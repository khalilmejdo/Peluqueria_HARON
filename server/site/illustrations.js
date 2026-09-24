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
const pasTelephone = '<rect x="7" y="2" width="18" height="28" rx="4"/>'
  + '<path d="M13 6 H19"/>'
  + '<path d="M11 14 H21 M11 19 H18"/>';

/** Une file de personnes vue de dessus, pour « sigue tu posición ». */
const pasFile = '<circle cx="9" cy="9" r="4"/>'
  + '<path d="M3 22 a6 6 0 0 1 12 0"/>'
  + '<circle cx="23" cy="11" r="3.2"/>'
  + '<path d="M18 22 a5 5 0 0 1 10 0"/>';

/** Une porte qui s'ouvre, pour « llega a tiempo ». */
const pasPorte = '<path d="M7 29 V6 l14-3 v27 Z"/>'
  + '<path d="M21 29 H27 V3"/>'
  + '<circle cx="11.5" cy="17" r="1.4" class="illu__point"/>';

const ICONES_ETAPES = [pasTelephone, pasFile, pasPorte];

/**
 * L'icone d'une etape. Un seul trait, la meme epaisseur partout : trois
 * pictogrammes d'epaisseurs differentes donneraient l'impression d'un
 * assemblage.
 */
export function iconeEtape(index) {
  const formes = ICONES_ETAPES[index] || pasTelephone;
  return '<svg class="illu illu--etape" viewBox="0 0 32 32" fill="none" aria-hidden="true" focusable="false">'
    + '<g class="illu__trait">' + formes + '</g>'
    + '</svg>';
}

/**
 * L'embleme rond de la fiche de prix — le medaillon du tableau du salon.
 *
 * Le texte suit le cercle : un `textPath` sur un arc, comme un cachet. C'est
 * ce qui le distingue d'un logo pose dans un rond, et c'est exactement ce que
 * font les enseignes de barbier depuis un siecle.
 *
 * L'identifiant de l'arc porte un suffixe fixe : un seul embleme par page, et
 * deux identifiants identiques dans un document feraient pointer les deux
 * textes sur le meme arc.
 */
export function emblemeRond() {
  return '<svg class="illu illu--medaillon" viewBox="0 0 120 120" fill="none" aria-hidden="true" focusable="false">'
    + '<defs>'
    // L'arc du haut va de GAUCHE a DROITE en passant par le dessus : le texte
    // s'y pose a l'endroit.
    + '<path id="haron-arc-haut" d="M16 60 A44 44 0 0 1 104 60" />'
    // Celui du bas doit aussi aller de GAUCHE a DROITE, mais en passant par le
    // dessous — d'ou le drapeau de balayage a 0. Avec 1, l'arc revient par le
    // haut et le texte s'affiche LA TETE EN BAS ; c'est le piege classique du
    // texte circulaire, et il ne se voit qu'a l'ecran.
    + '<path id="haron-arc-bas" d="M20 60 A40 40 0 0 0 100 60" />'
    + '</defs>'
    + '<circle cx="60" cy="60" r="56" class="medaillon__bord"/>'
    + '<circle cx="60" cy="60" r="50" class="medaillon__bord medaillon__bord--fin"/>'
    + '<circle cx="60" cy="60" r="34" class="medaillon__bord medaillon__bord--fin"/>'
    + '<text class="medaillon__texte"><textPath href="#haron-arc-haut" startOffset="50%" text-anchor="middle">'
    + 'PELUQUERÍA HARON</textPath></text>'
    + '<text class="medaillon__texte medaillon__texte--petit">'
    + '<textPath href="#haron-arc-bas" startOffset="50%" text-anchor="middle">SERVICIO Y ESTILO</textPath></text>'
    + '<g class="illu__trait medaillon__dessin">'
    + '<circle cx="52" cy="72" r="4"/><circle cx="68" cy="72" r="4"/>'
    + '<path d="M54.8 69.2 72 48M65.2 69.2 48 48"/>'
    + '<path d="M44 58h32"/><path d="M48 58v-7M56 58v-7M64 58v-7M72 58v-7"/>'
    + '</g>'
    + '</svg>';
}

