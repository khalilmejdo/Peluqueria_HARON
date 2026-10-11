/**
 * Les chiffres du salon.
 *
 * La journee d'abord, puisque c'est ce qu'on regarde en fin de service, puis
 * l'historique jour par jour. Aucun graphique : un tableau lisible dit la meme
 * chose et se lit aussi bien sur un telephone.
 */
import { api } from './api.js';
import { el, remplacer, minutesLisibles } from './dom.js';
import { t } from '../langue.js';

/**
 * « mar 29/09 », dans la colonne la plus etroite du tableau.
 *
 * Le nom du jour vient des cles « jour.0 »..« jour.6 », coupe a trois lettres :
 * les sept abreviations restent distinctes dans les deux langues (dim, lun, mar,
 * mer, jeu, ven, sam — dom, lun, mar, mie, jue, vie, sab).
 */
function dateCourte(iso) {
  const [a, m, j] = String(iso).split('-').map(Number);
  const d = new Date(Date.UTC(a, m - 1, j));
  return t('jour.' + d.getUTCDay()).slice(0, 3) + ' ' + String(j).padStart(2, '0') + '/' + String(m).padStart(2, '0');
}

function carreau(valeur, libelle, precision = null) {
  return el('div.carreau',
    el('span.carreau__valeur', { texte: String(valeur) }),
    el('span.carreau__libelle', { texte: libelle }),
    precision ? el('span.carreau__precision', { texte: precision }) : null);
}

export async function vueStatistiques(conteneur, { etat }) {
  const jour = await api.get('/api/statistiques/jour');
  const gerant = ['GERANT', 'SUPERADMIN'].includes(etat.utilisateur?.role);

  const grille = el('div.carreaux',
    carreau(jour.total, t('chiffres.clientsDuJour')),
    carreau(jour.servis, t('chiffres.servis')),
    carreau(jour.annules, t('chiffres.annules')),
    carreau(jour.clientsEnRetard, t('chiffres.enRetard'),
      jour.absencesTotales ? t('chiffres.absencesTotales', { n: jour.absencesTotales }) : null),
    carreau(jour.attenteMoyenneMinutes === null ? '—' : minutesLisibles(jour.attenteMoyenneMinutes), t('chiffres.attenteMoyenne')),
    carreau(jour.serviceMoyenMinutes === null ? '—' : minutesLisibles(jour.serviceMoyenMinutes), t('chiffres.coupeMoyenne'),
      jour.dureeMoyenneReglee === null || jour.dureeMoyenneReglee === undefined
        ? t('chiffres.reglageAbsent')
        : t('chiffres.reglageActuel', { n: jour.dureeMoyenneReglee })),
    carreau(jour.enLigne, t('chiffres.parInternet')),
    carreau(jour.parQr, t('chiffres.parQr')),
    carreau(jour.auComptoir, t('chiffres.auComptoir')));

  const contenu = [
    el('h1.titre-page', { texte: t('chiffres.titre') }),
    el('p.texte-doux', {
      texte: t(jour.ouverte === false ? 'chiffres.journeeFermee' : 'chiffres.journeeDu', { date: jour.jour }),
    }),
    el('section.carte', grille),
  ];

  // Le détail par fauteuil n'a de sens qu'à partir de deux.
  if ((jour.fauteuils || []).length > 1) {
    contenu.push(el('section.carte',
      el('h2.reglages__titre', { texte: t('chiffres.parFauteuil') }),
      el('ul.liste-etat', jour.fauteuils.map((f) => el('li', {
        texte: t('chiffres.fauteuilServis', {
          nom: f.nom + (f.coiffeur ? ' (' + f.coiffeur + ')' : ''),
          n: f.servis,
        }) + (f.coupeMoyenneMinutes === null
          ? ''
          : t('chiffres.fauteuilCoupeMoyenne', { duree: minutesLisibles(f.coupeMoyenneMinutes) })),
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
      el('div.entete-section',
        el('h2.reglages__titre', { texte: t('chiffres.trenteDerniersJours') }),
        // Un vrai lien, pas un bouton avec du script : le navigateur telecharge
        // lui-meme, la session voyage dans le cookie, et « enregistrer sous »
        // du clic droit fonctionne.
        el('a.bouton.bouton--discret.bouton--petit', {
          href: '/api/statistiques/historique.csv',
          download: true,
          texte: t('chiffres.telechargerCsv'),
        })),
      historique.items.length
        ? el('div.tableau-defilant',
          el('table.tableau',
            el('thead', el('tr',
              el('th', { texte: t('chiffres.colJour') }),
              el('th.nombre', { texte: t('chiffres.colTotal') }),
              el('th.nombre', { texte: t('chiffres.colServis') }),
              el('th.nombre', { texte: t('chiffres.colAnnules') }),
              el('th.nombre', { texte: t('chiffres.colAbsences') }),
              el('th.nombre', { texte: t('chiffres.colAttenteMoyenne') }),
              el('th.nombre', { texte: t('chiffres.colInternetQr') }))),
            el('tbody', lignes)))
        : el('p.texte-doux', { texte: t('chiffres.aucuneJournee') })));

    const service = await api.get('/api/service/etat').catch(() => null);
    if (service) {
      const base = service.base.ok
        ? (service.base.ecriture
          ? t('chiffres.baseEnLigne')
          : t('chiffres.baseLectureSeule', { motif: service.base.motif }))
        : t('chiffres.baseMuette', { motif: service.base.motif });

      contenu.push(el('section.carte',
        el('h2.reglages__titre', { texte: t('chiffres.etatService') }),
        el('ul.liste-etat',
          el('li', { texte: base }),
          el('li', {
            texte: t('chiffres.whatsapp', {
              etat: t(service.whatsapp.actif ? 'chiffres.actif' : 'chiffres.nonConfigure'),
              enAttente: service.whatsapp.enAttente,
              enEchec: service.whatsapp.enEchec,
            }),
          }),
          el('li', { texte: t('chiffres.ecransConnectes', { n: service.tempsReel.abonnes }) }),
          el('li', {
            texte: t('chiffres.rapportErreurs', {
              etat: t(service.sentry ? 'chiffres.actif' : 'chiffres.nonConfigure'),
            }),
          }),
          el('li', {
            texte: t('chiffres.versionDeployee', {
              version: service.version || t('chiffres.versionInconnue'),
              fuseau: service.fuseau,
            }),
          }))));
    }
  }

  remplacer(conteneur, el('div.enveloppe.page-gestion', contenu));
}
