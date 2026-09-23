/**
 * Reglages du salon, comptes du personnel, statistiques, sante du service.
 *
 * Tout ce qui touche aux reglages et aux comptes est reserve au GERANT ; les
 * statistiques du jour restent visibles du coiffeur, qui a besoin de savoir
 * combien de tetes il a faites.
 */
import { Router } from '../http/router.js';
import { validate, validatePartial } from '../core/validate.js';
import { idDe, exigerTrouve } from '../http/aides.js';
import { all, one, execute } from '../db/index.js';
import { config } from '../core/config.js';
import { log } from '../core/logger.js';
import { badRequest, conflict, notFound, forbidden } from '../core/errors.js';
import { newId, hashPassword } from '../core/crypto.js';
import { PROFILES } from '../core/ratelimit.js';
import { CATALOGUE, lireTous, enregistrer, horairesLisibles, adressePublique } from '../core/reglages.js';
import { ROLES, CODES_ROLES } from '../core/roles.js';
import { revokeAllUserSessions } from '../core/session.js';
import { pingSante, etatBase } from '../db/index.js';
import { nombreAbonnes } from '../core/flux.js';
import { duJour, historique } from '../domain/statistiques.js';
import { lister, ajouter, supprimer, fermetureDuJour, prochaine as prochaineFermeture, messageDeFermeture } from '../domain/fermetures.js';
import {
  lister as listerPostes, creer as creerPoste, modifier as modifierPoste,
  supprimer as supprimerPoste, versClient as posteVersClient,
} from '../domain/postes.js';
import {
  lister as listerTarifas, crear as crearTarifa, modificar as modificarTarifa,
  eliminar as eliminarTarifa, mover as moverTarifa, prixLegible,
} from '../domain/tarifas.js';
import { etatBoite } from '../domain/notifications.js';
import { executerTache, nomsDesTaches } from '../core/taches.js';
import { jourLocal } from '../core/temps.js';

/* ================================================================== */
/*  Meta : sante et version                                            */
/* ================================================================== */

export const metaRoutes = new Router();

/** Sonde de l'hebergeur : jamais de session, jamais de detail inutile. */
metaRoutes.get('/healthz', async (ctx) => {
  try {
    const ms = await pingSante();
    ctx.ok({ ok: true, ms });
  } catch (err) {
    log.warn('Sonde de sante en echec', { error: err.message });
    ctx.json(503, { ok: false });
  }
}, { public: true });

metaRoutes.get('/api/version', async (ctx) => {
  ctx.ok({ version: config.version, env: config.env, fuseau: config.timezone });
}, { public: true });

/* ================================================================== */
/*  Reglages                                                           */
/* ================================================================== */

export const reglagesRoutes = new Router();

/**
 * Les reglages ET leur catalogue : le formulaire de l'espace de gestion est
 * construit depuis cette reponse. Ajouter un reglage ici le fait apparaitre a
 * l'ecran sans toucher a l'interface.
 */
reglagesRoutes.get('/', async (ctx) => {
  const valeurs = await lireTous({ frais: true });
  ctx.ok({
    valeurs,
    catalogue: Object.entries(CATALOGUE).map(([cle, regle]) => ({
      cle,
      type: regle.type,
      libelle: regle.libelle,
      aide: regle.aide ?? null,
      groupe: regle.groupe ?? null,
      min: regle.min ?? null,
      max: regle.max ?? null,
      maxLongueur: regle.maxLongueur ?? null,
      options: regle.options ?? null,
      defaut: regle.defaut,
    })),
    horaires: horairesLisibles(valeurs),
    adressePublique: adressePublique(valeurs, ctx.base),
    whatsapp: {
      actif: config.whatsapp.actif,
      modeles: config.whatsapp.modeles,
      // Le jeton et l'identifiant de numero viennent de l'environnement et n'en
      // sortent jamais : on dit seulement s'ils sont poses.
      configure: Boolean(config.whatsapp.numeroId && config.whatsapp.jeton),
    },
  });
}, { role: 'GERANT' });

