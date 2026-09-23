/**
 * La page de suivi d'un tour.
 *
 * Elle est deja complete quand elle arrive : ce module ne fait que la garder
 * juste. Un flux d'evenements l'informe a l'instant ou le coiffeur agit ; si le
 * flux tombe (tunnel, veille du telephone), une relecture ordinaire prend le
 * relais au retour a l'ecran.
 */
import { donneesInitiales, poser, envoyer, suivreFlux } from './commun.js';

const initial = donneesInitiales();
if (initial?.jeton) demarrer(initial.jeton, initial.vue);

function demarrer(jeton, premiereVue) {
  const carte = document.querySelector('[data-ticket]');
  const elements = {
    numero: document.querySelector('[data-numero]'),
    prenom: document.querySelector('[data-prenom]'),
    titre: document.querySelector('[data-titre]'),
    detail: document.querySelector('[data-detail]'),
    devant: document.querySelector('[data-devant]'),
    estimation: document.querySelector('[data-estimation]'),
  };
  const bouton = document.querySelector('[data-annuler]');
  const erreur = document.querySelector('[data-annuler-erreur]');

  let derniere = premiereVue || null;

  const TONS = ['attente', 'proche', 'tour', 'fini'];

  function afficher(vue) {
    if (!vue) return;
    const precedente = derniere;
    derniere = vue;

    poser(elements.numero, vue.numero);
    poser(elements.prenom, vue.prenom);
    poser(elements.titre, vue.titre);
    poser(elements.detail, vue.detail);
    poser(elements.devant, vue.devant);
    poser(elements.estimation, vue.estimationCourte);

    if (carte) {
      for (const ton of TONS) carte.classList.toggle('ticket--' + ton, vue.ton === ton);
    }
    document.title = 'Ticket ' + vue.numero + ' — ' + (vue.nomSalon || 'Peluquería HARON');

    // Le client a posé son téléphone sur la table : une vibration courte au
    // moment où son tour arrive vaut mieux qu'un écran qu'il ne regarde pas.
    if (precedente && precedente.phase !== 'VOTRE_TOUR' && vue.phase === 'VOTRE_TOUR') {
      if (typeof navigator.vibrate === 'function') navigator.vibrate([120, 70, 120]);
    }

    if (bouton) bouton.hidden = !vue.actif;
  }

  async function relire() {
    try {
      afficher(await envoyer('/api/public/tickets/' + encodeURIComponent(jeton), { methode: 'GET' }));
    } catch {
      // Hors ligne : la page garde le dernier etat connu, ce qui est honnete.
    }
  }

  suivreFlux('/api/public/tickets/' + encodeURIComponent(jeton) + '/flux', {
    sur: {
      ticket: afficher,
      fin: () => {
        if (elements.titre) elements.titre.textContent = 'Ce tour est terminé.';
        if (elements.detail) elements.detail.textContent = 'La journée du salon est close. À bientôt.';
        if (bouton) bouton.hidden = true;
      },
    },
    auReveil: relire,
  });

  if (bouton) {
    bouton.addEventListener('click', async () => {
      if (!window.confirm('Libérer votre place dans la file ? Vous devrez reprendre un tour pour revenir.')) return;
      bouton.disabled = true;
      if (erreur) erreur.hidden = true;
      try {
        await envoyer('/api/public/tickets/' + encodeURIComponent(jeton) + '/annuler');
        window.location.reload();
      } catch (err) {
        bouton.disabled = false;
        if (erreur) {
          erreur.textContent = err.message;
          erreur.hidden = false;
        }
      }
    });
  }
}
