/**
 * LE SCHEMA SE REJOUE.
 *
 * `schema.sql` est applique A CHAQUE DEMARRAGE du conteneur : c'est la promesse
 * du fichier, et c'est ce qui permet de deployer sans migration a la main.
 *
 * Ce test existe parce que cette promesse a ete FAUSSE en production. La
 * contrainte EXCLUDE des fermetures crее un index portant son nom ; la rejouer
 * leve « relation ... already exists » (42P07), et non 42710 comme une simple
 * contrainte CHECK. Le bloc ne rattrapait que 42710. Resultat : le schema
 * passait sur une base neuve — donc dans tous les tests, qui partent d'une base
 * jetable — et faisait echouer TOUT REDEMARRAGE sur une base existante. Le
 * salon est reste injoignable jusqu'a ce qu'on le voie dans les journaux.
 *
 * Le banc applique deja le schema une fois. Ici, on l'applique une SECONDE
 * fois : c'est exactement ce que fait un redemarrage, et c'est ce qu'aucun test
 * ne faisait.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { IGNORE, demarrer, RACINE } from './banc.js';

const SCHEMA = () => fs.readFileSync(path.join(RACINE, 'server/db/schema.sql'), 'utf8');

test('le schema et les donnees de reference se rejouent sans rien casser', { skip: IGNORE }, async (t) => {
  const banc = await demarrer();
  t.after(() => banc.arreter());

  const rejouer = () => banc.db.transaction(async (tx) => {
    await tx.query("SET LOCAL client_min_messages = 'warning'");
    await tx.query(SCHEMA());
  });

  await t.test('un deuxieme passage aboutit — c est ce que fait un redemarrage', async () => {
    await rejouer();
  });

  await t.test('un troisieme aussi : rien ne s accumule', async () => {
    await rejouer();
  });

  await t.test('les contraintes ne sont pas dupliquees', async () => {
    const n = await banc.db.value(
      `SELECT COUNT(*)::int FROM pg_constraint
        WHERE conname = 'fermetures_sans_chevauchement'
          AND conrelid = 'fermetures'::regclass`,
    );
    assert.equal(n, 1, 'exactement une contrainte d exclusion, pas zero et pas deux');
  });

  await t.test('la contrainte d exclusion fait toujours son travail', async () => {
    const gerant = await banc.connecter('GERANT');
    const un = await gerant.post('/api/fermetures', { du: '2027-07-01', au: '2027-07-15', motif: 'Verano' });
    assert.equal(un.status, 201);

    // Chevauchement : la base doit refuser, sinon le rejeu l'a perdue en route.
    const deux = await gerant.post('/api/fermetures', { du: '2027-07-10', au: '2027-07-20' });
    assert.equal(deux.status, 409, 'deux periodes ne doivent jamais se chevaucher');
  });

  await t.test('les tables attendues sont toutes la, une seule fois chacune', async () => {
    const tables = await banc.db.all(
      `SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        ORDER BY table_name`,
    );
    const noms = tables.map((t2) => t2.table_name);
    for (const attendue of ['app_meta', 'utilisateurs', 'sessions', 'reglages', 'journees',
      'postes', 'fermetures', 'tarifas', 'tickets', 'ticket_evenements', 'envois_whatsapp']) {
      assert.ok(noms.includes(attendue), 'table manquante : ' + attendue);
    }
    assert.equal(new Set(noms).size, noms.length, 'aucune table en double');
  });

  await t.test('le seed rejoue ne touche pas ce que le gerant a change', async () => {
    const gerant = await banc.connecter('GERANT');

    // Le gerant regle sa duree de coupe et renomme son fauteuil.
    assert.equal((await gerant.put('/api/reglages', { valeurs: { 'file.dureeMoyenneMinutes': 35 } })).status, 200);
    const poste = (await gerant.get('/api/postes')).body.items[0];
    assert.equal((await gerant.patch('/api/postes/' + poste.id, { nom: 'Sillón del escaparate' })).status, 200);

    // Une ligne de tarif supprimee ne doit pas revenir d'entre les morts.
    const tarif = (await gerant.get('/api/tarifas')).body.items.find((x) => x.nombre === 'Cejas');
    assert.equal((await gerant.delete('/api/tarifas/' + tarif.id)).status, 204);

    // Le meme module que celui qu'a charge le banc : on rejoue le seed tel que
    // le fait un redemarrage de conteneur.
    const { seed } = await import(pathToFileURL(path.join(RACINE, 'server/db/seed.js')).href);
    await seed({ silencieux: true });

    const reglages = await gerant.get('/api/reglages');
    assert.equal(reglages.body.valeurs['file.dureeMoyenneMinutes'], 35, 'le reglage du gerant reste');

    const postes = await gerant.get('/api/postes');
    assert.equal(postes.body.items.length, 1, 'aucun fauteuil ne reapparait');
    assert.equal(postes.body.items[0].nom, 'Sillón del escaparate', 'le nom choisi reste');

    const tarifas = await gerant.get('/api/tarifas');
    assert.ok(!tarifas.body.items.some((x) => x.nombre === 'Cejas'), 'une ligne supprimee ne revient pas');
  });
});
