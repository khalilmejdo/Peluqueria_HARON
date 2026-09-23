/**
 * LA FILE — l'ecran que le coiffeur a sous les yeux toute la journee.
 *
 * Une seule chose compte : le client actuel, en tres gros, et un bouton
 * « CLIENT SERVI » qu'on trouve sans regarder. Tout le reste est en dessous.
 *
 * L'ecran se met a jour tout seul par le flux d'evenements. Chaque geste rend
 * deja la file complete : meme si le flux est coupe, l'ecran reste juste.
 */
import { api, ErreurApi } from './api.js';
import { el, remplacer, annoncer, heure, depuis, minutesLisibles, LIBELLE_SOURCE, LIBELLE_STATUT } from './dom.js';

let flux = null;
let conteneurCourant = null;
let derniereFile = null;
let enCoursDeGeste = false;

/* ------------------------------------------------------------------ */
/*  Gestes                                                             */
/* ------------------------------------------------------------------ */

async function geste(chemin, { corps = null, annonce = null } = {}) {
  if (enCoursDeGeste) return;
  enCoursDeGeste = true;
  marquerOccupe(true);
  try {
    const reponse = corps ? await api.post(chemin, corps) : await api.post(chemin);
    if (reponse?.file) peindre(reponse.file);
    if (annonce) annoncer(annonce);
    return reponse;
  } catch (err) {
    signaler(err instanceof ErreurApi ? err.message : 'Le geste n’a pas abouti.');
    // Le serveur a peut-etre change la file avant de refuser : on relit.
    await recharger();
    throw err;
  } finally {
    enCoursDeGeste = false;
    marquerOccupe(false);
  }
}

function marquerOccupe(occupe) {
  if (!conteneurCourant) return;
  conteneurCourant.classList.toggle('gestion__contenu--occupe', occupe);
}

function signaler(message) {
  if (!conteneurCourant) return;
  const zone = conteneurCourant.querySelector('[data-alerte]');
  if (!zone) return;
  zone.textContent = message;
  zone.hidden = false;
  clearTimeout(zone.dataset.minuterie);
  zone.dataset.minuterie = String(setTimeout(() => { zone.hidden = true; }, 8000));
  annoncer(message);
}

async function recharger() {
  try {
    const reponse = await api.get('/api/file');
    if (reponse?.file) peindre(reponse.file);
  } catch {
    // Hors ligne : l'ecran garde le dernier etat connu.
  }
}

/* ------------------------------------------------------------------ */
/*  Le client actuel                                                   */
/* ------------------------------------------------------------------ */

function blocActuel(file) {
  const actuel = file.enCours;

  if (!actuel) {
    const prochain = file.prochain;
    return el('section.actuel.actuel--vide',
      el('p.actuel__label', { texte: 'Client actuel' }),
      el('p.actuel__aucun', { texte: prochain ? 'Le fauteuil est libre.' : 'Personne n’attend.' }),
      prochain
        ? el('div.actuel__suite',
          el('p.actuel__prochain-label', { texte: 'Prochain' }),
          el('p.actuel__prochain', { texte: prochain.prenom + ' ' + prochain.nom }),
          el('p.actuel__prochain-numero', { texte: prochain.numero }),
          el('button.bouton.bouton--principal.bouton--geant', {
            type: 'button',
            texte: 'Appeler ' + prochain.prenom,
            surClick: () => geste('/api/file/suivant', { annonce: prochain.prenom + ' est appelé.' }),
          }))
        : el('p.texte-doux', { texte: 'La file se remplira dès qu’un client prendra son tour.' }));
  }

  const appele = actuel.statut === 'CALLED';

  return el('section.actuel' + (appele ? '.actuel--appele' : '.actuel--service'),
    el('p.actuel__label', { texte: 'Client actuel' }),
    el('p.actuel__numero', { texte: actuel.numero }),
    el('h1.actuel__nom', { texte: actuel.prenom + ' ' + actuel.nom }),
    el('p.actuel__etat', { texte: appele ? 'Appelé ' + depuis(actuel.appeleA) : 'Au fauteuil ' + depuis(actuel.serviA) }),
    actuel.retards > 0
      ? el('p.actuel__retard', { texte: 'Déjà absent ' + actuel.retards + ' fois aujourd’hui.' })
      : null,
    el('button.bouton.bouton--servi', {
      type: 'button',
      surClick: () => geste('/api/file/' + actuel.id + '/servi', { annonce: actuel.prenom + ' est servi.' }),
    }, 'CLIENT SERVI ✓'),
    el('div.actuel__secondaires',
      appele
        ? el('button.bouton.bouton--discret', {
          type: 'button',
          texte: 'Commencer la coupe',
          surClick: () => geste('/api/file/' + actuel.id + '/commencer'),
        })
        : null,
      el('button.bouton.bouton--absent', {
        type: 'button',
        texte: 'Absent / en retard',
        surClick: () => geste('/api/file/' + actuel.id + '/absent', {
          annonce: actuel.prenom + ' est replacé en fin de file.',
        }),
      })));
}

