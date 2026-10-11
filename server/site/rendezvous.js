/**
 * LES PAGES DE RENDEZ-VOUS, rendues par le serveur.
 *
 *   GET  /rendez-vous                  choisir : prestations, professionnel, jour, heure
 *   POST /rendez-vous                  confirmer (coordonnees)
 *   GET  /rdv/<jeton>                  SON rendez-vous
 *   GET  /rdv/<jeton>/calendrier.ics   l'ajouter a son agenda
 *   POST /rdv/<jeton>/annuler          l'annuler
 *
 * TOUT MARCHE SANS JAVASCRIPT. Le choix est un formulaire GET : chaque appui
 * sur « Voir les heures » recharge la page avec les jours et les heures du
 * choix. La confirmation est un formulaire POST distinct, qui porte l'heure et
 * les coordonnees — le numero de telephone n'apparait donc jamais dans une
 * adresse (ni dans un historique, ni dans un journal).
 *
 * Avec JavaScript (rdv.js), la meme page se met a jour sans rechargement : le
 * script redemande CETTE page et remplace la zone qui change. Il n'y a qu'une
 * facon de dessiner un creneau, celle d'ici.
 */
import { Router } from '../http/router.js';
import { escapeHtml } from '../core/text.js';
import { ValidationError, AppError } from '../core/errors.js';
import { validate, rules } from '../core/validate.js';
import { config } from '../core/config.js';
import { traduire } from '../core/langue.js';
import { lireTous, adressePublique } from '../core/reglages.js';
import {
  consommerReservation, PROFILES, suiviBloque, noterEchecSuivi, consommerJeton,
} from '../core/ratelimit.js';
import { jourLocal, dateLongue, jourRelatif } from '../core/temps.js';
import { montantLisible } from '../core/devise.js';
import { offreDeRendezVous, idsDe } from '../routes/rendezvous.js';
import {
  calendrier, creneauxDisponibles, reserver, parJeton, pourClient, annulerParClient, fichierIcs,
} from '../domain/rendezvous.js';
import { parMoment } from '../domain/creneaux.js';
import { page, entete, piedDePage, pageErreur } from './mise-en-page.js';
import { filet, icone } from './ornements.js';
import { iconeTarifa } from './icones-tarifas.js';
import { programme as programmeFidelite, carteDuRendezVous } from '../domain/fidelite.js';
import { carteFidelite } from './fidelite.js';

export const siteRdvRoutes = new Router();

const e = escapeHtml;

/** Les chiffres du jour pour la bande : « jeu. », « 9 », « oct. ». */
function morceauxDeDate(iso, tr) {
  const [a, m, j] = iso.split('-').map(Number);
  const dow = new Date(Date.UTC(a, m - 1, j)).getUTCDay();
  return { jour: tr('jour.court.' + dow), n: j, mois: tr('mois.court.' + m) };
}

/* ------------------------------------------------------------------ */
/*  La page de reservation                                             */
/* ------------------------------------------------------------------ */

/**
 * L'etat de la page a partir de ce que le client a choisi (adresse ou corps).
 * Tout est revalide ici : une prestation masquee, un professionnel parti, un
 * jour hors de l'horizon sont simplement oublies.
 */
