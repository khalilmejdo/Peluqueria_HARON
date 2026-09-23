/**
 * Le socle : temps du salon, telephones, validation, reglages, chiffrement,
 * connecteur WhatsApp, PNG.
 *
 * Ce sont les briques sur lesquelles tout le reste repose. Une erreur ici ne se
 * voit pas a l'ecran : elle se voit six mois plus tard, sur un ticket date de
 * la veille ou un numero WhatsApp perdu.
 */
import './amorce.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  jourLocal, heureLocale, instantLocal, heureEnMinutes, heureValide,
  attenteLisible, dateLongueFr, jourSemaine, minutesDepuisMinuit,
} from '../../server/core/temps.js';
import { telephoneInternational, formatTelephone, telephoneMasque, capitaliserNom, escapeHtml } from '../../server/core/text.js';
import { validate, rules } from '../../server/core/validate.js';
import { ValidationError } from '../../server/core/errors.js';
import { versTexte, estOuvert, CATALOGUE } from '../../server/core/reglages.js';
import { encrypt, decrypt, blindIndex, hashToken, jetonSuivi, jetonPlausible, hashPassword, verifyPassword, MARQUEUR_ILLISIBLE } from '../../server/core/crypto.js';
import { corpsModele, parametreModele, numeroValide, lienWaMe, ErreurWhatsapp } from '../../server/core/whatsapp.js';
import { texteMessage } from '../../server/domain/notifications.js';
import { pngNoirEtBlanc, pngCouleur } from '../../server/core/png.js';

/* ------------------------------------------------------------------ */
/*  Le temps du salon                                                  */
/* ------------------------------------------------------------------ */

test('la journee se lit dans le fuseau du salon, pas en UTC', () => {
  // 23 septembre 2026, 23 h 30 a Madrid — soit 21 h 30 UTC. Un calcul en UTC
  // donnerait le bon jour ici, mais le suivant donne le mauvais.
  const soir = new Date('2026-09-23T21:30:00Z');
  assert.equal(jourLocal(soir, 'Europe/Madrid'), '2026-09-23');

  // Minuit trente a Madrid, soit 22 h 30 UTC la VEILLE. C'est le cas qui casse
  // tout : un ticket pris a 00 h 30 doit appartenir au 24, pas au 23.
  const nuit = new Date('2026-09-23T22:30:00Z');
  assert.equal(jourLocal(nuit, 'Europe/Madrid'), '2026-09-24');
  assert.equal(nuit.toISOString().slice(0, 10), '2026-09-23'); // ce que donnerait l UTC
});

test('le fuseau du salon est configurable : Madrid ou Casablanca', () => {
  const instant = new Date('2026-09-23T23:30:00Z');
  assert.equal(jourLocal(instant, 'Europe/Madrid'), '2026-09-24');
  assert.equal(jourLocal(instant, 'Africa/Casablanca'), '2026-09-24');
  assert.equal(heureLocale(instant, 'Europe/Madrid'), '01:30');
  assert.equal(heureLocale(instant, 'Africa/Casablanca'), '00:30');
});

test('instantLocal retrouve le bon instant, y compris au changement d heure', () => {
  const ete = instantLocal('2026-07-15', '10:00', 'Europe/Madrid');
  assert.equal(ete.toISOString(), '2026-07-15T08:00:00.000Z'); // UTC+2

  const hiver = instantLocal('2026-01-15', '10:00', 'Europe/Madrid');
  assert.equal(hiver.toISOString(), '2026-01-15T09:00:00.000Z'); // UTC+1

  assert.equal(instantLocal('2026-02-30', '10:00'), null);
  assert.equal(instantLocal('2026-01-15', '25:00'), null);
});

test('les heures se lisent et se comptent', () => {
  assert.ok(heureValide('09:30'));
  assert.ok(heureValide('00:00'));
  assert.ok(heureValide('23:59'));
  assert.ok(!heureValide('24:00'));
  assert.ok(!heureValide('9:30'));
  assert.equal(heureEnMinutes('09:30'), 570);
  assert.equal(heureEnMinutes('n importe quoi'), null);

  const midi = new Date('2026-09-23T10:05:00Z'); // 12 h 05 a Madrid
  assert.equal(minutesDepuisMinuit(midi, 'Europe/Madrid'), 12 * 60 + 5);
  assert.equal(jourSemaine(midi, 'Europe/Madrid'), 3); // mercredi
});

