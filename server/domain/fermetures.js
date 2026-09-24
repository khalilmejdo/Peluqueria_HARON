/**
 * Les periodes de fermeture : conges, jours feries, fermeture exceptionnelle.
 *
 * Une periode couvre ses deux bornes incluses. Pendant qu'elle court, la prise
 * de tour est refusee en disant la date de reouverture — un client qui voit
 * « nous rouvrons le lundi 12 octobre » ne rappelle pas trois fois le salon.
 *
 * Ce qui est fermé, c'est l'ENTREE dans la file, pas la file elle-meme : un
 * conge declare pour la semaine prochaine ne gene en rien le service du jour,
 * et une periode qui commence aujourd'hui laisse le coiffeur finir les clients
 * deja presents.
 *
 * Les chevauchements sont interdits par la base (contrainte d'exclusion) : deux
 * periodes qui se recouvrent rendraient toute suppression incomprehensible.
 */
import { all, one, execute } from '../db/index.js';
import { newId } from '../core/crypto.js';
import { jourLocal, dateLongueFr } from '../core/temps.js';
import { addDays } from '../core/text.js';
import { conflict, notFound } from '../core/errors.js';

/** La periode qui couvre ce jour, ou null. */
export async function fermetureDuJour(jour = jourLocal()) {
  return one('SELECT id, du, au, motif FROM fermetures WHERE du <= $1 AND au >= $1', [jour]);
}

/** Toutes les periodes, les plus recentes d'abord, sans l'histoire ancienne. */
export async function lister({ depuis = null, limite = 100 } = {}) {
  const borne = depuis || addDays(jourLocal(), -365);
  return all(
    `SELECT f.id, f.du, f.au, f.motif, f.created_at, u.identifiant AS par
       FROM fermetures f LEFT JOIN utilisateurs u ON u.id = f.created_by
      WHERE f.au >= $1 ORDER BY f.du DESC LIMIT $2`,
    [borne, Math.min(Math.max(1, limite), 500)],
  );
}

/** La prochaine periode a venir (pour prevenir les clients a l'avance). */
export async function prochaine(jour = jourLocal()) {
  return one('SELECT id, du, au, motif FROM fermetures WHERE du > $1 ORDER BY du LIMIT 1', [jour]);
}

export async function ajouter({ du, au, motif = null }, { parUtilisateurId = null } = {}) {
  if (au < du) throw conflict('La fecha de fin debe ser posterior o igual a la de inicio.');
  const id = newId();
  try {
    await execute(
      'INSERT INTO fermetures (id, du, au, motif, created_by) VALUES ($1,$2,$3,$4,$5)',
      [id, du, au, motif, parUtilisateurId],
    );
  } catch (err) {
    // 23P01 : la contrainte d'exclusion a refuse un chevauchement.
    if (err?.code === '23P01') {
      const existante = await one(
        'SELECT du, au FROM fermetures WHERE daterange(du, au, $3) && daterange($1, $2, $3) LIMIT 1',
        [du, au, '[]'],
      );
      throw conflict(existante
        ? 'Ya hay un cierre que cubre estas fechas (del ' + existante.du + ' al ' + existante.au + '). Modifíquelo en lugar de añadir otro.'
        : 'Ya hay un cierre que cubre estas fechas.');
    }
    throw err;
  }
  return one('SELECT id, du, au, motif, created_at FROM fermetures WHERE id = $1', [id]);
}

export async function supprimer(id) {
  const n = await execute('DELETE FROM fermetures WHERE id = $1', [id]);
  if (!n) throw notFound('Este periodo de cierre ya no existe.');
  return true;
}

/**
 * Le message a montrer au client, quand le salon est ferme.
 * @param {{du:string, au:string, motif:string|null}} fermeture
 */
export function messageDeFermeture(fermeture) {
  const reouverture = dateLongueFr(addDays(fermeture.au, 1));
  const raison = fermeture.motif ? fermeture.motif + '. ' : '';
  return raison + 'El salón está cerrado hasta el ' + dateLongueFr(fermeture.au)
    + ' incluido. Reabrimos el ' + reouverture + '.';
}
