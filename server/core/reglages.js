/**
 * Reglages du salon.
 *
 * Un catalogue DECLARE : chaque reglage dit son type, ses bornes, sa valeur par
 * defaut et la phrase qui l'explique au gerant. Une cle absente du catalogue
 * n'est ni lue ni ecrite - l'API ne peut donc pas servir de sac fourre-tout.
 *
 * Aucun secret ici : le jeton WhatsApp et les cles de chiffrement viennent de
 * l'environnement, jamais de la base. Ce qui se regle a l'ecran est ce qui
 * change la vie du salon : la duree d'une coupe, les horaires, le nom.
 *
 * Les valeurs sont gardees en memoire et relues au plus une fois toutes les
 * quelques secondes : la file est recalculee a chaque geste, il serait absurde
 * d'aller chercher « duree moyenne » en base vingt fois par minute.
 */
import { randomBytes } from 'node:crypto';
import { all, execute } from '../db/index.js';
import { heureValide, heureEnMinutes, nomJour } from './temps.js';
import { config } from './config.js';
import { ValidationError } from './errors.js';
import {
  t, texte as texteEnLangue, existe, poserLangueActive, langueActive,
  LANGUE_DEFAUT, optionsLangues, LANGUES, poserActivite,
} from './langue.js';
import { themeDe, cssDuTheme, empreinte, monogrammeDe } from './theme.js';
import { poserDeviseActive, DEVISE_DEFAUT, optionsDevises, DEVISES } from './devise.js';
import { sansBarresFinales } from './text.js';

/** Une couleur se saisit en « #rrggbb » : ce que rend un <input type=color>. */
export const COULEUR_RE = /^#[0-9a-f]{6}$/i;

/**
 * @typedef {{ type: 'texte'|'entier'|'booleen'|'heure'|'url'|'telephone'|'choix'|'coordenadas'|'couleur',
 *             defaut: any, defautCle?: string, libelleCle?: string, jour?: number,
 *             options?: Array<{valeur:string}>, groupe?: string,
 *             min?: number, max?: number, maxLongueur?: number, reserve?: 'SUPERADMIN' }} Reglage
 */

/**
 * LES LIBELLES NE SONT PAS ICI.
 *
 * Chaque entree tire son libelle et son explication du dictionnaire, par
 * convention : la cle « salon.nom » lit « reglage.salon.nom.libelle » et, s'il
 * existe, « reglage.salon.nom.aide ». Rien a declarer deux fois, donc rien qui
 * puisse se contredire — et surtout, les libelles sont resolus AU MOMENT OU ON
 * LES DEMANDE, pas au chargement du module. C'est indispensable : le catalogue
 * est construit une seule fois au demarrage, et la langue du salon peut changer
 * apres.
 *
 * L'IDENTITE VIENT EN TETE, et la langue en tete de l'identite. L'ordre de cet
 * objet est l'ordre du formulaire — le premier ecran qu'ouvre un gerant qui
 * installe le salon doit commencer par la question qui commande toutes les
 * autres.
 */
/** @type {Record<string, Reglage>} */
/** Longueur sous laquelle une cle d'ecran est remplacee (noms complets). */
const CLE_PANTALLA_MIN = 20;

/**
 * LA MARQUE.
 *
 * Ce qui fait qu'une meme application devient LE salon d'un client : son nom,
 * son activite, sa palette, ses lettres, son logo. Ces reglages portent
 * `reserve: 'SUPERADMIN'` : seul l'editeur qui livre l'application les change
 * (voir peutEcrire()). Le gerant regle sa journee, pas son identite.
 */
export const ACTIVITES = ['BARBERIA', 'PELUQUERIA', 'UNISEX', 'ESTETICA', 'ONGLES'];
export const PALETTES = ['ONYX', 'IVOIRE', 'NACRE', 'POUDRE', 'CORAIL', 'LILAS', 'NUDE', 'PRUNE', 'EMERAUDE', 'BORDEAUX', 'MINUIT', 'PERSO'];
export const TYPOGRAPHIES = ['CLASSIQUE', 'COUTURE', 'PRESTIGE', 'MODERNE', 'DOUCE'];
/** La composition de la page d'accueil : centree et solennelle, ou en images. */
export const ACCUEILS = ['CLASSIQUE', 'IMAGES', 'FICHE'];
export const ANGLES = ['NETS', 'DOUX', 'ARRONDIS'];
const choix = (valeurs) => valeurs.map((valeur) => ({ valeur }));

/**
 * LE PAYS : le fuseau horaire et l'indicatif telephonique.
 *
 * Ils venaient du fichier .env seul. Une application vendue en Espagne et au
 * Maroc doit pouvoir les regler a l'ecran, comme la langue et la monnaie. Le
 * .env reste la valeur de DEPART (celle d'une base qui n'a encore rien
 * choisi) : un salon deja en service ne change donc pas d'heure en recevant
 * cette version.
 *
 * Les fuseaux sont une liste fermee de noms IANA : un nom libre mal tape
 * ferait planter le calcul de « aujourd'hui » pour tout le salon.
 */
const IDENTIFIANT_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const FUSEAU_ENV = config.timezone;
const INDICATIF_ENV = Number(config.indicatifDefaut) || 34;
const FUSEAUX = [
  ['Europe/Madrid', 'España — Madrid'], ['Atlantic/Canary', 'España — Canarias'], ['Africa/Casablanca', 'Maroc — Casablanca'],
  ['Europe/Paris', 'France — Paris'], ['Europe/Brussels', 'Belgique — Bruxelles'], ['Europe/Lisbon', 'Portugal — Lisboa'],
  ['Europe/London', 'United Kingdom — London'], ['Europe/Rome', 'Italia — Roma'], ['Europe/Berlin', 'Deutschland — Berlin'],
  ['Africa/Algiers', 'Algérie — Alger'], ['Africa/Tunis', 'Tunisie — Tunis'], ['Africa/Cairo', 'Egypt — Cairo'],
  ['Asia/Riyadh', 'Saudi Arabia — Riyadh'], ['Asia/Dubai', 'UAE — Dubai'], ['America/Toronto', 'Canada — Montréal / Toronto'],
];
if (!FUSEAUX.some(([v]) => v === FUSEAU_ENV)) FUSEAUX.unshift([FUSEAU_ENV, FUSEAU_ENV]);
export const CODES_FUSEAUX = FUSEAUX.map(([v]) => v);

