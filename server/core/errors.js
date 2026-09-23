/**
 * Erreurs applicatives typees.
 *
 * Le message d'une AppError est destine a l'utilisateur et peut etre affiche
 * tel quel. Toute autre exception devient une erreur 500 generique cote
 * client : le detail ne va que dans les journaux du serveur.
 */

export class AppError extends Error {
  /**
   * @param {number} status  code HTTP
   * @param {string} message message affichable
   * @param {{code?: string, details?: object}} [opts]
   */
  constructor(status, message, opts = {}) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = opts.code || httpCodeName(status);
    this.details = opts.details || null;
  }
}

function httpCodeName(status) {
  return ({
    400: 'REQUETE_INVALIDE',
    401: 'NON_AUTHENTIFIE',
    403: 'ACCES_REFUSE',
    404: 'INTROUVABLE',
    405: 'METHODE_NON_AUTORISEE',
    409: 'CONFLIT',
    413: 'CONTENU_TROP_VOLUMINEUX',
    415: 'TYPE_NON_SUPPORTE',
    422: 'VALIDATION',
    429: 'TROP_DE_REQUETES',
    503: 'SERVICE_INDISPONIBLE',
  })[status] || 'ERREUR';
}

export const badRequest = (msg = 'Requête invalide.', details) => new AppError(400, msg, { details });
export const unauthorized = (msg = 'Authentification requise.') => new AppError(401, msg);
export const forbidden = (msg = 'Vous n’avez pas les droits nécessaires pour cette action.') => new AppError(403, msg);
export const notFound = (msg = 'Élément introuvable.') => new AppError(404, msg);
export const conflict = (msg = 'Conflit avec l’état actuel de la donnée.', details) => new AppError(409, msg, { details });
export const tooLarge = (msg = 'Contenu trop volumineux.') => new AppError(413, msg);
export const unsupportedMedia = (msg = 'Type de contenu non autorisé.') => new AppError(415, msg);

/**
 * Une valeur que PostgreSQL n'a pas su convertir dans le type de la colonne
 * (identifiant mal forme, date impossible) : c'est la requete qui est mal
 * formee, pas le serveur qui est en panne. Rend null hors de cette famille.
 */
const CODES_DE_TYPE = {
  '22P02': 'Un paramètre de la requête est mal formé : une valeur n’a pas la forme attendue.',
  '22007': 'Un paramètre de la requête est mal formé : une date est attendue au format AAAA-MM-JJ.',
  '22008': 'Un paramètre de la requête est mal formé : cette date ou cette heure n’existe pas.',
  '22003': 'Une valeur dépasse la capacité du champ qui la reçoit.',
};

export function erreurDeTypePostgres(err) {
  // HR001 : verrou metier pose par un declencheur (ticket d'une journee close).
  if (err?.code === 'HR001') return new AppError(409, String(err.message || 'Opération refusée.'), { code: 'VERROU_METIER' });
  if (err?.code === '23505') {
    const contrainte = String(err.constraint || '');
    // Le rang et le numero uniques par journee sont la garantie « jamais deux
    // clients a la meme position ». Un doublon signifie que deux gestes se sont
    // croises a la milliseconde : rien n'a ete ecrit, le geste se refait.
    if (contrainte.includes('tickets_journee_rang') || contrainte.includes('tickets_journee_numero')) {
      return new AppError(409, 'Deux modifications de la file se sont croisées. Rien n’a été perdu : renouvelez le geste.', { code: 'FILE_CONCURRENTE' });
    }
    // Un seul client au fauteuil : deux appels simultanes, un seul passe.
    if (contrainte.includes('tickets_un_seul_en_cours')) {
      return new AppError(409, 'Un client vient d’être appelé au même instant. Rechargez la file avant d’appeler le suivant.', { code: 'FAUTEUIL_OCCUPE' });
    }
    return new AppError(409, 'Cet élément existe déjà (valeur en double). Rechargez la page et vérifiez avant de recommencer.', { code: 'DOUBLON' });
  }
  const message = CODES_DE_TYPE[err?.code];
  if (!message) return null;
  return new AppError(400, message, { code: 'PARAMETRE_MAL_FORME', details: { pgCode: err.code } });
}

/**
 * La base ne repond pas, ou refuse d'ecrire : un 503 qui dit la cause, avec un
 * delai avant de reessayer. Rend null hors de cette famille.
 */
const CODES_INDISPONIBLES = {
  '42501': 'la base refuse l’écriture : droits insuffisants',
  '42P01': 'une table attendue n’existe pas : la base n’est pas migrée',
  '08000': 'la connexion à la base a été perdue',
  '08001': 'la base est injoignable',
  '08003': 'la connexion à la base a été perdue',
  '08006': 'la connexion à la base a été perdue',
  '57P01': 'la base s’arrête',
  '57P03': 'la base démarre',
  '53300': 'la base n’accepte plus de connexion',
  '53200': 'la base manque de mémoire',
  '53100': 'le disque de la base est plein',
  '58030': 'le disque de la base ne répond plus',
  '25006': 'la base est en lecture seule : aucune écriture n’est possible',
  '55P03': 'une autre opération tenait le verrou trop longtemps',
  '57014': 'l’opération a dépassé le temps accordé et a été interrompue',
};

export function erreurBaseIndisponible(err) {
  if (!err) return null;
  let cause = CODES_INDISPONIBLES[err.code] ?? null;
  const texte = String(err.message || '');
  if (!cause && /timeout exceeded when trying to connect/i.test(texte)) cause = 'toutes les connexions à la base sont occupées';
  if (!cause && /Connection terminated|ECONNREFUSED|ECONNRESET/i.test(texte)) cause = 'la connexion à la base a été perdue';
  if (!cause) return null;
  return new AppError(503,
    'Le service ne peut pas utiliser la base pour le moment : ' + cause + '. Rien n’a été enregistré. Réessayez dans un instant.',
    { code: 'BASE_INDISPONIBLE', details: { retryAfter: 5 } });
}

/** Erreur de validation portant le detail champ par champ. */
export class ValidationError extends AppError {
  /** @param {Record<string,string>} fields */
  constructor(fields, msg = 'Certains champs sont invalides.') {
    super(422, msg, { code: 'VALIDATION', details: { fields } });
    this.name = 'ValidationError';
    this.fields = fields;
  }
}
