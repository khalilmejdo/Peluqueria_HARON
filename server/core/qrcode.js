/**
 * Encodeur QR Code, ecrit a la main (norme ISO/IEC 18004).
 *
 * Pourquoi ne pas prendre une bibliotheque ? Parce que ce fichier est la seule
 * chose que l'application demande au monde exterieur, qu'il ne bouge jamais
 * (la norme date de 1997) et qu'il tient en un fichier lisible. Une dependance
 * de plus, c'est une chaine d'approvisionnement de plus a surveiller pour
 * dessiner un carre noir et blanc.
 *
 * Portee volontairement limitee a ce dont le salon a besoin :
 *   - mode OCTET (une adresse web en ASCII, ou en UTF-8) ;
 *   - versions 1 a 15, soit jusqu'a 412 octets en correction M ;
 *   - les quatre niveaux de correction d'erreur.
 *
 * Etapes, dans l'ordre de la norme :
 *   1. mise en bits    : indicateur de mode, longueur, donnees, remplissage
 *   2. correction      : Reed-Solomon sur GF(256), par blocs
 *   3. entrelacement   : blocs de donnees puis blocs de correction
 *   4. trame           : motifs de detection, d'alignement, de synchronisation
 *   5. placement       : parcours en zigzag, colonnes par deux
 *   6. masquage        : les 8 masques sont essayes, le moins penalise gagne
 *   7. information     : niveau + masque (BCH 15,5), version (BCH 18,6)
 */

/* ------------------------------------------------------------------ */
/*  Tables de la norme                                                 */
/* ------------------------------------------------------------------ */

/** Niveaux de correction, avec les deux bits qui les designent. */
export const NIVEAUX = { L: 0b01, M: 0b00, Q: 0b11, H: 0b10 };

/**
 * Caracteristiques de correction d'erreur, versions 1 a 15.
 *
 * Chaque entree : [octets de correction par bloc, blocs du groupe 1,
 *                  octets de donnees par bloc du groupe 1,
 *                  blocs du groupe 2, octets de donnees par bloc du groupe 2]
 *
 * La coherence de cette table est verifiee par un test : pour chaque version et
 * chaque niveau, donnees + correction doit tomber exactement sur le nombre
 * total d'octets de la version (TOTAL_OCTETS). Une faute de frappe ne peut donc
 * pas passer inapercue.
 */
export const CORRECTION = {
  1: { L: [7, 1, 19, 0, 0], M: [10, 1, 16, 0, 0], Q: [13, 1, 13, 0, 0], H: [17, 1, 9, 0, 0] },
  2: { L: [10, 1, 34, 0, 0], M: [16, 1, 28, 0, 0], Q: [22, 1, 22, 0, 0], H: [28, 1, 16, 0, 0] },
  3: { L: [15, 1, 55, 0, 0], M: [26, 1, 44, 0, 0], Q: [18, 2, 17, 0, 0], H: [22, 2, 13, 0, 0] },
  4: { L: [20, 1, 80, 0, 0], M: [18, 2, 32, 0, 0], Q: [26, 2, 24, 0, 0], H: [16, 4, 9, 0, 0] },
  5: { L: [26, 1, 108, 0, 0], M: [24, 2, 43, 0, 0], Q: [18, 2, 15, 2, 16], H: [22, 2, 11, 2, 12] },
  6: { L: [18, 2, 68, 0, 0], M: [16, 4, 27, 0, 0], Q: [24, 4, 19, 0, 0], H: [28, 4, 15, 0, 0] },
  7: { L: [20, 2, 78, 0, 0], M: [18, 4, 31, 0, 0], Q: [18, 2, 14, 4, 15], H: [26, 4, 13, 1, 14] },
  8: { L: [24, 2, 97, 0, 0], M: [22, 2, 38, 2, 39], Q: [22, 4, 18, 2, 19], H: [26, 4, 14, 2, 15] },
  9: { L: [30, 2, 116, 0, 0], M: [22, 3, 36, 2, 37], Q: [20, 4, 16, 4, 17], H: [24, 4, 12, 4, 13] },
  10: { L: [18, 2, 68, 2, 69], M: [26, 4, 43, 1, 44], Q: [24, 6, 19, 2, 20], H: [28, 6, 15, 2, 16] },
  11: { L: [20, 4, 81, 0, 0], M: [30, 1, 50, 4, 51], Q: [28, 4, 22, 4, 23], H: [24, 3, 12, 8, 13] },
  12: { L: [24, 2, 92, 2, 93], M: [22, 6, 36, 2, 37], Q: [26, 4, 20, 6, 21], H: [28, 7, 14, 4, 15] },
  13: { L: [26, 4, 107, 0, 0], M: [22, 8, 37, 1, 38], Q: [24, 8, 20, 4, 21], H: [22, 12, 11, 4, 12] },
  14: { L: [30, 3, 115, 1, 116], M: [24, 4, 40, 5, 41], Q: [20, 11, 16, 5, 17], H: [24, 11, 12, 5, 13] },
  15: { L: [22, 5, 87, 1, 88], M: [24, 5, 41, 5, 42], Q: [30, 5, 24, 7, 25], H: [24, 11, 12, 7, 13] },
};

