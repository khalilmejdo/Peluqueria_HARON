/**
 * La fiche de prix du salon.
 *
 * Une liste simple — une prestation, un prix, une note facultative — tenue
 * depuis l'espace de gestion et affichee en vitrine. Pas de categories, pas de
 * duree : le client veut savoir combien coute une coupe, pas lire un catalogue.
 *
 * LE PRIX EST UN ENTIER DE CENTIMES, du formulaire jusqu'a l'affichage. Il
 * n'existe aucun flottant sur ce chemin. « 14,90 € » se saisit tel quel, se
 * stocke 1490, et se reaffiche « 14,90 € » : le nombre qu'on lit est exactement
 * celui qu'on a tape, ce qu'un flottant ne garantit pas.
 *
 * Une ligne masquee (« visible = false ») reste en base : c'est la facon de
 * retirer une prestation de la vitrine sans perdre son prix, le temps d'une
 * saison ou d'une hesitation.
 */
import { all, one, execute, transaction } from '../db/index.js';
import { newId } from '../core/crypto.js';
import { AppError, notFound, badRequest } from '../core/errors.js';
import { normalize, cleanSpaces } from '../core/text.js';
import { ICONES } from '../site/icones-tarifas.js';

const COLONNES = 'id, nombre, precio_cts, nota, icono, ordre, visible, created_at, updated_at';

/** Au-dela, ce n'est plus un prix de coiffure mais une faute de frappe. */
const PRIX_MAX_CTS = 100000;
const NOM_MAX = 60;
const NOTA_MAX = 80;

/* ------------------------------------------------------------------ */
/*  Prix : texte <-> centimes                                          */
/* ------------------------------------------------------------------ */

/**
 * Lit un prix saisi a la main et rend des CENTIMES.
 *
 * Accepte « 14 », « 14,9 », « 14,90 », « 14.90 », « 14 € », « 14,90€ ». Refuse
 * tout le reste plutot que de deviner : un prix mal lu s'affiche au mur.
 *
 * Le calcul evite le flottant. `Math.round(14.9 * 100)` donnerait bien 1490,
 * mais `Math.round(1.005 * 100)` donne 100 et non 101 : on prefere assembler
 * les deux moities en entiers et ne jamais dependre de l'arrondi binaire.
 */
export function prixEnCentimes(entree) {
  if (entree === null || entree === undefined) return null;
  // Un entier deja en centimes (ce qu'envoie l'interface) passe tel quel.
  if (typeof entree === 'number') {
    return Number.isInteger(entree) && entree >= 0 && entree <= PRIX_MAX_CTS ? entree : null;
  }
  const texte = String(entree).trim().replace(/\s|€|EUR/gi, '').replace(',', '.');
  if (!/^\d{1,4}(\.\d{1,2})?$/.test(texte)) return null;
  const [euros, decimales = ''] = texte.split('.');
  const centimes = Number(euros) * 100 + Number((decimales + '00').slice(0, 2));
  return centimes <= PRIX_MAX_CTS ? centimes : null;
}

/**
 * Met un prix en forme a l'espagnole : virgule decimale, espace avant l'euro.
 * Les centimes a zero ne s'ecrivent pas — une fiche de prix de salon annonce
 * « 14 € », pas « 14,00 € ».
 */
export function prixLegible(centimes) {
  const n = Number(centimes) || 0;
  const euros = Math.floor(n / 100);
  const cts = n % 100;
  return cts === 0
    ? euros + ' €'
    : euros + ',' + String(cts).padStart(2, '0') + ' €';
}

/* ------------------------------------------------------------------ */
/*  Lectures                                                           */
/* ------------------------------------------------------------------ */

/**
 * La fiche, dans l'ordre d'affichage.
 *
 * `ordre` n'est pas unique : deux lignes peuvent le partager. Le tri retombe
 * alors sur le nom, ce qui rend l'affichage deterministe — sans quoi deux
 * rechargements pourraient presenter la meme fiche dans deux ordres.
 */
export async function lister({ visiblesSeulement = false } = {}) {
  return all(
    'SELECT ' + COLONNES + ' FROM tarifas '
    + (visiblesSeulement ? 'WHERE visible ' : '')
    + 'ORDER BY ' + (visiblesSeulement ? '' : 'visible DESC, ') + 'ordre, nombre_lower',
  );
}

