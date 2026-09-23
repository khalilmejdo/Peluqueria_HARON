#!/usr/bin/env node
/**
 * Fabrique les images de marque : npm run images
 *
 *   public/img/app-180.png           icone iOS
 *   public/img/app-192.png           icone Android
 *   public/img/app-512.png           icone Android, grande
 *   public/img/app-maskable-512.png  icone Android « maskable » (marge de sûreté)
 *   public/img/og.png                aperçu partagé sur WhatsApp (1200 x 630)
 *
 * Les images sont VERSIONNEES dans le depot : ce script ne sert qu'a les
 * regenerer si l'identite change. Elles sont dessinees par fonctions de
 * distance signee, ce qui donne des bords lisses sans aucune dependance
 * graphique - et, accessoirement, exactement le meme resultat sur toutes les
 * machines.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pngCouleur } from '../server/core/png.js';

const RACINE = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const DOSSIER = path.join(RACINE, 'public', 'img');

const ENCRE = [0x0e, 0x10, 0x13];
const ENCRE_2 = [0x18, 0x1c, 0x23];
const LAITON = [0xc8, 0xa2, 0x4a];
const CREME = [0xf7, 0xf2, 0xe8];

/* ------------------------------------------------------------------ */
/*  Outils de dessin                                                   */
/* ------------------------------------------------------------------ */

/** Distance signee a un rectangle arrondi centre en (cx, cy). */
function dRectArrondi(x, y, cx, cy, demiL, demiH, rayon) {
  const qx = Math.abs(x - cx) - (demiL - rayon);
  const qy = Math.abs(y - cy) - (demiH - rayon);
  const dehors = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
  return dehors + Math.min(Math.max(qx, qy), 0) - rayon;
}

/** Distance signee a un segment d'epaisseur nulle. */
function dSegment(x, y, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const longueur2 = dx * dx + dy * dy || 1;
  const t = Math.min(1, Math.max(0, ((x - x1) * dx + (y - y1) * dy) / longueur2));
  return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy));
}

const dCercle = (x, y, cx, cy, rayon) => Math.hypot(x - cx, y - cy) - rayon;

/** Couverture d'un pixel : 1 dedans, 0 dehors, dégradé sur un pixel de bord. */
const couverture = (distance, adoucissement = 1) => Math.min(1, Math.max(0, 0.5 - distance / adoucissement));

function melanger(fond, dessus, alpha) {
  const a = Math.min(1, Math.max(0, alpha));
  return [
    Math.round(fond[0] * (1 - a) + dessus[0] * a),
    Math.round(fond[1] * (1 - a) + dessus[1] * a),
    Math.round(fond[2] * (1 - a) + dessus[2] * a),
  ];
}

/**
 * Peint une image. `peintre(x, y)` rend la couleur d'un point, en coordonnees
 * de pixel (le centre du pixel, donc x + 0.5).
 */
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
/*  L'embleme                                                          */
/* ------------------------------------------------------------------ */

/**
 * L'embleme du salon, dessine dans un carre de cote `taille`.
 *
 * C'est exactement le motif de public/img/favicon.svg : un cadre arrondi, deux
 * raies obliques de mat de barbier, deux anneaux de ciseaux et leurs lames
 * croisees.
 *
 * @param {number} taille
 * @param {{ marge?: number, fond?: number[] }} [opts]
 *   marge : part de l'image laissee vide autour (0.1 = 10 %). Les icones
 *   « maskable » d'Android sont rognees en cercle : il leur faut 20 % de marge,
 *   sinon le cadre disparait.
 */
function emblemeIcone(taille, { marge = 0.06, fond = ENCRE } = {}) {
  const u = taille / 48; // une unite du dessin d'origine
  const decalage = taille * marge;
  const echelle = (taille - decalage * 2) / taille;

  return peindre(taille, taille, (px, py) => {
    // Repere du dessin d'origine (48 x 48), marge comprise.
    const x = (px - decalage) / (u * echelle);
    const y = (py - decalage) / (u * echelle);

    // Fond : un carre arrondi, plus clair vers le haut (un peu de profondeur).
    const dFond = dRectArrondi(x, y, 24, 24, 24, 24, 11);
    let couleur = melanger(fond, ENCRE_2, Math.max(0, 0.35 - y / 100));
    if (dFond > 0) {
      // Hors du carre arrondi : transparent impossible en RGB, on met l'encre.
      couleur = fond;
      if (dFond > 1) return couleur;
    }

    const trait = (distance, epaisseur, teinte, opacite = 1) => {
      const a = couverture(distance - epaisseur / 2, 1 / (u * echelle)) * opacite;
      if (a > 0) couleur = melanger(couleur, teinte, a);
    };

    // Cadre.
    trait(Math.abs(dRectArrondi(x, y, 24, 24, 21, 21, 12)), 2, LAITON);
    // Raies du mat de barbier.
    trait(dSegment(x, y, 10, 34, 26, 10), 2.5, LAITON, 0.32);
    trait(dSegment(x, y, 17, 38, 33, 14), 2.5, LAITON, 0.18);
    // Anneaux et lames des ciseaux.
    trait(Math.abs(dCercle(x, y, 17, 32, 4.2)), 2.2, LAITON);
    trait(Math.abs(dCercle(x, y, 29, 32, 4.2)), 2.2, LAITON);
    trait(dSegment(x, y, 15, 14, 31, 33), 2.2, LAITON);
    trait(dSegment(x, y, 31, 14, 15, 33), 2.2, LAITON);

    return couleur;
  });
}

