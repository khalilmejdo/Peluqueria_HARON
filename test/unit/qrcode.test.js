/**
 * L'encodeur QR Code.
 *
 * Un QR Code faux ne se voit pas : il ressemble a un QR Code juste. Ce fichier
 * le verifie donc de trois manieres independantes.
 *
 *   1. COHERENCE DES TABLES. Pour chaque version et chaque niveau, octets de
 *      donnees + octets de correction doit tomber exactement sur le nombre
 *      total d'octets de la version. Les deux tables viennent de sources
 *      differentes de la norme : une faute de frappe dans l'une ne peut pas
 *      passer. Les centres d'alignement sont, eux, recalcules par l'algorithme
 *      de la norme et compares a la table.
 *
 *   2. VECTEUR CONNU. Le calcul Reed-Solomon est compare a l'exemple de la
 *      norme (annexe I.2 de l'ISO/IEC 18004).
 *
 *   3. RELECTURE COMPLETE. Un decodeur ecrit ici, a partir des regles de la
 *      norme et non du code de l'encodeur, relit la matrice produite : format,
 *      masque, parcours en zigzag, desentrelacement, syndromes de correction
 *      nuls, puis contenu. Si l'encodeur se trompe de place, de masque ou
 *      d'ordre, ce test tombe.
 *
 * Reste une chose qu'aucun test ne remplace : scanner l'affiche imprimee avec
 * un vrai telephone avant de la coller en vitrine. C'est dit dans l'écran QR.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  encoder, versSvg, versMatrice, correctionReedSolomon, bitsFormat, bitsVersion,
  CORRECTION, ALIGNEMENTS, TOTAL_OCTETS, VERSION_MAX, NIVEAUX, taillePourVersion,
  plusPetiteVersion, ErreurQrTropLong,
} from '../../server/core/qrcode.js';

const NIVEAUX_LISTE = ['L', 'M', 'Q', 'H'];

/* ------------------------------------------------------------------ */
/*  1. Coherence des tables                                            */
/* ------------------------------------------------------------------ */

test('les tables de correction tombent juste pour chaque version et chaque niveau', () => {
  for (let v = 1; v <= VERSION_MAX; v += 1) {
    for (const niveau of NIVEAUX_LISTE) {
      const [ec, b1, d1, b2, d2] = CORRECTION[v][niveau];
      const donnees = b1 * d1 + b2 * d2;
      const correction = (b1 + b2) * ec;
      assert.equal(donnees + correction, TOTAL_OCTETS[v],
        'version ' + v + ' niveau ' + niveau + ' : ' + donnees + ' + ' + correction + ' au lieu de ' + TOTAL_OCTETS[v]);
      // Les blocs du second groupe portent exactement un octet de plus.
      if (b2 > 0) assert.equal(d2, d1 + 1, 'version ' + v + ' niveau ' + niveau);
    }
  }
});

test('les centres d alignement suivent l algorithme de la norme', () => {
  for (let v = 2; v <= VERSION_MAX; v += 1) {
    const taille = taillePourVersion(v);
    const nombre = Math.floor(v / 7) + 2;
    const pas = Math.ceil((taille - 13) / (2 * nombre - 2)) * 2;
    const attendus = [6];
    for (let position = taille - 7; attendus.length < nombre; position -= pas) attendus.splice(1, 0, position);
    assert.deepEqual(ALIGNEMENTS[v], attendus, 'version ' + v);
  }
  assert.deepEqual(ALIGNEMENTS[1], []);
});

test('l information de format porte bien le niveau et le masque', () => {
  // Les 32 combinaisons sont distinctes et s'ecartent d'au moins 5 bits : c'est
  // ce qui permet a un lecteur de retrouver le format sur un code abime.
  const vus = [];
  for (const niveau of NIVEAUX_LISTE) {
    for (let masque = 0; masque < 8; masque += 1) {
      const bits = bitsFormat(niveau, masque);
      assert.ok(bits >= 0 && bits < 32768);
      // Le format se relit : on retire le masque et on lit les 5 bits utiles.
      const utiles = (bits ^ 0b101010000010010) >> 10;
      assert.equal(utiles >> 3, NIVEAUX[niveau]);
      assert.equal(utiles & 0b111, masque);
      vus.push(bits);
    }
  }
  assert.equal(new Set(vus).size, 32);
  for (let i = 0; i < vus.length; i += 1) {
    for (let j = i + 1; j < vus.length; j += 1) {
      const distance = ((vus[i] ^ vus[j]).toString(2).match(/1/g) || []).length;
      assert.ok(distance >= 5, 'formats trop proches : ' + vus[i] + ' et ' + vus[j]);
    }
  }
});

