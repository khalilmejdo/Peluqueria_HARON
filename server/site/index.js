/**
 * Les pages du client, rendues par le serveur.
 *
 *   /                  accueil : l'affluence, et un seul bouton
 *   /join              prendre son tour (formulaire)      GET et POST
 *   /ticket/<jeton>    suivi de SON tour, en temps reel
 *   /affiche           l'affiche a imprimer pour la vitrine
 *   /qr.svg  /qr.png   le QR Code seul, a telecharger
 *
 * Le formulaire fonctionne SANS JavaScript : il se poste, le serveur repond, et
 * le client arrive sur sa page de suivi. Le JavaScript n'ajoute ensuite que le
 * confort (validation immediate, mise a jour en direct). C'est la seule facon
 * d'etre sur qu'un tour se prend meme depuis un vieux telephone, dans un salon
 * ou le reseau passe mal.
 */
import { Router } from '../http/router.js';
import { escapeHtml } from '../core/text.js';
import { ValidationError, AppError } from '../core/errors.js';
import { validate, rules } from '../core/validate.js';
import { consommerPriseDeTour, consume, PROFILES } from '../core/ratelimit.js';
import { lireTous, adressePublique, horairesLisibles } from '../core/reglages.js';
import { jetonPlausible } from '../core/crypto.js';
import { jourLocal, attenteLisible, dateLongueFr } from '../core/temps.js';
import { encoder, versSvg, versMatrice } from '../core/qrcode.js';
import { pngNoirEtBlanc } from '../core/png.js';
import { prendreTour, ticketParJeton, chargerEtat, pourClient, etatPriseDeTour } from '../domain/file.js';
import { page, marque, entete, piedDePage, pageErreur } from './mise-en-page.js';

export const siteRoutes = new Router();

/* ------------------------------------------------------------------ */
/*  Accueil                                                            */
/* ------------------------------------------------------------------ */

siteRoutes.get('/', async (ctx) => {
  const reglages = await lireTous();
  const [etat, prise] = await Promise.all([chargerEtat(jourLocal()), etatPriseDeTour()]);
  const devant = etat.compteurs.enAttente + etat.compteurs.enCours;
  const attente = devant * etat.dureeMoyenneMinutes;

  const affluence = etat.compteurs.enAttente === 0
    ? '<p class="affluence__forte">Aucune attente</p><p class="affluence__detail">Le fauteuil vous attend.</p>'
    : '<p class="affluence__forte">' + etat.compteurs.enAttente + ' personne' + (etat.compteurs.enAttente > 1 ? 's' : '') + ' dans la file</p>'
      + '<p class="affluence__detail">Attente estimée : ' + escapeHtml(attenteLisible(attente).replace(/^environ /, '≈ ')) + '</p>';

  // Congés, arrêt des tours, hors horaires : on le dit AVANT le bouton, et on
  // retire le bouton. Un client qui appuie pour se voir refuser à l'écran
  // suivant repart plus agacé que s'il avait su tout de suite.
  const appel = prise.ouverte
    ? '<div class="affluence" data-affluence>' + affluence + '</div>'
      + '<a class="bouton bouton--principal bouton--geant" href="/join">Prendre mon tour</a>'
      + '<p class="hero__note">Pas de compte, pas d’application à installer. Vous recevez un lien de suivi sur WhatsApp.</p>'
    : '<div class="avis-ferme" data-ferme>'
      + '<p class="avis-ferme__titre">' + escapeHtml(prise.code === 'SALON_EN_CONGES' ? 'Salon fermé' : 'Prise de tour arrêtée') + '</p>'
      + '<p class="avis-ferme__texte">' + escapeHtml(prise.message) + '</p>'
      + '</div>'
      + (reglages['salon.telephone']
        ? '<a class="bouton bouton--discret" href="tel:' + escapeHtml(reglages['salon.telephone'].replace(/[^+0-9]/g, '')) + '">Appeler le salon</a>'
        : '');

  const annonce = prise.ouverte && prise.prochaineFermeture
    ? '<section class="enveloppe bandeau-annonce">'
      + '<p class="bandeau-annonce__texte">Fermeture à venir : du ' + escapeHtml(dateLongueFr(prise.prochaineFermeture.du))
      + ' au ' + escapeHtml(dateLongueFr(prise.prochaineFermeture.au))
      + (prise.prochaineFermeture.motif ? ' — ' + escapeHtml(prise.prochaineFermeture.motif) : '') + '.</p>'
      + '</section>'
    : '';

  const corps = '<main id="principal">'
    + '<section class="hero">'
    + '<div class="hero__raies" aria-hidden="true"></div>'
    + '<div class="enveloppe hero__contenu">'
    + marque({ taille: 'grand', lien: false })
    + '<h1 class="hero__accroche">' + escapeHtml(reglages['salon.accroche']) + '</h1>'
    + appel
    + '</div>'
    + '</section>'
    + annonce
    + '<section class="enveloppe bandeau-qr">'
    + '<p class="bandeau-qr__titre">Déjà au salon ?</p>'
    + '<p class="bandeau-qr__texte">Scannez le QR Code affiché en vitrine et rejoignez la même file.</p>'
    + '</section>'
    + '</main>';

  ctx.html(200, page({
    titre: reglages['salon.nom'] + ' — Prenez votre tour, sans attendre',
    description: 'Prenez votre tour chez ' + reglages['salon.nom'] + ' depuis votre téléphone, suivez votre position en direct et venez au bon moment. Sans compte et sans application.',
    corps,
    base: ctx.base,
    chemin: '/',
    classe: 'theme-sombre',
    scripts: ['/js/accueil.js'],
    pied: piedDePage({
      horaires: reglages['horaires.actifs'] ? horairesLisibles(reglages) : null,
      adresse: reglages['salon.adresse'] || null,
      telephone: reglages['salon.telephone'] || null,
    }),
  }), { noStore: false, entetes: { 'Cache-Control': 'no-cache' } });
}, { public: true });

