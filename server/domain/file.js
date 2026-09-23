/**
 * LA FILE.
 *
 * Tout le metier de l'application tient ici. Une seule file par journee, un
 * seul ordre : celui des rangs. L'origine du client (en ligne, QR Code,
 * comptoir) est affichee au coiffeur mais n'entre JAMAIS dans le tri.
 *
 * Invariants, garantis par la base et re-dits ici avec un message clair :
 *
 *   - deux clients n'occupent jamais la meme position : le rang est unique par
 *     journee et n'est jamais reutilise ;
 *   - un seul client est appele ou en cours a la fois (le salon a un fauteuil) ;
 *   - un ticket d'une journee close ne bouge plus ;
 *   - un client remis en fin de file pour retard garde son numero et son
 *     historique, et recoit un rang neuf, superieur a tous les autres.
 *
 * Tout geste passe par une transaction. Deux appuis sur la tablette au meme
 * instant, ou le coiffeur et le gerant qui agissent ensemble, ne peuvent pas
 * laisser la file a moitie modifiee.
 */
import { transaction, all, one } from '../db/index.js';
import { newId, jetonSuivi, hashToken, encrypt, decrypt, blindIndexTous, blindIndex } from '../core/crypto.js';
import { jourLocal, attenteLisible, attenteCourte, jourSemaine, minutesDepuisMinuit } from '../core/temps.js';
import { conflict, notFound, badRequest, AppError } from '../core/errors.js';
import { lireTous, estOuvert } from '../core/reglages.js';
import { annoncerChangement } from '../core/flux.js';
import { log } from '../core/logger.js';
import {
  assurerJournee, verrouillerJournee, prochainNumeroEtRang, prochainRang, numeroAffiche,
  STATUTS_ACTIFS, STATUTS_EN_ATTENTE, STATUTS_EN_COURS,
} from './journee.js';
import { enfilerEnvoi } from './notifications.js';
import { fermetureDuJour, prochaine as prochaineFermeture, messageDeFermeture } from './fermetures.js';

const COLONNES = `id, jour, numero, numero_affiche, rang, prenom, nom, telephone_enc, telephone_fin,
                  source, statut, retards, jeton_enc, arrive_at, file_depuis_at, statut_at, appele_at,
                  service_at, termine_at, motif, version`;

/* ================================================================== */
/*  Calculs purs                                                       */
/* ================================================================== */

/**
 * Positions, personnes devant et estimations pour une journee.
 *
 * Fonction PURE : elle ne connait ni la base ni l'heure, ce qui la rend
 * testable ligne a ligne. C'est elle qui definit ce que voit le client.
 *
 * @param {Array<object>} tickets  tous les tickets du jour, tries par rang
 * @param {{ dureeMoyenneMinutes:number, seuilPrevenir:number }} reglages
 * @returns {Map<string, { position:number, devant:number, estimationMinutes:number, phase:string }>}
 */
export function calculerPositions(tickets, { dureeMoyenneMinutes, seuilPrevenir }) {
  const actifs = tickets.filter((t) => STATUTS_ACTIFS.includes(t.statut)).sort((a, b) => a.rang - b.rang);
  const sortie = new Map();

  actifs.forEach((ticket, index) => {
    // Personnes devant : tous les actifs de rang inferieur, y compris celui qui
    // est au fauteuil. C'est le compte qu'attend un client, pas une subtilite.
    const devant = index;
    const estimationMinutes = devant * dureeMoyenneMinutes;
    let phase;
    if (ticket.statut === 'IN_SERVICE') phase = 'EN_COURS';
    else if (ticket.statut === 'CALLED') phase = 'VOTRE_TOUR';
    else if (devant === 0) phase = 'PROCHAIN';
    else if (devant <= seuilPrevenir) phase = 'APPROCHE';
    else phase = 'ATTENTE';
    sortie.set(ticket.id, { position: index + 1, devant, estimationMinutes, phase });
  });

  for (const ticket of tickets) {
    if (sortie.has(ticket.id)) continue;
    sortie.set(ticket.id, {
      position: 0,
      devant: 0,
      estimationMinutes: 0,
      phase: ticket.statut === 'COMPLETED' ? 'TERMINE' : 'ANNULE',
    });
  }
  return sortie;
}

