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
import { consommerPriseDeTour, consume, PROFILES, suiviBloque, noterEchecSuivi, consommerJeton } from '../core/ratelimit.js';
import {
  lireTous, adressePublique, horairesLisibles, nomDuSalon, estOuvert, plagesDuJour, themeCourant,
} from '../core/reglages.js';
import { jetonPlausible } from '../core/crypto.js';
import { jourLocal, attenteNue, dateLongue, jourSemaine, minutesDepuisMinuit, jourRelatif } from '../core/temps.js';
import { traduire, t, langueActive } from '../core/langue.js';
import { encoder, versSvg, versMatrice } from '../core/qrcode.js';
import { pngNoirEtBlanc } from '../core/png.js';
import {
  prendreTour, ticketParJeton, chargerEtat, pourClient, pourPantalla, etatPriseDeTour, attenteNouvelArrivant,
} from '../domain/file.js';
import { pourVitrine as photosVitrine } from '../domain/photos.js';
import { programme as programmeFidelite } from '../domain/fidelite.js';
import { carteFidelite, sectionFidelite } from './fidelite.js';
import { etatPourTicket, deposer as deposerAvis, publies as avisPublies } from '../domain/avis.js';
import { blocAvis, sectionAvis, noteEnLigne } from './avis.js';
import {
  ouverture, ouvertureImages, ficheTete, mosaique, reperes, pastilleEtat, engagementsDe, sectionEngagements, sectionRituel, sectionInvitation, sectionMaison, sectionCarte, sectionReserver, sectionEquipe, sectionGalerie,
  sectionLieu, horairesDuJour, etatDuMoment,
} from './vitrine.js';
import { pourVitrine } from '../domain/tarifas.js';
import { page, marque, entete, piedDePage, pageErreur } from './mise-en-page.js';
import { filet, icone } from './ornements.js';
import { listerActifs as listerPostesActifs } from '../domain/postes.js';
import { prochainesHeures } from '../domain/rendezvous.js';
import { exigerClePantalla } from '../routes/public.js';

export const siteRoutes = new Router();

/**
 * Le traducteur du salon, quand l appelant n en fournit pas.
 *
 * Toutes les sections recoivent leur traducteur de la route, qui l a tire des
 * reglages : c est explicite, et un test de rendu dit alors dans quelle langue
 * il demande la page. Ce defaut est la pour qu un oubli donne une page dans la
 * langue du salon plutot qu une page blanche — un « tr is not a function » au
 * milieu du rendu emporterait la vitrine entiere pour un mot manquant.
 */
const duSalon = () => traduire(langueActive());

