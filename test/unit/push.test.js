/**
 * Ce qui part — et surtout ce qui NE part PAS — dans un avis pousse.
 *
 * UNE NOTIFICATION S'AFFICHE SUR UN ECRAN VERROUILLE. Le telephone du coiffeur
 * est pose sur le meuble, face en l'air, et n'importe qui passe devant. Ce qui
 * tient dans ces deux lignes est donc public au sens le plus concret du terme.
 *
 * Deux choses ne doivent jamais s'y trouver :
 *
 *   - un numero de telephone. Il est chiffre en base, jamais journalise ; le
 *     faire ressortir par la notification annulerait tout le reste ;
 *   - le jeton de suivi. Il EST le mot de passe du client : qui l'a peut
 *     annuler son tour. Il ne quitte pas la machine.
 *
 * Ces tests ne regardent pas un rendu, ils regardent la SOURCE du message. Une
 * relecture attentive le verrait aujourd'hui ; dans six mois, non.
 */
import './amorce.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import { _messageTourPris, _messageAnnulation } from '../../server/domain/push.js';

const TICKET = {
  id: '11111111-1111-4111-8111-111111111111',
  jour: '2026-09-24',
  numero_affiche: 'A012',
  prenom: 'Ana',
  nom: 'Ruiz',
  telephone_fin: '6789',
  telephone_enc: 'chiffre-mais-present-sur-l-objet',
  jeton_enc: 'jeton-chiffre-mais-present-sur-l-objet',
};

const tout = (message) => JSON.stringify(message);

test('un avis dit le numero, le prenom, et combien attendent', () => {
  const message = _messageTourPris(TICKET, 3);
  assert.match(message.titre, /A012/);
  assert.match(message.titre, /Ana/);
  assert.match(message.corps, /3/);
  assert.equal(message.url, '/gestion#file');
});

test('l annulation se distingue d un tour pris au premier coup d oeil', () => {
  const pris = _messageTourPris(TICKET, 2);
  const annule = _messageAnnulation(TICKET, 1);
  assert.notEqual(pris.titre, annule.titre);
  assert.match(annule.titre, /anulado/i);
});

/*
 * L'accord en nombre porte sur le nom ET sur ce qui l'entoure. « Quedan 1
 * persona » est le genre de phrase qui fait douter le coiffeur de tout le
 * reste de l'ecran.
 */
test('les phrases s accordent en nombre', () => {
  assert.match(_messageTourPris(TICKET, 1).corps, /único/i);
  assert.match(_messageTourPris(TICKET, 4).corps, /4 personas/);
  assert.match(_messageAnnulation(TICKET, 0).corps, /nadie/i);
  assert.match(_messageAnnulation(TICKET, 1).corps, /1 persona\b/);
  assert.match(_messageAnnulation(TICKET, 5).corps, /5 personas/);
});

test('aucun numero de telephone ne sort par la notification', () => {
  for (const message of [_messageTourPris(TICKET, 2), _messageAnnulation(TICKET, 2)]) {
    const texte = tout(message);
    assert.ok(!texte.includes('6789'), 'les 4 derniers chiffres du téléphone sont dans le message');
    assert.ok(!texte.includes(TICKET.telephone_enc), 'le téléphone chiffré est dans le message');
    assert.ok(!/tele[fp]h?on/i.test(texte), 'un champ téléphone est dans le message');
  }
});

test('le jeton de suivi ne sort JAMAIS : il est le mot de passe du client', () => {
  for (const message of [_messageTourPris(TICKET, 2), _messageAnnulation(TICKET, 2)]) {
    const texte = tout(message);
    assert.ok(!texte.includes(TICKET.jeton_enc), 'le jeton est dans le message');
    assert.ok(!/jeton|ticket\//i.test(texte), 'une trace du jeton est dans le message');
    assert.ok(!message.url.startsWith('/ticket/'), 'la notification mène à la page du client');
  }
});

/*
 * Le nom de famille ne sert a rien au coiffeur — il reconnait « Ana » — et
 * c'est une donnee de plus sur un ecran verrouille. On s'interdit de l'ajouter
 * « parce que c'est plus clair ».
 */
test('le nom de famille reste dans le salon', () => {
  for (const message of [_messageTourPris(TICKET, 2), _messageAnnulation(TICKET, 2)]) {
    assert.ok(!tout(message).includes('Ruiz'), 'le nom de famille est dans le message');
  }
});

test('un ticket sans prenom ne fabrique pas un titre bancal', () => {
  const message = _messageTourPris({ ...TICKET, prenom: null }, 2);
  assert.ok(!message.titre.includes('null'));
  assert.ok(!message.titre.includes('undefined'));
  assert.ok(!/—\s*$/.test(message.titre), 'un tiret pend à la fin du titre');
});

/*
 * Le regroupement est ce qui rend les avis supportables : trois tours pris
 * pendant une coupe font UNE notification remplacee trois fois, pas trois
 * notifications empilees. Mais il faut `renotifier`, sinon le remplacement est
 * silencieux et le coiffeur rate les deux derniers.
 */
test('les avis se remplacent, et le remplacement se fait entendre', () => {
  for (const message of [_messageTourPris(TICKET, 2), _messageAnnulation(TICKET, 2)]) {
    assert.equal(message.tag, 'file');
    assert.equal(message.renotifier, true);
  }
});

/*
 * Les services de notification refusent les charges trop grosses, et une
 * notification longue est de toute facon tronquee par le systeme. Si un jour
 * quelqu'un y met une phrase de trop, ce test le dira avant le telephone.
 */
test('un avis tient largement dans ce qu accepte un service de notification', () => {
  const taille = Buffer.byteLength(tout(_messageTourPris(TICKET, 12)), 'utf8');
  assert.ok(taille < 600, 'message de ' + taille + ' octets');
});
