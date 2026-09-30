/**
 * Ce que le client peut faire, sans compte et sans mot de passe.
 *
 *   POST /api/public/tickets            prendre son tour
 *   GET  /api/public/tickets/:jeton     l'etat de SON tour
 *   GET  /api/public/tickets/:jeton/flux suivi temps reel
 *   POST /api/public/tickets/:jeton/annuler  renoncer a son tour
 *   GET  /api/public/file               l'affluence du moment (aucun nom)
 *
 * Aucune de ces routes ne revele quoi que ce soit sur un autre client : ni nom,
 * ni numero, ni meme l'existence d'un ticket qu'on ne possede pas. Le jeton de
 * suivi est le seul sesame, il fait 192 bits, et une demande sur un jeton mal
 * forme rend exactement la meme reponse qu'une demande sur un jeton inconnu.
 */
import { timingSafeEqual } from 'node:crypto';
import { Router } from '../http/router.js';
import { validate, rules } from '../core/validate.js';
import { jetonDe } from '../http/aides.js';
import { AppError, notFound } from '../core/errors.js';
import { consume, consommerPriseDeTour, PROFILES } from '../core/ratelimit.js';
import { lireTous, adressePublique } from '../core/reglages.js';
import { abonner, envoyerEtatInitial } from '../core/flux.js';
import { jourLocal } from '../core/temps.js';
import { prendreTour, ticketParJeton, chargerEtat, pourClient, annulerParClient, etatPriseDeTour, attenteNouvelArrivant } from '../domain/file.js';
import { t } from '../core/langue.js';

export const publicRoutes = new Router();

/**
 * La cle de l'ecran du salon.
 *
 * Vide, la page est ouverte comme avant. Posee, elle devient une ADRESSE
 * SECRETE : c'est le meme principe que le lien de suivi d'un client — pas de
 * session a expirer sur un televiseur, mais une adresse qu'on ne devine pas.
 * Elle est fabriquee automatiquement des que le gerant choisit d'afficher les
 * noms de famille.
 *
 * On repond 404, pas 403 : une page protegee qui dit « mauvaise cle » confirme
 * qu'elle existe, et invite a essayer la suivante.
 *
 * La comparaison est a temps constant. La difference est theorique sur un
 * reseau, mais elle ne coute rien et elle evite d'avoir a se demander si elle
 * l'est vraiment.
 */
export async function exigerClePantalla(ctx) {
  const reglages = await lireTous();
  const attendue = reglages['pantalla.clave'];
  if (!attendue) return;

  const fournie = String(ctx.query('k') || '');
  const a = Buffer.from(fournie);
  const b = Buffer.from(attendue);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw notFound(t('erreur.pageIntrouvable'));
  }
}

/**
 * PRENDRE SON TOUR.
 *
 * `source` distingue une prise de tour en ligne d'un scan du QR Code affiche
 * dans le salon. Les deux entrent dans LA MEME file, au meme titre : cette
 * valeur ne sert qu'aux statistiques du gerant.
 */
