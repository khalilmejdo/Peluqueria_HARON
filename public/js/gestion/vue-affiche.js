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

  // La clé de l'écran n'existe que si le gérant a choisi d'afficher les
  // apellidos. Un coiffeur ne lit pas les réglages : il n'a alors que le
  // chemin nu, ce qui est juste tant que l'écran n'est pas protégé.
  const clePantalla = donnees?.valeurs?.['pantalla.clave'] || '';
  const cheminPantalla = '/pantalla' + (clePantalla ? '?k=' + encodeURIComponent(clePantalla) : '');
  const adressePantalla = base + cheminPantalla;

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
    /*
     * L'ECRAN DU SALON. Il vit ici parce qu'il fait le meme travail que
     * l'affiche : montrer la file a la piece. Une fois ouvert sur le
     * televiseur, on n'y revient plus — d'ou l'adresse en clair, a recopier
     * sur l'appareil qui l'affichera, plutot qu'un simple lien qui n'aiderait
     * que sur cet ordinateur-ci.
     */
    el('section.carte.carte--discrete',
      el('h2.reglages__titre', { texte: 'Pantalla del salón' }),
      el('p.texte-doux', { texte: 'Una pantalla o una tablet en la sala de espera: el turno en curso en grande, los siguientes debajo, y el código QR siempre visible. Se actualiza sola.' }),
      /*
       * LA CLE FAIT PARTIE DE L'ADRESSE. Sans elle, recopiee telle quelle sur
       * le televiseur, la page repond 404 — et on chercherait le probleme du
       * cote du reseau. On montre donc l'adresse COMPLETE, jamais le chemin nu.
       */
      el('p.qr__adresse', { texte: adressePantalla }),
      el('div.qr__actions',
        el('a.bouton.bouton--principal', {
          href: cheminPantalla, target: '_blank', rel: 'noopener', texte: 'Abrir la pantalla',
        }),
        el('button.bouton.bouton--discret', {
          type: 'button',
          texte: 'Copiar la dirección de la pantalla',
          surClick: async () => {
            try {
              await navigator.clipboard.writeText(adressePantalla);
              annoncer('Dirección de la pantalla copiada.');
            } catch {
              window.prompt('Copia esta dirección:', adressePantalla);
            }
          },
        })),
      el('p.texte-doux', {
        texte: clePantalla
          ? 'Esa dirección lleva una clave: es lo que mantiene la pantalla fuera del alcance de quien no la conozca, ya que se muestran los apellidos. Cópiala entera en el navegador de la pantalla y ponlo en pantalla completa (F11). Si la clave cambia, hay que volver a poner la dirección.'
          : 'Ábrela en el navegador de la pantalla y ponlo en pantalla completa (F11). No hace falta iniciar sesión, y por eso la página solo muestra números, nombres de pila y sillones. En Ajustes se puede quitar los nombres, o mostrar también los apellidos (entonces se añade una clave a la dirección).',
      })),

    el('section.carte.carte--discrete',
      el('h2.reglages__titre', { texte: 'Antes de imprimir' }),
      el('ul.liste-etat',
        el('li', { texte: 'Comprueba que la dirección de arriba es la dirección pública definitiva del salón: un código QR impreso no se corrige.' }),
        el('li', { texte: 'Escanéalo tú mismo con un móvil antes de llevarlo a la imprenta.' }),
        el('li', { texte: 'El SVG es el formato para la imprenta; el PNG basta para imprimir en la oficina.' })))));
}
