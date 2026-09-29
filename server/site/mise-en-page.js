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
    + '<meta property="og:site_name" content="Peluquería HARON">\n'
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
 * Le logotype : un peigne stylise, les deux lames d'un ciseau, et la diagonale
 * du mat de barbier. Dessine en SVG, donc net a toutes les tailles et servi
 * depuis la meme origine.
 */
export function marque({ taille = 'grand', lien = true } = {}) {
  // « Peluquería HARON » est le NOM DE L'ENSEIGNE, pas un libelle : il ne se
  // traduit pas, pas plus qu'on ne traduirait « Carrefour ». Seul le texte que
  // lit le lecteur d'ecran suit la langue du salon — c'est une phrase, elle.
  const interieur = '<span class="marque__embleme" aria-hidden="true">' + embleme() + '</span>'
    + '<span class="marque__mots">'
    + '<span class="marque__peluqueria">Peluquería</span>'
    + '<span class="marque__haron">HARON</span>'
    + '</span>';
  const classe = 'marque marque--' + taille;
  const tr = traduire(langueActive());
  return lien
    ? '<a class="' + classe + '" href="/"><span class="visuellement-cache">'
      + escapeHtml(tr('marque.inicio', { nom: 'Peluquería HARON' })) + '</span>' + interieur + '</a>'
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
  const tr = traduire(langueActive());
  const lignes = [];
  if (adresse) lignes.push('<p class="pied__ligne">' + escapeHtml(adresse) + '</p>');
  if (telephone) {
    lignes.push('<p class="pied__ligne"><a href="tel:' + escapeHtml(telephone.replace(/[^+0-9]/g, '')) + '">' + escapeHtml(telephone) + '</a></p>');
  }
  if (horaires && horaires.length) {
    const items = horaires.map((h) => '<li><span>' + escapeHtml(h.nom) + '</span><span>'
      + (h.ferme
        ? escapeHtml(tr('commun.ferme'))
        : escapeHtml(h.plages.map((p) => p.ouverture + ' – ' + p.fermeture).join(' · '))) + '</span></li>').join('');
    lignes.push('<ul class="pied__horaires">' + items + '</ul>');
  }
  return '<footer class="pied">'
    + '<div class="enveloppe">'
    + (lignes.length ? '<div class="pied__infos">' + lignes.join('') + '</div>' : '')
    + '<div class="pied__bas">'
    + '<p class="pied__mention">' + escapeHtml(tr('pied.devise')) + '</p>'
    // L'acces du personnel : discret, en bas, et JAMAIS un bouton.
    //
    // POURQUOI PAS CACHE. Le masquer ne protege rien : « /gestion » est un
    // chemin ordinaire, et les robots qui sondent deja « /.env » le trouvent
    // sans lien. Ce qui protege, c'est la limite de debit sur la connexion et
    // le verrouillage du compte apres plusieurs echecs — tous deux en place.
    //
    // POURQUOI PAS UN BOUTON. La vitrine n'a qu'un seul geste a proposer :
    // prendre son tour. Un second bouton oblige le client a choisir, et un
    // choix inutile coute tous les jours ce qu'un lien discret ne coute
    // jamais.
    //
    // « Personal » et non « gerente » : le coiffeur s'en sert plus que le
    // gerant. C'est son ecran de travail.
    //
    // « nofollow » va avec le « Disallow: /gestion » de robots.txt : les deux
    // disent la meme chose, a deux robots qui ne lisent pas les memes regles.
    + '<a class="pied__acces" href="/gestion" rel="nofollow">' + escapeHtml(tr('pied.acces')) + '</a>'
    + '</div>'
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
