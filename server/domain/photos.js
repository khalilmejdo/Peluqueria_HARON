/**
 * Les photos du salon.
 *
 * Elles se gerent depuis l'espace de gestion : envoyees depuis le telephone du
 * gerant, legendees, ordonnees, masquees, et l'une d'elles choisie comme
 * COUVERTURE — la grande image qui ouvre la vitrine. Avant, il fallait les
 * deposer par `scp` dans un dossier monte en lecture seule : autrement dit,
 * personne ne le faisait, et la vitrine n'a jamais eu de photo.
 *
 * TROIS REGLES, qui viennent de loca-stad ou elles tiennent deja :
 *
 *   - le TYPE se lit dans les OCTETS, jamais dans l'extension ni dans l'en-tete
 *     annonce par le navigateur. Un fichier HTML renomme en .jpg reste du HTML
 *     et il est refuse. SVG n'est pas admis : c'est du XML qui peut porter un
 *     script, et il serait servi sur l'origine de l'application ;
 *   - le nom sur disque est un IDENTIFIANT ALEATOIRE. Le nom d'origine
 *     (« IMG_2034.HEIC.jpg ») ne sert a rien et n'est pas garde ;
 *   - aucun chemin ne vient d'une requete. Il est reconstruit depuis la base,
 *     verifie contre un motif strict, puis contre le dossier racine.
 *
 * Fonctions pures en tete (testees sans base), stockage ensuite.
 */
import fs from 'node:fs/promises';
import { constants as FS } from 'node:fs';
import path from 'node:path';
import { all, one, execute, transaction } from '../db/index.js';
import { newId } from '../core/crypto.js';
import { config } from '../core/config.js';
import { AppError, badRequest, notFound, conflict, unsupportedMedia } from '../core/errors.js';
import { cleanSpaces } from '../core/text.js';
import { t } from '../core/langue.js';
import { log } from '../core/logger.js';

/** Une page d'accueil n'est pas un album : chaque photo pese au chargement. */
export const GALERIE_MAX = 24;
export const LEGENDE_MAX = 80;

/* ------------------------------------------------------------------ */
/*  Lecture des octets                                                 */
/* ------------------------------------------------------------------ */

const EXTENSIONS = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const MOTIF_FICHIER = /^[0-9a-f-]{36}\.(jpg|png|webp)$/;

const egal = (buffer, decalage, octets) => octets.every((o, i) => buffer[decalage + i] === o);
const ascii = (buffer, decalage, texte) => buffer.toString('latin1', decalage, decalage + texte.length) === texte;

/**
 * Les dimensions d'un JPEG, lues dans son marqueur SOF.
 *
 * On parcourt les segments un par un (chacun annonce sa longueur) jusqu'au
 * premier SOFn. Les marqueurs sans longueur (RSTn, SOI) sont sautes. Une
 * longueur incoherente arrete la lecture : on rend null plutot que de lire au
 * hasard dans un fichier abime.
 */
function dimensionsJpeg(b) {
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) { i += 1; continue; }
    const marqueur = b[i + 1];
    if (marqueur === 0xd8 || marqueur === 0x01 || (marqueur >= 0xd0 && marqueur <= 0xd7)) { i += 2; continue; }
    const longueur = b.readUInt16BE(i + 2);
    if (longueur < 2) return null;
    const estSof = marqueur >= 0xc0 && marqueur <= 0xcf && marqueur !== 0xc4 && marqueur !== 0xc8 && marqueur !== 0xcc;
    if (estSof) return { hauteur: b.readUInt16BE(i + 5), largeur: b.readUInt16BE(i + 7) };
    i += 2 + longueur;
  }
  return null;
}

function dimensionsWebp(b) {
  const bloc = b.toString('latin1', 12, 16);
  if (bloc === 'VP8X' && b.length >= 30) {
    return { largeur: 1 + b.readUIntLE(24, 3), hauteur: 1 + b.readUIntLE(27, 3) };
  }
  if (bloc === 'VP8 ' && b.length >= 30) {
    return { largeur: b.readUInt16LE(26) & 0x3fff, hauteur: b.readUInt16LE(28) & 0x3fff };
  }
  if (bloc === 'VP8L' && b.length >= 25) {
    const v = b.readUInt32LE(21);
    return { largeur: 1 + (v & 0x3fff), hauteur: 1 + ((v >> 14) & 0x3fff) };
  }
  return null;
}

