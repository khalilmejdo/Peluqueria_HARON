/**
 * Les notifications poussees du personnel : s'abonner, se desabonner, essayer.
 *
 * TOUT LE PERSONNEL, PAS SEULEMENT LE GERANT. C'est le coiffeur au fauteuil qui
 * a besoin de savoir qu'un tour vient d'etre pris ou annule. Reserver ces routes
 * au gerant reviendrait a offrir la fonction a celui qui en a le moins besoin.
 *
 * UN ABONNEMENT APPARTIENT A UN APPAREIL, PAS A UNE PERSONNE. Chaque route
 * porte donc l'adresse d'abonnement (`endpoint`) de l'appareil qui parle, et
 * chaque requete ne peut toucher que les lignes du compte connecte : la clause
 * `utilisateur_id = $1` est dans le domaine, pas ici, mais elle n'est jamais
 * facultative. Sans elle, connaitre l'adresse d'un collegue suffirait a le
 * desabonner.
 *
 * L'adresse d'abonnement est une URL choisie par le NAVIGATEUR : on la valide
 * comme une donnee hostile. Elle doit etre en https, et on borne sa longueur —
 * sans quoi la table accepterait des chaines de plusieurs kilo-octets.
 */
import { Router } from '../http/router.js';
import { validate } from '../core/validate.js';
import { badRequest } from '../core/errors.js';
import { PROFILES } from '../core/ratelimit.js';
import { log } from '../core/logger.js';
import {
  notificationsActives, clePubliqueVapid, enregistrerAbonnement, supprimerAbonnement,
  compterAbonnements, envoyerUnEssai,
} from '../domain/push.js';

export const avisosRoutes = new Router();

const REGLES_ABONNEMENT = {
  endpoint: { type: 'string', required: true, max: 1000 },
  p256dh: { type: 'string', required: true, max: 200 },
  auth: { type: 'string', required: true, max: 100 },
  appareil: { type: 'string', max: 80 },
};

/**
 * Une adresse d'abonnement valable.
 *
 * On exige https : un service de notification en clair n'existe pas, et
 * accepter « http:// » ouvrirait la porte a une adresse interne — le serveur
 * irait alors poster, avec ses propres droits reseau, ou on lui dit.
 */
function exigerEndpoint(valeur) {
  let url;
  try {
    url = new URL(valeur);
  } catch {
    throw badRequest('Dirección de suscripción no válida.');
  }
  if (url.protocol !== 'https:') throw badRequest('La suscripción debe usar https.');
  return url.href;
}

/**
 * L'etat, pour l'ecran de gestion.
 *
 * `clePublique` est demandee par le navigateur AVANT de s'abonner : c'est elle
 * qu'il scelle dans l'abonnement. Elle est publique au sens propre — elle ne
 * sert qu'a verifier nos jetons.
 */
avisosRoutes.get('/', async (ctx) => {
  // L'adresse d'abonnement n'est PAS demandee ici. Elle fait mille caracteres
  // et resterait des mois dans les journaux du proxy ; le navigateur sait de
  // toute facon s'il est abonne, en interrogeant son propre gestionnaire.
  ctx.ok({
    actif: notificationsActives(),
    clePublique: clePubliqueVapid(),
    abonnements: notificationsActives() ? await compterAbonnements(ctx.user.id) : 0,
  });
});

avisosRoutes.post('/', async (ctx) => {
  if (!notificationsActives()) {
    throw badRequest('Los avisos no están configurados en este servidor.');
  }
  const data = validate(ctx.body, REGLES_ABONNEMENT);
  await enregistrerAbonnement(ctx.user.id, {
    endpoint: exigerEndpoint(data.endpoint),
    p256dh: data.p256dh,
    auth: data.auth,
    appareil: data.appareil,
  });
  log.info('Abonnement aux notifications', { par: ctx.user.identifiant });
  ctx.ok({ ok: true });
}, { rateLimit: PROFILES.administration });

/**
 * Se desabonner. Un POST plutot qu'un DELETE : l'adresse d'abonnement fait
 * mille caracteres et n'a rien a faire dans une URL — ni dans les journaux du
 * proxy, ou elle resterait des mois.
 */
avisosRoutes.post('/baja', async (ctx) => {
  const data = validate(ctx.body, { endpoint: REGLES_ABONNEMENT.endpoint });
  const efface = await supprimerAbonnement(ctx.user.id, data.endpoint);
  ctx.ok({ ok: true, efface });
}, { rateLimit: PROFILES.administration });

/**
 * L'essai. Il part AU SEUL appareil qui le demande : un essai qui fait sonner
 * tout le salon n'est pas un essai.
 *
 * Le resultat dit ce qui s'est passe. « Envoye : 0 » avec un abonnement efface
 * signifie que le navigateur avait deja revoque l'autorisation — c'est la
 * reponse la plus utile qu'on puisse rendre, et elle evite de chercher du cote
 * du serveur un probleme qui est dans le telephone.
 */
avisosRoutes.post('/prueba', async (ctx) => {
  if (!notificationsActives()) {
    throw badRequest('Los avisos no están configurados en este servidor.');
  }
  const data = validate(ctx.body, { endpoint: REGLES_ABONNEMENT.endpoint });
  const bilan = await envoyerUnEssai(ctx.user.id, data.endpoint);
  if (!bilan.envoyes && bilan.effaces) {
    throw badRequest('Este aparato ya no acepta avisos: vuelve a activarlos.');
  }
  if (!bilan.envoyes) {
    throw badRequest('No se ha podido enviar el aviso a este aparato.');
  }
  ctx.ok(bilan);
}, { rateLimit: PROFILES.administration });
