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
import { conflict, notFound, badRequest, AppError, ValidationError } from '../core/errors.js';
import { lireTous, estOuvert } from '../core/reglages.js';
import { annoncerChangement } from '../core/flux.js';
import { log } from '../core/logger.js';
import {
  assurerJournee, verrouillerJournee, prochainNumeroEtRang, prochainRang, numeroAffiche,
  STATUTS_ACTIFS, STATUTS_EN_ATTENTE, STATUTS_EN_COURS,
} from './journee.js';
import { enfilerEnvoi } from './notifications.js';
import { fermetureDuJour, prochaine as prochaineFermeture, messageDeFermeture } from './fermetures.js';
import {
  lister as listerPostes, posteLibre, parId as posteParId, versClient as posteVersClient,
} from './postes.js';

/**
 * Les deux organisations possibles de la file.
 *
 *   UNIQUE       une seule file pour tout le salon. Le client prend un tour, le
 *                premier coiffeur libre le sert. C'est le mode par defaut, et
 *                celui qui fait avancer le salon le plus vite.
 *   PAR_FAUTEUIL une file par coiffeur. Le client CHOISIT son coiffeur et
 *                attend dans sa file, meme si le voisin est libre. Plus lent
 *                pour le salon, mais c'est parfois ce que veut la clientele.
 */
export const MODE_UNIQUE = 'UNIQUE';
export const MODE_PAR_FAUTEUIL = 'PAR_FAUTEUIL';

const COLONNES = `id, jour, numero, numero_affiche, rang, prenom, nom, telephone_enc, telephone_fin,
                  source, statut, retards, poste_choisi_id, poste_id, jeton_enc, arrive_at, file_depuis_at, statut_at,
                  appele_at, service_at, termine_at, motif, version`;

/* ================================================================== */
/*  Calculs purs                                                       */
/* ================================================================== */

/**
 * Positions, personnes devant et estimations pour une journee.
 *
 * Fonction PURE : elle ne connait ni la base ni l'heure, ce qui la rend
 * testable ligne a ligne. C'est elle qui definit ce que voit le client.
 *
 * LE NOMBRE DE FAUTEUILS DIVISE L'ATTENTE. Avec N fauteuils ouverts et des
 * coupes de duree d, les N premiers de la file commencent tout de suite, les N
 * suivants a d, et ainsi de suite : celui qui a `devant` personnes devant lui
 * attend `floor(devant / N)` coupes. C'est exactement ce qu'observe un client
 * dans un salon a deux fauteuils — la file avance deux fois plus vite.
 *
 * On appelle « tour » cette unite : zero tour = je passe dans la foulee, un
 * tour = il y a une fournee avant moi. Le seuil de prevenance compte en tours,
 * pas en personnes, sans quoi « prévenir à 2 personnes » n'aurait pas le meme
 * sens selon le nombre de fauteuils.
 *
 * @param {Array<object>} tickets  tous les tickets du jour, tries par rang
 * @param {{ dureeMoyenneMinutes:number, seuilPrevenir:number, postesActifs?:number }} reglages
 * @returns {Map<string, { position:number, devant:number, tours:number,
 *                         estimationMinutes:number, phase:string }>}
 */
