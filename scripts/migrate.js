#!/usr/bin/env node
/**
 * Applique le schema PostgreSQL : npm run migrate
 *
 * Le schema est IDEMPOTENT : il est rejoue a chaque demarrage du conteneur, et
 * le rejouer a la main ne casse rien. Un verrou consultatif empeche deux
 * instances de l'appliquer en meme temps pendant un deploiement.
 */
import fs from 'node:fs';
import path from 'node:path';
import { assertConfig, ROOT } from '../server/core/config.js';
import { query, transaction, closePool, ping } from '../server/db/index.js';

assertConfig();

async function main() {
  const ms = await ping();
  console.log('  Base joignable (' + ms + ' ms). Application du schema...');
  const sql = fs.readFileSync(path.join(ROOT, 'server', 'db', 'schema.sql'), 'utf8');
  await transaction(async (tx) => {
    await tx.query("SET LOCAL statement_timeout = '600s'");
    await tx.query("SET LOCAL client_min_messages = 'warning'");
    await tx.query("SELECT pg_advisory_xact_lock(hashtext('haron.migration'))");
    await tx.query(sql);
  });
  await query(
    `INSERT INTO app_meta(key, value, updated_at) VALUES ('schema.applied_at', $1, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [new Date().toISOString()],
  );
  const tables = await query(
    "SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'",
  );
  console.log('  Schema applique : ' + tables.rows[0].n + ' tables.');
}

main()
  .then(() => closePool())
  .catch(async (err) => {
    console.error('\n  Echec de la migration : ' + err.message);
    if (err.position) console.error('  Position dans le SQL : ' + err.position);
    await closePool().catch(() => {});
    process.exit(1);
  });