/* ------------------------------------------------------------------ */
/*  Une carte de la file                                               */
/* ------------------------------------------------------------------ */

function carteAttente(ticket, index) {
  const actions = el('div.carte-file__actions',
    el('button.bouton.bouton--discret.bouton--petit', {
      type: 'button',
      texte: index === 0 ? 'Appeler' : 'Appeler maintenant',
      surClick: () => geste('/api/file/' + ticket.id + '/appeler', { annonce: ticket.prenom + ' est appelé.' }),
    }),
    el('button.bouton.bouton--discret.bouton--petit', {
      type: 'button',
      texte: 'Servi',
      surClick: () => geste('/api/file/' + ticket.id + '/servi', { annonce: ticket.prenom + ' est servi.' }),
    }),
    el('button.bouton.bouton--discret.bouton--petit', {
      type: 'button',
      texte: 'WhatsApp',
      surClick: () => ouvrirWhatsapp(ticket),
    }),
    el('button.bouton.bouton--discret.bouton--petit.bouton--danger', {
      type: 'button',
      texte: 'Annuler',
      surClick: () => annulerTicket(ticket),
    }));

  return el('li.carte-file' + (ticket.retards > 0 ? '.carte-file--retard' : ''),
    el('div.carte-file__tete',
      el('span.carte-file__position', { texte: '#' + (index + 1) }),
      el('span.carte-file__numero', { texte: ticket.numero }),
      el('span.carte-file__source', { texte: LIBELLE_SOURCE[ticket.source] || ticket.source })),
    el('p.carte-file__nom', { texte: ticket.prenom + ' ' + ticket.nom }),
    el('p.carte-file__meta',
      el('span', { texte: 'Arrivé à ' + heure(ticket.arriveA) }),
      el('span', { texte: '·' }),
      el('span', { texte: 'Attend ' + depuis(ticket.dansLaFileDepuis) }),
      ticket.retards > 0 ? el('span', { texte: '·' }) : null,
      ticket.retards > 0 ? el('span.carte-file__retard', { texte: 'absent ' + ticket.retards + '×' }) : null),
    actions);
}

async function ouvrirWhatsapp(ticket) {
  try {
    const reponse = await api.get('/api/file/' + ticket.id + '/whatsapp');
    // Ouvert dans un onglet neuf : l'ecran de la file reste tel quel derriere.
    window.open(reponse.lienWhatsapp, '_blank', 'noopener');
  } catch (err) {
    signaler(err instanceof ErreurApi ? err.message : 'Impossible de préparer le message.');
  }
}

async function annulerTicket(ticket) {
  const motif = window.prompt('Annuler le tour de ' + ticket.prenom + ' (' + ticket.numero + ') ?\nMotif (facultatif) :', '');
  if (motif === null) return;
  await geste('/api/file/' + ticket.id + '/annuler', {
    corps: { motif: motif || undefined },
    annonce: 'Tour ' + ticket.numero + ' annulé.',
  }).catch(() => {});
}

/* ------------------------------------------------------------------ */
/*  Ajout au comptoir                                                  */
/* ------------------------------------------------------------------ */

