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
import { t } from '../langue.js';
import { vueFile, brancherFlux, debrancherFlux } from './vue-file.js';
import { vueReglages } from './vue-reglages.js';
import { vueStatistiques } from './vue-statistiques.js';
import { vueComptes } from './vue-comptes.js';
import { vueAffiche } from './vue-affiche.js';
import { vueFermetures } from './vue-fermetures.js';
import { vueTarifas } from './vue-tarifas.js';
import { vueGalerie } from './vue-galerie.js';
import { vueAgenda } from './vue-agenda.js';
import { vueMarque } from './vue-marque.js';
import { vueAvis } from './vue-avis.js';

const racine = document.getElementById('application');

export const etat = {
  utilisateur: null,
  onglet: 'file',
  /** Declaree par le serveur avec la session ; voir motDePasseMin(). */
  motDePasseMin: null,
};

/**
 * Les onglets portent une CLE de texte, pas un libelle.
 *
 * Ce tableau est construit une fois au chargement du module ; un libelle ecrit
 * ici aurait ete fige dans la langue du premier rendu, et la barre de navigation
 * serait restee en espagnol apres un passage en francais — le genre
 * d'incoherence qui fait croire que l'enregistrement a echoue.
 *
 * La cle de texte est distincte de la cle d'onglet : celle-ci se retrouve dans
 * l'adresse (« /gestion#tarifas ») et ne doit jamais changer, sous peine de
 * casser les liens que le personnel a mis en favori.
 */
const ONGLETS = [
  { cle: 'file', texte: 'nav.file', rendre: vueFile },
  { cle: 'agenda', texte: 'nav.agenda', rendre: vueAgenda },
  { cle: 'tarifas', texte: 'nav.tarifs', rendre: vueTarifas, gerant: true },
  { cle: 'galerie', texte: 'nav.galerie', rendre: vueGalerie, gerant: true },
  { cle: 'avis', texte: 'nav.avis', rendre: vueAvis, gerant: true },
  { cle: 'affiche', texte: 'nav.qr', rendre: vueAffiche },
  { cle: 'statistiques', texte: 'nav.chiffres', rendre: vueStatistiques },
  { cle: 'fermetures', texte: 'nav.conges', rendre: vueFermetures, gerant: true },
  { cle: 'reglages', texte: 'nav.reglages', rendre: vueReglages, gerant: true },
  { cle: 'comptes', texte: 'nav.comptes', rendre: vueComptes, gerant: true },
  // La marque : reservee a l'administrateur de la plateforme.
  { cle: 'marque', texte: 'nav.marque', rendre: vueMarque, superAdmin: true },
];

/**
 * La longueur minimale d'un mot de passe, telle que LE SERVEUR la declare.
 *
 * Elle arrive avec la session, donc elle ne peut pas mentir : c'est la meme
 * valeur qui accepte ou refuse la saisie. Le defaut ne sert qu'a la fraction de
 * seconde qui precede la premiere reponse du serveur.
 */
const motDePasseMin = () => etat.motDePasseMin || 12;

// L'administrateur de la plateforme fait tout ce que fait le gerant.
const estSuperAdmin = () => etat.utilisateur?.role === 'SUPERADMIN';
const estGerant = () => etat.utilisateur?.role === 'GERANT' || estSuperAdmin();

/**
 * Le logo de la barre : le dernier mot du nom en grand, le reste au-dessus —
 * la meme coupe que sur la vitrine (decouperNom, cote serveur).
 */
function marqueDuSalon(nom) {
  const mots = String(nom || document.documentElement.dataset.salon || '').trim().split(' ').filter(Boolean);
  const grand = mots.pop() || '';
  return [
    mots.length ? el('span.marque__petit', { texte: mots.join(' ') }) : null,
    el('span.marque__grand', { texte: grand }),
  ];
}
const ongletsVisibles = () => ONGLETS.filter((o) => (!o.gerant || estGerant()) && (!o.superAdmin || estSuperAdmin()));

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
    'aria-label': t('connexion.montrerMotDePasse'),
    title: t('connexion.montrerMotDePasse'),
    surClick: () => {
      const visible = entree.type === 'text';
      entree.type = visible ? 'password' : 'text';
      bouton.setAttribute('aria-pressed', visible ? 'false' : 'true');
      const libelle = t(visible ? 'connexion.montrerMotDePasse' : 'connexion.cacherMotDePasse');
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
  const bouton = el('button.bouton.bouton--principal.bouton--geant', { type: 'submit', texte: t('connexion.entrer') });

  const formulaire = el('form.formulaire', {
    surSubmit: async (evenement) => {
      evenement.preventDefault();
      erreur.hidden = true;
      bouton.disabled = true;
      bouton.textContent = t('commun.unMoment');
      try {
        const reponse = await api.post('/api/auth/login', {
          identifiant: identifiant.value.trim(),
          motDePasse: motDePasse.value,
        });
        poserCsrf(reponse.csrfToken);
        etat.utilisateur = reponse.utilisateur;
        etat.salon = reponse.salon ?? etat.salon;
        etat.motDePasseMin = reponse.motDePasseMin ?? etat.motDePasseMin;
        motDePasse.value = '';
        rendre();
      } catch (err) {
        erreur.textContent = err.message;
        erreur.hidden = false;
        bouton.disabled = false;
        bouton.textContent = t('connexion.entrer');
        motDePasse.focus();
        motDePasse.select();
      }
    },
  },
  erreur,
  el('div.champ', el('label', { for: 'c-identifiant', texte: t('connexion.identifiant') }), identifiant),
  el('div.champ', el('label', { for: 'c-motdepasse', texte: t('connexion.motDePasse') }), champMotDePasse(motDePasse)),
  bouton);

  return el('main.enveloppe.page-etroite#principal',
    el('div.connexion',
      el('p.pastille', { texte: t('connexion.titre') }),
      // Le nom de l'enseigne ne se traduit pas.
      el('h1.titre-page.connexion__nom', { texte: document.documentElement.dataset.salon || '' }),
      el('p.texte-doux', { texte: t('connexion.sousTitre') }),
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
        el('a.bouton.bouton--discret', { href: '/', texte: t('nav.pageDuSalon') }))));
}

