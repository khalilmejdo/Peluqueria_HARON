/**
 * Appels a l'API depuis l'espace de gestion.
 *
 * Toute requete mutante porte le jeton CSRF recu a la connexion. Une reponse
 * 401 ramene a l'ecran de connexion sans jamais perdre le travail en cours :
 * il n'y a rien a perdre, la file est en base.
 */
import { t } from '../langue.js';

let csrf = null;
const auditeurs = new Set();

export function poserCsrf(jeton) {
  csrf = jeton || null;
}

/** Prevenu quand la session tombe (deconnexion, expiration, compte desactive). */
export function surSessionPerdue(fn) {
  auditeurs.add(fn);
  return () => auditeurs.delete(fn);
}

export class ErreurApi extends Error {
  constructor(message, { statut = 0, code = null, champs = null } = {}) {
    super(message);
    this.name = 'ErreurApi';
    this.statut = statut;
    this.code = code;
    this.champs = champs;
  }
}

async function requete(methode, chemin, corps, { brut = null } = {}) {
  const entetes = {};
  // Une image part BRUTE : le corps est le fichier, son type est celui de l'image.
  if (brut) entetes['Content-Type'] = brut.type || 'application/octet-stream';
  else if (corps !== undefined) entetes['Content-Type'] = 'application/json';
  if (csrf && methode !== 'GET') entetes['X-CSRF-Token'] = csrf;

  let reponse;
  try {
    reponse = await fetch(chemin, {
      method: methode,
      headers: entetes,
      body: brut || (corps === undefined ? undefined : JSON.stringify(corps)),
      credentials: 'same-origin',
    });
  } catch {
    throw new ErreurApi(t('commun.salonInjoignable'), { statut: 0 });
  }

  if (reponse.status === 204) return null;

  let donnees = null;
  try {
    donnees = await reponse.json();
  } catch {
    donnees = null;
  }

  if (reponse.status === 401) {
    csrf = null;
    for (const fn of auditeurs) fn();
  }

  if (!reponse.ok) {
    throw new ErreurApi(
      donnees?.error?.message || t('commun.erreurAvecCode', { statut: reponse.status }),
      { statut: reponse.status, code: donnees?.error?.code ?? null, champs: donnees?.error?.details?.fields ?? null },
    );
  }
  if (donnees && donnees.csrfToken) csrf = donnees.csrfToken;
  return donnees;
}

export const api = {
  get: (chemin) => requete('GET', chemin),
  post: (chemin, corps = {}) => requete('POST', chemin, corps),
  put: (chemin, corps = {}) => requete('PUT', chemin, corps),
  patch: (chemin, corps = {}) => requete('PATCH', chemin, corps),
  supprimer: (chemin) => requete('DELETE', chemin),
  /** Envoie un fichier tel quel (une photo), sans l'emballer dans du JSON. */
  envoyerFichier: (chemin, fichier) => requete('POST', chemin, undefined, { brut: fichier }),
};
