/**
 * Les reglages du salon.
 *
 * Le formulaire est CONSTRUIT depuis le catalogue rendu par le serveur :
 * ajouter un reglage dans server/core/reglages.js le fait apparaitre ici sans
 * toucher a ce fichier. Les libelles et les aides arrivent deja traduits — il
 * n'y a qu'un seul dictionnaire de reglages, et il est cote serveur.
 */
import { api, ErreurApi } from './api.js';
import { el, remplacer, annoncer } from './dom.js';
import { t } from '../langue.js';

/**
 * L'ORDRE DES GROUPES EST L'ORDRE DE L'INSTALLATION.
 *
 * L'identite vient en premier parce qu'elle commande tout le reste : la langue
 * decide des mots de cet ecran meme, la monnaie decide du symbole de la fiche de
 * prix. Un gerant qui installe le salon doit repondre a ces deux questions avant
 * de saisir quoi que ce soit — sans quoi il saisira tout, puis recommencera.
 */
const GROUPES = [
  { titre: 'reglages.groupe.identite', prefixes: ['salon.'], identite: true },
  { titre: 'reglages.groupe.marque', prefixes: ['marque.'] },
  { titre: 'reglages.groupe.pays', prefixes: ['pays.'] },
  // Les deux facons de venir : la file en ligne, les rendez-vous.
  { titre: 'reglages.groupe.rdv', prefixes: ['accueil.', 'rdv.'] },
  { titre: 'reglages.groupe.file', prefixes: ['file.'] },
  { titre: 'reglages.groupe.horaires', prefixes: ['horaires.'] },
  // Les sections de la vitrine, et la note des tarifs avec elles : tout ce qui
  // decide de ce que le visiteur voit, au meme endroit.
  { titre: 'reglages.groupe.vitrine', prefixes: ['vitrine.', 'tarifas.'] },
  { titre: 'reglages.groupe.pantalla', prefixes: ['pantalla.'] },
  { titre: 'reglages.groupe.public', prefixes: ['public.'] },
];

/**
 * CE QUI VIENT DU FICHIER .env, MONTRE A COTE DE CE QUI VIENT DE L'ECRAN.
 *
 * Le fuseau horaire, l'indicatif telephonique et la langue des modeles WhatsApp
 * ne se reglent pas ici, et c'est deliberé : changer le fuseau en milieu
 * d'apres-midi deplacerait la journee en cours, et la file du jour paraitrait
 * vide sans que personne comprenne pourquoi. Ce sont des decisions
 * d'installation, pas des reglages d'ecran.
 *
 * MAIS LES CACHER SERAIT PIRE. Un salon marocain dont le fuseau est reste sur
 * Madrid fonctionne — mal, et de facon parfaitement silencieuse. On montre donc
 * les trois valeurs, on dit ou les changer, et on signale ce qui ne concorde pas
 * avec la monnaie choisie juste au-dessus.
 */
function blocServeur(identite) {
  if (!identite) return null;

  const ligne = (cle, valeur, variable) => el('li.identite__ligne',
    el('span.identite__quoi', { texte: t(cle) }),
    el('span.identite__valeur', { texte: valeur }),
    el('code.identite__variable', { texte: variable }));

  const avertissements = identite.avertissements || [];

  return el('div.identite',
    el('h3.identite__titre', { texte: t('identite.serveurTitre') }),
    el('ul.identite__liste',
      ligne('identite.fuseau', identite.timezone, t('marque.titre')),
      ligne('identite.indicatif', '+' + identite.indicatif, t('marque.titre')),
      ligne(
        'identite.whatsappLangue',
        identite.whatsappLangue || t('identite.whatsappInactif'),
        'WHATSAPP_LANGUE',
      )),
    avertissements.length
      ? el('div.identite__alertes',
        el('p.identite__alertes-titre', { texte: t('identite.aCorriger') }),
        el('ul.identite__alertes-liste', avertissements.map((a) => el('li',
          el('code', { texte: a.champ }),
          el('span', { texte: ' ' + a.message })))))
      : el('p.identite__ok', { texte: t('identite.coherenceOk') }),
    el('p.texte-doux.identite__note', { texte: t('identite.envNote') }));
}

