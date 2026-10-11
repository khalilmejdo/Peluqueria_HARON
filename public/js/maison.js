/**
 * LA VITRINE, COTE NAVIGATEUR.
 *
 * Rien ici n'est necessaire : la page est complete sans script. On ajoute le
 * confort — l'attente qui se met a jour, les sections qui arrivent, la
 * section courante dans le menu, la visionneuse, la carte au clic, la barre
 * d'appel sur telephone.
 */
import './entete.js';
import { envoyer, activerHorsLigne, bandeauHorsLigne } from './commun.js';
import { t, dureeNue } from './langue.js';

activerHorsLigne();

const mouvementAccepte = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ------------------------------------------------------------------ */
/*  L'attente, en direct                                               */
/* ------------------------------------------------------------------ */

const direct = document.querySelector('[data-affluence]');
const court = document.querySelector('[data-affluence-court] [data-texte]');

/** Change un texte en le faisant briller une fois : un chiffre qui saute sans rien dire passe inapercu. */
function poser(element, texte) {
  if (!element || element.textContent === texte) return;
  element.textContent = texte;
  element.classList.remove('vient-de-changer');
  void element.offsetWidth;
  element.classList.add('vient-de-changer');
}

if (direct || court) {
  const forte = direct?.querySelector('[data-forte]');
  const detail = direct?.querySelector('[data-detail]');
  const reseau = bandeauHorsLigne();

  const rafraichir = async () => {
    if (document.visibilityState !== 'visible') return;
    try {
      const etat = await envoyer('/api/public/file', { methode: 'GET' });
      const libre = etat.enAttente === 0;
      const titre = libre ? t('accueil.sansAttente') : t('accueil.enFile', { n: etat.enAttente });
      poser(forte, titre);
      poser(detail, libre ? t('accueil.sansAttenteDetail') : t('accueil.attenteEstimee', { duree: '≈ ' + dureeNue(etat.attenteEstimeeMinutes) }));
      poser(court, titre);
      reseau.reussite();
    } catch {
      reseau.echec();
    }
  };
  const minuterie = setInterval(rafraichir, 20000);
  window.addEventListener('pagehide', () => clearInterval(minuterie));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') rafraichir();
  });
}

/* ------------------------------------------------------------------ */
/*  Les sections arrivent au defilement                                */
/* ------------------------------------------------------------------ */

if (mouvementAccepte && 'IntersectionObserver' in window) {
  const cibles = document.querySelectorAll('.section, .reperes');
  const observateur = new IntersectionObserver((entrees) => {
    for (const entree of entrees) {
      if (!entree.isIntersecting) continue;
      entree.target.classList.add('est-arrivee');
      observateur.unobserve(entree.target);
    }
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.06 });
  for (const cible of cibles) {
    cible.classList.add('a-arriver');
    observateur.observe(cible);
  }
}

/* ------------------------------------------------------------------ */
/*  La section courante, dans le menu                                  */
/* ------------------------------------------------------------------ */

const liensNav = [...document.querySelectorAll('.entete__lien')];
if (liensNav.length && 'IntersectionObserver' in window) {
  const parAncre = new Map(liensNav.map((l) => [l.getAttribute('href').replace('/#', ''), l]));
  const sections = [...parAncre.keys()].map((id) => document.getElementById(id)).filter(Boolean);
  const lecture = new IntersectionObserver((entrees) => {
    for (const entree of entrees) {
      if (!entree.isIntersecting) continue;
      for (const l of liensNav) l.removeAttribute('aria-current');
      parAncre.get(entree.target.id)?.setAttribute('aria-current', 'true');
    }
  }, { rootMargin: '-45% 0px -50% 0px' });
  for (const s of sections) lecture.observe(s);
  // En haut de page, aucune section n'est « courante » : l'ouverture n'en est pas une.
  window.addEventListener('scroll', () => {
    if (window.scrollY < 200) for (const l of liensNav) l.removeAttribute('aria-current');
  }, { passive: true });
}

/* ------------------------------------------------------------------ */
/*  La barre d'appel, sur telephone                                    */
/* ------------------------------------------------------------------ */

/**
 * Elle suit le pouce quand l'appel du haut n'est plus visible, et s'efface
 * des que la section de reservation (ou l'appel du haut) est a l'ecran : deux
 * boutons identiques l'un sur l'autre ne disent rien de plus.
 */
const barreAppel = document.querySelector('[data-appel-fixe]');
if (barreAppel && 'IntersectionObserver' in window) {
  const visibles = new Set();
  const veille = new IntersectionObserver((entrees) => {
    for (const entree of entrees) {
      if (entree.isIntersecting) visibles.add(entree.target);
      else visibles.delete(entree.target);
    }
    barreAppel.classList.toggle('appel-fixe--montree', visibles.size === 0);
  }, { rootMargin: '-8px 0px 0px 0px' });
  for (const cible of [document.querySelector('[data-appel-principal]'), document.getElementById('reserver')]) {
    if (cible) veille.observe(cible);
  }
}

/* ------------------------------------------------------------------ */
/*  La visionneuse de la galerie                                       */
/* ------------------------------------------------------------------ */

