/**
 * LA GALERIE — les photos du salon, envoyees depuis le telephone du gerant.
 *
 * Avant cet ecran, une photo se deposait par `scp` dans un dossier du serveur :
 * autrement dit, la vitrine n'en a jamais eu. Ici on appuie sur « Ajouter des
 * photos », on choisit dans la pellicule, et c'est en ligne.
 *
 * LE TELEPHONE REDUIT LA PHOTO AVANT DE L'ENVOYER. Une photo de telephone pese
 * 3 a 8 Mo et mesure 4000 px : l'envoyer telle quelle prendrait une minute en
 * 4G, et la vitrine la servirait a chaque visiteur. Le navigateur la redessine
 * a 2000 px au plus, en JPEG, avant l'envoi — quelques centaines de Ko.
 * `createImageBitmap` applique au passage l'orientation EXIF : sans cela, les
 * photos prises en portrait arriveraient couchees.
 */
import { api, ErreurApi } from './api.js';
import { el, remplacer, annoncer } from './dom.js';
import { t } from '../langue.js';

const COTE_MAX = 2000;
const QUALITE = 0.86;

/**
 * Reduit une image a COTE_MAX sur son plus grand cote, en JPEG.
 *
 * Un format que le navigateur ne sait pas decoder (le HEIC de certains iPhone
 * sur un ordinateur, par exemple) part tel quel s'il est deja admis par le
 * serveur, et le serveur le refusera avec un message clair sinon.
 */
async function preparer(fichier) {
  let image;
  try {
    image = await createImageBitmap(fichier, { imageOrientation: 'from-image' });
  } catch {
    return fichier;
  }
  const echelle = Math.min(1, COTE_MAX / Math.max(image.width, image.height));
  const largeur = Math.round(image.width * echelle);
  const hauteur = Math.round(image.height * echelle);
  const toile = document.createElement('canvas');
  toile.width = largeur;
  toile.height = hauteur;
  toile.getContext('2d').drawImage(image, 0, 0, largeur, hauteur);
  image.close?.();
  const blob = await new Promise((ok) => toile.toBlob(ok, 'image/jpeg', QUALITE));
  return blob || fichier;
}

