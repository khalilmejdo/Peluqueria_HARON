/**
 * Donnees de reference.
 *
 * Idempotent, joue a chaque demarrage du conteneur. Il ne fait que deux choses :
 *
 *   - poser les reglages par defaut qui n'existent pas encore. Il ne TOUCHE
 *     JAMAIS a un reglage deja enregistre : le gerant est maitre chez lui, et
 *     un redeploiement ne doit pas lui remettre 20 minutes par coupe alors
 *     qu'il en a mis 35 ;
 *   - creer le premier compte du salon si la table est vide, et seulement dans
 *     ce cas, a partir de BOOTSTRAP_ADMIN_USERNAME / BOOTSTRAP_ADMIN_PASSWORD.
 */
import { config } from '../core/config.js';
import { execute, one } from './index.js';
import { newId, hashPassword } from '../core/crypto.js';
import { normalize } from '../core/text.js';
import { CATALOGUE } from '../core/reglages.js';

export async function seed({ silencieux = false } = {}) {
  const dire = silencieux ? () => {} : (message) => console.log(message);

  let poses = 0;
  for (const [cle, regle] of Object.entries(CATALOGUE)) {
    const valeur = regle.type === 'booleen' ? (regle.defaut ? 'true' : 'false') : String(regle.defaut ?? '');
    poses += await execute(
      'INSERT INTO reglages (cle, valeur) VALUES ($1, $2) ON CONFLICT (cle) DO NOTHING',
      [cle, valeur],
    );
  }
  dire('  Reglages : ' + poses + ' valeur(s) par defaut posee(s), '
    + (Object.keys(CATALOGUE).length - poses) + ' deja definie(s).');

  // Un salon a toujours au moins un fauteuil. Celui-ci n'est cree que si la
  // table est vide : un gerant qui l'a renomme « Poste vitrine » ne le verra
  // pas revenir a chaque redeploiement.
  const fauteuils = await one('SELECT COUNT(*)::int AS n FROM postes');
  if (fauteuils.n === 0) {
    await execute(
      'INSERT INTO postes (id, nom, nom_lower, ordre) VALUES ($1, $2, $3, 1)',
      [newId(), 'Fauteuil 1', normalize('Fauteuil 1')],
    );
    dire('  Fauteuils : « Fauteuil 1 » cree.');
  } else {
    dire('  Fauteuils : ' + fauteuils.n + ' deja present(s).');
  }

  const compte = await one('SELECT COUNT(*)::int AS n FROM utilisateurs');
  if (compte.n > 0) {
    dire('  Comptes : ' + compte.n + ' deja present(s), rien a creer.');
    return { reglagesPoses: poses, compteCree: false };
  }

  if (!config.bootstrap.password) {
    dire('  Aucun compte et BOOTSTRAP_ADMIN_PASSWORD absent : creez-en un avec « npm run coiffeur ».');
    return { reglagesPoses: poses, compteCree: false };
  }
  if (config.bootstrap.password.length < config.security.passwordMinLength) {
    throw new Error('BOOTSTRAP_ADMIN_PASSWORD est trop court : ' + config.security.passwordMinLength + ' caracteres au minimum.');
  }

  const identifiant = config.bootstrap.username.toLowerCase();
  await execute(
    `INSERT INTO utilisateurs (id, identifiant, identifiant_lower, nom_complet, mot_de_passe_hash, role, doit_changer_mot_de_passe)
     VALUES ($1,$2,$2,$3,$4,'GERANT',TRUE)`,
    [newId(), identifiant, 'Gérant du salon', await hashPassword(config.bootstrap.password)],
  );
  dire('  Compte gerant « ' + identifiant + ' » cree. Il devra changer son mot de passe a la premiere connexion.');
  return { reglagesPoses: poses, compteCree: true };
}
