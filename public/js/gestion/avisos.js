/**
 * Les avis pousses, cote coiffeur : une carte, un interrupteur, un essai.
 *
 * L'AUTORISATION SE DEMANDE SUR UN GESTE, JAMAIS AU CHARGEMENT. Un navigateur
 * qui affiche « ce site veut vous envoyer des notifications » avant qu'on ait
 * rien demande se fait refuser neuf fois sur dix — et un refus est DEFINITIF :
 * on ne peut plus jamais reposer la question, il faut aller dans les reglages
 * du navigateur. C'est pour cela que le bouton explique d'abord ce qu'il fait.
 *
 * L'ABONNEMENT APPARTIENT A CET APPAREIL. Le coiffeur qui active ici active
 * pour ce telephone ou cette tablette, pas pour son compte : c'est exactement
 * ce qu'il veut, puisqu'il ne porte pas la tablette du comptoir dans sa poche.
 * La carte le dit, sans quoi on croit avoir active partout.
 *
 * Le travailleur de service est enregistre ICI et pas dans `commun.js` : les
 * pages du client l'enregistrent pour le hors-ligne, la gestion ne l'enregistre
 * que si l'on veut des avis. Il ne met de toute facon jamais en cache ni
 * « /gestion » ni « /api » — c'est ecrit dans `sw.js`.
 */
import { api, ErreurApi } from './api.js';
import { el } from './dom.js';

const VERSION = new URL(import.meta.url).searchParams.get('v') || 'dev';

/**
 * La cle publique VAPID, telle que l'attend `pushManager.subscribe` : des
 * octets, pas du texte. Le base64url de la norme n'est pas du base64 : « - » et
 * « _ » y remplacent « + » et « / », et le remplissage est absent. `atob` ne
 * connait ni l'un ni l'autre.
 */
function clePourAbonnement(base64url) {
  const remplissage = '='.repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + remplissage).replace(/-/g, '+').replace(/_/g, '/');
  const brut = atob(base64);
  const octets = new Uint8Array(brut.length);
  for (let i = 0; i < brut.length; i += 1) octets[i] = brut.charCodeAt(i);
  return octets;
}

const enB64u = (tampon) => btoa(String.fromCharCode(...new Uint8Array(tampon)))
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** Un nom d'appareil lisible, pour distinguer deux lignes dans la table. */
function nomDeLAppareil() {
  const ua = navigator.userAgent || '';
  const systeme = /Android/i.test(ua) ? 'Android'
    : /iPhone|iPad|iPod/i.test(ua) ? 'iOS'
      : /Windows/i.test(ua) ? 'Windows'
        : /Mac/i.test(ua) ? 'Mac' : 'otro';
  const navigateur = /Edg\//.test(ua) ? 'Edge'
    : /Chrome\//.test(ua) ? 'Chrome'
      : /Firefox\//.test(ua) ? 'Firefox'
        : /Safari\//.test(ua) ? 'Safari' : 'navegador';
  return navigateur + ' · ' + systeme;
}

/**
 * Le service worker, enregistre a la demande.
 *
 * `navigator.serviceWorker.ready` attend qu'il soit ACTIF : s'abonner sur un
 * enregistrement encore en installation echoue, et l'erreur ne dit pas
 * pourquoi.
 */
async function travailleurPret() {
  await navigator.serviceWorker.register('/sw.js?v=' + encodeURIComponent(VERSION));
  return navigator.serviceWorker.ready;
}

