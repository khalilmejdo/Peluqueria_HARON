/**
 * Petites aides partagees par les routes.
 */
import { isUuid, jetonPlausible } from '../core/crypto.js';
import { badRequest, notFound } from '../core/errors.js';

/** Parametre de chemin identifiant : 404 plutot qu'une erreur de type en base. */
export function idDe(ctx, nom = 'id') {
  const valeur = ctx.params[nom];
  if (!isUuid(valeur)) throw notFound('No encontrado.');
  return valeur.toLowerCase();
}

/**
 * Jeton de suivi pris dans l'adresse.
 *
 * Un jeton mal forme rend EXACTEMENT la meme reponse qu'un jeton inconnu :
 * sinon, la difference de message dirait a qui cherche quels jetons ont la
 * bonne forme, et diviserait d'autant son travail d'enumeration.
 */
export function jetonDe(ctx, nom = 'jeton') {
  const valeur = ctx.params[nom];
  if (!jetonPlausible(valeur)) throw notFound('Este enlace de seguimiento ya no sirve.');
  return valeur;
}

export function exigerTrouve(ligne, message = 'No encontrado.') {
  if (!ligne) throw notFound(message);
  return ligne;
}

/** Liste paginee standard : { items, total, page, limit }. */
export function page(items, total, { page: numero, limit }) {
  return { items, total: Number(total) || 0, page: numero, limit };
}

/** Refuse un corps vide pour une mise a jour. */
export function exigerChamps(data) {
  if (!data || !Object.keys(data).length) throw badRequest('Aucune modification transmise.');
  return data;
}
