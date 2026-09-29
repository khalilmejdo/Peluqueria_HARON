/**
 * Les deux roles du salon.
 *
 * Volontairement minimal : un salon de quartier n'a pas besoin d'une matrice de
 * permissions. Le COIFFEUR tient la file ; le GERANT fait tout ce que fait le
 * coiffeur, plus les reglages, les comptes et l'historique.
 *
 * Une route declare soit `role: 'GERANT'`, soit rien de special (toute session
 * du personnel suffit), soit `public: true`. L'oubli d'une annotation FERME
 * l'acces au lieu de l'ouvrir (voir enforceRouteRequirements).
 */

import { t } from './langue.js';

export const CODES_ROLES = ['COIFFEUR', 'GERANT'];

/**
 * Les deux roles, dits dans la langue du salon.
 *
 * C'EST UNE FONCTION, PAS UNE CONSTANTE. Un objet fige au chargement du module
 * aurait porte les libelles de la langue du demarrage, et un salon qui passe en
 * francais aurait garde « Peluquero » dans son ecran des comptes jusqu'au
 * prochain redemarrage — le genre d'incoherence qu'on met une heure a
 * s'expliquer.
 */
export const roles = () => CODES_ROLES.map((code) => ({
  code,
  libelle: t('role.' + code + '.libelle'),
  description: t('role.' + code + '.description'),
}));

/** Un seul role, par son code. */
export const role = (code) => roles().find((r) => r.code === code) ?? null;

/** Le gerant fait tout ce que fait le coiffeur ; l'inverse est faux. */
export function aLeRole(user, requis) {
  if (!user || !user.role) return false;
  if (user.role === requis) return true;
  return user.role === 'GERANT';
}

export const estGerant = (user) => user?.role === 'GERANT';
