/**
 * Limitation de debit en memoire.
 *
 * L'application tourne sur une seule instance : un compteur en memoire suffit
 * et evite un cache externe. La protection contre le bourrage d'identifiants
 * ne repose pas que sur lui : le verrouillage de compte est en base.
 */
import { config } from './config.js';

/** @type {Map<string, {count:number, resetAt:number}>} */
const buckets = new Map();
const MAX_BUCKETS = 50000;

let cleanupTimer = null;
function startCleanup() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(key);
  }, 120000);
  cleanupTimer.unref?.();
}

/**
 * Consomme une unite dans le compteur `key`.
 * @param {string} key
 * @param {{ max: number, windowMs: number }} profil
 */
export function consume(key, { max, windowMs }) {
  startCleanup();
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    // Sous une attaque distribuee, la table ne doit pas devenir elle-meme le cout.
    if (buckets.size >= MAX_BUCKETS) {
      for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
      if (buckets.size >= MAX_BUCKETS) buckets.clear();
    }
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
  }
  bucket.count += 1;
  return {
    allowed: bucket.count <= max,
    remaining: Math.max(0, max - bucket.count),
    retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
  };
}

/** Consulte un compteur sans rien consommer. */
export function peek(key, { max }) {
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= Date.now()) return { allowed: true, remaining: max, retryAfterSeconds: 0 };
  return {
    allowed: bucket.count <= max,
    remaining: Math.max(0, max - bucket.count),
    retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - Date.now()) / 1000)),
  };
}

export function reset(key) {
  buckets.delete(key);
}

export function resetAll() {
  buckets.clear();
}

/**
 * Attente reelle, en francais. « Patientez un instant » est un mensonge quand
 * Retry-After vaut 3 600 s : le client appelle le salon, et le salon ne sait
 * pas pourquoi.
 */
export function attenteLisible(secondes) {
  const s = Math.max(1, Math.ceil(Number(secondes) || 0));
  if (s < 90) return 'dans ' + s + ' seconde' + (s > 1 ? 's' : '');
  const minutes = Math.ceil(s / 60);
  if (minutes < 60) return 'dans ' + minutes + ' minute' + (minutes > 1 ? 's' : '');
  const heures = Math.floor(minutes / 60);
  const reste = minutes % 60;
  return 'dans ' + heures + ' heure' + (heures > 1 ? 's' : '') + (reste ? ' et ' + reste + ' minute' + (reste > 1 ? 's' : '') : '');
}

/**
 * Debit d'une prise de tour publique : par ADRESSE (large, contre les robots)
 * ET par NUMERO, qui est la limite reelle.
 *
 * Une adresse IP n'est pas un client : derriere le wifi du salon, la connexion
 * partagee d'un immeuble ou le NAT d'un operateur mobile, plusieurs vraies
 * personnes la partagent. Quatre clients qui scannent le QR Code depuis le meme
 * wifi doivent tous passer ; un seul numero qui insiste est arrete.
 *
 * @param {{ ip: string, telephone?: string|null }} p  telephone en forme internationale
 * @param {{ telephoneSalon?: string|null }} [o]
 * @returns {{ allowed: boolean, retryAfterSeconds: number, message: string|null, portee: 'IP'|'NUMERO'|null }}
 */
export function consommerPriseDeTour({ ip, telephone = null }, { telephoneSalon = null } = {}) {
  const parIp = consume('tour:ip:' + ip, PROFILES.priseDeTourIp);
  const numero = String(telephone || '').replace(/[^0-9]/g, '');
  const parNumero = numero ? consume('tour:tel:' + numero, PROFILES.priseDeTourNumero) : { allowed: true, retryAfterSeconds: 0 };

  const bloquant = !parNumero.allowed ? { r: parNumero, portee: 'NUMERO' } : (!parIp.allowed ? { r: parIp, portee: 'IP' } : null);
  if (!bloquant) return { allowed: true, retryAfterSeconds: 0, message: null, portee: null };

  const attente = attenteLisible(bloquant.r.retryAfterSeconds);
  const ouAppeler = telephoneSalon ? ' Vous pouvez aussi appeler le salon au ' + telephoneSalon + '.' : ' Vous pouvez aussi vous présenter directement au salon.';
  const message = bloquant.portee === 'NUMERO'
    ? 'Ce numéro a déjà pris plusieurs tours aujourd’hui. Le prochain sera possible ' + attente + '.' + ouAppeler
    : 'Trop de demandes depuis cette connexion internet. Réessayez ' + attente + '.' + ouAppeler;
  return { allowed: false, retryAfterSeconds: bloquant.r.retryAfterSeconds, message, portee: bloquant.portee };
}

/** Profils selon la sensibilite de la route. */
export const PROFILES = {
  get standard() {
    return { max: config.security.rateLimitMax, windowMs: config.security.rateLimitWindowMs };
  },
  /** Fichiers servis depuis le cache : un budget large, a part. */
  statique: { max: 3000, windowMs: 60000 },
  /** Tentatives de connexion du personnel, par adresse IP. */
  get login() {
    return { max: config.security.loginRateMax, windowMs: 300000 };
  },
  /**
   * Prise de tour, par ADRESSE. Large : le salon a un seul wifi et toute une
   * matinee de clients scanne le QR Code derriere lui.
   */
  priseDeTourIp: { max: 40, windowMs: 3600000 },
  /** Prise de tour, par NUMERO WhatsApp : la vraie limite anti-abus. */
  priseDeTourNumero: { max: 5, windowMs: 3600000 },
  /** Consultation d'un lien de suivi : anti-enumeration de jetons. */
  suivi: { max: 240, windowMs: 600000 },
  /** Ouverture d'un flux temps reel (une connexion longue par onglet). */
  flux: { max: 40, windowMs: 300000 },
  /** Gestes du coiffeur sur la file : genereux, il travaille vite. */
  file: { max: 600, windowMs: 60000 },
  /** Ecritures d'administration (reglages, comptes). */
  administration: { max: 60, windowMs: 60000 },
};
