#!/usr/bin/env node
/**
 * Point d'entree du conteneur : attend la base, applique le schema, pose les
 * donnees de reference, puis demarre le serveur.
 *
 * Les deux premieres etapes sont idempotentes : un redeploiement ne demande
 * aucune intervention, et un redemarrage en pleine journee ne touche ni la file
 * en cours ni les reglages du salon.
 *
 *   SKIP_MIGRATE=true, SKIP_SEED=true pour les desactiver.
 *   DEMO_DATA=true charge une file de demonstration si la journee est vide.
 */
import { spawnSync } from 'node:child_process';
import { assertConfig } from '../server/core/config.js';
import { ping, closePool } from '../server/db/index.js';

const bool = (v) => /^(1|true|yes|on)$/i.test(String(v || ''));
assertConfig();

async function attendreBase() {
  const limite = Date.now() + 90000;
  while (Date.now() < limite) {
    try {
      await ping();
      return true;
    } catch (err) {
      console.log('  Base injoignable (' + err.message.split('\n')[0] + '), nouvelle tentative dans 2 s.');
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  return false;
}

function executer(libelle, script, args = []) {
  console.log('\n  ' + libelle + '...');
  const r = spawnSync(process.execPath, [script, ...args], { stdio: 'inherit', env: process.env });
  if (r.status !== 0) {
    console.error('\n  Echec : ' + libelle + ' (code ' + r.status + '). Demarrage interrompu.');
    process.exit(1);
  }
}

const joignable = await attendreBase();
await closePool().catch(() => {});
if (!joignable) {
  console.error('  La base n a pas repondu dans le delai imparti.');
  process.exit(1);
}

if (!bool(process.env.SKIP_MIGRATE)) executer('Application du schema', 'scripts/migrate.js');
if (!bool(process.env.SKIP_SEED)) executer('Donnees de reference', 'scripts/seed.js');
if (bool(process.env.DEMO_DATA)) executer('File de demonstration', 'scripts/demo.js', ['--si-vide']);

await import('../server/index.js');
