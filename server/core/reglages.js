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
    libelle: 'Nombre del salón',
    aide: 'Aparece en la cabecera de todas las páginas y en los mensajes de WhatsApp.',
  },
  'salon.accroche': {
    type: 'texte', defaut: 'Pide tu turno sin esperar de pie.', maxLongueur: 120,
    libelle: 'Frase de la página de inicio',
  },
  'salon.adresse': {
    type: 'texte', defaut: '', maxLongueur: 160,
    libelle: 'Dirección del salón',
    aide: 'Aparece en la sección Contacto de la página de inicio, con enlace al mapa, y en la página de seguimiento.',
  },
  'salon.telephone': {
    type: 'telephone', defaut: '', maxLongueur: 25,
    libelle: 'Teléfono del salón',
    aide: 'Aparece en la sección Contacto de la página de inicio y se ofrece al cliente cuando no se pueden pedir turnos por internet.',
  },
  'salon.whatsapp': {
    type: 'telephone', defaut: '', maxLongueur: 25,
    libelle: 'WhatsApp del salón',
    aide: 'Número desde el que salen los mensajes. Aparece en la sección Contacto, con enlace directo a la conversación.',
  },

  'file.dureeMoyenneMinutes': {
    type: 'entier', defaut: 20, min: 1, max: 240,
    libelle: 'Duración media de un corte (minutos)',
    aide: 'Sirve para estimar la espera. Se puede cambiar en cualquier momento; el día en curso conserva el valor de la mañana.',
  },
  'file.seuilPrevenir': {
    type: 'entier', defaut: 2, min: 0, max: 20,
    libelle: 'Avisar al cliente cuando le queden N personas delante',
    aide: 'Por debajo de este umbral, el cliente ve « tu turno se acerca » y recibe un mensaje de WhatsApp.',
  },
  'file.mode': {
    type: 'choix',
    defaut: 'UNIQUE',
    options: [
      { valeur: 'UNIQUE', libelle: 'Una sola fila para todo el salón' },
      { valeur: 'PAR_FAUTEUIL', libelle: 'Una fila por peluquero' },
    ],
    libelle: 'Organización de la fila',
    aide: 'Una sola fila: el cliente pide turno y le atiende el primer peluquero libre. '
      + 'Una fila por peluquero: el cliente elige el suyo y espera en SU fila. '
      + 'Solo se puede cambiar con la fila vacía.',
  },
  'file.priseDeTourOuverte': {
    type: 'booleen', defaut: true,
    libelle: 'Aceptar nuevos turnos',
    aide: 'Desmarque para dejar de dar turnos sin tocar la fila en curso: quien espera será atendido, pero nadie nuevo entra.',
  },
  'file.messagePause': {
    type: 'texte', defaut: '', maxLongueur: 160,
    libelle: 'Mensaje cuando no se dan turnos',
    aide: 'Por ejemplo: « Esta tarde ya no damos más turnos, mañana a las 9:30. » Si lo deja vacío se usa un mensaje predeterminado.',
  },
  'file.maxParJour': {
    type: 'entier', defaut: 200, min: 1, max: 2000,
    libelle: 'Número máximo de turnos por día',
    aide: 'Tope de seguridad: por encima, no se aceptan más turnos por internet y se explica al cliente.',
  },

  'horaires.actifs': {
    type: 'booleen', defaut: false,
    libelle: 'No dar turnos fuera del horario',
    aide: 'Desactivado, el cliente puede pedir turno a cualquier hora.',
  },

  // La fiche de prix elle-meme vit dans sa propre table, avec son propre ecran.
  // Ces deux reglages ne disent que comment la SECTION se presente en vitrine.
  'tarifas.visible': {
    type: 'booleen', defaut: true,
    libelle: 'Mostrar las tarifas en la página de inicio',
    aide: 'Desactívelo si prefiere no publicar los precios.',
  },
  'tarifas.nota': {
    type: 'texte', defaut: '', maxLongueur: 160,
    libelle: 'Nota debajo de las tarifas',
    aide: 'Por ejemplo: « Efectivo y tarjeta. » Se deja vacío si no hace falta.',
  },
  'salon.coordenadas': {
    type: 'coordenadas', defaut: '', maxLongueur: 44,
    libelle: 'Coordenadas del salón (latitud, longitud)',
    aide: 'En Google Maps: pulsación larga sobre la puerta del salón y se copian « 40.416775, -3.703790 ». Con ellas, el botón « Cómo llegar » lleva a la puerta y no a mitad de la calle.',
  },
  'salon.comoLlegar': {
    type: 'texte', defaut: '', maxLongueur: 400,
    libelle: 'Cómo llegar',
    aide: 'Referencias, transporte y aparcamiento. Por ejemplo: « Frente a la farmacia, metro Sol a 3 minutos, aparcamiento en la plaza. »',
  },
  'pantalla.nombres': {
    type: 'booleen', defaut: true,
    libelle: 'Mostrar los nombres en la pantalla del salón',
    aide: 'Desactívelo y la pantalla solo mostrará los números de turno, como en una panadería. Útil si la pantalla se ve desde la calle.',
  },
  'public.url': {
    type: 'url', defaut: '', maxLongueur: 300,
    libelle: 'Dirección pública del salón',
    aide: 'Es la que codifica el código QR del escaparate. Déjelo vacío para usar PUBLIC_URL.',
  },
};

