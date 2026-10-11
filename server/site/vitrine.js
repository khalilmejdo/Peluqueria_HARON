/**
 * LA VITRINE — le site de la maison.
 *
 * Elle suit l'ordre dans lequel un client decide, et chaque section n'existe
 * que si elle a quelque chose a dire :
 *
 *   l'ouverture   le nom, l'accroche, l'image ; reserver ou prendre son tour
 *   les reperes   aujourd'hui, l'adresse, le telephone, en une ligne
 *   la maison     quelques lignes sur le salon (si le gerant les a ecrites)
 *   la carte      les prestations par chapitre, prix et durees
 *   reserver      les rendez-vous (prochaines heures libres) et/ou la file
 *   l'equipe      les professionnels
 *   la galerie    les photos
 *   l'acces       la carte, l'adresse, les horaires, appeler
 *
 * Rien ici ne calcule ni ne lit la base : tout arrive pret de la route, et ce
 * fichier ne fait que composer.
 */
import { escapeHtml, normalize } from '../core/text.js';
import { decouperNom } from './mise-en-page.js';
import { monogramme, filet, icone, planStylise } from './ornements.js';
import { iconeTarifa } from './icones-tarifas.js';

const e = escapeHtml;

/* ------------------------------------------------------------------ */
/*  L'etat du salon, en une ligne                                      */
/* ------------------------------------------------------------------ */

/**
 * « Ouvert · jusqu'a 20:30 », « Ferme · ouvre a 17:00 », « Ferme aujourd'hui ».
 * Rien quand on ne SAIT pas : sans horaires declares, « ouvert » serait un
 * mensonge le dimanche.
 */
export function etatDuMoment({ tr, horaires, prise }) {
  if (prise && !prise.ouverte && prise.code === 'SALON_EN_CONGES') {
    return { classe: 'ferme', texte: tr('vt.etat.conges') };
  }
  if (!horaires) return null;
  if (horaires.ouvert) {
    return { classe: 'ouvert', texte: horaires.fermeture ? tr('vt.etat.ouvertJusqua', { heure: horaires.fermeture }) : tr('vt.etat.ouvert') };
  }
  if (horaires.ouverture) {
    return { classe: 'ferme', texte: tr(horaires.enPause ? 'vt.etat.pause' : 'vt.etat.ouvreA', { heure: horaires.ouverture }) };
  }
  return { classe: 'ferme', texte: tr('vt.etat.fermeAujourdhui') };
}

/** « 10:00 – 14:00 · 17:00 – 20:30 », ou « Ferme ». Null sans horaires declares. */
export function horairesDuJour({ tr, plages, actifs }) {
  if (!actifs) return null;
  if (!plages.length) return tr('commun.ferme');
  return plages.map((p) => p.ouverture + ' – ' + p.fermeture).join(' · ');
}

/** L'en-tete d'une section : surtitre, titre, filet, et un chapeau facultatif. */
export function teteDeSection({ surtitre, titre, id, chapo = null, classe = '' }) {
  return '<header class="section__tete ' + classe + '">'
    + '<p class="surtitre">' + e(surtitre) + '</p>'
    + '<h2 class="section__titre" id="' + e(id) + '">' + e(titre) + '</h2>'
    + filet()
    + (chapo ? '<p class="section__chapo">' + e(chapo) + '</p>' : '')
    + '</header>';
}

/* ------------------------------------------------------------------ */
/*  L'ouverture                                                        */
/* ------------------------------------------------------------------ */

/**
 * LE HAUT DE LA PAGE.
 *
 * Avec une photo de couverture : elle occupe tout l'ecran, sous un voile qui
 * garde le texte lisible. Sans photo : le monogramme de la marque, en grand,
 * dans ses cercles fins — une page qui n'a pas encore de photo reste une page
 * de maison, pas un gabarit vide.
 *
 * @param {object} o
 * @param {Array<{href:string, texte:string, principal?:boolean}>} o.actions
 * @param {string} o.reperes  le HTML des pastilles (etat, file en direct)
 */
