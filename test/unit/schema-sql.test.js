/**
 * Le schema, relu sans base de donnees.
 *
 * POURQUOI CE FICHIER EXISTE. Le 25 septembre 2026, un bloc `DO $$ ... $$` a
 * ete ecrit `DO $ ... $` : un dollar perdu a l'echappement d'un script shell.
 * PostgreSQL a refuse le fichier entier avec « syntax error at or near "$" »,
 * l'application a boucle sur son demarrage, et le salon est reste injoignable
 * pendant qu'on cherchait ailleurs.
 *
 * Rien ne l'avait vu : les tests unitaires ne touchent pas a SQL, et les tests
 * d'integration -- qui l'auraient attrape des la premiere seconde -- demandent
 * une base, donc ne tournent que sur le serveur, donc APRES le deploiement.
 *
 * Les controles ci-dessous ne remplacent pas PostgreSQL. Ils attrapent la
 * famille d'erreurs qui casse le fichier ENTIER : une seule faute de
 * delimiteur, et plus une ligne du schema ne s'applique.
 */
import './amorce.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const SCHEMA = fs.readFileSync(path.join(process.cwd(), 'server/db/schema.sql'), 'utf8');

/** Les lignes hors commentaire : un `--` en debut de ligne ne compte pas. */
const LIGNES = SCHEMA.split('\n')
  .map((l, i) => ({ n: i + 1, texte: l }))
  .filter((l) => !l.texte.trim().startsWith('--'));

test('aucun dollar isole ne sert de delimiteur', () => {
  // `$` n'a aucun autre usage dans ce fichier : pas de parametre `$1`, pas de
  // chaine qui en contienne. Tout `$` doit donc appartenir a un `$$`.
  const fautifs = LIGNES.filter((l) => /(^|[^$])\$([^$]|$)/.test(l.texte));
  assert.deepEqual(
    fautifs.map((l) => l.n + ': ' + l.texte.trim()),
    [],
    'dollar isolé — un délimiteur `$$` a perdu un caractère',
  );
});

test('les delimiteurs $$ vont par paires', () => {
  const total = (SCHEMA.match(/\$\$/g) || []).length;
  assert.equal(total % 2, 0, total + ' délimiteurs `$$` : il en manque un');
});

/*
 * Chaque bloc anonyme doit etre ouvert ET referme. Un `END $$;` oublie fait
 * avaler au bloc tout le reste du fichier : PostgreSQL se plaint alors d'une
 * erreur situee des centaines de lignes plus loin, et on cherche au mauvais
 * endroit.
 */
test('chaque DO est referme', () => {
  const ouverts = (SCHEMA.match(/^DO \$\$ BEGIN$/gm) || []).length;
  const fermes = (SCHEMA.match(/END \$\$;/g) || []).length;
  const fonctions = (SCHEMA.match(/LANGUAGE plpgsql AS \$\$/g) || []).length;
  assert.equal(ouverts + fonctions, fermes,
    ouverts + ' blocs DO et ' + fonctions + ' fonctions pour ' + fermes + ' fermetures');
});

/*
 * Le schema est rejoue A CHAQUE DEMARRAGE. Une instruction qui ne supporte pas
 * d'etre rejouee fait tomber le salon au premier redemarrage -- ce qui est
 * arrive le 24 septembre, en production, avec une contrainte EXCLUDE.
 */
test('toute creation est idempotente', () => {
  const creations = LIGNES.filter((l) => /^\s*CREATE (TABLE|INDEX|UNIQUE INDEX)\b/i.test(l.texte));
  const sansGarde = creations.filter((l) => !/IF NOT EXISTS/i.test(l.texte));
  assert.deepEqual(
    sansGarde.map((l) => l.n + ': ' + l.texte.trim()),
    [],
    'CREATE sans « IF NOT EXISTS » : le prochain redémarrage échouera',
  );
});

/*
 * `ADD CONSTRAINT` n'a pas de « IF NOT EXISTS » en PostgreSQL. Chaque ajout
 * doit donc etre protege, et il y a DEUX facons de le faire, toutes deux
 * presentes dans ce fichier :
 *
 *   - rattraper l'erreur APRES : `EXCEPTION WHEN duplicate_object` ;
 *   - verifier AVANT : un `IF NOT EXISTS (SELECT 1 FROM pg_constraint ...)`.
 *
 * La seconde existe parce qu'une contrainte EXCLUDE cree un INDEX portant son
 * nom : la rejouer leve `42P07`, pas `duplicate_object`, et le rattrapage
 * classique la laissait passer. C'est ce qui a mis le salon en 502 au premier
 * redemarrage, le 24 septembre 2026.
 *
 * On regarde donc AUTOUR de la ligne, dans les deux sens.
 */
test('toute contrainte ajoutee est protegee du doublon', () => {
  const lignes = SCHEMA.split('\n');
  const manquants = [];
  lignes.forEach((ligne, i) => {
    if (!/ADD CONSTRAINT/i.test(ligne) || ligne.trim().startsWith('--')) return;
    const autour = lignes.slice(Math.max(0, i - 8), i + 6).join('\n');
    const protege = /EXCEPTION WHEN duplicate_object/i.test(autour)
      || /IF NOT EXISTS\s*\(/i.test(autour);
    if (!protege) manquants.push((i + 1) + ': ' + ligne.trim());
  });
  assert.deepEqual(manquants, [], 'ADD CONSTRAINT sans protection contre le doublon');
});