export function carteAvisos() {
  const etatTexte = el('p.avisos__etat', { texte: 'Comprobando…' });
  const detail = el('p.avisos__detail.texte-doux', { hidden: true });
  const actions = el('div.avisos__actions');
  const carte = el('section.carte.avisos',
    el('h2.avisos__titre', { texte: 'Avisos en este aparato' }),
    etatTexte,
    detail,
    actions);

  let enregistrement = null;
  let clePublique = null;
  // Le serveur connait-il l'abonnement de CETTE page ? Remis a faux quand le
  // navigateur renouvelle l'abonnement dans notre dos : la nouvelle adresse est
  // alors inconnue du serveur, et les avis partiraient vers l'ancienne.
  let synchronise = false;

  const dire = (texte, secondaire = null) => {
    etatTexte.textContent = texte;
    detail.hidden = !secondaire;
    detail.textContent = secondaire || '';
  };

  const bouton = (texte, principal, surClick) => el(
    'button.bouton.bouton--petit' + (principal ? '.bouton--principal' : '.bouton--discret'),
    { type: 'button', texte, surClick },
  );

  function remplacerActions(...enfants) {
    while (actions.firstChild) actions.firstChild.remove();
    for (const enfant of enfants) if (enfant) actions.append(enfant);
  }

  async function activer(declencheur) {
    declencheur.disabled = true;
    try {
      // La demande d'autorisation DOIT partir du geste : lancee plus tard, dans
      // une suite de promesses, Safari la refuse sans explication.
      const autorisation = await Notification.requestPermission();
      if (autorisation !== 'granted') {
        dire('Avisos bloqueados.', autorisation === 'denied'
          ? 'El navegador ya no volverá a preguntar: hay que permitirlos en sus ajustes de sitio.'
          : 'No se ha dado permiso.');
        remplacerActions();
        return;
      }

      const abonnement = await enregistrement.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: clePourAbonnement(clePublique),
      });

      await api.post('/api/avisos', {
        endpoint: abonnement.endpoint,
        p256dh: enB64u(abonnement.getKey('p256dh')),
        auth: enB64u(abonnement.getKey('auth')),
        appareil: nomDeLAppareil(),
      });

      await peindre();
    } catch (err) {
      dire('No se han podido activar.', err instanceof ErreurApi ? err.message : String(err.message || err));
      declencheur.disabled = false;
    }
  }

  async function desactiver(declencheur) {
    declencheur.disabled = true;
    try {
      const abonnement = await enregistrement.pushManager.getSubscription();
      if (abonnement) {
        // On previent le serveur AVANT de rompre l'abonnement : dans l'autre
        // sens, une coupure de reseau au mauvais moment laisserait une ligne
        // morte a laquelle on enverrait chaque tour pris jusqu'au menage.
        await api.post('/api/avisos/baja', { endpoint: abonnement.endpoint }).catch(() => {});
        await abonnement.unsubscribe();
      }
      await peindre();
    } catch (err) {
      dire('No se han podido desactivar.', String(err.message || err));
      declencheur.disabled = false;
    }
  }

  async function essayer(declencheur) {
    const texteInitial = declencheur.textContent;
    declencheur.disabled = true;
    declencheur.textContent = 'Enviando…';
    try {
      const abonnement = await enregistrement.pushManager.getSubscription();
      if (!abonnement) throw new Error('Este aparato ya no está suscrito.');
      await api.post('/api/avisos/prueba', { endpoint: abonnement.endpoint });
      dire('Aviso enviado.', 'Debería aparecer en un momento. Si no llega, comprueba los ajustes del aparato.');
    } catch (err) {
      dire('El aviso de prueba no ha llegado a salir.',
        err instanceof ErreurApi ? err.message : String(err.message || err));
      await peindre();
      return;
    }
    declencheur.disabled = false;
    declencheur.textContent = texteInitial;
  }

  async function peindre() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      dire('Este navegador no admite avisos.',
        'En iPhone hay que añadir la página a la pantalla de inicio para que funcionen.');
      remplacerActions();
      return;
    }

    let reponse;
    try {
      reponse = await api.get('/api/avisos');
    } catch {
      dire('No se ha podido comprobar el estado de los avisos.');
      remplacerActions();
      return;
    }

    if (!reponse.actif) {
      dire('Los avisos no están configurados en este servidor.',
        'Hacen falta las claves WEBPUSH en el servidor. Mientras tanto, la fila se actualiza sola en pantalla.');
      remplacerActions();
      return;
    }

    clePublique = reponse.clePublique;
    enregistrement = await travailleurPret().catch(() => null);
    if (!enregistrement) {
      dire('El navegador no ha permitido preparar los avisos.',
        'Suele pasar en ventanas privadas.');
      remplacerActions();
      return;
    }

    const abonnement = await enregistrement.pushManager.getSubscription();

    if (abonnement && !synchronise) {
      // Une seule fois par chargement : reposer l'abonnement remet a jour ses
      // cles cote serveur, et rattrape un renouvellement silencieux.
      synchronise = true;
      api.post('/api/avisos', {
        endpoint: abonnement.endpoint,
        p256dh: enB64u(abonnement.getKey('p256dh')),
        auth: enB64u(abonnement.getKey('auth')),
        appareil: nomDeLAppareil(),
      }).catch(() => { synchronise = false; });
    }

    if (abonnement) {
      dire('Activados en este aparato.',
        reponse.abonnements > 1
          ? 'Tienes ' + reponse.abonnements + ' aparatos suscritos con tu cuenta.'
          : 'Sonará cuando alguien pida turno o lo anule.');
      remplacerActions(
        bouton('Probar', false, (e) => essayer(e.currentTarget)),
        bouton('Desactivar', false, (e) => desactiver(e.currentTarget)),
      );
      return;
    }

    if (Notification.permission === 'denied') {
      dire('Avisos bloqueados en este navegador.',
        'Hay que permitirlos en los ajustes del sitio; desde aquí ya no se puede preguntar.');
      remplacerActions();
      return;
    }

    dire('Desactivados en este aparato.',
      'Actívalos y el móvil vibrará cuando alguien pida turno o lo anule, sin tener que mirar la pantalla.');
    remplacerActions(bouton('Activar los avisos', true, (e) => activer(e.currentTarget)));
  }

  // Le navigateur renouvelle parfois l'abonnement de lui-meme ; le travailleur
  // de service nous le dit, et on le re-enregistre sans rien demander.
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (evenement) => {
      if (evenement.data && evenement.data.type === 'haron:reabonner') {
        synchronise = false;
        peindre().catch(() => {});
      }
    });
  }

  peindre().catch(() => dire('No se ha podido comprobar el estado de los avisos.'));
  return carte;
}
