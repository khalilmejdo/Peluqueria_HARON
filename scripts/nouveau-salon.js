#!/usr/bin/env node
/**
 * PREPARER L'INSTALLATION D'UN NOUVEAU SALON : npm run nouveau-salon
 *
 * Le meme code sert tous les salons ; ce qui fait d'une installation « le salon
 * de Samira a Casablanca » tient dans son fichier .env (le pays, l'activite, le
 * domaine, les secrets) puis dans l'ecran « Marque ». Ce script ecrit ce .env
 * en une fois, a partir de .env.example, au lieu de le remplir a la main :
 *
 *   npm run nouveau-salon
 *     (pose les questions une a une)
 *
 *   npm run nouveau-salon -- --nom="Ongles de Samira" --domaine=samira.duckdns.org \
 *     --activite=ONGLES --pays=MA --courriel=khalil@exemple.com
 *     (sans question : pour le refaire a l'identique)
 *
 * IL TIRE AU SORT DES SECRETS NEUFS A CHAQUE FOIS. Deux salons ne partagent
 * jamais une cle : la fuite de l'un ne doit rien ouvrir chez l'autre. Il refuse
 * d'ecraser un .env existant — ecraser les cles d'un salon en service rendrait
 * illisibles tous ses numeros de telephone.
 *
 * Il ne touche ni a la base, ni au serveur, ni a Docker : il ecrit un fichier
 * et dit quoi faire ensuite.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { fileURLToPath } from 'node:url';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Ce que le pays decide : la langue, la monnaie, l'heure et l'indicatif. */
export const PAYS = {
  MA: { libelle: 'Maroc', langue: 'fr', monnaie: 'MAD', fuseau: 'Africa/Casablanca', indicatif: '212' },
  ES: { libelle: 'Espagne', langue: 'es', monnaie: 'EUR', fuseau: 'Europe/Madrid', indicatif: '34' },
  FR: { libelle: 'France', langue: 'fr', monnaie: 'EUR', fuseau: 'Europe/Paris', indicatif: '33' },
};

export const ACTIVITES = {
  BARBERIA: 'barbier (homme)',
  PELUQUERIA: 'salon de coiffure (femme)',
  UNISEX: 'salon mixte',
  ESTETICA: 'institut de beaute',
  ONGLES: 'bar a ongles',
};

const DOMAINE_RE = /^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;
const COURRIEL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const IDENTIFIANT_RE = /^[a-z0-9._-]{3,32}$/;

/**
 * Les valeurs du .env d'un salon. Pur, a l'alea pres (injectable pour les tests).
 * @throws {Error} un message par champ invalide, tous ensemble
 */
