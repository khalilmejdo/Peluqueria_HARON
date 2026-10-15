#!/usr/bin/env node
/**
 * REMPLIR UN SALON DE DEMONSTRATION : horaires, contact, adresse, equipe,
 * presentation et illustrations — pour montrer la vitrine a un prospect.
 *
 *   docker compose -f docker-compose.oci.yml -f docker-compose.local.yml exec app node scripts/vitrine-demo.js --ville=oujda
 *
 * TOUT EST FICTIF et doit etre remplace avant d'ouvrir le salon au public : le
 * telephone n'appartient a personne de connu, l'adresse est une grande avenue
 * de la ville, les images sont des DESSINS legendes « Illustration ».
 *
 * Il n'ecrit AUCUN avis client : des avis inventes presentes comme vrais
 * tromperaient les visiteurs. Les avis viennent des vraies clientes.
 *
 * GARDE-FOU : il refuse de tourner sur un salon qui a deja servi (des tickets
 * ou des rendez-vous en base) — il ecraserait les horaires et le contact d'un
 * vrai salon. --forcer passe outre, en connaissance de cause.
 */
import { assertConfig } from '../server/core/config.js';
import { one, all, execute, closePool } from '../server/db/index.js';
import { enregistrer, invaliderCache } from '../server/core/reglages.js';
import { ajouter as ajouterPhoto } from '../server/domain/photos.js';
import { serieOngles, serieBarbier } from './images-demo.js';

assertConfig();

const VILLES = {
  oujda: {
    adresse: 'Boulevard Mohammed V, 60000 Oujda',
    coordonnees: '34.6814,-1.9086',
    commentVenir: 'En plein centre, à deux pas de la place du 16 Août. Stationnement dans les rues voisines.',
    telephone: '+212 600 000 000',
  },
};

// 0 = dimanche. Lundi ferme, journee continue du mardi au samedi, dimanche matin.
const HORAIRES = {
  0: ['10:00', '14:00', '', ''],
  1: ['', '', '', ''],
  2: ['10:00', '20:00', '', ''],
  3: ['10:00', '20:00', '', ''],
  4: ['10:00', '20:00', '', ''],
  5: ['10:00', '20:00', '13:00', '15:00'],
  6: ['10:00', '20:00', '', ''],
};

const EQUIPES = { BARBERIA: ['Youssef', 'Karim', 'Mehdi'], DEFAUT: ['Salma', 'Nadia', 'Yasmine'] };

const PRESENTATION_BARBIER = 'Un barbier à l’ancienne : serviette chaude, rasoir droit et le temps qu’il faut pour une coupe nette.\n\n'
  +'Coupe, dégradé, taille de barbe et soins : chaque passage commence par un vrai conseil sur ce qui vous va.';

const PRESENTATION = 'Un bar à ongles pensé comme un salon privé : lumière douce, fauteuils confortables et une seule cliente par styliste.\n\n'
  + 'Manucure, semi-permanent, gel et nail art : chaque rendez-vous commence par un vrai conseil sur la forme et la couleur qui vous ressemblent.';

function argument(nom, defaut = null) {
  const a = process.argv.find((x) => x.startsWith('--' + nom + '='));
  return a ? a.slice(nom.length + 3) : defaut;
}

async function main() {
  const activite = (await one("SELECT valeur FROM reglages WHERE cle = 'marque.activite'"))?.valeur;
  const barbier = activite === 'BARBERIA';
  const EQUIPE = barbier ? EQUIPES.BARBERIA : EQUIPES.DEFAUT;
  const ville = VILLES[String(argument('ville', 'oujda')).toLowerCase()];
  if (!ville) throw new Error('--ville : ' + Object.keys(VILLES).join(', '));

  const servi = await one(`SELECT (SELECT COUNT(*) FROM tickets)::int + (SELECT COUNT(*) FROM rendez_vous)::int AS n`);
  if (servi.n > 0 && !process.argv.includes('--forcer')) {
    console.error('\n  Ce salon a deja ' + servi.n + ' ticket(s) ou rendez-vous : ce n\'est pas un salon de demonstration.\n'
      + '  Je n\'ecrase pas ses horaires ni son contact. (--forcer pour passer outre.)\n');
    process.exitCode = 1;
    return;
  }

  // 1. Les reglages : horaires, contact, adresse, rendez-vous ET file.
  const valeurs = {
    'salon.adresse': ville.adresse,
    'salon.coordenadas': ville.coordonnees,
    'salon.comoLlegar': ville.commentVenir,
    'salon.telephone': ville.telephone,
    'salon.whatsapp': ville.telephone,
    'salon.presentation': barbier ? PRESENTATION_BARBIER : PRESENTATION,
    'horaires.actifs': true,
    'rdv.actifs': true,
    'accueil.file': true,
    'vitrine.equipe': true,
    'vitrine.galerie': true,
    'vitrine.localisation': true,
    'vitrine.contact': true,
  };
  for (const [jour, [ouverture, fermeture, pauseDebut, pauseFin]] of Object.entries(HORAIRES)) {
    Object.assign(valeurs, {
      ['horaires.' + jour + '.ouverture']: ouverture,
      ['horaires.' + jour + '.fermeture']: fermeture,
      ['horaires.' + jour + '.pauseDebut']: pauseDebut,
      ['horaires.' + jour + '.pauseFin']: pauseFin,
    });
  }
  await enregistrer(valeurs);
  invaliderCache();
  console.log('  Horaires, contact et adresse poses (' + ville.adresse + ').');

  // 2. L'equipe : un nom par fauteuil, et des fauteuils s'il en manque.
  const postes = await all('SELECT id FROM postes WHERE actif ORDER BY ordre, nom_lower');
  for (let i = 0; i < EQUIPE.length; i += 1) {
    if (postes[i]) {
      await execute('UPDATE postes SET coiffeur = $2 WHERE id = $1', [postes[i].id, EQUIPE[i]]);
    } else {
      const nom = 'Poste ' + (i + 1);
      await execute(
        `INSERT INTO postes (id, nom, nom_lower, coiffeur, ordre)
         VALUES (gen_random_uuid(), $1, lower($1), $2, (SELECT COALESCE(MAX(ordre), 0) + 1 FROM postes))
         ON CONFLICT DO NOTHING`,
        [nom, EQUIPE[i]],
      );
    }
  }
  console.log('  Equipe : ' + EQUIPE.join(', ') + '.');

  // 3. Les illustrations, seulement si la galerie est vide.
  const deja = await one("SELECT COUNT(*)::int AS n FROM photos WHERE usage = 'GALERIE'");
  if (deja.n > 0) {
    console.log('  Galerie : ' + deja.n + ' photo(s) deja en place, je n\'en ajoute pas.');
  } else {
    for (const p of (barbier ? serieBarbier() : serieOngles())) {
      await ajouterPhoto({ contenu: p.image(), legende: p.legende });
      console.log('  Image : ' + p.legende);
    }
  }

  console.log('\n  Salon de demonstration pret. TOUT EST FICTIF : a remplacer dans Reglages et Galerie avant l\'ouverture au public.\n');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => closePool());
