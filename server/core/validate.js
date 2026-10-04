/**
 * Validation declarative des entrees.
 *
 * Chaque route decrit ce qu'elle accepte ; tout ce qui n'est pas decrit est
 * ignore (jamais recopie tel quel en base), et toute valeur non conforme
 * produit une erreur 422 qui nomme le champ.
 *
 *   const data = validate(ctx.body, {
 *     prenom: { type: 'prenom', required: true },
 *     telephone: { type: 'whatsapp', required: true },
 *   });
 */
import { ValidationError } from './errors.js';
import { isUuid } from './crypto.js';
import { config } from './config.js';
import { cleanSpaces, isValidIsoDate, capitaliserNom, telephoneInternational, sansBarresFinales } from './text.js';
import { heureValide } from './temps.js';
import { t } from './langue.js';

/** Entier strict : « 12 » oui, « 12abc », « 1e3 », « 12.5 » non. */
export function entierStrict(value) {
  if (typeof value === 'number') return Number.isInteger(value) ? value : Number.NaN;
  if (typeof value !== 'string') return Number.NaN;
  const texte = value.trim();
  return /^[+-]?\d+$/.test(texte) ? Number(texte) : Number.NaN;
}

/**
 * Un nom ou un prenom : lettres de toutes les langues du salon (latin, arabe),
 * espaces, apostrophes et traits d'union. Ni chiffres, ni ponctuation, ni
 * emoji : la file s'affiche en tres gros a l'ecran du coiffeur, et un nom
 * fantaisiste y est illisible autant qu'inutile.
 */
const NOM_RE = /^[\p{L}\p{M}][\p{L}\p{M} '’.-]*$/u;

/**
 * L'exemple montre au client quand son numero est refuse.
 *
 * Les mobiles espagnols et marocains commencent tous deux par 6 : l'exemple
 * tombe juste dans les deux pays. Il est nomme ici pour que le jour ou un pays
 * aux numeros differents arrive, il n'y ait qu'un endroit a corriger.
 */
const EXEMPLE_NUMERO = '612 345 678';

const CONVERTERS = {
  string(value, rule) {
    if (typeof value === 'object') return { error: t('valid.texteAttendu') };
    let text = String(value);
    if (rule.trim !== false) text = cleanSpaces(text);
    if (rule.upper) text = text.toUpperCase();
    if (rule.lower) text = text.toLowerCase();
    if (rule.min !== undefined && text.length < rule.min) return { error: t('valid.nomMin', { min: rule.min }) };
    if (rule.max !== undefined && text.length > rule.max) return { error: t('valid.nomMax', { max: rule.max }) };
    if (rule.pattern && !rule.pattern.test(text)) return { error: rule.patternMessage || t('valid.formatInvalide') };
    return { value: text };
  },

  text(value, rule) {
    if (typeof value === 'object') return { error: t('valid.texteAttendu') };
    const text = String(value).replace(/\r\n/g, '\n').trim();
    if (rule.min !== undefined && text.length < rule.min) return { error: t('valid.texteMin', { min: rule.min }) };
    if (rule.max !== undefined && text.length > rule.max) return { error: t('valid.texteMax', { max: rule.max }) };
    return { value: text };
  },

  /** Prenom ou nom de famille, remis en forme « Ahmed Benali ». */
  nom(value, rule) {
    if (typeof value === 'object') return { error: t('valid.texteAttendu') };
    const brut = cleanSpaces(value);
    const min = rule.min ?? 2;
    const max = rule.max ?? 40;
    if (brut.length < min) return { error: t('valid.nomMin', { min }) };
    if (brut.length > max) return { error: t('valid.nomMax', { max }) };
    if (!NOM_RE.test(brut)) return { error: t('valid.nomLettres') };
    return { value: capitaliserNom(brut) };
  },

  /**
   * Numero WhatsApp. La valeur retenue est la forme internationale en chiffres
   * seuls (« 34612345678 ») : c'est elle que l'API de Meta attend et celle sur
   * laquelle l'index aveugle est calcule. La saisie du client reste libre.
   */
  whatsapp(value) {
    if (typeof value === 'object') return { error: t('valid.numeroAttendu') };
    const numero = telephoneInternational(value, config.indicatifDefaut);
    if (!numero) {
      // L'indicatif vient de la configuration : le message d'un salon marocain
      // doit montrer « +212 », pas « +34 ». C'etait ecrit en dur, et un client
      // de Casablanca aurait lu un exemple espagnol.
      return { error: t('valid.whatsappInvalide', { exemple: EXEMPLE_NUMERO, indicatif: config.indicatifDefaut }) };
    }
    return { value: numero };
  },

  int(value, rule) {
    const n = entierStrict(value);
    if (!Number.isSafeInteger(n)) return { error: t('valid.entierAttendu') };
    if (rule.min !== undefined && n < rule.min) return { error: t('valid.intMin', { min: rule.min }) };
    if (rule.max !== undefined && n > rule.max) return { error: t('valid.intMax', { max: rule.max }) };
    return { value: n };
  },

  bool(value) {
    if (typeof value === 'boolean') return { value };
    const text = String(value).trim().toLowerCase();
    if (['1', 'true', 'oui', 'yes', 'on'].includes(text)) return { value: true };
    if (['0', 'false', 'non', 'no', 'off'].includes(text)) return { value: false };
    return { error: t('valid.ouiNon') };
  },

  uuid(value) {
    const text = String(value).trim();
    if (!isUuid(text)) return { error: t('valid.identifiant') };
    return { value: text.toLowerCase() };
  },

  date(value, rule) {
    const brut = String(value).trim();
    const ISO = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/;
    const text = ISO.test(brut) ? brut.slice(0, 10) : brut;
    if (!isValidIsoDate(text)) return { error: t('valid.dateInvalide') };
    if (rule.min && text < rule.min) return { error: t('valid.dateMin', { min: rule.min }) };
    if (rule.max && text > rule.max) return { error: t('valid.dateMax', { max: rule.max }) };
    return { value: text };
  },

  time(value) {
    const brut = String(value).trim();
    const text = /^\d{2}:\d{2}(:\d{2})?$/.test(brut) ? brut.slice(0, 5) : brut;
    if (!heureValide(text)) return { error: t('valid.heureInvalide') };
    return { value: text };
  },

  /** Adresse publique du salon (PUBLIC_URL, page de suivi partagee). */
  url(value, rule) {
    const brut = String(value).trim();
    if (brut.length > (rule.max ?? 300) + 50) return { error: t('valid.urlTropLongue') };
    const text = sansBarresFinales(brut);
    if (text.length > (rule.max ?? 300)) return { error: t('valid.urlTropLongue') };
    try {
      const u = new URL(text);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return { error: t('valid.urlProtocole') };
      return { value: text };
    } catch {
      return { error: t('valid.url') };
    }
  },

  enum(value, rule) {
    let text = String(value).trim();
    if (rule.upper) text = text.toUpperCase();
    if (!rule.values.includes(text)) return { error: t('valid.choix', { valeurs: rule.values.join(', ') }) };
    return { value: text };
  },

  array(value, rule, path) {
    if (!Array.isArray(value)) return { error: t('valid.listeAttendue') };
    if (rule.min !== undefined && value.length < rule.min) return { error: t('valid.listeMin', { min: rule.min }) };
    if (rule.max !== undefined && value.length > rule.max) return { error: t('valid.listeMax', { max: rule.max }) };
    const items = [];
    const errors = {};
    value.forEach((item, index) => {
      const itemPath = path + '[' + index + ']';
      // Une regle a un « type » chaine ; un schema d'objet non.
      if (rule.of && typeof rule.of.type !== 'string') {
        try {
          items.push(validate(item, rule.of, { path: itemPath }));
        } catch (err) {
          if (err instanceof ValidationError) Object.assign(errors, err.fields);
          else throw err;
        }
      } else if (rule.of) {
        const res = applyRule(item, rule.of, itemPath);
        if (res.fieldErrors) Object.assign(errors, res.fieldErrors);
        else if (res.error) errors[itemPath] = res.error;
        else items.push(res.value);
      } else {
        items.push(item);
      }
    });
    if (Object.keys(errors).length) return { fieldErrors: errors };
    return { value: items };
  },

  object(value, rule, path) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return { error: t('valid.objetAttendu') };
    if (!rule.of) return { value };
    try {
      return { value: validate(value, rule.of, { path }) };
    } catch (err) {
      if (err instanceof ValidationError) return { fieldErrors: err.fields };
      throw err;
    }
  },
};