/**
 * « VOTRE VITRINE » : ce que voient les visiteurs, section par section.
 *
 * Une section sans donnees disparait de la vitrine sans rien dire — c'est juste
 * pour le visiteur, et deroutant pour le gerant, qui cherchait sa section
 * contact sans savoir qu'il suffisait de saisir le telephone. Ce bilan dit,
 * pour chacune, si elle est visible et sinon ce qui manque, avec un lien vers
 * l'endroit ou le corriger.
 */
const OU_CORRIGER = {
  couverture: '#galerie', galerie: '#galerie', tarifs: '#tarifas', rendezvous: '#r-horaires-actifs',
  localisation: '#r-salon-adresse', contact: '#r-salon-telephone', horaires: '#r-horaires-actifs',
};

function bilanVitrine(sections) {
  if (!sections?.length) return null;
  return el('section.carte.reglages__groupe.bilan',
    el('h2.reglages__titre', { texte: t('bilan.titre') }),
    el('p.texte-doux', { texte: t('bilan.intro') }),
    el('ul.bilan__liste', sections.map((s) => el('li.bilan__ligne' + (s.visible ? '.bilan__ligne--ok' : ''),
      el('span.bilan__pastille', { 'aria-hidden': 'true', texte: s.visible ? '✓' : '○' }),
      el('span.bilan__nom', { texte: t('bilan.section.' + s.cle) }),
      el('span.bilan__etat', { texte: s.visible ? t('bilan.visible') : t('bilan.raison.' + s.raison) }),
      !s.visible && OU_CORRIGER[s.cle]
        ? el('a.bilan__lien', { href: OU_CORRIGER[s.cle], texte: t('bilan.corriger') })
        : null))));
}

/**
 * Les fauteuils du salon.
 *
 * Un fauteuil qui a deja servi ne se supprime pas, il se ferme : son historique
 * reste attache aux tickets qu'il a servis. Le bouton change donc de nom selon
 * le cas, plutot que de proposer une suppression qui sera refusee.
 */
