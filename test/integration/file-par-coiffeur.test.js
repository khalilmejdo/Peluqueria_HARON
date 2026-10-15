/**
 * UNE FILE PAR COIFFEUR.
 *
 * Mode facultatif, a l'oppose du mode par defaut : le client CHOISIT son
 * coiffeur et attend dans SA file, meme si le voisin est libre.
 *
 * Ce qui doit rester vrai :
 *   - le choix du coiffeur est obligatoire, et verifie ;
 *   - chacun n'a devant lui que sa propre file ;
 *   - « appeler le suivant » prend le suivant DE CE COIFFEUR ;
 *   - un absent repart en fin de SA file, pas ailleurs ;
 *   - le coiffeur peut malgre tout depanner la file d'un collegue, et ca se
 *     lit dans l'historique ;
 *   - on ne change pas d'organisation avec des clients dans la file.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { IGNORE, demarrer } from './banc.js';

test('le salon peut donner une file a chaque coiffeur', { skip: IGNORE }, async (t) => {
  const banc = await demarrer();
  t.after(() => banc.arreter());

  const coiffeur = await banc.connecter('COIFFEUR');
  const gerant = await banc.connecter('GERANT');

  let youssef;
  let haron;

  await t.test('le mode par defaut est la file unique', async () => {
    const r = await gerant.get('/api/reglages');
    assert.equal(r.body.valeurs['file.mode'], 'UNIQUE');
    const file = await coiffeur.get('/api/file');
    assert.equal(file.body.file.mode, 'UNIQUE');
  });

  await t.test('on prepare deux coiffeurs nommes', async () => {
    const un = await gerant.patch('/api/postes/' + (await gerant.get('/api/postes')).body.items[0].id, {
      nom: 'Sillón 1', coiffeur: 'Youssef',
    });
    assert.equal(un.status, 200);
    youssef = un.body;

    const deux = await gerant.post('/api/postes', { nom: 'Fauteuil 2', coiffeur: 'Haron' });
    assert.equal(deux.status, 201);
    haron = deux.body;
  });

  await t.test('on bascule en file par coiffeur, file vide', async () => {
    const r = await gerant.put('/api/reglages', { valeurs: { 'file.mode': 'PAR_FAUTEUIL' } });
    assert.equal(r.status, 200);
    assert.equal(r.body.valeurs['file.mode'], 'PAR_FAUTEUIL');

    const file = await coiffeur.get('/api/file');
    assert.equal(file.body.file.mode, 'PAR_FAUTEUIL');
    // Chaque fauteuil porte desormais sa propre file.
    for (const p of file.body.file.postes) {
      assert.ok(Array.isArray(p.attente), 'chaque fauteuil doit porter sa file');
      assert.equal(p.attente.length, 0);
    }
  });

  /* ---------------- le client choisit ---------------- */

  await t.test('le client public voit qui est disponible, et l attente de chacun', async () => {
    const r = await banc.client().get('/api/public/file');
    assert.equal(r.status, 200);
    assert.equal(r.body.mode, 'PAR_FAUTEUIL');
    assert.equal(r.body.coiffeurs.length, 2);
    assert.deepEqual(r.body.coiffeurs.map((c) => c.nom).sort(), ['Haron', 'Youssef']);
    assert.equal(r.body.coiffeurs[0].enAttente, 0);
  });

  await t.test('prendre un tour sans choisir de coiffeur est refuse', async () => {
    await banc.reinitialiserDebit();
    const r = await banc.client().post('/api/public/tickets', {
      prenom: 'Ahmed', nom: 'Benali', telephone: '612390001',
    });
    assert.equal(r.status, 422);
    assert.ok(r.body.error.details.fields.posteId);
    assert.match(r.body.error.message, /elige/i);
  });

  await t.test('un coiffeur inconnu ou ferme est refuse', async () => {
    await banc.reinitialiserDebit();
    const inconnu = await banc.client().post('/api/public/tickets', {
      prenom: 'Ahmed', nom: 'Benali', telephone: '612390001',
      posteId: '00000000-0000-4000-8000-000000000000',
    });
    assert.equal(inconnu.status, 422);
    assert.match(inconnu.body.error.message, /ya no está disponible/);
  });

  let ahmed;
  let sofia;
  let karim;

  await t.test('trois clients choisissent : deux chez Youssef, un chez Haron', async () => {
    await banc.reinitialiserDebit();
    const prendre = async (prenom, nom, tel, posteId) => {
      const r = await banc.client().post('/api/public/tickets', { prenom, nom, telephone: tel, posteId });
      assert.equal(r.status, 201, JSON.stringify(r.body));
      return r.body;
    };
    ahmed = await prendre('Ahmed', 'Benali', '612390001', youssef.id);
    sofia = await prendre('Sofia', 'Martin', '612390002', haron.id);
    karim = await prendre('Karim', 'Ouali', '612390003', youssef.id);

    // Le ticket rappelle au client qui il a choisi.
    assert.equal(ahmed.coiffeur, 'Youssef');
    assert.equal(sofia.coiffeur, 'Haron');
  });

  await t.test('chacun n a devant lui que sa propre file', async () => {
    // Karim est le 3e arrive du salon, mais le 2e chez Youssef.
    const vueKarim = await banc.client().get('/api/public/tickets/' + karim.jeton);
    assert.equal(vueKarim.body.position, 2);
    assert.equal(vueKarim.body.devant, 1);
    assert.equal(vueKarim.body.coiffeur, 'Youssef');

    // Sofia est 2e arrivee du salon, mais 1re chez Haron.
    const vueSofia = await banc.client().get('/api/public/tickets/' + sofia.jeton);
    assert.equal(vueSofia.body.position, 1);
    assert.equal(vueSofia.body.devant, 0);
    assert.equal(vueSofia.body.phase, 'PROCHAIN');
  });

  await t.test('l ecran du salon montre une file par coiffeur', async () => {
    const r = await coiffeur.get('/api/file');
    const fileYoussef = r.body.file.postes.find((p) => p.id === youssef.id);
    const fileHaron = r.body.file.postes.find((p) => p.id === haron.id);

    assert.deepEqual(fileYoussef.attente.map((x) => x.numero), ['A001', 'A003']);
    assert.deepEqual(fileHaron.attente.map((x) => x.numero), ['A002']);
    assert.equal(fileYoussef.prochain.numero, 'A001');
    // L'attente annoncee au comptoir est celle de la file la plus longue.
    assert.equal(r.body.file.attenteEstimeeMinutes, 40);
  });

  /* ---------------- appeler ---------------- */

  await t.test('« appeler le suivant » prend le suivant DE CE COIFFEUR', async () => {
    const r = await coiffeur.post('/api/file/suivant', { posteId: haron.id });
    assert.equal(r.status, 200);
    // Sofia, pas Ahmed : Ahmed attend Youssef.
    assert.equal(r.body.appele, 'A002');
    assert.equal(r.body.fauteuil, 'Fauteuil 2');
  });

  await t.test('un coiffeur sans personne dans sa file le dit clairement', async () => {
    // On sert Sofia pour vider la file de Haron.
    const file = await coiffeur.get('/api/file');
    const assise = file.body.file.postes.find((p) => p.id === haron.id).client;
    await coiffeur.post('/api/file/' + assise.id + '/servi');

    const r = await coiffeur.post('/api/file/suivant', { posteId: haron.id });
    assert.equal(r.status, 400);
    assert.match(r.body.error.message, /este peluquero/i);
    // Alors que deux personnes attendent bien dans le salon.
    const apres = await coiffeur.get('/api/file');
    assert.equal(apres.body.file.attente.length, 2);
  });

  await t.test('un coiffeur libre peut dépanner la file d un collègue, et ça se lit', async () => {
    const file = await coiffeur.get('/api/file');
    const chezYoussef = file.body.file.postes.find((p) => p.id === youssef.id).attente;
    const aDeplacer = chezYoussef[0];

    const r = await coiffeur.post('/api/file/' + aDeplacer.id + '/appeler', { posteId: haron.id });
    assert.equal(r.status, 200);
    assert.equal(r.body.fauteuil, 'Fauteuil 2');

    const detail = await coiffeur.get('/api/file/' + aDeplacer.id);
    const dernier = detail.body.evenements.at(-1);
    assert.equal(dernier.statut, 'CALLED');
    assert.match(dernier.detail, /movido/);
  });

  /* ---------------- retards ---------------- */

  await t.test('un absent repart en fin de SA file, chez son coiffeur', async () => {
    const file = await coiffeur.get('/api/file');
    const assis = file.body.file.postes.find((p) => p.id === haron.id).client;
    assert.ok(assis);

    const r = await coiffeur.post('/api/file/' + assis.id + '/absent');
    assert.equal(r.status, 200);
    assert.equal(r.body.retards, 1);

    // Il est reparti chez Youssef — son choix d'origine — et non chez Haron,
    // qui ne faisait que le dépanner. Le fauteuil, lui, est bien libéré.
    const ligne = await banc.db.one(
      'SELECT poste_choisi_id, poste_id, statut FROM tickets WHERE numero_affiche = $1',
      [assis.numero],
    );
    assert.equal(ligne.poste_choisi_id, youssef.id, 'le client garde le coiffeur qu’il a choisi');
    assert.equal(ligne.poste_id, null, 'le fauteuil est libéré');
    assert.equal(ligne.statut, 'LATE');

    const apres = await coiffeur.get('/api/file');
    const chezYoussef = apres.body.file.postes.find((p) => p.id === youssef.id).attente;
    assert.equal(chezYoussef.at(-1).numero, assis.numero, 'il est dernier de sa file');
    // Et le fauteuil de Haron est bien libre.
    assert.equal(apres.body.file.postes.find((p) => p.id === haron.id).client, null);
  });

  /* ---------------- fermer un coiffeur ---------------- */

  await t.test('on ne ferme pas un coiffeur qui a une file', async () => {
    const r = await gerant.patch('/api/postes/' + youssef.id, { actif: false });
    assert.equal(r.status, 409);
    assert.match(r.body.error.message, /espera/);
    assert.match(r.body.error.message, /antes de cerrar/);
  });

  /* ---------------- changer de coiffeur ---------------- */

  await t.test('le salon déplace un client vers un autre coiffeur, et il garde son rang', async () => {
    // Deux nouveaux clients chez Youssef, pour avoir de quoi deplacer.
    await banc.reinitialiserDebit();
    const prendre = async (prenom, tel, posteId) => {
      const r = await banc.client().post('/api/public/tickets', { prenom, nom: 'Transfert', telephone: tel, posteId });
      assert.equal(r.status, 201, JSON.stringify(r.body));
      return r.body;
    };
    const premier = await prendre('Nadia', '612390030', youssef.id);
    const second = await prendre('Omar', '612390031', youssef.id);

    const avant = await coiffeur.get('/api/file');
    const chezYoussef = avant.body.file.postes.find((p) => p.id === youssef.id).attente;
    const cible = chezYoussef.find((x) => x.numero === second.numero);

    const r = await coiffeur.post('/api/file/' + cible.id + '/transferer', { posteId: haron.id });
    assert.equal(r.status, 200);
    assert.equal(r.body.transfere, second.numero);
    assert.equal(r.body.fauteuil, 'Fauteuil 2');

    // Il est parti de la file de Youssef et arrive dans celle de Haron.
    const apres = r.body.file;
    const yq = apres.postes.find((p) => p.id === youssef.id).attente.map((x) => x.numero);
    const hq = apres.postes.find((p) => p.id === haron.id).attente.map((x) => x.numero);
    assert.ok(!yq.includes(second.numero));
    assert.ok(hq.includes(second.numero));

    // Son RANG n'a pas bouge : il ne perd pas son heure d'arrivee.
    const ligne = await banc.db.one('SELECT rang, poste_choisi_id FROM tickets WHERE numero_affiche = $1', [second.numero]);
    assert.equal(ligne.poste_choisi_id, haron.id);
    const avantLigne = await banc.db.one('SELECT rang FROM tickets WHERE numero_affiche = $1', [premier.numero]);
    assert.ok(ligne.rang > avantLigne.rang, 'l’ordre d’arrivée est conservé');

    // Et le changement est ecrit dans son historique, DANS LA LANGUE DU SALON.
    //
    // Ce test attendait « Changement de coiffeur » — du francais, dans un salon
    // espagnol. Ce n'etait pas une exigence, c'etait le constat d'une
    // incoherence : l'historique melangeait « Cliente llamado al sillón » et
    // « Tour pris (en ligne) », selon l'humeur de la ligne. Une trace s'ecrit
    // maintenant dans la langue du salon au moment du geste, et elle ne se
    // retraduit jamais apres coup — c'est ce qui en fait une trace.
    const detail = await coiffeur.get('/api/file/' + cible.id);
    assert.match(detail.body.evenements.at(-1).detail, /Cambio de peluquero/);
    assert.match(detail.body.evenements.at(-1).detail, /Haron/);
  });

  await t.test('déplacer vers le coiffeur qu il attend déjà est refusé', async () => {
    const file = await coiffeur.get('/api/file');
    const chezHaron = file.body.file.postes.find((p) => p.id === haron.id).attente[0];
    const r = await coiffeur.post('/api/file/' + chezHaron.id + '/transferer', { posteId: haron.id });
    assert.equal(r.status, 409);
    assert.match(r.body.error.message, /ya está esperando/);
  });

  await t.test('on ne change pas le coiffeur de quelqu un qui est au fauteuil', async () => {
    await coiffeur.post('/api/file/suivant', { posteId: haron.id });
    const file = await coiffeur.get('/api/file');
    const assis = file.body.file.postes.find((p) => p.id === haron.id).client;
    assert.ok(assis);
    const r = await coiffeur.post('/api/file/' + assis.id + '/transferer', { posteId: youssef.id });
    assert.equal(r.status, 409);
    assert.match(r.body.error.message, /en el sillón/);
    await coiffeur.post('/api/file/' + assis.id + '/servi');
  });

  await t.test('un coiffeur fermé ou inconnu est refusé comme destination', async () => {
    const file = await coiffeur.get('/api/file');
    const cible = file.body.file.attente[0];
    const r = await coiffeur.post('/api/file/' + cible.id + '/transferer', {
      posteId: '00000000-0000-4000-8000-000000000000',
    });
    assert.equal(r.status, 404);
  });

  await t.test('déplacer permet enfin de fermer un coiffeur qui avait une file', async () => {
    // On vide la file de Youssef en la deplacant vers Haron.
    let file = await coiffeur.get('/api/file');
    let chezYoussef = file.body.file.postes.find((p) => p.id === youssef.id).attente;
    for (const t2 of chezYoussef) {
      const r = await coiffeur.post('/api/file/' + t2.id + '/transferer', { posteId: haron.id });
      assert.equal(r.status, 200, JSON.stringify(r.body));
    }
    file = await coiffeur.get('/api/file');
    chezYoussef = file.body.file.postes.find((p) => p.id === youssef.id).attente;
    assert.equal(chezYoussef.length, 0);

    const fermeture = await gerant.patch('/api/postes/' + youssef.id, { actif: false });
    assert.equal(fermeture.status, 200);
    assert.equal(fermeture.body.actif, false);
    // Et on le rouvre pour la suite des essais.
    await gerant.patch('/api/postes/' + youssef.id, { actif: true });
  });

  /* ---------------- changement de mode ---------------- */

  await t.test('on ne change pas d organisation avec des clients dans la file', async () => {
    const r = await gerant.put('/api/reglages', { valeurs: { 'file.mode': 'UNIQUE' } });
    assert.equal(r.status, 409);
    assert.match(r.body.error.message, /en la fila de hoy/);
    // Le reglage n'a pas bouge.
    const apres = await gerant.get('/api/reglages');
    assert.equal(apres.body.valeurs['file.mode'], 'PAR_FAUTEUIL');
  });

  await t.test('file vidée, le retour en file unique passe', async () => {
    // On sert tout le monde.
    for (let i = 0; i < 6; i += 1) {
      const file = await coiffeur.get('/api/file');
      const cible = banc.auFauteuil(file.body.file) || file.body.file.attente[0];
      if (!cible) break;
      await coiffeur.post('/api/file/' + cible.id + '/servi');
    }
    const vide = await coiffeur.get('/api/file');
    assert.equal(vide.body.file.attente.length, 0);

    const r = await gerant.put('/api/reglages', { valeurs: { 'file.mode': 'UNIQUE' } });
    assert.equal(r.status, 200);
    assert.equal(r.body.valeurs['file.mode'], 'UNIQUE');
  });

  await t.test('de retour en file unique, le choix du coiffeur n est plus demandé', async () => {
    await banc.reinitialiserDebit();
    const r = await banc.client().post('/api/public/tickets', {
      prenom: 'Mehdi', nom: 'Fassi', telephone: '612390010',
    });
    assert.equal(r.status, 201);
    assert.equal(r.body.coiffeur, null);

    const publique = await banc.client().get('/api/public/file');
    assert.equal(publique.body.mode, 'UNIQUE');
    assert.deepEqual(publique.body.coiffeurs, []);
  });

  await t.test('le formulaire public s adapte au mode', async () => {
    // En file unique : pas de choix de coiffeur.
    const unique = await banc.client().get('/join');
    assert.equal(unique.status, 200);
    assert.ok(!unique.body.includes('name="posteId"'));

    // On revient en file par coiffeur, file vidée d'abord.
    const file = await coiffeur.get('/api/file');
    for (const t2 of file.body.file.attente) await coiffeur.post('/api/file/' + t2.id + '/servi');
    await gerant.put('/api/reglages', { valeurs: { 'file.mode': 'PAR_FAUTEUIL' } });

    const parCoiffeur = await banc.client().get('/join');
    assert.equal(parCoiffeur.status, 200);
    assert.match(parCoiffeur.body, /name="posteId"/);
    assert.match(parCoiffeur.body, /Youssef/);
    assert.match(parCoiffeur.body, /Haron/);
    assert.match(parCoiffeur.body, /Tu barbero/);
  });

  await t.test('le formulaire refuse un envoi sans coiffeur et le redit a l ecran', async () => {
    await banc.reinitialiserDebit();
    const r = await banc.client().requete('POST', '/join',
      { prenom: 'Rachid', nom: 'Amrani', telephone: '612390020', source: 'ONLINE' },
      { formulaire: true });
    assert.equal(r.status, 422);
    assert.match(r.body, /Elige tu peluquero/);
    // Et le formulaire est toujours la, avec les champs remplis.
    assert.match(r.body, /value="Rachid"/);
  });
});
