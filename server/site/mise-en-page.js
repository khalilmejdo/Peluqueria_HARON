/**
 * La coquille des pages publiques.
 *
 * Les pages du client sont rendues PAR LE SERVEUR : elles s'affichent des le
 * premier octet recu, sur un telephone en 4G faible, meme si le JavaScript
 * n'arrive jamais. Le temps reel vient ensuite s'y greffer.
 *
 * Aucun style ni script en ligne : la politique de securite du contenu les
 * interdit, et c'est ce qui fait qu'une faille d'echappement, si elle existait,
 * ne pourrait pas devenir une execution de code.
 */
import { escapeHtml } from '../core/text.js';
import { config } from '../core/config.js';
import { traduire, langueActive, LANGUES } from '../core/langue.js';
import { deviseActive, DEVISES } from '../core/devise.js';
import { nomDuSalon } from '../core/reglages.js';

const v = () => (config.version ? '?v=' + config.version : '');

/**
 * @param {{ titre:string, description:string, corps:string, base:string,
 *           classe?:string, scripts?:string[], chemin?:string, robots?:string,
 *           donnees?:object|null, entete?:boolean, pied?:string|null,
 *           langue?:string|null }} p
 */
export function page({
  titre, description, corps, base, classe = '', scripts = [], chemin = '/',
  robots = 'index, follow', donnees = null, pied = null, langue = null,
}) {
  const code = LANGUES[langue] ? langue : langueActive();
  const tr = traduire(code);
  const devise = deviseActive();
  const url = base + chemin;
  const modules = scripts.map((s) => '<script type="module" src="' + s + v() + '"></script>').join('');
  // Les donnees initiales voyagent dans un attribut de donnees, jamais dans un
  // script en ligne : la politique de securite du contenu reste stricte.
  const socle = donnees
    ? '<div id="donnees" hidden data-initial="' + escapeHtml(JSON.stringify(donnees)) + '"></div>'
    : '';

  // LA LANGUE ET LA MONNAIE SONT POSEES SUR <html>.
  //
  // C'est ainsi que les scripts les apprennent. La politique de securite du
  // contenu interdit tout script en ligne, donc impossible de leur passer une
  // variable ; et un second appel au serveur pour demander « quelle langue ? »
  // serait un aller-retour de plus sur un telephone en 4G faible. Un attribut
  // deja present dans le document ne coute rien.
  //
  // `lang` n'est pas decoratif : c'est lui qui dit au lecteur d'ecran quelle
  // prononciation employer, et au navigateur quelles regles de cesure appliquer.
  return '<!DOCTYPE html>\n'
    + '<html lang="' + escapeHtml(tr.htmlLang) + '" data-devise="' + escapeHtml(devise) + '"'
    + ' data-symbole="' + escapeHtml(DEVISES[devise].symbole) + '"'
    + ' class="' + escapeHtml(classe) + '">\n'
    + '<head>\n'
    + '<meta charset="utf-8">\n'
    + '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
    + '<title>' + escapeHtml(titre) + '</title>\n'
    + '<meta name="description" content="' + escapeHtml(description) + '">\n'
    + '<meta name="robots" content="' + escapeHtml(robots) + '">\n'
    + '<meta name="theme-color" content="#0E1013">\n'
    + '<link rel="canonical" href="' + escapeHtml(url) + '">\n'
    + '<link rel="icon" href="/img/favicon.svg' + v() + '" type="image/svg+xml">\n'
    + '<link rel="apple-touch-icon" href="/img/app-180.png' + v() + '">\n'
    + '<link rel="manifest" href="/haron.webmanifest' + v() + '">\n'
    + '<meta property="og:type" content="website">\n'
    + '<meta property="og:site_name" content="' + escapeHtml(nomDuSalon()) + '">\n'
    + '<meta property="og:locale" content="' + escapeHtml(tr.ogLocale) + '">\n'
    + '<meta property="og:title" content="' + escapeHtml(titre) + '">\n'
    + '<meta property="og:description" content="' + escapeHtml(description) + '">\n'
    + '<meta property="og:url" content="' + escapeHtml(url) + '">\n'
    + '<meta property="og:image" content="' + escapeHtml(base + '/img/og.png') + '">\n'
    + '<meta property="og:image:width" content="1200">\n'
    + '<meta property="og:image:height" content="630">\n'
    + '<meta name="twitter:card" content="summary_large_image">\n'
    + '<link rel="stylesheet" href="/css/fonts.css' + v() + '">\n'
    + '<link rel="stylesheet" href="/css/site.css' + v() + '">\n'
    + '<link rel="stylesheet" href="/css/vitrine.css' + v() + '">\n'
    + '</head>\n'
    + '<body>\n'
    + '<a class="saut" href="#principal">' + escapeHtml(tr('saut.contenu')) + '</a>\n'
    + corps
    + (pied ?? piedDePage())
    + socle
    + modules
    + '\n</body>\n</html>';
}

