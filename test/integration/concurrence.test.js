/**
 * CONCURRENCE.
 *
 * Un salon, c'est deux mains sur une tablette, un client qui appuie deux fois
 * sur « Prendre mon tour » parce que le reseau rame, et parfois le gerant qui
 * agit depuis son telephone pendant que le coiffeur agit depuis la tablette.
 *
 * Ce qui doit rester vrai, quoi qu'il arrive :
 *   - deux clients n'ont jamais le meme numero ni la meme position ;
 *   - un client servi deux fois ne compte qu'une fois ;
 *   - un seul client est au fauteuil ;
 *   - un client remis en fin de file deux fois de suite ne se dedouble pas.
 *
 * Ces invariants ne sont pas tenus par le code seul : ils sont portes par des
 * index uniques dans la base. Ce fichier verifie qu'ils tiennent VRAIMENT sous
 * des gestes simultanes, et pas seulement l'un apres l'autre.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { IGNORE, demarrer } from './banc.js';

test('la file tient sous des gestes simultanes', { skip: IGNORE }, async (t) => {
  const banc = await demarrer();
  t.after(() => banc.arreter());
  const salon = await banc.connecter('COIFFEUR');

  await t.test('vingt-cinq prises de tour au meme instant donnent vingt-cinq places distinctes', async () => {
    await banc.reinitialiserDebit();
    // Des prenoms sans chiffre : le validateur les refuserait, et c'est voulu
    // (la file s'affiche en tres gros a l'ecran du coiffeur).
    const lettres = 'ABCDEFGHIJKLMNOPQRSTUVWXY';
    const demandes = Array.from({ length: 25 }, (_, i) => banc.client().post('/api/public/tickets', {
      prenom: 'Client' + lettres[i],
      nom: 'Simultane',
      telephone: '6127000' + String(i).padStart(2, '0'),
    }));
    const reponses = await Promise.all(demandes);

    const crees = reponses.filter((r) => r.status === 201);
    assert.equal(crees.length, 25, 'toutes les prises de tour auraient du aboutir : '
      + JSON.stringify(reponses.filter((r) => r.status !== 201).map((r) => r.body)));

    // Vingt-cinq numeros differents, sans trou : A001 a A025.
    const numeros = crees.map((r) => r.body.numero).sort();
    assert.equal(new Set(numeros).size, 25);
    assert.deepEqual(numeros, Array.from({ length: 25 }, (_, i) => 'A' + String(i + 1).padStart(3, '0')).sort());

    // Vingt-cinq jetons de suivi differents.
    assert.equal(new Set(crees.map((r) => r.body.jeton)).size, 25);

    // Et surtout : vingt-cinq positions differentes.
    const rangs = await banc.db.all('SELECT rang FROM tickets ORDER BY rang');
    assert.equal(new Set(rangs.map((r) => r.rang)).size, 25);
    assert.deepEqual(rangs.map((r) => r.rang), Array.from({ length: 25 }, (_, i) => i + 1));
  });

  await t.test('la base refuse structurellement deux clients a la meme position', async () => {
    const [premier, second] = await banc.db.all('SELECT id, jour, rang FROM tickets ORDER BY rang LIMIT 2');
    await assert.rejects(
      () => banc.db.query('UPDATE tickets SET rang = $2 WHERE id = $1', [second.id, premier.rang]),
      (err) => {
        assert.equal(err.code, '23505');
        assert.match(String(err.constraint), /tickets_journee_rang/);
        return true;
      },
    );
  });

  await t.test('deux appels simultanes ne mettent qu un seul client au fauteuil', async () => {
    const file = await salon.get('/api/file');
    const [a, b] = file.body.file.attente;

    const [r1, r2] = await Promise.all([
      salon.post('/api/file/' + a.id + '/appeler'),
      salon.post('/api/file/' + b.id + '/appeler'),
    ]);

    const reussis = [r1, r2].filter((r) => r.status === 200);
    assert.equal(reussis.length, 1, 'un seul appel aurait du aboutir');
    const refuse = [r1, r2].find((r) => r.status !== 200);
    assert.equal(refuse.status, 409);
    assert.equal(refuse.body.error.code, 'FAUTEUIL_OCCUPE');

    // La base le confirme : un seul ticket appele ou en cours.
    const enCours = await banc.db.value(
      "SELECT COUNT(*)::int FROM tickets WHERE statut IN ('CALLED','IN_SERVICE')",
    );
    assert.equal(enCours, 1);
  });

  await t.test('servir deux fois le meme client ne le compte qu une fois', async () => {
    const file = await salon.get('/api/file');
    const actuel = file.body.file.enCours;

    const [r1, r2] = await Promise.all([
      salon.post('/api/file/' + actuel.id + '/servi'),
      salon.post('/api/file/' + actuel.id + '/servi'),
    ]);
    assert.equal(r1.status, 200);
    assert.equal(r2.status, 200);

    const servis = await banc.db.value("SELECT COUNT(*)::int FROM tickets WHERE statut = 'COMPLETED'");
    assert.equal(servis, 1);

    // Et l'historique ne raconte pas deux fois le meme geste.
    const traces = await banc.db.value(
      "SELECT COUNT(*)::int FROM ticket_evenements WHERE ticket_id = $1 AND statut = 'COMPLETED'",
      [actuel.id],
    );
    assert.equal(traces, 1);
  });

  await t.test('deux « absent » simultanes ne donnent qu un seul deplacement', async () => {
    const file = await salon.get('/api/file');
    const cible = file.body.file.attente[0];
    await salon.post('/api/file/' + cible.id + '/appeler');

    const [r1, r2] = await Promise.all([
      salon.post('/api/file/' + cible.id + '/absent'),
      salon.post('/api/file/' + cible.id + '/absent'),
    ]);

    // Le second geste trouve un ticket deja replace : soit il passe (le ticket
    // est encore actif et repart une fois de plus), soit il est refuse. Ce qui
    // compte, c'est qu'on ne puisse jamais compter deux absences pour une.
    const ligne = await banc.db.one('SELECT retards, rang, statut FROM tickets WHERE id = $1', [cible.id]);
    const traces = await banc.db.value(
      "SELECT COUNT(*)::int FROM ticket_evenements WHERE ticket_id = $1 AND statut = 'LATE'",
      [cible.id],
    );
    assert.equal(ligne.retards, traces, 'le compteur d absences doit coller a l historique');
    assert.equal(ligne.statut, 'LATE');
    assert.ok([r1.status, r2.status].includes(200));

    // Les rangs restent uniques, meme apres ce croisement.
    const doublons = await banc.db.all('SELECT rang FROM tickets GROUP BY jour, rang HAVING COUNT(*) > 1');
    assert.deepEqual(doublons, []);
  });

  await t.test('le meme numero envoye deux fois au meme instant ne cree qu un ticket', async () => {
    await banc.reinitialiserDebit();
    const corps = { prenom: 'Double', nom: 'Appui', telephone: '612700999' };
    const [r1, r2] = await Promise.all([
      banc.client().post('/api/public/tickets', corps),
      banc.client().post('/api/public/tickets', corps),
    ]);

    const crees = [r1, r2].filter((r) => r.status === 201);
    assert.equal(crees.length, 1, 'un double appui ne doit creer qu un seul ticket');
    const refuse = [r1, r2].find((r) => r.status !== 201);
    assert.equal(refuse.status, 409);

    const { blindIndex } = await banc.importer('server/core/crypto.js');
    const combien = await banc.db.value(
      'SELECT COUNT(*)::int FROM tickets WHERE telephone_idx = $1',
      [blindIndex('34612700999')],
    );
    assert.equal(combien, 1);
  });

  await t.test('la file reste coherente apres toute cette agitation', async () => {
    const r = await salon.get('/api/file');
    const attente = r.body.file.attente;

    // Les positions affichees sont 1, 2, 3... sans trou ni doublon.
    assert.deepEqual(attente.map((x) => x.position), attente.map((_, i) => i + 1 + (r.body.file.enCours ? 1 : 0)));
    // Les numeros de ticket sont tous distincts.
    assert.equal(new Set(attente.map((x) => x.numero)).size, attente.length);
    // Le total recoupe la base.
    const total = await banc.db.value('SELECT COUNT(*)::int FROM tickets');
    assert.equal(r.body.file.compteurs.total, total);
  });
});
