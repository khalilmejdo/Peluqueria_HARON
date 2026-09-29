/**
 * Le dictionnaire, verifie sans base et sans serveur.
 *
 * Trois defauts de ce fichier ne se voient JAMAIS a l'execution, et c'est pour
 * eux que ce test existe :
 *
 *   1. UNE CLE EN DOUBLE. En JavaScript, la seconde ecrase la premiere en
 *      silence. Avec six cents cles ecrites a la main, c'est l'accident le plus
 *      probable du lot, et le symptome est une phrase qui change au mauvais
 *      endroit — impossible a relier a sa cause.
 *   2. UN « {parametre} » OUBLIE D'UN COTE. La page francaise afficherait alors
 *      « Nous rouvrons le . » sans erreur, sans journal, sans rien.
 *   3. UN PLURIEL DECLARE DANS UNE SEULE LANGUE : l'autre dirait « 1 personnes ».
 *
 * Les deux premiers demandent de lire le fichier comme du TEXTE : l'objet
 * charge par Node a deja perdu l'information. C'est la meme methode que
 * schema-sql.test.js, pour la meme raison.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { TEXTES } from '../../server/core/textes.js';
import { TEXTES as TEXTES_CLIENT } from '../../public/js/textes.js';
import {
  texte, traduire, t, poserLangueActive, langueActive,
  indicePluriel, existe, CODES_LANGUES, LANGUES, LANGUE_DEFAUT,
} from '../../server/core/langue.js';

const RACINE = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));

/**
 * LES DEUX DICTIONNAIRES PASSENT LES MEMES EPREUVES.
 *
 * Celui du navigateur est aussi facile a casser que celui du serveur, et son
 * defaut se voit encore moins : une cle en double dans un ecran de gestion
 * change une phrase a l'autre bout de l'application, et personne ne relie les
 * deux. Les quatre controles tournent donc sur les deux fichiers.
 */
const DICTIONNAIRES = [
  { nom: 'serveur', entrees: TEXTES, fichier: 'server/core/textes.js' },
  { nom: 'navigateur', entrees: TEXTES_CLIENT, fichier: 'public/js/textes.js' },
];

const parametres = (s) => new Set([...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]));

/* ------------------------------------------------------------------ */
/*  Les fichiers eux-memes                                            */
/* ------------------------------------------------------------------ */