/* ------------------------------------------------------------------ */
/*  L'apercu partage                                                   */
/* ------------------------------------------------------------------ */

/**
 * L'image que WhatsApp affiche quand le lien de suivi est partage.
 *
 * Volontairement sans texte : un texte rasterise a la main serait laid, et une
 * image de marque nette vaut mieux qu'une legende approximative. La devanture
 * du barbier : encre profonde, raies de laiton, filet creme, et l'embleme.
 */
function apercuPartage(largeur = 1200, hauteur = 630) {
  const cx = largeur * 0.5;
  const cy = hauteur * 0.5;
  const cote = Math.round(hauteur * 0.42);

  const icone = emblemeIcone(cote, { marge: 0, fond: ENCRE });
  const iconeX = Math.round(cx - cote / 2);
  const iconeY = Math.round(cy - cote / 2);

  return peindre(largeur, hauteur, (x, y) => {
    // Fond : un dégradé très doux du haut vers le bas.
    let couleur = melanger(ENCRE, ENCRE_2, 0.15 + 0.25 * (y / hauteur));

    // Raies du mat de barbier, en diagonale, très discretes.
    const diagonale = (x * Math.cos(-0.96) + y * Math.sin(-0.96));
    const periode = 44;
    const dansLaRaie = ((diagonale % periode) + periode) % periode < 12;
    // Elles s'estompent vers le bas, comme le mask-image de la page d'accueil.
    const force = 0.1 * Math.max(0, 1 - (y / hauteur) * 1.35);
    if (dansLaRaie && force > 0) couleur = melanger(couleur, LAITON, force);

    // Filet crème, à 26 pixels du bord.
    const dCadre = Math.abs(dRectArrondi(x, y, cx, cy, largeur / 2 - 26, hauteur / 2 - 26, 18));
    const aCadre = couverture(dCadre - 1, 1.4);
    if (aCadre > 0) couleur = melanger(couleur, CREME, aCadre * 0.22);

    // L'embleme, au centre.
    const ix = Math.floor(x) - iconeX;
    const iy = Math.floor(y) - iconeY;
    if (ix >= 0 && iy >= 0 && ix < cote && iy < cote) {
      const i = (iy * cote + ix) * 3;
      const pixel = [icone.rgb[i], icone.rgb[i + 1], icone.rgb[i + 2]];
      // Le fond de l'icone est la meme encre : on ne garde que ce qui s'en
      // detache, pour que le degrade et les raies restent visibles derriere.
      const ecart = Math.abs(pixel[0] - ENCRE[0]) + Math.abs(pixel[1] - ENCRE[1]) + Math.abs(pixel[2] - ENCRE[2]);
      if (ecart > 6) couleur = melanger(couleur, pixel, Math.min(1, ecart / 60));
    }

    return couleur;
  });
}

/* ------------------------------------------------------------------ */

const SORTIES = [
  ['app-180.png', () => emblemeIcone(180)],
  ['app-192.png', () => emblemeIcone(192)],
  ['app-512.png', () => emblemeIcone(512)],
  // Android rogne l'icone « maskable » en cercle : 20 % de marge, sinon le
  // cadre du logotype est coupe.
  ['app-maskable-512.png', () => emblemeIcone(512, { marge: 0.2 })],
  ['og.png', () => apercuPartage()],
];

fs.mkdirSync(DOSSIER, { recursive: true });
for (const [nom, fabriquer] of SORTIES) {
  const image = fabriquer();
  const fichier = path.join(DOSSIER, nom);
  fs.writeFileSync(fichier, pngCouleur(image));
  console.log('  ' + nom + ' — ' + image.largeur + ' x ' + image.hauteur
    + ' — ' + Math.round(fs.statSync(fichier).size / 1024) + ' ko');
}
console.log('\n  Images de marque regenerees dans public/img.\n');
