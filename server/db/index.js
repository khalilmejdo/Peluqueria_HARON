/**
 * Acces a la base PostgreSQL.
 *
 * Regles appliquees ici, sans exception dans le reste du code :
 *   - toute requete passe par des parametres lies ($1, $2...) ; aucune valeur
 *     utilisateur n'est jamais concatenee dans une chaine SQL ;
 *   - les identifiants SQL dynamiques (tri) ne viennent que de listes blanches
 *     declarees par l'appelant (orderBy) ;
 *   - un statement_timeout empeche qu'une requete pathologique n'immobilise le
 *     pool de connexions.
 */
import pg from 'pg';
import { config } from '../core/config.js';
import { log } from '../core/logger.js';
import { conflict, AppError } from '../core/errors.js';

const { Pool, Client, types } = pg;

/* ------------------------------------------------------------------ */
/*  Typage des resultats                                               */
/* ------------------------------------------------------------------ */

// BIGINT et NUMERIC arrivent en chaine. On les convertit, mais un entier que
// Number ne represente pas exactement est refuse plutot que fausse en silence.
const entierRepresentable = (v) => {
  const n = Number(v);
  if (!Number.isSafeInteger(n) && /^-?\d+$/.test(v)) {
    throw new AppError(500, 'Valeur entière hors de la plage représentable (' + v + ').', { code: 'VALEUR_NON_REPRESENTABLE' });
  }
  return n;
};
types.setTypeParser(20, (v) => (v === null ? null : entierRepresentable(v)));
types.setTypeParser(1700, (v) => (v === null ? null : (/^-?\d+$/.test(v) ? entierRepresentable(v) : Number(v))));
// Les DATE restent des chaines « AAAA-MM-JJ » : un objet Date y ajouterait un fuseau.
types.setTypeParser(1082, (v) => v);

/* ------------------------------------------------------------------ */
/*  Pool                                                               */
/* ------------------------------------------------------------------ */

let pool = null;

function sslOption() {
  if (config.db.ssl === 'off') return false;
  if (config.db.ssl === 'verify') return { rejectUnauthorized: true, ca: config.db.caCert.split('\\n').join('\n') };
  return { rejectUnauthorized: false };
}

export function getPool() {
  if (pool) return pool;
  pool = new Pool({
    connectionString: config.db.url,
    ssl: sslOption(),
    max: config.db.poolMax,
    idleTimeoutMillis: config.db.idleTimeoutMs,
    connectionTimeoutMillis: config.db.connectionTimeoutMs,
    statement_timeout: config.db.statementTimeoutMs,
    application_name: 'peluqueria-haron',
    options: '-c timezone=UTC',
  });
  // Une connexion inactive coupee par le serveur ne doit pas tuer le processus.
  pool.on('error', (err) => log.error('Erreur sur une connexion inactive du pool', { error: err.message }));
  return pool;
}

/* ------------------------------------------------------------------ */
/*  Execution                                                          */
/* ------------------------------------------------------------------ */

const SLOW_QUERY_MS = 1000;

export async function query(text, params = []) {
  const started = Date.now();
  try {
    const result = await getPool().query(text, params);
    const elapsed = Date.now() - started;
    if (elapsed > SLOW_QUERY_MS) log.warn('Requete lente', { ms: elapsed, sql: text.slice(0, 160).replace(/\s+/g, ' ') });
    return result;
  } catch (err) {
    log.error('Echec SQL', { error: err.message, code: err.code, sql: text.slice(0, 300).replace(/\s+/g, ' ') });
    throw err;
  }
}

export const all = async (text, params) => (await query(text, params)).rows;
export const one = async (text, params) => (await query(text, params)).rows[0] ?? null;
export async function value(text, params) {
  const row = await one(text, params);
  if (!row) return null;
  const keys = Object.keys(row);
  return keys.length ? row[keys[0]] : null;
}
export const execute = async (text, params) => (await query(text, params)).rowCount;

/* ------------------------------------------------------------------ */
/*  Transactions                                                       */
/* ------------------------------------------------------------------ */

