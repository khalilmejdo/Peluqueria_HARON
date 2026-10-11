/**
 * LES RENDEZ-VOUS.
 *
 * Le client choisit ses prestations, eventuellement son professionnel, un jour
 * et une heure. Le salon voit son agenda, accueille le client, l'installe au
 * fauteuil — et la suite (servi, absent, historique) est celle de la file.
 *
 * CE QUI EST GARANTI, ET PAR QUI :
 *   - aucun fauteuil ne porte deux rendez-vous qui se chevauchent : la base
 *     (contrainte d'exclusion), pas le code ;
 *   - une heure proposee est une heure REELLEMENT libre : la reservation
 *     recalcule les creneaux au moment de valider, elle ne croit pas la page ;
 *   - la duree vient des prestations relues EN BASE, jamais du navigateur ;
 *   - le telephone n'est jamais stocke en clair (chiffre + index aveugle) et
 *     le lien du client n'est garde qu'en empreinte.
 *
 * Les rendez-vous et la file vivent cote a cote : un fauteuil prend des
 * clients de passage entre deux rendez-vous, et un client de rendez-vous qui
 * arrive passe avant la file DE SON FAUTEUIL (voir rdvAAccueillir()).
 */
import { transaction, all, one, execute } from '../db/index.js';
import { newId, jetonSuivi, hashToken, encrypt, decrypt, blindIndex, blindIndexTous, jetonPlausible } from '../core/crypto.js';
import { jourLocal, minutesDepuisMinuit, instantLocal, dateLongue } from '../core/temps.js';
import { addDays } from '../core/text.js';
import { t } from '../core/langue.js';
import { AppError, conflict, notFound, ValidationError } from '../core/errors.js';
import { lireTous, plagesDuJour } from '../core/reglages.js';
import { montantLisible } from '../core/devise.js';
import { annoncerChangement } from '../core/flux.js';
import { log } from '../core/logger.js';
import { creneauxDuJour, fauteuilLeMoinsCharge, enMinutes } from './creneaux.js';
import { ticketPourRendezVous } from './file.js';
import { prevenirDuRendezVous } from './push.js';

export const STATUTS_RDV_ACTIFS = ['CONFIRME', 'ARRIVE', 'INSTALLE'];

const COLONNES = `id, jour, debut, fin, poste_id, poste_choisi, prenom, nom, telephone_enc, telephone_idx,
                  telephone_fin, duree_min, statut, source, jeton_enc, note, ticket_id, annule_par, motif,
                  statut_at, version, created_at`;

/** Jour de la semaine (0 = dimanche) d'une date « AAAA-MM-JJ ». */
export function jourDeSemaine(iso) {
  const [a, m, j] = String(iso).split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, j)).getUTCDay();
}

/* ------------------------------------------------------------------ */
/*  Le contexte d'un calcul de creneaux                                */
/* ------------------------------------------------------------------ */

/**
 * LES RENDEZ-VOUS SONT-ILS POSSIBLES ? Et sinon, pourquoi — une raison qu'on
 * peut dire au client (« le salon ne prend pas de rendez-vous en ligne ») et
 * au gerant (« declarez vos horaires »).
 *
 * `enLigne` : la question du client. Le salon, lui, tient son agenda meme
 * quand la reservation en ligne est coupee (rendez-vous pris au telephone).
 */
export function etatDesRendezVous(r, { enLigne = true, postes = [] } = {}) {
  if (enLigne && !r['rdv.actifs']) return { ouvert: false, raison: 'INACTIFS' };
  if (!r['horaires.actifs']) return { ouvert: false, raison: 'HORAIRES' };
  if (!postes.length) return { ouvert: false, raison: 'AUCUN_FAUTEUIL' };
  return { ouvert: true, raison: null };
}

export const postesPourRdv = () => all(
  'SELECT id, nom, coiffeur, ordre FROM postes WHERE actif AND rdv ORDER BY ordre, nom_lower',
);

/**
 * Les bornes de la reservation : on ne reserve ni dans le passe, ni dans
 * l'heure (delai), ni au-dela de l'horizon. Le salon, au telephone, n'a pas
 * de delai et voit trois mois devant lui.
 */
