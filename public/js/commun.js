/**
 * Le peu de JavaScript partage par les pages du client.
 *
 * Les pages sont rendues par le serveur et fonctionnent sans ce fichier : il
 * n'ajoute que le direct et le confort. Aucune donnee n'est insere en HTML,
 * uniquement par textContent : une injection n'a donc aucune prise.
 */

/* ------------------------------------------------------------------ */
/*  Hors ligne                                                         */
/* ------------------------------------------------------------------ */

/**
 * Le travailleur de service, enregistre avec la VERSION DEPLOYEE.
 *
 * La version se lit dans l'adresse de ce module : le serveur sert les fichiers
 * statiques en « ?v=<commit> », donc `import.meta.url` la porte deja. Aucune
 * donnee a poser dans la page, et le jour ou la version change, l'adresse du
 * travailleur change aussi — le navigateur prend donc le nouveau, et le nouveau
 * efface les caches de l'ancien.
 *
 * Il n'est pas enregistre dans l'espace de gestion : le coiffeur a besoin de la
 * verite du serveur, jamais d'une page gardee.
 */
export function activerHorsLigne() {
  if (!('serviceWorker' in navigator)) return;
  if (location.pathname.startsWith('/gestion')) return;
  const version = new URL(import.meta.url).searchParams.get('v') || 'dev';
  // A l'arret du chargement : l'enregistrement ne doit pas disputer la bande
  // passante a la page elle-meme.
  addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js?v=' + encodeURIComponent(version)).catch(() => {
      // Un navigateur qui refuse (navigation privee, reglage) garde une page
      // parfaitement fonctionnelle : il n'y a rien a signaler.
    });
  });
}

/**
 * Le bandeau « sin conexión ».
 *
 * Sans lui, une page qui ne se met plus a jour a l'air JUSTE : le client lit
 * « 3 personas » et attend, alors que c'est peut-etre deja son tour. Le dire
 * vaut mieux que de se taire.
 *
 * Rend une fonction a appeler quand une lecture reussit ou echoue, pour que
 * l'etat reel du service compte autant que `navigator.onLine` — un telephone
 * peut etre « en ligne » sur un wifi qui ne mene nulle part.
 */
export function bandeauHorsLigne() {
  const bandeau = document.createElement('p');
  bandeau.className = 'hors-ligne';
  bandeau.setAttribute('role', 'status');
  bandeau.hidden = true;
  bandeau.textContent = 'Sin conexión — mostramos lo último que sabemos.';
  document.body.prepend(bandeau);

  let echecs = 0;
  const peindre = () => {
    // Deux echecs de suite avant de le dire : une lecture ratee arrive, et un
    // bandeau qui clignote a chaque hoquet inquiete pour rien.
    bandeau.hidden = navigator.onLine && echecs < 2;
  };

  addEventListener('online', () => { echecs = 0; peindre(); });
  addEventListener('offline', peindre);
  peindre();

  return {
    reussite() { echecs = 0; peindre(); },
    echec() { echecs += 1; peindre(); },
  };
}

/** Les donnees initiales posees par le serveur (jamais un script en ligne). */
export function donneesInitiales() {
  const socle = document.getElementById('donnees');
  if (!socle) return null;
  try {
    return JSON.parse(socle.dataset.initial || 'null');
  } catch {
    return null;
  }
}

/** Ecrit une valeur et la fait clignoter brievement si elle a change. */
export function poser(element, valeur) {
  if (!element) return;
  const texte = String(valeur);
  if (element.textContent === texte) return;
  element.textContent = texte;
  element.classList.remove('valeur-changee');
  // Forcer un reflux pour que l'animation reparte meme sur deux changements
  // rapprochés.
  void element.offsetWidth;
  element.classList.add('valeur-changee');
}

/** Le jeton CSRF n'existe pas cote client public : les routes publiques en sont dispensees. */
export async function envoyer(url, { methode = 'POST', corps = null } = {}) {
  const reponse = await fetch(url, {
    method: methode,
    headers: corps ? { 'Content-Type': 'application/json' } : {},
    body: corps ? JSON.stringify(corps) : undefined,
    credentials: 'same-origin',
  });
  let donnees = null;
  try {
    donnees = await reponse.json();
  } catch {
    donnees = null;
  }
  if (!reponse.ok) {
    const message = donnees?.error?.message || 'El servicio no está disponible ahora mismo. Inténtalo en un instante.';
    const erreur = new Error(message);
    erreur.statut = reponse.status;
    erreur.details = donnees?.error?.details ?? null;
    throw erreur;
  }
  return donnees;
}

/**
 * Ouvre un flux d'evenements et le tient ouvert.
 *
 * EventSource se reconnecte tout seul, mais pas quand le telephone se met en
 * veille : au retour a l'ecran, le navigateur rend une connexion morte sans le
 * dire. On repart donc d'une connexion neuve a chaque retour de visibilite,
 * apres avoir relu l'etat une fois par requete ordinaire.
 */
export function suivreFlux(url, { sur = {}, auReveil = null } = {}) {
  let source = null;

  const ouvrir = () => {
    fermer();
    source = new EventSource(url, { withCredentials: true });
    for (const [nom, gestionnaire] of Object.entries(sur)) {
      source.addEventListener(nom, (evenement) => {
        try {
          gestionnaire(JSON.parse(evenement.data));
        } catch {
          // Un message illisible ne doit pas casser le suivi.
        }
      });
    }
  };

  const fermer = () => {
    if (source) source.close();
    source = null;
  };

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (auReveil) auReveil();
    ouvrir();
  });
  window.addEventListener('pagehide', fermer);

  ouvrir();
  return { fermer, ouvrir };
}
