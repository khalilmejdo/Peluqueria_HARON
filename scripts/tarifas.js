#!/usr/bin/env node
/**
 * Charge la fiche de prix du salon sur une base DEJA EN SERVICE.
 *
 *     npm run tarifas -- --apercu     montre ce qui changerait, sans rien ecrire
 *     npm run tarifas -- --remplacer  remplace la fiche entiere
 *
 * POURQUOI UN SCRIPT ET PAS LE SEED. Le seed ne touche jamais une table qui
 * contient deja quelque chose — c'est ce qui protege les prix saisis par le
 * gerant d'un redeploiement. Sur un salon deja demarre avec la fiche
 * d'exemple, il ne servirait donc a rien.
 *
 * `--remplacer` VIDE la table avant d'ecrire. C'est voulu et c'est dit : une
 * fusion « intelligente » sur les noms laisserait des doublons proches
 * (« Corte » / « Corte normal ») que personne ne verrait avant de les lire en
 * vitrine. Aucun ticket ne reference un tarif : rien d'autre n'est perdu.
 *
 * Sans option, le script ne fait qu'AFFICHER. On ne remplace pas une fiche de
 * prix par accident.
 */
import { TARIFS_DE_DEPART } from '../server/db/seed.js';
import { transaction, all, closePool } from '../server/db/index.js';
import { newId } from '../server/core/crypto.js';
import { normalize } from '../server/core/text.js';
import { prixLegible } from '../server/domain/tarifas.js';

const options = new Set(process.argv.slice(2));
const remplacer = options.has('--remplacer');
const apercu = options.has('--apercu') || !remplacer;

function tableau(titre, lignes) {
  console.log('');
  console.log('  ' + titre);
  console.log('  ' + '-'.repeat(titre.length));
  if (!lignes.length) {
    console.log('  (vide)');
    return;
  }
  for (const l of lignes) {
    console.log('  ' + String(l.nom).padEnd(22) + String(l.prix).padStart(9)
      + (l.icone ? '   ' + l.icone : ''));
  }
}

try {
  const actuelles = await all('SELECT nombre, precio_cts, icono FROM tarifas ORDER BY ordre, nombre_lower');
  tableau('EN BASE AUJOURD HUI (' + actuelles.length + ')', actuelles.map((t) => ({
    nom: t.nombre, prix: prixLegible(t.precio_cts), icone: t.icono || '',
  })));

  tableau('LA FICHE DU SALON (' + TARIFS_DE_DEPART.length + ')', TARIFS_DE_DEPART.map(([nom, cts, icone]) => ({
    nom, prix: prixLegible(cts), icone,
  })));

  if (apercu) {
    console.log('');
    console.log('  Rien n a ete ecrit. Pour remplacer la fiche entiere :');
    console.log('');
    console.log('      npm run tarifas -- --remplacer');
    console.log('');
    process.exit(0);
  }

  const n = await transaction(async (tx) => {
    await tx.query('DELETE FROM tarifas');
    for (let i = 0; i < TARIFS_DE_DEPART.length; i += 1) {
      const [nombre, cts, icono, nota] = TARIFS_DE_DEPART[i];
      await tx.query(
        'INSERT INTO tarifas (id, nombre, nombre_lower, precio_cts, nota, icono, ordre) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [newId(), nombre, normalize(nombre), cts, nota || null, icono || null, i],
      );
    }
    return TARIFS_DE_DEPART.length;
  });

  console.log('');
  console.log('  ' + n + ' prestation(s) enregistree(s). La vitrine est a jour.');
  console.log('');
} catch (err) {
  console.error('');
  console.error('  ECHEC : ' + err.message);
  console.error('');
  process.exitCode = 1;
} finally {
  await closePool();
}
