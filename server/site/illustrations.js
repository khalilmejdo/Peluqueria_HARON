/**
 * Les illustrations de la vitrine.
 *
 * Dessinees a la main, en SVG, servies dans le HTML de la page. Pourquoi pas des
 * photographies ?
 *
 *   - la politique de securite du contenu n'autorise que « img-src 'self' » :
 *     aucune image d'un autre domaine n'entrerait dans la page ;
 *   - une photo de banque d'images se reconnait, et un salon de quartier n'a
 *     rien a gagner a ressembler a tous les autres ;
 *   - un SVG reste net sur un ecran de telephone comme sur une vitrine en 4K,
 *     pese trois kilo-octets, et suit automatiquement les couleurs du theme.
 *
 * Les VRAIES photos du salon ont leur place, elles : voir la galerie, alimentee
 * par les fichiers que le gerant depose sur le serveur.
 *
 * Toutes les formes utilisent `currentColor` ou les classes du theme : aucune
 * couleur n'est ecrite deux fois, ici et dans la feuille de style.
 */

/**
 * Le mat de barbier — l'objet qui dit « barbier » sans un mot.
 *
 * La spirale n'est pas un degrade : ce sont des bandes obliques dans un
 * rectangle arrondi, decoupees par un chemin de rognage. C'est ce qui lui donne
 * son aplomb a toutes les tailles, la ou un degrade repete baverait.
 */
export function matDeBarbier() {
  return '<svg class="illu illu--mat" viewBox="0 0 40 120" fill="none" aria-hidden="true" focusable="false">'
    + '<defs>'
    + '<clipPath id="illu-mat-tube"><rect x="11" y="18" width="18" height="84" rx="9"/></clipPath>'
    + '</defs>'
    // Les embouts, en haut et en bas.
    + '<path d="M8 18 Q20 8 32 18" class="illu__laiton-plein"/>'
    + '<rect x="7" y="9" width="26" height="9" rx="4.5" class="illu__laiton-plein"/>'
    + '<rect x="7" y="102" width="26" height="9" rx="4.5" class="illu__laiton-plein"/>'
    // Le tube, puis les bandes obliques rognees dedans.
    + '<rect x="11" y="18" width="18" height="84" rx="9" class="illu__tube"/>'
    + '<g clip-path="url(#illu-mat-tube)">'
    + [0, 1, 2, 3, 4, 5, 6, 7].map((i) => '<path d="M' + (-14 + i * 15) + ' 110 L' + (6 + i * 15) + ' 10 '
      + 'L' + (14 + i * 15) + ' 10 L' + (-6 + i * 15) + ' 110 Z" class="illu__bande"/>').join('')
    + '</g>'
    + '<rect x="11" y="18" width="18" height="84" rx="9" class="illu__tube-bord"/>'
    + '</svg>';
}

/**
 * Le fauteuil de barbier, de profil.
 *
 * Volontairement schematique : quelques traits qui se lisent en un dixieme de
 * seconde. Un dessin detaille aurait l'air d'un dessin detaille rate.
 */
export function fauteuil() {
  return '<svg class="illu illu--fauteuil" viewBox="0 0 120 120" fill="none" aria-hidden="true" focusable="false">'
    + '<g class="illu__trait">'
    // Le pied et la colonne.
    + '<path d="M34 108 H86"/>'
    + '<path d="M60 108 V82"/>'
    + '<path d="M44 96 H76"/>'
    // L'assise et le dossier.
    + '<path d="M30 82 H90 a6 6 0 0 0 6-6 V70 a6 6 0 0 0-6-6 H36 a6 6 0 0 0-6 6 v6 a6 6 0 0 0 6 6 Z"/>'
    + '<path d="M82 64 V28 a8 8 0 0 0-8-8 H52 a8 8 0 0 0-8 8 v36"/>'
    // L'appuie-tete et l'accoudoir.
    + '<path d="M52 20 V14 a5 5 0 0 1 5-5 h12 a5 5 0 0 1 5 5 v6"/>'
    + '<path d="M30 70 H18 a5 5 0 0 0-5 5 v9"/>'
    + '</g>'
    + '</svg>';
}

/**
 * Les ciseaux et le peigne croises — l'embleme des metiers de la coupe.
 * Sert de filigrane derriere le titre : tres grand, tres pale.
 */
export function ciseauxEtPeigne() {
  return '<svg class="illu illu--filigrane" viewBox="0 0 200 200" fill="none" aria-hidden="true" focusable="false">'
    + '<g class="illu__trait-fin">'
    // Les ciseaux.
    + '<path d="M62 32 L132 142"/>'
    + '<path d="M138 32 L68 142"/>'
    + '<circle cx="60" cy="152" r="14"/>'
    + '<circle cx="140" cy="152" r="14"/>'
    // Le peigne, en diagonale.
    + '<path d="M28 96 L172 96" transform="rotate(-38 100 96)"/>'
    + '<path d="M28 108 L172 108" transform="rotate(-38 100 102)"/>'
    + [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => '<path d="M' + (34 + i * 15) + ' 96 V78" '
      + 'transform="rotate(-38 100 96)"/>').join('')
    + '</g>'
    + '</svg>';
}

/* ------------------------------------------------------------------ */
/*  Les trois etapes                                                   */
/* ------------------------------------------------------------------ */

/** Un telephone, pour « pide tu turno ». */
const iconeTelephone = '<rect x="7" y="2" width="18" height="28" rx="4"/>'
  + '<path d="M13 6 H19"/>'
  + '<path d="M11 14 H21 M11 19 H18"/>';

/** Une file de personnes vue de dessus, pour « sigue tu posición ». */
const iconeFile = '<circle cx="9" cy="9" r="4"/>'
  + '<path d="M3 22 a6 6 0 0 1 12 0"/>'
  + '<circle cx="23" cy="11" r="3.2"/>'
  + '<path d="M18 22 a5 5 0 0 1 10 0"/>';

/** Une porte qui s'ouvre, pour « llega a tiempo ». */
const iconePorte = '<path d="M7 29 V6 l14-3 v27 Z"/>'
  + '<path d="M21 29 H27 V3"/>'
  + '<circle cx="11.5" cy="17" r="1.4" class="illu__point"/>';

const ICONES_ETAPES = [iconeTelephone, iconeFile, iconePorte];

/**
 * L'icone d'une etape. Un seul trait, la meme epaisseur partout : trois
 * pictogrammes d'epaisseurs differentes donneraient l'impression d'un
 * assemblage.
 */
export function iconeEtape(index) {
  const formes = ICONES_ETAPES[index] || iconeTelephone;
  return '<svg class="illu illu--etape" viewBox="0 0 32 32" fill="none" aria-hidden="true" focusable="false">'
    + '<g class="illu__trait">' + formes + '</g>'
    + '</svg>';
}

/**
 * Le rasoir droit, ouvert — le filet decoratif entre deux sections.
 * Purement ornemental : il ne porte aucune information.
 */
export function separateur() {
  return '<div class="separateur" aria-hidden="true">'
    + '<span class="separateur__filet"></span>'
    + '<svg class="illu illu--rasoir" viewBox="0 0 64 24" fill="none" focusable="false">'
    + '<g class="illu__trait">'
    + '<path d="M4 15 h34 a4 4 0 0 1 0 8 H8 a4 4 0 0 1-4-4 Z"/>'
    + '<path d="M40 19 C46 19 54 13 60 3 C50 6 42 11 40 15 Z"/>'
    + '</g>'
    + '</svg>'
    + '<span class="separateur__filet"></span>'
    + '</div>';
}
