/**
 * LA MARQUE — l'ecran de l'administrateur de la plateforme.
 *
 * C'est ici qu'une meme application devient LE salon d'un client : son nom,
 * son activite, son logo, sa palette, ses lettres, ses formes. Le gerant du
 * salon ne voit pas cet onglet ; il regle sa journee, pas son identite.
 *
 * L'APERCU EST IMMEDIAT, L'ENREGISTREMENT EST UN GESTE. Chaque choix repeint
 * la petite vitrine de droite sans rien ecrire ; « Enregistrer » applique
 * tout d'un coup, puis recharge la page — la marque change tous les ecrans, y
 * compris ceux que le serveur a rendus.
 */
import { api, ErreurApi } from './api.js';
import { el, remplacer, annoncer } from './dom.js';
import { t } from '../langue.js';

/** Les polices de chaque typographie (les memes que server/core/theme.js). */
const POLICES = {
  CLASSIQUE: { titre: "'Cormorant Garamond', Georgia, serif", ui: "'Manrope', system-ui, sans-serif", casse: 'none', espacement: '0.005em', poids: '500' },
  PRESTIGE: { titre: "'Marcellus', Georgia, serif", ui: "'Jost', system-ui, sans-serif", casse: 'none', espacement: '0.04em', poids: '400' },
  MODERNE: { titre: "'Jost', system-ui, sans-serif", ui: "'Jost', system-ui, sans-serif", casse: 'uppercase', espacement: '0.14em', poids: '300' },
};
const RAYONS = { NETS: ['0px', '2px'], DOUX: ['8px', '14px'], ARRONDIS: ['999px', '22px'] };

