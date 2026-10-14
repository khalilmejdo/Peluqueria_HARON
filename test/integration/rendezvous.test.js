/**
 * LES RENDEZ-VOUS ET LA MARQUE, contre l'application et une base reelles.
 *
 * Le parcours d'un client (voir les heures, reserver, consulter, annuler), les
 * gestes du salon (agenda, arrive, installer, deplacer), les garanties de la
 * base (jamais deux rendez-vous sur le meme fauteuil a la meme heure) et les
 * droits de l'administrateur de la plateforme sur la marque.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { IGNORE, demarrer } from './banc.js';

const plusJours = (iso, n) => {
  const [a, m, j] = iso.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, j + n)).toISOString().slice(0, 10);
};

test('rendez-vous et marque blanche', { skip: IGNORE }, async (t) => {
  const banc = await demarrer();
  t.after(() => banc.arreter());
  const { jourLocal } = await banc.importer('server/core/temps.js');
  const gerant = await banc.connecter('GERANT');
  const coiffeur = await banc.connecter('COIFFEUR');
  const demain = plusJours(jourLocal(), 1);
  let prestation;
  let poste;

  await t.test('sans horaires ni activation, la reservation est fermee et le dit', async () => {
    const offre = await banc.client().get('/api/public/rdv/offre');
    assert.equal(offre.status, 200);
    assert.equal(offre.body.etat.ouvert, false);
    assert.equal(offre.body.etat.raison, 'INACTIFS');
    const page = await banc.client().get('/rendez-vous');
    assert.equal(page.status, 409);
    assert.ok(!page.body.includes('name="telephone"'), 'aucun formulaire quand on ne peut pas reserver');
  });

  await t.test('le gerant ouvre les rendez-vous : horaires, activation', async () => {
    const valeurs = { 'horaires.actifs': true, 'rdv.actifs': true, 'rdv.pasMinutes': 30, 'rdv.delaiMinutes': 0 };
    for (let j = 0; j < 7; j += 1) {
      valeurs['horaires.' + j + '.ouverture'] = '09:00';
      valeurs['horaires.' + j + '.fermeture'] = '19:00';
      valeurs['horaires.' + j + '.pauseDebut'] = '13:00';
      valeurs['horaires.' + j + '.pauseFin'] = '15:00';
    }
    const r = await gerant.put('/api/reglages', { valeurs });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const offre = await banc.client().get('/api/public/rdv/offre');
    assert.equal(offre.body.etat.ouvert, true);
    prestation = offre.body.prestations[0];
    poste = offre.body.professionnels[0];
    assert.ok(prestation.id && prestation.duracionMin > 0);
    // Rien de personnel dans l'offre.
    assert.ok(!JSON.stringify(offre.body).includes('telephone'));
  });

  await t.test('le calendrier et les heures respectent les horaires et la coupure', async () => {
    const cal = await banc.client().get('/api/public/rdv/calendrier?tarifaIds=' + prestation.id);
    assert.equal(cal.status, 200);
    const jour = cal.body.jours.find((j) => j.jour === demain);
    assert.ok(jour && jour.libres > 0, 'demain devrait avoir des heures');
    const r = await banc.client().get('/api/public/rdv/creneaux?jour=' + demain + '&tarifaIds=' + prestation.id);
    const heures = r.body.creneaux.map((c) => c.heure);
    assert.equal(heures[0], '09:00');
    assert.ok(heures.every((h) => h < '13:00' || h >= '15:00'), 'aucune heure pendant la coupure : ' + heures.join(' '));
    // Seules les heures sortent : jamais quel fauteuil est libre.
    assert.deepEqual(Object.keys(r.body.creneaux[0]).sort(), ['heure', 'minutes']);
  });

  await t.test('reserver : confirme, puis l heure disparait de ce fauteuil', async () => {
    await banc.reinitialiserDebit();
    const r = await banc.client().post('/api/public/rdv', {
      prenom: 'Lucia', nom: 'Navarro', telephone: '612500001', tarifaIds: [prestation.id], posteId: poste.id, jour: demain, heure: '10:00',
    });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    assert.equal(r.body.heure, '10:00');
    assert.equal(r.body.statut, 'CONFIRME');
    assert.match(r.body.lien, /\/rdv\/[A-Za-z0-9_-]{20,}$/);
    const apres = await banc.client().get('/api/public/rdv/creneaux?jour=' + demain + '&tarifaIds=' + prestation.id + '&posteId=' + poste.id);
    assert.ok(!apres.body.creneaux.some((c) => c.heure === '10:00'));
    // Le telephone n'est nulle part en clair dans la base.
    const ligne = await banc.db.one('SELECT telephone_enc, telephone_fin, jeton_hash FROM rendez_vous LIMIT 1');
    assert.ok(!ligne.telephone_enc.includes('612500001'));
    assert.equal(ligne.telephone_fin, '0001');
    assert.ok(!r.body.lien.includes(ligne.jeton_hash));
  });

  await t.test('deux clients sur la meme heure du meme fauteuil : un seul l obtient', async () => {
    await banc.reinitialiserDebit();
    const demande = (n) => banc.client().post('/api/public/rdv', {
      prenom: 'Rival', nom: 'Simultane', telephone: '61250010' + n, tarifaIds: [prestation.id], posteId: poste.id, jour: demain, heure: '11:00',
    });
    const reponses = await Promise.all([demande(1), demande(2), demande(3)]);
    assert.equal(reponses.filter((r) => r.status === 201).length, 1, reponses.map((r) => r.status).join(','));
    for (const r of reponses.filter((x) => x.status !== 201)) {
      assert.equal(r.status, 409);
      assert.ok(['CRENEAU_PRIS', 'CRENEAU_INDISPONIBLE'].includes(r.body.error.code), r.body.error.code);
    }
    const n = await banc.db.one("SELECT COUNT(*)::int AS n FROM rendez_vous WHERE statut = 'CONFIRME' AND to_char(debut AT TIME ZONE 'Europe/Madrid', 'HH24:MI') = '11:00'");
    assert.equal(n.n, 1);
  });

  await t.test('sans preference de fauteuil : jamais plus de rendez-vous a une heure que de fauteuils', async () => {
    await banc.reinitialiserDebit();
    // Un jour a part : les tests suivants comptent sur les heures de demain.
    const plusTard = plusJours(jourLocal(), 5);
    const fauteuils = (await banc.db.one('SELECT COUNT(*)::int AS n FROM postes WHERE actif')).n;
    const demande = (n) => banc.client().post('/api/public/rdv', {
      prenom: 'Foule', nom: 'Simultanee', telephone: '6125007' + String(n).padStart(2, '0'), tarifaIds: [prestation.id], jour: plusTard, heure: '12:00',
    });
    const reponses = await Promise.all(Array.from({ length: fauteuils + 4 }, (_, i) => demande(i)));
    const prises = reponses.filter((r) => r.status === 201).length;
    assert.ok(prises >= 1 && prises <= fauteuils, prises + ' rendez-vous pour ' + fauteuils + ' fauteuil(s) : ' + reponses.map((r) => r.status).join(','));
    for (const r of reponses.filter((x) => x.status !== 201)) assert.equal(r.status, 409, JSON.stringify(r.body));
    // Aucun fauteuil ne porte deux rendez-vous qui se recouvrent.
    const doubles = await banc.db.one(`SELECT COUNT(*)::int AS n FROM rendez_vous a JOIN rendez_vous b
      ON a.poste_id = b.poste_id AND a.id < b.id AND a.debut < b.fin AND b.debut < a.fin
      WHERE a.statut = 'CONFIRME' AND b.statut = 'CONFIRME'`);
    assert.equal(doubles.n, 0);
    // L'heure prise n'est plus proposee a la cliente suivante.
    const apres = await banc.client().get('/api/public/rdv/creneaux?jour=' + plusTard + '&tarifaIds=' + prestation.id);
    if (prises === fauteuils) assert.ok(!apres.body.creneaux.some((c) => c.heure === '12:00'), '12:00 encore proposee alors que tout est pris');
  });

  await t.test('la base refuse elle-meme un chevauchement, quel que soit le code', async () => {
    const un = await banc.db.one("SELECT poste_id, debut, fin FROM rendez_vous WHERE statut = 'CONFIRME' LIMIT 1");
    await assert.rejects(
      () => banc.db.query(
        `INSERT INTO rendez_vous (id, jour, debut, fin, poste_id, prenom, nom, telephone_enc, telephone_idx, telephone_fin, duree_min, jeton_hash)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, 'X', 'Y', 'e', 'i', '0000', 30, 'jeton-de-test')`,
        [demain, un.debut, un.fin, un.poste_id],
      ),
      (err) => err.code === '23P01',
    );
  });

  await t.test('des demandes bancales sont refusees proprement', async () => {
    await banc.reinitialiserDebit();
    const base = { prenom: 'Ana', nom: 'Lopez', telephone: '612500201', tarifaIds: [prestation.id], jour: demain, heure: '16:00' };
    const cas = [
      [{ ...base, heure: '13:30' }, 409, 'pendant la coupure'],
      [{ ...base, heure: '16:07' }, 409, 'hors du pas'],
      [{ ...base, jour: plusJours(jourLocal(), -1) }, 409, 'hier'],
      [{ ...base, jour: plusJours(jourLocal(), 400) }, 409, 'au-dela de l horizon'],
      [{ ...base, tarifaIds: [] }, 422, 'sans prestation'],
      [{ ...base, tarifaIds: ['00000000-0000-0000-0000-000000000000'] }, 422, 'prestation inconnue'],
      [{ ...base, heure: 'midi' }, 422, 'heure illisible'],
    ];
    let n = 0;
    for (const [corps, statut, quoi] of cas) {
      // Un numero par essai : c'est la regle qu'on verifie, pas la limite de debit.
      n += 1;
      const r = await banc.client().post('/api/public/rdv', { ...corps, telephone: '61250021' + n });
      assert.equal(r.status, statut, quoi + ' : ' + JSON.stringify(r.body));
    }
  });

  await t.test('un meme numero ne tient pas plus de rendez-vous que le reglage', async () => {
    await banc.reinitialiserDebit();
    const prendre = (heure) => banc.client().post('/api/public/rdv', {
      prenom: 'Gourmand', nom: 'Client', telephone: '612500301', tarifaIds: [prestation.id], jour: demain, heure,
    });
    assert.equal((await prendre('15:00')).status, 201);
    assert.equal((await prendre('16:00')).status, 201);
    const troisieme = await prendre('17:00');
    assert.equal(troisieme.status, 409);
    assert.equal(troisieme.body.error.code, 'TROP_DE_RDV');
  });

  let jeton;
  await t.test('le formulaire de la page reserve sans JavaScript, et mene a SON rendez-vous', async () => {
    await banc.reinitialiserDebit();
    const page = await banc.client().get('/rendez-vous?p=' + prestation.id + '&jour=' + demain);
    assert.equal(page.status, 200);
    assert.ok(page.body.includes('name="heure"') && page.body.includes('value="18:00"'));
    assert.ok(page.body.includes('form="form-choix"') && page.body.includes('id="form-confirmer"'));
    const r = await banc.client().requete('POST', '/rendez-vous',
      { p: prestation.id, pro: '', jour: demain, heure: '18:00', prenom: 'Sofia', nom: 'Martin', telephone: '612500401' },
      { formulaire: true });
    assert.equal(r.status, 303, String(r.body).slice(0, 300));
    const cible = r.headers.get('location');
    assert.match(cible, /^\/rdv\/[A-Za-z0-9_-]+\?nouveau=1$/);
    jeton = cible.split('/')[2].split('?')[0];
    const suivi = await banc.client().get(cible);
    assert.equal(suivi.status, 200);
    assert.ok(suivi.body.includes('18:00') && suivi.body.includes(prestation.nombre));
    assert.match(suivi.body, /<meta name="robots" content="noindex/);
    // Le numero n'apparait jamais dans la page.
    assert.ok(!suivi.body.includes('612500401') && !suivi.body.includes('612 500 401'));
    const ics = await banc.client().get('/rdv/' + jeton + '/calendrier.ics');
    assert.equal(ics.status, 200);
    assert.match(String(ics.body), /BEGIN:VEVENT/);
  });

  await t.test('un lien invente ne montre rien, et le rendez-vous d un autre ne se devine pas', async () => {
    const faux = await banc.client().get('/rdv/' + 'x'.repeat(32));
    assert.equal(faux.status, 404);
    const api = await banc.client().get('/api/public/rdv/' + 'y'.repeat(32));
    assert.equal(api.status, 404);
    await banc.reinitialiserDebit();
  });

  await t.test('le client annule lui-meme, et l heure redevient libre', async () => {
    const r = await banc.client().post('/api/public/rdv/' + jeton + '/annuler');
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.statut, 'ANNULE');
    const libres = await banc.client().get('/api/public/rdv/creneaux?jour=' + demain + '&tarifaIds=' + prestation.id);
    assert.ok(libres.body.creneaux.some((c) => c.heure === '18:00'));
    // Une seconde annulation ne casse rien.
    assert.equal((await banc.client().post('/api/public/rdv/' + jeton + '/annuler')).status, 200);
  });

  await t.test('l agenda est au personnel, pas au public', async () => {
    assert.equal((await banc.client().get('/api/agenda')).status, 401);
    const a = await coiffeur.get('/api/agenda?jour=' + demain);
    assert.equal(a.status, 200);
    assert.ok(a.body.rdvs.length >= 4);
    const lucia = a.body.rdvs.find((x) => x.prenom === 'Lucia');
    assert.equal(lucia.telephone.replace(/\D/g, '').slice(-9), '612500001', 'le personnel voit le numero');
    assert.equal(lucia.posteChoisi, true);
  });

  let rdvDuJour;
  await t.test('le salon pose un rendez-vous au telephone, le client arrive, on l installe', async () => {
    const aujourdhui = jourLocal();
    // Le salon ouvert toute la journee, au pas de cinq minutes : ce test ne
    // doit pas dependre de l'heure a laquelle on le lance.
    const toutLeJour = { 'rdv.pasMinutes': 5 };
    for (let j = 0; j < 7; j += 1) {
      Object.assign(toutLeJour, {
        ['horaires.' + j + '.ouverture']: '00:00', ['horaires.' + j + '.fermeture']: '23:59',
        ['horaires.' + j + '.pauseDebut']: '', ['horaires.' + j + '.pauseFin']: '',
      });
    }
    assert.equal((await gerant.put('/api/reglages', { valeurs: toutLeJour })).status, 200);
    const libres = await coiffeur.get('/api/agenda/creneaux?jour=' + aujourdhui + '&tarifaIds=' + prestation.id + '&posteId=' + poste.id);
    assert.equal(libres.status, 200);
    if (!libres.body.creneaux.length) {
      t.diagnostic('plus aucune heure libre aujourd hui (journee finie) : sous-test sans objet');
      return;
    }
    const heure = libres.body.creneaux[0].heure;
    const pose = await coiffeur.post('/api/agenda', {
      prenom: 'Telephone', nom: 'Client', telephone: '612500501', tarifaIds: [prestation.id], posteId: poste.id, jour: aujourdhui, heure,
    });
    assert.equal(pose.status, 201, JSON.stringify(pose.body));
    rdvDuJour = pose.body.id;

    // La carte du fauteuil annonce le rendez-vous.
    const file = await coiffeur.get('/api/file');
    const carte = file.body.file.postes.find((p) => p.id === poste.id);
    assert.ok(carte.prochainsRdv.some((r) => r.id === rdvDuJour));

    // Un client de passage est DEJA dans la file quand le rendez-vous arrive.
    const avant = await coiffeur.post('/api/file/comptoir', { prenom: 'Avant', nom: 'Passage', telephone: '612500601' });
    assert.equal(avant.status, 201, JSON.stringify(avant.body));

    const arrive = await coiffeur.post('/api/agenda/' + rdvDuJour + '/statut', { statut: 'ARRIVE' });
    assert.equal(arrive.status, 200);
    const installe = await coiffeur.post('/api/agenda/' + rdvDuJour + '/installer');
    assert.equal(installe.status, 200, JSON.stringify(installe.body));

    const apres = await coiffeur.get('/api/file');
    const assis = apres.body.file.postes.find((p) => p.id === poste.id).client;
    assert.equal(assis.prenom, 'Telephone');
    assert.equal(assis.source, 'RDV');
    assert.equal(assis.statut, 'CALLED');
    assert.equal(assis.prestations.length, 1);
    // Installer deux fois ne cree pas deux tickets.
    assert.equal((await coiffeur.post('/api/agenda/' + rdvDuJour + '/installer')).status, 409);
    assert.equal((await banc.db.one("SELECT COUNT(*)::int AS n FROM tickets WHERE source = 'RDV'")).n, 1);
  });

  await t.test('le client qui attendait compte celui qu on vient d installer devant lui', async () => {
    if (!rdvDuJour) return;
    // Le client de rendez-vous a ete installe APRES l'arrivee du client de
    // passage : son rang est plus grand. Trie par rang seul, il passait
    // derriere, et la file annoncait « personne devant vous » a quelqu'un qui
    // regardait un autre se faire coiffer.
    const file = await coiffeur.get('/api/file');
    const attend = file.body.file.attente.find((x) => x.prenom === 'Avant');
    const assis = file.body.file.postes.find((p) => p.id === poste.id).client;
    assert.ok(attend && assis);
    assert.equal(attend.devant, 1, 'le client au fauteuil est devant celui qui attend');
    assert.equal(attend.position, 2);
    // « Suivant » sur ce fauteuil, une fois libere, reprend la file normalement.
    assert.equal((await coiffeur.post('/api/file/' + assis.id + '/servi')).status, 200);
    const suivant = await coiffeur.post('/api/file/suivant', { posteId: poste.id });
    assert.equal(suivant.status, 200, JSON.stringify(suivant.body));
    const apres = await coiffeur.get('/api/file');
    assert.equal(apres.body.file.postes.find((p) => p.id === poste.id).client.prenom, 'Avant');
    assert.equal((await coiffeur.post('/api/file/' + attend.id + '/servi')).status, 200);
  });

  await t.test('« suivant » prend d abord le client de rendez-vous arrive, avant la file', async () => {
    const aujourdhui = jourLocal();
    const libres = await coiffeur.get('/api/agenda/creneaux?jour=' + aujourdhui + '&tarifaIds=' + prestation.id + '&posteId=' + poste.id);
    if (!libres.body.creneaux.length || !rdvDuJour) return;
    const pose = await coiffeur.post('/api/agenda', {
      prenom: 'Reserve', nom: 'Client', telephone: '612500611', tarifaIds: [prestation.id], posteId: poste.id, jour: aujourdhui, heure: libres.body.creneaux[0].heure,
    });
    assert.equal(pose.status, 201, JSON.stringify(pose.body));
    const passage = await coiffeur.post('/api/file/comptoir', { prenom: 'Passage', nom: 'Client', telephone: '612500612' });
    assert.equal(passage.status, 201);
    assert.equal((await coiffeur.post('/api/agenda/' + pose.body.id + '/statut', { statut: 'ARRIVE' })).status, 200);
    // Son heure est venue : on la pose a l'instant (le creneau libre trouve plus
    // haut pouvait etre dans une heure, et « suivant » ne prend un rendez-vous
    // qu'a son heure). Le rendez-vous deja honore est range dans le passe.
    await banc.db.query("UPDATE rendez_vous SET debut = now() - interval '3 hours', fin = now() - interval '2 hours' WHERE id = $1", [rdvDuJour]);
    await banc.db.query("UPDATE rendez_vous SET debut = now() - interval '1 minute', fin = now() + interval '20 minutes' WHERE id = $1", [pose.body.id]);
    const r = await coiffeur.post('/api/file/suivant', { posteId: poste.id });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.rendezVous, true);
    const file = await coiffeur.get('/api/file');
    const assis = file.body.file.postes.find((p) => p.id === poste.id).client;
    assert.equal(assis.prenom, 'Reserve', 'le rendez-vous passe avant le client de passage');
    assert.equal((await coiffeur.post('/api/file/' + assis.id + '/servi')).status, 200);
  });

  await t.test('deplacer un rendez-vous garde la regle : seulement vers une heure libre', async () => {
    const a = await coiffeur.get('/api/agenda?jour=' + demain);
    const lucia = a.body.rdvs.find((x) => x.prenom === 'Lucia');
    const pris = a.body.rdvs.find((x) => x.prenom === 'Rival' && x.statut === 'CONFIRME');
    const refuse = await coiffeur.post('/api/agenda/' + lucia.id + '/deplacer', { jour: demain, heure: pris.heure });
    assert.equal(refuse.status, 409);
    const ok = await coiffeur.post('/api/agenda/' + lucia.id + '/deplacer', { jour: demain, heure: '12:00' });
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    assert.equal(ok.body.rdvs.find((x) => x.id === lucia.id).heure, '12:00');
  });

  await t.test('salon sur rendez-vous seulement : la file en ligne se ferme, le comptoir reste', async () => {
    await banc.reinitialiserDebit();
    assert.equal((await gerant.put('/api/reglages', { valeurs: { 'accueil.file': false } })).status, 200);
    const refus = await banc.client().post('/api/public/tickets', { prenom: 'Enligne', nom: 'Client', telephone: '612500701' });
    assert.equal(refus.status, 409);
    assert.equal(refus.body.error.code, 'FILE_HORS_LIGNE');
    const join = await banc.client().get('/join');
    assert.equal(join.status, 409);
    assert.ok(join.body.includes('href="/rendez-vous"') && !join.body.includes('name="telephone"'));
    const accueil = await banc.client().get('/');
    assert.ok(accueil.body.includes('href="/rendez-vous"') && !accueil.body.includes('href="/join"'));
    const comptoir = await coiffeur.post('/api/file/comptoir', { prenom: 'Comptoir', nom: 'Client', telephone: '612500702' });
    assert.equal(comptoir.status, 201, JSON.stringify(comptoir.body));
    // Le QR mene alors a la reservation.
    const affiche = await banc.client().get('/affiche');
    assert.ok(affiche.body.includes('/rendez-vous'));
    assert.equal((await gerant.put('/api/reglages', { valeurs: { 'accueil.file': true } })).status, 200);
  });

  await t.test('la marque : le gerant la regle tant qu il n y a pas d administrateur de plateforme', async () => {
    const r = await gerant.put('/api/reglages', { valeurs: { 'salon.nom': 'Maison Élise', 'marque.palette': 'IVOIRE', 'marque.activite': 'PELUQUERIA' } });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const css = await banc.client().get('/theme.css');
    assert.match(String(css.body), /color-scheme: light/);
    const accueil = await banc.client().get('/');
    assert.ok(accueil.body.includes('data-activite="PELUQUERIA"') && accueil.body.includes('data-clarte="clair"'));
    assert.ok(accueil.body.includes('Maison Élise') && !accueil.body.includes('HARON'));
    const manifeste = await banc.client().get('/site.webmanifest');
    assert.equal(JSON.parse(manifeste.body).name, 'Maison Élise');
    for (const chemin of ['/favicon.svg', '/icones/192.png', '/icones/maskable.png', '/apercu.png']) {
      assert.equal((await banc.client().get(chemin, { brut: true })).status, 200, chemin);
    }
    assert.equal((await banc.client().get('/icones/secret.png')).status, 404);
  });

  await t.test('des qu il existe, la marque n appartient plus qu a lui', async () => {
    const admin = await banc.connecter('SUPERADMIN');
    const refus = await gerant.put('/api/reglages', { valeurs: { 'marque.palette': 'ONYX' } });
    assert.equal(refus.status, 403);
    assert.equal((await gerant.put('/api/reglages', { valeurs: { 'salon.nom': 'Pirate' } })).status, 403);
    // Ses reglages de tous les jours restent les siens.
    assert.equal((await gerant.put('/api/reglages', { valeurs: { 'salon.adresse': 'Calle Mayor 12' } })).status, 200);
    assert.equal((await gerant.get('/api/marque')).status, 403);
    assert.equal((await coiffeur.get('/api/marque')).status, 403);

    const ok = await admin.put('/api/reglages', { valeurs: { 'marque.palette': 'PERSO', 'marque.couleurFond': '#101820', 'marque.couleurAccent': '#f2aa4c' } });
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    const css = String((await banc.client().get('/theme.css')).body);
    assert.ok(css.includes('--fond: #101820') && css.includes('--accent: #f2aa4c'));
    const piege = await admin.put('/api/reglages', { valeurs: { 'marque.couleurAccent': 'red;}body{display:none}' } });
    assert.equal(piege.status, 422);
    const ecran = await admin.get('/api/marque');
    assert.equal(ecran.status, 200);
    assert.equal(ecran.body.palettes.length, 11);
    // Le pays et la page d'accueil se reglent sur le meme ecran.
    for (const cle of ['pays.fuseau', 'pays.indicatif', 'marque.accueil']) {
      assert.ok(ecran.body.catalogue.some((e) => e.cle === cle), cle + ' absent de l ecran Marque');
    }
  });

  await t.test('le fuseau et l indicatif du pays se reglent a l ecran, par l administrateur seul', async () => {
    const admin = await banc.connecter('SUPERADMIN');
    const { config } = await banc.importer('server/core/config.js');
    const { telephoneInternational } = await banc.importer('server/core/text.js');
    const depart = { fuseau: config.timezone, indicatif: config.indicatifDefaut };
    assert.deepEqual(depart, { fuseau: 'Europe/Madrid', indicatif: '34' });

    assert.equal((await gerant.put('/api/reglages', { valeurs: { 'pays.fuseau': 'Africa/Casablanca' } })).status, 403);
    assert.equal((await gerant.put('/api/reglages', { valeurs: { 'pays.indicatif': 212 } })).status, 403);
    assert.equal((await admin.put('/api/reglages', { valeurs: { 'pays.fuseau': 'Mars/Olympus' } })).status, 422);
    assert.equal((await admin.put('/api/reglages', { valeurs: { 'pays.indicatif': 0 } })).status, 422);
    assert.equal(config.timezone, 'Europe/Madrid', 'un refus ne change rien');

    try {
      const ok = await admin.put('/api/reglages', { valeurs: { 'pays.fuseau': 'Africa/Casablanca', 'pays.indicatif': 212 } });
      assert.equal(ok.status, 200, JSON.stringify(ok.body));
      // Ce que TOUT le code lit : l'heure du salon et l'indicatif des numeros.
      assert.equal(config.timezone, 'Africa/Casablanca');
      assert.equal(config.indicatifDefaut, '212');
      assert.equal(telephoneInternational('0612345678', config.indicatifDefaut), '212612345678');
      const lu = await gerant.get('/api/reglages');
      assert.equal(lu.body.identite.timezone, 'Africa/Casablanca');
      assert.equal(String(lu.body.identite.indicatif), '212');
      // Un numero marocain saisi sans indicatif est accepte tel quel.
      await banc.reinitialiserDebit();
      const tour = await banc.client().post('/api/public/tickets', { prenom: 'Salma', nom: 'Alaoui', telephone: '0612345678', source: 'ONLINE' });
      assert.equal(tour.status, 201, JSON.stringify(tour.body));
    } finally {
      const retour = await admin.put('/api/reglages', { valeurs: { 'pays.fuseau': depart.fuseau, 'pays.indicatif': Number(depart.indicatif) } });
      assert.equal(retour.status, 200, JSON.stringify(retour.body));
    }
    assert.deepEqual({ fuseau: config.timezone, indicatif: config.indicatifDefaut }, depart);
  });

  await t.test('un bar a ongles : son vocabulaire, sa carte, et l accueil en images', async () => {
    const admin = await banc.connecter('SUPERADMIN');
    const avant = (await admin.get('/api/marque')).body.valeurs;
    const classique = String((await banc.client().get('/')).body);
    assert.ok(!classique.includes('une--images') && !classique.includes('data-ruban'), 'par defaut, l accueil reste classique');
    assert.ok(!classique.includes('id="soin"') && !classique.includes('class="invitation"'), 'l accueil classique ne recoit aucune promesse nouvelle');

    try {
      const ok = await admin.put('/api/reglages', {
        valeurs: { 'marque.activite': 'ONGLES', 'marque.palette': 'CORAIL', 'marque.typographie': 'DOUCE', 'marque.angles': 'ARRONDIS', 'marque.accueil': 'IMAGES' },
      });
      assert.equal(ok.status, 200, JSON.stringify(ok.body));
      const type = await gerant.post('/api/tarifas/catalogue', { activite: 'ONGLES' });
      assert.equal(type.status, 200, JSON.stringify(type.body));
      assert.ok(type.body.ajoutees >= 8, 'la carte type des ongles est ajoutee');
      assert.ok(type.body.items.some((l) => /gel/i.test(l.nombre)));

      // Sans photo : la meme composition, des arches peintes — jamais un trou.
      const vide = String((await banc.client().get('/')).body);
      assert.ok(vide.includes('data-activite="ONGLES"') && vide.includes('accueil-images'));
      assert.ok(vide.includes('une--images') && vide.includes('collage__cadre--vide'));
      assert.ok(!vide.includes('data-ruban'), 'pas de galerie sans photo');
      assert.ok(vide.includes('Salón de uñas'), 'le metier est nomme');
      assert.ok(vide.includes('class="fiche"') && !vide.includes('menu__ligne'), 'la carte est en fiches');
      assert.match(vide, /class="fiche__lien" href="\/rendez-vous\?p=[0-9a-f-]+"/, 'une fiche mene a la reservation deja cochee');
      const css = String((await banc.client().get('/theme.css')).body);
      assert.ok(css.includes('--accent: #f0725c') && css.includes('--r-bouton: 999px'));

      // Le soin : les quatre engagements de l'onglerie, trois rappeles en ouverture,
      // les trois gestes de la reservation, et l'invitation finale.
      assert.equal(vide.split('class="engagement"').length - 1, 4);
      assert.ok(vide.includes('Higiene impecable') && vide.includes('limas nuevas'));
      assert.equal((vide.split('class="une__atouts"')[1] || '').split('</ul>')[0].split('<li>').length - 1, 3);
      assert.equal(vide.split('class="rituel__geste"').length - 1, 3);
      assert.ok(vide.includes('class="invitation"') && vide.includes('Regálese este momento'));
      // Le salon reecrit ses engagements : les siens remplacent ceux de l'activite.
      const ecrits = await gerant.put('/api/reglages', { valeurs: { 'salon.engagements': 'Marcas veganas : Solo esmaltes sin crueldad.\nSin esperas' } });
      assert.equal(ecrits.status, 200, JSON.stringify(ecrits.body));
      const reecrit = String((await banc.client().get('/')).body);
      assert.equal(reecrit.split('class="engagement"').length - 1, 2);
      assert.ok(reecrit.includes('Marcas veganas') && reecrit.includes('Solo esmaltes sin crueldad.') && !reecrit.includes('Higiene impecable'));
      // Une balise ecrite dans un engagement reste du texte.
      assert.equal((await gerant.put('/api/reglages', { valeurs: { 'salon.engagements': '<img src=x onerror=alert(1)> : <b>gras</b>' } })).status, 200);
      const piege = String((await banc.client().get('/')).body);
      assert.ok(!piege.includes('<img src=x') && !piege.includes('<b>gras</b>'));
      // Les deux sections se retirent ; l'ouverture ne garde alors aucune promesse.
      assert.equal((await gerant.put('/api/reglages', { valeurs: { 'salon.engagements': '', 'vitrine.engagements': false, 'vitrine.etapes': false } })).status, 200);
      const sobre = String((await banc.client().get('/')).body);
      assert.ok(!sobre.includes('id="soin"') && !sobre.includes('une__atouts') && !sobre.includes('rituel__geste'));
      assert.equal((await gerant.put('/api/reglages', { valeurs: { 'vitrine.engagements': true, 'vitrine.etapes': true } })).status, 200);

      // Avec des photos : elles montent dans l'ouverture ET dans le ruban.
      const { pngCouleur } = await banc.importer('server/core/png.js');
      const image = (r, g, b) => {
        const rgb = new Uint8Array(40 * 50 * 3);
        for (let i = 0; i < rgb.length; i += 3) { rgb[i] = r; rgb[i + 1] = g; rgb[i + 2] = b; }
        return pngCouleur({ largeur: 40, hauteur: 50, rgb });
      };
      const envoyer = async (contenu, legende) => {
        const res = await fetch(banc.base + '/api/photos?legende=' + encodeURIComponent(legende), {
          method: 'POST',
          headers: { Origin: banc.base, Cookie: gerant.cookie, 'X-CSRF-Token': gerant.csrf, 'Content-Type': 'image/png' },
          body: contenu,
        });
        assert.equal(res.status, 201, await res.text());
      };
      await envoyer(image(240, 114, 92), 'French rose');
      await envoyer(image(138, 92, 214), 'Baby boomer');
      await envoyer(image(193, 105, 79), 'Nail art');

      const plein = String((await banc.client().get('/')).body);
      assert.equal(plein.split('class="collage__image"').length - 1, 3, 'trois photos dans l ouverture');
      assert.ok(!plein.includes('collage__cadre--vide'));
      assert.equal(plein.split('data-agrandir').length - 1, 3, 'chaque photo une seule fois dans la galerie');
      assert.equal(plein.split('data-visionneuse').length - 1, 1, 'une seule visionneuse');
      assert.ok(plein.includes('data-ruban') && plein.includes('French rose'));
      assert.ok(plein.indexOf('id="galerie"') < plein.indexOf('id="carte"'), 'la galerie passe avant la carte');
      assert.ok(!plein.includes('entete--sur-image'), 'l en-tete reste lisible : pas de photo dessous');

      // La section galerie eteinte : plus de ruban ; seule la photo de
      // couverture reste dans l'ouverture, comme sur l'accueil classique.
      assert.equal((await gerant.put('/api/reglages', { valeurs: { 'vitrine.galerie': false } })).status, 200);
      const sans = String((await banc.client().get('/')).body);
      assert.ok(!sans.includes('data-ruban') && !sans.includes('data-agrandir'));
      assert.ok(sans.split('class="collage__image"').length - 1 <= 1);
      assert.equal((await gerant.put('/api/reglages', { valeurs: { 'vitrine.galerie': true } })).status, 200);
    } finally {
      const cles = ['marque.activite', 'marque.palette', 'marque.typographie', 'marque.angles', 'marque.accueil'];
      const retour = await admin.put('/api/reglages', { valeurs: Object.fromEntries(cles.map((c) => [c, avant[c]])) });
      assert.equal(retour.status, 200, JSON.stringify(retour.body));
    }
    const apres = String((await banc.client().get('/')).body);
    assert.ok(!apres.includes('une--images') && apres.includes('data-agrandir'), 'retour au classique : la mosaique revient');
  });

  await t.test('l accueil « fiche » : identite, mosaique, prestations a choisir, colonne pour venir', async () => {
    const admin = await banc.connecter('SUPERADMIN');
    const avant = (await admin.get('/api/marque')).body.valeurs['marque.accueil'];
    try {
      assert.equal((await admin.put('/api/reglages', { valeurs: { 'marque.accueil': 'FICHE' } })).status, 200);
      const page = String((await banc.client().get('/')).body);
      assert.ok(page.includes('accueil-fiche') && page.includes('salon__tete') && page.includes('salon__cote'));
      assert.ok(!page.includes('une--images') && !page.includes('class="une '), 'ni l ouverture classique, ni le collage');
      assert.ok(page.includes('class="mosaique'), 'la mosaique, ou son bandeau sans photo');
      assert.equal(page.split('data-visionneuse').length - 1, page.includes('data-agrandir') ? 1 : 0, 'une visionneuse, seulement s il y a des photos');
      assert.match(page, /class="bouton bouton--principal bouton--petit prestation__choisir" href="\/rendez-vous\?p=[0-9a-f-]+"/);
      assert.ok(page.indexOf('salon__principal') < page.indexOf('salon__cote'), 'les prestations d abord, de quoi venir ensuite');
      assert.equal(page.split('id="titre-une"').length - 1, 1, 'un seul titre de page');
    } finally {
      assert.equal((await admin.put('/api/reglages', { valeurs: { 'marque.accueil': avant } })).status, 200);
    }
  });

  await t.test('le gerant ne peut ni creer, ni toucher, ni devenir administrateur de plateforme', async () => {
    const admin = await banc.compte('SUPERADMIN');
    const creer = await gerant.post('/api/comptes', { identifiant: 'intrus', nomComplet: 'Intrus', role: 'SUPERADMIN', motDePasse: 'Mot-De-Passe-Long-42' });
    assert.equal(creer.status, 403);
    assert.equal((await gerant.post('/api/comptes/' + admin.id + '/mot-de-passe', { motDePasse: 'Mot-De-Passe-Long-42' })).status, 403);
    assert.equal((await gerant.patch('/api/comptes/' + admin.id, { actif: false })).status, 403);
    assert.equal((await gerant.patch('/api/comptes/' + gerant.utilisateurId, { role: 'SUPERADMIN' })).status, 403);
    const liste = await gerant.get('/api/comptes');
    assert.ok(!liste.body.items.some((c) => c.id === admin.id || c.role === 'SUPERADMIN'), 'le compte de l editeur n apparait pas chez le gerant');
    const vuParLui = await (await banc.connecter('SUPERADMIN')).get('/api/comptes');
    assert.ok(vuParLui.body.items.some((c) => c.role === 'SUPERADMIN'), 'l editeur, lui, se voit');
    assert.ok(!liste.body.roles.some((r) => r.code === 'SUPERADMIN'));
  });

  await t.test('la carte : chapitre, « a partir de », reservable — et la carte type n ecrase rien', async () => {
    const cree = await gerant.post('/api/tarifas', { nombre: 'Soin signature', precio: '80', duracion: '50', categoria: 'Soins', precioDesde: true, reservable: false });
    assert.equal(cree.status, 201, JSON.stringify(cree.body));
    assert.deepEqual([cree.body.categoria, cree.body.precioDesde, cree.body.reservable], ['Soins', true, false]);
    const offre = await banc.client().get('/api/public/rdv/offre');
    assert.ok(!offre.body.prestations.some((p) => p.nombre === 'Soin signature'), 'non reservable : absente de la reservation');
    const accueil = await banc.client().get('/');
    assert.ok(accueil.body.includes('Soin signature'), 'visible sur la carte de la vitrine');
    assert.match(accueil.body, /desde 80/, 'le prix « a partir de » est dit');
    const avant = (await gerant.get('/api/tarifas')).body.items;
    const type = await gerant.post('/api/tarifas/catalogue', { activite: 'PELUQUERIA' });
    assert.equal(type.status, 200, JSON.stringify(type.body));
    assert.ok(type.body.ajoutees > 0);
    const apres = type.body.items;
    for (const l of avant) assert.deepEqual(apres.find((x) => x.id === l.id).precioCts, l.precioCts, l.nombre + ' a change de prix');
    assert.equal((await gerant.post('/api/tarifas/catalogue', { activite: 'PELUQUERIA' })).body.ajoutees, 0, 'rejouer n ajoute rien');
    assert.equal((await coiffeur.post('/api/tarifas/catalogue', {})).status, 403);
  });
});
