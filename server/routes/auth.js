/**
 * Connexion du personnel.
 *
 * Un salon, deux ou trois comptes. La protection tient a trois choses :
 *   - le debit par adresse IP, qui arrete un robot ;
 *   - le verrouillage du compte apres plusieurs echecs, qui arrete le bourrage
 *     d'identifiants meme depuis mille adresses differentes ;
 *   - un temps de reponse identique pour un identifiant inconnu et un mot de
 *     passe faux, qui empeche de deviner quels comptes existent.
 */
import { Router } from '../http/router.js';
import { validate } from '../core/validate.js';
import { one, execute, transaction } from '../db/index.js';
import { config } from '../core/config.js';
import { log } from '../core/logger.js';
import { unauthorized, AppError, badRequest } from '../core/errors.js';
import { verifyPassword, hashPassword, needsRehash, DerivationImpossible, DUMMY_HASH } from '../core/crypto.js';
import { PROFILES } from '../core/ratelimit.js';
import {
  SESSION_COOKIE, createSession, revokeSession, revokeAllUserSessions,
  makeCsrfToken, listActiveSessions,
} from '../core/session.js';
import { role as roleParCode } from '../core/roles.js';
import { t } from '../core/langue.js';

export const authRoutes = new Router();

/**
 * Le meme refus pour un identifiant inconnu et pour un mot de passe faux.
 *
 * C'est une FONCTION, pas une constante de module : une constante serait
 * evaluee au chargement du fichier et figerait la phrase dans la langue du
 * demarrage. Un salon passe en francais aurait continue a refuser en espagnol
 * jusqu'au prochain redemarrage — sur l'ecran de connexion, c'est-a-dire le
 * premier ecran que voit le personnel.
 */
const refus = () => t('acces.identifiantsIncorrects');

function profil(user, csrfToken) {
  return {
    utilisateur: {
      id: user.id,
      identifiant: user.identifiant,
      nomComplet: user.nomComplet ?? user.nom_complet,
      role: user.role,
      roleLibelle: roleParCode(user.role)?.libelle ?? user.role,
      doitChangerMotDePasse: user.doitChangerMotDePasse ?? user.doit_changer_mot_de_passe ?? false,
    },
    csrfToken,
    /*
     * LA LONGUEUR MINIMALE VIENT DU SERVEUR, ET DE LUI SEUL.
     *
     * Elle etait ecrite « 12 » en dur a trois endroits du navigateur : le
     * `minlength` du champ, la phrase d'aide sous le champ, et l'invite de
     * reinitialisation. Un deploiement qui remonte PASSWORD_MIN_LENGTH les
     * aurait tous les trois laisses mentir, et le gerant aurait vu son mot de
     * passe refuse par un serveur qui demandait plus que ce que l'ecran annoncait.
     */
    motDePasseMin: config.security.passwordMinLength,
  };
}

/**
 * Connexion.
 *
 * `skipCsrf` : il n'y a pas encore de session, donc pas de jeton a verifier.
 * Le controle d'origine, lui, s'applique bien (voir server/index.js).
 */
authRoutes.post('/login', async (ctx) => {
  const data = validate(ctx.body, {
    identifiant: { type: 'string', required: true, max: 60, lower: true },
    motDePasse: { type: 'string', required: true, max: 200, trim: false },
  });

  const ligne = await one(
    `SELECT id, identifiant, nom_complet, mot_de_passe_hash, role, actif,
            doit_changer_mot_de_passe, tentatives_echouees, verrouille_jusqu_a
       FROM utilisateurs WHERE identifiant_lower = $1`,
    [data.identifiant],
  );

  if (ligne?.verrouille_jusqu_a && new Date(ligne.verrouille_jusqu_a).getTime() > Date.now()) {
    const minutes = Math.ceil((new Date(ligne.verrouille_jusqu_a).getTime() - Date.now()) / 60000);
    throw new AppError(429, t('acces.compteBloque', { n: minutes }), { code: 'COMPTE_VERROUILLE' });
  }

  let correct = false;
  try {
    // Un identifiant inconnu coute le meme temps qu'un mot de passe faux :
    // sinon, la duree de la reponse dirait a l'attaquant quels comptes existent.
    correct = await verifyPassword(data.motDePasse, ligne?.mot_de_passe_hash || DUMMY_HASH);
  } catch (err) {
    if (err instanceof DerivationImpossible) {
      log.error('Verification du mot de passe impossible', { error: err.message });
      // Un incident machine n'est PAS une tentative ratee : ne pas verrouiller.
      throw new AppError(503, t('acces.serviceIndisponible'));
    }
    throw err;
  }

  if (!ligne || !correct) {
    if (ligne) await compterEchec(ligne);
    log.warn('Connexion refusee', { identifiant: data.identifiant, ip: ctx.ip });
    throw unauthorized(refus());
  }
  if (!ligne.actif) throw unauthorized(refus());

  const session = await transaction(async (tx) => {
    await tx.execute(
      'UPDATE utilisateurs SET tentatives_echouees = 0, verrouille_jusqu_a = NULL, derniere_connexion_at = now() WHERE id = $1',
      [ligne.id],
    );
    if (needsRehash(ligne.mot_de_passe_hash)) {
      await tx.execute('UPDATE utilisateurs SET mot_de_passe_hash = $2 WHERE id = $1', [ligne.id, await hashPassword(data.motDePasse)]);
    }
    return null;
  }).then(() => createSession(ligne.id, { ip: ctx.ip, userAgent: ctx.userAgent }));

  ctx.setCookie(SESSION_COOKIE, session.token, { maxAge: Math.floor(config.security.sessionAbsoluteMs / 1000) });
  log.info('Connexion reussie', { identifiant: ligne.identifiant, ip: ctx.ip });
  ctx.ok(profil({
    id: ligne.id,
    identifiant: ligne.identifiant,
    nomComplet: ligne.nom_complet,
    role: ligne.role,
    doitChangerMotDePasse: ligne.doit_changer_mot_de_passe,
  }, session.csrfToken));
}, { public: true, skipCsrf: true, rateLimit: PROFILES.login });

