/**
 * LA RESERVATION, SANS RECHARGEMENT.
 *
 * La page marche sans script : chaque choix se valide par « Voir les heures ».
 * Ici, on fait la meme chose sans quitter la page : a chaque choix (prestation,
 * professionnel, jour), on redemande CETTE page au serveur avec le nouveau
 * choix et on remplace les zones qui en dependent — les jours, les heures, le
 * recapitulatif et les champs caches du formulaire de confirmation. Les
 * coordonnees deja tapees ne bougent pas.
 *
 * Une seule facon de dessiner un creneau : celle du serveur. Le script ne
 * construit aucun HTML de creneau lui-meme.
 */
import './entete.js';
import { activerHorsLigne } from './commun.js';
import { t } from './langue.js';

activerHorsLigne();
document.documentElement.classList.add('js');

const choix = document.getElementById('form-choix');
const reservation = document.querySelector('[data-reservation]');

/** Garde le jour coche visible dans la bande, sans faire defiler la page. */
function centrerLeJour() {
  const bande = document.querySelector('[data-bande-jours]');
  const coche = bande?.querySelector('input:checked + label');
  if (!bande || !coche) return;
  bande.scrollLeft = coche.offsetLeft - bande.clientWidth / 2 + coche.clientWidth / 2;
}

function synchroniserBouton() {
  const bouton = document.querySelector('[data-reserver]');
  const heure = document.querySelector('input[name="heure"]:checked');
  const jour = document.querySelector('[data-cache] input[name="jour"]');
  if (bouton) bouton.disabled = !(heure && jour && jour.value);
}

if (choix && reservation) {
  let enCours = null;
  let minuterie = null;

  const recharger = async (ancreApres = null) => {
    const adresse = '/rendez-vous?' + new URLSearchParams(new FormData(choix)).toString();
    enCours?.abort();
    enCours = new AbortController();
    reservation.classList.add('reservation--charge');
    try {
      const reponse = await fetch(adresse, { signal: enCours.signal, headers: { Accept: 'text/html' } });
      const doc = new DOMParser().parseFromString(await reponse.text(), 'text/html');
      for (const selecteur of ['#etape-jour', '#etape-heure', '[data-resume]', '[data-cache]']) {
        const neuf = doc.querySelector(selecteur);
        const actuel = document.querySelector(selecteur);
        if (neuf && actuel) actuel.replaceWith(neuf);
      }
      history.replaceState(null, '', adresse);
      centrerLeJour();
      synchroniserBouton();
      if (ancreApres) {
        const cible = document.querySelector(ancreApres);
        const bas = cible?.getBoundingClientRect().top ?? 0;
        if (cible && bas > window.innerHeight * 0.7) cible.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } catch (err) {
      if (err?.name !== 'AbortError') choix.submit();
    } finally {
      reservation.classList.remove('reservation--charge');
    }
  };

  // Les champs du choix vivent ailleurs dans la page (attribut form) : on
  // ecoute le document, et on ne retient que les leurs.
  document.addEventListener('change', (evenement) => {
    const champ = evenement.target;
    if (!(champ instanceof HTMLInputElement)) return;
    if (champ.form === choix) {
      clearTimeout(minuterie);
      // Une prestation cochee, puis une autre : un seul aller-retour.
      minuterie = setTimeout(() => recharger(champ.name === 'jour' ? '#etape-heure' : null), champ.name === 'p' ? 220 : 0);
      return;
    }
    if (champ.name === 'heure') {
      const quand = document.querySelector('[data-resume-quand]');
      if (quand) quand.textContent = quand.dataset.jour + ' · ' + champ.value;
      synchroniserBouton();
      const coordonnees = document.getElementById('form-confirmer');
      const bas = coordonnees?.getBoundingClientRect().top ?? 0;
      if (coordonnees && bas > window.innerHeight * 0.8) coordonnees.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });

  centrerLeJour();
  synchroniserBouton();
}

/* Le telephone : des chiffres, des espaces, un « + ». */
const telephone = document.getElementById('rdv-telephone');
telephone?.addEventListener('input', () => {
  const propre = telephone.value.replace(/[^0-9+()./ -]/g, '');
  if (propre !== telephone.value) telephone.value = propre;
});

/* Un seul envoi : un double appui ne reserve pas deux fois. */
const confirmer = document.getElementById('form-confirmer');
confirmer?.addEventListener('submit', () => {
  const bouton = confirmer.querySelector('[data-reserver]');
  if (!bouton) return;
  setTimeout(() => {
    bouton.disabled = true;
    bouton.textContent = t('rdvp.enCours');
  }, 0);
});
