/**
 * L'ecran du salon : tenir la file a jour, indefiniment.
 *
 * CETTE PAGE RESTE OUVERTE DES SEMAINES. C'est ce qui la distingue de toutes
 * les autres, et ce qui commande tout ce fichier :
 *
 *   - RIEN NE S'ACCUMULE. Le contenu vivant est remplace en bloc, jamais
 *     ajoute. Aucun ecouteur n'est pose sur ce qu'on remplace, donc rien ne
 *     fuit ;
 *   - LA CONNEXION SE RECONSTRUIT TOUJOURS. `EventSource` se reconnecte seul,
 *     mais pas apres une coupure longue ni apres une mise en veille : on
 *     surveille le silence et on repart d'une connexion neuve. Un ecran qui
 *     affiche la file d'il y a deux heures est pire qu'un ecran noir, parce
 *     qu'il a l'air juste ;
 *   - LA PAGE SE RECHARGE AU CHANGEMENT DE JOUR. C'est le seul moment ou un
 *     rechargement ne derange personne, et il ramasse au passage la version
 *     deployee dans la nuit.
 *
 * Aucune donnee n'est assemblee en chaine HTML : tout passe par
 * `createElement` et `textContent`. Un prenom contenant « <script> » n'est,
 * au pire, qu'un prenom bizarre sur un televiseur.
 */
import { t } from './langue.js';

/**
 * Le document n'existe pas quand ce fichier est importe par un test, qui ne
 * vient chercher que la fabrication du contenu. Tout ce qui touche a la page
 * est donc derriere ce garde-fou, et `demarrer()` n'est appele que dans un
 * navigateur — sans quoi l'import echouerait des la premiere ligne.
 */
const DANS_UN_NAVIGATEUR = typeof document !== 'undefined' && typeof window !== 'undefined';

const racine = DANS_UN_NAVIGATEUR ? document.querySelector('[data-pantalla]') : null;
const zone = DANS_UN_NAVIGATEUR ? document.querySelector('[data-corps]') : null;
const horloge = DANS_UN_NAVIGATEUR ? document.querySelector('[data-horloge]') : null;
const bandeauHorsLigne = DANS_UN_NAVIGATEUR ? document.querySelector('[data-hors-ligne]') : null;

/** Deux minutes sans un mot du serveur : la connexion est morte, elle le dit. */
const SILENCE_MAX_MS = 120000;
/** Le battement du serveur passe toutes les 25 s ; 40 s laissent de la marge. */
const VERIFICATION_MS = 40000;

let flux = null;
let dernierMessage = Date.now();
let jourAffiche = null;

/* ------------------------------------------------------------------ */
/*  Fabrication                                                        */
/* ------------------------------------------------------------------ */

function el(balise, classe, texte) {
  const element = document.createElement(balise);
  if (classe) element.className = classe;
  if (texte !== undefined && texte !== null) element.textContent = String(texte);
  return element;
}

function carte(tour, classe) {
  const li = el('li', 'tour ' + classe);
  li.append(el('span', 'tour__numero', tour.numero));
  if (tour.prenom) li.append(el('span', 'tour__prenom', tour.prenom));
  if (tour.poste) li.append(el('span', 'tour__poste', tour.poste));
  return li;
}

function liste(tours, classe, carteClasse) {
  const ul = el('ul', 'tours ' + classe);
  for (const tour of tours) ul.append(carte(tour, carteClasse));
  return ul;
}

/**
 * Le contenu vivant.
 *
 * Il reprend EXACTEMENT la mise en page rendue par le serveur dans
 * `server/site/index.js` (`corpsPantalla`). Les deux doivent produire la meme
 * chose : le serveur rend la premiere image, ce script rend les suivantes, et
 * deux mises en page qui divergent donnent un ecran qui saute des la premiere
 * mise a jour. Un test compare les deux.
 */
