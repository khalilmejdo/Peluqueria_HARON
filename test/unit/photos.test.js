/**
 * Les photos du salon : ce qui se verifie sans base.
 *
 * Une photo arrive du telephone du gerant, par le reseau, et finit servie a
 * tous les visiteurs de la vitrine. Trois choses doivent tenir quoi qu'on
 * envoie :
 *
 *   - le TYPE se lit dans les octets. Un fichier HTML renomme en .jpg, un SVG
 *     (du XML qui peut porter un script), une image tronquee par un envoi
 *     interrompu : tout cela est refuse ;
 *   - aucun nom de fichier ne peut sortir du dossier des photos ;
 *   - une legende reste du TEXTE, quelle qu'elle soit.
 */
import './amorce.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

import { lireImage, cheminPhoto, legendeDepuisNom, legendeValide, LEGENDE_MAX } from '../../server/domain/photos.js';
import { sectionGalerie } from '../../server/site/vitrine.js';
import { traduire } from '../../server/core/langue.js';
import { pngCouleur } from '../../server/core/png.js';

/* ------------------------------------------------------------------ */
/*  Des images fabriquees octet par octet                              */
/* ------------------------------------------------------------------ */

/**
 * Un JPEG minimal mais STRUCTURELLEMENT juste : SOI, un APP0, un SOF0 qui porte
 * les dimensions, des donnees, EOI. Ecrit a la main plutot que genere par une
 * bibliotheque : le projet n'en a qu'une, et c'est `pg`.
 */
function jpeg({ largeur = 1600, hauteur = 1200, fin = true } = {}) {
  const app0 = [0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00];
  const sof0 = [0xff, 0xc0, 0x00, 0x11, 0x08,
    (hauteur >> 8) & 0xff, hauteur & 0xff, (largeur >> 8) & 0xff, largeur & 0xff,
    0x03, 0x01, 0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01];
  const donnees = new Array(120).fill(0x55);
  return Buffer.from([0xff, 0xd8, ...app0, ...sof0, ...donnees, ...(fin ? [0xff, 0xd9] : [])]);
}

function webpVp8x(largeur, hauteur) {
  const b = Buffer.alloc(40);
  b.write('RIFF', 0, 'latin1');
  b.writeUInt32LE(32, 4);
  b.write('WEBP', 8, 'latin1');
  b.write('VP8X', 12, 'latin1');
  b.writeUInt32LE(10, 16);
  b.writeUIntLE(largeur - 1, 24, 3);
  b.writeUIntLE(hauteur - 1, 27, 3);
  return b;
}

/* ------------------------------------------------------------------ */
/*  Le type et les dimensions                                          */
/* ------------------------------------------------------------------ */

test('un JPEG est reconnu, avec ses dimensions', () => {
  assert.deepEqual(lireImage(jpeg({ largeur: 1600, hauteur: 1200 })),
    { mime: 'image/jpeg', ext: 'jpg', largeur: 1600, hauteur: 1200 });
  // Portrait : les deux valeurs ne doivent pas etre inversees — c'est la
  // confusion classique, le SOF donne la hauteur AVANT la largeur.
  assert.deepEqual(lireImage(jpeg({ largeur: 900, hauteur: 1600 })),
    { mime: 'image/jpeg', ext: 'jpg', largeur: 900, hauteur: 1600 });
});

test('un PNG et un WebP sont reconnus, avec leurs dimensions', () => {
  const png = pngCouleur({ largeur: 40, hauteur: 30, rgb: new Uint8Array(40 * 30 * 3).fill(180) });
  const lu = lireImage(png);
  assert.equal(lu.mime, 'image/png');
  assert.equal(lu.largeur, 40);
  assert.equal(lu.hauteur, 30);

  assert.deepEqual(lireImage(webpVp8x(2000, 1333)), { mime: 'image/webp', ext: 'webp', largeur: 2000, hauteur: 1333 });
});