test('aucune cle en double dans les dictionnaires', () => {
  for (const { nom, entrees, fichier } of DICTIONNAIRES) {
    const source = fs.readFileSync(path.join(RACINE, fichier), 'utf8');
    // Les cles sont toujours ecrites entre apostrophes en debut de ligne,
    // suivies de deux-points : « 'accueil.titre': { ... } ».
    const vues = new Map();
    const doublons = [];
    source.split(/\r?\n/).forEach((ligne, i) => {
      const m = /^\s*'([a-zA-Z0-9_.-]+)':\s*\{/.exec(ligne);
      if (!m) return;
      const cle = m[1];
      if (vues.has(cle)) doublons.push(cle + ' (lignes ' + vues.get(cle) + ' et ' + (i + 1) + ')');
      else vues.set(cle, i + 1);
    });

    assert.deepEqual(doublons, [], nom + ' : cles en double, la seconde ecrase la premiere en silence');
    // Le compte doit tomber juste : si le motif ci-dessus ratait des lignes, le
    // test ne verifierait plus rien tout en restant vert.
    assert.equal(vues.size, Object.keys(entrees).length,
      nom + ' : le motif de lecture ne retrouve pas toutes les cles chargees par Node');
  }
});

test('chaque cle est traduite dans les deux langues', () => {
  const manques = [];
  for (const { nom, entrees } of DICTIONNAIRES) {
    for (const [cle, entree] of Object.entries(entrees)) {
      for (const code of CODES_LANGUES) {
        const valeur = entree[code];
        if (typeof valeur !== 'string' || valeur.trim() === '') manques.push(nom + ' ' + cle + '.' + code);
      }
      // Une entree qui porterait une troisieme langue serait une faute de frappe.
      const inconnues = Object.keys(entree).filter((k) => !CODES_LANGUES.includes(k));
      assert.deepEqual(inconnues, [], nom + ' : cle ' + cle + ', champ inattendu');
    }
  }
  assert.deepEqual(manques, []);
});

test('les parametres sont les memes dans les deux langues', () => {
  const ecarts = [];
  for (const { nom, entrees } of DICTIONNAIRES) {
    for (const [cle, entree] of Object.entries(entrees)) {
      const es = parametres(entree.es);
      const fr = parametres(entree.fr);
      const seulEs = [...es].filter((p) => !fr.has(p));
      const seulFr = [...fr].filter((p) => !es.has(p));
      if (seulEs.length || seulFr.length) {
        ecarts.push(nom + ' ' + cle + ' : es={' + [...es].join(',') + '} fr={' + [...fr].join(',') + '}');
      }
    }
  }
  assert.deepEqual(ecarts, []);
});

test('un pluriel declare dans une langue l est dans l autre', () => {
  const ecarts = [];
  for (const { nom, entrees } of DICTIONNAIRES) {
    for (const [cle, entree] of Object.entries(entrees)) {
      if (entree.es.includes('|') !== entree.fr.includes('|')) ecarts.push(nom + ' ' + cle);
    }
  }
  assert.deepEqual(ecarts, []);
});

/**
 * LE MOT A RECOPIER POUR EFFACER L'HISTORIQUE DOIT ETRE LE MEME DES DEUX COTES.
 *
 * Le navigateur l'affiche, le serveur le compare. S'ils divergent, le gerant
 * recopie exactement ce que l'ecran lui demande et se voit refuser — sans aucun
 * moyen de comprendre pourquoi, puisque les deux mots sont invisibles l'un a
 * l'autre. C'est le seul texte de l'application dont l'egalite est fonctionnelle
 * et non cosmetique.
 */
test('le mot de confirmation de la purge est identique des deux cotes', () => {
  for (const code of CODES_LANGUES) {
    assert.equal(
      TEXTES_CLIENT['reglages.purge.mot'][code],
      TEXTES['admin.purgeMot'][code],
      'le mot a recopier diverge en ' + code + ' : la purge serait refusee sans explication',
    );
  }
});

/* ------------------------------------------------------------------ */
/*  Le moteur                                                         */
/* ------------------------------------------------------------------ */

test('le pluriel ne coupe pas au meme endroit dans les deux langues', () => {
  // Zero : l'espagnol met le pluriel, le francais le singulier. C'est LA
  // difference qui justifie une fonction plutot qu'un « n > 1 » recopie.
  assert.equal(indicePluriel('es', 0), 1);
  assert.equal(indicePluriel('fr', 0), 0);
  assert.equal(indicePluriel('es', 1), 0);
  assert.equal(indicePluriel('fr', 1), 0);
  assert.equal(indicePluriel('es', 2), 1);
  assert.equal(indicePluriel('fr', 2), 1);
  // Sans nombre, on prend la premiere branche plutot que de rendre du vide.
  assert.equal(indicePluriel('fr', undefined), 0);
});

test('le pluriel choisit la bonne branche dans chaque langue', () => {
  assert.equal(texte('es', 'accueil.enFile', { n: 1 }), '1 persona en la fila');
  assert.equal(texte('es', 'accueil.enFile', { n: 3 }), '3 personas en la fila');
  assert.equal(texte('fr', 'accueil.enFile', { n: 1 }), '1 personne dans la file');
  assert.equal(texte('fr', 'accueil.enFile', { n: 3 }), '3 personnes dans la file');
});

test('les parametres sont remplaces, et les inconnus laisses tels quels', () => {
  assert.equal(texte('fr', 'conges.reouverture', { date: 'lundi 5 octobre 2026' }),
    'Nous rouvrons le lundi 5 octobre 2026.');
  // Un parametre absent laisse son accolade : une phrase amputee se repare, une
  // phrase silencieusement fausse ne se voit pas.
  assert.match(texte('fr', 'conges.reouverture', {}), /\{date\}/);
});

test('une cle inconnue rend la cle, et ne lance pas', () => {
  assert.equal(texte('fr', 'cette.cle.n.existe.pas'), 'cette.cle.n.existe.pas');
});

test('une langue inconnue retombe sur la langue par defaut', () => {
  assert.equal(texte('de', 'commun.accueil'), texte(LANGUE_DEFAUT, 'commun.accueil'));
});

test('traduire fige la langue et porte de quoi construire la page', () => {
  const tr = traduire('fr');
  assert.equal(tr.langue, 'fr');
  assert.equal(tr.htmlLang, 'fr');
  assert.equal(tr.ogLocale, 'fr_FR');
  assert.equal(tr('commun.accueil'), 'Accueil');
});

test('la langue active gouverne t(), et revient a l espagnol par defaut', () => {
  const avant = langueActive();
  try {
    poserLangueActive('fr');
    assert.equal(langueActive(), 'fr');
    assert.equal(t('commun.ferme'), 'Fermé');
    poserLangueActive('es');
    assert.equal(t('commun.ferme'), 'Cerrado');
    // Une valeur impossible ne laisse pas le salon muet.
    poserLangueActive('klingon');
    assert.equal(langueActive(), LANGUE_DEFAUT);
  } finally {
    poserLangueActive(avant);
  }
});

test('existe() dit la verite sur les cles facultatives', () => {
  assert.equal(existe('reglage.salon.nom.aide'), true);
  // « salon.accroche » n'a volontairement pas d'aide : son libelle suffit.
  assert.equal(existe('reglage.salon.accroche.aide'), false);
});

test('chaque langue declaree porte ce qu il faut pour rendre une page', () => {
  for (const code of CODES_LANGUES) {
    const l = LANGUES[code];
    assert.equal(l.code, code);
    assert.match(l.htmlLang, /^[a-z]{2}$/);
    assert.match(l.ogLocale, /^[a-z]{2}_[A-Z]{2}$/);
    assert.ok(l.nomLocal.length > 0);
  }
});
