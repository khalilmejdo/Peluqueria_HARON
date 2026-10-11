/**
 * LA PAGE D'UN RENDEZ-VOUS : copier ou envoyer son lien, confirmer avant
 * d'annuler. Sans script, le lien se lit et se copie a la main, et
 * l'annulation part directement.
 */
import './entete.js';
import { activerHorsLigne } from './commun.js';

activerHorsLigne();

const copier = document.querySelector('[data-copier]');
const partager = document.querySelector('[data-partager]');
const retour = document.querySelector('[data-copie]');

copier?.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(copier.dataset.valeur);
    if (retour) {
      retour.hidden = false;
      clearTimeout(Number(retour.dataset.minuterie));
      retour.dataset.minuterie = String(setTimeout(() => { retour.hidden = true; }, 4000));
    }
  } catch {
    // Presse-papiers refuse : le lien reste affiche en entier, on le copie a la main.
  }
});

if (partager && navigator.share) {
  partager.hidden = false;
  partager.addEventListener('click', () => {
    navigator.share({ url: copier?.dataset.valeur || location.href, title: document.title }).catch(() => {});
  });
}

const annuler = document.querySelector('[data-annuler-rdv]');
annuler?.addEventListener('submit', (evenement) => {
  if (!window.confirm(annuler.dataset.confirmation || '')) evenement.preventDefault();
});