async function etatDuChoix(source) {
  const offre = await offreDeRendezVous();
  const r = await lireTous();
  const connues = new Map(offre.prestations.map((p) => [p.id, p]));
  const choisies = idsDe(source.p).filter((id) => connues.has(id));
  const pro = offre.professionnels.some((p) => p.id === source.pro) ? source.pro : '';
  const duree = choisies.reduce((n, id) => n + connues.get(id).duracionMin, 0);

  let jours = [];
  let jour = null;
  let creneaux = [];
  if (offre.etat.ouvert && duree > 0) {
    jours = (await calendrier({ duree, posteId: pro || null })).jours;
    const demande = jours.find((j) => j.jour === source.jour && j.libres > 0);
    jour = demande ? demande.jour : (jours.find((j) => j.libres > 0)?.jour ?? null);
    if (jour) creneaux = (await creneauxDisponibles({ jour, duree, posteId: pro || null })).creneaux;
  }
  const heure = creneaux.some((c) => c.heure === source.heure) ? source.heure : null;
  return {
    offre, r, choisies, pro, duree, jours, jour, creneaux, heure,
    // Le client arrive d'un lien « 15:30 » de la vitrine sans avoir encore
    // choisi de prestation : on lui rappelle l'heure visee.
    vise: !duree && source.jour && source.heure ? { jour: source.jour, heure: source.heure } : null,
    prestations: choisies.map((id) => connues.get(id)),
  };
}

function etapePrestations(c, tr) {
  const chapitres = [];
  for (const p of c.offre.prestations) {
    const titre = p.categoria || '';
    let ch = chapitres.find((x) => x.titre === titre);
    if (!ch) chapitres.push(ch = { titre, lignes: [] });
    ch.lignes.push(p);
  }
  const coche = new Set(c.choisies);
  return '<fieldset class="etape" id="etape-prestations">'
    + '<legend class="etape__titre"><span class="etape__num">1</span>' + e(tr('rdvp.etape.prestations')) + '</legend>'
    + (c.vise ? '<p class="etape__rappel">' + icone('horloge') + e(tr('rdvp.vise', { jour: jourRelatif(c.vise.jour, jourLocal(), tr.langue), heure: c.vise.heure })) + '</p>' : '')
    + chapitres.map((ch) => (ch.titre && chapitres.length > 1 ? '<p class="etape__chapitre">' + e(ch.titre) + '</p>' : '')
      + '<ul class="choix-prestations">' + ch.lignes.map((p) => '<li>'
        + '<input class="choix__case" type="checkbox" name="p" value="' + e(p.id) + '" id="p-' + e(p.id) + '" form="form-choix"'
        + ' data-minutes="' + p.duracionMin + '"' + (coche.has(p.id) ? ' checked' : '') + '>'
        + '<label class="choix-prestation" for="p-' + e(p.id) + '">'
        + '<span class="choix-prestation__icone" aria-hidden="true">' + iconeTarifa(p.icono) + '</span>'
        + '<span class="choix-prestation__nom">' + e(p.nombre) + '</span>'
        + '<span class="choix-prestation__meta">' + e(tr('mx.carte.duree', { n: p.duracionMin }))
        + (p.precioTexte ? ' · ' + e(p.precioTexte) : '') + '</span>'
        + '<span class="choix__coche" aria-hidden="true">' + icone('coche') + '</span>'
        + '</label></li>').join('') + '</ul>').join('')
    + '</fieldset>';
}

function etapeProfessionnel(c, tr) {
  if (!c.offre.professionnels.length) return '';
  const options = [{ id: '', nom: tr('rdvp.sansPreference') }, ...c.offre.professionnels];
  return '<fieldset class="etape" id="etape-pro">'
    + '<legend class="etape__titre"><span class="etape__num">2</span>' + e(tr('rdvp.etape.pro')) + '</legend>'
    + '<ul class="choix-pros">' + options.map((p) => '<li>'
      + '<input class="choix__case" type="radio" name="pro" value="' + e(p.id) + '" id="pro-' + e(p.id || 'tous') + '" form="form-choix"'
      + (c.pro === p.id ? ' checked' : '') + '>'
      + '<label class="choix-pro" for="pro-' + e(p.id || 'tous') + '">'
      + '<span class="choix-pro__initiale" aria-hidden="true">' + (p.id ? e(String(p.nom).charAt(0).toUpperCase()) : icone('etoile')) + '</span>'
      + '<span class="choix-pro__nom">' + e(p.nom) + '</span>'
      + '</label></li>').join('') + '</ul>'
    + '</fieldset>';
}

