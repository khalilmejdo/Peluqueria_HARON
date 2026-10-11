/**
 * Configuration applicative.
 *
 * Charge le fichier .env (sans dependance externe) puis valide strictement les
 * parametres critiques : l'application refuse de demarrer si un secret est
 * absent, mal forme, ou si une variable posee ne se lit pas.
 *
 * Les variables deja presentes dans l'environnement (Coolify, Docker) ont
 * toujours la priorite sur le fichier .env.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));

/* ------------------------------------------------------------------ */
/*  Lecture du fichier .env                                            */
/* ------------------------------------------------------------------ */

function loadDotEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const rawLine of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    const quoted = (value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"));
    if (quoted) value = value.slice(1, -1);
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

// Les tests d'integration posent tout eux-memes : un .env de poste ne doit
// jamais leur faire designer une vraie base.
if (process.env.HARON_SANS_DOTENV !== '1') loadDotEnv(path.join(ROOT, '.env'));

/* ------------------------------------------------------------------ */
/*  Lecture typee                                                      */
/* ------------------------------------------------------------------ */

const str = (key, fallback = '') => {
  const v = process.env[key];
  return v === undefined || v === '' ? fallback : String(v);
};

const bool = (key, fallback = false) => {
  const v = process.env[key];
  if (v === undefined || v === '') return fallback;
  return /^(1|true|yes|on|oui)$/i.test(String(v).trim());
};

/** Une variable posee mais illisible n'est pas remplacee en silence par le defaut. */
const ENV_ILLISIBLES = [];

const int = (key, fallback) => {
  const brut = str(key, '').trim();
  if (brut === '') return fallback;
  if (!/^-?\d+$/.test(brut)) {
    ENV_ILLISIBLES.push(key + '=' + brut + ' (un entier est attendu)');
    return fallback;
  }
  return Number.parseInt(brut, 10);
};

const borne = (n, min, max) => Math.min(Math.max(n, min), max);

const list = (key) => str(key).split(',').map((s) => s.trim()).filter(Boolean);

/**
 * Planchers de la posture de securite : une variable d'environnement ne peut
 * pas desarmer le verrouillage de compte ni la duree de session.
 */
export const PLANCHERS_SECURITE = {
  sessionIdleMinutes: { min: 5, max: 960, env: 'SESSION_IDLE_MINUTES' },
  sessionAbsoluteHours: { min: 1, max: 168, env: 'SESSION_ABSOLUTE_HOURS' },
  loginMaxAttempts: { min: 3, max: 20, env: 'LOGIN_MAX_ATTEMPTS' },
  loginLockoutMinutes: { min: 1, max: 1440, env: 'LOGIN_LOCKOUT_MINUTES' },
  passwordMinLength: { min: 10, max: 64, env: 'PASSWORD_MIN_LENGTH' },
  rateLimitMax: { min: 10, max: 100000, env: 'RATE_LIMIT_MAX' },
  rateLimitWindowSeconds: { min: 1, max: 3600, env: 'RATE_LIMIT_WINDOW_SECONDS' },
};

/* ------------------------------------------------------------------ */
/*  Configuration                                                      */
/* ------------------------------------------------------------------ */

const nodeEnv = str('NODE_ENV', 'production');

/** Empreinte du commit deploye (Coolify pose SOURCE_COMMIT au build). */
const versionDeployee = (str('SOURCE_COMMIT') || str('COOLIFY_GIT_COMMIT_SHA') || str('GIT_COMMIT') || '')
  .trim().slice(0, 7) || null;

const dataDir = path.resolve(ROOT, str('DATA_DIR', './data'));

/** Adresse publique, sans barre finale : elle sert au QR Code et aux liens partages. */
const publicUrl = str('PUBLIC_URL').trim().replace(/\/+$/, '');

export const config = {
  env: nodeEnv,
  isProduction: nodeEnv === 'production',
  version: versionDeployee,
  /** Fuseau du salon : toute notion de « jour » ou d'« heure » s'y lit. */
  timezone: str('APP_TIMEZONE', 'Europe/Madrid'),

  http: {
    port: int('PORT', 3000),
    host: str('HOST', '0.0.0.0'),
    publicUrl,
    trustProxy: bool('TRUST_PROXY', true),
    trustProxyHops: borne(int('TRUST_PROXY_HOPS', 1), 1, 5),
    trustRealIp: bool('TRUST_REAL_IP', false),
    allowedOrigins: list('ALLOWED_ORIGINS'),
    bodyLimitBytes: int('BODY_LIMIT_KB', 256) * 1024,
  },

  db: {
    url: str('DATABASE_URL'),
    ssl: str('DATABASE_SSL', 'require').toLowerCase(),
    caCert: str('DATABASE_CA_CERT'),
    poolMax: int('DATABASE_POOL_MAX', 10),
    statementTimeoutMs: int('DATABASE_STATEMENT_TIMEOUT_MS', 20000),
    lockTimeoutMs: int('DATABASE_LOCK_TIMEOUT_MS', 5000),
    connectionTimeoutMs: int('DATABASE_CONNECT_TIMEOUT_MS', 12000),
    idleTimeoutMs: int('DATABASE_IDLE_TIMEOUT_MS', 600000),
  },

  security: {
    secret: str('APP_SECRET'),
    encryptionKey: str('APP_ENCRYPTION_KEY'),
    encryptionKeyPrevious: str('APP_ENCRYPTION_KEY_PREVIOUS', ''),
    passwordPepper: str('APP_PASSWORD_PEPPER'),
    secureCookies: bool('SECURE_COOKIES', true),
    enableHsts: bool('ENABLE_HSTS', true),
    // Le coiffeur travaille debout, les mains prises : une session courte le
    // ferait se reconnecter dix fois par jour. Journee de travail entiere.
    sessionIdleMs: int('SESSION_IDLE_MINUTES', 720) * 60000,
    sessionAbsoluteMs: int('SESSION_ABSOLUTE_HOURS', 24) * 3600000,
    passwordMinLength: int('PASSWORD_MIN_LENGTH', 12),
    loginMaxAttempts: int('LOGIN_MAX_ATTEMPTS', 5),
    loginLockoutMs: int('LOGIN_LOCKOUT_MINUTES', 15) * 60000,
    rateLimitWindowMs: int('RATE_LIMIT_WINDOW_SECONDS', 60) * 1000,
    rateLimitMax: int('RATE_LIMIT_MAX', 600),
    loginRateMax: borne(int('LOGIN_RATE_MAX', 10), 3, 100000),
  },

  whatsapp: {
    actif: bool('WHATSAPP_ACTIF', false),
    numeroId: str('WHATSAPP_NUMERO_ID'),
    jeton: str('WHATSAPP_JETON'),
    langue: str('WHATSAPP_LANGUE', 'fr'),
    modeles: {
      confirmation: str('WHATSAPP_MODELE_CONFIRMATION', 'haron_tour_enregistre'),
      approche: str('WHATSAPP_MODELE_APPROCHE', 'haron_tour_approche'),
      tour: str('WHATSAPP_MODELE_TOUR', 'haron_c_est_votre_tour'),
    },
  },

  /** Indicatif applique a un numero saisi sans « + » (34 Espagne, 212 Maroc). */
  indicatifDefaut: str('TELEPHONE_INDICATIF_DEFAUT', '34').replace(/[^0-9]/g, ''),

  /**
   * LA LANGUE ET LA MONNAIE DE LA PREMIERE INSTALLATION, et d'elle seule.
   *
   * Ensuite, les deux se reglent a l'ecran et c'est la base qui fait foi : ces
   * variables ne sont lues que par le seed, sur une base ou le reglage n'existe
   * pas encore. Sans elles, un salon marocain s'installerait en espagnol avec
   * des euros, et le gerant devrait tout reprendre — y compris les quinze noms
   * de prestations et le nom du fauteuil, ecrits dans la mauvaise langue.
   *
   * Elles ne REMPLACENT pas le reglage : un .env modifie apres coup ne change
   * plus rien, et c'est voulu. Ce qui est dans la base appartient au gerant.
   */
  installation: {
    langue: str('APP_LANGUE', '').trim().toLowerCase(),
    monnaie: str('APP_MONNAIE', '').trim().toUpperCase(),
    // BARBERIA, PELUQUERIA, UNISEX ou ESTETICA : la carte de depart et le
    // style propose d'une installation neuve.
    activite: str('APP_ACTIVITE', '').trim().toUpperCase(),
  },

  storage: {
    dataDir,
    /**
     * Les photos du salon, envoyees depuis l'espace de gestion.
     *
     * Hors de `public/` : elles ne passent pas par le serveur de fichiers
     * statiques, qui garde tout en memoire en production — une photo supprimee
     * y serait restee servie jusqu'au prochain redemarrage. Elles passent par
     * une route qui relit la base a chaque demande.
     */
    photosDir: path.resolve(ROOT, str('PHOTOS_DIR', path.join(dataDir, 'photos'))),
    /**
     * Le plafond d'une photo recue. Le navigateur la reduit a 2000 px avant
     * l'envoi (quelques centaines de Ko) ; ce plafond ne sert qu'a arreter un
     * envoi aberrant avant qu'il remplisse la memoire.
     */
    imageMaxBytes: borne(int('PHOTO_MAX_KO', 8192), 256, 20480) * 1024,
  },

  bootstrap: {
    username: str('BOOTSTRAP_ADMIN_USERNAME', 'haron'),
    password: str('BOOTSTRAP_ADMIN_PASSWORD'),
  },
};

/** La valeur d'environnement d'une grandeur de posture, dans l'unite de son plancher. */
export function valeurPosture(cle) {
  const s = config.security;
  switch (cle) {
    case 'sessionIdleMinutes': return Math.round(s.sessionIdleMs / 60000);
    case 'sessionAbsoluteHours': return Math.round(s.sessionAbsoluteMs / 3600000);
    case 'loginMaxAttempts': return s.loginMaxAttempts;
    case 'loginLockoutMinutes': return Math.round(s.loginLockoutMs / 60000);
    case 'passwordMinLength': return s.passwordMinLength;
    case 'rateLimitMax': return s.rateLimitMax;
    case 'rateLimitWindowSeconds': return Math.round(s.rateLimitWindowMs / 1000);
    default: return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Validation stricte au demarrage                                    */
/* ------------------------------------------------------------------ */

const HEX64 = /^[0-9a-fA-F]{64}$/;

export function validateConfig({ requireDb = true } = {}) {
  const errors = [];

  const secrets = [
    ['APP_SECRET', config.security.secret, 'signature des sessions et jetons CSRF'],
    ['APP_ENCRYPTION_KEY', config.security.encryptionKey, 'chiffrement des numeros WhatsApp'],
    ['APP_PASSWORD_PEPPER', config.security.passwordPepper, 'poivre des mots de passe'],
  ];
  for (const [key, value, label] of secrets) {
    if (!value) errors.push(key + ' est absent (' + label + '). Generez-le avec : npm run keygen');
    else if (!HEX64.test(value)) errors.push(key + ' doit contenir exactement 64 caracteres hexadecimaux (' + label + ').');
  }
  const fournis = secrets.map((s) => s[1]).filter(Boolean);
  if (fournis.length === 3 && new Set(fournis).size < 3) {
    errors.push('APP_SECRET, APP_ENCRYPTION_KEY et APP_PASSWORD_PEPPER doivent etre distincts.');
  }
  if (config.security.encryptionKeyPrevious && !HEX64.test(config.security.encryptionKeyPrevious)) {
    errors.push('APP_ENCRYPTION_KEY_PREVIOUS doit contenir 64 caracteres hexadecimaux, ou etre retiree.');
  }

  if (requireDb) {
    if (!config.db.url) errors.push('DATABASE_URL est requis (chaine de connexion PostgreSQL).');
    else if (!/^postgres(ql)?:\/\//i.test(config.db.url)) errors.push('DATABASE_URL doit commencer par postgresql://');
  }
  if (!['off', 'require', 'verify'].includes(config.db.ssl)) errors.push('DATABASE_SSL doit valoir off, require ou verify.');
  if (config.db.ssl === 'verify' && !config.db.caCert) errors.push('DATABASE_SSL=verify impose DATABASE_CA_CERT.');
  if (config.security.enableHsts && !config.security.secureCookies) errors.push('ENABLE_HSTS=true impose SECURE_COOKIES=true.');

  if (config.http.publicUrl) {
    try {
      const u = new URL(config.http.publicUrl);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') errors.push('PUBLIC_URL doit commencer par http:// ou https://');
    } catch {
      errors.push('PUBLIC_URL n est pas une adresse valide : ' + config.http.publicUrl);
    }
  }

  if (config.whatsapp.actif) {
    if (!/^\d{5,30}$/.test(config.whatsapp.numeroId)) errors.push('WHATSAPP_ACTIF=true impose WHATSAPP_NUMERO_ID (chiffres seuls).');
    if (config.whatsapp.jeton.length < 10) errors.push('WHATSAPP_ACTIF=true impose WHATSAPP_JETON.');
    if (!/^[a-z]{2,3}(_[A-Z]{2})?$/.test(config.whatsapp.langue)) errors.push('WHATSAPP_LANGUE doit ressembler a « fr », « es » ou « fr_FR ».');
    for (const [nom, modele] of Object.entries(config.whatsapp.modeles)) {
      if (!/^[a-z0-9_]{1,512}$/.test(modele)) errors.push('Le modele WhatsApp « ' + nom + ' » doit etre en minuscules, chiffres et soulignes.');
    }
  }
  if (!/^\d{1,4}$/.test(config.indicatifDefaut)) {
    errors.push('TELEPHONE_INDICATIF_DEFAUT doit etre un indicatif en chiffres (34, 212, 33...).');
  }
  // Une valeur mal orthographiee tomberait silencieusement sur le defaut, et le
  // salon s'installerait dans la mauvaise langue sans que personne le sache
  // avant de voir la vitrine.
  if (config.installation.langue && !['es', 'fr'].includes(config.installation.langue)) {
    errors.push('APP_LANGUE doit valoir « es » ou « fr » (lu : ' + config.installation.langue + ').');
  }
  if (config.installation.activite && !['BARBERIA', 'PELUQUERIA', 'UNISEX', 'ESTETICA'].includes(config.installation.activite)) {
    errors.push('APP_ACTIVITE doit valoir BARBERIA, PELUQUERIA, UNISEX ou ESTETICA (lu : ' + config.installation.activite + ').');
  }
  if (config.installation.monnaie && !['EUR', 'MAD'].includes(config.installation.monnaie)) {
    errors.push('APP_MONNAIE doit valoir « EUR » ou « MAD » (lu : ' + config.installation.monnaie + ').');
  }

  for (const [cle, regle] of Object.entries(PLANCHERS_SECURITE)) {
    const valeur = valeurPosture(cle);
    if (valeur < regle.min || valeur > regle.max) {
      errors.push(regle.env + ' doit se situer entre ' + regle.min + ' et ' + regle.max + ' (valeur lue : ' + valeur + ').');
    }
  }
  if (config.security.sessionIdleMs > config.security.sessionAbsoluteMs) {
    errors.push('SESSION_IDLE_MINUTES ne peut pas exceder SESSION_ABSOLUTE_HOURS.');
  }
  try {
    new Intl.DateTimeFormat('fr-FR', { timeZone: config.timezone });
  } catch {
    errors.push('APP_TIMEZONE designe un fuseau inconnu : ' + config.timezone);
  }
  for (const illisible of ENV_ILLISIBLES) {
    errors.push(illisible + ' : la valeur ne se lit pas, et le defaut ne s applique pas en silence.');
  }
  return errors;
}

export function configWarnings() {
  const w = [];
  if (config.isProduction && !config.security.secureCookies) {
    w.push('SECURE_COOKIES=false en production : le cookie de session circulera en clair.');
  }
  if (config.isProduction && config.http.allowedOrigins.length === 0) {
    w.push('ALLOWED_ORIGINS est vide : la protection CSRF se limitera a une comparaison avec le Host.');
  }
  if (config.isProduction && !config.http.publicUrl) {
    w.push('PUBLIC_URL est vide : le QR Code utilisera l adresse vue dans la requete, qui peut etre celle du proxy.');
  }
  if (config.db.ssl === 'off' && config.isProduction) {
    w.push('DATABASE_SSL=off : la connexion a la base n est pas chiffree (acceptable sur un reseau Docker interne).');
  }
  if (!config.whatsapp.actif) {
    w.push('WHATSAPP_ACTIF=false : aucun message ne partira seul. Le client voit son lien a l ecran et le coiffeur dispose du lien wa.me.');
  }
  if (config.security.encryptionKeyPrevious) {
    w.push('APP_ENCRYPTION_KEY_PREVIOUS est declaree : une rotation de cle est en cours.');
  }
  return w;
}

export function assertConfig(opts) {
  const errors = validateConfig(opts);
  if (errors.length) {
    console.error('\n  Configuration invalide - demarrage interrompu :\n');
    for (const e of errors) console.error('   - ' + e);
    console.error('\n  Voir .env.example, puis : npm run keygen\n');
    process.exit(1);
  }
}
