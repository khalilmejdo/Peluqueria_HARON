/**
 * Lecture et analyse du corps des requetes.
 *
 * Aucune bibliotheque externe n'intervient ici : le corps est lu avec une borne
 * stricte, puis analyse selon son type declare. Une requete qui depasse la
 * limite est interrompue des le depassement, sans attendre la fin du flux.
 *
 * L'application ne recoit aucun fichier : multipart n'est pas pris en charge,
 * et c'est voulu (moins de surface, rien a assainir).
 */
import { badRequest, tooLarge, unsupportedMedia } from '../core/errors.js';
import { sansOctetNul } from '../core/text.js';

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
      reject(tooLarge('El contenido enviado supera el límite permitido.'));
      req.resume();
      return;
    }

    const chunks = [];
    let size = 0;
    let settled = false;

    const fail = (err) => {
      if (settled) return;
      settled = true;
      req.destroy();
      reject(err);
    };

    req.on('data', (chunk) => {
      if (settled) return;
      size += chunk.length;
      if (size > limitBytes) {
        fail(tooLarge('El contenido enviado supera el límite permitido.'));
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      if (settled) return;
      settled = true;
      resolve(Buffer.concat(chunks, size));
    });

    req.on('error', (err) => fail(badRequest('Lecture de la requete interrompue : ' + err.message)));
    req.on('aborted', () => fail(badRequest('Requete interrompue par le client.')));
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

function sanitizeKeys(input, depth = 0) {
  if (depth > 12) throw badRequest('Estructura JSON demasiado profunda.');
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
    throw badRequest('El cuerpo de la petición no es un JSON válido.');
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw badRequest('El cuerpo de la petición debe ser un objeto JSON.');
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
 * @param {{ jsonLimit:number }} limits
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
  throw unsupportedMedia('Type de contenu non pris en charge : ' + type);
}
