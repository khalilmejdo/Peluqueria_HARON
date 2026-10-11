/**
 * Taches de fond.
 *
 * Trois seulement, et chacune est REJOUABLE sans dommage : si le serveur
 * redemarre en plein milieu, la suivante reprend le travail la ou il en etait.
 *
 *   journee.cloture   clot les journees passees restees ouvertes
 *   whatsapp.envois   vide la boite d'envoi
 *   sessions.purge    efface les vieilles sessions revoquees
 *
 * La cloture de la journee EN COURS n'est jamais automatique : le coiffeur qui
 * finit une tete a 20 h 40 alors que le salon ferme a 20 h 30 ne doit pas voir
 * sa file disparaitre. C'est le gerant qui clot sa journee d'un bouton, ou bien
 * elle se clot toute seule au passage de minuit, quand « aujourd'hui » change.
 */
import { log } from './logger.js';
import { solderLesRendezVousPasses } from '../domain/rendezvous.js';
import { purgeExpiredSessions } from './session.js';
import { transaction } from '../db/index.js';
import { jourLocal } from './temps.js';
import { cloturerJourneesAnterieures } from '../domain/journee.js';
import { traiterEnvois } from '../domain/notifications.js';
import { t } from './langue.js';

/** @type {Array<{ nom:string, intervalleMs:number, executer:() => Promise<any>, timer:any }>} */
const TACHES = [
  {
    nom: 'journee.cloture',
    intervalleMs: 10 * 60000,
    executer: async () => {
      const jour = jourLocal();
      const n = await transaction((tx) => cloturerJourneesAnterieures(tx, jour, { par: t('journee.clotureAuto') }));
      // Les rendez-vous d'hier jamais honores ne trainent pas dans l'agenda.
      await solderLesRendezVousPasses(jour);
      return n;
    },
  },
  {
    nom: 'whatsapp.envois',
    intervalleMs: 30000,
    executer: () => traiterEnvois({ limite: 20 }),
  },
  {
    nom: 'sessions.purge',
    intervalleMs: 3600000,
    executer: () => purgeExpiredSessions(),
  },
];

const enCours = new Set();

async function lancer(tache) {
  // Une tache lente ne doit pas se chevaucher avec elle-meme.
  if (enCours.has(tache.nom)) return;
  enCours.add(tache.nom);
  const debut = Date.now();
  try {
    const bilan = await tache.executer();
    const interessant = bilan && ((Array.isArray(bilan) && bilan.length)
      || (typeof bilan === 'object' && Object.values(bilan).some((v) => typeof v === 'number' && v > 0))
      || (typeof bilan === 'number' && bilan > 0));
    if (interessant) log.info('Tache executee', { tache: tache.nom, ms: Date.now() - debut, bilan });
  } catch (err) {
    log.error('Tache en echec', { tache: tache.nom, error: err?.message });
  } finally {
    enCours.delete(tache.nom);
  }
}

export function demarrerTaches() {
  for (const tache of TACHES) {
    if (tache.timer) continue;
    tache.timer = setInterval(() => lancer(tache), tache.intervalleMs);
    tache.timer.unref?.();
    // Un premier passage rapide apres le demarrage : c'est la que se rattrape
    // une journee restee ouverte pendant que l'application etait arretee.
    const amorce = setTimeout(() => lancer(tache), 3000 + Math.floor(Math.random() * 2000));
    amorce.unref?.();
  }
  log.info('Taches de fond demarrees', { taches: TACHES.map((t) => t.nom) });
}

export function arreterTaches() {
  for (const tache of TACHES) {
    if (tache.timer) clearInterval(tache.timer);
    tache.timer = null;
  }
}

/** Declenche une tache a la demande (bouton d'administration, tests). */
export async function executerTache(nom) {
  const tache = TACHES.find((t) => t.nom === nom);
  if (!tache) throw new Error('Tache inconnue : ' + nom);
  return tache.executer();
}

export const nomsDesTaches = () => TACHES.map((t) => t.nom);