test('un envoi interrompu est refuse, pas enregistre a moitie', () => {
  // Un JPEG sans son marqueur de fin : le telephone a perdu le reseau.
  assert.equal(lireImage(jpeg({ fin: false })), null);
  // Un WebP qui annonce plus d'octets qu'il n'en contient.
  const tronque = webpVp8x(800, 600).subarray(0, 36);
  assert.equal(lireImage(tronque), null);
});

test('ce qui n est pas une photo est refuse, quelle que soit son extension', () => {
  const html = Buffer.from('<!DOCTYPE html><html><script>alert(1)</script></html>'.padEnd(200, ' '));
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'.padEnd(200, ' '));
  const gif = Buffer.from('GIF89a' + ' '.repeat(100), 'latin1');
  for (const contenu of [html, svg, gif, Buffer.alloc(0), Buffer.from('xx')]) {
    assert.equal(lireImage(contenu), null);
  }
  assert.equal(lireImage('pas un buffer'), null);
});

/* ------------------------------------------------------------------ */
/*  Le chemin sur disque                                               */
/* ------------------------------------------------------------------ */

test('aucun nom ne sort du dossier des photos', () => {
  const racine = path.resolve('/tmp/photos-essai');
  const bon = cheminPhoto('0199a1b2-c3d4-7e5f-8a6b-7c8d9e0f1a2b.jpg', racine);
  assert.equal(bon, path.join(racine, '0199a1b2-c3d4-7e5f-8a6b-7c8d9e0f1a2b.jpg'));

  for (const mauvais of [
    '../../etc/passwd',
    '..\\..\\windows\\win.ini',
    '0199a1b2-c3d4-7e5f-8a6b-7c8d9e0f1a2b.jpg/../../x',
    '0199a1b2-c3d4-7e5f-8a6b-7c8d9e0f1a2b.svg',
    '0199a1b2-c3d4-7e5f-8a6b-7c8d9e0f1a2b.jpg\0.html',
    'photo.jpg',
    '',
    null,
  ]) {
    assert.equal(cheminPhoto(mauvais, racine), null, 'accepte a tort : ' + String(mauvais));
  }
});

/* ------------------------------------------------------------------ */
/*  Les legendes                                                       */
/* ------------------------------------------------------------------ */

test('le nom d un fichier depose a la main devient une legende lisible', () => {
  assert.equal(legendeDepuisNom('01-nuestro-salon.jpg'), 'Nuestro salon');
  assert.equal(legendeDepuisNom('02_la_vitrine.webp'), 'La vitrine');
  // Le prefixe de classement ne s'affiche jamais, et un nom sans mot n'en
  // fabrique pas : une photo sans legende vaut mieux qu'une legende « 0003 ».
  assert.equal(legendeDepuisNom('0003.jpg'), '');
  assert.equal(legendeDepuisNom('Écran-Café.png'), 'Écran Café');
});

test('une legende trop longue est refusee, les espaces sont nettoyes', () => {
  assert.equal(legendeValide('  Le   fauteuil  '), 'Le fauteuil');
  assert.throws(() => legendeValide('x'.repeat(LEGENDE_MAX + 1)));
});

test('une legende reste du texte dans la page, jamais du HTML', () => {
  const tr = traduire('es');
  const html = sectionGalerie({
    tr,
    photos: [{ src: '/photos/a.jpg', legende: '"><img src=x onerror=alert(1)>', largeur: 10, hauteur: 10 }],
  });
  assert.ok(!html.includes('<img src=x'), 'la legende a ete injectee telle quelle');
  assert.ok(html.includes('&quot;&gt;&lt;img src=x onerror=alert(1)&gt;'));
});

test('aucune photo, aucune section : la vitrine ne s excuse pas d etre vide', () => {
  assert.equal(sectionGalerie({ tr: traduire('fr'), photos: [] }), '');
});