test('l attente se dit comme on la dit a un client', () => {
  assert.equal(attenteLisible(0), 'quelques instants');
  assert.equal(attenteLisible(1), 'environ 1 minute');
  assert.equal(attenteLisible(25), 'environ 25 minutes');
  assert.equal(attenteLisible(60), 'environ 1 h');
  assert.equal(attenteLisible(95), 'environ 1 h 35');
  assert.equal(dateLongueFr('2026-09-23'), 'mercredi 23 septembre 2026');
});

/* ------------------------------------------------------------------ */
/*  Telephones                                                         */
/* ------------------------------------------------------------------ */

test('un numero espagnol saisi de six facons donne le meme numero international', () => {
  const attendu = '34612345678';
  for (const saisie of ['612345678', '612 34 56 78', '+34612345678', '+34 612 345 678', '0034612345678', '34612345678']) {
    assert.equal(telephoneInternational(saisie, '34'), attendu, 'saisie : ' + saisie);
  }
});

test('l indicatif par defaut est celui du pays du salon', () => {
  // Le zero de tete national est remplace par l indicatif du salon.
  assert.equal(telephoneInternational('0612345678', '33'), '33612345678');
  assert.equal(telephoneInternational('0612345678', '212'), '212612345678');
  // Un « + » explicite l emporte toujours sur l indicatif par defaut.
  assert.equal(telephoneInternational('+212612345678', '34'), '212612345678');
});

test('un numero invraisemblable est refuse, pas rafistole', () => {
  for (const mauvais of ['', '  ', '12', 'appelle-moi', '+', '00', '612345678901234567', 'tel: 612345678', null, undefined]) {
    assert.equal(telephoneInternational(mauvais, '34'), null, 'aurait du etre refuse : ' + mauvais);
  }
});

test('un numero ne s affiche jamais en entier cote public', () => {
  assert.equal(telephoneMasque('34612345678'), '•••• •••• 5678');
  assert.match(formatTelephone('34612345678', '34'), /^\+34 /);
});

/* ------------------------------------------------------------------ */
/*  Validation                                                         */
/* ------------------------------------------------------------------ */

test('un prenom est remis en forme, et le faux est refuse', () => {
  const bon = validate({ prenom: '  ahmed   BENALI ' }, { prenom: rules.prenom });
  assert.equal(bon.prenom, 'Ahmed Benali');

  assert.equal(validate({ prenom: 'jean-pierre' }, { prenom: rules.prenom }).prenom, 'Jean-Pierre');
  assert.equal(validate({ prenom: 'محمد' }, { prenom: rules.prenom }).prenom, 'محمد');

  for (const mauvais of ['A', '', '12345', 'Ahmed <script>', 'Ahmed😀']) {
    assert.throws(
      () => validate({ prenom: mauvais }, { prenom: rules.prenom }),
      ValidationError,
      'aurait du etre refuse : ' + mauvais,
    );
  }
});

test('un champ absent du schema n est jamais recopie', () => {
  const sortie = validate(
    { prenom: 'Ahmed', role: 'GERANT', id: 'quelque-chose' },
    { prenom: rules.prenom },
  );
  assert.deepEqual(Object.keys(sortie), ['prenom']);
});

test('l erreur de validation nomme le champ fautif', () => {
  try {
    validate({ prenom: 'A', nom: 'Benali', telephone: '612345678' },
      { prenom: rules.prenom, nom: rules.nomFamille, telephone: rules.whatsapp });
    assert.fail('aurait du lever');
  } catch (err) {
    assert.ok(err instanceof ValidationError);
    assert.ok(err.fields.prenom);
    assert.equal(err.status, 422);
  }
});

/* ------------------------------------------------------------------ */
/*  Reglages                                                           */
/* ------------------------------------------------------------------ */

test('un reglage hors bornes est refuse avec une phrase utile', () => {
  assert.equal(versTexte('file.dureeMoyenneMinutes', '25'), '25');
  assert.throws(() => versTexte('file.dureeMoyenneMinutes', '0'), ValidationError);
  assert.throws(() => versTexte('file.dureeMoyenneMinutes', '999'), ValidationError);
  assert.throws(() => versTexte('file.dureeMoyenneMinutes', 'vingt'), ValidationError);
  assert.throws(() => versTexte('cle.inventee', 'x'), ValidationError);
});

