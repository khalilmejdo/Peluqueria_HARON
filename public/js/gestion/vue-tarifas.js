/**
 * La fiche de prix du salon.
 *
 * Elle s'affiche en vitrine : une faute ici se lit depuis la rue. L'ecran est
 * donc fait pour corriger vite — un champ, Entree, c'est enregistre — et pour
 * montrer l'ordre exact dans lequel le client verra les lignes.
 *
 * Le prix se tape comme on l'ecrit : « 14 », « 14,90 », « 14.90 ». C'est le
 * SERVEUR qui le lit et qui decide comment il se reaffiche ; cet ecran ne fait
 * aucun calcul sur de l'argent et n'invente aucun format. Il renvoie la chaine
 * telle quelle et affiche ce que le serveur lui rend.
 *
 * « Ocultar » plutot que supprimer : une prestation retiree de la vitrine garde
 * son prix pour le jour ou elle revient.
 */
import { api, ErreurApi } from './api.js';
import { el, remplacer, annoncer } from './dom.js';
import { t, dureeCourte } from '../langue.js';
import { montantNu, symboleMonnaie } from '../devise.js';

/**
 * Le glisser-deposer de la fiche de prix.
 *
 * POINTER EVENTS, et pas le glisser-deposer HTML5 : celui-ci ne marche pas au
 * doigt, et le gerant tient une tablette. Trois choix qui comptent :
 *
 *   - la poignee seule demarre le geste. Sans elle, un doigt pose sur la ligne
 *     pour faire defiler la page deplacerait un tarif par erreur ;
 *   - on n'attend pas la fin pour montrer le resultat : la ligne saisie change
 *     de place en direct, des qu'elle depasse le MILIEU d'une voisine. Un
 *     apercu qui suit le doigt sans jamais s'engager donne l'impression que
 *     rien ne se passe ;
 *   - au relachement, l'ordre COMPLET part en une seule requete. Le serveur
 *     refuse si la liste ne correspond plus a la fiche : quelqu'un a ajoute ou
 *     supprime une ligne entre-temps, et appliquer quand meme la perdrait.
 *
 * Les fleches restent : elles sont le chemin au clavier, et le seul qui
 * fonctionne si ce fichier n'arrive jamais.
 */
function brancherGlisser(liste, dire, recharger) {
  let saisie = null;
  let ordreInitial = null;

  const idsAffiches = () => [...liste.children].map((li) => li.dataset.id);

  liste.addEventListener('pointerdown', (evenement) => {
    const poignee = evenement.target.closest('.tarifa-admin__poignee');
    if (!poignee || evenement.button !== 0) return;
    evenement.preventDefault();

    saisie = poignee.closest('.tarifa-admin');
    if (!saisie) return;
    ordreInitial = idsAffiches();
    saisie.classList.add('tarifa-admin--saisie');
    poignee.setPointerCapture(evenement.pointerId);
  });

  liste.addEventListener('pointermove', (evenement) => {
    if (!saisie) return;
    evenement.preventDefault();

    for (const autre of liste.children) {
      if (autre === saisie) continue;
      const cadre = autre.getBoundingClientRect();
      const milieu = cadre.top + cadre.height / 2;
      // Au-dessus du milieu de la voisine du dessus : on passe devant elle.
      if (evenement.clientY < milieu && autre.compareDocumentPosition(saisie)
        & Node.DOCUMENT_POSITION_FOLLOWING) {
        liste.insertBefore(saisie, autre);
        return;
      }
      // Sous le milieu de la voisine du dessous : on passe apres elle.
      if (evenement.clientY > milieu && autre.compareDocumentPosition(saisie)
        & Node.DOCUMENT_POSITION_PRECEDING) {
        liste.insertBefore(saisie, autre.nextSibling);
        return;
      }
    }
  });

  const lacher = async () => {
    if (!saisie) return;
    saisie.classList.remove('tarifa-admin--saisie');
    saisie = null;

    const ids = idsAffiches();
    // Rien n'a bouge : pas de requete, pas de message.
    if (ids.join() === (ordreInitial || []).join()) return;

    try {
      await api.post('/api/tarifas/orden', { ids });
      annoncer(t('tarifs.ordreEnregistre'));
      await recharger();
    } catch (err) {
      dire(err instanceof ErreurApi ? err.message : t('tarifs.ordreEchoue'));
      // L'ecran montre un ordre que la base n'a pas : on repart du vrai.
      await recharger();
    }
  };

  liste.addEventListener('pointerup', lacher);
  liste.addEventListener('pointercancel', lacher);
}

