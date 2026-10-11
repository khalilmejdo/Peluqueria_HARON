/**
 * LA MISE EN PAGE COMMUNE des pages du client : le document, l'en-tete, le
 * pied de page, la page d'erreur.
 *
 * TOUT CE QUI EST DE LA MARQUE VIENT DU THEME COURANT (core/reglages.js ->
 * themeCourant) : le nom, le logo ou le monogramme, la couleur de la barre du
 * navigateur, les icones, le manifeste. Aucune couleur, aucun nom ici.
 *
 * La feuille /theme.css est chargee EN DERNIER : elle remplace les valeurs de
 * repli que base.css pose pour le cas ou elle ne viendrait pas.
 */
import { escapeHtml } from '../core/text.js';
import { config } from '../core/config.js';
import { traduire, langueActive, LANGUES } from '../core/langue.js';
import { deviseActive, DEVISES } from '../core/devise.js';
import { nomDuSalon, themeCourant } from '../core/reglages.js';
import { monogramme, icone } from './ornements.js';

const v = () => (config.version ? '?v=' + config.version : '');

/**
 * Le document complet.
 *
 * @param {object} o
 * @param {string|null} [o.image]  l'image de partage (la couverture du salon) ;
 *   a defaut, l'apercu dessine aux couleurs de la marque.
 */
export function page({
  titre, description, corps, base, classe = '', scripts = [], chemin = '/',
  robots = 'index, follow', donnees = null, pied = null, langue = null, image = null,
}) {
  const code = LANGUES[langue] ? langue : langueActive();
  const tr = traduire(code);
  const devise = deviseActive();
  const theme = themeCourant();
  const q = '?t=' + theme.empreinte;
  const url = base + chemin;
  const modules = scripts.map((s) => '<script type="module" src="' + s + v() + '"></script>').join('');
  const socle = donnees
    ? '<div id="donnees" hidden data-initial="' + escapeHtml(JSON.stringify(donnees)) + '"></div>'
    : '';
  const partage = image ? base + image : base + '/apercu.png' + q;

  return '<!DOCTYPE html>\n'
    + '<html lang="' + escapeHtml(tr.htmlLang) + '" data-devise="' + escapeHtml(devise) + '"'
    + ' data-symbole="' + escapeHtml(DEVISES[devise].symbole) + '"'
    + ' data-activite="' + escapeHtml(theme.activite || 'BARBERIA') + '"'
    + ' data-clarte="' + (theme.clair ? 'clair' : 'sombre') + '"'
    + ' class="' + escapeHtml(classe) + '">\n'
    + '<head>\n'
    + '<meta charset="utf-8">\n'
    + '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
    + '<title>' + escapeHtml(titre) + '</title>\n'
    + '<meta name="description" content="' + escapeHtml(description) + '">\n'
    + '<meta name="robots" content="' + escapeHtml(robots) + '">\n'
    + '<meta name="theme-color" content="' + escapeHtml(theme.couleurTheme) + '">\n'
    + '<meta name="color-scheme" content="' + (theme.clair ? 'light' : 'dark') + '">\n'
    + '<link rel="canonical" href="' + escapeHtml(url) + '">\n'
    + '<link rel="icon" href="/favicon.svg' + q + '" type="image/svg+xml">\n'
    + '<link rel="apple-touch-icon" href="/icones/180.png' + q + '">\n'
    + '<link rel="manifest" href="/site.webmanifest' + q + '">\n'
    + '<meta property="og:type" content="website">\n'
    + '<meta property="og:site_name" content="' + escapeHtml(nomDuSalon()) + '">\n'
    + '<meta property="og:locale" content="' + escapeHtml(tr.ogLocale) + '">\n'
    + '<meta property="og:title" content="' + escapeHtml(titre) + '">\n'
    + '<meta property="og:description" content="' + escapeHtml(description) + '">\n'
    + '<meta property="og:url" content="' + escapeHtml(url) + '">\n'
    + '<meta property="og:image" content="' + escapeHtml(partage) + '">\n'
    + '<meta name="twitter:card" content="summary_large_image">\n'
    + '<link rel="stylesheet" href="/css/fonts.css' + v() + '">\n'
    + '<link rel="stylesheet" href="/css/base.css' + v() + '">\n'
    + '<link rel="stylesheet" href="/css/maison.css' + v() + '">\n'
    + '<link rel="stylesheet" href="/theme.css' + q + '">\n'
    + '</head>\n'
    + '<body>\n'
    + '<a class="saut" href="#principal">' + escapeHtml(tr('saut.contenu')) + '</a>\n'
    + corps
    + (pied ?? piedDePage())
    + socle
    + modules
    + '\n</body>\n</html>';
}

