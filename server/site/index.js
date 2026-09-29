/**
 * Les pages du client, rendues par le serveur.
 *
 *   /                  accueil : l'affluence, et un seul bouton
 *   /join              prendre son tour (formulaire)      GET et POST
 *   /ticket/<jeton>    suivi de SON tour, en temps reel
 *   /affiche           l'affiche a imprimer pour la vitrine
 *   /pantalla          la file en direct, pour l'ecran accroche dans le salon
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
import {
  prendreTour, ticketParJeton, chargerEtat, pourClient, pourPantalla, etatPriseDeTour,
} from '../domain/file.js';
import { pourVitrine } from '../domain/tarifas.js';
import { page, marque, entete, piedDePage, pageErreur } from './mise-en-page.js';
import {
  matDeBarbier, fauteuil, ciseauxEtPeigne, iconeEtape, separateur,
  emblemeRond, ciseauxPetits, iconeLieu, iconeTelephone, iconeConversation,
  scenesDuSalon, planStylise,
} from './illustrations.js';
import { iconeTarifa } from './icones-tarifas.js';
import { photosDuSalon } from './galerie.js';
import { exigerClePantalla } from '../routes/public.js';

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
  const items = lignes.map((t) => {
    const icone = iconeTarifa(t.icono);
    return '<li class="tarifa">'
      + (icone ? '<span class="tarifa__icone" aria-hidden="true">' + icone + '</span>' : '<span class="tarifa__icone"></span>')
      + '<span class="tarifa__nombre">' + escapeHtml(t.nombre) + '</span>'
      + '<span class="tarifa__filete" aria-hidden="true"></span>'
      + '<span class="tarifa__precio">' + escapeHtml(t.precio) + '</span>'
      + (t.nota ? '<span class="tarifa__nota">' + escapeHtml(t.nota) + '</span>' : '')
      + '</li>';
  }).join('');

  return '<section class="enveloppe seccion seccion--tarifas" id="tarifas">'
    + '<div class="seccion__tete">'
    + '<h2 class="seccion__titulo">Tarifas</h2>'
    + '<p class="seccion__intro">Precios claros, sin sorpresas.</p>'
    + '</div>'
    // Le cadre reprend le tableau accroche dans le salon : un double filet de
    // laiton, l'embleme en haut, et la devise en bas sur une plaque.
    + '<div class="tarifas__cadre">'
    // Le mat tourne, et c'est la seule chose qui bouge ici. Il n'apparait qu'a
    // partir de la largeur ou il ne vole de place a aucun prix.
    + '<div class="tarifas__mat" aria-hidden="true">' + matDeBarbier() + '</div>'
    + '<div class="tarifas__contenu">'
    + '<div class="tarifas__entete">'
    + '<span class="tarifas__embleme" aria-hidden="true">' + emblemeRond() + '</span>'
    + '<span class="tarifas__bandeau">Barbería &amp; estilo</span>'
    + '</div>'
    + '<div class="tarifas__filet-orne" aria-hidden="true">'
    + '<span class="tarifas__filet"></span>' + ciseauxPetits() + '<span class="tarifas__filet"></span>'
    + '</div>'
    + '<ul class="tarifas">' + items + '</ul>'
    + '<p class="tarifas__devise">Tu estilo, nuestra pasión</p>'
    + '</div>'
    + '</div>'
    + (nota ? '<p class="tarifas__nota">' + escapeHtml(nota) + '</p>' : '')
    + '</section>';
}

/**
 * LA FILE, EN MARQUES.
 *
 * Une marque par personne qui attend. Un chiffre se lit, une longueur se VOIT :
 * « 7 » demande un instant de traduction, sept traits n'en demandent aucun, et
 * c'est ce coup d'oeil-la que donne un passant devant la vitrine.
 *
 * DIX AU PLUS, puis « +n ». Au-dela, la rangee deviendrait une bouillie ou
 * douze et quinze se ressemblent — et un nombre qu'on ne peut plus estimer ne
 * vaut pas mieux qu'un nombre qu'on ne montre pas.
 *
 * Elle est rendue par le SERVEUR, pas seulement par le script : une page sans
 * JavaScript montre la file du chargement, elle ne montre pas un vide.
 *
 * `aria-hidden` : la phrase juste au-dessus dit deja « 7 personas en la fila ».
 * Faire lire sept traits a un lecteur d'ecran serait du bruit pur.
 */
