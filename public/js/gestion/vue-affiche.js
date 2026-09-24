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
    alt: 'Código QR que lleva a la página para pedir turno en el salón',
    width: '320',
    height: '320',
  });

  remplacer(conteneur, el('div.enveloppe.page-gestion',
    el('h1.titre-page', { texte: 'Código QR del salón' }),
    el('p.texte-doux', { texte: 'Pégalo en el escaparate o en el espejo. El cliente lo escanea, rellena tres campos y entra en la misma fila que quien pide turno por internet.' }),
    el('section.carte.qr',
      image,
      el('p.qr__legende', { texte: 'Escanea para pedir tu turno' }),
      el('p.qr__adresse', { texte: adresse }),
      el('div.qr__actions',
        el('a.bouton.bouton--principal', { href: '/affiche', target: '_blank', rel: 'noopener', texte: 'Abrir el cartel para imprimir' }),
        el('a.bouton.bouton--discret', { href: '/qr.svg?telecharger=1', download: true, texte: 'Descargar (SVG)' }),
        el('a.bouton.bouton--discret', { href: '/qr.png?telecharger=1', download: true, texte: 'Descargar (PNG)' }),
        el('button.bouton.bouton--discret', {
          type: 'button',
          texte: 'Copiar la dirección',
          surClick: async () => {
            try {
              await navigator.clipboard.writeText(adresse);
              annoncer('Dirección copiada.');
            } catch {
              window.prompt('Copia esta dirección:', adresse);
            }
          },
        }))),
    el('section.carte.carte--discrete',
      el('h2.reglages__titre', { texte: 'Antes de imprimir' }),
      el('ul.liste-etat',
        el('li', { texte: 'Comprueba que la dirección de arriba es la dirección pública definitiva del salón: un código QR impreso no se corrige.' }),
        el('li', { texte: 'Escanéalo tú mismo con un móvil antes de llevarlo a la imprenta.' }),
        el('li', { texte: 'El SVG es el formato para la imprenta; el PNG basta para imprimir en la oficina.' })))));
}
