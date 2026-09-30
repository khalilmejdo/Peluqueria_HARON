/**
 * LA VITRINE — la page d'accueil, reconstruite comme le site d'un salon.
 *
 * L'ancienne page etait une colonne centree sans navigation, sans image, avec
 * la reservation sur une autre page, et des sections (contact, carte) qui
 * restaient invisibles tant qu'elles n'etaient pas remplies. Elle ressemblait a
 * un ecran d'application pose sur un fond sombre. Celle-ci suit l'ordre dans
 * lequel un client decide :
 *
 *   1. OU SUIS-JE, ET EST-CE OUVERT ?   l'en-tete : le nom, l'etat du moment
 *   2. EST-CE QUE CA ME PLAIT ?         l'ouverture : l'image, l'accroche
 *   3. COMBIEN, ET COMBIEN DE TEMPS ?   les tarifs, l'attente en direct
 *   4. JE RESERVE                        le formulaire, DANS la page
 *   5. JE VIENS                          la carte, l'adresse, les horaires
 *
 * Chaque section n'existe que si elle a quelque chose a dire, et le gerant peut
 * en retirer depuis les reglages. Rien ici ne calcule : tout arrive pret de la
 * route, et ce fichier ne fait que composer.
 */
import { escapeHtml } from '../core/text.js';
import { decouperNom } from './mise-en-page.js';
import { archeIllustree, planStylise, iconeLieu, iconeTelephone, iconeConversation, iconeEtape } from './illustrations.js';

const e = escapeHtml;

/* ------------------------------------------------------------------ */
/*  L'etat du salon, dit en une ligne                                  */
/* ------------------------------------------------------------------ */

/**
 * « Ouvert · jusqu'a 20:30 », « Ferme · ouvre a 17:00 », « Ferme aujourd'hui ».
 *
 * Rien n'est dit quand on ne SAIT pas : sans horaires declares, annoncer
 * « ouvert » serait un mensonge le dimanche. La pastille disparait alors, et
 * c'est mieux que de deviner.
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

/* ------------------------------------------------------------------ */
/*  L'ouverture                                                        */
/* ------------------------------------------------------------------ */

/**
 * Le haut de la vitrine : le nom en grand, l'accroche, l'attente en direct et
 * deux actions ; a droite, l'arche qui porte la photo de couverture — ou le
 * miroir dessine tant qu'il n'y en a pas.
 *
 * `affluence` arrive en HTML deja compose (les marques de la file, les
 * compteurs) : c'est le meme bloc que le script tient a jour, avec les memes
 * attributs `data-*`.
 */
export function ouverture({ tr, nom, accroche, affluence, appel, couverture, atouts = true }) {
  const { petit, grand } = decouperNom(nom);
  const image = couverture
    ? '<img class="vt-arche__photo" src="' + e(couverture.src) + '" alt="' + e(couverture.legende || nom) + '"'
      + (couverture.largeur ? ' width="' + couverture.largeur + '" height="' + couverture.hauteur + '"' : '')
      + ' fetchpriority="high" decoding="async">'
    : archeIllustree();

  return '<section class="vt-une" aria-labelledby="vt-titre">'
    + '<div class="vt-une__lumiere" aria-hidden="true"></div>'
    + '<div class="vt-une__dedans">'
    + '<div class="vt-une__texte">'
    // Le surtitre ne sert que si le nom tient en un mot : sinon sa premiere
    // partie (« Peluquería ») le dit deja, juste en dessous.
    + (petit ? '' : '<p class="vt-surtitre">' + e(tr('vt.une.surtitre')) + '</p>')
    + '<h1 class="vt-une__titre" id="vt-titre">'
    + (petit ? '<span class="vt-une__titre-petit">' + e(petit) + '</span>' : '')
    + '<span class="vt-une__titre-grand">' + e(grand) + '</span>'
    + '</h1>'
    + '<p class="vt-une__accroche">' + e(accroche) + '</p>'
    + affluence
    + appel
    + (atouts
      ? '<ul class="vt-atouts">'
        + ['vt.atout.compte', 'vt.atout.direct', 'vt.atout.duree'].map((c) => '<li>' + e(tr(c)) + '</li>').join('')
        + '</ul>'
      : '')
    + '</div>'
    + '<figure class="vt-arche' + (couverture ? ' vt-arche--photo' : '') + '">'
    + '<div class="vt-arche__cadre">' + image + '</div>'
    + (couverture && couverture.legende ? '<figcaption class="vt-arche__legende">' + e(couverture.legende) + '</figcaption>' : '')
    + '</figure>'
    + '</div>'
    + '</section>';
}

