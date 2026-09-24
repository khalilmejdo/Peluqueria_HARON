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
import { config } from '../core/config.js';
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
import { pourVitrine } from '../domain/tarifas.js';
import { page, marque, entete, piedDePage, pageErreur } from './mise-en-page.js';

export const siteRoutes = new Router();

/* ------------------------------------------------------------------ */
/*  Accueil                                                            */
/* ------------------------------------------------------------------ */

/**
 * La fiche de prix, telle qu'elle s'affiche en vitrine.
 *
 * Une ligne = un nom, un filet de pointilles, un prix. C'est la forme d'une
 * carte de salon depuis toujours, et elle se lit d'un coup d'oeil : le regard
 * suit le pointille du service jusqu'au chiffre, sans hesiter sur la colonne.
 *
 * Les prix arrivent DEJA mis en forme par le domaine. Cette fonction ne fait
 * aucun calcul sur de l'argent.
 */
function ficheDePrix(lignes, nota) {
  if (!lignes.length) return '';
  const items = lignes.map((t) => '<li class="tarifa">'
    + '<span class="tarifa__nombre">' + escapeHtml(t.nombre) + '</span>'
    + '<span class="tarifa__filete" aria-hidden="true"></span>'
    + '<span class="tarifa__precio">' + escapeHtml(t.precio) + '</span>'
    + (t.nota ? '<span class="tarifa__nota">' + escapeHtml(t.nota) + '</span>' : '')
    + '</li>').join('');

  return '<section class="enveloppe seccion" id="tarifas">'
    + '<div class="seccion__tete">'
    + '<h2 class="seccion__titulo">Tarifas</h2>'
    + '<p class="seccion__intro">Precios claros, sin sorpresas.</p>'
    + '</div>'
    + '<ul class="tarifas">' + items + '</ul>'
    + (nota ? '<p class="tarifas__nota">' + escapeHtml(nota) + '</p>' : '')
    + '</section>';
}

/**
 * « Cómo funciona » : trois etapes, pas une de plus.
 *
 * C'est la section qui remplace une explication au comptoir. Un client qui
 * passe devant la vitrine doit comprendre en dix secondes qu'il n'a rien a
 * installer et rien a payer d'avance.
 */
function commentCaMarche() {
  const etapes = [
    ['1', 'Pide tu turno', 'Tu nombre y tu teléfono. Nada más: ni cuenta, ni contraseña, ni aplicación.'],
    ['2', 'Sigue tu posición', 'Te llevas un enlace que te dice en directo cuántas personas te faltan.'],
    ['3', 'Llega a tiempo', 'Espera donde quieras y ven cuando el enlace te diga que te toca.'],
  ];
  const items = etapes.map(([n, titre, texte]) => '<li class="paso">'
    + '<span class="paso__num" aria-hidden="true">' + n + '</span>'
    + '<h3 class="paso__titulo">' + escapeHtml(titre) + '</h3>'
    + '<p class="paso__texto">' + escapeHtml(texte) + '</p>'
    + '</li>').join('');

  return '<section class="enveloppe seccion">'
    + '<div class="seccion__tete">'
    + '<h2 class="seccion__titulo">Cómo funciona</h2>'
    + '</div>'
    + '<ol class="pasos">' + items + '</ol>'
    + '</section>';
}

