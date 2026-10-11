/**
 * Les avis des clients.
 *
 * Un avis arrive « en attente » depuis la page de suivi d'un client servi. Rien
 * ne paraît sur la vitrine tant que le gérant ne l'a pas publié : c'est lui qui
 * répond de ce que son salon affiche.
 */
import { api, ErreurApi } from './api.js';
import { el, remplacer, annoncer } from './dom.js';
import { t } from '../langue.js';

const ETOILES = [1, 2, 3, 4, 5];

function etoiles(note) {
  return el('span.avis-note', { 'aria-label': t('avis.noteSur5', { n: note }) },
    ETOILES.map((i) => el('span.avis-note__etoile' + (i <= note ? '.avis-note__etoile--pleine' : ''), { 'aria-hidden': 'true', texte: '★' })));
}

export async function vueAvis(conteneur, contexte) {
  const donnees = await api.get('/api/avis');
  const alerte = el('p.alerte.alerte--refus', { role: 'alert', hidden: true });
  const recharger = () => vueAvis(conteneur, contexte);

  const agir = async (action, annonce) => {
    alerte.hidden = true;
    try {
      await action();
      annoncer(annonce);
      await recharger();
    } catch (err) {
      alerte.textContent = err instanceof ErreurApi ? err.message : t('avis.echec');
      alerte.hidden = false;
    }
  };

  const carte = (a) => el('li.carte.avis-gestion.avis-gestion--' + a.statut.toLowerCase(),
    el('div.avis-gestion__tete',
      el('span.pastille.avis-gestion__statut', { texte: t('avis.statut.' + a.statut) }),
      etoiles(a.note),
      el('span.avis-gestion__qui', { texte: a.prenom }),
      el('span.texte-doux', { texte: new Date(a.le).toLocaleDateString() })),
    el('p.avis-gestion__texte' + (a.commentaire ? '' : '.texte-doux'), { texte: a.commentaire || t('avis.sansCommentaire') }),
    el('div.avis-gestion__actions',
      a.statut === 'PUBLIE'
        ? null
        : el('button.bouton.bouton--principal.bouton--petit', {
          type: 'button',
          texte: t('avis.publier'),
          surClick: () => agir(() => api.patch('/api/avis/' + a.id, { statut: 'PUBLIE' }), t('avis.publie')),
        }),
      a.statut === 'MASQUE'
        ? null
        : el('button.bouton.bouton--discret.bouton--petit', {
          type: 'button',
          texte: t('avis.masquer'),
          surClick: () => agir(() => api.patch('/api/avis/' + a.id, { statut: 'MASQUE' }), t('avis.masque')),
        }),
      el('button.bouton.bouton--lien.bouton--danger', {
        type: 'button',
        texte: t('avis.supprimer'),
        surClick: () => {
          if (!window.confirm(t('avis.confirmerSuppression', { prenom: a.prenom }))) return;
          agir(() => api.supprimer('/api/avis/' + a.id), t('avis.supprime'));
        },
      })));

  remplacer(conteneur,
    el('div.enveloppe',
      el('header.vue__tete',
        el('h1.titre-page', { texte: t('avis.titre') }),
        el('p.texte-doux', { texte: t('avis.intro') }),
        donnees.publies.nombre
          ? el('p.avis-gestion__bilan', { texte: t('avis.moyenne', { note: String(donnees.publies.moyenne).replace('.', ','), n: donnees.publies.nombre }) })
          : null),
      alerte,
      donnees.items.length
        ? el('ul.avis-gestion__liste', donnees.items.map(carte))
        : el('p.carte.texte-doux', { texte: t('avis.aucun') })));
}
