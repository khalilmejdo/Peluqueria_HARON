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
// ValidationError manquait a cet import, et dureeValide() s'en sert : la duree
// invalide ne levait donc pas un 422 qui nomme le champ, elle levait un
// ReferenceError, c'est-a-dire une erreur 500. Deux defauts empiles au meme
// endroit — le motif faux garantissait que le second se declenche toujours.
import { AppError, notFound, badRequest, ValidationError } from '../core/errors.js';
import { normalize, cleanSpaces } from '../core/text.js';
import { t } from '../core/langue.js';
import { montantLisible, centimesDepuisTexte, deviseActive } from '../core/devise.js';
import { ICONES } from '../site/icones-tarifas.js';

const COLONNES = 'id, nombre, precio_cts, nota, icono, duracion_min, categoria, precio_desde, reservable, ordre, visible, created_at, updated_at';

const CATEGORIE_MAX = 40;

const NOM_MAX = 60;
const NOTA_MAX = 80;

/** Une prestation prend au moins une minute, et pas plus de quatre heures. */
const DUREE_MIN = 1;
const DUREE_MAX = 240;

/* ------------------------------------------------------------------ */
/*  Prix : texte <-> centimes                                          */
/* ------------------------------------------------------------------ */

/**
 * Le prix reste un ENTIER DE CENTIMES de bout en bout ; seule son ecriture
 * depend de la monnaie du salon, et cette ecriture vit dans core/devise.js.
 *
 * Les deux fonctions restent exportees sous leurs noms d'origine : elles sont
 * appelees depuis les routes et les tests, et un renommage n'aurait rien apporte
 * a un lecteur — « prixLegible » dit deja ce qu'il fait.
 */
export const prixEnCentimes = centimesDepuisTexte;
export const prixLegible = montantLisible;

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
    // « Desde 45 € » : la couleur depend de la longueur, un prix ferme mentirait.
    precioDesde: Boolean(l.precio_desde),
    precioTexte: l.precio_desde ? t('tarifs.aPartirDe', { prix: prixLegible(l.precio_cts) }) : prixLegible(l.precio_cts),
    duracionMin: l.duracion_min,
    categoria: l.categoria || '',
    reservable: Boolean(l.reservable),
  }));
}

/* ------------------------------------------------------------------ */
/*  Ecritures                                                          */
/* ------------------------------------------------------------------ */

function nomValide(valeur) {
  const nom = cleanSpaces(String(valeur ?? ''));
  if (!nom) throw badRequest(t('tarifa.nomRequis'));
  if (nom.length > NOM_MAX) throw badRequest(t('tarifa.nomTropLong', { max: NOM_MAX }));
  return nom;
}

function notaValide(valeur) {
  const nota = cleanSpaces(String(valeur ?? ''));
  if (nota.length > NOTA_MAX) throw badRequest(t('tarifa.notaTropLongue', { max: NOTA_MAX }));
  return nota;
}

/**
 * L'icone : un nom de la liste fermee, ou rien.
 *
 * Un nom inconnu est ECARTE en silence plutot que refuse : le gerant n'a rien
 * fait de mal, et une ligne sans icone reste parfaitement lisible.
 */
function categorieValide(valeur) {
  const texte = cleanSpaces(String(valeur ?? ''));
  if (texte.length > CATEGORIE_MAX) throw badRequest(t('tarifa.categorieTropLongue', { max: CATEGORIE_MAX }));
  return texte;
}

function iconeValide(valeur) {
  const nom = String(valeur ?? '').trim();
  return ICONES.includes(nom) ? nom : null;
}

/**
 * Les exemples du message d'erreur suivent la monnaie du salon.
 *
 * « Escriba un precio como « 14 » o « 14,90 » » n'aide pas un gerant marocain :
 * une coupe a 14 dirhams n'existe pas, et l'exemple lui fait douter de l'unite
 * plutot que de la forme. On montre donc un ordre de grandeur credible.
 */
const EXEMPLES_PRIX = { MAD: ['80', '99,50'], EUR: ['14', '14,90'] };

function prixValide(valeur) {
  const cts = prixEnCentimes(valeur);
  if (cts === null) {
    const [exemple1, exemple2] = EXEMPLES_PRIX[deviseActive()] ?? EXEMPLES_PRIX.EUR;
    throw badRequest(t('tarifa.prixInvalide', { exemple1, exemple2 }));
  }
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
    return new AppError(409, t('tarifa.dupliquee'), { code: 'TARIFA_DUPLICADA' });
  }
  if (err?.constraint === 'tarifas_prix_plausible') return badRequest(t('tarifa.prixDeraisonnable'));
  if (err?.constraint === 'tarifas_nom_non_vide') return badRequest(t('tarifa.nomRequis'));
  return err;
}

/**
 * La duree d'une prestation, en minutes.
 *
 * Elle sert a annoncer l'attente : une valeur absurde ferait mentir toute la
 * file, pas seulement sa ligne. On borne donc a quatre heures, et on refuse
 * zero — un service qui ne prend aucun temps n'occupe pas un fauteuil.
 */