/** Les lignes affichees en vitrine. */
export const listerVisibles = () => lister({ visiblesSeulement: true });

export async function parId(id) {
  return one('SELECT ' + COLONNES + ' FROM tarifas WHERE id = $1', [id]);
}

/** La fiche mise en forme pour l'affichage : prix deja lisibles. */
export async function pourVitrine() {
  const lignes = await listerVisibles();
  return lignes.map((l) => ({
    id: l.id,
    nombre: l.nombre,
    nota: l.nota || '',
    icono: l.icono || null,
    precioCts: l.precio_cts,
    precio: prixLegible(l.precio_cts),
  }));
}

/* ------------------------------------------------------------------ */
/*  Ecritures                                                          */
/* ------------------------------------------------------------------ */

function nomValide(valeur) {
  const nom = cleanSpaces(String(valeur ?? ''));
  if (!nom) throw badRequest('Indique el nombre del servicio.');
  if (nom.length > NOM_MAX) throw badRequest('El nombre del servicio no puede pasar de ' + NOM_MAX + ' caracteres.');
  return nom;
}

function notaValide(valeur) {
  const nota = cleanSpaces(String(valeur ?? ''));
  if (nota.length > NOTA_MAX) throw badRequest('La nota no puede pasar de ' + NOTA_MAX + ' caracteres.');
  return nota;
}

/**
 * L'icone : un nom de la liste fermee, ou rien.
 *
 * Un nom inconnu est ECARTE en silence plutot que refuse : le gerant n'a rien
 * fait de mal, et une ligne sans icone reste parfaitement lisible.
 */
function iconeValide(valeur) {
  const nom = String(valeur ?? '').trim();
  return ICONES.includes(nom) ? nom : null;
}

function prixValide(valeur) {
  const cts = prixEnCentimes(valeur);
  if (cts === null) throw badRequest('Escriba un precio como « 14 » o « 14,90 ».');
  return cts;
}

/**
 * Traduit les refus de la base en erreurs metier.
 *
 * `conflict()` prend `details` en second argument, PAS des options : lui passer
 * `{ code }` enfouirait le code dans les details et l'interface ne le verrait
 * jamais. On construit donc l'AppError a la main.
 */
function traduireErreur(err) {
  if (err?.constraint === 'tarifas_nom_unique' || err?.code === '23505') {
    return new AppError(409, 'Ya existe un servicio con ese nombre.', { code: 'TARIFA_DUPLICADA' });
  }
  if (err?.constraint === 'tarifas_prix_plausible') return badRequest('El precio está fuera de lo razonable.');
  if (err?.constraint === 'tarifas_nom_non_vide') return badRequest('Indique el nombre del servicio.');
  return err;
}

/** Ajoute une prestation en fin de fiche. */
export async function crear({ nombre, precio, nota, icono } = {}) {
  const nom = nomValide(nombre);
  const cts = prixValide(precio);
  const note = notaValide(nota);
  const icone = iconeValide(icono);
  const id = newId();

  // « ordre » suit le maximum existant : une nouvelle ligne arrive en bas, la
  // ou le gerant vient de la taper. Elle ne se glisse jamais au milieu.
  try {
    await execute(
      'INSERT INTO tarifas (id, nombre, nombre_lower, precio_cts, nota, icono, ordre, visible) '
      + 'VALUES ($1, $2, $3, $4, $5, $6, COALESCE((SELECT MAX(ordre) + 1 FROM tarifas), 0), TRUE)',
      [id, nom, normalize(nom), cts, note || null, icone],
    );
  } catch (err) {
    throw traduireErreur(err);
  }
  return parId(id);
}

/** Modifie une prestation. Les champs absents ne bougent pas. */
export async function modificar(id, champs = {}) {
  const actuel = await parId(id);
  if (!actuel) throw notFound('Servicio no encontrado.');

  const nom = champs.nombre === undefined ? actuel.nombre : nomValide(champs.nombre);
  const cts = champs.precio === undefined ? actuel.precio_cts : prixValide(champs.precio);
  const note = champs.nota === undefined ? (actuel.nota || '') : notaValide(champs.nota);
  const visible = champs.visible === undefined ? actuel.visible : Boolean(champs.visible);
  const icone = champs.icono === undefined ? actuel.icono : iconeValide(champs.icono);

  try {
    await execute(
      'UPDATE tarifas SET nombre = $2, nombre_lower = $3, precio_cts = $4, nota = $5, visible = $6, icono = $7 WHERE id = $1',
      [id, nom, normalize(nom), cts, note || null, visible, icone],
    );
  } catch (err) {
    throw traduireErreur(err);
  }
  return parId(id);
}

