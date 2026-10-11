/**
 * LA MARQUE : ce que la palette et le nom fabriquent, et l'ecran de l'editeur.
 *
 * Publiques (aucune session) :
 *   GET /theme.css              les jetons de couleur, police et forme
 *   GET /favicon.svg            le monogramme aux couleurs de la marque
 *   GET /icones/:fichier        180.png, 192.png, 512.png, maskable.png
 *   GET /apercu.png             l'image d'un lien partage (1200 x 630)
 *   GET /site.webmanifest       l'application installable du client
 *   GET /gestion.webmanifest    celle du personnel
 *
 * Reservees a l'administrateur de la plateforme (SUPERADMIN) :
 *   GET    /api/marque          l'etat de la marque et ce qu'il faut pour l'editer
 *   POST   /api/marque/logo     poser (ou remplacer) le logo — corps = l'image
 *   DELETE /api/marque/logo     revenir au monogramme
 *
 * LES ADRESSES PUBLIQUES SONT VERSIONNEES par l'empreinte du theme
 * (« ?t=... ») : elles se mettent en cache un an, et changer une couleur change
 * l'adresse — donc personne ne garde l'ancienne. Une adresse sans empreinte (ou
 * avec une empreinte perimee) n'est jamais mise en cache longtemps.
 */
import { Router } from '../http/router.js';
import { badRequest, notFound } from '../core/errors.js';
import { PROFILES } from '../core/ratelimit.js';
import { log } from '../core/logger.js';
import { t, traduire } from '../core/langue.js';
import { lireTous, themeCourant, catalogueTraduit, CATALOGUE } from '../core/reglages.js';
import { PALETTES_DEF, TYPOGRAPHIES_DEF, STYLE_DE_L_ACTIVITE, themeDe } from '../core/theme.js';
import { pngDeMarque, faviconSvg } from '../core/images-marque.js';
import { applySecurityHeaders } from '../http/security.js';
import { logo as logoActuel, poserLogo, retirerLogo, urlPublique } from '../domain/photos.js';

export const marquePubliqueRoutes = new Router();
export const marqueRoutes = new Router();

const UN_AN = 'public, max-age=31536000, immutable';
const COURT = 'public, max-age=300';

/** Le cache selon que l'adresse porte la BONNE empreinte. */
function cacheDe(ctx, theme) {
  return ctx.query('t') === theme.empreinte ? UN_AN : COURT;
}

function envoyer(ctx, contenu, type, cache) {
  if (ctx.responded) return;
  ctx.responded = true;
  applySecurityHeaders(ctx.res, { kind: 'asset' });
  ctx.res.setHeader('Cache-Control', cache);
  // Les apercus de liens sont lus par des robots d'autres domaines (WhatsApp).
  ctx.res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  ctx.envoyerTexte(200, Buffer.isBuffer(contenu) ? contenu : Buffer.from(contenu, 'utf8'), { 'Content-Type': type });
}

marquePubliqueRoutes.get('/theme.css', async (ctx) => {
  await lireTous();
  const theme = themeCourant();
  envoyer(ctx, theme.css, 'text/css; charset=utf-8', cacheDe(ctx, theme));
}, { public: true });

marquePubliqueRoutes.get('/favicon.svg', async (ctx) => {
  await lireTous();
  const theme = themeCourant();
  envoyer(ctx, faviconSvg(theme, theme.monogramme), 'image/svg+xml', cacheDe(ctx, theme));
}, { public: true });

const FORMES = { '180.png': '180', '192.png': '192', '512.png': '512', 'maskable.png': 'maskable' };

marquePubliqueRoutes.get('/icones/:fichier', async (ctx) => {
  const forme = FORMES[String(ctx.params.fichier || '')];
  if (!forme) throw notFound(t('err.introuvable'));
  await lireTous();
  const theme = themeCourant();
  envoyer(ctx, pngDeMarque(theme, forme), 'image/png', cacheDe(ctx, theme));
}, { public: true });

marquePubliqueRoutes.get('/apercu.png', async (ctx) => {
  await lireTous();
  const theme = themeCourant();
  envoyer(ctx, pngDeMarque(theme, 'apercu'), 'image/png', cacheDe(ctx, theme));
}, { public: true });

/**
 * Le manifeste de l'application installable. Il porte le NOM et les COULEURS
 * de la marque : installee sur l'ecran d'accueil, l'application s'appelle
 * comme le salon, pas comme le logiciel.
 */