test('l information de version se relit', () => {
  for (let v = 7; v <= VERSION_MAX; v += 1) {
    assert.equal(bitsVersion(v) >> 12, v);
  }
});

/* ------------------------------------------------------------------ */
/*  2. Vecteur connu de la norme                                       */
/* ------------------------------------------------------------------ */

test('Reed-Solomon donne le resultat de l exemple de la norme', () => {
  // ISO/IEC 18004, annexe I.2 : « 01234567 » en mode numerique, version 1,
  // niveau M. Les 16 octets de donnees et les 10 octets de correction attendus
  // sont publies tels quels dans la norme.
  const donnees = [0x10, 0x20, 0x0c, 0x56, 0x61, 0x80, 0xec, 0x11, 0xec, 0x11, 0xec, 0x11, 0xec, 0x11, 0xec, 0x11];
  const attendus = [0xa5, 0x24, 0xd4, 0xc1, 0xed, 0x36, 0xc7, 0x87, 0x2c, 0x55];
  assert.deepEqual(correctionReedSolomon(donnees, 10), attendus);
});

test('un bloc vide ne produit que des zeros de correction', () => {
  assert.deepEqual(correctionReedSolomon([0, 0, 0, 0], 7), [0, 0, 0, 0, 0, 0, 0]);
});

/* ------------------------------------------------------------------ */
/*  3. Relecture complete de la matrice                                */
/* ------------------------------------------------------------------ */

/* --- Galois, reecrit ici pour ne rien emprunter a l'encodeur --- */

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

/* --- Carte des modules de service, redressee depuis la norme --- */

function carteDeService(version) {
  const n = taillePourVersion(version);
  const service = new Uint8Array(n * n);
  const marquer = (x, y) => {
    if (x >= 0 && y >= 0 && x < n && y < n) service[y * n + x] = 1;
  };

  // Motifs de detection et leurs separateurs : trois carres de 8 sur 8.
  for (const [cx, cy] of [[0, 0], [n - 7, 0], [0, n - 7]]) {
    for (let dy = -1; dy <= 7; dy += 1) for (let dx = -1; dx <= 7; dx += 1) marquer(cx + dx, cy + dy);
  }
  // Lignes de synchronisation.
  for (let i = 0; i < n; i += 1) {
    marquer(6, i);
    marquer(i, 6);
  }
  // Motifs d'alignement, hors des trois coins.
  const centres = ALIGNEMENTS[version];
  const dernier = n - 7;
  for (const cy of centres) {
    for (const cx of centres) {
      if ((cx === 6 && cy === 6) || (cx === 6 && cy === dernier) || (cx === dernier && cy === 6)) continue;
      for (let dy = -2; dy <= 2; dy += 1) for (let dx = -2; dx <= 2; dx += 1) marquer(cx + dx, cy + dy);
    }
  }
  // Zones d'information de format.
  for (let i = 0; i < 9; i += 1) {
    marquer(8, i);
    marquer(i, 8);
  }
  for (let i = 0; i < 8; i += 1) {
    marquer(n - 1 - i, 8);
    marquer(8, n - 1 - i);
  }
  // Zones d'information de version.
  if (version >= 7) {
    for (let i = 0; i < 18; i += 1) {
      const a = Math.floor(i / 3);
      const b = (i % 3) + n - 11;
      marquer(a, b);
      marquer(b, a);
    }
  }
  return service;
}

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

