/**
 * Point d'entree du serveur.
 *
 * Enchainement d'une requete :
 *
 *   1. contexte et en-tetes de securite
 *   2. fichiers statiques (budget de debit propre)
 *   3. limitation de debit generale, par adresse IP
 *   4. recherche de la route
 *      - aucune : coquille de l'espace de gestion, ou page d'erreur
 *        (budget de debit propre aux adresses inexistantes)
 *   5. session depuis le cookie
 *   6. controle d'origine et jeton CSRF pour toute requete mutante
 *   7. exigences de la route (session, role, debit propre)
 *   8. lecture et analyse du corps
 *   9. gestionnaire
 *  10. conversion de toute exception en reponse maitrisee
 *
 * Chaque etape refuse par defaut : une route sans annotation est protegee, un
 * corps de type inconnu est rejete, une exception inattendue ne divulgue rien.
 */
import http from 'node:http';
import { config, assertConfig, configWarnings } from './core/config.js';
import { log } from './core/logger.js';
import { AppError, erreurDeTypePostgres, erreurBaseIndisponible } from './core/errors.js';
import { Context } from './http/context.js';
import { checkOrigin, isSafeMethod, hostPourOrigine } from './http/security.js';
import { serveStatic, loadHtml } from './http/static.js';
import { enforceRouteRequirements } from './http/router.js';
import { parseBody } from './http/body.js';
import { consume, PROFILES } from './core/ratelimit.js';
import { SESSION_COOKIE, loadSession, touchSession, verifyCsrfToken, purgeExpiredSessions } from './core/session.js';
import { ping, closePool } from './db/index.js';
import { brancher, demarrerBattement, arreterBattement, fermerTout } from './core/flux.js';
import { chargerEtat, pourSalon, pourClient, pourPantalla } from './domain/file.js';
import { pageErreur } from './site/mise-en-page.js';
import { lireTous } from './core/reglages.js';
import { traduire, langueActive, t } from './core/langue.js';
import { deviseActive, DEVISES } from './core/devise.js';
import { escapeHtml } from './core/text.js';
import { buildRouter } from './app.js';
import { demarrerTaches, arreterTaches } from './core/taches.js';
import { signalerErreur } from './core/sentry.js';

const router = buildRouter();

// Le diffuseur temps reel ne connait ni la base ni les regles de la file : le
// domaine se branche dessus ici, une fois pour toutes.
brancher({
  etat: chargerEtat,
  projection: pourClient,
  projectionSalon: pourSalon,
  projectionPantalla: pourPantalla,
});

/** Une adresse dont le dernier segment porte une extension designe un fichier. */
const ressembleAUnFichier = (chemin) => /\.[A-Za-z0-9]{1,8}$/.test(chemin.split('/').pop() || '');

/**
 * LA COQUILLE DE L'ESPACE DE GESTION, DANS LA LANGUE DU SALON.
 *
 * C'est une application monopage : tout est construit par app.js. Mais la page
 * qui la porte doit deja dire sa langue — `<html lang>` gouverne la
 * prononciation des lecteurs d'ecran et la cesure des mots, et le script n'a
 * aucun autre moyen d'apprendre la langue : la politique de securite du contenu
 * interdit le moindre script en ligne, et un appel supplementaire au serveur
 * pour demander « quelle langue ? » retarderait le premier affichage.
 *
 * Les marqueurs sont remplis ici plutot que par un gabarit : il y en a cinq, et
 * une bibliotheque de modeles pour cinq substitutions serait une dependance
 * ajoutee a un projet qui n'en a qu'une.
 *
 * Si les reglages ne se lisent pas — base en train de demarrer, par exemple — la
 * coquille sort quand meme, dans la langue par defaut. Un coiffeur devant un
 * ecran blanc ne sait pas quoi faire ; devant une page en espagnol qui se
 * charge, il attend.
 */
async function coquilleGestion() {
  const brut = await loadHtml('gestion.html');
  if (!brut) return null;

  let nom = 'Peluquería HARON';
  try {
    const reglages = await lireTous();
    nom = reglages['salon.nom'] || nom;
  } catch {
    // On garde les valeurs par defaut : la langue active est celle du dernier
    // chargement reussi des reglages, ou l'espagnol au tout premier demarrage.
  }

  const tr = traduire(langueActive());
  const devise = deviseActive();
  const valeurs = {
    langue: tr.htmlLang,
    devise,
    symbole: DEVISES[devise].symbole,
    titre: tr('gestion.titrePage', { nom }),
    saut: tr('saut.contenu'),
    chargement: tr('gestion.chargement'),
  };
  return brut.replace(/\{\{(\w+)\}\}/g, (entier, cle) => (
    Object.hasOwn(valeurs, cle) ? escapeHtml(valeurs[cle]) : entier
  ));
}

