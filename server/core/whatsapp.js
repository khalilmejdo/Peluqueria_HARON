/**
 * Connecteur WhatsApp Business (API Cloud de Meta), sans dependance.
 *
 * Module PUR : aucune lecture de configuration ni de base. Le domaine
 * (server/domain/notifications.js) decide de l'envoi, ce module sait seulement
 * parler a Meta.
 *
 * WhatsApp n'autorise l'envoi automatique d'un premier message que par un
 * MODELE approuve par Meta (compte WhatsApp Business verifie, numero
 * enregistre, jeton d'acces). Le message part vers
 *   POST https://graph.facebook.com/v20.0/<numero_id>/messages
 * Seul cet hote est admis : l'adresse n'est jamais construite depuis une donnee
 * saisie. Les tests passent une adresse de base locale par un parametre
 * reserve, jamais expose par l'API.
 */

export const HOTE_META = 'graph.facebook.com';
export const VERSION_API = 'v20.0';
const BASE_META = 'https://' + HOTE_META;

export class ErreurWhatsapp extends Error {
  constructor(message, { statut = 0, temporaire = true } = {}) {
    super(message);
    this.name = 'ErreurWhatsapp';
    this.statut = statut;
    this.temporaire = temporaire;
  }
}

/** Numero au format international, chiffres seuls (34612345678). */
export const numeroValide = (n) => typeof n === 'string' && /^[1-9]\d{7,14}$/.test(n);
/** Identifiant du numero d'envoi chez Meta. */
export const numeroIdValide = (n) => typeof n === 'string' && /^\d{5,30}$/.test(n);
/** Nom d'un modele approuve : minuscules, chiffres, soulignes. */
export const nomModeleValide = (n) => typeof n === 'string' && /^[a-z0-9_]{1,512}$/.test(n);
/** Code de langue du modele (fr, es, en_US, ar). */
export const langueValide = (l) => typeof l === 'string' && /^[a-z]{2,3}(_[A-Z]{2})?$/.test(l);

/**
 * Parametre de corps d'un modele : Meta refuse retours a la ligne, tabulations
 * et plus de quatre espaces consecutifs. On remplace plutot que d'echouer (le
 * texte vient de la base : un prenom, un numero de ticket).
 */
export function parametreModele(valeur) {
  const texte = [...String(valeur ?? '')].map((c) => (c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127 ? ' ' : c)).join('')
    .replace(/ {4,}/g, '   ').trim().slice(0, 900);
  return texte || '-';
}

/**
 * Corps JSON d'un message modele.
 *
 * `lien` est le suffixe d'adresse pose dans le bouton du modele. Meta impose
 * qu'un bouton d'adresse dynamique ne fournisse QUE la partie variable : le
 * debut de l'adresse est fige dans le modele approuve.
 */
export function corpsModele({ destinataire, modele, langue = 'fr', parametres = [], lien = null }) {
  if (!numeroValide(destinataire)) throw new ErreurWhatsapp('Numéro WhatsApp du destinataire invalide (format international, chiffres seuls).', { temporaire: false });
  if (!nomModeleValide(modele)) throw new ErreurWhatsapp('Nom de modèle WhatsApp invalide.', { temporaire: false });
  if (!langueValide(langue)) throw new ErreurWhatsapp('Langue de modèle WhatsApp invalide.', { temporaire: false });

  const corps = { messaging_product: 'whatsapp', to: destinataire, type: 'template', template: { name: modele, language: { code: langue } } };
  const composants = [];
  if (parametres.length) {
    composants.push({ type: 'body', parameters: parametres.map((p) => ({ type: 'text', text: parametreModele(p) })) });
  }
  if (lien) {
    composants.push({ type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: parametreModele(lien) }] });
  }
  if (composants.length) corps.template.components = composants;
  return corps;
}

/**
 * Envoie un modele.
 * @param {{ numeroId: string, jeton: string, destinataire: string, modele: string,
 *           langue?: string, parametres?: string[], lien?: string|null,
 *           delaiMs?: number, baseEssai?: string|null, fetch?: typeof fetch }} p
 *   baseEssai : adresse de base d'un faux serveur, reservee aux tests.
 * @returns {Promise<{ id: string|null }>}
 */
export async function envoyerModele({
  numeroId, jeton, destinataire, modele, langue = 'fr', parametres = [], lien = null,
  delaiMs = 10000, baseEssai = null, fetch: fetchFn = globalThis.fetch,
}) {
  if (!numeroIdValide(numeroId)) throw new ErreurWhatsapp('Identifiant du numéro WhatsApp invalide.', { temporaire: false });
  if (typeof jeton !== 'string' || jeton.length < 10 || jeton.length > 2000 || /\s/.test(jeton)) {
    throw new ErreurWhatsapp('Jeton d’accès WhatsApp absent ou invalide.', { temporaire: false });
  }
  const corps = corpsModele({ destinataire, modele, langue, parametres, lien });
  const url = new URL('/' + VERSION_API + '/' + numeroId + '/messages', baseEssai || BASE_META);
  if (!baseEssai && (url.protocol !== 'https:' || url.hostname !== HOTE_META)) {
    throw new ErreurWhatsapp('Adresse de l’API WhatsApp non admise.', { temporaire: false });
  }

  let reponse;
  try {
    reponse = await fetchFn(url.href, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + jeton, 'Content-Type': 'application/json' },
      body: JSON.stringify(corps),
      redirect: 'manual',
      signal: AbortSignal.timeout(delaiMs),
    });
  } catch (err) {
    throw new ErreurWhatsapp(err?.name === 'TimeoutError' ? 'Délai dépassé avec l’API WhatsApp.' : 'API WhatsApp injoignable.');
  }

  let donnees = null;
  try {
    donnees = JSON.parse((await reponse.text()).slice(0, 20000));
  } catch {
    donnees = null;
  }
  if (reponse.ok) return { id: typeof donnees?.messages?.[0]?.id === 'string' ? donnees.messages[0].id.slice(0, 200) : null };

  const message = String(donnees?.error?.message || 'réponse ' + reponse.status).slice(0, 200);
  // 429 et 5xx : a reessayer ; autres 4xx (jeton, modele non approuve...) : definitif.
  throw new ErreurWhatsapp('Refus de l’API WhatsApp (' + reponse.status + ') : ' + message,
    { statut: reponse.status, temporaire: reponse.status === 429 || reponse.status >= 500 });
}

/**
 * Lien « wa.me » qui ouvre une conversation WhatsApp avec un texte pre-rempli.
 *
 * C'est la solution SANS API : le coiffeur appuie sur le numero d'un client
 * depuis sa tablette, WhatsApp s'ouvre, le message est deja ecrit, il envoie.
 * Zero configuration, zero compte Business, et ca marche des le premier jour.
 *
 * @param {string} destinataire  numero international, chiffres seuls
 * @param {string} texte
 */
export function lienWaMe(destinataire, texte = '') {
  if (!numeroValide(destinataire)) return null;
  const base = 'https://wa.me/' + destinataire;
  return texte ? base + '?text=' + encodeURIComponent(String(texte).slice(0, 1500)) : base;
}
