#!/usr/bin/env node
/**
 * Genere la paire de cles VAPID des avis pousses : npm run avisos:cles
 *
 * A coller dans `.env`, puis redeployer. Sans elles, les avis sont simplement
 * eteints : rien d'autre ne change dans le salon.
 *
 * LA PAIRE NE SE CHANGE PAS A LA LEGERE. Chaque navigateur scelle la CLE
 * PUBLIQUE dans son abonnement. Changer la paire rend donc muets, d'un coup,
 * tous les appareils deja abonnes — et personne ne s'en apercoit, puisqu'un
 * avis qui ne part pas ne fait aucun bruit. Il faut alors reactiver les avis
 * sur chaque telephone. On la genere une fois, et on la garde.
 *
 * WEBPUSH_SUJET identifie le salon aupres des services de notification : une
 * adresse de courriel ou l'adresse du site. Ils s'en servent pour prevenir en
 * cas de probleme ; une adresse inventee n'aide personne.
 */
import { genererCles } from '../server/core/webpush.js';

const cles = genererCles();

console.log('');
console.log('  Avis pousses — a coller dans .env, a ne jamais commiter :');
console.log('');
console.log('WEBPUSH_CLE_PUBLIQUE=' + cles.publique);
console.log('WEBPUSH_CLE_PRIVEE=' + cles.privee);
console.log('WEBPUSH_SUJET=mailto:votre.adresse@example.com');
console.log('');
console.log('  La cle PUBLIQUE part dans chaque navigateur : c est normal.');
console.log('  La cle PRIVEE ne sort jamais du serveur.');
console.log('');
console.log('  Ne la regenerez pas une fois le salon en service : tous les');
console.log('  appareils deja abonnes deviendraient muets, sans un mot.');
console.log('');
