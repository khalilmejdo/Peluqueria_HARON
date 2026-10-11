/**
 * LES IMAGES DE LA MARQUE, DESSINEES A LA DEMANDE.
 *
 * Icones de l'application (ecran d'accueil du telephone) et apercu partage
 * (WhatsApp, reseaux). Elles etaient dessinees une fois pour toutes aux
 * couleurs de HARON et versionnees dans public/img : une application vendue
 * a plusieurs salons ne peut pas porter l'or et le noir d'un seul. Elles se
 * dessinent maintenant dans la palette de la marque, pixel par pixel (aucune
 * bibliotheque d'image : des distances signees et un melange de couleurs), et
 * restent en memoire tant que le theme ne change pas.
 *
 * Volontairement SANS TEXTE : rasteriser des lettres a la main donnerait un
 * resultat approximatif, et une icone nette vaut mieux qu'un monogramme baveux.
 * Le monogramme vit dans le favicon SVG, ou le navigateur dessine les lettres.
 */
import { pngCouleur } from './png.js';
import { hexVersRgb } from './theme.js';

/* ------------------------------------------------------------------ */
/*  Outils de dessin                                                   */
/* ------------------------------------------------------------------ */

function dRectArrondi(x, y, cx, cy, demiL, demiH, rayon) {
  const qx = Math.abs(x - cx) - (demiL - rayon);
  const qy = Math.abs(y - cy) - (demiH - rayon);
  const dehors = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
  return dehors + Math.min(Math.max(qx, qy), 0) - rayon;
}

function dSegment(x, y, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const longueur2 = dx * dx + dy * dy || 1;
  const t = Math.min(1, Math.max(0, ((x - x1) * dx + (y - y1) * dy) / longueur2));
  return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy));
}

const dCercle = (x, y, cx, cy, rayon) => Math.hypot(x - cx, y - cy) - rayon;
const couverture = (distance, adoucissement = 1) => Math.min(1, Math.max(0, 0.5 - distance / adoucissement));

function melanger(fond, dessus, alpha) {
  const a = Math.min(1, Math.max(0, alpha));
  return [0, 1, 2].map((i) => Math.round(fond[i] * (1 - a) + dessus[i] * a));
}

function peindre(largeur, hauteur, peintre) {
  const rgb = new Uint8Array(largeur * hauteur * 3);
  for (let y = 0; y < hauteur; y += 1) {
    for (let x = 0; x < largeur; x += 1) {
      const [r, g, b] = peintre(x + 0.5, y + 0.5);
      const i = (y * largeur + x) * 3;
      rgb[i] = r;
      rgb[i + 1] = g;
      rgb[i + 2] = b;
    }
  }
  return { largeur, hauteur, rgb };
}

/* ------------------------------------------------------------------ */
/*  Les motifs                                                         */
/* ------------------------------------------------------------------ */

/**
 * Le motif d'une activite, dans le repere 48 x 48 du dessin d'origine.
 * `trait(distance, epaisseur, opacite)` peint dans la couleur d'accent.
 */
const MOTIFS = {
  // Les ciseaux, avec les raies du mat de barbier derriere.
  BARBERIA: (x, y, trait) => {
    trait(dSegment(x, y, 10, 34, 26, 10), 2.5, 0.3);
    trait(dSegment(x, y, 17, 38, 33, 14), 2.5, 0.16);
    MOTIFS.CISEAUX(x, y, trait);
  },
  CISEAUX: (x, y, trait) => {
    trait(Math.abs(dCercle(x, y, 17, 32, 4.2)), 2.1);
    trait(Math.abs(dCercle(x, y, 29, 32, 4.2)), 2.1);
    trait(dSegment(x, y, 15, 13, 31, 33), 2.1);
    trait(dSegment(x, y, 31, 13, 15, 33), 2.1);
  },
  // Une rosace de six petales : la beaute, sans figuratif.
  ESTETICA: (x, y, trait) => {
    for (let i = 0; i < 6; i += 1) {
      const a = (Math.PI / 3) * i;
      trait(Math.abs(dCercle(x, y, 24 + Math.cos(a) * 6.5, 24 + Math.sin(a) * 6.5, 6.5)), 1.6);
    }
    trait(Math.abs(dCercle(x, y, 24, 24, 2.2)), 1.6);
  },
};

const motifDe = (activite) => (activite === 'BARBERIA' ? MOTIFS.BARBERIA
  : activite === 'ESTETICA' ? MOTIFS.ESTETICA : MOTIFS.CISEAUX);

/**
 * L'icone : un carre plein (les lanceurs le rognent eux-memes), un filet
 * d'accent, et le motif de l'activite.
 *
 * @param {number} taille
 * @param {{ fond:string, surface:string, accent:string, activite?:string, marge?:number }} o
 *   marge : Android rogne l'icone « maskable » en cercle ; il lui faut 20 %.
 */
