/**
 * Les icones de la fiche de prix.
 *
 * Un tableau de barbier porte un petit dessin devant chaque ligne. Il ne dit
 * rien que le texte ne dise deja — il donne le RYTHME, et c'est ce qui fait la
 * difference entre une liste et une carte.
 *
 * Ce sont des NOMS, pas des fichiers : le dessin vit ici, suit les couleurs du
 * theme, pese quelques octets et ne se telecharge pas. Un nom inconnu rend une
 * chaine vide — la ligne s'affiche sans icone plutot que cassee.
 *
 * Un seul trait, la MEME EPAISSEUR partout. Des epaisseurs differentes
 * donneraient l'impression d'un assemblage de pictogrammes trouves ailleurs,
 * et c'est exactement ce qu'on evite.
 */

const D = {
  /* --- la coupe --- */
  tijeras: '<circle cx="6.5" cy="17.5" r="3"/><circle cx="17.5" cy="17.5" r="3"/>'
    + '<path d="M8.6 15.4 19 4M15.4 15.4 5 4"/>',
  rapado: '<rect x="4" y="9" width="16" height="7" rx="2"/><path d="M7 9V6M12 9V6M17 9V6"/>'
    + '<path d="M4 19h16"/>',
  nino: '<path d="M12 4a5 5 0 0 1 5 5v2a5 5 0 0 1-10 0V9a5 5 0 0 1 5-5Z"/>'
    + '<path d="M4 21a8 8 0 0 1 16 0"/>',

  /* --- la barbe --- */
  barba: '<path d="M5 5v5a7 7 0 0 0 14 0V5"/><path d="M9 14.5c1 1 5 1 6 0"/>'
    + '<path d="M8.5 9h.01M15.5 9h.01"/>',
  navaja: '<path d="M3 14h11a3 3 0 0 1 0 6H6a3 3 0 0 1-3-3Z"/>'
    + '<path d="M15 17c4 0 7-4 9-11-6 2-10 5-11 8Z"/>',

  /* --- le soin --- */
  mascarilla: '<path d="M4 10h16a8 8 0 0 1-16 0Z"/><path d="M12 10V4"/><path d="M8 21h8"/>'
    + '<path d="M12 18v3"/>',
  gota: '<path d="M12 3c4 5 6 8 6 10.5A6 6 0 0 1 6 13.5C6 11 8 8 12 3Z"/>',
  bote: '<rect x="7" y="8" width="10" height="13" rx="2"/><path d="M10 8V5h4v3"/>'
    + '<path d="M10 12h4"/>',
  cera: '<path d="M4 12h16a8 8 0 0 1-16 0Z"/><path d="M7 8c0-2 2-2 2-4M12 8c0-2 2-2 2-4M17 8c0-2 2-2 2-4"/>',
  lavado: '<path d="M3 12h18a9 9 0 0 1-18 0Z"/><path d="M8 8c0-3 2-5 5-5"/>'
    + '<path d="M6 21l1-3M18 21l-1-3"/>',

  /* --- la couleur --- */
  tinte: '<path d="m4 20 2-6 9-9 4 4-9 9Z"/><path d="m14 5 4 4"/><path d="M4 20h5"/>',
  mechas: '<path d="M5 4v16M9.7 4v16M14.3 4v16M19 4v16"/>',
  peine: '<path d="M4 8h16"/><path d="M6 8v8M10 8v11M14 8v11M18 8v8"/>',
  cejas: '<path d="M4 14c3-6 13-6 16 0"/><path d="M7 9.5h.01M12 8h.01M17 9.5h.01"/>',

  /* --- le coiffage --- */
  secador: '<path d="M4 7a5 5 0 0 1 5-5h4v10H9a5 5 0 0 1-5-5Z"/><path d="M13 4h5l2 2v2l-2 2h-5"/>'
    + '<path d="M8 12l1 9h3l-1-9"/>',
  cepillo: '<rect x="8" y="3" width="8" height="10" rx="4"/><path d="M6 6h2M6 10h2M16 6h2M16 10h2"/>'
    + '<path d="M12 13v8"/>',
  ondas: '<path d="M4 7c3-3 5 3 8 0s5 3 8 0"/><path d="M4 12c3-3 5 3 8 0s5 3 8 0"/>'
    + '<path d="M4 17c3-3 5 3 8 0s5 3 8 0"/>',
  plancha: '<path d="M6 3h4l-1 13H7Z"/><path d="M14 3h4l-1 13h-2Z"/><path d="M8 16v5M16 16v5"/>',
  recogido: '<circle cx="12" cy="6" r="3"/><path d="M6 21v-5a6 6 0 0 1 12 0v5"/><path d="M9 11c1 1 5 1 6 0"/>',

  /* --- la beaute --- */
  esmalte: '<rect x="7" y="10" width="10" height="11" rx="2"/><path d="M10 10V6h4v4"/><path d="M11 6V3h2v3"/>',
  labial: '<path d="M9 21V12h6v9Z"/><path d="M10 12V7l4-3v8"/><path d="M8 21h8"/>',
  pestanas: '<path d="M3 13c4-5 14-5 18 0"/><path d="M6 10.5 4.5 7.5M9.5 9 9 5.5M14.5 9l.5-3.5M18 10.5l1.5-3"/>',
  hoja: '<path d="M5 19C5 10 10 5 20 4c-1 10-6 15-15 15Z"/><path d="M5 19 13 11"/>',
  destello: '<path d="M12 3v6M12 15v6M3 12h6M15 12h6"/><path d="m7 7 2 2M15 15l2 2M17 7l-2 2M9 15l-2 2"/>',
  diadema: '<path d="M4 17 6 8l4 4 2-6 2 6 4-4 2 9Z"/><path d="M4 20h16"/>',
};

export const ICONES = Object.keys(D);

/**
 * Le dessin d'une icone, ou une chaine vide si le nom est inconnu.
 *
 * Rendre vide plutot que jeter : une icone manquante ne doit jamais empecher
 * un prix de s'afficher en vitrine.
 */
export function iconeTarifa(nom) {
  const chemin = D[String(nom || '')];
  if (!chemin) return '';
  return '<svg class="illu illu--tarifa" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">'
    + '<g class="illu__trait">' + chemin + '</g>'
    + '</svg>';
}