export function ouverture({ tr, nom, accroche, metier, actions, reperes = '', couverture = null, lettres = '' }) {
  const { petit, grand } = decouperNom(nom);
  const fond = couverture
    ? '<div class="une__fond"><img class="une__image" src="' + e(couverture.src) + '" alt=""'
      + (couverture.largeur ? ' width="' + couverture.largeur + '" height="' + couverture.hauteur + '"' : '')
      + ' fetchpriority="high" decoding="async"></div><div class="une__voile" aria-hidden="true"></div>'
    : '<div class="une__decor" aria-hidden="true">' + monogramme(lettres, { classe: 'une__monogramme' })
      + '<span class="une__anneau une__anneau--1"></span><span class="une__anneau une__anneau--2"></span></div>';

  return '<section class="une' + (couverture ? ' une--photo' : ' une--monogramme') + '" aria-labelledby="titre-une">'
    + fond
    + '<div class="une__dedans">'
    // Le metier n'est pas redit quand le nom le porte deja (« Barbería Atlas »).
    + (memeMot(petit, metier) ? '' : '<p class="surtitre une__surtitre">' + e(metier) + '</p>')
    + '<h1 class="une__titre" id="titre-une">'
    + (petit ? '<span class="une__titre-petit">' + e(petit) + '</span>' : '')
    + '<span class="une__titre-grand">' + e(grand) + '</span>'
    + '</h1>'
    + filet({ classe: 'une__filet' })
    + (accroche ? '<p class="une__accroche">' + e(accroche) + '</p>' : '')
    + (actions.length
      ? '<div class="une__actions">' + actions.map((a) => '<a class="bouton ' + (a.principal ? 'bouton--principal' : 'bouton--contour')
        + ' bouton--grand" href="' + e(a.href) + '"' + (a.principal ? ' data-appel-principal' : '') + '>' + e(a.texte) + '</a>').join('') + '</div>'
      : '')
    + (reperes ? '<ul class="une__reperes">' + reperes + '</ul>' : '')
    + '</div>'
    + '<a class="une__defiler" href="#apres-une" aria-label="' + e(tr('mx.une.defiler')) + '"><span></span></a>'
    + '</section>';
}

/**
 * L'OUVERTURE « EN IMAGES ».
 *
 * Le texte d'un cote, trois photos de l'autre, dans des cadres en arche : ce
 * qu'un salon de beaute vend se REGARDE, et une cliente decide sur une image
 * avant de lire un prix. Les photos sont celles de la galerie (la couverture
 * d'abord). Un salon qui n'en a pas encore garde la meme composition : les
 * arches sont peintes aux couleurs de la marque, le monogramme dans la
 * premiere — jamais un cadre gris qui s'excuse.
 *
 * @param {object} o
 * @param {Array<{src:string, legende?:string, largeur?:number, hauteur?:number}>} o.photos  trois au plus
 * @param {{ href:string, jour:string, heure:string }|null} o.prochain  la prochaine heure libre
 */
