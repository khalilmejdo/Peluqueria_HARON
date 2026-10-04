/**
 * Limitation de debit en memoire.
 *
 * L'application tourne sur une seule instance : un compteur en memoire suffit
 * et evite un cache externe. La protection contre le bourrage d'identifiants
 * ne repose pas que sur lui : le verrouillage de compte est en base.
 */
import { config } from './config.js';
import { t } from './langue.js';

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
      // Toujours pleine : on retire les plus ANCIENS (une Map garde l'ordre
      // d'insertion), pas tout. Vider la table effacait aussi les compteurs de
      // connexion — remplir la table devenait le moyen de les remettre a zero.
      if (buckets.size >= MAX_BUCKETS) {
        let aRetirer = Math.ceil(MAX_BUCKETS / 10);
        for (const k of buckets.keys()) {
          if (aRetirer-- <= 0) break;
          buckets.delete(k);
        }
      }
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
 * L'attente reelle, dite au client. « Espere un momento » est un mensonge quand
 * Retry-After vaut 3 600 s : le client appelle le salon, et le salon ne sait pas
 * pourquoi.
 *
 * La preposition « en » fait partie du retour : les appelants concatenent la
 * phrase telle quelle et n'ont pas a savoir si l'attente se dit en secondes ou
 * en heures.
 */
export function attenteLisible(secondes) {
  const s = Math.max(1, Math.ceil(Number(secondes) || 0));
  if (s < 90) return t('debit.dansSecondes', { n: s });
  const minutes = Math.ceil(s / 60);
  if (minutes < 60) return t('debit.dansMinutes', { n: minutes });
  const heures = Math.floor(minutes / 60);
  const reste = minutes % 60;
  return t('debit.dansHeures', { n: heures }) + (reste ? t('debit.etMinutes', { n: reste }) : '');
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
  // Une adresse deja refusee ne cree plus de compteur par numero : sinon chaque
  // essai d'un robot, numero different a chaque fois, ajoutait une entree.
  const parNumero = numero && parIp.allowed ? consume('tour:tel:' + numero, PROFILES.priseDeTourNumero) : { allowed: true, retryAfterSeconds: 0 };

  const bloquant = !parNumero.allowed ? { r: parNumero, portee: 'NUMERO' } : (!parIp.allowed ? { r: parIp, portee: 'IP' } : null);
  if (!bloquant) return { allowed: true, retryAfterSeconds: 0, message: null, portee: null };

  const delai = attenteLisible(bloquant.r.retryAfterSeconds);
  const ouAppeler = telephoneSalon
    ? t('debit.appelerAussi', { telephone: telephoneSalon })
    : t('debit.venirAuSalon');
  const message = t(bloquant.portee === 'NUMERO' ? 'debit.tropDeTours' : 'debit.tropDepuisCetteConnexion',
    { delai }) + ouAppeler;
  return { allowed: false, retryAfterSeconds: bloquant.r.retryAfterSeconds, message, portee: bloquant.portee };
}

/**
 * Debit d'un LIEN DE SUIVI : on compte les ECHECS par adresse, et le volume par
 * jeton.
 *
 * Le premier reglage comptait TOUT par adresse, page, API et flux confondus.
 * Or tous les clients assis dans la salle d'attente partagent le wifi du salon,
 * donc UNE adresse : un samedi, vingt telephones qui se rallument deux fois
 * epuisaient le budget du flux, et le suivant recevait un 429 — sur lequel
 * EventSource ne se reconnecte jamais. Sa page restait figee sur une position
 * perimee, et rien ne le lui disait.
 *
 * Ce dont on se protege, c'est l'enumeration : quelqu'un qui essaie des jetons
 * au hasard. Il se trahit par ses ECHECS, et c'est eux seuls que l'adresse
 * paie. Un jeton valide, lui, ne coute qu'a son proprietaire : son budget est
 * le sien, et la file d'a cote ne le touche pas.
 *
 *   1. suiviBloque(ip)            avant toute recherche : l'adresse a-t-elle
 *                                 trop echoue ?
 *   2. noterEchecSuivi(ip)        jeton inconnu ou mal forme ;
 *   3. consommerJeton(jeton, p)   jeton valide : son propre budget.
 */
export function suiviBloque(ip) {
  return peek('suivi:echec:' + ip, PROFILES.suiviEchecs);
}

export function noterEchecSuivi(ip) {
  return consume('suivi:echec:' + ip, PROFILES.suiviEchecs);
}

export function consommerJeton(jeton, profil) {
  return consume('suivi:jeton:' + jeton, profil);
}

/** Profils selon la sensibilite de la route. */
export const PROFILES = {
  get standard() {
    return { max: config.security.rateLimitMax, windowMs: config.security.rateLimitWindowMs };
  },
  /** Fichiers servis depuis le cache : un budget large, a part. */
  statique: { max: 3000, windowMs: 60000 },
  /**
   * Adresses qui ne correspondent a aucune route.
   *
   * Un client legitime n'en demande presque jamais : il suit des liens. Un
   * robot d'exploration, lui, en essaie des centaines a la suite — « /.env »,
   * « /.aws/credentials », « /terraform.tfstate ». Un budget etroit le freine
   * donc sans jamais gener personne, et evite de noyer le journal.
   */
  inconnu: { max: 60, windowMs: 60000 },
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
  /** Consultation d'UN lien de suivi (page, API, annulation), par jeton. */
  suivi: { max: 240, windowMs: 600000 },
  /**
   * Jetons INCONNUS essayes depuis une adresse : l'anti-enumeration. Un client
   * honnete n'en produit qu'en recopiant mal son lien ; trente en dix minutes,
   * c'est une machine.
   */
  suiviEchecs: { max: 30, windowMs: 600000 },
  /** Ouverture d'un flux temps reel (une connexion longue par onglet). */
  flux: { max: 40, windowMs: 300000 },
  /** Gestes du coiffeur sur la file : genereux, il travaille vite. */
  file: { max: 600, windowMs: 60000 },
  /** Ecritures d'administration (reglages, comptes). */
  administration: { max: 60, windowMs: 60000 },
};