async function sectionFauteuils(recharger, dire) {
  const donnees = await api.get('/api/postes');

  const lignes = donnees.items.map((p) => el('li.fauteuil' + (p.actif ? '' : '.fauteuil--ferme'),
    el('div.fauteuil__tete',
      el('span.fauteuil__nom', { texte: p.nom }),
      p.coiffeur ? el('span.fauteuil__coiffeur', { texte: p.coiffeur }) : null,
      p.actif ? null : el('span.fauteuil__badge', { texte: t('reglages.fauteuils.badgeFerme') })),
    el('p.fauteuil__meta',
      p.occupePar
        ? el('span.fauteuil__occupe', { texte: t('reglages.fauteuils.occupe', { qui: p.occupePar }) })
        : el('span', { texte: t(p.actif ? 'reglages.fauteuils.libre' : 'reglages.fauteuils.horsService') }),
      el('span', { texte: '·' }),
      el('span', { texte: t('reglages.fauteuils.servis', { n: p.servisAujourdhui }) })),
    el('div.fauteuil__actions',
      el('button.bouton.bouton--discret.bouton--petit', {
        type: 'button',
        texte: t('commun.renommer'),
        surClick: async () => {
          const nom = window.prompt(t('reglages.fauteuils.inviteNom'), p.nom);
          if (nom === null || nom.trim() === p.nom) return;
          try {
            await api.patch('/api/postes/' + p.id, { nom: nom.trim() });
            await recharger();
          } catch (err) {
            dire(err instanceof ErreurApi ? err.message : t('reglages.fauteuils.echecRenommer'));
          }
        },
      }),
      el('button.bouton.bouton--discret.bouton--petit', {
        type: 'button',
        texte: t(p.coiffeur ? 'reglages.fauteuils.changerCoiffeur' : 'reglages.fauteuils.mettreCoiffeur'),
        surClick: async () => {
          const coiffeur = window.prompt(t('reglages.fauteuils.inviteCoiffeur'), p.coiffeur || '');
          if (coiffeur === null) return;
          try {
            await api.patch('/api/postes/' + p.id, { coiffeur: coiffeur.trim() });
            await recharger();
          } catch (err) {
            dire(err instanceof ErreurApi ? err.message : t('reglages.fauteuils.echecModif'));
          }
        },
      }),
      el('button.bouton.bouton--discret.bouton--petit', {
        type: 'button',
        texte: t(p.actif ? 'reglages.fauteuils.fermer' : 'reglages.fauteuils.reouvrir'),
        surClick: async () => {
          try {
            await api.patch('/api/postes/' + p.id, { actif: !p.actif });
            dire(t(p.actif ? 'reglages.fauteuils.estFerme' : 'reglages.fauteuils.estReouvert'), true);
            await recharger();
          } catch (err) {
            dire(err instanceof ErreurApi ? err.message : t('reglages.fauteuils.echecModif'));
          }
        },
      }),
      // Ce fauteuil prend-il des rendez-vous ? Un salon garde souvent un
      // fauteuil pour les clients de passage.
      el('button.bouton.bouton--discret.bouton--petit', {
        type: 'button',
        texte: t(p.rdv ? 'reglages.fauteuils.sansRdv' : 'reglages.fauteuils.avecRdv'),
        surClick: async () => {
          try {
            await api.patch('/api/postes/' + p.id, { rdv: !p.rdv });
            await recharger();
          } catch (err) {
            dire(err instanceof ErreurApi ? err.message : t('reglages.fauteuils.echecModif'));
          }
        },
      }),
      p.servisAujourdhui === 0
        ? el('button.bouton.bouton--discret.bouton--petit.bouton--danger', {
          type: 'button',
          texte: t('commun.supprimer'),
          surClick: async () => {
            if (!window.confirm(t('reglages.fauteuils.confirmerSuppression', { nom: p.nom }))) return;
            try {
              await api.supprimer('/api/postes/' + p.id);
              dire(t('reglages.fauteuils.estSupprime'), true);
              await recharger();
            } catch (err) {
              dire(err instanceof ErreurApi ? err.message : t('reglages.fauteuils.echecSuppression'));
            }
          },
        })
        : null)));

  const nom = el('input', {
    id: 'p-nom', type: 'text', maxlength: '40', required: true,
    placeholder: t('reglages.fauteuils.exempleNom'),
  });
  const coiffeur = el('input', {
    id: 'p-coiffeur', type: 'text', maxlength: '60',
    placeholder: t('reglages.fauteuils.exempleCoiffeur'),
  });

  const ajout = el('form.formulaire', {
    surSubmit: async (evenement) => {
      evenement.preventDefault();
      try {
        await api.post('/api/postes', { nom: nom.value.trim(), coiffeur: coiffeur.value.trim() || undefined });
        dire(t('reglages.fauteuils.estAjoute'), true);
        await recharger();
      } catch (err) {
        dire(err instanceof ErreurApi ? err.message : t('reglages.fauteuils.echecCreation'));
      }
    },
  },
  el('div.reglages__grille',
    el('div.champ', el('label', { for: 'p-nom', texte: t('reglages.fauteuils.champNom') }), nom),
    el('div.champ', el('label', { for: 'p-coiffeur', texte: t('reglages.fauteuils.champCoiffeur') }), coiffeur,
      el('p.champ__aide', { texte: t('reglages.fauteuils.aideCoiffeur') }))),
  el('button.bouton.bouton--principal', { type: 'submit', texte: t('reglages.fauteuils.ajouter') }));

  return el('section.carte.reglages__groupe',
    el('h2.reglages__titre', { texte: t('reglages.fauteuils.titre') }),
    el('p.texte-doux', {
      texte: donnees.actifs > 1
        ? t('reglages.fauteuils.plusieurs', { n: donnees.actifs })
        : t('reglages.fauteuils.unSeul'),
    }),
    el('ul.fauteuils-liste', lignes),
    el('details.creation',
      el('summary', { texte: t('reglages.fauteuils.titreAjout') }),
      ajout));
}

