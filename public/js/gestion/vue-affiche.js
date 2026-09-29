/**
 * Le QR Code du salon.
 *
 * L'adresse encodee ne change JAMAIS : l'affiche est imprimee une fois et reste
 * collee en vitrine des annees. Cet ecran ne fait que la montrer, permettre de
 * la telecharger et ouvrir l'affiche prete a imprimer.
 */
import { api } from './api.js';
import { el, remplacer, annoncer } from './dom.js';
import { t } from '../langue.js';

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
    alt: t('affiche.qr.alt'),
    width: '320',
    height: '320',
  });

  remplacer(conteneur, el('div.enveloppe.page-gestion',
    el('h1.titre-page', { texte: t('affiche.titre') }),
    el('p.texte-doux', { texte: t('affiche.intro') }),
    el('section.carte.qr',
      image,
      el('p.qr__legende', { texte: t('affiche.qr.legende') }),
      el('p.qr__adresse', { texte: adresse }),
      el('div.qr__actions',
        el('a.bouton.bouton--principal', { href: '/affiche', target: '_blank', rel: 'noopener', texte: t('affiche.action.ouvrirAffiche') }),
        el('a.bouton.bouton--discret', { href: '/qr.svg?telecharger=1', download: true, texte: t('affiche.action.telechargerSvg') }),
        el('a.bouton.bouton--discret', { href: '/qr.png?telecharger=1', download: true, texte: t('affiche.action.telechargerPng') }),
        el('button.bouton.bouton--discret', {
          type: 'button',
          texte: t('affiche.action.copierAdresse'),
          surClick: async () => {
            try {
              await navigator.clipboard.writeText(adresse);
              annoncer(t('affiche.succes.adresseCopiee'));
            } catch {
              window.prompt(t('affiche.invite.copierAdresse'), adresse);
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
      el('h2.reglages__titre', { texte: t('affiche.ecran.titre') }),
      el('p.texte-doux', { texte: t('affiche.ecran.intro') }),
      /*
       * LA CLE FAIT PARTIE DE L'ADRESSE. Sans elle, recopiee telle quelle sur
       * le televiseur, la page repond 404 — et on chercherait le probleme du
       * cote du reseau. On montre donc l'adresse COMPLETE, jamais le chemin nu.
       */
      el('p.qr__adresse', { texte: adressePantalla }),
      el('div.qr__actions',
        el('a.bouton.bouton--principal', {
          href: cheminPantalla, target: '_blank', rel: 'noopener', texte: t('affiche.ecran.action.ouvrir'),
        }),
        el('button.bouton.bouton--discret', {
          type: 'button',
          texte: t('affiche.ecran.action.copierAdresse'),
          surClick: async () => {
            try {
              await navigator.clipboard.writeText(adressePantalla);
              annoncer(t('affiche.ecran.succes.adresseCopiee'));
            } catch {
              window.prompt(t('affiche.invite.copierAdresse'), adressePantalla);
            }
          },
        })),
      el('p.texte-doux', {
        texte: clePantalla
          ? t('affiche.ecran.aide.avecCle')
          : t('affiche.ecran.aide.sansCle'),
      })),

    el('section.carte.carte--discrete',
      el('h2.reglages__titre', { texte: t('affiche.impression.titre') }),
      el('ul.liste-etat',
        el('li', { texte: t('affiche.impression.adresseDefinitive') }),
        el('li', { texte: t('affiche.impression.testerSoiMeme') }),
        el('li', { texte: t('affiche.impression.formats') })))));
}