reglagesRoutes.put('/', async (ctx) => {
  const valeurs = ctx.body && typeof ctx.body === 'object' ? ctx.body.valeurs : null;
  if (!valeurs || typeof valeurs !== 'object' || Array.isArray(valeurs)) {
    throw badRequest('Envoyez un objet « valeurs » contenant les réglages à enregistrer.');
  }

  // Changer l'organisation de la file en pleine journee laisserait les clients
  // deja en attente dans un entre-deux : en file unique ils n'ont pas de
  // coiffeur, en file par coiffeur ils en ont un que personne n'a choisi. On
  // exige une file vide — c'est un reglage qu'on pose une fois, le matin.
  if (Object.hasOwn(valeurs, 'file.mode')) {
    const actuel = await lireTous();
    const demande = String(valeurs['file.mode']).toUpperCase();
    if (demande !== actuel['file.mode']) {
      const enFile = await one(
        'SELECT COUNT(*)::int AS n FROM tickets WHERE jour = $1 AND statut = ANY($2)',
        [jourLocal(), ['WAITING', 'LATE', 'CALLED', 'IN_SERVICE']],
      );
      if ((enFile?.n ?? 0) > 0) {
        throw conflict('Impossible de changer l’organisation de la file : ' + enFile.n
          + ' client' + (enFile.n > 1 ? 's sont' : ' est') + ' encore dans la file du jour. '
          + 'Servez-les, ou clôturez la journée, puis changez le réglage.',
        );
      }
    }
  }

  const n = await enregistrer(valeurs, { parUtilisateurId: ctx.user.id });
  log.info('Reglages enregistres', { nombre: n, par: ctx.user.identifiant });
  const frais = await lireTous({ frais: true });
  ctx.ok({ enregistres: n, valeurs: frais, horaires: horairesLisibles(frais) });
}, { role: 'GERANT', rateLimit: PROFILES.administration });

/* ================================================================== */
/*  Comptes du personnel                                               */
/* ================================================================== */

export const comptesRoutes = new Router();

const versClient = (u) => ({
  id: u.id,
  identifiant: u.identifiant,
  nomComplet: u.nom_complet,
  role: u.role,
  roleLibelle: ROLES[u.role]?.libelle ?? u.role,
  actif: u.actif,
  doitChangerMotDePasse: u.doit_changer_mot_de_passe,
  verrouilleJusquA: u.verrouille_jusqu_a,
  derniereConnexion: u.derniere_connexion_at,
  creeA: u.created_at,
});

comptesRoutes.get('/', async (ctx) => {
  const lignes = await all(
    `SELECT id, identifiant, nom_complet, role, actif, doit_changer_mot_de_passe,
            verrouille_jusqu_a, derniere_connexion_at, created_at
       FROM utilisateurs ORDER BY role, identifiant_lower`,
  );
  ctx.ok({ items: lignes.map(versClient), roles: CODES_ROLES.map((c) => ({ code: c, ...ROLES[c] })) });
}, { role: 'GERANT' });

comptesRoutes.post('/', async (ctx) => {
  const data = validate(ctx.body, {
    identifiant: {
      type: 'string', required: true, min: 3, max: 40, lower: true,
      pattern: /^[a-z0-9._-]+$/,
      patternMessage: 'Lettres sans accent, chiffres, point, tiret et souligné uniquement.',
    },
    nomComplet: { type: 'string', required: true, max: 80 },
    role: { type: 'enum', required: true, values: CODES_ROLES, upper: true },
    motDePasse: { type: 'string', required: true, max: 200, trim: false },
  });
  if (data.motDePasse.length < config.security.passwordMinLength) {
    throw badRequest('Le mot de passe doit comporter au moins ' + config.security.passwordMinLength + ' caractères.',
      { fields: { motDePasse: 'Au moins ' + config.security.passwordMinLength + ' caractères.' } });
  }

  const existe = await one('SELECT id FROM utilisateurs WHERE identifiant_lower = $1', [data.identifiant]);
  if (existe) throw conflict('Un compte porte déjà cet identifiant.');

  const id = newId();
  await execute(
    `INSERT INTO utilisateurs (id, identifiant, identifiant_lower, nom_complet, mot_de_passe_hash, role, doit_changer_mot_de_passe)
     VALUES ($1,$2,$2,$3,$4,$5,TRUE)`,
    [id, data.identifiant, data.nomComplet, await hashPassword(data.motDePasse), data.role],
  );
  log.info('Compte cree', { identifiant: data.identifiant, role: data.role, par: ctx.user.identifiant });
  const ligne = await one('SELECT * FROM utilisateurs WHERE id = $1', [id]);
  ctx.created(versClient(ligne));
}, { role: 'GERANT', rateLimit: PROFILES.administration });