export const CATALOGUE = {
  'salon.nom': {
    // Une installation neuve s'appelle « Mi salon » jusqu'a ce que la marque
    // soit posee : l'application se vend a plusieurs salons, elle ne porte le
    // nom d'aucun. Un salon en service a son nom en base, ce defaut ne le touche pas.
    type: 'texte', defaut: 'Mi salón', defautCle: 'reglage.salon.nom.defaut', maxLongueur: 60, reserve: 'SUPERADMIN',
  },
  'marque.activite': {
    type: 'choix', defaut: 'BARBERIA', options: choix(ACTIVITES), reserve: 'SUPERADMIN',
  },
  'salon.idioma': {
    type: 'choix', defaut: LANGUE_DEFAUT, options: optionsLangues(), reserve: 'SUPERADMIN',
  },
  'salon.moneda': {
    type: 'choix', defaut: DEVISE_DEFAUT, options: optionsDevises(), reserve: 'SUPERADMIN',
  },
  'pays.fuseau': {
    type: 'choix', defaut: FUSEAU_ENV, options: FUSEAUX.map(([valeur, libelle]) => ({ valeur, libelle })), reserve: 'SUPERADMIN',
  },
  'pays.indicatif': {
    type: 'entier', defaut: INDICATIF_ENV, min: 1, max: 9999, reserve: 'SUPERADMIN',
  },
  'marque.palette': {
    type: 'choix', defaut: 'ONYX', options: choix(PALETTES), reserve: 'SUPERADMIN',
  },
  // Lues seulement quand la palette est PERSO.
  'marque.couleurFond': {
    type: 'couleur', defaut: '#0b0b0d', maxLongueur: 7, reserve: 'SUPERADMIN',
  },
  'marque.couleurAccent': {
    type: 'couleur', defaut: '#c9a45c', maxLongueur: 7, reserve: 'SUPERADMIN',
  },
  'marque.typographie': {
    type: 'choix', defaut: 'CLASSIQUE', options: choix(TYPOGRAPHIES), reserve: 'SUPERADMIN',
  },
  'marque.angles': {
    type: 'choix', defaut: 'NETS', options: choix(ANGLES), reserve: 'SUPERADMIN',
  },
  'marque.accueil': {
    type: 'choix', defaut: 'CLASSIQUE', options: choix(ACCUEILS), reserve: 'SUPERADMIN',
  },
  // Les lettres du monogramme, quand il n'y a pas de logo. Vide : les
  // initiales du nom.
  'marque.monogramme': {
    type: 'texte', defaut: '', maxLongueur: 3, reserve: 'SUPERADMIN',
  },
  'salon.accroche': {
    // Le defaut suit la langue : un salon installe en francais ne doit pas
    // afficher une accroche espagnole tant que le gerant n'a rien saisi.
    type: 'texte', defaut: 'Pide tu turno sin esperar de pie.',
    defautCle: 'reglage.salon.accroche.defaut', maxLongueur: 120,
  },
  // Quelques lignes sur la maison, en tete de la vitrine. Vide : pas de section.
  'salon.presentation': {
    type: 'texte', defaut: '', maxLongueur: 600, lignes: true,
  },
  'salon.adresse': {
    type: 'texte', defaut: '', maxLongueur: 160,
  },
  'salon.telephone': {
    type: 'telephone', defaut: '', maxLongueur: 25,
  },
  'salon.whatsapp': {
    type: 'telephone', defaut: '', maxLongueur: 25,
  },
  'salon.coordenadas': {
    type: 'coordenadas', defaut: '', maxLongueur: 44,
  },
  'salon.comoLlegar': {
    type: 'texte', defaut: '', maxLongueur: 400,
  },
  // La page Instagram du salon : c'est la que les clientes regardent son travail.
  'salon.instagram': {
    type: 'url', defaut: '', maxLongueur: 200,
  },

  'file.dureeMoyenneMinutes': {
    type: 'entier', defaut: 20, min: 1, max: 240,
  },
  'file.seuilPrevenir': {
    type: 'entier', defaut: 2, min: 0, max: 20,
  },
  'file.mode': {
    type: 'choix',
    defaut: 'UNIQUE',
    options: [{ valeur: 'UNIQUE' }, { valeur: 'PAR_FAUTEUIL' }],
  },
  'file.priseDeTourOuverte': {
    type: 'booleen', defaut: true,
  },
  'file.messagePause': {
    type: 'texte', defaut: '', maxLongueur: 160,
  },
  'file.maxParJour': {
    type: 'entier', defaut: 200, min: 1, max: 2000,
  },

  'horaires.actifs': {
    type: 'booleen', defaut: false,
  },

  // DEUX FACONS DE VENIR, CHACUNE SE COUPE.
  //
  // La file d'attente en ligne (le client prend son tour depuis son
  // telephone) et les rendez-vous (il choisit un creneau). Un barbier de
  // quartier vit de la file ; un salon de luxe ne travaille que sur
  // rendez-vous ; beaucoup font les deux. La file du COMPTOIR, elle, reste
  // toujours ouverte au personnel.
  'accueil.file': {
    type: 'booleen', defaut: true,
  },
  'rdv.actifs': {
    type: 'booleen', defaut: false,
  },
  // L'intervalle entre deux heures proposees : 9:00, 9:15, 9:30...
  'rdv.pasMinutes': {
    type: 'entier', defaut: 15, min: 5, max: 60,
  },
  // Pas de rendez-vous pris dans l'heure : le salon doit pouvoir s'organiser.
  'rdv.delaiMinutes': {
    type: 'entier', defaut: 60, min: 0, max: 2880,
  },
  'rdv.horizonJours': {
    type: 'entier', defaut: 21, min: 1, max: 90,
  },
  // Jusqu'a combien d'heures avant le client annule-t-il lui-meme ?
  'rdv.annulationHeures': {
    type: 'entier', defaut: 2, min: 0, max: 72,
  },
  // Temps laisse entre deux rendez-vous du meme fauteuil (nettoyage, retard).
  'rdv.tamponMinutes': {
    type: 'entier', defaut: 0, min: 0, max: 30,
  },
  'rdv.choixProfessionnel': {
    type: 'booleen', defaut: true,
  },
  // Rendez-vous a venir qu'un meme numero peut tenir a la fois.
  'rdv.maxParNumero': {
    type: 'entier', defaut: 2, min: 1, max: 5,
  },
  // Une phrase sur la confirmation : « Merci d'arriver cinq minutes avant ».
  'rdv.message': {
    type: 'texte', defaut: '', maxLongueur: 240,
  },

  // LES SECTIONS DE LA VITRINE, une par une. Allumees par defaut : une section
  // dont les donnees manquent disparait d'elle-meme (pas d'adresse, pas de
  // carte), et ces interrupteurs servent a retirer celles qu'on NE VEUT PAS
  // montrer, pas a faire apparaitre celles qu'on a remplies.
  // L'equipe : les professionnels (le nom porte par chaque fauteuil).
  'vitrine.equipe': {
    type: 'booleen', defaut: true,
  },
  'vitrine.galerie': {
    type: 'booleen', defaut: true,
  },
  'vitrine.localisation': {
    type: 'booleen', defaut: true,
  },
  'vitrine.contact': {
    type: 'booleen', defaut: true,
  },
  'vitrine.etapes': {
    type: 'booleen', defaut: true,
  },
  // Les avis des clients : l'invitation sur la page de suivi, et la section.
  'vitrine.avis': {
    type: 'booleen', defaut: true,
  },
  // « Notre exigence » : quatre engagements de la maison (accueil en images).
  'vitrine.engagements': {
    type: 'booleen', defaut: true,
  },
  // Les engagements ecrits par le salon, un par ligne, « Titre : texte ».
  // Vide : ceux de l'activite.
  'salon.engagements': {
    type: 'texte', defaut: '', maxLongueur: 600, lignes: true,
  },

  // LE PROGRAMME DE FIDELITE. Eteint par defaut : c'est une promesse faite
  // aux clients, elle se decide.
  'fidelite.active': {
    type: 'booleen', defaut: false,
  },
  // Le nombre de seances qui donne droit au cadeau.
  'fidelite.seances': {
    type: 'entier', defaut: 10, min: 2, max: 50,
  },
  // La prestation offerte : une ligne de la carte (ses options viennent de la
  // base, d'ou « dynamique »), ou aucune.
  'fidelite.prestation': {
    type: 'choix', defaut: '', options: [], dynamique: true,
  },
  // Un cadeau decrit librement, seul ou en plus de la prestation.
  'fidelite.cadeau': {
    type: 'texte', defaut: '', maxLongueur: 120,
  },

  // La fiche de prix elle-meme vit dans sa propre table, avec son propre ecran.
  // Ces deux reglages ne disent que comment la SECTION se presente en vitrine.
  'tarifas.visible': {
    type: 'booleen', defaut: true,
  },
  'tarifas.nota': {
    type: 'texte', defaut: '', maxLongueur: 160,
  },

  'pantalla.nombres': {
    type: 'choix',
    defaut: 'NOMBRE',
    options: [{ valeur: 'NINGUNO' }, { valeur: 'NOMBRE' }, { valeur: 'COMPLETO' }],
  },
  'pantalla.clave': {
    type: 'texte', defaut: '', maxLongueur: 64,
  },
  'public.url': {
    type: 'url', defaut: '', maxLongueur: 300,
  },
};