export function ouvertureImages({ tr, nom, accroche, metier, actions, reperes = '', photos = [], lettres = '', prochain = null }) {
  const { petit, grand } = decouperNom(nom);
  const cadres = [0, 1, 2].map((i) => {
    const p = photos[i];
    const classe = 'collage__cadre collage__cadre--' + (i + 1);
    if (!p) {
      return '<span class="' + classe + ' collage__cadre--vide" aria-hidden="true">'
        + (i === 0 ? monogramme(lettres, { classe: 'collage__monogramme' }) : '') + '</span>';
    }
    return '<a class="' + classe + '" href="#galerie" aria-label="' + e(tr('mx.une.voirGalerie')) + '">'
      + '<img class="collage__image" src="' + e(p.src) + '" alt="' + e(p.legende || tr('vt.galerie.photo', { n: i + 1 })) + '"'
      + (p.largeur ? ' width="' + p.largeur + '" height="' + p.hauteur + '"' : '')
      + (i === 0 ? ' fetchpriority="high"' : '') + ' decoding="async"></a>';
  }).join('');

  return '<section class="une une--images" aria-labelledby="titre-une">'
    + '<span class="une__halo une__halo--1" aria-hidden="true"></span><span class="une__halo une__halo--2" aria-hidden="true"></span>'
    + '<div class="une__grille">'
    + '<div class="une__dedans">'
    + (memeMot(petit, metier) ? '' : '<p class="etiquette-pilule une__surtitre">' + e(metier) + '</p>')
    + '<h1 class="une__titre" id="titre-une">'
    + (petit ? '<span class="une__titre-petit">' + e(petit) + '</span>' : '')
    + '<span class="une__titre-grand">' + e(grand) + '</span>'
    + '</h1>'
    + (accroche ? '<p class="une__accroche">' + e(accroche) + '</p>' : '')
    + (actions.length
      ? '<div class="une__actions">' + actions.map((a) => '<a class="bouton ' + (a.principal ? 'bouton--principal' : 'bouton--contour')
        + ' bouton--grand" href="' + e(a.href) + '"' + (a.principal ? ' data-appel-principal' : '') + '>' + e(a.texte) + '</a>').join('') + '</div>'
      : '')
    + (reperes ? '<ul class="une__reperes">' + reperes + '</ul>' : '')
    + '</div>'
    + '<div class="collage" role="group" aria-label="' + e(tr('mx.une.photos')) + '">'
    + cadres
    + (prochain
      ? '<a class="collage__carte" href="' + e(prochain.href) + '">'
        + '<span class="collage__carte-icone" aria-hidden="true">' + icone('calendrier') + '</span>'
        + '<span class="collage__carte-mots"><span class="collage__carte-quoi">' + e(tr('mx.une.prochain')) + '</span>'
        + '<span class="collage__carte-valeur">' + e(prochain.jour) + ' · ' + e(prochain.heure) + '</span></span></a>'
      : '')
    + '</div>'
    + '</div>'
    + '</section>';
}

const sansAccent = (v) => normalize(String(v || ''));
const memeMot = (a, b) => Boolean(a) && Boolean(b) && (sansAccent(a).includes(sansAccent(b)) || sansAccent(b).includes(sansAccent(a)));

/** Une pastille d'etat : un point de couleur, un texte. */
export function pastilleEtat({ classe, texte, attributs = '' }) {
  return '<li class="pastille-etat pastille-etat--' + e(classe) + '"' + attributs + '>'
    + '<span class="pastille-etat__point" aria-hidden="true"></span><span data-texte>' + e(texte) + '</span></li>';
}

/* ------------------------------------------------------------------ */
/*  Les reperes                                                        */
/* ------------------------------------------------------------------ */

/** Aujourd'hui, l'adresse, le telephone : ce qu'on cherche en arrivant. */
export function reperes({ tr, aujourdhui, adresse, telephone }) {
  const cases = [];
  if (aujourdhui) {
    cases.push('<div class="repere">' + icone('horloge', { classe: 'repere__icone' })
      + '<div><p class="repere__quoi">' + e(tr('vt.infos.aujourdhui')) + '</p><p class="repere__valeur">' + e(aujourdhui) + '</p></div></div>');
  }
  if (adresse) {
    cases.push('<a class="repere repere--lien" href="/#acces">' + icone('lieu', { classe: 'repere__icone' })
      + '<div><p class="repere__quoi">' + e(tr('vt.infos.adresse')) + '</p><p class="repere__valeur">' + e(adresse) + '</p></div></a>');
  }
  if (telephone) {
    cases.push('<a class="repere repere--lien" href="tel:' + e(telephone.replace(/[^+0-9]/g, '')) + '">' + icone('telephone', { classe: 'repere__icone' })
      + '<div><p class="repere__quoi">' + e(tr('vt.infos.telephone')) + '</p><p class="repere__valeur repere__valeur--chiffres">' + e(telephone) + '</p></div></a>');
  }
  if (!cases.length) return '<div id="apres-une"></div>';
  return '<section class="reperes" id="apres-une" aria-label="' + e(tr('vt.infos.aria')) + '">'
    + '<div class="reperes__dedans reperes__dedans--' + cases.length + '">' + cases.join('') + '</div>'
    + '</section>';
}

/* ------------------------------------------------------------------ */
/*  La maison                                                          */
/* ------------------------------------------------------------------ */

