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
      dire(err instanceof ErreurApi ? err.message : 'La acción no se ha completado.');
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
        el('span', { texte: compte.actif ? 'activa' : 'desactivada' }),
        verrouille ? el('span', { texte: '· bloqueada' }) : null,
        compte.doitChangerMotDePasse ? el('span', { texte: '· contraseña provisional' }) : null),
      el('div.compte__actions',
        el('button.bouton.bouton--discret.bouton--petit', {
          type: 'button',
          texte: compte.actif ? 'Desactivar' : 'Reactivar',
          surClick: () => agir(
            () => api.patch('/api/comptes/' + compte.id, { actif: !compte.actif }),
            compte.actif ? 'Cuenta desactivada.' : 'Cuenta reactivada.',
          ),
        }),
        el('button.bouton.bouton--discret.bouton--petit', {
          type: 'button',
          texte: compte.role === 'GERANT' ? 'Pasar a peluquero' : 'Pasar a gerente',
          surClick: () => agir(
            () => api.patch('/api/comptes/' + compte.id, { role: compte.role === 'GERANT' ? 'COIFFEUR' : 'GERANT' }),
            'Rol modificado.',
          ),
        }),
        el('button.bouton.bouton--discret.bouton--petit', {
          type: 'button',
          texte: 'Contraseña nueva',
          surClick: () => {
            const nouveau = window.prompt('Contraseña provisional nueva para ' + compte.identifiant + ' (12 caracteres como mínimo):', '');
            if (!nouveau) return;
            agir(
              () => api.post('/api/comptes/' + compte.id + '/mot-de-passe', { motDePasse: nouveau }),
              'Contraseña restablecida. La cuenta tendrá que cambiarla al entrar.',
            );
          },
        }),
        verrouille
          ? el('button.bouton.bouton--discret.bouton--petit', {
            type: 'button',
            texte: 'Desbloquear',
            surClick: () => agir(() => api.post('/api/comptes/' + compte.id + '/debloquer'), 'Cuenta desbloqueada.'),
          })
          : null));
  });

  /* ---- creation ---- */

  const identifiant = el('input', { id: 'n-identifiant', type: 'text', autocapitalize: 'none', spellcheck: 'false', required: true, placeholder: 'usuario' });
  const nomComplet = el('input', { id: 'n-nom', type: 'text', required: true, placeholder: 'Nombre completo' });
  const role = el('select', { id: 'n-role' },
    ...donnees.roles.map((r) => el('option', { value: r.code, texte: r.libelle })));
  const motDePasse = el('input', { id: 'n-mdp', type: 'text', required: true, minlength: '12', placeholder: 'Contraseña provisional' });

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
        dire('Cuenta creada. Dale su contraseña provisional.', true);
        await recharger();
      } catch (err) {
        dire(err instanceof ErreurApi ? err.message : 'No se ha podido crear.');
      }
    },
  },
  el('div.champ', el('label', { for: 'n-identifiant', texte: 'Usuario' }), identifiant,
    el('p.champ__aide', { texte: 'Letras sin acento, cifras, punto, guion y subrayado.' })),
  el('div.champ', el('label', { for: 'n-nom', texte: 'Nombre completo' }), nomComplet),
  el('div.champ', el('label', { for: 'n-role', texte: 'Rol' }), role),
  el('div.champ', el('label', { for: 'n-mdp', texte: 'Contraseña provisional' }), motDePasse,
    el('p.champ__aide', { texte: 'La cuenta tendrá que cambiarla al entrar la primera vez.' })),
  el('button.bouton.bouton--principal', { type: 'submit', texte: 'Crear la cuenta' }));

  remplacer(conteneur, el('div.enveloppe.page-gestion',
    el('h1.titre-page', { texte: 'Cuentas del salón' }),
    alerte, succes,
    el('section.carte', el('ul.comptes', lignes)),
    el('details.creation',
      el('summary', { texte: 'Añadir una cuenta' }),
      el('section.carte', creation))));
}