/**
 * Supprime une prestation.
 *
 * Contrairement a un fauteuil, une ligne de tarif ne porte aucun historique :
 * aucun ticket ne la reference. Elle se supprime donc vraiment. Le gerant qui
 * hesite dispose de « masquer », qui garde le prix sans l'afficher.
 */
export async function eliminar(id) {
  const n = await execute('DELETE FROM tarifas WHERE id = $1', [id]);
  if (!n) throw notFound('Servicio no encontrado.');
  return true;
}

/**
 * Reordonne la fiche entiere, d'un seul geste.
 *
 * Le glisser-deposer envoie l'ordre COMPLET plutot qu'une suite de
 * deplacements : douze lignes reordonnees feraient sinon douze requetes, dont
 * une peut echouer au milieu et laisser la fiche dans un ordre que personne n'a
 * voulu.
 *
 * On EXIGE que la liste recue soit exactement l'ensemble des lignes existantes.
 * Un identifiant en trop, en moins ou en double signifie que l'ecran travaillait
 * sur une fiche perimee — quelqu'un a ajoute ou supprime une ligne pendant ce
 * temps. Appliquer quand meme perdrait silencieusement cette ligne.
 */
export async function reordenar(ids) {
  if (!Array.isArray(ids) || !ids.length) throw badRequest('Envíe el orden completo de la lista.');

  return transaction(async (tx) => {
    const lignes = (await tx.query('SELECT id FROM tarifas ORDER BY id FOR UPDATE')).rows;
    const connus = new Set(lignes.map((l) => l.id));
    const recus = new Set(ids);

    if (recus.size !== ids.length) throw badRequest('La lista enviada repite un servicio.');
    if (recus.size !== connus.size || [...recus].some((id) => !connus.has(id))) {
      throw new AppError(409,
        'La lista ha cambiado mientras la reordenabas. Recarga la página e inténtalo de nuevo.',
        { code: 'TARIFAS_DESFASADAS' });
    }

    for (let i = 0; i < ids.length; i += 1) {
      await tx.query('UPDATE tarifas SET ordre = $2 WHERE id = $1', [ids[i], i]);
    }
    return ids.length;
  });
}

/**
 * Deplace une prestation d'un cran vers le haut ou vers le bas.
 *
 * Toute la fiche est verrouillee dans UNE transaction, et `FOR UPDATE` prend les
 * verrous dans l'ordre du `ORDER BY` — le meme pour tout le monde. Deux gerants
 * qui reordonnent la fiche au meme instant attendent donc l'un l'autre au lieu
 * de se bloquer mutuellement.
 */
export async function mover(id, sens) {
  if (sens !== 'arriba' && sens !== 'abajo') throw badRequest('Sentido no válido.');

  return transaction(async (tx) => {
    const lignes = (await tx.query(
      'SELECT id, ordre, nombre_lower FROM tarifas ORDER BY ordre, nombre_lower FOR UPDATE',
    )).rows;

    const i = lignes.findIndex((l) => l.id === id);
    if (i < 0) throw notFound('Servicio no encontrado.');
    const j = sens === 'arriba' ? i - 1 : i + 1;
    if (j < 0 || j >= lignes.length) return false; // deja en bout de liste

    // On reecrit TOUTE la colonne « ordre » avec la position finale de chaque
    // ligne. C'est plus simple qu'un echange de deux valeurs, et cela repare du
    // meme coup les egalites laissees par d'anciennes manipulations.
    const ordonne = lignes.slice();
    [ordonne[i], ordonne[j]] = [ordonne[j], ordonne[i]];
    for (let k = 0; k < ordonne.length; k += 1) {
      await tx.query('UPDATE tarifas SET ordre = $2 WHERE id = $1', [ordonne[k].id, k]);
    }
    return true;
  });
}
