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
import { t, texte as texteEnLangue } from './langue.js';

/**
 * Dire quelque chose, dans une langue donnee ou dans celle du salon.
 *
 * `langue` nulle est le cas courant : le module est appele depuis le domaine,
 * qui n'a pas de langue sous la main et n'en a pas besoin — il y en a une seule.
 * Les pages qui rendent du HTML passent la leur, pour que le test d'une page en
 * francais n'ait pas a deplacer un etat global.
 */
const dire = (langue, cle, params = null) => (
  langue ? texteEnLangue(langue, cle, params) : t(cle, params)
);

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

/** « 23/09/2026 a las 14:05 », dans le fuseau et la langue du salon. */
export function formatInstant(instant, { timeZone = config.timezone, langue = null } = {}) {
  if (!instant) return '';
  const date = instant instanceof Date ? instant : new Date(instant);
  if (Number.isNaN(date.getTime())) return '';
  const p = partiesLocales(date, timeZone);
  return dire(langue, 'date.alors', {
    date: deux(p.jour) + '/' + deux(p.mois) + '/' + p.annee,
    heure: deux(p.heure) + ':' + deux(p.minute),
  });
}

/**
 * Le nom d'un jour de la semaine. 0 = dimanche, comme partout ailleurs ici.
 *
 * `langue` omise, c'est la langue du salon qui parle. On la passe explicitement
 * la ou le texte est rendu pour une page dont la langue est deja connue.
 */
export const nomJour = (jourSem, langue = null) => dire(langue, 'jour.' + (((Number(jourSem) % 7) + 7) % 7));

/** Les sept noms, dimanche en tete. */
export const nomsJours = (langue = null) => [0, 1, 2, 3, 4, 5, 6].map((j) => nomJour(j, langue));

/** Le nom d'un mois. 1 = janvier, comme dans une date ISO. */
export const nomMois = (mois, langue = null) => dire(langue, 'mois.' + Number(mois));

/**
 * « miércoles 23 de septiembre de 2026 », « mercredi 23 septembre 2026 ».
 *
 * La forme espagnole intercale « de » deux fois, la ou le francais ne met rien :
 * c'est pour cela que la fonction ne se resume pas a changer deux tableaux, et
 * que le gabarit vit dans le dictionnaire plutot qu'ici.
 */
export function dateLongue(dateIso, langue = null) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateIso ?? ''));
  if (!m) return '';
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return dire(langue, 'date.longue', {
    jour: nomJour(d.getUTCDay(), langue),
    n: Number(m[3]),
    mois: nomMois(Number(m[2]), langue),
    annee: m[1],
  });
}

/** « jeu. 9 oct. », « jue 9 oct » : la date d'une puce ou d'une bande de jours. */
export function dateCourte(dateIso, langue = null) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateIso ?? ''));
  if (!m) return '';
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return dire(langue, 'date.courte', {
    jour: dire(langue, 'jour.court.' + d.getUTCDay()),
    n: Number(m[3]),
    mois: dire(langue, 'mois.court.' + Number(m[2])),
  });
}

/** « Aujourd'hui », « Demain », ou la date courte. */
export function jourRelatif(dateIso, aujourdhui, langue = null) {
  if (dateIso === aujourdhui) return dire(langue, 'date.aujourdhui');
  const [a, mo, j] = String(aujourdhui).split('-').map(Number);
  const demain = new Date(Date.UTC(a, mo - 1, j + 1)).toISOString().slice(0, 10);
  if (dateIso === demain) return dire(langue, 'date.demain');
  return dateCourte(dateIso, langue);
}

/**
 * Une duree en minutes, NUE : « 25 minutos », « 1 h 35 ».
 *
 * Elle existe pour que personne n'ait plus a decouper une phrase deja faite.
 * Trois endroits le faisaient — `attenteLisible(...).replace(/^unos /, '≈ ')` —
 * et ces trois endroits auraient affiche la phrase entiere en francais, ou
 * « environ » ne s'ecrit pas « unos ». Un texte qu'on retaille apres coup est un
 * texte qui casse a la premiere traduction.
 */
export function attenteNue(minutes, langue = null) {
  const m = Math.max(0, Math.round(Number(minutes) || 0));
  if (m < 60) return dire(langue, 'duree.minutes', { n: m });
  const h = Math.floor(m / 60);
  const reste = m % 60;
  return reste
    ? dire(langue, 'duree.heuresMinutes', { h, m: deux(reste) })
    : dire(langue, 'duree.heures', { h });
}

/**
 * La meme duree, dite comme on la dit a un client qui attend.
 *   0   -> « unos minutos »        / « quelques minutes »
 *   25  -> « unos 25 minutos »     / « environ 25 minutes »
 *   95  -> « alrededor de 1 h 35 » / « environ 1 h 35 »
 */
export function attenteLisible(minutes, langue = null) {
  const m = Math.max(0, Math.round(Number(minutes) || 0));
  if (m <= 0) return dire(langue, 'duree.quelquesMinutes');
  const nue = attenteNue(m, langue);
  return dire(langue, m < 60 ? 'duree.environMinutes' : 'duree.environHeures', { duree: nue });
}

/**
 * La forme courte, pour une case dont le libelle dit deja « Estimation » :
 * « 25 min », « 1 h 40 ». Repeter « environ » sous un titre qui annonce une
 * estimation fait deborder la case et n'apprend rien.
 */
export function attenteCourte(minutes, langue = null) {
  const m = Math.max(0, Math.round(Number(minutes) || 0));
  if (m <= 0) return dire(langue, 'duree.maintenant');
  if (m < 60) return dire(langue, 'duree.min', { n: m });
  return attenteNue(m, langue);
}
