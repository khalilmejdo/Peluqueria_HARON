/**
 * LES RENDEZ-VOUS, COTE API.
 *
 * Public (le jeton du rendez-vous tient lieu de sesame, comme pour un ticket) :
 *   GET  /api/public/rdv/offre                 ce qu'on peut reserver
 *   GET  /api/public/rdv/calendrier            les jours, et combien d'heures libres
 *   GET  /api/public/rdv/creneaux?jour=...     les heures libres d'un jour
 *   POST /api/public/rdv                       reserver
 *   GET  /api/public/rdv/:jeton                SON rendez-vous
 *   POST /api/public/rdv/:jeton/annuler        l'annuler
 *
 * Personnel (session) :
 *   GET  /api/agenda?jour=AAAA-MM-JJ           l'agenda d'un jour
 *   GET  /api/agenda/calendrier                les jours (pour reserver au telephone)
 *   GET  /api/agenda/creneaux                  les heures libres
 *   POST /api/agenda                           poser un rendez-vous (pris au telephone)
 *   POST /api/agenda/:id/statut                arrive, absent, annule, confirme
 *   POST /api/agenda/:id/installer             au fauteuil (devient un ticket)
 *   POST /api/agenda/:id/deplacer              autre jour, autre heure
 *   GET  /api/agenda/:id/whatsapp              ecrire au client, lien compris
 */
import { Router } from '../http/router.js';
import { one } from '../db/index.js';
import { validate, rules } from '../core/validate.js';
import { idDe } from '../http/aides.js';
import { AppError, notFound } from '../core/errors.js';
import { t } from '../core/langue.js';
import { lireTous, adressePublique, plagesDuJour, horairesLisibles } from '../core/reglages.js';
import {
  consommerReservation, PROFILES, suiviBloque, noterEchecSuivi, consommerJeton,
} from '../core/ratelimit.js';
import { jourLocal } from '../core/temps.js';
import { lienWaMe } from '../core/whatsapp.js';
import { pourVitrine as tarifsVitrine } from '../domain/tarifas.js';
import { parMoment } from '../domain/creneaux.js';
import {
  calendrier, creneauxDisponibles, reserver, parJeton, pourClient, annulerParClient, agendaDuJour,
  changerStatut, installer, deplacer, lienDuClient, postesPourRdv, etatDesRendezVous, prestationsDemandees,
  jourDeSemaine,
} from '../domain/rendezvous.js';

export const rdvPublicRoutes = new Router();
export const agendaRoutes = new Router();

/** « a,b,c » ou un tableau -> des uuid, six au plus. */
export function idsDe(brut) {
  const liste = Array.isArray(brut) ? brut : String(brut ?? '').split(',');
  return liste.map((v) => String(v).trim()).filter((v) => /^[0-9a-f-]{36}$/i.test(v)).slice(0, 6);
}

const jourValide = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? String(v) : null);

/* ------------------------------------------------------------------ */
/*  Public                                                             */
/* ------------------------------------------------------------------ */

/**
 * L'OFFRE : les prestations qu'on peut reserver, et les professionnels
 * entre lesquels choisir (si le salon le propose). Rien de personnel.
 */
export async function offreDeRendezVous() {
  const r = await lireTous();
  const postes = await postesPourRdv();
  const etat = etatDesRendezVous(r, { postes });
  const prestations = (await tarifsVitrine()).filter((p) => p.reservable);
  return {
    etat,
    prestations: r['tarifas.visible'] ? prestations : prestations.map((p) => ({ ...p, precio: null, precioTexte: null, precioCts: null })),
    professionnels: r['rdv.choixProfessionnel']
      ? postes.map((p) => ({ id: p.id, nom: p.coiffeur || p.nom }))
      : [],
    horizonJours: r['rdv.horizonJours'],
    annulationHeures: r['rdv.annulationHeures'],
  };
}

rdvPublicRoutes.get('/offre', async (ctx) => {
  ctx.ok(await offreDeRendezVous());
}, { public: true });

rdvPublicRoutes.get('/calendrier', async (ctx) => {
  const r = await lireTous();
  const { duree } = await prestationsDemandees(idsDe(ctx.query('tarifaIds')), { enLigne: true, r });
  ctx.ok(await calendrier({ duree, posteId: ctx.queryUuid('posteId') }));
}, { public: true, rateLimit: PROFILES.suivi });

