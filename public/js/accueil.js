/**
 * L'accueil : rafraichit l'affluence sans recharger la page.
 *
 * Un client qui hesite devant la vitrine garde la page ouverte deux minutes. Il
 * doit voir la file bouger. Une lecture toutes les vingt secondes suffit
 * largement, et elle ne part que si l'onglet est visible.
 */
import { envoyer } from './commun.js';

const bloc = document.querySelector('[data-affluence]');
const INTERVALLE_MS = 20000;

if (bloc) {
  const rafraichir = async () => {
    if (document.visibilityState !== 'visible') return;
    try {
      const etat = await envoyer('/api/public/file', { methode: 'GET' });
      const forte = bloc.querySelector('.affluence__forte');
      const detail = bloc.querySelector('.affluence__detail');
      if (!forte || !detail) return;
      if (etat.enAttente === 0) {
        forte.textContent = 'Sin espera';
        detail.textContent = 'El sillón te está esperando.';
        return;
      }
      forte.textContent = etat.enAttente + ' persona' + (etat.enAttente > 1 ? 's' : '') + ' en la fila';
      detail.textContent = 'Espera estimada: ≈ ' + minutesLisibles(etat.attenteEstimeeMinutes);
    } catch {
      // Hors ligne : on garde ce qui est affiche plutot que d'inventer un chiffre.
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
  if (m <= 0) return 'quelques instants';
  if (m < 60) return m + ' minute' + (m > 1 ? 's' : '');
  const h = Math.floor(m / 60);
  const reste = m % 60;
  return h + ' h' + (reste ? ' ' + String(reste).padStart(2, '0') : '');
}