const DERNIER_REFUS = new Map();
function premierRefusDeLaMinute(ip) {
  const maintenant = Date.now();
  const vu = DERNIER_REFUS.get(ip);
  if (vu && maintenant - vu < 60000) return false;
  if (DERNIER_REFUS.size >= 500) DERNIER_REFUS.clear();
  DERNIER_REFUS.set(ip, maintenant);
  return true;
}

export async function handle(ctx) {
  // --- 2. fichiers statiques
  if (ctx.method === 'GET' || ctx.method === 'HEAD') {
    const servi = await serveStatic(ctx, {
      avantEnvoi: () => {
        const limite = consume('statique:' + ctx.ipDebit, PROFILES.statique);
        if (!limite.allowed) {
          ctx.res.setHeader('Retry-After', String(limite.retryAfterSeconds));
          throw new AppError(429, t('http.tropDeDemandes'), { details: { retryAfter: limite.retryAfterSeconds } });
        }
      },
    });
    if (servi) return;
  }

  // --- 3. limitation de debit generale, par adresse IP
  const limit = consume('ip:' + ctx.ipDebit, PROFILES.standard);
  if (!limit.allowed) {
    ctx.res.setHeader('Retry-After', String(limit.retryAfterSeconds));
    if (premierRefusDeLaMinute(ctx.ip)) log.warn('Debit general atteint', { ip: ctx.ip, path: ctx.path });
    throw new AppError(429, t('http.tropDeDemandes'), { details: { retryAfter: limit.retryAfterSeconds } });
  }

  // --- 4. route
  const matched = router.match(ctx.method, ctx.path);
  if (!matched) {
    // Espace de gestion : application monopage, routee cote client.
    if ((ctx.method === 'GET' || ctx.method === 'HEAD')
      && (ctx.path === '/gestion' || ctx.path.startsWith('/gestion/'))
      && !ressembleAUnFichier(ctx.path)) {
      const coquille = await coquilleGestion();
      if (coquille) {
        ctx.res.setHeader('X-Robots-Tag', 'noindex, nofollow');
        ctx.html(200, coquille);
        return;
      }
    }
    const allowed = router.allowedMethods(ctx.path);
    if (allowed.length) {
      ctx.res.setHeader('Allow', allowed.join(', '));
      throw new AppError(405, t('http.methodeInterdite'));
    }

    // Aucune route, et ce n'est pas l'espace de gestion : c'est une adresse qui
    // n'existe pas. Un budget propre, bien plus etroit que le general, freine
    // les robots qui en essaient des centaines a la suite. Le drapeau sert
    // ensuite a journaliser ces 404 en « debug » plutot qu'en « info » : sans
    // cela, une seule exploration ecrit cent lignes et cache les vrais
    // evenements de la journee.
    ctx.routeInconnue = true;
    const inconnu = consume('inconnu:' + ctx.ipDebit, PROFILES.inconnu);
    if (!inconnu.allowed) {
      ctx.res.setHeader('Retry-After', String(inconnu.retryAfterSeconds));
      if (premierRefusDeLaMinute('inconnu:' + ctx.ipDebit)) {
        log.warn('Exploration d adresses inexistantes', { ip: ctx.ip, path: ctx.path });
      }
      throw new AppError(429, t('http.tropDeDemandes'), { details: { retryAfter: inconnu.retryAfterSeconds } });
    }
    throw new AppError(404, t('http.adresseInconnue'));
  }

  const { route, params } = matched;
  ctx.params = params;

  // --- 5. session
  const token = ctx.cookies[SESSION_COOKIE];
  if (token) {
    const loaded = await loadSession(token);
    if (loaded) {
      ctx.session = loaded.session;
      ctx.user = loaded.user;
      touchSession(loaded.session.id, loaded.session.lastSeenAt).catch(() => {});
    } else {
      ctx.clearCookie(SESSION_COOKIE);
    }
  }

  // --- 6. anti-CSRF
  if (!isSafeMethod(ctx.method)) {
    const origin = checkOrigin(ctx.req, hostPourOrigine(ctx.req));
    if (!origin.ok) {
      log.warn('Requete mutante refusee : origine invalide', { path: ctx.path, ip: ctx.ip, reason: origin.reason });
      throw new AppError(403, t('http.origineRefusee'), { code: 'ORIGINE_REFUSEE' });
    }
    // Une route publique n'a pas de session a detourner : le controle d'origine
    // et la limitation de debit la protegent.
    if (!route.options.skipCsrf && !route.options.public) {
      if (!ctx.session && token) {
        throw new AppError(401, t('http.sessionExpiree'), { code: 'SESSION_INVALIDE' });
      }
      if (!ctx.session || !verifyCsrfToken(ctx.session, ctx.req.headers['x-csrf-token'])) {
        throw new AppError(403, t('http.csrf'), { code: 'CSRF_INVALIDE' });
      }
    }
  }

  // --- 7. exigences de la route
  enforceRouteRequirements(route, ctx);
  if (route.options.rateLimit) {
    const cle = 'route:' + ctx.method + ':' + route.path + ':' + (ctx.user?.id || ctx.ipDebit);
    const r = consume(cle, route.options.rateLimit);
    if (!r.allowed) {
      ctx.res.setHeader('Retry-After', String(r.retryAfterSeconds));
      throw new AppError(429, t('http.tropDeDemandesOperation'), { details: { retryAfter: r.retryAfterSeconds } });
    }
  }

  // --- 8. corps
  if (!isSafeMethod(ctx.method)) {
    // Une image n'est lue que par une route qui l'a DECLAREE (`image: true`) :
    // partout ailleurs, un corps de plusieurs megaoctets est refuse avant d'etre
    // lu, comme avant.
    const parsed = await parseBody(ctx.req, {
      jsonLimit: config.http.bodyLimitBytes,
      imageLimit: route.options.image ? config.storage.imageMaxBytes : 0,
    });
    ctx.body = parsed.body;
    ctx.image = parsed.image ?? null;
  }

  // --- 9. gestionnaire
  await route.handler(ctx);
  if (!ctx.responded) {
    log.error('Gestionnaire sans reponse', { path: ctx.path, method: ctx.method });
    ctx.json(500, { error: { code: 'ERREUR', message: t('req.reponseManquante') } });
  }
}

