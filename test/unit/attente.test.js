/**
 * L'attente annoncee, quand les prestations ont des durees.
 *
 * C'est le chiffre le plus consulte de l'application, et le seul que le client
 * peut verifier montre en main. Une file de six barbes et une file de six
 * queratinas ne durent pas la meme chose : avant, elles annoncaient pourtant la
 * meme attente, et la seconde mentait d'une heure et demie.
 *
 * LE TEST QUI COMPTE EST LE PREMIER : a durees egales, la nouvelle simulation
 * doit rendre EXACTEMENT ce que rendait la multiplication d'avant. Sans cette
 * garantie, tous les salons qui n'ont pas saisi leurs durees verraient leur
 * attente changer sans que personne ait rien demande.
 */
import './amorce.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import { calculerPositions, MODE_PAR_FAUTEUIL } from '../../server/domain/file.js';

const t = (rang, duree, extra = {}) => ({
  id: 't' + rang, rang, statut: 'WAITING', duree_min: duree,
  poste_choisi_id: null, poste_id: null, service_at: null, ...extra,
});

const REGLAGES = { dureeMoyenneMinutes: 20, seuilPrevenir: 2, instant: 0 };
const estimation = (positions, id) => positions.get(id).estimationMinutes;

test('a durees egales, la simulation rend ce que rendait la multiplication', () => {
  // Six clients, deux fauteuils, vingt minutes chacun : 0, 0, 20, 20, 40, 40.
  const tickets = [1, 2, 3, 4, 5, 6].map((r) => t(r, 20));
  const p = calculerPositions(tickets, { ...REGLAGES, postesActifs: 2 });
  assert.deepEqual([1, 2, 3, 4, 5, 6].map((r) => estimation(p, 't' + r)), [0, 0, 20, 20, 40, 40]);
});

test('une duree absente retombe sur la moyenne du salon', () => {
  const tickets = [t(1, null), t(2, null), t(3, null)];
  const p = calculerPositions(tickets, { ...REGLAGES, postesActifs: 1 });
  assert.deepEqual([1, 2, 3].map((r) => estimation(p, 't' + r)), [0, 20, 40]);
});

/*
 * Le cas qui motivait tout : des durees tres inegales. Avec un seul fauteuil,
 * l'attente de chacun est la somme de ce qui le precede -- pas son rang fois
 * une moyenne.
 */
test('les durees reelles s additionnent, elles ne se moyennent pas', () => {
  const tickets = [t(1, 30), t(2, 5), t(3, 25)]; // queratina, peinado, mechas
  const p = calculerPositions(tickets, { ...REGLAGES, postesActifs: 1 });
  assert.equal(estimation(p, 't1'), 0);
  assert.equal(estimation(p, 't2'), 30);
  assert.equal(estimation(p, 't3'), 35);
});

/*
 * Deux fauteuils, durees inegales : le client suivant prend le fauteuil qui se
 * libere LE PREMIER, pas celui de son rang. C'est ce que fait un salon, et
 * c'est ce qui distingue une simulation d'une division.
 */
test('chacun prend le fauteuil qui se libere le premier', () => {
  const tickets = [t(1, 30), t(2, 5), t(3, 5), t(4, 5)];
  const p = calculerPositions(tickets, { ...REGLAGES, postesActifs: 2 });
  assert.equal(estimation(p, 't1'), 0, 'premier fauteuil, tout de suite');
  assert.equal(estimation(p, 't2'), 0, 'second fauteuil, tout de suite');
  // Le second fauteuil se libere a 5, le premier seulement a 30.
  assert.equal(estimation(p, 't3'), 5);
  assert.equal(estimation(p, 't4'), 10);
});

/*
 * Quelqu'un a vingt minutes d'une coupe de vingt-cinq ne fait plus attendre
 * vingt-cinq minutes la salle entiere. Sans ca, l'attente annoncee ne descend
 * jamais tant que le fauteuil n'est pas libere, et le client voit un chiffre
 * fige qui lui fait croire que rien n'avance.
 */
test('le temps deja passe au fauteuil est deduit', () => {
  const maintenant = Date.parse('2026-09-24T12:00:00Z');
  const debut = new Date(maintenant - 20 * 60000).toISOString();
  const tickets = [
    t(1, 25, { statut: 'IN_SERVICE', service_at: debut }),
    t(2, 10),
  ];
  const p = calculerPositions(tickets, {
    ...REGLAGES, postesActifs: 1, instant: maintenant,
  });
  assert.equal(estimation(p, 't2'), 5, 'il reste cinq minutes, pas vingt-cinq');
});

test('un fauteuil occupe compte toujours pour au moins une minute', () => {
  const maintenant = Date.parse('2026-09-24T12:00:00Z');
  // Une coupe de 10 min commencee il y a une heure : le client est encore la.
  const debut = new Date(maintenant - 60 * 60000).toISOString();
  const tickets = [
    t(1, 10, { statut: 'IN_SERVICE', service_at: debut }),
    t(2, 10),
  ];
  const p = calculerPositions(tickets, { ...REGLAGES, postesActifs: 1, instant: maintenant });
  assert.equal(estimation(p, 't2'), 1, 'un fauteuil occupe n est pas un fauteuil libre');
});

/*
 * En file par coiffeur, chaque couloir a SON fauteuil : la longue prestation de
 * l'un ne doit rien ajouter a l'attente annoncee chez l'autre.
 */
test('en file par coiffeur, les durees ne debordent pas d un couloir a l autre', () => {
  const tickets = [
    t(1, 40, { poste_choisi_id: 'A' }),
    t(2, 10, { poste_choisi_id: 'B' }),
    t(3, 10, { poste_choisi_id: 'B' }),
  ];
  const p = calculerPositions(tickets, {
    ...REGLAGES, postesActifs: 2, mode: MODE_PAR_FAUTEUIL,
  });
  assert.equal(estimation(p, 't2'), 0);
  assert.equal(estimation(p, 't3'), 10, 'la queratina de l autre coiffeur ne compte pas');
});

/*
 * Le seuil « prevenir a N personnes » se regle en PERSONNES. Le traduire en
 * minutes changerait le sens d'un reglage deja pose par le gerant.
 */
test('les tours restent comptes en personnes, pas en minutes', () => {
  const tickets = [t(1, 60), t(2, 1), t(3, 1)];
  const p = calculerPositions(tickets, { ...REGLAGES, postesActifs: 1 });
  assert.equal(p.get('t2').tours, 1);
  assert.equal(p.get('t3').tours, 2);
});
