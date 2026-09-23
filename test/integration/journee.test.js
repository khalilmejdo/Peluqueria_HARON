/**
 * LA JOURNEE.
 *
 * La file active est celle d'aujourd'hui, et d'elle seule. Les tickets de la
 * veille ne sont jamais effaces — les statistiques s'appuient dessus — mais ils
 * ne peuvent plus apparaitre dans la file ni etre modifies.
 *
 * Deux chemins menent a la cloture, et les deux sont verifies ici :
 *   - le chemin PARESSEUX, declenche par le premier geste d'une journee neuve ;
 *   - le chemin VOLONTAIRE, le bouton « clôturer la journée » du gerant.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { IGNORE, demarrer } from './banc.js';

test('une nouvelle journee part d une file vide et d une numerotation neuve', { skip: IGNORE }, async (t) => {
  const banc = await demarrer();
  t.after(() => banc.arreter());

  const salon = await banc.connecter('COIFFEUR');
  const gerant = await banc.connecter('GERANT');
  const { newId, encrypt, blindIndex, hashToken, jetonSuivi } = await banc.importer('server/core/crypto.js');
  const { jourLocal } = await banc.importer('server/core/temps.js');

  const aujourdhui = jourLocal();
  const veille = new Date(Date.UTC(...aujourdhui.split('-').map((n, i) => (i === 1 ? Number(n) - 1 : Number(n)))));
  veille.setUTCDate(veille.getUTCDate() - 1);
  const hier = veille.toISOString().slice(0, 10);

  const jetonsHier = [];

  await t.test('on fabrique une journee de la veille, restee ouverte', async () => {
    await banc.db.query(
      'INSERT INTO journees (jour, ouverte, dernier_numero, dernier_rang, duree_moyenne_minutes) VALUES ($1, TRUE, 3, 3, 20)',
      [hier],
    );
    for (let i = 1; i <= 3; i += 1) {
      const jeton = jetonSuivi();
      jetonsHier.push(jeton);
      await banc.db.query(
        `INSERT INTO tickets (id, jour, numero, numero_affiche, rang, prenom, nom,
                              telephone_enc, telephone_idx, telephone_fin, source, statut, jeton_hash, jeton_enc)
         VALUES ($1,$2,$3,$4,$3,$5,'Hier',$6,$7,'0001','ONLINE','WAITING',$8,$9)`,
        [newId(), hier, i, 'A00' + i, 'Client' + i,
          encrypt('3461234500' + i), blindIndex('3461234500' + i), hashToken(jeton), encrypt(jeton)],
      );
    }
    const restants = await banc.db.value("SELECT COUNT(*)::int FROM tickets WHERE jour = $1 AND statut = 'WAITING'", [hier]);
    assert.equal(restants, 3);
  });

  await t.test('la file du jour ignore completement la veille', async () => {
    const r = await salon.get('/api/file');
    assert.equal(r.status, 200);
    assert.equal(r.body.file.jour, aujourdhui);
    assert.equal(r.body.file.attente.length, 0);
    assert.equal(r.body.file.compteurs.total, 0);
  });

  await t.test('le premier ticket du jour clot la veille au passage', async () => {
    const premier = await banc.prendreTour('Sofia', 'Martin', '612345801');
    // La numerotation repart a A001, quoi qu'il se soit passe hier.
    assert.equal(premier.numero, 'A001');

    const journeeHier = await banc.db.one('SELECT ouverte, close_at, close_par FROM journees WHERE jour = $1', [hier]);
    assert.equal(journeeHier.ouverte, false);
    assert.ok(journeeHier.close_at);
    assert.equal(journeeHier.close_par, 'nouvelle journée');
  });

  await t.test('les tours non servis de la veille sont annules, jamais effaces', async () => {
    const lignes = await banc.db.all('SELECT statut, motif FROM tickets WHERE jour = $1 ORDER BY numero', [hier]);
    assert.equal(lignes.length, 3, 'les tickets de la veille doivent rester en base');
    for (const ligne of lignes) {
      assert.equal(ligne.statut, 'CANCELLED');
      assert.match(ligne.motif, /Journée terminée/);
    }
    // L'historique de chacun porte la trace de la cloture.
    const evenements = await banc.db.value(
      "SELECT COUNT(*)::int FROM ticket_evenements WHERE jour = $1 AND statut = 'CANCELLED'",
      [hier],
    );
    assert.equal(evenements, 3);
  });

  await t.test('un client de la veille voit un tour termine, pas une erreur', async () => {
    const r = await banc.client().get('/api/public/tickets/' + jetonsHier[0]);
    assert.equal(r.status, 200);
    assert.equal(r.body.jour, hier);
    assert.equal(r.body.phase, 'ANNULE');
    assert.equal(r.body.actif, false);
  });

  await t.test('un ticket d une journee close ne bouge plus, quoi qu il arrive', async () => {
    // Le garde-fou est dans la BASE, pas dans le code : meme une ecriture
    // directe est refusee. C'est ce qui protege l'historique d'un onglet reste
    // ouvert sur la tablette depuis la veille.
    await assert.rejects(
      () => banc.db.query("UPDATE tickets SET statut = 'WAITING' WHERE jour = $1", [hier]),
      (err) => {
        assert.equal(err.code, 'HR001');
        assert.match(err.message, /close/);
        return true;
      },
    );
    await assert.rejects(() => banc.db.query('DELETE FROM tickets WHERE jour = $1', [hier]));
  });

  await t.test('les statistiques gardent la veille', async () => {
    const r = await gerant.get('/api/statistiques/historique?limite=10');
    assert.equal(r.status, 200);
    const ligneHier = r.body.items.find((x) => x.jour === hier);
    assert.ok(ligneHier, 'la veille doit apparaitre dans l historique');
    assert.equal(ligneHier.total, 3);
    assert.equal(ligneHier.annules, 3);
    assert.equal(ligneHier.servis, 0);
  });

  await t.test('le gerant clot sa journee a la main', async () => {
    await banc.prendreTour('Rachid', 'Amrani', '612345802');
    const avant = await salon.get('/api/file');
    assert.equal(avant.body.file.attente.length, 2);

    const r = await gerant.post('/api/file/cloturer');
    assert.equal(r.status, 200);
    assert.equal(r.body.annules, 2);
    assert.equal(r.body.file.ouverte, false);
    assert.equal(r.body.file.attente.length, 0);
  });

  await t.test('une journee close refuse tout nouveau geste, avec une phrase claire', async () => {
    const r = await banc.client().post('/api/public/tickets', {
      prenom: 'Tardif', nom: 'Client', telephone: '612345803',
    });
    assert.equal(r.status, 409);
    assert.equal(r.body.error.code, 'JOURNEE_CLOSE');
    assert.match(r.body.error.message, /clôturé sa journée/);

    const suivant = await salon.post('/api/file/suivant');
    assert.ok(suivant.status === 400 || suivant.status === 409, 'statut inattendu : ' + suivant.status);
  });

  await t.test('cloturer deux fois ne fait rien de plus', async () => {
    const r = await gerant.post('/api/file/cloturer');
    assert.equal(r.status, 200);
    assert.equal(r.body.deja, true);
    assert.equal(r.body.annules, 0);
  });

  await t.test('la cloture est reservee au gerant', async () => {
    const r = await salon.post('/api/file/cloturer');
    assert.equal(r.status, 403);
    assert.match(r.body.error.message, /gérant/);
  });
});
