/**
 * Utilitaires de texte : normalisation, echappement, telephones.
 *
 * Aucun caractere special n'est ecrit en clair ni par sequence d'echappement
 * dans les expressions : ils sont construits par leur code, ce qui les garde
 * intacts quel que soit l'outil qui edite le fichier.
 */

const DIACRITIQUES = new RegExp('[' + String.fromCharCode(0x300) + '-' + String.fromCharCode(0x36f) + ']', 'g');
const CARACTERE_NUL = String.fromCharCode(0);

/** Retire les accents : « Réservée » -> « Reservee ». */
export function sansAccents(input) {
  return String(input ?? '').normalize('NFD').replace(DIACRITIQUES, '');
}

/** Forme de comparaison : sans accents, minuscules, espaces compresses. */
export function normalize(input) {
  if (input === null || input === undefined) return '';
  return sansAccents(input).toLowerCase().replace(/\s+/g, ' ').trim();
}

export function cleanSpaces(input) {
  if (input === null || input === undefined) return '';
  return String(input).replace(/\s+/g, ' ').trim();
}

/** Retire les octets nuls, que PostgreSQL refuse dans une colonne texte. */
export function sansOctetNul(input) {
  if (typeof input !== 'string') return input;
  return input.includes(CARACTERE_NUL) ? input.split(CARACTERE_NUL).join('') : input;
}

/** Echappement HTML : toute donnee inseree dans un gabarit passe par ici. */
export function escapeHtml(input) {
  if (input === null || input === undefined) return '';
  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Premiere lettre de chaque mot en capitale : « ahmed BENALI » -> « Ahmed Benali ». */
export function capitaliserNom(input) {
  return cleanSpaces(input)
    .split(' ')
    .map((mot) => mot.split('-').map((p) => (p ? p[0].toLocaleUpperCase('fr') + p.slice(1).toLocaleLowerCase('fr') : p)).join('-'))
    .join(' ');
}

export function initiales(prenom, nom) {
  const p = cleanSpaces(prenom);
  const n = cleanSpaces(nom);
  const lettres = (p ? p[0] : '') + (n ? n[0] : '');
  return (lettres || '?').toLocaleUpperCase('fr');
}

/* ------------------------------------------------------------------ */
/*  Dates calendaires (sans fuseau)                                    */
/* ------------------------------------------------------------------ */

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isValidIsoDate(input) {
  if (typeof input !== 'string') return false;
  const m = input.match(DATE_RE);
  if (!m) return false;
  const [, y, mo, d] = m.map(Number);
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
}

export function addDays(isoDate, days) {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export function formatDateFr(isoDate) {
  if (!isoDate) return '';
  const value = String(isoDate).slice(0, 10);
  if (!DATE_RE.test(value)) return String(isoDate);
  const [y, m, d] = value.split('-');
  return d + '/' + m + '/' + y;
}

/* ------------------------------------------------------------------ */
/*  Telephones WhatsApp                                                */
/* ------------------------------------------------------------------ */

/**
 * Forme internationale d'un numero : chiffres seuls, indicatif compris,
 * sans « + » ni zero de tete national. C'est la forme attendue par l'API
 * WhatsApp (« 34612345678 ») et celle sur laquelle l'index aveugle est calcule.
 *
 * Regles appliquees, dans cet ordre :
 *   « +34 612 34 56 78 »  -> 34612345678   (indicatif explicite)
 *   « 0034612345678 »     -> 34612345678   (prefixe international 00)
 *   « 0612345678 »        -> 33612345678   avec indicatifDefaut = 33
 *   « 612345678 »         -> 34612345678   avec indicatifDefaut = 34
 *
 * @param {string} valeur
 * @param {string} indicatifDefaut  indicatif du pays du salon, chiffres seuls
 * @returns {string|null} numero international, ou null s'il est invraisemblable
 */
export function telephoneInternational(valeur, indicatifDefaut = '34') {
  const brut = String(valeur ?? '').trim();
  if (!brut) return null;
  // Seuls les separateurs usuels sont admis : une saisie exotique est refusee
  // plutot que nettoyee au mieux (elle cacherait une faute de frappe).
  if (!/^\+?[0-9][0-9\s.\-()/]*$/.test(brut)) return null;

  const explicite = brut.startsWith('+');
  let chiffres = brut.replace(/[^0-9]/g, '');
  if (!chiffres) return null;

  if (explicite) {
    // rien a faire : l'indicatif est deja la
  } else if (chiffres.startsWith('00')) {
    chiffres = chiffres.slice(2);
  } else if (chiffres.startsWith('0')) {
    chiffres = indicatifDefaut + chiffres.slice(1);
  } else if (!chiffres.startsWith(indicatifDefaut)) {
    chiffres = indicatifDefaut + chiffres;
  }

  // L'UIT borne un numero international a 15 chiffres ; en deca de 8, ce n'est
  // pas un mobile joignable. Le premier chiffre d'un indicatif n'est jamais 0.
  if (!/^[1-9]\d{7,14}$/.test(chiffres)) return null;
  return chiffres;
}

/** « 34612345678 » -> « +34 612 345 678 » (groupes de trois apres l'indicatif). */
export function formatTelephone(international, indicatif = null) {
  const n = String(international ?? '').replace(/[^0-9]/g, '');
  if (!n) return '';
  const tete = indicatif && n.startsWith(indicatif) ? indicatif : n.slice(0, n.length > 11 ? 3 : 2);
  const reste = n.slice(tete.length);
  return '+' + tete + ' ' + (reste.match(/.{1,3}/g) || []).join(' ');
}

/** Masque d'affichage public : les quatre derniers chiffres seulement. */
export function telephoneMasque(international) {
  const n = String(international ?? '').replace(/[^0-9]/g, '');
  if (n.length < 4) return '••••';
  return '•••• •••• ' + n.slice(-4);
}
