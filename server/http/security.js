/**
 * En-tetes de securite HTTP, controle d'origine et adresse du client.
 *
 * La politique de securite du contenu est stricte : ni script en ligne, ni
 * style en ligne, ni ressource externe. Polices, styles, scripts et images sont
 * servis depuis la meme origine. Une faille d'echappement qui passerait entre
 * les mailles ne suffirait donc pas a executer un script.
 */
import { config } from '../core/config.js';

const APP_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  // Le suivi temps reel passe par un flux SSE de la meme origine.
  "connect-src 'self'",
  "media-src 'none'",
  "object-src 'none'",
  // Un seul cadre tiers, et un seul : la carte OpenStreetMap de la vitrine.
  // Elle ne se charge QUE lorsque le visiteur appuie sur « Afficher la carte »
  // (voir accueil.js) : rien ne part vers un tiers avant qu'il l'ait demande.
  "frame-src https://www.openstreetmap.org",
  "frame-ancestors 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "worker-src 'self'",
  "manifest-src 'self'",
].join('; ');

/** @param {{ kind?: 'app'|'api' }} [opts] */
export function applySecurityHeaders(res, { kind = 'app' } = {}) {
  if (kind === 'api') res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
  else res.setHeader('Content-Security-Policy', APP_CSP);

  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  res.setHeader('Permissions-Policy', 'accelerometer=(), camera=(), geolocation=(), gyroscope=(), microphone=(), payment=(), usb=(), interest-cohort=()');
  if (config.security.enableHsts) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.removeHeader('X-Powered-By');
}

export function applyNoStore(res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
}

/* ------------------------------------------------------------------ */
/*  Controle d'origine (premiere barriere anti-CSRF)                   */
/* ------------------------------------------------------------------ */

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
export const isSafeMethod = (method) => SAFE_METHODS.has(String(method).toUpperCase());

/**
 * Verifie qu'une requete mutante provient bien de l'application.
 * @param {import('node:http').IncomingMessage} req
 * @param {string} host  hote pris dans l'en-tete Host seul (voir hostPourOrigine)
 */
export function checkOrigin(req, host) {
  if (isSafeMethod(req.method)) return { ok: true };
  const allowed = new Set(config.http.allowedOrigins);
  if (config.http.publicUrl) {
    try {
      allowed.add(new URL(config.http.publicUrl).origin);
    } catch {
      // PUBLIC_URL invalide : deja signale par la validation de configuration.
    }
  }
  if (host) {
    allowed.add('https://' + host);
    if (!config.security.secureCookies) allowed.add('http://' + host);
  }
  const origin = req.headers.origin;
  if (origin) return allowed.has(origin) ? { ok: true } : { ok: false, reason: 'Origine non autorisee : ' + origin };
  const referer = req.headers.referer;
  if (referer) {
    try {
      const refOrigin = new URL(referer).origin;
      return allowed.has(refOrigin) ? { ok: true } : { ok: false, reason: 'Referent non autorise : ' + refOrigin };
    } catch {
      return { ok: false, reason: 'Referent illisible.' };
    }
  }
  return { ok: false, reason: 'Origine de la requete absente.' };
}

/**
 * L'hote qui sert au controle d'origine : l'en-tete Host seul.
 * X-Forwarded-Host est ecrit par le client et souvent relaye tel quel ; le
 * croire ici laisserait l'attaquant choisir l'origine acceptee.
 */
export function hostPourOrigine(req) {
  const host = String(req.headers.host || '').split(',')[0].trim();
  return /^[a-zA-Z0-9.\-:[\]]+$/.test(host) ? host : '';
}

/* ------------------------------------------------------------------ */
/*  Adresse du client                                                  */
/* ------------------------------------------------------------------ */

/**
 * L'adresse du client dans X-Forwarded-For. Le proxy AJOUTE l'adresse qu'il
 * voit en fin de chaine : le premier element est ecrit par le client et ne vaut
 * rien. On compte depuis la fin, un element par proxy de confiance. Une chaine
 * plus courte que prevu ne contient rien de fiable : null.
 */