/** La phrase que lit le client, selon sa phase. */
export function messageDePhase(phase, { devant = 0, estimationMinutes = 0, nomSalon = 'le salon' } = {}) {
  switch (phase) {
    case 'VOTRE_TOUR':
      return { titre: 'C’est votre tour !', detail: 'Présentez-vous au fauteuil, ' + nomSalon + ' vous attend.', ton: 'tour' };
    case 'EN_COURS':
      return { titre: 'Vous êtes au fauteuil.', detail: 'Bonne coupe !', ton: 'tour' };
    case 'PROCHAIN':
      return { titre: 'Vous êtes le prochain.', detail: 'Restez à proximité du salon, votre tour arrive.', ton: 'proche' };
    case 'APPROCHE':
      return {
        titre: 'Votre tour approche !',
        detail: 'Il reste ' + devant + ' personne' + (devant > 1 ? 's' : '') + ' devant vous. Rapprochez-vous du salon.',
        ton: 'proche',
      };
    case 'TERMINE':
      return { titre: 'Vous avez été servi.', detail: 'Merci de votre visite, à bientôt.', ton: 'fini' };
    case 'ANNULE':
      return { titre: 'Ce tour a été annulé.', detail: 'Reprenez un tour quand vous le souhaitez.', ton: 'fini' };
    default:
      return {
        titre: 'Vous êtes dans la file.',
        detail: 'Environ ' + attenteLisible(estimationMinutes).replace(/^environ /, '') + ' d’attente. Restez à proximité, nous vous préviendrons.',
        ton: 'attente',
      };
  }
}

/* ================================================================== */
/*  La prise de tour est-elle ouverte ?                                */
/* ================================================================== */

/**
 * Trois raisons, et trois seulement, peuvent fermer l'entree dans la file.
 * Elles sont classees de la plus durable a la plus passagere, parce que c'est
 * dans cet ordre qu'un client veut l'apprendre :
 *
 *   1. CONGES     le salon est ferme plusieurs jours ; on dit quand il rouvre ;
 *   2. SUSPENDUE  le coiffeur a arrete les tours du moment (il finit sa
 *                 journee, il part une heure) ; la file en cours continue ;
 *   3. HORAIRES   hors des heures d'ouverture, si le controle est active.
 *
 * Aucune des trois ne touche a la file : ceux qui attendent sont servis.
 *
 * Une seule fonction, appelee par la page d'accueil, par le formulaire et par
 * la prise de tour elle-meme : les trois disent donc toujours la meme chose.
 *
 * @returns {Promise<{ouverte:boolean, code:string|null, message:string|null,
 *                    fermeture:object|null, prochaineFermeture:object|null,
 *                    ouvertureA:string|null}>}
 */
export async function etatPriseDeTour({ instant = new Date() } = {}) {
  const reglages = await lireTous();
  const jour = jourLocal(instant);

  const fermeture = await fermetureDuJour(jour);
  if (fermeture) {
    return {
      ouverte: false,
      code: 'SALON_EN_CONGES',
      message: messageDeFermeture(fermeture),
      fermeture,
      prochaineFermeture: null,
      ouvertureA: null,
    };
  }

  const aVenir = await prochaineFermeture(jour);

  if (!reglages['file.priseDeTourOuverte']) {
    return {
      ouverte: false,
      code: 'PRISE_DE_TOUR_SUSPENDUE',
      message: reglages['file.messagePause']
        || 'Le salon ne prend plus de nouveaux tours pour le moment. Présentez-vous directement au salon, ou revenez un peu plus tard.',
      fermeture: null,
      prochaineFermeture: aVenir,
      ouvertureA: null,
    };
  }

  const horaires = estOuvert(reglages, jourSemaine(instant), minutesDepuisMinuit(instant));
  if (!horaires.ouvert) {
    return {
      ouverte: false,
      code: 'SALON_FERME',
      message: horaires.ouverture
        ? 'Le salon est fermé pour le moment. Vous pourrez prendre votre tour à partir de ' + horaires.ouverture + '.'
        : 'Le salon est fermé aujourd’hui. Revenez le prochain jour d’ouverture.',
      fermeture: null,
      prochaineFermeture: aVenir,
      ouvertureA: horaires.ouverture,
    };
  }

  return { ouverte: true, code: null, message: null, fermeture: null, prochaineFermeture: aVenir, ouvertureA: null };
}

