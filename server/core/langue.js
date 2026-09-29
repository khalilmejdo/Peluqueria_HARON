/**
 * La langue du salon.
 *
 * Le meme code sert un salon a Fuente Alamo et un salon a Casablanca. Ce qui
 * change n'est pas le logiciel : c'est la langue dans laquelle il parle, et la
 * monnaie dans laquelle il compte. Les deux se reglent a l'ecran, dans la
 * section « Identidad / Identite » des reglages.
 *
 * UNE LANGUE PAR BASE, PAS PAR VISITEUR. Il n'y a pas de negociation avec
 * « Accept-Language », et c'est voulu : les tarifs, l'accroche, les noms des
 * prestations et les messages WhatsApp sont saisis par le gerant dans SA langue.
 * Servir le cadre en francais autour de tarifs ecrits en espagnol donnerait une
 * page batarde, pire que la version d'origine. Le salon a une langue, comme il a
 * une adresse.
 *
 * C'est aussi pourquoi la langue active est gardee ICI, dans une variable de
 * module, posee par reglages.lireTous(). Ce n'est pas un raccourci : un salon a
 * exactement une langue, et la faire voyager dans la signature de chaque
 * fonction qui leve une erreur reviendrait a declarer que deux appels
 * simultanes pourraient ne pas repondre dans la meme langue. Ils ne peuvent
 * pas.
 *
 * LES DEUX LANGUES SONT SUR LA MEME LIGNE du dictionnaire. Deux objets separes
 * auraient derive au premier ajout : on traduit ce qu'on voit, et on ne voit pas
 * ce qui est deux cents lignes plus bas. Cote a cote, une traduction manquante
 * saute aux yeux, et un test refuse le fichier s'il en reste une.
 */
import { TEXTES } from './textes.js';

/** @typedef {'es'|'fr'} CodeLangue */

export const LANGUES = {
  es: {
    code: 'es',
    nom: 'Español',
    nomLocal: 'Español',
    htmlLang: 'es',
    ogLocale: 'es_ES',
    /** Etiquette de la langue dans l'autre langue, pour le menu des reglages. */
    intl: 'es-ES',
  },
  fr: {
    code: 'fr',
    nom: 'Français',
    nomLocal: 'Français',
    htmlLang: 'fr',
    ogLocale: 'fr_FR',
    intl: 'fr-FR',
  },
};

export const CODES_LANGUES = Object.keys(LANGUES);

/**
 * L'espagnol reste le defaut : c'est la langue du premier salon, et un defaut
 * qui change de sens selon la version installee est un piege.
 */
export const LANGUE_DEFAUT = 'es';

/* ------------------------------------------------------------------ */
/*  La langue active                                                   */
/* ------------------------------------------------------------------ */

let active = LANGUE_DEFAUT;

export function poserLangueActive(code) {
  active = LANGUES[code] ? code : LANGUE_DEFAUT;
  return active;
}

export const langueActive = () => active;

/* ------------------------------------------------------------------ */
/*  Rendu                                                              */
/* ------------------------------------------------------------------ */

/**
 * Le pluriel, dans les deux langues.
 *
 * Elles ne coupent pas au meme endroit : l'espagnol dit « 0 personas », le
 * francais « 0 personne ». Un seul test « n > 1 » partout aurait donc ete faux
 * une fois sur deux, et faux precisement sur le cas vide, celui qu'on lit le
 * plus souvent en vitrine un lundi matin.
 */
export function indicePluriel(langue, n) {
  const nombre = Number(n);
  if (!Number.isFinite(nombre)) return 0;
  return langue === 'fr' ? (Math.abs(nombre) <= 1 ? 0 : 1) : (Math.abs(nombre) === 1 ? 0 : 1);
}

/** Les cles reclamees qu'on n'a pas su rendre, dites une seule fois chacune. */
const manquantes = new Set();

function signaler(message) {
  if (manquantes.has(message)) return;
  manquantes.add(message);
  // console et non le logger : langue.js est charge avant lui par plusieurs
  // modules, et une dependance circulaire au demarrage serait payee plus cher
  // que ce message ne vaut.
  console.warn('[langue] ' + message);
}