export async function vueGalerie(conteneur) {
  const donnees = await api.get('/api/photos');
  const alerte = el('p.alerte.alerte--refus', { role: 'alert', hidden: true });
  const succes = el('p.alerte.alerte--succes', { role: 'status', hidden: true });

  const dire = (message, bon = false) => {
    const cible = bon ? succes : alerte;
    (bon ? alerte : succes).hidden = true;
    cible.textContent = message;
    cible.hidden = false;
    annoncer(message);
  };
  const recharger = () => vueGalerie(conteneur);
  const agir = async (promesse, messageBon = null) => {
    try {
      await promesse;
      if (messageBon) dire(messageBon, true);
      await recharger();
    } catch (err) {
      dire(err instanceof ErreurApi ? err.message : t('galerie.echec'));
    }
  };

  /* -------- l'interrupteur de la section -------- */
  const interrupteur = el('input', { id: 'g-visible', type: 'checkbox' });
  interrupteur.checked = Boolean(donnees.galerieVisible);
  interrupteur.addEventListener('change', () => agir(
    api.put('/api/reglages', { valeurs: { 'vitrine.galerie': interrupteur.checked } }),
    t(interrupteur.checked ? 'galerie.sectionAffichee' : 'galerie.sectionMasquee'),
  ));

  /* -------- l'envoi -------- */
  const choix = el('input', { id: 'g-fichiers', type: 'file', accept: 'image/jpeg,image/png,image/webp,image/*', multiple: true, hidden: true });
  const etatEnvoi = el('p.galerie-admin__envoi', { role: 'status', hidden: true });
  const place = donnees.max - donnees.items.length;

  choix.addEventListener('change', async () => {
    const fichiers = [...choix.files].slice(0, Math.max(0, place));
    if (!fichiers.length) return;
    let envoyees = 0;
    etatEnvoi.hidden = false;
    for (let i = 0; i < fichiers.length; i += 1) {
      etatEnvoi.textContent = t('galerie.envoiEnCours', { n: i + 1, total: fichiers.length });
      try {
        const pret = await preparer(fichiers[i]);
        await api.envoyerFichier('/api/photos', pret);
        envoyees += 1;
      } catch (err) {
        dire(err instanceof ErreurApi ? err.message : t('galerie.echec'));
        break;
      }
    }
    etatEnvoi.hidden = true;
    choix.value = '';
    if (envoyees) dire(t('galerie.envoyees', { n: envoyees }), true);
    await recharger();
  });

  const boutonAjout = el('button.bouton.bouton--principal', {
    type: 'button',
    texte: t('galerie.ajouter'),
    disabled: place <= 0 || !donnees.inscriptible ? true : null,
    surClick: () => choix.click(),
  });

  /* -------- les photos -------- */
  const ids = donnees.items.map((p) => p.id);
  const deplacer = (index, sens) => {
    const cible = index + sens;
    if (cible < 0 || cible >= ids.length) return;
    const ordre = ids.slice();
    [ordre[index], ordre[cible]] = [ordre[cible], ordre[index]];
    agir(api.post('/api/photos/orden', { ids: ordre }));
  };

  const cartes = donnees.items.map((p, i) => {
    const legende = el('input', {
      type: 'text', maxlength: '80', value: p.legende,
      placeholder: t('galerie.legendeExemple'), 'aria-label': t('galerie.legende'),
    });
    const enregistrerLegende = () => {
      if (legende.value.trim() === p.legende) return;
      agir(api.patch('/api/photos/' + p.id, { legende: legende.value }), t('galerie.legendeEnregistree'));
    };
    legende.addEventListener('change', enregistrerLegende);
    legende.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); legende.blur(); } });

    const petit = (texte, surClick, danger = false) => el('button.bouton.bouton--discret.bouton--petit' + (danger ? '.bouton--danger' : ''), {
      type: 'button', texte, surClick,
    });

    return el('li.galerie-admin__photo' + (p.visible ? '' : '.galerie-admin__photo--masquee'),
      el('div.galerie-admin__vignette',
        el('img', { src: p.src, alt: p.legende || '', loading: 'lazy', decoding: 'async' }),
        p.couverture ? el('span.galerie-admin__badge', { texte: t('galerie.couverture') }) : null,
        !p.visible ? el('span.galerie-admin__badge.galerie-admin__badge--masquee', { texte: t('galerie.masquee') }) : null),
      legende,
      el('div.galerie-admin__actions',
        p.couverture ? null : petit(t('galerie.mettreEnCouverture'),
          () => agir(api.patch('/api/photos/' + p.id, { couverture: true }), t('galerie.couvertureChoisie'))),
        petit(t(p.visible ? 'galerie.masquer' : 'galerie.afficher'),
          () => agir(api.patch('/api/photos/' + p.id, { visible: !p.visible }))),
        el('span.galerie-admin__fleches',
          el('button.bouton.bouton--discret.bouton--petit', {
            type: 'button', texte: '↑', 'aria-label': t('galerie.avancer'), disabled: i === 0 ? true : null,
            surClick: () => deplacer(i, -1),
          }),
          el('button.bouton.bouton--discret.bouton--petit', {
            type: 'button', texte: '↓', 'aria-label': t('galerie.reculer'), disabled: i === ids.length - 1 ? true : null,
            surClick: () => deplacer(i, 1),
          })),
        petit(t('commun.supprimer'), () => {
          if (!window.confirm(t('galerie.confirmerSuppression'))) return;
          agir(api.supprimer('/api/photos/' + p.id), t('galerie.supprimee'));
        }, true)));
  });

  remplacer(conteneur, el('div.enveloppe.page-gestion',
    el('h1.titre-page', { texte: t('galerie.titre') }),
    el('p.texte-doux', { texte: t('galerie.intro') }),
    alerte, succes,
    // Le dossier du serveur refuse l'ecriture : on le dit AVANT le premier
    // envoi rate, avec la commande qui le repare.
    donnees.inscriptible ? null : el('p.alerte.alerte--refus', { texte: t('galerie.dossierFerme') }),
    el('section.carte.reglages__groupe',
      el('div.champ.champ--case',
        el('label', { for: 'g-visible', texte: t('galerie.interrupteur') }),
        interrupteur,
        el('p.champ__aide', { texte: t('galerie.interrupteurAide') }))),
    el('section.carte.reglages__groupe',
      el('div.galerie-admin__tete',
        el('h2.reglages__titre', { texte: t('galerie.photos', { n: donnees.items.length, max: donnees.max }) }),
        boutonAjout, choix),
      el('p.champ__aide', { texte: t('galerie.conseil') }),
      etatEnvoi,
      donnees.items.length
        ? el('ul.galerie-admin__grille', cartes)
        : el('p.texte-doux.galerie-admin__vide', { texte: t('galerie.vide') }))));
}