rdvPublicRoutes.get('/creneaux', async (ctx) => {
  const r = await lireTous();
  const jour = jourValide(ctx.query('jour'));
  if (!jour) throw notFound(t('rdv.heureInvalide'));
  const { duree } = await prestationsDemandees(idsDe(ctx.query('tarifaIds')), { enLigne: true, r });
  const { etat, creneaux } = await creneauxDisponibles({ jour, duree, posteId: ctx.queryUuid('posteId') });
  // On ne dit JAMAIS quel fauteuil est libre a quelle heure : le client choisit
  // une heure, le salon place. Seule la liste des heures sort.
  const heures = creneaux.map((c) => ({ heure: c.heure, minutes: c.minutes }));
  ctx.ok({ etat, jour, duree, creneaux: heures, parMoment: parMoment(heures) });
}, { public: true, rateLimit: PROFILES.suivi });

rdvPublicRoutes.post('/', async (ctx) => {
  const data = validate(ctx.body, {
    prenom: rules.prenom,
    nom: rules.nomFamille,
    telephone: rules.whatsapp,
    tarifaIds: { type: 'array', max: 6, of: { type: 'uuid' }, required: true },
    posteId: { type: 'uuid' },
    jour: { type: 'date', required: true },
    heure: { type: 'string', required: true, max: 5 },
  });
  const reglages = await lireTous();
  const debit = consommerReservation({ ip: ctx.ipDebit, telephone: data.telephone }, { telephoneSalon: reglages['salon.telephone'] || null });
  if (!debit.allowed) {
    ctx.res.setHeader('Retry-After', String(debit.retryAfterSeconds));
    throw new AppError(429, debit.message, { code: 'TROP_DE_DEMANDES', details: { retryAfter: debit.retryAfterSeconds } });
  }
  const { rdv, jeton } = await reserver({ ...data, source: 'ONLINE' });
  const base = adressePublique(reglages, ctx.base);
  ctx.created({ jeton, lien: base + '/rdv/' + jeton, ...(await pourClient(rdv)) });
}, { public: true });

/** Meme protection que le lien d'un ticket : echecs par adresse, volume par jeton. */
async function rdvDuJeton(ctx) {
  const refuser = (limite) => {
    ctx.res.setHeader('Retry-After', String(limite.retryAfterSeconds));
    throw new AppError(429, t('http.tropDeDemandes'), { details: { retryAfter: limite.retryAfterSeconds } });
  };
  const bloque = suiviBloque(ctx.ipDebit);
  if (!bloque.allowed) refuser(bloque);
  const jeton = String(ctx.params.jeton || '');
  const rdv = await parJeton(jeton);
  if (!rdv) {
    noterEchecSuivi(ctx.ipDebit);
    throw notFound(t('rdv.introuvable'));
  }
  const limite = consommerJeton('rdv:' + jeton, PROFILES.suivi);
  if (!limite.allowed) refuser(limite);
  return { rdv, jeton };
}

rdvPublicRoutes.get('/:jeton', async (ctx) => {
  const { rdv } = await rdvDuJeton(ctx);
  ctx.ok(await pourClient(rdv));
}, { public: true });

rdvPublicRoutes.post('/:jeton/annuler', async (ctx) => {
  const { jeton } = await rdvDuJeton(ctx);
  const rdv = await annulerParClient(jeton);
  ctx.ok(await pourClient(rdv));
}, { public: true, skipCsrf: true });

/* ------------------------------------------------------------------ */
/*  Personnel                                                          */
/* ------------------------------------------------------------------ */

agendaRoutes.get('/', async (ctx) => {
  const jour = jourValide(ctx.query('jour')) || jourLocal();
  const r = await lireTous();
  const postes = await postesPourRdv();
  ctx.ok({
    jour,
    aujourdhui: jourLocal(),
    etat: etatDesRendezVous(r, { enLigne: false, postes }),
    enLigne: Boolean(r['rdv.actifs']),
    postes: postes.map((p) => ({ id: p.id, nom: p.nom, professionnel: p.coiffeur || p.nom })),
    plages: r['horaires.actifs'] ? plagesDuJour(r, jourDeSemaine(jour)) : [],
    semaine: horairesLisibles(r, r['salon.idioma']),
    pas: r['rdv.pasMinutes'],
    rdvs: await agendaDuJour(jour),
  });
});

