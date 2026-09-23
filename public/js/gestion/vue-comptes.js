/**
 * Les comptes du personnel.
 *
 * Deux roles, pas de matrice de permissions : le coiffeur tient la file, le
 * gerant fait tout. Un compte cree recoit un mot de passe provisoire qu'il
 * devra changer a sa premiere connexion.
 */
import { api, ErreurApi } from './api.js';
import { el, remplacer, annoncer } from './dom.js';

export async function vueComptes(conteneur, { etat }) {
  const donnees = await api.get('/api/comptes');
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

  const recharger = () => vueComptes(conteneur, { etat });

  async function agir(action, message) {
    try {
      await action();
      dire(message, true);
      await recharger();
    } catch (err) {
      dire(err instanceof ErreurApi ? err.message : 'Le geste n’a pas abouti.');
    }
  }

  const lignes = donnees.items.map((compte) => {
    const verrouille = compte.verrouilleJusquA && new Date(compte.verrouilleJusquA) > new Date();
    return el('li.compte' + (compte.actif ? '' : '.compte--inactif'),
      el('div.compte__tete',
        el('span.compte__nom', { texte: compte.nomComplet }),
        el('span.compte__role', { texte: compte.roleLibelle })),
      el('p.compte__meta',
        el('span', { texte: compte.identifiant }),
        el('span', { texte: '·' }),
        el('span', { texte: compte.actif ? 'actif' : 'désactivé' }),
        verrouille ? el('span', { texte: '· bloqué' }) : null,
        compte.doitChangerMotDePasse ? el('span', { texte: '· mot de passe provisoire' }) : null),
      el('div.compte__actions',
        el('button.bouton.bouton--discret.bouton--petit', {
          type: 'button',
          texte: compte.actif ? 'Désactiver' : 'Réactiver',
          surClick: () => agir(
            () => api.patch('/api/comptes/' + compte.id, { actif: !compte.actif }),
            compte.actif ? 'Compte désactivé.' : 'Compte réactivé.',
          ),
        }),
        el('button.bouton.bouton--discret.bouton--petit', {
          type: 'button',
          texte: compte.role === 'GERANT' ? 'Passer coiffeur' : 'Passer gérant',
          surClick: () => agir(
            () => api.patch('/api/comptes/' + compte.id, { role: compte.role === 'GERANT' ? 'COIFFEUR' : 'GERANT' }),
            'Rôle modifié.',
          ),
        }),
        el('button.bouton.bouton--discret.bouton--petit', {
          type: 'button',
          texte: 'Nouveau mot de passe',
          surClick: () => {
            const nouveau = window.prompt('Nouveau mot de passe provisoire pour ' + compte.identifiant + ' (12 caractères au moins) :', '');
            if (!nouveau) return;
            agir(
              () => api.post('/api/comptes/' + compte.id + '/mot-de-passe', { motDePasse: nouveau }),
              'Mot de passe réinitialisé. Le compte devra le changer à sa prochaine connexion.',
            );
          },
        }),
        verrouille
          ? el('button.bouton.bouton--discret.bouton--petit', {
            type: 'button',
            texte: 'Débloquer',
            surClick: () => agir(() => api.post('/api/comptes/' + compte.id + '/debloquer'), 'Compte débloqué.'),
          })
          : null));
  });

  /* ---- creation ---- */

  const identifiant = el('input', { id: 'n-identifiant', type: 'text', autocapitalize: 'none', spellcheck: 'false', required: true, placeholder: 'identifiant' });
  const nomComplet = el('input', { id: 'n-nom', type: 'text', required: true, placeholder: 'Nom complet' });
  const role = el('select', { id: 'n-role' },
    ...donnees.roles.map((r) => el('option', { value: r.code, texte: r.libelle })));
  const motDePasse = el('input', { id: 'n-mdp', type: 'text', required: true, minlength: '12', placeholder: 'Mot de passe provisoire' });

  const creation = el('form.formulaire', {
    surSubmit: async (evenement) => {
      evenement.preventDefault();
      try {
        await api.post('/api/comptes', {
          identifiant: identifiant.value.trim(),
          nomComplet: nomComplet.value.trim(),
          role: role.value,
          motDePasse: motDePasse.value,
        });
        dire('Compte créé. Communiquez-lui son mot de passe provisoire.', true);
        await recharger();
      } catch (err) {
        dire(err instanceof ErreurApi ? err.message : 'Création impossible.');
      }
    },
  },
  el('div.champ', el('label', { for: 'n-identifiant', texte: 'Identifiant' }), identifiant,
    el('p.champ__aide', { texte: 'Lettres sans accent, chiffres, point, tiret et souligné.' })),
  el('div.champ', el('label', { for: 'n-nom', texte: 'Nom complet' }), nomComplet),
  el('div.champ', el('label', { for: 'n-role', texte: 'Rôle' }), role),
  el('div.champ', el('label', { for: 'n-mdp', texte: 'Mot de passe provisoire' }), motDePasse,
    el('p.champ__aide', { texte: 'Le compte devra le changer à sa première connexion.' })),
  el('button.bouton.bouton--principal', { type: 'submit', texte: 'Créer le compte' }));

  remplacer(conteneur, el('div.enveloppe.page-gestion',
    el('h1.titre-page', { texte: 'Comptes du salon' }),
    alerte, succes,
    el('section.carte', el('ul.comptes', lignes)),
    el('details.creation',
      el('summary', { texte: 'Ajouter un compte' }),
      el('section.carte', creation))));
}