export async function vueReglages(conteneur, { etat } = {}) {
  const donnees = await api.get('/api/reglages');
  // LA MARQUE (nom, langue, monnaie, couleurs...) se regle dans l'onglet
  // « Marque », par l'administrateur de la plateforme. Elle n'apparait ici que
  // sur une installation qui n'a pas encore de tel compte : sans cela, plus
  // personne ne pourrait renommer le salon.
  const marqueIci = !donnees.marqueVerrouillee && etat?.utilisateur?.role !== 'SUPERADMIN';
  donnees.catalogue = donnees.catalogue.filter((r) => !r.reserve || marqueIci);
  const champs = new Map();
  const erreurGlobale = el('p.alerte.alerte--refus', { role: 'alert', hidden: true });
  const succes = el('p.alerte.alerte--succes', { role: 'status', hidden: true });

  function champ(regle) {
    const id = 'r-' + regle.cle.replace(/[^a-z0-9]/gi, '-');
    const valeur = donnees.valeurs[regle.cle];
    let entree;

    if (regle.type === 'booleen') {
      entree = el('input', { id, type: 'checkbox' });
      entree.checked = Boolean(valeur);
    } else if (regle.type === 'choix') {
      entree = el('select', { id }, ...(regle.options || []).map((o) => el('option', {
        value: o.valeur,
        texte: o.libelle,
        selected: o.valeur === valeur ? true : null,
      })));
      entree.value = String(valeur ?? regle.defaut);
    } else if (regle.type === 'entier') {
      entree = el('input', {
        id, type: 'number', inputmode: 'numeric',
        min: regle.min ?? undefined, max: regle.max ?? undefined,
        value: String(valeur ?? ''),
      });
    } else if (regle.type === 'heure') {
      entree = el('input', { id, type: 'time', value: String(valeur ?? '') });
    } else if (regle.type === 'url') {
      entree = el('input', { id, type: 'url', inputmode: 'url', value: String(valeur ?? '') });
    } else if (regle.type === 'couleur') {
      entree = el('input', { id, type: 'color', value: String(valeur ?? '#000000') });
    } else if (regle.type === 'telephone') {
      entree = el('input', { id, type: 'tel', inputmode: 'tel', value: String(valeur ?? '') });
    } else if ((regle.maxLongueur ?? 0) > 200) {
      // Un texte de plusieurs phrases dans une ligne d'une seule hauteur ne se
      // relit pas : on n'en voit jamais que la fin.
      entree = el('textarea', { id, rows: 3, maxlength: regle.maxLongueur, texte: String(valeur ?? '') });
    } else {
      entree = el('input', { id, type: 'text', maxlength: regle.maxLongueur ?? 200, value: String(valeur ?? '') });
    }

    champs.set(regle.cle, { regle, entree });
    const erreur = el('p.champ__erreur', { hidden: true, donnees: { erreur: regle.cle } });

    const large = regle.type === 'choix' || (regle.maxLongueur ?? 0) > 200;
    return el('div.champ' + (regle.type === 'booleen' ? '.champ--case' : '') + (large ? '.champ--large' : ''),
      el('label', { for: id, texte: regle.libelle }),
      entree,
      regle.aide ? el('p.champ__aide', { texte: regle.aide }) : null,
      erreur);
  }

  /**
   * LES HORAIRES EN TABLEAU : une ligne par jour, lundi en tete, quatre
   * colonnes — ouverture, debut de pause, reprise, fermeture.
   *
   * Ils etaient poses en vrac dans la grille commune : vingt-huit champs qui se
   * repliaient au hasard de la largeur, « reprise dimanche » sous « ouverture
   * lundi ». Pour saisir une journee coupee, il fallait deviner quelle case
   * allait avec quel jour. Chaque champ garde son libelle complet pour les
   * lecteurs d'ecran (« Ouverture lundi ») ; a l'ecran, la ligne et la colonne
   * suffisent.
   */
  function grilleHoraires(regles) {
    const parCle = new Map(regles.map((r) => [r.cle, r]));
    const colonnes = ['ouverture', 'pauseDebut', 'pauseFin', 'fermeture'];
    const aide = parCle.get('horaires.1.pauseDebut')?.aide;
    const cellule = (regle) => {
      const bloc = champ({ ...regle, aide: null });
      bloc.classList.add('champ--horaire');
      bloc.querySelector('label').classList.add('visuellement-cache');
      return bloc;
    };
    const jours = [1, 2, 3, 4, 5, 6, 0].filter((j) => parCle.has('horaires.' + j + '.ouverture'));
    return el('div.horaires-grille',
      el('div.horaires-grille__tete',
        el('span', { texte: '' }),
        colonnes.map((c) => el('span', { texte: t('horaires.col.' + c) }))),
      jours.map((j) => el('div.horaires-grille__ligne',
        el('span.horaires-grille__jour', { texte: t('jour.' + j) }),
        colonnes.map((c) => cellule(parCle.get('horaires.' + j + '.' + c))))),
      aide ? el('p.champ__aide', { texte: aide }) : null);
  }

  const sections = GROUPES.map((groupe) => {
    const regles = donnees.catalogue.filter((r) => groupe.prefixes.some((p) => r.cle.startsWith(p)));
    if (!regles.length) return null;
    const horaires = groupe.prefixes.includes('horaires.');
    return el('section.carte.reglages__groupe',
      el('h2.reglages__titre', { texte: t(groupe.titre) }),
      horaires
        ? [el('div.reglages__grille', regles.filter((r) => r.cle === 'horaires.actifs').map(champ)),
          grilleHoraires(regles.filter((r) => r.cle !== 'horaires.actifs'))]
        : el('div.reglages__grille', regles.map(champ)),
      groupe.identite ? blocServeur(donnees.identite) : null);
  });

  const bouton = el('button.bouton.bouton--principal', { type: 'submit', texte: t('reglages.enregistrer') });

  const formulaire = el('form.reglages', {
    surSubmit: async (evenement) => {
      evenement.preventDefault();
      erreurGlobale.hidden = true;
      succes.hidden = true;
      for (const bloc of conteneur.querySelectorAll('[data-erreur]')) bloc.hidden = true;
      bouton.disabled = true;

      const valeurs = {};
      for (const [cle, { regle, entree }] of champs) {
        valeurs[cle] = regle.type === 'booleen' ? entree.checked : entree.value;
      }
      try {
        const reponse = await api.put('/api/reglages', { valeurs });

        /*
         * CHANGER LA LANGUE OU LA MONNAIE RECHARGE TOUTE LA PAGE.
         *
         * Ce ne sont pas des valeurs comme les autres : elles changent TOUS les
         * mots de l'application, y compris la barre de navigation, le titre du
         * document et l'attribut « lang » — trois choses rendues par le serveur,
         * qu'aucun re-rendu cote client ne toucherait. Sans ce rechargement, le
         * gerant verrait le formulaire changer de langue et le reste de l'ecran
         * rester dans l'ancienne, et conclurait que l'enregistrement a echoue a
         * moitie.
         *
         * Le serveur decide, pas nous : il compare l'avant et l'apres, et ne
         * demande le rechargement que si l'un des deux a reellement change.
         */
        if (reponse?.rechargerTout) {
          succes.textContent = t('reglages.rechargement');
          succes.hidden = false;
          annoncer(t('reglages.rechargement'));
          window.location.reload();
          return;
        }

        succes.textContent = t('reglages.enregistres');
        succes.hidden = false;
        annoncer(t('reglages.enregistres'));
      } catch (err) {
        if (err instanceof ErreurApi && err.champs) {
          for (const [cle, message] of Object.entries(err.champs)) {
            const bloc = conteneur.querySelector('[data-erreur="' + CSS.escape(cle) + '"]');
            if (bloc) {
              bloc.textContent = message;
              bloc.hidden = false;
            }
          }
        }
        erreurGlobale.textContent = err.message;
        erreurGlobale.hidden = false;
      } finally {
        bouton.disabled = false;
      }
    },
  },
  // Les deux bandeaux d'alerte vivent plus haut dans la page : ils servent
  // aussi a la section des fauteuils.
  sections, el('div.reglages__pied', bouton));

  const whatsapp = el('section.carte.reglages__groupe',
    el('h2.reglages__titre', { texte: t('reglages.whatsapp.titre') }),
    el('p.texte-doux', {
      texte: donnees.whatsapp.actif
        ? t('reglages.whatsapp.actif', { modeles: Object.values(donnees.whatsapp.modeles).join(', ') })
        : t('reglages.whatsapp.inactif'),
    }),
    el('p.texte-doux.reglages__note', { texte: t('reglages.whatsapp.note') }));

  const dire = (message, bon = false) => {
    const cible = bon ? succes : erreurGlobale;
    const autre = bon ? erreurGlobale : succes;
    cible.textContent = message;
    cible.hidden = false;
    autre.hidden = true;
    annoncer(message);
  };

  const fauteuils = await sectionFauteuils(() => vueReglages(conteneur), dire);

  remplacer(conteneur, el('div.enveloppe.page-gestion',
    el('h1.titre-page', { texte: t('reglages.titre') }),
    el('p.texte-doux', { texte: t('reglages.adresseQr', { url: donnees.adressePublique }) }),
    erreurGlobale, succes,
    bilanVitrine(donnees.vitrine),
    fauteuils,
    formulaire,
    whatsapp,
    sectionPurge(dire)));
}