test('les types de reglages se convertissent dans les deux sens', () => {
  assert.equal(versTexte('horaires.actifs', true), 'true');
  assert.equal(versTexte('horaires.actifs', 'non'), 'false');
  assert.equal(versTexte('horaires.1.ouverture', '09:30'), '09:30');
  assert.equal(versTexte('horaires.1.ouverture', ''), '');
  assert.throws(() => versTexte('horaires.1.ouverture', '9h30'), ValidationError);
  assert.equal(versTexte('public.url', 'https://haron.example/'), 'https://haron.example');
  assert.throws(() => versTexte('public.url', 'haron.example'), ValidationError);
});

test('le catalogue couvre les sept jours de la semaine', () => {
  for (let j = 0; j < 7; j += 1) {
    assert.ok(CATALOGUE['horaires.' + j + '.ouverture'], 'jour ' + j);
    assert.ok(CATALOGUE['horaires.' + j + '.fermeture'], 'jour ' + j);
  }
});

test('les horaires ne ferment le salon que s ils sont actives', () => {
  const reglages = {
    'horaires.actifs': false,
    'horaires.3.ouverture': '09:30',
    'horaires.3.fermeture': '20:00',
  };
  // Controle desactive : ouvert a 3 h du matin, et c est voulu.
  assert.equal(estOuvert(reglages, 3, 3 * 60).ouvert, true);

  const actifs = { ...reglages, 'horaires.actifs': true };
  assert.equal(estOuvert(actifs, 3, 3 * 60).ouvert, false);
  assert.equal(estOuvert(actifs, 3, 10 * 60).ouvert, true);
  assert.equal(estOuvert(actifs, 3, 20 * 60).ouvert, false); // l heure de fermeture est exclue
  // Un jour sans horaire est un jour de fermeture.
  assert.equal(estOuvert(actifs, 0, 10 * 60).ouvert, false);
});

/* ------------------------------------------------------------------ */
/*  Chiffrement                                                        */
/* ------------------------------------------------------------------ */

test('un numero chiffre se retrouve, et un chiffre altere ne rend jamais de donnee douteuse', () => {
  const numero = '34612345678';
  const chiffre = encrypt(numero);
  assert.notEqual(chiffre, numero);
  assert.equal(decrypt(chiffre), numero);

  // Deux chiffrements du meme numero different : pas de dictionnaire possible.
  assert.notEqual(encrypt(numero), encrypt(numero));

  // Un octet modifie : le chiffrement authentifie le detecte.
  const altere = chiffre.slice(0, -2) + (chiffre.endsWith('A') ? 'B' : 'A');
  assert.equal(decrypt(altere), MARQUEUR_ILLISIBLE);
  assert.equal(decrypt('n importe quoi'), MARQUEUR_ILLISIBLE);
});

test('l index aveugle reconnait un numero sans le dechiffrer', () => {
  const index = blindIndex('34612345678');
  assert.equal(index, blindIndex('34612345678'));
  assert.notEqual(index, blindIndex('34612345679'));
  assert.match(index, /^[0-9a-f]{64}$/);
  // Il ne contient rien du numero.
  assert.ok(!index.includes('612345678'));
});

test('un jeton de suivi est long, unique, et ne se devine pas depuis la base', () => {
  const jetons = new Set();
  for (let i = 0; i < 500; i += 1) {
    const jeton = jetonSuivi();
    assert.ok(jetonPlausible(jeton), jeton);
    jetons.add(jeton);
  }
  assert.equal(jetons.size, 500);

  // La base ne garde que le condensat : il ne permet pas de remonter au jeton.
  const jeton = jetonSuivi();
  const condensat = hashToken(jeton);
  assert.match(condensat, /^[0-9a-f]{64}$/);
  assert.ok(!condensat.includes(jeton));
  assert.equal(hashToken(jeton), condensat);
});

test('une forme de jeton invalide est rejetee avant toute requete', () => {
  for (const mauvais of ['', 'court', '../../etc/passwd', 'a'.repeat(100), 'avec espace', null, 42]) {
    assert.ok(!jetonPlausible(mauvais), 'aurait du etre refuse : ' + mauvais);
  }
});

test('un mot de passe se verifie, et son condensat ne contient pas le mot de passe', async () => {
  const hash = await hashPassword('Un-Mot-De-Passe-Solide-42');
  assert.ok(hash.startsWith('scrypt$'));
  assert.ok(!hash.includes('Solide'));
  assert.equal(await verifyPassword('Un-Mot-De-Passe-Solide-42', hash), true);
  assert.equal(await verifyPassword('un-mot-de-passe-solide-42', hash), false);
  assert.equal(await verifyPassword('', hash), false);
  // Un condensat mal forme rend false plutot qu une erreur 500.
  assert.equal(await verifyPassword('x', 'pas-un-condensat'), false);
});