/**
 * Le nom du salon, coupe pour le logo : le dernier mot en grand, le reste
 * au-dessus en petites capitales. « Peluquería HARON » donne « Peluquería » /
 * « HARON » ; « Salon Atlas » donnerait « Salon » / « Atlas ». Un nom d'un seul
 * mot tient tout entier sur la grande ligne.
 */
export function decouperNom(nom) {
  const mots = String(nom || '').trim().split(/\s+/).filter(Boolean);
  if (mots.length < 2) return { petit: '', grand: mots[0] || '' };
  return { petit: mots.slice(0, -1).join(' '), grand: mots[mots.length - 1] };
}

/**
 * Le logotype : un peigne stylise, les deux lames d'un ciseau, et la diagonale
 * du mat de barbier. Dessine en SVG, donc net a toutes les tailles et servi
 * depuis la meme origine.
 *
 * LE NOM VIENT DU REGLAGE « salon.nom ». Il etait ecrit en dur — « Peluquería /
 * HARON » — si bien qu'un autre salon, ou le meme renomme, gardait l'enseigne
 * de Fuente Alamo en haut de chaque page.
 */
export function marque({ taille = 'grand', lien = true } = {}) {
  const nom = nomDuSalon();
  const { petit, grand } = decouperNom(nom);
  const interieur = '<span class="marque__embleme" aria-hidden="true">' + embleme() + '</span>'
    + '<span class="marque__mots">'
    + (petit ? '<span class="marque__peluqueria">' + escapeHtml(petit) + '</span>' : '')
    + '<span class="marque__haron">' + escapeHtml(grand) + '</span>'
    + '</span>';
  const classe = 'marque marque--' + taille;
  const tr = traduire(langueActive());
  return lien
    ? '<a class="' + classe + '" href="/"><span class="visuellement-cache">'
      + escapeHtml(tr('marque.inicio', { nom })) + '</span>' + interieur + '</a>'
    : '<span class="' + classe + '">' + interieur + '</span>';
}

export function embleme() {
  return '<svg viewBox="0 0 48 48" fill="none" aria-hidden="true" focusable="false">'
    + '<circle cx="24" cy="24" r="21" class="embleme__fond"/>'
    + '<path d="M10 34 L26 10" class="embleme__raie"/>'
    + '<path d="M17 38 L33 14" class="embleme__raie embleme__raie--2"/>'
    + '<circle cx="17" cy="32" r="4.2" class="embleme__lame"/>'
    + '<circle cx="29" cy="32" r="4.2" class="embleme__lame"/>'
    + '<path d="M15 14 L31 33 M31 14 L15 33" class="embleme__ciseau"/>'
    + '</svg>';
}

/**
 * La barre du haut, sur TOUTES les pages publiques.
 *
 * Les liens pointent vers « /#section » et non « #section » : depuis la page
 * de reservation ou de suivi, ils ramenent a la vitrine, au bon endroit.
 * Seules les sections qui EXISTENT ont un lien — un lien vers une section
 * absente mene en haut de page et fait croire a une panne.
 *
 * @param {{ retour?: {href:string, texte:string}|null,
 *           sections?: Array<{ancre:string, cle:string}>,
 *           etat?: {classe:string, texte:string}|null,
 *           appel?: boolean }} [o]
 */