/**
 * La zone de danger : effacer l'historique.
 *
 * ELLE EST EN BAS, ET ELLE EST LAIDE. C'est voulu. Un bouton irréversible ne se
 * place pas à côté de ceux qu'on touche tous les jours, et il ne doit pas
 * ressembler à eux.
 *
 * TROIS CHOSES AVANT DE POUVOIR CLIQUER : ouvrir le repli, lire ce qui part et
 * ce qui reste, et RECOPIER un mot. La recopie n'est pas une formalité — c'est
 * le temps d'arrêt qu'aucune fenêtre « êtes-vous sûr ? » ne procure, parce
 * qu'on y répond oui sans lire.
 *
 * LE MOT SUIT LA LANGUE DU SALON. Demander « BORRAR » à un gérant francophone
 * transformerait la friction voulue en devinette : il chercherait ce qu'il doit
 * taper au lieu de réfléchir à ce qu'il efface. Le serveur compare au même mot,
 * lu dans son propre dictionnaire sous la même clé.
 *
 * Les deux colonnes disent exactement ce qui disparaît. Une suppression dont on
 * ignore la portée ne se fait jamais l'esprit tranquille, et c'est comme ça
 * qu'on renonce à nettoyer des données d'essai qui restent des mois.
 */
function sectionPurge(dire) {
  const mot = t('reglages.purge.mot');

  const confirmation = el('input', {
    id: 'purge-confirmation', type: 'text', autocomplete: 'off',
    autocapitalize: 'characters', spellcheck: 'false', placeholder: mot,
  });

  const bouton = el('button.bouton.bouton--petit.bouton--danger', {
    type: 'submit', texte: t('reglages.purge.bouton'),
  });

  const liste = (titre, items, classe) => el('div.purge__colonne',
    el('p.purge__colonne-titre' + classe, { texte: titre }),
    el('ul.purge__liste', items.map((texte) => el('li', { texte }))));

  const formulaire = el('form.purge__form', {
    surSubmit: async (evenement) => {
      evenement.preventDefault();
      bouton.disabled = true;
      try {
        const reponse = await api.post('/api/service/purger', { confirmation: confirmation.value });
        dire(t('reglages.purge.fait', { n: reponse.total }), true);
        confirmation.value = '';
      } catch (err) {
        dire(err instanceof ErreurApi ? err.message : t('reglages.purge.echec'));
      }
      bouton.disabled = false;
    },
  },
  el('div.champ',
    el('label', { for: 'purge-confirmation', texte: t('reglages.purge.champ', { mot }) }),
    confirmation),
  bouton);

  return el('section.carte.reglages__groupe.purge',
    el('h2.reglages__titre.purge__titre', { texte: t('reglages.purge.titre') }),
    el('p.texte-doux', { texte: t('reglages.purge.intro') }),
    el('details.purge__repli',
      el('summary', { texte: t('reglages.purge.voir') }),
      el('div.purge__colonnes',
        liste(t('reglages.purge.seSupprime'), [
          t('reglages.purge.part1'),
          t('reglages.purge.part2'),
          t('reglages.purge.part3'),
          t('reglages.purge.part4'),
          t('reglages.purge.part5'),
        ], '.purge__colonne-titre--part'),
        liste(t('reglages.purge.seConserve'), [
          t('reglages.purge.reste1'),
          t('reglages.purge.reste2'),
          t('reglages.purge.reste3'),
          t('reglages.purge.reste4'),
          t('reglages.purge.reste5'),
        ], '.purge__colonne-titre--reste')),
      el('p.texte-doux.purge__note', { texte: t('reglages.purge.note') }),
      formulaire));
}