agendaRoutes.get('/calendrier', async (ctx) => {
  const r = await lireTous();
  const { duree } = await prestationsDemandees(idsDe(ctx.query('tarifaIds')), { enLigne: false, r });
  ctx.ok(await calendrier({ duree, posteId: ctx.queryUuid('posteId'), salon: true, saufId: ctx.queryUuid('saufId') }));
});

agendaRoutes.get('/creneaux', async (ctx) => {
  const r = await lireTous();
  const jour = jourValide(ctx.query('jour'));
  if (!jour) throw notFound(t('rdv.heureInvalide'));
  const saufId = ctx.queryUuid('saufId');
  let duree;
  if (saufId) {
    const actuel = await agendaDuJourDe(saufId);
    duree = actuel?.duree;
  }
  if (!duree) duree = (await prestationsDemandees(idsDe(ctx.query('tarifaIds')), { enLigne: false, r })).duree;
  const { etat, creneaux } = await creneauxDisponibles({ jour, duree, posteId: ctx.queryUuid('posteId'), salon: true, saufId });
  ctx.ok({ etat, jour, duree, creneaux, parMoment: parMoment(creneaux) });
});

/** La duree d'un rendez-vous existant (pour le deplacer). */
async function agendaDuJourDe(id) {
  const l = await one('SELECT duree_min FROM rendez_vous WHERE id = $1', [id]);
  return l ? { duree: l.duree_min } : null;
}

agendaRoutes.post('/', async (ctx) => {
  const data = validate(ctx.body, {
    prenom: rules.prenom,
    nom: rules.nomFamille,
    telephone: rules.whatsapp,
    tarifaIds: { type: 'array', max: 6, of: { type: 'uuid' } },
    posteId: { type: 'uuid' },
    jour: { type: 'date', required: true },
    heure: { type: 'string', required: true, max: 5 },
    note: { type: 'string', max: 200 },
  });
  const { rdv } = await reserver({ ...data, tarifaIds: data.tarifaIds || [], source: 'SALON' }, { user: ctx.user });
  ctx.created({ id: rdv.id, rdvs: await agendaDuJour(rdv.jour) });
}, { rateLimit: PROFILES.file });

agendaRoutes.post('/:id/statut', async (ctx) => {
  const data = validate(ctx.body, {
    statut: { type: 'enum', values: ['ARRIVE', 'ABSENT', 'ANNULE', 'CONFIRME'], upper: true, required: true },
    motif: { type: 'string', max: 200 },
  });
  const rdv = await changerStatut(idDe(ctx), data.statut, { user: ctx.user, motif: data.motif });
  ctx.ok({ rdvs: await agendaDuJour(rdv.jour) });
}, { rateLimit: PROFILES.file });

agendaRoutes.post('/:id/installer', async (ctx) => {
  const ticket = await installer(idDe(ctx), { user: ctx.user });
  ctx.ok({ numero: ticket.numero_affiche, rdvs: await agendaDuJour(jourLocal()) });
}, { rateLimit: PROFILES.file });

agendaRoutes.post('/:id/deplacer', async (ctx) => {
  const data = validate(ctx.body, {
    jour: { type: 'date', required: true },
    heure: { type: 'string', required: true, max: 5 },
    posteId: { type: 'uuid' },
  });
  const rdv = await deplacer(idDe(ctx), data, { user: ctx.user });
  ctx.ok({ jour: rdv.jour, rdvs: await agendaDuJour(rdv.jour) });
}, { rateLimit: PROFILES.file });

agendaRoutes.get('/:id/whatsapp', async (ctx) => {
  const { jeton, telephone, prenom } = await lienDuClient(idDe(ctx));
  const reglages = await lireTous();
  const lien = adressePublique(reglages, ctx.base) + '/rdv/' + jeton;
  const texte = t('rdv.messageWhatsapp', { prenom, nom: reglages['salon.nom'], lien });
  ctx.ok({ telephone, texte, lienWhatsapp: lienWaMe(String(telephone).replace(/[^0-9]/g, ''), texte), lienSuivi: lien });
});