function colaDeMarques(enAttente) {
  const n = Math.max(0, Math.trunc(Number(enAttente) || 0));
  const montrees = Math.min(n, MARQUES_MAX);
  const reste = n - montrees;

  return '<ul class="cola" data-cola aria-hidden="true">'
    + '<li class="cola__marque"></li>'.repeat(montrees)
    + (reste ? '<li class="cola__reste" data-cola-reste>+' + reste + '</li>' : '')
    + '</ul>';
}

const MARQUES_MAX = 10;

/**
 * LE BANDEAU DES CONGES.
 *
 * Deux situations qui n'ont rien a voir, et qui meritaient deux traitements :
 *
 *   PENDANT  le salon est ferme. C'est l'information la plus importante de la
 *            page, et elle doit etre lue AVANT que le client prenne sa voiture.
 *            Bandeau pleine largeur, en haut, en rouge, avec la date de
 *            REOUVERTURE — « fermé » sans « on rouvre le… » laisse le client
 *            devant une porte close sans savoir quand revenir.
 *   AVANT    la fermeture approche. Le ton monte a mesure qu'elle se rapproche :
 *            une note discrete a trois semaines, une alerte ambre a moins d'une
 *            semaine. Un avertissement toujours criard finit par ne plus rien
 *            dire, et un avertissement toujours discret n'a jamais rien dit.
 *
 * @param {object} prise  l'etat rendu par etatPriseDeTour()
 * @param {string} aujourdhui  « AAAA-MM-JJ »
 */
function bandeauFermeture(prise, aujourdhui) {
  if (!prise.ouverte && prise.code === 'SALON_EN_CONGES' && prise.fermeture) {
    const jusqua = prise.fermeture.au;
    return '<section class="enveloppe">'
      + '<div class="alerte-conges alerte-conges--maintenant" role="status">'
      + '<span class="alerte-conges__pastille">Cerrado</span>'
      + '<p class="alerte-conges__titre">El salón está cerrado'
      + (prise.fermeture.motif ? ' — ' + escapeHtml(prise.fermeture.motif) : '')
      + '</p>'
      + '<p class="alerte-conges__texte">Volvemos a abrir el '
      + escapeHtml(dateLongueFr(lendemain(jusqua))) + '.</p>'
      + '</div>'
      + '</section>';
  }

  if (!prise.ouverte || !prise.prochaineFermeture) return '';

  const f = prise.prochaineFermeture;
  const jours = joursEntre(aujourdhui, f.du);
  const proche = jours !== null && jours <= 7;

  // Loin, le titre ne repete pas la date : elle est juste dessous, en entier.
  // « Cerramos del jueves 15 » suivi de « Del jueves 15 au… » se lit deux fois
  // et ne dit rien de plus.
  const titre = jours === 0 ? 'Cerramos hoy'
    : jours === 1 ? 'Cerramos mañana'
      : proche ? 'Cerramos dentro de ' + jours + ' días'
        : 'Próximo cierre';

  return '<section class="enveloppe">'
    + '<div class="alerte-conges' + (proche ? ' alerte-conges--proche' : ' alerte-conges--loin') + '" role="status">'
    + (proche ? '<span class="alerte-conges__pastille">Aviso</span>' : '')
    + '<p class="alerte-conges__titre">' + escapeHtml(titre)
    + (f.motif ? ' — ' + escapeHtml(f.motif) : '') + '</p>'
    + '<p class="alerte-conges__texte">Del ' + escapeHtml(dateLongueFr(f.du))
    + ' al ' + escapeHtml(dateLongueFr(f.au))
    + '. Volvemos el ' + escapeHtml(dateLongueFr(lendemain(f.au))) + '.</p>'
    + '</div>'
    + '</section>';
}

/**
 * Le lendemain d'un jour « AAAA-MM-JJ », en UTC.
 *
 * UTC et non l'heure locale : une fermeture est une DATE, pas un instant, et
 * passer par le fuseau du serveur ferait sauter un jour deux fois par an, au
 * changement d'heure. C'est le genre de defaut qui n'apparait qu'en octobre.
 */
function lendemain(jour) {
  const [a, m, j] = String(jour).split('-').map(Number);
  const d = new Date(Date.UTC(a, m - 1, j + 1));
  return d.toISOString().slice(0, 10);
}

