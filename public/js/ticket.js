/**
 * La page de suivi d'un tour.
 *
 * Elle est deja complete quand elle arrive : ce module ne fait que la garder
 * juste. Un flux d'evenements l'informe a l'instant ou le coiffeur agit ; si le
 * flux tombe (tunnel, veille du telephone), une relecture ordinaire prend le
 * relais au retour a l'ecran.
 */
import { donneesInitiales, poser, envoyer, suivreFlux, activerHorsLigne, bandeauHorsLigne } from './commun.js';
import { t } from './langue.js';

// La page de suivi est celle qu'un client rafraichit dans le salon, la ou la 4G
// passe mal : c'est elle qui a le plus besoin de tenir sans reseau.
activerHorsLigne();

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
  const reseau = bandeauHorsLigne();

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
    document.title = t('ticket.titrePage', { numero: vue.numero, nom: vue.nomSalon || 'Peluquería HARON' });

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
      reseau.reussite();
    } catch {
      // La page garde le dernier etat connu — mais elle le DIT, au lieu de
      // laisser croire que « 3 personnes devant vous » est encore vrai.
      reseau.echec();
    }
  }

  suivreFlux('/api/public/tickets/' + encodeURIComponent(jeton) + '/flux', {
    sur: {
      ticket: (vue) => { reseau.reussite(); afficher(vue); },
      fin: () => {
        if (elements.titre) elements.titre.textContent = t('ticket.termine');
        if (elements.detail) elements.detail.textContent = t('ticket.journeeClose');
        if (bouton) bouton.hidden = true;
      },
    },
    auReveil: relire,
  });

  /* ---------------- garder son lien ---------------- */

  /**
   * Le lien de suivi est le seul moyen de revenir : ni compte, ni mot de passe.
   *
   * « Copier » suffit sur un ordinateur. Sur un telephone, « Envoyer » ouvre le
   * partage du systeme : le client s'envoie le lien sur WhatsApp lui-meme, en
   * deux appuis et sans que le salon paie quoi que ce soit.
   */
  const boutonCopier = document.querySelector('[data-copier]');
  const boutonPartager = document.querySelector('[data-partager]');
  const retour = document.querySelector('[data-copie]');
  const lien = boutonCopier?.dataset.valeur || window.location.href.split('?')[0];

  const confirmer = (message) => {
    if (!retour) return;
    retour.textContent = message;
    retour.hidden = false;
    clearTimeout(retour.dataset.minuterie);
    retour.dataset.minuterie = String(setTimeout(() => { retour.hidden = true; }, 4000));
  };

  if (boutonCopier) {
    boutonCopier.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(lien);
        confirmer(t('ticket.copie'));
      } catch {
        // Presse-papiers refuse (page non securisee, permission) : on
        // selectionne le lien pour que le client le copie lui-meme.
        const adresse = document.querySelector('[data-lien]');
        if (adresse) {
          const plage = document.createRange();
          plage.selectNodeContents(adresse);
          const selection = window.getSelection();
          selection.removeAllRanges();
          selection.addRange(plage);
          confirmer(t('ticket.selectionne'));
        }
      }
    });
  }

  if (boutonPartager && typeof navigator.share === 'function') {
    boutonPartager.hidden = false;
    boutonPartager.addEventListener('click', async () => {
      const numero = derniere?.numero || '';
      const salon = derniere?.nomSalon || t('commun.leSalon');
      try {
        await navigator.share({
          // Ces deux phrases etaient EN FRANCAIS dans une application
          // espagnole : la feuille de partage du telephone montrait « Mon tour
          // chez … » a un client de Fuente Alamo. Invisible en relisant le code,
          // visible seulement en appuyant sur « Envoyer le lien ».
          title: t('ticket.partageTitre', { salon }),
          text: t('ticket.partageTexte', { numero, salon }),
          url: lien,
        });
      } catch {
        // Partage annule par le client : rien a signaler.
      }
    });
  }

  /* ---------------- renoncer a son tour ---------------- */

  if (bouton) {
    bouton.addEventListener('click', async () => {
      if (!window.confirm(t('ticket.confirmerAnnulation'))) return;
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