export const VERSION_MAX = 15;

/** Nombre total d'octets (donnees + correction) par version. */
export const TOTAL_OCTETS = {
  1: 26, 2: 44, 3: 70, 4: 100, 5: 134, 6: 172, 7: 196, 8: 242,
  9: 292, 10: 346, 11: 404, 12: 466, 13: 532, 14: 581, 15: 655,
};

/** Centres des motifs d'alignement, par version. */
export const ALIGNEMENTS = {
  1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34],
  7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50],
  11: [6, 30, 54], 12: [6, 32, 58], 13: [6, 34, 62],
  14: [6, 26, 46, 66], 15: [6, 26, 48, 70],
};

/**
 * Bits restants apres le dernier octet de contenu. La norme les veut clairs ;
 * l'encodeur les produit naturellement (voir poserContenu). Expose pour que le
 * decodeur des tests sache ou s'arreter.
 */
export function bitsRestants(version) {
  if (version === 1) return 0;
  if (version <= 6) return 7;
  if (version <= 13) return 0;
  return 3; // versions 14 a 20
}

export const taillePourVersion = (version) => version * 4 + 17;

/* ------------------------------------------------------------------ */
/*  Arithmetique de Galois GF(256)                                     */
/* ------------------------------------------------------------------ */

// Polynome primitif de la norme : x^8 + x^4 + x^3 + x^2 + 1 (0x11D).
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i += 1) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i += 1) EXP[i] = EXP[i - 255];
})();

const mul = (a, b) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

/**
 * Polynome generateur de degre `degre` : le produit des (x - alpha^i).
 *
 * Les coefficients sont ranges du degre le plus FORT au plus faible. Multiplier
 * par x laisse donc chaque coefficient a son indice (le tableau s'allonge d'un
 * cran a droite), tandis que multiplier par alpha^i le decale d'un indice. Les
 * intervertir donne un polynome retourne, dont la correction reste plausible et
 * ne se voit qu'a la relecture : c'est exactement ce que verifie le decodeur de
 * test/unit/qrcode.test.js.
 */
function generateur(degre) {
  let poly = [1];
  for (let i = 0; i < degre; i += 1) {
    const suivant = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j += 1) {
      suivant[j] ^= poly[j];
      suivant[j + 1] ^= mul(poly[j], EXP[i]);
    }
    poly = suivant;
  }
  return poly;
}

const generateursConnus = new Map();
function generateurCache(degre) {
  if (!generateursConnus.has(degre)) generateursConnus.set(degre, generateur(degre));
  return generateursConnus.get(degre);
}

/**
 * Octets de correction d'un bloc de donnees : reste de la division du message
 * (decale) par le polynome generateur.
 * @param {number[]} donnees
 * @param {number} nbCorrection
 * @returns {number[]}
 */
