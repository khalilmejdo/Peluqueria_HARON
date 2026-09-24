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
import { carteAvisos } from './avisos.js';

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
    signaler(err instanceof ErreurApi ? err.message : 'La acción no se ha completado.');
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
    ? el('p.actuel__label', { texte: 'Cliente actual' })
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
      el('p.actuel__aucun', { texte: prochain ? 'Sillón libre.' : (parFauteuil ? 'Nadie espera a este peluquero.' : 'No espera nadie.') }),
      prochain
        ? el('div.actuel__suite',
          el('p.actuel__prochain-label', { texte: parFauteuil ? 'Siguiente en su fila' : 'Siguiente en la fila' }),
          el('p.actuel__prochain', { texte: prochain.prenom + ' ' + prochain.nom }),
          el('p.actuel__prochain-numero', { texte: prochain.numero }),
          el('button.bouton.bouton--principal.bouton--geant', {
            type: 'button',
            texte: 'Llamar a ' + prochain.prenom,
            surClick: () => geste('/api/file/suivant', {
              corps: { posteId: poste.id },
              annonce: prochain.prenom + ' ha sido llamado al sillón ' + poste.nom + '.',
            }),
          }))
        : el('p.texte-doux', {
          texte: parFauteuil
            ? 'Puedes coger un cliente de otra fila con « Llamar ahora ».'
            : 'La fila se llenará en cuanto alguien pida turno.',
        }));
  }

  const appele = actuel.statut === 'CALLED';

  return el('section.actuel' + (appele ? '.actuel--appele' : '.actuel--service'),
    enTete,
    el('p.actuel__numero', { texte: actuel.numero }),
    el('h1.actuel__nom', { texte: actuel.prenom + ' ' + actuel.nom }),
    el('p.actuel__etat', { texte: appele ? 'Llamado ' + depuis(actuel.appeleA) : 'En el sillón ' + depuis(actuel.serviA) }),
    actuel.retards > 0
      ? el('p.actuel__retard', { texte: 'Ya ha estado ausente ' + actuel.retards + ' vez/veces hoy.' })
      : null,
    el('button.bouton.bouton--servi', {
      type: 'button',
      surClick: () => geste('/api/file/' + actuel.id + '/servi', { annonce: actuel.prenom + ' ha sido atendido.' }),
    }, 'CLIENTE ATENDIDO ✓'),
    el('div.actuel__secondaires',
      appele
        ? el('button.bouton.bouton--discret', {
          type: 'button',
          texte: 'Empezar el corte',
          surClick: () => geste('/api/file/' + actuel.id + '/commencer'),
        })
        : null,
      el('button.bouton.bouton--absent', {
        type: 'button',
        texte: 'Ausente / con retraso',
        surClick: () => geste('/api/file/' + actuel.id + '/absent', {
          annonce: actuel.prenom + ' pasa al final de la fila.',
        }),
      })));
}

/** Tous les fauteuils, cote a cote. */
function blocFauteuils(file) {
  const postes = file.postes || [];
  if (!postes.length) {
    return el('section.actuel.actuel--vide',
      el('p.actuel__label', { texte: 'Cliente actual' }),
      el('p.actuel__aucun', { texte: 'Ningún sillón abierto.' }),
      el('p.texte-doux', { texte: 'Abre un sillón en Ajustes para poder llamar a un cliente.' }));
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
    el('span.transfert__invite', { texte: 'A:' }),
    autres.map((p) => el('button.bouton.bouton--discret.bouton--petit', {
      type: 'button',
      texte: p.coiffeur || p.nom,
      surClick: () => geste('/api/file/' + ticket.id + '/transferer', {
        corps: { posteId: p.id },
        annonce: ticket.prenom + ' espera ahora a ' + (p.coiffeur || p.nom) + '.',
      }).catch(() => {}),
    })));

  const bascule = el('button.bouton.bouton--discret.bouton--petit', {
    type: 'button',
    texte: 'Cambiar de peluquero',
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
      texte: index === 0 ? 'Llamar' : 'Llamar ahora',
      surClick: () => geste('/api/file/' + ticket.id + '/appeler', { annonce: ticket.prenom + ' ha sido llamado.' }),
    }),
    el('button.bouton.bouton--discret.bouton--petit', {
      type: 'button',
      texte: 'Atendido',
      surClick: () => geste('/api/file/' + ticket.id + '/servi', { annonce: ticket.prenom + ' ha sido atendido.' }),
    }),
    el('button.bouton.bouton--discret.bouton--petit', {
      type: 'button',
      texte: 'WhatsApp',
      surClick: () => ouvrirWhatsapp(ticket),
    }),
    el('button.bouton.bouton--discret.bouton--petit.bouton--danger', {
      type: 'button',
      texte: 'Anular',
      surClick: () => annulerTicket(ticket),
    }),
    // Changer de coiffeur n'a de sens qu'en file par coiffeur : en file
    // unique, il n'y en a qu'une.
    file?.mode === 'PAR_FAUTEUIL' ? boutonTransfert(ticket, file) : null);

  return el('li.carte-file' + (ticket.retards > 0 ? '.carte-file--retard' : ''),
    el('div.carte-file__tete',
      el('span.carte-file__position', { texte: '#' + (index + 1) }),
      el('span.carte-file__numero', { texte: ticket.numero }),
      el('span.carte-file__source', { texte: LIBELLE_SOURCE[ticket.source] || ticket.source })),
    el('p.carte-file__nom', { texte: ticket.prenom + ' ' + ticket.nom }),
    el('p.carte-file__meta',
      el('span', { texte: 'Llegó a las ' + heure(ticket.arriveA) }),
      el('span', { texte: '·' }),
      el('span', { texte: 'Espera ' + depuis(ticket.dansLaFileDepuis) }),
      ticket.retards > 0 ? el('span', { texte: '·' }) : null,
      ticket.retards > 0 ? el('span.carte-file__retard', { texte: 'ausente ' + ticket.retards + '×' }) : null),
    actions);
}

