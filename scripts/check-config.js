#!/usr/bin/env node
/**
 * Verifie la configuration sans rien demarrer : npm run check
 *
 * A lancer avant une mise en ligne : il dit ce qui manque, ce qui est mal forme
 * et ce qui merite un regard, puis sort en 1 si quelque chose empeche de
 * demarrer.
 */
import { validateConfig, configWarnings, config } from '../server/core/config.js';

const erreurs = validateConfig();
const avertissements = configWarnings();

console.log('\n  Peluquería HARON — vérification de la configuration');
console.log('  Environnement : ' + config.env + ' — fuseau : ' + config.timezone);
console.log('  Adresse publique : ' + (config.http.publicUrl || '(non définie)'));
console.log('  WhatsApp : ' + (config.whatsapp.actif ? 'activé' : 'non activé'));

if (avertissements.length) {
  console.log('\n  À regarder :');
  for (const a of avertissements) console.log('   · ' + a);
}

if (erreurs.length) {
  console.error('\n  Bloquant :');
  for (const e of erreurs) console.error('   ✗ ' + e);
  console.error('\n  Voir .env.example, puis : npm run keygen\n');
  process.exit(1);
}

console.log('\n  Configuration valide.\n');