/* ------------------------------------------------------------------ */
/*  Erreurs                                                            */
/* ------------------------------------------------------------------ */

const veutUnePage = (ctx) => !ctx.path.startsWith('/api/') && (ctx.method === 'GET' || ctx.method === 'HEAD')
  && String(ctx.req.headers.accept || '').includes('text/html');

export async function respondWithError(ctx, err) {
  if (ctx.responded) return;
  if (!(err instanceof AppError)) {
    const traduite = erreurDeTypePostgres(err) || erreurBaseIndisponible(err);
    if (traduite) {
      log.warn('Erreur traduite', { path: ctx.path, pgCode: err.code, status: traduite.status });
      if (traduite.status === 503) ctx.res.setHeader('Retry-After', '5');
      err = traduite;
    }
  }

  if (err instanceof AppError) {
    if (err.status === 401 || err.status === 403 || err.status === 429) {
      log.warn('Acces refuse', { status: err.status, path: ctx.path, method: ctx.method, ip: ctx.ip, user: ctx.user?.identifiant, message: err.message });
    }
    if (veutUnePage(ctx) && err.status >= 400) {
      const html = pageErreur({
        base: ctx.base,
        statut: err.status,
        titre: t(err.status === 404 ? 'erreur.pageIntrouvable' : 'erreur.unMoment'),
        message: err.message,
      });
      ctx.html(err.status, html);
      return;
    }
    ctx.json(err.status, { error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) } });
    return;
  }

  log.error('Erreur non geree', { requestId: ctx.requestId, path: ctx.path, method: ctx.method, user: ctx.user?.identifiant, error: err?.message, stack: err?.stack, pgCode: err?.code });
  // SEULES les erreurs non gerees partent chez Sentry. Un refus metier
  // (fauteuil occupe, numero invalide) n'est pas un incident : il nomme
  // parfois un client, et il n'a rien a faire chez un tiers.
  signalerErreur(err, {
    methode: ctx.method, chemin: ctx.path, requestId: ctx.requestId,
    utilisateur: ctx.user?.identifiant ?? null,
  });
  if (veutUnePage(ctx)) {
    ctx.html(500, pageErreur({
      base: ctx.base,
      statut: 500,
      titre: t('erreur.unMoment'),
      message: t('erreur.reessayer', { ref: ctx.requestId }),
    }));
    return;
  }
  ctx.json(500, {
    error: {
      code: 'ERREUR_SERVEUR',
      message: t('erreur.inattendue', { ref: ctx.requestId }),
      requestId: ctx.requestId,
    },
  });
}

/* ------------------------------------------------------------------ */
/*  Serveur                                                            */
/* ------------------------------------------------------------------ */