export function dureeValide(valeur) {
  const texte = String(valeur ?? '').trim();
  // « \d », et non « d ». L'antislash manquait : le motif exigeait la LETTRE d,
  // donc « 15 » etait refuse et « d » accepte. Consequence, silencieuse parce
  // que le message d'erreur restait plausible — aucune duree ne pouvait plus
  // etre enregistree, et l'attente annoncee retombait sur la moyenne du salon
  // pour toutes les prestations.
  if (!/^\d{1,3}$/.test(texte)) {
    throw new ValidationError({ duracion: t('tarifa.dureeEntiere') });
  }
  const n = Number(texte);
  if (n < DUREE_MIN || n > DUREE_MAX) {
    throw new ValidationError({ duracion: t('tarifa.dureeBornes', { min: DUREE_MIN, max: DUREE_MAX }) });
  }
  return n;
}

/** Ajoute une prestation en fin de fiche. */
export async function crear({
  nombre, precio, nota, icono, duracion, categoria, precioDesde, reservable,
} = {}) {
  const nom = nomValide(nombre);
  const cts = prixValide(precio);
  const note = notaValide(nota);
  const icone = iconeValide(icono);
  const minutos = duracion === undefined || duracion === null || duracion === '' ? 15 : dureeValide(duracion);
  const chapitre = categorieValide(categoria);
  const id = newId();

  // « ordre » suit le maximum existant : une nouvelle ligne arrive en bas, la
  // ou le gerant vient de la taper. Elle ne se glisse jamais au milieu.
  try {
    await execute(
      'INSERT INTO tarifas (id, nombre, nombre_lower, precio_cts, nota, icono, duracion_min, categoria, precio_desde, reservable, ordre, visible) '
      + 'VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, COALESCE((SELECT MAX(ordre) + 1 FROM tarifas), 0), TRUE)',
      [id, nom, normalize(nom), cts, note || null, icone, minutos, chapitre || null,
        Boolean(precioDesde), reservable === undefined || reservable === null ? true : Boolean(reservable)],
    );
  } catch (err) {
    throw traduireErreur(err);
  }
  return parId(id);
}

/** Modifie une prestation. Les champs absents ne bougent pas. */
export async function modificar(id, champs = {}) {
  const actuel = await parId(id);
  if (!actuel) throw notFound(t('tarifa.introuvable'));

  const nom = champs.nombre === undefined ? actuel.nombre : nomValide(champs.nombre);
  const cts = champs.precio === undefined ? actuel.precio_cts : prixValide(champs.precio);
  const note = champs.nota === undefined ? (actuel.nota || '') : notaValide(champs.nota);
  const visible = champs.visible === undefined ? actuel.visible : Boolean(champs.visible);
  const icone = champs.icono === undefined ? actuel.icono : iconeValide(champs.icono);
  const minutos = champs.duracion === undefined ? actuel.duracion_min : dureeValide(champs.duracion);
  const chapitre = champs.categoria === undefined ? (actuel.categoria || '') : categorieValide(champs.categoria);
  const desde = champs.precioDesde === undefined ? actuel.precio_desde : Boolean(champs.precioDesde);
  const resa = champs.reservable === undefined ? actuel.reservable : Boolean(champs.reservable);

  try {
    await execute(
      'UPDATE tarifas SET nombre = $2, nombre_lower = $3, precio_cts = $4, nota = $5, visible = $6, icono = $7, '
      + 'duracion_min = $8, categoria = $9, precio_desde = $10, reservable = $11 WHERE id = $1',
      [id, nom, normalize(nom), cts, note || null, visible, icone, minutos, chapitre || null, desde, resa],
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
  if (!n) throw notFound(t('tarifa.introuvable'));
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
  if (!Array.isArray(ids) || !ids.length) throw badRequest(t('tarifa.ordreIncomplet'));

  return transaction(async (tx) => {
    const lignes = (await tx.query('SELECT id FROM tarifas ORDER BY id FOR UPDATE')).rows;
    const connus = new Set(lignes.map((l) => l.id));
    const recus = new Set(ids);

    if (recus.size !== ids.length) throw badRequest(t('tarifa.ordreRepete'));
    if (recus.size !== connus.size || [...recus].some((id) => !connus.has(id))) {
      throw new AppError(409, t('tarifa.listeDesyncro'), { code: 'TARIFAS_DESFASADAS' });
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
  if (sens !== 'arriba' && sens !== 'abajo') throw badRequest(t('tarifa.sensInvalide'));

  return transaction(async (tx) => {
    const lignes = (await tx.query(
      'SELECT id, ordre, nombre_lower FROM tarifas ORDER BY ordre, nombre_lower FOR UPDATE',
    )).rows;

    const i = lignes.findIndex((l) => l.id === id);
    if (i < 0) throw notFound(t('tarifa.introuvable'));
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
