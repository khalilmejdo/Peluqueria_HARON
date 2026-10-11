/**
 * Donnees de reference.
 *
 * Idempotent, joue a chaque demarrage du conteneur :
 *
 *   - poser les reglages par defaut qui n'existent pas encore. Il ne TOUCHE
 *     JAMAIS a un reglage deja enregistre : le gerant est maitre chez lui, et
 *     un redeploiement ne doit pas lui remettre 20 minutes par coupe alors
 *     qu'il en a mis 35 ;
 *   - creer un premier fauteuil et une fiche de prix de depart, uniquement si
 *     ces tables sont VIDES. Une ligne de tarif supprimee ne doit pas
 *     reapparaitre au redeploiement suivant ;
 *   - creer le premier compte du salon si la table est vide, et seulement dans
 *     ce cas, a partir de BOOTSTRAP_ADMIN_USERNAME / BOOTSTRAP_ADMIN_PASSWORD.
 */
import { config } from '../core/config.js';
import { execute, one } from './index.js';
import { newId, hashPassword } from '../core/crypto.js';
import { normalize } from '../core/text.js';
import { CATALOGUE, defautDe, invaliderCache } from '../core/reglages.js';
import { t, poserLangueActive, LANGUE_DEFAUT } from '../core/langue.js';
import { poserDeviseActive, deviseActive, DEVISE_DEFAUT } from '../core/devise.js';
import { relibellerDefauts } from '../domain/relibeller.js';
import { reprendreLesAnciennes } from '../domain/photos.js';
import { CATALOGUES, appliquerCatalogue } from '../domain/catalogues.js';
import { STYLE_DE_L_ACTIVITE } from '../core/theme.js';

/**
 * La fiche de prix de depart : celle du tableau affiche dans le salon.
 *
 *   nom, prix EN CENTIMES, icone, note
 *
 * Elle n'est posee que sur une base VIDE. Sur un salon deja en service, c'est
 * `npm run tarifas` qui la charge, et lui seul — le seed ne doit jamais
 * ecraser les prix que le gerant a saisis.
 */
/**
 * La fiche du salon : nom, prix en CENTIMES, icone, note, DUREE en minutes.
 *
 * La duree est ce qui rend l attente annoncee juste. Quand une fourchette a
 * ete donnee (10-15 min), on retient la BORNE HAUTE : mieux vaut un client
 * qui passe plus tot que prevu qu un client qui attend au-dela de ce qu on
 * lui a promis.
 */
/**
 * La fiche de depart : une cle de nom, les prix par monnaie, l'icone, la note,
 * la duree en minutes.
 *
 * LES PRIX SONT DONNES PAR MONNAIE, ET CE N'EST PAS UNE CONVERSION. Sept euros
 * font environ soixante-quinze dirhams, mais une coupe a Casablanca ne coute pas
 * soixante-quinze dirhams : elle en coute quarante. Ce sont deux marches, pas
 * deux ecritures du meme prix — un taux de change ici aurait produit une fiche
 * credible nulle part.
 *
 * Ce sont des ordres de grandeur, pas une verite : le gerant les corrige en deux
 * minutes depuis l'espace de gestion, et c'est bien pour cela qu'ils existent —
 * une vitrine vide le premier jour est pire qu'une vitrine approximative.
 */
export const TARIFS_DE_DEPART = CATALOGUES.BARBERIA.map(([cle, , prix, icono, duree, o = {}]) => [cle, prix, icono, o.nota || null, duree]);

/**
 * LA LANGUE ET LA MONNAIE D'ABORD, AVANT TOUTE ECRITURE.
 *
 * Tout ce que le seed ecrit est du texte : l'accroche de la page d'accueil, le
 * nom du premier fauteuil, les quinze noms de prestations, le nom du compte
 * gerant. Les ecrire avant de savoir dans quelle langue on installe reviendrait
 * a installer en espagnol, puis a demander au gerant de tout retaper.
 *
 * On ne lit `.env` QUE si le reglage n'existe pas encore. Sur un salon en
 * service, la base fait foi : un APP_LANGUE oublie dans un fichier ne doit pas
 * pouvoir renverser le choix fait a l'ecran.
 */
async function langueDInstallation(dire) {
  const stockee = await one("SELECT valeur FROM reglages WHERE cle = 'salon.idioma'");
  const stockeeDevise = await one("SELECT valeur FROM reglages WHERE cle = 'salon.moneda'");

  const langue = stockee?.valeur || config.installation.langue || LANGUE_DEFAUT;
  const monnaie = stockeeDevise?.valeur || config.installation.monnaie || DEVISE_DEFAUT;

  const langueActive = poserLangueActive(langue);
  const deviseRetenue = poserDeviseActive(monnaie);
  invaliderCache();

  if (!stockee && config.installation.langue) {
    dire('  Installation : langue « ' + langueActive + ' » lue dans APP_LANGUE.');
  }
  if (!stockeeDevise && config.installation.monnaie) {
    dire('  Installation : monnaie « ' + deviseRetenue + ' » lue dans APP_MONNAIE.');
  }
  // L'ACTIVITE, meme regle : la base fait foi, APP_ACTIVITE ne sert qu'a une
  // installation neuve. Elle choisit la carte de depart et le style propose.
  const stockeeActivite = await one("SELECT valeur FROM reglages WHERE cle = 'marque.activite'");
  const activite = CATALOGUES[stockeeActivite?.valeur] ? stockeeActivite.valeur
    : (CATALOGUES[config.installation.activite] ? config.installation.activite : 'BARBERIA');
  if (!stockeeActivite && config.installation.activite) {
    dire('  Installation : activite « ' + activite + ' » lue dans APP_ACTIVITE.');
  }
  return { langue: langueActive, monnaie: deviseRetenue, activite };
}