/* ------------------------------------------------------------------ */
/*  WhatsApp                                                           */
/* ------------------------------------------------------------------ */

test('le corps d un message modele refuse ce que Meta refuse', () => {
  const corps = corpsModele({ destinataire: '34612345678', modele: 'haron_tour_enregistre', langue: 'fr', parametres: ['Ahmed', 'HARON', 'A024', '4'] });
  assert.equal(corps.messaging_product, 'whatsapp');
  assert.equal(corps.to, '34612345678');
  assert.equal(corps.template.name, 'haron_tour_enregistre');
  assert.equal(corps.template.components[0].parameters.length, 4);

  assert.throws(() => corpsModele({ destinataire: '06 12 34 56 78', modele: 'x' }), ErreurWhatsapp);
  assert.throws(() => corpsModele({ destinataire: '34612345678', modele: 'Modele Majuscule' }), ErreurWhatsapp);
  assert.throws(() => corpsModele({ destinataire: '34612345678', modele: 'ok', langue: 'francais' }), ErreurWhatsapp);
});

test('un parametre de modele est nettoye plutot que refuse', () => {
  // Meta refuse retours a la ligne, tabulations et quatre espaces consecutifs.
  assert.equal(parametreModele('Ahmed\nBenali'), 'Ahmed Benali');
  assert.equal(parametreModele('A      B'), 'A   B');
  assert.equal(parametreModele(''), '-');
  assert.equal(parametreModele(null), '-');
  assert.ok(parametreModele('x'.repeat(2000)).length <= 900);
});

test('le lien wa.me du coiffeur porte le message complet', () => {
  const lien = lienWaMe('34612345678', 'Bonjour Ahmed');
  assert.ok(lien.startsWith('https://wa.me/34612345678?text='));
  assert.ok(lien.includes(encodeURIComponent('Bonjour Ahmed')));
  assert.equal(lienWaMe('pas un numero', 'x'), null);
  assert.ok(numeroValide('34612345678'));
  assert.ok(!numeroValide('0612345678'));
});

test('les trois messages disent le numero de ticket et le lien de suivi', () => {
  const commun = { prenom: 'Ahmed', numero: 'A024', devant: 4, lien: 'https://haron.example/ticket/xyz', nomSalon: 'Peluquería HARON' };
  for (const type of ['CONFIRMATION', 'APPROCHE', 'TOUR']) {
    const texte = texteMessage(type, commun);
    assert.ok(texte.includes('Ahmed'), type);
    assert.ok(texte.includes('A024'), type);
    assert.ok(texte.includes('Peluquería HARON'), type);
    assert.ok(texte.includes(commun.lien), type + ' : le lien de suivi doit y etre');
  }
  assert.ok(texteMessage('CONFIRMATION', commun).includes('Personnes devant vous : 4'));
  assert.match(texteMessage('TOUR', commun), /c’est votre tour/i);
});

/* ------------------------------------------------------------------ */
/*  Images                                                             */
/* ------------------------------------------------------------------ */

test('un PNG produit est un PNG valide', () => {
  const image = pngNoirEtBlanc({ taille: 8, pixels: new Uint8Array(64).fill(1) });
  assert.deepEqual([...image.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.equal(image.subarray(12, 16).toString('ascii'), 'IHDR');
  assert.equal(image.readUInt32BE(16), 8);
  assert.equal(image.subarray(image.length - 8, image.length - 4).toString('ascii'), 'IEND');

  const couleur = pngCouleur({ largeur: 4, hauteur: 4, rgb: new Uint8Array(48).fill(200) });
  assert.equal(couleur.subarray(12, 16).toString('ascii'), 'IHDR');
  assert.equal(couleur[25], 2); // couleurs vraies

  assert.throws(() => pngNoirEtBlanc({ taille: 4, pixels: new Uint8Array(3) }));
  assert.throws(() => pngCouleur({ largeur: 2, hauteur: 2, rgb: new Uint8Array(3) }));
});

/* ------------------------------------------------------------------ */
/*  Echappement                                                        */
/* ------------------------------------------------------------------ */

test('toute donnee inseree dans une page est echappee', () => {
  assert.equal(escapeHtml('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;');
  assert.equal(escapeHtml('a"b\'c&d'), 'a&quot;b&#39;c&amp;d');
  assert.equal(escapeHtml(null), '');
  assert.equal(capitaliserNom('jean-pierre de LA tour'), 'Jean-Pierre De La Tour');
});
