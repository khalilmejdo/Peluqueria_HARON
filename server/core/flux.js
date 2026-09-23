/**
 * Diffusion temps reel (Server-Sent Events).
 *
 * Deux sortes d'abonnes, un seul calcul :
 *
 *   - le SALON : la tablette du coiffeur, qui veut la file entiere ;
 *   - un CLIENT : un telephone ouvert sur /ticket/<jeton>, qui ne veut que sa
 *     propre position et n'a le droit de voir que la sienne.
 *
 * Quand la file change, on relit UNE fois l'etat de la journee, puis chaque
 * abonne recoit la projection qui le concerne. Trente clients connectes ne
 * coutent donc pas trente requetes : ils coutent une requete et trente
 * ecritures sur des connexions deja ouvertes.
 *
 * Les changements sont regroupes sur un court delai : le coiffeur qui termine
 * un client puis appelle aussitot le suivant produit deux gestes a une seconde
 * d'intervalle, pas deux salves de messages.
 *
 * CONFIDENTIALITE. La projection envoyee a un client ne contient jamais le
 * numero WhatsApp de qui que ce soit, ni le nom des autres clients : sa
 * position, son statut, son estimation, rien de plus.
 */
import { log } from './logger.js';

/** Regroupement des changements successifs. */
const DELAI_REGROUPEMENT_MS = 60;
/** Battement de coeur : traverse les proxys qui coupent une connexion muette. */
const BATTEMENT_MS = 25000;
/** Plafond d'abonnes simultanes : un salon, pas un stade. */
const MAX_ABONNES = 500;

/** @typedef {{ id:number, res:import('node:http').ServerResponse, portee:'SALON'|'CLIENT', ticketId:string|null, jour:string }} Abonne */

/** @type {Set<Abonne>} */
const abonnes = new Set();
let prochainId = 1;

/**
 * Source de l'etat : posee une fois au demarrage par le domaine, pour que ce
 * module ne connaisse ni la base ni les regles de la file.
 * @type {null | ((jour: string) => Promise<object>)}
 */
let chargerEtat = null;

/**
 * Projection d'un etat vers un client donne.
 * @type {null | ((etat: object, ticketId: string) => object|null)}
 */
let projeterClient = null;

/**
 * Projection d'un etat vers le salon. Elle est DISTINCTE de celle du client :
 * c'est la seule des deux qui contient les numeros WhatsApp et les noms.
 * @type {null | ((etat: object) => object)}
 */
let projeterSalon = null;

/** Branche le domaine sur le diffuseur (appele une fois, au demarrage). */
export function brancher({ etat, projection, projectionSalon }) {
  chargerEtat = etat;
  projeterClient = projection;
  projeterSalon = projectionSalon;
}

/* ------------------------------------------------------------------ */
/*  Ecriture sur une connexion                                         */
/* ------------------------------------------------------------------ */

function ecrire(abonne, evenement, donnees) {
  try {
    // Une seule ligne « data: » : le JSON ne contient jamais de retour a la
    // ligne, JSON.stringify les echappe.
    abonne.res.write('event: ' + evenement + '\ndata: ' + JSON.stringify(donnees) + '\n\n');
    return true;
  } catch (err) {
    log.warn('Abonne temps reel injoignable, connexion fermee', { error: err?.message });
    fermer(abonne);
    return false;
  }
}

function fermer(abonne) {
  abonnes.delete(abonne);
  try {
    abonne.res.end();
  } catch {
    // La connexion etait deja tombee.
  }
}

/* ------------------------------------------------------------------ */
/*  Abonnement                                                         */
/* ------------------------------------------------------------------ */

/**
 * Inscrit une connexion.
 * @param {{ res: object, req: object, portee: 'SALON'|'CLIENT', ticketId?: string|null, jour: string }} p
 * @returns {Abonne|null} null si le plafond est atteint (la connexion est fermee)
 */
