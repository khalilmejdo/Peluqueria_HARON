/**
 * Le calcul de la file.
 *
 * calculerPositions est le coeur du metier et une fonction PURE : elle ne
 * connait ni la base, ni l'heure, ni le reseau. Tout ce que voit un client —
 * sa position, le nombre de personnes devant lui, son estimation, sa phase —
 * sort d'ici, et peut donc etre verifie ligne a ligne.
 */
import './amorce.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { calculerPositions, messageDePhase } from '../../server/domain/file.js';
import { numeroAffiche, STATUTS_ACTIFS } from '../../server/domain/journee.js';

const REGLAGES = { dureeMoyenneMinutes: 20, seuilPrevenir: 2 };

/** Fabrique un ticket minimal pour le calcul. */
const t = (id, rang, statut = 'WAITING') => ({ id, rang, statut });

test('la position suit le rang, et rien d autre', () => {
  // Volontairement dans le desordre, et avec des rangs non contigus : c'est
  // exactement ce que produit une file ou des gens ont ete servis et d'autres
  // replaces en fin de file.
  const tickets = [t('c', 30), t('a', 3), t('b', 11)];
  const positions = calculerPositions(tickets, REGLAGES);

  assert.equal(positions.get('a').position, 1);
  assert.equal(positions.get('b').position, 2);
  assert.equal(positions.get('c').position, 3);
});

test('l origine du client n influence jamais l ordre', () => {
  const tickets = [
    { id: 'enligne', rang: 1, statut: 'WAITING', source: 'ONLINE' },
    { id: 'qr', rang: 2, statut: 'WAITING', source: 'QR' },
    { id: 'comptoir', rang: 3, statut: 'WAITING', source: 'COMPTOIR' },
  ];
  const positions = calculerPositions(tickets, REGLAGES);
  assert.equal(positions.get('enligne').position, 1);
  assert.equal(positions.get('qr').position, 2);
  assert.equal(positions.get('comptoir').position, 3);
});

test('le client au fauteuil compte comme une personne devant', () => {
  const tickets = [t('fauteuil', 1, 'IN_SERVICE'), t('premier', 2), t('second', 3)];
  const positions = calculerPositions(tickets, REGLAGES);

  assert.equal(positions.get('fauteuil').devant, 0);
  assert.equal(positions.get('premier').devant, 1);
  assert.equal(positions.get('second').devant, 2);
  assert.equal(positions.get('premier').estimationMinutes, 20);
  assert.equal(positions.get('second').estimationMinutes, 40);
});

test('l exemple de la commande : trois personnes devant, environ soixante minutes', () => {
  const tickets = [t('a', 1), t('b', 2), t('c', 3), t('moi', 4)];
  const positions = calculerPositions(tickets, REGLAGES);
  assert.equal(positions.get('moi').devant, 3);
  assert.equal(positions.get('moi').estimationMinutes, 60);
});

test('les phases se succedent dans le bon ordre', () => {
  const tickets = [t('a', 1), t('b', 2), t('c', 3), t('d', 4), t('e', 5)];
  const positions = calculerPositions(tickets, REGLAGES);

  assert.equal(positions.get('a').phase, 'PROCHAIN');   // 0 devant
  assert.equal(positions.get('b').phase, 'APPROCHE');   // 1 devant, seuil 2
  assert.equal(positions.get('c').phase, 'APPROCHE');   // 2 devant, seuil 2
  assert.equal(positions.get('d').phase, 'ATTENTE');    // 3 devant
  assert.equal(positions.get('e').phase, 'ATTENTE');
});

test('l appel et le service ont leur propre phase, quel que soit le rang', () => {
  const tickets = [t('appele', 1, 'CALLED'), t('suivant', 2)];
  const positions = calculerPositions(tickets, REGLAGES);
  assert.equal(positions.get('appele').phase, 'VOTRE_TOUR');
  assert.equal(positions.get('suivant').phase, 'APPROCHE');

  const enCours = calculerPositions([t('x', 1, 'IN_SERVICE')], REGLAGES);
  assert.equal(enCours.get('x').phase, 'EN_COURS');
});

