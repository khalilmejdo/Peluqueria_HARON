/**
 * ARRET DES PRISES DE TOUR ET CONGES.
 *
 * Deux facons de fermer l'entree de la file, et une regle commune : ce qui est
 * ferme, c'est l'ENTREE, jamais la file. Ceux qui attendent deja sont servis
 * jusqu'au dernier, quoi qu'il arrive.
 *
 *   - ARRET MANUEL : le coiffeur part une heure, ou ne veut plus personne
 *     apres 19 h 30. Un appui, et c'est ferme ; un appui, et ca rouvre.
 *   - CONGES : une periode declaree a l'avance, annoncee aux clients des
 *     maintenant, avec la date de reouverture.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { IGNORE, demarrer } from './banc.js';

const jourPlus = (jour, n) => {
  const [a, m, j] = jour.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, j + n)).toISOString().slice(0, 10);
};

test('le salon peut fermer son entree sans jamais interrompre la file', { skip: IGNORE }, async (t) => {
  const banc = await demarrer();
  t.after(() => banc.arreter());

  const coiffeur = await banc.connecter('COIFFEUR');
  const gerant = await banc.connecter('GERANT');
  const { jourLocal } = await banc.importer('server/core/temps.js');
  const aujourdhui = jourLocal();

  /* ================= arret manuel ================= */

  let dansLaFile;

  await t.test('au depart, les clients peuvent prendre leur tour', async () => {
    const r = await coiffeur.get('/api/file');
    assert.equal(r.body.priseDeTour.ouverte, true);
    assert.equal(r.body.priseDeTour.code, null);

    dansLaFile = await banc.prendreTour('Youssef', 'Benali', '612360001');
    assert.equal(dansLaFile.numero, 'A001');
  });

  await t.test('le coiffeur arrete les prises de tour d un appui', async () => {
    const r = await coiffeur.post('/api/file/prise-de-tour', {
      ouverte: false,
      message: 'Nous ne prenons plus de tour ce soir, à demain 9 h 30.',
    });
    assert.equal(r.status, 200);
    assert.equal(r.body.priseDeTour.ouverte, false);
    assert.equal(r.body.priseDeTour.code, 'PRISE_DE_TOUR_SUSPENDUE');
    assert.match(r.body.priseDeTour.message, /à demain 9 h 30/);
  });

  await t.test('un nouveau client est refuse, avec le message du salon', async () => {
    await banc.reinitialiserDebit();
    const r = await banc.client().post('/api/public/tickets', {
      prenom: 'Karim', nom: 'Tardif', telephone: '612360002',
    });
    assert.equal(r.status, 409);
    assert.equal(r.body.error.code, 'PRISE_DE_TOUR_SUSPENDUE');
    assert.match(r.body.error.message, /à demain 9 h 30/);
  });

  await t.test('la file en cours, elle, n est pas touchee', async () => {
    const r = await coiffeur.get('/api/file');
    assert.equal(r.body.file.attente.length, 1);
    assert.equal(r.body.file.attente[0].numero, 'A001');

    // Et le client qui attend est servi normalement.
    const suivant = await coiffeur.post('/api/file/suivant');
    assert.equal(suivant.status, 200);
    const servi = await coiffeur.post('/api/file/' + banc.auFauteuil(suivant.body.file).id + '/servi');
    assert.equal(servi.status, 200);
    assert.equal(servi.body.file.compteurs.servis, 1);

    // Son lien de suivi fonctionne toujours.
    const vue = await banc.client().get('/api/public/tickets/' + dansLaFile.jeton);
    assert.equal(vue.status, 200);
    assert.equal(vue.body.phase, 'TERMINE');
  });

  await t.test('le coiffeur garde la main pour ajouter quelqu un au comptoir', async () => {
    // Le client est devant lui : une regle qui le contredirait serait
    // contournee avec un papier.
    const r = await coiffeur.post('/api/file/comptoir', {
      prenom: 'Rachid', nom: 'Present', telephone: '612360003',
    });
    assert.equal(r.status, 201);
    assert.equal(r.body.file.attente.length, 1);
  });

  await t.test('l accueil et le formulaire disent la meme chose', async () => {
    const accueil = await banc.client().get('/');
    assert.equal(accueil.status, 200);
    assert.match(accueil.body, /Prise de tour arrêtée/);
    assert.ok(!accueil.body.includes('href="/join"'), 'le bouton ne doit plus etre propose');

    const join = await banc.client().get('/join');
    assert.equal(join.status, 409);
    assert.match(join.body, /Prise de tour arrêtée/);
    assert.ok(!join.body.includes('name="telephone"'), 'le formulaire ne doit pas etre affiche');

    const api = await banc.client().get('/api/public/file');
    assert.equal(api.body.priseDeTour.ouverte, false);
    assert.equal(api.body.priseDeTour.code, 'PRISE_DE_TOUR_SUSPENDUE');
  });

  await t.test('la reprise efface le message d arret', async () => {
    const r = await coiffeur.post('/api/file/prise-de-tour', { ouverte: true });
    assert.equal(r.status, 200);
    assert.equal(r.body.priseDeTour.ouverte, true);
    assert.equal(r.body.priseDeTour.message, null);

    await banc.reinitialiserDebit();
    const client = await banc.client().post('/api/public/tickets', {
      prenom: 'Karim', nom: 'Revenu', telephone: '612360002',
    });
    assert.equal(client.status, 201);

    // Le message de la veille ne doit pas resurgir a la prochaine pause.
    const reglages = await gerant.get('/api/reglages');
    assert.equal(reglages.body.valeurs['file.messagePause'], '');
  });

  /* ================= congés ================= */

  await t.test('le gerant declare une periode de conges', async () => {
    const r = await gerant.post('/api/fermetures', {
      du: aujourdhui,
      au: jourPlus(aujourdhui, 6),
      motif: 'Congés d’été',
    });
    assert.equal(r.status, 201);
    assert.equal(r.body.jours, 7);
  });

  await t.test('pendant les conges, personne ne peut prendre de tour', async () => {
    await banc.reinitialiserDebit();
    const r = await banc.client().post('/api/public/tickets', {
      prenom: 'Sofia', nom: 'Martin', telephone: '612360010',
    });
    assert.equal(r.status, 409);
    assert.equal(r.body.error.code, 'SALON_EN_CONGES');
    // Le message dit la date de reouverture : c'est ce que le client veut savoir.
    assert.match(r.body.error.message, /Congés d’été/);
    assert.match(r.body.error.message, /rouvrons/);
  });

  await t.test('l accueil annonce la fermeture et la date de reouverture', async () => {
    const r = await banc.client().get('/');
    assert.match(r.body, /Salon fermé/);
    assert.match(r.body, /rouvrons/);
  });

  await t.test('les conges l emportent sur l interrupteur du coiffeur', async () => {
    // Meme en « rouvrant » les prises de tour, la periode de conges commande.
    await coiffeur.post('/api/file/prise-de-tour', { ouverte: true });
    const r = await coiffeur.get('/api/file');
    assert.equal(r.body.priseDeTour.ouverte, false);
    assert.equal(r.body.priseDeTour.code, 'SALON_EN_CONGES');
  });

  await t.test('la file du jour reste servie pendant les conges', async () => {
    // Karim a pris son tour juste avant la declaration : il est servi.
    const file = await coiffeur.get('/api/file');
    const karim = file.body.file.attente.find((x) => x.prenom === 'Karim');
    assert.ok(karim, 'le client deja en file doit y rester');
    const r = await coiffeur.post('/api/file/' + karim.id + '/servi');
    assert.equal(r.status, 200);
  });

  await t.test('deux periodes ne peuvent pas se chevaucher', async () => {
    const r = await gerant.post('/api/fermetures', {
      du: jourPlus(aujourdhui, 3),
      au: jourPlus(aujourdhui, 10),
    });
    assert.equal(r.status, 409);
    assert.match(r.body.error.message, /couvre déjà/);
  });

  await t.test('une periode dans le passe est refusee', async () => {
    const r = await gerant.post('/api/fermetures', {
      du: jourPlus(aujourdhui, -30),
      au: jourPlus(aujourdhui, -20),
    });
    assert.equal(r.status, 400);
    assert.match(r.body.error.message, /passé/);
  });

  await t.test('une fin avant le debut est refusee', async () => {
    const r = await gerant.post('/api/fermetures', {
      du: jourPlus(aujourdhui, 20),
      au: jourPlus(aujourdhui, 10),
    });
    assert.equal(r.status, 400);
  });

  await t.test('une fermeture a venir est annoncee aux clients des maintenant', async () => {
    const liste = await gerant.get('/api/fermetures');
    await gerant.delete('/api/fermetures/' + liste.body.items[0].id);

    await gerant.post('/api/fermetures', {
      du: jourPlus(aujourdhui, 14),
      au: jourPlus(aujourdhui, 21),
      motif: 'Fermeture annuelle',
    });

    const accueil = await banc.client().get('/');
    assert.match(accueil.body, /Fermeture à venir/);
    assert.match(accueil.body, /Fermeture annuelle/);
    // Mais la prise de tour, elle, est bien ouverte aujourd'hui.
    await banc.reinitialiserDebit();
    const r = await banc.client().post('/api/public/tickets', {
      prenom: 'Mehdi', nom: 'Aujourdhui', telephone: '612360020',
    });
    assert.equal(r.status, 201);
  });

  await t.test('supprimer une periode rouvre la prise de tour', async () => {
    const liste = await gerant.get('/api/fermetures');
    assert.equal(liste.body.items.length, 1);
    const r = await gerant.delete('/api/fermetures/' + liste.body.items[0].id);
    assert.equal(r.status, 204);

    const apres = await gerant.get('/api/fermetures');
    assert.equal(apres.body.items.length, 0);
    assert.equal(apres.body.prochaine, null);
  });

  await t.test('les conges sont reserves au gerant', async () => {
    assert.equal((await coiffeur.get('/api/fermetures')).status, 403);
    assert.equal((await coiffeur.post('/api/fermetures', { du: aujourdhui, au: aujourdhui })).status, 403);
  });

  /* ================= le champ telephone ================= */

  await t.test('le champ WhatsApp n accepte qu un numero', async () => {
    await banc.reinitialiserDebit();
    for (const mauvais of ['appelle-moi', 'ahmed612345678', '612345678 (Ahmed)', 'six-un-deux', '', '12']) {
      const r = await banc.client().post('/api/public/tickets', {
        prenom: 'Essai', nom: 'Numero', telephone: mauvais,
      });
      assert.equal(r.status, 422, 'aurait du etre refuse : ' + JSON.stringify(mauvais));
      assert.ok(r.body.error.details.fields.telephone);
    }
  });

  await t.test('un numero espagnol s ecrit sans indicatif', async () => {
    await banc.reinitialiserDebit();
    const r = await banc.client().post('/api/public/tickets', {
      prenom: 'Sofia', nom: 'Espagne', telephone: '612 34 56 78',
    });
    assert.equal(r.status, 201);

    // Le serveur a bien rangé le numéro au format international espagnol.
    const { blindIndex } = await banc.importer('server/core/crypto.js');
    const trouve = await banc.db.value('SELECT COUNT(*)::int FROM tickets WHERE telephone_idx = $1', [blindIndex('34612345678')]);
    assert.equal(trouve, 1);
  });

  await t.test('le formulaire impose le clavier numerique et un motif de numero', async () => {
    const r = await banc.client().get('/join');
    assert.equal(r.status, 200);
    assert.match(r.body, /name="telephone" type="tel" inputmode="tel"/);
    assert.match(r.body, /pattern="\[0-9\+\(\)\.\/ -\]\{8,25\}"/);
    // Et l'aide dit la regle espagnole.
    assert.match(r.body, /inutile d’écrire \+34/);
  });
});
