/**
 * Prevenir le personnel : un tour pris, un tour annule.
 *
 * A NE PAS CONFONDRE AVEC `notifications.js`, qui parle AU CLIENT par WhatsApp.
 * Ici on parle AU COIFFEUR, par notification poussee dans son navigateur. Deux
 * destinataires, deux transports, deux fichiers.
 *
 * LE CAS REEL. Le coiffeur est au fauteuil, les mains dans les cheveux d'un
 * client. Quelqu'un prend son tour depuis la rue. Sans ce fichier, il ne
 * l'apprend qu'en regardant l'ecran — donc en s'arretant. Avec, son telephone
 * vibre une fois dans sa poche et il regarde quand il peut.
 *
 * ET SURTOUT L'ANNULATION. Un client qui se desiste depuis son lien libere une
 * place que personne ne voit passer : le coiffeur appelle un nom, attend,
 * rappelle, et perd trois minutes devant un salon plein. C'est la notification
 * qui rapporte le plus.
 *
 * TROIS CHOIX QUI TIENNENT TOUT LE RESTE.
 *
 * 1. ON NE NOTIFIE JAMAIS SON PROPRE GESTE. Un tour pris AU COMPTOIR, c'est le
 *    coiffeur lui-meme qui vient de le saisir : lui faire vibrer le telephone
 *    pour le lui apprendre est le plus sur moyen qu'il coupe les notifications
 *    au bout de deux jours.
 *
 * 2. RIEN N'EST ATTENDU. L'envoi part APRES la validation de la transaction et
 *    personne ne l'attend. Un service de notification lent ne doit pas ralentir
 *    la prise de tour d'un client, et son echec ne doit rien annuler.
 *
 * 3. UN ABONNEMENT MORT EST EFFACE, pas reessaye. Les services repondent 404 ou
 *    410 quand l'application a ete desinstallee ou les notifications coupees.
 *    Garder la ligne, c'est reessayer a chaque tour pris, pour toujours.
 *
 * CE QUI PART DANS LE MESSAGE. Le numero du tour, le prenom, et combien de
 * personnes attendent. JAMAIS de numero de telephone, JAMAIS le jeton de suivi
 * — il est le mot de passe du client, et une notification s'affiche sur un
 * ecran verrouille, parfois sous les yeux d'un autre. Un test le verifie.
 */
import { all, execute, one } from '../db/index.js';
import { STATUTS_EN_ATTENTE } from './journee.js';
import { newId } from '../core/crypto.js';
import { log } from '../core/logger.js';
import { lireCles, envoyer } from '../core/webpush.js';
import { t, langueActive } from '../core/langue.js';
import { nomDuSalon } from '../core/reglages.js';
import { minutesDepuisMinuit, dateLongue } from '../core/temps.js';

const CLES = lireCles();

if (CLES.probleme) {
  log.warn('Notifications du personnel desactivees : ' + CLES.probleme);
}

/** Les notifications sont-elles configurees sur ce serveur ? */
export const notificationsActives = () => CLES.actif === true;

/**
 * La cle publique VAPID, que le navigateur doit connaitre pour s'abonner.
 * Elle est PUBLIQUE au sens propre : elle ne sert qu'a verifier nos jetons.
 */
export const clePubliqueVapid = () => (CLES.actif ? CLES.clePublique : null);

/* ------------------------------------------------------------------ */
/*  Les abonnements                                                    */
/* ------------------------------------------------------------------ */

/**
 * Enregistre — ou REPREND — l'abonnement d'un appareil.
 *
 * Le navigateur renouvelle son adresse d'abonnement quand il le decide, sans
 * prevenir personne. On remplace donc sur l'adresse : deux lignes pour le meme
 * appareil, c'est une notification en double aujourd'hui et une adresse morte
 * demain.
 */
export async function enregistrerAbonnement(utilisateurId, { endpoint, p256dh, auth, appareil = null }) {
  await execute(
    `INSERT INTO abonnements_push (id, utilisateur_id, endpoint, p256dh, auth, appareil)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (endpoint) DO UPDATE
        SET utilisateur_id = EXCLUDED.utilisateur_id,
            p256dh = EXCLUDED.p256dh,
            auth = EXCLUDED.auth,
            appareil = EXCLUDED.appareil,
            echecs = 0,
            derniere_erreur = NULL`,
    [newId(), utilisateurId, endpoint, p256dh, auth, appareil ? String(appareil).slice(0, 80) : null],
  );
}

