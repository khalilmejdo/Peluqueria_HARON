/**
 * DES ILLUSTRATIONS POUR UN SALON DE DEMONSTRATION.
 *
 * Pas de photo de banque d'images : elle mentirait (ce ne serait pas le
 * travail du salon) et sa licence ne suit pas forcement. Ce sont des DESSINS,
 * calcules pixel par pixel (des distances signees, comme les icones de la
 * marque), et leur legende le dit : « Illustration — ... ». Le salon les
 * remplace par ses vraies photos dans l'onglet Galerie.
 *
 * Deux motifs : une main (cinq doigts, cinq ongles vernis, un reflet) et des
 * flacons de vernis. Chacun se decline en couleurs.
 */
import { pngCouleur } from '../server/core/png.js';

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const melange = (a, b, t) => a.map((v, i) => v + (b[i] - v) * Math.min(1, Math.max(0, t)));
const couvre = (d, flou = 1.2) => Math.min(1, Math.max(0, 0.5 - d / flou));

/** Distance a un segment epais (une « gelule ») : negative a l'interieur. */
function gelule(x, y, x1, y1, x2, y2, rayon) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const t = Math.min(1, Math.max(0, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy)) - rayon;
}
function rectArrondi(x, y, cx, cy, demiL, demiH, r) {
  const qx = Math.abs(x - cx) - (demiL - r);
  const qy = Math.abs(y - cy) - (demiH - r);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}

function peindre(largeur, hauteur, peintre) {
  const rgb = new Uint8Array(largeur * hauteur * 3);
  for (let y = 0; y < hauteur; y += 1) {
    for (let x = 0; x < largeur; x += 1) {
      const c = peintre(x + 0.5, y + 0.5);
      const i = (y * largeur + x) * 3;
      rgb[i] = c[0];
      rgb[i + 1] = c[1];
      rgb[i + 2] = c[2];
    }
  }
  return pngCouleur({ largeur, hauteur, rgb });
}

/** Un fond doux : deux couleurs en diagonale, une lumiere en haut a gauche. */
function fond(x, y, L, H, a, b) {
  const base = melange(a, b, (x / L) * 0.4 + (y / H) * 0.6);
  return melange(base, [255, 255, 255], 0.35 * Math.max(0, 1 - Math.hypot(x / L - 0.2, y / H - 0.15) * 1.6));
}

/**
 * UNE MAIN AUX ONGLES VERNIS. `vernis` : la couleur ; `francaise` : un bord
 * blanc ; `paillettes` : des points dores ; `peau` : le teint.
 */
export function main({ vernis = '#b9836a', fondA = '#f6ece4', fondB = '#e9d6c8', peau = '#e8bfa3', francaise = false, paillettes = false, largeur = 900, hauteur = 1100 } = {}) {
  const V = hex(vernis);
  const P = hex(peau);
  const F1 = hex(fondA);
  const F2 = hex(fondB);
  const u = largeur / 900;
  // Cinq doigts en eventail, du pouce a l'auriculaire : base, bout, rayon.
  const doigts = [
    [250, 1100, 120, 640, 62],
    [360, 1100, 300, 300, 58],
    [480, 1100, 470, 230, 60],
    [600, 1100, 640, 290, 56],
    [710, 1100, 800, 420, 48],
  ].map(([bx, by, tx, ty, r]) => [bx * u, by * u, tx * u, ty * u, r * u]);
  const graines = Array.from({ length: 260 }, (_, i) => [((i * 7919) % 997) / 997, ((i * 6151) % 991) / 991]);

  return peindre(largeur, hauteur, (x, y) => {
    let c = fond(x, y, largeur, hauteur, F1, F2);
    // L'ombre portee de la main.
    for (const [bx, by, tx, ty, r] of doigts) {
      const d = gelule(x - 18 * u, y - 22 * u, bx, by, tx, ty, r);
      c = melange(c, melange(F2, [0, 0, 0], 0.25), couvre(d, 40 * u) * 0.35);
    }
    // La paume.
    const paume = rectArrondi(x, y, 470 * u, 1060 * u, 300 * u, 220 * u, 160 * u);
    c = melange(c, melange(P, [255, 255, 255], 0.05), couvre(paume, 1.5));
    for (const [bx, by, tx, ty, r] of doigts) {
      const d = gelule(x, y, bx, by, tx, ty, r);
      if (d > 2) continue;
      // Le doigt : la peau, plus sombre sur les bords.
      const bord = Math.min(1, Math.max(0, (d + r) / r));
      let doigt = melange(P, melange(P, [120, 70, 50], 0.5), bord * bord * 0.6);
      // L'ongle : une gelule plus fine, pres du bout.
      const lx = tx - bx;
      const ly = ty - by;
      const long = Math.hypot(lx, ly);
      const ux = lx / long;
      const uy = ly / long;
      const n1x = tx - ux * r * 1.9;
      const n1y = ty - uy * r * 1.9;
      const dn = gelule(x, y, n1x, n1y, tx - ux * r * 0.25, ty - uy * r * 0.25, r * 0.72);
      if (dn < 2) {
        // Le long de l'ongle, de la racine au bout (0 a 1).
        const t = ((x - n1x) * ux + (y - n1y) * uy) / (r * 1.65);
        let ongle = melange(V, [255, 255, 255], 0.18 * (1 - t));
        ongle = melange(ongle, melange(V, [0, 0, 0], 0.35), Math.min(1, Math.max(0, (dn + r * 0.72) / (r * 0.72))) ** 3);
        if (francaise) ongle = t > 0.78 ? [250, 248, 245] : melange([241, 196, 190], [255, 255, 255], 0.2);
        if (paillettes) {
          for (const [gx, gy] of graines) {
            const px = n1x + (gx - 0.5) * r * 1.4;
            const py = n1y + gy * (ty - n1y);
            if (Math.hypot(x - px, y - py) < 4 * u) ongle = melange(ongle, [236, 201, 120], 0.9);
          }
        }
        // Le reflet : une bande claire de biais.
        const reflet = Math.abs((x - n1x) * uy - (y - n1y) * ux + r * 0.28);
        ongle = melange(ongle, [255, 255, 255], couvre(reflet - r * 0.08, r * 0.12) * 0.55);
        doigt = melange(doigt, ongle, couvre(dn, 1.5));
      }
      c = melange(c, doigt, couvre(d, 1.5));
    }
    return c;
  });
}