export function adresseDepuisChaine(entete, sauts = 1) {
  if (!entete) return null;
  const chaine = (Array.isArray(entete) ? entete.join(',') : String(entete)).split(',').map((a) => a.trim()).filter(Boolean);
  const index = chaine.length - Math.max(1, Math.trunc(Number(sauts) || 1));
  return index < 0 ? null : chaine[index];
}

export function adresseCliente({ trustProxy, trustRealIp = false, sauts = 1, xForwardedFor, xRealIp, socket }) {
  if (trustProxy) {
    const depuisChaine = adresseDepuisChaine(xForwardedFor, sauts);
    if (depuisChaine) return depuisChaine;
    if (trustRealIp && xRealIp) {
      const premiere = String(Array.isArray(xRealIp) ? xRealIp[0] : xRealIp).split(',')[0].trim();
      if (premiere) return premiere;
    }
  }
  return socket || 'inconnue';
}

export function clientIp(req) {
  return adresseCliente({
    trustProxy: config.http.trustProxy,
    trustRealIp: config.http.trustRealIp,
    sauts: config.http.trustProxyHops,
    xForwardedFor: req.headers['x-forwarded-for'],
    xRealIp: req.headers['x-real-ip'],
    socket: req.socket?.remoteAddress,
  });
}

/**
 * La cle de DEBIT d'une adresse : elle-meme en IPv4, son /64 en IPv6.
 *
 * Un abonnement IPv6 recoit un /64 entier — dix-huit milliards de milliards
 * d'adresses — et en change a volonte. Compte adresse par adresse, chaque
 * limite par IP (prise de tour, suivi, connexion) tombait des que le domaine
 * avait un enregistrement AAAA. Le /64 est l'unite qu'un client controle :
 * c'est elle qu'on compte. Les journaux gardent l'adresse complete.
 */
export function cleDeDebit(ip) {
  const s = String(ip || '');
  if (!s.includes(':') || /^::ffff:\d+\.\d+\.\d+\.\d+$/i.test(s)) return s.replace(/^::ffff:/i, '');
  // Forme developpee des quatre premiers groupes, « :: » compris.
  const [tete, queue = ''] = s.split('::');
  const avant = tete ? tete.split(':') : [];
  const apres = queue ? queue.split(':') : [];
  const groupes = s.includes('::')
    ? [...avant, ...new Array(Math.max(0, 8 - avant.length - apres.length)).fill('0'), ...apres]
    : avant;
  return groupes.slice(0, 4).map((g) => (g || '0').toLowerCase().replace(/^0+(?=.)/, '')).join(':') + '::/64';
}

/** Hote effectif (pour construire des adresses), valide contre les caracteres inattendus. */
export function effectiveHost(req) {
  const raw = config.http.trustProxy ? req.headers['x-forwarded-host'] || req.headers.host : req.headers.host;
  const host = String(raw || '').split(',')[0].trim();
  return /^[a-zA-Z0-9.\-:[\]]+$/.test(host) ? host : '';
}

export function effectiveProtocol(req) {
  if (config.http.trustProxy) {
    const proto = req.headers['x-forwarded-proto'];
    if (proto) {
      const p = String(proto).split(',')[0].trim().toLowerCase();
      if (p === 'http' || p === 'https') return p;
    }
  }
  return req.socket?.encrypted ? 'https' : 'http';
}

/**
 * L'adresse publique de l'application.
 *
 * PUBLIC_URL fait foi : c'est elle qui est encodee dans le QR Code colle dans
 * la vitrine, et ce QR Code est imprime une fois pour toutes. A defaut, on
 * retombe sur l'hote vu dans la requete.
 */
export function baseUrl(req) {
  if (config.http.publicUrl) return config.http.publicUrl;
  const host = effectiveHost(req) || 'localhost:' + config.http.port;
  return effectiveProtocol(req) + '://' + host;
}
