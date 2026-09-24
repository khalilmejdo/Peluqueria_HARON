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

export const ROLES = {
  COIFFEUR: {
    code: 'COIFFEUR',
    libelle: 'Peluquero',
    description: 'Lleva la fila del día: llamar, atender, marcar ausente, anular.',
  },
  GERANT: {
    code: 'GERANT',
    libelle: 'Gerente',
    description: 'Todo lo que hace el peluquero, más los ajustes, las cuentas y el historial.',
  },
};

export const CODES_ROLES = Object.keys(ROLES);

/** Le gerant fait tout ce que fait le coiffeur ; l'inverse est faux. */
export function aLeRole(user, requis) {
  if (!user || !user.role) return false;
  if (user.role === requis) return true;
  return user.role === 'GERANT';
}

export const estGerant = (user) => user?.role === 'GERANT';
