/**
 * Primitives cryptographiques de l'application.
 *
 * Tout repose sur node:crypto : aucune dependance externe n'intervient dans la
 * protection des mots de passe, des sessions ou des numeros WhatsApp.
 *
 *  - Mots de passe : scrypt (memory-hard) + sel aleatoire + poivre applicatif.
 *  - Numeros WhatsApp : AES-256-GCM (chiffrement authentifie) + index aveugle
 *    HMAC-SHA-256, qui permet de reconnaitre « ce numero a deja un tour
 *    aujourd hui » sans jamais dechiffrer la colonne.
 *  - Jetons de suivi : 192 bits d'entropie, stockes uniquement sous forme de
 *    condensat SHA-256. Un vol de la base ne donne acces a aucun ticket.
 */
import crypto from 'node:crypto';
import { config } from './config.js';

/* ------------------------------------------------------------------ */
/*  Derivation des cles                                                */
/* ------------------------------------------------------------------ */

let cachedKeys = null;

const derive = (base, label) => Buffer.from(crypto.hkdfSync('sha256', base, Buffer.alloc(0), label, 32));

function keys() {
  if (cachedKeys) return cachedKeys;
  const master = Buffer.from(config.security.encryptionKey, 'hex');
  const secret = Buffer.from(config.security.secret, 'hex');
  const previous = config.security.encryptionKeyPrevious
    ? Buffer.from(config.security.encryptionKeyPrevious, 'hex')
    : null;
  cachedKeys = {
    // Une cle par usage : un usage ne peut pas contaminer l'autre.
    dataKey: derive(master, 'haron:data:v1'),
    indexKey: derive(master, 'haron:index:v1'),
    signKey: derive(secret, 'haron:sign:v1'),
    pepper: Buffer.from(config.security.passwordPepper, 'hex'),
    anciennes: previous ? { dataKey: derive(previous, 'haron:data:v1'), indexKey: derive(previous, 'haron:index:v1') } : null,
  };
  return cachedKeys;
}

/* ------------------------------------------------------------------ */
/*  Comparaisons et jetons                                             */
/* ------------------------------------------------------------------ */

/** Comparaison a temps constant de deux chaines. */
export function timingSafeEqual(a, b) {
  const bufA = Buffer.from(String(a ?? ''), 'utf8');
  const bufB = Buffer.from(String(b ?? ''), 'utf8');
  if (bufA.length !== bufB.length) {
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

/** Jeton opaque aleatoire, encode en base64url. */
export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}

/**
 * Jeton de suivi d'un ticket : 24 octets, soit 192 bits d'entropie, rendus
 * en 32 caracteres base64url. Deviner un jeton demanderait plus d'essais
 * qu'il n'y a d'atomes dans le systeme solaire ; la limitation de debit sur
 * la page de suivi arrete de toute facon l'enumeration bien avant.
 */
export const JETON_SUIVI_OCTETS = 24;
export const jetonSuivi = () => randomToken(JETON_SUIVI_OCTETS);

/** Forme admissible d'un jeton recu dans une adresse (avant toute requete). */
export const JETON_RE = /^[A-Za-z0-9_-]{22,64}$/;
export const jetonPlausible = (v) => typeof v === 'string' && JETON_RE.test(v);

/** Code aleatoire non biaise dans un alphabet sans caracteres ambigus (O/0, I/1). */
export function randomCode(length = 8, alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789') {
  let out = '';
  for (let i = 0; i < length; i += 1) out += alphabet[crypto.randomInt(0, alphabet.length)];
  return out;
}

/** Condensat d'un jeton, tel que stocke en base. */
export function hashToken(token) {
  return crypto.createHash('sha256').update(String(token), 'utf8').digest('hex');
}

export function sha256(data) {
  return crypto.createHash('sha256').update(Buffer.isBuffer(data) ? data : Buffer.from(String(data), 'utf8')).digest('hex');
}

/** HMAC-SHA-256 signe avec la cle de signature applicative. */
export function sign(value) {
  return crypto.createHmac('sha256', keys().signKey).update(String(value), 'utf8').digest('base64url');
}

export function verifySignature(value, signature) {
  return timingSafeEqual(sign(value), signature);
}

/* ------------------------------------------------------------------ */
/*  Mots de passe : scrypt                                             */
/* ------------------------------------------------------------------ */

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 32 };
const SCRYPT_MAXMEM = 128 * SCRYPT.N * SCRYPT.r * 2;

