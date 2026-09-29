/**
 * La monnaie du salon.
 *
 * Un salon en Espagne compte en euros, un salon au Maroc en dirhams. Le reste du
 * code ne connait que des CENTIMES ENTIERS et ne change pas d'une ligne : seul
 * l'habillage du nombre depend d'ici.
 *
 * LES DEUX MONNAIES S'ECRIVENT DE LA MEME FACON : virgule decimale, symbole
 * apres, espace insecable entre les deux. « 14,90 € » et « 149,50 DH ». Il n'y a
 * donc aucun drapeau « symbole avant / apres » dans ce module — ajouter un
 * reglage dont toutes les valeurs sont identiques est une complication qui
 * donne l'illusion d'etre generale. Le jour ou une monnaie qui se prefixe
 * arrivera, elle se lira dans ce fichier et nulle part ailleurs.
 *
 * L'ESPACE EST INSECABLE. « 150 DH » coupe en fin de ligne donnerait un « 150 »
 * seul au bout d'une ligne de tarif et un « DH » orphelin sur la suivante ; sur
 * l'affiche de la vitrine, imprimee une fois pour des annees, ce detail se voit.
 */

/**
 * L'espace insecable ordinaire (U+00A0), et non l'espace fine insecable
 * (U+202F) que demanderait la typographie soignee : la fine manque encore dans
 * des polices tres repandues, et un montant qui affiche un rectangle vide a la
 * place de son espace est bien pire qu'un montant un peu large.
 */
const ESPACE = ' ';

export const DEVISES = {
  EUR: {
    code: 'EUR',
    symbole: '€',
    /** Ce que lit le gerant dans le menu deroulant. */
    libelle: 'Euro (€)',
    /** Les ecritures acceptees a la saisie, en plus des chiffres seuls. */
    saisies: ['€', 'EUR'],
  },
  MAD: {
    code: 'MAD',
    symbole: 'DH',
    libelle: 'Dirham (DH)',
    // « DH » d'abord : c'est ce qu'un gerant marocain tape, et ce qu'il lit sur
    // toutes les fiches de prix du pays. « MAD » ne sert qu'aux virements.
    saisies: ['DH', 'MAD', 'DHS'],
  },
};

export const CODES_DEVISES = Object.keys(DEVISES);

/** L'euro reste le defaut : c'est la monnaie du premier salon installe. */
export const DEVISE_DEFAUT = 'EUR';

/* ------------------------------------------------------------------ */
/*  La devise active                                                   */
/* ------------------------------------------------------------------ */

/**
 * Meme raisonnement que pour la langue : une base, un salon, une monnaie. La
 * valeur est posee par reglages.lireTous() et lue partout ou un prix s'affiche.
 */
let active = DEVISE_DEFAUT;

export function poserDeviseActive(code) {
  active = DEVISES[code] ? code : DEVISE_DEFAUT;
  return active;
}

export const deviseActive = () => active;
export const symboleActif = () => DEVISES[active].symbole;

/* ------------------------------------------------------------------ */
/*  Centimes -> texte                                                  */
/* ------------------------------------------------------------------ */

/**
 * « 1490 » -> « 14,90 € ». Les centimes a zero ne s'ecrivent pas : une fiche de
 * prix de salon annonce « 14 € », jamais « 14,00 € ».
 *
 * Au Maroc, la quasi-totalite des prix sont des dirhams entiers — la regle rend
 * donc « 150 DH », exactement ce qui est ecrit sur le mur du salon.
 */
export function montantLisible(centimes, code = active) {
  const devise = DEVISES[code] || DEVISES[DEVISE_DEFAUT];
  const n = Math.trunc(Number(centimes) || 0);
  const entiers = Math.floor(Math.abs(n) / 100);
  const cts = Math.abs(n) % 100;
  const signe = n < 0 ? '-' : '';
  const nombre = cts === 0 ? String(entiers) : entiers + ',' + String(cts).padStart(2, '0');
  return signe + nombre + ESPACE + devise.symbole;
}

/* ------------------------------------------------------------------ */
/*  Texte -> centimes                                                  */
/* ------------------------------------------------------------------ */

/**
 * Toutes les ecritures de monnaie, quelle que soit la devise du salon.
 *
 * ON ACCEPTE « € » MEME AU MAROC. Un gerant qui recopie une ancienne fiche, ou
 * qui colle un prix depuis un message, ne doit pas se voir refuser un nombre
 * parfaitement lisible a cause d'un symbole en trop. Le symbole saisi est
 * IGNORE, pas interprete : le montant est enregistre dans la monnaie du salon,
 * et c'est la seule lecture possible — convertir en silence un euro en dirham
 * serait la pire des reponses.
 */
const SYMBOLES = Object.values(DEVISES)
  .flatMap((d) => d.saisies)
  .concat(['dhs', 'dh', 'mad', 'eur'])
  .sort((a, b) => b.length - a.length);

/** Au-dela, ce n'est plus un prix de coiffure mais une faute de frappe. */
export const MONTANT_MAX_CTS = 100000;

/**
 * Lit un montant saisi a la main et rend des CENTIMES.
 *
 * Accepte « 14 », « 14,9 », « 14,90 », « 14.90 », « 14 € », « 150 DH », « 150dh ».
 * Refuse tout le reste plutot que de deviner : un prix mal lu s'affiche au mur.
 *
 * Le calcul evite le flottant. `Math.round(14.9 * 100)` donnerait bien 1490,
 * mais `Math.round(1.005 * 100)` donne 100 et non 101 : on assemble les deux
 * moities en entiers et on ne depend jamais de l'arrondi binaire.
 */
export function centimesDepuisTexte(entree) {
  if (entree === null || entree === undefined) return null;
  // Un entier deja en centimes (ce qu'envoie l'interface) passe tel quel.
  if (typeof entree === 'number') {
    return Number.isInteger(entree) && entree >= 0 && entree <= MONTANT_MAX_CTS ? entree : null;
  }

  let texte = String(entree).trim().toLowerCase();
  for (const symbole of SYMBOLES) {
    const bas = symbole.toLowerCase();
    if (texte.endsWith(bas)) {
      texte = texte.slice(0, -bas.length);
      break;
    }
    if (texte.startsWith(bas)) {
      texte = texte.slice(bas.length);
      break;
    }
  }
  // Les espaces de toutes sortes, y compris l'insecable que rend montantLisible :
  // un prix relu a l'ecran et recolle dans le champ doit repasser.
  texte = texte.replace(/[\s  ]/g, '').replace(',', '.');

  if (!/^\d{1,4}(\.\d{1,2})?$/.test(texte)) return null;
  const [entiers, decimales = ''] = texte.split('.');
  const centimes = Number(entiers) * 100 + Number((decimales + '00').slice(0, 2));
  return centimes <= MONTANT_MAX_CTS ? centimes : null;
}

/** Le catalogue des monnaies, pour le menu deroulant des reglages. */
export const optionsDevises = () => CODES_DEVISES.map((code) => ({
  valeur: code,
  libelle: DEVISES[code].libelle,
}));