// Les horaires : une paire ouverture/fermeture par jour de la semaine.
// Vides tous les deux = ferme ce jour-la.
for (let j = 0; j < 7; j += 1) {
  CATALOGUE['horaires.' + j + '.ouverture'] = {
    type: 'heure', defaut: j === 0 ? '' : '09:30', maxLongueur: 5,
    libelle: 'Apertura ' + NOMS_JOURS[j], groupe: 'horaires',
  };
  CATALOGUE['horaires.' + j + '.fermeture'] = {
    type: 'heure', defaut: j === 0 ? '' : '20:00', maxLongueur: 5,
    libelle: 'Cierre ' + NOMS_JOURS[j], groupe: 'horaires',
  };
  // La coupure du milieu de journee. Vide, la journee est d'un seul tenant.
  //
  // L'explication n'est posee QUE sur le lundi : repetee sept fois, elle
  // deviendrait du bruit qu'on ne lit plus, et c'est le premier jour du
  // formulaire.
  CATALOGUE['horaires.' + j + '.pauseDebut'] = {
    type: 'heure', defaut: '', maxLongueur: 5,
    libelle: 'Empieza el descanso ' + NOMS_JOURS[j], groupe: 'horaires',
    aide: j === 1
      ? 'Si el salón cierra a mediodía, pon aquí las dos horas. Durante el descanso no se pueden pedir turnos, y el horario se muestra en dos tramos: 10:00 – 14:00 · 17:00 – 20:30. Déjalo vacío si la jornada es seguida.'
      : undefined,
  };
  CATALOGUE['horaires.' + j + '.pauseFin'] = {
    type: 'heure', defaut: '', maxLongueur: 5,
    libelle: 'Vuelve a abrir ' + NOMS_JOURS[j], groupe: 'horaires',
  };
}

export const CLES = Object.keys(CATALOGUE);

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
    case 'coordenadas':
      return normaliserCoordonnees(brut) || '';
    default:
      return String(brut);
  }
}

