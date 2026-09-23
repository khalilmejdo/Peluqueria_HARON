#!/usr/bin/env node
/**
 * Donnees de reference : npm run seed
 *
 * Idempotent : a rejouer sans crainte. Voir server/db/seed.js pour ce qu'il
 * pose exactement, et surtout pour ce qu'il ne touche jamais.
 */
import { assertConfig } from '../server/core/config.js';
import { closePool } from '../server/db/index.js';
import { seed } from '../server/db/seed.js';

assertConfig();

seed({ silencieux: process.argv.includes('--silencieux') })
  .then(() => closePool())
  .catch(async (err) => {
    console.error('\n  Echec du seed : ' + err.message);
    await closePool().catch(() => {});
    process.exit(1);
  });
