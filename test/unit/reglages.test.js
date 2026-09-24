/**
 * Les coordonnees du salon.
 *
 * Elles ne servent qu'a une chose, mais elles la font entierement : conduire
 * un client a la porte. Une coordonnee a moitie lue n'envoie pas « un peu a
 * cote » — elle envoie dans une autre ville, parfois dans la mer. Mieux vaut
 * donc refuser net et montrer la forme attendue que deviner.
 */
import './amorce.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import { normaliserCoordonnees, versTexte, CATALOGUE } from '../../server/core/reglages.js';
import { ValidationError } from '../../server/core/errors.js';

test('ce que Google Maps met dans le presse-papier est accepte tel quel', () => {
  assert.equal(normaliserCoordonnees('40.416775, -3.703790'), '40.416775,-3.70379');
  assert.equal(normaliserCoordonnees('40.416775,-3.703790'), '40.416775,-3.70379');
  assert.equal(normaliserCoordonnees('  40.416775 ;  -3.70379  '), '40.416775,-3.70379');
  assert.equal(normaliserCoordonnees('+40.4,-3.7'), '40.4,-3.7');
});

test('un entier sans decimale reste une coordonnee valable', () => {
  assert.equal(normaliserCoordonnees('41,2'), '41,2');
  assert.equal(normaliserCoordonnees('-33.8, 151'), '-33.8,151');
});

/*
 * L'usage espagnol ecrit la virgule decimale. « 40,41 , -3,70 » a donc quatre
 * nombres et deux lectures possibles : on refuse plutot que de parier sur la
 * position d'un salon.
 */
test('la virgule decimale est refusee, pas devinee', () => {
  assert.equal(normaliserCoordonnees('40,416775, -3,703790'), null);
});

test('ce qui n est pas une position est refuse', () => {
  assert.equal(normaliserCoordonnees(''), null);
  assert.equal(normaliserCoordonnees('   '), null);
  assert.equal(normaliserCoordonnees(null), null);
  assert.equal(normaliserCoordonnees('Calle Mayor 12'), null);
  assert.equal(normaliserCoordonnees('40.41'), null);              // une seule valeur
  assert.equal(normaliserCoordonnees('40.41, -3.70, 12'), null);   // trois valeurs
  assert.equal(normaliserCoordonnees('91, 0.5'), null);            // latitude hors du globe
  assert.equal(normaliserCoordonnees('40, 181'), null);            // longitude hors du globe
  assert.equal(normaliserCoordonnees('40.4e1, -3.7'), null);       // notation scientifique
});

/*
 * (0, 0) est au large du golfe de Guinee. Aucun salon n'y est ; c'est en
 * revanche ce que produit un champ a moitie rempli, et une carte qui s'ouvre
 * sur l'ocean fait douter le client du salon, pas du reglage.
 */
test('le point nul du globe est refuse : c est un champ oublie', () => {
  assert.equal(normaliserCoordonnees('0,0'), null);
  assert.equal(normaliserCoordonnees('0, 0.0'), null);
  assert.notEqual(normaliserCoordonnees('0, 0.1'), null);
});

test('le reglage refuse une saisie illisible avec un message qui montre la forme', () => {
  assert.equal(versTexte('salon.coordenadas', '40.416775, -3.703790'), '40.416775,-3.70379');
  assert.equal(versTexte('salon.coordenadas', ''), '');
  assert.throws(
    () => versTexte('salon.coordenadas', 'a cote de la pharmacie'),
    (err) => err instanceof ValidationError && /40\.416775/.test(err.fields['salon.coordenadas']),
  );
});

test('le texte « comment venir » tient plusieurs phrases', () => {
  const regle = CATALOGUE['salon.comoLlegar'];
  assert.ok(regle.maxLongueur > 200, 'une seule ligne ne suffit pas pour un itineraire');
  const long = 'x'.repeat(regle.maxLongueur + 1);
  assert.throws(() => versTexte('salon.comoLlegar', long), ValidationError);
});
