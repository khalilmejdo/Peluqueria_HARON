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
import { el, remplacer, annoncer, heure, depuis, minutesLisibles, libelleSource, libelleStatut } from './dom.js';
import { t } from '../langue.js';
import { carteAvisos } from './avisos.js';

/**
 * Ce que le client a demande.
 *
 * Le coiffeur doit le savoir AVANT de l'installer, pas en le lui demandant une
 * fois assis. Rien de coche : rien d'affiche — la ligne resterait vide pour la
 * moitie des clients du comptoir, a qui on ne demande pas.
 */
function prestationsDe(ticket) {
  const liste = ticket.prestations || [];
  if (!liste.length) return null;
  return el('p.carte-file__prestas',
    ...liste.map((s) => el('span.presta-puce', { texte: s.nombre })),
    ticket.dureeMin ? el('span.presta-duree', { texte: '≈ ' + ticket.dureeMin + ' min' }) : null);
}

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
    signaler(err instanceof ErreurApi ? err.message : t('file.gesteEchoue'));
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

/**
 * La carte d'UN fauteuil.
 *
 * Elle porte tout ce que le coiffeur fait pendant le service : le nom du
 * client en tres gros, le gros bouton, l'absence. Un salon a plusieurs
 * fauteuils en affiche une par fauteuil, cote a cote ; un salon a un seul
 * fauteuil retrouve exactement l'ecran d'avant, sans en-tete inutile.
 *
 * @param {object} poste  { id, nom, coiffeur, client }
 * @param {object} file
 * @param {boolean} seul  vrai si le salon n'a qu'un fauteuil ouvert
 */
function carteFauteuil(poste, file, seul) {
  const actuel = poste.client;
  const parFauteuil = file.mode === 'PAR_FAUTEUIL';
  const enTete = seul && !parFauteuil
    ? el('p.actuel__label', { texte: t('file.clientActuel') })
    : el('div.actuel__fauteuil',
      el('span.actuel__fauteuil-nom', { texte: poste.nom }),
      poste.coiffeur ? el('span.actuel__fauteuil-coiffeur', { texte: poste.coiffeur }) : null);

  if (!actuel) {
    // En file par coiffeur, « le prochain » est le prochain DE CE COIFFEUR :
    // proposer le premier du salon ferait passer devant quelqu'un qui attend
    // quelqu'un d'autre.
    const prochain = parFauteuil ? poste.prochain : file.prochain;
    return el('section.actuel.actuel--vide',
      enTete,
      el('p.actuel__aucun', {
        texte: prochain
          ? t('file.fauteuilLibre')
          : t(parFauteuil ? 'file.personneChezCeCoiffeur' : 'file.personneEnAttente'),
      }),
      prochain
        ? el('div.actuel__suite',
          el('p.actuel__prochain-label', { texte: t(parFauteuil ? 'file.suivantDansSaFile' : 'file.suivantDansLaFile') }),
          el('p.actuel__prochain', { texte: prochain.prenom + ' ' + prochain.nom }),
          el('p.actuel__prochain-numero', { texte: prochain.numero }),
          el('button.bouton.bouton--principal.bouton--geant', {
            type: 'button',
            texte: t('file.appelerQui', { prenom: prochain.prenom }),
            surClick: () => geste('/api/file/suivant', {
              corps: { posteId: poste.id },
              annonce: t('file.appeleAuFauteuil', { prenom: prochain.prenom, poste: poste.nom }),
            }),
          }))
        : el('p.texte-doux', {
          texte: t(parFauteuil ? 'file.prendreAutreFile' : 'file.seRemplira'),
        }));
  }

  const appele = actuel.statut === 'CALLED';

  return el('section.actuel' + (appele ? '.actuel--appele' : '.actuel--service'),
    enTete,
    el('p.actuel__numero', { texte: actuel.numero }),
    el('h1.actuel__nom', { texte: actuel.prenom + ' ' + actuel.nom }),
    prestationsDe(actuel),
    el('p.actuel__etat', {
      texte: appele
        ? t('file.appeleDepuis', { depuis: depuis(actuel.appeleA) })
        : t('file.auFauteuilDepuis', { depuis: depuis(actuel.serviA) }),
    }),
    actuel.retards > 0
      ? el('p.actuel__retard', { texte: t('file.dejaAbsent', { n: actuel.retards }) })
      : null,
    el('button.bouton.bouton--servi', {
      type: 'button',
      surClick: () => geste('/api/file/' + actuel.id + '/servi', {
        annonce: t('file.aEteServi', { prenom: actuel.prenom }),
      }),
    }, t('file.clientServi')),
    el('div.actuel__secondaires',
      appele
        ? el('button.bouton.bouton--discret', {
          type: 'button',
          texte: t('file.commencerCoupe'),
          surClick: () => geste('/api/file/' + actuel.id + '/commencer'),
        })
        : null,
      el('button.bouton.bouton--absent', {
        type: 'button',
        texte: t('file.absentRetard'),
        surClick: () => geste('/api/file/' + actuel.id + '/absent', {
          annonce: t('file.passeEnFin', { prenom: actuel.prenom }),
        }),
      })));
}

