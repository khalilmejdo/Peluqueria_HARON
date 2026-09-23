/**
 * Contexte de requete : tout ce dont un gestionnaire de route a besoin,
 * regroupe dans un objet unique, plus les aides de reponse.
 */
import zlib from 'node:zlib';
import { randomToken, isUuid } from '../core/crypto.js';
import { sansOctetNul, isValidIsoDate } from '../core/text.js';
import { config } from '../core/config.js';
import { badRequest } from '../core/errors.js';
import { applySecurityHeaders, applyNoStore, clientIp, effectiveHost, effectiveProtocol, baseUrl } from './security.js';

/* ------------------------------------------------------------------ */
/*  Cookies                                                            */
/* ------------------------------------------------------------------ */

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of String(header).split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    if (!key) continue;
    try {
      out[key] = decodeURIComponent(part.slice(eq + 1).trim());
    } catch {
      out[key] = part.slice(eq + 1).trim();
    }
  }
  return out;
}

function serializeCookie(name, value, opts = {}) {
  const segments = [name + '=' + encodeURIComponent(value)];

  segments.push('Path=' + (opts.path || '/'));
  if (opts.maxAge !== undefined) segments.push('Max-Age=' + Math.floor(opts.maxAge));
  if (opts.expires) segments.push('Expires=' + opts.expires.toUTCString());
  if (opts.domain) segments.push('Domain=' + opts.domain);

  // HttpOnly : le cookie de session reste inaccessible a tout JavaScript.
  if (opts.httpOnly !== false) segments.push('HttpOnly');
  // Secure : le cookie ne circule qu'en HTTPS.
  if (opts.secure ?? config.security.secureCookies) segments.push('Secure');
  // SameSite=Strict : le cookie n'accompagne aucune requete venant d'un autre
  // site, ce qui neutralise la CSRF a la racine.
  segments.push('SameSite=' + (opts.sameSite || 'Strict'));

  return segments.join('; ');
}

/* ------------------------------------------------------------------ */
/*  Contexte                                                           */
/* ------------------------------------------------------------------ */

export class Context {
  /**
   * @param {import('node:http').IncomingMessage} req
   * @param {import('node:http').ServerResponse} res
   */
  constructor(req, res) {
    this.req = req;
    this.res = res;
    this.startedAt = Date.now();
    this.requestId = randomToken(9);

    this.method = String(req.method || 'GET').toUpperCase();

    const host = effectiveHost(req);
    const protocol = effectiveProtocol(req);
    const url = new URL(req.url || '/', protocol + '://' + (host || 'localhost'));

    this.host = host;
    this.protocol = protocol;
    this.url = url;
    // decodeURIComponent leve sur un echappement « % » mal forme. Cet appel est
    // dans le constructeur, hors du .catch() qui entoure handle(ctx) : une
    // exception ici serait non capturee et arreterait le serveur. Une seule
    // requete non authentifiee suffirait donc a le faire tomber.
    let chemin;
    try {
      chemin = decodeURIComponent(url.pathname);
    } catch {
      chemin = url.pathname;
    }
    this.path = chemin.replace(/\/+$/, '') || '/';
    this.searchParams = url.searchParams;
    this.ip = clientIp(req);
    this.userAgent = String(req.headers['user-agent'] || '').slice(0, 400);
    this.cookies = parseCookies(req.headers.cookie);

    /** @type {Record<string,string>} parametres de chemin (/:id) */
    this.params = {};
    /** @type {Record<string,any>} corps analyse */
    this.body = {};

    /** @type {object|null} membre du personnel authentifie */
    this.user = null;
    /** @type {object|null} session courante */
    this.session = null;

    this.responded = false;

    applySecurityHeaders(res, { kind: 'app' });
    res.setHeader('X-Request-Id', this.requestId);
  }

  /** Adresse publique de l'application (PUBLIC_URL si elle est posee). */
  get base() {
    return baseUrl(this.req);
  }

  /* ---------------- lecture des parametres ---------------- */

  /** Parametre d'adresse, sous forme de chaine nettoyee. */
  query(name, fallback = undefined) {
    const value = this.searchParams.get(name);
    if (value === null || value === '') return fallback;
    return sansOctetNul(value).trim();
  }

