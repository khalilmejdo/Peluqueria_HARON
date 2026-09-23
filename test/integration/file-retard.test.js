/**
 * LA GESTION DES RETARDS.
 *
 * C'est la regle qui fait vivre un vrai salon : le client appelé qui n'est pas
 * là ne doit ni bloquer la file, ni perdre son tour. Il repart derriere tout le
 * monde, garde son numero et son historique, et son compteur d'absences monte.
 *
 * L'exemple de la commande, verifie tel quel :
 *   1. Ahmed  2. Youssef  3. Karim  4. Mehdi
 *   Ahmed est appele, absent -> 1. Youssef  2. Karim  3. Mehdi  4. Ahmed
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { IGNORE, demarrer } from './banc.js';

test('un client absent repart en fin de file, sans jamais perdre son tour', { skip: IGNORE }, async (t) => {
  const banc = await demarrer();
  t.after(() => banc.arreter());
  const salon = await banc.connecter('COIFFEUR');

  const ahmed = await banc.prendreTour('Ahmed', 'Benali', '612345001');
  const youssef = await banc.prendreTour('Youssef', 'Ouali', '612345002');
  const karim = await banc.prendreTour('Karim', 'Fassi', '612345003');
  const mehdi = await banc.prendreTour('Mehdi', 'Amrani', '612345004');

  const numerosEnAttente = async () => {
    const r = await salon.get('/api/file');
    return r.body.file.attente.map((x) => x.numero);
  };
  const idDe = async (numero) => {
    const r = await salon.get('/api/file');
    const trouve = [...r.body.file.attente, banc.auFauteuil(r.body.file)].filter(Boolean).find((x) => x.numero === numero);
    return trouve?.id ?? null;
  };

  await t.test('la file de depart est celle de l exemple', async () => {
    assert.deepEqual(await numerosEnAttente(), ['A001', 'A002', 'A003', 'A004']);
    assert.equal(ahmed.numero, 'A001');
    assert.equal(mehdi.numero, 'A004');
  });

  await t.test('Ahmed est appele, puis declare absent', async () => {
    await salon.post('/api/file/suivant');
    const enCours = await salon.get('/api/file');
    assert.equal(banc.auFauteuil(enCours.body.file).numero, 'A001');

    const r = await salon.post('/api/file/' + banc.auFauteuil(enCours.body.file).id + '/absent');
    assert.equal(r.status, 200);
    assert.equal(r.body.absent, 'A001');
    assert.equal(r.body.retards, 1);
  });

  await t.test('la nouvelle file est exactement celle annoncee', async () => {
    assert.deepEqual(await numerosEnAttente(), ['A002', 'A003', 'A004', 'A001']);
    // Le fauteuil est libre : Ahmed n'occupe plus la place.
    const r = await salon.get('/api/file');
    assert.equal(banc.auFauteuil(r.body.file), null);
    assert.equal(r.body.file.prochain.numero, 'A002');
  });

  await t.test('Ahmed garde son numero, son lien et son historique', async () => {
    const vue = await banc.client().get('/api/public/tickets/' + ahmed.jeton);
    assert.equal(vue.status, 200);
    assert.equal(vue.body.numero, 'A001');
    assert.equal(vue.body.position, 4);
    assert.equal(vue.body.devant, 3);
    assert.equal(vue.body.retards, 1);
    assert.equal(vue.body.actif, true);

    const detail = await salon.get('/api/file/' + (await idDe('A001')));
    const statuts = detail.body.evenements.map((e) => e.statut);
    assert.deepEqual(statuts, ['WAITING', 'CALLED', 'LATE']);
    assert.match(detail.body.evenements[2].detail, /fin de file/);
  });

  await t.test('Ahmed reste dans la file : son statut d attente le dit', async () => {
    const r = await salon.get('/api/file');
    const ligne = r.body.file.attente.find((x) => x.numero === 'A001');
    assert.equal(ligne.statut, 'LATE');
    assert.equal(ligne.retards, 1);
    assert.equal(r.body.file.compteurs.enAttente, 4);
    assert.equal(r.body.file.compteurs.retards, 1);
  });

  await t.test('absent une seconde fois : il repart encore derriere', async () => {
    // On sert les trois autres pour qu'Ahmed revienne en tete.
    for (const numero of ['A002', 'A003', 'A004']) {
      await salon.post('/api/file/' + (await idDe(numero)) + '/servi');
    }
    assert.deepEqual(await numerosEnAttente(), ['A001']);

    // Puis un nouveau client arrive, et Ahmed est de nouveau absent.
    const sofia = await banc.prendreTour('Sofia', 'Martin', '612345005');
    assert.equal(sofia.numero, 'A005');

    await salon.post('/api/file/' + (await idDe('A001')) + '/appeler');
    const r = await salon.post('/api/file/' + (await idDe('A001')) + '/absent');
    assert.equal(r.body.retards, 2);
    assert.deepEqual(await numerosEnAttente(), ['A005', 'A001']);
  });

  await t.test('le compteur d absences ne redescend jamais', async () => {
    const vue = await banc.client().get('/api/public/tickets/' + ahmed.jeton);
    assert.equal(vue.body.retards, 2);

    const detail = await salon.get('/api/file/' + (await idDe('A001')));
    const absences = detail.body.evenements.filter((e) => e.statut === 'LATE');
    assert.equal(absences.length, 2);
    // L heure d arrivee initiale n a pas bouge : c est l historique du client.
    assert.ok(detail.body.ticket.arriveA);
  });

  await t.test('un client finalement servi apres deux absences est bien servi', async () => {
    await salon.post('/api/file/' + (await idDe('A005')) + '/servi');
    const r = await salon.post('/api/file/' + (await idDe('A001')) + '/servi');
    assert.equal(r.status, 200);
    assert.equal(r.body.servi, 'A001');
    assert.equal(r.body.file.attente.length, 0);

    const vue = await banc.client().get('/api/public/tickets/' + ahmed.jeton);
    assert.equal(vue.body.phase, 'TERMINE');
  });

  await t.test('les chiffres comptent le client en retard une fois, ses absences deux', async () => {
    const r = await salon.get('/api/statistiques/jour');
    assert.equal(r.body.clientsEnRetard, 1);
    assert.equal(r.body.absencesTotales, 2);
    assert.equal(r.body.servis, 5);
  });

  await t.test('marquer absent un ticket deja termine est refuse clairement', async () => {
    const r = await salon.get('/api/file');
    const termine = r.body.file.termines[0];
    const refus = await salon.post('/api/file/' + termine.id + '/absent');
    assert.equal(refus.status, 409);
    assert.match(refus.body.error.message, /plus dans la file/);
  });

  await t.test('les rangs ne se reutilisent jamais : deux clients ne partagent pas une place', async () => {
    const rangs = await banc.db.all('SELECT jour, rang, COUNT(*)::int AS n FROM tickets GROUP BY jour, rang HAVING COUNT(*) > 1');
    assert.deepEqual(rangs, []);
    // Le rang d'Ahmed a bien ete change deux fois, et vaut plus que le dernier
    // numero distribue : il est passe derriere tout le monde, deux fois.
    const ligne = await banc.db.one('SELECT rang, numero, retards FROM tickets WHERE numero = 1');
    assert.equal(ligne.retards, 2);
    assert.ok(ligne.rang > 5, 'le rang aurait du depasser le nombre de tickets du jour');
  });

  void youssef;
  void karim;
  void mehdi;
});
