/**
 * L'accueil : l'affluence bouge toute seule, et les sections arrivent au fil
 * du defilement.
 *
 * Un client qui hesite devant la vitrine garde la page ouverte deux minutes. Il
 * doit voir la file vivre. Une lecture toutes les vingt secondes suffit, et
 * elle ne part que si l'onglet est visible — inutile d'interroger le serveur
 * pour un telephone rangé dans une poche.
 *
 * Rien ici n'est indispensable : sans JavaScript, la page reste juste, elle ne
 * se met simplement plus a jour d'elle-meme.
 */
import { envoyer, activerHorsLigne, bandeauHorsLigne } from './commun.js';
import { t, dureeNue } from './langue.js';

// La vitrine se garde aussi : un passant qui la rouvre sans reseau voit le
// salon, pas l'ecran d'erreur du navigateur.
activerHorsLigne();

const INTERVALLE_MS = 20000;

/* ------------------------------------------------------------------ */
/*  L'affluence, en direct                                             */
/* ------------------------------------------------------------------ */

const bloc = document.querySelector('[data-affluence]');

if (bloc) {
  const forte = bloc.querySelector('[data-forte]');
  const detail = bloc.querySelector('[data-detail]');
  const servis = bloc.querySelector('[data-servis]');
  const reseau = bandeauHorsLigne();

  /**
   * Change un texte en le faisant clignoter une fois.
   *
   * Un chiffre qui saute de 3 a 2 sans rien dire passe inapercu ; c'est
   * pourtant l'information la plus importante de la page. La classe est retiree
   * a la fin de l'animation, pour que le prochain changement la rejoue.
   */
  const poser = (element, texte) => {
    if (!element || element.textContent === texte) return;
    element.textContent = texte;
    element.classList.remove('vient-de-changer');
    // Forcer un reflow relance l'animation meme si la classe revient aussitot.
    void element.offsetWidth;
    element.classList.add('vient-de-changer');
  };

  /**
   * La file en marques : une par personne qui attend.
   *
   * ON N'ANIME QUE CE QUI CHANGE VRAIMENT. Une rangée qui ondulerait en
   * permanence dirait que la file avance alors qu'elle stagne peut-être depuis
   * dix minutes — c'est précisément le mensonge qu'une animation décorative
   * fait dire à une page. Ici, une marque n'apparaît que quand quelqu'un entre,
   * et ne part que quand quelqu'un passe au fauteuil.
   *
   * Les départs s'animent AVANT d'être retirés du document : enlever l'élément
   * tout de suite ferait sauter la rangée, et un saut se remarque bien plus
   * qu'un mouvement.
   */
  const MARQUES_MAX = 10;
  const cola = bloc.querySelector('[data-cola]');

  const poserCola = (enAttente) => {
    if (!cola) return;
    const n = Math.max(0, Math.trunc(Number(enAttente) || 0));
    const voulues = Math.min(n, MARQUES_MAX);
    const reste = n - voulues;

    // Les marques déjà en train de partir ne comptent plus : sans ça, deux
    // rafraîchissements rapprochés en recréeraient autant qu'elles en enlèvent.
    const vivantes = [...cola.querySelectorAll('.cola__marque:not(.cola__marque--part)')];

    for (let i = vivantes.length; i < voulues; i += 1) {
      const marque = document.createElement('li');
      marque.className = 'cola__marque cola__marque--entre';
      marque.addEventListener('animationend', () => marque.classList.remove('cola__marque--entre'), { once: true });
      cola.insertBefore(marque, cola.querySelector('[data-cola-reste]'));
    }

    for (const marque of vivantes.slice(voulues)) {
      marque.classList.add('cola__marque--part');
      marque.addEventListener('animationend', () => marque.remove(), { once: true });
      // Sans animation (préférence système, onglet caché), l'événement ne vient
      // jamais : on retire quand même, un peu plus tard.
      setTimeout(() => marque.remove(), 600);
    }

    let etiquette = cola.querySelector('[data-cola-reste]');
    if (reste > 0) {
      if (!etiquette) {
        etiquette = document.createElement('li');
        etiquette.className = 'cola__reste';
        etiquette.dataset.colaReste = '';
        cola.append(etiquette);
      }
      etiquette.textContent = '+' + reste;
    } else if (etiquette) {
      etiquette.remove();
    }
  };

  const rafraichir = async () => {
    if (document.visibilityState !== 'visible') return;
    try {
      const etat = await envoyer('/api/public/file', { methode: 'GET' });
      if (!forte || !detail) return;

      if (etat.enAttente === 0) {
        poser(forte, t('accueil.sansAttente'));
        poser(detail, t('accueil.sansAttenteDetail'));
      } else {
        poser(forte, t('accueil.enFile', { n: etat.enAttente }));
        poser(detail, t('accueil.attenteEstimee', { duree: '≈ ' + dureeNue(etat.attenteEstimeeMinutes) }));
      }
      poserCola(etat.enAttente);

      // Le compteur du jour n'apparait qu'a partir de trois : « 1 atendido hoy »
      // fait plus vide qu'un silence.
      if (servis) {
        const assez = Number(etat.servis) >= 3;
        servis.hidden = !assez;
        if (assez) poser(servis, t('accueil.servisAujourdhui', { n: etat.servis }));
      }
      reseau.reussite();
    } catch {
      // On garde ce qui est affiche plutot que d'inventer un chiffre — mais on
      // dit que ce n'est plus frais.
      reseau.echec();
    }
  };

  const minuterie = setInterval(rafraichir, INTERVALLE_MS);
  window.addEventListener('pagehide', () => clearInterval(minuterie));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') rafraichir();
  });
}


