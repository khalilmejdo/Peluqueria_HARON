/**
 * Les scenes dessinees de la vitrine.
 *
 * Elles tiennent la place des photos tant que le gerant n'en a depose aucune.
 * Trois choses doivent rester vraies, et aucune ne se verrait a l'oeil nu si
 * elle cassait :
 *
 *   - le SVG produit doit etre du SVG valide et clos ; un dessin mal ferme
 *     avale la fin de la page dans certains navigateurs ;
 *   - rien ne doit sortir du dessin vers le DOM : pas de <script>, pas de
 *     gestionnaire d'evenement, pas d'identifiant en double ;
 *   - la liste doit etre une COPIE. Elle est rendue a chaque page ; un
 *     appelant qui la trierait ou la couperait la casserait pour tout le monde
 *     jusqu'au redemarrage.
 */
import './amorce.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import { scenesDuSalon, emblemeRond } from '../../server/site/illustrations.js';

test('les trois scenes ont un titre et un dessin', () => {
  const scenes = scenesDuSalon();
  assert.equal(scenes.length, 3);
  for (const s of scenes) {
    assert.ok(s.legende.length > 0, 'legende vide');
    assert.ok(s.dessin.startsWith('<svg'), 'le dessin n est pas un SVG');
    assert.ok(s.dessin.endsWith('</svg>'), 'le SVG n est pas clos');
  }
  assert.deepEqual(scenes.map((s) => s.legende), ['Nuestro salón', 'El sillón', 'La entrada']);
});

test('chaque balise ouverte est refermee', () => {
  for (const s of scenesDuSalon()) {
    const ouverts = (s.dessin.match(/<g\b/g) || []).length;
    const fermes = (s.dessin.match(/<\/g>/g) || []).length;
    assert.equal(ouverts, fermes, 'des groupes non fermes dans « ' + s.legende + ' »');
  }
});

test('un dessin ne transporte ni script ni gestionnaire d evenement', () => {
  for (const s of scenesDuSalon()) {
    assert.ok(!/<script/i.test(s.dessin), 'script dans « ' + s.legende + ' »');
    assert.ok(!/\son[a-z]+\s*=/i.test(s.dessin), 'gestionnaire dans « ' + s.legende + ' »');
    assert.ok(!/javascript:/i.test(s.dessin), 'URL javascript dans « ' + s.legende + ' »');
  }
});

/*
 * Un identifiant en double ferait pointer deux elements sur la meme definition.
 * C'est exactement le defaut qui a mis le texte du medaillon la tete en bas :
 * il ne se voit qu'a l'ecran, jamais dans un test de contenu.
 */
test('aucun identifiant n est utilise deux fois dans la page', () => {
  const tout = scenesDuSalon().map((s) => s.dessin).join('') + emblemeRond();
  const ids = tout.match(/\sid="([^"]+)"/g) || [];
  assert.equal(new Set(ids).size, ids.length, 'identifiant en double');
});

test('la liste rendue est une copie : la vider ne vide pas la suivante', () => {
  const premiere = scenesDuSalon();
  premiere.length = 0;
  premiere.push({ legende: 'faux', dessin: '' });
  assert.equal(scenesDuSalon().length, 3);
});
