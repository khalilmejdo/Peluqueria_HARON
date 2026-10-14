/**
 * LES ORNEMENTS DE LA MAISON.
 *
 * L'application se vend a un barbier, a un salon de coiffure, a un institut de
 * beaute : ses dessins ne peuvent plus etre ceux d'un seul metier. Le mat de
 * barbier et les scenes de salon ont laisse la place a un vocabulaire de
 * maison de luxe, valable partout :
 *
 *   - le MONOGRAMME, les initiales de la marque dans un double cercle fin ;
 *   - le FILET ORNE, deux traits et un losange, qui separe les chapitres ;
 *   - des ICONES au trait, toutes de la MEME epaisseur.
 *
 * Tout est en SVG, dans la page : rien ne se telecharge, tout suit les
 * couleurs du theme (currentColor et variables CSS), et rien ne porte de
 * script ni de gestionnaire d'evenement (un test le verifie).
 */
import { escapeHtml } from '../core/text.js';

/**
 * Le monogramme : jusqu'a trois lettres, dessinees dans la police de titre de
 * la marque (le texte SVG herite de la page), dans un double cercle.
 */
export function monogramme(lettres, { classe = '' } = {}) {
  const texte = escapeHtml(String(lettres || '').slice(0, 3));
  const taille = String(lettres || '').length >= 3 ? 26 : String(lettres || '').length === 2 ? 32 : 40;
  return '<svg class="monogramme ' + escapeHtml(classe) + '" viewBox="0 0 100 100" aria-hidden="true" focusable="false">'
    + '<circle cx="50" cy="50" r="47" class="monogramme__cercle"/>'
    + '<circle cx="50" cy="50" r="42.5" class="monogramme__cercle monogramme__cercle--fin"/>'
    + '<text x="50" y="51" text-anchor="middle" dominant-baseline="central" class="monogramme__lettres" '
    + 'font-size="' + taille + '">' + texte + '</text>'
    + '</svg>';
}

/** Le filet orne : un trait, un losange, un trait. */
export function filet({ classe = '' } = {}) {
  return '<span class="filet ' + escapeHtml(classe) + '" aria-hidden="true">'
    + '<span class="filet__trait"></span>'
    + '<svg class="filet__losange" viewBox="0 0 12 12" focusable="false"><path d="M6 0.8 11.2 6 6 11.2 0.8 6Z"/></svg>'
    + '<span class="filet__trait"></span>'
    + '</span>';
}

const ICONES = {
  instagram: '<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r="0.6"/>',
  carte: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h4"/>',
  bouclier: '<path d="M12 3 5 5.8v5.4c0 4.4 2.9 8 7 9.8 4.1-1.8 7-5.4 7-9.8V5.8Z"/><path d="m9 12 2.2 2.2L15.2 10"/>',
  diamant: '<path d="M6.5 4h11L21 9l-9 11L3 9Z"/><path d="M3 9h18M9 4 7.5 9 12 20l4.5-11L15 4"/>',
  coeur: '<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10Z"/>',
  eclat: '<path d="M12 3c.6 4.6 2.4 6.4 7 7-4.6.6-6.4 2.4-7 7-.6-4.6-2.4-6.4-7-7 4.6-.6 6.4-2.4 7-7Z"/><path d="M18.5 16.5c.2 1.6.9 2.3 2.5 2.5-1.6.2-2.3.9-2.5 2.5-.2-1.6-.9-2.3-2.5-2.5 1.6-.2 2.3-.9 2.5-2.5Z"/>',
  lieu: '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/>',
  telephone: '<path d="M5 4h4l1.5 4-2.2 1.4a11 11 0 0 0 6.3 6.3L16 13.5l4 1.5v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z"/>',
  bulle: '<path d="M4 5h16v11H9l-5 4Z"/><path d="M8 9.5h8M8 12.5h5"/>',
  horloge: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  calendrier: '<rect x="3.5" y="5" width="17" height="15" rx="1.5"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/>',
  fleche: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  retour: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  coche: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  croix: '<path d="M6 6l12 12M18 6 6 18"/>',
  itineraire: '<path d="M12 3 21 12 12 21 3 12Z"/><path d="M10 14v-3h4M12.5 9 14 11l-1.5 2"/>',
  personne: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/>',
  etoile: '<path d="M12 3.5 14.4 9l5.9.5-4.5 3.9 1.4 5.8L12 16.1 6.8 19.2l1.4-5.8L3.7 9.5 9.6 9Z"/>',
  file: '<path d="M4 7h10M4 12h10M4 17h7"/><circle cx="18.5" cy="12" r="2.5"/>',
  partager: '<circle cx="6" cy="12" r="2.5"/><circle cx="17" cy="6" r="2.5"/><circle cx="17" cy="18" r="2.5"/><path d="m8.2 10.8 6.6-3.6M8.2 13.2l6.6 3.6"/>',
  copier: '<rect x="8" y="8" width="12" height="12" rx="1.5"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"/>',
};

export const NOMS_ICONES = Object.keys(ICONES);

/** Une icone au trait, ou une chaine vide si le nom est inconnu. */
export function icone(nom, { classe = '' } = {}) {
  const dessin = ICONES[nom];
  if (!dessin) return '';
  return '<svg class="icone ' + escapeHtml(classe) + '" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">'
    + dessin + '</svg>';
}

/**
 * Le fond de la carte, avant qu'on la charge : un plan stylise, sans donnee
 * reelle (aucune tuile n'est demandee a un tiers avant le clic du visiteur).
 */
export function planStylise() {
  return '<svg class="plan" viewBox="0 0 400 240" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">'
    + '<path class="plan__rue plan__rue--large" d="M-10 160 C80 140 160 170 240 130 S360 90 410 100"/>'
    + '<path class="plan__rue" d="M60 -10 C80 60 70 140 110 250"/>'
    + '<path class="plan__rue" d="M250 -10 C240 70 270 150 260 250"/>'
    + '<path class="plan__rue" d="M-10 60 C100 70 200 40 410 50"/>'
    + '<path class="plan__rue plan__rue--fine" d="M150 -10 L170 250"/>'
    + '<path class="plan__rue plan__rue--fine" d="M320 -10 C330 100 300 170 340 250"/>'
    + '<path class="plan__rue plan__rue--fine" d="M-10 210 C120 200 240 220 410 190"/>'
    + '</svg>';
}
