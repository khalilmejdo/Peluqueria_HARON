/**
 * LA REMONTEE DES ERREURS.
 *
 * Ce test ne verifie pas Sentry : il verifie CE QUI SORT DE LA MACHINE. C'est
 * la seule chose qu'on maitrise, et la seule qui puisse faire du mal.
 *
 * Le point capital : l'adresse d'une page de suivi contient le JETON du client,
 * qui tient lieu de mot de passe. Quiconque le lit ouvre son suivi. Il ne doit
 * jamais partir chez un tiers, meme dans un rapport d'erreur.
 *
 * Le module lit SENTRY_DSN a son PREMIER import : il est donc pose ici avant
 * d'importer quoi que ce soit du serveur.
 */
import './amorce.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

/** Un faux Sentry qui note ce qu'il recoit. */
const recu = [];
const serveur = http.createServer((req, res) => {
  let corps = '';
  req.on('data', (c) => { corps += c; });
  req.on('end', () => {
    recu.push({ url: req.url, entetes: req.headers, corps });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end('{"id":"factice"}');
  });
});

await new Promise((r) => serveur.listen(0, '127.0.0.1', r));
process.env.SENTRY_DSN = 'http://cle-publique-factice@127.0.0.1:' + serveur.address().port + '/42';

const { signalerErreur, sentryActif } = await import('../../server/core/sentry.js');

test.after(() => serveur.close());

/** Laisse partir la requete : l'envoi est volontairement non attendu. */
const laisserPartir = () => new Promise((r) => setTimeout(r, 500));

test('un DSN valide active la remontee', () => {
  assert.equal(sentryActif, true);
});

test('LE JETON DE SUIVI D UN CLIENT NE SORT JAMAIS', async () => {
  recu.length = 0;
  signalerErreur(new Error('Panne pendant le suivi'), {
    methode: 'GET',
    chemin: '/ticket/JETON-ULTRA-SECRET-DU-CLIENT?depuis=whatsapp',
  });
  await laisserPartir();

  assert.equal(recu.length, 1);
  const { corps } = recu[0];
  assert.ok(!corps.includes('JETON-ULTRA-SECRET-DU-CLIENT'),
    'le jeton ne doit apparaitre NULLE PART dans ce qui sort');

  const evenement = JSON.parse(corps.split('\n')[2]);
  assert.equal(evenement.request.url, '/ticket/<jeton>');
});

test('l enveloppe a la forme que Sentry attend', async () => {
  recu.length = 0;
  signalerErreur(new Error('Une panne bien a elle'), { methode: 'POST', chemin: '/api/file/suivant' });
  await laisserPartir();

  const { url, entetes, corps } = recu[0];
  assert.equal(url, '/api/42/envelope/');
  assert.equal(entetes['content-type'], 'application/x-sentry-envelope');
  assert.match(String(entetes['x-sentry-auth']), /sentry_key=cle-publique-factice/);

  const lignes = corps.split('\n');
  assert.equal(lignes.length, 3, 'entete, type, evenement');

  const evenement = JSON.parse(lignes[2]);
  assert.equal(evenement.level, 'error');
  assert.equal(evenement.exception.values[0].value, 'Une panne bien a elle');
  assert.ok(evenement.exception.values[0].stacktrace.frames.length > 0, 'la pile doit etre transmise');
});

test('la meme erreur repetee n est envoyee qu une fois', async () => {
  recu.length = 0;
  // Mille erreurs identiques ne disent rien de plus que la premiere, et la
  // limite gratuite de Sentry est vite atteinte.
  for (let i = 0; i < 5; i += 1) signalerErreur(new Error('Toujours la meme'), { chemin: '/' });
  await laisserPartir();
  assert.equal(recu.length, 1);
});

test('un secret d environnement ne se glisse jamais dans un rapport', async () => {
  recu.length = 0;
  signalerErreur(new Error('Panne quelconque'), { chemin: '/join' });
  await laisserPartir();

  const { corps } = recu[0];
  for (const cle of ['APP_SECRET', 'APP_ENCRYPTION_KEY', 'APP_PASSWORD_PEPPER', 'DATABASE_URL']) {
    assert.ok(!corps.includes(process.env[cle]), 'la valeur de ' + cle + ' ne doit pas sortir');
  }
});
