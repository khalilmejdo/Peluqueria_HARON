/**
 * LES CARTES DE DEPART, UNE PAR ACTIVITE.
 *
 * Un salon qui ouvre son espace la premiere fois doit trouver une carte
 * credible, pas une page vide : le gerant la corrige ensuite en quelques
 * minutes (prix, durees, lignes en trop). Ce sont des ORDRES DE GRANDEUR, pas
 * une verite — chaque salon fixe ses prix.
 *
 * Chaque ligne : [cle du nom, cle du chapitre, prix {EUR, MAD} en centimes,
 * icone, duree en minutes, options]. Les noms et chapitres sont des CLES du
 * dictionnaire (« seed.tarif.* », « seed.cat.* ») : ecrites dans la langue du
 * salon, et relibellees si la langue change tant que personne ne les a
 * retouchees (voir domain/relibeller.js).
 *
 * BARBERIA reprend EXACTEMENT les quinze lignes historiques du seed, dans le
 * meme ordre et avec les memes cles : une base installee avant les
 * catalogues reste reconnue ligne pour ligne.
 */
import { execute, all } from '../db/index.js';
import { newId } from '../core/crypto.js';
import { normalize } from '../core/text.js';
import { t } from '../core/langue.js';
import { deviseActive, DEVISE_DEFAUT } from '../core/devise.js';

const desde = { desde: true };
const surDemande = { reservable: false };

