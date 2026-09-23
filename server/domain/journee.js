/**
 * La journee du salon.
 *
 * L'application fonctionne par journee : la file active est celle d'AUJOURD'HUI,
 * lu dans le fuseau du salon. Les tickets de la veille ne sont jamais effaces -
 * ils deviennent l'historique, sur lequel s'appuient les statistiques - mais ils
 * ne peuvent plus apparaitre dans la file ni etre modifies.
 *
 * Deux mecanismes, volontairement redondants :
 *
 *   1. PARESSEUX. Tout geste qui touche la file commence par assurerJournee() :
 *      la ligne du jour est creee si elle manque, et toute journee anterieure
 *      restee ouverte est close au passage. Le salon peut donc etre coupe du
 *      reseau une semaine, la reprise est propre.
 *
 *   2. PROGRAMME. Une tache de fond (server/core/taches.js) clot la journee peu
 *      apres la fermeture, pour que les statistiques soient justes meme si
 *      personne ne rouvre l'application le lendemain.
 *
 * La ligne `journees` porte les compteurs (dernier numero, dernier rang). C'est
 * elle qu'on VERROUILLE pour attribuer un ticket : deux clients qui appuient sur
 * « Prendre mon tour » a la meme milliseconde sont ainsi serialises proprement,
 * sans verrouiller toute la table des tickets.
 */
import { newId } from '../core/crypto.js';
import { jourLocal } from '../core/temps.js';
import { log } from '../core/logger.js';

/** Statuts qui occupent une place dans la file. */
export const STATUTS_ACTIFS = ['WAITING', 'LATE', 'CALLED', 'IN_SERVICE'];
/** Statuts de ceux qui attendent encore leur appel. */
export const STATUTS_EN_ATTENTE = ['WAITING', 'LATE'];
/** Statuts du client du fauteuil. */
export const STATUTS_EN_COURS = ['CALLED', 'IN_SERVICE'];

/**
 * Cree la ligne du jour si elle manque, et clot toute journee anterieure restee
 * ouverte. A appeler au debut de toute transaction qui touche la file.
 *
 * @param {object} tx
 * @param {string} jour               « AAAA-MM-JJ »
 * @param {number} dureeMoyenneMinutes  fige pour cette journee
 * @returns {Promise<object>} la ligne de la journee, VERROUILLEE
 */
export async function assurerJournee(tx, jour, dureeMoyenneMinutes) {
  // Les journees anterieures d'abord : si l'application n'a pas tourne depuis
  // plusieurs jours, elles sont toutes closes en une fois.
  await cloturerJourneesAnterieures(tx, jour);

  await tx.execute(
    `INSERT INTO journees (jour, duree_moyenne_minutes) VALUES ($1, $2)
     ON CONFLICT (jour) DO NOTHING`,
    [jour, dureeMoyenneMinutes],
  );
  // Le verrou est pose APRES l'insertion : deux prises de tour simultanees sur
  // une journee neuve passent l'une derriere l'autre, sans doublon de numero.
  const ligne = await tx.one('SELECT * FROM journees WHERE jour = $1 FOR UPDATE', [jour]);
  if (!ligne) throw new Error('Journee introuvable juste apres sa creation : ' + jour);
  return ligne;
}

/** La ligne du jour, verrouillee, sans rien creer ni clore. */
export async function verrouillerJournee(tx, jour) {
  return tx.one('SELECT * FROM journees WHERE jour = $1 FOR UPDATE', [jour]);
}

/**
 * Clot une journee : les tickets restes actifs passent en CANCELLED avec un
 * motif lisible, puis la journee est marquee close.
 *
 * L'ORDRE COMPTE. Le declencheur de la base refuse toute modification d'un
 * ticket dont la journee est close : les tickets doivent donc etre mis a jour
 * AVANT que `ouverte` ne passe a faux, dans la meme transaction.
 *
 * @param {object} tx
 * @param {string} jour
 * @param {{ par?: string, motif?: string }} [opts]
 * @returns {Promise<{ jour:string, annules:number }|null>} null si deja close
 */
