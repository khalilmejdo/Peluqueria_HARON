#!/usr/bin/env node
/**
 * COPIER LA VITRINE D'UN SALON VERS UN AUTRE : son style, ses photos, sa carte,
 * ses horaires et ses textes — pour monter une demonstration qui ressemble
 * VRAIMENT a un salon en service.
 *
 *   Sur le salon modele :   node scripts/copier-vitrine.js exporter
 *     ecrit vitrine-export.json dans son dossier de photos
 *   Sur le salon cible :    node scripts/copier-vitrine.js importer [--forcer]
 *     lit vitrine-export.json dans SON dossier de photos
 *
 * (En conteneur : docker compose ... exec app node scripts/copier-vitrine.js ...
 *  et le fichier passe d'un dossier photos a l'autre sur la machine.)
 *
 * CE QUI NE SE COPIE JAMAIS :
 *   - les clients, les tours, les rendez-vous, les avis, les cartes de fidelite :
 *     ce sont de vraies personnes, elles n'ont rien a faire dans une demo ;
 *   - les comptes du personnel ;
 *   - L'IDENTITE du salon : nom, telephone, WhatsApp, adresse, coordonnees,
 *     Instagram, adresse publique, cle de l'ecran. Une copie qui porterait le
 *     telephone et l'adresse du vrai salon ferait reserver ses clients sur un
 *     site qui ne les attend pas. La cible garde les siens.
 *
 * L'import REMPLACE la carte et les photos de la cible. Il refuse une cible qui
 * a deja servi des clients (--forcer pour passer outre, en connaissance de cause).
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { assertConfig, config } from '../server/core/config.js';
import { all, one, execute, closePool } from '../server/db/index.js';
import { enregistrer, invaliderCache, CATALOGUE } from '../server/core/reglages.js';
import { ajouter, supprimer, poserLogo, retirerLogo, modifier, cheminPhoto } from '../server/domain/photos.js';
import { newId } from '../server/core/crypto.js';
import { normalize } from '../server/core/text.js';

assertConfig();

const FICHIER = () => path.join(config.storage.photosDir, 'vitrine-export.json');

/** L'identite du salon : jamais copiee. */
const IDENTITE = new Set([
  'salon.nom', 'salon.telephone', 'salon.whatsapp', 'salon.adresse', 'salon.coordenadas', 'salon.comoLlegar',
  'salon.instagram', 'public.url', 'pantalla.clave', 'marque.monogramme',
]);

async function exporter() {
  const reglages = Object.fromEntries((await all('SELECT cle, valeur FROM reglages')).map((r) => [r.cle, r.valeur]));
  const tarifas = await all(
    `SELECT nombre, precio_cts, nota, icono, duracion_min, categoria, precio_desde, reservable, ordre, visible
       FROM tarifas ORDER BY ordre, nombre_lower`,
  );
  const postes = await all('SELECT nom, coiffeur, actif, ordre FROM postes ORDER BY ordre, nom_lower');
  const photos = [];
  for (const p of await all("SELECT fichier, legende, visible, couverture, usage FROM photos ORDER BY usage, ordre")) {
    try {
      const contenu = await fs.readFile(cheminPhoto(p.fichier));
      photos.push({ ...p, contenu: contenu.toString('base64') });
    } catch {
      console.error('  photo introuvable sur le disque, ignoree : ' + p.fichier);
    }
  }
  const sortie = { version: 1, reglages, tarifas, postes, photos };
  await fs.writeFile(FICHIER(), JSON.stringify(sortie), { mode: 0o600 });
  console.error('  Exporte : ' + Object.keys(reglages).length + ' reglages, ' + tarifas.length + ' prestations, '
    + postes.length + ' fauteuils, ' + photos.length + ' photos -> ' + FICHIER());
}

