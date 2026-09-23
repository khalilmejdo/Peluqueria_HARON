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
import { all, execute } from '../db/index.js';
import { heureValide, heureEnMinutes, NOMS_JOURS } from './temps.js';
import { config } from './config.js';
import { ValidationError } from './errors.js';

/**
 * @typedef {{ type: 'texte'|'entier'|'booleen'|'heure'|'url'|'telephone',
 *             defaut: any, libelle: string, aide?: string,
 *             min?: number, max?: number, maxLongueur?: number }} Reglage
 */

/** @type {Record<string, Reglage>} */
export const CATALOGUE = {
  'salon.nom': {
    type: 'texte', defaut: 'Peluquería HARON', maxLongueur: 60,
    libelle: 'Nom du salon',
    aide: 'Affiché en haut de toutes les pages et dans les messages WhatsApp.',
  },
  'salon.accroche': {
    type: 'texte', defaut: 'Prenez votre tour, sans attendre.', maxLongueur: 120,
    libelle: 'Accroche de la page d’accueil',
  },
  'salon.adresse': {
    type: 'texte', defaut: '', maxLongueur: 160,
    libelle: 'Adresse du salon',
    aide: 'Affichée sur la page de suivi, pour que le client sache où revenir.',
  },
  'salon.telephone': {
    type: 'telephone', defaut: '', maxLongueur: 25,
    libelle: 'Téléphone du salon',
    aide: 'Proposé au client quand la prise de tour en ligne est momentanément refusée.',
  },
  'salon.whatsapp': {
    type: 'telephone', defaut: '', maxLongueur: 25,
    libelle: 'WhatsApp du salon',
    aide: 'Numéro depuis lequel partent les messages, affiché au client.',
  },

  'file.dureeMoyenneMinutes': {
    type: 'entier', defaut: 20, min: 1, max: 240,
    libelle: 'Durée moyenne d’une coupe (minutes)',
    aide: 'Sert à estimer l’attente. Modifiable à tout moment ; la journée en cours garde la valeur du matin.',
  },
  'file.seuilPrevenir': {
    type: 'entier', defaut: 2, min: 0, max: 20,
    libelle: 'Prévenir le client quand il reste N personnes devant lui',
    aide: 'Au-dessous de ce seuil, le client voit « votre tour approche » et reçoit un message WhatsApp.',
  },
  'file.mode': {
    type: 'choix',
    defaut: 'UNIQUE',
    options: [
      { valeur: 'UNIQUE', libelle: 'Une seule file pour tout le salon' },
      { valeur: 'PAR_FAUTEUIL', libelle: 'Une file par coiffeur' },
    ],
    libelle: 'Organisation de la file',
    aide: 'Une seule file : le client prend un tour, le premier coiffeur libre le sert. '
      + 'Une file par coiffeur : le client choisit son coiffeur et attend dans SA file. '
      + 'Ne se change qu’avec une file vide.',
  },
  'file.priseDeTourOuverte': {
    type: 'booleen', defaut: true,
    libelle: 'Accepter de nouveaux tours',
    aide: 'Décochez pour arrêter les prises de tour sans toucher à la file en cours : ceux qui attendent restent servis, personne de nouveau n’entre.',
  },
  'file.messagePause': {
    type: 'texte', defaut: '', maxLongueur: 160,
    libelle: 'Message affiché quand les tours sont arrêtés',
    aide: 'Par exemple : « Nous ne prenons plus de tour ce soir, à demain 9 h 30. » Laissé vide, un message par défaut est utilisé.',
  },
  'file.maxParJour': {
    type: 'entier', defaut: 200, min: 1, max: 2000,
    libelle: 'Nombre maximum de tickets par journée',
    aide: 'Garde-fou : au-delà, la prise de tour en ligne est refusée avec un message clair.',
  },

  'horaires.actifs': {
    type: 'booleen', defaut: false,
    libelle: 'Refuser la prise de tour en dehors des horaires',
    aide: 'Désactivé, le client peut prendre son tour à toute heure.',
  },
  'public.url': {
    type: 'url', defaut: '', maxLongueur: 300,
    libelle: 'Adresse publique du salon',
    aide: 'Celle qu’encode le QR Code collé en vitrine. Laissez vide pour utiliser PUBLIC_URL.',
  },
};