export function calculerPositions(tickets, {
  dureeMoyenneMinutes, seuilPrevenir, postesActifs = 1, mode = MODE_UNIQUE,
}) {
  const fauteuils = Math.max(1, Math.trunc(postesActifs) || 1);
  const parFauteuil = mode === MODE_PAR_FAUTEUIL;

  // Le COULOIR : l'ensemble de ceux qui se disputent la meme place.
  //
  //   file unique      -> un seul couloir, servi par tous les fauteuils ;
  //   file par coiffeur -> un couloir par fauteuil, servi par lui seul.
  //
  // Une seule formule couvre donc les deux modes, et il n'existe pas de
  // seconde regle de calcul quelque part ailleurs qui pourrait diverger.
  const couloirDe = (t) => (parFauteuil ? String(t.poste_choisi_id ?? 'sans-coiffeur') : '');
  const serveurs = parFauteuil ? 1 : fauteuils;

  const actifs = tickets.filter((t) => STATUTS_ACTIFS.includes(t.statut)).sort((a, b) => a.rang - b.rang);
  const sortie = new Map();
  const rangsDuCouloir = new Map();

  for (const ticket of actifs) {
    const couloir = couloirDe(ticket);
    const devant = rangsDuCouloir.get(couloir) ?? 0;
    rangsDuCouloir.set(couloir, devant + 1);

    // Personnes devant : tous les actifs de SON couloir situes avant lui, y
    // compris celui qui est deja au fauteuil. C'est le compte qu'attend un
    // client, pas une subtilite — et c'est ce chiffre-la qui part dans le
    // message WhatsApp.
    const tours = Math.floor(devant / serveurs);
    const estimationMinutes = tours * dureeMoyenneMinutes;
    let phase;
    if (ticket.statut === 'IN_SERVICE') phase = 'EN_COURS';
    else if (ticket.statut === 'CALLED') phase = 'VOTRE_TOUR';
    else if (tours === 0) phase = 'PROCHAIN';
    else if (tours <= seuilPrevenir) phase = 'APPROCHE';
    else phase = 'ATTENTE';

    sortie.set(ticket.id, { position: devant + 1, devant, tours, estimationMinutes, phase, couloir });
  }

  for (const ticket of tickets) {
    if (sortie.has(ticket.id)) continue;
    sortie.set(ticket.id, {
      position: 0,
      devant: 0,
      tours: 0,
      estimationMinutes: 0,
      phase: ticket.statut === 'COMPLETED' ? 'TERMINE' : 'ANNULE',
      couloir: couloirDe(ticket),
    });
  }
  return sortie;
}

