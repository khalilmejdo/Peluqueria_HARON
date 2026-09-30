/**
 * Les photos du salon : l'API de gestion (gerant seul) et la route publique qui
 * les sert a la vitrine.
 *
 *   GET    /api/photos              la galerie entiere, masquees comprises
 *   POST   /api/photos              une image BRUTE (le corps est le fichier)
 *   GET    /api/photos/:id/image    l'image, meme masquee — pour l'ecran de gestion
 *   PATCH  /api/photos/:id          legende, visibilite, couverture
 *   DELETE /api/photos/:id
 *   POST   /api/photos/orden        l'ordre complet
 *
 *   GET    /photos/:fichier         publique : seulement une photo visible ou
 *                                   la couverture, jamais une photo masquee
 */
import fs from 'node:fs/promises';
import { Router } from '../http/router.js';
import { idDe } from '../http/aides.js';
import { validate } from '../core/validate.js';
import { badRequest, notFound } from '../core/errors.js';
import { PROFILES } from '../core/ratelimit.js';
import { log } from '../core/logger.js';
import { t } from '../core/langue.js';
import { lireTous } from '../core/reglages.js';
import {
  lister, parId, parFichier, ajouter, modifier, supprimer, reordonner, versClient,
  cheminPhoto, dossierInscriptible, GALERIE_MAX, _MOTIF_FICHIER,
} from '../domain/photos.js';

export const photosRoutes = new Router();

photosRoutes.get('/', async (ctx) => {
  const [lignes, reglages, inscriptible] = await Promise.all([lister(), lireTous(), dossierInscriptible()]);
  ctx.ok({
    items: lignes.map(versClient),
    max: GALERIE_MAX,
    galerieVisible: reglages['vitrine.galerie'],
    // Dit AVANT le premier envoi rate : un dossier monte en lecture seule
    // donnait sinon une erreur a chaque photo, sans que l'ecran dise pourquoi.
    inscriptible,
  });
}, { role: 'GERANT' });

/**
 * L'envoi. Le corps EST l'image : pas de multipart a decouper, rien a
 * assainir. La legende voyage dans l'adresse (`?legende=`), encodee.
 *
 * `image: true` est ce qui autorise cette route, et elle seule, a recevoir un
 * corps de plusieurs megaoctets (voir server/index.js).
 */
photosRoutes.post('/', async (ctx) => {
  if (!ctx.image) throw badRequest(t('photos.aucuneImage'));
  const photo = await ajouter({ contenu: ctx.image.contenu, legende: ctx.query('legende') ?? '' });
  log.info('Photo ajoutee', { id: photo.id, taille: photo.taille, par: ctx.user.identifiant });
  ctx.created(versClient(photo));
}, { role: 'GERANT', image: true, rateLimit: PROFILES.administration });

photosRoutes.get('/:id/image', async (ctx) => {
  const photo = await parId(idDe(ctx));
  if (!photo) throw notFound(t('photos.introuvable'));
  await servir(ctx, photo, { cache: 'private, max-age=3600' });
}, { role: 'GERANT' });

photosRoutes.patch('/:id', async (ctx) => {
  const data = validate(ctx.body, {
    legende: { type: 'string', max: 200, trim: false },
    visible: { type: 'bool' },
    couverture: { type: 'bool' },
  }, { partial: true });
  const photo = await modifier(idDe(ctx), data);
  ctx.ok(versClient(photo));
}, { role: 'GERANT', rateLimit: PROFILES.administration });

photosRoutes.delete('/:id', async (ctx) => {
  await supprimer(idDe(ctx));
  log.info('Photo supprimee', { par: ctx.user.identifiant });
  ctx.noContent();
}, { role: 'GERANT', rateLimit: PROFILES.administration });

photosRoutes.post('/orden', async (ctx) => {
  const ids = Array.isArray(ctx.body?.ids) ? ctx.body.ids.map(String).slice(0, GALERIE_MAX + 1) : null;
  await reordonner(ids);
  ctx.ok({ items: (await lister()).map(versClient) });
}, { role: 'GERANT', rateLimit: PROFILES.administration });

/* ------------------------------------------------------------------ */
/*  La route publique                                                  */
/* ------------------------------------------------------------------ */

export const photosPubliquesRoutes = new Router();

/**
 * Une photo de la vitrine.
 *
 * Le nom est aleatoire et ne change jamais pour un meme contenu : on peut donc
 * le mettre en cache un an. Une photo remplacee en est une NOUVELLE, sous un
 * autre nom. Une photo masquee ou supprimee rend 404 — y compris a qui aurait
 * garde son adresse.
 */
photosPubliquesRoutes.get('/photos/:fichier', async (ctx) => {
  const fichier = String(ctx.params.fichier || '');
  if (!_MOTIF_FICHIER.test(fichier)) throw notFound();
  const photo = await parFichier(fichier);
  if (!photo || (!photo.visible && !photo.couverture)) throw notFound();
  await servir(ctx, photo, { cache: 'public, max-age=31536000, immutable' });
}, { public: true });

async function servir(ctx, photo, { cache }) {
  const chemin = cheminPhoto(photo.fichier);
  let contenu;
  try {
    contenu = chemin ? await fs.readFile(chemin) : null;
  } catch {
    contenu = null;
  }
  if (!contenu) {
    log.warn('Photo en base mais absente du disque', { id: photo.id, fichier: photo.fichier });
    throw notFound();
  }
  // L'apercu d'un lien partage sur WhatsApp va chercher l'image depuis un
  // autre domaine : c'est l'une des rares ressources qui doit le permettre.
  ctx.res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  ctx.file(contenu, { filename: photo.fichier, mimeType: photo.mime, download: false, cache });
}