/* ------------------------------------------------------------------ */
/*  Accueil                                                            */
/* ------------------------------------------------------------------ */


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
function bandeauFermeture(prise, aujourdhui, tr = duSalon()) {
  if (!prise.ouverte && prise.code === 'SALON_EN_CONGES' && prise.fermeture) {
    const jusqua = prise.fermeture.au;
    return '<section class="bandeau-conges">'
      + '<div class="alerte-conges alerte-conges--maintenant" role="status">'
      + '<span class="alerte-conges__pastille">' + escapeHtml(tr('commun.ferme')) + '</span>'
      + '<p class="alerte-conges__titre">' + escapeHtml(tr('conges.ferme'))
      + (prise.fermeture.motif ? ' — ' + escapeHtml(prise.fermeture.motif) : '')
      + '</p>'
      + '<p class="alerte-conges__texte">'
      + escapeHtml(tr('conges.reouverture', { date: dateLongue(lendemain(jusqua), tr.langue) })) + '</p>'
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
  const titre = jours === 0 ? tr('conges.fermonsAujourdhui')
    : jours === 1 ? tr('conges.fermonsDemain')
      : proche ? tr('conges.fermonsDans', { n: jours })
        : tr('conges.prochaineFermeture');

  return '<section class="bandeau-conges">'
    + '<div class="alerte-conges' + (proche ? ' alerte-conges--proche' : ' alerte-conges--loin') + '" role="status">'
    + (proche ? '<span class="alerte-conges__pastille">' + escapeHtml(tr('commun.avis')) + '</span>' : '')
    + '<p class="alerte-conges__titre">' + escapeHtml(titre)
    + (f.motif ? ' — ' + escapeHtml(f.motif) : '') + '</p>'
    + '<p class="alerte-conges__texte">' + escapeHtml(tr('conges.periode', {
      du: dateLongue(f.du, tr.langue),
      au: dateLongue(f.au, tr.langue),
      retour: dateLongue(lendemain(f.au), tr.langue),
    })) + '</p>'
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
 * LA VITRINE.
 *
 * Deux facons de venir, chacune activable : le RENDEZ-VOUS (les prochaines
 * heures libres, en lien direct) et la FILE (l'attente en direct, et le
 * formulaire). L'appel principal est le rendez-vous quand il est ouvert : c'est
 * ce que cherche le client d'une maison qui en prend.
 */
siteRoutes.get('/', async (ctx) => {
  const r = await lireTous();
  const tr = traduire(r['salon.idioma']);
  const nom = r['salon.nom'];
  const theme = themeCourant();
  const avecTarifs = r['tarifas.visible'];
  const fileEnLigne = Boolean(r['accueil.file']);
  const aujourdhui = jourLocal();

  const [etat, prise, prestations, galeriePhotos, postes] = await Promise.all([
    fileEnLigne ? chargerEtat(aujourdhui) : Promise.resolve(null),
    etatPriseDeTour(),
    pourVitrine(),
    photosVitrine(),
    listerPostesActifs(),
  ]);

  // L'etat du moment : seulement si le salon a declare ses horaires.
  const jourCourant = jourSemaine();
  const horairesActifs = Boolean(r['horaires.actifs']);
  const maintenant = horairesActifs ? estOuvert(r, jourCourant, minutesDepuisMinuit()) : null;
  const etatMoment = etatDuMoment({ tr, horaires: maintenant, prise });
  const semaine = horairesActifs ? horairesLisibles(r, tr.langue) : null;

  // --- les rendez-vous
  let rdv = null;
  if (r['rdv.actifs']) {
    const premiere = prestations.find((p) => p.reservable);
    const { etat: etatRdv, heures } = await prochainesHeures({ n: 6, duree: premiere ? premiere.duracionMin : r['file.dureeMoyenneMinutes'] });
    rdv = {
      ouvert: etatRdv.ouvert,
      prochains: heures.map((h) => ({
        href: '/rendez-vous?jour=' + h.jour + '&heure=' + encodeURIComponent(h.heure),
        jour: jourRelatif(h.jour, aujourdhui, tr.langue),
        heure: h.heure,
      })),
      fermeture: etatRdv.ouvert ? null : tr('rdv.ferme.' + etatRdv.raison),
    };
  }
  const rdvOuvert = Boolean(rdv && rdv.ouvert);

  // --- la file
  let file = null;
  // Les accueils « fiche » et « en images » ouvrent le formulaire du tour dans
  // une FENETRE, par-dessus la page : on ne quitte pas la vitrine pour prendre
  // son tour. Sans script, le lien mene a /join comme avant.
  const enFenetre = ['FICHE', 'IMAGES'].includes(r['marque.accueil']) && fileEnLigne && prise.ouverte;
  const formulaireEnPage = !enFenetre && fileEnLigne && prise.ouverte && !rdvOuvert;
  let fenetreTour = '';
  if (fileEnLigne) {
    const attente = attenteNouvelArrivant(etat);
    const direct = '<p class="direct" data-affluence>'
      + '<span class="direct__pouls" aria-hidden="true"></span>'
      + '<span class="direct__forte" data-forte>' + escapeHtml(etat.compteurs.enAttente === 0
        ? tr('accueil.sansAttente') : tr('accueil.enFile', { n: etat.compteurs.enAttente })) + '</span>'
      + '<span class="direct__detail" data-detail>' + escapeHtml(etat.compteurs.enAttente === 0
        ? tr('accueil.sansAttenteDetail') : tr('accueil.attenteEstimee', { duree: '≈ ' + attenteNue(attente, tr.langue) })) + '</span>'
      + '</p>';
    const coiffeurs = formulaireEnPage || enFenetre ? await coiffeursProposes(r) : [];
    if (enFenetre) {
      fenetreTour = '<dialog class="fenetre-tour" data-fenetre-tour aria-labelledby="titre-fenetre-tour">'
        + '<div class="fenetre-tour__tete">'
        + '<div><h2 class="fenetre-tour__titre" id="titre-fenetre-tour">' + escapeHtml(tr('mx.fenetre.titre')) + '</h2>'
        + '<p class="fenetre-tour__texte">' + escapeHtml(tr('mx.fenetre.texte')) + '</p></div>'
        + '<button class="fenetre-tour__fermer" type="button" data-fermer-fenetre aria-label="' + escapeHtml(tr('mx.fenetre.fermer')) + '">' + icone('croix') + '</button>'
        + '</div>'
        + direct
        + formulaire({ source: 'ONLINE', coiffeurs, prestations, tr, avecPrix: avecTarifs })
        + '</dialog>';
    }
    file = {
      ouverte: prise.ouverte,
      statut: prise.ouverte ? direct : '',
      message: prise.ouverte ? '' : tr(prise.code === 'SALON_EN_CONGES' ? 'accueil.salonFerme' : 'accueil.plusDeTours') + ' — ' + (prise.message || ''),
      formulaire: formulaireEnPage
        ? formulaire({ source: 'ONLINE', coiffeurs, prestations, tr, avecPrix: avecTarifs })
        : null,
    };
  }

  // --- l'equipe : seulement les fauteuils qui portent un nom de personne
  const membres = r['vitrine.equipe']
    ? postes.filter((p) => p.coiffeur && p.coiffeur.trim()).map((p) => ({ id: p.id, nom: p.coiffeur.trim(), rdv: p.rdv }))
    : [];

  // --- les actions de l'ouverture
  const actions = [];
  if (rdvOuvert) actions.push({ href: '/rendez-vous', texte: tr('mx.une.rdv'), principal: true });
  if (fileEnLigne && prise.ouverte) {
    actions.push({ href: formulaireEnPage ? '#reserver' : '/join', texte: tr('mx.une.tour'), principal: !rdvOuvert });
  }
  if (actions.length < 2 && avecTarifs && prestations.length) actions.push({ href: '#carte', texte: tr('mx.une.carte'), principal: !actions.length });
  const principale = actions.find((a) => a.principal) || null;

  const pastilles = (etatMoment ? pastilleEtat(etatMoment) : '')
    + (fileEnLigne && prise.ouverte
      ? pastilleEtat({
        classe: 'file',
        texte: etat.compteurs.enAttente === 0 ? tr('accueil.sansAttente') : tr('accueil.enFile', { n: etat.compteurs.enAttente }),
        attributs: ' data-affluence-court',
      })
      : '');

  const photos = r['vitrine.galerie'] ? galeriePhotos.photos : [];
  // L'accueil « en images » : la couverture d'abord, puis les photos de la
  // galerie, sans doublon. Trois pour le collage, la suivante pour « la maison ».
  const enImages = r['marque.accueil'] === 'IMAGES';
  const enFiche = r['marque.accueil'] === 'FICHE';
  const aLaUne = [];
  for (const p of [galeriePhotos.couverture, ...photos]) {
    if (p && !aLaUne.some((x) => x.src === p.src)) aLaUne.push(p);
  }
  const avecLieu = r['vitrine.localisation'] && Boolean(r['salon.adresse'] || r['salon.coordenadas']);
  const avecContact = r['vitrine.contact'] && Boolean(r['salon.telephone'] || r['salon.whatsapp'] || horairesActifs);
  const avecCarte = avecTarifs && prestations.length > 0;

  const sections = [
    String(r['salon.presentation'] || '').trim() ? { ancre: 'maison', cle: 'vt.nav.maison' } : null,
    avecCarte ? { ancre: 'carte', cle: 'vt.nav.carte' } : null,
    rdv || file ? { ancre: 'reserver', cle: rdv ? 'vt.nav.reserver' : 'vt.nav.file' } : null,
    membres.length ? { ancre: 'equipe', cle: 'vt.nav.equipe' } : null,
    photos.length ? { ancre: 'galerie', cle: 'vt.nav.galerie' } : null,
    avecLieu || avecContact ? { ancre: 'acces', cle: 'vt.nav.contact' } : null,
  ].filter(Boolean);

  const telephone = r['salon.telephone'];
  const avis = r['vitrine.avis'] ? await avisPublies() : null;
  const engagements = (enImages || enFiche) && r['vitrine.engagements']
    ? engagementsDe({ tr, activite: r['marque.activite'], ecrits: r['salon.engagements'] })
    : [];
  const actionFinale = principale && principale.href !== '#carte' ? principale : null;
  const lieu = sectionLieu({
    tr,
    avecLieu,
    avecContact,
    adresse: r['salon.adresse'],
    coordonnees: r['salon.coordenadas'],
    commentVenir: r['salon.comoLlegar'],
    telephone,
    whatsapp: r['salon.whatsapp'],
    horaires: semaine,
    jourCourant,
  });
  const reserver = sectionReserver({ tr, rdv: rdv && (rdv.ouvert || rdv.fermeture) ? rdv : null, file });
  const fidelite = sectionFidelite({ tr, programme: await programmeFidelite(r) });

  // L'ACCUEIL « FICHE » : l'identite et la note, les photos, puis deux
  // colonnes — ce que le salon propose a gauche, de quoi venir a droite.
  const pageFiche = enFiche
    ? '<div class="salon__dedans">'
      + ficheTete({
        tr,
        nom,
        metier: tr('mx.une.metier'),
        accroche: r['salon.accroche'],
        note: noteEnLigne({ tr, avis }),
        adresse: avecLieu ? r['salon.adresse'] : null,
        reperes: pastilles,
        actions,
        instagram: r['salon.instagram'] || null,
        // Seulement ce que l'application GARANTIT : pas une promesse du salon.
        atouts: rdvOuvert
          ? [
            tr('mx.fiche.atout.confirmation'),
            tr('mx.fiche.atout.sansCompte'),
            Number(r['rdv.annulationHeures']) > 0 ? tr('mx.fiche.atout.annulation', { n: r['rdv.annulationHeures'] }) : tr('mx.fiche.atout.annulationLibre'),
            tr('mx.fiche.atout.surPlace'),
          ]
          : (fileEnLigne && prise.ouverte ? [tr('mx.fiche.atout.tour'), tr('mx.fiche.atout.sansCompte'), tr('mx.fiche.atout.surPlace')] : []),
      })
      + mosaique({ tr, photos: aLaUne, lettres: theme.monogramme })
      + '</div>'
      + bandeauFermeture(prise, aujourdhui, tr)
      + '<div class="salon__dedans salon__corps" id="apres-une">'
      + '<div class="salon__principal">'
      + (avecCarte ? sectionCarte({ tr, prestations, nota: r['tarifas.nota'], avecPrix: avecTarifs, lignes: true, reserver: rdvOuvert }) : '')
      + fidelite
      + sectionEngagements({ tr, engagements })
      + sectionEquipe({ tr, membres, rdvActifs: rdvOuvert, titre: tr('mx.fiche.collaborateurs') })
      + sectionAvis({ tr, avis, langue: tr.langue })
      + sectionMaison({ tr, presentation: r['salon.presentation'], lettres: theme.monogramme, sobre: true })
      + '</div>'
      + '<aside class="salon__cote">' + reserver + lieu + '</aside>'
      + '</div>'
    : '';

  const corps = entete({
    sections,
    action: principale && principale.href !== '#carte' ? { href: principale.href === '#reserver' ? '/#reserver' : principale.href, texte: principale.texte } : null,
    surImage: !enImages && !enFiche && Boolean(galeriePhotos.couverture),
  })
    + '<main id="principal" class="vitrine' + (enFiche ? ' salon' : '') + '">'
    + (enFiche ? pageFiche : (enImages
      ? ouvertureImages({
        tr,
        nom,
        accroche: r['salon.accroche'],
        metier: tr('mx.une.metier'),
        actions,
        reperes: pastilles,
        photos: aLaUne.slice(0, 3),
        lettres: theme.monogramme,
        prochain: rdvOuvert && rdv.prochains.length ? rdv.prochains[0] : null,
        atouts: engagements.slice(0, 3).map((x) => x.titre),
        note: noteEnLigne({ tr, avis }),
      })
      : ouverture({
        tr,
        nom,
        accroche: r['salon.accroche'],
        metier: tr('mx.une.metier'),
        actions,
        reperes: pastilles,
        couverture: galeriePhotos.couverture,
        lettres: theme.monogramme,
      }))
    + bandeauFermeture(prise, aujourdhui, tr)
    + reperes({
      tr,
      aujourdhui: horairesDuJour({ tr, plages: plagesDuJour(r, jourCourant), actifs: horairesActifs }),
      adresse: avecLieu ? r['salon.adresse'] : null,
      telephone: avecContact ? telephone : null,
    })
    // En images, la galerie vient TOUT DE SUITE : c'est elle qui vend.
    + (enImages ? sectionGalerie({ tr, photos, ruban: true }) : '')
    + sectionEngagements({ tr, engagements })
    + sectionMaison({ tr, presentation: r['salon.presentation'], lettres: theme.monogramme, photo: enImages ? (aLaUne[3] || aLaUne[0] || null) : null })
    + (avecCarte ? sectionCarte({ tr, prestations, nota: r['tarifas.nota'], avecPrix: avecTarifs, fiches: enImages, reserver: rdvOuvert }) : '')
    + fidelite
    + (enImages && rdvOuvert && r['vitrine.etapes'] ? sectionRituel({ tr }) : '')
    + reserver
    + sectionEquipe({ tr, membres, rdvActifs: rdvOuvert })
    + (enImages ? '' : sectionGalerie({ tr, photos }))
    + sectionAvis({ tr, avis, langue: tr.langue })
    + (enImages ? sectionInvitation({ tr, action: actionFinale, telephone: avecContact ? telephone : null }) : '')
    + lieu)
    // L'appel qui suit le pouce, sur telephone : seulement quand il mene
    // vraiment quelque part.
    + (principale && principale.href !== '#carte'
      ? '<div class="appel-fixe" data-appel-fixe><a class="bouton bouton--principal bouton--large" href="' + escapeHtml(principale.href) + '">'
        + escapeHtml(principale.texte) + '</a></div>'
      : '')
    + fenetreTour
    + '</main>';

  ctx.html(200, page({
    titre: tr('accueil.titre', { nom }),
    description: tr('accueil.description', { nom }),
    corps,
    base: ctx.base,
    chemin: '/',
    langue: tr.langue,
    classe: 'page-accueil' + (enImages ? ' accueil-images' : '') + (enFiche ? ' accueil-fiche' : ''),
    image: galeriePhotos.couverture ? galeriePhotos.couverture.src : null,
    scripts: formulaireEnPage || enFenetre ? ['/js/maison.js', '/js/join.js'] : ['/js/maison.js'],
    pied: piedDePage({
      horaires: semaine,
      adresse: r['salon.adresse'] || null,
      telephone: telephone || null,
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

/**
 * LES TROIS CHAMPS, CONSTRUITS A CHAQUE RENDU.
 *
 * C'etait un tableau constant, et son aide disait « no hace falta escribir +34 »
 * — l'indicatif espagnol, ecrit en dur. Un client de Casablanca aurait lu qu'il
 * n'a pas besoin du prefixe espagnol, ce qui est vrai et parfaitement inutile.
 * L'indicatif vient maintenant de la configuration du serveur, celle qui sert
 * aussi a enregistrer le numero.
 */
const champsDuFormulaire = (tr) => [
  { nom: 'prenom', libelle: tr('join.champPrenom'), autocomplete: 'given-name', type: 'text', inputmode: 'text', max: 40, exemple: 'Ahmed' },
  { nom: 'nom', libelle: tr('join.champNom'), autocomplete: 'family-name', type: 'text', inputmode: 'text', max: 40, exemple: 'Benali' },
  {
    nom: 'telephone',
    libelle: tr('join.champTelephone'),
    autocomplete: 'tel',
    type: 'tel',
    inputmode: 'tel',
    max: 25,
    exemple: '612 345 678',
    motif: MOTIF_TELEPHONE,
    aide: tr('join.aideTelephone', { indicatif: config.indicatifDefaut }),
  },
];

/**
 * Le choix du coiffeur, en file par coiffeur.
 *
 * Des vignettes, pas une liste deroulante : le client doit voir d'un coup
 * combien de monde attend chez chacun, et choisir en connaissance de cause.
 * C'est la seule information qui l'aide vraiment.
 */
function choixDuCoiffeur(coiffeurs, choisi, tr = duSalon()) {
  const cartes = coiffeurs.map((c, i) => {
    const id = 'coiffeur-' + c.id;
    const coche = choisi ? choisi === c.id : i === 0;
    return '<label class="coiffeur" for="' + id + '">'
      + '<input class="coiffeur__choix" type="radio" name="posteId" id="' + id + '" '
      + 'value="' + escapeHtml(c.id) + '"' + (coche ? ' checked' : '') + ' required>'
      + '<span class="coiffeur__nom">' + escapeHtml(c.nom) + '</span>'
      + '<span class="coiffeur__attente">'
      + escapeHtml(c.enAttente === 0
        ? tr('join.coiffeurLibre')
        : tr('join.coiffeurAttente', {
          n: c.enAttente, duree: attenteNue(c.attenteEstimeeMinutes, tr.langue),
        }))
      + '</span>'
      + '</label>';
  }).join('');

  // Volontairement HORS de la classe « champ » : les regles de champ
  // (majuscules, hauteur de saisie, largeur pleine) s'appliqueraient au
  // libelle et au bouton radio, et donneraient un radio de la taille d'un
  // champ de texte.
  return '<fieldset class="bloc-coiffeurs">'
    + '<legend class="bloc-coiffeurs__titre">' + escapeHtml(tr('join.coiffeurTitre')) + '</legend>'
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
/*
 * `avecPrix` : faux quand le gerant a choisi de NE PAS publier ses tarifs.
 * Le formulaire garde alors les prestations et leur duree — c'est ce qui rend
 * l'attente juste — mais plus aucun montant. Il les affichait quand meme, si
 * bien que masquer la fiche de prix ne masquait rien.
 */
function choixDesPrestations(prestations, choisies, tr = duSalon(), { avecPrix = true } = {}) {
  if (!prestations.length) return '';
  const cochees = new Set(choisies || []);

  const lignes = prestations.map((p) => {
    const id = 'presta-' + p.id;
    return '<li>'
      + '<input class="presta__case" type="checkbox" id="' + escapeHtml(id) + '" name="tarifaIds" '
      + 'value="' + escapeHtml(p.id) + '" data-minutos="' + p.duracionMin + '"'
      + (avecPrix ? ' data-precio="' + p.precioCts + '"' : '') + (cochees.has(p.id) ? ' checked' : '') + '>'
      + '<label class="presta" for="' + escapeHtml(id) + '">'
      + '<span class="presta__nombre">' + escapeHtml(p.nombre) + '</span>'
      + '<span class="presta__meta">' + p.duracionMin + ' min' + (avecPrix ? ' · ' + escapeHtml(p.precio) : '') + '</span>'
      + '</label>'
      + '</li>';
  }).join('');

  return '<fieldset class="prestas">'
    + '<legend class="prestas__titre">' + escapeHtml(tr('join.prestationsTitre'))
    + ' <span class="prestas__facultatif">' + escapeHtml(tr('join.prestationsFacultatif')) + '</span></legend>'
    + '<p class="prestas__aide">' + escapeHtml(tr('join.prestationsAide')) + '</p>'
    + '<ul class="prestas__liste">' + lignes + '</ul>'
    + '<p class="prestas__total" data-presta-total hidden></p>'
    + '</fieldset>';
}

function formulaire({
  valeurs = {}, erreurs = {}, source = 'ONLINE', messageGlobal = null,
  coiffeurs = [], posteId = null, prestations = [], tarifaIds = [], tr = duSalon(), avecPrix = true,
}) {
  const champs = champsDuFormulaire(tr).map((c) => {
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
    + (coiffeurs.length ? choixDuCoiffeur(coiffeurs, posteId, tr) : '')
    + choixDesPrestations(prestations, tarifaIds, tr, { avecPrix })
    + champs
    + '<button class="bouton bouton--principal bouton--large" type="submit">'
    + escapeHtml(tr('join.envoyer')) + '</button>'
    + '<p class="formulaire__note">'
    + escapeHtml(tr(config.whatsapp.actif ? 'join.noteAvecWhatsapp' : 'join.noteSansWhatsapp'))
    + '</p>'
    + '</form>';
}

function pageJoin(ctx, reglages, options) {
  const { prise = null } = options;
  const tr = traduire(reglages['salon.idioma']);
  const telephone = reglages['salon.telephone'];
  const appeler = telephone
    ? '<a class="bouton bouton--contour" href="tel:' + escapeHtml(telephone.replace(/[^+0-9]/g, '')) + '">'
      + escapeHtml(tr('commun.appelerSalon')) + '</a>'
    : '';
  // Salon ferme, file coupee, ou salon sur rendez-vous : pas de formulaire du
  // tout. Rien n'est plus agacant qu'un formulaire qu'on remplit pour se voir
  // refuser a la validation.
  const horsLigne = prise && prise.code === 'FILE_HORS_LIGNE';
  const contenu = prise && !prise.ouverte
    ? '<section class="carte carte--centree carte--avis">'
      + '<p class="surtitre">' + escapeHtml(tr(horsLigne ? 'mx.rdv.titre' : (prise.code === 'SALON_EN_CONGES' ? 'commun.conges' : 'commun.ferme'))) + '</p>'
      + '<h1 class="titre-page">'
      + escapeHtml(tr(horsLigne ? 'join.horsLigneTitre' : (prise.code === 'SALON_EN_CONGES' ? 'join.fermeTitre' : 'accueil.plusDeTours'))) + '</h1>'
      + filet()
      + '<p class="texte-doux">' + escapeHtml(prise.message) + '</p>'
      + '<div class="carte__actions">'
      + (horsLigne && reglages['rdv.actifs'] ? '<a class="bouton bouton--principal" href="/rendez-vous">' + escapeHtml(tr('mx.une.rdv')) + '</a>' : '')
      + appeler
      + '<a class="bouton ' + (horsLigne && reglages['rdv.actifs'] ? 'bouton--lien' : 'bouton--principal') + '" href="/">' + escapeHtml(tr('commun.retourAccueil')) + '</a>'
      + '</div>'
      + '</section>'
    : '<header class="page__tete">'
      + '<p class="surtitre">' + escapeHtml(tr('mx.file.titre')) + '</p>'
      + '<h1 class="titre-page">' + escapeHtml(tr('join.h1')) + '</h1>'
      + filet()
      + '<p class="page__chapo">' + escapeHtml(tr('join.sousTitre')) + '</p>'
      + '</header>'
      + '<section class="carte carte--formulaire">' + formulaire({ ...options, tr, avecPrix: Boolean(reglages['tarifas.visible']) }) + '</section>';

  const corps = entete({ retour: { href: '/', texte: tr('commun.accueil') } })
    + '<main class="page page--etroite" id="principal">'
    + contenu
    + '</main>';
  return page({
    titre: tr('join.titre', { nom: reglages['salon.nom'] }),
    description: tr('join.description', { nom: reglages['salon.nom'] }),
    corps,
    base: ctx.base,
    chemin: '/join',
    langue: tr.langue,
    classe: 'page-join',
    scripts: ['/js/join.js'],
    pied: piedDePage({ adresse: reglages['salon.adresse'] || null, telephone: telephone || null }),
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
    { ip: ctx.ipDebit, telephone: data.telephone },
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

function blocTicket(vue, tr = duSalon()) {
  const ton = TONS[vue.ton] || 'attente';
  return '<section class="ticket ticket--' + ton + '" data-ticket>'
    + '<span class="ticket__encoche ticket__encoche--g" aria-hidden="true"></span><span class="ticket__encoche ticket__encoche--d" aria-hidden="true"></span>'
    + '<p class="surtitre ticket__label">' + escapeHtml(tr('ticket.label')) + '</p>'
    + '<p class="ticket__prenom" data-prenom>' + escapeHtml(vue.prenom) + '</p>'
    + '<p class="ticket__numero" data-numero>' + escapeHtml(vue.numero) + '</p>'
    + (vue.coiffeur
      ? '<p class="ticket__coiffeur" data-coiffeur>' + escapeHtml(tr('ticket.avecCoiffeur', { nom: vue.coiffeur })) + '</p>'
      : '')
    + '<div class="ticket__etat" data-etat>'
    + '<p class="ticket__titre" data-titre>' + escapeHtml(vue.titre) + '</p>'
    + '<p class="ticket__detail" data-detail>' + escapeHtml(vue.detail) + '</p>'
    + '</div>'
    + '<dl class="ticket__chiffres">'
    + '<div><dt>' + escapeHtml(tr('ticket.devant')) + '</dt><dd data-devant>' + vue.devant + '</dd></div>'
    + '<div><dt>' + escapeHtml(tr('ticket.estimation')) + '</dt><dd data-estimation>' + escapeHtml(vue.estimationCourte) + '</dd></div>'
    + '</dl>'
    + (vue.retards > 0
      ? '<p class="ticket__note">' + escapeHtml(tr('ticket.noteRetard')) + '</p>'
      : '')
    + '</section>';
}

/**
 * LE CLIENT DONNE SON AVIS, depuis la page de son tour. Son lien est sa preuve
 * de visite ; le domaine verifie qu'il a ete servi et qu'il n'a pas deja note.
 */
siteRoutes.post('/ticket/:jeton/avis', async (ctx) => {
  const reglages = await lireTous();
  const tr = traduire(reglages['salon.idioma']);
  const jeton = String(ctx.params.jeton || '');
  const refus = (statut, titre, message) => ctx.html(statut, pageErreur({ base: ctx.base, statut, titre, message }));
  if (!suiviBloque(ctx.ipDebit).allowed || !consommerJeton('avis:' + jeton, PROFILES.suivi).allowed) {
    return refus(429, tr('erreur.tropDeDemandes'), tr('erreur.tropDeDemandesTexte'));
  }
  const ticket = jetonPlausible(jeton) ? await ticketParJeton(jeton) : null;
  if (!ticket || !reglages['vitrine.avis']) {
    if (!ticket) noterEchecSuivi(ctx.ipDebit);
    return refus(404, tr('erreur.lienInvalide'), tr('avis.introuvable'));
  }
  try {
    await deposerAvis({ ticketId: ticket.id, note: ctx.body?.note, commentaire: ctx.body?.commentaire });
  } catch (err) {
    if (!(err instanceof AppError)) throw err;
    const detail = err instanceof ValidationError ? Object.values(err.fields)[0] : err.message;
    return refus(err.status, tr('avis.refuse'), detail);
  }
  return ctx.redirect('/ticket/' + jeton + '?avis=merci', 303);
}, { public: true });

siteRoutes.get('/ticket/:jeton', async (ctx) => {
  const reglages = await lireTous();
  const tr = traduire(reglages['salon.idioma']);
  const jeton = String(ctx.params.jeton || '');

  const tropDeDemandes = (limite) => {
    ctx.res.setHeader('Retry-After', String(limite.retryAfterSeconds));
    ctx.html(429, pageErreur({
      base: ctx.base, statut: 429,
      titre: tr('erreur.tropDeDemandes'),
      message: tr('erreur.tropDeDemandesTexte'),
    }));
  };

  // Les echecs se paient par adresse, le volume par jeton : toute la salle
  // d'attente partage le wifi du salon (voir suiviBloque()).
  const bloque = suiviBloque(ctx.ipDebit);
  if (!bloque.allowed) return tropDeDemandes(bloque);

  const ticket = jetonPlausible(jeton) ? await ticketParJeton(jeton) : null;
  if (!ticket) {
    noterEchecSuivi(ctx.ipDebit);
    ctx.html(404, pageErreur({
      base: ctx.base, statut: 404,
      titre: tr('erreur.lienInvalide'),
      // Ne renvoyer le client vers WhatsApp que si des messages partent
      // vraiment : sinon on l'envoie chercher quelque chose qui n'existe pas.
      message: tr(config.whatsapp.actif
        ? 'erreur.lienInvalideWhatsapp'
        : 'erreur.lienInvalideSansWhatsapp'),
    }));
    return;
  }
  const limite = consommerJeton(jeton, PROFILES.suivi);
  if (!limite.allowed) return tropDeDemandes(limite);

  const etat = await chargerEtat(ticket.jour);
  const vue = pourClient(etat, ticket.id);
  const etatAvis = reglages['vitrine.avis'] ? await etatPourTicket(ticket.id) : 'NON';
  const dateDuJour = ticket.jour === jourLocal() ? null : dateLongue(ticket.jour, tr.langue);

  // Le lien de suivi EST le ticket : il n'y a pas de compte, pas de mot de
  // passe, rien d'autre. Un client qui ferme l'onglet sans l'avoir garde n'a
  // plus aucun moyen de retrouver sa position. On le lui montre donc en entier,
  // avec de quoi le copier ou se l'envoyer — et on insiste juste apres la
  // prise de tour, quand c'est le moment de le faire.
  const lien = ctx.base + '/ticket/' + jeton;
  const nouveau = ctx.queryBool('nouveau');

  const blocLien = vue.actif
    ? '<section class="lien' + (nouveau ? ' lien--neuf' : '') + '" data-bloc-lien>'
      + '<p class="lien__titre">' + escapeHtml(tr(nouveau ? 'ticket.gardeLien' : 'ticket.tonLien')) + '</p>'
      + '<p class="lien__texte">' + escapeHtml(tr('ticket.lienTexte')) + '</p>'
      + '<p class="lien__adresse" data-lien>' + escapeHtml(lien) + '</p>'
      + '<div class="lien__actions">'
      + '<button class="bouton bouton--principal" type="button" data-copier data-valeur="' + escapeHtml(lien) + '">'
      + icone('copier') + escapeHtml(tr('ticket.copier')) + '</button>'
      // « Envoyer » ouvre le partage du systeme, qui propose WhatsApp parmi
      // d'autres. Annoncer WhatsApp serait inexact sur un appareil qui ne l'a
      // pas installe.
      + '<button class="bouton bouton--contour" type="button" data-partager hidden>'
      + icone('partager') + escapeHtml(tr('ticket.envoyer')) + '</button>'
      + '</div>'
      + '<p class="lien__retour" role="status" hidden data-copie>' + escapeHtml(tr('ticket.copie')) + '</p>'
      + '</section>'
    : '';

  const corps = entete({ retour: { href: '/', texte: tr('commun.accueil') } })
    + '<main class="page page--etroite page--ticket" id="principal">'
    + (dateDuJour
      ? '<p class="surtitre surtitre--centre">' + escapeHtml(tr('ticket.tourDu', { date: dateDuJour })) + '</p>'
      : '')
    + blocTicket(vue, tr)
    + blocAvis({ tr, action: '/ticket/' + jeton + '/avis', etat: etatAvis, merci: ctx.query('avis') === 'merci' })
    + carteFidelite({ tr, carte: vue.fidelite })
    + blocLien
    + (vue.actif
      ? '<section class="carte carte--discrete">'
        + '<p class="texte-doux">' + escapeHtml(tr('ticket.sActualise')) + '</p>'
        + (vue.adresseSalon ? '<p class="texte-doux">' + escapeHtml(vue.adresseSalon) + '</p>' : '')
        + '<button class="bouton bouton--lien bouton--danger" type="button" data-annuler>' + escapeHtml(tr('ticket.annuler')) + '</button>'
        + '<p class="alerte alerte--refus" role="alert" hidden data-annuler-erreur></p>'
        + '</section>'
      : '<section class="carte carte--discrete">'
        + '<a class="bouton bouton--principal" href="/join">' + escapeHtml(tr('ticket.nouveauTour')) + '</a>'
        + '</section>')
    + '</main>';

  ctx.html(200, page({
    titre: tr('ticket.titre', { numero: vue.numero, nom: reglages['salon.nom'] }),
    description: tr('ticket.description', { nom: reglages['salon.nom'] }),
    corps,
    base: ctx.base,
    chemin: '/ticket/' + jeton,
    langue: tr.langue,
    // Un lien de suivi est un secret : il ne doit jamais entrer dans un index.
    robots: 'noindex, nofollow, noarchive',
    classe: 'page-suivi',
    scripts: ['/js/ticket.js'],
    donnees: { jeton, vue },
    pied: piedDePage({ adresse: reglages['salon.adresse'] || null, telephone: reglages['salon.telephone'] || null }),
  }));
}, { public: true });

/**
 * LA PAGE HORS LIGNE, aux couleurs de la marque. Le service worker la demande
 * une fois, a son installation, et la sert quand le reseau a disparu et
 * qu'aucune page n'a ete gardee.
 */
siteRoutes.get('/hors-ligne', async (ctx) => {
  const reglages = await lireTous();
  const tr = traduire(reglages['salon.idioma']);
  const corps = '<main class="page page--etroite" id="principal">'
    + '<section class="carte carte--centree carte--avis">'
    + marque({ taille: 'grand', lien: false })
    + filet()
    + '<h1 class="titre-page">' + escapeHtml(tr('commun.sansConnexion')) + '</h1>'
    + '<p class="texte-doux">' + escapeHtml(tr('horsLigne.texte')) + '</p>'
    + '<div class="carte__actions"><a class="bouton bouton--principal" href="">' + escapeHtml(tr('horsLigne.reessayer')) + '</a></div>'
    + '</section></main>';
  ctx.html(200, page({
    titre: tr('commun.sansConnexion') + ' — ' + reglages['salon.nom'],
    description: tr('horsLigne.texte'),
    corps,
    base: ctx.base,
    chemin: '/hors-ligne',
    langue: tr.langue,
    robots: 'noindex, nofollow',
    pied: '',
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
  // Un salon qui ne recoit QUE sur rendez-vous : son QR mene a la reservation.
  // Sinon, « /join?qr=1 », le contrat de toujours.
  const surRdv = reglages['accueil.file'] === false && reglages['rdv.actifs'];
  return adressePublique(reglages, ctx.base) + (surRdv ? '/rendez-vous' : '/join?qr=1');
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
  ctx.file(Buffer.from(versSvg(qr, { titre: t('affiche.sousTitre') }), 'utf8'), {
    filename: 'qr.svg',
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
    filename: 'qr.png',
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
  const tr = traduire(reglages['salon.idioma']);
  const adresse = await adresseDuQr(ctx);
  const qr = encoder(adresse, { niveau: 'Q' });
  const surRdv = reglages['accueil.file'] === false && reglages['rdv.actifs'];

  const corps = '<main class="affiche" id="principal">'
    + '<div class="affiche__feuille">'
    + marque({ taille: 'grand', lien: false })
    + filet()
    + '<p class="affiche__titre">' + escapeHtml(tr(surRdv ? 'affiche.accrocheRdv' : 'affiche.accroche')) + '</p>'
    + '<p class="affiche__sous-titre">' + escapeHtml(tr(surRdv ? 'affiche.sousTitreRdv' : 'affiche.sousTitre')) + '</p>'
    + '<div class="affiche__qr">' + versSvg(qr, { titre: tr('affiche.qrAlt'), marge: 2 }) + '</div>'
    + '<p class="affiche__mention">' + escapeHtml(tr('affiche.mention')) + '</p>'
    + '<p class="affiche__adresse">' + escapeHtml(adresse.replace(/^https?:\/\//, '')) + '</p>'
    + '</div>'
    + '<div class="affiche__outils">'
    + '<a class="bouton bouton--contour" href="/qr.svg?telecharger=1" download>' + escapeHtml(tr('affiche.telechargerSvg')) + '</a>'
    + '<a class="bouton bouton--contour" href="/qr.png?telecharger=1" download>' + escapeHtml(tr('affiche.telechargerPng')) + '</a>'
    + '<button class="bouton bouton--principal" type="button" data-imprimer>' + escapeHtml(tr('affiche.imprimer')) + '</button>'
    + '</div>'
    + '</main>';

  ctx.html(200, page({
    titre: tr('affiche.titre', { nom: reglages['salon.nom'] }),
    description: tr('affiche.description'),
    corps,
    base: ctx.base,
    chemin: '/affiche',
    langue: tr.langue,
    robots: 'noindex, nofollow',
    classe: 'page-affiche',
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
  const tr = traduire(reglages['salon.idioma']);
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
    + '<div class="pantalla__corps" data-corps>' + corpsPantalla(vue, tr) + '</div>'
    + '<footer class="pantalla__pied">'
    + '<div class="pantalla__qr">' + versSvg(qr, { titre: tr('affiche.qrAlt'), marge: 1 }) + '</div>'
    + '<div class="pantalla__appel">'
    + '<p class="pantalla__appel-titre">' + escapeHtml(tr(reglages['accueil.file'] === false && reglages['rdv.actifs'] ? 'affiche.accrocheRdv' : 'pantalla.prendreTour')) + '</p>'
    + '<p class="pantalla__appel-texte">' + escapeHtml(tr(reglages['accueil.file'] === false && reglages['rdv.actifs'] ? 'affiche.sousTitreRdv' : 'pantalla.prendreTourTexte')) + '</p>'
    + '</div>'
    + '<p class="pantalla__hors-ligne" data-hors-ligne hidden>' + escapeHtml(tr('commun.sansConnexion')) + '</p>'
    + '</footer>'
    + '</main>';

  ctx.html(200, page({
    titre: tr('pantalla.titre', { nom: reglages['salon.nom'] }),
    description: tr('pantalla.description'),
    corps,
    base: ctx.base,
    chemin: '/pantalla',
    langue: tr.langue,
    robots: 'noindex, nofollow, noarchive',
    classe: 'page-pantalla',
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
function corpsPantalla(vue, tr = duSalon()) {
  const carte = (tour, classe) => '<li class="tour ' + classe + '">'
    + '<span class="tour__numero">' + escapeHtml(tour.numero) + '</span>'
    + (tour.prenom ? '<span class="tour__prenom">' + escapeHtml(tour.prenom) + '</span>' : '')
    + (tour.poste ? '<span class="tour__poste">' + escapeHtml(tour.poste) + '</span>' : '')
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
      + escapeHtml(vue.appeles.length
        ? tr(vue.appeles.length > 1 ? 'pantalla.cestATous' : 'pantalla.cestAToi')
        : tr('pantalla.auFauteuil'))
      + '</p>'
      + '<ul class="tours tours--vedette">' + enVedette.join('') + '</ul>'
      + '</section>'
    : '<section class="pantalla__vedette pantalla__vedette--vide">'
      + '<p class="pantalla__label">' + escapeHtml(tr(vue.ouverte ? 'pantalla.fauteuilLibre' : 'pantalla.journeeClose')) + '</p>'
      + '<p class="pantalla__vide">' + escapeHtml(tr(vue.ouverte ? 'pantalla.passeQuandTuVeux' : 'pantalla.aDemain')) + '</p>'
      + '</section>';

  const suite = vue.attente.length
    ? '<section class="pantalla__suite">'
      + '<p class="pantalla__label">' + escapeHtml(tr('pantalla.suivants')) + '</p>'
      + '<ul class="tours tours--suite">' + vue.attente.map((tour) => carte(tour, 'tour--attente')).join('') + '</ul>'
      + (vue.deplus
        ? '<p class="pantalla__deplus">' + escapeHtml(tr('pantalla.etDePlus', { n: vue.deplus })) + '</p>'
        : '')
      + '</section>'
    : '<section class="pantalla__suite pantalla__suite--vide">'
      + '<p class="pantalla__label">' + escapeHtml(tr('pantalla.suivants')) + '</p>'
      + '<p class="pantalla__vide">' + escapeHtml(tr('pantalla.personneEnAttente')) + '</p>'
      + '</section>';

  const chiffres = '<section class="pantalla__chiffres">'
    + '<p><strong>' + vue.enAttente + '</strong> ' + escapeHtml(tr('pantalla.enAttente')) + '</p>'
    + (vue.enAttente ? '<p><strong>~' + vue.attenteEstimeeMinutes + '</strong> min</p>' : '')
    + '<p><strong>' + vue.servis + '</strong> ' + escapeHtml(tr('pantalla.aujourdhui')) + '</p>'
    + '</section>';

  return vedette + suite + chiffres;
}

export const _corpsPantalla = corpsPantalla;