/** « Maison Élise » -> petit « Maison », grand « Élise ». */
export function decouperNom(nom) {
  const mots = String(nom || '').trim().split(/\s+/).filter(Boolean);
  if (mots.length < 2) return { petit: '', grand: mots[0] || '' };
  return { petit: mots.slice(0, -1).join(' '), grand: mots[mots.length - 1] };
}

/**
 * La marque : le LOGO s'il y en a un, sinon le monogramme et le nom.
 * @param {{ taille?: 'petit'|'grand', lien?: boolean, avecNom?: boolean }} [o]
 */
export function marque({ taille = 'petit', lien = true, avecNom = true } = {}) {
  const nom = nomDuSalon();
  const theme = themeCourant();
  const tr = traduire(langueActive());
  const { petit, grand } = decouperNom(nom);
  const interieur = theme.logo
    ? '<img class="marque__logo" src="' + escapeHtml(theme.logo.src) + '" alt="' + escapeHtml(nom) + '"'
      + (theme.logo.largeur ? ' width="' + theme.logo.largeur + '" height="' + theme.logo.hauteur + '"' : '') + '>'
    : '<span class="marque__embleme" aria-hidden="true">' + monogramme(theme.monogramme) + '</span>'
      + (avecNom
        ? '<span class="marque__mots">'
          + (petit ? '<span class="marque__petit">' + escapeHtml(petit) + '</span>' : '')
          + '<span class="marque__grand">' + escapeHtml(grand) + '</span>'
          + '</span>'
        : '');
  const classe = 'marque marque--' + taille + (theme.logo ? ' marque--logo' : '');
  return lien
    ? '<a class="' + classe + '" href="/"><span class="visuellement-cache">'
      + escapeHtml(tr('marque.inicio', { nom })) + '</span>' + interieur + '</a>'
    : '<span class="' + classe + '">' + interieur + '</span>';
}

/**
 * L'EN-TETE.
 *
 * @param {object} o
 * @param {Array<{ancre:string, cle:string}>} [o.sections]  la navigation de la vitrine
 * @param {{href:string, texte:string}|null} [o.retour]
 * @param {{href:string, texte:string}|null} [o.action]  l'appel principal (reserver)
 * @param {boolean} [o.surImage]  pose sur la photo de couverture : transparent
 *   tant qu'on n'a pas defile.
 */
