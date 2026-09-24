/**
 * Fabrication d'elements.
 *
 * Tout passe par createElement et textContent : aucune donnee n'est jamais
 * assemblee en chaine HTML. Un prenom contenant « <script> » n'est donc, au
 * pire, qu'un prenom bizarre a l'ecran.
 */

/**
 * @param {string} balise  « div », « button.bouton.bouton--principal », « p#titre »
 * @param {object|string|Node|Array} [attributs]
 * @param {...(string|Node|null|undefined|Array)} enfants
 */
export function el(balise, attributs, ...enfants) {
  const [nom, ...classesEtId] = balise.split(/(?=[.#])/);
  const element = document.createElement(nom || 'div');
  for (const partie of classesEtId) {
    if (partie.startsWith('.')) element.classList.add(partie.slice(1));
    else if (partie.startsWith('#')) element.id = partie.slice(1);
  }

  let options = attributs;
  if (options && (typeof options === 'string' || options instanceof Node || Array.isArray(options))) {
    enfants.unshift(options);
    options = null;
  }

  for (const [cle, valeur] of Object.entries(options || {})) {
    if (valeur === null || valeur === undefined || valeur === false) continue;
    if (cle === 'texte') element.textContent = String(valeur);
    else if (cle === 'classe') element.className = String(valeur);
    else if (cle === 'donnees') for (const [d, v] of Object.entries(valeur)) element.dataset[d] = String(v);
    else if (cle.startsWith('sur') && typeof valeur === 'function') element.addEventListener(cle.slice(3).toLowerCase(), valeur);
    else if (valeur === true) element.setAttribute(cle, '');
    else element.setAttribute(cle, String(valeur));
  }

  ajouter(element, enfants);
  return element;
}

function ajouter(parent, enfants) {
  for (const enfant of enfants.flat(4)) {
    if (enfant === null || enfant === undefined || enfant === false) continue;
    parent.append(enfant instanceof Node ? enfant : document.createTextNode(String(enfant)));
  }
}

export function vider(element) {
  while (element.firstChild) element.firstChild.remove();
  return element;
}

export function remplacer(element, ...contenu) {
  vider(element);
  ajouter(element, contenu);
  return element;
}

/** Message lu a voix haute par les lecteurs d'ecran, et affiche en bandeau. */
export function annoncer(texte) {
  const zone = document.getElementById('annonces');
  if (zone) zone.textContent = texte;
}

/** « 14:05 » dans le fuseau du navigateur, qui est celui du salon. */
export function heure(instant) {
  if (!instant) return '—';
  const date = new Date(instant);
  if (Number.isNaN(date.getTime())) return '—';
  return String(date.getHours()).padStart(2, '0') + ':' + String(date.getMinutes()).padStart(2, '0');
}

/** « il y a 12 min », pour dire depuis quand quelqu'un attend. */
export function depuis(instant) {
  if (!instant) return '';
  const minutes = Math.max(0, Math.round((Date.now() - new Date(instant).getTime()) / 60000));
  if (minutes < 1) return 'ahora mismo';
  if (minutes < 60) return 'desde hace ' + minutes + ' min';
  const h = Math.floor(minutes / 60);
  const reste = minutes % 60;
  return 'desde hace ' + h + ' h' + (reste ? ' ' + String(reste).padStart(2, '0') : '');
}

export function minutesLisibles(minutes) {
  const m = Math.max(0, Math.round(Number(minutes) || 0));
  if (m <= 0) return 'unos minutos';
  if (m < 60) return m + ' min';
  const h = Math.floor(m / 60);
  const reste = m % 60;
  return h + ' h' + (reste ? ' ' + String(reste).padStart(2, '0') : '');
}

export const LIBELLE_SOURCE = { ONLINE: 'Por internet', QR: 'Código QR', COMPTOIR: 'Mostrador' };
export const LIBELLE_STATUT = {
  WAITING: 'Esperando',
  LATE: 'Esperando · ya estuvo ausente',
  CALLED: 'Llamado',
  IN_SERVICE: 'En curso',
  COMPLETED: 'Atendido',
  CANCELLED: 'Anulado',
};