function etapeJour(c, tr, num) {
  const corps = !c.duree
    ? '<p class="etape__attente">' + e(tr('rdvp.choisirDabord')) + '</p>'
    : !c.jours.some((j) => j.libres > 0)
      ? '<p class="etape__attente">' + e(tr('rdvp.aucunJour')) + '</p>'
      : '<div class="bande-jours" data-bande-jours><ul class="jours">' + c.jours.map((j) => {
        const m = morceauxDeDate(j.jour, tr);
        const libre = j.libres > 0;
        return '<li>'
          + '<input class="choix__case" type="radio" name="jour" value="' + e(j.jour) + '" id="jour-' + e(j.jour) + '" form="form-choix"'
          + (j.jour === c.jour ? ' checked' : '') + (libre ? '' : ' disabled') + '>'
          + '<label class="jour' + (libre ? '' : ' jour--complet') + '" for="jour-' + e(j.jour) + '">'
          + '<span class="jour__nom">' + e(m.jour) + '</span>'
          + '<span class="jour__n">' + m.n + '</span>'
          + '<span class="jour__mois">' + e(libre ? m.mois : tr(j.ferme ? 'rdvp.ferme' : 'rdvp.complet')) + '</span>'
          + '</label></li>';
      }).join('') + '</ul></div>';
  return '<fieldset class="etape" id="etape-jour">'
    + '<legend class="etape__titre"><span class="etape__num">' + num + '</span>' + e(tr('rdvp.etape.jour')) + '</legend>'
    + corps
    + '<p class="etape__maj"><button class="bouton bouton--contour bouton--petit" type="submit" form="form-choix" data-maj>'
    + e(tr('rdvp.voirHeures')) + '</button></p>'
    + '</fieldset>';
}

function etapeHeure(c, tr, num) {
  let corps;
  if (!c.duree || !c.jour) {
    corps = '<p class="etape__attente">' + e(tr(c.duree ? 'rdvp.aucunJour' : 'rdvp.choisirDabord')) + '</p>';
  } else {
    const g = parMoment(c.creneaux);
    const bloc = (cle, liste) => (liste.length
      ? '<div class="moment"><p class="moment__titre">' + e(tr('rdvp.moment.' + cle)) + '</p><ul class="heures">'
        + liste.map((cr) => '<li><input class="choix__case" type="radio" name="heure" value="' + e(cr.heure) + '" id="h-' + e(cr.heure) + '"'
          + ' form="form-confirmer" required' + (c.heure === cr.heure ? ' checked' : '') + '>'
          + '<label class="heure" for="h-' + e(cr.heure) + '">' + e(cr.heure) + '</label></li>').join('')
        + '</ul></div>'
      : '');
    corps = '<p class="etape__jour">' + e(dateLongue(c.jour, tr.langue)) + '</p>'
      + bloc('matin', g.matin) + bloc('apresMidi', g.apresMidi) + bloc('soir', g.soir);
  }
  return '<fieldset class="etape" id="etape-heure">'
    + '<legend class="etape__titre"><span class="etape__num">' + num + '</span>' + e(tr('rdvp.etape.heure')) + '</legend>'
    + corps
    + '</fieldset>';
}

