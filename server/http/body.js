/**
 * Lecture et analyse du corps des requetes.
 *
 * Aucune bibliotheque externe n'intervient ici : le corps est lu avec une borne
 * stricte, puis analyse selon son type declare. Une requete qui depasse la
 * limite est interrompue des le depassement, sans attendre la fin du flux.
 *
 * Pas de multipart, et c'est voulu (moins de surface, rien a assainir). La
 * seule exception est une IMAGE envoyee brute — le corps EST le fichier — et
 * seulement vers une route qui l'a declare. Son type se verifie ensuite dans
 * ses octets (domain/photos.js), jamais dans l'en-tete annonce.
 */
import { AppError, badRequest, tooLarge, unsupportedMedia } from '../core/errors.js';

/** Silence maximal entre deux morceaux d'un corps de requete. */
const SILENCE_MAX_MS = 20000;
import { sansOctetNul } from '../core/text.js';
import { t } from '../core/langue.js';

/**
 * Lit integralement le corps de la requete, dans la limite indiquee.
 * @param {import('node:http').IncomingMessage} req
 * @param {number} limitBytes
 * @returns {Promise<Buffer>}
 */
export function readBody(req, limitBytes) {
  return new Promise((resolve, reject) => {
    // Content-Length permet de refuser immediatement, sans lire un seul octet.
    const declared = Number.parseInt(req.headers['content-length'] || '', 10);
    if (Number.isFinite(declared) && declared > limitBytes) {
      reject(tooLarge(t('req.tropGros')));
      req.resume();
      return;
    }

    const chunks = [];
    let size = 0;
    let settled = false;

    // UN CORPS QUI N'ARRIVE PAS NE GARDE PAS LE SOCKET POUR TOUJOURS.
    //
    // requestTimeout vaut 0 (les flux temps reel restent ouverts des heures) :
    // rien ne bornait donc une requete qui annonce 256 Ko et envoie un octet
    // par minute. Quelques centaines comme elle epuisaient les descripteurs du
    // processus. Deux bornes : vingt secondes sans un octet, et une duree
    // totale a la mesure de la limite — 16 Ko/s, le debit d'une 3G qui peine,
    // suffit a une photo de 8 Mo en neuf minutes.
    const totalMs = Math.max(30000, Math.ceil(limitBytes / 16384) * 1000);
    let silence = null;
    const total = setTimeout(() => fail(new AppError(408, t('req.interrompue'))), totalMs);
    const rearmer = () => {
      clearTimeout(silence);
      silence = setTimeout(() => fail(new AppError(408, t('req.interrompue'))), SILENCE_MAX_MS);
    };
    const arreterMinuteries = () => { clearTimeout(silence); clearTimeout(total); };
    rearmer();

    const fail = (err) => {
      if (settled) return;
      settled = true;
      arreterMinuteries();
      req.destroy();
      reject(err);
    };

    req.on('data', (chunk) => {
      if (settled) return;
      rearmer();
      size += chunk.length;
      if (size > limitBytes) {
        fail(tooLarge(t('req.tropGros')));
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      if (settled) return;
      settled = true;
      arreterMinuteries();
      resolve(Buffer.concat(chunks, size));
    });

    req.on('error', () => fail(badRequest(t('req.interrompue'))));
    req.on('aborted', () => fail(badRequest(t('req.interrompue'))));
  });
}

/** Extrait le type MIME et ses parametres de l'en-tete Content-Type. */
export function parseContentType(header) {
  if (!header) return { type: '', params: {} };
  const [rawType, ...rest] = String(header).split(';');
  const params = {};
  for (const part of rest) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim().toLowerCase();
    let val = part.slice(eq + 1).trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    params[key] = val;
  }
  return { type: rawType.trim().toLowerCase(), params };
}

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/** Les seules images qu'une route declaree accepte, avant verification des octets. */
const TYPES_IMAGE = new Set(['image/jpeg', 'image/png', 'image/webp']);

function sanitizeKeys(input, depth = 0) {
  if (depth > 12) throw badRequest(t('req.tropProfond'));
  if (Array.isArray(input)) return input.map((v) => sanitizeKeys(v, depth + 1));
  if (input === null || typeof input !== 'object') return input;

  const out = Object.create(null);
  for (const [key, val] of Object.entries(input)) {
    if (FORBIDDEN_KEYS.has(key)) continue;
    // L'octet nul est retire ici, ou passent toutes les valeurs de toutes les routes.
    out[key] = sansOctetNul(sanitizeKeys(val, depth + 1));
  }
  return Object.assign({}, out);
}

/** Analyse un corps JSON en refusant tout ce qui n'est pas un objet. */
export function parseJsonBody(buffer) {
  if (!buffer.length) return {};
  let parsed;
  try {
    parsed = JSON.parse(buffer.toString('utf8'));
  } catch {
    throw badRequest(t('req.jsonInvalide'));
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw badRequest(t('req.objetAttendu'));
  }
  // Neutralise la pollution de prototype : une cle « __proto__ » recue depuis
  // le reseau ne doit jamais atteindre Object.prototype.
  return sanitizeKeys(parsed);
}

export function parseUrlEncodedBody(buffer) {
  const params = new URLSearchParams(buffer.toString('utf8'));
  const out = {};
  for (const [key, val] of params) {
    if (FORBIDDEN_KEYS.has(key)) continue;
    out[key] = sansOctetNul(val);
  }
  return out;
}

/**
 * Lit et analyse le corps selon son type declare.
 * @param {import('node:http').IncomingMessage} req
 * @param {{ jsonLimit:number, imageLimit?:number }} limits
 */
export async function parseBody(req, limits) {
  const { type } = parseContentType(req.headers['content-type']);

  // Un corps non declare est ignore : POST sans contenu reste valide.
  if (!type) return { body: {} };

  if (type === 'application/json') {
    return { body: parseJsonBody(await readBody(req, limits.jsonLimit)) };
  }
  if (type === 'application/x-www-form-urlencoded') {
    return { body: parseUrlEncodedBody(await readBody(req, limits.jsonLimit)) };
  }
  if (limits.imageLimit && TYPES_IMAGE.has(type)) {
    return { body: {}, image: { type, contenu: await readBody(req, limits.imageLimit) } };
  }
  throw unsupportedMedia(t('req.typeNonPris', { type }));
}
