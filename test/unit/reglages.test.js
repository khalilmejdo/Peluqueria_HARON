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

import {
  normaliserCoordonnees, versTexte, CATALOGUE, plagesDuJour, estOuvert, horairesLisibles,
} from '../../server/core/reglages.js';
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

/* ------------------------------------------------------------------ */
/*  La journee coupee                                                  */
/* ------------------------------------------------------------------ */

/*
 * Beaucoup de salons ferment au milieu de la journee. Sans coupure, il fallait
 * choisir entre deux mensonges : annoncer « 10:00 – 20:30 » et faire venir un
 * client a quinze heures devant un rideau baisse, ou n'annoncer que l'apres-midi
 * et perdre toutes les prises de tour du matin.
 */
const JOURNEE_COUPEE = {
  'horaires.actifs': true,
  'horaires.3.ouverture': '10:00',
  'horaires.3.fermeture': '20:30',
  'horaires.3.pauseDebut': '14:00',
  'horaires.3.pauseFin': '17:00',
};

const h = (heures, minutes = 0) => heures * 60 + minutes;

test('une journee sans coupure ne fait qu une plage', () => {
  assert.deepEqual(
    plagesDuJour({ 'horaires.3.ouverture': '09:30', 'horaires.3.fermeture': '20:00' }, 3),
    [{ ouverture: '09:30', fermeture: '20:00' }],
  );
});

test('une journee coupee en fait deux, dans l ordre', () => {
  assert.deepEqual(plagesDuJour(JOURNEE_COUPEE, 3), [
    { ouverture: '10:00', fermeture: '14:00' },
    { ouverture: '17:00', fermeture: '20:30' },
  ]);
});

test('un jour ferme n a aucune plage', () => {
  assert.deepEqual(plagesDuJour({ 'horaires.0.ouverture': '', 'horaires.0.fermeture': '' }, 0), []);
});

/*
 * Une coupure douteuse arrivee en base malgre la validation ne doit PAS fermer
 * le salon : mieux vaut ouvert trop longtemps qu'injoignable toute la journee
 * sans que rien ne l'explique.
 */
test('une coupure incoherente est ignoree, elle ne ferme pas le salon', () => {
  const debordante = { ...JOURNEE_COUPEE, 'horaires.3.pauseFin': '23:00' };
  assert.deepEqual(plagesDuJour(debordante, 3), [{ ouverture: '10:00', fermeture: '20:30' }]);

  const alEnvers = { ...JOURNEE_COUPEE, 'horaires.3.pauseDebut': '18:00', 'horaires.3.pauseFin': '15:00' };
  assert.deepEqual(plagesDuJour(alEnvers, 3), [{ ouverture: '10:00', fermeture: '20:30' }]);

  const aMoitie = { ...JOURNEE_COUPEE, 'horaires.3.pauseFin': '' };
  assert.deepEqual(plagesDuJour(aMoitie, 3), [{ ouverture: '10:00', fermeture: '20:30' }]);
});

test('le salon ferme bien pendant la coupure, et rouvre apres', () => {
  assert.equal(estOuvert(JOURNEE_COUPEE, 3, h(9, 59)).ouvert, false);
  assert.equal(estOuvert(JOURNEE_COUPEE, 3, h(10)).ouvert, true);
  assert.equal(estOuvert(JOURNEE_COUPEE, 3, h(13, 59)).ouvert, true);
  assert.equal(estOuvert(JOURNEE_COUPEE, 3, h(14)).ouvert, false, 'l heure de coupure est exclue');
  assert.equal(estOuvert(JOURNEE_COUPEE, 3, h(16, 59)).ouvert, false);
  assert.equal(estOuvert(JOURNEE_COUPEE, 3, h(17)).ouvert, true);
  assert.equal(estOuvert(JOURNEE_COUPEE, 3, h(20, 29)).ouvert, true);
  assert.equal(estOuvert(JOURNEE_COUPEE, 3, h(20, 30)).ouvert, false);
});

/*
 * C'est L'HEURE ANNONCEE qui compte. « Abrimos a las 10:00 » dit a quinze
 * heures ferait croire au client qu'il a manque l'ouverture — et il ne
 * reviendrait pas.
 */
test('a midi on annonce la REPRISE, pas l ouverture du matin', () => {
  const pendant = estOuvert(JOURNEE_COUPEE, 3, h(15));
  assert.equal(pendant.ouvert, false);
  assert.equal(pendant.ouverture, '17:00');
  assert.equal(pendant.enPause, true);

  const avant = estOuvert(JOURNEE_COUPEE, 3, h(8));
  assert.equal(avant.ouverture, '10:00');
  assert.equal(avant.enPause, false, 'avant la premiere ouverture, ce n est pas une pause');

  const apres = estOuvert(JOURNEE_COUPEE, 3, h(21));
  assert.equal(apres.ouverture, null, 'la journee est finie : on n annonce pas l heure de ce matin');
  assert.equal(apres.enPause, false);
});

test('le controle des horaires desactive laisse tout ouvert', () => {
  const sansControle = { ...JOURNEE_COUPEE, 'horaires.actifs': false };
  assert.equal(estOuvert(sansControle, 3, h(15)).ouvert, true);
});

test('l affichage porte les deux plages', () => {
  const lignes = horairesLisibles(JOURNEE_COUPEE);
  const mercredi = lignes.find((l) => l.jour === 3);
  assert.equal(mercredi.ferme, false);
  assert.equal(mercredi.plages.length, 2);
  // L'amplitude reste juste pour ce qui ne sait afficher qu'une paire.
  assert.equal(mercredi.ouverture, '10:00');
  assert.equal(mercredi.fermeture, '20:30');
  assert.equal(lignes[0].jour, 1, 'la semaine commence le lundi');
});