function scryptDerive(password, salt, params) {
  // Le poivre n'est pas en base : un vol de la seule base ne permet pas
  // d'attaquer les condensats hors ligne.
  const material = Buffer.concat([Buffer.from(String(password), 'utf8'), keys().pepper]);
  return new Promise((resolve, reject) => {
    crypto.scrypt(material, salt, params.keylen, { N: params.N, r: params.r, p: params.p, maxmem: SCRYPT_MAXMEM },
      (err, derived) => (err ? reject(err) : resolve(derived)));
  });
}

/** Format stocke : scrypt$N$r$p$sel_b64$condensat_b64 */
export async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const derived = await scryptDerive(password, salt, SCRYPT);
  return ['scrypt', SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString('base64'), derived.toString('base64')].join('$');
}

/** Le calcul lui-meme n'a pas pu se faire : ce n'est PAS un mot de passe faux. */
export class DerivationImpossible extends Error {
  constructor(cause) {
    super('Verification du mot de passe impossible : ' + (cause?.message || cause));
    this.name = 'DerivationImpossible';
    this.cause = cause;
  }
}

/**
 * Un format inattendu rend false plutot qu'une erreur 500 ; en revanche un
 * echec du calcul lui-meme leve DerivationImpossible, pour ne jamais compter
 * un incident machine comme une tentative ratee (le compte serait verrouille).
 */
export async function verifyPassword(password, stored) {
  try {
    if (typeof stored !== 'string') return false;
    const parts = stored.split('$');
    if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
    const params = { N: Number.parseInt(parts[1], 10), r: Number.parseInt(parts[2], 10), p: Number.parseInt(parts[3], 10) };
    if (![params.N, params.r, params.p].every(Number.isFinite)) return false;
    if (params.N > 1048576 || params.r > 32 || params.p > 16) return false;
    const salt = Buffer.from(parts[4], 'base64');
    const expected = Buffer.from(parts[5], 'base64');
    if (expected.length < 16 || expected.length > 64) return false;
    let derived;
    try {
      derived = await scryptDerive(password, salt, { ...params, keylen: expected.length });
    } catch (err) {
      throw new DerivationImpossible(err);
    }
    return crypto.timingSafeEqual(derived, expected);
  } catch (err) {
    if (err instanceof DerivationImpossible) throw err;
    return false;
  }
}

/** Condensat factice : une connexion sur un identifiant inconnu coute le meme temps. */
export const DUMMY_HASH = 'scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';

export function needsRehash(stored) {
  if (typeof stored !== 'string') return true;
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return true;
  return Number.parseInt(parts[1], 10) < SCRYPT.N;
}

/* ------------------------------------------------------------------ */
/*  Chiffrement des numeros WhatsApp : AES-256-GCM                     */
/* ------------------------------------------------------------------ */

const ENC_PREFIX = 'v1';

/** Ce que decrypt() rend quand la valeur ne peut pas etre dechiffree. */
export const MARQUEUR_ILLISIBLE = '[dato ilegible]';

/** Le masque rendu a qui n'a pas le droit de lire en clair. */
export const MASQUE = '••••••••';