export async function supprimerAbonnement(utilisateurId, endpoint) {
  return execute(
    'DELETE FROM abonnements_push WHERE utilisateur_id = $1 AND endpoint = $2',
    [utilisateurId, endpoint],
  );
}

export async function compterAbonnements(utilisateurId) {
  const ligne = await one(
    'SELECT count(*)::int AS n FROM abonnements_push WHERE utilisateur_id = $1',
    [utilisateurId],
  );
  return ligne ? ligne.n : 0;
}

/* ------------------------------------------------------------------ */
/*  L'envoi                                                            */
/* ------------------------------------------------------------------ */

/**
 * Envoie un message a une liste d'abonnements et fait le menage.
 *
 * Ne leve jamais. Les envois partent ensemble : un service lent n'a aucune
 * raison de retarder les autres.
 */
async function diffuser(abonnements, contenu) {
  if (!abonnements.length) return { envoyes: 0, effaces: 0 };
  // LA LANGUE VOYAGE AVEC LE MESSAGE. Le travailleur de service est un script
  // classique : il ne peut ni importer le dictionnaire, ni lire l'attribut
  // « lang » d'une page qu'il n'a pas. Tout le texte qu'il affiche vient d'ici,
  // deja traduit ; ce champ ne sert qu'a sa phrase de secours.
  const charge = JSON.stringify({ ...contenu, langue: langueActive() });

  const resultats = await Promise.all(abonnements.map(async (a) => {
    const resultat = await envoyer(
      { endpoint: a.endpoint, p256dh: a.p256dh, auth: a.auth },
      charge,
      { clePublique: CLES.clePublique, clePrivee: CLES.clePrivee, sujet: CLES.sujet },
    );
    return { abonnement: a, resultat };
  }));

  const disparus = resultats.filter((r) => r.resultat.disparu).map((r) => r.abonnement.id);
  if (disparus.length) {
    await execute('DELETE FROM abonnements_push WHERE id = ANY($1::uuid[])', [disparus]);
  }

  // Les autres echecs sont comptes, pas effaces : un service indisponible dix
  // minutes n'est pas un abonnement mort. Au-dela de dix echecs d'affilee, il
  // l'est probablement, et la ligne part au menage suivant.
  const rates = resultats.filter((r) => !r.resultat.ok && !r.resultat.disparu);
  for (const { abonnement, resultat } of rates) {
    await execute(
      `UPDATE abonnements_push SET echecs = echecs + 1, derniere_erreur = $2
        WHERE id = $1`,
      [abonnement.id, String(resultat.erreur || 'échec').slice(0, 200)],
    );
  }
  await execute('DELETE FROM abonnements_push WHERE echecs >= 10');

  const reussis = resultats.filter((r) => r.resultat.ok).map((r) => r.abonnement.id);
  if (reussis.length) {
    await execute(
      'UPDATE abonnements_push SET dernier_envoi_at = now(), echecs = 0, derniere_erreur = NULL WHERE id = ANY($1::uuid[])',
      [reussis],
    );
  }

  if (rates.length) {
    log.warn('Notifications du personnel en echec', {
      rates: rates.length, effaces: disparus.length,
      premier: rates[0].resultat.erreur,
    });
  }

  return { envoyes: reussis.length, effaces: disparus.length };
}

/**
 * Tous les abonnements du personnel ACTIF.
 *
 * Un compte desactive garde ses lignes — son proprietaire peut revenir — mais
 * il ne recoit plus rien. Le filtre est ici, pas a la suppression : reactiver
 * un compte ne doit pas obliger a re-autoriser les notifications sur chaque
 * appareil.
 */
async function abonnementsDuPersonnel({ sauf = null } = {}) {
  return all(
    `SELECT a.id, a.endpoint, a.p256dh, a.auth
       FROM abonnements_push a
       JOIN utilisateurs u ON u.id = a.utilisateur_id
      WHERE u.actif
        AND ($1::uuid IS NULL OR a.utilisateur_id <> $1)`,
    [sauf],
  );
}

/* ------------------------------------------------------------------ */
/*  Les deux evenements                                                */
/* ------------------------------------------------------------------ */

/**
 * Fabrique le contenu d'une notification.
 *
 * `tag` regroupe : deux tours pris coup sur coup remplacent la meme
 * notification au lieu d'en empiler deux. `renotifier` fait malgre tout vibrer
 * l'appareil la seconde fois — sans lui, le remplacement est silencieux et le
 * coiffeur rate le second.
 */