// Les horaires : une paire ouverture/fermeture par jour de la semaine.
// Vides tous les deux = ferme ce jour-la.
for (let j = 0; j < 7; j += 1) {
  CATALOGUE['horaires.' + j + '.ouverture'] = {
    type: 'heure', defaut: j === 0 ? '' : '09:30', maxLongueur: 5,
    libelleCle: 'reglage.horaires.ouverture', jour: j, groupe: 'horaires',
  };
  CATALOGUE['horaires.' + j + '.fermeture'] = {
    type: 'heure', defaut: j === 0 ? '' : '20:00', maxLongueur: 5,
    libelleCle: 'reglage.horaires.fermeture', jour: j, groupe: 'horaires',
  };
  // La coupure du milieu de journee. Vide, la journee est d'un seul tenant.
  //
  // L'explication n'est posee QUE sur le lundi : repetee sept fois, elle
  // deviendrait du bruit qu'on ne lit plus, et c'est le premier jour du
  // formulaire.
  CATALOGUE['horaires.' + j + '.pauseDebut'] = {
    type: 'heure', defaut: '', maxLongueur: 5,
    libelleCle: 'reglage.horaires.pauseDebut', jour: j, groupe: 'horaires',
    aideCle: j === 1 ? 'reglage.horaires.pauseAide' : undefined,
  };
  CATALOGUE['horaires.' + j + '.pauseFin'] = {
    type: 'heure', defaut: '', maxLongueur: 5,
    libelleCle: 'reglage.horaires.pauseFin', jour: j, groupe: 'horaires',
  };
}

export const CLES = Object.keys(CATALOGUE);

/* ------------------------------------------------------------------ */
/*  Le catalogue, mis en mots                                          */
/* ------------------------------------------------------------------ */

/**
 * Le catalogue tel que l'interface le recoit : libelles, aides et options
 * traduits, dans la langue demandee.
 *
 * C'est la seule sortie du catalogue vers l'exterieur. Le catalogue brut reste
 * exporte pour les tests et pour le domaine, qui n'ont besoin que des types et
 * des bornes.
 */
