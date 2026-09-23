/**
 * BANC D'INTEGRATION : l'application reelle, contre une base PostgreSQL reelle.
 *
 *   TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:55440/postgres npm run test:integration
 *
 * L'adresse designe un serveur PostgreSQL JETABLE et un compte capable de creer
 * des bases. Chaque fichier de test cree SA base (haron_it_...), y applique le
 * schema et les donnees de reference, demarre le serveur sur un port libre, et
 * supprime la base a la fin. Aucune base existante n'est lue ni modifiee.
 *
 * Sans TEST_DATABASE_URL, les tests d'integration sont ignores (et le disent).
 *
 * Usage :
 *   import { IGNORE, demarrer } from './banc.js';
 *   test('...', { skip: IGNORE }, async (t) => {
 *     const banc = await demarrer();
 *     t.after(() => banc.arreter());
 *     const salon = await banc.connecter('COIFFEUR');
 *     const r = await salon.post('/api/file/suivant');   // { status, body, headers }
 *   });
 *
 * Les modules du serveur lisent l'environnement a leur premier import :
 * demarrer() pose l'environnement AVANT d'importer quoi que ce soit du serveur.
 * Un fichier de test ne doit donc importer aucun module du serveur au niveau
 * superieur ; il passe par banc.importer('server/...').
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import pg from 'pg';

export const RACINE = fileURLToPath(new URL('../../', import.meta.url));
export const URL_ADMIN = process.env.TEST_DATABASE_URL || '';
export const IGNORE = URL_ADMIN ? false : 'TEST_DATABASE_URL absent : tests d integration ignores (voir test/integration/banc.js)';

export const MOT_DE_PASSE = 'Banc-Essai-Salon-42';

function urlDeLaBase(nom) {
  const u = new URL(URL_ADMIN);
  u.pathname = '/' + nom;
  return u.toString();
}

async function avecAdmin(fn) {
  const client = new pg.Client({ connectionString: URL_ADMIN });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

let dejaDemarre = false;

/**
 * Demarre une application neuve sur une base neuve (une par processus de test).
 * @param {{ env?: Record<string,string> }} [opts]
 */
