/**
 * La file, vue du salon.
 *
 * Quatre gestes, quatre boutons, aucun menu :
 *   appeler   servir   absent   annuler
 *
 * Toutes ces routes exigent une session du personnel. Elles rendent, en plus du
 * resultat du geste, l'etat COMPLET de la file : la tablette n'a jamais besoin
 * d'une seconde requete pour se remettre a jour, meme si le flux temps reel a
 * ete coupe par un tunnel ou un ascenseur.
 */
import { Router } from '../http/router.js';
import { validate, rules } from '../core/validate.js';
import { idDe } from '../http/aides.js';
import { PROFILES } from '../core/ratelimit.js';
import { jourLocal } from '../core/temps.js';
import { transaction, one } from '../db/index.js';
import { log } from '../core/logger.js';
import { lireTous, adressePublique, enregistrer } from '../core/reglages.js';
import { abonner, envoyerEtatInitial, annoncerChangement } from '../core/flux.js';
import { decrypt } from '../core/crypto.js';
import { notFound } from '../core/errors.js';
import {
  chargerEtat, pourSalon, appeler, appelerSuivant, commencerService, terminer,
  marquerAbsent, annuler, ajouterAuComptoir, etatPriseDeTour, transferer,
} from '../domain/file.js';
import { cloturer } from '../domain/journee.js';
import { detailTicket } from '../domain/statistiques.js';
import { lienWhatsappCoiffeur, texteMessage } from '../domain/notifications.js';
import { t } from '../core/langue.js';

export const fileRoutes = new Router();

/**
 * L'etat courant de la file, avec le meme format que le flux temps reel, et
 * l'etat de la prise de tour (ouverte, suspendue, congés, hors horaires).
 */
async function repondreAvecLaFile(ctx, extra = {}) {
  const [etat, prise] = await Promise.all([chargerEtat(jourLocal()), etatPriseDeTour()]);
  ctx.ok({ ...extra, file: pourSalon(etat), priseDeTour: prise });
}

fileRoutes.get('/', async (ctx) => {
  await repondreAvecLaFile(ctx);
});

/**
 * ARRETER ou REPRENDRE les prises de tour.
 *
 * Geste du quotidien, pas de l'administration : le coiffeur qui part une heure,
 * ou qui ne veut plus personne apres 19 h 30, doit pouvoir fermer l'entree d'un
 * seul appui. La file en cours n'est pas touchee : ceux qui attendent sont
 * servis jusqu'au dernier.
 */
fileRoutes.post('/prise-de-tour', async (ctx) => {
  const data = validate(ctx.body, {
    ouverte: { type: 'bool', required: true },
    message: { type: 'string', max: 160 },
  });
  const valeurs = { 'file.priseDeTourOuverte': data.ouverte };
  // Le message d'arret n'a de sens que pendant l'arret : on l'efface a la
  // reprise, pour qu'il ne resurgisse pas six mois plus tard.
  if (data.ouverte) valeurs['file.messagePause'] = '';
  else if (data.message !== undefined) valeurs['file.messagePause'] = data.message ?? '';

  await enregistrer(valeurs, { parUtilisateurId: ctx.user.id });
  log.info('Prise de tour modifiee', { ouverte: data.ouverte, par: ctx.user.identifiant });
  await repondreAvecLaFile(ctx);
}, { rateLimit: PROFILES.administration });

/**
 * Flux temps reel du salon. La tablette reste allumee toute la journee :
 * une connexion ouverte, un battement toutes les 25 secondes, rien de plus.
 */
fileRoutes.get('/flux', async (ctx) => {
  const res = ctx.ouvrirFlux();
  if (!res) return;
  const abonne = abonner({ res, req: ctx.req, portee: 'SALON', jour: jourLocal() });
  if (abonne) await envoyerEtatInitial(abonne);
}, { flux: true, rateLimit: PROFILES.flux });

/* ---------------- les quatre gestes ---------------- */

/**
 * `posteId` designe le fauteuil. Facultatif : sans lui, le premier fauteuil
 * libre est pris — ce qui est exactement ce qu'il faut dans un salon a un seul
 * fauteuil, ou personne n'a a le choisir.
 */
const posteDemande = (ctx) => validate(ctx.body, { posteId: { type: 'uuid' } }).posteId ?? null;

fileRoutes.post('/suivant', async (ctx) => {
  const ticket = await appelerSuivant({ user: ctx.user, posteId: posteDemande(ctx) });
  await repondreAvecLaFile(ctx, { appele: ticket.numero_affiche, fauteuil: ticket.poste?.nom ?? null });
}, { rateLimit: PROFILES.file });