siteRoutes.get('/', async (ctx) => {
  const reglages = await lireTous();
  const [etat, prise, tarifas] = await Promise.all([
    chargerEtat(jourLocal()),
    etatPriseDeTour(),
    reglages['tarifas.visible'] ? pourVitrine() : Promise.resolve([]),
  ]);
  const devant = etat.compteurs.enAttente + etat.compteurs.enCours;
  const attente = devant * etat.dureeMoyenneMinutes;

  const affluence = etat.compteurs.enAttente === 0
    ? '<p class="affluence__forte">Sin espera</p><p class="affluence__detail">El sillón te está esperando.</p>'
    : '<p class="affluence__forte">' + etat.compteurs.enAttente + ' persona' + (etat.compteurs.enAttente > 1 ? 's' : '') + ' en la fila</p>'
      + '<p class="affluence__detail">Espera estimada: ' + escapeHtml(attenteLisible(attente).replace(/^unos /, '≈ ').replace(/^alrededor de /, '≈ ')) + '</p>';

  // Congés, arrêt des tours, hors horaires : on le dit AVANT le bouton, et on
  // retire le bouton. Un client qui appuie pour se voir refuser à l'écran
  // suivant repart plus agacé que s'il avait su tout de suite.
  const appel = prise.ouverte
    ? '<div class="affluence" data-affluence>' + affluence + '</div>'
      + '<a class="bouton bouton--principal bouton--geant" href="/join">Pedir mi turno</a>'
      // La promesse doit etre exacte : sans WhatsApp Business configure, aucun
      // message ne part, et annoncer le contraire serait un mensonge que le
      // client decouvrirait en attendant un message qui ne vient pas.
      + '<p class="hero__note">Sin cuenta y sin instalar nada. '
      + (config.whatsapp.actif
        ? 'Recibes un enlace de seguimiento por WhatsApp.'
        : 'Te llevas un enlace que muestra tu posición en directo.')
      + '</p>'
    : '<div class="avis-ferme" data-ferme>'
      + '<p class="avis-ferme__titre">' + escapeHtml(prise.code === 'SALON_EN_CONGES' ? 'Salón cerrado' : 'No damos más turnos') + '</p>'
      + '<p class="avis-ferme__texte">' + escapeHtml(prise.message) + '</p>'
      + '</div>'
      + (reglages['salon.telephone']
        ? '<a class="bouton bouton--discret" href="tel:' + escapeHtml(reglages['salon.telephone'].replace(/[^+0-9]/g, '')) + '">Llamar al salón</a>'
        : '');

  const annonce = prise.ouverte && prise.prochaineFermeture
    ? '<section class="enveloppe bandeau-annonce">'
      + '<p class="bandeau-annonce__texte">Próximo cierre: del ' + escapeHtml(dateLongueFr(prise.prochaineFermeture.du))
      + ' al ' + escapeHtml(dateLongueFr(prise.prochaineFermeture.au))
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
    + ficheDePrix(tarifas, reglages['tarifas.nota'])
    + commentCaMarche()
    + '<section class="enveloppe bandeau-qr">'
    + '<p class="bandeau-qr__titre">¿Ya estás en el salón?</p>'
    + '<p class="bandeau-qr__texte">Escanea el código QR del escaparate y entras en la misma fila.</p>'
    + '</section>'
    + '</main>';

  ctx.html(200, page({
    titre: reglages['salon.nom'] + ' — Pide tu turno sin esperar de pie',
    description: 'Pide turno en ' + reglages['salon.nom'] + ' desde el móvil, sigue tu posición en directo y llega en el momento justo. Sin cuenta y sin instalar nada.',
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
  { nom: 'prenom', libelle: 'Nombre', autocomplete: 'given-name', type: 'text', inputmode: 'text', max: 40, exemple: 'Ahmed' },
  { nom: 'nom', libelle: 'Apellido', autocomplete: 'family-name', type: 'text', inputmode: 'text', max: 40, exemple: 'Benali' },
  {
    nom: 'telephone',
    libelle: 'Número de WhatsApp',
    autocomplete: 'tel',
    type: 'tel',
    inputmode: 'tel',
    max: 25,
    exemple: '612 345 678',
    motif: MOTIF_TELEPHONE,
    aide: 'Solo cifras. Número español por defecto: no hace falta escribir +34. Desde el extranjero, empieza por « + ».',
  },
];

/**
 * Le choix du coiffeur, en file par coiffeur.
 *
 * Des vignettes, pas une liste deroulante : le client doit voir d'un coup
 * combien de monde attend chez chacun, et choisir en connaissance de cause.
 * C'est la seule information qui l'aide vraiment.
 */
function choixDuCoiffeur(coiffeurs, choisi) {
  const cartes = coiffeurs.map((c, i) => {
    const id = 'coiffeur-' + c.id;
    const coche = choisi ? choisi === c.id : i === 0;
    return '<label class="coiffeur" for="' + id + '">'
      + '<input class="coiffeur__choix" type="radio" name="posteId" id="' + id + '" '
      + 'value="' + escapeHtml(c.id) + '"' + (coche ? ' checked' : '') + ' required>'
      + '<span class="coiffeur__nom">' + escapeHtml(c.nom) + '</span>'
      + '<span class="coiffeur__attente">'
      + (c.enAttente === 0
        ? 'Libre ahora mismo'
        : c.enAttente + ' persona' + (c.enAttente > 1 ? 's' : '') + ' · ≈ '
          + escapeHtml(attenteLisible(c.attenteEstimeeMinutes).replace(/^unos /, '').replace(/^alrededor de /, '')))
      + '</span>'
      + '</label>';
  }).join('');

  // Volontairement HORS de la classe « champ » : les regles de champ
  // (majuscules, hauteur de saisie, largeur pleine) s'appliqueraient au
  // libelle et au bouton radio, et donneraient un radio de la taille d'un
  // champ de texte.
  return '<fieldset class="bloc-coiffeurs">'
    + '<legend class="bloc-coiffeurs__titre">Tu peluquero</legend>'
    + '<div class="coiffeurs">' + cartes + '</div>'
    + '</fieldset>';
}

function formulaire({
  valeurs = {}, erreurs = {}, source = 'ONLINE', messageGlobal = null,
  coiffeurs = [], posteId = null,
}) {
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
    + (erreurs.posteId ? '<p class="champ__erreur" role="alert">' + escapeHtml(erreurs.posteId) + '</p>' : '')
    + (coiffeurs.length ? choixDuCoiffeur(coiffeurs, posteId) : '')
    + champs
    + '<button class="bouton bouton--principal bouton--geant" type="submit">Pedir mi turno</button>'
    + '<p class="formulaire__note">'
    + (config.whatsapp.actif
      ? 'Tu número solo sirve para avisarte. Nunca se muestra en público.'
      : 'Tu número sirve al salón para localizarte si hace falta. Nunca se muestra en público.')
    + '</p>'
    + '</form>';
}

function pageJoin(ctx, reglages, options) {
  const { prise = null } = options;
  // Salon fermé : pas de formulaire du tout. Rien n'est plus agaçant qu'un
  // formulaire qu'on remplit pour se voir refuser à la validation.
  const contenu = prise && !prise.ouverte
    ? '<section class="carte carte--centree">'
      + '<p class="pastille pastille--neutre">' + escapeHtml(prise.code === 'SALON_EN_CONGES' ? 'Vacaciones' : 'Cerrado') + '</p>'
      + '<h1 class="titre-page">' + escapeHtml(prise.code === 'SALON_EN_CONGES' ? 'El salón está cerrado' : 'No damos más turnos') + '</h1>'
      + '<p class="texte-doux">' + escapeHtml(prise.message) + '</p>'
      + (reglages['salon.telephone']
        ? '<a class="bouton bouton--discret" href="tel:' + escapeHtml(reglages['salon.telephone'].replace(/[^+0-9]/g, '')) + '">Llamar al salón</a>'
        : '')
      + '<a class="bouton bouton--principal" href="/">Volver al inicio</a>'
      + '</section>'
    : '<h1 class="titre-page">Pedir mi turno</h1>'
      + '<p class="texte-doux">Tres datos, menos de un minuto, y sigues tu posición en directo.</p>'
      + '<section class="carte">' + formulaire(options) + '</section>';

  const corps = entete({ retour: { href: '/', texte: 'Inicio' } })
    + '<main class="enveloppe page-etroite" id="principal">'
    + contenu
    + '</main>';
  return page({
    titre: 'Pedir mi turno — ' + reglages['salon.nom'],
    description: 'Entra en la fila de ' + reglages['salon.nom'] + ' en menos de un minuto.',
    corps,
    base: ctx.base,
    chemin: '/join',
    classe: 'theme-sombre',
    scripts: ['/js/join.js'],
    pied: piedDePage({ adresse: reglages['salon.adresse'] || null }),
  });
}

/**
 * Les coiffeurs proposes au client, avec la longueur de leur file.
 * Liste vide en file unique : le client ne choisit pas.
 */
async function coiffeursProposes(reglages) {
  if (reglages['file.mode'] !== 'PAR_FAUTEUIL') return [];
  const etat = await chargerEtat(jourLocal());
  return etat.postesActifs.map((p) => {
    const sienne = etat.tickets.filter(
      (t) => t.poste_choisi_id === p.id && ['WAITING', 'LATE'].includes(t.statut),
    ).length;
    return {
      id: p.id,
      nom: p.coiffeur || p.nom,
      enAttente: sienne,
      attenteEstimeeMinutes: sienne * etat.dureeMoyenneMinutes,
    };
  });
}

siteRoutes.get('/join', async (ctx) => {
  const reglages = await lireTous();
  const prise = await etatPriseDeTour();
  // « ?qr=1 » : c'est le QR Code de la vitrine qui amene ici. La file est la
  // meme, seule l'origine enregistree change.
  const source = ctx.queryBool('qr') ? 'QR' : 'ONLINE';
  const coiffeurs = prise.ouverte ? await coiffeursProposes(reglages) : [];
  ctx.html(prise.ouverte ? 200 : 409, pageJoin(ctx, reglages, { source, prise, coiffeurs }));
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

  const posteId = String(ctx.body.posteId ?? '') || null;
  const coiffeurs = await coiffeursProposes(reglages);

  let data;
  try {
    data = validate({ ...brut, source, posteId }, {
      prenom: rules.prenom,
      nom: rules.nomFamille,
      telephone: rules.whatsapp,
      source: { type: 'enum', values: ['ONLINE', 'QR'], upper: true, default: 'ONLINE' },
      posteId: { type: 'uuid' },
    });
  } catch (err) {
    if (!(err instanceof ValidationError)) throw err;
    ctx.html(422, pageJoin(ctx, reglages, { valeurs: brut, erreurs: err.fields, source, coiffeurs, posteId }));
    return;
  }

  const debit = consommerPriseDeTour(
    { ip: ctx.ip, telephone: data.telephone },
    { telephoneSalon: reglages['salon.telephone'] || null },
  );
  if (!debit.allowed) {
    ctx.res.setHeader('Retry-After', String(debit.retryAfterSeconds));
    ctx.html(429, pageJoin(ctx, reglages, { valeurs: brut, source, coiffeurs, posteId, messageGlobal: debit.message }));
    return;
  }

  let resultat;
  try {
    resultat = await prendreTour(data);
  } catch (err) {
    if (err instanceof ValidationError) {
      ctx.html(422, pageJoin(ctx, reglages, {
        valeurs: brut, erreurs: err.fields, source, coiffeurs, posteId, messageGlobal: err.message,
      }));
      return;
    }
    if (err instanceof AppError && err.status === 409) {
      ctx.html(409, pageJoin(ctx, reglages, { valeurs: brut, source, coiffeurs, posteId, messageGlobal: err.message }));
      return;
    }
    throw err;
  }

  // 303 : le navigateur refait un GET, donc un rafraichissement de la page de
  // suivi ne reposte jamais le formulaire et ne cree jamais un second ticket.
  // « nouveau » met en avant le lien a garder : c'est maintenant ou jamais.
  ctx.redirect('/ticket/' + resultat.jeton + '?nouveau=1', 303);
}, { public: true });

/* ------------------------------------------------------------------ */
/*  Suivi d'un tour                                                    */
/* ------------------------------------------------------------------ */

const TONS = { tour: 'tour', proche: 'proche', attente: 'attente', fini: 'fini' };

function blocTicket(vue) {
  const ton = TONS[vue.ton] || 'attente';
  return '<section class="ticket ticket--' + ton + '" data-ticket>'
    + '<p class="ticket__label">Tu turno</p>'
    + '<p class="ticket__prenom" data-prenom>' + escapeHtml(vue.prenom) + '</p>'
    + '<p class="ticket__numero" data-numero>' + escapeHtml(vue.numero) + '</p>'
    + (vue.coiffeur ? '<p class="ticket__coiffeur" data-coiffeur>con ' + escapeHtml(vue.coiffeur) + '</p>' : '')
    + '<div class="ticket__etat" data-etat>'
    + '<p class="ticket__titre" data-titre>' + escapeHtml(vue.titre) + '</p>'
    + '<p class="ticket__detail" data-detail>' + escapeHtml(vue.detail) + '</p>'
    + '</div>'
    + '<dl class="ticket__chiffres">'
    + '<div><dt>Personas delante de ti</dt><dd data-devant>' + vue.devant + '</dd></div>'
    + '<div><dt>Estimación</dt><dd data-estimation>' + escapeHtml(vue.estimationCourte) + '</dd></div>'
    + '</dl>'
    + (vue.retards > 0
      ? '<p class="ticket__note">Te hemos puesto al final de la fila porque no estabas. Esta vez quédate cerca.</p>'
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
      titre: 'Demasiadas peticiones',
      message: 'Espera unos instantes antes de recargar esta página.',
    }));
    return;
  }

  const ticket = jetonPlausible(jeton) ? await ticketParJeton(jeton) : null;
  if (!ticket) {
    ctx.html(404, pageErreur({
      base: ctx.base, statut: 404,
      titre: 'Enlace de seguimiento no válido',
      // Ne renvoyer le client vers WhatsApp que si des messages partent
      // vraiment : sinon on l'envoie chercher quelque chose qui n'existe pas.
      message: 'Este enlace ya no sirve. Si tu turno sigue en curso, '
        + (config.whatsapp.actif
          ? 'busca el enlace que recibiste por WhatsApp, o pídelo en el salón.'
          : 'pide tu enlace en el salón: pueden encontrarlo con tu número de turno.'),
    }));
    return;
  }

  const etat = await chargerEtat(ticket.jour);
  const vue = pourClient(etat, ticket.id);
  const dateDuJour = ticket.jour === jourLocal() ? null : dateLongueFr(ticket.jour);

  // Le lien de suivi EST le ticket : il n'y a pas de compte, pas de mot de
  // passe, rien d'autre. Un client qui ferme l'onglet sans l'avoir garde n'a
  // plus aucun moyen de retrouver sa position. On le lui montre donc en entier,
  // avec de quoi le copier ou se l'envoyer — et on insiste juste apres la
  // prise de tour, quand c'est le moment de le faire.
  const lien = ctx.base + '/ticket/' + jeton;
  const nouveau = ctx.queryBool('nouveau');

  const blocLien = vue.actif
    ? '<section class="lien' + (nouveau ? ' lien--neuf' : '') + '" data-bloc-lien>'
      + '<p class="lien__titre">' + (nouveau ? 'Guarda este enlace' : 'Tu enlace de seguimiento') + '</p>'
      + '<p class="lien__texte">Abre esta página cuando quieras y te dice cuántas personas te faltan. '
      + 'Envíatelo a ti mismo, o guárdalo en favoritos.</p>'
      + '<p class="lien__adresse" data-lien>' + escapeHtml(lien) + '</p>'
      + '<div class="lien__actions">'
      + '<button class="bouton bouton--principal" type="button" data-copier data-valeur="' + escapeHtml(lien) + '">Copiar el enlace</button>'
      // « Envoyer » ouvre le partage du systeme, qui propose WhatsApp parmi
      // d'autres. Annoncer WhatsApp serait inexact sur un appareil qui ne l'a
      // pas installe.
      + '<button class="bouton bouton--discret" type="button" data-partager hidden>Enviar el enlace</button>'
      + '</div>'
      + '<p class="lien__retour" role="status" hidden data-copie>Enlace copiado.</p>'
      + '</section>'
    : '';

  const corps = entete()
    + '<main class="enveloppe page-etroite" id="principal">'
    + (dateDuJour ? '<p class="pastille pastille--neutre">Turno del ' + escapeHtml(dateDuJour) + '</p>' : '')
    + blocTicket(vue)
    + blocLien
    + (vue.actif
      ? '<section class="carte carte--discrete">'
        + '<p class="texte-doux">Esta página se actualiza sola. Déjala abierta, o vuelve con tu enlace.</p>'
        + (vue.adresseSalon ? '<p class="texte-doux">' + escapeHtml(vue.adresseSalon) + '</p>' : '')
        + '<button class="bouton bouton--discret" type="button" data-annuler>No voy a venir, liberar mi sitio</button>'
        + '<p class="alerte alerte--refus" role="alert" hidden data-annuler-erreur></p>'
        + '</section>'
      : '<section class="carte carte--discrete">'
        + '<a class="bouton bouton--principal" href="/join">Pedir un turno nuevo</a>'
        + '</section>')
    + '</main>';

  ctx.html(200, page({
    titre: 'Turno ' + vue.numero + ' — ' + reglages['salon.nom'],
    description: 'Sigue tu turno en ' + reglages['salon.nom'] + ' en directo.',
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
 *
 * Elle vient du reglage « public.url », modifiable depuis l'espace de gestion ;
 * a defaut, de PUBLIC_URL ; a defaut, de l'adresse vue dans la requete.
 */
async function adresseDuQr(ctx) {
  const reglages = await lireTous();
  return adressePublique(reglages, ctx.base) + '/join?qr=1';
}

/**
 * Le QR Code depend d'un reglage : il change des que le gerant change l'adresse
 * publique. Une heure de cache lui ferait donc afficher l'ancienne adresse
 * juste apres la modification — exactement au moment ou on vient verifier
 * qu'elle a bien ete prise en compte, et avant d'imprimer. Une minute suffit a
 * absorber les rechargements de la page sans jamais mentir a l'ecran.
 */
const CACHE_QR = 'public, max-age=60';

siteRoutes.get('/qr.svg', async (ctx) => {
  const qr = encoder(await adresseDuQr(ctx), { niveau: 'Q' });
  ctx.file(Buffer.from(versSvg(qr, { titre: 'Escanea para pedir tu turno' }), 'utf8'), {
    filename: 'haron-qr.svg',
    mimeType: 'image/svg+xml',
    download: ctx.queryBool('telecharger'),
    cache: CACHE_QR,
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
    cache: CACHE_QR,
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
    + '<p class="affiche__titre">¿Ya estás aquí?</p>'
    + '<p class="affiche__sous-titre">Escanea para pedir tu turno</p>'
    + '<div class="affiche__qr">' + versSvg(qr, { titre: 'Escanear para pedir turno', marge: 2 }) + '</div>'
    + '<p class="affiche__mention">No hace falta instalar ninguna aplicación</p>'
    + '<p class="affiche__adresse">' + escapeHtml(adresse.replace(/^https?:\/\//, '')) + '</p>'
    + '</div>'
    + '<div class="affiche__outils">'
    + '<a class="bouton bouton--discret" href="/qr.svg?telecharger=1" download>Descargar el QR (SVG)</a>'
    + '<a class="bouton bouton--discret" href="/qr.png?telecharger=1" download>Descargar el QR (PNG)</a>'
    + '<button class="bouton bouton--principal" type="button" data-imprimer>Imprimir el cartel</button>'
    + '</div>'
    + '</main>';

  ctx.html(200, page({
    titre: 'Cartel con código QR — ' + reglages['salon.nom'],
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
