/**
 * LES AVIS DES CLIENTS, SANS COMPTE.
 *
 * Le lien de suivi prouve la visite : on ne note qu'une fois servi, une seule
 * fois par visite, et rien ne parait en vitrine sans le gerant.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { IGNORE, demarrer } from './banc.js';

test('les avis des clients', { skip: IGNORE }, async (t) => {
  const banc = await demarrer();
  t.after(() => banc.arreter());
  const gerant = await banc.connecter('GERANT');
  const salon = await banc.connecter('COIFFEUR');

  const noter = (jeton, corps) => banc.client().requete('POST', '/ticket/' + jeton + '/avis', corps, { formulaire: true });
  async function servir(tour) {
    const appel = await salon.post('/api/file/suivant', {});
    const ticket = banc.auFauteuil(appel.body.file);
    assert.equal(ticket.numero, tour.numero);
    assert.equal((await salon.post('/api/file/' + ticket.id + '/servi')).status, 200);
  }

  let lucia;
  await t.test('on ne note pas une visite qui n a pas eu lieu', async () => {
    lucia = await banc.prendreTour('Lucia', 'Navarro', '612800001');
    const page = String((await banc.client().get('/ticket/' + lucia.jeton)).body);
    assert.ok(!page.includes('data-avis'), 'pas d invitation tant qu elle attend');
    const tot = await noter(lucia.jeton, { note: '5', commentaire: 'Trop tot' });
    assert.equal(tot.status, 409);
    assert.equal((await noter('jeton-invente-0123456789abcdef', { note: '5' })).status, 404);
    assert.equal((await banc.db.one('SELECT COUNT(*)::int AS n FROM avis')).n, 0);
  });

  await t.test('servie, elle est invitee ; une note bancale est refusee', async () => {
    await servir(lucia);
    const page = String((await banc.client().get('/ticket/' + lucia.jeton)).body);
    assert.ok(page.includes('data-avis') && page.includes('action="/ticket/' + lucia.jeton + '/avis"'));
    assert.equal(page.split('name="note"').length - 1, 5, 'cinq etoiles a choisir');
    for (const note of ['0', '6', '4.5', 'cinq', '']) {
      assert.equal((await noter(lucia.jeton, { note })).status, 422, 'note ' + note);
    }
    assert.equal((await noter(lucia.jeton, { note: '5', commentaire: 'x'.repeat(601) })).status, 422);
    assert.equal((await banc.db.one('SELECT COUNT(*)::int AS n FROM avis')).n, 0);
  });

  await t.test('un avis par visite, meme envoye trois fois en meme temps', async () => {
    const reponses = await Promise.all([1, 2, 3].map(() => noter(lucia.jeton, { note: '5', commentaire: '  Accueil   parfait,\nmains <b>superbes</b>  ' })));
    assert.equal(reponses.filter((r) => r.status === 303).length, 1, reponses.map((r) => r.status).join(','));
    assert.ok(reponses.filter((r) => r.status !== 303).every((r) => r.status === 409));
    const ligne = await banc.db.one('SELECT prenom, note, commentaire, statut FROM avis');
    assert.deepEqual(ligne, { prenom: 'Lucia', note: 5, commentaire: 'Accueil parfait, mains <b>superbes</b>', statut: 'ATTENTE' });
    const merci = String((await banc.client().get('/ticket/' + lucia.jeton + '?avis=merci')).body);
    assert.ok(merci.includes('avis-invite--merci') && !merci.includes('name="note"'), 'le formulaire a laisse place au merci');
    // Ni nom, ni telephone, ni ticket : l'avis ne garde que le prenom.
    const colonnes = (await banc.db.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'avis'")).rows.map((c) => c.column_name);
    assert.ok(!colonnes.some((c) => /nom$|telephone/.test(c) && c !== 'prenom'), colonnes.join(','));
  });

  await t.test('rien ne parait en vitrine tant que le gerant n a pas publie', async () => {
    const avant = String((await banc.client().get('/')).body);
    assert.ok(!avant.includes('id="avis"') && !avant.includes('Accueil parfait'));
    assert.equal((await salon.get('/api/avis')).status, 403, 'la moderation est au gerant');
    assert.ok([401, 403].includes((await banc.client().get('/api/avis')).status));

    const liste = await gerant.get('/api/avis');
    assert.equal(liste.status, 200);
    assert.equal(liste.body.items.length, 1);
    assert.equal(liste.body.items[0].statut, 'ATTENTE');
    assert.ok(!JSON.stringify(liste.body).includes('Navarro'), 'le nom de famille ne sort pas');
    const id = liste.body.items[0].id;
    assert.equal((await gerant.patch('/api/avis/' + id, { statut: 'APPROUVE' })).status, 422);
    assert.equal((await salon.patch('/api/avis/' + id, { statut: 'PUBLIE' })).status, 403);
    assert.equal((await gerant.patch('/api/avis/' + id, { statut: 'PUBLIE' })).status, 200);

    const apres = String((await banc.client().get('/')).body);
    assert.ok(apres.includes('id="avis"') && apres.includes('Lucia'));
    assert.ok(apres.includes('mains &lt;b&gt;superbes&lt;/b&gt;') && !apres.includes('<b>superbes</b>'), 'le commentaire est echappe');
    assert.ok(apres.includes('5,0'), 'la moyenne est dite');

    // Masque : il sort de la vitrine, il reste chez le gerant.
    assert.equal((await gerant.patch('/api/avis/' + id, { statut: 'MASQUE' })).status, 200);
    assert.ok(!(await banc.client().get('/')).body.includes('id="avis"'));
    assert.equal((await gerant.get('/api/avis')).body.items.length, 1);
    assert.equal((await gerant.patch('/api/avis/' + id, { statut: 'PUBLIE' })).status, 200);
  });

  await t.test('la moyenne ne compte que les avis publies', async () => {
    await banc.reinitialiserDebit();
    const ana = await banc.prendreTour('Ana', 'Lopez', '612800002');
    await servir(ana);
    assert.equal((await noter(ana.jeton, { note: '2' })).status, 303);
    let accueil = String((await banc.client().get('/')).body);
    assert.ok(accueil.includes('5,0') && !accueil.includes('3,5'), 'l avis en attente ne pese pas');
    const id = (await gerant.get('/api/avis')).body.items.find((a) => a.prenom === 'Ana').id;
    assert.equal((await gerant.patch('/api/avis/' + id, { statut: 'PUBLIE' })).status, 200);
    accueil = String((await banc.client().get('/')).body);
    assert.ok(accueil.includes('3,5'), 'cinq et deux font trois et demi');
    assert.equal((await gerant.get('/api/avis')).body.publies.nombre, 2);
    assert.equal((await gerant.delete('/api/avis/' + id)).status, 200);
    assert.equal((await gerant.delete('/api/avis/' + id)).status, 404);
    assert.ok(String((await banc.client().get('/')).body).includes('5,0'));
  });

  await t.test('le reglage eteint tout : ni invitation, ni depot, ni section', async () => {
    await banc.reinitialiserDebit();
    const eva = await banc.prendreTour('Eva', 'Ruiz', '612800003');
    await servir(eva);
    assert.equal((await gerant.put('/api/reglages', { valeurs: { 'vitrine.avis': false } })).status, 200);
    assert.ok(!(await banc.client().get('/ticket/' + eva.jeton)).body.includes('data-avis'));
    assert.equal((await noter(eva.jeton, { note: '4' })).status, 404);
    assert.ok(!(await banc.client().get('/')).body.includes('id="avis"'));
    assert.equal((await gerant.put('/api/reglages', { valeurs: { 'vitrine.avis': true } })).status, 200);
    assert.equal((await noter(eva.jeton, { note: '4' })).status, 303);
  });

  await t.test('la purge de l historique ne touche pas aux avis', async () => {
    const { PRESERVE } = await banc.importer('server/domain/purge.js');
    assert.ok(PRESERVE.includes('avis'));
    // Le ticket disparu, l'avis reste et la visite reste « deja notee ».
    const { etatPourTicket } = await banc.importer('server/domain/avis.js');
    const ligne = await banc.db.one('SELECT ticket_id FROM avis LIMIT 1');
    await banc.db.query('DELETE FROM ticket_evenements WHERE ticket_id = $1', [ligne.ticket_id]).catch(() => {});
    assert.equal(await etatPourTicket(ligne.ticket_id), 'DEJA');
    assert.equal(await etatPourTicket('00000000-0000-0000-0000-000000000000'), 'NON');
  });
});