/** Nombre de jours entiers entre deux dates « AAAA-MM-JJ ». */
function joursEntre(depuis, jusqua) {
  const enMs = (s) => {
    const [a, m, j] = String(s).split('-').map(Number);
    return Number.isFinite(a) ? Date.UTC(a, m - 1, j) : NaN;
  };
  const d = enMs(depuis);
  const f = enMs(jusqua);
  if (!Number.isFinite(d) || !Number.isFinite(f)) return null;
  return Math.round((f - d) / 86400000);
}

export const _bandeauFermeture = bandeauFermeture;

/**
 * Le contact : ou venir, comment appeler.
 *
 * Chaque ligne n'apparait QUE si le reglage correspondant est rempli. Un salon
 * qui n'a pas encore saisi son telephone n'affiche pas un cadre vide — la
 * section entiere disparait si rien n'est renseigne.
 *
 * Le telephone compose, le WhatsApp ouvre la conversation : sur un telephone,
 * ce sont deux gestes d'un seul appui. C'est tout ce qu'on demande a un
 * contact. L'adresse, elle, a sa propre section.
 */
function contact(reglages, horaires) {
  const telephone = reglages['salon.telephone'];
  const whatsapp = reglages['salon.whatsapp'];
  if (!telephone && !whatsapp && !horaires) return '';

  const numero = (v) => String(v).replace(/[^+0-9]/g, '');

  const cartes = [];

  // L'adresse n'est PAS ici : elle a sa propre section, « Cómo llegar », avec
  // le plan et le bouton qui ouvre l'application de cartes. La montrer aux deux
  // endroits obligeait le client a choisir entre deux boutons qui font la meme
  // chose — et un choix inutile est un temps d'arret.

  if (telephone) {
    cartes.push('<a class="contacto" href="tel:' + escapeHtml(numero(telephone)) + '">'
      + '<span class="contacto__icone" aria-hidden="true">' + iconeTelephone() + '</span>'
      + '<span class="contacto__quoi">Llámanos</span>'
      + '<span class="contacto__valeur">' + escapeHtml(telephone) + '</span>'
      + '<span class="contacto__action">Llamar ahora</span>'
      + '</a>');
  }

  if (whatsapp) {
    cartes.push('<a class="contacto" href="https://wa.me/' + escapeHtml(numero(whatsapp).replace(/^\+/, ''))
      + '" target="_blank" rel="noopener noreferrer">'
      + '<span class="contacto__icone" aria-hidden="true">' + iconeConversation() + '</span>'
      + '<span class="contacto__quoi">WhatsApp</span>'
      + '<span class="contacto__valeur">' + escapeHtml(whatsapp) + '</span>'
      + '<span class="contacto__action">Escribir</span>'
      + '</a>');
  }

  const grille = horaires && horaires.length
    ? '<div class="horario">'
      + '<h3 class="horario__titre">Horario</h3>'
      + '<ul class="horario__liste">'
      // Les plages séparées par un point médian : « 10:00 – 14:00 · 17:00 –
      // 20:30 ». Écrire l'amplitude « 10:00 – 20:30 » ferait venir un client à
      // quinze heures devant un rideau baissé.
      + horaires.map((h) => '<li' + (h.ferme ? ' class="horario--cerrado"' : '') + '>'
        + '<span>' + escapeHtml(h.nom) + '</span>'
        + '<span>' + (h.ferme
          ? 'Cerrado'
          : escapeHtml(h.plages.map((p) => p.ouverture + ' – ' + p.fermeture).join(' · '))) + '</span>'
        + '</li>').join('')
      + '</ul></div>'
    : '';

  return '<section class="enveloppe seccion" id="contacto">'
    + '<div class="seccion__tete">'
    + '<h2 class="seccion__titulo">Contacto</h2>'
    + '<p class="seccion__intro">Pasa cuando quieras, o escríbenos antes.</p>'
    + '</div>'
    + '<div class="contactos">' + cartes.join('') + '</div>'
    + grille
    + '</section>';
}

/**
 * La galerie : les vraies photos du salon.
 *
 * Aucune photo, aucune section. Le premier cliche est mis en avant — c'est
 * presque toujours la vue d'ensemble que le gerant depose en premier.
 *
 * `loading="lazy"` sur tout sauf la premiere : un client sur un reseau faible
 * doit voir le haut de la page, pas attendre six photos.
 */
