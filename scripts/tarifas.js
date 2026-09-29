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
import { lireTous } from '../server/core/reglages.js';
import { t } from '../server/core/langue.js';
import { deviseActive, DEVISE_DEFAUT } from '../server/core/devise.js';

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
  // Lire les reglages d abord : c est ce qui pose la langue et la monnaie du
  // salon. Sans cela, la fiche serait affichee et ecrite en espagnol avec des
  // euros sur un salon marocain deja en service.
  await lireTous({ frais: true });
  const ligne = ([cleNom, prix, icone, cleNota, duree]) => ({
    nom: t(cleNom),
    cts: prix[deviseActive()] ?? prix[DEVISE_DEFAUT],
    icone,
    nota: cleNota ? t(cleNota) : null,
    duree: duree || 15,
  });
  const fiche = TARIFS_DE_DEPART.map(ligne);

  const actuelles = await all('SELECT nombre, precio_cts, icono FROM tarifas ORDER BY ordre, nombre_lower');
  tableau('EN BASE AUJOURD HUI (' + actuelles.length + ')', actuelles.map((t) => ({
    nom: t.nombre, prix: prixLegible(t.precio_cts), icone: t.icono || '',
  })));

  tableau('LA FICHE DU SALON (' + fiche.length + ')', fiche.map((l) => ({
    nom: l.nom, prix: prixLegible(l.cts), icone: l.icone,
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
    for (let i = 0; i < fiche.length; i += 1) {
      const l = fiche[i];
      // La duree EST ecrite : c est elle qui rend l attente annoncee juste, et
      // l oublier ici remettait toutes les prestations a la duree par defaut.
      await tx.query(
        'INSERT INTO tarifas (id, nombre, nombre_lower, precio_cts, nota, icono, ordre, duracion_min) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
        [newId(), l.nom, normalize(l.nom), l.cts, l.nota, l.icone || null, i, l.duree],
      );
    }
    return fiche.length;
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
