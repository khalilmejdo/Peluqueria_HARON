/**
 * Les chiffres du salon.
 *
 * La journee d'abord, puisque c'est ce qu'on regarde en fin de service, puis
 * l'historique jour par jour. Aucun graphique : un tableau lisible dit la meme
 * chose et se lit aussi bien sur un telephone.
 */
import { api } from './api.js';
import { el, remplacer, minutesLisibles } from './dom.js';

const JOURS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

function dateCourte(iso) {
  const [a, m, j] = String(iso).split('-').map(Number);
  const d = new Date(Date.UTC(a, m - 1, j));
  return JOURS[d.getUTCDay()].slice(0, 3) + ' ' + String(j).padStart(2, '0') + '/' + String(m).padStart(2, '0');
}

function carreau(valeur, libelle, precision = null) {
  return el('div.carreau',
    el('span.carreau__valeur', { texte: String(valeur) }),
    el('span.carreau__libelle', { texte: libelle }),
    precision ? el('span.carreau__precision', { texte: precision }) : null);
}

export async function vueStatistiques(conteneur, { etat }) {
  const jour = await api.get('/api/statistiques/jour');
  const gerant = etat.utilisateur?.role === 'GERANT';

  const grille = el('div.carreaux',
    carreau(jour.total, 'clientes de hoy'),
    carreau(jour.servis, 'atendidos'),
    carreau(jour.annules, 'anulados'),
    carreau(jour.clientsEnRetard, 'llegaron tarde', jour.absencesTotales ? jour.absencesTotales + ' ausencia(s) en total' : null),
    carreau(jour.attenteMoyenneMinutes === null ? '—' : minutesLisibles(jour.attenteMoyenneMinutes), 'espera media'),
    carreau(jour.serviceMoyenMinutes === null ? '—' : minutesLisibles(jour.serviceMoyenMinutes), 'duración media de un corte',
      'ajuste actual: ' + (jour.dureeMoyenneReglee ?? '—') + ' min'),
    carreau(jour.enLigne, 'por internet'),
    carreau(jour.parQr, 'por código QR'),
    carreau(jour.auComptoir, 'añadidos en mostrador'));

  const contenu = [
    el('h1.titre-page', { texte: 'Cifras' }),
    el('p.texte-doux', { texte: 'Jornada del ' + jour.jour + (jour.ouverte === false ? ' — cerrada' : '') }),
    el('section.carte', grille),
  ];

  // Le détail par fauteuil n'a de sens qu'à partir de deux.
  if ((jour.fauteuils || []).length > 1) {
    contenu.push(el('section.carte',
      el('h2.reglages__titre', { texte: 'Por sillón' }),
      el('ul.liste-etat', jour.fauteuils.map((f) => el('li', {
        texte: f.nom + (f.coiffeur ? ' (' + f.coiffeur + ')' : '') + ': '
          + f.servis + ' cliente' + (f.servis > 1 ? 's' : '') + ' atendido' + (f.servis > 1 ? 's' : '')
          + (f.coupeMoyenneMinutes === null ? '' : ', corte medio ' + minutesLisibles(f.coupeMoyenneMinutes)),
      })))));
  }

  if (gerant) {
    const historique = await api.get('/api/statistiques/historique?limite=30');
    const lignes = historique.items.map((l) => el('tr',
      el('td', { texte: dateCourte(l.jour) }),
      el('td.nombre', { texte: String(l.total) }),
      el('td.nombre', { texte: String(l.servis) }),
      el('td.nombre', { texte: String(l.annules) }),
      el('td.nombre', { texte: String(l.clientsEnRetard) }),
      el('td.nombre', { texte: l.attenteMoyenneMinutes === null ? '—' : minutesLisibles(l.attenteMoyenneMinutes) }),
      el('td.nombre', { texte: l.enLigne + ' / ' + l.parQr })));

    contenu.push(el('section.carte',
      el('h2.reglages__titre', { texte: 'Los últimos treinta días' }),
      historique.items.length
        ? el('div.tableau-defilant',
          el('table.tableau',
            el('thead', el('tr',
              el('th', { texte: 'Día' }),
              el('th.nombre', { texte: 'Total' }),
              el('th.nombre', { texte: 'Atendidos' }),
              el('th.nombre', { texte: 'Anulados' }),
              el('th.nombre', { texte: 'Ausencias' }),
              el('th.nombre', { texte: 'Espera med.' }),
              el('th.nombre', { texte: 'Internet / QR' }))),
            el('tbody', lignes)))
        : el('p.texte-doux', { texte: 'Todavía no hay ninguna jornada registrada.' })));

    const service = await api.get('/api/service/etat').catch(() => null);
    if (service) {
      contenu.push(el('section.carte',
        el('h2.reglages__titre', { texte: 'Estado del servicio' }),
        el('ul.liste-etat',
          el('li', { texte: 'Base de datos: ' + (service.base.ok ? (service.base.ecriture ? 'en línea' : 'solo lectura — ' + service.base.motif) : 'no responde — ' + service.base.motif) }),
          el('li', { texte: 'WhatsApp: ' + (service.whatsapp.actif ? 'activo' : 'sin configurar') + ' — ' + service.whatsapp.enAttente + ' en espera, ' + service.whatsapp.enEchec + ' con error' }),
          el('li', { texte: 'Pantallas conectadas en directo: ' + service.tempsReel.abonnes }),
          el('li', { texte: 'Versión desplegada: ' + (service.version || 'desconocida') + ' — zona horaria ' + service.fuseau }))));
    }
  }

  remplacer(conteneur, el('div.enveloppe.page-gestion', contenu));
}
