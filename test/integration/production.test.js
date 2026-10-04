/**
 * MISE EN PRODUCTION : ce que la campagne d'attaque du 4 octobre 2026 a trouve.
 *
 * Une journee simulee (trois coiffeurs, cent cinquante clients, soixante flux
 * temps reel) et une serie d'attaques ont mis au jour des defauts reels. Chacun
 * est reproduit ici, contre l'application et une base reelles.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import http from 'node:http';
import { IGNORE, demarrer } from './banc.js';

/** Une requete ecrite a la main : fetch normaliserait la cible « // ». */
function brute(base, ligne, entetes = 'Host: 127.0.0.1') {
  const { port } = new URL(base);
  return new Promise((resolve) => {
    const s = net.connect(port, '127.0.0.1');
    let rep = '';
    s.on('data', (d) => { rep += d; });
    s.on('close', () => resolve(rep.split('\r\n')[0]));
    s.on('error', () => resolve('ERREUR'));
    s.write(ligne + '\r\n' + entetes + '\r\nConnection: close\r\n\r\n');
  });
}

/** Ouvre un flux et rend { statut, fermer, ferme } une fois les en-tetes recus. */
function ouvrirFlux(base, chemin) {
  return new Promise((resolve) => {
    const req = http.get(base + chemin, (res) => {
      const f = { statut: res.statusCode, ferme: false, fermer: () => req.destroy() };
      res.on('data', () => {});
      res.on('end', () => { f.ferme = true; });
      res.on('close', () => { f.ferme = true; });
      res.on('error', () => {});
      resolve(f);
    });
    req.on('error', () => resolve({ statut: 0, ferme: true, fermer() {} }));
  });
}