export function correctionReedSolomon(donnees, nbCorrection) {
  const gen = generateurCache(nbCorrection);
  const reste = new Array(nbCorrection).fill(0);
  for (const octet of donnees) {
    const facteur = octet ^ reste[0];
    reste.shift();
    reste.push(0);
    if (facteur !== 0) {
      for (let i = 0; i < nbCorrection; i += 1) reste[i] ^= mul(gen[i + 1], facteur);
    }
  }
  return reste;
}

/* ------------------------------------------------------------------ */
/*  Mise en bits                                                       */
/* ------------------------------------------------------------------ */

class Bits {
  constructor() {
    this.bits = [];
  }

  pousser(valeur, longueur) {
    for (let i = longueur - 1; i >= 0; i -= 1) this.bits.push((valeur >> i) & 1);
    return this;
  }

  get longueur() {
    return this.bits.length;
  }

  versOctets() {
    const octets = [];
    for (let i = 0; i < this.bits.length; i += 8) {
      let octet = 0;
      for (let j = 0; j < 8; j += 1) octet = (octet << 1) | (this.bits[i + j] ?? 0);
      octets.push(octet);
    }
    return octets;
  }
}

/** Nombre de bits du champ « longueur » en mode octet. */
const bitsLongueur = (version) => (version <= 9 ? 8 : 16);

/** Capacite en octets de donnees d'une version et d'un niveau. */
export function capaciteOctets(version, niveau) {
  const [, b1, d1, b2, d2] = CORRECTION[version][niveau];
  const total = b1 * d1 + b2 * d2;
  // Indicateur de mode (4 bits) + champ longueur, retires de la capacite.
  return total - Math.ceil((4 + bitsLongueur(version)) / 8);
}

/** La plus petite version qui accueille ces octets au niveau demande. */
export function plusPetiteVersion(nbOctets, niveau, versionMin = 1) {
  for (let v = Math.max(1, versionMin); v <= VERSION_MAX; v += 1) {
    const [, b1, d1, b2, d2] = CORRECTION[v][niveau];
    const capacite = b1 * d1 + b2 * d2;
    const bitsNecessaires = 4 + bitsLongueur(v) + nbOctets * 8;
    if (bitsNecessaires <= capacite * 8) return v;
  }
  return null;
}

/** Octets de donnees complets (mode, longueur, contenu, terminaison, remplissage). */
function octetsDeDonnees(contenu, version, niveau) {
  const [, b1, d1, b2, d2] = CORRECTION[version][niveau];
  const capacite = b1 * d1 + b2 * d2;

  const bits = new Bits();
  bits.pousser(0b0100, 4); // mode octet
  bits.pousser(contenu.length, bitsLongueur(version));
  for (const octet of contenu) bits.pousser(octet, 8);

  // Terminaison : jusqu'a quatre zeros, sans depasser la capacite.
  const restant = capacite * 8 - bits.longueur;
  bits.pousser(0, Math.min(4, Math.max(0, restant)));
  // Completer l'octet en cours.
  if (bits.longueur % 8 !== 0) bits.pousser(0, 8 - (bits.longueur % 8));

  const octets = bits.versOctets();
  // Remplissage alterne impose par la norme.
  const REMPLISSAGE = [0xec, 0x11];
  for (let i = 0; octets.length < capacite; i += 1) octets.push(REMPLISSAGE[i % 2]);
  return octets;
}

/**
 * Entrelacement : les blocs de donnees colonne par colonne, puis les blocs de
 * correction colonne par colonne. C'est ce qui permet a une tache d'encre de
 * n'abimer qu'un octet par bloc au lieu d'aneantir un bloc entier.
 */
function entrelacer(octets, version, niveau) {
  const [nbCorrection, b1, d1, b2, d2] = CORRECTION[version][niveau];

  const blocs = [];
  let position = 0;
  for (let i = 0; i < b1; i += 1) {
    blocs.push(octets.slice(position, position + d1));
    position += d1;
  }
  for (let i = 0; i < b2; i += 1) {
    blocs.push(octets.slice(position, position + d2));
    position += d2;
  }
  const corrections = blocs.map((bloc) => correctionReedSolomon(bloc, nbCorrection));

  const sortie = [];
  const maxDonnees = Math.max(d1, d2);
  for (let i = 0; i < maxDonnees; i += 1) {
    for (const bloc of blocs) if (i < bloc.length) sortie.push(bloc[i]);
  }
  for (let i = 0; i < nbCorrection; i += 1) {
    for (const bloc of corrections) sortie.push(bloc[i]);
  }
  return sortie;
}

