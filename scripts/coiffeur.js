#!/usr/bin/env node
/**
 * Cree ou repare un compte du salon : npm run coiffeur
 *
 *   npm run coiffeur -- --identifiant=youssef --nom="Youssef Haron" --role=GERANT
 *   npm run coiffeur -- --identifiant=youssef --mot-de-passe=UnMotDePasseSolide
 *
 * Sans --mot-de-passe, un mot de passe provisoire est tire au sort et affiche
 * une seule fois. Le compte devra le changer a sa premiere connexion.
 *
 * C'est la porte de secours quand plus personne ne peut entrer : elle s'ouvre
 * depuis le serveur, jamais depuis le reseau.
 */
import crypto from 'node:crypto';
import { assertConfig, config } from '../server/core/config.js';
import { one, execute, closePool } from '../server/db/index.js';
import { newId, hashPassword } from '../server/core/crypto.js';
import { CODES_ROLES } from '../server/core/roles.js';

assertConfig();

function argument(nom, defaut = null) {
  const prefixe = '--' + nom + '=';
  const trouve = process.argv.find((a) => a.startsWith(prefixe));
  return trouve ? trouve.slice(prefixe.length) : defaut;
}

async function main() {
  const identifiant = String(argument('identifiant', '')).trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,40}$/.test(identifiant)) {
    console.error('\n  --identifiant est obligatoire (lettres sans accent, chiffres, point, tiret, souligné).');
    console.error('  Exemple : npm run coiffeur -- --identifiant=youssef --nom="Youssef Haron" --role=GERANT\n');
    process.exit(1);
  }

  const role = String(argument('role', 'COIFFEUR')).toUpperCase();
  if (!CODES_ROLES.includes(role)) {
    console.error('\n  --role doit valoir ' + CODES_ROLES.join(' ou ') + '.\n');
    process.exit(1);
  }

  const nom = String(argument('nom', identifiant)).trim().slice(0, 80);
  const fourni = argument('mot-de-passe', null);
  const motDePasse = fourni || crypto.randomBytes(12).toString('base64url');
  if (motDePasse.length < config.security.passwordMinLength) {
    console.error('\n  Le mot de passe doit comporter au moins ' + config.security.passwordMinLength + ' caractères.\n');
    process.exit(1);
  }

  const hash = await hashPassword(motDePasse);
  const existant = await one('SELECT id FROM utilisateurs WHERE identifiant_lower = $1', [identifiant]);

  if (existant) {
    await execute(
      `UPDATE utilisateurs SET mot_de_passe_hash = $2, role = $3, nom_complet = $4, actif = TRUE,
              doit_changer_mot_de_passe = TRUE, tentatives_echouees = 0, verrouille_jusqu_a = NULL
        WHERE id = $1`,
      [existant.id, hash, role, nom],
    );
    await execute("UPDATE sessions SET revoked_at = now(), revoked_reason = 'compte réparé depuis le serveur' WHERE utilisateur_id = $1 AND revoked_at IS NULL", [existant.id]);
    console.log('\n  Compte « ' + identifiant + ' » réparé (rôle ' + role + ', réactivé, sessions fermées).');
  } else {
    await execute(
      `INSERT INTO utilisateurs (id, identifiant, identifiant_lower, nom_complet, mot_de_passe_hash, role, doit_changer_mot_de_passe)
       VALUES ($1,$2,$2,$3,$4,$5,TRUE)`,
      [newId(), identifiant, nom, hash, role],
    );
    console.log('\n  Compte « ' + identifiant + ' » créé (rôle ' + role + ').');
  }

  if (!fourni) {
    console.log('\n  Mot de passe provisoire (affiché une seule fois) :\n');
    console.log('      ' + motDePasse + '\n');
  }
  console.log('  Il devra être changé à la première connexion.\n');
}

main()
  .then(() => closePool())
  .catch(async (err) => {
    console.error('\n  Echec : ' + err.message);
    await closePool().catch(() => {});
    process.exit(1);
  });
