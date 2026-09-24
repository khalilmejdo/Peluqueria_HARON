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
  { titre: 'El salón', prefixes: ['salon.'] },
  { titre: 'La fila', prefixes: ['file.'] },
  { titre: 'Horario de apertura', prefixes: ['horaires.'] },
  { titre: 'Tarifas en la vitrina', prefixes: ['tarifas.'] },
  { titre: 'Dirección pública', prefixes: ['public.'] },
];

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
      p.actif ? null : el('span.fauteuil__badge', { texte: 'cerrado' })),
    el('p.fauteuil__meta',
      p.occupePar ? el('span.fauteuil__occupe', { texte: 'ocupado — ' + p.occupePar }) : el('span', { texte: p.actif ? 'libre' : 'fuera de servicio' }),
      el('span', { texte: '·' }),
      el('span', { texte: p.servisAujourdhui + ' atendido' + (p.servisAujourdhui > 1 ? 's' : '') + ' hoy' })),
    el('div.fauteuil__actions',
      el('button.bouton.bouton--discret.bouton--petit', {
        type: 'button',
        texte: 'Renombrar',
        surClick: async () => {
          const nom = window.prompt('Nombre del sillón:', p.nom);
          if (nom === null || nom.trim() === p.nom) return;
          try {
            await api.patch('/api/postes/' + p.id, { nom: nom.trim() });
            await recharger();
          } catch (err) {
            dire(err instanceof ErreurApi ? err.message : 'No se ha podido renombrar.');
          }
        },
      }),
      el('button.bouton.bouton--discret.bouton--petit', {
        type: 'button',
        texte: p.coiffeur ? 'Cambiar el peluquero' : 'Poner el peluquero',
        surClick: async () => {
          const coiffeur = window.prompt('Peluquero de este sillón (déjalo vacío para quitarlo):', p.coiffeur || '');
          if (coiffeur === null) return;
          try {
            await api.patch('/api/postes/' + p.id, { coiffeur: coiffeur.trim() });
            await recharger();
          } catch (err) {
            dire(err instanceof ErreurApi ? err.message : 'Modification impossible.');
          }
        },
      }),
      el('button.bouton.bouton--discret.bouton--petit', {
        type: 'button',
        texte: p.actif ? 'Cerrar' : 'Reabrir',
        surClick: async () => {
          try {
            await api.patch('/api/postes/' + p.id, { actif: !p.actif });
            dire(p.actif ? 'Sillón cerrado.' : 'Sillón reabierto.', true);
            await recharger();
          } catch (err) {
            dire(err instanceof ErreurApi ? err.message : 'Modification impossible.');
          }
        },
      }),
      p.servisAujourdhui === 0
        ? el('button.bouton.bouton--discret.bouton--petit.bouton--danger', {
          type: 'button',
          texte: 'Borrar',
          surClick: async () => {
            if (!window.confirm('¿Borrar el sillón « ' + p.nom + ' »?')) return;
            try {
              await api.supprimer('/api/postes/' + p.id);
              dire('Sillón borrado.', true);
              await recharger();
            } catch (err) {
              dire(err instanceof ErreurApi ? err.message : 'No se ha podido borrar.');
            }
          },
        })
        : null)));

  const nom = el('input', { id: 'p-nom', type: 'text', maxlength: '40', required: true, placeholder: 'Sillón 2' });
  const coiffeur = el('input', { id: 'p-coiffeur', type: 'text', maxlength: '60', placeholder: 'Nombre del peluquero (opcional)' });

  const ajout = el('form.formulaire', {
    surSubmit: async (evenement) => {
      evenement.preventDefault();
      try {
        await api.post('/api/postes', { nom: nom.value.trim(), coiffeur: coiffeur.value.trim() || undefined });
        dire('Sillón añadido.', true);
        await recharger();
      } catch (err) {
        dire(err instanceof ErreurApi ? err.message : 'No se ha podido crear.');
      }
    },
  },
  el('div.reglages__grille',
    el('div.champ', el('label', { for: 'p-nom', texte: 'Nombre del sillón' }), nom),
    el('div.champ', el('label', { for: 'p-coiffeur', texte: 'Peluquero' }), coiffeur,
      el('p.champ__aide', { texte: 'Se muestra en la tarjeta del sillón. Opcional.' }))),
  el('button.bouton.bouton--principal', { type: 'submit', texte: 'Añadir el sillón' }));

  return el('section.carte.reglages__groupe',
    el('h2.reglages__titre', { texte: 'Sillones' }),
    el('p.texte-doux', {
      texte: donnees.actifs > 1
        ? donnees.actifs + ' sillones abiertos: la fila sigue siendo una sola, pero avanza ' + donnees.actifs + ' veces más rápido, y la espera que se anuncia a los clientes lo tiene en cuenta.'
        : 'Solo un sillón abierto. Añade un segundo y la pantalla de la fila mostrará una tarjeta por sillón.',
    }),
    el('ul.fauteuils-liste', lignes),
    el('details.creation',
      el('summary', { texte: 'Añadir un sillón' }),
      ajout));
}

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

  const sections = GROUPES.map((groupe) => {
    const regles = donnees.catalogue.filter((r) => groupe.prefixes.some((p) => r.cle.startsWith(p)));
    if (!regles.length) return null;
    return el('section.carte.reglages__groupe',
      el('h2.reglages__titre', { texte: groupe.titre }),
      el('div.reglages__grille', regles.map(champ)));
  });

  const bouton = el('button.bouton.bouton--principal', { type: 'submit', texte: 'Guardar los ajustes' });

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
        succes.textContent = 'Ajustes guardados.';
        succes.hidden = false;
        annoncer('Ajustes guardados.');
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
    el('h2.reglages__titre', { texte: 'WhatsApp' }),
    el('p.texte-doux', {
      texte: donnees.whatsapp.actif
        ? 'Los mensajes salen automáticamente. Plantillas: ' + Object.values(donnees.whatsapp.modeles).join(', ') + '.'
        : 'El envío automático no está activado. Cada cliente ve su enlace en pantalla, y el botón « WhatsApp » de la fila abre la conversación con el mensaje ya escrito.',
    }),
    el('p.texte-doux.reglages__note', {
      texte: 'El token de acceso y el identificador del número se ponen en las variables de entorno (WHATSAPP_ACTIF, WHATSAPP_NUMERO_ID, WHATSAPP_JETON), nunca aquí: un secreto no tiene nada que hacer en la base de datos.',
    }));

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
    el('h1.titre-page', { texte: 'Ajustes' }),
    el('p.texte-doux', { texte: 'Dirección pública del código QR: ' + donnees.adressePublique }),
    erreurGlobale, succes,
    fauteuils,
    formulaire,
    whatsapp));
}
