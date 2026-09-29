/**
 * Messages WhatsApp.
 *
 * Trois messages, pas un de plus :
 *
 *   CONFIRMATION  « Votre tour est enregistré »  (a la prise de tour)
 *   APPROCHE      « Votre tour approche »        (sous le seuil de personnes)
 *   TOUR          « C'est votre tour »           (a l'appel)
 *
 * GARANTIE DE REMISE. Un message n'est jamais envoye depuis une route : il est
 * ECRIT DANS LA TRANSACTION du geste metier, dans la boite d'envoi. Un ROLLBACK
 * n'annonce rien, un COMMIT n'oublie rien. Une tache de fond vide la boite.
 *
 * NON-DOUBLON. L'unicite (ticket, type, passage) est portee par la base. Un
 * client rappele apres une absence recoit bien un nouveau « c'est votre tour »,
 * mais jamais deux fois le meme.
 *
 * SANS API. Si WhatsApp Business n'est pas configure, rien ne part tout seul :
 * les messages sont enregistres comme desactives, et le coiffeur dispose dans
 * son tableau de bord d'un lien « wa.me » qui ouvre la conversation avec le
 * texte deja ecrit. Le salon est utilisable des le premier jour.
 *
 * CONFIDENTIALITE. Le contenu porte le lien de suivi EN CLAIR : il est donc
 * chiffre en base, jamais journalise, et efface des que le message est parti.
 */
import { newId, encrypt, decrypt, MARQUEUR_ILLISIBLE } from '../core/crypto.js';
import { config } from '../core/config.js';
import { log } from '../core/logger.js';
import { all, query } from '../db/index.js';
import { envoyerModele, ErreurWhatsapp, lienWaMe } from '../core/whatsapp.js';
import { lireTous } from '../core/reglages.js';
import { t } from '../core/langue.js';

/** Essais avant abandon (la ligne passe alors en ECHEC, visible a l'ecran). */
export const ESSAIS_MAX = 6;

/**
 * L'intitule d'un type de message, tel qu'il s'affiche dans l'espace de gestion.
 *
 * C'est une FONCTION : un objet constant aurait fige les trois libelles dans la
 * langue du demarrage. Les cles, elles, restent les codes stockes en base.
 */
export const CODES_TYPES = ['CONFIRMATION', 'APPROCHE', 'TOUR'];
export const libelleType = (code) => t('wa.type.' + code);

/* ------------------------------------------------------------------ */
/*  Textes                                                             */
/* ------------------------------------------------------------------ */

/**
 * Le texte d'un message, en clair.
 *
 * Il sert a deux choses : le lien « wa.me » du coiffeur (envoi a la main), et
 * l'apercu affiche dans l'espace de gestion. Les envois automatiques, eux,
 * passent par un MODELE approuve par Meta : le texte exact y est fige, seuls
 * les parametres voyagent. Les deux doivent dire la meme chose, c'est pourquoi
 * ils sont ecrits ici, cote a cote.
 */
export function texteMessage(type, { prenom, numero, devant = 0, lien = '', nomSalon = 'Peluquería HARON' }) {
  const suivi = lien ? t('wa.suivi', { lien }) : '';
  switch (type) {
    case 'CONFIRMATION':
      return t('wa.confirmation', { prenom, numero, devant, salon: nomSalon })
        + suivi + t('wa.confirmationFin');
    case 'APPROCHE':
      return t('wa.approche', { prenom, numero, devant, salon: nomSalon }) + suivi;
    case 'TOUR':
      return t('wa.tour', { prenom, numero, salon: nomSalon }) + suivi;
    default:
      return '';
  }
}

/** Les parametres du modele Meta correspondant, dans l'ordre. */
function parametresModele(type, { prenom, numero, devant, nomSalon }) {
  switch (type) {
    case 'CONFIRMATION': return [prenom, nomSalon, numero, String(devant)];
    case 'APPROCHE': return [prenom, nomSalon, numero, String(devant)];
    case 'TOUR': return [prenom, nomSalon, numero];
    default: return [];
  }
}

const modelePourType = (type) => ({
  CONFIRMATION: config.whatsapp.modeles.confirmation,
  APPROCHE: config.whatsapp.modeles.approche,
  TOUR: config.whatsapp.modeles.tour,
})[type];

/* ------------------------------------------------------------------ */
/*  Mise en file                                                       */
/* ------------------------------------------------------------------ */