/** Relit un QR Code produit par l'encodeur, et rend le texte qu'il porte. */
function decoder(qr) {
  const n = qr.taille;
  const lire = (x, y) => qr.modules[y * n + x];

  // --- format : la copie du coin superieur gauche
  let brut = 0;
  const positionsFormat = [
    [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8],
    [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8],
  ];
  positionsFormat.forEach(([x, y], i) => {
    if (lire(x, y)) brut |= 1 << i;
  });
  const utiles = (brut ^ 0b101010000010010) >> 10;
  const niveau = Object.keys(NIVEAUX).find((k) => NIVEAUX[k] === (utiles >> 3));
  const masque = utiles & 0b111;
  assert.ok(niveau, 'niveau de correction illisible dans l information de format');

  // --- lecture des octets : le zigzag, en retirant le masque au passage
  const service = carteDeService(qr.version);
  const regle = MASQUES[masque];
  const bits = [];
  let montee = true;
  for (let colonne = n - 1; colonne > 0; colonne -= 2) {
    if (colonne === 6) colonne = 5;
    for (let pas = 0; pas < n; pas += 1) {
      const y = montee ? n - 1 - pas : pas;
      for (let dx = 0; dx < 2; dx += 1) {
        const x = colonne - dx;
        if (service[y * n + x]) continue;
        bits.push(lire(x, y) ^ (regle(y, x) ? 1 : 0));
      }
    }
    montee = !montee;
  }

  const octets = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    let octet = 0;
    for (let j = 0; j < 8; j += 1) octet = (octet << 1) | bits[i + j];
    octets.push(octet);
  }
  assert.equal(octets.length, TOTAL_OCTETS[qr.version],
    'nombre d octets relus incorrect pour la version ' + qr.version);

  // --- desentrelacement
  const [nbEc, b1, d1, b2, d2] = CORRECTION[qr.version][niveau];
  const tailles = [...Array(b1).fill(d1), ...Array(b2).fill(d2)];
  const blocs = tailles.map(() => []);
  let curseur = 0;
  for (let i = 0; i < Math.max(d1, d2); i += 1) {
    for (let b = 0; b < blocs.length; b += 1) {
      if (i < tailles[b]) blocs[b].push(octets[curseur++]);
    }
  }
  const corrections = blocs.map(() => []);
  for (let i = 0; i < nbEc; i += 1) {
    for (let b = 0; b < blocs.length; b += 1) corrections[b].push(octets[curseur++]);
  }
  assert.equal(curseur, octets.length);

  // --- syndromes : nuls si la correction a ete calculee juste
  blocs.forEach((bloc, b) => {
    const mot = [...bloc, ...corrections[b]];
    for (let i = 0; i < nbEc; i += 1) {
      let syndrome = 0;
      for (let j = 0; j < mot.length; j += 1) {
        syndrome ^= mul(mot[j], EXP[(i * (mot.length - 1 - j)) % 255]);
      }
      assert.equal(syndrome, 0, 'syndrome non nul (bloc ' + b + ', indice ' + i + ')');
    }
  });

  // --- contenu : mode octet, longueur, puis les octets
  const donnees = blocs.flat();
  const flux = [];
  for (const octet of donnees) for (let i = 7; i >= 0; i -= 1) flux.push((octet >> i) & 1);
  const prendre = (combien) => {
    let valeur = 0;
    for (let i = 0; i < combien; i += 1) valeur = (valeur << 1) | flux.shift();
    return valeur;
  };
  assert.equal(prendre(4), 0b0100, 'l indicateur de mode devrait etre « octet »');
  const longueur = prendre(qr.version <= 9 ? 8 : 16);
  const contenu = [];
  for (let i = 0; i < longueur; i += 1) contenu.push(prendre(8));
  return { texte: Buffer.from(contenu).toString('utf8'), niveau, masque };
}

test('un QR Code produit se relit, a tous les niveaux et sur plusieurs longueurs', () => {
  const textes = [
    'https://file.peluqueria-haron.com/join?qr=1',
    'A',
    'https://haron.example/join?qr=1',
    'https://file.peluqueria-haron.com/ticket/' + 'x'.repeat(32),
    // Accents et caracteres non latins : le mode octet porte de l'UTF-8.
    'Peluquería HARON — prenez votre tour, ça va vite !',
  ];
  for (const texte of textes) {
    for (const niveau of NIVEAUX_LISTE) {
      const qr = encoder(texte, { niveau });
      const relu = decoder(qr);
      assert.equal(relu.texte, texte, 'niveau ' + niveau + ' : « ' + texte +' »');
      assert.equal(relu.niveau, niveau);
      assert.equal(relu.masque, qr.masque);
    }
  }
});

test('les huit masques produisent tous un code relisible', () => {
  const texte = 'https://file.peluqueria-haron.com/join?qr=1';
  for (let masque = 0; masque < 8; masque += 1) {
    const qr = encoder(texte, { niveau: 'Q', masque });
    assert.equal(qr.masque, masque);
    assert.equal(decoder(qr).texte, texte);
  }
});