export const CATALOGUES = {
  BARBERIA: [
    ['seed.tarif.coupe', 'seed.cat.coupes', { EUR: 700, MAD: 4000 }, 'tijeras', 15],
    ['seed.tarif.barbe', 'seed.cat.barbe', { EUR: 500, MAD: 2000 }, 'barba', 15],
    ['seed.tarif.coupeBarbe', 'seed.cat.coupes', { EUR: 1200, MAD: 5500 }, 'navaja', 25, { nota: 'seed.tarif.leplusdemande' }],
    ['seed.tarif.masque', 'seed.cat.soins', { EUR: 300, MAD: 2000 }, 'mascarilla', 3],
    ['seed.tarif.dark', 'seed.cat.soins', { EUR: 800, MAD: 5000 }, 'bote', 10],
    ['seed.tarif.keratine', 'seed.cat.soins', { EUR: 4000, MAD: 30000 }, 'gota', 30, desde],
    ['seed.tarif.meches', 'seed.cat.couleur', { EUR: 2000, MAD: 15000 }, 'mechas', 25, desde],
    ['seed.tarif.mechesBlanches', 'seed.cat.couleur', { EUR: 4000, MAD: 30000 }, 'mechas', 25, desde],
    ['seed.tarif.coiffage', 'seed.cat.coupes', { EUR: 300, MAD: 3000 }, 'peine', 5],
    ['seed.tarif.sourcils', 'seed.cat.soins', { EUR: 300, MAD: 2000 }, 'cejas', 5],
    ['seed.tarif.sourcilsCire', 'seed.cat.soins', { EUR: 300, MAD: 2500 }, 'cera', 5],
    ['seed.tarif.teinture', 'seed.cat.couleur', { EUR: 500, MAD: 5000 }, 'tinte', 5],
    ['seed.tarif.coloration', 'seed.cat.couleur', { EUR: 1000, MAD: 10000 }, 'tinte', 5],
    ['seed.tarif.teintureBarbe', 'seed.cat.barbe', { EUR: 300, MAD: 2500 }, 'barba', 5],
    ['seed.tarif.shampoing', 'seed.cat.soins', { EUR: 200, MAD: 1500 }, 'lavado', 1],
  ],

  PELUQUERIA: [
    ['seed.tarif.f.coupeBrushing', 'seed.cat.coupes', { EUR: 4200, MAD: 25000 }, 'tijeras', 60],
    ['seed.tarif.f.coupe', 'seed.cat.coupes', { EUR: 3200, MAD: 18000 }, 'tijeras', 45],
    ['seed.tarif.f.brushing', 'seed.cat.coiffage', { EUR: 2600, MAD: 15000 }, 'secador', 40, desde],
    ['seed.tarif.f.lisse', 'seed.cat.coiffage', { EUR: 3000, MAD: 18000 }, 'plancha', 45, desde],
    ['seed.tarif.f.boucles', 'seed.cat.coiffage', { EUR: 3200, MAD: 20000 }, 'ondas', 45, desde],
    ['seed.tarif.f.chignon', 'seed.cat.coiffage', { EUR: 5500, MAD: 35000 }, 'recogido', 60, desde],
    ['seed.tarif.f.couleur', 'seed.cat.couleur', { EUR: 4800, MAD: 30000 }, 'tinte', 75, desde],
    ['seed.tarif.f.balayage', 'seed.cat.couleur', { EUR: 9500, MAD: 60000 }, 'mechas', 150, desde],
    ['seed.tarif.f.gloss', 'seed.cat.couleur', { EUR: 3500, MAD: 22000 }, 'gota', 30],
    ['seed.tarif.f.soinProfond', 'seed.cat.soins', { EUR: 3500, MAD: 22000 }, 'mascarilla', 30],
    ['seed.tarif.keratine', 'seed.cat.soins', { EUR: 15000, MAD: 90000 }, 'gota', 150, { ...desde, ...surDemande }],
    ['seed.tarif.f.mariee', 'seed.cat.evenements', { EUR: 18000, MAD: 120000 }, 'diadema', 120, { ...desde, ...surDemande }],
  ],

  UNISEX: [
    ['seed.tarif.f.coupeBrushing', 'seed.cat.femme', { EUR: 4200, MAD: 25000 }, 'tijeras', 60],
    ['seed.tarif.f.brushing', 'seed.cat.femme', { EUR: 2600, MAD: 15000 }, 'secador', 40, desde],
    ['seed.tarif.f.couleur', 'seed.cat.femme', { EUR: 4800, MAD: 30000 }, 'tinte', 75, desde],
    ['seed.tarif.f.balayage', 'seed.cat.femme', { EUR: 9500, MAD: 60000 }, 'mechas', 150, desde],
    ['seed.tarif.h.coupe', 'seed.cat.homme', { EUR: 2400, MAD: 12000 }, 'tijeras', 30],
    ['seed.tarif.coupeBarbe', 'seed.cat.homme', { EUR: 3400, MAD: 18000 }, 'navaja', 45],
    ['seed.tarif.h.barbe', 'seed.cat.homme', { EUR: 1600, MAD: 8000 }, 'barba', 20],
    ['seed.tarif.h.enfant', 'seed.cat.enfant', { EUR: 1600, MAD: 8000 }, 'nino', 25],
    ['seed.tarif.f.soinProfond', 'seed.cat.soins', { EUR: 3500, MAD: 22000 }, 'mascarilla', 30],
    ['seed.tarif.keratine', 'seed.cat.soins', { EUR: 15000, MAD: 90000 }, 'gota', 150, { ...desde, ...surDemande }],
  ],

  ESTETICA: [
    ['seed.tarif.e.soinVisage', 'seed.cat.visage', { EUR: 6500, MAD: 40000 }, 'hoja', 60],
    ['seed.tarif.e.soinEclat', 'seed.cat.visage', { EUR: 4500, MAD: 28000 }, 'destello', 45],
    ['seed.tarif.e.sourcils', 'seed.cat.regard', { EUR: 1800, MAD: 10000 }, 'cejas', 20],
    ['seed.tarif.e.rehausse', 'seed.cat.regard', { EUR: 5500, MAD: 35000 }, 'pestanas', 60],
    ['seed.tarif.e.manucure', 'seed.cat.mains', { EUR: 3000, MAD: 18000 }, 'esmalte', 45],
    ['seed.tarif.e.semiPermanent', 'seed.cat.mains', { EUR: 4000, MAD: 25000 }, 'esmalte', 60],
    ['seed.tarif.e.pedicure', 'seed.cat.mains', { EUR: 4500, MAD: 28000 }, 'esmalte', 60],
    ['seed.tarif.e.epilJambes', 'seed.cat.epilation', { EUR: 3200, MAD: 18000 }, 'cera', 40, desde],
    ['seed.tarif.e.massage', 'seed.cat.corps', { EUR: 7000, MAD: 45000 }, 'hoja', 60],
    ['seed.tarif.e.maquillage', 'seed.cat.evenements', { EUR: 6000, MAD: 40000 }, 'labial', 60, { ...desde, ...surDemande }],
  ],

  ONGLES: [
    ['seed.tarif.o.manucureExpress', 'seed.cat.mainsSeules', { EUR: 1800, MAD: 10000 }, 'esmalte', 25],
    ['seed.tarif.e.manucure', 'seed.cat.mainsSeules', { EUR: 3000, MAD: 18000 }, 'esmalte', 45],
    ['seed.tarif.e.semiPermanent', 'seed.cat.mainsSeules', { EUR: 3500, MAD: 22000 }, 'esmalte', 50],
    ['seed.tarif.o.deposeSemi', 'seed.cat.mainsSeules', { EUR: 1000, MAD: 6000 }, 'gota', 20],
    ['seed.tarif.o.poseGel', 'seed.cat.gel', { EUR: 5500, MAD: 35000 }, 'destello', 90],
    ['seed.tarif.o.remplissage', 'seed.cat.gel', { EUR: 4000, MAD: 25000 }, 'destello', 60],
    ['seed.tarif.o.nailArt', 'seed.cat.gel', { EUR: 500, MAD: 3000 }, 'diadema', 15, desde],
    ['seed.tarif.o.babyboomer', 'seed.cat.gel', { EUR: 6000, MAD: 38000 }, 'destello', 90],
    ['seed.tarif.e.pedicure', 'seed.cat.pieds', { EUR: 4000, MAD: 25000 }, 'hoja', 50],
    ['seed.tarif.o.pedicureSemi', 'seed.cat.pieds', { EUR: 4800, MAD: 30000 }, 'hoja', 60],
    ['seed.tarif.o.duo', 'seed.cat.pieds', { EUR: 7500, MAD: 48000 }, 'labial', 100, { nota: 'seed.tarif.leplusdemande' }],
  ],
};