comptesRoutes.patch('/:id', async (ctx) => {
  const id = idDe(ctx);
  const data = validatePartial(ctx.body, {
    nomComplet: { type: 'string', max: 80 },
    role: { type: 'enum', values: CODES_ROLES, upper: true },
    actif: { type: 'bool' },
  });
  if (!Object.keys(data).length) throw badRequest('Aucune modification transmise.');

  const ligne = exigerTrouve(await one('SELECT * FROM utilisateurs WHERE id = $1', [id]), 'Compte introuvable.');

  // Un gerant ne peut ni se retirer son propre role ni se desactiver : le salon
  // se retrouverait sans personne pour changer les reglages.
  if (ligne.id === ctx.user.id && (data.actif === false || (data.role && data.role !== 'GERANT'))) {
    throw forbidden('Vous ne pouvez pas retirer vos propres droits. Demandez à un autre gérant de le faire.');
  }
  if (ligne.role === 'GERANT' && ((data.role && data.role !== 'GERANT') || data.actif === false)) {
    const autres = await one(
      'SELECT COUNT(*)::int AS n FROM utilisateurs WHERE role = $1 AND actif AND id <> $2',
      ['GERANT', ligne.id],
    );
    if (!autres || autres.n === 0) throw conflict('Ce compte est le dernier gérant actif : le salon doit en garder un.');
  }

  const champs = [];
  const params = [id];
  for (const [colonne, valeur] of [['nom_complet', data.nomComplet], ['role', data.role], ['actif', data.actif]]) {
    if (valeur === undefined) continue;
    params.push(valeur);
    champs.push(colonne + ' = $' + params.length);
  }
  await execute('UPDATE utilisateurs SET ' + champs.join(', ') + ' WHERE id = $1', params);
  if (data.actif === false || (data.role && data.role !== ligne.role)) {
    await revokeAllUserSessions(id, data.actif === false ? 'compte désactivé' : 'rôle modifié');
  }
  log.info('Compte modifie', { identifiant: ligne.identifiant, par: ctx.user.identifiant, champs: Object.keys(data) });
  ctx.ok(versClient(await one('SELECT * FROM utilisateurs WHERE id = $1', [id])));
}, { role: 'GERANT', rateLimit: PROFILES.administration });

/** Reinitialisation du mot de passe d'un collegue : il devra le changer. */
comptesRoutes.post('/:id/mot-de-passe', async (ctx) => {
  const id = idDe(ctx);
  const data = validate(ctx.body, { motDePasse: { type: 'string', required: true, max: 200, trim: false } });
  if (data.motDePasse.length < config.security.passwordMinLength) {
    throw badRequest('Le mot de passe doit comporter au moins ' + config.security.passwordMinLength + ' caractères.',
      { fields: { motDePasse: 'Au moins ' + config.security.passwordMinLength + ' caractères.' } });
  }
  const ligne = exigerTrouve(await one('SELECT identifiant FROM utilisateurs WHERE id = $1', [id]), 'Compte introuvable.');
  await execute(
    `UPDATE utilisateurs SET mot_de_passe_hash = $2, doit_changer_mot_de_passe = TRUE,
            tentatives_echouees = 0, verrouille_jusqu_a = NULL WHERE id = $1`,
    [id, await hashPassword(data.motDePasse)],
  );
  await revokeAllUserSessions(id, 'mot de passe réinitialisé');
  log.info('Mot de passe reinitialise', { identifiant: ligne.identifiant, par: ctx.user.identifiant });
  ctx.ok({ ok: true });
}, { role: 'GERANT', rateLimit: PROFILES.administration });

