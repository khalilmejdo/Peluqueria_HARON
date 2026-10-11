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
import { avisosRoutes } from './routes/avisos.js';
import { photosRoutes, photosPubliquesRoutes } from './routes/photos.js';
import { avisRoutes } from './routes/avis.js';
import { marqueRoutes, marquePubliqueRoutes } from './routes/marque.js';
import { rdvPublicRoutes, agendaRoutes } from './routes/rendezvous.js';
import { siteRdvRoutes } from './site/rendezvous.js';
import {
  metaRoutes, reglagesRoutes, comptesRoutes, statistiquesRoutes, serviceRoutes,
  fermeturesRoutes, postesRoutes, tarifasRoutes,
} from './routes/administration.js';

export function buildRouter() {
  const router = new Router();

  // Sonde de sante et version : lisibles sans session.
  router.mount('', metaRoutes);

  // Pages du client, rendues par le serveur (accueil, prise de tour, suivi,
  // affiche et QR Code). Toutes publiques.
  router.mount('', siteRoutes);
  // La reservation d'un rendez-vous et la page de SON rendez-vous.
  router.mount('', siteRdvRoutes);
  // Les photos de la vitrine : publiques, mais seulement celles qui sont visibles.
  router.mount('', photosPubliquesRoutes);
  // Theme, icones et manifestes, fabriques depuis la marque.
  router.mount('', marquePubliqueRoutes);

  // API du client : prise de tour, suivi, temps reel. Aucune session, le jeton
  // de suivi tient lieu de sesame.
  router.mount('/api/public', publicRoutes);
  // Rendez-vous : reserver, consulter, annuler. Le jeton tient lieu de sesame.
  router.mount('/api/public/rdv', rdvPublicRoutes);

  // Espace du personnel.
  router.mount('/api/auth', authRoutes);
  router.mount('/api/file', fileRoutes);
  // L'agenda des rendez-vous : tout le personnel le tient.
  router.mount('/api/agenda', agendaRoutes);
  // Lisible par tout le personnel (l'ecran de la file en a besoin), modifiable
  // par le gerant seul : les exigences sont posees route par route.
  router.mount('/api/postes', postesRoutes);
  router.mount('/api/statistiques', statistiquesRoutes);
  // Avis pousses : tout le personnel s'abonne, chacun pour SES appareils.
  router.mount('/api/avisos', avisosRoutes);
  // Fiche de prix : lisible par tout le personnel (on la demande au comptoir),
  // modifiable par le gerant seul.
  router.mount('/api/tarifas', tarifasRoutes);

  // Reserve au gerant.
  router.mount('/api/fermetures', fermeturesRoutes);
  router.mount('/api/photos', photosRoutes);
  router.mount('/api/avis', avisRoutes);
  router.mount('/api/reglages', reglagesRoutes);
  router.mount('/api/comptes', comptesRoutes);
  router.mount('/api/service', serviceRoutes);

  // Reserve a l'administrateur de la plateforme.
  router.mount('/api/marque', marqueRoutes);

  return router;
}