function applyRule(value, rule, path) {
  const converter = CONVERTERS[rule.type];
  if (!converter) throw new Error('Type de validation inconnu : ' + rule.type + ' (' + path + ')');
  return converter(value, rule, path);
}

const EMPTY = (v) => v === undefined || v === null || v === '';

/**
 * Valide un objet contre un schema.
 * @param {object} input
 * @param {Record<string, object>} schema
 * @param {{path?: string, partial?: boolean}} [opts] partial : seuls les champs presents sont traites
 */
export function validate(input, schema, opts = {}) {
  const { path = '', partial = false } = opts;
  const source = input && typeof input === 'object' ? input : {};
  const output = {};
  const errors = {};

  for (const [field, rule] of Object.entries(schema)) {
    const fieldPath = path ? path + '.' + field : field;
    const present = Object.hasOwn(source, field);
    const raw = present ? source[field] : undefined;

    if (EMPTY(raw)) {
      if (partial && !present) continue;
      if (rule.required) {
        // Le message peut etre une FONCTION : les regles reutilisables ci-dessous
        // sont construites une seule fois au chargement du module, et un texte
        // fige a cet instant serait celui de la langue du demarrage, pas celle
        // du salon. Le meme mecanisme existe deja pour « default ».
        errors[fieldPath] = (typeof rule.requiredMessage === 'function'
          ? rule.requiredMessage()
          : rule.requiredMessage) || t('valid.requis');
        continue;
      }
      if (rule.default !== undefined) {
        output[field] = typeof rule.default === 'function' ? rule.default() : rule.default;
        continue;
      }
      if (present) output[field] = null;
      continue;
    }

    const result = applyRule(raw, rule, fieldPath);
    if (result.fieldErrors) Object.assign(errors, result.fieldErrors);
    else if (result.error) errors[fieldPath] = result.error;
    else output[field] = result.value;
  }

  if (Object.keys(errors).length) throw new ValidationError(errors);
  return output;
}

export const validatePartial = (input, schema) => validate(input, schema, { partial: true });

/** Regles reutilisables. */
export const rules = {
  id: { type: 'uuid', required: true },
  prenom: { type: 'nom', required: true, max: 40, requiredMessage: () => t('valid.prenomRequis') },
  nomFamille: { type: 'nom', required: true, max: 40, requiredMessage: () => t('valid.nomRequis') },
  whatsapp: { type: 'whatsapp', required: true, requiredMessage: () => t('valid.whatsappRequis') },
  motif: { type: 'text', max: 300 },
};
