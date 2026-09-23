/**
 * La fiche de prix : lecture et ecriture d'un prix.
 *
 * C'est de l'argent affiche au mur du salon. Le nombre que le gerant tape doit
 * etre exactement celui que le client lit, sans qu'un arrondi binaire s'invite
 * entre les deux. D'ou le stockage en centimes entiers, et d'ou ces tests.
 */
import './amorce.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import { prixEnCentimes, prixLegible } from '../../server/domain/tarifas.js';

test('un prix se saisit comme on l ecrit, et devient des centimes entiers', () => {
  assert.equal(prixEnCentimes('14'), 1400);
  assert.equal(prixEnCentimes('14,90'), 1490);
  assert.equal(prixEnCentimes('14.90'), 1490);
  assert.equal(prixEnCentimes('14,9'), 1490);   // une seule decimale = dizaines de centimes
  assert.equal(prixEnCentimes('9,05'), 905);
  assert.equal(prixEnCentimes('0'), 0);         // un service offert reste affichable
});

test('les facons d ecrire l euro sont tolerees, le reste est refuse', () => {
  assert.equal(prixEnCentimes('14 €'), 1400);
  assert.equal(prixEnCentimes('14,90€'), 1490);
  assert.equal(prixEnCentimes(' 14,90 EUR '), 1490);

  // Refus plutot que devinette : un prix mal lu finit imprime au mur.
  assert.equal(prixEnCentimes('abc'), null);
  assert.equal(prixEnCentimes('-5'), null);
  assert.equal(prixEnCentimes('14,999'), null);
  assert.equal(prixEnCentimes('14,90,50'), null);
  assert.equal(prixEnCentimes(''), null);
  assert.equal(prixEnCentimes(null), null);
  assert.equal(prixEnCentimes(undefined), null);
});

test('un prix invraisemblable est refuse, pas tronque', () => {
  assert.equal(prixEnCentimes('1000'), 100000);  // la borne exacte passe
  assert.equal(prixEnCentimes('1001'), null);    // au-dela, c est une faute de frappe
  assert.equal(prixEnCentimes(100001), null);
});

test('un entier de centimes traverse sans conversion', () => {
  assert.equal(prixEnCentimes(1490), 1490);
  assert.equal(prixEnCentimes(0), 0);
  assert.equal(prixEnCentimes(14.9), null);      // un flottant n est pas un prix
});

test('le prix s affiche a l espagnole, sans centimes inutiles', () => {
  assert.equal(prixLegible(1400), '14 €');
  assert.equal(prixLegible(1490), '14,90 €');
  assert.equal(prixLegible(905), '9,05 €');
  assert.equal(prixLegible(0), '0 €');
  assert.equal(prixLegible(100000), '1000 €');
});

/**
 * Le cas qui justifie tout le reste : `Math.round(1.005 * 100)` rend 100, pas
 * 101, parce que 1.005 n'existe pas exactement en binaire. Notre chemin ne
 * passe par aucun flottant, donc « 1,005 » est simplement refuse, et les deux
 * decimales qu'on accepte reviennent toujours identiques.
 */
test('aller et retour : ce qui est tape est ce qui est lu', () => {
  for (const ecrit of ['14', '14,90', '9,05', '22,50', '1,01', '0,99', '35']) {
    const cts = prixEnCentimes(ecrit);
    assert.notEqual(cts, null, ecrit + ' devrait etre accepte');
    const relu = prixLegible(cts).replace(' €', '');
    const attendu = ecrit.replace(/,(\d)$/, ',$10').replace(/,00$/, '');
    assert.equal(relu, attendu, ecrit + ' -> ' + cts + ' cts -> ' + relu);
  }
});