function manifeste(r, { gestion = false } = {}) {
  const tr = traduire(r['salon.idioma']);
  const theme = themeCourant();
  const nom = r['salon.nom'];
  const q = '?t=' + theme.empreinte;
  const icones = [
    { src: '/icones/192.png' + q, sizes: '192x192', type: 'image/png' },
    { src: '/icones/512.png' + q, sizes: '512x512', type: 'image/png' },
    { src: '/icones/maskable.png' + q, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    { src: '/favicon.svg' + q, sizes: 'any', type: 'image/svg+xml' },
  ];
  const commun = {
    lang: tr.htmlLang,
    dir: 'ltr',
    display: 'standalone',
    orientation: 'portrait',
    background_color: theme.couleurTheme,
    theme_color: theme.couleurTheme,
    icons: icones,
  };
  if (gestion) {
    return {
      ...commun,
      name: tr('manifeste.gestionNom', { nom }),
      short_name: tr('manifeste.gestionCourt'),
      description: tr('manifeste.gestionDescription', { nom }),
      start_url: '/gestion',
      scope: '/gestion',
    };
  }
  const raccourcis = [];
  if (r['rdv.actifs']) raccourcis.push({ name: tr('manifeste.raccourciRdv'), url: '/rendez-vous' });
  if (r['accueil.file']) raccourcis.push({ name: tr('manifeste.raccourciTour'), url: '/join' });
  return {
    ...commun,
    name: nom,
    short_name: nom.length > 12 ? (nom.split(/\s+/).pop() || nom).slice(0, 12) : nom,
    description: tr('accueil.description', { nom }),
    start_url: '/',
    scope: '/',
    shortcuts: raccourcis,
  };
}

marquePubliqueRoutes.get('/site.webmanifest', async (ctx) => {
  const r = await lireTous();
  envoyer(ctx, JSON.stringify(manifeste(r)), 'application/manifest+json; charset=utf-8', COURT);
}, { public: true });

marquePubliqueRoutes.get('/gestion.webmanifest', async (ctx) => {
  const r = await lireTous();
  envoyer(ctx, JSON.stringify(manifeste(r, { gestion: true })), 'application/manifest+json; charset=utf-8', COURT);
}, { public: true });

/* ------------------------------------------------------------------ */
/*  L'ecran de la marque (SUPERADMIN)                                  */
/* ------------------------------------------------------------------ */

const CLES_MARQUE = Object.keys(CATALOGUE).filter((c) => CATALOGUE[c].reserve === 'SUPERADMIN');

marqueRoutes.get('/', async (ctx) => {
  const r = await lireTous({ frais: true });
  const logo = await logoActuel();
  // Les palettes avec leurs couleurs : l'ecran montre un nuancier, pas une
  // liste de noms. Chacune passe par le meme calcul que le vrai theme — ce
  // qu'on voit dans le nuancier est exactement ce que la vitrine prendra.
  const palettes = Object.keys(PALETTES_DEF).map((cle) => {
    const v = themeDe({ ...r, 'marque.palette': cle }).variables;
    return { cle, fond: v['--fond'], surface: v['--surface'], texte: v['--texte'], accent: v['--accent'] };
  });
  ctx.ok({
    valeurs: Object.fromEntries(CLES_MARQUE.map((c) => [c, r[c]])),
    catalogue: catalogueTraduit(r['salon.idioma']).filter((e) => CLES_MARQUE.includes(e.cle)),
    palettes,
    typographies: Object.keys(TYPOGRAPHIES_DEF),
    styleDeLActivite: STYLE_DE_L_ACTIVITE,
    logo: logo ? { src: urlPublique(logo), largeur: logo.largeur, hauteur: logo.hauteur } : null,
    theme: { empreinte: themeCourant().empreinte, monogramme: themeCourant().monogramme },
  });
}, { role: 'SUPERADMIN' });

marqueRoutes.post('/logo', async (ctx) => {
  if (!ctx.image) throw badRequest(t('photos.aucuneImage'));
  const logo = await poserLogo(ctx.image.contenu);
  log.info('Logo de la marque remplace', { taille: logo.taille, par: ctx.user.identifiant });
  ctx.created({ src: urlPublique(logo), largeur: logo.largeur, hauteur: logo.hauteur });
}, { role: 'SUPERADMIN', image: true, rateLimit: PROFILES.administration });

marqueRoutes.delete('/logo', async (ctx) => {
  await retirerLogo();
  log.info('Logo de la marque retire', { par: ctx.user.identifiant });
  ctx.ok({ ok: true });
}, { role: 'SUPERADMIN', rateLimit: PROFILES.administration });
