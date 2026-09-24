/**
 * La galerie de photos du salon.
 *
 * Les VRAIES photos — le fauteuil, la vitrine, une coupe reussie — sont ce qui
 * rend une vitrine attirante. Aucune illustration ne remplace ça.
 *
 * Elles ne passent pas par la base : ce sont des fichiers, deposes dans
 * `public/img/galerie/`. Sur le serveur, ce dossier est un VOLUME monte depuis
 * `/opt/haron/photos`, donc ajouter une photo ne demande ni reconstruction
 * d'image, ni redemarrage, ni formulaire d'envoi a securiser.
 *
 *   scp mesphotos/*.jpg ubuntu@<serveur>:/opt/haron/photos/
 *
 * Dossier vide ou absent : la section n'existe pas. Le salon qui n'a pas encore
 * de photos garde une page complete, sans cadre gris « image manquante ».
 *
 * Le nom du fichier sert de legende : « 01-nuestro-salon.jpg » devient
 * « Nuestro salon ». C'est ce qui permet au gerant de choisir l'ORDRE et le
 * TEXTE sans toucher a un ecran d'administration.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DOSSIER = fileURLToPath(new URL('../../public/img/galerie/', import.meta.url));

/** Seuls ces formats sont servis par le serveur de fichiers statiques. */
const FORMATS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif']);

/**
 * Le contenu du dossier, garde en memoire quelques secondes.
 *
 * La vitrine est la page la plus demandee du site ; lire un dossier a chaque
 * visite serait un appel systeme pour rien. Dix secondes suffisent a ce qu'une
 * photo deposee apparaisse sans qu'on ait a redemarrer quoi que ce soit.
 */
let cache = { a: 0, photos: [] };
const DUREE_CACHE_MS = 10000;

/** « 02-la-vitrine.jpg » -> « La vitrine ». */
function legendeDepuisNom(fichier) {
  const sansExtension = fichier.slice(0, fichier.lastIndexOf('.'));
  const sansPrefixe = sansExtension.replace(/^[\s\d._-]+/, '');
  const mots = sansPrefixe.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!mots) return '';
  return mots.charAt(0).toUpperCase() + mots.slice(1);
}

/**
 * Les photos de la galerie, dans l'ordre des noms de fichiers.
 *
 * Aucun nom ne vient d'une requete : on liste un dossier fixe et on ne garde
 * que des noms de fichiers simples. Un nom contenant « / » ou « .. » serait
 * de toute facon impossible dans une entree de dossier, mais on l'ecarte
 * explicitement plutot que de compter sur cette propriete.
 */
export async function photosDuSalon({ maintenant = Date.now() } = {}) {
  if (maintenant - cache.a < DUREE_CACHE_MS) return cache.photos;

  let entrees;
  try {
    entrees = await fs.readdir(DOSSIER, { withFileTypes: true });
  } catch {
    // Dossier absent : c'est le cas normal d'un salon qui n'a pas de photos.
    cache = { a: maintenant, photos: [] };
    return cache.photos;
  }

  const photos = entrees
    .filter((e) => e.isFile())
    .map((e) => e.name)
    .filter((nom) => !nom.startsWith('.') && !nom.includes('/') && !nom.includes('\\'))
    .filter((nom) => FORMATS.has(path.extname(nom).toLowerCase()))
    .sort((a, b) => a.localeCompare(b, 'es'))
    .slice(0, 24)
    .map((nom) => ({ src: '/img/galerie/' + encodeURIComponent(nom), legende: legendeDepuisNom(nom) }));

  cache = { a: maintenant, photos };
  return photos;
}

/** Vide le cache — les tests en ont besoin pour ne pas s'attendre l'un l'autre. */
export function oublierLesPhotos() {
  cache = { a: 0, photos: [] };
}

export { legendeDepuisNom as _legendeDepuisNom, DOSSIER as _DOSSIER };
