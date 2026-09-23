/**
 * Sessions du personnel et jetons CSRF.
 *
 *   - Le jeton de session (256 bits) voyage dans un cookie HttpOnly + Secure +
 *     SameSite=Strict. La base n'en garde que le condensat SHA-256.
 *   - Deux expirations : inactivite (glissante) et duree absolue. Elles sont
 *     larges ici : le coiffeur laisse sa tablette ouverte toute la journee.
 *   - Le jeton est renouvele a chaque connexion : pas de fixation de session.
 *   - Le jeton CSRF est derive de la session par HMAC : un site tiers ne peut
 *     pas le deviner, et il meurt avec la session.
 */
import { newId, randomToken, hashToken, sign, timingSafeEqual } from './crypto.js';
import { config } from './config.js';
import { all, one, execute } from '../db/index.js';
import { log } from './logger.js';

export const SESSION_COOKIE = 'haron_session';

export async function createSession(utilisateurId, { ip, userAgent } = {}) {
  const sessionId = newId();
  const token = randomToken(32);
  const csrfSecret = randomToken(32);
  const expiresAt = new Date(Date.now() + config.security.sessionAbsoluteMs);
  await execute(
    `INSERT INTO sessions (id, utilisateur_id, token_hash, csrf_secret, ip, user_agent, expires_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [sessionId, utilisateurId, hashToken(token), csrfSecret, ip ?? null, userAgent ?? null, expiresAt],
  );
  return { sessionId, token, csrfToken: makeCsrfToken(sessionId, csrfSecret), expiresAt };
}

/**
 * Charge la session et le compte depuis le jeton du cookie. Rend null si le
 * jeton est inconnu, revoque, expire, ou si le compte a ete desactive ou
 * verrouille entre-temps.
 */
export async function loadSession(token) {
  if (!token || typeof token !== 'string' || token.length < 20 || token.length > 200) return null;
  const row = await one(
    `SELECT s.id AS session_id, s.csrf_secret, s.created_at, s.last_seen_at, s.expires_at,
            u.id AS utilisateur_id, u.identifiant, u.nom_complet, u.role, u.actif,
            u.doit_changer_mot_de_passe, u.verrouille_jusqu_a
       FROM sessions s
       JOIN utilisateurs u ON u.id = s.utilisateur_id
      WHERE s.token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > now()`,
    [hashToken(token)],
  );
  if (!row) return null;

  if (Date.now() - new Date(row.last_seen_at).getTime() > config.security.sessionIdleMs) {
    await revokeSession(row.session_id, 'expiration par inactivité');
    return null;
  }
  if (!row.actif) {
    await revokeSession(row.session_id, 'compte désactivé');
    return null;
  }
  if (row.verrouille_jusqu_a && new Date(row.verrouille_jusqu_a).getTime() > Date.now()) {
    await revokeSession(row.session_id, 'compte verrouillé');
    return null;
  }

  return {
    session: {
      id: row.session_id,
      csrfSecret: row.csrf_secret,
      createdAt: row.created_at,
      lastSeenAt: row.last_seen_at,
      expiresAt: row.expires_at,
    },
    user: {
      id: row.utilisateur_id,
      identifiant: row.identifiant,
      nomComplet: row.nom_complet,
      role: row.role,
      actif: row.actif,
      doitChangerMotDePasse: row.doit_changer_mot_de_passe,
    },
  };
}

/** Expiration glissante, ecrite au plus une fois par minute. */
export async function touchSession(sessionId, lastSeenAt) {
  if (Date.now() - new Date(lastSeenAt).getTime() < 60000) return;
  try {
    await execute('UPDATE sessions SET last_seen_at = now() WHERE id = $1', [sessionId]);
  } catch (err) {
    log.warn('Impossible de prolonger la session', { error: err.message });
  }
}

export async function revokeSession(sessionId, reason = 'déconnexion') {
  await execute('UPDATE sessions SET revoked_at = now(), revoked_reason = $2 WHERE id = $1 AND revoked_at IS NULL', [sessionId, reason]);
}

/** Revoque toutes les sessions d'un compte (mot de passe change, desactivation). */
export async function revokeAllUserSessions(utilisateurId, reason, { exceptSessionId = null } = {}) {
  if (exceptSessionId) {
    return execute(
      'UPDATE sessions SET revoked_at = now(), revoked_reason = $2 WHERE utilisateur_id = $1 AND revoked_at IS NULL AND id <> $3',
      [utilisateurId, reason, exceptSessionId],
    );
  }
  return execute('UPDATE sessions SET revoked_at = now(), revoked_reason = $2 WHERE utilisateur_id = $1 AND revoked_at IS NULL', [utilisateurId, reason]);
}

export async function listActiveSessions(utilisateurId) {
  return all(
    `SELECT id, ip, user_agent, created_at, last_seen_at, expires_at FROM sessions
      WHERE utilisateur_id = $1 AND revoked_at IS NULL AND expires_at > now() ORDER BY last_seen_at DESC`,
    [utilisateurId],
  );
}

export async function purgeExpiredSessions() {
  return execute(
    `DELETE FROM sessions WHERE expires_at < now() - interval '30 days'
        OR (revoked_at IS NOT NULL AND revoked_at < now() - interval '30 days')`,
  );
}

export function makeCsrfToken(sessionId, csrfSecret) {
  return sign(sessionId + ':' + csrfSecret);
}

export function verifyCsrfToken(session, provided) {
  if (!session || !provided || typeof provided !== 'string') return false;
  return timingSafeEqual(makeCsrfToken(session.id, session.csrfSecret), provided);
}