test('un client deja absent reste dans la file, a sa nouvelle place', () => {
  // Ahmed (rang 1) a ete absent : il repart au rang 5, derriere tout le monde.
  const tickets = [t('youssef', 2), t('karim', 3), t('mehdi', 4), t('ahmed', 5, 'LATE')];
  const positions = calculerPositions(tickets, REGLAGES);

  assert.equal(positions.get('youssef').position, 1);
  assert.equal(positions.get('ahmed').position, 4);
  assert.equal(positions.get('ahmed').devant, 3);
  // LATE est un statut d'attente : il ne sort pas le client de la file.
  assert.ok(STATUTS_ACTIFS.includes('LATE'));
});

test('les tickets termines et annules sortent du calcul mais gardent une phase', () => {
  const tickets = [t('servi', 1, 'COMPLETED'), t('annule', 2, 'CANCELLED'), t('attend', 3)];
  const positions = calculerPositions(tickets, REGLAGES);

  assert.equal(positions.get('servi').phase, 'TERMINE');
  assert.equal(positions.get('servi').position, 0);
  assert.equal(positions.get('annule').phase, 'ANNULE');
  // Celui qui attend est bien premier : les termines ne comptent pas devant lui.
  assert.equal(positions.get('attend').position, 1);
  assert.equal(positions.get('attend').devant, 0);
});

test('une file vide ne produit aucune position', () => {
  assert.equal(calculerPositions([], REGLAGES).size, 0);
});

test('un seuil a zero ne previent qu au moment d etre le prochain', () => {
  const tickets = [t('a', 1), t('b', 2)];
  const positions = calculerPositions(tickets, { dureeMoyenneMinutes: 20, seuilPrevenir: 0 });
  assert.equal(positions.get('a').phase, 'PROCHAIN');
  assert.equal(positions.get('b').phase, 'ATTENTE');
});

test('la duree moyenne du salon change l estimation, pas l ordre', () => {
  const tickets = [t('a', 1), t('b', 2), t('c', 3)];
  const rapide = calculerPositions(tickets, { dureeMoyenneMinutes: 10, seuilPrevenir: 2 });
  const lent = calculerPositions(tickets, { dureeMoyenneMinutes: 45, seuilPrevenir: 2 });

  assert.equal(rapide.get('c').estimationMinutes, 20);
  assert.equal(lent.get('c').estimationMinutes, 90);
  assert.equal(rapide.get('c').position, lent.get('c').position);
});

test('chaque phase dit au client quoi faire', () => {
  const tour = messageDePhase('VOTRE_TOUR', { nomSalon: 'HARON' });
  assert.match(tour.titre, /votre tour/i);
  assert.equal(tour.ton, 'tour');

  const approche = messageDePhase('APPROCHE', { devant: 2 });
  assert.match(approche.detail, /2 personnes/);
  assert.equal(approche.ton, 'proche');

  // L'accord en nombre : « 1 personne », pas « 1 personnes ».
  assert.match(messageDePhase('APPROCHE', { devant: 1 }).detail, /1 personne devant/);

  assert.equal(messageDePhase('PROCHAIN').ton, 'proche');
  assert.equal(messageDePhase('ATTENTE', { estimationMinutes: 40 }).ton, 'attente');
  assert.equal(messageDePhase('TERMINE').ton, 'fini');
  assert.equal(messageDePhase('ANNULE').ton, 'fini');
});

test('le numero affiche est toujours sur trois chiffres au moins', () => {
  assert.equal(numeroAffiche(1), 'A001');
  assert.equal(numeroAffiche(24), 'A024');
  assert.equal(numeroAffiche(999), 'A999');
  // Au-dela du millier, on ne tronque pas : le numero reste juste.
  assert.equal(numeroAffiche(1042), 'A1042');
});