function bornes(r, { salon = false, maintenant = new Date() } = {}) {
  const delai = salon ? 0 : r['rdv.delaiMinutes'];
  const horizon = salon ? 90 : r['rdv.horizonJours'];
  const auPlusTot = new Date(maintenant.getTime() + delai * 60000);
  const aujourdhui = jourLocal(maintenant);
  return {
    premier: aujourdhui,
    dernier: addDays(aujourdhui, horizon - 1),
    jourMin: jourLocal(auPlusTot),
    minuteMin: minutesDepuisMinuit(auPlusTot),
  };
}

async function occupesEntre(du, au, { saufId = null } = {}) {
  const lignes = await all(
    `SELECT id, poste_id, jour, debut, fin FROM rendez_vous
      WHERE jour BETWEEN $1 AND $2 AND statut = ANY($3) AND ($4::uuid IS NULL OR id <> $4)`,
    [du, au, STATUTS_RDV_ACTIFS, saufId],
  );
  return lignes.map((l) => ({
    jour: l.jour,
    posteId: l.poste_id,
    debut: minutesDepuisMinuit(new Date(l.debut)),
    // Un rendez-vous qui finirait apres minuit (impossible par les horaires,
    // mais on ne fait pas confiance) occupe la fin de la journee.
    fin: jourLocal(new Date(l.fin)) === l.jour ? minutesDepuisMinuit(new Date(l.fin)) : 24 * 60,
  }));
}

async function joursFermes(du, au) {
  const periodes = await all('SELECT du, au FROM fermetures WHERE au >= $1 AND du <= $2', [du, au]);
  return (jour) => periodes.some((p) => p.du <= jour && jour <= p.au);
}

/**
 * La duree et les prestations d'une demande, relues EN BASE.
 * En ligne, seules les prestations visibles ET reservables comptent, et il en
 * faut au moins une ; le salon peut poser un rendez-vous « sans precision »,
 * compte a la duree moyenne.
 */
export async function prestationsDemandees(ids, { enLigne = true, r } = {}) {
  const liste = Array.isArray(ids) ? [...new Set(ids)].slice(0, 6) : [];
  const lignes = liste.length
    ? await all(
      `SELECT id, nombre, duracion_min, precio_cts, precio_desde FROM tarifas
        WHERE id = ANY($1::uuid[]) AND visible ${enLigne ? 'AND reservable' : ''}`,
      [liste],
    )
    : [];
  const parId = new Map(lignes.map((l) => [l.id, l]));
  const choisies = liste.map((id) => parId.get(id)).filter(Boolean);
  if (enLigne && !choisies.length) {
    throw new ValidationError({ tarifaIds: t('rdv.choisirPrestation') }, t('rdv.choisirPrestation'));
  }
  const duree = choisies.length
    ? choisies.reduce((n, l) => n + l.duracion_min, 0)
    : r['file.dureeMoyenneMinutes'];
  return { choisies, duree: Math.max(5, Math.min(480, duree)) };
}

/* ------------------------------------------------------------------ */
/*  Creneaux et disponibilites                                         */
/* ------------------------------------------------------------------ */

function calculerJour(jour, c) {
  if (jour < c.bornes.premier || jour > c.bornes.dernier || jour < c.bornes.jourMin) return [];
  if (c.ferme(jour)) return [];
  const candidats = c.posteId ? c.postes.filter((p) => p.id === c.posteId) : c.postes;
  return creneauxDuJour({
    plages: plagesDuJour(c.r, jourDeSemaine(jour)),
    postes: candidats,
    occupes: c.occupes.filter((o) => o.jour === jour),
    duree: c.duree,
    pas: c.r['rdv.pasMinutes'],
    tampon: c.r['rdv.tamponMinutes'],
    auPlusTotMinutes: jour === c.bornes.jourMin ? c.bornes.minuteMin : -Infinity,
  });
}

async function contexteCalcul({ du, au, duree, posteId = null, salon = false, saufId = null }) {
  const r = await lireTous();
  const postes = await postesPourRdv();
  const etat = etatDesRendezVous(r, { enLigne: !salon, postes });
  return {
    r,
    postes,
    etat,
    posteId,
    duree,
    bornes: bornes(r, { salon }),
    occupes: await occupesEntre(du, au, { saufId }),
    ferme: await joursFermes(du, au),
  };
}

