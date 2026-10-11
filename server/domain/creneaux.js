/**
 * LES CRENEAUX LIBRES — calcul pur, sans base ni horloge.
 *
 * Tout ce qu'il faut est passe en argument : les plages d'ouverture du jour,
 * les fauteuils qui prennent des rendez-vous, les rendez-vous deja poses, la
 * duree demandee, le pas, le tampon, et l'instant a partir duquel on peut
 * reserver. C'est ce qui le rend testable ligne a ligne, y compris les cas
 * qui ne se produisent qu'au changement d'heure.
 *
 * LE RAISONNEMENT SE FAIT EN MINUTES LOCALES. « 9:30 » est 570, quelle que
 * soit la saison ; l'instant reel n'est calcule qu'a la fin, par `instantDe`
 * (le fuseau du salon). Un salon ouvert de 9:30 a 20:00 propose donc les
 * memes heures le jour du passage a l'heure d'ete qu'un autre jour.
 */

/** « 09:05 » depuis 545. */
export const enHeure = (minutes) => String(Math.floor(minutes / 60)).padStart(2, '0') + ':' + String(minutes % 60).padStart(2, '0');

/** 545 depuis « 09:05 », ou NaN. */
export function enMinutes(heure) {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(heure || ''));
  return m ? Number(m[1]) * 60 + Number(m[2]) : Number.NaN;
}

/**
 * Les heures proposees pour UNE journee.
 *
 * Un creneau est propose si, sur AU MOINS UN fauteuil candidat :
 *   - il tient entierement dans une plage d'ouverture (pas a cheval sur la
 *     coupure de midi, pas au-dela de la fermeture) ;
 *   - il ne chevauche aucun rendez-vous de ce fauteuil, tampon compris ;
 *   - il commence apres `auPlusTot`.
 *
 * @param {object} p
 * @param {Array<{ouverture:string, fermeture:string}>} p.plages
 * @param {Array<{id:string}>} p.postes      fauteuils candidats
 * @param {Array<{posteId:string, debut:number, fin:number}>} p.occupes  en minutes locales
 * @param {number} p.duree                   minutes
 * @param {number} p.pas                     minutes entre deux heures proposees
 * @param {number} [p.tampon]                minutes laissees libres autour d'un rendez-vous
 * @param {number} [p.auPlusTotMinutes]      minute locale avant laquelle rien n'est propose
 * @returns {Array<{ heure:string, minutes:number, postes:string[] }>}
 */
export function creneauxDuJour({
  plages, postes, occupes = [], duree, pas, tampon = 0, auPlusTotMinutes = -Infinity,
}) {
  if (!postes.length || !(duree > 0) || !(pas > 0)) return [];
  const sortie = [];
  for (const plage of plages) {
    const debut = enMinutes(plage.ouverture);
    const fin = enMinutes(plage.fermeture);
    if (!Number.isFinite(debut) || !Number.isFinite(fin) || fin <= debut) continue;
    for (let m = debut; m + duree <= fin; m += pas) {
      if (m < auPlusTotMinutes) continue;
      const libres = postes
        .filter((p) => !occupes.some((o) => o.posteId === p.id
          && m < o.fin + tampon && o.debut - tampon < m + duree))
        .map((p) => p.id);
      if (libres.length) sortie.push({ heure: enHeure(m), minutes: m, postes: libres });
    }
  }
  return sortie;
}

/**
 * Le fauteuil a donner a un client « sans preference » : celui qui a le
 * MOINS de rendez-vous ce jour-la (on repartit la charge), puis l'ordre du
 * salon. Le premier fauteuil ne doit pas porter toute la journee.
 */
export function fauteuilLeMoinsCharge(candidats, occupes, ordre = []) {
  const charge = (id) => occupes.filter((o) => o.posteId === id).length;
  const rang = (id) => {
    const i = ordre.indexOf(id);
    return i < 0 ? Number.MAX_SAFE_INTEGER : i;
  };
  return [...candidats].sort((a, b) => charge(a) - charge(b) || rang(a) - rang(b))[0] ?? null;
}

/** Les heures regroupees pour l'affichage : matin, apres-midi, soir. */
export function parMoment(creneaux) {
  const groupes = { matin: [], apresMidi: [], soir: [] };
  for (const c of creneaux) {
    if (c.minutes < 12 * 60) groupes.matin.push(c);
    else if (c.minutes < 18 * 60) groupes.apresMidi.push(c);
    else groupes.soir.push(c);
  }
  return groupes;
}
