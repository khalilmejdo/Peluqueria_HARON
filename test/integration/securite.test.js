/**
 * SECURITE.
 *
 * Ce que ce fichier verifie, et qui doit rester vrai a chaque modification :
 *
 *   - un client ne peut atteindre QUE son propre ticket, jamais celui d'un
 *     autre, meme en modifiant l'adresse ;
 *   - aucun numero WhatsApp ne sort cote public, sous aucune forme ;
 *   - la file du salon est fermee sans session ;
 *   - le coiffeur ne touche ni aux reglages ni aux comptes ;
 *   - une requete mutante sans jeton CSRF, ou depuis un autre site, est refusee ;
 *   - l'enumeration de jetons est arretee par la limitation de debit ;
 *   - une page de suivi ne finit jamais dans un moteur de recherche.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { IGNORE, demarrer } from './banc.js';

test('les tickets, les numeros et la file sont fermes a qui n y a pas droit', { skip: IGNORE }, async (t) => {
  const banc = await demarrer();
  t.after(() => banc.arreter());

  const coiffeur = await banc.connecter('COIFFEUR');
  const gerant = await banc.connecter('GERANT');

  const ahmed = await banc.prendreTour('Ahmed', 'Benali', '612349001');
  const sofia = await banc.prendreTour('Sofia', 'Martin', '612349002');

  /* ---------------- le ticket d un autre ---------------- */

  await t.test('un jeton inconnu, mal forme ou tronque rend toujours la meme reponse', async () => {
    const anonyme = banc.client();
    const essais = [
      'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',                                  // bien forme, inconnu
      ahmed.jeton.slice(0, -1) + (ahmed.jeton.endsWith('A') ? 'B' : 'A'),  // un caractere change
      ahmed.jeton.slice(0, 20),                                           // tronque
      'court',
      'avec.des.points',
      '%2e%2e%2f',
    ];
    const reponses = [];
    for (const jeton of essais) {
      await banc.reinitialiserDebit();
      const r = await anonyme.get('/api/public/tickets/' + encodeURIComponent(jeton));
      reponses.push({ jeton, statut: r.status, message: r.body?.error?.message });
    }
    // Toutes identiques : rien dans la reponse ne dit lequel des jetons avait
    // la bonne forme, ce qui diviserait d'autant le travail d'un attaquant.
    for (const reponse of reponses) {
      assert.equal(reponse.statut, 404, JSON.stringify(reponse));
      assert.equal(reponse.message, reponses[0].message, 'reponse differente pour : ' + reponse.jeton);
    }
  });

  await t.test('une adresse qui remonte dans l arborescence ne sert aucun fichier', async () => {
    await banc.reinitialiserDebit();
    const anonyme = banc.client();
    // Ces adresses ne ressemblent plus a un jeton : elles n'atteignent aucune
    // route, et surtout elles ne doivent jamais sortir un fichier du serveur.
    for (const chemin of [
      '/api/public/tickets/..%2F..%2F..%2Fetc%2Fpasswd',
      '/img%2F..%2F..%2F.env',
      '/css/../../.env',
      '/..%5C..%5C.env',
      '/.env',
      '/package.json',
      '/server/core/config.js',
    ]) {
      const r = await anonyme.get(chemin);
      assert.equal(r.status, 404, chemin + ' aurait du etre introuvable');
      const texte = typeof r.body === 'string' ? r.body : JSON.stringify(r.body);
      assert.ok(!texte.includes('APP_SECRET'), chemin + ' a laisse fuiter un fichier');
      assert.ok(!texte.includes('DATABASE_URL'), chemin + ' a laisse fuiter un fichier');
    }
  });

  await t.test('le jeton d Ahmed ne donne que le ticket d Ahmed', async () => {
    await banc.reinitialiserDebit();
    const vueAhmed = await banc.client().get('/api/public/tickets/' + ahmed.jeton);
    assert.equal(vueAhmed.body.numero, ahmed.numero);
    assert.equal(vueAhmed.body.prenom, 'Ahmed');

    const vueSofia = await banc.client().get('/api/public/tickets/' + sofia.jeton);
    assert.equal(vueSofia.body.numero, sofia.numero);
    assert.equal(vueSofia.body.prenom, 'Sofia');
    assert.notEqual(ahmed.jeton, sofia.jeton);
  });

  await t.test('connaitre le numero de ticket ne suffit pas a atteindre la page', async () => {
    await banc.reinitialiserDebit();
    // « A001 » est affiche dans le salon : il ne doit donner acces a rien.
    for (const essai of ['A001', 'A002', '1', '00000000-0000-0000-0000-000000000000']) {
      const r = await banc.client().get('/api/public/tickets/' + essai);
      assert.equal(r.status, 404, essai);
    }
  });

  await t.test('l identifiant interne d un ticket ne donne pas non plus acces', async () => {
    const file = await coiffeur.get('/api/file');
    const id = file.body.file.attente[0].id;
    await banc.reinitialiserDebit();
    const r = await banc.client().get('/api/public/tickets/' + id);
    assert.equal(r.status, 404);
  });

  await t.test('un client ne peut pas annuler le tour d un autre', async () => {
    await banc.reinitialiserDebit();
    const r = await banc.client().post('/api/public/tickets/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/annuler');
    assert.equal(r.status, 404);
    // Les deux tickets sont toujours en file.
    const file = await coiffeur.get('/api/file');
    assert.equal(file.body.file.attente.length, 2);
  });

  /* ---------------- les numeros de telephone ---------------- */

  await t.test('aucun numero WhatsApp ne sort par une route publique', async () => {
    await banc.reinitialiserDebit();
    const anonyme = banc.client();
    const reponses = await Promise.all([
      anonyme.get('/api/public/tickets/' + ahmed.jeton),
      anonyme.get('/api/public/file'),
      anonyme.get('/'),
      anonyme.get('/ticket/' + ahmed.jeton),
    ]);
    for (const r of reponses) {
      const texte = typeof r.body === 'string' ? r.body : JSON.stringify(r.body);
      assert.ok(!texte.includes('612349001'), 'un numero a fuite : ' + String(r.status));
      assert.ok(!texte.includes('34612349001'));
      assert.ok(!texte.includes('9001'));
    }
  });

  await t.test('la page de suivi ne contient pas le nom de famille du client', async () => {
    await banc.reinitialiserDebit();
    const r = await banc.client().get('/ticket/' + ahmed.jeton);
    assert.equal(r.status, 200);
    // Le prenom suffit a reconnaitre son ticket ; le nom de famille sur une
    // page qu'on montre a son voisin dans la salle d'attente, non.
    assert.ok(r.body.includes('Ahmed'));
    assert.ok(!r.body.includes('Benali'));
  });

  await t.test('le numero n est jamais dans le journal du serveur', async () => {
    const { _redact } = await banc.importer('server/core/logger.js');
    const expurge = _redact({ telephone: '34612349001', whatsapp: '34612349001', jeton: 'secret', prenom: 'Ahmed' });
    assert.equal(expurge.telephone, '[expurge]');
    assert.equal(expurge.whatsapp, '[expurge]');
    assert.equal(expurge.jeton, '[expurge]');
    assert.equal(expurge.prenom, 'Ahmed');
  });

  await t.test('la base ne contient le numero ni en clair ni le jeton en clair', async () => {
    const ligne = await banc.db.one('SELECT telephone_enc, telephone_idx, jeton_hash, jeton_enc FROM tickets LIMIT 1');
    for (const valeur of Object.values(ligne)) {
      assert.ok(!String(valeur).includes('612349001'), 'un numero est lisible en base');
    }
    assert.ok(!String(ligne.jeton_hash).includes(ahmed.jeton));
    assert.ok(!String(ligne.jeton_enc).includes(ahmed.jeton));
  });

  /* ---------------- la file du salon ---------------- */

  await t.test('sans session, la file du salon est fermee', async () => {
    const anonyme = banc.client();
    for (const chemin of ['/api/file', '/api/file/flux', '/api/statistiques/jour', '/api/reglages', '/api/comptes']) {
      const r = await anonyme.get(chemin);
      assert.equal(r.status, 401, chemin + ' devrait exiger une session');
    }
    const ecriture = await anonyme.post('/api/file/suivant');
    assert.ok([401, 403].includes(ecriture.status), 'statut inattendu : ' + ecriture.status);
  });

  await t.test('le coiffeur tient la file mais ne touche ni aux reglages ni aux comptes', async () => {
    assert.equal((await coiffeur.get('/api/file')).status, 200);
    assert.equal((await coiffeur.get('/api/statistiques/jour')).status, 200);

    for (const chemin of ['/api/reglages', '/api/comptes', '/api/statistiques/historique', '/api/service/etat']) {
      const r = await coiffeur.get(chemin);
      assert.equal(r.status, 403, chemin + ' devrait etre reserve au gerant');
      assert.match(r.body.error.message, /gerente/);
    }
    const ecriture = await coiffeur.put('/api/reglages', { valeurs: { 'file.dureeMoyenneMinutes': 5 } });
    assert.equal(ecriture.status, 403);
  });

  await t.test('le gerant, lui, passe partout', async () => {
    assert.equal((await gerant.get('/api/file')).status, 200);
    assert.equal((await gerant.get('/api/reglages')).status, 200);
    assert.equal((await gerant.get('/api/comptes')).status, 200);
  });

  /* ---------------- CSRF et origine ---------------- */

  await t.test('une ecriture du personnel sans jeton CSRF est refusee', async () => {
    const sansJeton = banc.client();
    sansJeton.cookie = coiffeur.cookie;
    sansJeton.csrf = '';
    const r = await sansJeton.post('/api/file/suivant');
    assert.equal(r.status, 403);
    assert.equal(r.body.error.code, 'CSRF_INVALIDE');
  });

  await t.test('un jeton CSRF emprunte a une autre session ne marche pas', async () => {
    const melange = banc.client();
    melange.cookie = coiffeur.cookie;
    melange.csrf = gerant.csrf;
    const r = await melange.post('/api/file/suivant');
    assert.equal(r.status, 403);
    assert.equal(r.body.error.code, 'CSRF_INVALIDE');
  });

  await t.test('une requete venue d un autre site est refusee avant tout le reste', async () => {
    const r = await coiffeur.requete('POST', '/api/file/suivant', {}, {
      entetes: { Origin: 'https://un-autre-site.example' },
    });
    assert.equal(r.status, 403);
    assert.equal(r.body.error.code, 'ORIGINE_REFUSEE');

    // Y compris sur une route publique : la prise de tour n'est pas un
    // formulaire qu'un site tiers peut soumettre a la place du client.
    const publique = await banc.client().requete('POST', '/api/public/tickets',
      { prenom: 'Robot', nom: 'Distant', telephone: '612349100' },
      { entetes: { Origin: 'https://un-autre-site.example' } });
    assert.equal(publique.status, 403);
  });

  await t.test('le cookie de session est HttpOnly et SameSite=Strict', async () => {
    const cl = banc.client();
    const compte = await banc.compte('COIFFEUR', { identifiant: 'cookie-essai' });
    const r = await cl.post('/api/auth/login', { identifiant: compte.identifiant, motDePasse: 'Banc-Essai-Salon-42' });
    const cookie = r.headers.get('set-cookie');
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /SameSite=Strict/);
    assert.match(cookie, /Path=\//);
  });

  /* ---------------- debit et robots ---------------- */

  await t.test('l enumeration de jetons est arretee par la limitation de debit', async () => {
    await banc.reinitialiserDebit();
    const anonyme = banc.client();
    let refus = 0;
    // Le profil de suivi autorise 240 lectures par tranche de dix minutes : un
    // client qui recharge sa page passe, un robot qui balaie non.
    for (let i = 0; i < 300; i += 1) {
      const r = await anonyme.get('/api/public/tickets/' + 'A'.repeat(32));
      if (r.status === 429) {
        refus += 1;
        assert.ok(r.headers.get('retry-after'), 'un 429 doit dire quand revenir');
      }
    }
    assert.ok(refus > 0, 'aucune requete refusee : l enumeration serait libre');
  });

  await t.test('un meme numero ne peut pas inonder la file', async () => {
    await banc.reinitialiserDebit();
    const numero = '612349500';
    let refuse = null;
    for (let i = 0; i < 8 && !refuse; i += 1) {
      const r = await banc.client().post('/api/public/tickets', {
        prenom: 'Robot', nom: 'Insistant', telephone: numero,
      });
      if (r.status === 429) refuse = r;
    }
    assert.ok(refuse, 'le meme numero aurait du finir par etre arrete');
    assert.equal(refuse.body.error.code, 'TROP_DE_DEMANDES');
    // Le message dit la vraie attente, pas « patientez un instant ».
    assert.match(refuse.body.error.message, /minuto|hora|segundo/);
  });

  /* ---------------- referencement ---------------- */

  await t.test('une page de suivi ne finit jamais dans un moteur de recherche', async () => {
    await banc.reinitialiserDebit();
    const r = await banc.client().get('/ticket/' + sofia.jeton);
    assert.equal(r.status, 200);
    assert.match(r.body, /<meta name="robots" content="noindex, nofollow, noarchive">/);
    // La page d'accueil, elle, doit etre indexable.
    const accueil = await banc.client().get('/');
    assert.match(accueil.body, /<meta name="robots" content="index, follow">/);
  });

  await t.test('les en-tetes de securite sont poses sur toutes les pages', async () => {
    const r = await banc.client().get('/');
    assert.match(r.headers.get('content-security-policy'), /script-src 'self'/);
    assert.ok(!r.headers.get('content-security-policy').includes('unsafe-inline'));
    assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(r.headers.get('x-frame-options'), 'DENY');
    assert.match(r.headers.get('referrer-policy'), /strict-origin/);
  });

  await t.test('la page publique ne contient ni script ni style en ligne', async () => {
    for (const chemin of ['/', '/join', '/affiche']) {
      const r = await banc.client().get(chemin);
      assert.equal(r.status, 200, chemin);
      assert.ok(!/<script(?![^>]*\ssrc=)[^>]*>[\s\S]*?\S/.test(r.body), chemin + ' contient un script en ligne');
      assert.ok(!/\sstyle="/.test(r.body), chemin + ' contient un style en ligne');
      assert.ok(!/\son[a-z]+=/i.test(r.body), chemin + ' contient un gestionnaire en ligne');
    }
  });

  /* ---------------- comptes ---------------- */

  await t.test('un compte ne peut pas retirer ses propres droits de gerant', async () => {
    const moi = await gerant.get('/api/auth/session');
    const r = await gerant.patch('/api/comptes/' + moi.body.utilisateur.id, { role: 'COIFFEUR' });
    assert.equal(r.status, 403);
    assert.match(r.body.error.message, /tus propios permisos/i);
  });

  await t.test('le salon garde toujours au moins un gerant actif', async () => {
    const comptes = await gerant.get('/api/comptes');
    const gerants = comptes.body.items.filter((c) => c.role === 'GERANT' && c.actif);
    // Un seul gerant dans ce banc : le desactiver depuis un autre compte doit
    // etre refuse, sinon plus personne ne peut regler le salon.
    assert.equal(gerants.length, 1);
    const autre = await banc.connecter('GERANT', { identifiant: 'second-gerant' });
    const r = await autre.patch('/api/comptes/' + gerants[0].id, { actif: false });
    // Deux gerants actifs desormais : la desactivation passe.
    assert.equal(r.status, 200);
    const apres = await autre.get('/api/comptes');
    assert.equal(apres.body.items.filter((c) => c.role === 'GERANT' && c.actif).length, 1);
    // Le dernier, en revanche, est protege.
    const moi = await autre.get('/api/auth/session');
    const refus = await autre.patch('/api/comptes/' + moi.body.utilisateur.id, { actif: false });
    assert.equal(refus.status, 403);
  });

  await t.test('un compte desactive perd sa session sur-le-champ', async () => {
    const r = await coiffeur.get('/api/file');
    assert.equal(r.status, 200);
    await banc.db.query('UPDATE utilisateurs SET actif = FALSE WHERE identifiant_lower = $1', ['coiffeur']);
    const apres = await coiffeur.get('/api/file');
    assert.equal(apres.status, 401);
  });
});
