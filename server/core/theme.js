/**
 * LE THEME DE LA MARQUE : des reglages aux variables CSS.
 *
 * Une application vendue a plusieurs salons ne peut pas porter ses couleurs
 * dans sa feuille de style. Les feuilles ne parlent donc QUE de jetons
 * (`--fond`, `--accent`, `--police-titre`...) et ce module les remplit depuis
 * les reglages de la marque. Le resultat est servi par /theme.css, une vraie
 * feuille de style : la politique de securite du contenu reste stricte (aucun
 * style en ligne), et le navigateur la met en cache comme les autres.
 *
 * LA LISIBILITE N'EST PAS LAISSEE AU GOUT. Une couleur choisie a l'oeil
 * — un or pale sur un fond ivoire — peut etre illisible en texte. Le module
 * calcule le contraste (WCAG 2.1) et derive un « accent lisible » assez
 * fonce, ou assez clair, pour tenir 4,5:1 sur le fond. L'accent d'origine
 * reste celui des filets et des aplats ; le texte prend sa version lisible.
 */
import { createHash } from 'node:crypto';

/* ------------------------------------------------------------------ */
/*  Couleurs                                                           */
/* ------------------------------------------------------------------ */

export function hexVersRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''));
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbVersHex([r, g, b]) {
  return '#' + [r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('');
}

/** Luminance relative (WCAG 2.1). */
export function luminance(hex) {
  const rgb = hexVersRgb(hex);
  if (!rgb) return 0;
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Rapport de contraste entre deux couleurs, de 1 a 21. */
export function contraste(a, b) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

/** Melange `a` vers `b` dans la proportion `t` (0 = a, 1 = b). */
export function melanger(a, b, t) {
  const x = hexVersRgb(a);
  const y = hexVersRgb(b);
  if (!x || !y) return a;
  return rgbVersHex(x.map((v, i) => v + (y[i] - v) * t));
}

/**
 * La variante de `couleur` qui se lit sur `fond` (contraste >= cible) :
 * assombrie sur un fond clair, eclaircie sur un fond sombre, par petits pas.
 * Elle rend la couleur d'origine si elle tient deja.
 */
export function lisibleSur(couleur, fond, cible = 4.5) {
  if (contraste(couleur, fond) >= cible) return couleur;
  const vers = luminance(fond) > 0.4 ? '#000000' : '#ffffff';
  for (let t = 0.05; t <= 1; t += 0.05) {
    const essai = melanger(couleur, vers, t);
    if (contraste(essai, fond) >= cible) return essai;
  }
  return vers;
}

/* ------------------------------------------------------------------ */
/*  Palettes                                                           */
/* ------------------------------------------------------------------ */

/**
 * Six maisons, et la septieme qu'on compose soi-meme.
 *
 * Chaque palette est pensee comme un ensemble : le fond, deux profondeurs de
 * surface, une encre, une encre douce, un filet, et UN accent — le metal de la
 * maison. Jamais deux accents : le luxe tient a la retenue.
 */
export const PALETTES_DEF = {
  // Noir profond et or : le barbier de grande maison.
  ONYX: { fond: '#0b0b0d', surface: '#131316', surface2: '#1b1b1f', texte: '#f3eee4', texteDoux: '#a39d90', bordure: '#2a2a2f', accent: '#c9a45c' },
  // Ivoire et champagne : le salon de coiffure lumineux.
  IVOIRE: { fond: '#f8f4ec', surface: '#fffdf8', surface2: '#efe7d8', texte: '#1d1a16', texteDoux: '#6c6457', bordure: '#e2d8c6', accent: '#a8823d' },
  // Rose poudre et or rose : la beaute, la douceur.
  POUDRE: { fond: '#f6eeeb', surface: '#fffaf8', surface2: '#efdfda', texte: '#2a1d1f', texteDoux: '#7a6365', bordure: '#e8d3cd', accent: '#b07a6c' },
  // Blanc casse et corail : frais, lumineux, le bar a ongles.
  CORAIL: { fond: '#fff8f4', surface: '#ffffff', surface2: '#ffece4', texte: '#2b1c1a', texteDoux: '#7d635d', bordure: '#f6d9cd', accent: '#f0725c' },
  // Lavande et prune : doux, contemporain.
  LILAS: { fond: '#f8f5fd', surface: '#ffffff', surface2: '#ece4f9', texte: '#241b33', texteDoux: '#6d6183', bordure: '#e0d5f2', accent: '#8a5cd6' },
  // Beige rose et terracotta : le nude des instituts.
  NUDE: { fond: '#f7efe8', surface: '#fffaf5', surface2: '#eedfd2', texte: '#2e221b', texteDoux: '#7b665a', bordure: '#e6d3c3', accent: '#c1694f' },
  // Nacre et or rose : l'institut de luxe, clair et chaud.
  NACRE: { fond: '#f4ece3', surface: '#ffffff', surface2: '#efe3d6', texte: '#2a1d1a', texteDoux: '#7a665c', bordure: '#e2cfbd', accent: '#b9836a' },
  // Prune profonde et or rose : le meme luxe, de nuit.
  PRUNE: { fond: '#1a1016', surface: '#24161e', surface2: '#2e1c27', texte: '#f6ece8', texteDoux: '#b9a3a6', bordure: '#3d2733', accent: '#dba58f' },
  // Vert bouteille et laiton : le club anglais.
  EMERAUDE: { fond: '#0a1612', surface: '#0f1f1a', surface2: '#152a23', texte: '#eef1ea', texteDoux: '#9db0a5', bordure: '#22392f', accent: '#c8a96a' },
  // Bordeaux et or rose : le velours.
  BORDEAUX: { fond: '#160a0d', surface: '#201014', surface2: '#2a151b', texte: '#f6ece8', texteDoux: '#b39c9b', bordure: '#3a1f27', accent: '#d4a373' },
  // Bleu nuit et platine : le tailleur.
  MINUIT: { fond: '#0a0e17', surface: '#10151f', surface2: '#161e2c', texte: '#eef1f6', texteDoux: '#98a3b6', bordure: '#243047', accent: '#b8c2d2' },
};

/**
 * Une palette composee a partir de DEUX couleurs : le fond et l'accent. Le
 * reste s'en deduit — une surface est le fond legerement eclairci (ou
 * assombri), l'encre est presque blanche sur fond sombre et presque noire sur
 * fond clair. Le gerant choisit deux couleurs ; il n'a pas a en harmoniser sept.
 */
export function paletteComposee(fond, accent) {
  const clair = luminance(fond) > 0.4;
  const texte = clair ? '#1c1a17' : '#f4f0e8';
  return {
    fond,
    // Une surface est toujours un peu plus claire que le fond : posee sur
    // l'ivoire, une carte blanchit ; posee sur le noir, elle se devine.
    surface: melanger(fond, '#ffffff', clair ? 0.55 : 0.035),
    surface2: melanger(fond, texte, clair ? 0.06 : 0.07),
    texte,
    texteDoux: melanger(texte, fond, 0.42),
    bordure: melanger(fond, texte, clair ? 0.13 : 0.14),
    accent,
  };
}

/* ------------------------------------------------------------------ */
/*  Typographies et formes                                             */
/* ------------------------------------------------------------------ */

/**
 * Trois voix. Toutes servies depuis /fonts (aucun appel a un service tiers :
 * ni la politique de securite ni la vie privee des clients ne le permettent).
 *
 *   CLASSIQUE  Cormorant Garamond + Manrope : la carte d'une grande maison.
 *   PRESTIGE   Marcellus + Jost : des capitales gravees, la mode.
 *   MODERNE    Jost leger en capitales espacees : l'epure.
 */
export const TYPOGRAPHIES_DEF = {
  CLASSIQUE: {
    titre: "'Cormorant Garamond', Georgia, 'Times New Roman', serif",
    ui: "'Manrope', 'Segoe UI', system-ui, sans-serif",
    poids: 500, casse: 'none', espacement: '0.005em', echelle: 1,
  },
  // Une serif de haute couture pour les titres, un menu et des boutons en
  // minuscules : le luxe d'aujourd'hui, sans la raideur des capitales.
  COUTURE: {
    titre: "'Cormorant Garamond', Georgia, 'Times New Roman', serif",
    ui: "'Manrope', 'Segoe UI', system-ui, sans-serif",
    poids: 500, casse: 'none', espacement: '0em', echelle: 1.04,
    uiCasse: 'none', uiEspacement: '0.02em', uiGrossir: 1.2,
  },
  PRESTIGE: {
    titre: "'Marcellus', 'Cormorant Garamond', Georgia, serif",
    ui: "'Jost', 'Segoe UI', system-ui, sans-serif",
    poids: 400, casse: 'none', espacement: '0.04em', echelle: 0.92,
  },
  // Une geometrique ronde, en casse normale et serree : la voix des marques
  // d'aujourd'hui, celle d'un bar a ongles ou d'un salon jeune.
  DOUCE: {
    titre: "'Jost', 'Segoe UI', system-ui, sans-serif",
    ui: "'Manrope', 'Segoe UI', system-ui, sans-serif",
    poids: 500, casse: 'none', espacement: '-0.02em', echelle: 0.9,
    // Les boutons et le menu parlent en minuscules, plus gros, sans interlettrage.
    uiCasse: 'none', uiEspacement: '0.01em', uiGrossir: 1.22, boutonUni: true,
  },
  MODERNE: {
    titre: "'Jost', 'Segoe UI', system-ui, sans-serif",
    ui: "'Jost', 'Segoe UI', system-ui, sans-serif",
    poids: 300, casse: 'uppercase', espacement: '0.14em', echelle: 0.78,
  },
};

export const ANGLES_DEF = {
  NETS: { petit: '0px', moyen: '2px', grand: '2px', bouton: '0px' },
  DOUX: { petit: '6px', moyen: '12px', grand: '18px', bouton: '8px' },
  ARRONDIS: { petit: '10px', moyen: '18px', grand: '28px', bouton: '999px' },
};

/* ------------------------------------------------------------------ */
/*  Activites                                                          */
/* ------------------------------------------------------------------ */

/**
 * Ce que l'ACTIVITE propose par defaut : un point de depart, que la marque
 * peut changer ensuite. L'ecran « Marque » s'en sert pour suggerer un ensemble
 * coherent quand on change d'activite.
 */
export const STYLE_DE_L_ACTIVITE = {
  BARBERIA: { palette: 'ONYX', typographie: 'CLASSIQUE', angles: 'NETS', accueil: 'CLASSIQUE' },
  // rdv / file : comment on vient, a l'installation. Une onglerie et un
  // institut travaillent sur rendez-vous ; un salon de coiffure fait les deux.
  PELUQUERIA: { palette: 'POUDRE', typographie: 'PRESTIGE', angles: 'ARRONDIS', accueil: 'FICHE', rdv: true, file: true },
  UNISEX: { palette: 'IVOIRE', typographie: 'DOUCE', angles: 'DOUX', accueil: 'FICHE', rdv: true, file: true },
  ESTETICA: { palette: 'NUDE', typographie: 'COUTURE', angles: 'ARRONDIS', accueil: 'FICHE', rdv: true, file: false },
  ONGLES: { palette: 'NACRE', typographie: 'COUTURE', angles: 'ARRONDIS', accueil: 'FICHE', rdv: true, file: false },
};

/* ------------------------------------------------------------------ */
/*  Du reglage au theme                                                */
/* ------------------------------------------------------------------ */

/**
 * Le theme complet d'une marque.
 * @param {Record<string, any>} r  les reglages (lireTous)
 */
export function themeDe(r) {
  const nomPalette = PALETTES_DEF[r['marque.palette']] ? r['marque.palette'] : (r['marque.palette'] === 'PERSO' ? 'PERSO' : 'ONYX');
  const p = nomPalette === 'PERSO'
    ? paletteComposee(hexVersRgb(r['marque.couleurFond']) ? r['marque.couleurFond'] : '#0b0b0d',
      hexVersRgb(r['marque.couleurAccent']) ? r['marque.couleurAccent'] : '#c9a45c')
    : PALETTES_DEF[nomPalette];
  const typo = TYPOGRAPHIES_DEF[r['marque.typographie']] || TYPOGRAPHIES_DEF.CLASSIQUE;
  const angles = ANGLES_DEF[r['marque.angles']] || ANGLES_DEF.NETS;
  const clair = luminance(p.fond) > 0.4;

  // L'accent en TEXTE (liens, prix, surtitres) : lisible sur le fond ET sur
  // les surfaces. L'accent en APLAT (bouton principal) porte un texte choisi
  // pour lui : noir ou blanc, celui qui contraste le plus.
  const accentLisible = lisibleSur(lisibleSur(p.accent, p.fond), p.surface);
  const surAccent = contraste('#111111', p.accent) >= contraste('#ffffff', p.accent) ? '#111111' : '#ffffff';
  const texteDoux = lisibleSur(p.texteDoux, p.surface, 4.5);

  return {
    palette: nomPalette,
    clair,
    couleurTheme: p.fond,
    variables: {
      '--fond': p.fond,
      '--surface': p.surface,
      '--surface-2': p.surface2,
      '--texte': p.texte,
      '--texte-doux': texteDoux,
      '--bordure': p.bordure,
      '--accent': p.accent,
      '--accent-lisible': accentLisible,
      // Sur papier blanc (l'affiche imprimee) : l'accent assez fonce pour se lire.
      '--accent-sur-clair': lisibleSur(p.accent, '#ffffff', 4.5),
      '--accent-clair': melanger(p.accent, '#ffffff', 0.35),
      '--accent-profond': melanger(p.accent, '#000000', 0.32),
      '--sur-accent': surAccent,
      '--voile': clair ? 'rgb(29 26 22 / 55%)' : 'rgb(0 0 0 / 62%)',
      '--ombre': clair ? '0 24px 60px -32px rgb(40 30 20 / 32%)' : '0 24px 60px -28px rgb(0 0 0 / 75%)',
      '--ombre-douce': clair ? '0 2px 14px -8px rgb(40 30 20 / 22%)' : '0 2px 14px -8px rgb(0 0 0 / 60%)',
      '--police-titre': typo.titre,
      '--police-ui': typo.ui,
      '--titre-poids': String(typo.poids),
      '--titre-casse': typo.casse,
      '--titre-espacement': typo.espacement,
      '--titre-echelle': String(typo.echelle),
      '--ui-casse': typo.uiCasse || 'uppercase',
      '--ui-espacement': typo.uiEspacement || '0.2em',
      '--ui-grossir': String(typo.uiGrossir || 1),
      // Le bouton principal : un reflet de metal (les maisons classiques) ou
      // un aplat lumineux (les marques d'aujourd'hui).
      '--bouton-image': typo.boutonUni
        ? 'linear-gradient(110deg, ' + p.accent + ' 0%, ' + melanger(p.accent, '#ffffff', 0.22) + ' 50%, ' + p.accent + ' 100%)'
        : 'linear-gradient(110deg, ' + melanger(p.accent, '#000000', 0.32) + ' 0%, ' + p.accent + ' 30%, ' + melanger(p.accent, '#ffffff', 0.35) + ' 50%, ' + p.accent + ' 70%, ' + melanger(p.accent, '#000000', 0.32) + ' 100%)',
      '--r-petit': angles.petit,
      '--r': angles.moyen,
      '--r-grand': angles.grand,
      '--r-bouton': angles.bouton,
    },
  };
}

/** La feuille /theme.css. */
export function cssDuTheme(theme) {
  const lignes = Object.entries(theme.variables).map(([k, v]) => '  ' + k + ': ' + v + ';');
  return '/* Theme de la marque, genere depuis les reglages. */\n'
    + ':root {\n  color-scheme: ' + (theme.clair ? 'light' : 'dark') + ';\n' + lignes.join('\n') + '\n}\n';
}

/** Empreinte courte : elle versionne l'adresse /theme.css?t=... */
export function empreinte(texte) {
  return createHash('sha256').update(texte).digest('hex').slice(0, 12);
}

/* ------------------------------------------------------------------ */
/*  Monogramme                                                         */
/* ------------------------------------------------------------------ */

/** Les initiales d'un nom : « Maison Élise Durand » -> « ÉD ». Deux au plus. */
export function initiales(nom) {
  const mots = String(nom || '').trim().split(/\s+/).filter(Boolean);
  // Les petits mots d'une enseigne (« de », « la », « & ») ne font pas un
  // monogramme : « Salon de la Rose » donne « SR ».
  const pleins = mots.filter((m) => !/^(de|del|la|las|le|les|el|los|du|des|y|et|&|the|of|chez|salon|peluqueria|peluquería|barberia|barbería)$/i.test(m));
  const source = (pleins.length ? pleins : mots).slice(-2);
  return source.map((m) => m.charAt(0).toUpperCase()).join('') || 'H';
}

export const monogrammeDe = (r) => (String(r['marque.monogramme'] || '').trim() || initiales(r['salon.nom'])).slice(0, 3);
