/**
 * Le temps du salon.
 *
 * Les instants sont stockes en UTC (timestamptz). Mais la file d'attente est
 * celle d'une JOURNEE du salon : « aujourd'hui » se lit dans le fuseau de
 * l'etablissement (config.timezone), jamais dans celui du serveur ni en UTC.
 * Sans cela, entre minuit et deux heures du matin, un ticket pris le soir
 * basculerait dans la journee du lendemain et disparaitrait de la file.
 *
 * Aucun decalage n'est code en dur : tout passe par Intl et la base de fuseaux
 * de Node, qui connait les changements d'heure de chaque pays.
 */
import { config } from './config.js';

const formateurs = new Map();

function formateur(timeZone) {
  if (!formateurs.has(timeZone)) {
    formateurs.set(timeZone, new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }));
  }
  return formateurs.get(timeZone);
}

/** Les composantes d'un instant dans le fuseau du salon. */
export function partiesLocales(instant = new Date(), timeZone = config.timezone) {
  const date = instant instanceof Date ? instant : new Date(instant);
  const parts = {};
  for (const p of formateur(timeZone).formatToParts(date)) parts[p.type] = p.value;
  return {
    annee: Number(parts.year),
    mois: Number(parts.month),
    jour: Number(parts.day),
    heure: Number(parts.hour),
    minute: Number(parts.minute),
    seconde: Number(parts.second),
  };
}

const deux = (n) => String(n).padStart(2, '0');

/** « AAAA-MM-JJ » de la journee du salon pour cet instant. */
export function jourLocal(instant = new Date(), timeZone = config.timezone) {
  const p = partiesLocales(instant, timeZone);
  return p.annee + '-' + deux(p.mois) + '-' + deux(p.jour);
}

/** « HH:MM » du salon pour cet instant. */
export function heureLocale(instant = new Date(), timeZone = config.timezone) {
  const p = partiesLocales(instant, timeZone);
  return deux(p.heure) + ':' + deux(p.minute);
}

/** Minutes ecoulees depuis minuit, heure du salon. */
export function minutesDepuisMinuit(instant = new Date(), timeZone = config.timezone) {
  const p = partiesLocales(instant, timeZone);
  return p.heure * 60 + p.minute;
}

/** Jour de la semaine du salon : 0 = dimanche, 1 = lundi... 6 = samedi. */
export function jourSemaine(instant = new Date(), timeZone = config.timezone) {
  const p = partiesLocales(instant, timeZone);
  return new Date(Date.UTC(p.annee, p.mois - 1, p.jour)).getUTCDay();
}

const HEURE_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
export const heureValide = (texte) => HEURE_RE.test(String(texte ?? ''));

/** « 09:30 » -> 570 minutes. Rend null si l'heure est invalide. */
export function heureEnMinutes(texte) {
  const m = HEURE_RE.exec(String(texte ?? ''));
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/**
 * L'instant qui correspond a une date et une heure lues sur l'horloge du salon.
 * « 2026-09-23 », « 20:00 » -> Date (UTC).
 *
 * Le decalage est cherche par approximations successives : on part de l'UTC, on
 * regarde quelle heure locale cela donne, on corrige de l'ecart. Deux passages
 * suffisent hors changement d'heure ; le troisieme couvre la bascule.
 */
export function instantLocal(dateIso, heure = '00:00', timeZone = config.timezone) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateIso ?? ''));
  const h = HEURE_RE.exec(String(heure ?? ''));
  if (!m || !h) return null;
  const cible = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(h[1]), Number(h[2]));
  const verif = new Date(cible);
  if (verif.getUTCDate() !== Number(m[3]) || verif.getUTCMonth() !== Number(m[2]) - 1) return null;

  let essai = cible;
  for (let i = 0; i < 3; i += 1) {
    const p = partiesLocales(new Date(essai), timeZone);
    const lu = Date.UTC(p.annee, p.mois - 1, p.jour, p.heure, p.minute);
    const ecart = lu - cible;
    if (ecart === 0) break;
    essai -= ecart;
  }
  return new Date(essai);
}

/** « 23/09/2026 à 14:05 », dans le fuseau du salon. */
export function formatInstantFr(instant, timeZone = config.timezone) {
  if (!instant) return '';
  const date = instant instanceof Date ? instant : new Date(instant);
  if (Number.isNaN(date.getTime())) return '';
  const p = partiesLocales(date, timeZone);
  return deux(p.jour) + '/' + deux(p.mois) + '/' + p.annee + ' à ' + deux(p.heure) + ':' + deux(p.minute);
}

export const NOMS_JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

/** « mercredi 23 septembre 2026 » pour une date calendaire. */
export function dateLongueFr(dateIso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateIso ?? ''));
  if (!m) return '';
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return NOMS_JOURS[d.getUTCDay()] + ' ' + Number(m[3]) + ' ' + MOIS[Number(m[2]) - 1] + ' ' + m[1];
}

/**
 * Une duree en minutes, dite comme on la dit a un client qui attend.
 *   0   -> « quelques instants »
 *   25  -> « environ 25 minutes »
 *   95  -> « environ 1 h 35 »
 */
export function attenteLisible(minutes) {
  const m = Math.max(0, Math.round(Number(minutes) || 0));
  if (m <= 0) return 'quelques instants';
  if (m < 60) return 'environ ' + m + ' minute' + (m > 1 ? 's' : '');
  const h = Math.floor(m / 60);
  const reste = m % 60;
  return 'environ ' + h + ' h' + (reste ? ' ' + deux(reste) : '');
}

/**
 * La meme duree, en forme courte, pour une case dont le libelle dit deja
 * « Estimation » : « 25 min », « 1 h 40 ». Repeter « environ » sous un titre
 * qui annonce une estimation fait deborder la case et n'apprend rien.
 */
export function attenteCourte(minutes) {
  const m = Math.max(0, Math.round(Number(minutes) || 0));
  if (m <= 0) return 'à l’instant';
  if (m < 60) return m + ' min';
  const h = Math.floor(m / 60);
  const reste = m % 60;
  return h + ' h' + (reste ? ' ' + deux(reste) : '');
}

export const NOMS_MOIS = MOIS;