/* ------------------------------------------------------------------ */
/*  Trame : motifs fixes                                               */
/* ------------------------------------------------------------------ */

/**
 * @typedef {{ taille:number, modules:Uint8Array, reserve:Uint8Array }} Trame
 * modules : 1 = sombre. reserve : 1 = module de service, le contenu ne s'y pose pas.
 */

function trameVide(taille) {
  return { taille, modules: new Uint8Array(taille * taille), reserve: new Uint8Array(taille * taille) };
}

const lire = (t, x, y) => t.modules[y * t.taille + x];
const poser = (t, x, y, sombre, service = false) => {
  t.modules[y * t.taille + x] = sombre ? 1 : 0;
  if (service) t.reserve[y * t.taille + x] = 1;
};
const estReserve = (t, x, y) => t.reserve[y * t.taille + x] === 1;

/** Motif de detection de position : carre 7x7, plus son separateur clair. */
function poserDetection(t, cx, cy) {
  for (let dy = -1; dy <= 7; dy += 1) {
    for (let dx = -1; dx <= 7; dx += 1) {
      const x = cx + dx;
      const y = cy + dy;
      if (x < 0 || y < 0 || x >= t.taille || y >= t.taille) continue;
      const dansCarre = dx >= 0 && dx <= 6 && dy >= 0 && dy <= 6;
      const bordure = dansCarre && (dx === 0 || dx === 6 || dy === 0 || dy === 6);
      const centre = dansCarre && dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4;
      poser(t, x, y, bordure || centre, true);
    }
  }
}

/** Motif d'alignement : carre 5x5, sauf la ou il chevaucherait un motif de detection. */
function poserAlignements(t, version) {
  const centres = ALIGNEMENTS[version];
  // Le dernier centre d'alignement d'une version tombe toujours sur taille - 7,
  // c'est-a-dire sur le centre des motifs de detection des coins.
  const dernier = t.taille - 7;
  for (const cy of centres) {
    for (const cx of centres) {
      // Les trois coins portent deja un motif de detection.
      if ((cx === 6 && cy === 6) || (cx === 6 && cy === dernier) || (cx === dernier && cy === 6)) continue;
      for (let dy = -2; dy <= 2; dy += 1) {
        for (let dx = -2; dx <= 2; dx += 1) {
          const bord = Math.max(Math.abs(dx), Math.abs(dy));
          poser(t, cx + dx, cy + dy, bord !== 1, true);
        }
      }
    }
  }
}

/** Lignes de synchronisation : une alternance sombre/clair, ligne 6 et colonne 6. */
function poserSynchronisation(t) {
  for (let i = 8; i < t.taille - 8; i += 1) {
    const sombre = i % 2 === 0;
    poser(t, i, 6, sombre, true);
    poser(t, 6, i, sombre, true);
  }
}

