/**
 * LES AVIS, DESSINES : l'invitation sur la page de suivi du client, et la
 * section de la vitrine.
 */
import { escapeHtml } from '../core/text.js';
import { jourLocal, dateCourte } from '../core/temps.js';
import { teteDeSection } from './vitrine.js';

const e = escapeHtml;

const ETOILE = '<path d="M12 2.6 14.9 9l6.9.7-5.2 4.6 1.5 6.8L12 17.6 5.9 21.1l1.5-6.8L2.2 9.7 9.1 9Z"/>';

/** « 4,8 » : un chiffre apres la virgule, a la francaise comme a l'espagnole. */
export const noteLisible = (note) => Number(note).toFixed(1).replace('.', ',');

/** Cinq etoiles, pleines selon la note (arrondie a l'etoile). Decoratif : le texte dit la note. */
export function etoiles(note, { classe = '' } = {}) {
  const pleines = Math.round(Number(note) || 0);
  return '<span class="etoiles ' + e(classe) + '" aria-hidden="true">'
    + [1, 2, 3, 4, 5].map((i) => '<svg class="etoiles__une' + (i <= pleines ? ' etoiles__une--pleine' : '') + '" viewBox="0 0 24 24" focusable="false">' + ETOILE + '</svg>').join('')
    + '</span>';
}

/**
 * L'invitation a noter, sur la page de suivi. Un vrai formulaire, sans script :
 * cinq boutons radio dessines en etoiles (de 5 a 1 dans le code, remis dans
 * l'ordre par la feuille de style — c'est ce qui allume les etoiles
 * precedentes au survol sans une ligne de JavaScript).
 *
 * @param {{ tr:Function, action:string, etat:'OUVERT'|'DEJA'|'NON', merci?:boolean, erreur?:string|null }} o
 */
export function blocAvis({ tr, action, etat, merci = false, erreur = null }) {
  if (etat === 'DEJA') {
    return '<section class="carte avis-invite avis-invite--merci" data-avis>'
      + '<p class="surtitre">' + e(tr('avis.merci.titre')) + '</p>'
      + '<p class="texte-doux">' + e(tr(merci ? 'avis.merci.texte' : 'avis.merci.deja')) + '</p>'
      + '</section>';
  }
  if (etat !== 'OUVERT') return '';
  return '<section class="carte avis-invite" data-avis>'
    + '<h2 class="avis-invite__titre">' + e(tr('avis.invite.titre')) + '</h2>'
    + '<p class="texte-doux">' + e(tr('avis.invite.texte')) + '</p>'
    + (erreur ? '<p class="alerte alerte--refus" role="alert">' + e(erreur) + '</p>' : '')
    + '<form class="avis-invite__formulaire" method="post" action="' + e(action) + '">'
    + '<fieldset class="notation"><legend class="notation__legende">' + e(tr('avis.note')) + '</legend>'
    + '<div class="notation__etoiles">'
    + [5, 4, 3, 2, 1].map((n) => '<input class="notation__choix" type="radio" name="note" id="note-' + n + '" value="' + n + '" required>'
      + '<label class="notation__etoile" for="note-' + n + '"><span class="visuellement-cache">' + e(tr('avis.etoiles', { n })) + '</span>'
      + '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + ETOILE + '</svg></label>').join('')
    + '</div></fieldset>'
    + '<div class="champ"><label for="avis-commentaire">' + e(tr('avis.commentaire')) + '</label>'
    + '<textarea id="avis-commentaire" name="commentaire" rows="3" maxlength="600"></textarea></div>'
    + '<button class="bouton bouton--principal bouton--large" type="submit">' + e(tr('avis.envoyer')) + '</button>'
    + '</form>'
    + '</section>';
}

/** « ★ 4,8 (12 avis) » : la note en une ligne, pour le haut de la vitrine. Rien sans avis publie. */
export function noteEnLigne({ tr, avis }) {
  if (!avis || !avis.nombre) return '';
  return '<a class="note-ligne" href="#avis">' + etoiles(avis.moyenne)
    + '<span class="note-ligne__note">' + e(noteLisible(avis.moyenne)) + '</span>'
    + '<span class="note-ligne__nombre">(' + e(tr('mx.avis.nombre', { n: avis.nombre })) + ')</span></a>';
}

/**
 * La section de la vitrine : la note en grand, la repartition par etoiles,
 * et les derniers avis. Aucun avis publie, aucune section.
 */
export function sectionAvis({ tr, avis, langue = null }) {
  if (!avis || !avis.nombre) return '';
  const barres = avis.repartition.map((n, i) => {
    const part = Math.round((n / avis.nombre) * 100);
    return '<li class="repartition__ligne"><span class="repartition__note">' + (5 - i) + '</span>'
      + '<span class="repartition__barre"><span class="repartition__plein repartition__plein--' + Math.round(part / 10) * 10 + '"></span></span>'
      + '<span class="repartition__nombre">' + n + '</span></li>';
  }).join('');
  const cartes = avis.liste.map((a) => '<li class="avis-carte">'
    + '<div class="avis-carte__tete"><span class="avis-carte__initiale" aria-hidden="true">' + e(String(a.prenom).charAt(0).toUpperCase()) + '</span>'
    + '<div><p class="avis-carte__prenom">' + e(a.prenom) + '</p>'
    + '<p class="avis-carte__date">' + e(dateCourte(jourLocal(new Date(a.le)), langue)) + '</p></div>'
    + '<span class="avis-carte__note">' + etoiles(a.note) + '<span class="visuellement-cache">' + e(tr('mx.avis.noteAria', { note: a.note })) + '</span></span></div>'
    + (a.commentaire ? '<p class="avis-carte__texte">' + e(a.commentaire) + '</p>' : '')
    + '</li>').join('');

  return '<section class="section section--avis" id="avis" aria-labelledby="titre-avis">'
    + '<div class="section__dedans">'
    + teteDeSection({ surtitre: tr('mx.avis.surtitre'), titre: tr('mx.avis.titre'), id: 'titre-avis' })
    + '<div class="avis">'
    + '<div class="avis__bilan">'
    + '<p class="avis__moyenne">' + e(noteLisible(avis.moyenne)) + '<span class="avis__sur"> / 5</span></p>'
    + etoiles(avis.moyenne, { classe: 'etoiles--grandes' })
    + '<p class="avis__nombre">' + e(tr('mx.avis.nombre', { n: avis.nombre })) + '</p>'
    + '<ul class="repartition">' + barres + '</ul>'
    + '<p class="avis__verifie">' + e(tr('mx.avis.verifie')) + '</p>'
    + '</div>'
    + '<ul class="avis__liste">' + cartes + '</ul>'
    + '</div>'
    + '</div>'
    + '</section>';
}