fileRoutes.post('/:id/appeler', async (ctx) => {
  const ticket = await appeler(idDe(ctx), { user: ctx.user, posteId: posteDemande(ctx) });
  await repondreAvecLaFile(ctx, { appele: ticket.numero_affiche, fauteuil: ticket.poste?.nom ?? null });
}, { rateLimit: PROFILES.file });

fileRoutes.post('/:id/commencer', async (ctx) => {
  const ticket = await commencerService(idDe(ctx), { user: ctx.user });
  await repondreAvecLaFile(ctx, { enCours: ticket.numero_affiche });
}, { rateLimit: PROFILES.file });

/** CLIENT SERVI : le gros bouton. */
fileRoutes.post('/:id/servi', async (ctx) => {
  const ticket = await terminer(idDe(ctx), { user: ctx.user });
  await repondreAvecLaFile(ctx, { servi: ticket.numero_affiche });
}, { rateLimit: PROFILES.file });

/** ABSENT : le client repart en fin de file, il n'est jamais supprime. */
fileRoutes.post('/:id/absent', async (ctx) => {
  const ticket = await marquerAbsent(idDe(ctx), { user: ctx.user });
  await repondreAvecLaFile(ctx, { absent: ticket.numero_affiche, retards: ticket.retards });
}, { rateLimit: PROFILES.file });

/**
 * CHANGER LE COIFFEUR d'un client qui attend.
 *
 * Utile quand une file s'allonge et qu'une autre est vide, et indispensable
 * pour vider la file d'un coiffeur qui doit partir. Le client garde son rang :
 * son heure d'arrivee ne change pas.
 */
fileRoutes.post('/:id/transferer', async (ctx) => {
  const data = validate(ctx.body, { posteId: { type: 'uuid', required: true, requiredMessage: () => t('file.indiquerCoiffeur') } });
  const ticket = await transferer(idDe(ctx), { user: ctx.user, posteId: data.posteId });
  await repondreAvecLaFile(ctx, { transfere: ticket.numero_affiche, fauteuil: ticket.poste?.nom ?? null });
}, { rateLimit: PROFILES.file });

fileRoutes.post('/:id/annuler', async (ctx) => {
  const data = validate(ctx.body, { motif: rules.motif });
  const ticket = await annuler(idDe(ctx), { user: ctx.user, motif: data.motif });
  await repondreAvecLaFile(ctx, { annule: ticket.numero_affiche });
}, { rateLimit: PROFILES.file });

/**
 * AJOUTER UN CLIENT AU COMPTOIR.
 *
 * Le QR Code couvre la quasi-totalite des cas, mais il reste le client qui n'a
 * pas de telephone en main. Sans ce geste, le coiffeur devrait tenir une file
 * parallele sur un papier - c'est-a-dire exactement ce que l'application est
 * censee supprimer.
 */
fileRoutes.post('/comptoir', async (ctx) => {
  const data = validate(ctx.body, {
    prenom: rules.prenom,
    nom: rules.nomFamille,
    telephone: rules.whatsapp,
  });
  const { ticket, jeton } = await ajouterAuComptoir(data, { user: ctx.user });
  const reglages = await lireTous();
  const base = adressePublique(reglages, ctx.base);
  const etat = await chargerEtat(jourLocal());
  ctx.created({
    numero: ticket.numero_affiche,
    lien: base + '/ticket/' + jeton,
    file: pourSalon(etat),
  });
}, { rateLimit: PROFILES.file });

/* ---------------- detail et WhatsApp ---------------- */

/** L'historique complet d'un ticket : qui a fait quoi, et quand. */
fileRoutes.get('/:id', async (ctx) => {
  const detail = await detailTicket(idDe(ctx));
  if (!detail) throw notFound(t('journee.tourIntrouvable'));
  ctx.ok({
    ticket: {
      id: detail.ticket.id,
      jour: detail.ticket.jour,
      numero: detail.ticket.numero_affiche,
      prenom: detail.ticket.prenom,
      nom: detail.ticket.nom,
      telephoneFin: detail.ticket.telephone_fin,
      source: detail.ticket.source,
      statut: detail.ticket.statut,
      retards: detail.ticket.retards,
      arriveA: detail.ticket.arrive_at,
      appeleA: detail.ticket.appele_at,
      serviA: detail.ticket.service_at,
      termineA: detail.ticket.termine_at,
      motif: detail.ticket.motif,
    },
    evenements: detail.evenements.map((e) => ({
      statut: e.statut, rang: e.rang, par: e.par_libelle, detail: e.detail, a: e.at,
    })),
  });
});