export function abonner({ res, req, portee, ticketId = null, jour }) {
  if (abonnes.size >= MAX_ABONNES) {
    log.warn('Plafond d abonnes temps reel atteint', { abonnes: abonnes.size });
    try {
      res.write('event: sature\ndata: {}\n\n');
      res.end();
    } catch {
      // rien de plus a faire
    }
    return null;
  }
  const abonne = { id: prochainId++, res, portee, ticketId, jour };
  abonnes.add(abonne);

  const partir = () => fermer(abonne);
  req.on('close', partir);
  req.on('error', partir);
  res.on('error', partir);

  return abonne;
}

export function nombreAbonnes() {
  return abonnes.size;
}

/** Ferme tout (arret du serveur, tests). */
export function fermerTout() {
  for (const abonne of [...abonnes]) fermer(abonne);
}

/* ------------------------------------------------------------------ */
/*  Diffusion                                                          */
/* ------------------------------------------------------------------ */

let enAttente = null;
let joursEnAttente = new Set();

/**
 * Annonce que la file d'une journee a change. Ne bloque jamais l'appelant : la
 * reponse HTTP du coiffeur ne doit pas attendre que trente telephones aient
 * recu leur mise a jour.
 *
 * @param {string} jour  « AAAA-MM-JJ »
 */
export function annoncerChangement(jour) {
  joursEnAttente.add(jour);
  if (enAttente) return;
  enAttente = setTimeout(() => {
    const jours = joursEnAttente;
    joursEnAttente = new Set();
    enAttente = null;
    for (const j of jours) {
      diffuser(j).catch((err) => log.error('Diffusion temps reel en echec', { jour: j, error: err?.message }));
    }
  }, DELAI_REGROUPEMENT_MS);
  enAttente.unref?.();
}

async function diffuser(jour) {
  const concernes = [...abonnes].filter((a) => a.jour === jour);
  if (!concernes.length) return;
  if (!chargerEtat) {
    log.error('Diffuseur non branche : aucun etat a envoyer.');
    return;
  }
  const etat = await chargerEtat(jour);

  const vueSalon = concernes.some((a) => a.portee === 'SALON') && projeterSalon ? projeterSalon(etat) : null;

  for (const abonne of concernes) {
    if (abonne.portee === 'SALON') {
      if (vueSalon) ecrire(abonne, 'file', vueSalon);
      continue;
    }
    const projection = projeterClient ? projeterClient(etat, abonne.ticketId) : null;
    if (projection) {
      ecrire(abonne, 'ticket', projection);
    } else {
      // Le ticket a disparu de la journee (cloture) : on le dit puis on ferme,
      // plutot que de laisser le telephone afficher une position perimee.
      ecrire(abonne, 'fin', { motif: 'journee_close' });
      fermer(abonne);
    }
  }
}

/** Envoie tout de suite son etat a un seul abonne (juste apres son arrivee). */
export async function envoyerEtatInitial(abonne) {
  if (!chargerEtat) return;
  const etat = await chargerEtat(abonne.jour);
  if (abonne.portee === 'SALON') {
    if (projeterSalon) ecrire(abonne, 'file', projeterSalon(etat));
    return;
  }
  const projection = projeterClient ? projeterClient(etat, abonne.ticketId) : null;
  if (projection) ecrire(abonne, 'ticket', projection);
  else {
    ecrire(abonne, 'fin', { motif: 'introuvable' });
    fermer(abonne);
  }
}

/* ------------------------------------------------------------------ */
/*  Battement de coeur                                                 */
/* ------------------------------------------------------------------ */

let battement = null;

export function demarrerBattement() {
  if (battement) return;
  battement = setInterval(() => {
    for (const abonne of [...abonnes]) {
      try {
        // Un commentaire SSE : le navigateur l'ignore, le proxy voit passer des
        // octets et garde la connexion ouverte.
        abonne.res.write(': battement\n\n');
      } catch {
        fermer(abonne);
      }
    }
  }, BATTEMENT_MS);
  battement.unref?.();
}

export function arreterBattement() {
  if (battement) clearInterval(battement);
  battement = null;
  if (enAttente) clearTimeout(enAttente);
  enAttente = null;
  joursEnAttente = new Set();
}
