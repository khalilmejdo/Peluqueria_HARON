/**
 * npm run nouveau-salon : le .env d'un nouveau salon, ecrit d'un coup.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { valeursDuSalon, composerEnv, PAYS } from '../../scripts/nouveau-salon.js';

const salon = { nom: 'Ongles de Samira', domaine: 'https://Samira.duckdns.org/', activite: 'ongles', pays: 'ma', courriel: 'k@exemple.com' };

test('le pays decide la langue, la monnaie, l heure et l indicatif', () => {
  const v = valeursDuSalon(salon);
  assert.deepEqual(
    [v.APP_LANGUE, v.APP_MONNAIE, v.APP_TIMEZONE, v.TELEPHONE_INDICATIF_DEFAUT, v.APP_ACTIVITE, v.DOMAINE, v.PUBLIC_URL],
    ['fr', 'MAD', 'Africa/Casablanca', '212', 'ONGLES', 'samira.duckdns.org', 'https://samira.duckdns.org'],
  );
  assert.equal(valeursDuSalon({ ...salon, pays: 'ES' }).APP_TIMEZONE, PAYS.ES.fuseau);
});

test('chaque salon recoit des secrets neufs, jamais ceux d un autre', () => {
  const a = valeursDuSalon(salon);
  const b = valeursDuSalon(salon);
  for (const cle of ['APP_SECRET', 'APP_ENCRYPTION_KEY', 'APP_PASSWORD_PEPPER', 'POSTGRES_PASSWORD', 'BOOTSTRAP_ADMIN_PASSWORD']) {
    assert.notEqual(a[cle], b[cle], cle);
  }
  assert.match(a.APP_ENCRYPTION_KEY, /^[0-9a-f]{64}$/);
  assert.ok(new Set([a.APP_SECRET, a.APP_ENCRYPTION_KEY, a.APP_PASSWORD_PEPPER]).size === 3, 'trois cles differentes');
});

test('une saisie bancale est refusee, avec tous les motifs a la fois', () => {
  assert.throws(() => valeursDuSalon({ nom: '', domaine: 'pas un domaine', activite: 'COIFFURE', pays: 'BE', courriel: 'x' }), (err) => {
    for (const champ of ['--nom', '--domaine', '--activite', '--pays', '--courriel']) assert.ok(err.message.includes(champ), champ);
    return true;
  });
  assert.throws(() => valeursDuSalon({ ...salon, nom: 'A\nAPP_SECRET=volee' }), /--nom/, 'pas d injection de ligne dans le .env');
});

test('le .env garde les commentaires du modele et remplace les valeurs', () => {
  const modele = fs.readFileSync(new URL('../../.env.example', import.meta.url), 'utf8');
  const v = valeursDuSalon(salon, (n) => Buffer.alloc(n, 7));
  const env = composerEnv(modele, v);
  const lire = (cle) => (new RegExp('^' + cle + '=(.*)$', 'm').exec(env) || [])[1];
  assert.equal(lire('APP_ACTIVITE'), 'ONGLES');
  assert.equal(lire('APP_SALON_NOM'), '"Ongles de Samira"', 'un nom a espaces est entre guillemets');
  assert.equal(lire('APP_SECRET'), '07'.repeat(32));
  assert.equal(lire('DOMAINE'), 'samira.duckdns.org');
  assert.ok(env.includes('# Fuseau du salon.'), 'les commentaires restent');
  // Chaque cle n'apparait qu'une fois.
  for (const cle of Object.keys(v)) assert.equal(env.split('\n').filter((l) => l.startsWith(cle + '=')).length, 1, cle);
  // Plus aucune valeur de HARON.
  assert.ok(!/^DOMAINE=file\.peluqueria-haron\.com$/m.test(env));
});
