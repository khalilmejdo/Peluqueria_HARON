/**
 * Assemblage des routes.
 *
 * Un seul endroit declare toute la surface exposee : on voit d'un coup d'oeil
 * qu'aucune route n'a ete oubliee, et laquelle est publique. Les exigences
 * (session, role, debit) sont declarees dans chaque fichier de routes, a cote
 * du gestionnaire qu'elles protegent.
 */
import { Router } from './http/router.js';
import { siteRoutes } from './site/index.js';
import { publicRoutes } from './routes/public.js';
import { authRoutes } from './routes/auth.js';
import { fileRoutes } from './routes/file.js';
import {
  metaRoutes, reglagesRoutes, comptesRoutes, statistiquesRoutes, serviceRoutes, fermeturesRoutes,
} from './routes/administration.js';

export function buildRouter() {
  const router = new Router();

  // Sonde de sante et version : lisibles sans session.
  router.mount('', metaRoutes);

  // Pages du client, rendues par le serveur (accueil, prise de tour, suivi,
  // affiche et QR Code). Toutes publiques.
  router.mount('', siteRoutes);

  // API du client : prise de tour, suivi, temps reel. Aucune session, le jeton
  // de suivi tient lieu de sesame.
  router.mount('/api/public', publicRoutes);

  // Espace du personnel.
  router.mount('/api/auth', authRoutes);
  router.mount('/api/file', fileRoutes);
  router.mount('/api/statistiques', statistiquesRoutes);

  // Reserve au gerant.
  router.mount('/api/fermetures', fermeturesRoutes);
  router.mount('/api/reglages', reglagesRoutes);
  router.mount('/api/comptes', comptesRoutes);
  router.mount('/api/service', serviceRoutes);

  return router;
}
