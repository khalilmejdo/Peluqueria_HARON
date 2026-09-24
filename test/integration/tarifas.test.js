/**
 * LA FICHE DE PRIX.
 *
 * Elle s'affiche en vitrine : une faute se lit depuis la rue. Ce qui doit
 * rester vrai :
 *
 *   - un prix tape « 14,90 » revient « 14,90 € », sans un centime de derive ;
 *   - deux lignes ne peuvent JAMAIS porter le meme nom (index unique en base) ;
 *   - un prix hors du plausible est refuse, pas tronque ;
 *   - l'ordre affiche au gerant est celui que verra le client ;
 *   - une ligne masquee disparait de la vitrine mais garde son prix ;
 *   - le coiffeur peut LIRE la fiche (on lui demande un prix au comptoir) mais
 *     pas la modifier.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { IGNORE, demarrer } from './banc.js';

test('la fiche de prix se tient depuis l espace de gestion', { skip: IGNORE }, async (t) => {
  const banc = await demarrer();
  t.after(() => banc.arreter());

  const gerant = await banc.connecter('GERANT');
  const coiffeur = await banc.connecter('COIFFEUR');

  await t.test('le salon demarre avec une fiche de depart, en espagnol', async () => {
    const r = await gerant.get('/api/tarifas');
    assert.equal(r.status, 200);
    assert.ok(r.body.items.length >= 5, 'la fiche de depart ne doit pas etre vide');
    assert.equal(r.body.visibles, r.body.items.length);
    const corte = r.body.items.find((x) => x.nombre === 'Corte de pelo');
    assert.ok(corte, 'la coupe simple doit y etre');
    assert.equal(corte.precioCts, 1400);
    assert.equal(corte.precio, '14 €');
  });

  await t.test('un prix se tape comme on l ecrit et revient identique', async () => {
    const r = await gerant.post('/api/tarifas', { nombre: 'Tinte', precio: '24,90', nota: 'Consultar antes' });
    assert.equal(r.status, 201);
    // Le centime est un ENTIER : aucune derive de flottant sur le chemin.
    assert.equal(r.body.precioCts, 2490);
    assert.equal(r.body.precio, '24,90 €');
    assert.equal(r.body.nota, 'Consultar antes');
    assert.equal(r.body.visible, true);
  });

  await t.test('les ecritures tolerees donnent le meme centime', async () => {
    const avecEuro = await gerant.post('/api/tarifas', { nombre: 'Mechas', precio: '35 €' });
    assert.equal(avecEuro.status, 201);
    assert.equal(avecEuro.body.precioCts, 3500);
    assert.equal(avecEuro.body.precio, '35 €');

    const avecPoint = await gerant.post('/api/tarifas', { nombre: 'Peinado', precio: '12.50' });
    assert.equal(avecPoint.status, 201);
    assert.equal(avecPoint.body.precioCts, 1250);
    assert.equal(avecPoint.body.precio, '12,50 €');
  });

  await t.test('un prix qui n en est pas un est refuse, pas devine', async () => {
    for (const precio of ['gratis', '14,999', '-5', '1001', '14,90,50']) {
      const r = await gerant.post('/api/tarifas', { nombre: 'Prueba ' + precio, precio });
      assert.equal(r.status, 400, 'refus attendu pour « ' + precio + ' »');
    }
  });

  await t.test('deux lignes du meme nom sont impossibles', async () => {
    const r = await gerant.post('/api/tarifas', { nombre: 'corte DE pelo', precio: '9' });
    assert.equal(r.status, 409);
    assert.equal(r.body.error.code, 'TARIFA_DUPLICADA');
  });

  await t.test('renommer vers un nom deja pris est refuse aussi', async () => {
    const liste = (await gerant.get('/api/tarifas')).body.items;
    const tinte = liste.find((x) => x.nombre === 'Tinte');
    const r = await gerant.patch('/api/tarifas/' + tinte.id, { nombre: 'Corte de pelo' });
    assert.equal(r.status, 409);
    assert.equal(r.body.error.code, 'TARIFA_DUPLICADA');
  });

  await t.test('une ligne masquee sort de la vitrine sans perdre son prix', async () => {
    const liste = (await gerant.get('/api/tarifas')).body.items;
    const mechas = liste.find((x) => x.nombre === 'Mechas');

    const cache = await gerant.patch('/api/tarifas/' + mechas.id, { visible: false });
    assert.equal(cache.status, 200);
    assert.equal(cache.body.visible, false);
    assert.equal(cache.body.precioCts, 3500, 'le prix reste, c est tout l interet de masquer');

    const apres = await gerant.get('/api/tarifas');
    assert.equal(apres.body.visibles, apres.body.items.length - 1);

    // La vitrine ne la montre plus.
    const accueil = await banc.client().get('/');
    assert.equal(accueil.status, 200);
    assert.ok(!accueil.body.includes('Mechas'), 'une ligne masquee ne doit pas sortir en vitrine');
    assert.ok(accueil.body.includes('Corte de pelo'), 'les lignes visibles, si');
  });

  await t.test('l ordre affiche est celui de la vitrine, et les fleches le changent', async () => {
    const avant = (await gerant.get('/api/tarifas')).body.items.map((x) => x.nombre);
    const second = avant[1];

    const r = await gerant.post('/api/tarifas/' + (await gerant.get('/api/tarifas')).body.items[1].id + '/mover', { sens: 'arriba' });
    assert.equal(r.status, 200);
    assert.equal(r.body.bouge, true);

    const apres = r.body.items.map((x) => x.nombre);
    assert.equal(apres[0], second, 'la ligne montee doit etre premiere');
    assert.equal(apres.length, avant.length, 'monter une ligne n en perd aucune');
    assert.deepEqual([...apres].sort(), [...avant].sort(), 'ce sont les memes lignes, dans un autre ordre');
  });

  await t.test('monter la premiere ligne ne casse rien et ne bouge rien', async () => {
    const avant = (await gerant.get('/api/tarifas')).body.items.map((x) => x.nombre);
    const r = await gerant.post('/api/tarifas/' + (await gerant.get('/api/tarifas')).body.items[0].id + '/mover', { sens: 'arriba' });
    assert.equal(r.status, 200);
    assert.equal(r.body.bouge, false);
    assert.deepEqual(r.body.items.map((x) => x.nombre), avant);
  });

  await t.test('le glisser-deposer envoie l ordre complet, et il est applique', async () => {
    const avant = (await gerant.get('/api/tarifas')).body.items;
    // On renverse la fiche : c'est ce que fait un gerant qui reorganise.
    const inverse = [...avant].reverse().map((x) => x.id);

    const r = await gerant.post('/api/tarifas/orden', { ids: inverse });
    assert.equal(r.status, 200);
    assert.deepEqual(r.body.items.map((x) => x.id), inverse);

    // Et l'ordre tient apres relecture : il est en base, pas a l'ecran.
    const relu = (await gerant.get('/api/tarifas')).body.items.map((x) => x.id);
    assert.deepEqual(relu, inverse);
  });

  await t.test('un ordre qui ne correspond plus a la fiche est refuse', async () => {
    const ids = (await gerant.get('/api/tarifas')).body.items.map((x) => x.id);

    // Une ligne manquante : l'ecran travaillait sur une fiche perimee.
    const ampute = await gerant.post('/api/tarifas/orden', { ids: ids.slice(1) });
    assert.equal(ampute.status, 409);
    assert.equal(ampute.body.error.code, 'TARIFAS_DESFASADAS');

    // Un doublon : appliquer perdrait silencieusement une ligne.
    const double = await gerant.post('/api/tarifas/orden', { ids: [ids[0], ...ids] });
    assert.equal(double.status, 400);

    // Un identifiant inconnu.
    const inconnu = await gerant.post('/api/tarifas/orden', {
      ids: [...ids.slice(1), '11111111-1111-1111-1111-111111111111'],
    });
    assert.equal(inconnu.status, 409);

    // Apres ces trois refus, la fiche n'a pas bouge d'un pouce.
    const apres = (await gerant.get('/api/tarifas')).body.items.map((x) => x.id);
    assert.deepEqual(apres, ids, 'un refus ne doit rien avoir ecrit');
  });

  await t.test('reordonner est reserve au gerant', async () => {
    const ids = (await coiffeur.get('/api/tarifas')).body.items.map((x) => x.id);
    assert.equal((await coiffeur.post('/api/tarifas/orden', { ids })).status, 403);
  });

  await t.test('un sens inconnu est refuse', async () => {
    const premier = (await gerant.get('/api/tarifas')).body.items[0];
    const r = await gerant.post('/api/tarifas/' + premier.id + '/mover', { sens: 'de-travers' });
    assert.equal(r.status, 400);
  });

  await t.test('le coiffeur lit la fiche mais ne la touche pas', async () => {
    const lecture = await coiffeur.get('/api/tarifas');
    assert.equal(lecture.status, 200, 'on lui demande un prix au comptoir');

    const ecriture = await coiffeur.post('/api/tarifas', { nombre: 'Barba gratis', precio: '0' });
    assert.equal(ecriture.status, 403);

    const premier = lecture.body.items[0];
    assert.equal((await coiffeur.patch('/api/tarifas/' + premier.id, { precio: '1' })).status, 403);
    assert.equal((await coiffeur.delete('/api/tarifas/' + premier.id)).status, 403);
  });

  await t.test('le public ne peut pas lire l API de la fiche', async () => {
    const r = await banc.client().get('/api/tarifas');
    assert.equal(r.status, 401, 'la fiche s affiche dans la page, pas par une API ouverte');
  });

  await t.test('une ligne se supprime vraiment : aucun ticket ne la reference', async () => {
    const liste = (await gerant.get('/api/tarifas')).body.items;
    const peinado = liste.find((x) => x.nombre === 'Peinado');
    assert.equal((await gerant.delete('/api/tarifas/' + peinado.id)).status, 204);

    const apres = (await gerant.get('/api/tarifas')).body.items;
    assert.ok(!apres.some((x) => x.nombre === 'Peinado'));
    assert.equal((await gerant.delete('/api/tarifas/' + peinado.id)).status, 404);
  });

  await t.test('la section entiere se retire depuis les reglages', async () => {
    const r = await gerant.put('/api/reglages', { valeurs: { 'tarifas.visible': false } });
    assert.equal(r.status, 200);

    const accueil = await banc.client().get('/');
    assert.ok(!accueil.body.includes('Corte de pelo'), 'plus aucun prix en vitrine');
    assert.ok(accueil.body.includes('Cómo funciona'), 'le reste de la vitrine tient toujours');
  });
});