export async function vueTarifas(conteneur, { etat }) {
  const donnees = await api.get('/api/tarifas');

  const alerte = el('p.alerte.alerte--refus', { role: 'alert', hidden: true });
  const succes = el('p.alerte.alerte--succes', { role: 'status', hidden: true });

  const dire = (message, bon = false) => {
    const cible = bon ? succes : alerte;
    const autre = bon ? alerte : succes;
    cible.textContent = message;
    cible.hidden = false;
    autre.hidden = true;
    annoncer(message);
  };

  const recharger = () => vueTarifas(conteneur, { etat });

  /** Un geste sur une ligne : on recharge, pour que l'ordre affiché soit celui de la base. */
  const agir = async (faire, messageOk) => {
    try {
      await faire();
      annoncer(messageOk);
      await recharger();
    } catch (err) {
      dire(err instanceof ErreurApi ? err.message : t('tarifs.enregistrementEchoue'));
    }
  };

  /* ---- la liste ---- */

  const lignes = donnees.items.map((tarifa, i) => el('li.tarifa-admin' + (tarifa.visible ? '' : '.tarifa-admin--oculta'), {
    donnees: { id: tarifa.id },
  },
    // La poignée de déplacement.
    //
    // Pointer Events, PAS le glisser-deposer HTML5 : celui-ci ne marche pas au
    // doigt, et le gerant tient une tablette. Les fleches restent en place —
    // elles sont le chemin au clavier, et le seul qui marche sans JavaScript.
    el('button.tarifa-admin__poignee', {
      type: 'button',
      'aria-label': t('tarifs.deplacerAria', { nom: tarifa.nombre }),
      title: t('tarifs.poigneeTitre'),
      texte: '⠿',
    }),
    el('div.tarifa-admin__texte',
      el('span.tarifa-admin__nombre', { texte: tarifa.nombre }),
      tarifa.nota ? el('span.tarifa-admin__nota', { texte: tarifa.nota }) : null,
      tarifa.visible ? null : el('span.tarifa-admin__badge', { texte: t('tarifs.badgeMasquee') })),

    el('div.tarifa-admin__chiffres',
      el('span.tarifa-admin__precio', { texte: tarifa.precio }),
      el('span.tarifa-admin__duree', { texte: dureeCourte(tarifa.duracionMin ?? 15) })),

    el('div.tarifa-admin__actions',
      // Les fleches sont desactivees en bout de liste plutot que cachees : la
      // colonne d'actions garde la meme largeur d'une ligne a l'autre.
      el('button.bouton.bouton--discret.bouton--petit', {
        type: 'button',
        texte: '↑',
        'aria-label': t('tarifs.monterAria', { nom: tarifa.nombre }),
        disabled: i === 0,
        surClick: () => agir(
          () => api.post('/api/tarifas/' + tarifa.id + '/mover', { sens: 'arriba' }),
          t('tarifs.aMonte', { nom: tarifa.nombre }),
        ),
      }),
      el('button.bouton.bouton--discret.bouton--petit', {
        type: 'button',
        texte: '↓',
        'aria-label': t('tarifs.descendreAria', { nom: tarifa.nombre }),
        disabled: i === donnees.items.length - 1,
        surClick: () => agir(
          () => api.post('/api/tarifas/' + tarifa.id + '/mover', { sens: 'abajo' }),
          t('tarifs.aDescendu', { nom: tarifa.nombre }),
        ),
      }),
      el('button.bouton.bouton--discret.bouton--petit', {
        type: 'button',
        texte: t('tarifs.modifier'),
        surClick: () => editer(tarifa),
      }),
      el('button.bouton.bouton--discret.bouton--petit', {
        type: 'button',
        texte: t(tarifa.visible ? 'tarifs.masquer' : 'tarifs.montrer'),
        surClick: () => agir(
          () => api.patch('/api/tarifas/' + tarifa.id, { visible: !tarifa.visible }),
          t(tarifa.visible ? 'tarifs.estMasquee' : 'tarifs.estAffichee', { nom: tarifa.nombre }),
        ),
      }),
      el('button.bouton.bouton--discret.bouton--petit.bouton--danger', {
        type: 'button',
        texte: t('tarifs.supprimer'),
        surClick: () => {
          if (!window.confirm(t('tarifs.confirmerSuppression', { nom: tarifa.nombre }))) return;
          agir(
            () => api.supprimer('/api/tarifas/' + tarifa.id),
            t('tarifs.estSupprimee', { nom: tarifa.nombre }),
          );
        },
      }))));

  /**
   * Modifier une ligne : une invite du navigateur, volontairement.
   *
   * Un formulaire complet ferait un plus bel ecran, mais le gerant corrige un
   * prix trois fois par an, debout, entre deux clients. Deux invites qu'il peut
   * valider au clavier le tirent d'affaire plus vite qu'un panneau a ouvrir.
   */
  const editer = (tarifa) => {
    const nombre = window.prompt(t('tarifs.inviteNom'), tarifa.nombre);
    if (nombre === null) return;
    const precio = window.prompt(t('tarifs.invitePrix'), montantNu(tarifa.precioCts));
    if (precio === null) return;
    const duracion = window.prompt(t('tarifs.inviteDuree'), String(tarifa.duracionMin ?? 15));
    if (duracion === null) return;
    const nota = window.prompt(t('tarifs.inviteNote'), tarifa.nota);
    if (nota === null) return;
    agir(
      () => api.patch('/api/tarifas/' + tarifa.id, { nombre, precio, duracion, nota }),
      t('tarifs.enregistre'),
    );
  };

  const liste = donnees.items.length
    ? el('ul.tarifas-admin', lignes)
    : el('p.texte-doux', { texte: t('tarifs.listeVide') });

  if (donnees.items.length > 1) brancherGlisser(liste, dire, recharger);

  /* ---- ajouter ---- */

  const champNombre = el('input', { id: 'tf-nombre', type: 'text', maxlength: '60', required: true, placeholder: t('tarifs.exempleService') });
  const champPrecio = el('input', { id: 'tf-precio', type: 'text', maxlength: '12', required: true, inputmode: 'decimal', placeholder: '14,90' });
  const champDuracion = el('input', { id: 'tf-duracion', type: 'number', min: '1', max: '240', inputmode: 'numeric', value: '15' });
  const champNota = el('input', { id: 'tf-nota', type: 'text', maxlength: '80', placeholder: t('tarifs.exempleNote') });
  const bouton = el('button.bouton.bouton--principal', { type: 'submit', texte: t('tarifs.ajouter') });

  const formulaire = el('form.formulaire.tarifas-admin__ajout', {
    surSubmit: async (evenement) => {
      evenement.preventDefault();
      bouton.disabled = true;
      try {
        await api.post('/api/tarifas', {
          nombre: champNombre.value.trim(),
          precio: champPrecio.value.trim(),
          duracion: champDuracion.value.trim(),
          nota: champNota.value.trim(),
        });
        annoncer(t('tarifs.estAjoutee', { nom: champNombre.value.trim() }));
        await recharger();
      } catch (err) {
        bouton.disabled = false;
        dire(err instanceof ErreurApi ? err.message : t('tarifs.ajoutEchoue'));
        champNombre.focus();
      }
    },
  },
  el('div.champ', el('label', { for: 'tf-nombre', texte: t('tarifs.champService') }), champNombre),
  el('div.champ', el('label', { for: 'tf-precio', texte: t('tarifs.champPrix') }), champPrecio,
    el('p.champ__aide', { texte: t('tarifs.aidePrix', { symbole: symboleMonnaie() }) })),
  el('div.champ', el('label', { for: 'tf-duracion', texte: t('tarifs.champDuree') }), champDuracion,
    el('p.champ__aide', { texte: t('tarifs.aideDuree') })),
  el('div.champ', el('label', { for: 'tf-nota', texte: t('tarifs.champNote') }), champNota),
  bouton);

  remplacer(conteneur, el('div.enveloppe.page-gestion',
    el('h1.titre-page', { texte: t('tarifs.titre') }),
    el('p.texte-doux', {
      texte: t('tarifs.compteVisibles', { visibles: donnees.visibles, total: donnees.items.length }),
    }),
    alerte, succes,
    el('section.carte', liste),
    el('section.carte',
      el('h2.reglages__titre', { texte: t('tarifs.titreAjout') }),
      formulaire)));
}