export function sectionMaison({ tr, presentation, lettres, photo = null }) {
  const texte = String(presentation || '').trim();
  if (!texte) return '';
  const paragraphes = texte.split(/\n{2,}|\r\n\r\n/).map((p) => '<p>' + e(p.trim()) + '</p>').join('');
  return '<section class="section section--maison" id="maison" aria-labelledby="titre-maison">'
    + '<div class="section__dedans maison">'
    + (photo
      ? '<div class="maison__photo"><img src="' + e(photo.src) + '" alt="' + e(photo.legende || '') + '"'
        + (photo.largeur ? ' width="' + photo.largeur + '" height="' + photo.hauteur + '"' : '') + ' loading="lazy" decoding="async"></div>'
      : '<div class="maison__embleme" aria-hidden="true">' + monogramme(lettres, { classe: 'maison__monogramme' }) + '</div>')
    + '<div class="maison__texte">'
    + teteDeSection({ surtitre: tr('mx.maison.surtitre'), titre: tr('mx.maison.titre'), id: 'titre-maison', classe: 'section__tete--gauche' })
    + '<div class="maison__corps">' + paragraphes + '</div>'
    + '</div>'
    + '</div>'
    + '</section>';
}

/* ------------------------------------------------------------------ */
/*  La carte                                                           */
/* ------------------------------------------------------------------ */

/**
 * LA CARTE, PAR CHAPITRES.
 *
 * Une ligne = le nom, un filet de points, le prix ; dessous, la duree et la
 * note. C'est la forme d'une carte de grande maison : le regard suit le filet
 * jusqu'au chiffre, sans hesiter sur la colonne. Les chapitres viennent de la
 * carte du salon ; une carte sans chapitre en a un seul, sans titre.
 */
export function sectionCarte({ tr, prestations, nota, avecPrix = true, fiches = false, reserver = false }) {
  if (!prestations.length) return '';
  const chapitres = [];
  for (const p of prestations) {
    const titre = p.categoria || '';
    let c = chapitres.find((x) => x.titre === titre);
    if (!c) {
      c = { titre, lignes: [] };
      chapitres.push(c);
    }
    c.lignes.push(p);
  }
  const unSeul = chapitres.length === 1;
  // EN FICHES (l'accueil « en images ») : une prestation = une carte, avec son
  // icone dans une pastille, et un lien qui ouvre la reservation DEJA cochee.
  const enFiches = () => chapitres.map((c) => '<div class="fiches__chapitre">'
    + (c.titre ? '<h3 class="fiches__titre">' + e(c.titre) + '</h3>' : (unSeul ? '' : '<h3 class="fiches__titre">' + e(tr('mx.carte.autres')) + '</h3>'))
    + '<ul class="fiches__liste">'
    + c.lignes.map((p) => {
      const lien = reserver && p.reservable !== false && p.id;
      return '<li class="fiche">'
        + '<span class="fiche__icone" aria-hidden="true">' + iconeTarifa(p.icono) + '</span>'
        + '<div class="fiche__mots"><p class="fiche__nom">' + e(p.nombre) + '</p>'
        + '<p class="fiche__detail">' + e(tr('mx.carte.duree', { n: p.duracionMin })) + (p.nota ? ' · ' + e(p.nota) : '') + '</p></div>'
        + (avecPrix ? '<p class="fiche__prix">' + e(p.precioTexte || p.precio) + '</p>' : '')
        + (lien
          ? '<a class="fiche__lien" href="/rendez-vous?p=' + e(p.id) + '" aria-label="' + e(tr('mx.carte.reserverCe', { nom: p.nombre })) + '">'
            + e(tr('mx.carte.reserver')) + icone('fleche') + '</a>'
          : '')
        + '</li>';
    }).join('')
    + '</ul></div>').join('');
  const html = fiches ? enFiches() : chapitres.map((c) => '<div class="menu__chapitre">'
    + (c.titre ? '<h3 class="menu__titre">' + e(c.titre) + '</h3>' : (unSeul ? '' : '<h3 class="menu__titre">' + e(tr('mx.carte.autres')) + '</h3>'))
    + '<ul class="menu__liste">'
    + c.lignes.map((p) => {
      const ico = iconeTarifa(p.icono);
      return '<li class="menu__ligne">'
        + '<span class="menu__icone" aria-hidden="true">' + ico + '</span>'
        + '<span class="menu__nom">' + e(p.nombre) + '</span>'
        + (avecPrix ? '<span class="menu__points" aria-hidden="true"></span><span class="menu__prix">' + e(p.precioTexte || p.precio) + '</span>' : '')
        + '<span class="menu__detail">' + e(tr('mx.carte.duree', { n: p.duracionMin })) + (p.nota ? ' · ' + e(p.nota) : '') + '</span>'
        + '</li>';
    }).join('')
    + '</ul></div>').join('');

  return '<section class="section section--carte" id="carte" aria-labelledby="titre-carte">'
    + '<div class="section__dedans">'
    + teteDeSection({ surtitre: tr('mx.carte.surtitre'), titre: tr('mx.carte.titre'), id: 'titre-carte' })
    + (fiches ? '<div class="fiches">' + html + '</div>' : '<div class="menu' + (unSeul ? ' menu--simple' : '') + '">' + html + '</div>')
    + (nota ? '<p class="menu__nota">' + e(nota) + '</p>' : '')
    + '</div>'
    + '</section>';
}