/**
 * Le calendrier : pour chaque jour de l'horizon, combien d'heures restent.
 * C'est ce qui grise « complet » ou « ferme » dans la bande des jours.
 */
export async function calendrier({ duree, posteId = null, salon = false, saufId = null } = {}) {
  const r = await lireTous();
  const b = bornes(r, { salon });
  const c = await contexteCalcul({ du: b.premier, au: b.dernier, duree, posteId, salon, saufId });
  if (!c.etat.ouvert) return { etat: c.etat, jours: [] };
  const jours = [];
  for (let jour = b.premier; jour <= b.dernier; jour = addDays(jour, 1)) {
    const ouvertCeJour = !c.ferme(jour) && plagesDuJour(r, jourDeSemaine(jour)).length > 0;
    const n = ouvertCeJour ? calculerJour(jour, c).length : 0;
    jours.push({ jour, jourSemaine: jourDeSemaine(jour), ferme: !ouvertCeJour, libres: n });
  }
  return { etat: c.etat, jours };
}

/**
 * LES PROCHAINES HEURES LIBRES, tous jours confondus : l'apercu de la vitrine.
 * Trois au plus par jour, pour montrer plusieurs jours plutot qu'une seule
 * matinee egrenee quart d'heure par quart d'heure.
 */
export async function prochainesHeures({ n = 6, duree, parJour = 3 } = {}) {
  const r = await lireTous();
  const b = bornes(r);
  const c = await contexteCalcul({ du: b.premier, au: b.dernier, duree });
  if (!c.etat.ouvert) return { etat: c.etat, heures: [] };
  const heures = [];
  for (let jour = b.premier; jour <= b.dernier && heures.length < n; jour = addDays(jour, 1)) {
    for (const creneau of calculerJour(jour, c).slice(0, parJour)) {
      heures.push({ jour, heure: creneau.heure });
      if (heures.length >= n) break;
    }
  }
  return { etat: c.etat, heures };
}

/** Les heures libres d'un jour. */
export async function creneauxDisponibles({ jour, duree, posteId = null, salon = false, saufId = null }) {
  const c = await contexteCalcul({ du: jour, au: jour, duree, posteId, salon, saufId });
  if (!c.etat.ouvert) return { etat: c.etat, creneaux: [] };
  return { etat: c.etat, creneaux: calculerJour(jour, c), contexte: c };
}

/* ------------------------------------------------------------------ */
/*  Reserver                                                           */
/* ------------------------------------------------------------------ */

const traduireConflit = (err) => {
  if (err?.code === '23P01') {
    return new AppError(409, t('rdv.creneauPris'), { code: 'CRENEAU_PRIS' });
  }
  return err;
};

/**
 * RESERVER UN CRENEAU.
 *
 * @param {object} d
 * @param {'ONLINE'|'SALON'} [d.source]
 * @returns {Promise<{ rdv:object, jeton:string }>}
 */