test('le contenu se relit dans toutes les versions atteintes par le salon', () => {
  // Une adresse courte tient en version 2 ; un lien de suivi long monte plus
  // haut. On force chaque version pour couvrir les deux tailles de champ de
  // longueur (8 bits jusqu'a la version 9, 16 bits au-dela) et les zones
  // d'information de version (a partir de la version 7).
  for (let v = 1; v <= VERSION_MAX; v += 1) {
    const texte = 'HARON-' + 'z'.repeat(Math.max(0, Math.min(40, v * 3)));
    const qr = encoder(texte, { niveau: 'Q', versionMin: v });
    assert.equal(qr.version, Math.max(v, plusPetiteVersion([...Buffer.from(texte)].length, 'Q')));
    assert.equal(decoder(qr).texte, texte);
  }
});

/* ------------------------------------------------------------------ */
/*  Motifs fixes et rendus                                             */
/* ------------------------------------------------------------------ */

test('les motifs de detection et de synchronisation sont a leur place', () => {
  const qr = encoder('https://file.peluqueria-haron.com/join?qr=1', { niveau: 'Q' });
  const n = qr.taille;
  const sombre = (x, y) => qr.estSombre(x, y);

  for (const [cx, cy] of [[0, 0], [n - 7, 0], [0, n - 7]]) {
    // Bordure sombre, anneau clair, centre sombre.
    assert.ok(sombre(cx, cy) && sombre(cx + 6, cy) && sombre(cx, cy + 6) && sombre(cx + 6, cy + 6));
    assert.ok(!sombre(cx + 1, cy + 1) && !sombre(cx + 5, cy + 5));
    assert.ok(sombre(cx + 3, cy + 3));
  }
  // Synchronisation : alternance stricte.
  for (let i = 8; i < n - 8; i += 1) {
    assert.equal(sombre(i, 6), i % 2 === 0, 'synchronisation horizontale en ' + i);
    assert.equal(sombre(6, i), i % 2 === 0, 'synchronisation verticale en ' + i);
  }
  // Le module toujours sombre.
  assert.ok(sombre(8, n - 8));
});

test('le SVG contient un module par carre sombre et respecte la zone calme', () => {
  const qr = encoder('HARON', { niveau: 'M' });
  const svg = versSvg(qr, { marge: 4 });
  const total = qr.taille + 8;
  assert.match(svg, new RegExp('viewBox="0 0 ' + total + ' ' + total + '"'));
  let sombres = 0;
  for (let y = 0; y < qr.taille; y += 1) for (let x = 0; x < qr.taille; x += 1) if (qr.estSombre(x, y)) sombres += 1;
  assert.equal((svg.match(/h1v1h-1z/g) || []).length, sombres);
  // La zone calme de quatre modules est obligatoire : sans elle, beaucoup de
  // telephones ne detectent tout simplement pas le code.
  assert.match(svg, /<rect width="\d+" height="\d+" fill="#ffffff"\/>/);
});

test('la matrice mise a l echelle garde exactement le meme dessin', () => {
  const qr = encoder('HARON', { niveau: 'M' });
  const { taille, pixels } = versMatrice(qr, { marge: 4, echelle: 3 });
  assert.equal(taille, (qr.taille + 8) * 3);
  for (let y = 0; y < qr.taille; y += 1) {
    for (let x = 0; x < qr.taille; x += 1) {
      const attendu = qr.estSombre(x, y) ? 1 : 0;
      for (let dy = 0; dy < 3; dy += 1) {
        for (let dx = 0; dx < 3; dx += 1) {
          const px = (x + 4) * 3 + dx;
          const py = (y + 4) * 3 + dy;
          assert.equal(pixels[py * taille + px], attendu);
        }
      }
    }
  }
  // La zone calme est bien vide.
  assert.equal(pixels[0], 0);
  assert.equal(pixels[pixels.length - 1], 0);
});

test('un contenu trop long est refuse clairement plutot que tronque', () => {
  assert.throws(() => encoder('x'.repeat(5000)), ErreurQrTropLong);
  assert.equal(plusPetiteVersion(5000, 'Q'), null);
});

test('l encodeur choisit la plus petite version qui convient', () => {
  // 13 octets tiennent dans la version 1 au niveau Q, 14 non.
  assert.equal(plusPetiteVersion(1, 'Q'), 1);
  assert.equal(encoder('HARON', { niveau: 'Q' }).version, 1);
  assert.ok(encoder('x'.repeat(120), { niveau: 'Q' }).version > 4);
});