async function importer() {
  const servi = await one('SELECT (SELECT COUNT(*) FROM tickets)::int + (SELECT COUNT(*) FROM rendez_vous)::int AS n');
  if (servi.n > 0 && !process.argv.includes('--forcer')) {
    console.error('\n  Ce salon a deja ' + servi.n + ' ticket(s) ou rendez-vous : je ne remplace pas sa vitrine.'
      + ' (--forcer pour passer outre.)\n');
    process.exitCode = 1;
    return;
  }
  const donnees = JSON.parse(await fs.readFile(FICHIER(), 'utf8'));

  // 1. Les reglages, sauf l'identite. Un par un : une valeur refusee (un
  //    reglage disparu entre deux versions) n'empeche pas les autres.
  //    Les horaires partent ENSEMBLE : une coupure se valide avec l'ouverture
  //    et la fermeture de son jour, jamais seule.
  let poses = 0;
  const valeurDe = (cle, valeur) => (CATALOGUE[cle].type === 'booleen' ? valeur === 'true' : valeur);
  const copiables = Object.entries(donnees.reglages).filter(([cle]) => !IDENTITE.has(cle) && Object.hasOwn(CATALOGUE, cle));
  const horaires = Object.fromEntries(copiables.filter(([cle]) => cle.startsWith('horaires.')).map(([cle, v]) => [cle, valeurDe(cle, v)]));
  try {
    await enregistrer(horaires);
    poses += Object.keys(horaires).length;
  } catch {
    console.error('  horaires ignores (refuses par la validation)');
  }
  for (const [cle, valeur] of copiables.filter(([c]) => !c.startsWith('horaires.'))) {
    try {
      await enregistrer({ [cle]: valeurDe(cle, valeur) });
      poses += 1;
    } catch {
      console.error('  reglage ignore : ' + cle);
    }
  }
  invaliderCache();

  // 2. La carte : remplacee entierement, dans l'ordre du modele.
  await execute('DELETE FROM tarifas');
  for (const [i, t] of donnees.tarifas.entries()) {
    await execute(
      `INSERT INTO tarifas (id, nombre, nombre_lower, precio_cts, nota, icono, duracion_min, categoria, precio_desde, reservable, ordre, visible)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [newId(), t.nombre, normalize(t.nombre), t.precio_cts, t.nota, t.icono, t.duracion_min, t.categoria, t.precio_desde, t.reservable, i, t.visible],
    );
  }

  // 3. Les fauteuils : les noms et les professionnels du modele.
  const existants = await all('SELECT id FROM postes ORDER BY ordre, nom_lower');
  // Deux temps : des noms provisoires d'abord, sinon renommer le fauteuil 1 en
  // « Fauteuil 2 » se heurte au fauteuil 2 qui porte encore ce nom.
  for (const e of existants) await execute("UPDATE postes SET nom = 'provisoire ' || id, nom_lower = 'provisoire ' || id WHERE id = $1", [e.id]);
  for (const [i, p] of donnees.postes.entries()) {
    if (existants[i]) {
      await execute('UPDATE postes SET nom = $2, nom_lower = lower($2), coiffeur = $3, actif = $4, ordre = $5 WHERE id = $1', [existants[i].id, p.nom, p.coiffeur, p.actif, i]);
    } else {
      await execute(
        "INSERT INTO postes (id, nom, nom_lower, coiffeur, actif, ordre) VALUES (gen_random_uuid(), $1, lower($1), $2, $3, $4) ON CONFLICT DO NOTHING",
        [p.nom, p.coiffeur, p.actif, i],
      );
    }
  }

  // 4. Les photos : celles de la cible partent, celles du modele arrivent, dans
  //    le meme ordre, avec leur legende, leur visibilite et la couverture.
  for (const p of await all("SELECT id FROM photos WHERE usage = 'GALERIE'")) await supprimer(p.id);
  await retirerLogo().catch(() => {});
  let nPhotos = 0;
  for (const p of donnees.photos) {
    const contenu = Buffer.from(p.contenu, 'base64');
    if (p.usage === 'LOGO') {
      await poserLogo(contenu);
      continue;
    }
    const cree = await ajouter({ contenu, legende: p.legende || '' });
    await modifier(cree.id, { visible: p.visible, couverture: p.couverture });
    nPhotos += 1;
  }

  await fs.unlink(FICHIER()).catch(() => {});
  console.error('  Importe : ' + poses + ' reglages, ' + donnees.tarifas.length + ' prestations, '
    + donnees.postes.length + ' fauteuils, ' + nPhotos + ' photos. Nom, telephone et adresse : ceux de ce salon.');
}

const action = process.argv[2];
(action === 'exporter' ? exporter() : action === 'importer' ? importer() : Promise.reject(new Error('exporter ou importer ?')))
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => closePool());
