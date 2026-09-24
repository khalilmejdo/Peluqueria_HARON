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

const formulaire = document.querySelector('[data-formulaire-tour]');

if (formulaire) {
  const NOM_RE = /^[\p{L}\p{M}][\p{L}\p{M} '’.-]*$/u;

  const REGLES = {
    prenom: (v) => (v.length < 2 ? 'Tu nombre es obligatorio.'
      : (!NOM_RE.test(v) ? 'Solo se aceptan letras, espacio, apóstrofo y guion.' : null)),
    nom: (v) => (v.length < 2 ? 'Tu apellido es obligatorio.'
      : (!NOM_RE.test(v) ? 'Solo se aceptan letras, espacio, apóstrofo y guion.' : null)),
    telephone: (v) => {
      if (!v) return 'Tu número de WhatsApp es obligatorio.';
      if (!/^\+?[0-9][0-9\s.\-()/]*$/.test(v)) return 'Número no válido: solo cifras, espacios y « + ».';
      const chiffres = v.replace(/[^0-9]/g, '');
      return chiffres.length >= 8 && chiffres.length <= 15 ? null : 'Este número no parece un número de teléfono.';
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
      bouton.disabled = true;
      bouton.textContent = 'Un momento…';
      // Si la navigation echoue (hors ligne), le bouton doit redevenir
      // utilisable : sinon le client reste bloque devant un ecran mort.
      setTimeout(() => {
        bouton.disabled = false;
        bouton.textContent = 'Prendre mon tour';
      }, 12000);
    }
  });
}
