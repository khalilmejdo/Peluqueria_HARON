/**
 * Les reglages du salon.
 *
 * Le formulaire est CONSTRUIT depuis le catalogue rendu par le serveur :
 * ajouter un reglage dans server/core/reglages.js le fait apparaitre ici sans
 * toucher a ce fichier.
 */
import { api, ErreurApi } from './api.js';
import { el, remplacer, annoncer } from './dom.js';

const GROUPES = [
  { titre: 'Le salon', prefixes: ['salon.'] },
  { titre: 'La file', prefixes: ['file.'] },
  { titre: 'Horaires d’ouverture', prefixes: ['horaires.'] },
  { titre: 'Adresse publique', prefixes: ['public.'] },
];

export async function vueReglages(conteneur) {
  const donnees = await api.get('/api/reglages');
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
    } else if (regle.type === 'telephone') {
      entree = el('input', { id, type: 'tel', inputmode: 'tel', value: String(valeur ?? '') });
    } else {
      entree = el('input', { id, type: 'text', maxlength: regle.maxLongueur ?? 200, value: String(valeur ?? '') });
    }

    champs.set(regle.cle, { regle, entree });
    const erreur = el('p.champ__erreur', { hidden: true, donnees: { erreur: regle.cle } });

    return el('div.champ' + (regle.type === 'booleen' ? '.champ--case' : ''),
      el('label', { for: id, texte: regle.libelle }),
      entree,
      regle.aide ? el('p.champ__aide', { texte: regle.aide }) : null,
      erreur);
  }

  const sections = GROUPES.map((groupe) => {
    const regles = donnees.catalogue.filter((r) => groupe.prefixes.some((p) => r.cle.startsWith(p)));
    if (!regles.length) return null;
    return el('section.carte.reglages__groupe',
      el('h2.reglages__titre', { texte: groupe.titre }),
      el('div.reglages__grille', regles.map(champ)));
  });

  const bouton = el('button.bouton.bouton--principal', { type: 'submit', texte: 'Enregistrer les réglages' });

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
        await api.put('/api/reglages', { valeurs });
        succes.textContent = 'Réglages enregistrés.';
        succes.hidden = false;
        annoncer('Réglages enregistrés.');
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
  erreurGlobale, succes, sections, el('div.reglages__pied', bouton));

  const whatsapp = el('section.carte.reglages__groupe',
    el('h2.reglages__titre', { texte: 'WhatsApp' }),
    el('p.texte-doux', {
      texte: donnees.whatsapp.actif
        ? 'Les messages partent automatiquement. Modèles : ' + Object.values(donnees.whatsapp.modeles).join(', ') + '.'
        : 'L’envoi automatique n’est pas activé. Chaque client voit son lien à l’écran, et le bouton « WhatsApp » de la file ouvre la conversation avec le message déjà écrit.',
    }),
    el('p.texte-doux.reglages__note', {
      texte: 'Le jeton d’accès et l’identifiant du numéro se posent dans les variables d’environnement (WHATSAPP_ACTIF, WHATSAPP_NUMERO_ID, WHATSAPP_JETON), jamais ici : un secret n’a rien à faire en base.',
    }));

  remplacer(conteneur, el('div.enveloppe.page-gestion',
    el('h1.titre-page', { texte: 'Réglages' }),
    el('p.texte-doux', { texte: 'Adresse publique du QR Code : ' + donnees.adressePublique }),
    formulaire,
    whatsapp));
}