/* ------------------------------------------------------------------ */
/*  Reserver                                                           */
/* ------------------------------------------------------------------ */

/**
 * LES DEUX FACONS DE VENIR, COTE A COTE.
 *
 * Le rendez-vous montre les prochaines heures libres, chacune un lien direct
 * vers la reservation a cette heure. La file montre l'attente en direct et le
 * bouton pour prendre son tour — ou le formulaire lui-meme, quand la file est
 * la seule facon de venir (un barbier sans rendez-vous n'a pas a faire changer
 * de page a son client).
 *
 * @param {object} o
 * @param {{ prochains: Array<{href:string, jour:string, heure:string}>, fermeture?:string }|null} o.rdv
 * @param {{ statut:string, formulaire?:string, ouverte:boolean, message?:string }|null} o.file
 */
export function sectionReserver({ tr, rdv, file }) {
  if (!rdv && !file) return '';
  const cartes = [];
  if (rdv) {
    cartes.push('<article class="offre offre--rdv">'
      + '<span class="offre__icone" aria-hidden="true">' + icone('calendrier') + '</span>'
      + '<h3 class="offre__titre">' + e(tr('mx.rdv.titre')) + '</h3>'
      + '<p class="offre__texte">' + e(tr('mx.rdv.texte')) + '</p>'
      + (rdv.prochains.length
        ? '<p class="offre__sous-titre">' + e(tr('mx.rdv.prochains')) + '</p>'
          + '<ul class="apercu-creneaux">' + rdv.prochains.map((c) => '<li><a class="puce-heure" href="' + e(c.href) + '">'
            + '<span class="puce-heure__jour">' + e(c.jour) + '</span><span class="puce-heure__heure">' + e(c.heure) + '</span></a></li>').join('') + '</ul>'
        : '<p class="offre__note">' + e(rdv.fermeture || tr('mx.rdv.aucun')) + '</p>')
      + '<a class="bouton bouton--principal bouton--large" href="/rendez-vous">' + e(tr('mx.rdv.choisir')) + '</a>'
      + '</article>');
  }
  if (file) {
    cartes.push('<article class="offre offre--file' + (file.formulaire ? ' offre--formulaire' : '') + '">'
      + '<span class="offre__icone" aria-hidden="true">' + icone('file') + '</span>'
      + '<h3 class="offre__titre">' + e(tr('mx.file.titre')) + '</h3>'
      + '<p class="offre__texte">' + e(tr('mx.file.texte')) + '</p>'
      + file.statut
      + (file.ouverte
        ? (file.formulaire || '<a class="bouton bouton--contour bouton--large" href="/join">' + e(tr('mx.file.bouton')) + '</a>')
        : '<p class="offre__note offre__note--ferme">' + e(file.message || '') + '</p>')
      + '</article>');
  }
  return '<section class="section section--reserver" id="reserver" aria-labelledby="titre-reserver">'
    + '<div class="section__dedans">'
    + teteDeSection({ surtitre: tr('mx.venir.surtitre'), titre: tr('mx.venir.titre'), id: 'titre-reserver', chapo: tr('mx.venir.chapo') })
    + '<div class="offres offres--' + cartes.length + '">' + cartes.join('') + '</div>'
    + '</div>'
    + '</section>';
}

/* ------------------------------------------------------------------ */
/*  L'equipe                                                           */
/* ------------------------------------------------------------------ */

