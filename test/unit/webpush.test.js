/**
 * Web Push : le chiffrement et le jeton VAPID.
 *
 * On ne « verifie » pas du chiffrement en regardant si ca a l'air de marcher.
 * Un message mal chiffre part sans erreur, arrive au service de notification,
 * et disparait : le telephone du coiffeur ne sonne pas et rien ne le dit.
 *
 * Le seul controle qui vaille est donc le VECTEUR DE LA NORME, rejoue octet par
 * octet — meme cle ephemere, meme sel, meme sortie attendue. C'est pourquoi
 * `chiffrer` accepte de se faire imposer les deux : sans cette porte, ce test
 * ne pourrait pas exister.
 *
 * Vecteur : RFC 8291, annexe A.
 */
import './amorce.js';
import crypto from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  chiffrer, enteteVapid, genererCles, lireCles, versB64u, depuisB64u,
} from '../../server/core/webpush.js';

const VECTEUR = {
  message: 'When I grow up, I want to be a watermelon',
  p256dh: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
  auth: 'BTBZMqHH6r4Tts7J_aSIgg',
  serveurPrivee: 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw',
  sel: 'DGv6ra1nlYgDCS1FRnbzlw',
  attendu: 'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZ'
    + 'IIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN',
};

test('le vecteur de la RFC 8291 sort octet pour octet', () => {
  const ecdh = crypto.createECDH('prime256v1');
  ecdh.setPrivateKey(depuisB64u(VECTEUR.serveurPrivee, 32));

  const corps = chiffrer(VECTEUR.message, { p256dh: VECTEUR.p256dh, auth: VECTEUR.auth }, {
    cleEphemere: ecdh,
    sel: depuisB64u(VECTEUR.sel, 16),
  });

  assert.equal(versB64u(corps), VECTEUR.attendu);
});

/*
 * L'en-tete binaire de la RFC 8188 : 16 octets de sel, la taille
 * d'enregistrement, la longueur de la cle, puis la cle publique du serveur.
 * Un octet de decalage ici et le navigateur jette le message en silence.
 */
test('l en-tete du corps a la forme aes128gcm', () => {
  const abonne = crypto.createECDH('prime256v1');
  abonne.generateKeys();
  const corps = chiffrer('hola', {
    p256dh: versB64u(abonne.getPublicKey()),
    auth: versB64u(crypto.randomBytes(16)),
  });

  assert.equal(corps.readUInt32BE(16), 4096, 'taille d enregistrement');
  assert.equal(corps[20], 65, 'longueur de la clé publique du serveur');
  assert.equal(corps[21], 0x04, 'la clé publique est non compressée');
  assert.ok(corps.length > 86, 'le corps ne contient pas de chiffré');
});

test('le message chiffre se dechiffre du cote du navigateur', () => {
  // On refait le chemin du navigateur : meme derivation, dans l'autre sens.
  const abonne = crypto.createECDH('prime256v1');
  abonne.generateKeys();
  const auth = crypto.randomBytes(16);
  const clair = 'Turno 12 — Ana';

  const corps = chiffrer(clair, {
    p256dh: versB64u(abonne.getPublicKey()),
    auth: versB64u(auth),
  });

  const sel = corps.subarray(0, 16);
  const serveurPublique = corps.subarray(21, 86);
  const chiffre = corps.subarray(86);

  const hmac = (cle, d) => crypto.createHmac('sha256', cle).update(d).digest();
  const hkdf = (s, ikm, info, n) => hmac(hmac(s, ikm), Buffer.concat([info, Buffer.from([1])])).subarray(0, n);
  const info = (nom) => Buffer.concat([Buffer.from('Content-Encoding: ' + nom), Buffer.from([0])]);

  const secret = abonne.computeSecret(serveurPublique);
  const ikm = hkdf(auth, secret, Buffer.concat([
    Buffer.from('WebPush: info'), Buffer.from([0]), abonne.getPublicKey(), serveurPublique,
  ]), 32);

  const decipher = crypto.createDecipheriv('aes-128-gcm', hkdf(sel, ikm, info('aes128gcm'), 16), hkdf(sel, ikm, info('nonce'), 12));
  decipher.setAuthTag(chiffre.subarray(chiffre.length - 16));
  const ouvert = Buffer.concat([decipher.update(chiffre.subarray(0, chiffre.length - 16)), decipher.final()]);

  assert.equal(ouvert[ouvert.length - 1], 2, 'le délimiteur de dernier enregistrement');
  assert.equal(ouvert.subarray(0, ouvert.length - 1).toString('utf8'), clair);
});

