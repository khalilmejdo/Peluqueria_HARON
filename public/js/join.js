/**
 * Le formulaire de prise de tour.
 *
 * Le formulaire se poste tout seul, sans ce fichier : ce module n'ajoute que la
 * verification immediate des champs et le verrouillage du bouton, pour qu'un
 * double appui sur un telephone lent ne cree pas deux tickets.
 *
 * La validation reste ENTIEREMENT refaite par le serveur : celle-ci ne sert
 * qu'a eviter un aller-retour inutile.
 */
import { t, dureeCourte } from './langue.js';
import { montant } from './devise.js';

const formulaire = document.querySelector('[data-formulaire-tour]');

if (formulaire) {
  const NOM_RE = /^[\p{L}\p{M}][\p{L}\p{M} '’.-]*$/u;

  const REGLES = {
    prenom: (v) => (v.length < 2 ? t('join.prenomRequis')
      : (!NOM_RE.test(v) ? t('join.nomLettres') : null)),
    nom: (v) => (v.length < 2 ? t('join.nomRequis')
      : (!NOM_RE.test(v) ? t('join.nomLettres') : null)),
    telephone: (v) => {
      if (!v) return t('join.telephoneRequis');
      if (!/^\+?[0-9][0-9\s.\-()/]*$/.test(v)) return t('join.telephoneForme');
      const chiffres = v.replace(/[^0-9]/g, '');
      return chiffres.length >= 8 && chiffres.length <= 15 ? null : t('join.telephoneInvraisemblable');
    },
  };

  const champDe = (nom) => formulaire.querySelector('[name="' + nom + '"]');

  function afficherErreur(nom, message) {
    const champ = champDe(nom);
    if (!champ) return;
    const bloc = champ.closest('.champ');
    if (!bloc) return;
    let paragraphe = bloc.querySelector('.champ__erreur');
    bloc.classList.toggle('champ--erreur', Boolean(message));
    champ.setAttribute('aria-invalid', message ? 'true' : 'false');
    if (!message) {
      if (paragraphe) paragraphe.remove();
      return;
    }
    if (!paragraphe) {
      paragraphe = document.createElement('p');
      paragraphe.className = 'champ__erreur';
      paragraphe.id = champ.id + '-erreur';
      bloc.append(paragraphe);
    }
    paragraphe.textContent = message;
    champ.setAttribute('aria-describedby', paragraphe.id);
  }

  /**
   * Le champ WhatsApp n'accepte QUE ce qui compose un numero.
   *
   * Sur un telephone, le clavier numerique offre malgre tout des caracteres
   * parasites, et un collage depuis un carnet d'adresses amene souvent un nom
   * accroche au numero (« Ahmed 612 345 678 »). On retire au fil de la frappe
   * ce qui n'a rien a y faire, en gardant la position du curseur : corriger
   * sans deplacer le curseur, c'est la difference entre un champ agreable et
   * un champ qu'on abandonne.
   */
  const telephone = champDe('telephone');
  if (telephone) {
    const AUTORISES = /[^0-9+()./ -]/g;
    telephone.addEventListener('input', () => {
      const avant = telephone.value;
      const apres = avant.replace(AUTORISES, '');
      if (apres === avant) return;
      const curseur = telephone.selectionStart ?? apres.length;
      const retires = avant.slice(0, curseur).replace(AUTORISES, '').length;
      telephone.value = apres;
      telephone.setSelectionRange(retires, retires);
    });
  }

  for (const nom of Object.keys(REGLES)) {
    const champ = champDe(nom);
    if (!champ) continue;
    // A la sortie du champ seulement : personne n'aime etre corrige a chaque
    // lettre tapee.
    champ.addEventListener('blur', () => afficherErreur(nom, REGLES[nom](champ.value.trim())));
    champ.addEventListener('input', () => {
      if (champ.closest('.champ')?.classList.contains('champ--erreur')) {
        afficherErreur(nom, REGLES[nom](champ.value.trim()));
      }
    });
  }

  formulaire.addEventListener('submit', (evenement) => {
    let premierFautif = null;
    for (const nom of Object.keys(REGLES)) {
      const champ = champDe(nom);
      if (!champ) continue;
      const message = REGLES[nom](champ.value.trim());
      afficherErreur(nom, message);
      if (message && !premierFautif) premierFautif = champ;
    }
    if (premierFautif) {
      evenement.preventDefault();
      premierFautif.focus();
      return;
    }
    const bouton = formulaire.querySelector('button[type="submit"]');
    if (bouton) {
      // Le libelle d'origine est MEMORISE, pas reecrit : il etait remis en dur
      // (« Prendre mon tour », en francais) et un client espagnol voyait son
      // bouton changer de langue au bout de douze secondes hors ligne.
      const libelle = bouton.textContent;
      bouton.disabled = true;
      bouton.textContent = t('commun.unMoment');
      // Si la navigation echoue (hors ligne), le bouton doit redevenir
      // utilisable : sinon le client reste bloque devant un ecran mort.
      setTimeout(() => {
        bouton.disabled = false;
        bouton.textContent = libelle;
      }, 12000);
    }
  });
}

/* ------------------------------------------------------------------ */
/*  Le total des prestations choisies                                  */
/* ------------------------------------------------------------------ */

/**
 * Le temps et le prix de ce qu'on vient de cocher.
 *
 * POURQUOI LE MONTRER. Cocher trois cases sans rien voir revient a remplir un
 * formulaire les yeux fermes : le client ne sait pas s'il vient de demander
 * dix minutes ou une heure. La ligne apparait des la premiere case et disparait
 * quand on decoche tout — un total a zero n'apprend rien.
 *
 * Le prix est indicatif, et c'est ecrit : le salon encaisse au comptoir, et
 * une remise ou un service ajoute sur place ne passeront jamais par ici.
 *
 * Les durees viennent du SERVEUR, posees sur chaque case. Rien n'est calcule a
 * partir de ce que le navigateur croit savoir — et de toute facon le serveur
 * recalcule tout : ce total ne sert qu'a informer.
 */
const totalPrestations = document.querySelector('[data-presta-total]');

if (totalPrestations) {
  const cases = [...document.querySelectorAll('.presta__case')];

  const recompter = () => {
    const cochees = cases.filter((c) => c.checked);
    if (!cochees.length) {
      totalPrestations.hidden = true;
      return;
    }
    const minutes = cochees.reduce((n, c) => n + Number(c.dataset.minutos || 0), 0);
    const centimes = cochees.reduce((n, c) => n + Number(c.dataset.precio || 0), 0);
    // montant() et non un « + ' €' » ecrit ici : le symbole vient de la monnaie
    // du salon, et il etait ecrit deux fois en dur a cet endroit.
    // Sans prix publies (aucun data-precio), le total ne dit que le temps.
    const avecPrix = cochees.some((c) => c.dataset.precio !== undefined);
    totalPrestations.textContent = t(avecPrix ? 'join.total' : 'join.totalSansPrix', {
      n: cochees.length,
      duree: dureeCourte(minutes),
      prix: montant(centimes),
    });
    totalPrestations.hidden = false;
  };

  for (const c of cases) c.addEventListener('change', recompter);
  recompter();
}
