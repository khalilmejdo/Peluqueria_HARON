/**
 * LES FAUTEUILS.
 *
 * Le salon peut en avoir un, deux ou cinq. Ce qui doit rester vrai :
 *
 *   - la file reste UNIQUE : le client prend un tour, jamais un fauteuil ;
 *   - deux fauteuils servent deux clients EN MEME TEMPS ;
 *   - un fauteuil ne sert jamais deux clients a la fois, meme si deux
 *     tablettes appellent a la milliseconde ;
 *   - l'attente annoncee au client tient compte du nombre de fauteuils ;
 *   - un fauteuil qui a servi ne se supprime pas : son historique reste.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { IGNORE, demarrer } from './banc.js';

test('plusieurs fauteuils servent la meme file, en parallele', { skip: IGNORE }, async (t) => {
  const banc = await demarrer();
  t.after(() => banc.arreter());

  const coiffeur = await banc.connecter('COIFFEUR');
  const gerant = await banc.connecter('GERANT');

  let fauteuil1;
  let fauteuil2;

  await t.test('le salon demarre avec un fauteuil', async () => {
    const r = await coiffeur.get('/api/postes');
    assert.equal(r.status, 200);
    assert.equal(r.body.items.length, 1);
    assert.equal(r.body.actifs, 1);
    assert.equal(r.body.items[0].nom, 'Sillón 1');
    assert.equal(r.body.items[0].actif, true);
    fauteuil1 = r.body.items[0];
  });

  await t.test('avec un seul fauteuil, l ecran est exactement celui d avant', async () => {
    const r = await coiffeur.get('/api/file');
    assert.equal(r.body.file.postes.length, 1);
    assert.equal(r.body.file.postes[0].client, null);
    assert.equal(r.body.file.compteurs.fauteuils, 1);
  });

  await t.test('le gerant ajoute un second fauteuil, avec le nom du coiffeur', async () => {
    const r = await gerant.post('/api/postes', { nom: 'Fauteuil 2', coiffeur: 'Youssef' });
    assert.equal(r.status, 201);
    assert.equal(r.body.nom, 'Fauteuil 2');
    assert.equal(r.body.coiffeur, 'Youssef');
    assert.equal(r.body.actif, true);
    fauteuil2 = r.body;
  });

  await t.test('deux fauteuils du meme nom sont refuses', async () => {
    const r = await gerant.post('/api/postes', { nom: 'fauteuil 2' });
    assert.equal(r.status, 409);
    assert.match(r.body.error.message, /ese nombre/);
  });

  await t.test('la creation et la modification sont reservees au gerant', async () => {
    assert.equal((await coiffeur.post('/api/postes', { nom: 'Fauteuil 3' })).status, 403);
    assert.equal((await coiffeur.patch('/api/postes/' + fauteuil2.id, { nom: 'X' })).status, 403);
    assert.equal((await coiffeur.delete('/api/postes/' + fauteuil2.id)).status, 403);
    // Mais le coiffeur doit pouvoir LIRE la liste : son ecran en a besoin.
    assert.equal((await coiffeur.get('/api/postes')).status, 200);
  });

  /* ---------------- deux clients en meme temps ---------------- */

  let ahmed;
  let sofia;
  let karim;

  await t.test('quatre clients prennent leur tour dans la meme file', async () => {
    ahmed = await banc.prendreTour('Ahmed', 'Benali', '612380001');
    sofia = await banc.prendreTour('Sofia', 'Martin', '612380002');
    karim = await banc.prendreTour('Karim', 'Ouali', '612380003');
    await banc.prendreTour('Mehdi', 'Fassi', '612380004');

    const r = await coiffeur.get('/api/file');
    assert.deepEqual(r.body.file.attente.map((x) => x.numero), ['A001', 'A002', 'A003', 'A004']);
    assert.equal(r.body.file.postes.length, 2);
  });

  await t.test('l attente annoncee au client tient compte des deux fauteuils', async () => {
    // Deux fauteuils, coupes de 20 minutes : Ahmed et Sofia passent tout de
    // suite, Karim et Mehdi a 20 minutes.
    const vueKarim = await banc.client().get('/api/public/tickets/' + karim.jeton);
    assert.equal(vueKarim.body.devant, 2, 'le nombre de personnes devant ne change pas');
    assert.equal(vueKarim.body.estimationMinutes, 20, 'mais l’attente est divisée par deux');

    const vueSofia = await banc.client().get('/api/public/tickets/' + sofia.jeton);
    assert.equal(vueSofia.body.devant, 1);
    assert.equal(vueSofia.body.estimationMinutes, 0);
    assert.equal(vueSofia.body.phase, 'PROCHAIN');
  });

  await t.test('deux clients sont appeles en meme temps, un par fauteuil', async () => {
    const premier = await coiffeur.post('/api/file/suivant', { posteId: fauteuil1.id });
    assert.equal(premier.status, 200);
    assert.equal(premier.body.appele, 'A001');
    assert.equal(premier.body.fauteuil, 'Sillón 1');

    const second = await coiffeur.post('/api/file/suivant', { posteId: fauteuil2.id });
    assert.equal(second.status, 200);
    assert.equal(second.body.appele, 'A002');
    assert.equal(second.body.fauteuil, 'Fauteuil 2');

    const file = second.body.file;
    assert.equal(file.postes.length, 2);
    assert.equal(file.postes.find((p) => p.id === fauteuil1.id).client.numero, 'A001');
    assert.equal(file.postes.find((p) => p.id === fauteuil2.id).client.numero, 'A002');
    assert.equal(file.compteurs.enCours, 2);
    assert.equal(file.compteurs.fauteuilsLibres, 0);
    assert.deepEqual(file.attente.map((x) => x.numero), ['A003', 'A004']);
  });

  await t.test('un fauteuil occupe refuse un second client, en le nommant', async () => {
    const file = await coiffeur.get('/api/file');
    const cible = file.body.file.attente[0];
    const r = await coiffeur.post('/api/file/' + cible.id + '/appeler', { posteId: fauteuil1.id });
    assert.equal(r.status, 409);
    assert.equal(r.body.error.code, 'FAUTEUIL_OCCUPE');
    assert.match(r.body.error.message, /Sillón 1/);
    assert.match(r.body.error.message, /A001/);
  });

  await t.test('tous les fauteuils occupes : le message le dit', async () => {
    const file = await coiffeur.get('/api/file');
    const cible = file.body.file.attente[0];
    const r = await coiffeur.post('/api/file/' + cible.id + '/appeler');
    assert.equal(r.status, 409);
    assert.equal(r.body.error.code, 'FAUTEUILS_OCCUPES');
  });

  await t.test('la base refuse structurellement deux clients sur un fauteuil', async () => {
    const enAttente = await banc.db.one("SELECT id FROM tickets WHERE statut = 'WAITING' ORDER BY rang LIMIT 1");
    await assert.rejects(
      () => banc.db.query(
        `UPDATE tickets SET statut = 'CALLED', poste_id = $2, appele_at = now() WHERE id = $1`,
        [enAttente.id, fauteuil1.id],
      ),
      (err) => {
        assert.equal(err.code, '23505');
        assert.match(String(err.constraint), /tickets_un_client_par_poste/);
        return true;
      },
    );
  });

  await t.test('un client appele est toujours sur un fauteuil', async () => {
    const enAttente = await banc.db.one("SELECT id FROM tickets WHERE statut = 'WAITING' ORDER BY rang LIMIT 1");
    await assert.rejects(
      () => banc.db.query("UPDATE tickets SET statut = 'CALLED' WHERE id = $1", [enAttente.id]),
      (err) => {
        assert.equal(err.code, '23514');
        assert.match(String(err.constraint), /tickets_en_cours_sur_un_poste/);
        return true;
      },
    );
  });

  await t.test('servir un client libere SON fauteuil, et lui seul', async () => {
    const file = await coiffeur.get('/api/file');
    const surLe1 = file.body.file.postes.find((p) => p.id === fauteuil1.id).client;
    const r = await coiffeur.post('/api/file/' + surLe1.id + '/servi');

    const apres = r.body.file;
    assert.equal(apres.postes.find((p) => p.id === fauteuil1.id).client, null);
    // L'autre fauteuil n'a pas bouge.
    assert.equal(apres.postes.find((p) => p.id === fauteuil2.id).client.numero, 'A002');
    assert.equal(apres.compteurs.enCours, 1);
    assert.equal(apres.compteurs.fauteuilsLibres, 1);
  });

  await t.test('l historique dit quel fauteuil a servi le client', async () => {
    const servi = await banc.db.one(
      `SELECT t.numero_affiche, p.nom FROM tickets t JOIN postes p ON p.id = t.poste_id
        WHERE t.statut = 'COMPLETED' LIMIT 1`,
    );
    assert.equal(servi.numero_affiche, 'A001');
    assert.equal(servi.nom, 'Sillón 1');
  });

  await t.test('un absent libere son fauteuil et repart en fin de file', async () => {
    const file = await coiffeur.get('/api/file');
    const surLe2 = file.body.file.postes.find((p) => p.id === fauteuil2.id).client;
    const r = await coiffeur.post('/api/file/' + surLe2.id + '/absent');

    assert.equal(r.status, 200);
    assert.equal(r.body.file.postes.find((p) => p.id === fauteuil2.id).client, null);
    assert.equal(r.body.file.compteurs.fauteuilsLibres, 2);
    // Il est bien dernier de la file, et plus rattache a aucun fauteuil.
    assert.equal(r.body.file.attente.at(-1).numero, 'A002');
    const ligne = await banc.db.one('SELECT poste_id, retards FROM tickets WHERE numero_affiche = $1', ['A002']);
    assert.equal(ligne.poste_id, null);
    assert.equal(ligne.retards, 1);
  });

  await t.test('sans fauteuil precise, le premier libre est pris', async () => {
    const r = await coiffeur.post('/api/file/suivant');
    assert.equal(r.status, 200);
    assert.equal(r.body.fauteuil, 'Sillón 1');
  });

  /* ---------------- ouvrir, fermer, supprimer ---------------- */

  await t.test('fermer un fauteuil occupe est refuse', async () => {
    const r = await gerant.patch('/api/postes/' + fauteuil1.id, { actif: false });
    assert.equal(r.status, 409);
    assert.match(r.body.error.message, /sentado en este sillón/);
  });

  await t.test('un fauteuil libre se ferme, et disparait des appels', async () => {
    const r = await gerant.patch('/api/postes/' + fauteuil2.id, { actif: false });
    assert.equal(r.status, 200);
    assert.equal(r.body.actif, false);

    const file = await coiffeur.get('/api/file');
    assert.equal(file.body.file.compteurs.fauteuils, 1);
    assert.equal(file.body.file.postes.length, 1, 'un fauteuil fermé et vide ne s’affiche plus');

    // Et l'attente repart sur la base d'un seul fauteuil.
    const vue = await banc.client().get('/api/public/tickets/' + karim.jeton);
    assert.ok(vue.body.estimationMinutes >= 0);
  });

  await t.test('on ne ferme pas le dernier fauteuil ouvert', async () => {
    // Le fauteuil 1 est occupe : on sert son client d'abord.
    const file = await coiffeur.get('/api/file');
    const assis = file.body.file.postes[0].client;
    if (assis) await coiffeur.post('/api/file/' + assis.id + '/servi');

    const r = await gerant.patch('/api/postes/' + fauteuil1.id, { actif: false });
    assert.equal(r.status, 409);
    assert.match(r.body.error.message, /último sillón/);
  });

  await t.test('un fauteuil qui a servi ne se supprime pas, il se ferme', async () => {
    const r = await gerant.delete('/api/postes/' + fauteuil1.id);
    assert.equal(r.status, 409);
    assert.match(r.body.error.message, /ese historial/);
  });

  await t.test('un fauteuil qui n a jamais servi se supprime', async () => {
    const cree = await gerant.post('/api/postes', { nom: 'Fauteuil essai' });
    assert.equal(cree.status, 201);
    const r = await gerant.delete('/api/postes/' + cree.body.id);
    assert.equal(r.status, 204);
  });

  await t.test('renommer un fauteuil et changer son coiffeur', async () => {
    const r = await gerant.patch('/api/postes/' + fauteuil1.id, { nom: 'Poste vitrine', coiffeur: 'Haron' });
    assert.equal(r.status, 200);
    assert.equal(r.body.nom, 'Poste vitrine');
    assert.equal(r.body.coiffeur, 'Haron');

    // Le nom du coiffeur se retire en envoyant une chaine vide.
    const sans = await gerant.patch('/api/postes/' + fauteuil1.id, { coiffeur: '' });
    assert.equal(sans.body.coiffeur, null);
  });

  await t.test('les chiffres du jour se lisent fauteuil par fauteuil', async () => {
    const r = await coiffeur.get('/api/statistiques/jour');
    assert.equal(r.status, 200);
    assert.ok(Array.isArray(r.body.fauteuils));
    const vitrine = r.body.fauteuils.find((f) => f.nom === 'Poste vitrine');
    assert.ok(vitrine, 'chaque fauteuil doit apparaitre');
    assert.ok(vitrine.servis >= 1);
    // La somme par fauteuil recoupe le total du jour.
    assert.equal(r.body.fauteuils.reduce((n, f) => n + f.servis, 0), r.body.servis);
  });

  void ahmed;
});
