/**
 * L'EN-TETE DES PAGES DU CLIENT : l'etat « defile » et le menu du telephone.
 *
 * Importe pour son effet par chaque page qui porte un en-tete. Sans lui, la
 * page reste complete : sur grand ecran la navigation est visible, et sur
 * telephone le bouton de reservation l'est aussi.
 */

function activerEntete() {
  const entete = document.querySelector('[data-entete]');
  if (!entete) return;

  // Pose sur une photo, l'en-tete est transparent ; des qu'on defile, il prend
  // un fond (et une ombre) pour rester lisible sur tout ce qui passe dessous.
  let dernier = null;
  const suivre = () => {
    const defile = window.scrollY > 24;
    if (defile !== dernier) {
      entete.classList.toggle('entete--defile', defile);
      dernier = defile;
    }
  };
  suivre();
  window.addEventListener('scroll', suivre, { passive: true });

  const bouton = entete.querySelector('[data-menu]');
  const tiroir = entete.querySelector('[data-tiroir]');
  if (!bouton || !tiroir) return;

  const ouvrir = (oui) => {
    bouton.setAttribute('aria-expanded', String(oui));
    tiroir.hidden = !oui;
    entete.classList.toggle('entete--ouvert', oui);
    document.documentElement.classList.toggle('sans-defilement', oui);
  };
  bouton.addEventListener('click', () => ouvrir(bouton.getAttribute('aria-expanded') !== 'true'));
  // Un lien du menu mene plus bas dans la page : le menu se referme.
  tiroir.addEventListener('click', (evenement) => {
    if (evenement.target.closest('a')) ouvrir(false);
  });
  document.addEventListener('keydown', (evenement) => {
    if (evenement.key === 'Escape' && bouton.getAttribute('aria-expanded') === 'true') {
      ouvrir(false);
      bouton.focus();
    }
  });
  // Revenu en grand ecran, le tiroir n'a plus de raison d'etre.
  window.matchMedia('(min-width: 60rem)').addEventListener('change', (m) => {
    if (m.matches) ouvrir(false);
  });
}

activerEntete();