  /** Parametre d'adresse entier, borne (pagination : retomber sur le defaut est le bon geste). */
  queryInt(name, fallback, { min = -Infinity, max = Infinity } = {}) {
    const raw = this.searchParams.get(name);
    const n = Number.parseInt(raw ?? '', 10);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  }

  /** Parametre d'adresse entier, STRICT : un filtre ne se remplace jamais en silence. */
  queryEntier(name, { min = -Infinity, max = Infinity, fallback = null } = {}) {
    const raw = this.searchParams.get(name);
    if (raw === null || raw === '') return fallback;
    const texte = sansOctetNul(raw).trim();
    const n = /^[+-]?\d+$/.test(texte) ? Number(texte) : Number.NaN;
    if (!Number.isSafeInteger(n)) {
      throw badRequest('Le paramètre « ' + name + ' » doit être un nombre entier.', { fields: { [name]: 'Nombre entier attendu.' } });
    }
    if (n < min || n > max) {
      throw badRequest('Le paramètre « ' + name + ' » doit être compris entre ' + min + ' et ' + max + '.', { fields: { [name]: 'Entre ' + min + ' et ' + max + '.' } });
    }
    return n;
  }

  /** Parametre d'adresse identifiant (UUID) : absent -> undefined ; mal forme -> 400. */
  queryUuid(name) {
    const value = this.query(name);
    if (value === undefined) return undefined;
    if (!isUuid(value)) {
      throw badRequest('Le paramètre « ' + name + ' » n’est pas un identifiant valide.', { fields: { [name]: 'Identifiant invalide.' } });
    }
    return value;
  }

  /** Parametre d'adresse date « AAAA-MM-JJ » : absent -> undefined ; mal forme -> 400. */
  queryDate(name) {
    const value = this.query(name);
    if (value === undefined) return undefined;
    if (!isValidIsoDate(value)) {
      throw badRequest('Le paramètre « ' + name + ' » doit être une date au format AAAA-MM-JJ.', { fields: { [name]: 'Date attendue : AAAA-MM-JJ.' } });
    }
    return value;
  }

  queryBool(name, fallback = false) {
    const raw = this.searchParams.get(name);
    if (raw === null || raw === '') return fallback;
    return /^(1|true|oui|yes|on)$/i.test(raw);
  }

  /** Pagination normalisee et bornee. */
  pagination({ defaultLimit = 50, maxLimit = 200 } = {}) {
    const limit = this.queryInt('limit', defaultLimit, { min: 1, max: maxLimit });
    const page = this.queryInt('page', 1, { min: 1, max: 100000 });
    return { limit, page, offset: (page - 1) * limit };
  }

  /* ---------------- cookies ---------------- */

  setCookie(name, value, opts) {
    const previous = this.res.getHeader('Set-Cookie');
    const serialized = serializeCookie(name, value, opts);
    const list = previous ? (Array.isArray(previous) ? [...previous, serialized] : [previous, serialized]) : [serialized];
    this.res.setHeader('Set-Cookie', list);
  }

  clearCookie(name, opts = {}) {
    this.setCookie(name, '', { ...opts, maxAge: 0, expires: new Date(0) });
  }

  /* ---------------- reponses ---------------- */

