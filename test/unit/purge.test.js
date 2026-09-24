/**
 * Effacer l'historique : ce qui part, ce qui reste.
 *
 * On ne teste pas ici la suppression elle-meme — elle demande une base, et
 * c'est l'affaire des tests d'integration. On verrouille la LISTE, parce que
 * c'est elle qui se deforme avec le temps : une table ajoutee au schema un
 * matin, oubliee ici le soir, et la purge laisse derriere elle des lignes que
 * personne ne pense a regarder — ou pire, emporte ce qu'elle devait garder.
 */
import './amorce.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { PRESERVE } from '../../server/domain/purge.js';

const SOURCE = fs.readFileSync(path.join(process.cwd(), 'server/domain/purge.js'), 'utf8');
const SCHEMA = fs.readFileSync(path.join(process.cwd(), 'server/db/schema.sql'), 'utf8');

const effacees = () => (SOURCE.match(/const TABLES = \[([^\]]+)\]/) || [, ''])[1]
  .split(',').map((s) => s.trim().replace(/'/g, '')).filter(Boolean);

test('les comptes du personnel ne sont JAMAIS effaces', () => {
  assert.ok(!effacees().includes('utilisateurs'), 'la purge emporte les comptes');
  assert.ok(PRESERVE.includes('utilisateurs'));
});

test('la configuration du salon survit a la purge', () => {
  for (const table of ['reglages', 'postes', 'tarifas']) {
    assert.ok(!effacees().includes(table), table + ' est effacee');
    assert.ok(PRESERVE.includes(table), table + ' manque a la liste montree au gerant');
  }
});

test('l historique des tours part en entier', () => {
  for (const table of ['tickets', 'ticket_evenements', 'envois_whatsapp', 'journees']) {
    assert.ok(effacees().includes(table), table + ' survivrait a la purge');
  }
});

/*
 * Les enfants avant les parents. Dans l'autre sens, une cle etrangere refuse la
 * suppression et la purge echoue au milieu -- en transaction, donc sans degat,
 * mais sans resultat non plus, et le message d'erreur de PostgreSQL n'aide
 * personne.
 */
test('les tables sont effacees dans un ordre qui respecte les cles etrangeres', () => {
  const ordre = effacees();
  assert.ok(ordre.indexOf('ticket_evenements') < ordre.indexOf('tickets'));
  assert.ok(ordre.indexOf('envois_whatsapp') < ordre.indexOf('tickets'));
  assert.ok(ordre.indexOf('tickets') < ordre.indexOf('journees'));
});

/*
 * LE TEST QUI SERVIRA DANS SIX MOIS. Toute table du schema doit etre d'un cote
 * ou de l'autre : effacee, ou explicitement preservee. Une table nouvelle fait
 * echouer ce test tant que quelqu'un n'a pas TRANCHE son sort -- ce qui est
 * exactement le moment ou l'on sait encore ce qu'elle contient.
 */
test('aucune table du schema n est laissee sans decision', () => {
  const duSchema = [...SCHEMA.matchAll(/CREATE TABLE IF NOT EXISTS (\w+)/g)].map((m) => m[1]);
  const connues = new Set([...effacees(), ...PRESERVE, 'app_meta', 'sessions']);
  const oubliees = duSchema.filter((t) => !connues.has(t));
  assert.deepEqual(oubliees, [], 'tables sans décision : ' + oubliees.join(', '));
});