/**
 * Enregistre un message a envoyer, DANS la transaction du geste metier.
 *
 * A ATTENDRE par l'appelant : une connexion PostgreSQL ne traite qu'une requete
 * a la fois, et lui en envoyer une seconde sans attendre la premiere est un
 * usage que node-postgres retirera. L'ecriture doit de toute facon aboutir
 * avant le COMMIT.
 *
 * Un echec d'ecriture abandonne la transaction entiere — c'est voulu : mieux
 * vaut une prise de tour refusee qu'une prise de tour muette.
 *
 * @param {object} tx
 * @param {{ ticket: object, type: 'CONFIRMATION'|'APPROCHE'|'TOUR', donnees?: object }} p
 *   ticket doit porter id, retards, telephone_enc, et jeton_enc ou un jeton en clair.
 */
export async function enfilerEnvoi(tx, { ticket, type, donnees = {} }) {
  if (!CODES_TYPES.includes(type)) throw new Error('Type de message inconnu : ' + type);
  const passage = (ticket.retards ?? 0) + 1;
  const statut = config.whatsapp.actif ? 'EN_ATTENTE' : 'DESACTIVE';

  const contenu = config.whatsapp.actif
    ? encrypt(JSON.stringify({
      devant: donnees.devant ?? 0,
      // Le jeton en clair vient soit de la prise de tour, soit de la colonne
      // chiffree du ticket. Il ne transite jamais autrement.
      jeton: donnees.jeton || (ticket.jeton_enc ? decrypt(ticket.jeton_enc) : null),
    }))
    : null;

  try {
    await tx.query(
      `INSERT INTO envois_whatsapp (id, ticket_id, type, passage, statut, destinataire_enc, contenu_enc,
                                    derniere_erreur, prochain_essai)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8, now())
       ON CONFLICT (ticket_id, type, passage) DO NOTHING`,
      [newId(), ticket.id, type, passage, statut, ticket.telephone_enc, contenu,
        config.whatsapp.actif ? null : t('wa.nonConfigure')],
    );
  } catch (err) {
    log.error('Boite d envoi WhatsApp : ecriture refusee, le geste metier est annule', { type, error: err?.message });
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  Vidage de la boite                                                 */
/* ------------------------------------------------------------------ */

/**
 * Envoie les messages en attente.
 *
 * Chaque ligne est reservee par un bail court (FOR UPDATE SKIP LOCKED puis
 * report du prochain essai) : deux instances, ou deux passages de la tache qui
 * se chevauchent, ne peuvent pas envoyer le meme message.
 *
 * @param {{ limite?: number, fetch?: typeof fetch, baseEssai?: string|null }} [opts]
 */
export async function traiterEnvois({ limite = 20, fetch: fetchFn = globalThis.fetch, baseEssai = null } = {}) {
  if (!config.whatsapp.actif) return { envoyes: 0, echecs: 0, ignores: 0 };

  const lignes = await all(
    `UPDATE envois_whatsapp SET prochain_essai = now() + interval '2 minutes'
      WHERE id IN (SELECT id FROM envois_whatsapp
                    WHERE statut = 'EN_ATTENTE' AND prochain_essai <= now()
                    ORDER BY prochain_essai LIMIT $1 FOR UPDATE SKIP LOCKED)
      RETURNING id, ticket_id, type, passage, destinataire_enc, contenu_enc, essais`,
    [limite],
  );
  if (!lignes.length) return { envoyes: 0, echecs: 0, ignores: 0 };

  const reglages = await lireTous();
  const bilan = { envoyes: 0, echecs: 0, ignores: 0 };

  for (const ligne of lignes) {
    const ticket = await all(
      'SELECT numero_affiche, prenom, statut FROM tickets WHERE id = $1',
      [ligne.ticket_id],
    ).then((r) => r[0] ?? null);
    if (!ticket) {
      bilan.ignores += 1;
      await marquer(ligne.id, 'DESACTIVE', { erreur: 'Ticket disparu avant l’envoi.' });
      continue;
    }

    const destinataire = decrypt(ligne.destinataire_enc);
    const brut = ligne.contenu_enc ? decrypt(ligne.contenu_enc) : '{}';
    if (destinataire === MARQUEUR_ILLISIBLE || brut === MARQUEUR_ILLISIBLE) {
      bilan.ignores += 1;
      await marquer(ligne.id, 'ECHEC', { erreur: 'Contenido ilegible (la clave de cifrado ha cambiado).' });
      continue;
    }
    let contenu = {};
    try {
      contenu = JSON.parse(brut);
    } catch {
      contenu = {};
    }

    try {
      const { id: messageId } = await envoyerModele({
        numeroId: config.whatsapp.numeroId,
        jeton: config.whatsapp.jeton,
        destinataire,
        modele: modelePourType(ligne.type),
        langue: config.whatsapp.langue,
        parametres: parametresModele(ligne.type, {
          prenom: ticket.prenom,
          numero: ticket.numero_affiche,
          devant: contenu.devant ?? 0,
          nomSalon: reglages['salon.nom'],
        }),
        // Meta n'accepte dans un bouton dynamique que la partie variable de
        // l'adresse : le debut (« .../ticket/ ») est fige dans le modele.
        lien: contenu.jeton || null,
        fetch: fetchFn,
        baseEssai,
      });
      await marquer(ligne.id, 'ENVOYE', { messageId });
      bilan.envoyes += 1;
    } catch (err) {
      const temporaire = err instanceof ErreurWhatsapp ? err.temporaire : true;
      const essais = ligne.essais + 1;
      const definitif = !temporaire || essais >= ESSAIS_MAX;
      await marquer(ligne.id, definitif ? 'ECHEC' : 'EN_ATTENTE', {
        erreur: String(err?.message || err).slice(0, 400),
        essais,
        reporter: !definitif,
      });
      bilan.echecs += 1;
      log.warn('Envoi WhatsApp en echec', { type: ligne.type, essais, definitif, error: err?.message });
    }
  }

  return bilan;
}

async function marquer(id, statut, { erreur = null, messageId = null, essais = null, reporter = false } = {}) {
  if (statut === 'ENVOYE') {
    await query(
      `UPDATE envois_whatsapp SET statut = 'ENVOYE', envoye_at = now(), contenu_enc = NULL,
              message_id = $2, essais = essais + 1, derniere_erreur = NULL
        WHERE id = $1`,
      [id, messageId],
    ).catch((e) => log.error('Marquage d envoi impossible', { error: e.message }));
    return;
  }
  await query(
    `UPDATE envois_whatsapp
        SET statut = $2,
            essais = COALESCE($4, essais),
            derniere_erreur = $3,
            contenu_enc = CASE WHEN $2 = 'EN_ATTENTE' THEN contenu_enc ELSE NULL END,
            prochain_essai = CASE WHEN $5 THEN now() + make_interval(secs => LEAST(COALESCE($4, essais), 6) * 60)
                                  ELSE prochain_essai END
      WHERE id = $1`,
    [id, statut, erreur, essais, reporter],
  ).catch((e) => log.error('Marquage d envoi impossible', { error: e.message }));
}

/* ------------------------------------------------------------------ */
/*  Liens « wa.me » (envoi a la main, sans API)                         */
/* ------------------------------------------------------------------ */

/**
 * Le lien qu'ouvre le coiffeur pour ecrire a un client depuis sa tablette.
 * Zero configuration : c'est la solution du premier jour, et le filet de
 * securite quand l'API refuse un envoi.
 *
 * @param {{ telephone:string, prenom:string, numero:string, devant?:number, lien?:string }} p
 */
export function lienWhatsappCoiffeur({ telephone, prenom, numero, devant = 0, lien = '', type = 'APPROCHE', nomSalon }) {
  return lienWaMe(telephone, texteMessage(type, { prenom, numero, devant, lien, nomSalon }));
}

/** Etat de la boite d'envoi, pour l'ecran d'administration. */
export async function etatBoite() {
  const rows = await all(
    `SELECT statut, COUNT(*)::int AS n, MIN(created_at) AS plus_ancien
       FROM envois_whatsapp
      WHERE statut <> 'ENVOYE' OR envoye_at > now() - interval '24 hours'
      GROUP BY statut`,
  );
  const par = Object.fromEntries(rows.map((r) => [r.statut, { n: r.n, plusAncien: r.plus_ancien }]));
  return {
    actif: config.whatsapp.actif,
    enAttente: par.EN_ATTENTE?.n || 0,
    plusAncienEnAttente: par.EN_ATTENTE?.plusAncien || null,
    enEchec: par.ECHEC?.n || 0,
    desactives: par.DESACTIVE?.n || 0,
    envoyes24h: par.ENVOYE?.n || 0,
  };
}