async function compterEchec(ligne) {
  const tentatives = (ligne.tentatives_echouees || 0) + 1;
  if (tentatives >= config.security.loginMaxAttempts) {
    await execute(
      'UPDATE utilisateurs SET tentatives_echouees = $2, verrouille_jusqu_a = now() + make_interval(secs => $3) WHERE id = $1',
      [ligne.id, tentatives, Math.round(config.security.loginLockoutMs / 1000)],
    );
    log.warn('Compte verrouille apres plusieurs echecs', { identifiant: ligne.identifiant, tentatives });
  } else {
    await execute('UPDATE utilisateurs SET tentatives_echouees = $2 WHERE id = $1', [ligne.id, tentatives]);
  }
}

/** L'etat de la session courante : appele au chargement de l'espace de gestion. */
authRoutes.get('/session', async (ctx) => {
  if (!ctx.user || !ctx.session) {
    ctx.ok({ utilisateur: null, csrfToken: null, motDePasseMin: config.security.passwordMinLength });
    return;
  }
  ctx.ok(profil(ctx.user, makeCsrfToken(ctx.session.id, ctx.session.csrfSecret)));
}, { public: true });

authRoutes.post('/logout', async (ctx) => {
  if (ctx.session) await revokeSession(ctx.session.id, t('trace.deconnexion'));
  ctx.clearCookie(SESSION_COOKIE);
  ctx.noContent();
}, { allowDuringPasswordChange: true });

/** Changement de mot de passe : toutes les autres sessions du compte tombent. */
authRoutes.post('/mot-de-passe', async (ctx) => {
  const data = validate(ctx.body, {
    actuel: { type: 'string', required: true, max: 200, trim: false },
    nouveau: { type: 'string', required: true, max: 200, trim: false },
  });

  if (data.nouveau.length < config.security.passwordMinLength) {
    throw badRequest(t('acces.motDePasseCourt', { min: config.security.passwordMinLength }),
      { fields: { nouveau: t('compte.minCaracteres', { min: config.security.passwordMinLength }) } });
  }
  if (data.nouveau === data.actuel) {
    throw badRequest(t('acces.motDePasseIdentique'), { fields: { nouveau: t('acces.motDePasseIdentiqueChamp') } });
  }

  const ligne = await one('SELECT mot_de_passe_hash FROM utilisateurs WHERE id = $1', [ctx.user.id]);
  if (!ligne || !(await verifyPassword(data.actuel, ligne.mot_de_passe_hash))) {
    throw unauthorized(t('acces.motDePasseActuelFaux'));
  }

  const hash = await hashPassword(data.nouveau);
  await execute(
    'UPDATE utilisateurs SET mot_de_passe_hash = $2, doit_changer_mot_de_passe = FALSE WHERE id = $1',
    [ctx.user.id, hash],
  );
  await revokeAllUserSessions(ctx.user.id, t('trace.motDePasseChange'), { exceptSessionId: ctx.session?.id ?? null });
  log.info('Mot de passe change', { identifiant: ctx.user.identifiant });
  ctx.ok({ ok: true });
}, { allowDuringPasswordChange: true, rateLimit: PROFILES.administration });

/** Les appareils actuellement connectes sur ce compte. */
authRoutes.get('/sessions', async (ctx) => {
  const lignes = await listActiveSessions(ctx.user.id);
  ctx.ok({
    items: lignes.map((s) => ({
      id: s.id,
      courante: s.id === ctx.session?.id,
      ip: s.ip,
      appareil: String(s.user_agent || '').slice(0, 120),
      depuis: s.created_at,
      vueA: s.last_seen_at,
      expireA: s.expires_at,
    })),
  });
});

authRoutes.post('/sessions/fermer-les-autres', async (ctx) => {
  const n = await revokeAllUserSessions(ctx.user.id, t('trace.deconnexionDemandee'), { exceptSessionId: ctx.session?.id ?? null });
  ctx.ok({ fermees: n });
}, { rateLimit: PROFILES.administration });