export function catalogueTraduit(langue = null) {
  const dire = (cle, params = null) => (langue ? texteEnLangue(langue, cle, params) : t(cle, params));
  return CLES.map((cle) => {
    const regle = CATALOGUE[cle];
    const params = regle.jour === undefined ? null : { jour: nomJour(regle.jour, langue) };
    const aideCle = regle.aideCle ?? ('reglage.' + cle + '.aide');
    const sortie = {
      cle,
      type: regle.type,
      libelle: dire(regle.libelleCle ?? ('reglage.' + cle + '.libelle'), params),
      groupe: regle.groupe ?? cle.split('.')[0],
    };
    if (regle.aideCle || existe(aideCle)) sortie.aide = dire(aideCle, params);
    if (regle.min !== undefined) sortie.min = regle.min;
    if (regle.max !== undefined) sortie.max = regle.max;
    if (regle.maxLongueur !== undefined) sortie.maxLongueur = regle.maxLongueur;
    if (regle.reserve) sortie.reserve = regle.reserve;
    if (regle.options) {
      // Une option qui porte deja son nom le garde : « Español » ne se traduit
      // pas en francais, et « Dirham (DH) » ne se traduit pas en espagnol. Ce
      // sont des noms propres, pas des libelles d'interface.
      sortie.options = regle.options.map((o) => ({
        valeur: o.valeur,
        libelle: o.libelle ?? dire('reglage.' + cle + '.' + o.valeur),
      }));
    }
    sortie.defaut = regle.defautCle ? dire(regle.defautCle) : regle.defaut;
    return sortie;
  });
}

/* ------------------------------------------------------------------ */
/*  Coordonnees                                                        */
/* ------------------------------------------------------------------ */

/**
 * « 40.416775, -3.703790 » — ce que Google Maps met dans le presse-papier.
 *
 * On accepte la virgule ET le point-virgule comme separateur, et on tolere les
 * espaces : c'est ce qui sort d'un copier-coller sur telephone. On refuse en
 * revanche la virgule DECIMALE, pourtant l'usage espagnol : « 40,41 , -3,70 »
 * est indechiffrable sans deviner, et deviner la position d'un salon est la
 * derniere chose a faire. Le gerant voit alors un message qui montre la forme
 * attendue.
 *
 * @returns {string|null} la forme normalisee « lat,lon », ou null si illisible.
 */
export function normaliserCoordonnees(brut) {
  const texte = String(brut ?? '').trim();
  if (!texte) return null;
  const parts = texte.split(/\s*[;,]\s*/);
  if (parts.length !== 2) return null;

  const nombres = parts.map((p) => {
    const t = p.trim();
    return /^[-+]?\d{1,3}(\.\d{1,8})?$/.test(t) ? Number(t) : Number.NaN;
  });
  const [lat, lon] = nombres;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;

  // Le point (0, 0) est au large du golfe de Guinee : c'est ce que rend un
  // champ a moitie rempli, jamais un salon.
  if (lat === 0 && lon === 0) return null;

  return lat + ',' + lon;
}

/* ------------------------------------------------------------------ */
/*  Conversion                                                         */
/* ------------------------------------------------------------------ */

/**
 * La valeur par defaut d'un reglage, dans la langue du salon.
 *
 * La plupart sont des constantes ; l'accroche de la page d'accueil est une
 * phrase, et une phrase a une langue. On ne peut donc pas la figer dans le
 * catalogue, qui est construit une fois pour toutes au demarrage.
 */
export function defautDe(cle) {
  const regle = CATALOGUE[cle];
  if (!regle) return null;
  return regle.defautCle ? t(regle.defautCle) : regle.defaut;
}

/**
 * Convertit la chaine stockee en base vers le type declare. Jamais d'exception.
 *
 * UNE VALEUR VIDE RETOMBE SUR LE DEFAUT pour tout ce qui ne peut pas etre vide :
 * un choix, des coordonnees. Une chaine vide rendue pour « salon.idioma » aurait
 * donne un menu deroulant sans rien de selectionne, et un « <html lang=""> ».
 * Les textes, eux, ont parfaitement le droit d'etre vides — c'est ainsi qu'on
 * retire une note de la vitrine.
 */
function depuisTexte(cle, brut) {
  const regle = CATALOGUE[cle];
  if (!regle) return null;
  if (brut === null || brut === undefined || brut === '') {
    if (regle.type === 'texte' || regle.type === 'url' || regle.type === 'telephone' || regle.type === 'heure') {
      return brut === '' ? '' : defautDe(cle);
    }
    return defautDe(cle);
  }
  switch (regle.type) {
    case 'entier': {
      const n = /^-?\d+$/.test(brut) ? Number(brut) : Number.NaN;
      if (!Number.isSafeInteger(n)) return regle.defaut;
      return Math.min(regle.max ?? n, Math.max(regle.min ?? n, n));
    }
    case 'booleen':
      return /^(1|true|oui|on)$/i.test(brut);
    case 'heure':
      return heureValide(brut) ? brut : '';
    case 'choix':
      if (regle.dynamique) return IDENTIFIANT_RE.test(brut) ? brut : regle.defaut;
      return regle.options.some((o) => o.valeur === brut) ? brut : regle.defaut;
    case 'coordenadas':
      return normaliserCoordonnees(brut) || '';
    case 'couleur':
      return COULEUR_RE.test(brut) ? brut.toLowerCase() : regle.defaut;
    default:
      return String(brut);
  }
}

/**
 * Valide une valeur soumise par le gerant et rend sa forme de stockage (texte).
 *
 * TROIS DE CES MESSAGES ETAIENT EN FRANCAIS dans une interface espagnole — la
 * valeur oui/non, l'heure et l'adresse. Personne ne les avait vus parce qu'on ne
 * les declenche qu'en se trompant, et qu'on ne se trompe pas en relisant son
 * propre code. Ils passent tous par le dictionnaire maintenant : une phrase qui
 * n'a pas de cle ne peut plus etre oubliee dans une langue.
 */