export async function reserver({
  prenom, nom, telephone, tarifaIds = [], posteId = null, jour, heure, source = 'ONLINE', note = null,
}, { user = null } = {}) {
  const salon = source === 'SALON';
  const r = await lireTous();
  const { choisies, duree } = await prestationsDemandees(tarifaIds, { enLigne: !salon, r });

  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(jour || '')) || !Number.isFinite(enMinutes(heure))) {
    throw new ValidationError({ heure: t('rdv.heureInvalide') }, t('rdv.heureInvalide'));
  }
  if (posteId && !r['rdv.choixProfessionnel'] && !salon) posteId = null;

  const { etat, creneaux, contexte } = await creneauxDisponibles({ jour, duree, posteId, salon });
  if (!etat.ouvert) throw new AppError(409, t('rdv.ferme.' + etat.raison), { code: 'RDV_' + etat.raison });
  const offre = creneaux.find((c) => c.heure === heure);
  if (!offre) throw new AppError(409, t('rdv.creneauIndisponible'), { code: 'CRENEAU_INDISPONIBLE' });

  const poste = posteId && offre.postes.includes(posteId)
    ? posteId
    : fauteuilLeMoinsCharge(offre.postes, contexte.occupes.filter((o) => o.jour === jour), contexte.postes.map((p) => p.id));

  // Un meme numero ne tient pas toute la semaine : au-dela de N rendez-vous a
  // venir, on demande d'appeler le salon. Le salon, lui, n'a pas de limite.
  if (!salon) {
    const deja = await one(
      `SELECT COUNT(*)::int AS n FROM rendez_vous
        WHERE telephone_idx = ANY($1) AND statut = ANY($2) AND fin > now()`,
      [blindIndexTous(telephone), ['CONFIRME', 'ARRIVE']],
    );
    if ((deja?.n ?? 0) >= r['rdv.maxParNumero']) {
      throw new AppError(409, t('rdv.tropDeRdv', { n: r['rdv.maxParNumero'] }), { code: 'TROP_DE_RDV' });
    }
  }

  const debut = instantLocal(jour, heure);
  const fin = new Date(debut.getTime() + duree * 60000);
  const jeton = jetonSuivi();
  const id = newId();

  let rdv;
  try {
    rdv = await transaction(async (tx) => {
      const ligne = await tx.one(
        `INSERT INTO rendez_vous (id, jour, debut, fin, poste_id, poste_choisi, prenom, nom, telephone_enc, telephone_idx,
                                  telephone_fin, duree_min, statut, source, jeton_hash, jeton_enc, note)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'CONFIRME',$13,$14,$15,$16)
         RETURNING ` + COLONNES,
        [id, jour, debut, fin, poste, Boolean(posteId), prenom, nom, encrypt(telephone), blindIndex(telephone),
          telephone.slice(-4), duree, salon ? 'SALON' : 'ONLINE', hashToken(jeton), encrypt(jeton), note || null],
      );
      for (let i = 0; i < choisies.length; i += 1) {
        const p = choisies[i];
        await tx.execute(
          `INSERT INTO rendez_vous_tarifas (id, rendez_vous_id, tarifa_id, nombre, duracion_min, precio_cts, precio_desde, ordre)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [newId(), id, p.id, p.nombre, p.duracion_min, p.precio_cts, p.precio_desde, i],
        );
      }
      tx.apresValidation(() => annoncerChangement(jourLocal()));
      return ligne;
    });
  } catch (err) {
    throw traduireConflit(err);
  }

  log.info('Rendez-vous reserve', { jour, heure, source: rdv.source, par: user?.identifiant ?? 'client' });
  if (!salon) prevenirDuRendezVous('PRIS', rdv, { sauf: user?.id ?? null }).catch(() => {});
  return { rdv, jeton };
}

/* ------------------------------------------------------------------ */
/*  Le client et son lien                                              */
/* ------------------------------------------------------------------ */

export async function parJeton(jeton) {
  if (!jetonPlausible(jeton)) return null;
  return one('SELECT ' + COLONNES + ' FROM rendez_vous WHERE jeton_hash = $1', [hashToken(jeton)]);
}

const prestationsDe = (id) => all(
  'SELECT nombre, duracion_min, precio_cts, precio_desde FROM rendez_vous_tarifas WHERE rendez_vous_id = $1 ORDER BY ordre',
  [id],
);

/** Peut-il encore annuler lui-meme ? Jusqu'a N heures avant. */
export function annulableParLeClient(rdv, r, maintenant = new Date()) {
  if (rdv.statut !== 'CONFIRME') return false;
  return new Date(rdv.debut).getTime() - maintenant.getTime() >= r['rdv.annulationHeures'] * 3600000;
}

const prixTexte = (p) => (p.precio_desde
  ? t('tarifs.aPartirDe', { prix: montantLisible(p.precio_cts) })
  : montantLisible(p.precio_cts));

/** Ce que voit le client : son rendez-vous, rien d'autre. */
export async function pourClient(rdv, { langue = null } = {}) {
  const r = await lireTous();
  const [prestations, poste] = await Promise.all([
    prestationsDe(rdv.id),
    one('SELECT nom, coiffeur FROM postes WHERE id = $1', [rdv.poste_id]),
  ]);
  const debut = new Date(rdv.debut);
  const heure = String(Math.floor(minutesDepuisMinuit(debut) / 60)).padStart(2, '0') + ':'
    + String(minutesDepuisMinuit(debut) % 60).padStart(2, '0');
  const total = prestations.reduce((n, p) => n + p.precio_cts, 0);
  return {
    jour: rdv.jour,
    heure,
    dateLongue: dateLongue(rdv.jour, langue),
    prenom: rdv.prenom,
    statut: rdv.statut,
    passe: new Date(rdv.fin).getTime() < Date.now(),
    duree: rdv.duree_min,
    professionnel: rdv.poste_choisi && poste ? (poste.coiffeur || poste.nom) : null,
    prestations: prestations.map((p) => ({ nombre: p.nombre, duree: p.duracion_min, prix: prixTexte(p) })),
    total: prestations.length ? montantLisible(total) : null,
    totalDesde: prestations.some((p) => p.precio_desde),
    annulable: annulableParLeClient(rdv, r),
    annulationHeures: r['rdv.annulationHeures'],
    message: r['rdv.message'] || '',
  };
}

/** ANNULER, par le client, depuis son lien. */
export async function annulerParClient(jeton) {
  const r = await lireTous();
  const rdv = await transaction(async (tx) => {
    const ligne = await tx.one('SELECT ' + COLONNES + ' FROM rendez_vous WHERE jeton_hash = $1 FOR UPDATE', [hashToken(jeton)]);
    if (!ligne) throw notFound(t('rdv.introuvable'));
    if (ligne.statut === 'ANNULE') return ligne;
    if (!annulableParLeClient(ligne, r)) {
      throw new AppError(409, t('rdv.tropTardPourAnnuler', { n: r['rdv.annulationHeures'] }), { code: 'RDV_NON_ANNULABLE' });
    }
    const maj = await tx.one(
      `UPDATE rendez_vous SET statut = 'ANNULE', annule_par = 'CLIENT', statut_at = now(), version = version + 1
        WHERE id = $1 RETURNING ` + COLONNES,
      [ligne.id],
    );
    tx.apresValidation(() => annoncerChangement(jourLocal()));
    return maj;
  });
  prevenirDuRendezVous('ANNULE', rdv).catch(() => {});
  return rdv;
}

/**
 * L'invitation de calendrier (.ics) : le rendez-vous entre dans l'agenda du
 * telephone en un geste, avec un rappel une heure avant.
 */
export function fichierIcs(rdv, { titre, lieu = '', description = '' }) {
  const date = (d) => new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const echapper = (s) => String(s || '').replace(/([,;\\])/g, '\\$1').replace(/\r?\n/g, '\\n');
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//rdv//FR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    'UID:' + rdv.id + '@rdv',
    'DTSTAMP:' + date(new Date()),
    'DTSTART:' + date(rdv.debut),
    'DTEND:' + date(rdv.fin),
    'SUMMARY:' + echapper(titre),
    'LOCATION:' + echapper(lieu),
    'DESCRIPTION:' + echapper(description),
    'BEGIN:VALARM', 'TRIGGER:-PT1H', 'ACTION:DISPLAY', 'DESCRIPTION:' + echapper(titre), 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR', '',
  ].join('\r\n');
}

/* ------------------------------------------------------------------ */
/*  Le salon : l'agenda                                                */
/* ------------------------------------------------------------------ */

/** Les rendez-vous d'un jour, pour le personnel (telephone en clair). */
export async function agendaDuJour(jour) {
  const lignes = await all(
    `SELECT ${COLONNES.split(',').map((c) => 'r.' + c.trim()).join(', ')}, p.nom AS poste_nom, p.coiffeur AS poste_coiffeur
       FROM rendez_vous r JOIN postes p ON p.id = r.poste_id
      WHERE r.jour = $1 ORDER BY r.debut, p.ordre`,
    [jour],
  );
  const prestations = lignes.length
    ? await all(
      'SELECT rendez_vous_id, nombre, duracion_min, precio_cts, precio_desde FROM rendez_vous_tarifas WHERE rendez_vous_id = ANY($1::uuid[]) ORDER BY ordre',
      [lignes.map((l) => l.id)],
    )
    : [];
  return lignes.map((l) => versPersonnel(l, prestations.filter((p) => p.rendez_vous_id === l.id)));
}

function versPersonnel(l, prestations) {
  const debut = new Date(l.debut);
  const fin = new Date(l.fin);
  const enHeure = (d) => {
    const m = minutesDepuisMinuit(d);
    return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
  };
  return {
    id: l.id,
    jour: l.jour,
    heure: enHeure(debut),
    heureFin: enHeure(fin),
    debutMinutes: minutesDepuisMinuit(debut),
    duree: l.duree_min,
    posteId: l.poste_id,
    posteNom: l.poste_nom,
    professionnel: l.poste_coiffeur || l.poste_nom,
    posteChoisi: l.poste_choisi,
    prenom: l.prenom,
    nom: l.nom,
    telephone: decrypt(l.telephone_enc),
    statut: l.statut,
    source: l.source,
    note: l.note || '',
    motif: l.motif || '',
    annulePar: l.annule_par,
    ticketId: l.ticket_id,
    prestations: prestations.map((p) => ({ nombre: p.nombre, duree: p.duracion_min, prix: prixTexte(p) })),
    version: l.version,
  };
}

async function verrouiller(tx, id) {
  const l = await tx.one('SELECT ' + COLONNES + ' FROM rendez_vous WHERE id = $1 FOR UPDATE', [id]);
  if (!l) throw notFound(t('rdv.introuvable'));
  return l;
}

/**
 * Les gestes du salon sur un rendez-vous : ARRIVE, ABSENT, ANNULE, et le
 * retour en arriere CONFIRME (une erreur de doigt sur « absent »).
 */
const TRANSITIONS = {
  ARRIVE: ['CONFIRME'],
  ABSENT: ['CONFIRME', 'ARRIVE'],
  ANNULE: ['CONFIRME', 'ARRIVE'],
  CONFIRME: ['ABSENT', 'ARRIVE'],
};

export async function changerStatut(id, statut, { user = null, motif = null } = {}) {
  if (!TRANSITIONS[statut]) throw new ValidationError({ statut: t('rdv.gesteInconnu') }, t('rdv.gesteInconnu'));
  const rdv = await transaction(async (tx) => {
    const l = await verrouiller(tx, id);
    if (l.statut === statut) return l;
    if (!TRANSITIONS[statut].includes(l.statut)) {
      throw conflict(t('rdv.gesteImpossible', { statut: t('rdv.statut.' + l.statut) }));
    }
    // « Arrive » n'a de sens que le jour meme.
    if (statut === 'ARRIVE' && l.jour !== jourLocal()) throw conflict(t('rdv.arriveAujourdhuiSeulement'));
    const maj = await tx.one(
      `UPDATE rendez_vous SET statut = $2, statut_at = now(), version = version + 1,
              annule_par = CASE WHEN $2 = 'ANNULE' THEN 'SALON' ELSE NULL END,
              motif = CASE WHEN $2 = 'ANNULE' THEN $3 ELSE motif END
        WHERE id = $1 RETURNING ` + COLONNES,
      [id, statut, motif ? String(motif).slice(0, 200) : null],
    );
    tx.apresValidation(() => annoncerChangement(jourLocal()));
    return maj;
  });
  log.info('Rendez-vous modifie', { statut, par: user?.identifiant });
  return rdv;
}

/**
 * INSTALLER le client de rendez-vous au fauteuil.
 *
 * Il devient un ticket de la file, APPELE sur SON fauteuil : le reste du
 * parcours (servi, historique, statistiques) est celui de tous les clients.
 * Un fauteuil occupe le refuse — on ne pose pas deux clients sur le meme
 * fauteuil, rendez-vous ou pas.
 */
export async function installer(id, { user = null } = {}) {
  const r = await lireTous();
  const resultat = await transaction(async (tx) => {
    const rdv = await verrouiller(tx, id);
    if (rdv.statut === 'INSTALLE') throw conflict(t('rdv.dejaInstalle'));
    if (!['CONFIRME', 'ARRIVE'].includes(rdv.statut)) {
      throw conflict(t('rdv.gesteImpossible', { statut: t('rdv.statut.' + rdv.statut) }));
    }
    if (rdv.jour !== jourLocal()) throw conflict(t('rdv.arriveAujourdhuiSeulement'));
    const prestations = await tx.all(
      'SELECT tarifa_id, nombre, duracion_min, precio_cts FROM rendez_vous_tarifas WHERE rendez_vous_id = $1 ORDER BY ordre',
      [rdv.id],
    );
    const ticket = await ticketPourRendezVous(tx, rdv, { user, prestations, reglages: r });
    await tx.execute(
      "UPDATE rendez_vous SET statut = 'INSTALLE', ticket_id = $2, statut_at = now(), version = version + 1 WHERE id = $1",
      [rdv.id, ticket.id],
    );
    return ticket;
  });
  log.info('Client de rendez-vous installe', { ticket: resultat.numero_affiche, par: user?.identifiant });
  return resultat;
}

/**
 * Le client de rendez-vous a accueillir EN PRIORITE sur ce fauteuil : arrive,
 * et dont l'heure est venue (ou presque). Le bouton « suivant » du fauteuil le
 * prend avant la file — il a reserve, il ne doit pas attendre derriere les
 * clients de passage.
 */
export async function rdvAAccueillir(posteId, { maintenant = new Date(), avanceMinutes = 15 } = {}) {
  return one(
    `SELECT id FROM rendez_vous
      WHERE poste_id = $1 AND jour = $2 AND statut = 'ARRIVE' AND debut <= $3
      ORDER BY debut LIMIT 1`,
    [posteId, jourLocal(maintenant), new Date(maintenant.getTime() + avanceMinutes * 60000)],
  );
}

/**
 * DEPLACER un rendez-vous (le client a appele). Meme controle qu'une
 * reservation : l'heure doit etre libre, la contrainte de la base tranche.
 */
export async function deplacer(id, { jour, heure, posteId = null }, { user = null } = {}) {
  const actuel = await one('SELECT ' + COLONNES + ' FROM rendez_vous WHERE id = $1', [id]);
  if (!actuel) throw notFound(t('rdv.introuvable'));
  if (!['CONFIRME', 'ARRIVE'].includes(actuel.statut)) {
    throw conflict(t('rdv.gesteImpossible', { statut: t('rdv.statut.' + actuel.statut) }));
  }
  const cible = posteId || actuel.poste_id;
  const { creneaux } = await creneauxDisponibles({ jour, duree: actuel.duree_min, posteId: cible, salon: true, saufId: id });
  if (!creneaux.some((c) => c.heure === heure)) {
    throw new AppError(409, t('rdv.creneauIndisponible'), { code: 'CRENEAU_INDISPONIBLE' });
  }
  const debut = instantLocal(jour, heure);
  const fin = new Date(debut.getTime() + actuel.duree_min * 60000);
  try {
    await transaction(async (tx) => {
      await verrouiller(tx, id);
      await tx.execute(
        `UPDATE rendez_vous SET jour = $2, debut = $3, fin = $4, poste_id = $5, statut = 'CONFIRME',
                statut_at = now(), version = version + 1 WHERE id = $1`,
        [id, jour, debut, fin, cible],
      );
      tx.apresValidation(() => annoncerChangement(jourLocal()));
    });
  } catch (err) {
    throw traduireConflit(err);
  }
  log.info('Rendez-vous deplace', { jour, heure, par: user?.identifiant });
  return one('SELECT ' + COLONNES + ' FROM rendez_vous WHERE id = $1', [id]);
}

/** Le lien du client, pour que le salon le lui renvoie (WhatsApp). */
export async function lienDuClient(id) {
  const l = await one('SELECT jeton_enc, telephone_enc, prenom FROM rendez_vous WHERE id = $1', [id]);
  if (!l) throw notFound(t('rdv.introuvable'));
  return { jeton: decrypt(l.jeton_enc), telephone: decrypt(l.telephone_enc), prenom: l.prenom };
}

/**
 * A LA CLOTURE : les rendez-vous d'avant aujourd'hui jamais honores
 * deviennent ABSENT. Un « confirme » d'hier ne doit pas trainer dans l'agenda.
 */
export async function solderLesRendezVousPasses(aujourdhui = jourLocal()) {
  return execute(
    "UPDATE rendez_vous SET statut = 'ABSENT', statut_at = now(), version = version + 1 WHERE jour < $1 AND statut IN ('CONFIRME', 'ARRIVE')",
    [aujourdhui],
  );
}

/** Les prochains rendez-vous du jour, par fauteuil (pour l'ecran de la file). */
export async function prochainsDuJour(jour = jourLocal()) {
  return all(
    `SELECT id, poste_id, debut, prenom, statut FROM rendez_vous
      WHERE jour = $1 AND statut IN ('CONFIRME', 'ARRIVE') ORDER BY debut`,
    [jour],
  );
}

