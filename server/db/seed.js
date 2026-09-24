/**
 * Donnees de reference.
 *
 * Idempotent, joue a chaque demarrage du conteneur :
 *
 *   - poser les reglages par defaut qui n'existent pas encore. Il ne TOUCHE
 *     JAMAIS a un reglage deja enregistre : le gerant est maitre chez lui, et
 *     un redeploiement ne doit pas lui remettre 20 minutes par coupe alors
 *     qu'il en a mis 35 ;
 *   - creer un premier fauteuil et une fiche de prix de depart, uniquement si
 *     ces tables sont VIDES. Une ligne de tarif supprimee ne doit pas
 *     reapparaitre au redeploiement suivant ;
 *   - creer le premier compte du salon si la table est vide, et seulement dans
 *     ce cas, a partir de BOOTSTRAP_ADMIN_USERNAME / BOOTSTRAP_ADMIN_PASSWORD.
 */
import { config } from '../core/config.js';
import { execute, one } from './index.js';
import { newId, hashPassword } from '../core/crypto.js';
import { normalize } from '../core/text.js';
import { CATALOGUE } from '../core/reglages.js';

/**
 * La fiche de prix de depart : celle du tableau affiche dans le salon.
 *
 *   nom, prix EN CENTIMES, icone, note
 *
 * Elle n'est posee que sur une base VIDE. Sur un salon deja en service, c'est
 * `npm run tarifas` qui la charge, et lui seul — le seed ne doit jamais
 * ecraser les prix que le gerant a saisis.
 */
export const TARIFS_DE_DEPART = [
  ['Corte normal', 700, 'tijeras', ''],
  ['Barba', 500, 'barba', ''],
  ['Corte + barba', 1200, 'navaja', 'El más pedido'],
  ['Mascarilla', 300, 'mascarilla', ''],
  ['Dark', 800, 'bote', ''],
  ['Queratina', 4000, 'gota', ''],
  ['Mechas', 2000, 'mechas', ''],
  ['Mechas blancas', 4000, 'mechas', ''],
  ['Peinado', 300, 'peine', ''],
  ['Cejas', 300, 'cejas', ''],
  ['Cejas con cera', 300, 'cera', ''],
  ['Tinte normal', 500, 'tinte', ''],
  ['Tinte de pelo', 1000, 'tinte', ''],
  ['Tinte barba', 300, 'barba', ''],
  ['Lavado de pelo', 200, 'lavado', ''],
];

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
      [newId(), 'Sillón 1', normalize('Sillón 1')],
    );
    dire('  Fauteuils : « Sillón 1 » cree.');
  } else {
    dire('  Fauteuils : ' + fauteuils.n + ' deja present(s).');
  }

  // Une fiche de prix de depart, pour que la vitrine ne soit jamais vide le
  // premier jour. Le gerant la corrige en deux minutes depuis l'espace de
  // gestion ; les prix ci-dessous sont des ordres de grandeur, pas une verite.
  const tarifs = await one('SELECT COUNT(*)::int AS n FROM tarifas');
  if (tarifs.n === 0) {
    for (let i = 0; i < TARIFS_DE_DEPART.length; i += 1) {
      const [nombre, cts, icono, nota] = TARIFS_DE_DEPART[i];
      await execute(
        'INSERT INTO tarifas (id, nombre, nombre_lower, precio_cts, nota, icono, ordre) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [newId(), nombre, normalize(nombre), cts, nota || null, icono || null, i],
      );
    }
    dire('  Fiche de prix : ' + TARIFS_DE_DEPART.length + ' ligne(s) de depart creee(s).');
  } else {
    dire('  Fiche de prix : ' + tarifs.n + ' ligne(s) deja presente(s).');
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
    [newId(), identifiant, 'Gerente del salón', await hashPassword(config.bootstrap.password)],
  );
  dire('  Compte gerant « ' + identifiant + ' » cree. Il devra changer son mot de passe a la premiere connexion.');
  return { reglagesPoses: poses, compteCree: true };
}
