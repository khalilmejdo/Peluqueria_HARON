/**
 * Effacer l'historique du salon, et lui seul.
 *
 * A QUOI CA SERT, ET A QUOI CA NE SERT PAS. Un salon qui a servi de terrain
 * d'essai pendant une semaine arrive au vrai premier jour avec cinquante faux
 * tours, des noms inventes et des chiffres qui ne veulent rien dire. On veut
 * repartir propre, sans refaire la fiche de prix, les fauteuils, les horaires
 * ni les comptes du personnel.
 *
 * CE QUI PART, ET CE QUI RESTE. La liste est ecrite ici, en toutes lettres, et
 * elle est aussi montree a l'ecran AVANT de confirmer. Une suppression dont on
 * ne sait pas exactement ce qu'elle emporte ne se fait jamais sereinement.
 *
 *   PART    les tours, leur historique, la boite d'envoi WhatsApp,
 *           les journees, les conges declares
 *   RESTE   les comptes du personnel, les reglages, les fauteuils,
 *           la fiche de prix, les abonnements aux avis
 *
 * C'EST IRREVERSIBLE, et il n'y a pas de corbeille. Trois choses s'y opposent :
 * le role de gerant, une phrase a recopier, et le refus categorique de purger
 * tant qu'un client attend. La derniere est la plus importante : un tour efface
 * pendant que son client regarde son lien de suivi lui laisse une page morte, et
 * personne dans le salon ne saura qu'il attend.
 *
 * TOUT EN UNE TRANSACTION. Une purge a moitie faite laisserait des evenements
 * orphelins et des journees sans tours — un etat que rien ailleurs ne sait
 * lire, et qui ne se repare qu'a la main.
 */
import { transaction } from '../db/index.js';
import { log } from '../core/logger.js';
import { conflict } from '../core/errors.js';
import { STATUTS_ACTIFS } from './journee.js';
import { t } from '../core/langue.js';

/**
 * Les tables videes, dans l'ordre. L'ordre compte : les enfants avant les
 * parents, faute de quoi une cle etrangere refuse la suppression.
 *
 * `ticket_evenements` et `envois_whatsapp` referencent les tickets en
 * ON DELETE CASCADE, donc les effacer explicitement n'est pas obligatoire — on
 * le fait quand meme pour que le compte rendu dise combien de lignes sont
 * parties de chaque table. Un chiffre qu'on peut lire vaut mieux qu'une
 * cascade silencieuse.
 */
const TABLES = ['ticket_evenements', 'ticket_tarifas', 'envois_whatsapp', 'tickets', 'journees', 'fermetures'];

/** Ce que la purge ne touche pas. Sert a l'ecran de confirmation. */
export const PRESERVE = ['utilisateurs', 'reglages', 'postes', 'tarifas', 'abonnements_push', 'photos'];

/**
 * Vide l'historique.
 *
 * @param {{ user?: object|null }} [options]
 * @returns {Promise<Record<string, number>>} le compte par table
 */
export async function purgerHistorique({ user = null } = {}) {
  return transaction(async (tx) => {
    // Le garde-fou qui compte. On le pose DANS la transaction : le verifier
    // avant l'ouvrirait une fenetre pendant laquelle un client peut entrer.
    const actifs = await tx.one(
      'SELECT count(*)::int AS n FROM tickets WHERE statut = ANY($1)',
      [STATUTS_ACTIFS],
    );
    if (actifs && actifs.n > 0) {
      throw conflict(t('purge.fileNonVide', { n: actifs.n }), { code: 'FILE_NON_VIDE' });
    }

    const bilan = {};
    for (const table of TABLES) {
      bilan[table] = await tx.execute('DELETE FROM ' + table);
    }

    log.warn('Historique du salon efface', { par: user?.identifiant ?? 'inconnu', bilan });
    return bilan;
  });
}
