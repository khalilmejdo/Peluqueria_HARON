/**
 * L'espace du salon.
 *
 * Une seule page, des onglets, et la file toujours a un doigt. Le coiffeur
 * travaille debout, les mains prises : l'ecran par defaut est la file, le geste
 * principal est un bouton plein ecran, et rien n'oblige jamais a naviguer.
 *
 * Les onglets marques « gerant » disparaissent purement et simplement pour un
 * coiffeur — et les routes qu'ils appellent le refusent de toute facon.
 */
import { api, poserCsrf, surSessionPerdue, ErreurApi } from './api.js';
import { el, remplacer, annoncer } from './dom.js';
import { vueFile, brancherFlux, debrancherFlux } from './vue-file.js';
import { vueReglages } from './vue-reglages.js';
import { vueStatistiques } from './vue-statistiques.js';
import { vueComptes } from './vue-comptes.js';
import { vueAffiche } from './vue-affiche.js';
import { vueFermetures } from './vue-fermetures.js';
import { vueTarifas } from './vue-tarifas.js';

const racine = document.getElementById('application');

export const etat = {
  utilisateur: null,
  onglet: 'file',
};

const ONGLETS = [
  { cle: 'file', libelle: 'La fila', rendre: vueFile },
  { cle: 'tarifas', libelle: 'Tarifas', rendre: vueTarifas, gerant: true },
  { cle: 'affiche', libelle: 'Código QR', rendre: vueAffiche },
  { cle: 'statistiques', libelle: 'Cifras', rendre: vueStatistiques },
  { cle: 'fermetures', libelle: 'Vacaciones', rendre: vueFermetures, gerant: true },
  { cle: 'reglages', libelle: 'Ajustes', rendre: vueReglages, gerant: true },
  { cle: 'comptes', libelle: 'Cuentas', rendre: vueComptes, gerant: true },
];

const estGerant = () => etat.utilisateur?.role === 'GERANT';
const ongletsVisibles = () => ONGLETS.filter((o) => !o.gerant || estGerant());

/* ------------------------------------------------------------------ */
/*  Connexion                                                          */
/* ------------------------------------------------------------------ */

function ecranConnexion({ message = null } = {}) {
  const erreur = el('p.alerte.alerte--refus', { role: 'alert', hidden: !message, texte: message || '' });

  const identifiant = el('input', { id: 'c-identifiant', name: 'identifiant', type: 'text', autocomplete: 'username', required: true, autocapitalize: 'none', spellcheck: 'false' });
  const motDePasse = el('input', { id: 'c-motdepasse', name: 'motDePasse', type: 'password', autocomplete: 'current-password', required: true });
  const bouton = el('button.bouton.bouton--principal.bouton--geant', { type: 'submit', texte: 'Entrar' });

  const formulaire = el('form.formulaire', {
    surSubmit: async (evenement) => {
      evenement.preventDefault();
      erreur.hidden = true;
      bouton.disabled = true;
      bouton.textContent = 'Un momento…';
      try {
        const reponse = await api.post('/api/auth/login', {
          identifiant: identifiant.value.trim(),
          motDePasse: motDePasse.value,
        });
        poserCsrf(reponse.csrfToken);
        etat.utilisateur = reponse.utilisateur;
        motDePasse.value = '';
        rendre();
      } catch (err) {
        erreur.textContent = err.message;
        erreur.hidden = false;
        bouton.disabled = false;
        bouton.textContent = 'Entrar';
        motDePasse.focus();
        motDePasse.select();
      }
    },
  },
  erreur,
  el('div.champ', el('label', { for: 'c-identifiant', texte: 'Usuario' }), identifiant),
  el('div.champ', el('label', { for: 'c-motdepasse', texte: 'Contraseña' }), motDePasse),
  bouton);

  return el('main.enveloppe.page-etroite#principal',
    el('div.connexion',
      el('p.pastille', { texte: 'Área del salón' }),
      el('h1.titre-page', { texte: 'Peluquería HARON' }),
      el('p.texte-doux', { texte: 'Entra para llevar la fila del día.' }),
      el('section.carte', formulaire)));
}

/* ------------------------------------------------------------------ */
/*  Changement de mot de passe impose                                  */
/* ------------------------------------------------------------------ */