/* ------------------------------------------------------------------ */
/*  Les sections arrivent au defilement                                */
/* ------------------------------------------------------------------ */

/**
 * Apparition douce des sections.
 *
 * Trois precautions, sans lesquelles une animation d'arrivee fait plus de mal
 * que de bien :
 *
 *   1. « prefers-reduced-motion » : on ne touche a rien. Un mouvement peut
 *      donner la nausee a qui y est sensible, et ce n'est pas une preference
 *      esthetique.
 *   2. La classe de depart est posee PAR LE SCRIPT. Si le JavaScript n'arrive
 *      jamais, rien n'est masque — sans cette precaution, une page sans script
 *      resterait vide, ce qui serait bien pire que pas d'animation du tout.
 *   3. Les elements sont revelees une fois, puis l'observateur les lache.
 */
const mouvementAccepte = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (mouvementAccepte && 'IntersectionObserver' in window) {
  const cibles = document.querySelectorAll('.seccion, .bandeau-qr, .vt-section, .vt-infos');
  if (cibles.length) {
    const observateur = new IntersectionObserver((entrees) => {
      for (const entree of entrees) {
        if (!entree.isIntersecting) continue;
        entree.target.classList.add('est-arrivee');
        observateur.unobserve(entree.target);
      }
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });

    for (const cible of cibles) {
      cible.classList.add('a-arriver');
      observateur.observe(cible);
    }
  }
}

/* ------------------------------------------------------------------ */
/*  La barre d'appel, sur téléphone                                    */
/* ------------------------------------------------------------------ */

/**
 * Elle ne se montre que quand elle sert : le bouton de l'ouverture a quitté
 * l'écran, ET le formulaire de réservation n'y est pas.
 *
 * Deux boutons identiques visibles en même temps font douter : le client se
 * demande s'ils mènent au même endroit. Et « Réserver » posé par-dessus le
 * formulaire de réservation cacherait le bouton d'envoi au pire moment.
 *
 * La classe de repli est posée PAR LE SCRIPT, jamais dans le HTML : si le
 * JavaScript n'arrive pas, la barre reste visible. Un doublon vaut mieux qu'un
 * bouton escamoté.
 */
const barreAppel = document.querySelector('.appel-fixe');
const appelDuHaut = document.querySelector('[data-appel-principal]');
const reservation = document.getElementById('reserver');

if (barreAppel && 'IntersectionObserver' in window) {
  const visibles = new Set();
  const veille = new IntersectionObserver((entrees) => {
    for (const entree of entrees) {
      if (entree.isIntersecting) visibles.add(entree.target);
      else visibles.delete(entree.target);
    }
    barreAppel.classList.toggle('appel-fixe--repli', visibles.size > 0);
  }, { rootMargin: '-8px 0px 0px 0px' });
  if (appelDuHaut) veille.observe(appelDuHaut);
  if (reservation) veille.observe(reservation);
}

