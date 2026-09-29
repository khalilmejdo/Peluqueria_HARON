/**
 * La monnaie, cote navigateur.
 *
 * Le symbole vient de « <html data-symbole> », pose par le serveur — meme
 * raisonnement que pour la langue : rien en ligne, aucun aller-retour.
 *
 * Le montant reste un ENTIER DE CENTIMES de bout en bout. Ce fichier ne fait que
 * l'habiller, et il doit rendre EXACTEMENT ce que rend montantLisible() cote
 * serveur : la meme virgule, le meme espace insecable, la meme regle des
 * centimes muets. Deux ecritures differentes du meme prix sur la meme page —
 * l'une rendue par le serveur, l'autre par le script — se voient tout de suite,
 * et font douter du prix.
 */

/** L'espace insecable, le meme que celui du serveur (U+00A0). */
const ESPACE = ' ';

/**
 * Relu a chaque appel, et non fige au chargement : ce module est importe par du
 * code que des tests executent dans Node, ou `document` n'existe pas. Un defaut
 * plutot qu'un vide — un prix sans monnaie ne se lit pas, et l'euro est la
 * monnaie du premier salon installe.
 */
function lireAttribut(nom, defaut) {
  if (typeof document === 'undefined' || !document.documentElement) return defaut;
  return String(document.documentElement.dataset[nom] || '').trim() || defaut;
}

export const symboleMonnaie = () => lireAttribut('symbole', '€');
export const codeMonnaie = () => lireAttribut('devise', 'EUR');

/**
 * « 1490 » -> « 14,90 € ». Les centimes a zero ne s'ecrivent pas : une fiche de
 * prix de salon annonce « 14 € », jamais « 14,00 € ».
 */
export function montant(centimes) {
  const n = Math.trunc(Number(centimes) || 0);
  const entiers = Math.floor(Math.abs(n) / 100);
  const cts = Math.abs(n) % 100;
  const signe = n < 0 ? '-' : '';
  const nombre = cts === 0 ? String(entiers) : entiers + ',' + String(cts).padStart(2, '0');
  return signe + nombre + ESPACE + symboleMonnaie();
}

/**
 * Le montant SANS son symbole, pour preremplir un champ de saisie.
 *
 * Le champ attend un nombre ; y deposer « 14,90 € » obligerait le gerant a
 * effacer le symbole avant de corriger le prix. Le serveur accepte les deux, mais
 * ce n'est pas une raison pour lui donner du travail.
 */
export function montantNu(centimes) {
  return montant(centimes).replace(new RegExp(ESPACE + '.*$'), '');
}
