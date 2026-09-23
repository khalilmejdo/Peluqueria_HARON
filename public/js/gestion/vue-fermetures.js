/**
 * Les congés du salon.
 *
 * Une periode couvre ses deux bornes incluses. Pendant qu'elle court, personne
 * ne peut prendre de tour, et la page d'accueil annonce la date de reouverture.
 * Une fermeture a venir est annoncee aux clients des maintenant : c'est
 * exactement ce qu'ils veulent savoir avant de passer.
 */
import { api, ErreurApi } from './api.js';
import { el, remplacer, annoncer } from './dom.js';

const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

function dateLongue(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  if (!m) return String(iso || '');
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return JOURS[d.getUTCDay()] + ' ' + Number(m[3]) + ' ' + MOIS[Number(m[2]) - 1] + ' ' + m[1];
}

export async function vueFermetures(conteneur, { etat }) {
  const donnees = await api.get('/api/fermetures');
  const alerte = el('p.alerte.alerte--refus', { role: 'alert', hidden: true });
  const succes = el('p.alerte.alerte--succes', { role: 'status', hidden: true });

  const dire = (message, bon = false) => {
    const cible = bon ? succes : alerte;
    const autre = bon ? alerte : succes;
    cible.textContent = message;
    cible.hidden = false;
    autre.hidden = true;
    annoncer(message);
  };

  const recharger = () => vueFermetures(conteneur, { etat });

  /* ---- la periode en cours ---- */

  const enCours = donnees.enCours
    ? el('section.carte.fermeture-active',
      el('p.pastille', { texte: 'En ce moment' }),
      el('h2.reglages__titre', { texte: 'Le salon est fermé' }),
      el('p.texte-doux', { texte: donnees.enCours.message }))
    : null;

  /* ---- la liste ---- */

  const lignes = donnees.items.map((f) => el('li.fermeture' + (f.enCours ? '.fermeture--active' : ''),
    el('div.fermeture__dates',
      el('span.fermeture__du', { texte: dateLongue(f.du) }),
      el('span.fermeture__separateur', { texte: f.du === f.au ? '' : ' → ' }),
      f.du === f.au ? null : el('span.fermeture__au', { texte: dateLongue(f.au) })),
    el('p.fermeture__meta',
      el('span', { texte: f.jours + ' jour' + (f.jours > 1 ? 's' : '') }),
      f.motif ? el('span', { texte: '· ' + f.motif }) : null,
      f.enCours ? el('span.fermeture__badge', { texte: 'en cours' }) : null),
    el('button.bouton.bouton--discret.bouton--petit.bouton--danger', {
      type: 'button',
      texte: 'Supprimer',
      surClick: async () => {
        if (!window.confirm('Supprimer la fermeture du ' + dateLongue(f.du) + ' ?\nLes clients pourront de nouveau prendre leur tour sur cette période.')) return;
        try {
          await api.supprimer('/api/fermetures/' + f.id);
          dire('Période supprimée.', true);
          await recharger();
        } catch (err) {
          dire(err instanceof ErreurApi ? err.message : 'Suppression impossible.');
        }
      },
    })));

  /* ---- ajout ---- */

  const du = el('input', { id: 'f-du', type: 'date', required: true, min: donnees.aujourdhui });
  const au = el('input', { id: 'f-au', type: 'date', required: true, min: donnees.aujourdhui });
  const motif = el('input', { id: 'f-motif', type: 'text', maxlength: '120', placeholder: 'Congés d’août, jour férié…' });

  // Choisir une date de debut sans date de fin est le cas courant (« je ferme
  // ce jour-là ») : on remplit la fin toute seule, l'utilisateur corrige s'il
  // veut plus long.
  du.addEventListener('change', () => {
    au.min = du.value || donnees.aujourdhui;
    if (!au.value || au.value < du.value) au.value = du.value;
  });

  const ajout = el('form.formulaire', {
    surSubmit: async (evenement) => {
      evenement.preventDefault();
      try {
        await api.post('/api/fermetures', {
          du: du.value,
          au: au.value || du.value,
          motif: motif.value.trim() || undefined,
        });
        dire('Période enregistrée. Les clients en sont informés dès maintenant.', true);
        await recharger();
      } catch (err) {
        dire(err instanceof ErreurApi ? err.message : 'Enregistrement impossible.');
      }
    },
  },
  el('div.reglages__grille',
    el('div.champ', el('label', { for: 'f-du', texte: 'Du' }), du),
    el('div.champ', el('label', { for: 'f-au', texte: 'Au (inclus)' }), au),
    el('div.champ', el('label', { for: 'f-motif', texte: 'Motif (facultatif)' }), motif)),
  el('button.bouton.bouton--principal', { type: 'submit', texte: 'Déclarer la fermeture' }));

  remplacer(conteneur, el('div.enveloppe.page-gestion',
    el('h1.titre-page', { texte: 'Congés et fermetures' }),
    el('p.texte-doux', {
      texte: 'Pendant une période déclarée, personne ne peut prendre de tour et la page d’accueil annonce la date de réouverture. La file du jour, elle, n’est jamais interrompue : les clients déjà présents sont servis.',
    }),
    alerte, succes,
    enCours,
    donnees.prochaine
      ? el('p.texte-doux.annonce-prochaine', {
        texte: 'Prochaine fermeture annoncée aux clients : du ' + dateLongue(donnees.prochaine.du) + ' au ' + dateLongue(donnees.prochaine.au) + '.',
      })
      : null,
    el('section.carte',
      el('h2.reglages__titre', { texte: 'Déclarer une période' }),
      ajout),
    el('section.carte',
      el('h2.reglages__titre', { texte: 'Périodes enregistrées' }),
      donnees.items.length
        ? el('ul.fermetures', lignes)
        : el('p.texte-doux', { texte: 'Aucune fermeture déclarée.' }))));
}
