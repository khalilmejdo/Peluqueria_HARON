/**
 * Service des fichiers statiques (styles, scripts, polices, images).
 *
 * Le chemin demande est resolu puis verifie : tout resultat sortant du dossier
 * public est refuse, ce qui exclut la traversee de repertoire (« ../../.env »).
 * Les fichiers sont gardes en memoire au premier acces, avec un ETag.
 *
 * Quand la version deployee est connue, les adresses des modules et des
 * feuilles de style portent « ?v=<commit> » : le navigateur les garde un an, et
 * une mise en ligne change toutes les adresses d'un coup.
 */
import zlib from 'node:zlib';
import fs from 'node:fs/promises';
import path from 'node:path';
import { ROOT, config } from '../core/config.js';
import { sha256 } from '../core/crypto.js';
import { applySecurityHeaders } from './security.js';

export const PUBLIC_DIR = path.join(ROOT, 'public');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  // La galerie du salon accepte l'AVIF : sans ce type, la photo partirait en
  // « application/octet-stream » et le navigateur la telechargerait au lieu de
  // l'afficher.
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};

/** @type {Map<string, {buffer:Buffer, mime:string, etag:string}>} */
const cache = new Map();

export function clearStaticCache() {
  cache.clear();
}

function resolveSafePath(urlPath) {
  const relative = urlPath.replace(/^\/+/, '');
  if (!relative || relative.includes(String.fromCharCode(0))) return null;
  const absolute = path.resolve(PUBLIC_DIR, relative);
  if (!absolute.startsWith(PUBLIC_DIR + path.sep)) return null;
  // Aucun fichier cache (.gitkeep, .env) ni segment cache n'est servi.
  if (absolute.slice(PUBLIC_DIR.length).split(path.sep).some((s) => s.startsWith('.'))) return null;
  return absolute;
}

/** Pose la version dans les imports de modules (remplacement par fonction : aucun motif « $ » interprete). */
export function versionnerModule(source, version) {
  return source.replace(
    /(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(['"])((?:\.{1,2}\/|\/)[^'"\n]+?\.m?js)\2/g,
    (_tout, avant, guillemet, chemin) => avant + guillemet + chemin + '?v=' + version + guillemet,
  );
}

/** Idem pour les balises script et link d'un document HTML. */
export function versionnerDocument(source, version) {
  return source.replace(
    /(<(?:script|link)\b[^>]*?\b(?:src|href)=")(\/[^"\n]+?\.(?:m?js|css))(")/g,
    (_tout, avant, chemin, apres) => avant + chemin + '?v=' + version + apres,
  );
}

async function loadFile(absolutePath) {
  const cached = cache.get(absolutePath);
  if (cached) return cached;
  let buffer;
  try {
    const stat = await fs.stat(absolutePath);
    if (!stat.isFile()) return null;
    buffer = await fs.readFile(absolutePath);
  } catch {
    return null;
  }
  const extension = path.extname(absolutePath).toLowerCase();
  if (config.version) {
    if (extension === '.js' || extension === '.mjs') buffer = Buffer.from(versionnerModule(buffer.toString('utf8'), config.version), 'utf8');
    else if (extension === '.html') buffer = Buffer.from(versionnerDocument(buffer.toString('utf8'), config.version), 'utf8');
  }
  const entry = { buffer, mime: MIME_TYPES[extension] || 'application/octet-stream', etag: '"' + sha256(buffer).slice(0, 32) + '"' };
  // En developpement (--watch), on relit a chaque fois pour voir les modifications.
  if (config.isProduction) cache.set(absolutePath, entry);
  return entry;
}

/** Compresse une fois pour toutes le fichier garde en memoire. */
function comprimer(file, encodage) {
  const corps = encodage === 'br'
    ? zlib.brotliCompressSync(file.buffer, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 9, [zlib.constants.BROTLI_PARAM_SIZE_HINT]: file.buffer.length } })
    : zlib.gzipSync(file.buffer, { level: 8 });
  file.compresse = { ...(file.compresse || {}), [encodage]: corps };
  return corps;
}

/**
 * Tente de servir un fichier statique. `avantEnvoi` est appele une fois le
 * fichier reconnu (limitation de debit propre aux fichiers).
 * @returns {Promise<boolean>} true si la reponse a ete emise
 */
export async function serveStatic(ctx, { avantEnvoi = null } = {}) {
  if (ctx.method !== 'GET' && ctx.method !== 'HEAD') return false;
  const absolutePath = resolveSafePath(ctx.path);
  if (!absolutePath) return false;
  const file = await loadFile(absolutePath);
  if (!file) return false;
  if (avantEnvoi) avantEnvoi();

  applySecurityHeaders(ctx.res, { kind: 'app' });
  // Les images publiques doivent pouvoir s'afficher dans l'apercu d'un lien
  // partage sur WhatsApp : ce sont elles, et elles seules, qui sortent.
  if (ctx.path.startsWith('/img/')) ctx.res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

  if (ctx.req.headers['if-none-match'] === file.etag) {
    ctx.responded = true;
    ctx.res.writeHead(304, { ETag: file.etag });
    ctx.res.end();
    return true;
  }
  const versionne = config.version && ctx.query('v') === config.version && !file.mime.startsWith('text/html');
  const immuable = ctx.path.startsWith('/fonts/');
  ctx.responded = true;
  const compressible = /^(text\/|application\/(javascript|json|manifest\+json)|image\/svg)/.test(file.mime);
  const encodage = compressible && ctx.method !== 'HEAD' && file.buffer.length >= 1024 ? ctx.encodageAccepte() : null;
  const corps = encodage ? (file.compresse?.[encodage] ?? comprimer(file, encodage)) : file.buffer;
  ctx.res.writeHead(200, {
    'Content-Type': file.mime,
    'Content-Length': corps.length,
    ETag: file.etag,
    'Cache-Control': versionne || immuable ? 'public, max-age=31536000, immutable' : 'no-cache',
    ...(encodage ? { 'Content-Encoding': encodage, Vary: 'Accept-Encoding' } : {}),
  });
  ctx.res.end(ctx.method === 'HEAD' ? undefined : corps);
  return true;
}

/** Charge un document HTML du dossier public (coquille de l'espace de gestion). */
export async function loadHtml(relative) {
  const file = await loadFile(path.join(PUBLIC_DIR, relative));
  return file ? file.buffer.toString('utf8') : null;
}