/** Le recapitulatif, colle sur le cote : ce qu'on reserve, en un coup d'oeil. */
function resume(c, tr) {
  const avecPrix = c.prestations.every((p) => p.precioCts !== null && p.precioCts !== undefined);
  const total = c.prestations.reduce((n, p) => n + (p.precioCts || 0), 0);
  const desde = c.prestations.some((p) => p.precioDesde);
  const pro = c.offre.professionnels.find((p) => p.id === c.pro);
  return '<aside class="resume carte" data-resume aria-live="polite">'
    + '<p class="surtitre">' + e(tr('rdvp.resume')) + '</p>'
    + (c.prestations.length
      ? '<ul class="resume__lignes">' + c.prestations.map((p) => '<li><span>' + e(p.nombre) + '</span>'
        + (p.precioTexte ? '<span>' + e(p.precioTexte) + '</span>' : '') + '</li>').join('') + '</ul>'
      : '<p class="resume__vide">' + e(tr('rdvp.resumeVide')) + '</p>')
    + filet({ classe: 'resume__filet' })
    + '<dl class="resume__details">'
    + (c.duree ? '<div><dt>' + e(tr('rdvp.duree')) + '</dt><dd>' + e(tr('mx.carte.duree', { n: c.duree })) + '</dd></div>' : '')
    + (c.prestations.length && avecPrix
      ? '<div><dt>' + e(tr('rdvp.total')) + '</dt><dd>' + e(desde ? tr('tarifs.aPartirDe', { prix: montantLisible(total) }) : montantLisible(total)) + '</dd></div>'
      : '')
    + (c.offre.professionnels.length ? '<div><dt>' + e(tr('rdvp.avec')) + '</dt><dd>' + e(pro ? pro.nom : tr('rdvp.sansPreference')) + '</dd></div>' : '')
    + (c.jour ? '<div><dt>' + e(tr('rdvp.quand')) + '</dt><dd data-resume-quand data-jour="' + e(dateLongue(c.jour, tr.langue)) + '">'
      + e(dateLongue(c.jour, tr.langue)) + (c.heure ? ' · ' + e(c.heure) : '') + '</dd></div>' : '')
    + '</dl>'
    + '</aside>';
}

/** Le formulaire de confirmation : l'heure (etape 4) y appartient par l'attribut form. */
function confirmation(c, tr, { valeurs = {}, erreurs = {}, message = null } = {}) {
  const champs = [
    { nom: 'prenom', libelle: tr('join.champPrenom'), auto: 'given-name', type: 'text', mode: 'text', max: 40 },
    { nom: 'nom', libelle: tr('join.champNom'), auto: 'family-name', type: 'text', mode: 'text', max: 40 },
    { nom: 'telephone', libelle: tr('join.champTelephone'), auto: 'tel', type: 'tel', mode: 'tel', max: 25, aide: tr('join.aideTelephone', { indicatif: config.indicatifDefaut }) },
  ].map((ch) => {
    const err = erreurs[ch.nom];
    const id = 'rdv-' + ch.nom;
    return '<div class="champ' + (err ? ' champ--erreur' : '') + '">'
      + '<label for="' + id + '">' + e(ch.libelle) + '</label>'
      + '<input id="' + id + '" name="' + ch.nom + '" type="' + ch.type + '" inputmode="' + ch.mode + '" autocomplete="' + ch.auto + '"'
      + ' required maxlength="' + ch.max + '" value="' + e(valeurs[ch.nom] ?? '') + '"'
      + (err ? ' aria-invalid="true" aria-describedby="' + id + '-erreur"' : '') + '>'
      + (err ? '<p class="champ__erreur" id="' + id + '-erreur">' + e(err) + '</p>' : (ch.aide ? '<p class="champ__aide">' + e(ch.aide) + '</p>' : ''))
      + '</div>';
  }).join('');
  const cache = c.choisies.map((id) => '<input type="hidden" name="p" value="' + e(id) + '">').join('')
    + '<input type="hidden" name="pro" value="' + e(c.pro) + '">'
    + '<input type="hidden" name="jour" value="' + e(c.jour || '') + '">';
  const pret = c.duree > 0 && c.jour;
  return '<form class="carte confirmer" id="form-confirmer" method="post" action="/rendez-vous" data-confirmer novalidate>'
    + '<p class="etape__titre"><span class="etape__num">✓</span>' + e(tr('rdvp.etape.coordonnees')) + '</p>'
    + (message ? '<p class="alerte alerte--refus" role="alert">' + e(message) + '</p>' : '')
    + (erreurs.heure ? '<p class="alerte alerte--refus" role="alert">' + e(erreurs.heure) + '</p>' : '')
    + '<div data-cache>' + cache + '</div>'
    + '<div class="confirmer__champs">' + champs + '</div>'
    + '<p class="confirmer__note">' + e(tr('rdvp.notePolitique', { n: c.r['rdv.annulationHeures'] })) + '</p>'
    + '<button class="bouton bouton--principal bouton--large" type="submit"' + (pret ? '' : ' disabled') + ' data-reserver>'
    + e(tr('rdvp.confirmer')) + '</button>'
    + '</form>';
}