/** Une valeur qui sort d'une restitution ne se rechiffre jamais par-dessus la vraie. */
export function estRestitution(valeur) {
  const texte = String(valeur ?? '');
  if (texte.includes('•')) return true;
  const sansAccents = (s) => s.normalize('NFD').replace(new RegExp('[' + String.fromCharCode(0x300) + '-' + String.fromCharCode(0x36f) + ']', 'g'), '').toLowerCase();
  return sansAccents(texte).includes(sansAccents(MARQUEUR_ILLISIBLE));
}

/**
 * Chiffre une valeur textuelle. Retourne null si la valeur est vide.
 * Format : v1.<iv>.<tag>.<chiffre>  (chaque segment en base64url)
 */
export function encrypt(plaintext) {
  if (plaintext === null || plaintext === undefined) return null;
  const text = String(plaintext);
  if (text === '') return null;
  if (estRestitution(text)) throw new Error('Refus de chiffrer une valeur restituee (masque ou donnee illisible).');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', keys().dataKey, iv);
  const ct = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return [ENC_PREFIX, iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), ct.toString('base64url')].join('.');
}

/** Dechiffre ; une valeur alteree rend le marqueur d'illisibilite, jamais une donnee douteuse. */
export function decrypt(payload) {
  if (payload === null || payload === undefined || payload === '') return null;
  const parts = String(payload).split('.');
  if (parts.length !== 4 || parts[0] !== ENC_PREFIX) return MARQUEUR_ILLISIBLE;
  for (const cle of [keys().dataKey, keys().anciennes?.dataKey].filter(Boolean)) {
    try {
      const decipher = crypto.createDecipheriv('aes-256-gcm', cle, Buffer.from(parts[1], 'base64url'));
      decipher.setAuthTag(Buffer.from(parts[2], 'base64url'));
      return Buffer.concat([decipher.update(Buffer.from(parts[3], 'base64url')), decipher.final()]).toString('utf8');
    } catch {
      // cle suivante
    }
  }
  return MARQUEUR_ILLISIBLE;
}

/**
 * Index aveugle : reconnaitre « ce numero a deja un tour aujourd hui » par
 * egalite exacte, sans jamais dechiffrer la colonne. La valeur passee est deja
 * la forme internationale (chiffres seuls), calculee par telephoneInternational.
 */
export function blindIndex(valeurNormalisee) {
  const forme = String(valeurNormalisee ?? '').trim();
  if (!forme) return null;
  return crypto.createHmac('sha256', keys().indexKey).update(forme, 'utf8').digest('hex');
}

/** Les index a comparer, cle courante et cle precedente pendant une rotation. */
export function blindIndexTous(valeurNormalisee) {
  const courant = blindIndex(valeurNormalisee);
  if (courant === null) return null;
  const ancienne = keys().anciennes?.indexKey;
  if (!ancienne) return [courant];
  return [courant, crypto.createHmac('sha256', ancienne).update(String(valeurNormalisee), 'utf8').digest('hex')];
}

/** Retire d'un objet les colonnes chiffrees et leurs index (*_enc, *_idx), recursivement. */
export function sansColonnesProtegees(valeur) {
  if (Array.isArray(valeur)) return valeur.map(sansColonnesProtegees);
  if (valeur === null || typeof valeur !== 'object' || valeur instanceof Date) return valeur;
  const sortie = {};
  for (const [cle, v] of Object.entries(valeur)) {
    if (/_(enc|idx|hash)$/.test(cle)) continue;
    sortie[cle] = sansColonnesProtegees(v);
  }
  return sortie;
}

/* ------------------------------------------------------------------ */
/*  Identifiants                                                       */
/* ------------------------------------------------------------------ */

/** UUID v7 : ordonne dans le temps, ce qui menage les index PostgreSQL. */
export function newId() {
  const bytes = crypto.randomBytes(16);
  const ts = BigInt(Date.now());
  for (let i = 0; i < 6; i += 1) bytes[i] = Number((ts >> BigInt(40 - 8 * i)) & 0xffn);
  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20, 32)].join('-');
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v) => typeof v === 'string' && UUID_RE.test(v);