/** Tous les fauteuils, cote a cote. */
function blocFauteuils(file) {
  const postes = file.postes || [];
  if (!postes.length) {
    return el('section.actuel.actuel--vide',
      el('p.actuel__label', { texte: t('file.clientActuel') }),
      el('p.actuel__aucun', { texte: t('file.aucunFauteuil') }),
      el('p.texte-doux', { texte: t('file.ouvrirUnFauteuil') }));
  }
  const seul = postes.length === 1;
  const cartes = postes.map((p) => carteFauteuil(p, file, seul));
  return seul ? cartes[0] : el('div.fauteuils', cartes);
}

/* ------------------------------------------------------------------ */
/*  Une carte de la file                                               */
/* ------------------------------------------------------------------ */

/**
 * « Changer de coiffeur », en un appui de plus, jamais deux.
 *
 * Une rangee de boutons plutot qu'une liste deroulante : le coiffeur a les
 * mains occupees et un salon en a deux ou trois, pas trente. Le menu se replie
 * de lui-meme des que le geste est fait ou qu'on appuie ailleurs.
 */
function boutonTransfert(ticket, file) {
  const autres = (file.postes || []).filter((p) => p.actif && p.id !== ticket.posteChoisiId);
  if (!autres.length) return null;

  const choix = el('div.transfert__choix', { hidden: true },
    el('span.transfert__invite', { texte: t('file.transfertVers') }),
    autres.map((p) => el('button.bouton.bouton--discret.bouton--petit', {
      type: 'button',
      texte: p.coiffeur || p.nom,
      surClick: () => geste('/api/file/' + ticket.id + '/transferer', {
        corps: { posteId: p.id },
        annonce: t('file.attendChez', { prenom: ticket.prenom, coiffeur: p.coiffeur || p.nom }),
      }).catch(() => {}),
    })));

  const bascule = el('button.bouton.bouton--discret.bouton--petit', {
    type: 'button',
    texte: t('file.changerCoiffeur'),
    'aria-expanded': 'false',
    surClick: () => {
      choix.hidden = !choix.hidden;
      bascule.setAttribute('aria-expanded', choix.hidden ? 'false' : 'true');
    },
  });

  return el('div.transfert', bascule, choix);
}