function blocComptoir() {
  const prenom = el('input', { id: 'k-prenom', type: 'text', autocomplete: 'off', required: true, placeholder: 'Prénom' });
  const nom = el('input', { id: 'k-nom', type: 'text', autocomplete: 'off', required: true, placeholder: 'Nom' });
  const telephone = el('input', { id: 'k-tel', type: 'tel', inputmode: 'tel', autocomplete: 'off', required: true, placeholder: 'WhatsApp' });
  const erreur = el('p.alerte.alerte--refus', { role: 'alert', hidden: true });

  const formulaire = el('form.comptoir__formulaire', {
    surSubmit: async (evenement) => {
      evenement.preventDefault();
      erreur.hidden = true;
      try {
        const reponse = await api.post('/api/file/comptoir', {
          prenom: prenom.value.trim(), nom: nom.value.trim(), telephone: telephone.value.trim(),
        });
        if (reponse?.file) peindre(reponse.file);
        annoncer('Ticket ' + reponse.numero + ' créé au comptoir.');
        prenom.value = '';
        nom.value = '';
        telephone.value = '';
        prenom.focus();
      } catch (err) {
        erreur.textContent = err instanceof ErreurApi ? err.message : 'Impossible d’ajouter ce client.';
        erreur.hidden = false;
      }
    },
  },
  erreur,
  el('div.comptoir__champs', prenom, nom, telephone),
  el('button.bouton.bouton--discret', { type: 'submit', texte: 'Ajouter à la file' }));

  return el('details.comptoir',
    el('summary', { texte: 'Ajouter un client au comptoir' }),
    el('p.texte-doux', { texte: 'Pour le client qui n’a pas son téléphone en main. Il entre dans la même file, à la suite.' }),
    formulaire);
}

/* ------------------------------------------------------------------ */
/*  Peinture                                                           */
/* ------------------------------------------------------------------ */

function peindre(file) {
  derniereFile = file;
  if (!conteneurCourant) return;

  const zone = conteneurCourant.querySelector('[data-file]');
  if (!zone) return;

  const attente = file.attente || [];
  const enTete = el('div.file__chiffres',
    chiffre(attente.length, attente.length === 1 ? 'client en attente' : 'clients en attente'),
    chiffre(file.compteurs.servis, file.compteurs.servis === 1 ? 'client servi' : 'clients servis'),
    chiffre(minutesLisibles(file.attenteEstimeeMinutes), 'd’attente estimée'));

  const liste = attente.length
    ? el('ul.file__liste', attente.map((t, i) => carteAttente(t, i)))
    : el('p.file__vide', { texte: 'Aucun client en attente.' });

  const termines = (file.termines || []).slice(0, 8);
  const historique = termines.length
    ? el('details.historique',
      el('summary', { texte: 'Déjà passés aujourd’hui (' + file.compteurs.servis + ')' }),
      el('ul.historique__liste', termines.map((t) => el('li',
        el('span.historique__numero', { texte: t.numero }),
        el('span.historique__nom', { texte: t.prenom + ' ' + t.nom }),
        el('span.historique__statut', { texte: LIBELLE_STATUT[t.statut] || t.statut }),
        el('span.historique__heure', { texte: heure(t.termineA) })))))
    : null;

  remplacer(zone,
    !file.ouverte ? el('p.alerte.alerte--refus', { texte: 'La journée est close. La file repartira demain à A001.' }) : null,
    blocPriseDeTour(file.priseDeTour),
    blocActuel(file),
    enTete,
    el('h2.file__titre', { texte: 'File d’attente' }),
    liste,
    blocComptoir(),
    historique);
}

function chiffre(valeur, libelle) {
  return el('div.chiffre',
    el('span.chiffre__valeur', { texte: String(valeur) }),
    el('span.chiffre__libelle', { texte: libelle }));
}

/* ------------------------------------------------------------------ */
/*  Arret et reprise des prises de tour                                */
/* ------------------------------------------------------------------ */

/**
 * L'interrupteur d'entree dans la file.
 *
 * Il n'arrete QUE les nouvelles arrivees : ceux qui attendent sont servis
 * jusqu'au dernier. C'est le geste du coiffeur qui part une heure, ou qui ne
 * veut plus personne après 19 h 30.
 *
 * Pendant des congés declares, l'interrupteur n'a rien a dire : c'est la
 * periode qui commande, et la changer se fait dans l'onglet « Congés ».
 */