/** Reserve les zones d'information (niveau + masque, et version si >= 7). */
function reserverInformation(t, version) {
  const n = t.taille;
  for (let i = 0; i < 9; i += 1) {
    if (!estReserve(t, i, 8)) poser(t, i, 8, false, true);
    if (!estReserve(t, 8, i)) poser(t, 8, i, false, true);
  }
  for (let i = 0; i < 8; i += 1) {
    poser(t, n - 1 - i, 8, false, true);
    poser(t, 8, n - 1 - i, false, true);
  }
  // Module toujours sombre, juste au-dessus du motif inferieur gauche.
  poser(t, 8, n - 8, true, true);

  if (version >= 7) {
    for (let i = 0; i < 18; i += 1) {
      const a = Math.floor(i / 3);
      const b = (i % 3) + n - 11;
      poser(t, a, b, false, true);
      poser(t, b, a, false, true);
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Placement du contenu                                               */
/* ------------------------------------------------------------------ */

/**
 * Parcours en zigzag : deux colonnes a la fois, depuis le coin inferieur droit,
 * en alternant montee et descente. La colonne 6 est sautee : elle porte la
 * ligne de synchronisation verticale.
 */
function poserContenu(t, octets) {
  const n = t.taille;
  let index = 0;
  let bit = 7;
  let montee = true;

  const prochainBit = () => {
    // Une fois les octets epuises, il reste les « bits restants » de la
    // version (0, 3 ou 7 selon la version) : la norme les veut clairs.
    if (index >= octets.length) return 0;
    const valeur = (octets[index] >> bit) & 1;
    bit -= 1;
    if (bit < 0) {
      bit = 7;
      index += 1;
    }
    return valeur;
  };

  for (let colonne = n - 1; colonne > 0; colonne -= 2) {
    if (colonne === 6) colonne = 5;
    for (let pas = 0; pas < n; pas += 1) {
      const y = montee ? n - 1 - pas : pas;
      for (let dx = 0; dx < 2; dx += 1) {
        const x = colonne - dx;
        if (estReserve(t, x, y)) continue;
        poser(t, x, y, prochainBit() === 1);
      }
    }
    montee = !montee;
  }
}

/* ------------------------------------------------------------------ */
/*  Masquage                                                           */
/* ------------------------------------------------------------------ */

const MASQUES = [
  (i, j) => (i + j) % 2 === 0,
  (i) => i % 2 === 0,
  (i, j) => j % 3 === 0,
  (i, j) => (i + j) % 3 === 0,
  (i, j) => (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0,
  (i, j) => ((i * j) % 2) + ((i * j) % 3) === 0,
  (i, j) => ((((i * j) % 2) + ((i * j) % 3)) % 2) === 0,
  (i, j) => ((((i + j) % 2) + ((i * j) % 3)) % 2) === 0,
];

function appliquerMasque(t, numero) {
  const regle = MASQUES[numero];
  const n = t.taille;
  for (let y = 0; y < n; y += 1) {
    for (let x = 0; x < n; x += 1) {
      if (estReserve(t, x, y)) continue;
      if (regle(y, x)) t.modules[y * n + x] ^= 1;
    }
  }
}

/**
 * Penalite d'un masque : plus elle est basse, plus le code est lisible par un
 * telephone. Les quatre regles de la norme, dans l'ordre.
 */
export function penalite(t) {
  const n = t.taille;
  let total = 0;

  // Regle 1 : suites de cinq modules de meme couleur ou plus.
  for (let axe = 0; axe < 2; axe += 1) {
    for (let a = 0; a < n; a += 1) {
      let precedent = -1;
      let suite = 0;
      for (let b = 0; b < n; b += 1) {
        const v = axe === 0 ? lire(t, b, a) : lire(t, a, b);
        if (v === precedent) {
          suite += 1;
          if (suite === 5) total += 3;
          else if (suite > 5) total += 1;
        } else {
          precedent = v;
          suite = 1;
        }
      }
    }
  }

  // Regle 2 : carres de 2x2 d'une seule couleur.
  for (let y = 0; y < n - 1; y += 1) {
    for (let x = 0; x < n - 1; x += 1) {
      const v = lire(t, x, y);
      if (v === lire(t, x + 1, y) && v === lire(t, x, y + 1) && v === lire(t, x + 1, y + 1)) total += 3;
    }
  }

  // Regle 3 : motif 1:1:3:1:1 borde de quatre modules clairs, qui imiterait un
  // motif de detection et egarerait le lecteur.
  const MOTIF = [1, 0, 1, 1, 1, 0, 1];
  const correspond = (suite, debut) => {
    for (let i = 0; i < 7; i += 1) if (suite[debut + i] !== MOTIF[i]) return false;
    const avant = suite.slice(Math.max(0, debut - 4), debut);
    const apres = suite.slice(debut + 7, debut + 11);
    const clairs = (arr) => arr.length === 4 && arr.every((v) => v === 0);
    return clairs(avant) || clairs(apres);
  };
  for (let axe = 0; axe < 2; axe += 1) {
    for (let a = 0; a < n; a += 1) {
      const suite = [];
      for (let b = 0; b < n; b += 1) suite.push(axe === 0 ? lire(t, b, a) : lire(t, a, b));
      for (let debut = 0; debut + 7 <= n; debut += 1) if (correspond(suite, debut)) total += 40;
    }
  }

  // Regle 4 : ecart de la proportion de sombre par rapport a la moitie.
  let sombres = 0;
  for (let i = 0; i < t.modules.length; i += 1) sombres += t.modules[i];
  const pourcent = (sombres * 100) / t.modules.length;
  total += Math.floor(Math.abs(pourcent - 50) / 5) * 10;

  return total;
}

/* ------------------------------------------------------------------ */
/*  Information de format et de version                                */
/* ------------------------------------------------------------------ */

/** BCH(15,5) du format : 5 bits utiles, 10 bits de controle, puis masque 0x5412. */
export function bitsFormat(niveau, masque) {
  const donnees = (NIVEAUX[niveau] << 3) | masque;
  let reste = donnees << 10;
  for (let i = 14; i >= 10; i -= 1) {
    if ((reste >> i) & 1) reste ^= 0b10100110111 << (i - 10);
  }
  return ((donnees << 10) | reste) ^ 0b101010000010010;
}

/** BCH(18,6) de la version, pour les versions 7 et suivantes. */
export function bitsVersion(version) {
  let reste = version << 12;
  for (let i = 17; i >= 12; i -= 1) {
    if ((reste >> i) & 1) reste ^= 0b1111100100101 << (i - 12);
  }
  return (version << 12) | reste;
}

function poserFormat(t, niveau, masque) {
  const bits = bitsFormat(niveau, masque);
  const n = t.taille;
  for (let i = 0; i < 15; i += 1) {
    const sombre = ((bits >> i) & 1) === 1;
    // Copie autour du motif superieur gauche.
    if (i < 6) poser(t, 8, i, sombre, true);
    else if (i === 6) poser(t, 8, 7, sombre, true);
    else if (i === 7) poser(t, 8, 8, sombre, true);
    else if (i === 8) poser(t, 7, 8, sombre, true);
    else poser(t, 14 - i, 8, sombre, true);
    // Copie de secours, repartie sur les deux autres coins.
    if (i < 8) poser(t, n - 1 - i, 8, sombre, true);
    else poser(t, 8, n - 15 + i, sombre, true);
  }
  poser(t, 8, n - 8, true, true);
}

function poserVersion(t, version) {
  if (version < 7) return;
  const bits = bitsVersion(version);
  const n = t.taille;
  for (let i = 0; i < 18; i += 1) {
    const sombre = ((bits >> i) & 1) === 1;
    const a = Math.floor(i / 3);
    const b = (i % 3) + n - 11;
    poser(t, a, b, sombre, true);
    poser(t, b, a, sombre, true);
  }
}

/* ------------------------------------------------------------------ */
/*  Point d'entree                                                     */
/* ------------------------------------------------------------------ */

export class ErreurQrTropLong extends Error {
  constructor(octets) {
    super('Contenu trop long pour un QR Code de version ' + VERSION_MAX + ' (' + octets + ' octets).');
    this.name = 'ErreurQrTropLong';
  }
}

/**
 * Encode un texte en QR Code.
 *
 * @param {string} texte
 * @param {{ niveau?: 'L'|'M'|'Q'|'H', versionMin?: number, masque?: number|null }} [opts]
 *   niveau : correction d'erreur. « Q » par defaut : l'affiche du salon vit
 *   collee sur une vitrine, elle prend la poussiere et les doigts, et 25 % de
 *   redondance la laisse lisible bien plus longtemps que 15 %.
 * @returns {{ taille:number, modules:Uint8Array, version:number, niveau:string, masque:number,
 *             estSombre:(x:number,y:number)=>boolean }}
 */
export function encoder(texte, { niveau = 'Q', versionMin = 1, masque = null } = {}) {
  if (!Object.hasOwn(NIVEAUX, niveau)) throw new Error('Niveau de correction inconnu : ' + niveau);
  const contenu = [...Buffer.from(String(texte), 'utf8')];

  const version = plusPetiteVersion(contenu.length, niveau, versionMin);
  if (!version) throw new ErreurQrTropLong(contenu.length);

  const donnees = octetsDeDonnees(contenu, version, niveau);
  const octets = entrelacer(donnees, version, niveau);

  const construire = (numeroMasque) => {
    const t = trameVide(taillePourVersion(version));
    poserDetection(t, 0, 0);
    poserDetection(t, t.taille - 7, 0);
    poserDetection(t, 0, t.taille - 7);
    poserAlignements(t, version);
    poserSynchronisation(t);
    reserverInformation(t, version);
    poserContenu(t, octets);
    appliquerMasque(t, numeroMasque);
    poserFormat(t, niveau, numeroMasque);
    poserVersion(t, version);
    return t;
  };

  let meilleur = null;
  let meilleurMasque = 0;
  if (masque !== null) {
    if (!Number.isInteger(masque) || masque < 0 || masque > 7) throw new Error('Numero de masque invalide : ' + masque);
    meilleur = construire(masque);
    meilleurMasque = masque;
  } else {
    let meilleurePenalite = Infinity;
    for (let m = 0; m < 8; m += 1) {
      const essai = construire(m);
      const p = penalite(essai);
      if (p < meilleurePenalite) {
        meilleurePenalite = p;
        meilleur = essai;
        meilleurMasque = m;
      }
    }
  }

  return {
    taille: meilleur.taille,
    modules: meilleur.modules,
    version,
    niveau,
    masque: meilleurMasque,
    estSombre: (x, y) => meilleur.modules[y * meilleur.taille + x] === 1,
  };
}

/* ------------------------------------------------------------------ */
/*  Rendus                                                             */
/* ------------------------------------------------------------------ */

/**
 * Rendu SVG : un seul chemin pour tous les modules sombres, ce qui donne un
 * fichier leger et parfaitement net a n'importe quelle taille d'impression.
 *
 * @param {ReturnType<typeof encoder>} qr
 * @param {{ marge?: number, sombre?: string, clair?: string, titre?: string }} [opts]
 *   marge : « zone calme » en modules. La norme en impose quatre : sans elle,
 *   beaucoup de telephones ne detectent tout simplement pas le code.
 */
export function versSvg(qr, { marge = 4, sombre = '#000000', clair = '#ffffff', titre = 'QR Code' } = {}) {
  const total = qr.taille + marge * 2;
  const chemin = [];
  for (let y = 0; y < qr.taille; y += 1) {
    for (let x = 0; x < qr.taille; x += 1) {
      if (qr.estSombre(x, y)) chemin.push('M' + (x + marge) + ' ' + (y + marge) + 'h1v1h-1z');
    }
  }
  const echapper = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + total + ' ' + total + '" '
    + 'width="' + total * 8 + '" height="' + total * 8 + '" shape-rendering="crispEdges" role="img" '
    + 'aria-label="' + echapper(titre) + '">'
    + '<title>' + echapper(titre) + '</title>'
    + '<rect width="' + total + '" height="' + total + '" fill="' + clair + '"/>'
    + '<path d="' + chemin.join('') + '" fill="' + sombre + '"/>'
    + '</svg>';
}

/**
 * Matrice brute avec sa zone calme, un octet par module (0 clair, 1 sombre).
 * Sert au rendu PNG et aux tests.
 */
export function versMatrice(qr, { marge = 4, echelle = 1 } = {}) {
  const total = (qr.taille + marge * 2) * echelle;
  const pixels = new Uint8Array(total * total);
  for (let y = 0; y < qr.taille; y += 1) {
    for (let x = 0; x < qr.taille; x += 1) {
      if (!qr.estSombre(x, y)) continue;
      for (let dy = 0; dy < echelle; dy += 1) {
        for (let dx = 0; dx < echelle; dx += 1) {
          const px = (x + marge) * echelle + dx;
          const py = (y + marge) * echelle + dy;
          pixels[py * total + px] = 1;
        }
      }
    }
  }
  return { taille: total, pixels };
}
