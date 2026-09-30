/**
 * AUCUNE PHRASE N'ARRIVE A L'ECRAN SANS PASSER PAR LE DICTIONNAIRE.
 *
 * Le premier balayage cherchait des MOTS espagnols dans le code. Il a laisse
 * passer « Lecture de la requete interrompue » (du francais sans accent) et
 * « Estructura JSON demasiado profunda » (de l'espagnol sans aucun mot de sa
 * liste) : deviner la langue d'une chaine ne marche pas.
 *
 * Ce test regarde l'autre bout : les ENDROITS par ou une phrase sort vers un
 * humain — un refus d'API, un `texte:` d'element, une fenetre `confirm`, un
 * `placeholder`, une annonce au lecteur d'ecran. A ces endroits, une chaine
 * litterale qui contient des lettres est une phrase figee dans une langue ; elle
 * doit passer par t(). Peu importe laquelle, c'est la place qui compte.
 *
 * Les rares litteraux legitimes (un nom de produit, un symbole) sont listes
 * ci-dessous un par un, avec leur raison. La liste doit rester courte : si elle
 * grossit, c'est que le test est contourne.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));

/** Les sorties vers un humain, et la forme litterale qu'on y refuse. */
const PUITS = [
  /\b(?:badRequest|notFound|conflict|forbidden|unauthorized|tooLarge|unsupportedMedia)\(\s*'((?:[^'\\]|\\.)*)'/g,
  /\bnew AppError\(\s*\d+\s*,\s*'((?:[^'\\]|\\.)*)'/g,
  /\bnew (?:ValidationError|ErreurApi|Error)\(\s*\{\s*[\w.'"]+\s*:\s*'((?:[^'\\]|\\.)*)'/g,
  /\bnew ErreurApi\(\s*'((?:[^'\\]|\\.)*)'/g,
  /\b(?:texte|placeholder|title|legende|message|libelle|'aria-label')\s*:\s*'((?:[^'\\]|\\.)*)'/g,
  /\b(?:confirm|prompt|alert|annoncer|signaler|dire|confirmer)\(\s*'((?:[^'\\]|\\.)*)'/g,
  /\.textContent\s*=\s*'((?:[^'\\]|\\.)*)'/g,
  /requiredMessage\s*:\s*'((?:[^'\\]|\\.)*)'/g,
  /patternMessage\s*:\s*'((?:[^'\\]|\\.)*)'/g,
];

/**
 * Les litteraux admis. Chacun a une raison ; aucun n'est une phrase.
 */
const ADMIS = new Set([
  'WhatsApp', // nom de produit, identique dans les deux langues
  'Peluquería HARON', // nom de l'enseigne, jamais traduit
  '·', '×', '—', '#', '+', '⠿', '↑', '↓', '≈ ',
  'SVG', 'PNG', 'CSV',
  'Euro (€)', 'Dirham (DH)', // noms de monnaies, identiques dans les deux langues
]);

/** Les fichiers qui ne parlent a personne, ou qui SONT le dictionnaire. */
const EXCLUS = [
  'server/core/textes.js', 'public/js/textes.js', 'server/core/config.js',
  'server/core/logger.js', 'server/db/', 'server/core/sentry.js', 'server/core/webpush.js',
  'server/core/whatsapp.js', 'server/core/langue.js', 'server/core/png.js', 'server/core/qrcode.js', 'public/sw.js',
];

function fichiers(dir, sortie = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) fichiers(p, sortie);
    else if (e.name.endsWith('.js')) sortie.push(p);
  }
  return sortie;
}

/** Retire les commentaires sans toucher aux chaines. Grossier mais suffisant ici. */
function sansCommentaires(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:'"\\])\/\/[^\n]*/g, (m, avant) => avant + ' '.repeat(m.length - avant.length));
}

test('aucune phrase figee dans une langue n arrive a l ecran', () => {
  const cibles = [...fichiers(path.join(RACINE, 'server')), ...fichiers(path.join(RACINE, 'public/js'))]
    .map((f) => path.relative(RACINE, f).replace(/\\/g, '/'))
    .filter((rel) => !EXCLUS.some((e) => rel === e || rel.startsWith(e)));

  const fautes = [];
  for (const rel of cibles) {
    const src = sansCommentaires(fs.readFileSync(path.join(RACINE, rel), 'utf8'));
    for (const motif of PUITS) {
      for (const m of src.matchAll(motif)) {
        const litteral = m[1];
        if (!/\p{L}{2,}/u.test(litteral)) continue; // ni lettre, ni phrase
        if (ADMIS.has(litteral)) continue;
        // Une CLE de dictionnaire n'est pas une phrase : « nav.file », « reglage. ».
        if (/^[a-z][a-zA-Z0-9]*(.[a-zA-Z0-9]*)+$/.test(litteral)) continue;
        const ligne = src.slice(0, m.index).split('\n').length;
        fautes.push(rel + ':' + ligne + '  « ' + litteral.slice(0, 70) + ' »');
      }
    }
  }
  assert.deepEqual(fautes, [], 'phrases a faire passer par t() :\n  ' + fautes.join('\n  '));
});
