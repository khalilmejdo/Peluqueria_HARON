/**
 * Les comptes du personnel.
 *
 * Deux roles, pas de matrice de permissions : le coiffeur tient la file, le
 * gerant fait tout. Un compte cree recoit un mot de passe provisoire qu'il
 * devra changer a sa premiere connexion.
 */
import { api, ErreurApi } from './api.js';
import { el, remplacer, annoncer } from './dom.js';
import { t } from '../langue.js';

export async function vueComptes(conteneur, { etat }) {
  // La longueur minimale vient du SERVEUR, avec la session : c'est la meme
  // valeur qui accepte ou refuse la saisie. Elle etait ecrite « 12 » en dur ici
  // et dans deux autres endroits, et un PASSWORD_MIN_LENGTH releve sur le
  // serveur les aurait tous laisses annoncer un minimum trop bas.
  const motDePasseMin = etat.motDePasseMin || 12;
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
      dire(err instanceof ErreurApi ? err.message : t('comptes.erreur.action'));
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
        el('span', { texte: compte.actif ? t('comptes.etat.actif') : t('comptes.etat.inactif') }),
        verrouille ? el('span', { texte: '· ' + t('comptes.etat.bloque') }) : null,
        compte.doitChangerMotDePasse ? el('span', { texte: '· ' + t('comptes.etat.motDePasseProvisoire') }) : null),
      el('div.compte__actions',
        // Le nom complet est ce qui s'affiche en haut de l'ecran toute la
        // journee. L'API l'acceptait deja ; il manquait juste de quoi le dire.
        el('button.bouton.bouton--discret.bouton--petit', {
          type: 'button',
          texte: t('comptes.action.renommer'),
          surClick: () => {
            const nomComplet = window.prompt(t('comptes.invite.nomComplet'), compte.nomComplet);
            if (nomComplet === null || nomComplet.trim() === compte.nomComplet) return;
            agir(
              () => api.patch('/api/comptes/' + compte.id, { nomComplet: nomComplet.trim() }),
              t('comptes.succes.nomChange'),
            );
          },
        }),
        el('button.bouton.bouton--discret.bouton--petit', {
          type: 'button',
          texte: compte.actif ? t('comptes.action.desactiver') : t('comptes.action.reactiver'),
          surClick: () => agir(
            () => api.patch('/api/comptes/' + compte.id, { actif: !compte.actif }),
            compte.actif ? t('comptes.succes.desactive') : t('comptes.succes.reactive'),
          ),
        }),
        el('button.bouton.bouton--discret.bouton--petit', {
          type: 'button',
          texte: compte.role === 'GERANT' ? t('comptes.action.passerCoiffeur') : t('comptes.action.passerGerant'),
          surClick: () => agir(
            () => api.patch('/api/comptes/' + compte.id, { role: compte.role === 'GERANT' ? 'COIFFEUR' : 'GERANT' }),
            t('comptes.succes.roleModifie'),
          ),
        }),
        el('button.bouton.bouton--discret.bouton--petit', {
          type: 'button',
          texte: t('comptes.action.nouveauMotDePasse'),
          surClick: () => {
            const nouveau = window.prompt(t('comptes.invite.nouveauMotDePasse', { identifiant: compte.identifiant, min: motDePasseMin }), '');
            if (!nouveau) return;
            agir(
              () => api.post('/api/comptes/' + compte.id + '/mot-de-passe', { motDePasse: nouveau }),
              t('comptes.succes.motDePasseReinitialise'),
            );
          },
        }),
        verrouille
          ? el('button.bouton.bouton--discret.bouton--petit', {
            type: 'button',
            texte: t('comptes.action.debloquer'),
            surClick: () => agir(() => api.post('/api/comptes/' + compte.id + '/debloquer'), t('comptes.succes.debloque')),
          })
          : null));
  });

  /* ---- creation ---- */

  const identifiant = el('input', { id: 'n-identifiant', type: 'text', autocapitalize: 'none', spellcheck: 'false', required: true, placeholder: t('comptes.champ.identifiant.exemple') });
  const nomComplet = el('input', { id: 'n-nom', type: 'text', required: true, placeholder: t('comptes.champ.nomComplet') });
  const role = el('select', { id: 'n-role' },
    ...donnees.roles.map((r) => el('option', { value: r.code, texte: r.libelle })));
  const motDePasse = el('input', { id: 'n-mdp', type: 'text', required: true, minlength: String(motDePasseMin), placeholder: t('comptes.champ.motDePasse') });

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
        dire(t('comptes.succes.creation'), true);
        await recharger();
      } catch (err) {
        dire(err instanceof ErreurApi ? err.message : t('comptes.erreur.creation'));
      }
    },
  },
  el('div.champ', el('label', { for: 'n-identifiant', texte: t('comptes.champ.identifiant') }), identifiant,
    el('p.champ__aide', { texte: t('comptes.champ.identifiant.aide') })),
  el('div.champ', el('label', { for: 'n-nom', texte: t('comptes.champ.nomComplet') }), nomComplet),
  el('div.champ', el('label', { for: 'n-role', texte: t('comptes.champ.role') }), role),
  el('div.champ', el('label', { for: 'n-mdp', texte: t('comptes.champ.motDePasse') }), motDePasse,
    el('p.champ__aide', { texte: t('comptes.champ.motDePasse.aide') })),
  el('button.bouton.bouton--principal', { type: 'submit', texte: t('comptes.action.creer') }));

  remplacer(conteneur, el('div.enveloppe.page-gestion',
    el('h1.titre-page', { texte: t('comptes.titre') }),
    alerte, succes,
    el('section.carte', el('ul.comptes', lignes)),
    el('details.creation',
      el('summary', { texte: t('comptes.action.ajouter') }),
      el('section.carte', creation))));
}