function blocPriseDeTour(prise) {
  if (!prise) return null;
  const enConges = prise.code === 'SALON_EN_CONGES';
  const horsHoraires = prise.code === 'SALON_FERME';

  if (enConges) {
    return el('div.prise.prise--conges',
      el('p.prise__etat', { texte: 'Salon fermé (congés)' }),
      el('p.prise__detail', { texte: prise.message }));
  }

  const bouton = el('button', {
    type: 'button',
    classe: 'bouton ' + (prise.ouverte ? 'bouton--absent' : 'bouton--principal'),
    texte: prise.ouverte ? 'Arrêter les prises de tour' : 'Reprendre les prises de tour',
    surClick: async () => {
      if (prise.ouverte) {
        const message = window.prompt(
          'Arrêter les prises de tour ?\n\nCeux qui attendent seront servis normalement ; personne de nouveau n’entrera.\n\nMessage affiché aux clients (facultatif) :',
          '',
        );
        if (message === null) return;
        await geste('/api/file/prise-de-tour', {
          corps: { ouverte: false, message: message || undefined },
          annonce: 'Les prises de tour sont arrêtées.',
        }).catch(() => {});
      } else {
        await geste('/api/file/prise-de-tour', {
          corps: { ouverte: true },
          annonce: 'Les prises de tour ont repris.',
        }).catch(() => {});
      }
    },
  });

  return el('div.prise' + (prise.ouverte ? '.prise--ouverte' : '.prise--fermee'),
    el('div.prise__texte',
      el('p.prise__etat', { texte: prise.ouverte ? 'Les clients peuvent prendre leur tour' : 'Prises de tour arrêtées' }),
      prise.message ? el('p.prise__detail', { texte: prise.message }) : null,
      horsHoraires ? el('p.prise__detail', { texte: 'Hors des horaires d’ouverture réglés.' }) : null),
    bouton);
}

/* ------------------------------------------------------------------ */
/*  Vue                                                                */
/* ------------------------------------------------------------------ */

export async function vueFile(conteneur, { etat }) {
  conteneurCourant = conteneur;
  const zone = el('div.enveloppe.file#file', { donnees: { file: '1' } });
  const alerte = el('p.alerte.alerte--refus.file__alerte', { role: 'alert', hidden: true, donnees: { alerte: '1' } });

  remplacer(conteneur, alerte, zone,
    etat.utilisateur?.role === 'GERANT'
      ? el('div.enveloppe.file__cloture',
        el('button.bouton.bouton--discret.bouton--petit', {
          type: 'button',
          texte: 'Clôturer la journée',
          surClick: async () => {
            if (!window.confirm('Clôturer la journée ?\nLes tours encore en file seront annulés et la numérotation repartira demain à A001.')) return;
            await geste('/api/file/cloturer', { annonce: 'Journée clôturée.' }).catch(() => {});
          },
        }))
      : null);

  const reponse = await api.get('/api/file');
  peindre(reponse.file);
}

/* ------------------------------------------------------------------ */
/*  Temps reel                                                         */
/* ------------------------------------------------------------------ */

export function brancherFlux() {
  debrancherFlux();
  flux = new EventSource('/api/file/flux', { withCredentials: true });
  flux.addEventListener('file', (evenement) => {
    try {
      peindre(JSON.parse(evenement.data));
    } catch {
      // Un message illisible ne doit pas casser l'ecran.
    }
  });
  // Au retour de veille, EventSource rend parfois une connexion morte sans le
  // dire : on repart d'une connexion neuve apres avoir relu la file.
  document.addEventListener('visibilitychange', auReveil);
}

function auReveil() {
  if (document.visibilityState !== 'visible') return;
  recharger();
  if (flux) {
    flux.close();
    flux = new EventSource('/api/file/flux', { withCredentials: true });
    flux.addEventListener('file', (evenement) => {
      try {
        peindre(JSON.parse(evenement.data));
      } catch {
        // idem
      }
    });
  }
}

export function debrancherFlux() {
  document.removeEventListener('visibilitychange', auReveil);
  if (flux) flux.close();
  flux = null;
}

export const fileCourante = () => derniereFile;