export function construireCorps(vue) {
  const fragment = document.createDocumentFragment();

  // Les appeles d'abord, puis ceux qui sont deja au fauteuil : on ne fait
  // jamais disparaitre un fauteuil occupe parce qu'on vient d'appeler a cote.
  const vedette = el('section', 'pantalla__vedette');
  if (vue.appeles.length || vue.auFauteuil.length) {
    vedette.append(el('p', 'pantalla__label', vue.appeles.length
      ? t(vue.appeles.length > 1 ? 'pantalla.cestATous' : 'pantalla.cestAToi')
      : t('pantalla.auFauteuil')));
    const ul = el('ul', 'tours tours--vedette');
    // « tour » et non « t » : « t » est le traducteur, et l ombrer dans une
    // boucle ferait qu un futur appel a t() y recevrait un ticket.
    for (const tour of vue.appeles) ul.append(carte(tour, 'tour--appele'));
    for (const tour of vue.auFauteuil) ul.append(carte(tour, 'tour--service'));
    vedette.append(ul);
  } else {
    vedette.classList.add('pantalla__vedette--vide');
    vedette.append(el('p', 'pantalla__label', t(vue.ouverte ? 'pantalla.fauteuilLibre' : 'pantalla.journeeClose')));
    vedette.append(el('p', 'pantalla__vide', t(vue.ouverte ? 'pantalla.passeQuandTuVeux' : 'pantalla.aDemain')));
  }
  fragment.append(vedette);

  const suite = el('section', 'pantalla__suite');
  suite.append(el('p', 'pantalla__label', 'Siguientes'));
  if (vue.attente.length) {
    suite.append(liste(vue.attente, 'tours--suite', 'tour--attente'));
    if (vue.deplus) suite.append(el('p', 'pantalla__deplus', t('pantalla.etDePlus', { n: vue.deplus })));
  } else {
    suite.classList.add('pantalla__suite--vide');
    suite.append(el('p', 'pantalla__vide', t('pantalla.personneEnAttente')));
  }
  fragment.append(suite);

  const chiffres = el('section', 'pantalla__chiffres');
  const chiffre = (valeur, libelle) => {
    const p = el('p');
    p.append(el('strong', null, valeur));
    p.append(document.createTextNode(' ' + libelle));
    return p;
  };
  chiffres.append(chiffre(vue.enAttente, 'esperando'));
  if (vue.enAttente) chiffres.append(chiffre('~' + vue.attenteEstimeeMinutes, 'min'));
  chiffres.append(chiffre(vue.servis, 'hoy'));
  fragment.append(chiffres);
  return fragment;
}

function peindre(vue) {
  // Remplacement EN BLOC. Rien n'est conserve, donc rien ne s'accumule.
  zone.replaceChildren(construireCorps(vue));

  // Le jour a change : la journee d'hier est close et le serveur peut avoir
  // ete redeploye dans la nuit. On repart proprement.
  if (jourAffiche && vue.jour !== jourAffiche) {
    location.reload();
    return;
  }
  jourAffiche = vue.jour;
}

/* ------------------------------------------------------------------ */
/*  Connexion                                                          */
/* ------------------------------------------------------------------ */

function horsLigne(oui) {
  if (bandeauHorsLigne) bandeauHorsLigne.hidden = !oui;
  if (racine) racine.classList.toggle('pantalla--hors-ligne', oui);
}

function brancher() {
  debrancher();
  // La cle de l'ecran voyage avec la page : elle est dans SON adresse, on la
  // repasse au flux. Sans cela, une page ouverte avec la bonne cle afficherait
  // un ecran fige, son flux ayant ete refuse — et rien ne le dirait.
  flux = new EventSource('/api/public/pantalla/flux' + location.search);

  flux.addEventListener('pantalla', (evenement) => {
    dernierMessage = Date.now();
    horsLigne(false);
    try {
      peindre(JSON.parse(evenement.data));
    } catch {
      // Un message illisible ne doit pas figer l'ecran pour la journee.
    }
  });

  // Le battement du serveur compte autant qu'un message : il prouve que la
  // connexion est vivante meme quand la file ne bouge pas de deux heures.
  flux.addEventListener('ping', () => { dernierMessage = Date.now(); });
  flux.addEventListener('open', () => { dernierMessage = Date.now(); horsLigne(false); });

  flux.addEventListener('error', () => {
    // On ne rebranche pas ici : EventSource reessaie de lui-meme, et se ruer
    // sur une reconnexion pendant une panne du serveur en ferait cinquante par
    // minute. La surveillance du silence s'en charge, plus lentement.
    horsLigne(true);
  });
}

function debrancher() {
  if (flux) {
    flux.close();
    flux = null;
  }
}

/**
 * La surveillance du silence.
 *
 * C'est elle qui rattrape les cas ou `EventSource` croit sa connexion vivante
 * alors qu'elle ne l'est plus : coupure du wifi du salon, veille du
 * televiseur, proxy qui a ferme la connexion sans le dire. Sans elle, l'ecran
 * reste sur la file d'il y a deux heures, et personne ne s'en apercoit avant
 * qu'un client se plaigne.
 */
function surveillerLeSilence() {
  const minuteur = setInterval(() => {
    if (Date.now() - dernierMessage < SILENCE_MAX_MS) return;
    horsLigne(true);
    brancher();
  }, VERIFICATION_MS);
  return minuteur;
}

/* ------------------------------------------------------------------ */
/*  L'heure                                                            */
/* ------------------------------------------------------------------ */

function peindreHorloge() {
  if (!horloge) return;
  const maintenant = new Date();
  horloge.textContent = String(maintenant.getHours()).padStart(2, '0')
    + ':' + String(maintenant.getMinutes()).padStart(2, '0');
}

/* ------------------------------------------------------------------ */
/*  Demarrage                                                          */
/* ------------------------------------------------------------------ */

function demarrer() {
  peindreHorloge();
  setInterval(peindreHorloge, 20000);
  surveillerLeSilence();

  // Au retour de veille, le televiseur rend parfois une connexion morte sans le
  // dire : on repart d'une connexion neuve plutot que de faire confiance.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    peindreHorloge();
    if (Date.now() - dernierMessage > SILENCE_MAX_MS) brancher();
  });

  brancher();
}

if (DANS_UN_NAVIGATEUR && zone) demarrer();