/* ------------------------------------------------------------------ */
/*  Le bandeau pratique                                                */
/* ------------------------------------------------------------------ */

/**
 * Trois informations, a hauteur d'yeux, juste sous l'ouverture : quand, ou,
 * comment joindre. C'est ce qu'on cherche en arrivant sur le site d'un
 * commerce, et c'etait enfoui en bas de page.
 */
export function infosPratiques({ tr, aujourdhui, adresse, telephone }) {
  const cases = [];
  if (aujourdhui) {
    cases.push('<div class="vt-info"><p class="vt-info__quoi">' + e(tr('vt.infos.aujourdhui')) + '</p>'
      + '<p class="vt-info__valeur">' + e(aujourdhui) + '</p></div>');
  }
  if (adresse) {
    cases.push('<a class="vt-info vt-info--lien" href="/#contact"><p class="vt-info__quoi">' + e(tr('vt.infos.adresse')) + '</p>'
      + '<p class="vt-info__valeur">' + e(adresse) + '</p></a>');
  }
  if (telephone) {
    cases.push('<a class="vt-info vt-info--lien" href="tel:' + e(telephone.replace(/[^+0-9]/g, '')) + '">'
      + '<p class="vt-info__quoi">' + e(tr('vt.infos.telephone')) + '</p>'
      + '<p class="vt-info__valeur vt-info__valeur--chiffres">' + e(telephone) + '</p></a>');
  }
  if (!cases.length) return '';
  return '<section class="vt-infos" aria-label="' + e(tr('vt.infos.aria')) + '">'
    + '<div class="vt-infos__dedans vt-infos__dedans--' + cases.length + '">' + cases.join('') + '</div>'
    + '</section>';
}

/* ------------------------------------------------------------------ */
/*  La reservation                                                     */
/* ------------------------------------------------------------------ */

/**
 * LA RESERVATION, DANS LA PAGE.
 *
 * Elle vivait sur une autre adresse : le client devait comprendre qu'il fallait
 * cliquer, attendre, puis remplir. Ici le formulaire est la, au milieu de la
 * vitrine, a cote de ce qui le rassure (les trois etapes). Il poste toujours
 * vers /join : sans JavaScript, il marche exactement pareil, et le code QR de
 * l'affiche, qui mene a /join, ne change pas.
 */
export function sectionReservation({ tr, contenu, etapes = true }) {
  const liste = etapes
    ? '<ol class="vt-etapes">'
      + [1, 2, 3].map((n) => '<li class="vt-etape">'
        + '<span class="vt-etape__icone" aria-hidden="true">' + iconeEtape(n - 1) + '</span>'
        + '<div><p class="vt-etape__titre"><span class="vt-etape__num">' + n + '.</span> ' + e(tr('etapes.' + n + '.titre')) + '</p>'
        + '<p class="vt-etape__texte">' + e(tr('etapes.' + n + '.texte')) + '</p></div>'
        + '</li>').join('')
      + '</ol>'
    : '';

  return '<section class="vt-section vt-resa" id="reserver" aria-labelledby="vt-resa-titre">'
    + '<div class="vt-section__dedans vt-resa__grille">'
    + '<div class="vt-resa__intro">'
    + '<p class="vt-surtitre">' + e(tr('vt.resa.surtitre')) + '</p>'
    + '<h2 class="vt-titre" id="vt-resa-titre">' + e(tr('vt.resa.titre')) + '</h2>'
    + '<p class="vt-chapo">' + e(tr('vt.resa.chapo')) + '</p>'
    + liste
    + '<p class="vt-resa__qr">' + e(tr('accueil.dejaAuSalonTexte')) + '</p>'
    + '</div>'
    + '<div class="vt-resa__carte">' + contenu + '</div>'
    + '</div>'
    + '</section>';
}

/* ------------------------------------------------------------------ */
/*  La galerie                                                         */
/* ------------------------------------------------------------------ */