/** Pour les tests : la liste des manques rencontres depuis le demarrage. */
export const _manquantes = manquantes;

/**
 * Remplace « {nom} » par params.nom.
 *
 * AUCUN ECHAPPEMENT ICI. C'est l'appelant qui echappe, comme partout ailleurs
 * dans ce code : une fonction qui echappe parfois est une fonction dont on ne
 * sait jamais si elle l'a fait, et c'est ainsi qu'on finit avec des « &amp;amp; »
 * dans une page.
 */
function interpoler(texte, params) {
  if (!params || !texte.includes('{')) return texte;
  return texte.replace(/\{(\w+)\}/g, (entier, cle) => (
    Object.hasOwn(params, cle) ? String(params[cle]) : entier
  ));
}

function brancher(texte, langue, params) {
  const barre = texte.indexOf('|');
  if (barre === -1) return texte;
  const branches = texte.split('|');
  const i = indicePluriel(langue, params?.n);
  return branches[Math.min(i, branches.length - 1)];
}

/**
 * Le texte d'une cle, dans une langue.
 *
 * Une cle inconnue rend la cle elle-meme plutot que du vide : une page ou l'on
 * lit « accueil.bouton » est immediatement reparable, une page ou le bouton a
 * disparu demande une demi-heure pour comprendre qu'il manquait un texte.
 *
 * Une traduction absente retombe sur l'espagnol pour la meme raison : mieux vaut
 * un mot dans la mauvaise langue qu'un trou dans la page. Le test du
 * dictionnaire fait en sorte que ce cas ne se produise jamais en vrai.
 */
export function texte(langue, cle, params = null) {
  const entree = TEXTES[cle];
  if (!entree) {
    signaler('cle inconnue : ' + cle);
    return cle;
  }
  const code = LANGUES[langue] ? langue : LANGUE_DEFAUT;
  let brut = entree[code];
  if (brut === undefined || brut === '') {
    signaler('traduction ' + code + ' absente : ' + cle);
    brut = entree[LANGUE_DEFAUT] ?? cle;
  }
  return interpoler(brancher(String(brut), code, params), params);
}

/**
 * Un traducteur fige sur une langue.
 *
 * Les pages publiques s'en servent : elles lisent les reglages de toute facon,
 * elles n'ont donc aucune raison de passer par la variable de module, et un
 * traducteur explicite rend les tests de rendu lisibles — on voit dans quelle
 * langue la page a ete demandee.
 */
export function traduire(langue) {
  const code = LANGUES[langue] ? langue : LANGUE_DEFAUT;
  const fn = (cle, params = null) => texte(code, cle, params);
  fn.langue = code;
  fn.htmlLang = LANGUES[code].htmlLang;
  fn.ogLocale = LANGUES[code].ogLocale;
  return fn;
}

/**
 * Le traducteur de la langue active.
 *
 * Pour tout ce qui parle loin des reglages : une erreur levee au fond du domaine
 * de la file, un libelle de statut, une ligne d'historique. Ces endroits n'ont
 * pas d'objet « reglages » sous la main, et leur en faire porter un aurait
 * contamine une quinzaine de signatures pour un reglage qui change une fois dans
 * la vie du salon.
 */
export const t = (cle, params = null) => texte(active, cle, params);

/**
 * Cette cle existe-t-elle ?
 *
 * Sert au catalogue des reglages : une aide est facultative, et plutot que de
 * declarer deux fois « cette entree a une aide » — une fois dans le catalogue,
 * une fois dans le dictionnaire — on demande au dictionnaire. Une seule source,
 * donc aucun moyen que les deux se contredisent.
 */
export const existe = (cle) => Object.hasOwn(TEXTES, cle);

/** Le catalogue des langues, pour le menu deroulant des reglages. */
export const optionsLangues = () => CODES_LANGUES.map((code) => ({
  valeur: code,
  libelle: LANGUES[code].nomLocal,
}));