function galerie(photos) {
  if (!photos.length) return scenesDessinees();
  const vignettes = photos.map((p, i) => '<figure class="cliche' + (i === 0 ? ' cliche--grand' : '') + '">'
    + '<img class="cliche__image" src="' + escapeHtml(p.src) + '" alt="' + escapeHtml(p.legende || 'Peluquería HARON') + '"'
    + (i === 0 ? '' : ' loading="lazy"') + ' decoding="async">'
    + (p.legende ? '<figcaption class="cliche__legende">' + escapeHtml(p.legende) + '</figcaption>' : '')
    + '</figure>').join('');

  return '<section class="enveloppe seccion" id="galeria">'
    + '<div class="seccion__tete">'
    + '<h2 class="seccion__titulo">El salón</h2>'
    + '<p class="seccion__intro">Así es la casa.</p>'
    + '</div>'
    + '<div class="galeria">' + vignettes + '</div>'
    + '</section>';
}

/**
 * « Cómo llegar » — ou est le salon, et comment y aller.
 *
 * LE BOUTON FAIT LE TRAVAIL, PAS LE DESSIN. Le plan a cote est un motif, il ne
 * represente aucun quartier reel ; ce qui amene vraiment le client, c'est le
 * bouton qui ouvre SON application de cartes, celle qu'il sait deja utiliser,
 * avec la navigation, le trafic et les transports qu'elle connait.
 *
 * AUCUNE CARTE N'EST EMBARQUEE DANS LA PAGE. Un plan tiers charge dans un cadre
 * verrait passer l'adresse IP de chaque visiteur avant meme qu'il ait clique,
 * et il faudrait ouvrir « frame-src » dans la politique de securite du contenu
 * pour tout le site. Ici, rien ne part tant que le client ne l'a pas demande.
 *
 * Les coordonnees, quand elles sont saisies, menent a LA PORTE du salon. Sans
 * elles on retombe sur l'adresse en toutes lettres, qui atterrit souvent au
 * milieu de la rue — d'ou l'aide du reglage, qui explique comment les relever.
 */
function localizacion(reglages) {
  const adresse = reglages['salon.adresse'];
  const coordonnees = reglages['salon.coordenadas'];
  const commentVenir = reglages['salon.comoLlegar'];
  if (!adresse && !coordonnees) return '';

  const cible = coordonnees || adresse;
  const itineraire = 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(cible);
  const carte = coordonnees
    ? 'https://www.openstreetmap.org/?mlat=' + encodeURIComponent(coordonnees.split(',')[0])
      + '&mlon=' + encodeURIComponent(coordonnees.split(',')[1])
      + '#map=18/' + coordonnees.split(',').join('/')
    : 'https://www.openstreetmap.org/search?query=' + encodeURIComponent(adresse);

  return '<section class="enveloppe seccion" id="como-llegar">'
    + '<div class="seccion__tete">'
    + '<h2 class="seccion__titulo">Cómo llegar</h2>'
    + '<p class="seccion__intro">Estamos aquí.</p>'
    + '</div>'
    + '<div class="ubicacion">'
    + '<div class="ubicacion__plan" aria-hidden="true">' + planStylise() + '</div>'
    + '<div class="ubicacion__infos">'
    + (adresse
      ? '<p class="ubicacion__direccion">'
        + '<span class="ubicacion__icone" aria-hidden="true">' + iconeLieu() + '</span>'
        + escapeHtml(adresse) + '</p>'
      : '')
    + (commentVenir
      ? '<p class="ubicacion__texto">' + escapeHtml(commentVenir) + '</p>'
      : '')
    + '<div class="ubicacion__botones">'
    + '<a class="bouton bouton--principal" href="' + escapeHtml(itineraire) + '"'
    + ' target="_blank" rel="noopener noreferrer">Cómo llegar</a>'
    + '<a class="bouton bouton--discret" href="' + escapeHtml(carte) + '"'
    + ' target="_blank" rel="noopener noreferrer">Ver en el mapa</a>'
    + '</div>'
    + '</div>'
    + '</div>'
    + '</section>';
}

/**
 * La galerie tant qu'aucune photo n'a ete deposee : trois scenes dessinees.
 *
 * Une vitrine sans la moindre image a l'air d'un site inacheve, et le gerant
 * n'a pas toujours de photo le premier jour. Ces dessins tiennent la place —
 * ils ne pretendent pas etre des photographies, et la legende le dit.
 *
 * Ils s'effacent tout seuls des la premiere vraie photo deposee.
 */