/** Deblocage apres plusieurs essais infructueux. */
comptesRoutes.post('/:id/debloquer', async (ctx) => {
  const id = idDe(ctx);
  exigerTrouve(await one('SELECT id FROM utilisateurs WHERE id = $1', [id]), 'Compte introuvable.');
  await execute('UPDATE utilisateurs SET tentatives_echouees = 0, verrouille_jusqu_a = NULL WHERE id = $1', [id]);
  ctx.ok({ ok: true });
}, { role: 'GERANT', rateLimit: PROFILES.administration });

/* ================================================================== */
/*  Fauteuils                                                          */
/* ================================================================== */

export const postesRoutes = new Router();

/**
 * La liste est lisible par TOUT le personnel : l'ecran de la file en a besoin
 * pour dessiner une carte par fauteuil. Seul le gerant peut la modifier.
 */
postesRoutes.get('/', async (ctx) => {
  const items = await listerPostes();
  const occupes = await all(
    `SELECT poste_id, numero_affiche, prenom FROM tickets
      WHERE jour = $1 AND statut IN ('CALLED','IN_SERVICE') AND poste_id IS NOT NULL`,
    [jourLocal()],
  );
  const parPoste = new Map(occupes.map((o) => [o.poste_id, o]));
  const servisAujourdhui = await all(
    `SELECT poste_id, COUNT(*)::int AS n FROM tickets
      WHERE jour = $1 AND statut = 'COMPLETED' AND poste_id IS NOT NULL GROUP BY poste_id`,
    [jourLocal()],
  );
  const parPosteServis = new Map(servisAujourdhui.map((s) => [s.poste_id, s.n]));

  ctx.ok({
    items: items.map((p) => ({
      ...posteVersClient(p),
      occupePar: parPoste.get(p.id) ? parPoste.get(p.id).prenom + ' (' + parPoste.get(p.id).numero_affiche + ')' : null,
      servisAujourdhui: parPosteServis.get(p.id) ?? 0,
    })),
    actifs: items.filter((p) => p.actif).length,
  });
});

postesRoutes.post('/', async (ctx) => {
  const data = validate(ctx.body, {
    nom: { type: 'string', required: true, min: 1, max: 40, requiredMessage: 'Donnez un nom au fauteuil.' },
    coiffeur: { type: 'string', max: 60 },
    ordre: { type: 'int', min: 0, max: 999 },
  });
  const cree = await creerPoste(data);
  log.info('Fauteuil cree', { nom: cree.nom, par: ctx.user.identifiant });
  ctx.created(posteVersClient(cree));
}, { role: 'GERANT', rateLimit: PROFILES.administration });

postesRoutes.patch('/:id', async (ctx) => {
  const data = validatePartial(ctx.body, {
    nom: { type: 'string', min: 1, max: 40 },
    coiffeur: { type: 'string', max: 60 },
    ordre: { type: 'int', min: 0, max: 999 },
    actif: { type: 'bool' },
  });
  // Un coiffeur efface se transmet comme une chaine vide : validate() la rend
  // en null, ce que modifier() comprend comme « retirer le nom ».
  if (Object.hasOwn(ctx.body ?? {}, 'coiffeur') && !data.coiffeur) data.coiffeur = '';
  const maj = await modifierPoste(idDe(ctx), data);
  log.info('Fauteuil modifie', { nom: maj.nom, champs: Object.keys(data), par: ctx.user.identifiant });
  ctx.ok(posteVersClient(maj));
}, { role: 'GERANT', rateLimit: PROFILES.administration });

postesRoutes.delete('/:id', async (ctx) => {
  const id = idDe(ctx);
  await supprimerPoste(id);
  log.info('Fauteuil supprime', { id, par: ctx.user.identifiant });
  ctx.noContent();
}, { role: 'GERANT', rateLimit: PROFILES.administration });

/* ================================================================== */
/*  Fiche de prix                                                      */
/* ================================================================== */