/**
 * Les photos, en mosaique ; un appui en ouvre une en grand (voir accueil.js).
 *
 * Sans JavaScript, chaque vignette est un LIEN vers la photo : on la voit quand
 * meme en grand, simplement dans une nouvelle page.
 *
 * Aucune photo, aucune section. L'ancienne version montrait des dessins avec la
 * mention « les photos arrivent bientot » : une vitrine qui s'excuse d'etre
 * inachevee fait moins bonne impression qu'une vitrine qui ne dit rien.
 */
export function sectionGalerie({ tr, photos }) {
  if (!photos.length) return '';
  const vignettes = photos.map((p, i) => '<li class="vt-galerie__case' + (i === 0 ? ' vt-galerie__case--grande' : '') + '">'
    + '<a class="vt-galerie__lien" href="' + e(p.src) + '" data-agrandir data-legende="' + e(p.legende || '') + '">'
    + '<img class="vt-galerie__image" src="' + e(p.src) + '" alt="' + e(p.legende || tr('vt.galerie.photo', { n: i + 1 })) + '"'
    + (p.largeur ? ' width="' + p.largeur + '" height="' + p.hauteur + '"' : '')
    + (i > 1 ? ' loading="lazy"' : '') + ' decoding="async">'
    + (p.legende ? '<span class="vt-galerie__legende">' + e(p.legende) + '</span>' : '')
    + '</a></li>').join('');

  return '<section class="vt-section vt-galerie" id="galerie" aria-labelledby="vt-galerie-titre">'
    + '<div class="vt-section__dedans">'
    + '<div class="vt-tete">'
    + '<p class="vt-surtitre">' + e(tr('vt.galerie.surtitre')) + '</p>'
    + '<h2 class="vt-titre" id="vt-galerie-titre">' + e(tr('galerie.titre')) + '</h2>'
    + '</div>'
    + '<ul class="vt-galerie__grille vt-galerie__grille--' + Math.min(photos.length, 6) + '">' + vignettes + '</ul>'
    + '</div>'
    // La visionneuse : vide et cachee, remplie par le script au premier appui.
    + '<div class="vt-visionneuse" data-visionneuse hidden role="dialog" aria-modal="true" aria-label="' + e(tr('vt.galerie.visionneuse')) + '">'
    + '<button class="vt-visionneuse__fermer" type="button" data-fermer aria-label="' + e(tr('vt.galerie.fermer')) + '">×</button>'
    + '<button class="vt-visionneuse__fleche vt-visionneuse__fleche--avant" type="button" data-precedente aria-label="' + e(tr('vt.galerie.precedente')) + '">‹</button>'
    + '<figure class="vt-visionneuse__cadre"><img class="vt-visionneuse__image" alt="" data-image>'
    + '<figcaption class="vt-visionneuse__legende" data-legende-grande></figcaption></figure>'
    + '<button class="vt-visionneuse__fleche vt-visionneuse__fleche--apres" type="button" data-suivante aria-label="' + e(tr('vt.galerie.suivante')) + '">›</button>'
    + '</div>'
    + '</section>';
}

/* ------------------------------------------------------------------ */
/*  Nous trouver                                                       */
/* ------------------------------------------------------------------ */

/**
 * LA CARTE SE CHARGE AU CLIC, PAS AVANT.
 *
 * Une carte OpenStreetMap integree ferait partir l'adresse IP de chaque
 * visiteur vers un tiers des l'ouverture de la page, avant qu'il ait rien
 * demande. On montre donc le plan dessine du salon avec un bouton « Afficher la
 * carte » : un appui, et la vraie carte prend sa place, centree sur la porte.
 * Sans coordonnees, pas de vraie carte possible (il faudrait geocoder
 * l'adresse chez un tiers) : le bouton « Itineraire » fait alors le travail.
 */
function blocCarte({ tr, coordonnees, adresse }) {
  const [lat, lon] = coordonnees ? coordonnees.split(',').map(Number) : [null, null];
  const dansLaCarte = coordonnees
    ? '<button class="vt-carte__bouton" type="button" data-afficher-carte>'
      + '<span class="vt-carte__epingle" aria-hidden="true">' + iconeLieu() + '</span>'
      + e(tr('vt.lieu.afficherCarte')) + '</button>'
      + '<p class="vt-carte__note">' + e(tr('vt.lieu.noteCarte')) + '</p>'
    : '<p class="vt-carte__adresse"><span class="vt-carte__epingle" aria-hidden="true">' + iconeLieu() + '</span>'
      + e(adresse || '') + '</p>';
  return '<div class="vt-carte"' + (coordonnees ? ' data-carte data-lat="' + lat + '" data-lon="' + lon + '"'
    + ' data-titre="' + e(tr('vt.lieu.titreCarte')) + '"' : '') + '>'
    + '<div class="vt-carte__plan" aria-hidden="true">' + planStylise() + '</div>'
    + '<div class="vt-carte__devant">' + dansLaCarte + '</div>'
    + '</div>';
}