publicRoutes.post('/tickets', async (ctx) => {
  const data = validate(ctx.body, {
    prenom: rules.prenom,
    nom: rules.nomFamille,
    telephone: rules.whatsapp,
    source: { type: 'enum', values: ['ONLINE', 'QR'], upper: true, default: 'ONLINE' },
    // Le coiffeur choisi. Ignore en file unique, obligatoire en file par
    // coiffeur — c'est prendreTour() qui tranche, selon le reglage du salon.
    posteId: { type: 'uuid' },
    // Les prestations demandees. Six au plus : au-dela ce n'est plus un passage
    // chez le coiffeur, c'est une matinee -- et une liste sans borne est une
    // invitation a remplir la base.
    tarifaIds: { type: 'array', max: 6, of: { type: 'uuid' } },
  });

  // Le debit se mesure APRES la validation : le numero est alors connu, et
  // c'est lui la vraie limite. Une adresse IP n'est pas un client - derriere le
  // wifi du salon, toute une matinee de clients la partage.
  const reglages = await lireTous();
  const debit = consommerPriseDeTour(
    { ip: ctx.ip, telephone: data.telephone },
    { telephoneSalon: reglages['salon.telephone'] || null },
  );
  if (!debit.allowed) {
    ctx.res.setHeader('Retry-After', String(debit.retryAfterSeconds));
    throw new AppError(429, debit.message, { code: 'TROP_DE_DEMANDES', details: { retryAfter: debit.retryAfterSeconds } });
  }

  const { ticket, jeton, position } = await prendreTour({ ...data, tarifaIds: data.tarifaIds || [] });
  const base = adressePublique(reglages, ctx.base);

  ctx.created({
    numero: ticket.numero_affiche,
    prenom: ticket.prenom,
    coiffeur: position.coiffeur,
    jeton,
    lien: base + '/ticket/' + jeton,
    position: position.position,
    devant: position.devant,
    estimationMinutes: position.estimationMinutes,
    estimationTexte: position.estimationTexte,
    phase: position.phase,
    titre: position.titre,
    detail: position.detail,
  });
}, { public: true });

/** L'etat d'un tour, depuis son lien de suivi. */
publicRoutes.get('/tickets/:jeton', async (ctx) => {
  const ticket = await chargerTicketDuJeton(ctx);
  const etat = await chargerEtat(ticket.jour);
  const vue = pourClient(etat, ticket.id);
  if (!vue) throw notFound(t('req.lienPerime'));
  ctx.ok(vue);
}, { public: true });

/**
 * SUIVI TEMPS REEL d'un tour.
 *
 * Le telephone du client reste sur cette page, parfois une heure. Un flux
 * d'evenements coute une connexion ouverte et rien de plus : pas d'appel toutes
 * les cinq secondes, pas de batterie videe, et la position change a l'instant
 * meme ou le coiffeur appuie sur « client servi ».
 */
publicRoutes.get('/tickets/:jeton/flux', async (ctx) => {
  const ticket = await chargerTicketDuJeton(ctx, PROFILES.flux);
  const res = ctx.ouvrirFlux();
  if (!res) return;
  const abonne = abonner({ res, req: ctx.req, portee: 'CLIENT', ticketId: ticket.id, jour: ticket.jour });
  if (abonne) await envoyerEtatInitial(abonne);
}, { public: true, flux: true });

/**
 * RENONCER a son tour.
 *
 * Le geste le plus utile d'un client qui ne viendra pas : sa place liberee fait
 * avancer tout le monde.
 */
publicRoutes.post('/tickets/:jeton/annuler', async (ctx) => {
  const jeton = jetonDe(ctx);
  const limite = consume('suivi:' + ctx.ip, PROFILES.suivi);
  if (!limite.allowed) {
    ctx.res.setHeader('Retry-After', String(limite.retryAfterSeconds));
    throw new AppError(429, t('http.tropDeDemandes'), { details: { retryAfter: limite.retryAfterSeconds } });
  }
  const ticket = await annulerParClient(jeton);
  ctx.ok({ numero: ticket.numero_affiche, statut: ticket.statut });
}, { public: true, skipCsrf: true });

/**
 * LE FLUX DE L'ECRAN DU SALON.
 *
 * Il alimente l'ecran accroche au mur, face a la salle d'attente. Aucun compte :
 * un televiseur ne se reconnecte pas tout seul quand une session expire, et une
 * session qui ne finit jamais sur un appareil que tout le salon peut manipuler
 * serait pire que pas de session du tout.
 *
 * CE QUI SORT EST DONC PUBLIC. C'est la projection « pantalla » qui le garantit
 * — numero, prenom, fauteuil, et rien d'autre. Elle est distincte de celle du
 * personnel, qui porte les numeros de telephone : la separation est dans le
 * domaine, pas dans un filtre pose ici qu'on oublierait un jour de mettre a
 * jour. Le reglage « pantalla.nombres » coupe meme les prenoms.
 *
 * Le debit est celui d'un flux ordinaire : un ecran ouvre UNE connexion et la
 * garde toute la journee.
 */
