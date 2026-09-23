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
import { chargerEtat, pourSalon, pourClient } from './domain/file.js';
import { pageErreur } from './site/mise-en-page.js';
import { buildRouter } from './app.js';
import { demarrerTaches, arreterTaches } from './core/taches.js';

const router = buildRouter();

// Le diffuseur temps reel ne connait ni la base ni les regles de la file : le
// domaine se branche dessus ici, une fois pour toutes.
brancher({ etat: chargerEtat, projection: pourClient, projectionSalon: pourSalon });

/** Une adresse dont le dernier segment porte une extension designe un fichier. */
const ressembleAUnFichier = (chemin) => /\.[A-Za-z0-9]{1,8}$/.test(chemin.split('/').pop() || '');

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
        const limite = consume('statique:' + ctx.ip, PROFILES.statique);
        if (!limite.allowed) {
          ctx.res.setHeader('Retry-After', String(limite.retryAfterSeconds));
          throw new AppError(429, 'Trop de requêtes. Patientez quelques instants.', { details: { retryAfter: limite.retryAfterSeconds } });
        }
      },
    });
    if (servi) return;
  }

  // --- 3. limitation de debit generale, par adresse IP
  const limit = consume('ip:' + ctx.ip, PROFILES.standard);
  if (!limit.allowed) {
    ctx.res.setHeader('Retry-After', String(limit.retryAfterSeconds));
    if (premierRefusDeLaMinute(ctx.ip)) log.warn('Debit general atteint', { ip: ctx.ip, path: ctx.path });
    throw new AppError(429, 'Trop de requêtes. Patientez quelques instants.', { details: { retryAfter: limit.retryAfterSeconds } });
  }

  // --- 4. route
  const matched = router.match(ctx.method, ctx.path);
  if (!matched) {
    // Espace de gestion : application monopage, routee cote client.
    if ((ctx.method === 'GET' || ctx.method === 'HEAD')
      && (ctx.path === '/gestion' || ctx.path.startsWith('/gestion/'))
      && !ressembleAUnFichier(ctx.path)) {
      const coquille = await loadHtml('gestion.html');
      if (coquille) {
        ctx.res.setHeader('X-Robots-Tag', 'noindex, nofollow');
        ctx.html(200, coquille);
        return;
      }
    }
    const allowed = router.allowedMethods(ctx.path);
    if (allowed.length) {
      ctx.res.setHeader('Allow', allowed.join(', '));
      throw new AppError(405, 'Méthode non autorisée pour cette adresse.');
    }
    throw new AppError(404, 'Adresse inconnue.');
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
      throw new AppError(403, 'Requête refusée : origine non reconnue.', { code: 'ORIGINE_REFUSEE' });
    }
    // Une route publique n'a pas de session a detourner : le controle d'origine
    // et la limitation de debit la protegent.
    if (!route.options.skipCsrf && !route.options.public) {
      if (!ctx.session && token) {
        throw new AppError(401, 'Votre session a expiré ou a été fermée : reconnectez-vous.', { code: 'SESSION_INVALIDE' });
      }
      if (!ctx.session || !verifyCsrfToken(ctx.session, ctx.req.headers['x-csrf-token'])) {
        throw new AppError(403, 'Jeton de sécurité absent ou invalide. Rechargez la page.', { code: 'CSRF_INVALIDE' });
      }
    }
  }

  // --- 7. exigences de la route
  enforceRouteRequirements(route, ctx);
  if (route.options.rateLimit) {
    const cle = 'route:' + ctx.method + ':' + route.path + ':' + (ctx.user?.id || ctx.ip);
    const r = consume(cle, route.options.rateLimit);
    if (!r.allowed) {
      ctx.res.setHeader('Retry-After', String(r.retryAfterSeconds));
      throw new AppError(429, 'Trop de demandes sur cette opération. Patientez un instant.', { details: { retryAfter: r.retryAfterSeconds } });
    }
  }

  // --- 8. corps
  if (!isSafeMethod(ctx.method)) {
    const parsed = await parseBody(ctx.req, { jsonLimit: config.http.bodyLimitBytes });
    ctx.body = parsed.body;
  }

  // --- 9. gestionnaire
  await route.handler(ctx);
  if (!ctx.responded) {
    log.error('Gestionnaire sans reponse', { path: ctx.path, method: ctx.method });
    ctx.json(500, { error: { code: 'ERREUR', message: 'Réponse absente du serveur.' } });
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
        titre: err.status === 404 ? 'Page introuvable' : 'Un instant',
        message: err.message,
      });
      ctx.html(err.status, html);
      return;
    }
    ctx.json(err.status, { error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) } });
    return;
  }

  log.error('Erreur non geree', { requestId: ctx.requestId, path: ctx.path, method: ctx.method, user: ctx.user?.identifiant, error: err?.message, stack: err?.stack, pgCode: err?.code });
  if (veutUnePage(ctx)) {
    ctx.html(500, pageErreur({
      base: ctx.base,
      statut: 500,
      titre: 'Une erreur est survenue',
      message: 'Réessayez dans un instant. Si le problème persiste, communiquez la référence ' + ctx.requestId + ' au salon.',
    }));
    return;
  }
  ctx.json(500, {
    error: {
      code: 'ERREUR_SERVEUR',
      message: 'Une erreur inattendue est survenue. Si elle persiste, communiquez la référence ' + ctx.requestId + ' à votre administrateur.',
      requestId: ctx.requestId,
    },
  });
}

/* ------------------------------------------------------------------ */
/*  Serveur                                                            */
/* ------------------------------------------------------------------ */

export function creerServeur() {
  const server = http.createServer((req, res) => {
    const ctx = new Context(req, res);
    handle(ctx)
      .catch((err) => respondWithError(ctx, err))
      .catch((err) => {
        log.error('Echec de la reponse d erreur', { error: err?.message });
        if (!res.headersSent) res.writeHead(500);
        res.end();
      })
      .finally(() => {
        if (!/\.(css|js|svg|png|jpg|jpeg|webp|ico|woff2)$/.test(ctx.path) || res.statusCode >= 400) {
          log.info('requete', { method: ctx.method, path: ctx.path, status: res.statusCode, ms: ctx.elapsedMs, user: ctx.user?.identifiant || null, ip: ctx.ip });
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
  process.on('unhandledRejection', (reason) => log.error('Promesse rejetee sans gestionnaire', { error: String(reason?.message || reason) }));
  process.on('uncaughtException', (err) => {
    log.error('Exception non capturee', { error: err.message, stack: err.stack });
    shutdown('uncaughtException');
  });
}

// Importe par les tests d'integration sans demarrer : ils creent leur propre serveur.
if (process.env.HARON_NE_PAS_DEMARRER !== '1') start();
