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
        poser(forte, 'Sin espera');
        poser(detail, 'El sillón te está esperando.');
      } else {
        poser(forte, etat.enAttente + ' persona' + (etat.enAttente > 1 ? 's' : '') + ' en la fila');
        poser(detail, 'Espera estimada: ≈ ' + minutesLisibles(etat.attenteEstimeeMinutes));
      }
      poserCola(etat.enAttente);

      // Le compteur du jour n'apparait qu'a partir de trois : « 1 atendido hoy »
      // fait plus vide qu'un silence.
      if (servis) {
        const assez = Number(etat.servis) >= 3;
        servis.hidden = !assez;
        if (assez) poser(servis, etat.servis + ' atendidos hoy');
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

function minutesLisibles(minutes) {
  const m = Math.max(0, Math.round(Number(minutes) || 0));
  if (m <= 0) return 'unos minutos';
  if (m < 60) return m + ' minuto' + (m > 1 ? 's' : '');
  const h = Math.floor(m / 60);
  const reste = m % 60;
  return h + ' h' + (reste ? ' ' + String(reste).padStart(2, '0') : '');
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
  const cibles = document.querySelectorAll('.seccion, .bandeau-qr');
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