function pageReservation(ctx, c, options = {}) {
  const tr = traduire(c.r['salon.idioma']);
  const pros = c.offre.professionnels.length > 0;
  const num = (n) => (pros ? n : n - 1);
  let contenu;
  if (!c.offre.etat.ouvert) {
    contenu = '<section class="carte carte--centree carte--avis">'
      + '<p class="surtitre">' + e(tr('mx.rdv.titre')) + '</p>'
      + '<h1 class="titre-page">' + e(tr('rdvp.indisponibleTitre')) + '</h1>'
      + filet()
      + '<p class="texte-doux">' + e(tr('rdv.ferme.' + c.offre.etat.raison)) + '</p>'
      + '<div class="carte__actions">'
      + (c.r['salon.telephone'] ? '<a class="bouton bouton--contour" href="tel:' + e(c.r['salon.telephone'].replace(/[^+0-9]/g, '')) + '">' + e(tr('commun.appelerSalon')) + '</a>' : '')
      + '<a class="bouton bouton--principal" href="/">' + e(tr('commun.retourAccueil')) + '</a>'
      + '</div></section>';
  } else {
    contenu = '<header class="page__tete">'
      + '<p class="surtitre">' + e(tr('mx.rdv.titre')) + '</p>'
      + '<h1 class="titre-page">' + e(tr('rdvp.titre')) + '</h1>'
      + filet()
      + '<p class="page__chapo">' + e(tr('rdvp.chapo')) + '</p>'
      + '</header>'
      + '<form id="form-choix" method="get" action="/rendez-vous" data-choix hidden></form>'
      + '<div class="reservation" data-reservation>'
      + '<div class="reservation__etapes">'
      + etapePrestations(c, tr)
      + etapeProfessionnel(c, tr)
      + etapeJour(c, tr, num(3))
      + etapeHeure(c, tr, num(4))
      + confirmation(c, tr, options)
      + '</div>'
      + resume(c, tr)
      + '</div>';
  }
  return page({
    titre: tr('rdvp.titrePage', { nom: c.r['salon.nom'] }),
    description: tr('rdvp.description', { nom: c.r['salon.nom'] }),
    corps: entete({ retour: { href: '/', texte: tr('commun.accueil') } })
      + '<main class="page page--large page--reserver" id="principal">' + contenu + '</main>',
    base: ctx.base,
    chemin: '/rendez-vous',
    langue: tr.langue,
    classe: 'page-reserver',
    scripts: ['/js/rdv.js'],
    pied: piedDePage({ adresse: c.r['salon.adresse'] || null, telephone: c.r['salon.telephone'] || null }),
  });
}

const sourceDepuisRequete = (ctx) => ({
  p: ctx.searchParams.getAll('p').join(','),
  pro: String(ctx.query('pro') || ''),
  jour: String(ctx.query('jour') || ''),
  heure: String(ctx.query('heure') || ''),
});

siteRdvRoutes.get('/rendez-vous', async (ctx) => {
  const c = await etatDuChoix(sourceDepuisRequete(ctx));
  ctx.html(c.offre.etat.ouvert ? 200 : 409, pageReservation(ctx, c), { noStore: true });
}, { public: true, rateLimit: PROFILES.suivi });

