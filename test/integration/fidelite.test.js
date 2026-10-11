/**
 * LE PROGRAMME DE FIDELITE.
 *
 * Eteint par defaut. Allume, chaque client SERVI gagne une seance sur son
 * numero de telephone ; toutes les N, un cadeau, que le personnel note
 * « remis » une fois et une seule.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { IGNORE, demarrer } from './banc.js';

test('le programme de fidelite', { skip: IGNORE }, async (t) => {
  const banc = await demarrer();
  t.after(() => banc.arreter());
  const gerant = await banc.connecter('GERANT');
  const salon = await banc.connecter('COIFFEUR');

  /** Une visite complete : le client prend son tour, il est appele, puis servi. */
  async function visite(telephone, prenom = 'Salma') {
    await banc.reinitialiserDebit();
    const tour = await banc.prendreTour(prenom, 'Alaoui', telephone);
    const appel = await salon.post('/api/file/suivant', {});
    assert.equal(appel.status, 200, JSON.stringify(appel.body));
    const ticket = banc.auFauteuil(appel.body.file);
    const servi = await salon.post('/api/file/' + ticket.id + '/servi');
    assert.equal(servi.status, 200, JSON.stringify(servi.body));
    return { tour, ticket, file: servi.body.file };
  }
  const cartes = () => banc.db.query('SELECT seances, cadeaux FROM fidelite ORDER BY seances DESC').then((r) => r.rows ?? r);

  await t.test('eteint par defaut : rien n est compte, rien n est montre', async () => {
    const r = await gerant.get('/api/reglages');
    assert.equal(r.body.valeurs['fidelite.active'], false);
    const { tour, file } = await visite('612700001');
    assert.equal((await cartes()).length, 0);
    assert.equal(file.termines[0].fidelite, null);
    const suivi = await banc.client().get('/ticket/' + tour.jeton);
    assert.ok(!suivi.body.includes('data-fidelite'));
    assert.ok(!(await banc.client().get('/')).body.includes('id="fidelite"'));
    // Un cadeau ne se remet pas quand le programme est eteint.
    assert.equal((await salon.post('/api/file/' + file.termines[0].id + '/cadeau')).status, 409);
  });

  let prestation;
  await t.test('le gerant le regle : nombre de seances, prestation offerte, cadeau', async () => {
    const lu = await gerant.get('/api/reglages');
    const regle = lu.body.catalogue.find((e) => e.cle === 'fidelite.prestation');
    assert.ok(regle.options.length > 1, 'les lignes de la carte sont proposees');
    assert.equal(regle.options[0].valeur, '');
    prestation = regle.options[1];

    assert.equal((await gerant.put('/api/reglages', { valeurs: { 'fidelite.seances': 1 } })).status, 422, 'une seance : ce n est pas un programme');
    assert.equal((await gerant.put('/api/reglages', { valeurs: { 'fidelite.prestation': 'n-importe-quoi' } })).status, 422);
    assert.equal((await salon.put('/api/reglages', { valeurs: { 'fidelite.active': true } })).status, 403, 'reserve au gerant');
    const ok = await gerant.put('/api/reglages', {
      valeurs: { 'fidelite.active': true, 'fidelite.seances': 3, 'fidelite.prestation': prestation.valeur, 'fidelite.cadeau': 'Un vernis <b>offert</b>' },
    });
    assert.equal(ok.status, 200, JSON.stringify(ok.body));

    const accueil = String((await banc.client().get('/')).body);
    assert.ok(accueil.includes('id="fidelite"'), 'la vitrine annonce le programme');
    assert.ok(accueil.includes(prestation.libelle) && accueil.includes('Un vernis &lt;b&gt;offert&lt;/b&gt;'), 'la prestation et le cadeau, echappes');
    assert.equal(accueil.split('<li class="tampon').length - 1, 3, 'trois pastilles pour trois seances');
  });

  await t.test('chaque client servi gagne une seance sur SON numero', async () => {
    const un = await visite('612700010');
    assert.deepEqual(un.file.termines.find((x) => x.id === un.ticket.id).fidelite.acquis, 1);
    await visite('612700020', 'Autre');
    const deux = await visite('612700010');
    const carte = deux.file.termines.find((x) => x.id === deux.ticket.id).fidelite;
    assert.deepEqual([carte.acquis, carte.objectif, carte.restant, carte.cadeaux], [2, 3, 1, 0]);
    assert.deepEqual((await cartes()).map((c) => c.seances), [2, 1], 'deux cartes : les numeros ne se melangent pas');
    // Le numero ecrit autrement (indicatif, espaces) retombe sur la meme carte.
    const trois = await visite('+34 612 70 00 10');
    assert.equal(trois.file.termines.find((x) => x.id === trois.ticket.id).fidelite.cadeaux, 1, 'la troisieme seance donne le cadeau');
    assert.deepEqual((await cartes()).map((c) => c.seances), [3, 1]);
  });

  await t.test('un tour annule ou seulement appele ne compte pas', async () => {
    await banc.reinitialiserDebit();
    const tour = await banc.prendreTour('Annule', 'Client', '612700030');
    const file = (await salon.get('/api/file')).body.file;
    const ticket = file.attente.find((x) => x.numero === tour.numero);
    assert.equal(ticket.fidelite.acquis, 0, 'la carte est montree des la file, a zero');
    assert.equal((await salon.post('/api/file/' + ticket.id + '/annuler', { motif: 'parti' })).status, 200);
    assert.equal((await cartes()).length, 2, 'aucune carte creee pour un tour annule');
  });

  await t.test('le client voit sa carte sur sa page de suivi, le personnel sur la file', async () => {
    await banc.reinitialiserDebit();
    const tour = await banc.prendreTour('Salma', 'Alaoui', '612700010');
    const suivi = String((await banc.client().get('/ticket/' + tour.jeton)).body);
    assert.ok(suivi.includes('data-fidelite') && suivi.includes('fidelite--pret'), 'le cadeau est annonce au client');
    assert.ok(suivi.includes(prestation.libelle));
    const api = await banc.client().get('/api/public/tickets/' + tour.jeton);
    assert.equal(api.body.fidelite.cadeaux, 1);
    assert.ok(!JSON.stringify(api.body).includes('telephone_idx'), 'l index du numero ne sort jamais');

    // Un autre client, a une seance : sa carte dit ou il en est.
    const autre = await banc.prendreTour('Autre', 'Alaoui', '612700020');
    const sien = String((await banc.client().get('/ticket/' + autre.jeton)).body);
    assert.ok(sien.includes('data-fidelite') && !sien.includes('fidelite--pret'));
    assert.equal(sien.split('tampon--acquis').length - 1, 1, 'une pastille pleine sur trois');

    const file = (await salon.get('/api/file')).body.file;
    const ticket = file.attente.find((x) => x.numero === tour.numero);
    assert.equal(ticket.fidelite.cadeaux, 1);
    assert.ok(ticket.fidelite.cadeau.includes('Un vernis'));

    // Le cadeau se remet UNE fois.
    const remis = await salon.post('/api/file/' + ticket.id + '/cadeau');
    assert.equal(remis.status, 200, JSON.stringify(remis.body));
    assert.equal(remis.body.file.attente.find((x) => x.id === ticket.id).fidelite.cadeaux, 0);
    const encore = await salon.post('/api/file/' + ticket.id + '/cadeau');
    assert.equal(encore.status, 409);
    assert.equal(encore.body.error.code, 'AUCUN_CADEAU');
    // Celui qui n'a qu'une seance n'a rien a recevoir.
    const pasEncore = file.attente.find((x) => x.numero === autre.numero);
    assert.equal((await salon.post('/api/file/' + pasEncore.id + '/cadeau')).status, 409);
    // Sans session : rien.
    assert.ok([401, 403].includes((await banc.client().post('/api/file/' + ticket.id + '/cadeau')).status));
    assert.deepEqual((await cartes()).map((c) => [c.seances, c.cadeaux]), [[3, 1], [1, 0]]);
  });

  await t.test('deux remises en meme temps : un seul cadeau part', async () => {
    await banc.db.query("UPDATE fidelite SET seances = 6 WHERE seances = 3");
    const file = (await salon.get('/api/file')).body.file;
    const ticket = file.attente.find((x) => x.fidelite.cadeaux === 1);
    const reponses = await Promise.all([1, 2, 3].map(() => salon.post('/api/file/' + ticket.id + '/cadeau')));
    assert.equal(reponses.filter((r) => r.status === 200).length, 1, reponses.map((r) => r.status).join(','));
    assert.deepEqual((await cartes())[0], { seances: 6, cadeaux: 2 });
  });

  await t.test('la purge de l historique garde les cartes ; eteindre le programme aussi', async () => {
    assert.equal((await gerant.put('/api/reglages', { valeurs: { 'fidelite.active': false } })).status, 200);
    assert.deepEqual((await cartes()).map((c) => c.seances), [6, 1]);
    assert.ok(!(await banc.client().get('/')).body.includes('id="fidelite"'));
    const { PRESERVE } = await banc.importer('server/domain/purge.js');
    assert.ok(PRESERVE.includes('fidelite'));
    const { TABLES } = await banc.importer('server/domain/purge.js');
    if (TABLES) assert.ok(!TABLES.includes('fidelite'));
  });
});
