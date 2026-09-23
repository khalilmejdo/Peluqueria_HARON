/**
 * Statistiques du salon.
 *
 * Volontairement courtes : de quoi savoir comment s'est passee la journee, et
 * comparer avec les precedentes. Rien de plus. Tout se calcule a la volee
 * depuis la table des tickets - un salon fait quelques dizaines de coupes par
 * jour, il n'y a aucune raison d'entretenir des compteurs qui pourraient
 * diverger de la realite.
 *
 * Deux durees, a ne pas confondre :
 *   - ATTENTE : de l'arrivee dans la file au debut de la coupe. C'est ce que
 *     vit le client, absences comprises (c'est bien lui qui est reparti).
 *   - SERVICE : du debut a la fin de la coupe. C'est ce qui nourrit le reglage
 *     « duree moyenne d'une coupe ».
 */
import { all, one } from '../db/index.js';
import { jourLocal } from '../core/temps.js';
import { STATUTS_ACTIFS } from './journee.js';

/**
 * Moyenne d'une duree, en minutes entieres.
 *
 * La clause FILTER appartient a l'AGREGAT, pas a l'expression qui l'entoure :
 * elle se place donc entre AVG(...) et le ROUND, jamais apres le cast. Ecrite
 * dans le mauvais ordre, PostgreSQL refuse la requete entiere — et ce sont les
 * statistiques du jour qui tombent en erreur.
 */
const MOYENNE_MINUTES = (intervalle, filtre) => 'ROUND(AVG(EXTRACT(EPOCH FROM ('
  + intervalle + ')) / 60) FILTER (WHERE ' + filtre + '))::int';

/**
 * Le bilan d'une journee.
 * @param {string} [jour] « AAAA-MM-JJ », aujourd'hui par defaut
 */
export async function duJour(jour = jourLocal()) {
  // PostgreSQL met en minuscules tout alias non entoure de guillemets : les
  // alias sont donc en minuscules avec soulignes, et la conversion vers les
  // noms de l'API se fait ici, une fois, explicitement.
  const ligne = await one(
    `SELECT
        COUNT(*)::int                                       AS total,
        COUNT(*) FILTER (WHERE statut = 'COMPLETED')::int   AS servis,
        COUNT(*) FILTER (WHERE statut = 'CANCELLED')::int   AS annules,
        COUNT(*) FILTER (WHERE statut = ANY($2))::int       AS actifs,
        COUNT(*) FILTER (WHERE retards > 0)::int            AS en_retard,
        COALESCE(SUM(retards), 0)::int                      AS absences,
        COUNT(*) FILTER (WHERE source = 'ONLINE')::int      AS en_ligne,
        COUNT(*) FILTER (WHERE source = 'QR')::int          AS par_qr,
        COUNT(*) FILTER (WHERE source = 'COMPTOIR')::int    AS au_comptoir,
        ` + MOYENNE_MINUTES('service_at - arrive_at', 'service_at IS NOT NULL') + ` AS attente_moyenne,
        ` + MOYENNE_MINUTES('termine_at - service_at', "statut = 'COMPLETED' AND service_at IS NOT NULL") + ` AS service_moyen,
        MIN(arrive_at)                                      AS premier_arrive,
        MAX(termine_at)                                     AS dernier_servi
      FROM tickets WHERE jour = $1`,
    [jour, STATUTS_ACTIFS],
  );
  const journee = await one('SELECT jour, ouverte, duree_moyenne_minutes, ouverte_at, close_at FROM journees WHERE jour = $1', [jour]);

  return {
    jour,
    ouverte: journee ? journee.ouverte : null,
    dureeMoyenneReglee: journee ? journee.duree_moyenne_minutes : null,
    total: ligne?.total ?? 0,
    servis: ligne?.servis ?? 0,
    annules: ligne?.annules ?? 0,
    actifs: ligne?.actifs ?? 0,
    clientsEnRetard: ligne?.en_retard ?? 0,
    absencesTotales: ligne?.absences ?? 0,
    enLigne: ligne?.en_ligne ?? 0,
    parQr: ligne?.par_qr ?? 0,
    auComptoir: ligne?.au_comptoir ?? 0,
    attenteMoyenneMinutes: ligne?.attente_moyenne ?? null,
    serviceMoyenMinutes: ligne?.service_moyen ?? null,
    premierArrive: ligne?.premier_arrive ?? null,
    dernierServi: ligne?.dernier_servi ?? null,
  };
}

/**
 * L'historique jour par jour, du plus recent au plus ancien.
 * @param {{ du?: string, au?: string, limite?: number }} [p]
 */
export async function historique({ du = null, au = null, limite = 60 } = {}) {
  const bornes = [];
  const params = [];
  if (du) {
    params.push(du);
    bornes.push('t.jour >= $' + params.length);
  }
  if (au) {
    params.push(au);
    bornes.push('t.jour <= $' + params.length);
  }
  params.push(Math.min(Math.max(1, limite), 366));

  const lignes = await all(
    `SELECT t.jour,
            COUNT(*)::int                                     AS total,
            COUNT(*) FILTER (WHERE t.statut = 'COMPLETED')::int AS servis,
            COUNT(*) FILTER (WHERE t.statut = 'CANCELLED')::int AS annules,
            COUNT(*) FILTER (WHERE t.retards > 0)::int          AS en_retard,
            COUNT(*) FILTER (WHERE t.source = 'ONLINE')::int    AS en_ligne,
            COUNT(*) FILTER (WHERE t.source = 'QR')::int        AS par_qr,
            COUNT(*) FILTER (WHERE t.source = 'COMPTOIR')::int  AS au_comptoir,
            ` + MOYENNE_MINUTES('t.service_at - t.arrive_at', 't.service_at IS NOT NULL') + ` AS attente_moyenne,
            ` + MOYENNE_MINUTES('t.termine_at - t.service_at', "t.statut = 'COMPLETED' AND t.service_at IS NOT NULL") + ` AS service_moyen
       FROM tickets t
       ` + (bornes.length ? 'WHERE ' + bornes.join(' AND ') : '') + `
      GROUP BY t.jour
      ORDER BY t.jour DESC
      LIMIT $` + params.length,
    params,
  );

  return lignes.map((l) => ({
    jour: l.jour,
    total: l.total,
    servis: l.servis,
    annules: l.annules,
    clientsEnRetard: l.en_retard,
    enLigne: l.en_ligne,
    parQr: l.par_qr,
    auComptoir: l.au_comptoir,
    attenteMoyenneMinutes: l.attente_moyenne,
    serviceMoyenMinutes: l.service_moyen,
  }));
}

/**
 * Le detail d'un ticket et son historique complet, pour repondre a un client
 * qui demande « pourquoi ai-je attendu si longtemps ».
 */
export async function detailTicket(ticketId) {
  const ticket = await one(
    `SELECT id, jour, numero_affiche, prenom, nom, telephone_fin, source, statut, retards,
            arrive_at, file_depuis_at, appele_at, service_at, termine_at, motif
       FROM tickets WHERE id = $1`,
    [ticketId],
  );
  if (!ticket) return null;
  const evenements = await all(
    `SELECT statut, rang, par_libelle, detail, at
       FROM ticket_evenements WHERE ticket_id = $1 ORDER BY at, id`,
    [ticketId],
  );
  return { ticket, evenements };
}