/* ------------------------------------------------------------------ */
/*  Prendre son tour                                                   */
/* ------------------------------------------------------------------ */

/**
 * Les trois champs, et rien de plus.
 *
 * Le champ WhatsApp n'accepte QUE ce qui compose un numero : chiffres, « + » et
 * separateurs usuels. Le clavier du telephone s'ouvre directement en mode
 * numerique (type=tel + inputmode=tel), le motif ferme la porte aux lettres, et
 * /js/join.js retire au fil de la frappe tout ce qui passerait malgre tout.
 * Le serveur revalide de toute facon : c'est lui qui fait foi.
 */
const MOTIF_TELEPHONE = '[0-9+()./ -]{8,25}';

const CHAMPS = [
  { nom: 'prenom', libelle: 'Prénom', autocomplete: 'given-name', type: 'text', inputmode: 'text', max: 40, exemple: 'Ahmed' },
  { nom: 'nom', libelle: 'Nom', autocomplete: 'family-name', type: 'text', inputmode: 'text', max: 40, exemple: 'Benali' },
  {
    nom: 'telephone',
    libelle: 'Numéro WhatsApp',
    autocomplete: 'tel',
    type: 'tel',
    inputmode: 'tel',
    max: 25,
    exemple: '612 345 678',
    motif: MOTIF_TELEPHONE,
    aide: 'Chiffres uniquement. Numéro espagnol par défaut : inutile d’écrire +34. Depuis l’étranger, commencez par « + ».',
  },
];

function formulaire({ valeurs = {}, erreurs = {}, source = 'ONLINE', messageGlobal = null }) {
  const champs = CHAMPS.map((c) => {
    const erreur = erreurs[c.nom];
    const id = 'champ-' + c.nom;
    return '<div class="champ' + (erreur ? ' champ--erreur' : '') + '">'
      + '<label for="' + id + '">' + escapeHtml(c.libelle) + '</label>'
      + '<input id="' + id + '" name="' + c.nom + '" type="' + c.type + '" inputmode="' + c.inputmode + '" '
      + 'autocomplete="' + c.autocomplete + '" required maxlength="' + c.max + '" '
      + 'placeholder="' + escapeHtml(c.exemple) + '" '
      + (c.motif ? 'pattern="' + escapeHtml(c.motif) + '" ' : '')
      + 'value="' + escapeHtml(valeurs[c.nom] ?? '') + '" '
      + (erreur ? 'aria-invalid="true" aria-describedby="' + id + '-erreur" ' : (c.aide ? 'aria-describedby="' + id + '-aide" ' : ''))
      + '>'
      + (erreur
        ? '<p class="champ__erreur" id="' + id + '-erreur">' + escapeHtml(erreur) + '</p>'
        : (c.aide ? '<p class="champ__aide" id="' + id + '-aide">' + escapeHtml(c.aide) + '</p>' : ''))
      + '</div>';
  }).join('');

  return '<form class="formulaire" method="post" action="/join" novalidate data-formulaire-tour>'
    + '<input type="hidden" name="source" value="' + escapeHtml(source) + '">'
    + (messageGlobal ? '<p class="alerte alerte--refus" role="alert">' + escapeHtml(messageGlobal) + '</p>' : '')
    + champs
    + '<button class="bouton bouton--principal bouton--geant" type="submit">Prendre mon tour</button>'
    + '<p class="formulaire__note">Votre numéro ne sert qu’à vous prévenir. Il n’est jamais affiché publiquement.</p>'
    + '</form>';
}