export const tarifasRoutes = new Router();

/**
 * Le prix voyage en CENTIMES et en toutes lettres.
 *
 * `precioCts` est la valeur de travail — un entier, sur lequel l'interface peut
 * recalculer sans jamais reinterpreter une virgule. `precio` est la meme chose
 * deja mise en forme pour l'affichage : c'est le serveur qui decide comment un
 * prix s'ecrit, pas chaque ecran.
 */
const tarifaVersClient = (t) => ({
  id: t.id,
  nombre: t.nombre,
  nota: t.nota || '',
  precioCts: t.precio_cts,
  precio: prixLegible(t.precio_cts),
  ordre: t.ordre,
  visible: t.visible,
});

/**
 * La fiche entiere, masquees comprises. Lisible par tout le personnel : le
 * coiffeur a besoin de dire un prix a quelqu'un qui le demande au comptoir.
 */
tarifasRoutes.get('/', async (ctx) => {
  const items = await listerTarifas();
  ctx.ok({
    items: items.map(tarifaVersClient),
    visibles: items.filter((t) => t.visible).length,
  });
});

tarifasRoutes.post('/', async (ctx) => {
  // « precio » reste une chaine : c'est le domaine qui sait lire « 14,90 », et
  // lui seul. Le faire ici en ferait deux endroits a garder d'accord.
  const data = validate(ctx.body, {
    nombre: { type: 'string', required: true, min: 1, max: 60, requiredMessage: 'Indique el nombre del servicio.' },
    precio: { type: 'string', required: true, max: 12, requiredMessage: 'Indique el precio.' },
    nota: { type: 'string', max: 80 },
  });
  const cree = await crearTarifa(data);
  log.info('Tarif cree', { nombre: cree.nombre, par: ctx.user.identifiant });
  ctx.created(tarifaVersClient(cree));
}, { role: 'GERANT', rateLimit: PROFILES.administration });

tarifasRoutes.patch('/:id', async (ctx) => {
  const data = validatePartial(ctx.body, {
    nombre: { type: 'string', min: 1, max: 60 },
    precio: { type: 'string', max: 12 },
    nota: { type: 'string', max: 80 },
    visible: { type: 'bool' },
  });
  // Une note effacee arrive en chaine vide, que validate() rend en null : le
  // domaine doit comprendre « retirer la note », pas « ne rien changer ».
  if (Object.hasOwn(ctx.body ?? {}, 'nota') && !data.nota) data.nota = '';
  const maj = await modificarTarifa(idDe(ctx), data);
  log.info('Tarif modifie', { nombre: maj.nombre, champs: Object.keys(data), par: ctx.user.identifiant });
  ctx.ok(tarifaVersClient(maj));
}, { role: 'GERANT', rateLimit: PROFILES.administration });

/** Monter ou descendre une ligne d'un cran. */
tarifasRoutes.post('/:id/mover', async (ctx) => {
  const sens = String(ctx.body?.sens || '');
  const bouge = await moverTarifa(idDe(ctx), sens);
  const items = await listerTarifas();
  ctx.ok({ bouge, items: items.map(tarifaVersClient) });
}, { role: 'GERANT', rateLimit: PROFILES.administration });

tarifasRoutes.delete('/:id', async (ctx) => {
  const id = idDe(ctx);
  await eliminarTarifa(id);
  log.info('Tarif supprime', { id, par: ctx.user.identifiant });
  ctx.noContent();
}, { role: 'GERANT', rateLimit: PROFILES.administration });

/* ================================================================== */
/*  Fermetures : conges, jours feries, fermeture exceptionnelle        */
/* ================================================================== */

export const fermeturesRoutes = new Router();

fermeturesRoutes.get('/', async (ctx) => {
  const [items, enCours, aVenir] = await Promise.all([lister(), fermetureDuJour(), prochaineFermeture()]);
  ctx.ok({
    items: items.map((f) => ({
      id: f.id,
      du: f.du,
      au: f.au,
      motif: f.motif,
      jours: joursEntre(f.du, f.au),
      enCours: enCours ? f.id === enCours.id : false,
      creeA: f.created_at,
      par: f.par,
    })),
    enCours: enCours ? { ...enCours, message: messageDeFermeture(enCours) } : null,
    prochaine: aVenir,
    aujourdhui: jourLocal(),
  });
}, { role: 'GERANT' });