test('mise en production : les defauts trouves en attaquant', { skip: IGNORE }, async (t) => {
  const banc = await demarrer();
  t.after(() => banc.arreter());
  const flux = await banc.importer('server/core/flux.js');
  const ouverts = [];
  t.after(() => ouverts.forEach((f) => f.fermer()));

  await t.test('une cible « // » ou un Host illisible rend 400, et le serveur survit', async () => {
    for (const [ligne, hote] of [['GET // HTTP/1.1'], ['GET //[ HTTP/1.1'], ['GET / HTTP/1.1', 'Host: a:99999']]) {
      const statut = await brute(banc.base, ligne, hote);
      assert.match(statut, / 400 /, ligne + ' ' + (hote || ''));
    }
    const sante = await fetch(banc.base + '/healthz');
    assert.equal(sante.status, 200);
  });

  await t.test('une requete refusee avant lecture de son corps ne garde pas le socket', async () => {
    // Origine etrangere : refusee AVANT de lire le corps. Le corps annonce
    // n'arrive jamais. Avant, Node attendait ce corps indefiniment.
    const { port } = new URL(banc.base);
    const t0 = Date.now();
    const duree = await new Promise((resolve) => {
      const s = net.connect(port, '127.0.0.1');
      s.write('POST /api/public/tickets HTTP/1.1\r\nHost: 127.0.0.1:' + port + '\r\nOrigin: https://ailleurs.example\r\n'
        + 'Content-Type: application/json\r\nContent-Length: 200\r\n\r\n{"pre');
      s.on('data', () => {});
      s.on('close', () => resolve(Date.now() - t0));
      setTimeout(() => { s.destroy(); resolve(-1); }, 8000);
    });
    assert.ok(duree >= 0 && duree < 6000, 'socket encore ouvert apres 8 s');
  });

  await t.test('un chemin de quinze mille « / » ne gele pas le serveur', async () => {
    const t0 = performance.now();
    const statut = await brute(banc.base, 'GET /a' + '/'.repeat(15000) + 'x HTTP/1.1');
    assert.match(statut, / 404 /);
    assert.ok(performance.now() - t0 < 150, 'trop lent : ' + Math.round(performance.now() - t0) + ' ms');
  });

  await t.test('toute une salle d attente sur le meme wifi garde son suivi en direct', async () => {
    await banc.reinitialiserDebit();
    const lettres = 'abcdefghijklmnopqrstuvwxyz';
    const jetons = [];
    for (let i = 0; i < 26; i += 1) {
      const r = await banc.prendreTour('Wifi' + lettres[i], 'Salon', '6128000' + String(i).padStart(2, '0'));
      jetons.push(r.jeton);
    }
    // Tous depuis 127.0.0.1 : chaque client ouvre sa page, puis son flux deux
    // fois (le telephone se rallume). Avant : 429 au-dela de quarante flux pour
    // l'adresse entiere — et EventSource ne se reconnecte jamais apres un 429.
    for (const jeton of jetons) {
      assert.equal((await banc.client().get('/ticket/' + jeton)).status, 200);
      for (let k = 0; k < 2; k += 1) {
        const f = await ouvrirFlux(banc.base, '/api/public/tickets/' + jeton + '/flux');
        ouverts.push(f);
        assert.equal(f.statut, 200, 'flux refuse au client ' + jeton.slice(0, 4));
      }
    }
  });

  await t.test('un meme ticket ne cumule pas les flux : le plus ancien est ferme', async () => {
    const { jeton } = await banc.prendreTour('Cumul', 'Flux', '612899001');
    const avant = flux.nombreAbonnes();
    const f = [];
    for (let k = 0; k < 5; k += 1) {
      f.push(await ouvrirFlux(banc.base, '/api/public/tickets/' + jeton + '/flux'));
      ouverts.push(f[k]);
    }
    await new Promise((r) => setTimeout(r, 150));
    assert.equal(flux.nombreAbonnes() - avant, 3);
    assert.ok(f[0].ferme && f[1].ferme, 'les deux plus anciens auraient du etre fermes');
    assert.ok(!f[4].ferme);
  });

  await t.test('essayer des jetons au hasard est arrete, sans gener le voisin legitime', async () => {
    await banc.reinitialiserDebit();
    const faux = () => 'x'.repeat(8) + Math.random().toString(36).slice(2).padEnd(24, 'y');
    let premier429 = null;
    for (let i = 0; i < 35; i += 1) {
      const r = await banc.client().get('/api/public/tickets/' + faux());
      if (r.status === 429) { premier429 = i; break; }
      assert.equal(r.status, 404);
    }
    assert.equal(premier429, 31, 'trente echecs admis, le trente-et-unieme refuse');
    await banc.reinitialiserDebit();
  });

  await t.test('au comptoir, en file par coiffeur, on choisit le coiffeur', async () => {
    const gerant = await banc.connecter('GERANT');
    await banc.db.query("UPDATE tickets SET statut = 'CANCELLED' WHERE statut IN ('WAITING','LATE','CALLED','IN_SERVICE')");
    const m = await gerant.put('/api/reglages', { valeurs: { 'file.mode': 'PAR_FAUTEUIL' } });
    assert.equal(m.status, 200, JSON.stringify(m.body));
    const postes = (await gerant.get('/api/postes')).body;
    const poste = postes.items.find((p) => p.actif);

    const sans = await gerant.post('/api/file/comptoir', { prenom: 'Mostrador', nom: 'Uno', telephone: '612899101' });
    assert.equal(sans.status, 422);
    const avec = await gerant.post('/api/file/comptoir', { prenom: 'Mostrador', nom: 'Uno', telephone: '612899101', posteId: poste.id });
    assert.equal(avec.status, 201, JSON.stringify(avec.body));
    const ticket = avec.body.file.attente.find((x) => x.numero === avec.body.numero);
    assert.equal(ticket.posteChoisiId, poste.id);

    await banc.db.query("UPDATE tickets SET statut = 'CANCELLED' WHERE statut IN ('WAITING','LATE')");
    assert.equal((await gerant.put('/api/reglages', { valeurs: { 'file.mode': 'UNIQUE' } })).status, 200);
  });

  await t.test('un numero deja en file : le public n apprend pas son numero de tour', async () => {
    await banc.reinitialiserDebit();
    const premier = await banc.prendreTour('Doble', 'Numero', '612899201');
    const r = await banc.client().post('/api/public/tickets', { prenom: 'Otro', nom: 'Alguien', telephone: '612899201' });
    assert.equal(r.status, 409);
    assert.equal(r.body.error.code, 'TOUR_DEJA_PRIS');
    assert.ok(!r.body.error.message.includes(premier.numero), r.body.error.message);
    // Le personnel, lui, a le client devant lui : on le lui dit.
    const salon = await banc.connecter('COIFFEUR');
    const c = await salon.post('/api/file/comptoir', { prenom: 'Doble', nom: 'Numero', telephone: '612899201' });
    assert.equal(c.status, 409);
    assert.ok(c.body.error.message.includes(premier.numero));
  });

  await t.test('cinq mots de passe faux ne deconnectent pas la tablette deja ouverte', async () => {
    const tablette = await banc.connecter('GERANT', { identifiant: 'tablette' });
    for (let i = 0; i < 6; i += 1) {
      await banc.client().post('/api/auth/login', { identifiant: 'tablette', motDePasse: 'mauvais-' + i });
    }
    const verrou = await banc.client().post('/api/auth/login', { identifiant: 'tablette', motDePasse: 'encore-faux' });
    assert.equal(verrou.status, 429, 'le compte aurait du etre verrouille');
    // La session ouverte avec le bon mot de passe continue de travailler.
    const r = await tablette.get('/api/file');
    assert.equal(r.status, 200, 'la tablette a ete deconnectee par un attaquant');
    await banc.db.query("UPDATE utilisateurs SET tentatives_echouees = 0, verrouille_jusqu_a = NULL WHERE identifiant_lower = 'tablette'");
  });

  await t.test('des echecs simultanes sont tous comptes (verrou non contournable)', async () => {
    await banc.compte('GERANT', { identifiant: 'rafale' });
    await Promise.all(Array.from({ length: 4 }, (_, i) => banc.client().post('/api/auth/login', { identifiant: 'rafale', motDePasse: 'rafale-' + i })));
    const { n } = await banc.db.one("SELECT tentatives_echouees AS n FROM utilisateurs WHERE identifiant_lower = 'rafale'");
    assert.equal(n, 4, 'quatre echecs simultanes, ' + n + ' comptes');
  });

  await t.test('une cle d ecran trop courte ne protege pas les noms complets', async () => {
    const gerant = await banc.connecter('GERANT');
    const r = await gerant.put('/api/reglages', { valeurs: { 'pantalla.nombres': 'COMPLETO', 'pantalla.clave': '1' } });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const cle = (await banc.db.one("SELECT valeur FROM reglages WHERE cle = 'pantalla.clave'")).valeur;
    assert.ok(cle.length >= 20, 'cle conservee : ' + cle);
    // Et une cle courte posee APRES coup, noms complets deja actifs, aussi.
    await gerant.put('/api/reglages', { valeurs: { 'pantalla.clave': 'abc' } });
    const ensuite = (await banc.db.one("SELECT valeur FROM reglages WHERE cle = 'pantalla.clave'")).valeur;
    assert.ok(ensuite.length >= 20, 'cle conservee : ' + ensuite);
    await gerant.put('/api/reglages', { valeurs: { 'pantalla.nombres': 'NOMBRE', 'pantalla.clave': '' } });
  });
});
