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
import {
  catalogueTraduit, lireTous, enregistrer, horairesLisibles, adressePublique, coherenceIdentite,
} from '../core/reglages.js';
import { t } from '../core/langue.js';
import { role as roleParCode, roles, CODES_ROLES } from '../core/roles.js';
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
  eliminar as eliminarTarifa, mover as moverTarifa, reordenar as reordenarTarifas, prixLegible,
} from '../domain/tarifas.js';
import { etatBoite } from '../domain/notifications.js';
import { purgerHistorique, PRESERVE } from '../domain/purge.js';
import { sentryActif } from '../core/sentry.js';
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
    // Le catalogue arrive DEJA traduit : libelles, aides et intitules d'options.
    // Le rendre brut obligerait l'interface a porter un second dictionnaire, et
    // les deux auraient divergé.
    catalogue: catalogueTraduit(valeurs['salon.idioma']),
    horaires: horairesLisibles(valeurs, valeurs['salon.idioma']),
    adressePublique: adressePublique(valeurs, ctx.base),
    // Ce qui vient du fichier .env, et ce qui ne concorde pas avec le choix fait
    // a l'ecran. Le gerant voit les deux moities du reglage cote a cote.
    identite: coherenceIdentite(valeurs),
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
    throw badRequest(t('reglages.envoiValeurs'));
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
        throw conflict(t('reglages.modeFileOccupee', { n: enFile.n }));
      }
    }
  }

  const avant = await lireTous();
  const n = await enregistrer(valeurs, { parUtilisateurId: ctx.user.id });
  log.info('Reglages enregistres', { nombre: n, par: ctx.user.identifiant });
  const frais = await lireTous({ frais: true });

  /*
   * « rechargerTout » : L'INTERFACE DOIT SE RECHARGER, PAS SE RAFRAICHIR.
   *
   * Changer la langue ou la monnaie ne change pas une valeur, il change TOUS les
   * mots de l'application — y compris ceux de la barre de navigation, du titre
   * de la page et de l'attribut « lang » du document, qui sont rendus par le
   * serveur et qu'aucun re-rendu cote client ne touchera. Sans ce signal, le
   * gerant verrait le formulaire changer de langue et le reste de l'ecran rester
   * dans l'ancienne : il conclurait que l'enregistrement a echoue a moitie.
   */
  const rechargerTout = avant['salon.idioma'] !== frais['salon.idioma']
    || avant['salon.moneda'] !== frais['salon.moneda'];

  ctx.ok({
    enregistres: n,
    valeurs: frais,
    horaires: horairesLisibles(frais, frais['salon.idioma']),
    identite: coherenceIdentite(frais),
    rechargerTout,
  });
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
  roleLibelle: roleParCode(u.role)?.libelle ?? u.role,
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
  ctx.ok({ items: lignes.map(versClient), roles: roles() });
}, { role: 'GERANT' });

comptesRoutes.post('/', async (ctx) => {
  const data = validate(ctx.body, {
    identifiant: {
      type: 'string', required: true, min: 3, max: 40, lower: true,
      pattern: /^[a-z0-9._-]+$/,
      patternMessage: t('compte.identifiantForme'),
    },
    nomComplet: { type: 'string', required: true, max: 80 },
    role: { type: 'enum', required: true, values: CODES_ROLES, upper: true },
    motDePasse: { type: 'string', required: true, max: 200, trim: false },
  });
  if (data.motDePasse.length < config.security.passwordMinLength) {
    throw badRequest(t('compte.motDePasseCourt', { min: config.security.passwordMinLength }),
      { fields: { motDePasse: t('compte.minCaracteres', { min: config.security.passwordMinLength }) } });
  }

  const existe = await one('SELECT id FROM utilisateurs WHERE identifiant_lower = $1', [data.identifiant]);
  if (existe) throw conflict(t('compte.identifiantPris'));

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
  if (!Object.keys(data).length) throw badRequest(t('commun.aucuneModification'));

  const ligne = exigerTrouve(await one('SELECT * FROM utilisateurs WHERE id = $1', [id]), t('compte.introuvable'));

  // Un gerant ne peut ni se retirer son propre role ni se desactiver : le salon
  // se retrouverait sans personne pour changer les reglages.
  if (ligne.id === ctx.user.id && (data.actif === false || (data.role && data.role !== 'GERANT'))) {
    throw forbidden(t('compte.pasSoiMeme'));
  }
  if (ligne.role === 'GERANT' && ((data.role && data.role !== 'GERANT') || data.actif === false)) {
    const autres = await one(
      'SELECT COUNT(*)::int AS n FROM utilisateurs WHERE role = $1 AND actif AND id <> $2',
      ['GERANT', ligne.id],
    );
    if (!autres || autres.n === 0) throw conflict(t('compte.dernierGerant'));
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
    await revokeAllUserSessions(id, t(data.actif === false ? 'trace.compteDesactive' : 'trace.roleModifie'));
  }
  log.info('Compte modifie', { identifiant: ligne.identifiant, par: ctx.user.identifiant, champs: Object.keys(data) });
  ctx.ok(versClient(await one('SELECT * FROM utilisateurs WHERE id = $1', [id])));
}, { role: 'GERANT', rateLimit: PROFILES.administration });

