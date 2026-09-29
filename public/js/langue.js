/**
 * La langue, cote navigateur.
 *
 * Le meme mecanisme que sur le serveur, en trente lignes : une cle, deux
 * langues sur la meme ligne, un pluriel marque par « | », des parametres entre
 * accolades.
 *
 * LA LANGUE VIENT DE « <html lang> », pose par le serveur. Trois raisons de ne
 * pas la demander autrement :
 *
 *   - la politique de securite du contenu interdit tout script en ligne : il n'y
 *     a aucun moyen de glisser une variable dans la page ;
 *   - un appel au serveur pour demander « quelle langue ? » retarderait le
 *     premier affichage sur un telephone en 4G faible, exactement la ou ce
 *     projet refuse de faire attendre ;
 *   - l'attribut est de toute facon la, parce qu'un lecteur d'ecran en a besoin
 *     pour choisir sa prononciation.
 *
 * POURQUOI UN SECOND DICTIONNAIRE. Celui du serveur ne peut pas etre importe ici
 * sans expedier au navigateur des centaines de phrases qu'il n'affichera jamais
 * — messages WhatsApp, refus de base de donnees, libelles de reglages. Les deux
 * ensembles sont presque disjoints : le serveur rend la vitrine, ce fichier rend
 * l'espace de gestion. Le peu qui se recoupe est la, et il est court.
 */
import { TEXTES } from './textes.js';

const LANGUES = ['es', 'fr'];
const DEFAUT = 'es';

/**
 * La langue du document, relue a chaque appel.
 *
 * DEUX RAISONS DE NE PAS LA FIGER AU CHARGEMENT DU MODULE :
 *
 *   - `pantalla.js` est importe par un test qui tourne dans Node, sans `document`.
 *     Une lecture au chargement y leverait une exception avant la premiere ligne
 *     du test, et le test qui garantit que le serveur et le script affichent le
 *     meme texte ne pourrait plus tourner du tout ;
 *   - un test peut ainsi demander la meme fonction dans les deux langues sans
 *     recharger le module.
 *
 * Lire un attribut du document coute quelques nanosecondes ; la file la plus
 * chargee en demande quelques centaines par rendu. Ce n'est pas mesurable.
 */
function langueDuDocument() {
  if (typeof document === 'undefined' || !document.documentElement) return DEFAUT;
  const brut = String(document.documentElement.lang || '').slice(0, 2).toLowerCase();
  return LANGUES.includes(brut) ? brut : DEFAUT;
}

export const langueCourante = langueDuDocument;

/**
 * L'espagnol met le pluriel a zero (« 0 personas »), le francais le singulier
 * (« 0 personne »). Un « n > 1 » recopie partout aurait donc ete faux une fois
 * sur deux, et faux sur le cas vide — celui qu'on lit le plus souvent.
 */
const indice = (langue, n) => {
  const nombre = Number(n);
  if (!Number.isFinite(nombre)) return 0;
  return langue === 'fr' ? (Math.abs(nombre) <= 1 ? 0 : 1) : (Math.abs(nombre) === 1 ? 0 : 1);
};

/**
 * Le texte d'une cle.
 *
 * Une cle inconnue rend la cle : un bouton ou l'on lit « file.appeler » se
 * repare en trente secondes, un bouton vide coute une demi-heure a diagnostiquer.
 */
export function t(cle, params = null) {
  const entree = TEXTES[cle];
  if (!entree) return cle;
  const langue = langueDuDocument();
  let texte = entree[langue] ?? entree[DEFAUT] ?? cle;
  if (texte.includes('|')) {
    const branches = texte.split('|');
    texte = branches[Math.min(indice(langue, params?.n), branches.length - 1)];
  }
  if (params && texte.includes('{')) {
    texte = texte.replace(/\{(\w+)\}/g, (entier, nom) => (
      Object.hasOwn(params, nom) ? String(params[nom]) : entier
    ));
  }
  return texte;
}

/* ------------------------------------------------------------------ */
/*  Dates et durees                                                   */
/* ------------------------------------------------------------------ */

const deux = (n) => String(n).padStart(2, '0');

/** « 25 minutes », « 1 h 35 » — la duree NUE, celle qui se compose. */
export function dureeNue(minutes) {
  const m = Math.max(0, Math.round(Number(minutes) || 0));
  if (m < 60) return t('duree.minutes', { n: m });
  const h = Math.floor(m / 60);
  const reste = m % 60;
  return reste ? t('duree.heuresMinutes', { h, m: deux(reste) }) : t('duree.heures', { h });
}

/** « environ 25 minutes » — la duree dite a quelqu'un qui attend. */
export function dureeLisible(minutes) {
  const m = Math.max(0, Math.round(Number(minutes) || 0));
  if (m <= 0) return t('duree.quelquesMinutes');
  return t(m < 60 ? 'duree.environMinutes' : 'duree.environHeures', { duree: dureeNue(m) });
}

/** « 25 min », « 1 h 40 » — la forme courte, sous un titre qui dit deja « Estimation ». */
export function dureeCourte(minutes) {
  const m = Math.max(0, Math.round(Number(minutes) || 0));
  if (m <= 0) return t('duree.maintenant');
  if (m < 60) return t('duree.min', { n: m });
  return dureeNue(m);
}

/** « mercredi 23 septembre 2026 » à partir de « 2026-09-23 ». */
export function dateLongue(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? ''));
  if (!m) return '';
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return t('date.longue', {
    jour: t('jour.' + d.getUTCDay()),
    n: Number(m[3]),
    mois: t('mois.' + Number(m[2])),
    annee: m[1],
  });
}

/** Le code de langue tel que l'attendent les API Intl du navigateur. */
export const etiquetteIntl = () => (langueDuDocument() === 'fr' ? 'fr-FR' : 'es-ES');