function scenesDessinees() {
  const scenes = scenesDuSalon();
  const vignettes = scenes.map((s) => '<figure class="escena">'
    + '<div class="escena__dessin">' + s.dessin + '</div>'
    + '<figcaption class="escena__legende">' + escapeHtml(s.legende) + '</figcaption>'
    + '</figure>').join('');

  return '<section class="enveloppe seccion" id="galeria">'
    + '<div class="seccion__tete">'
    + '<h2 class="seccion__titulo">El salón</h2>'
    + '<p class="seccion__intro">Así es la casa.</p>'
    + '</div>'
    + '<div class="escenas">' + vignettes + '</div>'
    + '<p class="escenas__nota">Ilustraciones. Las fotos del salón llegan pronto.</p>'
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
  const items = etapes.map(([n, titre, texte], i) => '<li class="paso">'
    + '<div class="paso__marque">'
    + iconeEtape(i)
    + '<span class="paso__num" aria-hidden="true">' + n + '</span>'
    + '</div>'
    + '<h3 class="paso__titulo">' + escapeHtml(titre) + '</h3>'
    + '<p class="paso__texto">' + escapeHtml(texte) + '</p>'
    + '</li>').join('');

  return '<section class="enveloppe seccion">'
    + '<div class="seccion__tete">'
    + '<h2 class="seccion__titulo">Cómo funciona</h2>'
    + '<p class="seccion__intro">Tres pasos, y ninguno cuesta nada.</p>'
    + '</div>'
    + '<ol class="pasos">' + items + '</ol>'
    + '</section>';
}