/** Valide une valeur soumise par le gerant et rend sa forme de stockage (texte). */
export function versTexte(cle, valeur) {
  const regle = CATALOGUE[cle];
  if (!regle) throw new ValidationError({ [cle]: 'Ajuste desconocido.' });
  const vide = valeur === null || valeur === undefined || String(valeur).trim() === '';

  switch (regle.type) {
    case 'entier': {
      if (vide) throw new ValidationError({ [cle]: 'Se espera un valor.' });
      const texte = String(valeur).trim();
      const n = /^-?\d+$/.test(texte) ? Number(texte) : Number.NaN;
      if (!Number.isSafeInteger(n)) throw new ValidationError({ [cle]: 'Se espera un número entero.' });
      if (regle.min !== undefined && n < regle.min) throw new ValidationError({ [cle]: 'Como mínimo ' + regle.min + '.' });
      if (regle.max !== undefined && n > regle.max) throw new ValidationError({ [cle]: 'Como máximo ' + regle.max + '.' });
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
      if (texte.length > (regle.maxLongueur ?? 300)) throw new ValidationError({ [cle]: 'Dirección demasiado larga.' });
      return texte;
    }
    case 'coordenadas': {
      if (vide) return '';
      const normalisees = normaliserCoordonnees(valeur);
      if (!normalisees) {
        throw new ValidationError({
          [cle]: 'Se esperan dos números con punto decimal, separados por una coma. Ejemplo: 40.416775, -3.703790',
        });
      }
      return normalisees;
    }
    case 'telephone': {
      if (vide) return '';
      const texte = String(valeur).replace(/\s+/g, ' ').trim();
      if (!/^\+?[0-9][0-9\s.\-()/]*$/.test(texte)) throw new ValidationError({ [cle]: 'Número no válido.' });
      if (texte.length > (regle.maxLongueur ?? 25)) throw new ValidationError({ [cle]: 'Número demasiado largo.' });
      return texte;
    }
    default: {
      const texte = String(valeur).replace(/\s+/g, ' ').trim();
      if (texte.length > (regle.maxLongueur ?? 200)) {
        throw new ValidationError({ [cle]: 'Este texto no puede pasar de ' + (regle.maxLongueur ?? 200) + ' caracteres.' });
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
      erreurs[cle] = 'Ajuste desconocido.';
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
      const nom = NOMS_JOURS[Number(jour)];
      const valeur = (champ) => saisi[champ] ?? actuels['horaires.' + jour + '.' + champ];
      const ouverture = valeur('ouverture');
      const fermeture = valeur('fermeture');
      const pauseDebut = valeur('pauseDebut');
      const pauseFin = valeur('pauseFin');

      if (ouverture && fermeture && heureEnMinutes(fermeture) <= heureEnMinutes(ouverture)) {
        throw new ValidationError({
          ['horaires.' + jour + '.fermeture']: 'El cierre debe ser posterior a la apertura (' + nom + ').',
        });
      }

      // Une coupure a moitie saisie fermerait le salon a l'heure du dejeuner ou
      // pas du tout, selon le champ oublie. On refuse les deux cas.
      if (Boolean(pauseDebut) !== Boolean(pauseFin)) {
        throw new ValidationError({
          ['horaires.' + jour + (pauseDebut ? '.pauseFin' : '.pauseDebut')]:
            'El descanso necesita las dos horas: cuándo empieza y cuándo se vuelve a abrir (' + nom + ').',
        });
      }

      if (pauseDebut && pauseFin) {
        if (heureEnMinutes(pauseFin) <= heureEnMinutes(pauseDebut)) {
          throw new ValidationError({
            ['horaires.' + jour + '.pauseFin']: 'La reapertura debe ser posterior al inicio del descanso (' + nom + ').',
          });
        }
        // Une coupure qui deborde de la journee n'a pas de sens, et la
        // silencieuse ignorer laisserait le gerant croire qu'elle s'applique.
        if (ouverture && fermeture
          && (heureEnMinutes(pauseDebut) <= heureEnMinutes(ouverture)
            || heureEnMinutes(pauseFin) >= heureEnMinutes(fermeture))) {
          throw new ValidationError({
            ['horaires.' + jour + '.pauseDebut']:
              'El descanso tiene que caer dentro del horario del día, entre ' + ouverture + ' y ' + fermeture + ' (' + nom + ').',
          });
        }
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
export function horairesLisibles(reglages) {
  const lignes = [];
  for (let j = 1; j <= 7; j += 1) {
    const jour = j % 7; // la semaine commence le lundi a l'affichage
    const plages = plagesDuJour(reglages, jour);
    lignes.push({
      jour,
      nom: NOMS_JOURS[jour],
      plages,
      ouverture: plages.length ? plages[0].ouverture : null,
      fermeture: plages.length ? plages[plages.length - 1].fermeture : null,
      ferme: plages.length === 0,
    });
  }
  return lignes;
}
