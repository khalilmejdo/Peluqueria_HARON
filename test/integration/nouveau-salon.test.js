/**
 * Un salon installe avec le .env de « npm run nouveau-salon » demarre a SON
 * nom, dans SA langue, avec SA carte et SON style — sans rien regler a l'ecran.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { IGNORE, demarrer } from './banc.js';

test('un nouveau salon demarre deja personnalise', { skip: IGNORE }, async (t) => {
  const banc = await demarrer({
    env: { APP_SALON_NOM: 'Ongles de Samira', APP_ACTIVITE: 'ONGLES', APP_LANGUE: 'fr', APP_MONNAIE: 'MAD' },
  });
  t.after(() => banc.arreter());
  const accueil = String((await banc.client().get('/')).body);
  assert.ok(accueil.includes('Ongles de Samira') && !accueil.includes('Mi salon'), 'son nom');
  assert.ok(accueil.includes('lang="fr"') && accueil.includes('data-activite="ONGLES"'), 'sa langue, son activite');
  assert.ok(accueil.includes('accueil-fiche'), 'le style de son activite');
  assert.ok(/Manucure|Vernis semi-permanent/.test(accueil) && accueil.includes('DH'), 'sa carte, en dirhams');
});