function ecranMotDePasse() {
  const erreur = el('p.alerte.alerte--refus', { role: 'alert', hidden: true });
  const actuel = el('input', { id: 'm-actuel', type: 'password', autocomplete: 'current-password', required: true });
  const nouveau = el('input', { id: 'm-nouveau', type: 'password', autocomplete: 'new-password', required: true, minlength: '12' });
  const bouton = el('button.bouton.bouton--principal.bouton--geant', { type: 'submit', texte: 'Guardar' });

  const formulaire = el('form.formulaire', {
    surSubmit: async (evenement) => {
      evenement.preventDefault();
      erreur.hidden = true;
      bouton.disabled = true;
      try {
        await api.post('/api/auth/mot-de-passe', { actuel: actuel.value, nouveau: nouveau.value });
        etat.utilisateur = { ...etat.utilisateur, doitChangerMotDePasse: false };
        annoncer('Contraseña guardada.');
        rendre();
      } catch (err) {
        erreur.textContent = err.message;
        erreur.hidden = false;
        bouton.disabled = false;
      }
    },
  },
  erreur,
  el('div.champ', el('label', { for: 'm-actuel', texte: 'Contraseña actual' }), actuel),
  el('div.champ', el('label', { for: 'm-nouveau', texte: 'Contraseña nueva' }), nouveau,
    el('p.champ__aide', { texte: 'Al menos 12 caracteres.' })),
  bouton);

  return el('main.enveloppe.page-etroite#principal',
    el('h1.titre-page', { texte: 'Elige tu contraseña' }),
    el('p.texte-doux', { texte: 'Esta cuenta todavía usa una contraseña provisional. Cámbiala para continuar.' }),
    el('section.carte', formulaire));
}

/* ------------------------------------------------------------------ */
/*  Coquille                                                           */
/* ------------------------------------------------------------------ */

function barre() {
  const onglets = ongletsVisibles().map((o) => el('button.onglet', {
    type: 'button',
    'aria-current': etat.onglet === o.cle ? 'page' : null,
    texte: o.libelle,
    surClick: () => {
      if (etat.onglet === o.cle) return;
      etat.onglet = o.cle;
      window.location.hash = '#' + o.cle;
      rendre();
    },
  }));

  return el('header.gestion__entete',
    el('div.enveloppe.gestion__entete-contenu',
      el('div.gestion__marque',
        el('span.marque__peluqueria', { texte: 'Peluquería' }),
        el('span.marque__haron', { texte: 'HARON' })),
      el('nav.onglets', { 'aria-label': 'Secciones' }, onglets),
      el('div.gestion__compte',
        el('span.gestion__qui', { texte: etat.utilisateur?.nomComplet || etat.utilisateur?.identifiant || '' }),
        el('button.bouton.bouton--discret.bouton--petit', {
          type: 'button',
          texte: 'Salir',
          surClick: async () => {
            debrancherFlux();
            await api.post('/api/auth/logout').catch(() => {});
            etat.utilisateur = null;
            poserCsrf(null);
            rendre();
          },
        }))));
}

export function rendre() {
  debrancherFlux();

  if (!etat.utilisateur) {
    remplacer(racine, ecranConnexion());
    document.querySelector('#c-identifiant')?.focus();
    return;
  }
  if (etat.utilisateur.doitChangerMotDePasse) {
    remplacer(racine, ecranMotDePasse());
    document.querySelector('#m-actuel')?.focus();
    return;
  }

  const onglet = ongletsVisibles().find((o) => o.cle === etat.onglet) || ongletsVisibles()[0];
  etat.onglet = onglet.cle;

  const contenu = el('main.gestion__contenu#principal');
  remplacer(racine, barre(), contenu);

  onglet.rendre(contenu, { etat, rendre }).catch((err) => {
    remplacer(contenu, el('div.enveloppe.page-etroite',
      el('p.alerte.alerte--refus', { role: 'alert', texte: err instanceof ErreurApi ? err.message : 'No se ha podido cargar esta pantalla.' })));
  });

  if (onglet.cle === 'file') brancherFlux(contenu);
}

/* ------------------------------------------------------------------ */
/*  Demarrage                                                          */
/* ------------------------------------------------------------------ */

surSessionPerdue(() => {
  if (!etat.utilisateur) return;
  etat.utilisateur = null;
  rendre();
});

const depuisAdresse = window.location.hash.replace('#', '');
if (ONGLETS.some((o) => o.cle === depuisAdresse)) etat.onglet = depuisAdresse;

window.addEventListener('hashchange', () => {
  const cle = window.location.hash.replace('#', '');
  if (ONGLETS.some((o) => o.cle === cle) && cle !== etat.onglet) {
    etat.onglet = cle;
    rendre();
  }
});

try {
  const session = await api.get('/api/auth/session');
  poserCsrf(session.csrfToken);
  etat.utilisateur = session.utilisateur;
} catch {
  etat.utilisateur = null;
}
rendre();