export function entete({ sections = [], retour = null, action = null, surImage = false } = {}) {
  const tr = traduire(langueActive());
  const liens = sections
    .map((s) => '<a class="entete__lien" href="/#' + escapeHtml(s.ancre) + '">' + escapeHtml(tr(s.cle)) + '</a>')
    .join('');
  const bouton = action
    ? '<a class="bouton bouton--principal bouton--petit entete__action" href="' + escapeHtml(action.href) + '">'
      + escapeHtml(action.texte) + '</a>'
    : '';
  return '<header class="entete' + (surImage ? ' entete--sur-image' : '') + '" data-entete>'
    + '<div class="entete__dedans">'
    + marque({ taille: 'petit' })
    + (liens ? '<nav class="entete__nav" aria-label="' + escapeHtml(tr('vt.nav.aria')) + '">' + liens + '</nav>' : '')
    + '<div class="entete__droite">'
    + (retour
      ? '<a class="lien-retour" href="' + escapeHtml(retour.href) + '">' + icone('retour') + '<span>' + escapeHtml(retour.texte) + '</span></a>'
      : '')
    + bouton
    + (liens
      ? '<button class="entete__menu" type="button" data-menu aria-expanded="false" aria-controls="tiroir">'
        + '<span class="visuellement-cache">' + escapeHtml(tr('vt.nav.menu')) + '</span>'
        + '<span class="entete__burger" aria-hidden="true"><span></span><span></span></span></button>'
      : '')
    + '</div>'
    + '</div>'
    + (liens
      ? '<div class="tiroir" id="tiroir" data-tiroir hidden>'
        + '<nav class="tiroir__nav" aria-label="' + escapeHtml(tr('vt.nav.aria')) + '">' + liens.replace(/entete__lien/g, 'tiroir__lien') + '</nav>'
        + (action ? '<a class="bouton bouton--principal tiroir__action" href="' + escapeHtml(action.href) + '">' + escapeHtml(action.texte) + '</a>' : '')
        + '</div>'
      : '')
    + '</header>';
}

/**
 * LE PIED DE PAGE.
 */
export function piedDePage({ horaires = null, adresse = null, telephone = null, devise = null } = {}) {
  const tr = traduire(langueActive());
  const nom = nomDuSalon();
  const colonnes = [];

  colonnes.push('<div class="pied__col pied__col--marque">'
    + marque({ taille: 'petit' })
    + '<p class="pied__devise">' + escapeHtml(devise || tr('pied.devise')) + '</p>'
    + '</div>');

  if (adresse || telephone) {
    colonnes.push('<div class="pied__col"><p class="pied__titre">' + escapeHtml(tr('contact.titre')) + '</p>'
      + (adresse ? '<p class="pied__ligne">' + escapeHtml(adresse) + '</p>' : '')
      + (telephone
        ? '<p class="pied__ligne"><a href="tel:' + escapeHtml(telephone.replace(/[^+0-9]/g, '')) + '">' + escapeHtml(telephone) + '</a></p>'
        : '')
      + '</div>');
  }

  if (horaires && horaires.length) {
    colonnes.push('<div class="pied__col"><p class="pied__titre">' + escapeHtml(tr('contact.horaires')) + '</p>'
      + '<ul class="pied__horaires">'
      + horaires.map((h) => '<li><span>' + escapeHtml(h.nom) + '</span><span>'
        + (h.ferme ? escapeHtml(tr('commun.ferme'))
          : escapeHtml(h.plages.map((p) => p.ouverture + ' – ' + p.fermeture).join(' · '))) + '</span></li>').join('')
      + '</ul></div>');
  }

  return '<footer class="pied">'
    + '<div class="pied__dedans pied__dedans--' + colonnes.length + '">' + colonnes.join('') + '</div>'
    + '<div class="pied__bas">'
    + '<p>© ' + new Date().getFullYear() + ' ' + escapeHtml(nom) + '</p>'
    + '<a class="pied__acces" href="/gestion" rel="nofollow">' + escapeHtml(tr('pied.acces')) + '</a>'
    + '</div>'
    + '</footer>';
}

/** La page d'erreur : sobre, et toujours une porte de sortie. */
export function pageErreur({ base, titre, message, statut = 404 }) {
  const tr = traduire(langueActive());
  const corps = entete()
    + '<main class="page page--etroite" id="principal">'
    + '<section class="carte carte--centree carte--erreur">'
    + '<p class="surtitre">' + escapeHtml(tr('erreur.etiquette', { statut })) + '</p>'
    + '<h1 class="titre-page">' + escapeHtml(titre) + '</h1>'
    + '<p class="texte-doux">' + escapeHtml(message) + '</p>'
    + '<a class="bouton bouton--principal" href="/">' + escapeHtml(tr('commun.retourAccueil')) + '</a>'
    + '</section>'
    + '</main>';
  return page({
    titre: titre + ' — ' + nomDuSalon(),
    description: message,
    corps,
    base,
    chemin: '/',
    robots: 'noindex, nofollow',
  });
}
