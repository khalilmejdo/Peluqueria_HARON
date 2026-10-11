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

/**
 * TROIS NIVEAUX, CHACUN FAIT TOUT CE QUE FAIT CELUI D'EN DESSOUS.
 *
 *   COIFFEUR    tient la file et l'agenda du jour ;
 *   GERANT      les reglages du salon, les comptes, l'historique ;
 *   SUPERADMIN  l'EDITEUR de l'application, qui l'installe et la vend a
 *               plusieurs salons : il est seul a changer la MARQUE (nom,
 *               couleurs, logo, activite, langue, monnaie). Le salon regle sa
 *               vie de tous les jours ; il ne peut pas defaire l'identite
 *               livree.
 *
 * Un gerant ne cree pas de SUPERADMIN et ne touche a aucun : sinon il lui
 * suffirait de reinitialiser son mot de passe pour s'en emparer.
 */
export const CODES_ROLES = ['COIFFEUR', 'GERANT', 'SUPERADMIN'];
const RANG = { COIFFEUR: 1, GERANT: 2, SUPERADMIN: 3 };

/** Les roles qu'un utilisateur peut attribuer : jamais au-dessus du sien. */
export const rolesAttribuables = (user) => CODES_ROLES.filter((c) => RANG[c] <= (RANG[user?.role] ?? 0));

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

/** Chaque niveau fait tout ce que fait celui d'en dessous ; l'inverse est faux. */
export function aLeRole(user, requis) {
  if (!user || !user.role || !RANG[requis]) return false;
  return (RANG[user.role] ?? 0) >= RANG[requis];
}

export const estGerant = (user) => aLeRole(user, 'GERANT');
export const estSuperAdmin = (user) => user?.role === 'SUPERADMIN';