async function ouvrirWhatsapp(ticket) {
  try {
    const reponse = await api.get('/api/file/' + ticket.id + '/whatsapp');
    // Ouvert dans un onglet neuf : l'ecran de la file reste tel quel derriere.
    window.open(reponse.lienWhatsapp, '_blank', 'noopener');
  } catch (err) {
    signaler(err instanceof ErreurApi ? err.message : 'No se ha podido preparar el mensaje.');
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
    signaler(err instanceof ErreurApi ? err.message : 'No se ha podido preparar los mensajes.');
    return;
  }
  if (!items.length) {
    annoncer('Nadie está esperando.');
    return;
  }

  const restants = items.slice();
  const suivant = () => {
    const client = restants.shift();
    if (!client) return;
    window.open(client.lienWhatsapp, '_blank', 'noopener');
    if (restants.length) {
      // On redemande : ouvrir six onglets sans rien dire serait une surprise.
      if (window.confirm('Mensaje preparado para ' + client.prenom + ' (' + client.numero + ').\n\n'
        + '¿Preparar el siguiente? Quedan ' + restants.length + '.')) suivant();
    } else {
      annoncer(items.length + ' mensaje(s) preparado(s).');
    }
  };
  suivant();
}

async function annulerTicket(ticket) {
  const motif = window.prompt('¿Anular el turno de ' + ticket.prenom + ' (' + ticket.numero + ')?\nMotivo (opcional):', '');
  if (motif === null) return;
  await geste('/api/file/' + ticket.id + '/annuler', {
    corps: { motif: motif || undefined },
    annonce: 'Turno ' + ticket.numero + ' anulado.',
  }).catch(() => {});
}

/* ------------------------------------------------------------------ */
/*  Ajout au comptoir                                                  */
/* ------------------------------------------------------------------ */

