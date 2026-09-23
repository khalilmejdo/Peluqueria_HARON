/**
 * Les fauteuils du salon.
 *
 * Le salon peut en avoir un, deux ou cinq. Chaque fauteuil sert UN client a la
 * fois ; la file, elle, reste unique et commune. C'est ce qui distingue cette
 * application d'un systeme de rendez-vous : le client prend un tour, pas un
 * fauteuil. Il ne choisit ni son siege ni son coiffeur, et n'a d'ailleurs
 * jamais besoin de savoir combien il y en a — seulement combien de temps il
 * attendra, ce qui, lui, depend du nombre de fauteuils ouverts.
 *
 * Un fauteuil qui a deja servi ne se supprime pas : il se DESACTIVE. Son
 * historique reste attache aux tickets qu'il a servis, et « qui a servi qui »
 * se lit encore un an plus tard.
 */
import { all, one, execute } from '../db/index.js';
import { newId } from '../core/crypto.js';
import { conflict, notFound, badRequest, AppError } from '../core/errors.js';
import { normalize } from '../core/text.js';

const COLONNES = 'id, nom, coiffeur, ordre, actif, created_at, updated_at';

/** Tous les fauteuils, actifs d'abord, dans l'ordre d'affichage. */
export async function lister({ actifsSeulement = false } = {}) {
  return all(
    'SELECT ' + COLONNES + ' FROM postes '
    + (actifsSeulement ? 'WHERE actif ' : '')
    + 'ORDER BY actif DESC, ordre, nom_lower',
  );
}

/** Les fauteuils ouverts, dans l'ordre d'affichage. */
export const listerActifs = () => lister({ actifsSeulement: true });

export async function parId(id) {
  return one('SELECT ' + COLONNES + ' FROM postes WHERE id = $1', [id]);
}

/**
 * Nombre de fauteuils ouverts. Il divise l'attente annoncee au client : deux
 * fauteuils, deux fois moins d'attente pour le meme nombre de personnes.
 * Jamais zero — une division par zero donnerait une estimation absurde.
 */
export async function nombreActifs() {
  const n = await one('SELECT COUNT(*)::int AS n FROM postes WHERE actif');
  return Math.max(1, n?.n ?? 1);
}

export async function creer({ nom, coiffeur = null, ordre = null }) {
  const existe = await one('SELECT id, actif FROM postes WHERE nom_lower = $1', [normalize(nom)]);
  if (existe) {
    throw conflict(existe.actif
      ? 'Un fauteuil porte déjà ce nom.'
      : 'Un fauteuil désactivé porte déjà ce nom. Réactivez-le plutôt que d’en créer un second.');
  }
  const rang = ordre ?? ((await one('SELECT COALESCE(MAX(ordre), 0) + 1 AS suivant FROM postes'))?.suivant ?? 1);
  const id = newId();
  await execute(
    'INSERT INTO postes (id, nom, nom_lower, coiffeur, ordre) VALUES ($1,$2,$3,$4,$5)',
    [id, nom, normalize(nom), coiffeur || null, rang],
  );
  return parId(id);
}

/**
 * Renomme un fauteuil, change son coiffeur, son ordre, ou l'ouvre / le ferme.
 *
 * Fermer un fauteuil occupe est refuse : le client qui y est assis
 * disparaitrait de l'ecran sans que personne sache ou il est passe.
 */
export async function modifier(id, champs) {
  const poste = await parId(id);
  if (!poste) throw notFound('Ce fauteuil n’existe plus.');

  if (champs.nom !== undefined) {
    const autre = await one('SELECT id FROM postes WHERE nom_lower = $1 AND id <> $2', [normalize(champs.nom), id]);
    if (autre) throw conflict('Un autre fauteuil porte déjà ce nom.');
  }

  if (champs.actif === false) {
    const occupe = await one(
      `SELECT numero_affiche, prenom FROM tickets
        WHERE poste_id = $1 AND statut IN ('CALLED', 'IN_SERVICE') LIMIT 1`,
      [id],
    );
    if (occupe) {
      throw conflict(occupe.prenom + ' (' + occupe.numero_affiche + ') est assis à ce fauteuil. '
        + 'Terminez-le, ou marquez-le absent, avant de fermer le fauteuil.');
    }

    // En file par coiffeur, fermer un fauteuil abandonnerait sa file : ces
    // clients ont CHOISI ce coiffeur et n'attendent dans aucune autre file.
    // On refuse plutot que de les deplacer en silence vers quelqu'un d'autre.
    const { lire } = await import('../core/reglages.js');
    if ((await lire('file.mode')) === 'PAR_FAUTEUIL') {
      const attente = await one(
        `SELECT COUNT(*)::int AS n FROM tickets
          WHERE poste_choisi_id = $1 AND statut IN ('WAITING', 'LATE')`,
        [id],
      );
      if ((attente?.n ?? 0) > 0) {
        throw conflict(attente.n + ' client' + (attente.n > 1 ? 's attendent' : ' attend')
          + ' ce coiffeur. Servez-' + (attente.n > 1 ? 'les' : 'le')
          + ', appelez-' + (attente.n > 1 ? 'les' : 'le') + ' depuis un autre fauteuil, ou annulez '
          + (attente.n > 1 ? 'ces tours' : 'ce tour') + ' avant de fermer.');
      }
    }
    const restants = await one('SELECT COUNT(*)::int AS n FROM postes WHERE actif AND id <> $1', [id]);
    if ((restants?.n ?? 0) === 0) {
      throw conflict('C’est le dernier fauteuil ouvert : le salon doit en garder un. Créez-en un autre avant de fermer celui-ci.');
    }
  }

  const colonnes = [];
  const params = [id];
  const poser = (colonne, valeur) => {
    if (valeur === undefined) return;
    params.push(valeur);
    colonnes.push(colonne + ' = $' + params.length);
  };
  poser('nom', champs.nom);
  if (champs.nom !== undefined) poser('nom_lower', normalize(champs.nom));
  poser('coiffeur', champs.coiffeur === '' ? null : champs.coiffeur);
  poser('ordre', champs.ordre);
  poser('actif', champs.actif);
  if (!colonnes.length) throw badRequest('Aucune modification transmise.');

  await execute('UPDATE postes SET ' + colonnes.join(', ') + ' WHERE id = $1', params);
  return parId(id);
}

