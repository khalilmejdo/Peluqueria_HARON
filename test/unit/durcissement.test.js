/**
 * DURCISSEMENT AVANT MISE EN PRODUCTION (campagne du 4 octobre 2026).
 *
 * Chaque test ici fige un defaut trouve en attaquant l'application, et qui
 * etait reel : on le reproduisait avant de le corriger.
 */
import './amorce.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import { sansBarresFinales } from '../../server/core/text.js';
import { cleDeDebit } from '../../server/http/security.js';
import { masquerJetons, _redact } from '../../server/core/logger.js';
import { consume, peek, resetAll, suiviBloque, noterEchecSuivi, consommerJeton, consommerPriseDeTour, PROFILES } from '../../server/core/ratelimit.js';
import { exigerEndpoint } from '../../server/routes/avisos.js';
import { rules, validate } from '../../server/core/validate.js';

test('les « / » finaux s otent en temps lineaire (plus de ReDoS)', () => {
  assert.equal(sansBarresFinales('/a/b///'), '/a/b');
  assert.equal(sansBarresFinales('////'), '');
  assert.equal(sansBarresFinales('/a'), '/a');
  // L'ancienne expression mettait 240 ms sur 16 000 barres suivies d'un
  // caractere ; 200 000 doivent passer en un clin d'oeil.
  const piege = '/a' + '/'.repeat(200000) + 'x';
  const t0 = performance.now();
  sansBarresFinales(piege);
  assert.ok(performance.now() - t0 < 50, 'trop lent : ReDoS de retour ?');
});

test('une adresse « url » faite de barres est refusee vite', () => {
  const t0 = performance.now();
  assert.throws(() => validate({ u: 'https://a' + '/'.repeat(200000) + 'x' }, { u: { type: 'url' } }));
  assert.ok(performance.now() - t0 < 50);
  assert.equal(validate({ u: 'https://salon.es///' }, { u: { type: 'url' } }).u, 'https://salon.es');
  assert.ok(rules);
});

test('le debit se compte par /64 en IPv6, par adresse en IPv4', () => {
  assert.equal(cleDeDebit('203.0.113.7'), '203.0.113.7');
  assert.equal(cleDeDebit('::ffff:10.0.0.1'), '10.0.0.1');
  const a = cleDeDebit('2a01:e0a:1f2:3b40:1234:5678:9abc:def0');
  assert.equal(a, '2a01:e0a:1f2:3b40::/64');
  // Toutes les adresses d'un meme /64 partagent la cle, quelle que soit l'ecriture.
  assert.equal(cleDeDebit('2a01:e0a:1f2:3b40::1'), a);
  assert.equal(cleDeDebit('2A01:0E0A:01F2:3B40:ffff::'), a);
  assert.notEqual(cleDeDebit('2a01:e0a:1f2:3b41::1'), a);
});

test('le jeton de suivi ne sort jamais dans un journal, ou qu il soit', () => {
  const jeton = 'y1evp68TAFzSMN_c338iSy4ikamEI5Jc';
  assert.equal(masquerJetons('/ticket/' + jeton), '/ticket/[jeton]');
  assert.equal(masquerJetons('/api/public/tickets/' + jeton + '/flux'), '/api/public/tickets/[jeton]/flux');
  const ligne = JSON.stringify(_redact({ path: '/ticket/' + jeton, detail: ['GET /api/public/tickets/' + jeton] }));
  assert.ok(!ligne.includes(jeton), ligne);
  // Un identifiant de ticket du personnel (uuid) n'est pas un secret, mais ne
  // doit pas casser le journal non plus.
  assert.match(masquerJetons('/api/file/abc'), /\/api\/file\/abc/);
});

test('le suivi : les ECHECS se paient par adresse, le volume par jeton', () => {
  resetAll();
  const ip = '198.51.100.9';
  // Toute une salle d'attente derriere le meme wifi : cinquante jetons valides,
  // trois ouvertures de flux chacun. Personne n'est refuse.
  for (let j = 0; j < 50; j += 1) {
    for (let k = 0; k < 3; k += 1) {
      assert.ok(suiviBloque(ip).allowed);
      assert.ok(consommerJeton('jeton-' + j, PROFILES.flux).allowed);
    }
  }
  // Un robot qui essaie des jetons au hasard est arrete apres trente echecs.
  for (let i = 0; i < PROFILES.suiviEchecs.max; i += 1) noterEchecSuivi(ip);
  assert.ok(suiviBloque(ip).allowed, 'trente echecs : encore admis');
  noterEchecSuivi(ip);
  assert.equal(suiviBloque(ip).allowed, false);
  // Le voisin, lui, n'est pas touche.
  assert.ok(suiviBloque('198.51.100.10').allowed);
  resetAll();
});

test('une adresse deja refusee ne cree plus de compteur par numero', () => {
  resetAll();
  const ip = '198.51.100.20';
  for (let i = 0; i < PROFILES.priseDeTourIp.max; i += 1) consommerPriseDeTour({ ip, telephone: '+3460000' + String(i).padStart(4, '0') });
  // Au-dela : refuse par l'adresse, et le numero essaye n'est pas compte.
  const r = consommerPriseDeTour({ ip, telephone: '+34699999999' });
  assert.equal(r.allowed, false);
  assert.equal(r.portee, 'IP');
  assert.equal(peek('tour:tel:34699999999', PROFILES.priseDeTourNumero).remaining, PROFILES.priseDeTourNumero.max);
  resetAll();
});

test('une table de debit pleine ne remet PAS tous les compteurs a zero', () => {
  resetAll();
  const profil = { max: 1, windowMs: 3600000 };
  // Un compteur de connexion recent, epuise.
  consume('route:POST:/api/auth/login:203.0.113.50', profil);
  // L'attaquant remplit la table.
  for (let i = 0; i < 50000; i += 1) consume('remplissage:' + i, profil);
  // Les plus anciens partent, pas tout : un compteur pose PEU AVANT le
  // debordement est toujours la (l'ancien code les effacait tous d'un coup).
  assert.equal(peek('remplissage:49000', profil).remaining, 0, 'compteur recent efface');
  assert.equal(peek('remplissage:49999', profil).remaining, 0);
  resetAll();
});

test('les avis ne partent que vers les services de notification des navigateurs', () => {
  assert.ok(exigerEndpoint('https://fcm.googleapis.com/fcm/send/abc'));
  assert.ok(exigerEndpoint('https://updates.push.services.mozilla.com/wpush/v2/abc'));
  assert.ok(exigerEndpoint('https://web.push.apple.com/QGx'));
  assert.ok(exigerEndpoint('https://wns2-par02p.notify.windows.com/w/?token=x'));
  for (const piege of [
    'https://10.0.0.5:8443/x',
    'https://127.0.0.1/x',
    'https://169.254.169.254/latest/meta-data',
    'https://fcm.googleapis.com.attaquant.example/x',
    'https://fcm.googleapis.com:8443/x',
    'http://fcm.googleapis.com/x',
    'https://localhost/x',
  ]) {
    assert.throws(() => exigerEndpoint(piege), undefined, piege);
  }
});
