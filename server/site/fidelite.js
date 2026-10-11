/**
 * LA CARTE DE FIDELITE, DESSINEE.
 *
 * Deux vues : celle du client sur sa page de suivi (ou il en est), et celle de
 * la vitrine (ce que le programme offre). Les deux montrent la meme rangee de
 * pastilles — autant que de seances a faire, la derniere est le cadeau.
 */
import { escapeHtml } from '../core/text.js';
import { icone } from './ornements.js';
import { teteDeSection } from './vitrine.js';

const e = escapeHtml;

/** Au-dela, une rangee de pastilles ne se lit plus : on ne garde que le texte. */
const PASTILLES_MAX = 15;

function pastilles(objectif, acquis) {
  if (objectif > PASTILLES_MAX) return '';
  return '<ol class="tampons" aria-hidden="true">'
    + Array.from({ length: objectif }, (_, i) => {
      const dernier = i === objectif - 1;
      return '<li class="tampon' + (i < acquis ? ' tampon--acquis' : '') + (dernier ? ' tampon--cadeau' : '') + '">'
        + (dernier ? icone('etoile') : (i < acquis ? icone('coche') : '')) + '</li>';
    }).join('')
    + '</ol>';
}

/**
 * La carte du client. Rien si le programme est eteint.
 * @param {{ tr:Function, carte:{acquis:number, objectif:number, restant:number, cadeaux:number, cadeau:string}|null }} o
 */
export function carteFidelite({ tr, carte }) {
  if (!carte) return '';
  const pret = carte.cadeaux > 0;
  return '<section class="carte fidelite' + (pret ? ' fidelite--pret' : '') + '" data-fidelite>'
    + '<p class="surtitre fidelite__label">' + e(tr('fidelite.titre')) + '</p>'
    + (pret
      ? '<p class="fidelite__titre">' + e(tr('fidelite.cadeauPret', { cadeau: carte.cadeau })) + '</p>'
      : '<p class="fidelite__titre">' + e(tr('fidelite.progression', { n: carte.acquis, objectif: carte.objectif })) + '</p>')
    + pastilles(carte.objectif, pret ? carte.objectif : carte.acquis)
    + (pret
      ? ''
      : '<p class="fidelite__texte">' + e(tr('fidelite.encore', { n: carte.restant, cadeau: carte.cadeau })) + '</p>')
    + '<p class="fidelite__note">' + e(tr('fidelite.parTelephone')) + '</p>'
    + '</section>';
}

/** La section de la vitrine : ce que le programme offre, et comment. */
export function sectionFidelite({ tr, programme }) {
  if (!programme) return '';
  return '<section class="section section--fidelite" id="fidelite" aria-labelledby="titre-fidelite">'
    + '<div class="section__dedans">'
    + teteDeSection({ surtitre: tr('mx.fidelite.surtitre'), titre: tr('mx.fidelite.titre'), id: 'titre-fidelite' })
    + '<div class="fidelite-vitrine">'
    + pastilles(programme.objectif, 0)
    + '<p class="fidelite-vitrine__offre">' + e(tr('mx.fidelite.offre', { n: programme.objectif, cadeau: programme.cadeau })) + '</p>'
    + '<p class="fidelite-vitrine__note">' + e(tr('fidelite.parTelephone')) + '</p>'
    + '</div>'
    + '</div>'
    + '</section>';
}
