/**
 * Petites aides partagees par les routes.
 */
import { isUuid, jetonPlausible } from '../core/crypto.js';
import { badRequest, notFound } from '../core/errors.js';
import { t } from '../core/langue.js';

/** Parametre de chemin identifiant : 404 plutot qu'une erreur de type en base. */
export function idDe(ctx, nom = 'id') {
  const valeur = ctx.params[nom];
  if (!isUuid(valeur)) throw notFound(t('err.introuvable'));
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
  if (!jetonPlausible(valeur)) throw notFound(t('req.lienPerime'));
  return valeur;
}

export function exigerTrouve(ligne, message = null) {
  if (!ligne) throw notFound(message ?? t('err.introuvable'));
  return ligne;
}

/** Liste paginee standard : { items, total, page, limit }. */
export function page(items, total, { page: numero, limit }) {
  return { items, total: Number(total) || 0, page: numero, limit };
}

/** Refuse un corps vide pour une mise a jour. */
export function exigerChamps(data) {
  if (!data || !Object.keys(data).length) throw badRequest(t('commun.aucuneModification'));
  return data;
}