/* ================================================================== */
/*  Lecture de l'etat                                                  */
/* ================================================================== */

/**
 * L'etat complet d'une journee : une seule requete, tout ce dont le salon et
 * les clients ont besoin. C'est cet etat qui est diffuse en temps reel ; chaque
 * abonne n'en recoit ensuite que la projection a laquelle il a droit.
 *
 * @param {string} jour
 * @returns {Promise<object>}
 */
export async function chargerEtat(jour) {
  const reglages = await lireTous();
  const [journee, tickets, prise] = await Promise.all([
    one('SELECT * FROM journees WHERE jour = $1', [jour]),
    all('SELECT ' + COLONNES + ' FROM tickets WHERE jour = $1 ORDER BY rang', [jour]),
    // L'etat de la prise de tour voyage avec la file : la tablette du coiffeur
    // le recoit par le flux temps reel, sans requete supplementaire, et sait
    // donc toujours si l'entree est ouverte.
    etatPriseDeTour(),
  ]);

  const dureeMoyenneMinutes = journee?.duree_moyenne_minutes ?? reglages['file.dureeMoyenneMinutes'];
  const seuilPrevenir = reglages['file.seuilPrevenir'];
  const positions = calculerPositions(tickets, { dureeMoyenneMinutes, seuilPrevenir });

  const actifs = tickets.filter((t) => STATUTS_ACTIFS.includes(t.statut)).sort((a, b) => a.rang - b.rang);
  const enCours = actifs.find((t) => STATUTS_EN_COURS.includes(t.statut)) || null;
  const attente = actifs.filter((t) => STATUTS_EN_ATTENTE.includes(t.statut));

  return {
    jour,
    ouverte: journee ? journee.ouverte : true,
    dureeMoyenneMinutes,
    seuilPrevenir,
    nomSalon: reglages['salon.nom'],
    adresseSalon: reglages['salon.adresse'] || null,
    maj: new Date().toISOString(),
    priseDeTour: prise,
    tickets,
    positions,
    enCoursId: enCours ? enCours.id : null,
    prochainId: attente.length ? attente[0].id : null,
    compteurs: {
      total: tickets.length,
      enAttente: attente.length,
      enCours: enCours ? 1 : 0,
      servis: tickets.filter((t) => t.statut === 'COMPLETED').length,
      annules: tickets.filter((t) => t.statut === 'CANCELLED').length,
      retards: tickets.reduce((n, t) => n + (t.retards > 0 ? 1 : 0), 0),
      enLigne: tickets.filter((t) => t.source === 'ONLINE').length,
      parQr: tickets.filter((t) => t.source === 'QR').length,
      auComptoir: tickets.filter((t) => t.source === 'COMPTOIR').length,
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Projections                                                        */
/* ------------------------------------------------------------------ */

/**
 * Ce que voit LE SALON : la file entiere, numeros WhatsApp compris. Reserve aux
 * sessions du personnel - c'est l'appelant qui garantit l'authentification.
 */
export function pourSalon(etat) {
  const ticket = (t) => {
    const p = etat.positions.get(t.id);
    return {
      id: t.id,
      numero: t.numero_affiche,
      prenom: t.prenom,
      nom: t.nom,
      telephone: decrypt(t.telephone_enc),
      source: t.source,
      statut: t.statut,
      phase: p?.phase ?? 'ATTENTE',
      position: p?.position ?? 0,
      devant: p?.devant ?? 0,
      estimationMinutes: p?.estimationMinutes ?? 0,
      retards: t.retards,
      arriveA: t.arrive_at,
      dansLaFileDepuis: t.file_depuis_at,
      statutDepuis: t.statut_at,
      appeleA: t.appele_at,
      serviA: t.service_at,
      termineA: t.termine_at,
      motif: t.motif,
      version: t.version,
    };
  };

  const actifs = etat.tickets.filter((t) => STATUTS_ACTIFS.includes(t.statut)).sort((a, b) => a.rang - b.rang);
  const enCours = actifs.find((t) => STATUTS_EN_COURS.includes(t.statut)) || null;
  const attente = actifs.filter((t) => STATUTS_EN_ATTENTE.includes(t.statut));
  const termines = etat.tickets
    .filter((t) => !STATUTS_ACTIFS.includes(t.statut))
    .sort((a, b) => new Date(b.termine_at || b.statut_at) - new Date(a.termine_at || a.statut_at));

  return {
    jour: etat.jour,
    ouverte: etat.ouverte,
    priseDeTour: etat.priseDeTour,
    maj: etat.maj,
    dureeMoyenneMinutes: etat.dureeMoyenneMinutes,
    seuilPrevenir: etat.seuilPrevenir,
    enCours: enCours ? ticket(enCours) : null,
    prochain: attente.length ? ticket(attente[0]) : null,
    attente: attente.map(ticket),
    termines: termines.slice(0, 40).map(ticket),
    compteurs: etat.compteurs,
    attenteEstimeeMinutes: attente.length * etat.dureeMoyenneMinutes,
  };
}

/**
 * Ce que voit UN CLIENT : sa position, son statut, son estimation. Rien
 * d'autre. Ni le nom, ni le numero, ni meme l'existence des autres clients -
 * seulement combien de personnes le precedent.
 *
 * @returns {object|null} null si le ticket n'appartient pas a cette journee
 */
export function pourClient(etat, ticketId) {
  const t = etat.tickets.find((x) => x.id === ticketId);
  if (!t) return null;
  const p = etat.positions.get(t.id) || { position: 0, devant: 0, estimationMinutes: 0, phase: 'ATTENTE' };
  const message = messageDePhase(p.phase, { devant: p.devant, estimationMinutes: p.estimationMinutes, nomSalon: etat.nomSalon });
  return {
    numero: t.numero_affiche,
    prenom: t.prenom,
    statut: t.statut,
    phase: p.phase,
    position: p.position,
    devant: p.devant,
    estimationMinutes: p.estimationMinutes,
    estimationTexte: attenteLisible(p.estimationMinutes),
    // Forme courte pour la case « Estimation », dont le libelle dit deja tout.
    estimationCourte: attenteCourte(p.estimationMinutes),
    retards: t.retards,
    actif: STATUTS_ACTIFS.includes(t.statut),
    titre: message.titre,
    detail: message.detail,
    ton: message.ton,
    jour: etat.jour,
    nomSalon: etat.nomSalon,
    adresseSalon: etat.adresseSalon,
    maj: etat.maj,
  };
}

/* ------------------------------------------------------------------ */
/*  Recherche par jeton de suivi                                       */
/* ------------------------------------------------------------------ */

/**
 * Retrouve un ticket depuis son jeton de suivi.
 *
 * La base ne connait que le CONDENSAT du jeton : on ne peut donc pas remonter
 * d'un ticket vers son lien, et un vol de la base ne donne acces a aucune page
 * de suivi. La recherche se fait sur toutes les journees (un client peut ouvrir
 * hier son lien d'hier ; il verra « ce tour est terminé », pas une erreur).
 */
export async function ticketParJeton(jeton) {
  return one('SELECT ' + COLONNES + ' FROM tickets WHERE jeton_hash = $1', [hashToken(jeton)]);
}

/* ================================================================== */
/*  Gestes                                                             */
/* ================================================================== */

/**
 * Planifie les messages WhatsApp qui decoulent de l'etat courant de la file.
 *
 * Appele a la fin de CHAQUE geste, dans la meme transaction. L'unicite
 * (ticket, type, passage) rend l'operation idempotente : la rejouer vingt fois
 * n'envoie jamais deux fois le meme message.
 *
 * @param {object} tx
 * @param {string} jour
 * @param {{ seuilPrevenir:number }} reglages
 * @param {{ saufTicketId?: string|null }} [opts] ticket cree a l'instant : il
 *   vient de recevoir sa confirmation, inutile de la doubler d'un « ca approche ».
 */
async function planifierNotifications(tx, jour, reglages, { saufTicketId = null } = {}) {
  const tickets = await tx.all(
    `SELECT id, statut, retards, telephone_enc, jeton_enc, numero_affiche, prenom
       FROM tickets WHERE jour = $1 AND statut = ANY($2) ORDER BY rang`,
    [jour, STATUTS_ACTIFS],
  );

  // Une connexion PostgreSQL ne traite qu'une requete a la fois : les envois
  // s'enfilent l'un apres l'autre, jamais en parallele sur la meme transaction.
  for (const [index, t] of tickets.entries()) {
    const devant = index;
    if (t.id === saufTicketId) continue;
    if (STATUTS_EN_ATTENTE.includes(t.statut) && devant <= reglages['file.seuilPrevenir']) {
      await enfilerEnvoi(tx, { ticket: t, type: 'APPROCHE', donnees: { devant } });
    }
    if (t.statut === 'CALLED') {
      await enfilerEnvoi(tx, { ticket: t, type: 'TOUR', donnees: { devant: 0 } });
    }
  }
}

/** Journalise le changement d'etat d'un ticket. */
async function tracer(tx, ticket, { statut, rang, user = null, detail = null }) {
  await tx.execute(
    `INSERT INTO ticket_evenements (id, ticket_id, jour, statut, rang, par_utilisateur_id, par_libelle, detail)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [newId(), ticket.id, ticket.jour, statut, rang ?? ticket.rang,
      user?.id ?? null, user ? user.nomComplet || user.identifiant : 'client', detail],
  );
}

/**
 * PRENDRE SON TOUR.
 *
 * Le seul geste ouvert au public. En ligne ou depuis le QR Code du salon, c'est
 * exactement le meme chemin et la meme file : seule l'origine enregistree
 * change, et elle n'influe pas sur l'ordre.
 *
 * @param {{ prenom:string, nom:string, telephone:string, source:'ONLINE'|'QR'|'COMPTOIR' }} donnees
 * @param {{ user?:object|null }} [contexte]
 * @returns {Promise<{ ticket:object, jeton:string, position:object }>}
 */
export async function prendreTour({ prenom, nom, telephone, source = 'ONLINE' }, { user = null } = {}) {
  const reglages = await lireTous();
  const maintenant = new Date();
  const jour = jourLocal(maintenant);

  // Congés, arrêt manuel, horaires : trois raisons de refuser une entree dans
  // la file, avec chacune sa phrase. Le COMPTOIR y echappe : le coiffeur est
  // physiquement la, il a devant lui quelqu'un a servir, et c'est lui qui
  // decide — une regle qui contredit la personne presente est une regle qu'on
  // contourne avec un papier.
  if (source !== 'COMPTOIR') {
    const etat = await etatPriseDeTour({ instant: maintenant });
    if (!etat.ouverte) throw new AppError(409, etat.message, { code: etat.code });
  }

  const jeton = jetonSuivi();
  const idxRecherche = blindIndexTous(telephone);

  const resultat = await transaction(async (tx) => {
    const journee = await assurerJournee(tx, jour, reglages['file.dureeMoyenneMinutes']);

    // Le gerant a clos sa journee : le declencheur de la base refuserait de
    // toute facon l'insertion, mais avec un message qui parle de l'historique.
    // Ici on dit au client ce qui le concerne : le salon a fini.
    if (!journee.ouverte) {
      throw new AppError(409,
        'Le salon a clôturé sa journée. Revenez demain, ou présentez-vous directement au salon.',
        { code: 'JOURNEE_CLOSE' });
    }

    const total = await tx.value('SELECT COUNT(*)::int FROM tickets WHERE jour = $1', [jour]);
    if (total >= reglages['file.maxParJour']) {
      throw new AppError(409, 'La file du jour est complète. Présentez-vous au salon ou revenez demain.', { code: 'FILE_COMPLETE' });
    }

    // Un meme numero ne peut pas occuper deux places dans la file du jour.
    // On ne renvoie PAS son lien de suivi : quelqu'un qui devinerait un numero
    // de telephone pourrait sinon recuperer le ticket d'un autre.
    const dejaLa = await tx.one(
      `SELECT numero_affiche FROM tickets
        WHERE jour = $1 AND telephone_idx = ANY($2) AND statut = ANY($3) LIMIT 1`,
      [jour, idxRecherche, STATUTS_ACTIFS],
    );
    if (dejaLa) {
      throw new AppError(409,
        'Un tour est déjà en cours pour ce numéro (ticket ' + dejaLa.numero_affiche + '). '
        + 'Retrouvez-le depuis le lien reçu sur WhatsApp, ou demandez-le au salon.',
        { code: 'TOUR_DEJA_PRIS' });
    }

    const { numero, rang } = await prochainNumeroEtRang(tx, journee);
    const id = newId();
    const affiche = numeroAffiche(numero);

    const ticket = await tx.one(
      `INSERT INTO tickets (id, jour, numero, numero_affiche, rang, prenom, nom,
                            telephone_enc, telephone_idx, telephone_fin, source, statut, jeton_hash, jeton_enc)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'WAITING',$12,$13)
       RETURNING ` + COLONNES,
      [id, jour, numero, affiche, rang, prenom, nom,
        encrypt(telephone), blindIndex(telephone), telephone.slice(-4), source,
        hashToken(jeton), encrypt(jeton)],
    );

    await tracer(tx, ticket, { statut: 'WAITING', rang, user, detail: 'Tour pris (' + libelleSource(source) + ').' });
    await enfilerEnvoi(tx, { ticket, type: 'CONFIRMATION', donnees: { jeton } });
    await planifierNotifications(tx, jour, reglages, { saufTicketId: id });

    tx.apresValidation(() => annoncerChangement(jour));
    return ticket;
  });

  const etat = await chargerEtat(jour);
  log.info('Tour pris', { jour, numero: resultat.numero_affiche, source });
  return { ticket: resultat, jeton, position: pourClient(etat, resultat.id) };
}

const libelleSource = (source) => ({ ONLINE: 'en ligne', QR: 'QR Code du salon', COMPTOIR: 'comptoir' })[source] || source;

/**
 * Charge un ticket ACTIF du jour et verrouille sa ligne. Tout geste du coiffeur
 * commence par la : la ligne ne peut plus changer sous ses pieds jusqu'au COMMIT.
 */
async function verrouillerTicket(tx, ticketId, jour) {
  const ticket = await tx.one(
    'SELECT ' + COLONNES + ' FROM tickets WHERE id = $1 AND jour = $2 FOR UPDATE',
    [ticketId, jour],
  );
  if (!ticket) throw notFound('Ce ticket n’est pas dans la file d’aujourd’hui.');
  return ticket;
}

/**
 * Fabrique commune a tous les gestes du coiffeur.
 *
 * Elle pose le meme cadre partout : verrou sur la journee, verrou sur le
 * ticket, refus si la journee est close, planification des messages, diffusion
 * temps reel apres le COMMIT et seulement apres. Un geste n'a donc a decrire
 * que sa propre regle.
 */
function geste(nom, executer) {
  return async (ticketId, options = {}) => {
    const { user = null } = options;
    const reglages = await lireTous();
    const jour = jourLocal();
    const resultat = await transaction(async (tx) => {
      const journee = await verrouillerJournee(tx, jour);
      if (!journee) throw notFound('Aucune file ouverte aujourd’hui.');
      if (!journee.ouverte) throw conflict('La journée est close : la file du jour n’est plus modifiable.');
      const ticket = await verrouillerTicket(tx, ticketId, jour);
      const sortie = await executer({ tx, ticket, journee, user, reglages, jour, options });
      await planifierNotifications(tx, jour, reglages);
      tx.apresValidation(() => annoncerChangement(jour));
      return sortie;
    });
    log.info('Geste sur la file', { geste: nom, jour, ticket: resultat?.numero_affiche, par: user?.identifiant });
    return resultat;
  };
}

/**
 * APPELER un client : on l'annonce, il vient au fauteuil.
 *
 * Un seul client peut etre appele a la fois. Si un autre l'est deja, on le dit
 * au lieu de l'ecraser : c'est exactement le moment ou le coiffeur risque
 * d'oublier quelqu'un.
 */
export const appeler = geste('appeler', async ({ tx, ticket, user, jour }) => {
  if (STATUTS_EN_COURS.includes(ticket.statut)) {
    throw conflict('Le ticket ' + ticket.numero_affiche + ' est déjà appelé.');
  }
  if (!STATUTS_EN_ATTENTE.includes(ticket.statut)) {
    throw conflict('Le ticket ' + ticket.numero_affiche + ' n’est plus en attente (' + libelleStatut(ticket.statut) + ').');
  }
  const occupe = await tx.one(
    'SELECT numero_affiche, prenom FROM tickets WHERE jour = $1 AND statut = ANY($2) LIMIT 1',
    [jour, STATUTS_EN_COURS],
  );
  if (occupe) {
    throw new AppError(409,
      occupe.prenom + ' (' + occupe.numero_affiche + ') est déjà au fauteuil. '
      + 'Terminez ce client, ou marquez-le absent, avant d’appeler le suivant.',
      { code: 'FAUTEUIL_OCCUPE' });
  }
  const maj = await tx.one(
    `UPDATE tickets SET statut = 'CALLED', statut_at = now(), appele_at = now(), version = version + 1
      WHERE id = $1 RETURNING ` + COLONNES,
    [ticket.id],
  );
  await tracer(tx, maj, { statut: 'CALLED', user, detail: 'Client appelé.' });
  return maj;
});

/** COMMENCER la coupe. Geste facultatif : « servir » depuis CALLED suffit. */
export const commencerService = geste('service', async ({ tx, ticket, user }) => {
  if (ticket.statut === 'IN_SERVICE') return ticket;
  if (ticket.statut !== 'CALLED') {
    throw conflict('Le ticket ' + ticket.numero_affiche + ' doit d’abord être appelé.');
  }
  const maj = await tx.one(
    `UPDATE tickets SET statut = 'IN_SERVICE', statut_at = now(), service_at = now(), version = version + 1
      WHERE id = $1 RETURNING ` + COLONNES,
    [ticket.id],
  );
  await tracer(tx, maj, { statut: 'IN_SERVICE', user, detail: 'Coupe commencée.' });
  return maj;
});

/**
 * CLIENT SERVI. Le geste principal du coiffeur, celui du gros bouton.
 *
 * Il fonctionne depuis n'importe quel etat actif : appele, en cours, ou meme
 * encore en attente (le coiffeur a pris le client sans l'appeler formellement).
 * Une interface qui refuse un geste evident pendant le travail est une
 * interface qu'on contourne.
 */
export const terminer = geste('servi', async ({ tx, ticket, user }) => {
  if (ticket.statut === 'COMPLETED') return ticket;
  if (!STATUTS_ACTIFS.includes(ticket.statut)) {
    throw conflict('Le ticket ' + ticket.numero_affiche + ' est déjà ' + libelleStatut(ticket.statut).toLowerCase() + '.');
  }
  const maj = await tx.one(
    `UPDATE tickets SET statut = 'COMPLETED', statut_at = now(), termine_at = now(),
            service_at = COALESCE(service_at, now()), version = version + 1
      WHERE id = $1 RETURNING ` + COLONNES,
    [ticket.id],
  );
  await tracer(tx, maj, { statut: 'COMPLETED', user, detail: 'Client servi.' });
  return maj;
});

/**
 * CLIENT ABSENT / EN RETARD.
 *
 * Le client n'est PAS supprime : il est replace derriere tous ceux qui
 * attendent, avec un rang neuf. Son numero de ticket ne change pas - c'est
 * celui qu'il a sous les yeux sur son telephone. S'il est encore absent au tour
 * suivant, le meme geste le repousse encore, et son compteur de retards monte.
 *
 * L'heure d'entree dans la file (file_depuis_at) est remise a maintenant :
 * c'est elle qui sert a dire « dans la file depuis 10 minutes ». L'heure
 * d'arrivee initiale (arrive_at), elle, ne bouge jamais : c'est l'historique.
 */
export const marquerAbsent = geste('absent', async ({ tx, ticket, journee, user }) => {
  if (!STATUTS_ACTIFS.includes(ticket.statut)) {
    throw conflict('Le ticket ' + ticket.numero_affiche + ' n’est plus dans la file (' + libelleStatut(ticket.statut).toLowerCase() + ').');
  }
  const rang = await prochainRang(tx, journee);
  const maj = await tx.one(
    `UPDATE tickets SET statut = 'LATE', rang = $2, retards = retards + 1,
            statut_at = now(), file_depuis_at = now(), appele_at = NULL, version = version + 1
      WHERE id = $1 RETURNING ` + COLONNES,
    [ticket.id, rang],
  );
  await tracer(tx, maj, {
    statut: 'LATE',
    rang,
    user,
    detail: 'Absent à l’appel : replacé en fin de file (absence n° ' + maj.retards + ').',
  });
  return maj;
});

/** ANNULER un tour. Le seul geste qui sort definitivement un client de la file. */
export const annuler = geste('annuler', async ({ tx, ticket, user, options }) => {
  if (!STATUTS_ACTIFS.includes(ticket.statut)) {
    throw conflict('Le ticket ' + ticket.numero_affiche + ' n’est plus dans la file.');
  }
  const motif = String(options.motif || '').trim().slice(0, 300) || 'Tour annulé par le salon.';
  const maj = await tx.one(
    `UPDATE tickets SET statut = 'CANCELLED', statut_at = now(), termine_at = now(),
            motif = $2, version = version + 1
      WHERE id = $1 RETURNING ` + COLONNES,
    [ticket.id, motif],
  );
  await tracer(tx, maj, { statut: 'CANCELLED', user, detail: motif });
  // Un message qui partirait apres l'annulation ferait revenir le client pour rien.
  await tx.execute(
    `UPDATE envois_whatsapp SET statut = 'DESACTIVE', contenu_enc = NULL,
            derniere_erreur = 'Tour annulé avant l’envoi.'
      WHERE ticket_id = $1 AND statut = 'EN_ATTENTE'`,
    [ticket.id],
  );
  return maj;
});

/**
 * Annulation par le CLIENT lui-meme, depuis son lien de suivi.
 *
 * Une place liberee d'elle-meme fait avancer tout le monde : c'est le geste le
 * plus utile que puisse faire un client qui ne viendra pas.
 */
export async function annulerParClient(jeton) {
  const reglages = await lireTous();
  const ticket = await ticketParJeton(jeton);
  if (!ticket) throw notFound('Ce lien de suivi n’est plus valable.');
  if (!STATUTS_ACTIFS.includes(ticket.statut)) {
    throw conflict('Ce tour n’est plus dans la file.');
  }
  const jour = ticket.jour;

  const resultat = await transaction(async (tx) => {
    const journee = await verrouillerJournee(tx, jour);
    if (!journee || !journee.ouverte) throw conflict('La journée est close.');
    const verrouille = await verrouillerTicket(tx, ticket.id, jour);
    if (!STATUTS_ACTIFS.includes(verrouille.statut)) throw conflict('Ce tour n’est plus dans la file.');
    const maj = await tx.one(
      `UPDATE tickets SET statut = 'CANCELLED', statut_at = now(), termine_at = now(),
              motif = 'Annulé par le client depuis son lien de suivi.', version = version + 1
        WHERE id = $1 RETURNING ` + COLONNES,
      [verrouille.id],
    );
    await tracer(tx, maj, { statut: 'CANCELLED', detail: 'Annulé par le client.' });
    await tx.execute(
      `UPDATE envois_whatsapp SET statut = 'DESACTIVE', contenu_enc = NULL,
              derniere_erreur = 'Tour annulé par le client.'
        WHERE ticket_id = $1 AND statut = 'EN_ATTENTE'`,
      [verrouille.id],
    );
    await planifierNotifications(tx, jour, reglages);
    tx.apresValidation(() => annoncerChangement(jour));
    return maj;
  });
  return resultat;
}

/**
 * APPELER LE SUIVANT : le premier de la file, quel qu'il soit. Raccourci du
 * tableau de bord, pour n'avoir jamais a choisir dans une liste.
 */
export async function appelerSuivant({ user = null } = {}) {
  const jour = jourLocal();
  const suivant = await one(
    `SELECT id FROM tickets WHERE jour = $1 AND statut = ANY($2) ORDER BY rang LIMIT 1`,
    [jour, STATUTS_EN_ATTENTE],
  );
  if (!suivant) throw badRequest('Personne n’attend pour le moment.');
  return appeler(suivant.id, { user });
}

/** Ajout d'un client AU COMPTOIR, par le coiffeur (client sans telephone en main). */
export async function ajouterAuComptoir({ prenom, nom, telephone }, { user = null } = {}) {
  return prendreTour({ prenom, nom, telephone, source: 'COMPTOIR' }, { user });
}

export function libelleStatut(statut) {
  return ({
    WAITING: 'En attente',
    LATE: 'En attente (déjà absent)',
    CALLED: 'Appelé',
    IN_SERVICE: 'En cours',
    COMPLETED: 'Terminé',
    CANCELLED: 'Annulé',
  })[statut] || statut;
}

export { STATUTS_ACTIFS, STATUTS_EN_ATTENTE, STATUTS_EN_COURS };