export async function seed({ silencieux = false } = {}) {
  const dire = silencieux ? () => {} : (message) => console.log(message);

  const installation = await langueDInstallation(dire);

  let poses = 0;
  for (const [cle, regle] of Object.entries(CATALOGUE)) {
    // La langue et la monnaie prennent la valeur d'installation ; les autres
    // prennent leur defaut, resolu DANS cette langue.
    const style = STYLE_DE_L_ACTIVITE[installation.activite];
    const defaut = cle === 'salon.idioma' ? installation.langue
      : cle === 'salon.moneda' ? installation.monnaie
        : cle === 'marque.activite' ? installation.activite
          : cle === 'marque.palette' ? style.palette
            : cle === 'marque.typographie' ? style.typographie
              : cle === 'marque.angles' ? style.angles
                : cle === 'marque.accueil' ? style.accueil
                  : defautDe(cle);
    const valeur = regle.type === 'booleen' ? (defaut ? 'true' : 'false') : String(defaut ?? '');
    poses += await execute(
      'INSERT INTO reglages (cle, valeur) VALUES ($1, $2) ON CONFLICT (cle) DO NOTHING',
      [cle, valeur],
    );
  }
  invaliderCache();
  dire('  Reglages : ' + poses + ' valeur(s) par defaut posee(s), '
    + (Object.keys(CATALOGUE).length - poses) + ' deja definie(s).');

  // Un salon a toujours au moins un fauteuil. Celui-ci n'est cree que si la
  // table est vide : un gerant qui l'a renomme « Poste vitrine » ne le verra
  // pas revenir a chaque redeploiement.
  const fauteuils = await one('SELECT COUNT(*)::int AS n FROM postes');
  if (fauteuils.n === 0) {
    const nom = t('seed.fauteuil1');
    await execute(
      'INSERT INTO postes (id, nom, nom_lower, ordre) VALUES ($1, $2, $3, 1)',
      [newId(), nom, normalize(nom)],
    );
    dire('  Fauteuils : « ' + nom + ' » cree.');
  } else {
    dire('  Fauteuils : ' + fauteuils.n + ' deja present(s).');
  }

  // Une fiche de prix de depart, pour que la vitrine ne soit jamais vide le
  // premier jour. Le gerant la corrige en deux minutes depuis l'espace de
  // gestion ; les prix ci-dessous sont des ordres de grandeur, pas une verite.
  const tarifs = await one('SELECT COUNT(*)::int AS n FROM tarifas');
  if (tarifs.n === 0) {
    const n = await appliquerCatalogue(installation.activite);
    dire('  Carte : ' + n + ' ligne(s) de depart creee(s) (' + installation.activite + ').');
  } else {
    dire('  Fiche de prix : ' + tarifs.n + ' ligne(s) deja presente(s).');
  }

  // Les textes poses par une installation precedente, dans une autre langue et
  // jamais retouches, passent dans la langue du salon. Voir domain/relibeller.js.
  const relibelles = await relibellerDefauts(installation.langue, { execute });
  if (relibelles) dire('  Textes par defaut : ' + relibelles + ' ligne(s) remise(s) dans la langue du salon.');

  // Les photos deposees a la main avant l'ecran de galerie y entrent d'elles-memes.
  await reprendreLesAnciennes({ journal: dire });

  const compte = await one('SELECT COUNT(*)::int AS n FROM utilisateurs');
  if (compte.n > 0) {
    dire('  Comptes : ' + compte.n + ' deja present(s), rien a creer.');
    return { reglagesPoses: poses, compteCree: false };
  }

  if (!config.bootstrap.password) {
    dire('  Aucun compte et BOOTSTRAP_ADMIN_PASSWORD absent : creez-en un avec « npm run coiffeur ».');
    return { reglagesPoses: poses, compteCree: false };
  }
  if (config.bootstrap.password.length < config.security.passwordMinLength) {
    throw new Error('BOOTSTRAP_ADMIN_PASSWORD est trop court : ' + config.security.passwordMinLength + ' caracteres au minimum.');
  }

  const identifiant = config.bootstrap.username.toLowerCase();
  await execute(
    `INSERT INTO utilisateurs (id, identifiant, identifiant_lower, nom_complet, mot_de_passe_hash, role, doit_changer_mot_de_passe)
     VALUES ($1,$2,$2,$3,$4,'GERANT',TRUE)`,
    [newId(), identifiant, t('seed.gerant'), await hashPassword(config.bootstrap.password)],
  );
  dire('  Compte gerant « ' + identifiant + ' » cree. Il devra changer son mot de passe a la premiere connexion.');
  return { reglagesPoses: poses, compteCree: true };
}