/** Les petits ciseaux du filet orne, au milieu de la fiche. */
export function ciseauxPetits() {
  return '<svg class="illu illu--ciseaux-petits" viewBox="0 0 32 24" fill="none" aria-hidden="true" focusable="false">'
    + '<g class="illu__trait">'
    + '<circle cx="9" cy="18" r="3.2"/><circle cx="23" cy="18" r="3.2"/>'
    + '<path d="M11.3 15.7 25 4M20.7 15.7 7 4"/>'
    + '</g></svg>';
}

/* ------------------------------------------------------------------ */
/*  Le contact                                                         */
/* ------------------------------------------------------------------ */

const enveloppeIcone = (formes) => '<svg class="illu illu--contacto" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">'
  + '<g class="illu__trait">' + formes + '</g></svg>';

/** Une epingle de carte. */
export function iconeLieu() {
  return enveloppeIcone('<path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z"/><circle cx="12" cy="10" r="2.6"/>');
}

/** Un combine telephonique. */
export function iconeTelephone() {
  return enveloppeIcone('<path d="M6 3h3l2 5-2.5 1.5a12 12 0 0 0 6 6L16 13l5 2v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4 5.2 2 2 0 0 1 6 3Z"/>');
}

/** Une bulle de conversation. */
export function iconeConversation() {
  return enveloppeIcone('<path d="M4 5h16a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H9l-5 4V6a1 1 0 0 1 1-1Z"/>'
    + '<path d="M8.5 10.5h.01M12 10.5h.01M15.5 10.5h.01"/>');
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


/* ------------------------------------------------------------------ */
/*  Les scenes du salon — en attendant les vraies photos               */
/* ------------------------------------------------------------------ */

/**
 * Trois scenes dessinees, montrees tant que le gerant n'a depose aucune photo.
 *
 * POURQUOI PAS UNE PHOTO DE BANQUE D'IMAGES. Parce qu'elle mentirait. Un
 * client qui pousse la porte et ne reconnait rien de ce qu'il a vu sur le site
 * se sent trompe, et il a raison : la photo montrait un autre salon. Un dessin,
 * lui, ne pretend a rien — il dit « voila l'idee » et laisse la place.
 *
 * Elles disparaissent d'elles-memes : des qu'une seule vraie photo arrive dans
 * le dossier, la galerie montre les photos et plus les dessins. Il n'y a pas de
 * reglage a penser a changer, et c'est voulu — un reglage a decocher plus tard
 * reste coche pour toujours.
 *
 * L'OCCLUSION EST LE SUJET. En dessin au trait, un meuble derriere un fauteuil
 * se voit A TRAVERS le fauteuil : tout devient une radiographie et la scene ne
 * se lit plus. Les formes du premier plan portent donc `illu__masque`, qui les
 * remplit de la couleur du cadre avant de les cerner. C'est ce qui donne la
 * profondeur, et c'est le seul endroit du dessin ou une forme est pleine.
 */
const SCENES = [
  ['Nuestro salón', '<svg class="illu illu--scene" viewBox="0 0 320 200" fill="none" aria-hidden="true" focusable="false">'
    + '<g class="illu__trait-fin">'
    // Le fond : le sol, les deux miroirs, le plan de travail continu.
    + '<path d="M18 176 H302"/>'
    + '<rect x="46" y="24" width="72" height="86" rx="8"/>'
    + '<rect x="202" y="24" width="72" height="86" rx="8"/>'
    + '<rect x="26" y="120" width="268" height="10" rx="3"/>'
    // Les flacons, poses entre les deux postes : la seule zone libre.
    + '<path d="M142 120 v-12 a5 5 0 0 1 10 0 v12"/>'
    + '<path d="M162 120 v-16 h8 v16"/>'
    + '<path d="M178 120 v-10 a4 4 0 0 1 8 0 v10"/>'
    + '</g>'
    + '<g class="illu__laiton-trait">'
    // La suspension, au centre : le seul accent de laiton de la scene.
    + '<path d="M160 6 v30"/><path d="M140 36 h40 l-11 20 h-18 Z"/><path d="M152 64 h16"/>'
    + '</g>'
    // Les deux fauteuils, au premier plan : pleins, donc ils cachent le meuble.
    + '<g class="illu__masque">'
    + '<path d="M64 152 v-34 a10 10 0 0 1 10-10 h20 a10 10 0 0 1 10 10 v34 Z"/>'
    + '<rect x="56" y="148" width="56" height="14" rx="7"/>'
    + '<path d="M214 152 v-34 a10 10 0 0 1 10-10 h20 a10 10 0 0 1 10 10 v34 Z"/>'
    + '<rect x="206" y="148" width="56" height="14" rx="7"/>'
    + '</g>'
    + '<g class="illu__trait">'
    + '<path d="M84 162 v14"/><path d="M68 176 H100"/>'
    + '<path d="M234 162 v14"/><path d="M218 176 H250"/>'
    + '</g></svg>'],

  ['El sillón', '<svg class="illu illu--scene" viewBox="0 0 320 200" fill="none" aria-hidden="true" focusable="false">'
    + '<g class="illu__trait-fin">'
    + '<path d="M18 180 H302"/>'
    // Le grand miroir et sa couronne d'ampoules. Les ampoules sont DANS
    // l'anneau, pas posees dessus : sur le cercle lui-meme, elles donnaient
    // une roue dentee.
    + '<circle cx="210" cy="88" r="70"/>'
    + '<circle cx="210" cy="88" r="52"/>'
    + [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => {
      const a = (i * Math.PI) / 6;
      return '<circle cx="' + (210 + 61 * Math.cos(a)).toFixed(1)
        + '" cy="' + (88 + 61 * Math.sin(a)).toFixed(1) + '" r="3.4"/>';
    }).join('')
    + '</g>'
    // Le fauteuil, de profil, tourne vers le miroir.
    + '<g class="illu__masque">'
    + '<path d="M60 130 V62 a12 12 0 0 1 12-12 h34 a12 12 0 0 1 12 12 v68 Z"/>'
    + '<path d="M74 50 V40 a9 9 0 0 1 9-9 h12 a9 9 0 0 1 9 9 v10 Z"/>'
    + '<path d="M50 128 h74 a9 9 0 0 1 0 26 H50 a9 9 0 0 1 0-26 Z"/>'
    + '</g>'
    + '<g class="illu__trait">'
    + '<path d="M92 154 v26"/><path d="M60 180 H124"/><path d="M70 168 H114"/>'
    + '</g>'
    + '<g class="illu__laiton-trait">'
    // Le repose-pied et la manette, en laiton : sur un fauteuil de barbier ce
    // sont les deux pieces qui brillent, et elles suffisent a le dater.
    + '<path d="M50 136 H32 a7 7 0 0 0-7 7 v11"/>'
    + '<path d="M25 154 h16"/>'
    + '<path d="M124 158 h22"/><circle cx="150" cy="158" r="4"/>'
    + '</g></svg>'],

  ['La entrada', '<svg class="illu illu--scene" viewBox="0 0 320 200" fill="none" aria-hidden="true" focusable="false">'
    + '<g class="illu__trait-fin">'
    + '<path d="M14 186 H306"/>'
    // La facade, la vitrine, la porte.
    + '<path d="M44 186 V58 h232 v128"/>'
    + '<rect x="60" y="96" width="106" height="74"/>'
    + '<path d="M78 170 v-24 h60 v24"/>'
    + '<rect x="186" y="96" width="56" height="90" rx="4"/>'
    + '<circle cx="195" cy="144" r="3" class="illu__point"/>'
    + '</g>'
    + '<g class="illu__laiton-trait">'
    // L'auvent raye, et l'enseigne au-dessus.
    + '<path d="M36 58 h248 l-12 24 H48 Z"/>'
    + [0, 1, 2, 3, 4, 5, 6, 7].map((i) => '<path d="M' + (58 + i * 29) + ' 58 l-6 24"/>').join('')
    + '<rect x="98" y="22" width="124" height="24" rx="6"/>'
    + '</g>'
    // Le mat de barbier, contre le mur — a l'INTERIEUR de la facade, sinon il
    // flotte a cote du batiment.
    + '<g class="illu__masque">'
    + '<rect x="252" y="106" width="14" height="52" rx="7"/>'
    + '</g>'
    + '<g class="illu__trait">'
    + '<path d="M250 102 h18"/><path d="M250 162 h18"/>'
    + '</g></svg>'],
];

/**
 * Les scenes, sous la forme que la galerie attend : un titre et un dessin.
 * On rend une COPIE du tableau — l'appelant ne doit pas pouvoir vider la liste
 * pour tout le monde en la triant ou en la coupant.
 */
export function scenesDuSalon() {
  return SCENES.map(([legende, dessin]) => ({ legende, dessin }));
}

/* ------------------------------------------------------------------ */
/*  Le plan                                                            */
/* ------------------------------------------------------------------ */

/**
 * Le plan de la section « Cómo llegar ».
 *
 * IL NE PRETEND PAS ETRE UNE CARTE. Aucune rue n'y porte de nom, aucune forme
 * ne reprend le quartier : c'est un motif, comme le fauteuil ou les ciseaux.
 * Une carte dessinee a la main qui ressemblerait a la vraie serait le pire des
 * deux mondes — assez juste pour qu'on la suive, assez fausse pour qu'on se
 * perde. L'adresse exacte et le bouton qui ouvre l'application de cartes du
 * telephone sont juste a cote ; c'est eux qui font le travail.
 *
 * Une rue est mise en valeur et porte l'epingle : l'oeil sait ou regarder.
 */
export function planStylise() {
  return '<svg class="illu illu--plan" viewBox="0 0 320 220" fill="none" aria-hidden="true" focusable="false">'
    // Les ilots. Des rectangles arrondis tres pales : ils donnent la matiere
    // du quartier sans rien affirmer.
    + '<g class="plan__ilot">'
    + '<rect x="18" y="18" width="92" height="64" rx="6"/>'
    + '<rect x="128" y="18" width="70" height="64" rx="6"/>'
    + '<rect x="216" y="18" width="86" height="42" rx="6"/>'
    + '<rect x="18" y="106" width="92" height="46" rx="6"/>'
    + '<rect x="216" y="86" width="86" height="66" rx="6"/>'
    + '<rect x="18" y="176" width="130" height="26" rx="6"/>'
    + '<rect x="168" y="176" width="134" height="26" rx="6"/>'
    + '</g>'
    // Les rues.
    + '<g class="plan__rue">'
    + '<path d="M0 94 H320"/>'
    + '<path d="M0 164 H320"/>'
    + '<path d="M119 0 V220"/>'
    + '<path d="M207 0 V220"/>'
    + '<path d="M216 72 H302"/>'
    + '</g>'
    // La notre, en laiton : celle que l'epingle designe.
    + '<path class="plan__rue plan__rue--notre" d="M119 94 H207"/>'
    // L'epingle, et l'onde qui en part. L'onde est purement decorative : elle
    // attire l'oeil sur le point, elle ne mesure rien.
    + '<circle class="plan__onde" cx="163" cy="94" r="12"/>'
    + '<g class="plan__pin">'
    + '<path d="M163 108 s-13-11.6-13-20.4a13 13 0 1 1 26 0c0 8.8-13 20.4-13 20.4Z"/>'
    + '<circle cx="163" cy="87" r="4.6" class="plan__pin-oeil"/>'
    + '</g>'
    + '</svg>';
}