/**
 * Execute `fn` dans une transaction. Toute exception declenche un ROLLBACK.
 *
 * C'est le garde-fou central de la file : appeler un client, le servir, le
 * remettre en fin de file sont des gestes qui touchent plusieurs lignes. Deux
 * coiffeurs qui cliquent au meme instant, ou un double appui sur une tablette,
 * ne doivent jamais laisser la file a moitie modifiee.
 *
 * @template T
 * @param {(tx: TxClient) => Promise<T>} fn
 * @returns {Promise<T>}
 */
export async function transaction(fn) {
  const client = await getPool().connect();
  // Un client sorti du pool n'a plus d'ecouteur « error » : sans celui-ci, une
  // coupure pendant la transaction tuerait le processus.
  const surCoupure = (err) => log.warn('Connexion coupee pendant une transaction', { error: err.message });
  client.on('error', surCoupure);
  const apresValidation = [];
  const tx = makeTxClient(client, apresValidation);
  try {
    await client.query('BEGIN');
    await client.query("SET LOCAL lock_timeout = '" + Math.max(1000, config.db.lockTimeoutMs) + "ms'");
    const result = await fn(tx);
    await client.query('COMMIT');
    for (const suite of apresValidation) {
      try {
        await suite();
      } catch (err) {
        log.error('Echec d une suite apres validation', { error: err.message });
      }
    }
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      log.error('Echec du ROLLBACK', { error: rollbackErr.message });
    }
    // Conflit de serialisation ou interblocage : rien n'a ete ecrit, rejouer aboutira.
    if (err && (err.code === '40001' || err.code === '40P01')) {
      throw conflict('Deux gestes se sont croisés au même instant. Rien n’a été enregistré : renouvelez l’opération.');
    }
    throw err;
  } finally {
    client.removeListener('error', surCoupure);
    client.release();
  }
}

/** @typedef {ReturnType<typeof makeTxClient>} TxClient */
function makeTxClient(client, apresValidation = []) {
  const run = async (text, params = []) => {
    try {
      return await client.query(text, params);
    } catch (err) {
      log.error('Echec SQL (transaction)', { error: err.message, code: err.code, sql: text.slice(0, 300).replace(/\s+/g, ' ') });
      throw err;
    }
  };
  return {
    raw: client,
    query: run,
    all: async (t, p) => (await run(t, p)).rows,
    one: async (t, p) => (await run(t, p)).rows[0] ?? null,
    value: async (t, p) => {
      const rows = (await run(t, p)).rows;
      if (!rows.length) return null;
      const keys = Object.keys(rows[0]);
      return keys.length ? rows[0][keys[0]] : null;
    },
    execute: async (t, p) => (await run(t, p)).rowCount,
    /** Suite a jouer apres le COMMIT, et jamais sans lui (diffusion temps reel, envoi WhatsApp). */
    apresValidation: (f) => { apresValidation.push(f); },
  };
}

/* ------------------------------------------------------------------ */
/*  Aides a la construction de requetes                                */
/* ------------------------------------------------------------------ */

/**
 * Clause WHERE parametree construite pas a pas.
 *
 *   const w = new Where();
 *   w.add('t.jour = ?', jour);
 *   w.addIf(statut, 't.statut = ?', statut);
 *   const rows = await all('SELECT ... FROM tickets t ' + w.sql(), w.params);
 */
export class Where {
  constructor(startIndex = 1) {
    this.clauses = [];
    this.params = [];
    this.index = startIndex;
  }

  add(clause, ...values) {
    let i = 0;
    const rendered = clause.replace(/\?/g, () => {
      i += 1;
      return '$' + this.index++;
    });
    if (i !== values.length) throw new Error('Where.add : ' + i + ' emplacement(s) pour ' + values.length + ' valeur(s).');
    this.clauses.push(rendered);
    this.params.push(...values);
    return this;
  }

  addIf(condition, clause, valuesFn) {
    if (condition === undefined || condition === null || condition === '' || condition === false) return this;
    const values = typeof valuesFn === 'function' ? valuesFn() : valuesFn;
    return this.add(clause, ...(Array.isArray(values) ? values : [values]));
  }