publicRoutes.get('/pantalla/flux', async (ctx) => {
  await exigerClePantalla(ctx);
  const limite = consume('pantalla:' + ctx.ip, PROFILES.flux);
  if (!limite.allowed) {
    ctx.res.setHeader('Retry-After', String(limite.retryAfterSeconds));
    throw new AppError(429, t('http.tropDeConnexions'), { details: { retryAfter: limite.retryAfterSeconds } });
  }
  const res = ctx.ouvrirFlux();
  if (!res) return;
  const abonne = abonner({ res, req: ctx.req, portee: 'PANTALLA', jour: jourLocal() });
  if (abonne) await envoyerEtatInitial(abonne);
}, { public: true, flux: true });

/**
 * L'AFFLUENCE du moment, pour la page d'accueil : combien de personnes
 * attendent et combien de temps, sans un seul nom ni numero.
 */
publicRoutes.get('/file', async (ctx) => {
  const jour = jourLocal();
  const [etat, prise] = await Promise.all([chargerEtat(jour), etatPriseDeTour()]);
  const enAttente = etat.compteurs.enAttente;
  ctx.ok({
    jour,
    ouverte: etat.ouverte,
    enAttente,
    enCours: etat.compteurs.enCours,
    // Le nombre de tetes faites aujourd'hui. C'est un AGREGAT : il ne dit rien
    // de personne, et il dit beaucoup du salon. Un client qui hesite devant la
    // vitrine voit que la maison tourne.
    servis: etat.compteurs.servis,
    dureeMoyenneMinutes: etat.dureeMoyenneMinutes,
    // La meme simulation que le ticket : la vitrine n annonce plus un chiffre
    // que le client verrait changer des qu il a pris son tour.
    attenteEstimeeMinutes: attenteNouvelArrivant(etat),
    mode: etat.mode,
    // En file par coiffeur, le client doit savoir qui est disponible et
    // combien de monde attend chez chacun. En file unique, la liste n'a pas
    // lieu d'etre : il ne choisit pas.
    coiffeurs: etat.mode === 'PAR_FAUTEUIL'
      ? etat.postesActifs.map((p) => {
        const sienne = etat.tickets.filter(
          (t) => t.poste_choisi_id === p.id && ['WAITING', 'LATE'].includes(t.statut),
        ).length;
        return {
          id: p.id,
          nom: p.coiffeur || p.nom,
          fauteuil: p.nom,
          enAttente: sienne,
          attenteEstimeeMinutes: sienne * etat.dureeMoyenneMinutes,
        };
      })
      : [],
    // Peut-on entrer dans la file en ce moment, et sinon pourquoi.
    priseDeTour: {
      ouverte: prise.ouverte,
      code: prise.code,
      message: prise.message,
      reouvertureLe: prise.fermeture ? prise.fermeture.au : null,
      ouvertureA: prise.ouvertureA,
    },
  });
}, { public: true });

/* ------------------------------------------------------------------ */

/**
 * Charge le ticket d'un jeton, en limitant le debit pour empecher l'enumeration.
 *
 * Un jeton mal forme, un jeton inconnu et un jeton d'une autre journee rendent
 * la meme reponse : rien dans le message ne permet de dire lequel des trois
 * cas s'est produit.
 */
async function chargerTicketDuJeton(ctx, profil = PROFILES.suivi) {
  const jeton = jetonDe(ctx);
  const limite = consume('suivi:' + ctx.ip, profil);
  if (!limite.allowed) {
    ctx.res.setHeader('Retry-After', String(limite.retryAfterSeconds));
    throw new AppError(429, t('http.tropDeDemandes'), { details: { retryAfter: limite.retryAfterSeconds } });
  }
  const ticket = await ticketParJeton(jeton);
  if (!ticket) throw notFound(t('req.lienPerime'));
  return ticket;
}