/** Reinitialisation du mot de passe d'un collegue : il devra le changer. */
comptesRoutes.post('/:id/mot-de-passe', async (ctx) => {
  const id = idDe(ctx);
  const data = validate(ctx.body, { motDePasse: { type: 'string', required: true, max: 200, trim: false } });
  if (data.motDePasse.length < config.security.passwordMinLength) {
    throw badRequest(t('compte.motDePasseCourt', { min: config.security.passwordMinLength }),
      { fields: { motDePasse: t('compte.minCaracteres', { min: config.security.passwordMinLength }) } });
  }
  const ligne = exigerTrouve(await one('SELECT identifiant FROM utilisateurs WHERE id = $1', [id]), t('compte.introuvable'));
  await execute(
    `UPDATE utilisateurs SET mot_de_passe_hash = $2, doit_changer_mot_de_passe = TRUE,
            tentatives_echouees = 0, verrouille_jusqu_a = NULL WHERE id = $1`,
    [id, await hashPassword(data.motDePasse)],
  );
  await revokeAllUserSessions(id, t('trace.motDePasseReinitialise'));
  log.info('Mot de passe reinitialise', { identifiant: ligne.identifiant, par: ctx.user.identifiant });
  ctx.ok({ ok: true });
}, { role: 'GERANT', rateLimit: PROFILES.administration });

/** Deblocage apres plusieurs essais infructueux. */
comptesRoutes.post('/:id/debloquer', async (ctx) => {
  const id = idDe(ctx);
  exigerTrouve(await one('SELECT id FROM utilisateurs WHERE id = $1', [id]), t('compte.introuvable'));
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
  icono: t.icono || null,
  precioCts: t.precio_cts,
  precio: prixLegible(t.precio_cts),
  duracionMin: t.duracion_min,
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
    nombre: { type: 'string', required: true, min: 1, max: 60, requiredMessage: () => t('admin.tarifNomRequis') },
    precio: { type: 'string', required: true, max: 12, requiredMessage: () => t('admin.tarifPrixRequis') },
    nota: { type: 'string', max: 80 },
    icono: { type: 'string', max: 20 },
    // La duree reste une chaine ici aussi : le domaine la valide, et il est le
    // seul a savoir ce qu'est une duree plausible pour un fauteuil.
    duracion: { type: 'string', max: 4 },
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
    icono: { type: 'string', max: 20 },
    duracion: { type: 'string', max: 4 },
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

/**
 * Reordonner la fiche entiere : le glisser-deposer envoie l'ordre complet.
 *
 * Douze lignes reordonnees feraient sinon douze requetes, dont une peut echouer
 * au milieu et laisser la fiche dans un ordre que personne n'a voulu.
 *
 * Pas de conflit de route ici : « /orden » n'a qu'un segment, la ou
 * « /:id/mover » en a deux — mais le routeur prend la PREMIERE route qui
 * correspond, sans preferer un segment fixe. Toute future route a un seul
 * segment devra donc etre declaree avant un eventuel « POST /:id ».
 */
tarifasRoutes.post('/orden', async (ctx) => {
  const brut = ctx.body?.ids;
  if (!Array.isArray(brut)) throw badRequest(t('admin.ordreComplet'));
  if (brut.length > 500) throw badRequest('Lista demasiado larga.');
  const ids = brut.map((v) => String(v));

  const n = await reordenarTarifas(ids);
  log.info('Fiche de prix reordonnee', { lignes: n, par: ctx.user.identifiant });
  const items = await listerTarifas();
  ctx.ok({ items: items.map(tarifaVersClient) });
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
    du: { type: 'date', required: true, requiredMessage: () => t('admin.dateDebutRequise') },
    au: { type: 'date', required: true, requiredMessage: () => t('admin.dateFinRequise') },
    motif: { type: 'string', max: 120 },
  });
  if (data.au < data.du) {
    throw badRequest(t('admin.finApresDebut'), { fields: { au: t('admin.posterieurDebut') } });
  }
  // Une fermeture qui commence dans le passe ne sert a rien et embrouille
  // l'historique : on la refuse plutot que de la laisser passer en silence.
  const hier = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (data.du < hier) {
    throw badRequest(t('admin.congesPasse'), { fields: { du: t('admin.aPartirDAujourdhui') } });
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
  if (du && au && du > au) throw badRequest(t('admin.debutAvantFin'));
  const limite = ctx.queryInt('limite', 60, { min: 1, max: 366 });
  ctx.ok({ items: await historique({ du, au, limite }) });
}, { role: 'GERANT' });

/**
 * Le meme historique, en CSV, pour le comptable ou un tableur.
 *
 * DEUX PRECAUTIONS sur un CSV qu'un tableur va ouvrir :
 *
 *   - la virgule decimale et le point-virgule. Un Excel en espagnol lit
 *     « 12,5 » comme un nombre et « 12.5 » comme du texte, et il attend des
 *     point-virgules entre les colonnes. On ecrit donc les deux a l'espagnole,
 *     sinon le comptable recoit une colonne unique remplie de texte.
 *   - le BOM UTF-8. Sans lui, Excel lit « Atendidos » correctement mais
 *     « Duración » en mojibake. Trois octets evitent le probleme.
 *
 * Aucune donnee personnelle : ce sont des totaux par journee, jamais un nom
 * ni un numero.
 */
statistiquesRoutes.get('/historique.csv', async (ctx) => {
  const du = ctx.queryDate('du') || null;
  const au = ctx.queryDate('au') || null;
  if (du && au && du > au) throw badRequest(t('admin.debutAvantFin'));
  const lignes = await historique({ du, au, limite: ctx.queryInt('limite', 366, { min: 1, max: 366 }) });

  const nombre = (v) => (v === null || v === undefined ? '' : String(v).replace('.', ','));
  const colonnes = [
    t('admin.colDate'), t('admin.colTotal'), t('admin.colServis'), t('admin.colAnnules'), t('admin.colAbsence'),
    t('admin.colEnLigne'), t('admin.colQr'), t('admin.colComptoir'),
    t('admin.colAttenteMoyenne'), t('admin.colDureeMoyenne'),
  ];

  const corps = lignes.map((l) => [
    l.jour, l.total, l.servis, l.annules, l.clientsEnRetard,
    l.enLigne, l.parQr, l.auComptoir,
    nombre(l.attenteMoyenneMinutes), nombre(l.serviceMoyenMinutes),
  ].join(';'));

  const csv = '﻿' + [colonnes.join(';'), ...corps].join('\r\n') + '\r\n';
  const nom = 'haron-' + (du || t('admin.csvNomFichier')) + '_' + (au || jourLocal()) + '.csv';

  log.info('Export CSV des chiffres', { lignes: lignes.length, par: ctx.user.identifiant });
  ctx.file(Buffer.from(csv, 'utf8'), { filename: nom, mimeType: 'text/csv; charset=utf-8', download: true });
}, { role: 'GERANT', rateLimit: PROFILES.administration });

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
    // On dit seulement SI la remontee d'erreurs est branchee. Le DSN est une
    // cle : il ne sort jamais, pas meme vers l'ecran du gerant.
    sentry: sentryActif,
    taches: nomsDesTaches(),
  });
}, { role: 'GERANT' });