export function versTexte(cle, valeur) {
  const regle = CATALOGUE[cle];
  if (!regle) throw new ValidationError({ [cle]: t('valid.reglageInconnu') });
  const vide = valeur === null || valeur === undefined || String(valeur).trim() === '';

  switch (regle.type) {
    case 'entier': {
      if (vide) throw new ValidationError({ [cle]: t('valid.valeurAttendue') });
      const texte = String(valeur).trim();
      const n = /^-?\d+$/.test(texte) ? Number(texte) : Number.NaN;
      if (!Number.isSafeInteger(n)) throw new ValidationError({ [cle]: t('valid.entierAttendu') });
      if (regle.min !== undefined && n < regle.min) throw new ValidationError({ [cle]: t('valid.minimum', { min: regle.min }) });
      if (regle.max !== undefined && n > regle.max) throw new ValidationError({ [cle]: t('valid.maximum', { max: regle.max }) });
      return String(n);
    }
    case 'booleen':
      if (typeof valeur === 'boolean') return valeur ? 'true' : 'false';
      if (/^(1|true|oui|on)$/i.test(String(valeur).trim())) return 'true';
      if (/^(0|false|non|off)$/i.test(String(valeur).trim())) return 'false';
      throw new ValidationError({ [cle]: t('valid.ouiNon') });
    case 'heure': {
      if (vide) return '';
      const texte = String(valeur).trim().slice(0, 5);
      if (!heureValide(texte)) throw new ValidationError({ [cle]: t('valid.heure') });
      return texte;
    }
    case 'choix': {
      // La langue se stocke en minuscules (« es », « fr ») : ce sont des codes
      // ISO, et les mettre en majuscules comme les autres choix aurait donne
      // « ES » dans « <html lang> ». Les autres choix restent en majuscules.
      const brut = String(valeur).trim();
      // Un choix dont les options vivent en base (une ligne de la carte) :
      // vide, ou un identifiant. Qu'il existe encore se verifie a l'usage.
      if (regle.dynamique) {
        if (brut !== '' && !IDENTIFIANT_RE.test(brut)) throw new ValidationError({ [cle]: t('valid.choix', { valeurs: '—' }) });
        return brut;
      }
      const texte = regle.options.some((o) => o.valeur === brut) ? brut : brut.toUpperCase();
      if (!regle.options.some((o) => o.valeur === texte)) {
        throw new ValidationError({ [cle]: t('valid.choix', { valeurs: regle.options.map((o) => o.valeur).join(', ') }) });
      }
      return texte;
    }
    case 'couleur': {
      const texte = String(valeur ?? '').trim().toLowerCase();
      if (!COULEUR_RE.test(texte)) throw new ValidationError({ [cle]: t('valid.couleur') });
      return texte;
    }
    case 'url': {
      if (vide) return '';
      const brutUrl = String(valeur).trim();
      if (brutUrl.length > (regle.maxLongueur ?? 300) + 50) throw new ValidationError({ [cle]: t('valid.urlTropLongue') });
      // Pas d'expression « barres finales » : quadratique (voir sansBarresFinales).
      const texte = sansBarresFinales(brutUrl);
      try {
        const u = new URL(texte);
        if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('protocole');
      } catch {
        throw new ValidationError({ [cle]: t('valid.url') });
      }
      if (texte.length > (regle.maxLongueur ?? 300)) throw new ValidationError({ [cle]: t('valid.urlTropLongue') });
      return texte;
    }
    case 'coordenadas': {
      if (vide) return '';
      const normalisees = normaliserCoordonnees(valeur);
      if (!normalisees) throw new ValidationError({ [cle]: t('valid.coordonnees') });
      return normalisees;
    }
    case 'telephone': {
      if (vide) return '';
      const texte = String(valeur).replace(/\s+/g, ' ').trim();
      if (!/^\+?[0-9][0-9\s.\-()/]*$/.test(texte)) throw new ValidationError({ [cle]: t('valid.telephone') });
      if (texte.length > (regle.maxLongueur ?? 25)) throw new ValidationError({ [cle]: t('valid.telephoneTropLong') });
      return texte;
    }
    default: {
      // Un texte « a lignes » (presentation, engagements) garde ses retours :
      // ce sont eux qui font les paragraphes. Une ligne vide au plus entre deux.
      const texte = regle.lignes
        ? String(valeur).split(/\r?\n/).map((l) => l.replace(/\s+/g, ' ').trim()).join('\n').replace(/\n{3,}/g, '\n\n').trim()
        : String(valeur).replace(/\s+/g, ' ').trim();
      if (texte.length > (regle.maxLongueur ?? 200)) {
        throw new ValidationError({ [cle]: t('valid.texteTropLong', { max: regle.maxLongueur ?? 200 }) });
      }
      return texte;
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Lecture (avec cache court)                                         */
/* ------------------------------------------------------------------ */

const DUREE_CACHE_MS = 5000;

/**
 * Le nom du salon, tel que le dernier chargement des reglages l'a lu.
 *
 * Meme raisonnement que la langue : une base, un salon, un nom. Le logo, le
 * medaillon des tarifs et les balises de partage le lisent ici plutot que de
 * l'ecrire en dur — il etait ecrit « Peluquería HARON » dans le code, si bien
 * qu'un salon de Casablanca aurait porte l'enseigne de Fuente Alamo.
 */
const NOM_PAR_DEFAUT = 'Mi salón';
let nomActif = NOM_PAR_DEFAUT;
export const nomDuSalon = () => nomActif;

/**
 * LE THEME COURANT, calcule une fois par lecture des reglages et garde ici :
 * chaque page en a besoin (adresse versionnee de /theme.css, couleur de la
 * barre du navigateur), et le recalculer a chaque requete serait absurde.
 */
let themeActif = null;
function poserTheme(r, logo = null) {
  const theme = themeDe(r);
  const css = cssDuTheme(theme);
  themeActif = {
    ...theme,
    css,
    empreinte: empreinte(css),
    monogramme: monogrammeDe(r),
    activite: r['marque.activite'],
    logo: logo ? { src: '/photos/' + logo.fichier, largeur: logo.largeur, hauteur: logo.hauteur } : null,
  };
}
export function themeCourant() {
  // Avant toute lecture (tests de rendu, toute premiere requete) : le theme
  // des valeurs par defaut, plutot qu'une page sans couleurs.
  if (!themeActif) poserTheme(Object.fromEntries(Object.keys(CATALOGUE).map((cle) => [cle, CATALOGUE[cle].defaut])));
  return themeActif;
}
let cache = null;
let cacheAt = 0;

export function invaliderCache() {
  cache = null;
  cacheAt = 0;
}

/**
 * Tous les reglages, catalogue complet, valeurs par defaut comprises.
 *
 * C'EST ICI QUE LA LANGUE ET LA MONNAIE DU SALON ENTRENT EN VIGUEUR, et l'ordre
 * des trois etapes n'est pas indifferent :
 *
 *   1. lire la langue et la monnaie telles qu'elles sont stockees,
 *   2. les rendre actives,
 *   3. seulement ensuite, resoudre les autres valeurs.
 *
 * Inverser 2 et 3 ferait calculer l'accroche par defaut dans la langue
 * PRECEDENTE — invisible tant que le defaut n'est pas utilise, donc invisible
 * jusqu'au jour de l'installation d'un nouveau salon.
 */
export async function lireTous({ frais = false } = {}) {
  if (!frais && cache && Date.now() - cacheAt < DUREE_CACHE_MS) return cache;
  // Le LOGO voyage avec les reglages : chaque page en a besoin pour son en-tete,
  // et le relire a chaque rendu serait absurde. Meme cache, meme duree.
  const [rows, logos] = await Promise.all([
    all('SELECT cle, valeur FROM reglages WHERE cle = ANY($1)', [CLES]),
    all("SELECT fichier, largeur, hauteur FROM photos WHERE usage = 'LOGO'").catch(() => []),
  ]);
  const stockes = new Map(rows.map((r) => [r.cle, r.valeur]));

  const langue = poserLangueActive(depuisTexte('salon.idioma', stockes.get('salon.idioma')));
  const devise = poserDeviseActive(depuisTexte('salon.moneda', stockes.get('salon.moneda')));

  const sortie = {};
  for (const cle of CLES) {
    sortie[cle] = stockes.has(cle) ? depuisTexte(cle, stockes.get(cle)) : defautDe(cle);
  }
  sortie['salon.idioma'] = langue;
  sortie['salon.moneda'] = devise;
  nomActif = sortie['salon.nom'] || defautDe('salon.nom') || NOM_PAR_DEFAUT;
  poserActivite(sortie['marque.activite']);
  // Le fuseau et l'indicatif choisis a l'ecran deviennent ceux de TOUT le
  // serveur : les calculs de jour et la lecture des numeros lisent `config`.
  config.timezone = sortie['pays.fuseau'] || FUSEAU_ENV;
  config.indicatifDefaut = String(sortie['pays.indicatif'] || INDICATIF_ENV);
  poserTheme(sortie, logos[0] || null);

  cache = sortie;
  cacheAt = Date.now();
  return sortie;
}

export async function lire(cle) {
  const tous = await lireTous();
  return tous[cle];
}

/**
 * Enregistre un lot de reglages. Tout est valide AVANT d'ecrire quoi que ce
 * soit : un formulaire a moitie applique laisserait le salon dans un etat que
 * personne n'a voulu.
 *
 * @param {object} valeurs  { 'file.dureeMoyenneMinutes': 25, ... }
 * @param {{ tx?: object, parUtilisateurId?: string|null }} [opts]
 */
export async function enregistrer(valeurs, { tx = null, parUtilisateurId = null } = {}) {
  const erreurs = {};
  const aEcrire = [];
  for (const [cle, valeur] of Object.entries(valeurs || {})) {
    if (!Object.hasOwn(CATALOGUE, cle)) {
      erreurs[cle] = t('valid.reglageInconnu');
      continue;
    }
    try {
      aEcrire.push([cle, versTexte(cle, valeur)]);
    } catch (err) {
      if (err instanceof ValidationError) Object.assign(erreurs, err.fields);
      else throw err;
    }
  }
  if (Object.keys(erreurs).length) throw new ValidationError(erreurs);
  if (!aEcrire.length) return 0;

  // Coherence des horaires : une fermeture avant l'ouverture rendrait le salon
  // ferme toute la journee sans que personne comprenne pourquoi.
  const parJour = new Map();
  for (const [cle, texte] of aEcrire) {
    const m = /^horaires\.(\d)\.(ouverture|fermeture|pauseDebut|pauseFin)$/.exec(cle);
    if (m) {
      if (!parJour.has(m[1])) parJour.set(m[1], {});
      parJour.get(m[1])[m[2]] = texte;
    }
  }
  if (parJour.size) {
    const actuels = await lireTous({ frais: true });
    for (const [jour, saisi] of parJour) {
      const nom = nomJour(Number(jour));
      const valeur = (champ) => saisi[champ] ?? actuels['horaires.' + jour + '.' + champ];
      const ouverture = valeur('ouverture');
      const fermeture = valeur('fermeture');
      const pauseDebut = valeur('pauseDebut');
      const pauseFin = valeur('pauseFin');

      if (ouverture && fermeture && heureEnMinutes(fermeture) <= heureEnMinutes(ouverture)) {
        throw new ValidationError({
          ['horaires.' + jour + '.fermeture']: t('valid.fermetureApresOuverture', { jour: nom }),
        });
      }

      // Une coupure a moitie saisie fermerait le salon a l'heure du dejeuner ou
      // pas du tout, selon le champ oublie. On refuse les deux cas.
      if (Boolean(pauseDebut) !== Boolean(pauseFin)) {
        throw new ValidationError({
          ['horaires.' + jour + (pauseDebut ? '.pauseFin' : '.pauseDebut')]:
            t('valid.pauseDeuxHeures', { jour: nom }),
        });
      }

      if (pauseDebut && pauseFin) {
        if (heureEnMinutes(pauseFin) <= heureEnMinutes(pauseDebut)) {
          throw new ValidationError({
            ['horaires.' + jour + '.pauseFin']: t('valid.pauseFinApresDebut', { jour: nom }),
          });
        }
        // Une coupure qui deborde de la journee n'a pas de sens, et la
        // silencieuse ignorer laisserait le gerant croire qu'elle s'applique.
        if (ouverture && fermeture
          && (heureEnMinutes(pauseDebut) <= heureEnMinutes(ouverture)
            || heureEnMinutes(pauseFin) >= heureEnMinutes(fermeture))) {
          throw new ValidationError({
            ['horaires.' + jour + '.pauseDebut']:
              t('valid.pauseDansJournee', { jour: nom, ouverture, fermeture }),
          });
        }
      }
    }
  }

  /*
   * L'ECRAN QUI MONTRE LES NOMS COMPLETS SE FERME.
   *
   * L'adresse de /pantalla n'a pas de session : elle est lisible par quiconque
   * la connait. Montrer un nom de famille sur une page ouverte a tout internet
   * n'est pas la meme chose que de l'afficher sur un mur, et le gerant qui
   * coche « nombre y apellido » pense au mur.
   *
   * On ne le lui refuse pas — c'est son salon — mais on ne le laisse pas non
   * plus croire que l'ecran est prive alors qu'il ne l'est pas. La cle est
   * donc fabriquee ICI, toute seule, au moment ou elle devient necessaire :
   * une friction de moins, et la promesse tenue.
   *
   * Vingt-quatre octets : on ne devine pas une adresse pareille, et elle tient
   * dans un champ qu'on recopie sur un televiseur.
   */
  //
  // UNE CLE COURTE NE PROTEGE RIEN. Le champ etait libre : « 1 » protegeait
  // des noms de famille qu'on trouvait en dix essais. Avec les noms complets,
  // une cle de moins de vingt caracteres est remplacee par une cle tiree au
  // sort — que la cle change, ou que l'affichage passe aux noms complets.
  const aEcrireMap = new Map(aEcrire);
  if (aEcrireMap.has('pantalla.nombres') || aEcrireMap.has('pantalla.clave')) {
    const actuels = await lireTous({ frais: true });
    const nombres = aEcrireMap.get('pantalla.nombres') ?? actuels['pantalla.nombres'];
    const cle = String(aEcrireMap.get('pantalla.clave') ?? actuels['pantalla.clave'] ?? '');
    if (nombres === 'COMPLETO' && cle.length < CLE_PANTALLA_MIN) {
      const neuve = randomBytes(24).toString('base64url');
      const i = aEcrire.findIndex(([k]) => k === 'pantalla.clave');
      if (i >= 0) aEcrire[i] = ['pantalla.clave', neuve];
      else aEcrire.push(['pantalla.clave', neuve]);
    }
  }

  const exec = tx ? tx.execute.bind(tx) : execute;
  let n = 0;
  for (const [cle, texte] of aEcrire) {
    n += await exec(
      `INSERT INTO reglages (cle, valeur, updated_at, updated_by) VALUES ($1,$2, now(), $3)
       ON CONFLICT (cle) DO UPDATE SET valeur = EXCLUDED.valeur, updated_at = now(), updated_by = EXCLUDED.updated_by`,
      [cle, texte, parUtilisateurId],
    );
  }
  invaliderCache();
  return n;
}

/* ------------------------------------------------------------------ */
/*  Lectures derivees                                                  */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  L'identite, et sa coherence avec le serveur                        */
/* ------------------------------------------------------------------ */

/**
 * Ce qu'on attend du serveur selon la monnaie du salon.
 *
 * LA MONNAIE SERT DE PAYS, pas la langue. Un salon de Tanger peut parler
 * espagnol tout en encaissant des dirhams, et un salon de Perpignan parler
 * francais en encaissant des euros : la langue ne dit rien du fuseau ni de
 * l'indicatif. La monnaie, elle, ne se choisit pas — c'est celle du pays ou l'on
 * encaisse.
 *
 * L'euro couvre l'Espagne, la France et la Belgique : on ne peut donc rien en
 * deduire de precis, et on se garde d'inventer une attente qu'on ne sait pas
 * verifier. Seule la contradiction franche est signalee.
 */
const ATTENDU_PAR_DEVISE = {
  MAD: { timezone: 'Africa/Casablanca', indicatif: '212' },
  EUR: { timezone: null, indicatif: null },
};

/**
 * Les contradictions entre ce qui se regle a l'ecran et ce qui se regle dans le
 * fichier .env.
 *
 * ELLES NE BLOQUENT RIEN. Un salon marocain dont le fuseau est reste sur Madrid
 * fonctionne — mal, mais il fonctionne, et refuser d'enregistrer la monnaie
 * jusqu'a ce que quelqu'un se connecte en SSH serait absurde. On dit le probleme
 * a l'endroit ou l'on vient de faire le choix qui le cree, et on dit quoi
 * changer.
 *
 * C'est la seule reponse honnete a un reglage a moitie dans la base et a moitie
 * dans l'environnement : montrer les deux moities cote a cote.
 */
export function coherenceIdentite(reglages) {
  const devise = reglages['salon.moneda'] || DEVISE_DEFAUT;
  const langue = reglages['salon.idioma'] || LANGUE_DEFAUT;
  const attendu = ATTENDU_PAR_DEVISE[devise] || { timezone: null, indicatif: null };
  const avertissements = [];

  if (attendu.timezone && config.timezone !== attendu.timezone) {
    avertissements.push({
      champ: t('reglage.pays.fuseau.libelle'),
      message: t('identite.fuseauIncoherent', {
        devise: DEVISES[devise]?.symbole ?? devise,
        actuel: config.timezone,
        attendu: attendu.timezone,
      }),
    });
  }
  if (attendu.indicatif && config.indicatifDefaut !== attendu.indicatif) {
    avertissements.push({
      champ: t('reglage.pays.indicatif.libelle'),
      message: t('identite.indicatifIncoherent', {
        devise: DEVISES[devise]?.symbole ?? devise,
        actuel: config.indicatifDefaut,
        attendu: attendu.indicatif,
      }),
    });
  }
  // Une plantilla WhatsApp est declaree par langue chez Meta : demander un
  // modele en espagnol pour un salon francais ne donne pas un message mal
  // traduit, il donne un refus d'envoi.
  if (config.whatsapp.actif && !config.whatsapp.langue.toLowerCase().startsWith(langue)) {
    avertissements.push({
      champ: 'WHATSAPP_LANGUE',
      message: t('identite.whatsappIncoherent', {
        langue: LANGUES[langue]?.nomLocal ?? langue,
        actuel: config.whatsapp.langue,
      }),
    });
  }

  return {
    langue,
    devise,
    timezone: config.timezone,
    indicatif: config.indicatifDefaut,
    whatsappLangue: config.whatsapp.actif ? config.whatsapp.langue : null,
    avertissements,
  };
}

/**
 * L'adresse publique effective : le reglage s'il est pose, sinon PUBLIC_URL,
 * sinon l'adresse vue dans la requete (passee par l'appelant).
 */
export function adressePublique(reglages, secours = '') {
  return (reglages['public.url'] || config.http.publicUrl || secours || '').replace(/\/+$/, '');
}

/**
 * Les plages d'ouverture d'un jour, dans l'ordre.
 *
 * Une seule plage si la journee est d'un seul tenant, deux si le salon coupe au
 * milieu. C'est la SEULE fonction qui sait lire une coupure : tout le reste —
 * la prise de tour, la vitrine, le pied de page, l'affiche — part de sa sortie.
 * Une seconde lecture des memes reglages ailleurs finirait par diverger, et
 * personne ne verrait laquelle des deux a raison.
 *
 * Une coupure incoherente (hors de la journee, ou a l'envers) est IGNOREE
 * plutot que de fermer le salon : la saisie la refuse deja, et si une valeur
 * douteuse arrivait malgre tout en base, mieux vaut un salon ouvert trop
 * longtemps qu'un salon injoignable toute la journee sans explication.
 */
export function plagesDuJour(reglages, jourSemaine) {
  const ouverture = reglages['horaires.' + jourSemaine + '.ouverture'];
  const fermeture = reglages['horaires.' + jourSemaine + '.fermeture'];
  if (!ouverture || !fermeture) return [];

  const debut = heureEnMinutes(ouverture);
  const fin = heureEnMinutes(fermeture);
  if (fin <= debut) return [];

  const pauseDebut = reglages['horaires.' + jourSemaine + '.pauseDebut'];
  const pauseFin = reglages['horaires.' + jourSemaine + '.pauseFin'];
  if (!pauseDebut || !pauseFin) return [{ ouverture, fermeture }];

  const coupure = heureEnMinutes(pauseDebut);
  const reprise = heureEnMinutes(pauseFin);
  if (!(debut < coupure && coupure < reprise && reprise < fin)) return [{ ouverture, fermeture }];

  return [
    { ouverture, fermeture: pauseDebut },
    { ouverture: pauseFin, fermeture },
  ];
}

/**
 * Le salon est-il ouvert a cet instant ? Rend toujours ouvert si le controle
 * est desactive.
 *
 * `ouverture` porte l'heure a annoncer au client qui arrive trop tot : le
 * debut de la prochaine plage du jour, donc l'heure de REPRISE pendant la
 * coupure. Dire « a partir de 10:00 » a quelqu'un qui regarde son telephone a
 * 15 h, un jour ou le salon rouvre a 17 h, est pire que de ne rien dire.
 */
export function estOuvert(reglages, jourSemaine, minutes) {
  if (!reglages['horaires.actifs']) {
    return { ouvert: true, ouverture: null, fermeture: null, enPause: false };
  }

  const plages = plagesDuJour(reglages, jourSemaine);
  if (!plages.length) return { ouvert: false, ouverture: null, fermeture: null, enPause: false };

  for (const plage of plages) {
    const debut = heureEnMinutes(plage.ouverture);
    const fin = heureEnMinutes(plage.fermeture);
    if (minutes >= debut && minutes < fin) {
      return { ouvert: true, ouverture: plage.ouverture, fermeture: plage.fermeture, enPause: false };
    }
  }

  const suivante = plages.find((p) => minutes < heureEnMinutes(p.ouverture));
  return {
    ouvert: false,
    // Rien apres : la journee est finie, on n'annonce aucune heure plutot que
    // celle de ce matin.
    ouverture: suivante ? suivante.ouverture : null,
    fermeture: suivante ? suivante.fermeture : null,
    // Entre deux plages, et non avant la premiere : c'est ce qui permet de
    // dire « on rouvre a » plutot que « on ouvre a ».
    enPause: Boolean(suivante) && minutes >= heureEnMinutes(plages[0].ouverture),
  };
}

/**
 * Les horaires, mis en forme pour l'affichage.
 *
 * `plages` porte la verite ; `ouverture` et `fermeture` restent la pour ce qui
 * ne sait afficher qu'une amplitude, et donnent alors le premier et le dernier
 * horaire du jour.
 */
export function horairesLisibles(reglages, langue = null) {
  const lignes = [];
  for (let j = 1; j <= 7; j += 1) {
    const jour = j % 7; // la semaine commence le lundi a l'affichage
    const plages = plagesDuJour(reglages, jour);
    lignes.push({
      jour,
      nom: nomJour(jour, langue),
      plages,
      ouverture: plages.length ? plages[0].ouverture : null,
      fermeture: plages.length ? plages[plages.length - 1].fermeture : null,
      ferme: plages.length === 0,
    });
  }
  return lignes;
}
