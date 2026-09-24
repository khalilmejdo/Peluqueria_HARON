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

export const badRequest = (msg = 'Petición no válida.', details) => new AppError(400, msg, { details });
export const unauthorized = (msg = 'Hace falta identificarse.') => new AppError(401, msg);
export const forbidden = (msg = 'No tienes permiso para esta acción.') => new AppError(403, msg);
export const notFound = (msg = 'No encontrado.') => new AppError(404, msg);
export const conflict = (msg = 'Conflicto con el estado actual del dato.', details) => new AppError(409, msg, { details });
export const tooLarge = (msg = 'Contenido demasiado grande.') => new AppError(413, msg);
export const unsupportedMedia = (msg = 'Tipo de contenido no permitido.') => new AppError(415, msg);

/**
 * Une valeur que PostgreSQL n'a pas su convertir dans le type de la colonne
 * (identifiant mal forme, date impossible) : c'est la requete qui est mal
 * formee, pas le serveur qui est en panne. Rend null hors de cette famille.
 */
const CODES_DE_TYPE = {
  '22P02': 'Un parámetro de la petición está mal formado: un valor no tiene la forma esperada.',
  '22007': 'Un parámetro de la petición está mal formado: se espera una fecha con formato AAAA-MM-DD.',
  '22008': 'Un parámetro de la petición está mal formado: esa fecha u hora no existe.',
  '22003': 'Un valor supera la capacidad del campo que lo recibe.',
};

export function erreurDeTypePostgres(err) {
  // HR001 : verrou metier pose par un declencheur (ticket d'une journee close).
  if (err?.code === 'HR001') return new AppError(409, String(err.message || 'Operación rechazada.'), { code: 'VERROU_METIER' });
  if (err?.code === '23505') {
    const contrainte = String(err.constraint || '');
    // Le rang et le numero uniques par journee sont la garantie « jamais deux
    // clients a la meme position ». Un doublon signifie que deux gestes se sont
    // croises a la milliseconde : rien n'a ete ecrit, le geste se refait.
    if (contrainte.includes('tickets_journee_rang') || contrainte.includes('tickets_journee_numero')) {
      return new AppError(409, 'Dos cambios en la fila se han cruzado. No se ha perdido nada: repite la acción.', { code: 'FILE_CONCURRENTE' });
    }
    // Un seul client au fauteuil : deux appels simultanes, un seul passe.
    if (contrainte.includes('tickets_un_seul_en_cours')) {
      return new AppError(409, 'Se acaba de llamar a un cliente en el mismo instante. Recarga la fila antes de llamar al siguiente.', { code: 'FAUTEUIL_OCCUPE' });
    }
    return new AppError(409, 'Este elemento ya existe (valor duplicado). Recarga la página y comprueba antes de repetir.', { code: 'DOUBLON' });
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
  '42501': 'la base de datos rechaza la escritura: permisos insuficientes',
  '42P01': 'falta una tabla: la base de datos no está migrada',
  '08000': 'se ha perdido la conexión con la base de datos',
  '08001': 'la base de datos no responde',
  '08003': 'se ha perdido la conexión con la base de datos',
  '08006': 'se ha perdido la conexión con la base de datos',
  '57P01': 'la base de datos se está apagando',
  '57P03': 'la base de datos está arrancando',
  '53300': 'la base de datos ya no acepta conexiones',
  '53200': 'la base de datos se ha quedado sin memoria',
  '53100': 'el disco de la base de datos está lleno',
  '58030': 'el disco de la base de datos no responde',
  '25006': 'la base de datos está en solo lectura: no se puede escribir',
  '55P03': 'otra operación mantenía el bloqueo demasiado tiempo',
  '57014': 'la operación ha superado el tiempo permitido y se ha interrumpido',
};

export function erreurBaseIndisponible(err) {
  if (!err) return null;
  let cause = CODES_INDISPONIBLES[err.code] ?? null;
  const texte = String(err.message || '');
  if (!cause && /timeout exceeded when trying to connect/i.test(texte)) cause = 'todas las conexiones con la base de datos están ocupadas';
  if (!cause && /Connection terminated|ECONNREFUSED|ECONNRESET/i.test(texte)) cause = 'se ha perdido la conexión con la base de datos';
  if (!cause) return null;
  return new AppError(503,
    'El servicio no puede usar la base de datos ahora mismo: ' + cause + '. No se ha guardado nada. Inténtalo en un instante.',
    { code: 'BASE_INDISPONIBLE', details: { retryAfter: 5 } });
}

/** Erreur de validation portant le detail champ par champ. */
export class ValidationError extends AppError {
  /** @param {Record<string,string>} fields */
  constructor(fields, msg = 'Algunos campos no son válidos.') {
    super(422, msg, { code: 'VALIDATION', details: { fields } });
    this.name = 'ValidationError';
    this.fields = fields;
  }
}