export function valeursDuSalon({ nom, domaine, activite, pays, courriel, identifiant = 'gerant' }, alea = crypto.randomBytes) {
  const erreurs = [];
  const n = String(nom ?? '').trim();
  const d = String(domaine ?? '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/+$/, '');
  const a = String(activite ?? '').trim().toUpperCase();
  const p = String(pays ?? '').trim().toUpperCase();
  const c = String(courriel ?? '').trim();
  const i = String(identifiant ?? '').trim().toLowerCase();
  if (!n || n.length > 60 || /[\r\n=#"]/.test(n)) erreurs.push('--nom : le nom du salon, 60 caracteres au plus, sans « = », « # » ni guillemet.');
  if (!DOMAINE_RE.test(d)) erreurs.push('--domaine : un nom de domaine, par exemple samira.duckdns.org (lu : « ' + d + ' »).');
  if (!ACTIVITES[a]) erreurs.push('--activite : ' + Object.keys(ACTIVITES).join(', ') + ' (lu : « ' + a + ' »).');
  if (!PAYS[p]) erreurs.push('--pays : ' + Object.keys(PAYS).join(', ') + ' (lu : « ' + p + ' »).');
  if (!COURRIEL_RE.test(c)) erreurs.push('--courriel : l\'adresse que Let\'s Encrypt previendra si le certificat expire.');
  if (!IDENTIFIANT_RE.test(i)) erreurs.push('--identifiant : 3 a 32 lettres minuscules, chiffres, « . », « _ » ou « - ».');
  if (erreurs.length) throw new Error(erreurs.join('\n'));

  const reglage = PAYS[p];
  const hex = (octets) => alea(octets).toString('hex');
  return {
    APP_SALON_NOM: n,
    APP_ACTIVITE: a,
    APP_LANGUE: reglage.langue,
    APP_MONNAIE: reglage.monnaie,
    APP_TIMEZONE: reglage.fuseau,
    TELEPHONE_INDICATIF_DEFAUT: reglage.indicatif,
    WHATSAPP_LANGUE: reglage.langue,
    DOMAINE: d,
    COURRIEL_TLS: c,
    PUBLIC_URL: 'https://' + d,
    ALLOWED_ORIGINS: 'https://' + d,
    APP_SECRET: hex(32),
    APP_ENCRYPTION_KEY: hex(32),
    APP_PASSWORD_PEPPER: hex(32),
    POSTGRES_PASSWORD: hex(24),
    BOOTSTRAP_ADMIN_USERNAME: i,
    BOOTSTRAP_ADMIN_PASSWORD: alea(12).toString('base64url'),
  };
}

/** Une valeur ecrite telle quelle, ou entre guillemets si elle porte un espace. */
const enLigne = (v) => (/[\s'"$`\\]/.test(v) ? '"' + v.replace(/["\\$`]/g, (c) => '\\' + c) + '"' : v);

/**
 * Le .env : le modele ligne a ligne, chaque « CLE=... » remplace par sa
 * valeur, commentaires gardes (ils expliquent chaque reglage au prochain qui
 * ouvrira le fichier). Une cle absente du modele est ajoutee a la fin.
 */
export function composerEnv(modele, valeurs) {
  const restantes = new Set(Object.keys(valeurs));
  const lignes = String(modele).split(/\r?\n/).map((ligne) => {
    const m = /^([A-Z][A-Z0-9_]*)=/.exec(ligne);
    if (!m || !restantes.has(m[1])) return ligne;
    restantes.delete(m[1]);
    return m[1] + '=' + enLigne(valeurs[m[1]]);
  });
  if (restantes.size) {
    lignes.push('', '# --- Ajoute par npm run nouveau-salon ---');
    for (const cle of restantes) lignes.push(cle + '=' + enLigne(valeurs[cle]));
  }
  return lignes.join('\n').replace(/\n*$/, '\n');
}

/** « --cle=valeur » et « --cle valeur ». */
function lireArguments(argv) {
  const sortie = {};
  for (let i = 0; i < argv.length; i += 1) {
    const m = /^--([a-z]+)(?:=(.*))?$/.exec(argv[i]);
    if (!m) continue;
    sortie[m[1]] = m[2] !== undefined ? m[2] : (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[(i += 1)] : 'true');
  }
  return sortie;
}

async function principal() {
  const args = lireArguments(process.argv.slice(2));
  const cible = path.resolve(args.sortie || path.join(RACINE, '.env'));
  if (fs.existsSync(cible)) {
    console.error('\n  ' + cible + ' existe deja : je ne l\'ecrase pas.\n'
      + '  Si c\'est un salon en service, ses cles y sont : les perdre rendrait ses numeros illisibles.\n'
      + '  Pour preparer un AUTRE salon, ecrivez ailleurs :  npm run nouveau-salon -- --sortie=../salon-samira.env\n');
    process.exit(1);
  }

  const questions = [
    ['nom', 'Nom du salon (ex. Ongles de Samira) : '],
    ['activite', 'Activite — ' + Object.entries(ACTIVITES).map(([k, v]) => k + ' (' + v + ')').join(', ') + ' : '],
    ['pays', 'Pays — ' + Object.entries(PAYS).map(([k, v]) => k + ' (' + v.libelle + ')').join(', ') + ' : '],
    ['domaine', 'Adresse du site, sans https:// (ex. samira.duckdns.org) : '],
    ['courriel', 'Courriel pour le certificat HTTPS : '],
  ];
  const manquantes = questions.filter(([cle]) => !args[cle]);
  if (manquantes.length) {
    if (!process.stdin.isTTY) {
      console.error('Il manque : ' + manquantes.map(([cle]) => '--' + cle).join(', '));
      process.exit(1);
    }
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    console.log('\n  Nouveau salon — cinq questions. Tout se change ensuite dans l\'ecran « Marque ».\n');
    for (const [cle, question] of manquantes) args[cle] = await rl.question('  ' + question);
    rl.close();
  }

  let valeurs;
  try {
    valeurs = valeursDuSalon(args);
  } catch (err) {
    console.error('\n' + err.message + '\n');
    process.exit(1);
  }
  const modele = fs.readFileSync(path.join(RACINE, '.env.example'), 'utf8');
  // « wx » : jamais d'ecrasement, meme si le fichier est apparu entre-temps.
  fs.writeFileSync(cible, composerEnv(modele, valeurs), { flag: 'wx', mode: 0o600 });

  const pays = PAYS[String(args.pays).toUpperCase()];
  console.log(`
  Ecrit : ${cible}

  Salon      ${valeurs.APP_SALON_NOM} — ${ACTIVITES[valeurs.APP_ACTIVITE]}, ${pays.libelle}
  Adresse    https://${valeurs.DOMAINE}
  Langue     ${valeurs.APP_LANGUE}, monnaie ${valeurs.APP_MONNAIE}, heure ${valeurs.APP_TIMEZONE}, indicatif +${valeurs.TELEPHONE_INDICATIF_DEFAUT}
  Gerant     identifiant « ${valeurs.BOOTSTRAP_ADMIN_USERNAME} », mot de passe de depart : ${valeurs.BOOTSTRAP_ADMIN_PASSWORD}
             (a changer a la premiere connexion — l'application l'exige)

  !! GARDEZ UNE COPIE DE CE FICHIER HORS DU SERVEUR (dossier des cles, sur ce poste).
     Sans APP_ENCRYPTION_KEY, une sauvegarde restauree a des numeros illisibles.

  La suite pas a pas : docs/NOUVEAU-SALON.md. En bref, sur la machine du salon :
    1. git clone du depot dans /opt/haron, puis copier ce fichier en /opt/haron/.env   (chmod 600)
    2. ./scripts/deployer.sh
    3. votre compte d'editeur, au-dessus du gerant :
       docker compose -f docker-compose.oci.yml exec app node scripts/coiffeur.js --identifiant=khalil --nom="Khalil" --role=SUPERADMIN
    4. https://${valeurs.DOMAINE}/gestion : onglet « Marque » (logo, couleurs), puis la carte, les horaires, les photos.
    5. quand le gerant s'est connecte : vider BOOTSTRAP_ADMIN_PASSWORD dans le .env du serveur.
`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  principal().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