/**
 * Les professionnels de la maison. Un nom n'est montre que s'il a ete DONNE
 * (le coiffeur d'un fauteuil) : « Sillón 2 » n'est pas une personne.
 */
export function sectionEquipe({ tr, membres, rdvActifs }) {
  if (!membres.length) return '';
  const initiales = (nom) => String(nom).split(/\s+/).filter(Boolean).slice(0, 2).map((m) => m.charAt(0).toUpperCase()).join('');
  return '<section class="section section--equipe" id="equipe" aria-labelledby="titre-equipe">'
    + '<div class="section__dedans">'
    + teteDeSection({ surtitre: tr('mx.equipe.surtitre'), titre: tr('mx.equipe.titre'), id: 'titre-equipe' })
    + '<ul class="equipe equipe--' + Math.min(membres.length, 4) + '">'
    + membres.map((m) => '<li class="membre">'
      + '<span class="membre__portrait" aria-hidden="true">' + monogramme(initiales(m.nom), { classe: 'membre__monogramme' }) + '</span>'
      + '<p class="membre__nom">' + e(m.nom) + '</p>'
      + '<p class="membre__role">' + e(tr('mx.equipe.role')) + '</p>'
      + (rdvActifs ? '<a class="lien-fin membre__lien" href="/rendez-vous?pro=' + e(m.id) + '">' + e(tr('mx.equipe.reserver', { nom: m.nom })) + '</a>' : '')
      + '</li>').join('')
    + '</ul>'
    + '</div>'
    + '</section>';
}

/* ------------------------------------------------------------------ */
/*  La galerie                                                         */
/* ------------------------------------------------------------------ */

/**
 * Les photos, en mosaique ; un appui en ouvre une en grand (voir maison.js).
 * Sans JavaScript, chaque vignette est un LIEN vers la photo.
 * Aucune photo, aucune section : une vitrine qui s'excuse d'etre inachevee
 * fait moins bonne impression qu'une vitrine qui ne dit rien.
 */
export function sectionGalerie({ tr, photos, ruban = false }) {
  if (!photos.length) return '';
  if (ruban) return galerieEnRuban({ tr, photos });
  const vignettes = photos.map((p, i) => '<li class="galerie__case' + (i === 0 ? ' galerie__case--grande' : '') + '">'
    + '<a class="galerie__lien" href="' + e(p.src) + '" data-agrandir data-legende="' + e(p.legende || '') + '">'
    + '<img class="galerie__image" src="' + e(p.src) + '" alt="' + e(p.legende || tr('vt.galerie.photo', { n: i + 1 })) + '"'
    + (p.largeur ? ' width="' + p.largeur + '" height="' + p.hauteur + '"' : '')
    + (i > 1 ? ' loading="lazy"' : '') + ' decoding="async">'
    + (p.legende ? '<span class="galerie__legende">' + e(p.legende) + '</span>' : '')
    + '</a></li>').join('');

  return '<section class="section section--galerie" id="galerie" aria-labelledby="titre-galerie">'
    + '<div class="section__dedans">'
    + teteDeSection({ surtitre: tr('vt.galerie.surtitre'), titre: tr('galerie.titre'), id: 'titre-galerie' })
    + '<ul class="galerie galerie--' + Math.min(photos.length, 6) + '">' + vignettes + '</ul>'
    + '</div>'
    + '<div class="visionneuse" data-visionneuse hidden role="dialog" aria-modal="true" aria-label="' + e(tr('vt.galerie.visionneuse')) + '">'
    + '<button class="visionneuse__fermer" type="button" data-fermer aria-label="' + e(tr('vt.galerie.fermer')) + '">' + icone('croix') + '</button>'
    + '<button class="visionneuse__fleche visionneuse__fleche--avant" type="button" data-precedente aria-label="' + e(tr('vt.galerie.precedente')) + '">' + icone('retour') + '</button>'
    + '<figure class="visionneuse__cadre"><img class="visionneuse__image" alt="" data-image>'
    + '<figcaption class="visionneuse__legende" data-legende-grande></figcaption></figure>'
    + '<button class="visionneuse__fleche visionneuse__fleche--apres" type="button" data-suivante aria-label="' + e(tr('vt.galerie.suivante')) + '">' + icone('fleche') + '</button>'
    + '</div>'
    + '</section>';
}

