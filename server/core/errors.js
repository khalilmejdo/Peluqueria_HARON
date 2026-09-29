/**
 * Erreurs applicatives typees.
 *
 * Le message d'une AppError est destine a l'utilisateur et peut etre affiche
 * tel quel. Toute autre exception devient une erreur 500 generique cote
 * client : le detail ne va que dans les journaux du serveur.
 *
 * LES MESSAGES PAR DEFAUT SONT DES APPELS, PAS DES CONSTANTES. Un parametre par
 * defaut est evalue a chaque appel : « badRequest() » parle donc toujours la
 * langue du salon, y compris si elle a change depuis le demarrage. Une constante
 * de module aurait fige la langue du premier chargement.
 */
import { t } from './langue.js';

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

export const badRequest = (msg = null, details) => new AppError(400, msg ?? t('err.requeteInvalide'), { details });
export const unauthorized = (msg = null) => new AppError(401, msg ?? t('err.identification'));
export const forbidden = (msg = null) => new AppError(403, msg ?? t('err.interdit'));
export const notFound = (msg = null) => new AppError(404, msg ?? t('err.introuvable'));
export const conflict = (msg = null, details) => new AppError(409, msg ?? t('err.conflit'), { details });
export const tooLarge = (msg = null) => new AppError(413, msg ?? t('err.tropGros'));
export const unsupportedMedia = (msg = null) => new AppError(415, msg ?? t('err.typeNonPermis'));

/**
 * Une valeur que PostgreSQL n'a pas su convertir dans le type de la colonne
 * (identifiant mal forme, date impossible) : c'est la requete qui est mal
 * formee, pas le serveur qui est en panne. Rend null hors de cette famille.
 */
const CODES_DE_TYPE = {
  '22P02': 'err.pgType.valeur',
  '22007': 'err.pgType.date',
  '22008': 'err.pgType.dateImpossible',
  '22003': 'err.pgType.capacite',
};

export function erreurDeTypePostgres(err) {
  // HR001 : verrou metier pose par un declencheur (ticket d'une journee close).
  if (err?.code === 'HR001') return new AppError(409, String(err.message || t('err.operationRefusee')), { code: 'VERROU_METIER' });
  if (err?.code === '23505') {
    const contrainte = String(err.constraint || '');
    // Le rang et le numero uniques par journee sont la garantie « jamais deux
    // clients a la meme position ». Un doublon signifie que deux gestes se sont
    // croises a la milliseconde : rien n'a ete ecrit, le geste se refait.
    if (contrainte.includes('tickets_journee_rang') || contrainte.includes('tickets_journee_numero')) {
      return new AppError(409, t('err.fileConcurrente'), { code: 'FILE_CONCURRENTE' });
    }
    // Un seul client au fauteuil : deux appels simultanes, un seul passe.
    if (contrainte.includes('tickets_un_seul_en_cours')) {
      return new AppError(409, t('err.fauteuilConcurrent'), { code: 'FAUTEUIL_OCCUPE' });
    }
    return new AppError(409, t('err.doublon'), { code: 'DOUBLON' });
  }
  const cle = CODES_DE_TYPE[err?.code];
  if (!cle) return null;
  return new AppError(400, t(cle), { code: 'PARAMETRE_MAL_FORME', details: { pgCode: err.code } });
}

/**
 * La base ne repond pas, ou refuse d'ecrire : un 503 qui dit la cause, avec un
 * delai avant de reessayer. Rend null hors de cette famille.
 */
const CODES_INDISPONIBLES = {
  '42501': 'err.base.ecriture',
  '42P01': 'err.base.tableManquante',
  '08000': 'err.base.connexionPerdue',
  '08001': 'err.base.neRepondPas',
  '08003': 'err.base.connexionPerdue',
  '08006': 'err.base.connexionPerdue',
  '57P01': 'err.base.extinction',
  '57P03': 'err.base.demarrage',
  '53300': 'err.base.plusDeConnexions',
  '53200': 'err.base.memoire',
  '53100': 'err.base.disquePlein',
  '58030': 'err.base.disqueNeRepondPas',
  '25006': 'err.base.lectureSeule',
  '55P03': 'err.base.verrouTropLong',
  '57014': 'err.base.tempsDepasse',
};

export function erreurBaseIndisponible(err) {
  if (!err) return null;
  let cle = CODES_INDISPONIBLES[err.code] ?? null;
  const texte = String(err.message || '');
  if (!cle && /timeout exceeded when trying to connect/i.test(texte)) cle = 'err.base.connexionsOccupees';
  if (!cle && /Connection terminated|ECONNREFUSED|ECONNRESET/i.test(texte)) cle = 'err.base.connexionPerdue';
  if (!cle) return null;
  return new AppError(503, t('err.baseIndisponible', { cause: t(cle) }),
    { code: 'BASE_INDISPONIBLE', details: { retryAfter: 5 } });
}

/** Erreur de validation portant le detail champ par champ. */
export class ValidationError extends AppError {
  /** @param {Record<string,string>} fields */
  constructor(fields, msg = null) {
    super(422, msg ?? t('err.champsInvalides'), { code: 'VALIDATION', details: { fields } });
    this.name = 'ValidationError';
    this.fields = fields;
  }
}