/*
 * Node accepte du base64 mal forme et rend un tampon plus court. Une cle
 * tronquee donnerait un secret partage silencieusement faux, donc des
 * notifications qui ne partent jamais sans qu'on sache pourquoi.
 */
test('une cle tronquee est refusee, pas rabotee', () => {
  assert.throws(() => depuisB64u('abc', 65), /65 attendus/);
  assert.throws(
    () => chiffrer('x', { p256dh: 'abc', auth: versB64u(crypto.randomBytes(16)) }),
    /65 attendus/,
  );
  const abonne = crypto.createECDH('prime256v1');
  abonne.generateKeys();
  assert.throws(
    () => chiffrer('x', { p256dh: versB64u(abonne.getPublicKey()), auth: 'court' }),
    /16 attendus/,
  );
});

/* ------------------------------------------------------------------ */
/*  VAPID                                                              */
/* ------------------------------------------------------------------ */

test('le jeton VAPID se verifie avec la cle publique annoncee', () => {
  const cles = genererCles();
  const entete = enteteVapid('https://fcm.googleapis.com/fcm/send/abc', {
    clePublique: cles.publique,
    clePrivee: cles.privee,
    sujet: 'mailto:salon@example.com',
  });

  const [, jeton, clef] = entete.match(/^vapid t=([^,]+), k=(.+)$/) || [];
  assert.ok(jeton, 'en-tête mal formé : ' + entete);
  assert.equal(clef, cles.publique);

  const [enteteB64, chargeB64, signatureB64] = jeton.split('.');
  const publique = depuisB64u(clef, 65);
  const cleVerif = crypto.createPublicKey({
    format: 'jwk',
    key: {
      kty: 'EC', crv: 'P-256',
      x: versB64u(publique.subarray(1, 33)),
      y: versB64u(publique.subarray(33, 65)),
    },
  });

  assert.ok(crypto.verify(
    'sha256',
    Buffer.from(enteteB64 + '.' + chargeB64, 'ascii'),
    { key: cleVerif, dsaEncoding: 'ieee-p1363' },
    depuisB64u(signatureB64, 64),
  ), 'signature invalide');

  const charge = JSON.parse(Buffer.from(chargeB64, 'base64url').toString('utf8'));
  assert.equal(charge.aud, 'https://fcm.googleapis.com', 'l’audience est l’ORIGINE, pas l’adresse complète');
  assert.equal(charge.sub, 'mailto:salon@example.com');
});

test('le jeton ne vaut que douze heures', () => {
  const cles = genererCles();
  const maintenant = 1_700_000_000_000;
  const entete = enteteVapid('https://updates.push.services.mozilla.com/wpush/v2/abc', {
    clePublique: cles.publique, clePrivee: cles.privee, sujet: 'https://peluqueria-haron.example',
  }, { maintenant });

  const charge = JSON.parse(Buffer.from(entete.split('.')[1], 'base64url').toString('utf8'));
  assert.equal(charge.exp, Math.floor(maintenant / 1000) + 12 * 3600);
});

/* ------------------------------------------------------------------ */
/*  Configuration                                                      */
/* ------------------------------------------------------------------ */

test('sans cles, les notifications sont simplement eteintes', () => {
  assert.deepEqual(lireCles({}), { actif: false });
});

test('une configuration a moitie remplie le DIT, elle ne se tait pas', () => {
  const cles = genererCles();
  assert.match(lireCles({ WEBPUSH_CLE_PUBLIQUE: cles.publique }).probleme, /vont par deux/);
  assert.match(
    lireCles({ WEBPUSH_CLE_PUBLIQUE: cles.publique, WEBPUSH_CLE_PRIVEE: cles.privee }).probleme,
    /WEBPUSH_SUJET/,
  );
  assert.match(
    lireCles({
      WEBPUSH_CLE_PUBLIQUE: cles.publique,
      WEBPUSH_CLE_PRIVEE: versB64u(Buffer.alloc(32, 7)),
      WEBPUSH_SUJET: 'mailto:a@b.c',
    }).probleme || 'aucun',
    /illisibles|aucun/,
  );
});

test('une configuration complete est active', () => {
  const cles = genererCles();
  const lues = lireCles({
    WEBPUSH_CLE_PUBLIQUE: cles.publique,
    WEBPUSH_CLE_PRIVEE: cles.privee,
    WEBPUSH_SUJET: 'mailto:salon@example.com',
  });
  assert.equal(lues.actif, true);
  assert.equal(lues.clePublique, cles.publique);
});
