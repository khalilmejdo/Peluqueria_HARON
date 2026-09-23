/**
 * Encodeur PNG minimal, pour l'image telechargeable du QR Code.
 *
 * Le SVG suffit a l'impression, mais un PNG se glisse dans un message, un
 * document ou une commande d'imprimeur sans discussion. Un PNG est une suite de
 * blocs ; il en faut trois : l'en-tete, les pixels compresses, la fin. zlib est
 * dans Node, aucune dependance n'est necessaire.
 *
 * Portee : images en niveaux de gris sur 1 bit (noir et blanc), ce qui est
 * exactement ce qu'est un QR Code, et donne un fichier minuscule.
 */
import zlib from 'node:zlib';

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Table du controle de redondance cyclique, calculee une fois. */
const TABLE_CRC = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) c = TABLE_CRC[(c ^ buffer[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function bloc(type, donnees) {
  const entete = Buffer.alloc(8);
  entete.writeUInt32BE(donnees.length, 0);
  entete.write(type, 4, 'ascii');
  const controle = Buffer.alloc(4);
  controle.writeUInt32BE(crc32(Buffer.concat([entete.subarray(4), donnees])), 0);
  return Buffer.concat([entete, donnees, controle]);
}

/**
 * Fabrique un PNG noir et blanc.
 *
 * @param {{ taille:number, pixels:Uint8Array }} matrice  1 = noir, 0 = blanc
 * @returns {Buffer}
 */
export function pngNoirEtBlanc({ taille, pixels }) {
  if (!Number.isInteger(taille) || taille < 1) throw new Error('Taille d image invalide.');
  if (pixels.length !== taille * taille) throw new Error('Le nombre de pixels ne correspond pas a la taille.');

  // En-tete : largeur, hauteur, 1 bit par echantillon, niveaux de gris (0),
  // compression 0, filtre 0, entrelacement 0.
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(taille, 0);
  ihdr.writeUInt32BE(taille, 4);
  ihdr[8] = 1;
  ihdr[9] = 0;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  // Une ligne = un octet de filtre (0 : aucun) puis les pixels, huit par octet.
  // En niveaux de gris 1 bit, 0 est noir et 1 est blanc : on inverse donc la
  // matrice, ou 1 designe un module sombre.
  const octetsParLigne = Math.ceil(taille / 8);
  const brut = Buffer.alloc((octetsParLigne + 1) * taille, 0);
  for (let y = 0; y < taille; y += 1) {
    const debut = y * (octetsParLigne + 1);
    brut[debut] = 0;
    for (let x = 0; x < taille; x += 1) {
      if (pixels[y * taille + x]) continue; // sombre : le bit reste a 0
      brut[debut + 1 + (x >> 3)] |= 0x80 >> (x & 7);
    }
  }

  const idat = zlib.deflateSync(brut, { level: 9 });
  return Buffer.concat([SIGNATURE, bloc('IHDR', ihdr), bloc('IDAT', idat), bloc('IEND', Buffer.alloc(0))]);
}

/**
 * Fabrique un PNG en couleurs vraies (RGB, 8 bits par canal).
 *
 * Sert aux images de marque : l'icone de l'application et l'apercu partage sur
 * WhatsApp. Elles sont dessinees par scripts/images.js et versionnees dans
 * public/img/ : elles ne changent qu'a la main.
 *
 * @param {{ largeur:number, hauteur:number, rgb:Uint8Array }} p  rgb : 3 octets par pixel
 * @returns {Buffer}
 */
export function pngCouleur({ largeur, hauteur, rgb }) {
  if (!Number.isInteger(largeur) || !Number.isInteger(hauteur) || largeur < 1 || hauteur < 1) {
    throw new Error('Dimensions d image invalides.');
  }
  if (rgb.length !== largeur * hauteur * 3) throw new Error('Le nombre d octets ne correspond pas aux dimensions.');

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(largeur, 0);
  ihdr.writeUInt32BE(hauteur, 4);
  ihdr[8] = 8; // 8 bits par canal
  ihdr[9] = 2; // couleurs vraies, sans canal alpha
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  // Filtre 1 (« Sub ») : chaque octet devient sa difference avec celui du pixel
  // precedent. Sur des aplats et des degrades doux, cela divise la taille du
  // fichier par plusieurs, pour trois lignes de code.
  const octetsParLigne = largeur * 3;
  const brut = Buffer.alloc((octetsParLigne + 1) * hauteur);
  for (let y = 0; y < hauteur; y += 1) {
    const debut = y * (octetsParLigne + 1);
    brut[debut] = 1;
    const ligne = y * octetsParLigne;
    for (let i = 0; i < octetsParLigne; i += 1) {
      const precedent = i >= 3 ? rgb[ligne + i - 3] : 0;
      brut[debut + 1 + i] = (rgb[ligne + i] - precedent) & 0xff;
    }
  }

  const idat = zlib.deflateSync(brut, { level: 9 });
  return Buffer.concat([SIGNATURE, bloc('IHDR', ihdr), bloc('IDAT', idat), bloc('IEND', Buffer.alloc(0))]);
}

export { crc32 as _crc32 };