  /** Reserve le prochain emplacement (LIMIT, OFFSET). */
  next(valueToPush) {
    this.params.push(valueToPush);
    return '$' + this.index++;
  }

  sql(prefix = 'WHERE') {
    return this.clauses.length ? prefix + ' ' + this.clauses.join(' AND ') : '';
  }
}

/**
 * Tri resolu contre une liste blanche : « jour:desc » -> « t.jour DESC NULLS LAST ».
 * Seule une cle PROPRE de la liste, de valeur chaine, est acceptee
 * (« constructor » ou « toString » ne traversent pas le prototype).
 */
export function orderBy(requested, allowed, fallback) {
  if (!requested || typeof requested !== 'string') return fallback;
  const [field, dirRaw] = requested.split(':');
  const column = Object.hasOwn(allowed, field) ? allowed[field] : null;
  const colonnes = Array.isArray(column) ? column : [column];
  if (!colonnes.length || colonnes.some((c) => !c || typeof c !== 'string')) return fallback;
  const dir = String(dirRaw || 'asc').toLowerCase() === 'desc' ? 'DESC' : 'ASC';
  return colonnes.map((c) => c + ' ' + dir + ' NULLS LAST').join(', ');
}

export async function ping() {
  const started = Date.now();
  await query('SELECT 1');
  return Date.now() - started;
}

let poolSante = null;

/**
 * Sonde de sante : une connexion dediee, courte, hors du pool des requetes.
 * Si toutes les connexions applicatives sont occupees, l'application reste
 * « en vie » pour l'hebergeur au lieu d'etre redemarree en plein service.
 */
export async function pingSante() {
  if (!poolSante) {
    poolSante = new Pool({
      connectionString: config.db.url,
      ssl: sslOption(),
      max: 1,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
      statement_timeout: 2000,
      application_name: 'peluqueria-haron-sante',
      options: '-c timezone=UTC',
    });
    poolSante.on('error', (err) => log.warn('Erreur sur la connexion de la sonde de sante', { error: err.message }));
  }
  const started = Date.now();
  await poolSante.query('SELECT 1');
  return Date.now() - started;
}

/**
 * Sante detaillee : la base repond-elle, et accepte-t-elle encore d'ECRIRE ?
 *
 * Une base passee en lecture seule repond parfaitement a « SELECT 1 » pendant
 * que plus personne ne peut prendre son tour : la sonde dirait « ok » et le
 * coiffeur croirait a un bug de l'application.
 */
export async function etatBase() {
  const debut = Date.now();
  const client = new Client({
    connectionString: config.db.url,
    ssl: sslOption(),
    connectionTimeoutMillis: 2000,
    statement_timeout: 2000,
    application_name: 'peluqueria-haron-sante',
  });
  try {
    await client.connect();
    const r = await client.query('SELECT pg_is_in_recovery() AS replique');
    if (r.rows[0].replique === true) {
      return { ok: true, ecriture: false, ms: Date.now() - debut, motif: 'la base est une réplique de lecture' };
    }
    // Vraie tentative d'ecriture, annulee aussitot : le verrou de ligne ne
    // change aucune donnee mais echoue si la base n'ecrit plus.
    try {
      await client.query('BEGIN');
      await client.query('SELECT key FROM app_meta FOR UPDATE LIMIT 1');
      await client.query('ROLLBACK');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      const brut = String(err.message);
      const motif = /read-only|lecture seule/i.test(brut)
        ? 'la base est en lecture seule : aucune écriture n’est possible'
        : /disk|space|53100/i.test(brut) ? 'le disque de la base est plein' : brut.slice(0, 160);
      return { ok: true, ecriture: false, ms: Date.now() - debut, motif };
    }
    return { ok: true, ecriture: true, ms: Date.now() - debut, motif: null };
  } catch (err) {
    return { ok: false, ecriture: false, ms: Date.now() - debut, motif: String(err.message).slice(0, 200) };
  } finally {
    await client.end().catch(() => {});
  }
}

export async function closePool() {
  if (poolSante) {
    const sante = poolSante;
    poolSante = null;
    await sante.end().catch(() => {});
  }
  if (!pool) return;
  const current = pool;
  pool = null;
  await current.end();
}