function carteAttente(ticket, index, file = null) {
  const actions = el('div.carte-file__actions',
    el('button.bouton.bouton--discret.bouton--petit', {
      type: 'button',
      texte: t(index === 0 ? 'file.appeler' : 'file.appelerMaintenant'),
      surClick: () => geste('/api/file/' + ticket.id + '/appeler', {
        annonce: t('file.aEteAppele', { prenom: ticket.prenom }),
      }),
    }),
    el('button.bouton.bouton--discret.bouton--petit', {
      type: 'button',
      texte: t('file.servi'),
      surClick: () => geste('/api/file/' + ticket.id + '/servi', {
        annonce: t('file.aEteServi', { prenom: ticket.prenom }),
      }),
    }),
    el('button.bouton.bouton--discret.bouton--petit', {
      type: 'button',
      texte: t('file.champWhatsapp'),
      surClick: () => ouvrirWhatsapp(ticket),
    }),
    el('button.bouton.bouton--discret.bouton--petit.bouton--danger', {
      type: 'button',
      texte: t('commun.annuler'),
      surClick: () => annulerTicket(ticket),
    }),
    // Changer de coiffeur n'a de sens qu'en file par coiffeur : en file
    // unique, il n'y en a qu'une.
    file?.mode === 'PAR_FAUTEUIL' ? boutonTransfert(ticket, file) : null);

  return el('li.carte-file' + (ticket.retards > 0 ? '.carte-file--retard' : ''),
    el('div.carte-file__tete',
      el('span.carte-file__position', { texte: '#' + (index + 1) }),
      el('span.carte-file__numero', { texte: ticket.numero }),
      el('span.carte-file__source', { texte: libelleSource(ticket.source) })),
    el('p.carte-file__nom', { texte: ticket.prenom + ' ' + ticket.nom }),
    prestationsDe(ticket),
    el('p.carte-file__meta',
      el('span', { texte: t('file.arriveA', { heure: heure(ticket.arriveA) }) }),
      el('span', { texte: '·' }),
      el('span', { texte: t('file.attendDepuis', { depuis: depuis(ticket.dansLaFileDepuis) }) }),
      ticket.retards > 0 ? el('span', { texte: '·' }) : null,
      ticket.retards > 0 ? el('span.carte-file__retard', { texte: t('file.absentFois', { n: ticket.retards }) }) : null),
    actions);
}

async function ouvrirWhatsapp(ticket) {
  try {
    const reponse = await api.get('/api/file/' + ticket.id + '/whatsapp');
    // Ouvert dans un onglet neuf : l'ecran de la file reste tel quel derriere.
    window.open(reponse.lienWhatsapp, '_blank', 'noopener');
  } catch (err) {
    signaler(err instanceof ErreurApi ? err.message : t('file.messageEchoue'));
  }
}

/**
 * Prevenir les N prochains, d'un seul geste.
 *
 * Un samedi matin, prevenir trois personnes une par une demande trois
 * allers-retours dans la file : le coiffeur ne le fait pas, et les clients
 * arrivent en retard.
 *
 * Les conversations s'ouvrent UNE PAR UNE, a chaque appui : un navigateur
 * bloque plusieurs fenetres ouvertes d'un coup, et le coiffeur veut de toute
 * facon relire chaque message avant de l'envoyer. Rien n'est envoye par
 * l'application — chaque envoi reste son geste, depuis son telephone.
 */
async function prevenirLesProchains(combien = 3) {
  let items;
  try {
    const reponse = await api.get('/api/file/prochains/whatsapp?combien=' + combien);
    items = reponse.items || [];
  } catch (err) {
    signaler(err instanceof ErreurApi ? err.message : t('file.messagesEchoues'));
    return;
  }
  if (!items.length) {
    annoncer(t('file.personneNAttend'));
    return;
  }

  const restants = items.slice();
  const suivant = () => {
    const client = restants.shift();
    if (!client) return;
    window.open(client.lienWhatsapp, '_blank', 'noopener');
    if (restants.length) {
      // On redemande : ouvrir six onglets sans rien dire serait une surprise.
      if (window.confirm(t('file.messagePrepare', {
        prenom: client.prenom, numero: client.numero, reste: restants.length,
      }))) suivant();
    } else {
      annoncer(t('file.messagesPrepares', { n: items.length }));
    }
  };
  suivant();
}

async function annulerTicket(ticket) {
  const motif = window.prompt(t('file.confirmerAnnulation', { prenom: ticket.prenom, numero: ticket.numero }), '');
  if (motif === null) return;
  await geste('/api/file/' + ticket.id + '/annuler', {
    corps: { motif: motif || undefined },
    annonce: t('file.tourAnnule', { numero: ticket.numero }),
  }).catch(() => {});
}

