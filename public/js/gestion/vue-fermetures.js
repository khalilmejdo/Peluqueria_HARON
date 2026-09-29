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
import { t, dateLongue } from '../langue.js';

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
      el('p.pastille', { texte: t('conges.maintenant') }),
      el('h2.reglages__titre', { texte: t('conges.salonFerme') }),
      el('p.texte-doux', { texte: donnees.enCours.message }))
    : null;

  /* ---- la liste ---- */

  const lignes = donnees.items.map((f) => el('li.fermeture' + (f.enCours ? '.fermeture--active' : ''),
    el('div.fermeture__dates',
      el('span.fermeture__du', { texte: dateLongue(f.du) }),
      el('span.fermeture__separateur', { texte: f.du === f.au ? '' : ' → ' }),
      f.du === f.au ? null : el('span.fermeture__au', { texte: dateLongue(f.au) })),
    el('p.fermeture__meta',
      el('span', { texte: t('conges.jours', { n: f.jours }) }),
      f.motif ? el('span', { texte: '· ' + f.motif }) : null,
      f.enCours ? el('span.fermeture__badge', { texte: t('conges.badgeEnCours') }) : null),
    el('button.bouton.bouton--discret.bouton--petit.bouton--danger', {
      type: 'button',
      texte: t('commun.supprimer'),
      surClick: async () => {
        if (!window.confirm(t('conges.confirmerSuppression', { date: dateLongue(f.du) }))) return;
        try {
          await api.supprimer('/api/fermetures/' + f.id);
          dire(t('conges.periodeSupprimee'), true);
          await recharger();
        } catch (err) {
          dire(err instanceof ErreurApi ? err.message : t('conges.echecSuppression'));
        }
      },
    })));

  /* ---- ajout ---- */

  const du = el('input', { id: 'f-du', type: 'date', required: true, min: donnees.aujourdhui });
  const au = el('input', { id: 'f-au', type: 'date', required: true, min: donnees.aujourdhui });
  const motif = el('input', { id: 'f-motif', type: 'text', maxlength: '120', placeholder: t('conges.motifExemple') });

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
        dire(t('conges.periodeEnregistree'), true);
        await recharger();
      } catch (err) {
        dire(err instanceof ErreurApi ? err.message : t('conges.echecEnregistrement'));
      }
    },
  },
  el('div.reglages__grille',
    el('div.champ', el('label', { for: 'f-du', texte: t('conges.du') }), du),
    el('div.champ', el('label', { for: 'f-au', texte: t('conges.au') }), au),
    el('div.champ', el('label', { for: 'f-motif', texte: t('conges.motif') }), motif)),
  el('button.bouton.bouton--principal', { type: 'submit', texte: t('conges.declarerBouton') }));

  remplacer(conteneur, el('div.enveloppe.page-gestion',
    el('h1.titre-page', { texte: t('conges.titre') }),
    el('p.texte-doux', { texte: t('conges.intro') }),
    alerte, succes,
    enCours,
    donnees.prochaine
      ? el('p.texte-doux.annonce-prochaine', {
        texte: t('conges.prochaineAnnoncee', {
          du: dateLongue(donnees.prochaine.du),
          au: dateLongue(donnees.prochaine.au),
        }),
      })
      : null,
    el('section.carte',
      el('h2.reglages__titre', { texte: t('conges.titreDeclarer') }),
      ajout),
    el('section.carte',
      el('h2.reglages__titre', { texte: t('conges.titreListe') }),
      donnees.items.length
        ? el('ul.fermetures', lignes)
        : el('p.texte-doux', { texte: t('conges.aucune') }))));
}