fermeturesRoutes.post('/', async (ctx) => {
  const data = validate(ctx.body, {
    du: { type: 'date', required: true, requiredMessage: 'La date de début est obligatoire.' },
    au: { type: 'date', required: true, requiredMessage: 'La date de fin est obligatoire.' },
    motif: { type: 'string', max: 120 },
  });
  if (data.au < data.du) {
    throw badRequest('La date de fin doit être postérieure ou égale à la date de début.',
      { fields: { au: 'Après la date de début.' } });
  }
  // Une fermeture qui commence dans le passe ne sert a rien et embrouille
  // l'historique : on la refuse plutot que de la laisser passer en silence.
  const hier = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (data.du < hier) {
    throw badRequest('Une période de fermeture ne se déclare pas dans le passé.',
      { fields: { du: 'À partir d’aujourd’hui.' } });
  }

  const cree = await ajouter(data, { parUtilisateurId: ctx.user.id });
  log.info('Fermeture declaree', { du: cree.du, au: cree.au, par: ctx.user.identifiant });
  ctx.created({ ...cree, jours: joursEntre(cree.du, cree.au) });
}, { role: 'GERANT', rateLimit: PROFILES.administration });

fermeturesRoutes.delete('/:id', async (ctx) => {
  const id = idDe(ctx);
  await supprimer(id);
  log.info('Fermeture supprimee', { id, par: ctx.user.identifiant });
  ctx.noContent();
}, { role: 'GERANT', rateLimit: PROFILES.administration });

const joursEntre = (du, au) => Math.round((Date.parse(au + 'T00:00:00Z') - Date.parse(du + 'T00:00:00Z')) / 86400000) + 1;

/* ================================================================== */
/*  Statistiques                                                       */
/* ================================================================== */

export const statistiquesRoutes = new Router();

/** Le bilan d'une journee. Le coiffeur y a droit : c'est sa journee. */
statistiquesRoutes.get('/jour', async (ctx) => {
  const jour = ctx.queryDate('jour') || jourLocal();
  ctx.ok(await duJour(jour));
});

/** L'historique jour par jour. Reserve au gerant. */
statistiquesRoutes.get('/historique', async (ctx) => {
  const du = ctx.queryDate('du') || null;
  const au = ctx.queryDate('au') || null;
  if (du && au && du > au) throw badRequest('La date de début doit précéder la date de fin.');
  const limite = ctx.queryInt('limite', 60, { min: 1, max: 366 });
  ctx.ok({ items: await historique({ du, au, limite }) });
}, { role: 'GERANT' });

/* ================================================================== */
/*  Sante detaillee et taches                                          */
/* ================================================================== */

export const serviceRoutes = new Router();

serviceRoutes.get('/etat', async (ctx) => {
  const [base, whatsapp] = await Promise.all([etatBase(), etatBoite()]);
  ctx.ok({
    version: config.version,
    env: config.env,
    fuseau: config.timezone,
    jour: jourLocal(),
    base,
    whatsapp,
    tempsReel: { abonnes: nombreAbonnes() },
    taches: nomsDesTaches(),
  });
}, { role: 'GERANT' });

/**
 * Relance une tache de fond a la main. Utile le jour ou l'API WhatsApp a ete
 * coupee une heure : on vide la boite sans attendre le prochain passage.
 */
serviceRoutes.post('/taches/:nom', async (ctx) => {
  const nom = String(ctx.params.nom || '');
  if (!nomsDesTaches().includes(nom)) throw notFound('Tâche inconnue.');
  const bilan = await executerTache(nom);
  log.info('Tache relancee a la main', { tache: nom, par: ctx.user.identifiant });
  ctx.ok({ tache: nom, bilan: bilan ?? null });
}, { role: 'GERANT', rateLimit: PROFILES.administration });
