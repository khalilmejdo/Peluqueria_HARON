/**
 * Les chiffres du salon.
 *
 * La journee d'abord, puisque c'est ce qu'on regarde en fin de service, puis
 * l'historique jour par jour. Aucun graphique : un tableau lisible dit la meme
 * chose et se lit aussi bien sur un telephone.
 */
import { api } from './api.js';
import { el, remplacer, minutesLisibles } from './dom.js';

const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

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
    carreau(jour.total, 'clients du jour'),
    carreau(jour.servis, 'servis'),
    carreau(jour.annules, 'annulés'),
    carreau(jour.clientsEnRetard, 'arrivés en retard', jour.absencesTotales ? jour.absencesTotales + ' absence(s) au total' : null),
    carreau(jour.attenteMoyenneMinutes === null ? '—' : minutesLisibles(jour.attenteMoyenneMinutes), 'attente moyenne'),
    carreau(jour.serviceMoyenMinutes === null ? '—' : minutesLisibles(jour.serviceMoyenMinutes), 'durée moyenne d’une coupe',
      'réglage actuel : ' + (jour.dureeMoyenneReglee ?? '—') + ' min'),
    carreau(jour.enLigne, 'venus en ligne'),
    carreau(jour.parQr, 'venus par QR Code'),
    carreau(jour.auComptoir, 'ajoutés au comptoir'));

  const contenu = [
    el('h1.titre-page', { texte: 'Chiffres' }),
    el('p.texte-doux', { texte: 'Journée du ' + jour.jour + (jour.ouverte === false ? ' — close' : '') }),
    el('section.carte', grille),
  ];

  // Le détail par fauteuil n'a de sens qu'à partir de deux.
  if ((jour.fauteuils || []).length > 1) {
    contenu.push(el('section.carte',
      el('h2.reglages__titre', { texte: 'Par fauteuil' }),
      el('ul.liste-etat', jour.fauteuils.map((f) => el('li', {
        texte: f.nom + (f.coiffeur ? ' (' + f.coiffeur + ')' : '') + ' : '
          + f.servis + ' client' + (f.servis > 1 ? 's' : '') + ' servi' + (f.servis > 1 ? 's' : '')
          + (f.coupeMoyenneMinutes === null ? '' : ', coupe moyenne ' + minutesLisibles(f.coupeMoyenneMinutes)),
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
      el('h2.reglages__titre', { texte: 'Les trente derniers jours' }),
      historique.items.length
        ? el('div.tableau-defilant',
          el('table.tableau',
            el('thead', el('tr',
              el('th', { texte: 'Jour' }),
              el('th.nombre', { texte: 'Total' }),
              el('th.nombre', { texte: 'Servis' }),
              el('th.nombre', { texte: 'Annulés' }),
              el('th.nombre', { texte: 'Retards' }),
              el('th.nombre', { texte: 'Attente moy.' }),
              el('th.nombre', { texte: 'En ligne / QR' }))),
            el('tbody', lignes)))
        : el('p.texte-doux', { texte: 'Aucune journée enregistrée pour le moment.' })));

    const service = await api.get('/api/service/etat').catch(() => null);
    if (service) {
      contenu.push(el('section.carte',
        el('h2.reglages__titre', { texte: 'État du service' }),
        el('ul.liste-etat',
          el('li', { texte: 'Base de données : ' + (service.base.ok ? (service.base.ecriture ? 'en ligne' : 'lecture seule — ' + service.base.motif) : 'injoignable — ' + service.base.motif) }),
          el('li', { texte: 'WhatsApp : ' + (service.whatsapp.actif ? 'actif' : 'non configuré') + ' — ' + service.whatsapp.enAttente + ' en attente, ' + service.whatsapp.enEchec + ' en échec' }),
          el('li', { texte: 'Écrans connectés en direct : ' + service.tempsReel.abonnes }),
          el('li', { texte: 'Version déployée : ' + (service.version || 'inconnue') + ' — fuseau ' + service.fuseau }))));
    }
  }

  remplacer(conteneur, el('div.enveloppe.page-gestion', contenu));
}
