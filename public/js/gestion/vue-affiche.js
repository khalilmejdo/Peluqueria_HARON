/**
 * Le QR Code du salon.
 *
 * L'adresse encodee ne change JAMAIS : l'affiche est imprimee une fois et reste
 * collee en vitrine des annees. Cet ecran ne fait que la montrer, permettre de
 * la telecharger et ouvrir l'affiche prete a imprimer.
 */
import { api } from './api.js';
import { el, remplacer, annoncer } from './dom.js';

export async function vueAffiche(conteneur, { etat }) {
  const gerant = etat.utilisateur?.role === 'GERANT';
  // Le coiffeur n'a pas acces aux reglages : on retombe alors sur l'adresse de
  // la page, qui est de toute facon celle du salon.
  const donnees = gerant ? await api.get('/api/reglages').catch(() => null) : null;
  const base = donnees?.adressePublique || window.location.origin;
  const adresse = base + '/join?qr=1';

  const image = el('img.qr__image', {
    src: '/qr.svg',
    alt: 'QR Code menant à la page de prise de tour du salon',
    width: '320',
    height: '320',
  });

  remplacer(conteneur, el('div.enveloppe.page-gestion',
    el('h1.titre-page', { texte: 'QR Code du salon' }),
    el('p.texte-doux', { texte: 'Collez-le en vitrine ou sur le miroir. Le client scanne, remplit trois champs, et entre dans la même file que ceux qui réservent en ligne.' }),
    el('section.carte.qr',
      image,
      el('p.qr__legende', { texte: 'Scannez pour prendre votre tour' }),
      el('p.qr__adresse', { texte: adresse }),
      el('div.qr__actions',
        el('a.bouton.bouton--principal', { href: '/affiche', target: '_blank', rel: 'noopener', texte: 'Ouvrir l’affiche à imprimer' }),
        el('a.bouton.bouton--discret', { href: '/qr.svg?telecharger=1', download: true, texte: 'Télécharger (SVG)' }),
        el('a.bouton.bouton--discret', { href: '/qr.png?telecharger=1', download: true, texte: 'Télécharger (PNG)' }),
        el('button.bouton.bouton--discret', {
          type: 'button',
          texte: 'Copier l’adresse',
          surClick: async () => {
            try {
              await navigator.clipboard.writeText(adresse);
              annoncer('Adresse copiée.');
            } catch {
              window.prompt('Copiez cette adresse :', adresse);
            }
          },
        }))),
    el('section.carte.carte--discrete',
      el('h2.reglages__titre', { texte: 'Avant d’imprimer' }),
      el('ul.liste-etat',
        el('li', { texte: 'Vérifiez que l’adresse ci-dessus est bien l’adresse publique définitive du salon : un QR Code imprimé ne se corrige pas.' }),
        el('li', { texte: 'Scannez-le vous-même avec un téléphone avant de partir chez l’imprimeur.' }),
        el('li', { texte: 'Le SVG est le format à donner à un imprimeur ; le PNG suffit pour une impression de bureau.' })))));
}
