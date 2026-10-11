/**
 * Les avis des clients, cote gestion (gerant seul) :
 *
 *   GET    /api/avis        tous les avis, ceux qui attendent d'abord
 *   PATCH  /api/avis/:id    { statut } : PUBLIE, MASQUE ou ATTENTE
 *   DELETE /api/avis/:id
 *
 * Le depot, lui, est public et passe par la page de suivi du client
 * (server/site) : c'est son lien qui prouve la visite.
 */
import { Router } from '../http/router.js';
import { idDe } from '../http/aides.js';
import { PROFILES } from '../core/ratelimit.js';
import { log } from '../core/logger.js';
import { lister, changerStatut, supprimer, publies } from '../domain/avis.js';

export const avisRoutes = new Router();

avisRoutes.get('/', async (ctx) => {
  const [items, bilan] = await Promise.all([lister(), publies({ limite: 0 })]);
  ctx.ok({ items, publies: { nombre: bilan.nombre, moyenne: bilan.moyenne } });
}, { role: 'GERANT' });

avisRoutes.patch('/:id', async (ctx) => {
  const avis = await changerStatut(idDe(ctx), String(ctx.body?.statut ?? ''));
  log.info('Avis modere', { id: avis.id, statut: avis.statut, par: ctx.user.identifiant });
  ctx.ok(avis);
}, { role: 'GERANT', rateLimit: PROFILES.administration });

avisRoutes.delete('/:id', async (ctx) => {
  await supprimer(idDe(ctx));
  log.info('Avis supprime', { id: idDe(ctx), par: ctx.user.identifiant });
  ctx.ok({ supprime: true });
}, { role: 'GERANT', rateLimit: PROFILES.administration });