/**
 * Les liens WhatsApp des N PROCHAINS clients, d'un seul appel.
 *
 * Sans l'API Business, prevenir trois personnes demande trois allers-retours
 * dans la file, trois ouvertures de fiche, trois retours. Un samedi matin, le
 * coiffeur ne le fait pas — et les clients arrivent en retard.
 *
 * Cette route ne fait qu'ASSEMBLER les liens : rien n'est envoye ici. Le
 * coiffeur ouvre les conversations une par une, depuis son telephone, et
 * chaque envoi reste son geste. C'est aussi pour cela qu'elle est en GET :
 * elle ne change rien.
 *
 * Les numeros sortent en clair — c'est le but, on va ecrire a ces gens — mais
 * uniquement vers une session du personnel, et jamais dans le journal.
 */
fileRoutes.get('/prochains/whatsapp', async (ctx) => {
  const combien = ctx.queryInt('combien', 3, { min: 1, max: 10 });
  const reglages = await lireTous();
  const base = adressePublique(reglages, ctx.base);
  const etat = await chargerEtat(jourLocal());

  // L'ordre de la file, pas celui de la base : c'est celui que le coiffeur voit.
  const attente = etat.tickets
    .filter((t) => ['WAITING', 'LATE'].includes(t.statut))
    .sort((a, b) => a.rang - b.rang)
    .slice(0, combien);

  const items = attente.map((t) => {
    const position = etat.positions.get(t.id);
    const jeton = t.jeton_enc ? decrypt(t.jeton_enc) : null;
    const lien = jeton ? base + '/ticket/' + jeton : '';
    const telephone = decrypt(t.telephone_enc);
    return {
      id: t.id,
      numero: t.numero_affiche,
      prenom: t.prenom,
      devant: position?.devant ?? 0,
      lienWhatsapp: lienWhatsappCoiffeur({
        telephone,
        prenom: t.prenom,
        numero: t.numero_affiche,
        devant: position?.devant ?? 0,
        lien,
        type: 'APPROCHE',
        nomSalon: reglages['salon.nom'],
      }),
    };
  });

  ctx.ok({ items, total: attente.length });
});

/**
 * Le lien WhatsApp d'un client, avec le message deja ecrit.
 *
 * C'est le filet de securite du premier jour : sans API WhatsApp Business
 * configuree, le coiffeur appuie ici et la conversation s'ouvre, texte compris.
 * Le numero n'est donc jamais affiche en clair dans une liste - il ne sort que
 * lorsqu'on demande explicitement a ecrire a quelqu'un.
 */
fileRoutes.get('/:id/whatsapp', async (ctx) => {
  const id = idDe(ctx);
  const ticket = await one(
    'SELECT id, prenom, numero_affiche, telephone_enc, jeton_enc, statut, retards FROM tickets WHERE id = $1',
    [id],
  );
  if (!ticket) throw notFound(t('journee.tourIntrouvable'));

  const reglages = await lireTous();
  const base = adressePublique(reglages, ctx.base);
  const etat = await chargerEtat(jourLocal());
  const position = etat.positions.get(id);
  const jeton = ticket.jeton_enc ? decrypt(ticket.jeton_enc) : null;
  const lien = jeton ? base + '/ticket/' + jeton : '';
  const type = ticket.statut === 'CALLED' ? 'TOUR' : 'APPROCHE';
  const telephone = decrypt(ticket.telephone_enc);

  ctx.ok({
    telephone,
    type,
    texte: texteMessage(type, {
      prenom: ticket.prenom,
      numero: ticket.numero_affiche,
      devant: position?.devant ?? 0,
      lien,
      nomSalon: reglages['salon.nom'],
    }),
    lienWhatsapp: lienWhatsappCoiffeur({
      telephone,
      prenom: ticket.prenom,
      numero: ticket.numero_affiche,
      devant: position?.devant ?? 0,
      lien,
      type,
      nomSalon: reglages['salon.nom'],
    }),
    lienSuivi: lien,
  });
});


/* ---------------- cloture ---------------- */

/**
 * CLOTURER LA JOURNEE.
 *
 * Geste du gerant, pas du coiffeur : il annule tous les tours encore en file et
 * verrouille la journee. Elle passe alors a l'historique, ou plus rien ne
 * bouge. Le lendemain, la file repart vide et la numerotation a A001.
 */
fileRoutes.post('/cloturer', async (ctx) => {
  const jour = jourLocal();
  const bilan = await transaction(async (tx) => {
    const resultat = await cloturer(tx, jour, { par: ctx.user.identifiant, motif: t('journee.fermeeParSalon') });
    // Les telephones encore ouverts sur un suivi doivent l'apprendre tout de
    // suite, et seulement si la cloture a bien ete validee.
    tx.apresValidation(() => annoncerChangement(jour));
    return resultat;
  });
  const etat = await chargerEtat(jour);
  ctx.ok({
    jour,
    deja: bilan === null,
    annules: bilan?.annules ?? 0,
    file: pourSalon(etat),
  });
}, { role: 'GERANT', rateLimit: PROFILES.administration });