/** Les lignes d'une carte, ecrites dans la langue et la monnaie du salon. */
export function lignesDuCatalogue(activite) {
  const source = CATALOGUES[activite] || CATALOGUES.BARBERIA;
  const devise = deviseActive();
  return source.map(([cleNom, cleChapitre, prix, icono, duree, o = {}]) => ({
    nombre: t(cleNom),
    categoria: t(cleChapitre),
    precioCts: prix[devise] ?? prix[DEVISE_DEFAUT],
    nota: o.nota ? t(o.nota) : null,
    icono,
    duracion: duree,
    precioDesde: Boolean(o.desde),
    reservable: o.reservable !== false,
  }));
}

/**
 * Ajoute a la carte les lignes de l'activite qui n'y sont pas encore.
 *
 * JAMAIS DESTRUCTIF : une ligne du meme nom (sans tenir compte des accents ni
 * de la casse) est laissee telle quelle, avec SON prix. On peut donc appliquer
 * la carte de l'activite sur une carte deja travaillee sans rien perdre.
 *
 * @returns {Promise<number>} le nombre de lignes ajoutees
 */
export async function appliquerCatalogue(activite, { exec = execute, lire = all } = {}) {
  const deja = new Set((await lire('SELECT nombre_lower FROM tarifas')).map((l) => l.nombre_lower));
  const ordre = Number((await lire('SELECT COALESCE(MAX(ordre), -1) + 1 AS o FROM tarifas'))[0]?.o ?? 0);
  let ajoutees = 0;
  for (const l of lignesDuCatalogue(activite)) {
    const cle = normalize(l.nombre);
    if (deja.has(cle)) continue;
    await exec(
      `INSERT INTO tarifas (id, nombre, nombre_lower, precio_cts, nota, icono, duracion_min, categoria, precio_desde, reservable, ordre)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [newId(), l.nombre, cle, l.precioCts, l.nota, l.icono, l.duracion, l.categoria, l.precioDesde, l.reservable, ordre + ajoutees],
    );
    deja.add(cle);
    ajoutees += 1;
  }
  return ajoutees;
}