const visionneuseHtml = (tr) => '<div class="visionneuse" data-visionneuse hidden role="dialog" aria-modal="true" aria-label="' + e(tr('vt.galerie.visionneuse')) + '">'
  + '<button class="visionneuse__fermer" type="button" data-fermer aria-label="' + e(tr('vt.galerie.fermer')) + '">' + icone('croix') + '</button>'
  + '<button class="visionneuse__fleche visionneuse__fleche--avant" type="button" data-precedente aria-label="' + e(tr('vt.galerie.precedente')) + '">' + icone('retour') + '</button>'
  + '<figure class="visionneuse__cadre"><img class="visionneuse__image" alt="" data-image>'
  + '<figcaption class="visionneuse__legende" data-legende-grande></figcaption></figure>'
  + '<button class="visionneuse__fleche visionneuse__fleche--apres" type="button" data-suivante aria-label="' + e(tr('vt.galerie.suivante')) + '">' + icone('fleche') + '</button>'
  + '</div>';

/**
 * LA GALERIE EN RUBAN : une rangee de grandes photos qui defile au doigt,
 * placee HAUT dans la page. Elle deborde de la colonne jusqu'aux bords de
 * l'ecran — on voit qu'il y en a d'autres sans avoir a le dire. Les deux
 * fleches n'existent que pour la souris ; au doigt, on glisse. Sans
 * JavaScript, le ruban defile quand meme et chaque photo reste un lien.
 */
function galerieEnRuban({ tr, photos }) {
  const cases = photos.map((p, i) => '<li class="ruban__case">'
    + '<a class="ruban__lien" href="' + e(p.src) + '" data-agrandir data-legende="' + e(p.legende || '') + '">'
    + '<img class="ruban__image" src="' + e(p.src) + '" alt="' + e(p.legende || tr('vt.galerie.photo', { n: i + 1 })) + '"'
    + (p.largeur ? ' width="' + p.largeur + '" height="' + p.hauteur + '"' : '')
    + (i > 2 ? ' loading="lazy"' : '') + ' decoding="async">'
    + (p.legende ? '<span class="ruban__legende">' + e(p.legende) + '</span>' : '')
    + '</a></li>').join('');
  return '<section class="section section--galerie section--ruban" id="galerie" aria-labelledby="titre-galerie">'
    + '<div class="section__dedans ruban__tete">'
    + '<div><p class="etiquette-pilule">' + e(tr('mx.galerie.surtitre')) + '</p>'
    + '<h2 class="section__titre" id="titre-galerie">' + e(tr('mx.galerie.titre')) + '</h2>'
    + '<p class="section__chapo">' + e(tr('mx.galerie.chapo')) + '</p></div>'
    + (photos.length > 2
      ? '<div class="ruban__fleches" data-ruban-fleches hidden>'
        + '<button class="ruban__fleche" type="button" data-ruban-avant aria-label="' + e(tr('mx.galerie.avant')) + '">' + icone('retour') + '</button>'
        + '<button class="ruban__fleche" type="button" data-ruban-apres aria-label="' + e(tr('mx.galerie.apres')) + '">' + icone('fleche') + '</button>'
        + '</div>'
      : '')
    + '</div>'
    + '<ul class="ruban" data-ruban tabindex="0" aria-label="' + e(tr('mx.une.photos')) + '">' + cases + '</ul>'
    + visionneuseHtml(tr)
    + '</section>';
}

/* ------------------------------------------------------------------ */
/*  L'acces                                                            */
/* ------------------------------------------------------------------ */

/**
 * LA CARTE SE CHARGE AU CLIC, PAS AVANT : une carte integree enverrait
 * l'adresse IP de chaque visiteur a un tiers des l'ouverture de la page.
 */