siteRdvRoutes.post('/rendez-vous', async (ctx) => {
  const corps = ctx.body || {};
  const brut = {
    prenom: String(corps.prenom ?? ''),
    nom: String(corps.nom ?? ''),
    telephone: String(corps.telephone ?? ''),
  };
  const source = {
    p: [].concat(corps.p ?? []).join(','),
    pro: String(corps.pro ?? ''),
    jour: String(corps.jour ?? ''),
    heure: String(corps.heure ?? ''),
  };
  const c = await etatDuChoix(source);
  const reafficher = (status, o) => ctx.html(status, pageReservation(ctx, c, { valeurs: brut, ...o }));

  let data;
  try {
    data = validate(brut, { prenom: rules.prenom, nom: rules.nomFamille, telephone: rules.whatsapp });
  } catch (err) {
    if (!(err instanceof ValidationError)) throw err;
    return reafficher(422, { erreurs: err.fields });
  }
  if (!c.heure) return reafficher(409, { erreurs: { heure: traduire(c.r['salon.idioma'])('rdv.creneauIndisponible') } });

  const debit = consommerReservation({ ip: ctx.ipDebit, telephone: data.telephone }, { telephoneSalon: c.r['salon.telephone'] || null });
  if (!debit.allowed) {
    ctx.res.setHeader('Retry-After', String(debit.retryAfterSeconds));
    return reafficher(429, { message: debit.message });
  }

  let resultat;
  try {
    resultat = await reserver({
      ...data, tarifaIds: c.choisies, posteId: c.pro || null, jour: c.jour, heure: c.heure, source: 'ONLINE',
    });
  } catch (err) {
    if (err instanceof ValidationError) return reafficher(422, { erreurs: err.fields, message: err.message });
    if (err instanceof AppError && err.status === 409) {
      // L'heure vient d'etre prise : on la retire, et la page montre les autres.
      const frais = await etatDuChoix({ ...source, heure: '' });
      return ctx.html(409, pageReservation(ctx, frais, { valeurs: brut, message: err.message }));
    }
    throw err;
  }
  // 303 : un rafraichissement de la confirmation ne reposte jamais.
  ctx.redirect('/rdv/' + resultat.jeton + '?nouveau=1', 303);
}, { public: true });

/* ------------------------------------------------------------------ */
/*  SON rendez-vous                                                    */
/* ------------------------------------------------------------------ */

/** Meme protection que le lien d'un ticket : echecs par adresse, volume par jeton. */
async function rdvDeLaPage(ctx, tr) {
  const bloque = suiviBloque(ctx.ipDebit);
  if (!bloque.allowed) {
    ctx.res.setHeader('Retry-After', String(bloque.retryAfterSeconds));
    ctx.html(429, pageErreur({ base: ctx.base, statut: 429, titre: tr('erreur.tropDeDemandes'), message: tr('erreur.tropDeDemandesTexte') }));
    return null;
  }
  const jeton = String(ctx.params.jeton || '');
  const rdv = await parJeton(jeton);
  if (!rdv) {
    noterEchecSuivi(ctx.ipDebit);
    ctx.html(404, pageErreur({ base: ctx.base, statut: 404, titre: tr('erreur.lienInvalide'), message: tr('rdv.introuvable') }));
    return null;
  }
  const limite = consommerJeton('rdv:' + jeton, PROFILES.suivi);
  if (!limite.allowed) {
    ctx.res.setHeader('Retry-After', String(limite.retryAfterSeconds));
    ctx.html(429, pageErreur({ base: ctx.base, statut: 429, titre: tr('erreur.tropDeDemandes'), message: tr('erreur.tropDeDemandesTexte') }));
    return null;
  }
  return { rdv, jeton };
}

