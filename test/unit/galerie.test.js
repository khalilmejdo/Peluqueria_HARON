/**
 * La galerie de photos du salon.
 *
 * Le nom du fichier porte l'ordre ET la legende : c'est ce qui permet au gerant
 * de tout regler en renommant ses photos, sans ecran d'administration. Cette
 * convention doit donc etre exacte, et surtout ne jamais laisser passer un nom
 * de fichier tordu dans la page.
 */
import './amorce.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import { _legendeDepuisNom as legende } from '../../server/site/galerie.js';
import { escapeHtml } from '../../server/core/text.js';

test('le nom du fichier devient la legende', () => {
  assert.equal(legende('01-nuestro-salon.jpg'), 'Nuestro salon');
  assert.equal(legende('02-la_vitrina.png'), 'La vitrina');
  assert.equal(legende('03-corte-clasico.webp'), 'Corte clasico');
  assert.equal(legende('mostrador.jpeg'), 'Mostrador');
});

test('le prefixe de classement ne s affiche jamais', () => {
  // Le gerant numerote pour choisir l'ordre, pas pour que le client le lise.
  assert.equal(legende('1-fauteuil.jpg'), 'Fauteuil');
  assert.equal(legende('001_fauteuil.jpg'), 'Fauteuil');
  assert.equal(legende('10 fauteuil.jpg'), 'Fauteuil');
  assert.equal(legende('  07 - fauteuil.jpg'), 'Fauteuil');
});

test('une photo sans nom parlant n a simplement pas de legende', () => {
  // Mieux vaut aucune legende qu'une legende « Img 4837 ».
  assert.equal(legende('04.jpg'), '');
  assert.equal(legende('12-.jpg'), '');
  assert.equal(legende('.jpg'), '');
});

test('les accents et les majuscules du nom sont respectes', () => {
  assert.equal(legende('01-el-salón.jpg'), 'El salón');
  assert.equal(legende('02-HARON.jpg'), 'HARON');
});

/**
 * Un nom de fichier tordu.
 *
 * La legende ne nettoie PAS le texte, et c'est volontaire : ce n'est pas son
 * travail. Elle rend un nom lisible, et la seule defense contre l'injection est
 * l'echappement au moment d'ecrire la page — un seul endroit, toujours le meme.
 * Nettoyer aussi ici donnerait deux defenses a garder d'accord, et c'est ainsi
 * qu'on finit par en oublier une.
 *
 * Ce test verifie donc les deux faits separement : la legende rend du texte
 * brut, et ce texte devient inerte une fois echappe.
 */
test('un nom de fichier tordu reste du texte, et s echappe a l ecriture', () => {
  const brut = legende('01-<script>alert(1)</script>.jpg');
  assert.equal(typeof brut, 'string');

  const dansLaPage = escapeHtml(brut);
  assert.ok(!dansLaPage.includes('<script'), 'aucune balise ne doit atteindre la page');
  assert.ok(!dansLaPage.includes('>'), 'aucun chevron fermant non echappe');
  assert.ok(dansLaPage.includes('&lt;script'), 'le chevron est echappe, pas supprime');
});

/** Une legende sert d attribut « alt » : elle ne doit pas casser l attribut. */
test('une legende avec guillemets ne casse pas l attribut alt', () => {
  const brut = legende('01-el "mejor" corte.jpg');
  const attribut = '<img alt="' + escapeHtml(brut) + '">';
  // Un seul couple de guillemets dans la balise : ceux que nous avons ecrits.
  assert.equal((attribut.match(/"/g) || []).length, 2);
});