export async function cloturer(tx, jour, { par = 'clôture automatique', motif = 'Journée terminée : ce tour n’a pas été servi.' } = {}) {
  const ligne = await verrouillerJournee(tx, jour);
  if (!ligne || !ligne.ouverte) return null;

  const restants = await tx.all(
    `UPDATE tickets SET statut = 'CANCELLED', statut_at = now(), termine_at = now(),
            motif = $2, version = version + 1
      WHERE jour = $1 AND statut = ANY($3)
      RETURNING id, rang`,
    [jour, motif, STATUTS_ACTIFS],
  );
  for (const t of restants) {
    await tx.execute(
      `INSERT INTO ticket_evenements (id, ticket_id, jour, statut, rang, par_libelle, detail)
       VALUES ($1,$2,$3,'CANCELLED',$4,$5,$6)`,
      [newId(), t.id, jour, t.rang, par, motif],
    );
  }
  // Les messages WhatsApp encore en attente pour ces tickets n'ont plus lieu
  // d'etre : prevenir quelqu'un que son tour approche le lendemain matin serait
  // pire que de ne rien envoyer.
  await tx.execute(
    `UPDATE envois_whatsapp SET statut = 'DESACTIVE', contenu_enc = NULL,
            derniere_erreur = 'Journée close avant l’envoi.'
      WHERE statut = 'EN_ATTENTE'
        AND ticket_id IN (SELECT id FROM tickets WHERE jour = $1)`,
    [jour],
  );

  await tx.execute(
    'UPDATE journees SET ouverte = FALSE, close_at = now(), close_par = $2 WHERE jour = $1',
    [jour, String(par).slice(0, 80)],
  );
  return { jour, annules: restants.length };
}

/**
 * Clot toutes les journees ouvertes anterieures a `jour`.
 * @returns {Promise<Array<{jour:string, annules:number}>>}
 */
export async function cloturerJourneesAnterieures(tx, jour, { par = 'nouvelle journée' } = {}) {
  const ouvertes = await tx.all(
    'SELECT jour FROM journees WHERE ouverte AND jour < $1 ORDER BY jour',
    [jour],
  );
  const bilans = [];
  for (const ligne of ouvertes) {
    const bilan = await cloturer(tx, ligne.jour, { par });
    if (bilan) {
      bilans.push(bilan);
      log.info('Journee close', { jour: bilan.jour, ticketsAnnules: bilan.annules, par });
    }
  }
  return bilans;
}

/** La journee en cours, du point de vue du salon. */
export const journeeCourante = () => jourLocal();

/**
 * Le prochain numero et le prochain rang d'une journee verrouillee, et la mise
 * a jour des compteurs. Un rang n'est JAMAIS reutilise : c'est ce qui rend
 * l'index unique (jour, rang) tenable et interdit structurellement deux clients
 * a la meme position.
 *
 * @param {object} tx
 * @param {object} journee  ligne verrouillee
 * @returns {Promise<{ numero:number, rang:number }>}
 */
export async function prochainNumeroEtRang(tx, journee) {
  const numero = journee.dernier_numero + 1;
  const rang = journee.dernier_rang + 1;
  await tx.execute(
    'UPDATE journees SET dernier_numero = $2, dernier_rang = $3 WHERE jour = $1',
    [journee.jour, numero, rang],
  );
  return { numero, rang };
}

/**
 * Un rang neuf, sans consommer de numero : pour remettre un client en fin de
 * file apres une absence. Il garde son numero de ticket (« A024 » reste
 * « A024 » : c'est ce que le client a sous les yeux), mais passe derriere tout
 * le monde.
 */
export async function prochainRang(tx, journee) {
  const rang = journee.dernier_rang + 1;
  await tx.execute('UPDATE journees SET dernier_rang = $2 WHERE jour = $1', [journee.jour, rang]);
  return rang;
}

/** « A001 », « A024 », « A1042 » au-dela du millier. */
export function numeroAffiche(numero, prefixe = 'A') {
  return prefixe + String(numero).padStart(3, '0');
}