  /**
   * Envoie un corps textuel, compresse quand le client l'accepte et que le gain
   * en vaut la peine. La page de suivi est ouverte au telephone, souvent en
   * 4G faible : zlib est dans Node, aucune dependance ajoutee.
   */
  envoyerTexte(status, body, entetes) {
    const encodage = this.method === 'HEAD' || body.length < 1024 ? null : this.encodageAccepte();
    if (!encodage) {
      this.res.writeHead(status, { ...entetes, 'Content-Length': body.length });
      this.res.end(this.method === 'HEAD' ? undefined : body);
      return;
    }
    const compresse = encodage === 'br'
      ? zlib.brotliCompressSync(body, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 5, [zlib.constants.BROTLI_PARAM_SIZE_HINT]: body.length } })
      : zlib.gzipSync(body, { level: 6 });
    this.res.writeHead(status, {
      ...entetes,
      'Content-Encoding': encodage,
      'Content-Length': compresse.length,
      Vary: entetes.Vary ? entetes.Vary + ', Accept-Encoding' : 'Accept-Encoding',
    });
    this.res.end(compresse);
  }

  /** Meilleur encodage accepte par le client, ou null. */
  encodageAccepte() {
    const accepte = String(this.req.headers['accept-encoding'] || '').toLowerCase();
    const jetons = accepte.split(',').map((x) => x.split(';')[0].trim());
    if (jetons.includes('br')) return 'br';
    if (jetons.includes('gzip')) return 'gzip';
    return null;
  }

  /** Reponse JSON. Les reponses d'API ne sont jamais mises en cache. */
  json(status, payload) {
    if (this.responded) return;
    this.responded = true;
    applySecurityHeaders(this.res, { kind: 'api' });
    applyNoStore(this.res);
    this.envoyerTexte(status, Buffer.from(JSON.stringify(payload ?? null), 'utf8'), { 'Content-Type': 'application/json; charset=utf-8' });
  }

  ok(payload) { this.json(200, payload); }
  created(payload) { this.json(201, payload); }

  noContent() {
    if (this.responded) return;
    this.responded = true;
    applyNoStore(this.res);
    this.res.writeHead(204);
    this.res.end();
  }

  /** Reponse HTML. `kind` ajuste la politique de securite du contenu. */
  html(status, markup, { kind = 'app', noStore = true, entetes = {} } = {}) {
    if (this.responded) return;
    this.responded = true;
    applySecurityHeaders(this.res, { kind });
    if (noStore) applyNoStore(this.res);
    this.envoyerTexte(status, Buffer.from(markup, 'utf8'), { 'Content-Type': 'text/html; charset=utf-8', ...entetes });
  }

  text(status, content) {
    if (this.responded) return;
    this.responded = true;
    applyNoStore(this.res);
    this.envoyerTexte(status, Buffer.from(String(content), 'utf8'), { 'Content-Type': 'text/plain; charset=utf-8' });
  }

  /**
   * Envoi d'un fichier (SVG ou PNG du QR Code).
   * Le nom de fichier est assaini : il ne doit jamais permettre d'injecter un
   * en-tete supplementaire dans la reponse.
   */
  file(buffer, { filename, mimeType = 'application/octet-stream', download = true, cache = null } = {}) {
    if (this.responded) return;
    this.responded = true;
    if (cache) this.res.setHeader('Cache-Control', cache);
    else applyNoStore(this.res);
    const safeName = String(filename || 'fichier')
      .replace(/[\r\n"\\]/g, '')
      .replace(/[^\w .\-()]/g, '_')
      .slice(0, 120);
    this.res.writeHead(200, {
      'Content-Type': mimeType,
      'Content-Length': buffer.length,
      'Content-Disposition': (download ? 'attachment' : 'inline') + '; filename="' + safeName + '"; filename*=UTF-8\'\'' + encodeURIComponent(safeName),
      'X-Content-Type-Options': 'nosniff',
    });
    this.res.end(this.method === 'HEAD' ? undefined : buffer);
  }

  /**
   * Ouvre un flux d'evenements (Server-Sent Events).
   *
   * Le suivi doit se mettre a jour tout seul, sur un telephone posé sur une
   * table, parfois pendant une heure. SSE tient cela avec une seule connexion
   * sortante, se reconnecte de lui-meme et traverse les proxys HTTP ordinaires,
   * la ou un WebSocket demande une negociation particuliere a chaque relais.
   *
   * X-Accel-Buffering coupe la mise en tampon de nginx : sans lui, les messages
   * arrivent par paquets de plusieurs kilo-octets, c'est-a-dire jamais.
   */
  ouvrirFlux() {
    if (this.responded) return null;
    this.responded = true;
    applySecurityHeaders(this.res, { kind: 'api' });
    this.res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    // Un commentaire initial ouvre le flux tout de suite cote navigateur.
    this.res.write(': ouvert\n\n');
    this.res.flushHeaders?.();
    return this.res;
  }

  /** Redirection interne. Toute cible externe est refusee. */
  redirect(location, status = 302) {
    if (this.responded) return;
    this.responded = true;
    const target = String(location);
    const safe = target.startsWith('/') && !target.startsWith('//') ? target : '/';
    this.res.writeHead(status, { Location: safe });
    this.res.end();
  }

  /** Duree de traitement de la requete, en millisecondes. */
  get elapsedMs() {
    return Date.now() - this.startedAt;
  }
}