function blocComptoir() {
  const prenom = el('input', { id: 'k-prenom', type: 'text', autocomplete: 'off', required: true, placeholder: 'Nombre' });
  const nom = el('input', { id: 'k-nom', type: 'text', autocomplete: 'off', required: true, placeholder: 'Apellido' });
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
        annoncer('Turno ' + reponse.numero + ' creado en el mostrador.');
        prenom.value = '';
        nom.value = '';
        telephone.value = '';
        prenom.focus();
      } catch (err) {
        erreur.textContent = err instanceof ErreurApi ? err.message : 'No se ha podido añadir a este cliente.';
        erreur.hidden = false;
      }
    },
  },
  erreur,
  el('div.comptoir__champs', prenom, nom, telephone),
  el('button.bouton.bouton--discret', { type: 'submit', texte: 'Añadir a la fila' }));

  return el('details.comptoir',
    el('summary', { texte: 'Añadir un cliente en el mostrador' }),
    el('p.texte-doux', { texte: 'Para el cliente que no lleva el móvil a mano. Entra en la misma fila, a continuación.' }),
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
    chiffre(attente.length, attente.length === 1 ? 'cliente esperando' : 'clientes esperando'),
    chiffre(file.compteurs.servis, file.compteurs.servis === 1 ? 'cliente atendido' : 'clientes atendidos'),
    chiffre(minutesLisibles(file.attenteEstimeeMinutes), 'de espera estimada'),
    // Le nombre de fauteuils n'a d'interet que s'il y en a plusieurs : sinon
    // c'est une case qui dit « 1 » toute la journee.
    fauteuils > 1
      ? chiffre(file.compteurs.fauteuilsLibres + ' / ' + fauteuils, 'sillones libres')
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
            texte: p.attente.length + ' esperando'
              + (p.attente.length ? ' · ≈ ' + minutesLisibles(p.attenteEstimeeMinutes) : ''),
          })),
        p.attente.length
          ? el('ul.file__liste', p.attente.map((t, i) => carteAttente(t, i, file)))
          : el('p.file__vide', { texte: 'Nadie espera a este peluquero.' }))),
      (file.sansFauteuil || []).length
        ? el('section.file-coiffeur.file-coiffeur--orphelins',
          el('h3.file-coiffeur__titre',
            el('span', { texte: 'Sin peluquero' }),
            el('span.file-coiffeur__compte', { texte: file.sansFauteuil.length + ' esperando' })),
          el('p.texte-doux', { texte: 'Estos clientes pidieron turno antes del cambio de organización. Llámalos desde el sillón que quieras.' }),
          el('ul.file__liste', file.sansFauteuil.map((t, i) => carteAttente(t, i, file))))
        : null)
    : (attente.length
      ? el('ul.file__liste', attente.map((t, i) => carteAttente(t, i, file)))
      : el('p.file__vide', { texte: 'Ningún cliente esperando.' }));

  const termines = (file.termines || []).slice(0, 8);
  const historique = termines.length
    ? el('details.historique',
      el('summary', { texte: 'Ya han pasado hoy (' + file.compteurs.servis + ')' }),
      el('ul.historique__liste', termines.map((t) => el('li',
        el('span.historique__numero', { texte: t.numero }),
        el('span.historique__nom', { texte: t.prenom + ' ' + t.nom }),
        el('span.historique__statut', { texte: LIBELLE_STATUT[t.statut] || t.statut }),
        el('span.historique__heure', { texte: heure(t.termineA) })))))
    : null;

  remplacer(zone,
    !file.ouverte ? el('p.alerte.alerte--refus', { texte: 'La jornada está cerrada. La fila volverá a empezar mañana en A001.' }) : null,
    blocPriseDeTour(file.priseDeTour),
    blocFauteuils(file),
    enTete,
    // Le titre disparait aux grandes largeurs (la grille le rend inutile), mais
    // pas le bouton : ils vivent donc dans une enveloppe commune, et c'est le
    // TITRE SEUL que la feuille de style masque.
    el('div.file__entete',
      el('h2.file__titre', { texte: 'Fila de espera' }),
      // Le bouton n'a de sens qu'a partir de deux personnes : pour une seule,
      // le bouton « WhatsApp » de sa carte fait deja le travail.
      attente.length >= 2
        ? el('button.bouton.bouton--discret.bouton--petit', {
          type: 'button',
          texte: 'Avisar a los ' + Math.min(3, attente.length) + ' siguientes',
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
      el('p.prise__etat', { texte: 'Salón cerrado (vacaciones)' }),
      el('p.prise__detail', { texte: prise.message }));
  }

  const bouton = el('button', {
    type: 'button',
    classe: 'bouton ' + (prise.ouverte ? 'bouton--absent' : 'bouton--principal'),
    texte: prise.ouverte ? 'Dejar de dar turnos' : 'Volver a dar turnos',
    surClick: async () => {
      if (prise.ouverte) {
        const message = window.prompt(
          '¿Dejar de dar turnos?\n\nQuien espera será atendido con normalidad; no entrará nadie nuevo.\n\nMensaje que verán los clientes (opcional):',
          '',
        );
        if (message === null) return;
        await geste('/api/file/prise-de-tour', {
          corps: { ouverte: false, message: message || undefined },
          annonce: 'Ya no se dan turnos.',
        }).catch(() => {});
      } else {
        await geste('/api/file/prise-de-tour', {
          corps: { ouverte: true },
          annonce: 'Se vuelven a dar turnos.',
        }).catch(() => {});
      }
    },
  });

  return el('div.prise' + (prise.ouverte ? '.prise--ouverte' : '.prise--fermee'),
    el('div.prise__texte',
      el('p.prise__etat', { texte: prise.ouverte ? 'Los clientes pueden pedir turno' : 'No se dan turnos' }),
      prise.message ? el('p.prise__detail', { texte: prise.message }) : null,
      horsHoraires ? el('p.prise__detail', { texte: 'Fuera del horario de apertura configurado.' }) : null),
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
          texte: 'Cerrar la jornada',
          surClick: async () => {
            if (!window.confirm('¿Cerrar la jornada?\nLos turnos que sigan en la fila se anularán y la numeración volverá a empezar mañana en A001.')) return;
            await geste('/api/file/cloturer', { annonce: 'Jornada cerrada.' }).catch(() => {});
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