/* ------------------------------------------------------------------ */
/*  Changement de mot de passe impose                                  */
/* ------------------------------------------------------------------ */

function ecranMotDePasse() {
  const erreur = el('p.alerte.alerte--refus', { role: 'alert', hidden: true });
  const actuel = el('input', { id: 'm-actuel', type: 'password', autocomplete: 'current-password', required: true });
  const nouveau = el('input', {
    id: 'm-nouveau', type: 'password', autocomplete: 'new-password', required: true,
    minlength: String(motDePasseMin()),
  });
  const bouton = el('button.bouton.bouton--principal.bouton--geant', { type: 'submit', texte: t('commun.guardar') });

  const formulaire = el('form.formulaire', {
    surSubmit: async (evenement) => {
      evenement.preventDefault();
      erreur.hidden = true;
      bouton.disabled = true;
      try {
        await api.post('/api/auth/mot-de-passe', { actuel: actuel.value, nouveau: nouveau.value });
        etat.utilisateur = { ...etat.utilisateur, doitChangerMotDePasse: false };
        annoncer(t('connexion.motDePasseEnregistre'));
        rendre();
      } catch (err) {
        erreur.textContent = err.message;
        erreur.hidden = false;
        bouton.disabled = false;
      }
    },
  },
  erreur,
  el('div.champ', el('label', { for: 'm-actuel', texte: t('connexion.motDePasseActuel') }), champMotDePasse(actuel)),
  el('div.champ', el('label', { for: 'm-nouveau', texte: t('connexion.motDePasseNouveau') }), champMotDePasse(nouveau),
    el('p.champ__aide', { texte: t('connexion.auMoins', { n: motDePasseMin() }) })),
  bouton);

  return el('main.enveloppe.page-etroite#principal',
    el('h1.titre-page', { texte: t('connexion.choisirMotDePasse') }),
    el('p.texte-doux', { texte: t('connexion.motDePasseProvisoire') }),
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
    texte: t(o.texte),
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
    'aria-label': t('nav.sections'),
    donnees: { ouvrirTiroir: '1' },
    surClick: ouvrirTiroir,
  }, el('span.gestion__menu-barres', { 'aria-hidden': 'true' }));

  return el('header.gestion__entete',
    el('div.enveloppe.gestion__entete-contenu',
      ouvrir,
      el('div.gestion__marque',
        // Le nom du salon, tel que la session le donne : il etait ecrit en dur.
        ...marqueDuSalon(etat.salon)),
      el('div.tiroir__voile', { donnees: { voile: '1' }, surClick: fermerTiroir }),
      el('nav.onglets', {
        'aria-label': t('nav.sections'),
        donnees: { tiroir: '1' },
      },
      el('div.tiroir__tete',
        el('span.tiroir__titre', { texte: t('nav.sections') }),
        el('button.tiroir__fermer', {
          type: 'button', 'aria-label': t('nav.fermerMenu'), texte: '×', surClick: fermerTiroir,
        })),
      onglets),
      el('div.gestion__compte',
        el('span.gestion__qui', { texte: etat.utilisateur?.nomComplet || etat.utilisateur?.identifiant || '' }),
        el('button.bouton.bouton--discret.bouton--petit', {
          type: 'button',
          texte: t('nav.sortir'),
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
      el('p.alerte.alerte--refus', {
        role: 'alert',
        texte: err instanceof ErreurApi ? err.message : t('nav.chargementEchoue'),
      })));
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
  etat.salon = session.salon ?? null;
  etat.motDePasseMin = session.motDePasseMin ?? null;
} catch {
  etat.utilisateur = null;
}
rendre();
