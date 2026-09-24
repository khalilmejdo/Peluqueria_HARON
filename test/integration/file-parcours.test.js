/**
 * LE PARCOURS NOMINAL, de bout en bout.
 *
 * Un client prend son tour en ligne, un autre scanne le QR Code du salon, un
 * troisieme est ajoute au comptoir. Ils entrent tous dans LA MEME file, dans
 * l'ordre de leur arrivee. Le coiffeur appelle, sert, et la file avance.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { IGNORE, demarrer } from './banc.js';

test('la file du salon, du premier ticket au dernier client servi', { skip: IGNORE }, async (t) => {
  const banc = await demarrer();
  t.after(() => banc.arreter());

  const salon = await banc.connecter('COIFFEUR');

  await t.test('une file neuve est vide', async () => {
    const r = await salon.get('/api/file');
    assert.equal(r.status, 200);
    assert.equal(r.body.file.attente.length, 0);
    assert.equal(banc.auFauteuil(r.body.file), null);
    assert.equal(r.body.file.prochain, null);
    assert.equal(r.body.file.compteurs.total, 0);
  });

  let youssef;
  let ahmed;
  let karim;
  let mehdi;

  await t.test('en ligne et par QR Code, c est la meme file et le meme ordre', async () => {
    youssef = await banc.prendreTour('Youssef', 'Benali', '612345601', 'ONLINE');
    ahmed = await banc.prendreTour('Ahmed', 'Mejdoubi', '612345602', 'QR');
    karim = await banc.prendreTour('Karim', 'Ouali', '612345603', 'ONLINE');
    mehdi = await banc.prendreTour('Mehdi', 'Fassi', '612345604', 'QR');

    // La numerotation repart a A001 chaque journee.
    assert.equal(youssef.numero, 'A001');
    assert.equal(ahmed.numero, 'A002');
    assert.equal(karim.numero, 'A003');
    assert.equal(mehdi.numero, 'A004');

    const r = await salon.get('/api/file');
    const ordre = r.body.file.attente.map((x) => x.numero);
    assert.deepEqual(ordre, ['A001', 'A002', 'A003', 'A004']);
    // L'origine est affichee au coiffeur mais n'a pas touche a l'ordre.
    assert.deepEqual(r.body.file.attente.map((x) => x.source), ['ONLINE', 'QR', 'ONLINE', 'QR']);
  });

  await t.test('la position et l estimation rendues au client sont justes', async () => {
    assert.equal(youssef.position, 1);
    assert.equal(youssef.devant, 0);
    assert.equal(mehdi.devant, 3);
    // Duree moyenne par defaut : 20 minutes.
    assert.equal(mehdi.estimationMinutes, 60);
    assert.match(mehdi.estimationTexte, /1 h/);
  });

  await t.test('le client suit son tour depuis son lien, et rien d autre', async () => {
    const anonyme = banc.client();
    const r = await anonyme.get('/api/public/tickets/' + mehdi.jeton);
    assert.equal(r.status, 200);
    assert.equal(r.body.numero, 'A004');
    assert.equal(r.body.prenom, 'Mehdi');
    assert.equal(r.body.devant, 3);
    assert.equal(r.body.phase, 'ATTENTE');
    // Rien sur les autres clients, rien sur son propre numero de telephone.
    const texte = JSON.stringify(r.body);
    assert.ok(!texte.includes('Youssef'));
    assert.ok(!texte.includes('612345604'));
    assert.ok(!texte.includes('Benali'));
  });

  await t.test('le client repart avec un lien qu il peut copier et s envoyer', async () => {
    // Le lien EST le ticket : sans compte ni mot de passe, c'est le seul moyen
    // de revenir. Il doit donc etre visible, copiable, et mis en avant juste
    // apres la prise de tour — et tout cela sans rien coûter au salon.
    const page = await banc.client().get('/ticket/' + mehdi.jeton + '?nouveau=1');
    assert.equal(page.status, 200);
    assert.match(page.body, /Guarda este enlace/);
    assert.match(page.body, /data-copier/);
    assert.match(page.body, /data-partager/);
    // L'adresse complete est affichee, pour pouvoir la recopier a la main.
    assert.ok(page.body.includes('/ticket/' + mehdi.jeton), 'le lien doit être affiché en entier');

    // Sans « nouveau », le bloc est toujours la, simplement moins insistant.
    const ordinaire = await banc.client().get('/ticket/' + mehdi.jeton);
    assert.match(ordinaire.body, /Tu enlace de seguimiento/);
    assert.ok(!ordinaire.body.includes('Guarda este enlace'));
  });

  await t.test('appeler le suivant prend le premier de la file', async () => {
    const r = await salon.post('/api/file/suivant');
    assert.equal(r.status, 200);
    assert.equal(r.body.appele, 'A001');
    assert.equal(banc.auFauteuil(r.body.file).numero, 'A001');
    assert.equal(banc.auFauteuil(r.body.file).statut, 'CALLED');
    assert.equal(r.body.file.attente.length, 3);
    assert.equal(r.body.file.prochain.numero, 'A002');
  });

  await t.test('le client appele voit « c est votre tour »', async () => {
    const r = await banc.client().get('/api/public/tickets/' + youssef.jeton);
    assert.equal(r.body.phase, 'VOTRE_TOUR');
    assert.equal(r.body.devant, 0);
    assert.match(r.body.titre, /tu turno/i);
  });

  await t.test('un seul client au fauteuil a la fois', async () => {
    const r = await salon.post('/api/file/suivant');
    assert.equal(r.status, 409);
    assert.equal(r.body.error.code, 'FAUTEUIL_OCCUPE');
    // Le message nomme qui occupe le fauteuil : c'est ce que le coiffeur
    // a besoin de savoir pour decider.
    assert.match(r.body.error.message, /A001/);
  });

  await t.test('servir le client fait avancer toute la file', async () => {
    const avant = await salon.get('/api/file');
    const idEnCours = banc.auFauteuil(avant.body.file).id;

    const r = await salon.post('/api/file/' + idEnCours + '/servi');
    assert.equal(r.status, 200);
    assert.equal(r.body.servi, 'A001');
    assert.equal(banc.auFauteuil(r.body.file), null);
    assert.equal(r.body.file.compteurs.servis, 1);
    assert.deepEqual(r.body.file.attente.map((x) => x.numero), ['A002', 'A003', 'A004']);

    // Les personnes devant chacun ont diminue d'autant.
    const vueMehdi = await banc.client().get('/api/public/tickets/' + mehdi.jeton);
    assert.equal(vueMehdi.body.devant, 2);
    assert.equal(vueMehdi.body.estimationMinutes, 40);
  });

  await t.test('un client servi disparait de la file active et passe a l historique', async () => {
    const r = await salon.get('/api/file');
    assert.ok(!r.body.file.attente.some((x) => x.numero === 'A001'));
    const historique = r.body.file.termines.find((x) => x.numero === 'A001');
    assert.ok(historique);
    assert.equal(historique.statut, 'COMPLETED');

    const vue = await banc.client().get('/api/public/tickets/' + youssef.jeton);
    assert.equal(vue.body.phase, 'TERMINE');
    assert.equal(vue.body.actif, false);
  });

  await t.test('le coiffeur peut servir sans passer par l appel', async () => {
    const file = await salon.get('/api/file');
    const cible = file.body.file.attente.find((x) => x.numero === 'A002');
    const r = await salon.post('/api/file/' + cible.id + '/servi');
    assert.equal(r.status, 200);
    assert.equal(r.body.file.compteurs.servis, 2);
  });

  await t.test('appeler puis commencer la coupe', async () => {
    const file = await salon.get('/api/file');
    const cible = file.body.file.attente.find((x) => x.numero === 'A003');

    const appel = await salon.post('/api/file/' + cible.id + '/appeler');
    assert.equal(banc.auFauteuil(appel.body.file).statut, 'CALLED');

    const debut = await salon.post('/api/file/' + cible.id + '/commencer');
    assert.equal(banc.auFauteuil(debut.body.file).statut, 'IN_SERVICE');

    const vue = await banc.client().get('/api/public/tickets/' + karim.jeton);
    assert.equal(vue.body.phase, 'EN_COURS');

    await salon.post('/api/file/' + cible.id + '/servi');
  });

  await t.test('un client peut renoncer a son tour et liberer sa place', async () => {
    const avant = await salon.get('/api/file');
    assert.equal(avant.body.file.attente.length, 1);

    const r = await banc.client().post('/api/public/tickets/' + mehdi.jeton + '/annuler');
    assert.equal(r.status, 200);
    assert.equal(r.body.statut, 'CANCELLED');

    const apres = await salon.get('/api/file');
    assert.equal(apres.body.file.attente.length, 0);
    assert.equal(apres.body.file.compteurs.annules, 1);
  });

  await t.test('le meme numero ne peut pas occuper deux places', async () => {
    await banc.reinitialiserDebit();
    await banc.prendreTour('Sofia', 'Martin', '612345610');
    const r = await banc.client().post('/api/public/tickets', {
      prenom: 'Sofia', nom: 'Martin', telephone: '612345610',
    });
    assert.equal(r.status, 409);
    assert.equal(r.body.error.code, 'TOUR_DEJA_PRIS');
    // Le lien de suivi n'est PAS renvoye : sinon, deviner un numero de
    // telephone suffirait a recuperer le ticket de quelqu'un d'autre.
    assert.ok(!JSON.stringify(r.body).includes('jeton'));
    assert.ok(!JSON.stringify(r.body).includes('/ticket/'));
  });

  await t.test('le meme numero redevient admis une fois son tour termine', async () => {
    const file = await salon.get('/api/file');
    const sofia = file.body.file.attente.find((x) => x.prenom === 'Sofia');
    await salon.post('/api/file/' + sofia.id + '/servi');

    await banc.reinitialiserDebit();
    const r = await banc.client().post('/api/public/tickets', {
      prenom: 'Sofia', nom: 'Martin', telephone: '612345610',
    });
    assert.equal(r.status, 201);
  });

  await t.test('le coiffeur ajoute un client au comptoir, dans la meme file', async () => {
    const r = await salon.post('/api/file/comptoir', {
      prenom: 'Rachid', nom: 'Amrani', telephone: '612345699',
    });
    assert.equal(r.status, 201);
    const ajoute = r.body.file.attente.find((x) => x.numero === r.body.numero);
    assert.equal(ajoute.source, 'COMPTOIR');
    // Il recoit lui aussi un lien de suivi : le coiffeur peut le lui envoyer.
    assert.match(r.body.lien, /\/ticket\/[A-Za-z0-9_-]{22,}$/);
  });

  await t.test('l historique d un ticket raconte tout ce qui lui est arrive', async () => {
    const file = await salon.get('/api/file');
    const rachid = file.body.file.attente.find((x) => x.prenom === 'Rachid');
    const r = await salon.get('/api/file/' + rachid.id);

    assert.equal(r.status, 200);
    assert.equal(r.body.ticket.source, 'COMPTOIR');
    // Le numero n'est jamais rendu en entier dans un detail : seuls les quatre
    // derniers chiffres, de quoi verifier qu'on parle du bon client.
    assert.equal(r.body.ticket.telephoneFin, '5699');
    assert.ok(!JSON.stringify(r.body).includes('34612345699'));
    assert.ok(r.body.evenements.length >= 1);
    assert.equal(r.body.evenements[0].statut, 'WAITING');
  });

  await t.test('le lien WhatsApp du coiffeur porte le message complet', async () => {
    const file = await salon.get('/api/file');
    const rachid = file.body.file.attente.find((x) => x.prenom === 'Rachid');
    const r = await salon.get('/api/file/' + rachid.id + '/whatsapp');

    assert.equal(r.status, 200);
    assert.equal(r.body.telephone, '34612345699');
    assert.ok(r.body.lienWhatsapp.startsWith('https://wa.me/34612345699?text='));
    assert.ok(r.body.texte.includes('Rachid'));
    assert.ok(r.body.lienSuivi.includes('/ticket/'));
  });

  await t.test('les chiffres du jour recoupent la file', async () => {
    const r = await salon.get('/api/statistiques/jour');
    assert.equal(r.status, 200);
    // Servis : A001 Youssef, A002 Ahmed, A003 Karim, puis Sofia.
    assert.equal(r.body.servis, 4);
    // Annules : Mehdi, qui a rendu sa place lui-meme.
    assert.equal(r.body.annules, 1);
    // Venus par le QR Code du salon : Ahmed et Mehdi.
    assert.equal(r.body.parQr, 2);
    assert.equal(r.body.auComptoir, 1);
    // Sept tickets : quatre du depart, les deux de Sofia, et Rachid.
    assert.equal(r.body.total, 7);
    // Deux restent en file : le second tour de Sofia et Rachid.
    assert.equal(r.body.actifs, 2);
    // Une attente moyenne a bien ete mesuree sur les clients servis.
    assert.ok(Number.isInteger(r.body.attenteMoyenneMinutes));
  });

  // En dernier : ce test cree un ticket, et decalerait les comptes au-dessus.
  await t.test('la prise de tour renvoie sur le suivi, en mettant le lien en avant', async () => {
    await banc.reinitialiserDebit();
    const r = await banc.client().requete('POST', '/join',
      { prenom: 'Leila', nom: 'Berrada', telephone: '612345650', source: 'ONLINE' },
      { formulaire: true });
    // 303 : un rafraichissement ne repostera pas le formulaire, et « nouveau »
    // met le lien a garder en evidence.
    assert.equal(r.status, 303);
    assert.match(r.headers.get('location'), /^\/ticket\/[A-Za-z0-9_-]{22,}\?nouveau=1$/);

    const suivi = await banc.client().get(r.headers.get('location'));
    assert.equal(suivi.status, 200);
    assert.match(suivi.body, /Guarda este enlace/);
  });
});
