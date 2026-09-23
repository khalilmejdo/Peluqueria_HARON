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

const v = () => (config.version ? '?v=' + config.version : '');

/**
 * @param {{ titre:string, description:string, corps:string, base:string,
 *           classe?:string, scripts?:string[], chemin?:string, robots?:string,
 *           donnees?:object|null, entete?:boolean, pied?:string|null }} p
 */
export function page({
  titre, description, corps, base, classe = '', scripts = [], chemin = '/',
  robots = 'index, follow', donnees = null, pied = null,
}) {
  const url = base + chemin;
  const modules = scripts.map((s) => '<script type="module" src="' + s + v() + '"></script>').join('');
  // Les donnees initiales voyagent dans un attribut de donnees, jamais dans un
  // script en ligne : la politique de securite du contenu reste stricte.
  const socle = donnees
    ? '<div id="donnees" hidden data-initial="' + escapeHtml(JSON.stringify(donnees)) + '"></div>'
    : '';

  return '<!DOCTYPE html>\n'
    + '<html lang="fr" class="' + escapeHtml(classe) + '">\n'
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
    + '<meta property="og:site_name" content="Peluquería HARON">\n'
    + '<meta property="og:locale" content="fr_FR">\n'
    + '<meta property="og:title" content="' + escapeHtml(titre) + '">\n'
    + '<meta property="og:description" content="' + escapeHtml(description) + '">\n'
    + '<meta property="og:url" content="' + escapeHtml(url) + '">\n'
    + '<meta property="og:image" content="' + escapeHtml(base + '/img/og.png') + '">\n'
    + '<meta property="og:image:width" content="1200">\n'
    + '<meta property="og:image:height" content="630">\n'
    + '<meta name="twitter:card" content="summary_large_image">\n'
    + '<link rel="stylesheet" href="/css/fonts.css' + v() + '">\n'
    + '<link rel="stylesheet" href="/css/site.css' + v() + '">\n'
    + '</head>\n'
    + '<body>\n'
    + '<a class="saut" href="#principal">Aller au contenu</a>\n'
    + corps
    + (pied ?? piedDePage())
    + socle
    + modules
    + '\n</body>\n</html>';
}

/**
 * Le logotype : un peigne stylise, les deux lames d'un ciseau, et la diagonale
 * du mat de barbier. Dessine en SVG, donc net a toutes les tailles et servi
 * depuis la meme origine.
 */
export function marque({ taille = 'grand', lien = true } = {}) {
  const interieur = '<span class="marque__embleme" aria-hidden="true">' + embleme() + '</span>'
    + '<span class="marque__mots">'
    + '<span class="marque__peluqueria">Peluquería</span>'
    + '<span class="marque__haron">HARON</span>'
    + '</span>';
  const classe = 'marque marque--' + taille;
  return lien
    ? '<a class="' + classe + '" href="/"><span class="visuellement-cache">Peluquería HARON, accueil</span>' + interieur + '</a>'
    : '<span class="' + classe + '">' + interieur + '</span>';
}

export function embleme() {
  return '<svg viewBox="0 0 48 48" fill="none" aria-hidden="true" focusable="false">'
    + '<rect x="3" y="3" width="42" height="42" rx="12" class="embleme__fond"/>'
    + '<path d="M10 34 L26 10" class="embleme__raie"/>'
    + '<path d="M17 38 L33 14" class="embleme__raie embleme__raie--2"/>'
    + '<circle cx="17" cy="32" r="4.2" class="embleme__lame"/>'
    + '<circle cx="29" cy="32" r="4.2" class="embleme__lame"/>'
    + '<path d="M15 14 L31 33 M31 14 L15 33" class="embleme__ciseau"/>'
    + '</svg>';
}

/** Le bandeau haut des pages publiques. */
export function entete({ retour = null } = {}) {
  return '<header class="entete">'
    + '<div class="enveloppe enveloppe--entete">'
    + marque({ taille: 'petit' })
    + (retour ? '<a class="lien-retour" href="' + escapeHtml(retour.href) + '">' + escapeHtml(retour.texte) + '</a>' : '')
    + '</div>'
    + '</header>';
}

export function piedDePage({ horaires = null, adresse = null, telephone = null } = {}) {
  const lignes = [];
  if (adresse) lignes.push('<p class="pied__ligne">' + escapeHtml(adresse) + '</p>');
  if (telephone) {
    lignes.push('<p class="pied__ligne"><a href="tel:' + escapeHtml(telephone.replace(/[^+0-9]/g, '')) + '">' + escapeHtml(telephone) + '</a></p>');
  }
  if (horaires && horaires.length) {
    const items = horaires.map((h) => '<li><span>' + escapeHtml(h.nom) + '</span><span>'
      + (h.ferme ? 'Fermé' : escapeHtml(h.ouverture + ' – ' + h.fermeture)) + '</span></li>').join('');
    lignes.push('<ul class="pied__horaires">' + items + '</ul>');
  }
  return '<footer class="pied">'
    + '<div class="enveloppe">'
    + (lignes.length ? '<div class="pied__infos">' + lignes.join('') + '</div>' : '')
    + '<p class="pied__mention">Un salon. Une file. Un ticket.</p>'
    + '</div>'
    + '</footer>';
}

/** Page d'erreur publique, dans la meme identite que le reste. */
export function pageErreur({ base, titre, message, statut = 404 }) {
  const corps = entete()
    + '<main class="enveloppe page-etroite" id="principal">'
    + '<section class="carte carte--centree">'
    + '<p class="pastille pastille--neutre">Erreur ' + statut + '</p>'
    + '<h1 class="titre-page">' + escapeHtml(titre) + '</h1>'
    + '<p class="texte-doux">' + escapeHtml(message) + '</p>'
    + '<a class="bouton bouton--principal" href="/">Revenir à l’accueil</a>'
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