/**
 * Le type reel d'une image et ses dimensions, lus dans ses octets.
 *
 * Au-dela de la signature, de quoi ecarter un fichier TRONQUE — un envoi
 * interrompu depuis un telephone qui perd le reseau au milieu du salon est le
 * cas normal, pas l'exception :
 *   - JPEG : un marqueur de fin FF D9 present (pas forcement en derniere
 *     position : les photos « animees » des telephones ajoutent une video
 *     apres l'image) ;
 *   - PNG : le bloc IHDR en tete et IEND a la fin ;
 *   - WebP : la taille RIFF annoncee tient dans le fichier.
 *
 * @param {Buffer} b
 * @returns {{mime:string, ext:string, largeur:number|null, hauteur:number|null}|null}
 */
export function lireImage(b) {
  if (!Buffer.isBuffer(b) || b.length < 32) return null;

  if (egal(b, 0, [0xff, 0xd8, 0xff])) {
    if (b.indexOf(Buffer.from([0xff, 0xd9]), 4) === -1) return null;
    const d = dimensionsJpeg(b);
    return { mime: 'image/jpeg', ext: 'jpg', largeur: d?.largeur ?? null, hauteur: d?.hauteur ?? null };
  }

  if (egal(b, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    if (!ascii(b, 12, 'IHDR') || b.lastIndexOf(Buffer.from('IEND', 'latin1')) === -1) return null;
    return { mime: 'image/png', ext: 'png', largeur: b.readUInt32BE(16), hauteur: b.readUInt32BE(20) };
  }

  if (ascii(b, 0, 'RIFF') && ascii(b, 8, 'WEBP')) {
    if (b.readUInt32LE(4) + 8 > b.length) return null;
    if (!['VP8 ', 'VP8L', 'VP8X'].includes(b.toString('latin1', 12, 16))) return null;
    const d = dimensionsWebp(b);
    return { mime: 'image/webp', ext: 'webp', largeur: d?.largeur ?? null, hauteur: d?.hauteur ?? null };
  }

  return null;
}

/**
 * Le chemin absolu d'une photo, reconstruit depuis son nom en base.
 *
 * Deux verrous : le nom doit avoir exactement la forme qu'on lui donne a la
 * creation, ET le resultat doit rester dans le dossier. Le premier suffirait ;
 * le second protege du jour ou quelqu'un elargira le premier sans y penser.
 */
export function cheminPhoto(fichier, racine = config.storage.photosDir) {
  if (!MOTIF_FICHIER.test(String(fichier))) return null;
  const absolu = path.resolve(racine, fichier);
  return absolu.startsWith(path.resolve(racine) + path.sep) ? absolu : null;
}

export function legendeValide(valeur) {
  const texte = cleanSpaces(String(valeur ?? ''));
  if (texte.length > LEGENDE_MAX) throw badRequest(t('photos.legendeTropLongue', { max: LEGENDE_MAX }));
  return texte;
}

/* ------------------------------------------------------------------ */
/*  Lectures                                                           */
/* ------------------------------------------------------------------ */

const COLONNES = 'id, fichier, mime, taille, largeur, hauteur, legende, ordre, visible, couverture, created_at';

export const lister = () => all('SELECT ' + COLONNES + ' FROM photos ORDER BY ordre, created_at');
export const parId = (id) => one('SELECT ' + COLONNES + ' FROM photos WHERE id = $1', [id]);
export const parFichier = (fichier) => one('SELECT ' + COLONNES + ' FROM photos WHERE fichier = $1', [fichier]);

/** L'adresse PUBLIQUE d'une photo : le nom de fichier aleatoire ne change jamais. */
export const urlPublique = (p) => '/photos/' + p.fichier;

/** Pour l'espace de gestion : tout, y compris les photos masquees. */
export const versClient = (p) => ({
  id: p.id,
  src: '/api/photos/' + p.id + '/image',
  legende: p.legende,
  largeur: p.largeur,
  hauteur: p.hauteur,
  visible: p.visible,
  couverture: p.couverture,
  taille: p.taille,
});

/**
 * Ce que la vitrine montre : les photos visibles, et la couverture a part.
 *
 * La couverture peut etre MASQUEE de la galerie et servir quand meme en tete de
 * page : c'est souvent la meme image, et la voir deux fois sur la meme page
 * est une repetition que le gerant voudra eviter.
 */
export async function pourVitrine() {
  const lignes = await lister();
  const vers = (p) => ({ src: urlPublique(p), legende: p.legende, largeur: p.largeur, hauteur: p.hauteur });
  const couverture = lignes.find((p) => p.couverture);
  return {
    photos: lignes.filter((p) => p.visible).map(vers),
    couverture: couverture ? vers(couverture) : null,
  };
}

/* ------------------------------------------------------------------ */
/*  Ecritures                                                          */
/* ------------------------------------------------------------------ */

async function ecrire(fichier, contenu) {
  await fs.mkdir(config.storage.photosDir, { recursive: true });
  const chemin = cheminPhoto(fichier);
  // « wx » : on ne remplace jamais un fichier existant. Un identifiant
  // aleatoire qui tomberait sur un nom deja pris est un bug, pas un cas a gerer.
  await fs.writeFile(chemin, contenu, { flag: 'wx' });
}

async function effacer(fichier) {
  const chemin = cheminPhoto(fichier);
  if (!chemin) return;
  await fs.unlink(chemin).catch((err) => {
    if (err.code !== 'ENOENT') log.warn('Photo non effacee du disque', { fichier, erreur: err.message });
  });
}

/**
 * Ajoute une photo en fin de galerie.
 *
 * LE DISQUE D'ABORD, LA BASE ENSUITE. Une ligne sans fichier serait une image
 * cassee en vitrine ; un fichier sans ligne n'est qu'un octet perdu. Si la base
 * refuse, on efface le fichier qu'on vient d'ecrire.
 *
 * La premiere photo devient d'office la couverture : un gerant qui envoie une
 * image s'attend a la voir en grand, pas a devoir chercher un bouton.
 */
export async function ajouter({ contenu, legende = '' }) {
  const image = lireImage(contenu);
  if (!image) throw unsupportedMedia(t('photos.formatRefuse'));
  const texte = legendeValide(legende);

  const id = newId();
  const fichier = id + '.' + EXTENSIONS[image.mime];
  try {
    await ecrire(fichier, contenu);
  } catch (err) {
    log.error('Photo non ecrite sur le disque', { dossier: config.storage.photosDir, erreur: err.message, code: err.code });
    throw new AppError(503, t(err.code === 'EACCES' || err.code === 'EROFS' ? 'photos.dossierFerme' : 'photos.ecritureImpossible'),
      { code: 'PHOTOS_DOSSIER' });
  }

  try {
    await transaction(async (tx) => {
      const n = Number((await tx.one('SELECT COUNT(*)::int AS n FROM photos')).n);
      if (n >= GALERIE_MAX) throw conflict(t('photos.galeriePleine', { max: GALERIE_MAX }));
      const rang = Number((await tx.one('SELECT COALESCE(MAX(ordre), -1) + 1 AS r FROM photos')).r);
      await tx.execute(
        `INSERT INTO photos (id, fichier, mime, taille, largeur, hauteur, legende, ordre, couverture)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [id, fichier, image.mime, contenu.length, image.largeur, image.hauteur, texte, rang, n === 0],
      );
    });
  } catch (err) {
    await effacer(fichier);
    throw err;
  }
  return parId(id);
}

/**
 * Change la legende, la visibilite, ou designe la couverture.
 *
 * Designer une couverture RETIRE l'ancienne dans la meme transaction : l'index
 * unique partiel refuserait la seconde, et l'ordre des deux ecritures compte.
 */
export async function modifier(id, { legende, visible, couverture } = {}) {
  return transaction(async (tx) => {
    const actuelle = await tx.one('SELECT id FROM photos WHERE id = $1 FOR UPDATE', [id]);
    if (!actuelle) throw notFound(t('photos.introuvable'));
    if (couverture === true) await tx.execute('UPDATE photos SET couverture = FALSE WHERE couverture AND id <> $1', [id]);

    const champs = [];
    const params = [id];
    const poser = (colonne, valeur) => { params.push(valeur); champs.push(colonne + ' = $' + params.length); };
    if (legende !== undefined) poser('legende', legendeValide(legende));
    if (visible !== undefined) poser('visible', Boolean(visible));
    if (couverture !== undefined) poser('couverture', Boolean(couverture));
    if (!champs.length) throw badRequest(t('commun.aucuneModification'));
    await tx.execute('UPDATE photos SET ' + champs.join(', ') + ' WHERE id = $1', params);
    return tx.one('SELECT ' + COLONNES + ' FROM photos WHERE id = $1', [id]);
  });
}

/** Supprime une photo : la ligne, puis le fichier. */
export async function supprimer(id) {
  const photo = await parId(id);
  if (!photo) throw notFound(t('photos.introuvable'));
  await execute('DELETE FROM photos WHERE id = $1', [id]);
  await effacer(photo.fichier);
  return true;
}

/**
 * Reordonne la galerie entiere. Meme contrat que les tarifs : l'ordre complet,
 * ou rien. Une liste perimee est refusee plutot qu'appliquee a moitie.
 */
export async function reordonner(ids) {
  if (!Array.isArray(ids) || !ids.length) throw badRequest(t('tarifa.ordreIncomplet'));
  return transaction(async (tx) => {
    const connus = new Set((await tx.all('SELECT id FROM photos ORDER BY id FOR UPDATE')).map((l) => l.id));
    const recus = new Set(ids);
    if (recus.size !== ids.length) throw badRequest(t('tarifa.ordreRepete'));
    if (recus.size !== connus.size || [...recus].some((id) => !connus.has(id))) {
      throw new AppError(409, t('tarifa.listeDesyncro'), { code: 'PHOTOS_DESFASADAS' });
    }
    for (let i = 0; i < ids.length; i += 1) await tx.execute('UPDATE photos SET ordre = $2 WHERE id = $1', [ids[i], i]);
    return ids.length;
  });
}

/* ------------------------------------------------------------------ */
/*  Reprise des photos deposees a la main                             */
/* ------------------------------------------------------------------ */

/** « 02-la-vitrine.jpg » -> « La vitrine ». */
export function legendeDepuisNom(nom) {
  const sansExtension = nom.includes('.') ? nom.slice(0, nom.lastIndexOf('.')) : nom;
  const mots = sansExtension.replace(/^[\s\d._-]+/, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  return mots ? (mots.charAt(0).toUpperCase() + mots.slice(1)).slice(0, LEGENDE_MAX) : '';
}

/**
 * Les photos que le gerant avait deposees par `scp` avant l'existence de
 * l'ecran de galerie entrent dans la base, sans qu'il ait rien a refaire.
 *
 * Chacune est RENOMMEE sous un identifiant aleatoire (le nom d'origine devient
 * sa legende), puis enregistree. Un fichier qui n'est pas une image lisible est
 * laisse ou il est, et signale dans le journal. Rejoue a chaque demarrage :
 * une fois reprises, les photos ont un nom reconnu et ne sont plus touchees.
 */
export async function reprendreLesAnciennes({ journal = () => {} } = {}) {
  let noms;
  try {
    noms = await fs.readdir(config.storage.photosDir);
  } catch {
    return 0;
  }
  const a_reprendre = noms
    .filter((nom) => !nom.startsWith('.') && !MOTIF_FICHIER.test(nom))
    .filter((nom) => /\.(jpe?g|png|webp)$/i.test(nom))
    .sort((a, b) => a.localeCompare(b));

  let n = 0;
  for (const nom of a_reprendre) {
    const ancien = path.join(config.storage.photosDir, nom);
    try {
      const contenu = await fs.readFile(ancien);
      const image = lireImage(contenu);
      if (!image) {
        log.warn('Fichier du dossier photos ignore : ce n est pas une image lisible', { nom });
        continue;
      }
      const total = Number((await one('SELECT COUNT(*)::int AS n FROM photos')).n);
      if (total >= GALERIE_MAX) break;
      const id = newId();
      const fichier = id + '.' + EXTENSIONS[image.mime];
      await fs.rename(ancien, cheminPhoto(fichier));
      const rang = Number((await one('SELECT COALESCE(MAX(ordre), -1) + 1 AS r FROM photos')).r);
      await execute(
        `INSERT INTO photos (id, fichier, mime, taille, largeur, hauteur, legende, ordre, couverture)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [id, fichier, image.mime, contenu.length, image.largeur, image.hauteur, legendeDepuisNom(nom), rang, total === 0],
      );
      n += 1;
    } catch (err) {
      log.warn('Photo deposee a la main non reprise', { nom, erreur: err.message });
    }
  }
  if (n) journal('  Photos : ' + n + ' photo(s) deposee(s) a la main reprise(s) dans la galerie.');
  return n;
}

/** Le dossier est-il inscriptible ? L'ecran de galerie le dit AVANT le premier envoi rate. */
export async function dossierInscriptible() {
  try {
    await fs.mkdir(config.storage.photosDir, { recursive: true });
    await fs.access(config.storage.photosDir, FS.W_OK);
    return true;
  } catch {
    return false;
  }
}

export const _MOTIF_FICHIER = MOTIF_FICHIER;