/**
 * Supprime un fauteuil qui n'a JAMAIS servi. Des qu'il a servi une fois, la
 * suppression est refusee : elle emporterait avec elle le « qui a servi qui »
 * de tous ses tickets. On le desactive a la place.
 */
export async function supprimer(id) {
  const poste = await parId(id);
  if (!poste) throw notFound('Ce fauteuil n’existe plus.');

  const servis = await one('SELECT COUNT(*)::int AS n FROM tickets WHERE poste_id = $1', [id]);
  if ((servis?.n ?? 0) > 0) {
    throw conflict('Ce fauteuil a déjà servi ' + servis.n + ' client' + (servis.n > 1 ? 's' : '')
      + ' : le supprimer effacerait cet historique. Fermez-le plutôt.');
  }
  const restants = await one('SELECT COUNT(*)::int AS n FROM postes WHERE id <> $1', [id]);
  if ((restants?.n ?? 0) === 0) throw conflict('Le salon doit garder au moins un fauteuil.');

  await execute('DELETE FROM postes WHERE id = $1', [id]);
  return true;
}

/**
 * Le fauteuil a utiliser quand le coiffeur n'en designe aucun.
 *
 * Un salon a un seul fauteuil n'a aucune raison de le choisir a chaque appel :
 * s'il n'y en a qu'un, c'est celui-la. S'il y en a plusieurs, on prend le
 * premier qui est libre — et s'ils sont tous occupes, on le dit.
 */
export async function posteLibre(jour, { prefere = null } = {}) {
  if (prefere) {
    const poste = await parId(prefere);
    if (!poste) throw notFound('Ce fauteuil n’existe plus.');
    if (!poste.actif) throw conflict('Le fauteuil « ' + poste.nom + ' » est fermé.');
    return poste;
  }

  const libre = await one(
    `SELECT ` + COLONNES.split(', ').map((c) => 'p.' + c).join(', ') + `
       FROM postes p
      WHERE p.actif
        AND NOT EXISTS (
          SELECT 1 FROM tickets t
           WHERE t.poste_id = p.id AND t.jour = $1 AND t.statut IN ('CALLED', 'IN_SERVICE'))
      ORDER BY p.ordre, p.nom_lower
      LIMIT 1`,
    [jour],
  );
  if (!libre) {
    // Dire QUI occupe les fauteuils : c'est exactement ce que le coiffeur a
    // besoin de savoir pour decider. « Tous les fauteuils sont occupés » tout
    // court l'obligerait a aller regarder ailleurs.
    const assis = await all(
      `SELECT t.numero_affiche, t.prenom, p.nom
         FROM tickets t JOIN postes p ON p.id = t.poste_id
        WHERE t.jour = $1 AND t.statut IN ('CALLED', 'IN_SERVICE')
        ORDER BY p.ordre, p.nom_lower`,
      [jour],
    );
    const suite = ' Terminez un client, ou marquez-le absent, avant d’appeler le suivant.';

    if (assis.length === 1) {
      throw new AppError(409,
        assis[0].prenom + ' (' + assis[0].numero_affiche + ') est déjà au fauteuil.' + suite,
        { code: 'FAUTEUIL_OCCUPE' });
    }
    const detail = assis.map((a) => a.prenom + ' (' + a.numero_affiche + ') au ' + a.nom).join(', ');
    throw new AppError(409,
      'Tous les fauteuils sont occupés' + (detail ? ' : ' + detail + '.' : '.') + suite,
      { code: 'FAUTEUILS_OCCUPES' });
  }
  return libre;
}

/** Mise en forme pour l'API. */
export const versClient = (p) => ({
  id: p.id,
  nom: p.nom,
  coiffeur: p.coiffeur,
  ordre: p.ordre,
  actif: p.actif,
});
