/**
 * Les congés du salon.
 *
 * Une periode couvre ses deux bornes incluses. Pendant qu'elle court, personne
 * ne peut prendre de tour, et la page d'accueil annonce la date de reouverture.
 * Une fermeture a venir est annoncee aux clients des maintenant : c'est
 * exactement ce qu'ils veulent savoir avant de passer.
 */
import { api, ErreurApi } from './api.js';
import { el, remplacer, annoncer } from './dom.js';

const JOURS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MOIS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function dateLongue(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  if (!m) return String(iso || '');
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return JOURS[d.getUTCDay()] + ' ' + Number(m[3]) + ' de ' + MOIS[Number(m[2]) - 1] + ' de ' + m[1];
}

export async function vueFermetures(conteneur, { etat }) {
  const donnees = await api.get('/api/fermetures');
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

  const recharger = () => vueFermetures(conteneur, { etat });

  /* ---- la periode en cours ---- */

  const enCours = donnees.enCours
    ? el('section.carte.fermeture-active',
      el('p.pastille', { texte: 'Ahora mismo' }),
      el('h2.reglages__titre', { texte: 'El salón está cerrado' }),
      el('p.texte-doux', { texte: donnees.enCours.message }))
    : null;

  /* ---- la liste ---- */

  const lignes = donnees.items.map((f) => el('li.fermeture' + (f.enCours ? '.fermeture--active' : ''),
    el('div.fermeture__dates',
      el('span.fermeture__du', { texte: dateLongue(f.du) }),
      el('span.fermeture__separateur', { texte: f.du === f.au ? '' : ' → ' }),
      f.du === f.au ? null : el('span.fermeture__au', { texte: dateLongue(f.au) })),
    el('p.fermeture__meta',
      el('span', { texte: f.jours + ' día' + (f.jours > 1 ? 's' : '') }),
      f.motif ? el('span', { texte: '· ' + f.motif }) : null,
      f.enCours ? el('span.fermeture__badge', { texte: 'en curso' }) : null),
    el('button.bouton.bouton--discret.bouton--petit.bouton--danger', {
      type: 'button',
      texte: 'Borrar',
      surClick: async () => {
        if (!window.confirm('¿Borrar el cierre del ' + dateLongue(f.du) + '?\nLos clientes podrán volver a pedir turno en esas fechas.')) return;
        try {
          await api.supprimer('/api/fermetures/' + f.id);
          dire('Periodo borrado.', true);
          await recharger();
        } catch (err) {
          dire(err instanceof ErreurApi ? err.message : 'No se ha podido borrar.');
        }
      },
    })));

  /* ---- ajout ---- */

  const du = el('input', { id: 'f-du', type: 'date', required: true, min: donnees.aujourdhui });
  const au = el('input', { id: 'f-au', type: 'date', required: true, min: donnees.aujourdhui });
  const motif = el('input', { id: 'f-motif', type: 'text', maxlength: '120', placeholder: 'Vacaciones de agosto, festivo…' });

  // Choisir une date de debut sans date de fin est le cas courant (« je ferme
  // ce jour-là ») : on remplit la fin toute seule, l'utilisateur corrige s'il
  // veut plus long.
  du.addEventListener('change', () => {
    au.min = du.value || donnees.aujourdhui;
    if (!au.value || au.value < du.value) au.value = du.value;
  });

  const ajout = el('form.formulaire', {
    surSubmit: async (evenement) => {
      evenement.preventDefault();
      try {
        await api.post('/api/fermetures', {
          du: du.value,
          au: au.value || du.value,
          motif: motif.value.trim() || undefined,
        });
        dire('Periodo guardado. Los clientes ya están informados.', true);
        await recharger();
      } catch (err) {
        dire(err instanceof ErreurApi ? err.message : 'No se ha podido guardar.');
      }
    },
  },
  el('div.reglages__grille',
    el('div.champ', el('label', { for: 'f-du', texte: 'Desde' }), du),
    el('div.champ', el('label', { for: 'f-au', texte: 'Hasta (incluido)' }), au),
    el('div.champ', el('label', { for: 'f-motif', texte: 'Motivo (opcional)' }), motif)),
  el('button.bouton.bouton--principal', { type: 'submit', texte: 'Declarar el cierre' }));

  remplacer(conteneur, el('div.enveloppe.page-gestion',
    el('h1.titre-page', { texte: 'Vacaciones y cierres' }),
    el('p.texte-doux', {
      texte: 'Durante un periodo declarado, nadie puede pedir turno y la página de inicio anuncia la fecha de reapertura. La fila del día nunca se interrumpe: los clientes que ya están se atienden.',
    }),
    alerte, succes,
    enCours,
    donnees.prochaine
      ? el('p.texte-doux.annonce-prochaine', {
        texte: 'Próximo cierre anunciado a los clientes: del ' + dateLongue(donnees.prochaine.du) + ' al ' + dateLongue(donnees.prochaine.au) + '.',
      })
      : null,
    el('section.carte',
      el('h2.reglages__titre', { texte: 'Declarar un periodo' }),
      ajout),
    el('section.carte',
      el('h2.reglages__titre', { texte: 'Periodos guardados' }),
      donnees.items.length
        ? el('ul.fermetures', lignes)
        : el('p.texte-doux', { texte: 'No hay ningún cierre declarado.' }))));
}