/** La phrase que lit le client, selon sa phase. */
export function messageDePhase(phase, { devant = 0, estimationMinutes = 0, nomSalon = 'el salón' } = {}) {
  switch (phase) {
    case 'VOTRE_TOUR':
      return { titre: '¡Es tu turno!', detail: 'Pasa al sillón, ' + nomSalon + ' te espera.', ton: 'tour' };
    case 'EN_COURS':
      return { titre: 'Estás en el sillón.', detail: '¡Que te quede bien!', ton: 'tour' };
    case 'PROCHAIN':
      return { titre: 'Eres el siguiente.', detail: 'Quédate cerca del salón, tu turno está a punto de llegar.', ton: 'proche' };
    case 'APPROCHE':
      return {
        titre: '¡Tu turno se acerca!',
        detail: 'Te queda' + (devant > 1 ? 'n' : '') + ' ' + devant + ' persona' + (devant > 1 ? 's' : '') + ' delante. Acércate al salón.',
        ton: 'proche',
      };
    case 'TERMINE':
      return { titre: 'Ya te han atendido.', detail: 'Gracias por tu visita, ¡hasta pronto!', ton: 'fini' };
    case 'ANNULE':
      return { titre: 'Este turno se ha anulado.', detail: 'Pide otro turno cuando quieras.', ton: 'fini' };
    default:
      return {
        titre: 'Estás en la fila.',
        detail: 'Unos ' + attenteLisible(estimationMinutes).replace(/^unos /, '').replace(/^alrededor de /, '') + ' de espera. Quédate cerca, te avisaremos.',
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
        || 'El salón no da más turnos por ahora. Ven directamente al salón, o vuelve un poco más tarde.',
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
        ? 'El salón está cerrado ahora mismo. Podrás pedir tu turno a partir de las ' + horaires.ouverture + '.'
        : 'El salón está cerrado hoy. Vuelve el próximo día de apertura.',
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
  const [journee, tickets, prise, postes] = await Promise.all([
    one('SELECT * FROM journees WHERE jour = $1', [jour]),
    all('SELECT ' + COLONNES + ' FROM tickets WHERE jour = $1 ORDER BY rang', [jour]),
    // L'etat de la prise de tour voyage avec la file : la tablette du coiffeur
    // le recoit par le flux temps reel, sans requete supplementaire, et sait
    // donc toujours si l'entree est ouverte.
    etatPriseDeTour(),
    listerPostes(),
  ]);

  const postesActifs = postes.filter((p) => p.actif);
  const dureeMoyenneMinutes = journee?.duree_moyenne_minutes ?? reglages['file.dureeMoyenneMinutes'];
  const seuilPrevenir = reglages['file.seuilPrevenir'];
  const mode = reglages['file.mode'];
  const positions = calculerPositions(tickets, {
    dureeMoyenneMinutes,
    seuilPrevenir,
    postesActifs: postesActifs.length,
    mode,
  });

  const actifs = tickets.filter((t) => STATUTS_ACTIFS.includes(t.statut)).sort((a, b) => a.rang - b.rang);
  const auxFauteuils = actifs.filter((t) => STATUTS_EN_COURS.includes(t.statut));
  const attente = actifs.filter((t) => STATUTS_EN_ATTENTE.includes(t.statut));

  return {
    jour,
    ouverte: journee ? journee.ouverte : true,
    mode,
    dureeMoyenneMinutes,
    seuilPrevenir,
    nomSalon: reglages['salon.nom'],
    adresseSalon: reglages['salon.adresse'] || null,
    maj: new Date().toISOString(),
    priseDeTour: prise,
    postes,
    postesActifs,
    tickets,
    positions,
    prochainId: attente.length ? attente[0].id : null,
    compteurs: {
      total: tickets.length,
      enAttente: attente.length,
      enCours: auxFauteuils.length,
      fauteuils: postesActifs.length,
      fauteuilsLibres: postesActifs.length - auxFauteuils.length,
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
      posteId: t.poste_id,
      posteChoisiId: t.poste_choisi_id,
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
  const attente = actifs.filter((t) => STATUTS_EN_ATTENTE.includes(t.statut));
  const termines = etat.tickets
    .filter((t) => !STATUTS_ACTIFS.includes(t.statut))
    .sort((a, b) => new Date(b.termine_at || b.statut_at) - new Date(a.termine_at || a.statut_at));

  // Un fauteuil, une carte : le coiffeur voit d'un coup d'oeil qui est assis
  // ou, et lequel est libre. Les fauteuils fermes qui portent encore un client
  // (cas impossible par construction, mais on ne cache jamais un client) sont
  // rendus eux aussi.
  const parFauteuil = etat.mode === MODE_PAR_FAUTEUIL;

  const cartes = etat.postes
    .filter((p) => p.actif || actifs.some((t) => t.poste_id === p.id || t.poste_choisi_id === p.id))
    .map((p) => {
      const assis = actifs.find((t) => t.poste_id === p.id && STATUTS_EN_COURS.includes(t.statut)) || null;
      // En file par coiffeur, chaque fauteuil porte SA file : c'est elle que
      // le coiffeur regarde, et le total du salon ne lui dit plus rien.
      const sienne = parFauteuil ? attente.filter((t) => t.poste_choisi_id === p.id) : [];
      return {
        ...posteVersClient(p),
        client: assis ? ticket(assis) : null,
        attente: sienne.map(ticket),
        prochain: sienne.length ? ticket(sienne[0]) : null,
        attenteEstimeeMinutes: parFauteuil ? sienne.length * etat.dureeMoyenneMinutes : null,
      };
    });

  const fauteuils = Math.max(1, etat.postesActifs.length);

  return {
    jour: etat.jour,
    ouverte: etat.ouverte,
    mode: etat.mode,
    priseDeTour: etat.priseDeTour,
    maj: etat.maj,
    dureeMoyenneMinutes: etat.dureeMoyenneMinutes,
    seuilPrevenir: etat.seuilPrevenir,
    postes: cartes,
    prochain: attente.length ? ticket(attente[0]) : null,
    // La file entiere reste rendue dans les deux modes : en file par coiffeur,
    // elle sert au bandeau « toute la file » et aux clients sans fauteuil.
    attente: attente.map(ticket),
    // Ceux qui n'ont pas de fauteuil alors que le mode en exige un : cas de
    // bascule de mode en cours de journee. On ne les cache jamais.
    sansFauteuil: parFauteuil ? attente.filter((t) => !t.poste_choisi_id).map(ticket) : [],
    termines: termines.slice(0, 40).map(ticket),
    compteurs: etat.compteurs,
    // L'attente annoncee au comptoir : la file entiere repartie sur les
    // fauteuils ouverts. En file par coiffeur, c'est la plus longue des files
    // qui commande — un client qui arrive attend au pire celle-la.
    attenteEstimeeMinutes: parFauteuil
      ? Math.max(0, ...cartes.filter((c) => c.actif).map((c) => c.attente.length)) * etat.dureeMoyenneMinutes
      : Math.ceil(attente.length / fauteuils) * etat.dureeMoyenneMinutes,
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
  const p = etat.positions.get(t.id) || { position: 0, devant: 0, tours: 0, estimationMinutes: 0, phase: 'ATTENTE' };
  const message = messageDePhase(p.phase, { devant: p.devant, estimationMinutes: p.estimationMinutes, nomSalon: etat.nomSalon });
  // En file par coiffeur, le client a CHOISI : son ticket doit le lui rappeler.
  const posteRef = t.poste_id || t.poste_choisi_id;
  const poste = etat.mode === MODE_PAR_FAUTEUIL && posteRef
    ? etat.postes.find((x) => x.id === posteRef) || null
    : null;

  return {
    numero: t.numero_affiche,
    prenom: t.prenom,
    // Le nom du coiffeur s'il a ete choisi, sinon le nom du fauteuil.
    coiffeur: poste ? (poste.coiffeur || poste.nom) : null,
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
    `SELECT id, rang, statut, retards, poste_choisi_id, poste_id, telephone_enc, jeton_enc, numero_affiche, prenom
       FROM tickets WHERE jour = $1 AND statut = ANY($2) ORDER BY rang`,
    [jour, STATUTS_ACTIFS],
  );
  const fauteuils = Math.max(1, await tx.value('SELECT COUNT(*)::int FROM postes WHERE actif') ?? 1);

  // On repasse par calculerPositions plutot que de recompter ici : c'est la
  // MEME regle qui decide de ce que le client voit a l'ecran et de ce qu'il
  // recoit sur WhatsApp. Deux comptages separes finiraient par diverger, et le
  // client lirait « 4 personnes devant vous » en recevant « votre tour
  // approche ». Le seuil compte en TOURS, pas en personnes.
  const positions = calculerPositions(tickets, {
    dureeMoyenneMinutes: reglages['file.dureeMoyenneMinutes'],
    seuilPrevenir: reglages['file.seuilPrevenir'],
    postesActifs: fauteuils,
    mode: reglages['file.mode'],
  });

  // Une connexion PostgreSQL ne traite qu'une requete a la fois : les envois
  // s'enfilent l'un apres l'autre, jamais en parallele sur la meme transaction.
  for (const t of tickets) {
    if (t.id === saufTicketId) continue;
    const p = positions.get(t.id);
    if (!p) continue;

    if (STATUTS_EN_ATTENTE.includes(t.statut) && p.tours <= reglages['file.seuilPrevenir']) {
      // Le message, lui, annonce le nombre REEL de personnes devant : c'est ce
      // que le client compte des yeux en entrant dans le salon.
      await enfilerEnvoi(tx, { ticket: t, type: 'APPROCHE', donnees: { devant: p.devant } });
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
 * En mode « une file par coiffeur », le client choisit son fauteuil a ce
 * moment-la, et il ne bouge plus : il attend dans SA file.
 *
 * @param {{ prenom:string, nom:string, telephone:string,
 *           source:'ONLINE'|'QR'|'COMPTOIR', posteId?:string|null }} donnees
 * @param {{ user?:object|null }} [contexte]
 * @returns {Promise<{ ticket:object, jeton:string, position:object }>}
 */
export async function prendreTour({ prenom, nom, telephone, source = 'ONLINE', posteId = null }, { user = null } = {}) {
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

  // En file par coiffeur, le choix du fauteuil est OBLIGATOIRE : sans lui, le
  // client atterrirait dans aucune file et n'avancerait jamais.
  let poste = null;
  if (reglages['file.mode'] === MODE_PAR_FAUTEUIL) {
    if (!posteId) {
      throw new ValidationError({ posteId: 'Elige tu peluquero.' },
        'El salón funciona con una fila por peluquero: elige el tuyo.');
    }
    poste = await posteParId(posteId);
    if (!poste || !poste.actif) {
      throw new ValidationError({ posteId: 'Este peluquero no está disponible.' },
        'Este peluquero ya no está disponible. Elige otro.');
    }
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
        'El salón ha cerrado la jornada. Vuelve mañana, o ven directamente al salón.',
        { code: 'JOURNEE_CLOSE' });
    }

    const total = await tx.value('SELECT COUNT(*)::int FROM tickets WHERE jour = $1', [jour]);
    if (total >= reglages['file.maxParJour']) {
      throw new AppError(409, 'La fila de hoy está completa. Ven al salón o vuelve mañana.', { code: 'FILE_COMPLETE' });
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
        'Ya hay un turno en curso para este número (turno ' + dejaLa.numero_affiche + '). '
        + 'Búscalo en tu enlace de seguimiento, o pídelo en el salón.',
        { code: 'TOUR_DEJA_PRIS' });
    }

    const { numero, rang } = await prochainNumeroEtRang(tx, journee);
    const id = newId();
    const affiche = numeroAffiche(numero);

    const ticket = await tx.one(
      `INSERT INTO tickets (id, jour, numero, numero_affiche, rang, prenom, nom,
                            telephone_enc, telephone_idx, telephone_fin, source, statut, jeton_hash,
                            jeton_enc, poste_choisi_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'WAITING',$12,$13,$14)
       RETURNING ` + COLONNES,
      [id, jour, numero, affiche, rang, prenom, nom,
        encrypt(telephone), blindIndex(telephone), telephone.slice(-4), source,
        hashToken(jeton), encrypt(jeton), poste ? poste.id : null],
    );

    await tracer(tx, ticket, {
      statut: 'WAITING',
      rang,
      user,
      detail: 'Tour pris (' + libelleSource(source) + ')'
        + (poste ? ', file de ' + (poste.coiffeur || poste.nom) : '') + '.',
    });
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
  if (!ticket) throw notFound('Este turno no está en la fila de hoy.');
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
      if (!journee.ouverte) throw conflict('La jornada está cerrada: la fila de hoy ya no se puede modificar.');
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
export const appeler = geste('appeler', async ({ tx, ticket, user, jour, options, reglages }) => {
  if (STATUTS_EN_COURS.includes(ticket.statut)) {
    throw conflict('El turno ' + ticket.numero_affiche + ' ya está llamado.');
  }
  if (!STATUTS_EN_ATTENTE.includes(ticket.statut)) {
    throw conflict('El turno ' + ticket.numero_affiche + ' ya no está esperando (' + libelleStatut(ticket.statut) + ').');
  }

  // En file par coiffeur, le fauteuil du client est celui qu'il a choisi. Le
  // coiffeur peut malgre tout le prendre a un autre fauteuil : un client qui
  // attend depuis une heure pendant que le voisin est libre ne doit pas rester
  // planté au nom d'une regle. Le deplacement est alors ECRIT dans l'historique.
  const parFauteuil = reglages['file.mode'] === MODE_PAR_FAUTEUIL;
  const demande = options.posteId ?? (parFauteuil ? ticket.poste_choisi_id : null);
  const poste = await posteLibre(jour, { prefere: demande });
  const deplace = parFauteuil && ticket.poste_choisi_id && ticket.poste_choisi_id !== poste.id;

  const occupe = await tx.one(
    `SELECT numero_affiche, prenom FROM tickets
      WHERE jour = $1 AND poste_id = $2 AND statut = ANY($3) LIMIT 1`,
    [jour, poste.id, STATUTS_EN_COURS],
  );
  if (occupe) {
    throw new AppError(409,
      occupe.prenom + ' (' + occupe.numero_affiche + ') ya está en el sillón « ' + poste.nom + ' ». '
      + 'Terminez ce client, ou marquez-le absent, avant d’appeler le suivant.',
      { code: 'FAUTEUIL_OCCUPE' });
  }

  const maj = await tx.one(
    `UPDATE tickets SET statut = 'CALLED', poste_id = $2, statut_at = now(), appele_at = now(),
            version = version + 1
      WHERE id = $1 RETURNING ` + COLONNES,
    [ticket.id, poste.id],
  );
  await tracer(tx, maj, {
    statut: 'CALLED',
    user,
    detail: 'Cliente llamado al sillón « ' + poste.nom + ' »'
      + (deplace ? ' (movido desde otro sillón).' : '.'),
  });
  maj.poste = poste;
  maj.deplace = deplace;
  return maj;
});

/** COMMENCER la coupe. Geste facultatif : « servir » depuis CALLED suffit. */
export const commencerService = geste('service', async ({ tx, ticket, user }) => {
  if (ticket.statut === 'IN_SERVICE') return ticket;
  if (ticket.statut !== 'CALLED') {
    throw conflict('El turno ' + ticket.numero_affiche + ' tiene que ser llamado primero.');
  }
  const maj = await tx.one(
    `UPDATE tickets SET statut = 'IN_SERVICE', statut_at = now(), service_at = now(), version = version + 1
      WHERE id = $1 RETURNING ` + COLONNES,
    [ticket.id],
  );
  await tracer(tx, maj, { statut: 'IN_SERVICE', user, detail: 'Corte empezado.' });
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
    throw conflict('El turno ' + ticket.numero_affiche + ' ya está ' + libelleStatut(ticket.statut).toLowerCase() + '.');
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
    throw conflict('El turno ' + ticket.numero_affiche + ' ya no está en la fila (' + libelleStatut(ticket.statut).toLowerCase() + ').');
  }
  const rang = await prochainRang(tx, journee);
  // Le fauteuil est libere du meme geste : le client n'y est plus, et le
  // coiffeur doit pouvoir appeler quelqu'un d'autre a sa place tout de suite.
  //
  // Le coiffeur CHOISI, lui, ne bouge pas : le client repart en fin de SA file,
  // meme s'il venait d'etre depanne par un collegue. Il avait choisi quelqu'un,
  // ce choix lui appartient.
  const maj = await tx.one(
    `UPDATE tickets SET statut = 'LATE', rang = $2, retards = retards + 1, poste_id = NULL,
            statut_at = now(), file_depuis_at = now(), appele_at = NULL, version = version + 1
      WHERE id = $1 RETURNING ` + COLONNES,
    [ticket.id, rang],
  );
  await tracer(tx, maj, {
    statut: 'LATE',
    rang,
    user,
    detail: 'Ausente al llamarle: pasa al final de la fila (ausencia n.º ' + maj.retards + ').',
  });
  return maj;
});

/**
 * CHANGER DE COIFFEUR.
 *
 * Le client change de file : il n'est plus « depanne » par un collegue, il
 * devient vraiment le client de quelqu'un d'autre. C'est un geste qu'on fait
 * avec lui, au comptoir : « Youssef en a pour une heure, Haron peut vous
 * prendre dans dix minutes, ca vous va ? ».
 *
 * IL GARDE SON RANG. Il est arrive a une certaine heure, et cette heure ne
 * change pas : il se glisse dans la nouvelle file a la place que lui donne son
 * arrivee, ni devant ceux qui attendaient deja avant lui, ni derriere ceux
 * arrives apres. Le faire repartir en fin de file serait le punir d'un
 * arrangement que le salon lui a propose.
 *
 * N'a de sens qu'en file par coiffeur : en file unique, il n'y en a qu'une.
 */
export const transferer = geste('transferer', async ({ tx, ticket, user, reglages, options }) => {
  if (reglages['file.mode'] !== MODE_PAR_FAUTEUIL) {
    throw conflict('El salón funciona con una sola fila: no hay otra fila a la que mover a este cliente.');
  }
  if (!STATUTS_EN_ATTENTE.includes(ticket.statut)) {
    throw conflict('El turno ' + ticket.numero_affiche + ' ya no está esperando ('
      + libelleStatut(ticket.statut).toLowerCase() + '): no se cambia de peluquero a alguien que ya está en el sillón.');
  }
  if (!options.posteId) throw badRequest('Indique el peluquero al que mover a este cliente.');

  const cible = await posteParId(options.posteId);
  if (!cible) throw notFound('Este peluquero ya no existe.');
  if (!cible.actif) throw conflict('El sillón « ' + cible.nom + ' » está cerrado.');
  if (cible.id === ticket.poste_choisi_id) {
    throw conflict('Este cliente ya está esperando a ' + (cible.coiffeur || cible.nom) + '.');
  }

  const depart = ticket.poste_choisi_id ? await posteParId(ticket.poste_choisi_id) : null;
  const maj = await tx.one(
    `UPDATE tickets SET poste_choisi_id = $2, statut_at = now(), version = version + 1
      WHERE id = $1 RETURNING ` + COLONNES,
    [ticket.id, cible.id],
  );
  await tracer(tx, maj, {
    statut: maj.statut,
    user,
    detail: 'Changement de coiffeur : '
      + (depart ? (depart.coiffeur || depart.nom) : 'sin peluquero')
      + ' → ' + (cible.coiffeur || cible.nom) + '.',
  });
  maj.poste = cible;
  return maj;
});

/** ANNULER un tour. Le seul geste qui sort definitivement un client de la file. */
export const annuler = geste('annuler', async ({ tx, ticket, user, options }) => {
  if (!STATUTS_ACTIFS.includes(ticket.statut)) {
    throw conflict('El turno ' + ticket.numero_affiche + ' ya no está en la fila.');
  }
  const motif = String(options.motif || '').trim().slice(0, 300) || 'Turno anulado por el salón.';
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
            derniere_erreur = 'Turno anulado antes del envío.'
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
  if (!ticket) throw notFound('Este enlace de seguimiento ya no sirve.');
  if (!STATUTS_ACTIFS.includes(ticket.statut)) {
    throw conflict('Este turno ya no está en la fila.');
  }
  const jour = ticket.jour;

  const resultat = await transaction(async (tx) => {
    const journee = await verrouillerJournee(tx, jour);
    if (!journee || !journee.ouverte) throw conflict('La jornada está cerrada.');
    const verrouille = await verrouillerTicket(tx, ticket.id, jour);
    if (!STATUTS_ACTIFS.includes(verrouille.statut)) throw conflict('Este turno ya no está en la fila.');
    const maj = await tx.one(
      `UPDATE tickets SET statut = 'CANCELLED', statut_at = now(), termine_at = now(),
              motif = 'Anulado por el cliente desde su enlace de seguimiento.', version = version + 1
        WHERE id = $1 RETURNING ` + COLONNES,
      [verrouille.id],
    );
    await tracer(tx, maj, { statut: 'CANCELLED', detail: 'Anulado por el cliente.' });
    await tx.execute(
      `UPDATE envois_whatsapp SET statut = 'DESACTIVE', contenu_enc = NULL,
              derniere_erreur = 'Turno anulado por el cliente.'
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
 * APPELER LE SUIVANT : le premier de la file, quel qu'il soit, sur le fauteuil
 * demande (ou le premier libre). Raccourci du tableau de bord, pour n'avoir
 * jamais a choisir dans une liste pendant le travail.
 */
export async function appelerSuivant({ user = null, posteId = null } = {}) {
  const reglages = await lireTous();
  const jour = jourLocal();
  const parFauteuil = reglages['file.mode'] === MODE_PAR_FAUTEUIL;

  // En file par coiffeur, « le suivant » est le suivant DE CE FAUTEUIL : celui
  // qui a choisi ce coiffeur. Prendre le premier du salon ferait passer devant
  // quelqu'un qui attend un autre coiffeur.
  const suivant = parFauteuil && posteId
    ? await one(
      `SELECT id FROM tickets WHERE jour = $1 AND statut = ANY($2) AND poste_choisi_id = $3
        ORDER BY rang LIMIT 1`,
      [jour, STATUTS_EN_ATTENTE, posteId],
    )
    : await one(
      `SELECT id FROM tickets WHERE jour = $1 AND statut = ANY($2) ORDER BY rang LIMIT 1`,
      [jour, STATUTS_EN_ATTENTE],
    );

  if (!suivant) {
    throw badRequest(parFauteuil && posteId
      ? 'Ahora mismo nadie espera a este peluquero.'
      : 'Ahora mismo no espera nadie.');
  }
  return appeler(suivant.id, { user, posteId });
}

/** Ajout d'un client AU COMPTOIR, par le coiffeur (client sans telephone en main). */
export async function ajouterAuComptoir({ prenom, nom, telephone }, { user = null } = {}) {
  return prendreTour({ prenom, nom, telephone, source: 'COMPTOIR' }, { user });
}

export function libelleStatut(statut) {
  return ({
    WAITING: 'Esperando',
    LATE: 'Esperando (ya estuvo ausente)',
    CALLED: 'Llamado',
    IN_SERVICE: 'En curso',
    COMPLETED: 'Atendido',
    CANCELLED: 'Anulado',
  })[statut] || statut;
}

export { STATUTS_ACTIFS, STATUTS_EN_ATTENTE, STATUTS_EN_COURS };