function pageJoin(ctx, reglages, options) {
  const { prise = null } = options;
  // Salon fermé : pas de formulaire du tout. Rien n'est plus agaçant qu'un
  // formulaire qu'on remplit pour se voir refuser à la validation.
  const contenu = prise && !prise.ouverte
    ? '<section class="carte carte--centree">'
      + '<p class="pastille pastille--neutre">' + escapeHtml(prise.code === 'SALON_EN_CONGES' ? 'Congés' : 'Fermé') + '</p>'
      + '<h1 class="titre-page">' + escapeHtml(prise.code === 'SALON_EN_CONGES' ? 'Le salon est fermé' : 'Prise de tour arrêtée') + '</h1>'
      + '<p class="texte-doux">' + escapeHtml(prise.message) + '</p>'
      + (reglages['salon.telephone']
        ? '<a class="bouton bouton--discret" href="tel:' + escapeHtml(reglages['salon.telephone'].replace(/[^+0-9]/g, '')) + '">Appeler le salon</a>'
        : '')
      + '<a class="bouton bouton--principal" href="/">Revenir à l’accueil</a>'
      + '</section>'
    : '<h1 class="titre-page">Prendre mon tour</h1>'
      + '<p class="texte-doux">Trois informations, moins d’une minute, et vous suivez votre position en direct.</p>'
      + '<section class="carte">' + formulaire(options) + '</section>';

  const corps = entete({ retour: { href: '/', texte: 'Accueil' } })
    + '<main class="enveloppe page-etroite" id="principal">'
    + contenu
    + '</main>';
  return page({
    titre: 'Prendre mon tour — ' + reglages['salon.nom'],
    description: 'Rejoignez la file de ' + reglages['salon.nom'] + ' en moins d’une minute.',
    corps,
    base: ctx.base,
    chemin: '/join',
    classe: 'theme-sombre',
    scripts: ['/js/join.js'],
    pied: piedDePage({ adresse: reglages['salon.adresse'] || null }),
  });
}

siteRoutes.get('/join', async (ctx) => {
  const reglages = await lireTous();
  const prise = await etatPriseDeTour();
  // « ?qr=1 » : c'est le QR Code de la vitrine qui amene ici. La file est la
  // meme, seule l'origine enregistree change.
  const source = ctx.queryBool('qr') ? 'QR' : 'ONLINE';
  ctx.html(prise.ouverte ? 200 : 409, pageJoin(ctx, reglages, { source, prise }));
}, { public: true });

/**
 * Le formulaire se poste ici. Aucune API, aucun JavaScript necessaire : le
 * serveur cree le ticket et renvoie le client sur sa page de suivi.
 */
siteRoutes.post('/join', async (ctx) => {
  const reglages = await lireTous();
  const brut = {
    prenom: String(ctx.body.prenom ?? ''),
    nom: String(ctx.body.nom ?? ''),
    telephone: String(ctx.body.telephone ?? ''),
  };
  const source = String(ctx.body.source ?? 'ONLINE').toUpperCase() === 'QR' ? 'QR' : 'ONLINE';

  let data;
  try {
    data = validate({ ...brut, source }, {
      prenom: rules.prenom,
      nom: rules.nomFamille,
      telephone: rules.whatsapp,
      source: { type: 'enum', values: ['ONLINE', 'QR'], upper: true, default: 'ONLINE' },
    });
  } catch (err) {
    if (!(err instanceof ValidationError)) throw err;
    ctx.html(422, pageJoin(ctx, reglages, { valeurs: brut, erreurs: err.fields, source }));
    return;
  }

  const debit = consommerPriseDeTour(
    { ip: ctx.ip, telephone: data.telephone },
    { telephoneSalon: reglages['salon.telephone'] || null },
  );
  if (!debit.allowed) {
    ctx.res.setHeader('Retry-After', String(debit.retryAfterSeconds));
    ctx.html(429, pageJoin(ctx, reglages, { valeurs: brut, source, messageGlobal: debit.message }));
    return;
  }

  let resultat;
  try {
    resultat = await prendreTour(data);
  } catch (err) {
    if (err instanceof AppError && err.status === 409) {
      ctx.html(409, pageJoin(ctx, reglages, { valeurs: brut, source, messageGlobal: err.message }));
      return;
    }
    throw err;
  }

  // 303 : le navigateur refait un GET, donc un rafraichissement de la page de
  // suivi ne reposte jamais le formulaire et ne cree jamais un second ticket.
  ctx.redirect('/ticket/' + resultat.jeton, 303);
}, { public: true });