/**
 * Les horaires de la semaine, le jour courant mis en avant.
 * Une journee coupee s'ecrit en deux tranches — jamais en amplitude, qui ferait
 * venir un client a quinze heures devant un rideau baisse.
 */
function tableHoraires({ tr, horaires, jourCourant }) {
  if (!horaires || !horaires.length) return '';
  return '<div class="vt-horaires"><h3 class="vt-coord__titre">' + e(tr('contact.horaires')) + '</h3><ul>'
    + horaires.map((h) => '<li' + (h.jour === jourCourant ? ' class="vt-horaires__aujourdhui" aria-current="date"' : '') + '>'
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
      + e(tr('lieu.itineraire')) + '</a>');
  }
  if (joindre && telephone) {
    boutons.push('<a class="bouton bouton--discret vt-bouton-icone" href="tel:' + e(numero(telephone)) + '">'
      + '<span aria-hidden="true">' + iconeTelephone() + '</span>' + e(tr('contact.appelerAction')) + '</a>');
  }
  if (joindre && whatsapp) {
    boutons.push('<a class="bouton bouton--discret vt-bouton-icone" href="https://wa.me/' + e(numero(whatsapp).replace(/^\+/, '')) + '"'
      + ' target="_blank" rel="noopener noreferrer"><span aria-hidden="true">' + iconeConversation() + '</span>WhatsApp</a>');
  }

  const coord = '<div class="vt-coord">'
    + (lieu && adresse
      ? '<div class="vt-coord__bloc"><h3 class="vt-coord__titre">' + e(tr('vt.infos.adresse')) + '</h3>'
        + '<p class="vt-coord__adresse">' + e(adresse) + '</p>'
        + (commentVenir ? '<p class="vt-coord__texte">' + e(commentVenir) + '</p>' : '')
        + '</div>'
      : '')
    + (joindre && (telephone || whatsapp)
      ? '<div class="vt-coord__bloc"><h3 class="vt-coord__titre">' + e(tr('contact.titre')) + '</h3>'
        + (telephone ? '<p class="vt-coord__ligne"><a href="tel:' + e(numero(telephone)) + '">' + e(telephone) + '</a></p>' : '')
        + (whatsapp && whatsapp !== telephone ? '<p class="vt-coord__ligne">WhatsApp · ' + e(whatsapp) + '</p>' : '')
        + '</div>'
      : '')
    + (boutons.length ? '<div class="vt-coord__boutons">' + boutons.join('') + '</div>' : '')
    + (joindre ? tableHoraires({ tr, horaires, jourCourant }) : '')
    + '</div>';

  return '<section class="vt-section vt-lieu" id="contact" aria-labelledby="vt-lieu-titre">'
    + '<div class="vt-section__dedans">'
    + '<div class="vt-tete">'
    + '<p class="vt-surtitre">' + e(tr('vt.lieu.surtitre')) + '</p>'
    + '<h2 class="vt-titre" id="vt-lieu-titre">' + e(tr('vt.lieu.titre')) + '</h2>'
    + '</div>'
    + '<div class="vt-lieu__grille' + (lieu ? '' : ' vt-lieu__grille--seule') + '">'
    + (lieu ? blocCarte({ tr, coordonnees, adresse }) : '')
    + coord
    + '</div>'
    + '</div>'
    + '</section>';
}

/* ------------------------------------------------------------------ */
/*  Horaires du jour                                                   */
/* ------------------------------------------------------------------ */

/** « 10:00 – 14:00 · 17:00 – 20:30 », ou « Ferme ». Null sans horaires declares. */
export function horairesDuJour({ tr, plages, actifs }) {
  if (!actifs) return null;
  if (!plages.length) return tr('commun.ferme');
  return plages.map((p) => p.ouverture + ' – ' + p.fermeture).join(' · ');
}