export async function demarrer({ env = {} } = {}) {
  if (!URL_ADMIN) throw new Error(IGNORE);
  if (dejaDemarre) throw new Error('Un seul banc par fichier de test : les modules du serveur gardent leur configuration.');
  dejaDemarre = true;

  const nom = 'haron_it_' + process.pid + '_' + crypto.randomBytes(3).toString('hex');
  await avecAdmin((c) => c.query('CREATE DATABASE ' + nom));
  const dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'haron-it-'));

  Object.assign(process.env, {
    HARON_SANS_DOTENV: '1',
    HARON_NE_PAS_DEMARRER: '1',
    HARON_LOG_SILENCE: '1',
    NODE_ENV: 'test',
    DATABASE_URL: urlDeLaBase(nom),
    DATABASE_SSL: 'off',
    APP_SECRET: crypto.randomBytes(32).toString('hex'),
    APP_ENCRYPTION_KEY: crypto.randomBytes(32).toString('hex'),
    APP_PASSWORD_PEPPER: crypto.randomBytes(32).toString('hex'),
    APP_TIMEZONE: 'Europe/Madrid',
    SECURE_COOKIES: 'false',
    ENABLE_HSTS: 'false',
    TRUST_PROXY: 'false',
    PUBLIC_URL: '',
    DATA_DIR: dossier,
    RATE_LIMIT_MAX: '100000',
    LOGIN_RATE_MAX: '100000',
    BOOTSTRAP_ADMIN_PASSWORD: '',
    WHATSAPP_ACTIF: 'false',
    TELEPHONE_INDICATIF_DEFAUT: '34',
    ...env,
  });

  const importer = (relatif) => import(pathToFileURL(path.join(RACINE, relatif)).href);

  const db = await importer('server/db/index.js');
  const schema = fs.readFileSync(path.join(RACINE, 'server/db/schema.sql'), 'utf8');
  await db.transaction(async (tx) => {
    await tx.query("SET LOCAL client_min_messages = 'warning'");
    await tx.query(schema);
  });
  const { seed } = await importer('server/db/seed.js');
  await seed({ silencieux: true });

  const { creerServeur } = await importer('server/index.js');
  const serveur = creerServeur();
  await new Promise((resolve) => serveur.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + serveur.address().port;

  const { hashPassword, newId } = await importer('server/core/crypto.js');
  const hash = await hashPassword(MOT_DE_PASSE);
  const comptes = new Map();

  /** Cree (une fois) un compte actif du role demande, mot de passe deja change. */
  async function compte(role, { identifiant = null } = {}) {
    const cle = identifiant || role.toLowerCase();
    if (!comptes.has(cle)) {
      const id = newId();
      await db.query(
        `INSERT INTO utilisateurs (id, identifiant, identifiant_lower, nom_complet, mot_de_passe_hash, role, doit_changer_mot_de_passe)
         VALUES ($1,$2,$2,$3,$4,$5,FALSE)`,
        [id, cle, 'Compte ' + cle, hash, role],
      );
      comptes.set(cle, id);
    }
    return { id: comptes.get(cle), identifiant: cle };
  }

  function client() {
    let cookie = '';
    let csrf = '';
    async function requete(methode, chemin, corps, { entetes = {}, brut = false, formulaire = false } = {}) {
      const headers = { Origin: base, ...entetes };
      if (cookie) headers.Cookie = cookie;
      if (csrf) headers['X-CSRF-Token'] = csrf;
      let body;
      if (formulaire && corps) {
        headers['Content-Type'] = 'application/x-www-form-urlencoded';
        body = new URLSearchParams(corps).toString();
      } else if (corps !== undefined) {
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify(corps);
      }
      const res = await fetch(base + chemin, { method: methode, headers, body, redirect: 'manual' });
      const setCookie = res.headers.get('set-cookie');
      if (setCookie) {
        const m = /haron_session=([^;]*)/.exec(setCookie);
        if (m) cookie = m[1] ? 'haron_session=' + m[1] : '';
      }
      const type = res.headers.get('content-type') || '';
      let contenu;
      if (brut) contenu = Buffer.from(await res.arrayBuffer());
      else if (type.includes('application/json')) contenu = await res.json();
      else contenu = await res.text();
      if (contenu && typeof contenu === 'object' && !Buffer.isBuffer(contenu) && contenu.csrfToken) csrf = contenu.csrfToken;
      return { status: res.status, body: contenu, headers: res.headers };
    }
    return {
      get: (c, o) => requete('GET', c, undefined, o),
      post: (c, b, o) => requete('POST', c, b ?? {}, o),
      put: (c, b, o) => requete('PUT', c, b ?? {}, o),
      patch: (c, b, o) => requete('PATCH', c, b ?? {}, o),
      delete: (c, o) => requete('DELETE', c, undefined, o),
      requete,
      get cookie() { return cookie; },
      set cookie(v) { cookie = v; },
      get csrf() { return csrf; },
      set csrf(v) { csrf = v; },
    };
  }

  /** Client connecte avec un compte du role demande. */
  async function connecter(role, opts = {}) {
    const c = await compte(role, opts);
    const cl = client();
    const r = await cl.post('/api/auth/login', { identifiant: c.identifiant, motDePasse: MOT_DE_PASSE });
    if (r.status !== 200) throw new Error('Connexion impossible pour ' + c.identifiant + ' : ' + JSON.stringify(r.body));
    cl.utilisateurId = c.id;
    return cl;
  }

  /** Raccourci : un client public prend son tour et rend { numero, jeton, ... }. */
  async function prendreTour(prenom, nom, telephone, source = 'ONLINE') {
    const cl = client();
    const r = await cl.post('/api/public/tickets', { prenom, nom, telephone, source });
    if (r.status !== 201) throw new Error('Prise de tour refusee : ' + JSON.stringify(r.body));
    return r.body;
  }

  /**
   * Le client assis au premier fauteuil occupe, ou null.
   *
   * La file rend une carte par fauteuil ; la plupart des tests travaillent sur
   * un salon a un seul fauteuil et veulent simplement « celui qui est au
   * fauteuil ». Cette aide evite de repeter la meme recherche partout, et fait
   * que les tests d'un salon a un fauteuil restent lisibles.
   */
  function auFauteuil(file) {
    return (file?.postes || []).map((p) => p.client).find(Boolean) || null;
  }

  /** Tous les clients assis, dans l'ordre des fauteuils. */
  function auxFauteuils(file) {
    return (file?.postes || []).map((p) => p.client).filter(Boolean);
  }

  /**
   * Remet les compteurs de debit a zero.
   *
   * Les tests parlent tous depuis 127.0.0.1 : sans cela, le quinzieme ticket
   * d'un fichier se ferait refuser par la protection anti-robot, et le test
   * echouerait pour une raison qui n'a rien a voir avec ce qu'il verifie.
   */
  async function reinitialiserDebit() {
    const { resetAll } = await importer('server/core/ratelimit.js');
    resetAll();
  }

  async function arreter() {
    const { fermerTout } = await importer('server/core/flux.js');
    fermerTout();
    serveur.closeAllConnections?.();
    await new Promise((resolve) => serveur.close(resolve));
    await db.closePool();
    await avecAdmin(async (c) => {
      await c.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1', [nom]);
      await c.query('DROP DATABASE IF EXISTS ' + nom);
    });
    fs.rmSync(dossier, { recursive: true, force: true });
  }

  return {
    base, db, importer, client, compte, connecter, prendreTour,
    auFauteuil, auxFauteuils, reinitialiserDebit, arreter, nomBase: nom, dossier,
  };
}
