/**
 * LES TEXTES PAR DEFAUT SUIVENT LA LANGUE ; CEUX DU GERANT, JAMAIS.
 *
 * Le seed ecrit du texte en base : le nom du premier fauteuil, celui du compte
 * gerant, les quinze prestations de depart, l'accroche de la page d'accueil. Ce
 * texte est ecrit UNE fois, dans la langue du moment. Changer la langue ensuite
 * laissait donc « Fauteuil 1 » sur un ecran espagnol, et l'accroche de la toute
 * premiere version — « Prenez votre tour, sans attendre. » — en tete d'une
 * vitrine espagnole. C'est exactement ce que Khalil voyait.
 *
 * LA REGLE : un texte encore IDENTIQUE a une valeur par defaut connue, dans
 * n'importe quelle langue, est reecrit dans la langue du salon. Un texte que le
 * gerant a retouche, meme d'une lettre, n'est plus reconnu et ne bouge plus.
 * C'est la seule frontiere qu'on puisse tracer sans lui demander : ce qu'il a
 * ecrit lui appartient, ce que le logiciel a ecrit appartient au logiciel.
 *
 * Joue a chaque demarrage (depuis le seed) et a chaque changement de langue.
 * Idempotent : une seconde passe ne trouve plus rien a changer.
 */
import { TEXTES } from '../core/textes.js';
import { CODES_LANGUES } from '../core/langue.js';
import { normalize } from '../core/text.js';

/**
 * Les valeurs d'avant le dictionnaire, qu'on retrouve encore en base.
 *
 * La premiere version etait en francais et posait cette accroche ; aucune cle
 * ne la porte plus, mais un salon installe a cette epoque l'a toujours.
 */
const ACCROCHES_HISTORIQUES = ['Prenez votre tour, sans attendre.'];

/** Toutes les ecritures d'une cle, dans toutes les langues. */
const ecritures = (cle) => CODES_LANGUES.map((code) => TEXTES[cle]?.[code]).filter(Boolean);

/** Les cles des prestations de depart (noms et note). */
const CLES_TARIFS = Object.keys(TEXTES).filter((cle) => cle.startsWith('seed.tarif.'));

/**
 * @param {string} langue  la langue du salon
 * @param {{ execute: Function }} db  la base, ou une transaction
 * @returns {Promise<number>} le nombre de lignes reecrites
 */
export async function relibellerDefauts(langue, db) {
  let n = 0;

  // Une prestation a la fois : l'index unique sur le nom normalise refuserait
  // la reecriture si le gerant a DEJA cree la meme prestation dans l'autre
  // langue. Dans ce cas on laisse la ligne telle quelle plutot que d'echouer.
  for (const cle of CLES_TARIFS) {
    const cible = TEXTES[cle][langue];
    for (const ancien of ecritures(cle)) {
      if (ancien === cible) continue;
      try {
        n += await db.execute(
          'UPDATE tarifas SET nombre = $2, nombre_lower = $3 WHERE nombre = $1',
          [ancien, cible, normalize(cible)],
        );
      } catch (err) {
        if (err?.code !== '23505') throw err;
      }
      n += await db.execute('UPDATE tarifas SET nota = $2 WHERE nota = $1', [ancien, cible]);
    }
  }

  const fauteuil = TEXTES['seed.fauteuil1'][langue];
  for (const ancien of ecritures('seed.fauteuil1')) {
    if (ancien === fauteuil) continue;
    try {
      n += await db.execute('UPDATE postes SET nom = $2, nom_lower = $3 WHERE nom = $1', [ancien, fauteuil, normalize(fauteuil)]);
    } catch (err) {
      if (err?.code !== '23505') throw err;
    }
  }

  const gerant = TEXTES['seed.gerant'][langue];
  for (const ancien of ecritures('seed.gerant')) {
    if (ancien !== gerant) n += await db.execute('UPDATE utilisateurs SET nom_complet = $2 WHERE nom_complet = $1', [ancien, gerant]);
  }

  const accroche = TEXTES['reglage.salon.accroche.defaut'][langue];
  for (const ancien of [...ecritures('reglage.salon.accroche.defaut'), ...ACCROCHES_HISTORIQUES]) {
    if (ancien !== accroche) {
      n += await db.execute("UPDATE reglages SET valeur = $2 WHERE cle = 'salon.accroche' AND valeur = $1", [ancien, accroche]);
    }
  }

  return n;
}

export const _ACCROCHES_HISTORIQUES = ACCROCHES_HISTORIQUES;
