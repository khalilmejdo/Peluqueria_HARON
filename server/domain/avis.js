/**
 * LES AVIS DES CLIENTS, SANS COMPTE.
 *
 * LA PREUVE DE VISITE EST LE LIEN DE SUIVI. Il n'y a ni compte ni courriel :
 * un avis se depose depuis la page de son tour ou de son rendez-vous, une fois
 * le client SERVI. Quelqu'un qui n'est pas venu n'a pas de lien, donc pas
 * d'avis — c'est ce qui manque aux avis ouverts a tous.
 *
 * UN AVIS PAR VISITE. La cle est le ticket : un rendez-vous honore porte le
 * sien (`rendez_vous.ticket_id`), donc ses deux liens menent au meme avis.
 *
 * RIEN N'EST PUBLIE SANS LE SALON. Un avis arrive « en attente » ; le gerant
 * le publie, le masque ou le supprime. La vitrine ne montre que les publies.
 *
 * Seul le PRENOM est garde, recopie du ticket : l'avis doit survivre a la
 * purge de l'historique, et ne doit jamais porter un nom ni un numero.
 */
import { all, one, execute, transaction } from '../db/index.js';
import { newId } from '../core/crypto.js';
import { t } from '../core/langue.js';
import { AppError, ValidationError, notFound } from '../core/errors.js';

export const STATUTS_AVIS = ['ATTENTE', 'PUBLIE', 'MASQUE'];
export const COMMENTAIRE_MAX = 600;

/** Le commentaire, nettoye : espaces resserres, caracteres de controle retires. */
function nettoyer(texte) {
  return Array.from(String(texte ?? ''))
    .map((c) => (c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127 ? ' ' : c))
    .join('')
    .split(' ')
    .filter(Boolean)
    .join(' ');
}

/**
 * Ou en est l'avis d'une visite.
 * @returns {Promise<'OUVERT'|'DEJA'|'NON'>} OUVERT : le client peut noter ;
 *   DEJA : c'est fait ; NON : la visite n'est pas (encore) terminee.
 */
export async function etatPourTicket(ticketId) {
  if (!ticketId) return 'NON';
  const ligne = await one(
    `SELECT t.statut, (SELECT 1 FROM avis a WHERE a.ticket_id = t.id) AS deja
       FROM tickets t WHERE t.id = $1`,
    [ticketId],
  );
  if (!ligne) return (await one('SELECT 1 AS n FROM avis WHERE ticket_id = $1', [ticketId])) ? 'DEJA' : 'NON';
  if (ligne.deja) return 'DEJA';
  return ligne.statut === 'COMPLETED' ? 'OUVERT' : 'NON';
}

/**
 * DEPOSER un avis pour une visite terminee.
 * @param {{ ticketId:string, note:any, commentaire?:any }} o
 */
export async function deposer({ ticketId, note, commentaire = '' }) {
  const n = Number(note);
  if (!Number.isInteger(n) || n < 1 || n > 5) throw new ValidationError({ note: t('avis.noteInvalide') });
  const texte = nettoyer(commentaire);
  if (texte.length > COMMENTAIRE_MAX) throw new ValidationError({ commentaire: t('valid.texteTropLong', { max: COMMENTAIRE_MAX }) });

  return transaction(async (tx) => {
    const ticket = await tx.one('SELECT id, prenom, statut FROM tickets WHERE id = $1 FOR UPDATE', [ticketId]);
    if (!ticket || ticket.statut !== 'COMPLETED') throw new AppError(409, t('avis.pasEncore'), { code: 'VISITE_NON_TERMINEE' });
    const cree = await tx.one(
      `INSERT INTO avis (id, ticket_id, prenom, note, commentaire)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (ticket_id) DO NOTHING
       RETURNING id`,
      [newId(), ticket.id, ticket.prenom, n, texte],
    );
    if (!cree) throw new AppError(409, t('avis.dejaDonne'), { code: 'AVIS_DEJA_DONNE' });
    return cree;
  });
}

const versGestion = (a) => ({
  id: a.id, prenom: a.prenom, note: a.note, commentaire: a.commentaire, statut: a.statut, le: a.created_at,
});

/** Tous les avis, pour le gerant : ceux qui attendent d'abord. */
export async function lister() {
  const lignes = await all(
    `SELECT id, prenom, note, commentaire, statut, created_at FROM avis
      ORDER BY (statut = 'ATTENTE') DESC, created_at DESC LIMIT 300`,
  );
  return lignes.map(versGestion);
}

export async function changerStatut(id, statut) {
  if (!STATUTS_AVIS.includes(statut)) throw new ValidationError({ statut: t('avis.statutInvalide') });
  const maj = await one(
    'UPDATE avis SET statut = $2 WHERE id = $1 RETURNING id, prenom, note, commentaire, statut, created_at',
    [id, statut],
  );
  if (!maj) throw notFound(t('avis.introuvable'));
  return versGestion(maj);
}

export async function supprimer(id) {
  const n = await execute('DELETE FROM avis WHERE id = $1', [id]);
  if (!n) throw notFound(t('avis.introuvable'));
}

/**
 * Ce que la VITRINE montre : la moyenne et le nombre des avis PUBLIES, leur
 * repartition par note, et les plus recents.
 * @returns {Promise<{ nombre:number, moyenne:number, repartition:number[], liste:Array }>}
 *   repartition[0] = le nombre de 5 etoiles ... repartition[4] = le nombre de 1 etoile
 */
export async function publies({ limite = 6 } = {}) {
  const [compte, liste] = await Promise.all([
    all("SELECT note, COUNT(*)::int AS n FROM avis WHERE statut = 'PUBLIE' GROUP BY note"),
    all(
      `SELECT prenom, note, commentaire, created_at FROM avis
        WHERE statut = 'PUBLIE' ORDER BY created_at DESC LIMIT $1`,
      [limite],
    ),
  ]);
  const repartition = [5, 4, 3, 2, 1].map((note) => compte.find((c) => c.note === note)?.n ?? 0);
  const nombre = repartition.reduce((a, b) => a + b, 0);
  const somme = repartition.reduce((a, n, i) => a + n * (5 - i), 0);
  return {
    nombre,
    moyenne: nombre ? Math.round((somme / nombre) * 10) / 10 : 0,
    repartition,
    liste: liste.map((a) => ({ prenom: a.prenom, note: a.note, commentaire: a.commentaire, le: a.created_at })),
  };
}
