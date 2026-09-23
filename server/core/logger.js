/**
 * Journalisation structuree (une ligne JSON par evenement).
 *
 * Les cles sensibles sont expurgees avant ecriture : un mot de passe, un jeton
 * de suivi ou un numero WhatsApp ne doit jamais finir dans un fichier de
 * journal que tout exploitant peut lire.
 */
import { config } from './config.js';
import { sansAccents } from './text.js';

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const threshold = LEVELS[String(process.env.LOG_LEVEL || '').toLowerCase()]
  ?? (config.isProduction ? LEVELS.info : LEVELS.debug);

const REDACTED_KEYS = new Set([
  'password', 'motdepasse', 'newpassword', 'currentpassword', 'token', 'jeton', 'csrf', 'csrftoken',
  'authorization', 'cookie', 'secret', 'apikey', 'databaseurl', 'connectionstring',
  // Propres a HARON : le lien de suivi est le secret du client, le numero
  // WhatsApp est une donnee personnelle.
  'telephone', 'whatsapp', 'lien', 'liensuivi', 'jetonsuivi',
]);

/** « jetonSuivi », « jeton_suivi » et « JETON-SUIVI » designent la meme cle. */
function motsDeCle(key) {
  const mots = sansAccents(String(key))
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  return [mots.join(''), ...mots];
}

const estSensible = (key) => motsDeCle(key).some((m) => REDACTED_KEYS.has(m));

function redact(input, depth = 0) {
  if (depth > 4) return '[profondeur max]';
  if (input === null || input === undefined) return input;
  if (Array.isArray(input)) return input.slice(0, 20).map((v) => redact(v, depth + 1));
  if (typeof input === 'object') {
    if (input instanceof Error) return { message: input.message, name: input.name, stack: input.stack };
    const out = {};
    for (const [key, val] of Object.entries(input)) out[key] = estSensible(key) ? '[expurge]' : redact(val, depth + 1);
    return out;
  }
  if (typeof input === 'string' && input.length > 2000) return input.slice(0, 2000) + '... [tronque]';
  return input;
}

function emit(level, message, context) {
  if (LEVELS[level] < threshold) return;
  if (process.env.HARON_LOG_SILENCE === '1' && level !== 'error') return;
  const line = JSON.stringify({ ts: new Date().toISOString(), level, msg: String(message), ...(context ? { ctx: redact(context) } : {}) });
  if (level === 'error' || level === 'warn') process.stderr.write(line + '\n');
  else process.stdout.write(line + '\n');
}

export const log = {
  debug: (msg, ctx) => emit('debug', msg, ctx),
  info: (msg, ctx) => emit('info', msg, ctx),
  warn: (msg, ctx) => emit('warn', msg, ctx),
  error: (msg, ctx) => emit('error', msg, ctx),
};

export { redact as _redact };