function blocCarte({ tr, coordonnees, adresse }) {
  const [lat, lon] = coordonnees ? coordonnees.split(',').map(Number) : [null, null];
  const devant = coordonnees
    ? '<button class="plan-carte__bouton" type="button" data-afficher-carte>' + icone('lieu') + e(tr('vt.lieu.afficherCarte')) + '</button>'
      + '<p class="plan-carte__note">' + e(tr('vt.lieu.noteCarte')) + '</p>'
    : '<p class="plan-carte__adresse">' + icone('lieu') + e(adresse || '') + '</p>';
  return '<div class="plan-carte"' + (coordonnees ? ' data-carte data-lat="' + lat + '" data-lon="' + lon + '"'
    + ' data-titre="' + e(tr('vt.lieu.titreCarte')) + '"' : '') + '>'
    + '<div class="plan-carte__fond" aria-hidden="true">' + planStylise() + '</div>'
    + '<div class="plan-carte__devant">' + devant + '</div>'
    + '</div>';
}

function tableHoraires({ tr, horaires, jourCourant }) {
  if (!horaires || !horaires.length) return '';
  return '<div class="horaires"><h3 class="acces__titre">' + e(tr('contact.horaires')) + '</h3><ul class="horaires__liste">'
    + horaires.map((h) => '<li' + (h.jour === jourCourant ? ' class="horaires__aujourdhui" aria-current="date"' : '') + '>'
      + '<span>' + e(h.nom) + '</span>'
      + '<span>' + (h.ferme ? e(tr('commun.ferme')) : e(h.plages.map((p) => p.ouverture + ' – ' + p.fermeture).join(' · '))) + '</span>'
      + '</li>').join('')
    + '</ul></div>';
}

export function sectionLieu({
  tr, avecLieu, avecContact, adresse, coordonnees, commentVenir, telephone, whatsapp, horaires, jourCourant,
}) {
  const lieu = avecLieu && (adresse || coordonnees);
  const joindre = avecContact && (telephone || whatsapp || (horaires && horaires.length));
  if (!lieu && !joindre) return '';

  const cible = coordonnees || adresse;
  const itineraire = cible ? 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(cible) : null;
  const numero = (v) => String(v).replace(/[^+0-9]/g, '');

  const boutons = [];
  if (lieu && itineraire) {
    boutons.push('<a class="bouton bouton--principal" href="' + e(itineraire) + '" target="_blank" rel="noopener noreferrer">'
      + icone('itineraire') + e(tr('lieu.itineraire')) + '</a>');
  }
  if (joindre && telephone) {
    boutons.push('<a class="bouton bouton--contour" href="tel:' + e(numero(telephone)) + '">' + icone('telephone') + e(tr('contact.appelerAction')) + '</a>');
  }
  if (joindre && whatsapp) {
    boutons.push('<a class="bouton bouton--contour" href="https://wa.me/' + e(numero(whatsapp).replace(/^\+/, '')) + '"'
      + ' target="_blank" rel="noopener noreferrer">' + icone('bulle') + 'WhatsApp</a>');
  }

  const coord = '<div class="acces__infos">'
    + (lieu && adresse
      ? '<div class="acces__bloc"><h3 class="acces__titre">' + e(tr('vt.infos.adresse')) + '</h3>'
        + '<p class="acces__adresse">' + e(adresse) + '</p>'
        + (commentVenir ? '<p class="acces__texte">' + e(commentVenir) + '</p>' : '')
        + '</div>'
      : '')
    + (joindre && (telephone || whatsapp)
      ? '<div class="acces__bloc"><h3 class="acces__titre">' + e(tr('contact.titre')) + '</h3>'
        + (telephone ? '<p class="acces__ligne"><a href="tel:' + e(numero(telephone)) + '">' + e(telephone) + '</a></p>' : '')
        + (whatsapp && whatsapp !== telephone ? '<p class="acces__ligne">WhatsApp · ' + e(whatsapp) + '</p>' : '')
        + '</div>'
      : '')
    + (boutons.length ? '<div class="acces__boutons">' + boutons.join('') + '</div>' : '')
    + (joindre ? tableHoraires({ tr, horaires, jourCourant }) : '')
    + '</div>';

  return '<section class="section section--acces" id="acces" aria-labelledby="titre-acces">'
    + '<div class="section__dedans">'
    + teteDeSection({ surtitre: tr('vt.lieu.surtitre'), titre: tr('vt.lieu.titre'), id: 'titre-acces' })
    + '<div class="acces' + (lieu ? '' : ' acces--seul') + '">'
    + (lieu ? blocCarte({ tr, coordonnees, adresse }) : '')
    + coord
    + '</div>'
    + '</div>'
    + '</section>';
}