export function entete({ retour = null, sections = [], etat = null, appel = false } = {}) {
  const tr = traduire(langueActive());
  const liens = sections
    .map((s) => '<a class="vt-nav__lien" href="/#' + escapeHtml(s.ancre) + '">' + escapeHtml(tr(s.cle)) + '</a>')
    .join('');
  return '<header class="vt-barre" data-barre>'
    + '<div class="vt-barre__dedans">'
    + marque({ taille: 'petit' })
    + (liens ? '<nav class="vt-nav" aria-label="' + escapeHtml(tr('vt.nav.aria')) + '">' + liens + '</nav>' : '')
    + '<div class="vt-barre__droite">'
    + (etat
      ? '<span class="vt-etat vt-etat--' + escapeHtml(etat.classe) + '"><span class="vt-etat__point" aria-hidden="true"></span>'
        + escapeHtml(etat.texte) + '</span>'
      : '')
    + (retour ? '<a class="lien-retour" href="' + escapeHtml(retour.href) + '">' + escapeHtml(retour.texte) + '</a>' : '')
    + (appel ? '<a class="bouton bouton--principal vt-barre__appel" href="/#reserver">' + escapeHtml(tr('vt.nav.reserver')) + '</a>' : '')
    + '</div>'
    + '</div>'
    + '</header>';
}

/**
 * Le pied de page : l'enseigne et sa devise, ou nous trouver, quand venir.
 * C'est la que l'oeil va chercher un numero en fin de page ; il doit l'y
 * trouver sans remonter.
 */
export function piedDePage({ horaires = null, adresse = null, telephone = null } = {}) {
  const tr = traduire(langueActive());
  const nom = nomDuSalon();
  const colonnes = [];

  colonnes.push('<div class="vt-pied__col vt-pied__col--marque">'
    + marque({ taille: 'petit' })
    + '<p class="vt-pied__devise">' + escapeHtml(tr('pied.devise')) + '</p>'
    + '</div>');

  if (adresse || telephone) {
    colonnes.push('<div class="vt-pied__col"><p class="vt-pied__titre">' + escapeHtml(tr('contact.titre')) + '</p>'
      + (adresse ? '<p class="vt-pied__ligne">' + escapeHtml(adresse) + '</p>' : '')
      + (telephone
        ? '<p class="vt-pied__ligne"><a href="tel:' + escapeHtml(telephone.replace(/[^+0-9]/g, '')) + '">' + escapeHtml(telephone) + '</a></p>'
        : '')
      + '</div>');
  }

  if (horaires && horaires.length) {
    colonnes.push('<div class="vt-pied__col"><p class="vt-pied__titre">' + escapeHtml(tr('contact.horaires')) + '</p>'
      + '<ul class="vt-pied__horaires">'
      + horaires.map((h) => '<li><span>' + escapeHtml(h.nom) + '</span><span>'
        + (h.ferme ? escapeHtml(tr('commun.ferme'))
          : escapeHtml(h.plages.map((p) => p.ouverture + ' – ' + p.fermeture).join(' · '))) + '</span></li>').join('')
      + '</ul></div>');
  }

  return '<footer class="vt-pied">'
    + '<div class="vt-pied__dedans vt-pied__dedans--' + colonnes.length + '">' + colonnes.join('') + '</div>'
    + '<div class="vt-pied__bas">'
    + '<p>© ' + new Date().getFullYear() + ' ' + escapeHtml(nom) + '</p>'
    // L'acces du personnel : discret, en bas, et JAMAIS un bouton. Le cacher ne
    // protegerait rien (« /gestion » se devine) : ce qui protege, c'est la
    // limite de debit et le verrouillage du compte, tous deux en place. Un
    // second bouton obligerait en revanche le client a choisir.
    + '<a class="vt-pied__acces" href="/gestion" rel="nofollow">' + escapeHtml(tr('pied.acces')) + '</a>'
    + '</div>'
    + '</footer>';
}

/** Page d'erreur publique, dans la meme identite que le reste. */
export function pageErreur({ base, titre, message, statut = 404 }) {
  const tr = traduire(langueActive());
  const corps = entete()
    + '<main class="enveloppe page-etroite" id="principal">'
    + '<section class="carte carte--centree">'
    + '<p class="pastille pastille--neutre">' + escapeHtml(tr('erreur.etiquette', { statut })) + '</p>'
    + '<h1 class="titre-page">' + escapeHtml(titre) + '</h1>'
    + '<p class="texte-doux">' + escapeHtml(message) + '</p>'
    + '<a class="bouton bouton--principal" href="/">' + escapeHtml(tr('commun.retourAccueil')) + '</a>'
    + '</section>'
    + '</main>';
  return page({
    titre: titre + ' — Peluquería HARON',
    description: message,
    corps,
    base,
    chemin: '/',
    robots: 'noindex, nofollow',
    classe: 'theme-sombre',
  });
}
