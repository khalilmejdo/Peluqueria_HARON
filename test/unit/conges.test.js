/**
 * L'annonce des conges sur la vitrine.
 *
 * TOUT SE JOUE SUR LA DATE DE REOUVERTURE. « Cerrado » sans « volvemos el… »
 * laisse le client devant une porte close sans savoir quand revenir : il
 * telephone, ou il ne revient pas. Ces tests verifient donc surtout ce qui est
 * DIT, pas la mise en forme.
 *
 * Le ton monte a mesure que la fermeture approche. Un avertissement toujours
 * criard finit par ne plus rien dire, et un avertissement toujours discret n'a
 * jamais rien dit.
 */
import './amorce.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import { _bandeauFermeture as bandeau } from '../../server/site/index.js';

const AUJOURDHUI = '2026-09-24';
const texteDe = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

test('pendant les conges, l alerte dit le jour de la REOUVERTURE', () => {
  const html = bandeau({
    ouverte: false,
    code: 'SALON_EN_CONGES',
    fermeture: { du: '2026-09-20', au: '2026-09-28', motif: 'Vacaciones' },
    prochaineFermeture: null,
  }, AUJOURDHUI);

  assert.match(html, /alerte-conges--maintenant/);
  // Le 28 est le dernier jour ferme : on rouvre le 29, pas le 28.
  assert.match(texteDe(html), /29 de septiembre/);
  assert.match(texteDe(html), /Vacaciones/);
});

test('une fermeture proche passe en alerte, une lointaine reste une note', () => {
  const proche = bandeau({ ouverte: true, prochaineFermeture: { du: '2026-09-27', au: '2026-10-05', motif: null } }, AUJOURDHUI);
  assert.match(proche, /alerte-conges--proche/);
  assert.match(texteDe(proche), /dentro de 3 días/);

  const loin = bandeau({ ouverte: true, prochaineFermeture: { du: '2026-10-15', au: '2026-10-20', motif: null } }, AUJOURDHUI);
  assert.match(loin, /alerte-conges--loin/);
  assert.match(texteDe(loin), /Próximo cierre/);
});

test('« hoy » et « mañana » plutot qu un compte de jours', () => {
  const demain = bandeau({ ouverte: true, prochaineFermeture: { du: '2026-09-25', au: '2026-09-26', motif: null } }, AUJOURDHUI);
  assert.match(texteDe(demain), /Cerramos mañana/);

  const aujourdhui = bandeau({ ouverte: true, prochaineFermeture: { du: AUJOURDHUI, au: '2026-09-26', motif: null } }, AUJOURDHUI);
  assert.match(texteDe(aujourdhui), /Cerramos hoy/);
});

/*
 * Le titre lointain ne repete pas la date : elle est juste dessous, en entier.
 * « Cerramos del jueves 15 » suivi de « Del jueves 15 al… » se lit deux fois et
 * ne dit rien de plus.
 */
test('le titre ne repete pas ce que la ligne suivante dit deja', () => {
  const loin = texteDe(bandeau({ ouverte: true, prochaineFermeture: { du: '2026-10-15', au: '2026-10-20', motif: null } }, AUJOURDHUI));
  assert.equal((loin.match(/15 de octubre/g) || []).length, 1);
});

test('sans fermeture, aucun bandeau', () => {
  assert.equal(bandeau({ ouverte: true, prochaineFermeture: null }, AUJOURDHUI), '');
  // Fermeture pour une autre raison (tours suspendus) : ce bandeau-ci se tait,
  // le message est deja dans le hero.
  assert.equal(bandeau({ ouverte: false, code: 'PRISE_DE_TOUR_SUSPENDUE', prochaineFermeture: null }, AUJOURDHUI), '');
});

/*
 * Une fermeture qui chevauche le changement d'heure. Le calcul passe par UTC
 * exprès : en heure locale, « le lendemain » saute un jour deux fois par an, et
 * ce defaut n'apparaitrait qu'en octobre, sur le site en production.
 */
test('le lendemain reste juste au changement d heure', () => {
  const html = bandeau({
    ouverte: false,
    code: 'SALON_EN_CONGES',
    fermeture: { du: '2026-10-20', au: '2026-10-25', motif: null },
    prochaineFermeture: null,
  }, '2026-10-24');
  assert.match(texteDe(html), /26 de octubre/);
});

test('un motif contenant du HTML reste du texte', () => {
  const html = bandeau({
    ouverte: true,
    prochaineFermeture: { du: '2026-09-27', au: '2026-09-28', motif: '<script>alert(1)</script>' },
  }, AUJOURDHUI);
  assert.ok(!html.includes('<script>'), 'le motif est injecté tel quel');
  assert.match(html, /&lt;script&gt;/);
});