siteRoutes.get('/', async (ctx) => {
  const reglages = await lireTous();
  const [etat, prise, tarifas, photos] = await Promise.all([
    chargerEtat(jourLocal()),
    etatPriseDeTour(),
    reglages['tarifas.visible'] ? pourVitrine() : Promise.resolve([]),
    photosDuSalon(),
  ]);
  const devant = etat.compteurs.enAttente + etat.compteurs.enCours;
  const attente = devant * etat.dureeMoyenneMinutes;

  // « En directo » : un point qui bat, et l'affluence qui se met a jour toute
  // seule. C'est la seule chose de la page qui bouge parce qu'elle CHANGE
  // vraiment — une animation qui ne dit rien est du bruit.
  const pouls = '<p class="affluence__pouls"><span class="pouls" aria-hidden="true"></span>En directo</p>';

  const affluence = pouls + (etat.compteurs.enAttente === 0
    ? '<p class="affluence__forte" data-forte>Sin espera</p><p class="affluence__detail" data-detail>El sillón te está esperando.</p>'
    : '<p class="affluence__forte" data-forte>' + etat.compteurs.enAttente + ' persona' + (etat.compteurs.enAttente > 1 ? 's' : '') + ' en la fila</p>'
      + '<p class="affluence__detail" data-detail>Espera estimada: ' + escapeHtml(attenteLisible(attente).replace(/^unos /, '≈ ').replace(/^alrededor de /, '≈ ')) + '</p>')
    + colaDeMarques(etat.compteurs.enAttente)
    // Le compteur du jour n'apparait qu'a partir de trois : « 1 atendido hoy »
    // fait plus vide qu'un silence.
    + (etat.compteurs.servis >= 3
      ? '<p class="affluence__servis" data-servis>' + etat.compteurs.servis + ' atendidos hoy</p>'
      : '<p class="affluence__servis" data-servis hidden></p>');

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

  const annonce = bandeauFermeture(prise, jourLocal());

  const corps = '<main id="principal">'
    + '<section class="hero">'
    + '<div class="hero__raies" aria-hidden="true"></div>'
    // Le filigrane : ciseaux et peigne croises, tres pales, derriere le titre.
    // Purement decoratif, donc hors du flux et invisible des lecteurs d'ecran.
    + '<div class="hero__filigrane" aria-hidden="true">' + ciseauxEtPeigne() + '</div>'
    + '<div class="enveloppe hero__contenu">'
    + marque({ taille: 'grand', lien: false })
    + '<h1 class="hero__accroche">' + escapeHtml(reglages['salon.accroche']) + '</h1>'
    + appel
    + '</div>'
    + '</section>'
    + annonce
    + ficheDePrix(tarifas, reglages['tarifas.nota'])
    + galerie(photos)
    + separateur()
    + commentCaMarche()
    + contact(reglages, reglages['horaires.actifs'] ? horairesLisibles(reglages) : null)
    + localizacion(reglages)
    + '<section class="enveloppe bandeau-qr">'
    + '<div class="bandeau-qr__illu" aria-hidden="true">' + fauteuil() + '</div>'
    + '<div class="bandeau-qr__texte-bloc">'
    + '<p class="bandeau-qr__titre">¿Ya estás en el salón?</p>'
    + '<p class="bandeau-qr__texte">Escanea el código QR del escaparate y entras en la misma fila.</p>'
    + '</div>'
    + '</section>'
    // L'appel qui suit le pouce, sur téléphone. Seulement quand on peut
    // vraiment prendre un tour : une barre qui mène à un refus est pire que
    // pas de barre du tout.
    + (prise.ouverte
      ? '<div class="appel-fixe"><a class="bouton bouton--principal" href="/join">Pedir mi turno</a></div>'
      : '')
    + '</main>';

  ctx.html(200, page({
    titre: reglages['salon.nom'] + ' — Pide tu turno sin esperar de pie',
    description: 'Pide turno en ' + reglages['salon.nom'] + ' desde el móvil, sigue tu posición en directo y llega en el momento justo. Sin cuenta y sin instalar nada.',
    corps,
    base: ctx.base,
    chemin: '/',
    classe: 'theme-sombre page-accueil',
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

/**
 * LE CHOIX DES PRESTATIONS.
 *
 * Il ne sert pas a facturer — le salon encaisse au comptoir — mais a ANNONCER
 * UNE ATTENTE JUSTE. Une file de six barbes et une file de six queratinas ne
 * durent pas la meme chose ; sans cette question, la seconde mentait d'une
 * heure et demie a tout le monde.
 *
 * DES CASES, PAS UNE LISTE DEROULANTE. On en coche souvent deux (« corte » et
 * « barba »), et une liste deroulante interdirait le cas le plus frequent du
 * salon. Chaque case est une cible de quarante-quatre pixels : on coche au
 * pouce, debout, sans viser.
 *
 * FACULTATIF, ET DIT COMME TEL. Un client presse doit pouvoir passer outre ;
 * son tour est alors compte a la duree moyenne du salon, comme avant. Un champ
 * obligatoire de plus, c'est un client qui renonce.
 *
 * Le total est calcule par le serveur au chargement, puis tenu a jour par le
 * script. Sans JavaScript, les cases fonctionnent quand meme : c'est un
 * formulaire ordinaire, et le serveur recalcule tout de toute facon.
 */
function choixDesPrestations(prestations, choisies) {
  if (!prestations.length) return '';
  const cochees = new Set(choisies || []);

  const lignes = prestations.map((p) => {
    const id = 'presta-' + p.id;
    return '<li>'
      + '<input class="presta__case" type="checkbox" id="' + escapeHtml(id) + '" name="tarifaIds" '
      + 'value="' + escapeHtml(p.id) + '" data-minutos="' + p.duracionMin + '" '
      + 'data-precio="' + p.precioCts + '"' + (cochees.has(p.id) ? ' checked' : '') + '>'
      + '<label class="presta" for="' + escapeHtml(id) + '">'
      + '<span class="presta__nombre">' + escapeHtml(p.nombre) + '</span>'
      + '<span class="presta__meta">' + p.duracionMin + ' min · ' + escapeHtml(p.precio) + '</span>'
      + '</label>'
      + '</li>';
  }).join('');

  return '<fieldset class="prestas">'
    + '<legend class="prestas__titre">¿Qué te vas a hacer? <span class="prestas__facultatif">opcional</span></legend>'
    + '<p class="prestas__aide">Nos ayuda a calcular mejor tu espera. Puedes elegir varios.</p>'
    + '<ul class="prestas__liste">' + lignes + '</ul>'
    + '<p class="prestas__total" data-presta-total hidden></p>'
    + '</fieldset>';
}

function formulaire({
  valeurs = {}, erreurs = {}, source = 'ONLINE', messageGlobal = null,
  coiffeurs = [], posteId = null, prestations = [], tarifaIds = [],
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
    + choixDesPrestations(prestations, tarifaIds)
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
  const prestations = prise.ouverte ? await pourVitrine() : [];
  ctx.html(prise.ouverte ? 200 : 409, pageJoin(ctx, reglages, { source, prise, coiffeurs, prestations }));
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
  const prestations = await pourVitrine();
  // Une seule case cochee arrive comme une chaine, plusieurs comme un tableau :
  // c'est ainsi qu'un formulaire HTML poste des cases du meme nom.
  const brutTarifas = ctx.body.tarifaIds;
  const tarifaIds = (Array.isArray(brutTarifas) ? brutTarifas : [brutTarifas])
    .map((v) => String(v ?? '').trim()).filter(Boolean).slice(0, 6);

  let data;
  try {
    data = validate({ ...brut, source, posteId, tarifaIds }, {
      prenom: rules.prenom,
      nom: rules.nomFamille,
      telephone: rules.whatsapp,
      source: { type: 'enum', values: ['ONLINE', 'QR'], upper: true, default: 'ONLINE' },
      posteId: { type: 'uuid' },
      tarifaIds: { type: 'array', max: 6, of: { type: 'uuid' } },
    });
  } catch (err) {
    if (!(err instanceof ValidationError)) throw err;
    ctx.html(422, pageJoin(ctx, reglages, { valeurs: brut, erreurs: err.fields, source, coiffeurs, posteId, prestations, tarifaIds }));
    return;
  }

  const debit = consommerPriseDeTour(
    { ip: ctx.ip, telephone: data.telephone },
    { telephoneSalon: reglages['salon.telephone'] || null },
  );
  if (!debit.allowed) {
    ctx.res.setHeader('Retry-After', String(debit.retryAfterSeconds));
    ctx.html(429, pageJoin(ctx, reglages, { valeurs: brut, source, coiffeurs, posteId, prestations, tarifaIds, messageGlobal: debit.message }));
    return;
  }

  let resultat;
  try {
    resultat = await prendreTour({ ...data, tarifaIds: data.tarifaIds || [] });
  } catch (err) {
    if (err instanceof ValidationError) {
      ctx.html(422, pageJoin(ctx, reglages, {
        valeurs: brut, erreurs: err.fields, source, coiffeurs, posteId, prestations, tarifaIds, messageGlobal: err.message,
      }));
      return;
    }
    if (err instanceof AppError && err.status === 409) {
      ctx.html(409, pageJoin(ctx, reglages, { valeurs: brut, source, coiffeurs, posteId, prestations, tarifaIds, messageGlobal: err.message }));
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

/* ------------------------------------------------------------------ */
/*  L'ecran du salon                                                   */
/* ------------------------------------------------------------------ */

/**
 * LA PAGE A AFFICHER SUR L'ECRAN DU SALON.
 *
 * Elle est faite pour un televiseur accroche au mur, lu depuis un fauteuil a
 * quatre metres, et laissee allumee toute la journee. Tout en decoule.
 *
 *   - AUCUN COMPTE. Un televiseur ne se reconnecte pas quand une session
 *     expire, et une session eternelle sur un appareil que tout le salon
 *     manipule serait pire que pas de session. L'adresse est donc publique,
 *     et c'est la projection « pantalla » qui garantit ce qui en sort :
 *     numero, prenom, fauteuil. Jamais un telephone, jamais un jeton.
 *   - AUCUN GESTE. Rien a cliquer, rien a faire defiler. Ce qui ne tient pas
 *     a l'ecran n'est pas affiche, et le compte de ce qui manque est dit.
 *   - LE QR EN PERMANENCE. C'est la vraie raison d'etre de cet ecran : un
 *     client debout dans la salle voit la file avancer ET peut prendre son
 *     tour dans le meme regard.
 *
 * Elle est servie sans JavaScript aussi : le premier etat est rendu par le
 * serveur. Le script ne fait que la tenir a jour. Un ecran qui perd son
 * script affiche donc l'etat du chargement, pas une page vide.
 */
siteRoutes.get('/pantalla', async (ctx) => {
  // La meme cle que le flux, et pour la meme raison : une page ouverte dont le
  // flux est ferme afficherait un ecran vide sans dire pourquoi.
  await exigerClePantalla(ctx);
  const reglages = await lireTous();
  const jour = jourLocal();
  const [etat, adresse] = await Promise.all([chargerEtat(jour), adresseDuQr(ctx)]);
  const vue = pourPantalla(etat);
  const qr = encoder(adresse, { niveau: 'Q' });

  const corps = '<main class="pantalla" id="principal" data-pantalla>'
    + '<header class="pantalla__entete">'
    + marque({ taille: 'petit', lien: false })
    + '<p class="pantalla__horloge" data-horloge aria-hidden="true"></p>'
    + '</header>'
    // Le contenu vivant est remplace en bloc par le script. Le serveur en pose
    // la premiere version : un ecran sans JavaScript reste juste au chargement.
    + '<div class="pantalla__corps" data-corps>' + corpsPantalla(vue) + '</div>'
    + '<footer class="pantalla__pied">'
    + '<div class="pantalla__qr">' + versSvg(qr, { titre: 'Escanear para pedir turno', marge: 1 }) + '</div>'
    + '<div class="pantalla__appel">'
    + '<p class="pantalla__appel-titre">Pide tu turno</p>'
    + '<p class="pantalla__appel-texte">Escanea el código y sigue tu posición en el móvil.</p>'
    + '</div>'
    + '<p class="pantalla__hors-ligne" data-hors-ligne hidden>Sin conexión</p>'
    + '</footer>'
    + '</main>';

  ctx.html(200, page({
    titre: 'Pantalla — ' + reglages['salon.nom'],
    description: 'La fila del salón, en directo.',
    corps,
    base: ctx.base,
    chemin: '/pantalla',
    robots: 'noindex, nofollow, noarchive',
    classe: 'theme-sombre page-pantalla',
    scripts: ['/js/pantalla.js'],
    pied: '',
  }));
}, { public: true });

/**
 * Le contenu vivant de l'ecran.
 *
 * Ecrit ici ET repris a l'identique dans `public/js/pantalla.js` : le serveur
 * rend la premiere image, le script rend les suivantes. Les deux doivent
 * produire la meme chose, et c'est un test qui le verifie — deux mises en page
 * qui divergent donnent un ecran qui saute a la premiere mise a jour.
 */
function corpsPantalla(vue) {
  const carte = (t, classe) => '<li class="tour ' + classe + '">'
    + '<span class="tour__numero">' + escapeHtml(t.numero) + '</span>'
    + (t.prenom ? '<span class="tour__prenom">' + escapeHtml(t.prenom) + '</span>' : '')
    + (t.poste ? '<span class="tour__poste">' + escapeHtml(t.poste) + '</span>' : '')
    + '</li>';

  // LES DEUX FAUTEUILS RESTENT VISIBLES. Une premiere version ne montrait que
  // les appeles, et celui qui etait deja au fauteuil disparaissait de l'ecran
  // des qu'on appelait quelqu'un d'autre — dans un salon a deux fauteuils,
  // c'est la moitie de l'information qui s'efface. Les appeles passent devant,
  // eux seuls clignotent, et le nom du fauteuil dit qui est ou.
  const enVedette = vue.appeles.map((t) => carte(t, 'tour--appele'))
    .concat(vue.auFauteuil.map((t) => carte(t, 'tour--service')));

  const vedette = enVedette.length
    ? '<section class="pantalla__vedette">'
      + '<p class="pantalla__label">'
      + (vue.appeles.length
        ? (vue.appeles.length > 1 ? 'Es vuestro turno' : 'Es tu turno')
        : 'En el sillón')
      + '</p>'
      + '<ul class="tours tours--vedette">' + enVedette.join('') + '</ul>'
      + '</section>'
    : '<section class="pantalla__vedette pantalla__vedette--vide">'
      + '<p class="pantalla__label">' + (vue.ouverte ? 'Sillón libre' : 'Jornada cerrada') + '</p>'
      + '<p class="pantalla__vide">' + (vue.ouverte ? 'Pasa cuando quieras.' : 'Hasta mañana.') + '</p>'
      + '</section>';

  const suite = vue.attente.length
    ? '<section class="pantalla__suite">'
      + '<p class="pantalla__label">Siguientes</p>'
      + '<ul class="tours tours--suite">' + vue.attente.map((t) => carte(t, 'tour--attente')).join('') + '</ul>'
      + (vue.deplus ? '<p class="pantalla__deplus">y ' + vue.deplus + ' más</p>' : '')
      + '</section>'
    : '<section class="pantalla__suite pantalla__suite--vide">'
      + '<p class="pantalla__label">Siguientes</p>'
      + '<p class="pantalla__vide">Nadie esperando.</p>'
      + '</section>';

  const chiffres = '<section class="pantalla__chiffres">'
    + '<p><strong>' + vue.enAttente + '</strong> ' + (vue.enAttente === 1 ? 'esperando' : 'esperando') + '</p>'
    + (vue.enAttente ? '<p><strong>~' + vue.attenteEstimeeMinutes + '</strong> min</p>' : '')
    + '<p><strong>' + vue.servis + '</strong> hoy</p>'
    + '</section>';

  return vedette + suite + chiffres;
}

export const _corpsPantalla = corpsPantalla;