function messageTourPris(ticket, enAttente) {
  const qui = ticket.prenom ? ' — ' + ticket.prenom : '';
  return {
    titre: t('push.tourPris', { numero: ticket.numero_affiche, qui }),
    corps: enAttente === 1
      ? t('push.seulEnAttente')
      : t('push.enAttente', { n: enAttente }),
    tag: 'file',
    renotifier: true,
    url: '/gestion#file',
  };
}

function messageAnnulation(ticket, enAttente) {
  const qui = ticket.prenom ? ' — ' + ticket.prenom : '';
  return {
    titre: t('push.tourAnnule', { numero: ticket.numero_affiche, qui }),
    corps: enAttente === 0
      ? t('push.personneEnAttente')
      : t('push.resteEnAttente', { n: enAttente }),
    tag: 'file',
    renotifier: true,
    url: '/gestion#file',
  };
}

/**
 * Compte ce qui attend AU MOMENT DE L'ENVOI.
 *
 * On ne passe pas le compte calcule avant la transaction : entre les deux, un
 * autre client a pu entrer ou sortir, et une notification qui annonce un chiffre
 * faux est pire que pas de notification — le coiffeur cesse d'y croire.
 */
async function combienAttendent(jour) {
  const ligne = await one(
    `SELECT count(*)::int AS n FROM tickets
      WHERE jour = $1 AND statut = ANY($2)`,
    [jour, STATUTS_EN_ATTENTE],
  );
  return ligne ? ligne.n : 0;
}

/**
 * Le point d'entree unique. Ne leve jamais, n'est jamais attendu.
 *
 * @param {'PRIS'|'ANNULE'} evenement
 * @param {object} ticket
 * @param {{ sauf?: string|null }} [options]  le compte a NE PAS prevenir
 */
export async function prevenirLePersonnel(evenement, ticket, { sauf = null } = {}) {
  if (!notificationsActives()) return { envoyes: 0, effaces: 0 };
  try {
    const abonnements = await abonnementsDuPersonnel({ sauf });
    if (!abonnements.length) return { envoyes: 0, effaces: 0 };
    const enAttente = await combienAttendent(ticket.jour);
    const contenu = evenement === 'ANNULE'
      ? messageAnnulation(ticket, enAttente)
      : messageTourPris(ticket, enAttente);
    return await diffuser(abonnements, contenu);
  } catch (err) {
    // Une notification est un confort. Rien de ce qui se passe ici ne doit
    // remonter jusqu'au client qui vient de prendre son tour.
    log.warn('Notification du personnel abandonnee', { erreur: err.message });
    return { envoyes: 0, effaces: 0 };
  }
}

/**
 * UN RENDEZ-VOUS PRIS (ou annule) EN LIGNE : le salon le sait tout de suite.
 * Meme contrat que pour la file : un confort, jamais une erreur qui remonte.
 *
 * @param {'PRIS'|'ANNULE'} evenement
 */
export async function prevenirDuRendezVous(evenement, rdv, { sauf = null } = {}) {
  if (!notificationsActives()) return { envoyes: 0, effaces: 0 };
  try {
    const abonnements = await abonnementsDuPersonnel({ sauf });
    if (!abonnements.length) return { envoyes: 0, effaces: 0 };
    const m = minutesDepuisMinuit(new Date(rdv.debut));
    const quand = dateLongue(rdv.jour) + ', ' + String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
    return await diffuser(abonnements, {
      titre: t(evenement === 'ANNULE' ? 'push.rdvAnnule' : 'push.rdvPris', { prenom: rdv.prenom }),
      corps: quand,
      tag: 'rdv-' + rdv.id,
      renotifier: true,
      url: '/gestion#agenda',
    });
  } catch (err) {
    log.warn('Notification de rendez-vous abandonnee', { erreur: err.message });
    return { envoyes: 0, effaces: 0 };
  }
}

/**
 * L'essai, depuis l'espace de gestion. Il part au seul appareil qui le demande :
 * un essai qui fait sonner tout le salon n'est pas un essai.
 */
export async function envoyerUnEssai(utilisateurId, endpoint) {
  if (!notificationsActives()) return { envoyes: 0, effaces: 0 };
  const abonnements = await all(
    'SELECT id, endpoint, p256dh, auth FROM abonnements_push WHERE utilisateur_id = $1 AND endpoint = $2',
    [utilisateurId, endpoint],
  );
  return diffuser(abonnements, {
    titre: nomDuSalon(),
    corps: t('push.essai'),
    tag: 'prueba',
    renotifier: true,
    url: '/gestion#file',
  });
}

export const _messageTourPris = messageTourPris;
export const _messageAnnulation = messageAnnulation;