// Les horaires : une paire ouverture/fermeture par jour de la semaine.
// Vides tous les deux = ferme ce jour-la.
for (let j = 0; j < 7; j += 1) {
  CATALOGUE['horaires.' + j + '.ouverture'] = {
    type: 'heure', defaut: j === 0 ? '' : '09:30', maxLongueur: 5,
    libelle: 'Ouverture ' + NOMS_JOURS[j], groupe: 'horaires',
  };
  CATALOGUE['horaires.' + j + '.fermeture'] = {
    type: 'heure', defaut: j === 0 ? '' : '20:00', maxLongueur: 5,
    libelle: 'Fermeture ' + NOMS_JOURS[j], groupe: 'horaires',
  };
}

export const CLES = Object.keys(CATALOGUE);

/* ------------------------------------------------------------------ */
/*  Conversion                                                         */
/* ------------------------------------------------------------------ */

/** Convertit la chaine stockee en base vers le type declare. Jamais d'exception. */
function depuisTexte(cle, brut) {
  const regle = CATALOGUE[cle];
  if (!regle) return null;
  if (brut === null || brut === undefined || brut === '') {
    return regle.type === 'booleen' ? regle.defaut : (regle.type === 'entier' ? regle.defaut : (brut === '' ? '' : regle.defaut));
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
      return regle.options.some((o) => o.valeur === brut) ? brut : regle.defaut;
    default:
      return String(brut);
  }
}