/** DES FLACONS DE VERNIS, trois couleurs, alignes sur un plan. */
export function flacons({ couleurs = ['#b9836a', '#c4566a', '#8a5cd6'], fondA = '#f6ece4', fondB = '#ead9cb', largeur = 900, hauteur = 1100 } = {}) {
  const F1 = hex(fondA);
  const F2 = hex(fondB);
  const u = largeur / 900;
  const pos = [[250, 700, 1], [470, 640, 1.18], [680, 720, 0.95]].map(([cx, cy, s], i) => ({ cx: cx * u, cy: cy * u, s: s * u, V: hex(couleurs[i % couleurs.length]) }));
  return peindre(largeur, hauteur, (x, y) => {
    let c = fond(x, y, largeur, hauteur, F1, F2);
    // Le plan : plus sombre en bas.
    if (y > 820 * u) c = melange(c, F2, 0.6);
    for (const { cx, cy, s } of pos) {
      const ombre = Math.hypot((x - cx - 20 * s) / (130 * s), (y - cy - 150 * s) / (24 * s)) - 1;
      c = melange(c, melange(F2, [0, 0, 0], 0.35), couvre(ombre, 0.4) * 0.5);
    }
    for (const { cx, cy, s, V } of pos) {
      // Le corps : du verre teinte, plus clair au centre.
      const corps = rectArrondi(x, y, cx, cy + 40 * s, 100 * s, 115 * s, 34 * s);
      if (corps < 2) {
        const centre = Math.abs(x - cx) / (100 * s);
        let verre = melange(V, melange(V, [0, 0, 0], 0.45), centre * centre);
        verre = melange(verre, [255, 255, 255], couvre(Math.abs(x - (cx - 52 * s)) - 9 * s, 6 * s) * 0.55);
        c = melange(c, verre, couvre(corps, 1.5));
      }
      // Le bouchon : long, noir laque, un reflet.
      const bouchon = rectArrondi(x, y, cx, cy - 165 * s, 38 * s, 95 * s, 10 * s);
      if (bouchon < 2) {
        let laque = melange([34, 28, 30], [70, 62, 64], Math.max(0, 1 - Math.abs(x - (cx - 14 * s)) / (14 * s)));
        laque = melange(laque, [255, 255, 255], couvre(Math.abs(x - (cx - 18 * s)) - 3 * s, 3 * s) * 0.4);
        c = melange(c, laque, couvre(bouchon, 1.5));
      }
      // Le col dore.
      const col = rectArrondi(x, y, cx, cy - 66 * s, 44 * s, 10 * s, 4 * s);
      c = melange(c, melange([206, 170, 110], [255, 236, 200], Math.max(0, 1 - Math.abs(x - cx) / (44 * s))), couvre(col, 1.5));
    }
    return c;
  });
}

/** La serie d'un salon de demonstration : six illustrations et leur legende. */
export function serieOngles(legende = (texte) => 'Illustration — ' + texte) {
  return [
    { legende: legende('vernis nude rosé'), image: () => main({ vernis: '#c98b78' }) },
    { legende: legende('french manucure'), image: () => main({ francaise: true, fondA: '#f3eef0', fondB: '#e2d4dc' }) },
    { legende: legende('flacons de vernis'), image: () => flacons({}) },
    { legende: legende('rouge cerise'), image: () => main({ vernis: '#a8243a', fondA: '#f6e9e6', fondB: '#e8cfca', peau: '#d9a689' }) },
    { legende: legende('nail art pailleté'), image: () => main({ vernis: '#3c2f44', paillettes: true, fondA: '#efe9f3', fondB: '#d9cde3' }) },
    { legende: legende('lilas pastel'), image: () => main({ vernis: '#b49ad8', fondA: '#f2eef8', fondB: '#ddd3ee', peau: '#f0caa9' }) },
  ];
}