/* ------------------------------------------------------------------ */
/*  Suivi d'un tour                                                    */
/* ------------------------------------------------------------------ */

const TONS = { tour: 'tour', proche: 'proche', attente: 'attente', fini: 'fini' };

function blocTicket(vue) {
  const ton = TONS[vue.ton] || 'attente';
  return '<section class="ticket ticket--' + ton + '" data-ticket>'
    + '<p class="ticket__label">Votre tour</p>'
    + '<p class="ticket__prenom" data-prenom>' + escapeHtml(vue.prenom) + '</p>'
    + '<p class="ticket__numero" data-numero>' + escapeHtml(vue.numero) + '</p>'
    + '<div class="ticket__etat" data-etat>'
    + '<p class="ticket__titre" data-titre>' + escapeHtml(vue.titre) + '</p>'
    + '<p class="ticket__detail" data-detail>' + escapeHtml(vue.detail) + '</p>'
    + '</div>'
    + '<dl class="ticket__chiffres">'
    + '<div><dt>Personnes devant vous</dt><dd data-devant>' + vue.devant + '</dd></div>'
    + '<div><dt>Estimation</dt><dd data-estimation>' + escapeHtml(vue.estimationCourte) + '</dd></div>'
    + '</dl>'
    + (vue.retards > 0
      ? '<p class="ticket__note">Vous avez été replacé en fin de file après une absence. Restez à proximité cette fois-ci.</p>'
      : '')
    + '</section>';
}

siteRoutes.get('/ticket/:jeton', async (ctx) => {
  const reglages = await lireTous();
  const jeton = String(ctx.params.jeton || '');

  const limite = consume('suivi:' + ctx.ip, PROFILES.suivi);
  if (!limite.allowed) {
    ctx.res.setHeader('Retry-After', String(limite.retryAfterSeconds));
    ctx.html(429, pageErreur({
      base: ctx.base, statut: 429,
      titre: 'Trop de demandes',
      message: 'Patientez quelques instants avant de recharger cette page.',
    }));
    return;
  }

  const ticket = jetonPlausible(jeton) ? await ticketParJeton(jeton) : null;
  if (!ticket) {
    ctx.html(404, pageErreur({
      base: ctx.base, statut: 404,
      titre: 'Lien de suivi introuvable',
      message: 'Ce lien n’est plus valable. Si votre tour est toujours en cours, retrouvez le lien reçu sur WhatsApp, ou demandez-le au salon.',
    }));
    return;
  }

  const etat = await chargerEtat(ticket.jour);
  const vue = pourClient(etat, ticket.id);
  const dateDuJour = ticket.jour === jourLocal() ? null : dateLongueFr(ticket.jour);

  const corps = entete()
    + '<main class="enveloppe page-etroite" id="principal">'
    + (dateDuJour ? '<p class="pastille pastille--neutre">Tour du ' + escapeHtml(dateDuJour) + '</p>' : '')
    + blocTicket(vue)
    + (vue.actif
      ? '<section class="carte carte--discrete">'
        + '<p class="texte-doux">Cette page se met à jour toute seule. Gardez-la ouverte, ou revenez-y depuis WhatsApp.</p>'
        + (vue.adresseSalon ? '<p class="texte-doux">' + escapeHtml(vue.adresseSalon) + '</p>' : '')
        + '<button class="bouton bouton--discret" type="button" data-annuler>Je ne viendrai pas, libérer ma place</button>'
        + '<p class="alerte alerte--refus" role="alert" hidden data-annuler-erreur></p>'
        + '</section>'
      : '<section class="carte carte--discrete">'
        + '<a class="bouton bouton--principal" href="/join">Prendre un nouveau tour</a>'
        + '</section>')
    + '</main>';

  ctx.html(200, page({
    titre: 'Ticket ' + vue.numero + ' — ' + reglages['salon.nom'],
    description: 'Suivez votre tour chez ' + reglages['salon.nom'] + ' en direct.',
    corps,
    base: ctx.base,
    chemin: '/ticket/' + jeton,
    // Un lien de suivi est un secret : il ne doit jamais entrer dans un index.
    robots: 'noindex, nofollow, noarchive',
    classe: 'theme-sombre',
    scripts: ['/js/ticket.js'],
    donnees: { jeton, vue },
    pied: piedDePage({ adresse: reglages['salon.adresse'] || null, telephone: reglages['salon.telephone'] || null }),
  }));
}, { public: true });