/** Valide une valeur soumise par le gerant et rend sa forme de stockage (texte). */
export function versTexte(cle, valeur) {
  const regle = CATALOGUE[cle];
  if (!regle) throw new ValidationError({ [cle]: 'Réglage inconnu.' });
  const vide = valeur === null || valeur === undefined || String(valeur).trim() === '';

  switch (regle.type) {
    case 'entier': {
      if (vide) throw new ValidationError({ [cle]: 'Une valeur est attendue.' });
      const texte = String(valeur).trim();
      const n = /^-?\d+$/.test(texte) ? Number(texte) : Number.NaN;
      if (!Number.isSafeInteger(n)) throw new ValidationError({ [cle]: 'Un nombre entier est attendu.' });
      if (regle.min !== undefined && n < regle.min) throw new ValidationError({ [cle]: 'Au minimum ' + regle.min + '.' });
      if (regle.max !== undefined && n > regle.max) throw new ValidationError({ [cle]: 'Au maximum ' + regle.max + '.' });
      return String(n);
    }
    case 'booleen':
      if (typeof valeur === 'boolean') return valeur ? 'true' : 'false';
      if (/^(1|true|oui|on)$/i.test(String(valeur).trim())) return 'true';
      if (/^(0|false|non|off)$/i.test(String(valeur).trim())) return 'false';
      throw new ValidationError({ [cle]: 'Valeur oui/non attendue.' });
    case 'heure': {
      if (vide) return '';
      const texte = String(valeur).trim().slice(0, 5);
      if (!heureValide(texte)) throw new ValidationError({ [cle]: 'Heure attendue au format HH:MM.' });
      return texte;
    }
    case 'choix': {
      const texte = String(valeur).trim().toUpperCase();
      if (!regle.options.some((o) => o.valeur === texte)) {
        throw new ValidationError({ [cle]: 'Valeur attendue parmi : ' + regle.options.map((o) => o.valeur).join(', ') + '.' });
      }
      return texte;
    }
    case 'url': {
      if (vide) return '';
      const texte = String(valeur).trim().replace(/\/+$/, '');
      try {
        const u = new URL(texte);
        if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('protocole');
      } catch {
        throw new ValidationError({ [cle]: 'Adresse invalide. Exemple : https://file.peluqueria-haron.com' });
      }
      if (texte.length > (regle.maxLongueur ?? 300)) throw new ValidationError({ [cle]: 'Adresse trop longue.' });
      return texte;
    }
    case 'telephone': {
      if (vide) return '';
      const texte = String(valeur).replace(/\s+/g, ' ').trim();
      if (!/^\+?[0-9][0-9\s.\-()/]*$/.test(texte)) throw new ValidationError({ [cle]: 'Numéro invalide.' });
      if (texte.length > (regle.maxLongueur ?? 25)) throw new ValidationError({ [cle]: 'Numéro trop long.' });
      return texte;
    }
    default: {
      const texte = String(valeur).replace(/\s+/g, ' ').trim();
      if (texte.length > (regle.maxLongueur ?? 200)) {
        throw new ValidationError({ [cle]: 'Ce texte ne peut pas dépasser ' + (regle.maxLongueur ?? 200) + ' caractères.' });
      }
      return texte;
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Lecture (avec cache court)                                         */
/* ------------------------------------------------------------------ */

const DUREE_CACHE_MS = 5000;
let cache = null;
let cacheAt = 0;

export function invaliderCache() {
  cache = null;
  cacheAt = 0;
}

/** Tous les reglages, catalogue complet, valeurs par defaut comprises. */
export async function lireTous({ frais = false } = {}) {
  if (!frais && cache && Date.now() - cacheAt < DUREE_CACHE_MS) return cache;
  const rows = await all('SELECT cle, valeur FROM reglages WHERE cle = ANY($1)', [CLES]);
  const stockes = new Map(rows.map((r) => [r.cle, r.valeur]));
  const sortie = {};
  for (const cle of CLES) {
    sortie[cle] = stockes.has(cle) ? depuisTexte(cle, stockes.get(cle)) : CATALOGUE[cle].defaut;
  }
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
      erreurs[cle] = 'Réglage inconnu.';
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
    const m = /^horaires\.(\d)\.(ouverture|fermeture)$/.exec(cle);
    if (m) {
      if (!parJour.has(m[1])) parJour.set(m[1], {});
      parJour.get(m[1])[m[2]] = texte;
    }
  }
  if (parJour.size) {
    const actuels = await lireTous({ frais: true });
    for (const [jour, paire] of parJour) {
      const ouverture = paire.ouverture ?? actuels['horaires.' + jour + '.ouverture'];
      const fermeture = paire.fermeture ?? actuels['horaires.' + jour + '.fermeture'];
      if (ouverture && fermeture && heureEnMinutes(fermeture) <= heureEnMinutes(ouverture)) {
        throw new ValidationError({
          ['horaires.' + jour + '.fermeture']: 'La fermeture doit être postérieure à l’ouverture (' + NOMS_JOURS[Number(jour)] + ').',
        });
      }
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

/**
 * L'adresse publique effective : le reglage s'il est pose, sinon PUBLIC_URL,
 * sinon l'adresse vue dans la requete (passee par l'appelant).
 */
export function adressePublique(reglages, secours = '') {
  return (reglages['public.url'] || config.http.publicUrl || secours || '').replace(/\/+$/, '');
}

/** Le salon est-il ouvert a cet instant ? Rend toujours ouvert si le controle est desactive. */
export function estOuvert(reglages, jourSemaine, minutes) {
  if (!reglages['horaires.actifs']) return { ouvert: true, ouverture: null, fermeture: null };
  const ouverture = reglages['horaires.' + jourSemaine + '.ouverture'];
  const fermeture = reglages['horaires.' + jourSemaine + '.fermeture'];
  if (!ouverture || !fermeture) return { ouvert: false, ouverture: null, fermeture: null };
  const debut = heureEnMinutes(ouverture);
  const fin = heureEnMinutes(fermeture);
  return { ouvert: minutes >= debut && minutes < fin, ouverture, fermeture };
}

/** Les horaires, mis en forme pour l'affichage. */
export function horairesLisibles(reglages) {
  const lignes = [];
  for (let j = 1; j <= 7; j += 1) {
    const jour = j % 7; // la semaine commence le lundi a l'affichage
    const o = reglages['horaires.' + jour + '.ouverture'];
    const f = reglages['horaires.' + jour + '.fermeture'];
    lignes.push({ jour, nom: NOMS_JOURS[jour], ouverture: o || null, fermeture: f || null, ferme: !o || !f });
  }
  return lignes;
}