/* ------------------------------------------------------------------ */
/*  Ajout au comptoir                                                  */
/* ------------------------------------------------------------------ */

function blocComptoir() {
  const prenom = el('input', { id: 'k-prenom', type: 'text', autocomplete: 'off', required: true, placeholder: t('file.champPrenom') });
  const nom = el('input', { id: 'k-nom', type: 'text', autocomplete: 'off', required: true, placeholder: t('file.champNom') });
  const telephone = el('input', { id: 'k-tel', type: 'tel', inputmode: 'tel', autocomplete: 'off', required: true, placeholder: t('file.champWhatsapp') });
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
        annoncer(t('file.tourCreeComptoir', { numero: reponse.numero }));
        prenom.value = '';
        nom.value = '';
        telephone.value = '';
        prenom.focus();
      } catch (err) {
        erreur.textContent = err instanceof ErreurApi ? err.message : t('file.ajoutEchoue');
        erreur.hidden = false;
      }
    },
  },
  erreur,
  el('div.comptoir__champs', prenom, nom, telephone),
  el('button.bouton.bouton--discret', { type: 'submit', texte: t('file.ajouterALaFile') }));

  return el('details.comptoir',
    el('summary', { texte: t('file.ajouterAuComptoir') }),
    el('p.texte-doux', { texte: t('file.ajouterAuComptoirAide') }),
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
  const fauteuils = file.compteurs.fauteuils ?? 1;
  const enTete = el('div.file__chiffres',
    chiffre(attente.length, t('file.chiffreEnAttente', { n: attente.length })),
    chiffre(file.compteurs.servis, t('file.chiffreServis', { n: file.compteurs.servis })),
    chiffre(minutesLisibles(file.attenteEstimeeMinutes), t('file.chiffreAttente')),
    // Le nombre de fauteuils n'a d'interet que s'il y en a plusieurs : sinon
    // c'est une case qui dit « 1 » toute la journee.
    fauteuils > 1
      ? chiffre(file.compteurs.fauteuilsLibres + ' / ' + fauteuils, t('file.chiffreFauteuils'))
      : null);

  // En file par coiffeur, la file se lit coiffeur par coiffeur : une liste
  // melangee n'apprendrait rien a personne, puisque chacun ne sert que la
  // sienne. Les clients sans coiffeur (bascule de mode) sont montres a part —
  // on ne cache jamais quelqu'un qui attend.
  const liste = file.mode === 'PAR_FAUTEUIL'
    ? el('div.files-par-coiffeur',
      (file.postes || []).map((p) => el('section.file-coiffeur',
        el('h3.file-coiffeur__titre',
          el('span', { texte: p.coiffeur || p.nom }),
          el('span.file-coiffeur__compte', {
            texte: t('file.compteEnAttente', { n: p.attente.length })
              + (p.attente.length ? ' · ≈ ' + minutesLisibles(p.attenteEstimeeMinutes) : ''),
          })),
        p.attente.length
          ? el('ul.file__liste', p.attente.map((t, i) => carteAttente(t, i, file)))
          : el('p.file__vide', { texte: t('file.personneChezCeCoiffeur') }))),
      (file.sansFauteuil || []).length
        ? el('section.file-coiffeur.file-coiffeur--orphelins',
          el('h3.file-coiffeur__titre',
            el('span', { texte: t('file.sansCoiffeur') }),
            el('span.file-coiffeur__compte', { texte: t('file.compteEnAttente', { n: file.sansFauteuil.length }) })),
          el('p.texte-doux', { texte: t('file.sansCoiffeurAide') }),
          el('ul.file__liste', file.sansFauteuil.map((t, i) => carteAttente(t, i, file))))
        : null)
    : (attente.length
      ? el('ul.file__liste', attente.map((t, i) => carteAttente(t, i, file)))
      : el('p.file__vide', { texte: t('file.aucunEnAttente') }));

  const termines = (file.termines || []).slice(0, 8);
  const historique = termines.length
    ? el('details.historique',
      el('summary', { texte: t('file.dejaPasses', { n: file.compteurs.servis }) }),
      // `ligne` et non `t` : `t` est desormais le traducteur, et l'ombrer ici
      // aurait donne un « t.statut is not a function » au premier client servi.
      el('ul.historique__liste', termines.map((ligne) => el('li',
        el('span.historique__numero', { texte: ligne.numero }),
        el('span.historique__nom', { texte: ligne.prenom + ' ' + ligne.nom }),
        el('span.historique__statut', { texte: libelleStatut(ligne.statut) }),
        el('span.historique__heure', { texte: heure(ligne.termineA) })))))
    : null;

  remplacer(zone,
    !file.ouverte ? el('p.alerte.alerte--refus', { texte: t('file.journeeClose') }) : null,
    blocPriseDeTour(file.priseDeTour),
    blocFauteuils(file),
    enTete,
    // Le titre disparait aux grandes largeurs (la grille le rend inutile), mais
    // pas le bouton : ils vivent donc dans une enveloppe commune, et c'est le
    // TITRE SEUL que la feuille de style masque.
    el('div.file__entete',
      el('h2.file__titre', { texte: t('file.titreAttente') }),
      // Le bouton n'a de sens qu'a partir de deux personnes : pour une seule,
      // le bouton « WhatsApp » de sa carte fait deja le travail.
      attente.length >= 2
        ? el('button.bouton.bouton--discret.bouton--petit', {
          type: 'button',
          texte: t('file.prevenirProchains', { n: Math.min(3, attente.length) }),
          surClick: () => prevenirLesProchains(Math.min(3, attente.length)),
        })
        : null),
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
      el('p.prise__etat', { texte: t('file.salonEnConges') }),
      el('p.prise__detail', { texte: prise.message }));
  }

  const bouton = el('button', {
    type: 'button',
    classe: 'bouton ' + (prise.ouverte ? 'bouton--absent' : 'bouton--principal'),
    texte: t(prise.ouverte ? 'file.arreterTours' : 'file.reprendreTours'),
    surClick: async () => {
      if (prise.ouverte) {
        const message = window.prompt(t('file.confirmerArret'), '');
        if (message === null) return;
        await geste('/api/file/prise-de-tour', {
          corps: { ouverte: false, message: message || undefined },
          annonce: t('file.toursArretes'),
        }).catch(() => {});
      } else {
        await geste('/api/file/prise-de-tour', {
          corps: { ouverte: true },
          annonce: t('file.toursReprennent'),
        }).catch(() => {});
      }
    },
  });

  return el('div.prise' + (prise.ouverte ? '.prise--ouverte' : '.prise--fermee'),
    el('div.prise__texte',
      el('p.prise__etat', { texte: t(prise.ouverte ? 'file.toursOuverts' : 'file.toursFermes') }),
      prise.message ? el('p.prise__detail', { texte: prise.message }) : null,
      horsHoraires ? el('p.prise__detail', { texte: t('file.horsHoraires') }) : null),
    bouton);
}

/* ------------------------------------------------------------------ */
/*  Vue                                                                */
/* ------------------------------------------------------------------ */

export async function vueFile(conteneur, { etat }) {
  conteneurCourant = conteneur;
  const zone = el('div.enveloppe.file#file', { donnees: { file: '1' } });
  const alerte = el('p.alerte.alerte--refus.file__alerte', { role: 'alert', hidden: true, donnees: { alerte: '1' } });

  // La carte des avis vit HORS de `zone` : `peindre` remplace le contenu de
  // `zone` a chaque battement du temps reel, et la carte y perdrait son etat
  // (et son enregistrement) plusieurs fois par minute.
  remplacer(conteneur, alerte, zone, el('div.enveloppe.avisos__enveloppe', carteAvisos()),
    etat.utilisateur?.role === 'GERANT'
      ? el('div.enveloppe.file__cloture',
        el('button.bouton.bouton--discret.bouton--petit', {
          type: 'button',
          texte: t('file.cloturerJournee'),
          surClick: async () => {
            if (!window.confirm(t('file.confirmerCloture'))) return;
            await geste('/api/file/cloturer', { annonce: t('file.journeeCloturee') }).catch(() => {});
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