/** Clair ou sombre ? Luminance relative, comme le serveur. */
function estClair(hex) {
  const n = parseInt(String(hex).slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4;
}

export async function vueMarque(conteneur) {
  const donnees = await api.get('/api/marque');
  const valeurs = { ...donnees.valeurs };
  const regle = (cle) => donnees.catalogue.find((r) => r.cle === cle);
  const alerte = el('p.alerte.alerte--refus', { role: 'alert', hidden: true });

  /* ---------------- l'apercu ---------------- */

  const apercuMonogramme = el('span.apercu__monogramme');
  const apercuPetit = el('span.apercu__petit');
  const apercuGrand = el('span.apercu__grand');
  const apercuMetier = el('span.apercu__metier');
  const apercu = el('div.apercu', { 'aria-hidden': 'true' },
    el('div.apercu__barre', apercuMonogramme, el('span.apercu__nav', { texte: '—  —  —' })),
    el('div.apercu__une',
      apercuMetier,
      apercuPetit,
      apercuGrand,
      el('span.apercu__filet'),
      el('span.apercu__bouton', { texte: t('marque.apercu.bouton') }),
      el('span.apercu__bouton.apercu__bouton--contour', { texte: t('marque.apercu.carte') })),
    el('div.apercu__carte',
      el('span.apercu__ligne', el('span', { texte: t('marque.apercu.prestation') }), el('span.apercu__prix', { texte: '45' }))));

  function repeindre() {
    const p = valeurs['marque.palette'] === 'PERSO'
      ? (() => {
        const fond = valeurs['marque.couleurFond'];
        const clair = estClair(fond);
        return { fond, surface: fond, texte: clair ? '#1c1a17' : '#f4f0e8', accent: valeurs['marque.couleurAccent'] };
      })()
      : donnees.palettes.find((x) => x.cle === valeurs['marque.palette']) || donnees.palettes[0];
    const typo = POLICES[valeurs['marque.typographie']] || POLICES.CLASSIQUE;
    const [rBouton, rCarte] = RAYONS[valeurs['marque.angles']] || RAYONS.NETS;
    const poser = (nom, v) => apercu.style.setProperty(nom, v);
    poser('--a-fond', p.fond);
    poser('--a-surface', p.surface);
    poser('--a-texte', p.texte);
    poser('--a-accent', p.accent);
    poser('--a-titre', typo.titre);
    poser('--a-ui', typo.ui);
    poser('--a-casse', typo.casse);
    poser('--a-espacement', typo.espacement);
    poser('--a-poids', typo.poids);
    poser('--a-r-bouton', rBouton);
    poser('--a-r-carte', rCarte);
    const mots = String(valeurs['salon.nom'] || '').trim().split(' ').filter(Boolean);
    apercuGrand.textContent = mots.pop() || '';
    apercuPetit.textContent = mots.join(' ');
    const initiales = (valeurs['marque.monogramme'] || '').trim()
      || String(valeurs['salon.nom'] || '').split(' ').filter(Boolean).slice(-2).map((m) => m.charAt(0).toUpperCase()).join('');
    apercuMonogramme.textContent = initiales.slice(0, 3);
    const activite = regle('marque.activite').options.find((o) => o.valeur === valeurs['marque.activite']);
    apercuMetier.textContent = activite ? activite.libelle : '';
  }

  /* ---------------- les champs ---------------- */

  const champTexte = (cle, { max = null } = {}) => {
    const r = regle(cle);
    const entree = el('input', { type: 'text', id: 'm-' + cle, value: valeurs[cle] ?? '', maxlength: max || r.maxLongueur || null });
    entree.addEventListener('input', () => { valeurs[cle] = entree.value; repeindre(); });
    return el('div.champ', el('label', { for: 'm-' + cle, texte: r.libelle }), entree,
      r.aide ? el('p.champ__aide', { texte: r.aide }) : null);
  };

  const champChoix = (cle, { surChangement = null } = {}) => {
    const r = regle(cle);
    const select = el('select', { id: 'm-' + cle },
      r.options.map((o) => el('option', { value: o.valeur, texte: o.libelle, selected: valeurs[cle] === o.valeur })));
    select.addEventListener('change', () => {
      valeurs[cle] = select.value;
      surChangement?.(select.value);
      repeindre();
    });
    return el('div.champ', el('label', { for: 'm-' + cle, texte: r.libelle }), select,
      r.aide ? el('p.champ__aide', { texte: r.aide }) : null);
  };

  /** Des cartes a choisir : une seule cochee, comme des boutons radio. */
  const cartesAChoisir = (cle, rendreCarte) => {
    const r = regle(cle);
    const groupe = el('div.choix-marque', { role: 'radiogroup', 'aria-label': r.libelle });
    const peindre = () => remplacer(groupe, r.options.map((o) => {
      const carte = el('button.choix-marque__carte', {
        type: 'button', role: 'radio', 'aria-checked': valeurs[cle] === o.valeur ? 'true' : 'false',
        surClick: () => { valeurs[cle] = o.valeur; peindre(); repeindre(); surPalette(); },
      }, rendreCarte(o), el('span.choix-marque__nom', { texte: o.libelle.split(' — ')[0] }));
      return carte;
    }));
    peindre();
    return { noeud: el('div.champ', el('p.etiquette', { texte: r.libelle }), groupe, r.aide ? el('p.champ__aide', { texte: r.aide }) : null), peindre };
  };

  const pastille = (couleur) => {
    const p = el('span.nuancier__pastille');
    p.style.setProperty('background', couleur);
    return p;
  };

  const palettes = cartesAChoisir('marque.palette', (o) => {
    const p = donnees.palettes.find((x) => x.cle === o.valeur);
    if (!p) return el('span.nuancier.nuancier--perso', pastille(valeurs['marque.couleurFond']), pastille(valeurs['marque.couleurAccent']));
    const n = el('span.nuancier', pastille(p.surface), pastille(p.accent), pastille(p.texte));
    n.style.setProperty('background', p.fond);
    return n;
  });

  const couleur = (cle) => {
    const r = regle(cle);
    const entree = el('input', { type: 'color', id: 'm-' + cle, value: valeurs[cle] });
    entree.addEventListener('input', () => { valeurs[cle] = entree.value; repeindre(); palettes.peindre(); });
    return el('div.champ.champ--couleur', el('label', { for: 'm-' + cle, texte: r.libelle }), entree,
      r.aide ? el('p.champ__aide', { texte: r.aide }) : null);
  };
  const couleurs = el('div.marque__couleurs', couleur('marque.couleurFond'), couleur('marque.couleurAccent'));
  function surPalette() {
    couleurs.hidden = valeurs['marque.palette'] !== 'PERSO';
  }

  const typographies = cartesAChoisir('marque.typographie', (o) => {
    const e = el('span.echantillon', { texte: 'Aa' });
    const typo = POLICES[o.valeur];
    e.style.setProperty('font-family', typo.titre);
    e.style.setProperty('text-transform', typo.casse);
    e.style.setProperty('font-weight', typo.poids);
    return e;
  });

  const angles = cartesAChoisir('marque.angles', (o) => {
    const e = el('span.forme');
    e.style.setProperty('border-radius', (RAYONS[o.valeur] || RAYONS.NETS)[1]);
    return e;
  });

  /* ---------------- le logo ---------------- */

  const zoneLogo = el('div.logo-marque');
  const peindreLogo = (logo) => remplacer(zoneLogo,
    logo
      ? el('img.logo-marque__image', { src: logo.src, alt: t('marque.logo.alt') })
      : el('p.texte-doux', { texte: t('marque.logo.aucun') }),
    el('div.logo-marque__actions',
      (() => {
        const fichier = el('input.visuellement-cache', { type: 'file', accept: 'image/png,image/jpeg,image/webp', id: 'm-logo' });
        fichier.addEventListener('change', async () => {
          if (!fichier.files[0]) return;
          alerte.hidden = true;
          try {
            peindreLogo(await api.envoyerFichier('/api/marque/logo', fichier.files[0]));
            annoncer(t('marque.logo.pose'));
          } catch (err) {
            alerte.textContent = err instanceof ErreurApi ? err.message : t('marque.echec');
            alerte.hidden = false;
          }
        });
        return [fichier, el('label.bouton.bouton--discret.bouton--petit', { for: 'm-logo', texte: t(logo ? 'marque.logo.remplacer' : 'marque.logo.choisir') })];
      })(),
      logo
        ? el('button.bouton.bouton--lien.bouton--danger', {
          type: 'button',
          texte: t('marque.logo.retirer'),
          surClick: async () => {
            await api.supprimer('/api/marque/logo').catch(() => {});
            peindreLogo(null);
          },
        })
        : null),
    el('p.champ__aide', { texte: t('marque.logo.aide') }));
  peindreLogo(donnees.logo);

  /* ---------------- enregistrer ---------------- */

  const enregistrer = el('button.bouton.bouton--principal', { type: 'submit', texte: t('marque.enregistrer') });
  const formulaire = el('form.marque__formulaire', {
    surSubmit: async (evenement) => {
      evenement.preventDefault();
      alerte.hidden = true;
      enregistrer.disabled = true;
      try {
        await api.put('/api/reglages', { valeurs });
        annoncer(t('marque.enregistree'));
        // La marque change TOUT, y compris ce que le serveur a rendu : on recharge.
        window.location.reload();
      } catch (err) {
        alerte.textContent = err instanceof ErreurApi ? err.message : t('marque.echec');
        alerte.hidden = false;
        enregistrer.disabled = false;
      }
    },
  },
  el('section.carte',
    el('h2.reglages__titre', { texte: t('marque.section.identite') }),
    champTexte('salon.nom'),
    champChoix('marque.activite', {
      // Changer d'activite PROPOSE son style ; on peut ensuite tout retoucher.
      surChangement: (activite) => {
        const style = donnees.styleDeLActivite[activite];
        if (!style) return;
        valeurs['marque.palette'] = style.palette;
        valeurs['marque.typographie'] = style.typographie;
        valeurs['marque.angles'] = style.angles;
        palettes.peindre();
        typographies.peindre();
        angles.peindre();
        surPalette();
      },
    }),
    el('div.marque__duo', champChoix('salon.idioma'), champChoix('salon.moneda')),
    champTexte('marque.monogramme', { max: 3 }),
    el('div.champ', el('p.etiquette', { texte: t('marque.logo.titre') }), zoneLogo)),
  el('section.carte',
    el('h2.reglages__titre', { texte: t('marque.section.style') }),
    palettes.noeud,
    couleurs,
    typographies.noeud,
    angles.noeud),
  alerte,
  el('div.marque__pied', enregistrer, el('p.texte-doux', { texte: t('marque.noteRechargement') })));

  surPalette();
  repeindre();

  remplacer(conteneur,
    el('div.enveloppe.marque',
      el('header.vue__tete',
        el('h1.titre-page', { texte: t('marque.titre') }),
        el('p.texte-doux', { texte: t('marque.intro') })),
      el('div.marque__grille',
        formulaire,
        el('aside.marque__apercu',
          el('p.etiquette', { texte: t('marque.apercu.titre') }),
          apercu,
          el('p.champ__aide', { texte: t('marque.apercu.aide') })))));
}