siteRdvRoutes.get('/rdv/:jeton', async (ctx) => {
  const r = await lireTous();
  const tr = traduire(r['salon.idioma']);
  const trouve = await rdvDeLaPage(ctx, tr);
  if (!trouve) return;
  const { rdv, jeton } = trouve;
  const vue = await pourClient(rdv, { langue: tr.langue });
  const prog = await programmeFidelite(r);
  const fidelite = prog ? carteFidelite({ tr, carte: { ...(await carteDuRendezVous(rdv.id, prog.objectif)), cadeau: prog.cadeau } }) : '';
  const lien = adressePublique(r, ctx.base) + '/rdv/' + jeton;
  const nouveau = ctx.queryBool('nouveau');
  const actif = ['CONFIRME', 'ARRIVE', 'INSTALLE'].includes(vue.statut) && !vue.passe;
  const adresse = r['salon.adresse'];
  const cible = r['salon.coordenadas'] || adresse;

  const titre = vue.statut === 'ANNULE' ? tr('rdvp.annuleTitre')
    : vue.statut === 'ABSENT' || (vue.passe && vue.statut === 'CONFIRME') ? tr('rdvp.passeTitre')
      : nouveau ? tr('rdvp.confirmeTitre') : tr('rdvp.votreRdv');

  const details = '<dl class="confirmation__details">'
    + (vue.prestations.length
      ? '<div><dt>' + e(tr('rdvp.prestations')) + '</dt><dd><ul>' + vue.prestations.map((p) => '<li><span>' + e(p.nombre) + '</span><span>' + e(p.prix) + '</span></li>').join('') + '</ul></dd></div>'
      : '')
    + '<div><dt>' + e(tr('rdvp.duree')) + '</dt><dd>' + e(tr('mx.carte.duree', { n: vue.duree })) + '</dd></div>'
    + (vue.professionnel ? '<div><dt>' + e(tr('rdvp.avec')) + '</dt><dd>' + e(vue.professionnel) + '</dd></div>' : '')
    + (vue.total ? '<div><dt>' + e(tr('rdvp.total')) + '</dt><dd>' + e(vue.totalDesde ? tr('tarifs.aPartirDe', { prix: vue.total }) : vue.total) + '</dd></div>' : '')
    + (adresse ? '<div><dt>' + e(tr('vt.infos.adresse')) + '</dt><dd>' + e(adresse) + '</dd></div>' : '')
    + '</dl>';

  const actions = actif
    ? '<div class="confirmation__actions">'
      + '<a class="bouton bouton--principal" href="/rdv/' + e(jeton) + '/calendrier.ics" download>' + icone('calendrier') + e(tr('rdvp.ajouterAgenda')) + '</a>'
      + (cible ? '<a class="bouton bouton--contour" href="https://www.google.com/maps/dir/?api=1&destination=' + e(encodeURIComponent(cible)) + '" target="_blank" rel="noopener noreferrer">' + icone('itineraire') + e(tr('lieu.itineraire')) + '</a>' : '')
      + '</div>'
    : '<div class="confirmation__actions"><a class="bouton bouton--principal" href="/rendez-vous">' + e(tr('rdvp.nouveauRdv')) + '</a></div>';

  const annulation = vue.statut === 'CONFIRME' && !vue.passe
    ? (vue.annulable
      ? '<form class="annulation" method="post" action="/rdv/' + e(jeton) + '/annuler" data-annuler-rdv data-confirmation="' + e(tr('rdvp.confirmerAnnulation')) + '">'
        + '<button class="bouton bouton--lien bouton--danger" type="submit">' + e(tr('rdvp.annuler')) + '</button>'
        + '<p class="annulation__note">' + e(tr('rdvp.annulableJusqua', { n: vue.annulationHeures })) + '</p>'
        + '</form>'
      : '<p class="annulation__note">' + e(tr('rdv.tropTardPourAnnuler', { n: vue.annulationHeures })) + '</p>')
    : '';

  const blocLien = actif
    ? '<section class="lien' + (nouveau ? ' lien--neuf' : '') + '" data-bloc-lien>'
      + '<p class="lien__titre">' + e(tr(nouveau ? 'rdvp.gardeLien' : 'ticket.tonLien')) + '</p>'
      + '<p class="lien__texte">' + e(tr('rdvp.lienTexte')) + '</p>'
      + '<p class="lien__adresse" data-lien>' + e(lien) + '</p>'
      + '<div class="lien__actions">'
      + '<button class="bouton bouton--contour" type="button" data-copier data-valeur="' + e(lien) + '">' + icone('copier') + e(tr('ticket.copier')) + '</button>'
      + '<button class="bouton bouton--contour" type="button" data-partager hidden>' + icone('partager') + e(tr('ticket.envoyer')) + '</button>'
      + '</div>'
      + '<p class="lien__retour" role="status" hidden data-copie>' + e(tr('ticket.copie')) + '</p>'
      + '</section>'
    : '';

  const corps = entete({ retour: { href: '/', texte: tr('commun.accueil') } })
    + '<main class="page page--etroite page--rdv" id="principal">'
    + '<section class="confirmation carte confirmation--' + e(vue.statut.toLowerCase()) + (vue.passe ? ' confirmation--passe' : '') + '">'
    + '<span class="confirmation__sceau" aria-hidden="true">' + icone(vue.statut === 'ANNULE' ? 'croix' : 'coche') + '</span>'
    + '<p class="surtitre">' + e(tr('rdv.statut.' + vue.statut)) + '</p>'
    + '<h1 class="titre-page">' + e(titre) + '</h1>'
    + '<p class="confirmation__date">' + e(vue.dateLongue) + '</p>'
    + '<p class="confirmation__heure">' + e(vue.heure) + '</p>'
    + filet()
    + details
    + (vue.message && actif ? '<p class="confirmation__message">' + e(vue.message) + '</p>' : '')
    + actions
    + annulation
    + '</section>'
    + fidelite
    + blocLien
    + '</main>';

  ctx.html(200, page({
    titre: tr('rdvp.titreSuivi', { nom: r['salon.nom'] }),
    description: tr('rdvp.description', { nom: r['salon.nom'] }),
    corps,
    base: ctx.base,
    chemin: '/rdv/' + jeton,
    langue: tr.langue,
    robots: 'noindex, nofollow, noarchive',
    classe: 'page-rdv',
    scripts: ['/js/rdv-suivi.js'],
    pied: piedDePage({ adresse: adresse || null, telephone: r['salon.telephone'] || null }),
  }));
}, { public: true });