export function creerServeur() {
  const server = http.createServer((req, res) => {
    // CE QUI EST ICI EST HORS DE TOUT .catch() : une exception levee en
    // construisant le contexte remonterait jusqu'a « uncaughtException », qui
    // arrete le processus. Une cible « // » ou un Host « a:99999 » suffisaient
    // a faire tomber le salon, sans compte, en une requete. Plus jamais : une
    // requete qu'on ne sait pas lire recoit un 400, et le serveur continue.
    let ctx;
    try {
      ctx = new Context(req, res);
    } catch (err) {
      log.warn('Requete illisible', { error: err?.message });
      res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8', 'X-Content-Type-Options': 'nosniff', Connection: 'close' });
      res.end('400');
      return;
    }
    // UNE REPONSE QUI LAISSE LE CORPS NON LU FERME LA CONNEXION.
    //
    // Refusee AVANT la lecture du corps (mauvaise origine, 401, 429, route
    // inconnue), une requete laissait Node attendre le reste de ce corps pour
    // garder la connexion vivante. Annoncer 256 Ko et en envoyer un octet par
    // minute tenait alors le socket indefiniment — la borne de lecture de
    // readBody() ne joue que si on lit. On ferme proprement (FIN apres la
    // reponse), puis on coupe pour de bon si le client fait le mort.
    res.on('finish', () => {
      if (req.complete) return;
      const socket = req.socket;
      if (!socket || socket.destroyed) return;
      socket.end();
      setTimeout(() => socket.destroy(), 5000).unref?.();
    });
    handle(ctx)
      .catch((err) => respondWithError(ctx, err))
      .catch((err) => {
        log.error('Echec de la reponse d erreur', { error: err?.message });
        if (!res.headersSent) res.writeHead(500);
        res.end();
      })
      .finally(() => {
        if (!/\.(css|js|svg|png|jpg|jpeg|webp|ico|woff2)$/.test(ctx.path) || res.statusCode >= 400) {
          // Une adresse qui n'existe pas est du bruit de robot, pas un
          // evenement du salon : « debug », donc invisible en production.
          const ecrire = ctx.routeInconnue && res.statusCode === 404 ? log.debug : log.info;
          ecrire('requete', { method: ctx.method, path: ctx.path, status: res.statusCode, ms: ctx.elapsedMs, user: ctx.user?.identifiant || null, ip: ctx.ip });
        }
      });
  });
  server.headersTimeout = 20000;
  // Un flux d'evenements reste ouvert des heures : aucune borne de duree de
  // requete ne doit le couper. Les requetes ordinaires, elles, sont bornees par
  // headersTimeout et par la limite de taille du corps.
  server.requestTimeout = 0;
  server.keepAliveTimeout = 65000;
  server.maxHeadersCount = 60;
  return server;
}

async function start() {
  assertConfig();
  for (const warning of configWarnings()) log.warn('Configuration : ' + warning);
  try {
    const ms = await ping();
    log.info('Base de donnees joignable', { ms });
  } catch (err) {
    log.error('Base de donnees injoignable - demarrage interrompu', { error: err.message });
    process.exit(1);
  }

  const purge = setInterval(() => {
    purgeExpiredSessions().catch((err) => log.warn('Echec de la purge des sessions', { error: err.message }));
  }, 3600000);
  purge.unref?.();

  const server = creerServeur();
  server.listen(config.http.port, config.http.host, () => {
    log.info('Serveur demarre', { host: config.http.host, port: config.http.port, env: config.env, version: config.version });
    demarrerTaches();
    demarrerBattement();
    console.log('\n  Peluquería HARON — en écoute sur http://' + (config.http.host === '0.0.0.0' ? 'localhost' : config.http.host) + ':' + config.http.port + '\n');
  });

  let arret = false;
  const shutdown = (signal) => {
    if (arret) return;
    arret = true;
    log.info('Arret demande', { signal });
    arreterTaches();
    arreterBattement();
    // Les flux ouverts doivent etre fermes a la main : sans cela, server.close()
    // attend indefiniment des connexions qui, par nature, ne se terminent jamais.
    fermerTout();
    server.close(async () => {
      await closePool().catch(() => {});
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref?.();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('unhandledRejection', (reason) => {
    log.error('Promesse rejetee sans gestionnaire', { error: String(reason?.message || reason) });
    signalerErreur(reason instanceof Error ? reason : new Error(String(reason)));
  });
  process.on('uncaughtException', (err) => {
    log.error('Exception non capturee', { error: err.message, stack: err.stack });
    // Le processus va s'arreter : l'envoi part, mais on ne l'attend pas —
    // retarder l'arret d'un processus deja casse ne rend service a personne.
    signalerErreur(err);
    shutdown('uncaughtException');
  });
}

// Importe par les tests d'integration sans demarrer : ils creent leur propre serveur.
if (process.env.HARON_NE_PAS_DEMARRER !== '1') start();
