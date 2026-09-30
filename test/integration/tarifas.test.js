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

/**
 * L'espace INSECABLE qui separe le nombre de son symbole.
 *
 * Ce n'est pas une coquetterie : dans la colonne etroite des tarifs, un espace
 * ordinaire laisse « 24,90 » en fin de ligne et « € » orphelin dessous. Le test
 * l'ecrit explicitement parce que la difference est invisible a l'oeil dans un
 * message d'echec — deux chaines qui paraissent identiques et ne le sont pas.
 */
const NBSP = '\u00a0';
const prix = (texte) => texte.replace(' ', NBSP);

/**
 * DEUX NOMS QUI N'EXISTENT PAS DANS LA FICHE DE DEPART.
 *
 * Ce fichier a longtemps cree « Tinte », « Mechas » et « Peinado » : les trois
 * figurent dans la fiche de quinze lignes que pose le seed, donc les creations
 * repondaient 409 au lieu de 201 et la moitie du fichier tombait. Personne ne
 * l'avait vu, parce que ces tests demandent une base et n'avaient jamais tourne.
 */
const NOUVEAU = 'Prueba de tinte';
const NOUVEAU_2 = 'Prueba de mechas';
const NOUVEAU_3 = 'Prueba de peinado';

/** Une ligne de la fiche de depart, celle du salon : « Corte normal », 7 €. */
const DEPART = 'Corte normal';
const DEPART_CTS = 700;

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
    const corte = r.body.items.find((x) => x.nombre === DEPART);
    assert.ok(corte, 'la coupe simple doit y etre');
    assert.equal(corte.precioCts, DEPART_CTS);
    assert.equal(corte.precio, prix('7 €'));
  });

  await t.test('un prix se tape comme on l ecrit et revient identique', async () => {
    const r = await gerant.post('/api/tarifas', { nombre: NOUVEAU, precio: '24,90', nota: 'Consultar antes' });
    assert.equal(r.status, 201);
    // Le centime est un ENTIER : aucune derive de flottant sur le chemin.
    assert.equal(r.body.precioCts, 2490);
    assert.equal(r.body.precio, prix('24,90 €'));
    assert.equal(r.body.nota, 'Consultar antes');
    assert.equal(r.body.visible, true);
  });

  await t.test('les ecritures tolerees donnent le meme centime', async () => {
    const avecEuro = await gerant.post('/api/tarifas', { nombre: NOUVEAU_2, precio: '35 €' });
    assert.equal(avecEuro.status, 201);
    assert.equal(avecEuro.body.precioCts, 3500);
    assert.equal(avecEuro.body.precio, prix('35 €'));

    const avecPoint = await gerant.post('/api/tarifas', { nombre: NOUVEAU_3, precio: '12.50' });
    assert.equal(avecPoint.status, 201);
    assert.equal(avecPoint.body.precioCts, 1250);
    assert.equal(avecPoint.body.precio, prix('12,50 €'));
  });

  await t.test('un prix qui n en est pas un est refuse, pas devine', async () => {
    for (const precio of ['gratis', '14,999', '-5', '1001', '14,90,50']) {
      const r = await gerant.post('/api/tarifas', { nombre: 'Prueba ' + precio, precio });
      assert.equal(r.status, 400, 'refus attendu pour « ' + precio + ' »');
    }
  });

  await t.test('deux lignes du meme nom sont impossibles', async () => {
    // La casse ne protege de rien : l'index unique travaille sur le nom normalise.
    const r = await gerant.post('/api/tarifas', { nombre: DEPART.toUpperCase(), precio: '9' });
    assert.equal(r.status, 409);
    assert.equal(r.body.error.code, 'TARIFA_DUPLICADA');
  });

  await t.test('renommer vers un nom deja pris est refuse aussi', async () => {
    const liste = (await gerant.get('/api/tarifas')).body.items;
    const tinte = liste.find((x) => x.nombre === NOUVEAU);
    const r = await gerant.patch('/api/tarifas/' + tinte.id, { nombre: DEPART });
    assert.equal(r.status, 409);
    assert.equal(r.body.error.code, 'TARIFA_DUPLICADA');
  });

  await t.test('une ligne masquee sort de la vitrine sans perdre son prix', async () => {
    const liste = (await gerant.get('/api/tarifas')).body.items;
    const mechas = liste.find((x) => x.nombre === NOUVEAU_2);

    const cache = await gerant.patch('/api/tarifas/' + mechas.id, { visible: false });
    assert.equal(cache.status, 200);
    assert.equal(cache.body.visible, false);
    assert.equal(cache.body.precioCts, 3500, 'le prix reste, c est tout l interet de masquer');

    const apres = await gerant.get('/api/tarifas');
    assert.equal(apres.body.visibles, apres.body.items.length - 1);

    // La vitrine ne la montre plus.
    const accueil = await banc.client().get('/');
    assert.equal(accueil.status, 200);
    assert.ok(!accueil.body.includes(NOUVEAU_2), 'une ligne masquee ne doit pas sortir en vitrine');
    assert.ok(accueil.body.includes(DEPART), 'les lignes visibles, si');
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

    /*
     * LES LIGNES MASQUEES PASSENT EN DERNIER, QUEL QUE SOIT L'ORDRE ENVOYE.
     *
     * La liste du gerant est triee « visible d'abord, puis ordre » : une ligne
     * retiree de la vitrine descend en bas de l'ecran, ou elle ne gene plus la
     * lecture de celles qui comptent. Le rang qu'on lui donne est bien
     * enregistre — il la replacera au bon endroit le jour ou elle revient — mais
     * il ne la fait pas remonter tant qu'elle est masquee.
     *
     * Ce test attendait l'ordre envoye tel quel, ce qui n'a jamais pu passer des
     * lors qu'une ligne etait masquee juste avant. Il verifie maintenant le vrai
     * contrat : l'ordre demande, a l'interieur de chaque groupe.
     */
    const visibles = new Map(avant.map((x) => [x.id, x.visible]));
    const attendu = [
      ...inverse.filter((id) => visibles.get(id)),
      ...inverse.filter((id) => !visibles.get(id)),
    ];
    assert.deepEqual(r.body.items.map((x) => x.id), attendu);

    // Et l'ordre tient apres relecture : il est en base, pas a l'ecran.
    const relu = (await gerant.get('/api/tarifas')).body.items.map((x) => x.id);
    assert.deepEqual(relu, attendu);
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
    // Plus de fiche de prix, et plus AUCUN montant nulle part : le formulaire
    // de reservation, qui vit maintenant dans la vitrine, montrait encore le
    // prix de chaque prestation. Les prestations restent (leur duree fait
    // l'attente), mais sans montant.
    assert.ok(!accueil.body.includes('seccion--tarifas'), 'la fiche de prix a disparu');
    assert.ok(!/\d\u00a0€/.test(accueil.body), 'plus aucun montant en vitrine');
    assert.ok(accueil.body.includes('presta__case'), 'les prestations restent choisissables');
    assert.ok(accueil.body.includes('id="reserver"'), 'le reste de la vitrine tient toujours');
  });
});