/* ------------------------------------------------------------------ */
/*  QR Code et affiche                                                 */
/* ------------------------------------------------------------------ */

/**
 * L'adresse qu'encode le QR Code. Elle ne doit JAMAIS changer : l'affiche est
 * imprimee une fois et reste collee des annees en vitrine. « /join?qr=1 » est
 * donc un contrat, au meme titre qu'une API publique.
 */
async function adresseDuQr(ctx) {
  const reglages = await lireTous();
  return adressePublique(reglages, ctx.base) + '/join?qr=1';
}

siteRoutes.get('/qr.svg', async (ctx) => {
  const qr = encoder(await adresseDuQr(ctx), { niveau: 'Q' });
  ctx.file(Buffer.from(versSvg(qr, { titre: 'Scannez pour prendre votre tour' }), 'utf8'), {
    filename: 'haron-qr.svg',
    mimeType: 'image/svg+xml',
    download: ctx.queryBool('telecharger'),
    cache: 'public, max-age=3600',
  });
}, { public: true });

siteRoutes.get('/qr.png', async (ctx) => {
  const qr = encoder(await adresseDuQr(ctx), { niveau: 'Q' });
  // Huit pixels par module : de quoi imprimer en A4 sans le moindre escalier.
  const echelle = ctx.queryInt('echelle', 12, { min: 4, max: 24 });
  ctx.file(pngNoirEtBlanc(versMatrice(qr, { marge: 4, echelle })), {
    filename: 'haron-qr.png',
    mimeType: 'image/png',
    download: ctx.queryBool('telecharger'),
    cache: 'public, max-age=3600',
  });
}, { public: true });

/**
 * L'affiche de la vitrine. Une page faite pour etre imprimee : le QR Code y est
 * dessine en SVG, donc net quelle que soit l'imprimante, et la feuille de style
 * d'impression retire tout le reste.
 */
siteRoutes.get('/affiche', async (ctx) => {
  const reglages = await lireTous();
  const adresse = await adresseDuQr(ctx);
  const qr = encoder(adresse, { niveau: 'Q' });

  const corps = '<main class="affiche" id="principal">'
    + '<div class="affiche__feuille">'
    + marque({ taille: 'grand', lien: false })
    + '<p class="affiche__titre">Vous êtes arrivé ?</p>'
    + '<p class="affiche__sous-titre">Scannez pour prendre votre tour</p>'
    + '<div class="affiche__qr">' + versSvg(qr, { titre: 'Scanner pour prendre son tour', marge: 2 }) + '</div>'
    + '<p class="affiche__mention">Pas besoin de télécharger d’application</p>'
    + '<p class="affiche__adresse">' + escapeHtml(adresse.replace(/^https?:\/\//, '')) + '</p>'
    + '</div>'
    + '<div class="affiche__outils">'
    + '<a class="bouton bouton--discret" href="/qr.svg?telecharger=1" download>Télécharger le QR (SVG)</a>'
    + '<a class="bouton bouton--discret" href="/qr.png?telecharger=1" download>Télécharger le QR (PNG)</a>'
    + '<button class="bouton bouton--principal" type="button" data-imprimer>Imprimer l’affiche</button>'
    + '</div>'
    + '</main>';

  ctx.html(200, page({
    titre: 'Affiche QR Code — ' + reglages['salon.nom'],
    description: 'L’affiche à imprimer pour la vitrine du salon.',
    corps,
    base: ctx.base,
    chemin: '/affiche',
    robots: 'noindex, nofollow',
    classe: 'theme-clair page-affiche',
    scripts: ['/js/affiche.js'],
    pied: '',
  }));
}, { public: true });