const visionneuse = document.querySelector('[data-visionneuse]');
const vignettes = [...document.querySelectorAll('[data-agrandir]')];

if (visionneuse && vignettes.length) {
  const image = visionneuse.querySelector('[data-image]');
  const legende = visionneuse.querySelector('[data-legende-grande]');
  let courante = 0;
  let origine = null;

  const montrer = (i) => {
    courante = (i + vignettes.length) % vignettes.length;
    const v = vignettes[courante];
    image.src = v.getAttribute('href');
    image.alt = v.dataset.legende || v.querySelector('img')?.alt || '';
    legende.textContent = v.dataset.legende || '';
  };
  const ouvrir = (i, depuis) => {
    origine = depuis;
    montrer(i);
    visionneuse.hidden = false;
    document.documentElement.classList.add('sans-defilement');
    visionneuse.querySelector('[data-fermer]').focus();
  };
  const fermer = () => {
    visionneuse.hidden = true;
    document.documentElement.classList.remove('sans-defilement');
    image.removeAttribute('src');
    origine?.focus();
  };

  vignettes.forEach((v, i) => v.addEventListener('click', (evenement) => {
    evenement.preventDefault();
    ouvrir(i, v);
  }));
  visionneuse.querySelector('[data-fermer]').addEventListener('click', fermer);
  visionneuse.querySelector('[data-precedente]').addEventListener('click', () => montrer(courante - 1));
  visionneuse.querySelector('[data-suivante]').addEventListener('click', () => montrer(courante + 1));
  visionneuse.addEventListener('click', (evenement) => { if (evenement.target === visionneuse) fermer(); });
  document.addEventListener('keydown', (evenement) => {
    if (visionneuse.hidden) return;
    if (evenement.key === 'Escape') fermer();
    else if (evenement.key === 'ArrowLeft') montrer(courante - 1);
    else if (evenement.key === 'ArrowRight') montrer(courante + 1);
  });
  // Au doigt : un glissement change de photo.
  let departX = null;
  visionneuse.addEventListener('pointerdown', (evenement) => { departX = evenement.clientX; });
  visionneuse.addEventListener('pointerup', (evenement) => {
    if (departX === null) return;
    const ecart = evenement.clientX - departX;
    departX = null;
    if (Math.abs(ecart) > 50) montrer(courante + (ecart < 0 ? 1 : -1));
  });
}

/* ------------------------------------------------------------------ */
/*  Le ruban de la galerie                                             */
/* ------------------------------------------------------------------ */

/**
 * Les deux fleches du ruban. Elles restent cachees tant que le script n'a pas
 * constate qu'il y a de quoi defiler : sans JavaScript, ou sur un ecran assez
 * large pour tout montrer, deux boutons morts n'ont rien a faire la.
 */
const ruban = document.querySelector('[data-ruban]');
const fleches = document.querySelector('[data-ruban-fleches]');
if (ruban && fleches) {
  const avant = fleches.querySelector('[data-ruban-avant]');
  const apres = fleches.querySelector('[data-ruban-apres]');
  const mesurer = () => {
    const course = ruban.scrollWidth - ruban.clientWidth;
    fleches.hidden = course <= 4;
    avant.disabled = ruban.scrollLeft <= 4;
    apres.disabled = ruban.scrollLeft >= course - 4;
  };
  const avancer = (sens) => ruban.scrollBy({ left: sens * ruban.clientWidth * 0.8, behavior: 'smooth' });
  avant.addEventListener('click', () => avancer(-1));
  apres.addEventListener('click', () => avancer(1));
  ruban.addEventListener('scroll', mesurer, { passive: true });
  window.addEventListener('resize', mesurer);
  window.addEventListener('load', mesurer);
  mesurer();
}

/* ------------------------------------------------------------------ */
/*  La carte, au clic                                                  */
/* ------------------------------------------------------------------ */

/**
 * Aucune requete vers un tiers avant que le visiteur le demande : le plan
 * dessine reste en place jusqu'a l'appui, puis la vraie carte le remplace,
 * centree sur la porte du salon.
 */
const carte = document.querySelector('[data-carte]');
const boutonCarte = carte?.querySelector('[data-afficher-carte]');
if (carte && boutonCarte) {
  boutonCarte.addEventListener('click', () => {
    const lat = Number(carte.dataset.lat);
    const lon = Number(carte.dataset.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
    const marge = { lat: 0.0022, lon: 0.0036 };
    const cadre = [lon - marge.lon, lat - marge.lat, lon + marge.lon, lat + marge.lat].map((n) => n.toFixed(6)).join(',');
    const iframe = document.createElement('iframe');
    iframe.className = 'plan-carte__iframe';
    iframe.title = carte.dataset.titre || '';
    iframe.loading = 'lazy';
    iframe.referrerPolicy = 'no-referrer';
    iframe.src = 'https://www.openstreetmap.org/export/embed.html?bbox=' + encodeURIComponent(cadre)
      + '&layer=mapnik&marker=' + encodeURIComponent(lat.toFixed(6) + ',' + lon.toFixed(6));
    carte.querySelector('.plan-carte__devant')?.remove();
    carte.querySelector('.plan-carte__fond')?.remove();
    carte.append(iframe);
  });
}
