/**
 * LE PROGRAMME DE FIDELITE.
 *
 * Toutes les N seances, un cadeau : une prestation de la carte, un cadeau
 * decrit par le salon, ou les deux. Eteint par defaut ; le gerant l'allume et
 * le regle (« fidelite.* »).
 *
 * LA CARTE EST LE NUMERO DE TELEPHONE. Pas de compte, pas de carte a tamponner
 * ni a perdre : une seance compte quand le coiffeur marque le client « servi »,
 * et elle s'ajoute au numero donne a la prise de tour ou de rendez-vous.
 *
 * CE QUI EST GARDE : l'INDEX AVEUGLE du numero (le meme condensat a cle que
 * celui des tickets), jamais le numero. On ne peut donc pas remonter d'une
 * carte a un telephone, et un vol de la base ne livre aucune liste de clients.
 * La table vit A PART des tickets, expres : la purge de l'historique efface
 * les tickets, elle ne doit pas effacer les seances acquises.
 *
 * UNE SEANCE NE COMPTE QU'UNE FOIS : `terminer` ne s'execute qu'au passage a
 * « servi », et un ticket servi ne revient jamais en arriere.
 *
 * Les seances ne comptent que PENDANT que le programme est allume : l'eteindre
 * garde les cartes telles quelles, le rallumer reprend ou elles en etaient.
 */
import { all, one, transaction } from '../db/index.js';
import { t } from '../core/langue.js';
import { conflict, notFound, AppError } from '../core/errors.js';
import { lireTous } from '../core/reglages.js';

/**
 * Ou en est une carte, pour un objectif donne. Pur.
 *
 * @param {{ seances?:number, cadeaux?:number }|null} ligne
 * @param {number} objectif  le nombre de seances qui donne un cadeau
 * @returns {{ seances:number, acquis:number, objectif:number, restant:number, cadeaux:number }}
 *   acquis : les seances de la carte EN COURS ; cadeaux : ceux qui attendent d'etre remis
 */
export function etatDeLaCarte(ligne, objectif) {
  const n = Math.max(2, Number(objectif) || 10);
  const seances = Math.max(0, Number(ligne?.seances) || 0);
  const remis = Math.max(0, Number(ligne?.cadeaux) || 0);
  const acquis = seances % n;
  return {
    seances,
    acquis,
    objectif: n,
    restant: n - acquis,
    cadeaux: Math.max(0, Math.floor(seances / n) - remis),
  };
}

/**
 * Le programme tel qu'il est regle, ou null s'il est eteint.
 * @returns {Promise<{ objectif:number, cadeau:string }|null>}
 */
export async function programme(reglages = null) {
  const r = reglages || await lireTous();
  if (!r['fidelite.active']) return null;
  const id = r['fidelite.prestation'];
  const prestation = id ? await one('SELECT nombre FROM tarifas WHERE id = $1', [id]) : null;
  const morceaux = [
    prestation ? t('fidelite.prestationOfferte', { nom: prestation.nombre }) : null,
    String(r['fidelite.cadeau'] || '').trim() || null,
  ].filter(Boolean);
  return {
    objectif: Math.max(2, Number(r['fidelite.seances']) || 10),
    cadeau: morceaux.join(' + ') || t('fidelite.cadeauDefaut'),
  };
}

/** Une seance de plus sur la carte du client de ce ticket. Dans la transaction du geste. */
export async function compterSeance(tx, ticketId, reglages) {
  if (!reglages['fidelite.active']) return;
  await tx.execute(
    `INSERT INTO fidelite (telephone_idx, seances, derniere_at)
          SELECT telephone_idx, 1, now() FROM tickets WHERE id = $1
     ON CONFLICT (telephone_idx) DO UPDATE SET seances = fidelite.seances + 1, derniere_at = now()`,
    [ticketId],
  );
}

/** Les cartes des clients d'une journee, par ticket. Une seule requete. */
export async function cartesDuJour(jour, objectif) {
  const lignes = await all(
    `SELECT t.id, f.seances, f.cadeaux
       FROM tickets t LEFT JOIN fidelite f ON f.telephone_idx = t.telephone_idx
      WHERE t.jour = $1`,
    [jour],
  );
  return new Map(lignes.map((l) => [l.id, etatDeLaCarte(l, objectif)]));
}

/** La carte du client d'un rendez-vous. */
export async function carteDuRendezVous(rdvId, objectif) {
  const ligne = await one(
    `SELECT f.seances, f.cadeaux
       FROM rendez_vous r LEFT JOIN fidelite f ON f.telephone_idx = r.telephone_idx
      WHERE r.id = $1`,
    [rdvId],
  );
  return etatDeLaCarte(ligne, objectif);
}

/**
 * LE CADEAU EST REMIS : un cadeau de moins a donner sur la carte de ce client.
 * Refuse s'il n'y en a aucun — on ne remet pas un cadeau qui n'est pas acquis.
 */
export async function remettreCadeau(ticketId) {
  const p = await programme();
  if (!p) throw conflict(t('fidelite.eteint'));
  return transaction(async (tx) => {
    const ligne = await tx.one(
      `SELECT f.telephone_idx, f.seances, f.cadeaux
         FROM tickets t JOIN fidelite f ON f.telephone_idx = t.telephone_idx
        WHERE t.id = $1 FOR UPDATE OF f`,
      [ticketId],
    );
    if (!ligne) {
      const existe = await tx.one('SELECT 1 AS n FROM tickets WHERE id = $1', [ticketId]);
      if (!existe) throw notFound(t('file.pasDansLaFile'));
      throw new AppError(409, t('fidelite.aucunCadeau'), { code: 'AUCUN_CADEAU' });
    }
    if (etatDeLaCarte(ligne, p.objectif).cadeaux < 1) throw new AppError(409, t('fidelite.aucunCadeau'), { code: 'AUCUN_CADEAU' });
    await tx.execute('UPDATE fidelite SET cadeaux = cadeaux + 1 WHERE telephone_idx = $1', [ligne.telephone_idx]);
    return etatDeLaCarte({ seances: ligne.seances, cadeaux: ligne.cadeaux + 1 }, p.objectif);
  });
}