export function icone(taille, { fond, surface, accent, activite = 'BARBERIA', marge = 0.06 }) {
  const F = hexVersRgb(fond) || [11, 11, 13];
  const S = hexVersRgb(surface) || F;
  const A = hexVersRgb(accent) || [201, 164, 92];
  const motif = motifDe(activite);
  const u = taille / 48;
  const decalage = taille * marge;
  const echelle = (taille - decalage * 2) / taille;

  return peindre(taille, taille, (px, py) => {
    const x = (px - decalage) / (u * echelle);
    const y = (py - decalage) / (u * echelle);
    // Un peu de profondeur : la surface affleure en haut.
    let couleur = melanger(F, S, Math.max(0, 0.7 - y / 48));
    const trait = (distance, epaisseur, opacite = 1) => {
      const a = couverture(distance - epaisseur / 2, 1 / (u * echelle)) * opacite;
      if (a > 0) couleur = melanger(couleur, A, a);
    };
    trait(Math.abs(dRectArrondi(x, y, 24, 24, 21, 21, 3)), 1.2);
    trait(Math.abs(dRectArrondi(x, y, 24, 24, 19, 19, 2)), 0.5, 0.55);
    motif(x, y, trait);
    return couleur;
  });
}

/**
 * L'apercu partage (1200 x 630) : un aplat profond, un double filet et
 * l'embleme au centre. Sobre, comme une carte de visite.
 */
export function apercu({ fond, surface, accent, activite }, largeur = 1200, hauteur = 630) {
  const F = hexVersRgb(fond) || [11, 11, 13];
  const S = hexVersRgb(surface) || F;
  const A = hexVersRgb(accent) || [201, 164, 92];
  const cote = Math.round(hauteur * 0.36);
  const embleme = icone(cote, { fond, surface: fond, accent, activite, marge: 0 });
  const ex = Math.round(largeur / 2 - cote / 2);
  const ey = Math.round(hauteur / 2 - cote / 2);

  return peindre(largeur, hauteur, (x, y) => {
    let couleur = melanger(F, S, 0.5 * (1 - Math.hypot(x - largeur / 2, y - hauteur / 2) / (largeur * 0.6)));
    const filet = (demi, opacite) => {
      const d = Math.abs(dRectArrondi(x, y, largeur / 2, hauteur / 2, largeur / 2 - demi, hauteur / 2 - demi, 0));
      const a = couverture(d - 0.6, 1.2) * opacite;
      if (a > 0) couleur = melanger(couleur, A, a);
    };
    filet(30, 0.75);
    filet(38, 0.35);
    const ix = Math.floor(x) - ex;
    const iy = Math.floor(y) - ey;
    if (ix >= 0 && iy >= 0 && ix < cote && iy < cote) {
      const i = (iy * cote + ix) * 3;
      const p = [embleme.rgb[i], embleme.rgb[i + 1], embleme.rgb[i + 2]];
      const ecart = Math.abs(p[0] - F[0]) + Math.abs(p[1] - F[1]) + Math.abs(p[2] - F[2]);
      if (ecart > 8) couleur = melanger(couleur, p, Math.min(1, ecart / 70));
    }
    return couleur;
  });
}

/* ------------------------------------------------------------------ */
/*  Cache                                                              */
/* ------------------------------------------------------------------ */

const cache = new Map();

/**
 * Le PNG demande, pour le theme courant. Une seule entree par theme et par
 * forme : quand le theme change, les anciennes sont oubliees.
 * @param {{ empreinte:string, variables:object, activite:string }} theme
 * @param {'180'|'192'|'512'|'maskable'|'apercu'} forme
 */
export function pngDeMarque(theme, forme) {
  const cle = theme.empreinte + ':' + theme.activite + ':' + forme;
  if (cache.has(cle)) return cache.get(cle);
  if (cache.size > 40) cache.clear();
  const c = {
    fond: theme.variables['--fond'],
    surface: theme.variables['--surface-2'],
    accent: theme.variables['--accent'],
    activite: theme.activite,
  };
  let image;
  if (forme === 'apercu') image = apercu(c);
  else if (forme === 'maskable') image = icone(512, { ...c, marge: 0.2 });
  else image = icone(Number(forme), c);
  const png = pngCouleur(image);
  cache.set(cle, png);
  return png;
}

/**
 * Le favicon : un SVG, donc des lettres dessinees par le navigateur. Le
 * monogramme de la marque dans un cadre fin, aux couleurs du theme.
 */
export function faviconSvg(theme, monogramme) {
  const v = theme.variables;
  const lettres = String(monogramme || '').slice(0, 3)
    .replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const taille = lettres.length >= 3 ? 15 : lettres.length === 2 ? 19 : 24;
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">'
    + '<rect width="48" height="48" rx="10" fill="' + v['--fond'] + '"/>'
    + '<rect x="4.5" y="4.5" width="39" height="39" rx="7" fill="none" stroke="' + v['--accent'] + '" stroke-width="1.4"/>'
    + '<text x="24" y="24" text-anchor="middle" dominant-baseline="central" font-family="Georgia, \'Times New Roman\', serif" '
    + 'font-size="' + taille + '" letter-spacing="0.5" fill="' + v['--accent'] + '">' + lettres + '</text>'
    + '</svg>';
}