/**
 * EFFACER L'HISTORIQUE.
 *
 * Le geste le plus destructeur de l'application, et il n'a pas de corbeille.
 * Trois barrieres, et chacune arrete un accident different :
 *
 *   le role de GERANT       un coiffeur ne peut pas le declencher ;
 *   une phrase a recopier   on ne tape pas « BORRAR » par inadvertance, la ou
 *                           on clique « oui » sans lire ;
 *   la file doit etre vide  verifie dans la transaction, pas ici.
 *
 * La phrase est comparee TELLE QUELLE, sans tolerance de casse ni d'espaces :
 * la recopier est justement le temps d'arret qu'on cherche a provoquer.
 */
serviceRoutes.post('/purger', async (ctx) => {
  const data = validate(ctx.body, {
    confirmation: { type: 'string', required: true, max: 20, trim: false },
  });
  // Le mot a recopier suit la langue du salon : demander « BORRAR » a un gerant
  // francophone lui ferait chercher ce qu'il doit taper, et la friction voulue
  // deviendrait une devinette. C'est la MEME cle que l'interface affiche.
  if (data.confirmation !== t('admin.purgeMot')) {
    throw badRequest(t('admin.purgeMotMajuscules'), {
      fields: { confirmation: t('admin.purgeMotExact') },
    });
  }

  const bilan = await purgerHistorique({ user: ctx.user });
  const total = Object.values(bilan).reduce((n, v) => n + v, 0);
  log.warn('Purge demandee', { par: ctx.user.identifiant, total });
  ctx.ok({ bilan, total, preserve: PRESERVE });
}, { role: 'GERANT', rateLimit: PROFILES.administration });

/**
 * Relance une tache de fond a la main. Utile le jour ou l'API WhatsApp a ete
 * coupee une heure : on vide la boite sans attendre le prochain passage.
 */
serviceRoutes.post('/taches/:nom', async (ctx) => {
  const nom = String(ctx.params.nom || '');
  if (!nomsDesTaches().includes(nom)) throw notFound(t('admin.tacheInconnue'));
  const bilan = await executerTache(nom);
  log.info('Tache relancee a la main', { tache: nom, par: ctx.user.identifiant });
  ctx.ok({ tache: nom, bilan: bilan ?? null });
}, { role: 'GERANT', rateLimit: PROFILES.administration });