/* ------------------------------------------------------------------ */
/*  La barre du haut                                                   */
/* ------------------------------------------------------------------ */

/**
 * Elle se densifie des qu'on quitte le haut de page — transparente sur
 * l'ouverture, opaque sur le texte — et le lien de la section qu'on lit est
 * souligne. Un visiteur qui descend sait toujours ou il est.
 */
const barre = document.querySelector('[data-barre]');
if (barre) {
  const liensNav = [...barre.querySelectorAll('.vt-nav__lien')];
  const marquer = () => {
    barre.classList.toggle('vt-barre--defile', window.scrollY > 24);
    // En haut de page, on lit l ouverture : aucune section n est « en cours ».
    if (window.scrollY < 200) for (const l of liensNav) l.removeAttribute('aria-current');
  };
  marquer();
  window.addEventListener('scroll', marquer, { passive: true });

  const liens = [...barre.querySelectorAll('.vt-nav__lien')];
  const parAncre = new Map(liens.map((l) => [l.getAttribute('href').replace('/#', ''), l]));
  const sections = [...parAncre.keys()].map((id) => document.getElementById(id)).filter(Boolean);
  if (sections.length && 'IntersectionObserver' in window) {
    const lecture = new IntersectionObserver((entrees) => {
      for (const entree of entrees) {
        if (!entree.isIntersecting) continue;
        for (const l of liens) l.removeAttribute('aria-current');
        parAncre.get(entree.target.id)?.setAttribute('aria-current', 'true');
      }
    }, { rootMargin: '-45% 0px -50% 0px' });
    for (const s of sections) lecture.observe(s);
  }
}

/* ------------------------------------------------------------------ */
/*  La visionneuse de la galerie                                       */
/* ------------------------------------------------------------------ */

/**
 * Un appui sur une vignette l'ouvre en grand ; fleches, Echap, balayage au
 * doigt. Sans JavaScript, la vignette reste un lien vers la photo.
 *
 * Le focus est rendu a la vignette a la fermeture : un visiteur au clavier
 * reprend exactement ou il etait, au lieu de repartir du haut de la page.
 */
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
    document.documentElement.style.overflow = 'hidden';
    visionneuse.querySelector('[data-fermer]').focus();
  };

  const fermer = () => {
    visionneuse.hidden = true;
    document.documentElement.style.overflow = '';
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
  // Un appui sur le fond ferme ; un appui sur la photo, non.
  visionneuse.addEventListener('click', (evenement) => { if (evenement.target === visionneuse) fermer(); });

  document.addEventListener('keydown', (evenement) => {
    if (visionneuse.hidden) return;
    if (evenement.key === 'Escape') fermer();
    else if (evenement.key === 'ArrowLeft') montrer(courante - 1);
    else if (evenement.key === 'ArrowRight') montrer(courante + 1);
  });

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
/*  La carte, au clic                                                  */
/* ------------------------------------------------------------------ */

/**
 * La vraie carte ne se charge QUE si le visiteur la demande : une carte tierce
 * chargee d'office enverrait son adresse IP a OpenStreetMap avant qu'il ait
 * rien demande. Le plan dessine tient la place, le bouton le remplace.
 *
 * La vue est un petit rectangle centre sur la porte, avec une epingle : c'est
 * ce que veut voir quelqu'un qui cherche le salon, pas la province entiere.
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
    iframe.className = 'vt-carte__iframe';
    iframe.title = carte.dataset.titre || '';
    iframe.loading = 'lazy';
    iframe.referrerPolicy = 'no-referrer';
    iframe.src = 'https://www.openstreetmap.org/export/embed.html?bbox=' + encodeURIComponent(cadre)
      + '&layer=mapnik&marker=' + encodeURIComponent(lat.toFixed(6) + ',' + lon.toFixed(6));
    carte.querySelector('.vt-carte__devant')?.remove();
    carte.querySelector('.vt-carte__plan')?.remove();
    carte.append(iframe);
  });
}
