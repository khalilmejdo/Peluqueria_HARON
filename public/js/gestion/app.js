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

/**
 * VOIR CE QU'ON TAPE.
 *
 * Un mot de passe de douze caracteres se saisit au pouce, souvent debout dans
 * le salon, parfois avec les mains mouillees. Sans pouvoir le relire, on s'y
 * reprend a trois fois — et au troisieme echec le compte se verrouille.
 *
 * L'oeil barre est un BOUTON, pas une icone cliquable posee sur un div : au
 * clavier on l'atteint par Tab, et un lecteur d'ecran annonce son etat grace a
 * `aria-pressed`. Il fait quarante-quatre pixels de cote, la taille d'un
 * pouce, et vit DANS le champ plutot qu'a cote pour ne pas voler de largeur au
 * texte saisi.
 *
 * Il revient toujours a « masque » quand la page change : un mot de passe
 * laisse en clair sur la tablette du comptoir se lit depuis le fauteuil.
 */
function champMotDePasse(entree) {
  const bouton = el('button.champ__oeil', {
    type: 'button',
    'aria-pressed': 'false',
    'aria-label': 'Mostrar la contraseña',
    title: 'Mostrar la contraseña',
    surClick: () => {
      const visible = entree.type === 'text';
      entree.type = visible ? 'password' : 'text';
      bouton.setAttribute('aria-pressed', visible ? 'false' : 'true');
      const libelle = visible ? 'Mostrar la contraseña' : 'Ocultar la contraseña';
      bouton.setAttribute('aria-label', libelle);
      bouton.setAttribute('title', libelle);
      // Le curseur revient dans le champ, a la fin : sans cela, continuer a
      // taper demande un second appui, et on tape a cote.
      const fin = entree.value.length;
      entree.focus();
      entree.setSelectionRange?.(fin, fin);
    },
  });

  return el('div.champ__avec-oeil', entree, bouton);
}

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
  el('div.champ', el('label', { for: 'c-motdepasse', texte: 'Contraseña' }), champMotDePasse(motDePasse)),
  bouton);

  return el('main.enveloppe.page-etroite#principal',
    el('div.connexion',
      el('p.pastille', { texte: 'Área del salón' }),
      el('h1.titre-page', { texte: 'Peluquería HARON' }),
      el('p.texte-doux', { texte: 'Entra para llevar la fila del día.' }),
      el('section.carte', formulaire),
      /*
       * LA SORTIE. Apres « Salir », on atterrit ici — et sans ce lien, le seul
       * chemin vers la vitrine est de retaper l'adresse. C'est aussi l'ecran ou
       * arrive quelqu'un qui a suivi « Acceso del personal » par curiosite : lui
       * laisser une porte evite qu'il essaie un mot de passe pour voir.
       *
       * Un vrai lien, pas un bouton qui appelle `location` : il s'ouvre dans un
       * nouvel onglet au clic du milieu, et le navigateur le montre au survol.
       */
      el('div.connexion__sortie',
        el('a.bouton.bouton--discret', { href: '/', texte: 'Ir a la página del salón' }))));
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
  el('div.champ', el('label', { for: 'm-actuel', texte: 'Contraseña actual' }), champMotDePasse(actuel)),
  el('div.champ', el('label', { for: 'm-nouveau', texte: 'Contraseña nueva' }), champMotDePasse(nouveau),
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

/**
 * LE MENU LATERAL, SUR TELEPHONE.
 *
 * En haut, les onglets formaient une rangee qui defile horizontalement : sur un
 * ecran de telephone, les deux derniers vivaient hors du cadre et personne ne
 * les trouvait. Un tiroir lateral montre TOUTE la liste d'un coup, avec des
 * cibles hautes qu'on atteint au pouce, et il rend au passage les trois
 * centimetres de haut que la barre volait a la file.
 *
 * Aux grandes largeurs, rien ne change : les onglets restent en haut, ou ils
 * tiennent tous et ou un tiroir serait un clic de trop. C'est la feuille de
 * style qui bascule, pas le JavaScript — il n'y a donc qu'une seule liste
 * d'onglets dans la page, et jamais deux etats a garder d'accord.
 *
 * Le tiroir se ferme de quatre facons : en choisissant un onglet, par le voile,
 * par la croix, et par Echap. Un panneau qu'on ne sait pas fermer est un
 * panneau qui fait peur.
 */
function fermerTiroir() {
  document.body.classList.remove('tiroir-ouvert');
  document.querySelector('[data-tiroir]')?.setAttribute('aria-hidden', 'true');
  document.querySelector('[data-ouvrir-tiroir]')?.setAttribute('aria-expanded', 'false');
}

function ouvrirTiroir() {
  document.body.classList.add('tiroir-ouvert');
  const tiroir = document.querySelector('[data-tiroir]');
  tiroir?.setAttribute('aria-hidden', 'false');
  document.querySelector('[data-ouvrir-tiroir]')?.setAttribute('aria-expanded', 'true');
  // Le premier onglet prend le focus : au clavier comme au lecteur d'ecran, on
  // arrive DANS le menu, pas derriere lui.
  tiroir?.querySelector('.onglet')?.focus();
}

document.addEventListener('keydown', (evenement) => {
  if (evenement.key === 'Escape' && document.body.classList.contains('tiroir-ouvert')) fermerTiroir();
});

function barre() {
  const onglets = ongletsVisibles().map((o) => el('button.onglet', {
    type: 'button',
    'aria-current': etat.onglet === o.cle ? 'page' : null,
    texte: o.libelle,
    surClick: () => {
      fermerTiroir();
      if (etat.onglet === o.cle) return;
      etat.onglet = o.cle;
      window.location.hash = '#' + o.cle;
      rendre();
    },
  }));

  const ouvrir = el('button.gestion__menu', {
    type: 'button',
    'aria-expanded': 'false',
    'aria-label': 'Secciones',
    donnees: { ouvrirTiroir: '1' },
    surClick: ouvrirTiroir,
  }, el('span.gestion__menu-barres', { 'aria-hidden': 'true' }));

  return el('header.gestion__entete',
    el('div.enveloppe.gestion__entete-contenu',
      ouvrir,
      el('div.gestion__marque',
        el('span.marque__peluqueria', { texte: 'Peluquería' }),
        el('span.marque__haron', { texte: 'HARON' })),
      el('div.tiroir__voile', { donnees: { voile: '1' }, surClick: fermerTiroir }),
      el('nav.onglets', {
        'aria-label': 'Secciones',
        donnees: { tiroir: '1' },
      },
      el('div.tiroir__tete',
        el('span.tiroir__titre', { texte: 'Secciones' }),
        el('button.tiroir__fermer', {
          type: 'button', 'aria-label': 'Cerrar el menú', texte: '×', surClick: fermerTiroir,
        })),
      onglets),
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