siteRdvRoutes.get('/rdv/:jeton/calendrier.ics', async (ctx) => {
  const r = await lireTous();
  const tr = traduire(r['salon.idioma']);
  const trouve = await rdvDeLaPage(ctx, tr);
  if (!trouve) return;
  const { rdv, jeton } = trouve;
  const vue = await pourClient(rdv, { langue: tr.langue });
  const ics = fichierIcs(rdv, {
    titre: tr('rdvp.titreAgenda', { nom: r['salon.nom'] }),
    lieu: r['salon.adresse'] || '',
    description: vue.prestations.map((p) => p.nombre).join(', ') + '\n' + adressePublique(r, ctx.base) + '/rdv/' + jeton,
  });
  ctx.file(Buffer.from(ics, 'utf8'), { filename: 'rendez-vous.ics', mimeType: 'text/calendar; charset=utf-8', download: true });
}, { public: true });

siteRdvRoutes.post('/rdv/:jeton/annuler', async (ctx) => {
  const r = await lireTous();
  const tr = traduire(r['salon.idioma']);
  const trouve = await rdvDeLaPage(ctx, tr);
  if (!trouve) return;
  try {
    await annulerParClient(trouve.jeton);
  } catch (err) {
    if (!(err instanceof AppError)) throw err;
    ctx.html(err.status, pageErreur({ base: ctx.base, statut: err.status, titre: tr('rdvp.annulationImpossible'), message: err.message }));
    return;
  }
  ctx.redirect('/rdv/' + trouve.jeton, 303);
}, { public: true });

