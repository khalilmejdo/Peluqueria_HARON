/* eslint-env serviceworker */
/**
 * Le travailleur de service : garder la page utilisable quand le reseau tombe.
 *
 * LE CAS REEL. Le client est ASSIS DANS LE SALON, ou devant la vitrine, la ou
 * la 4G passe mal. Sa page de suivi est ouverte depuis dix minutes. Il la
 * rafraichit par reflexe — et sans ce fichier, il tombe sur l'ecran d'erreur du
 * navigateur, croit que le salon a un probleme, et va demander au comptoir.
 *
 * LE DANGER, qui est l'exact oppose. Un cache mal tenu sert une vieille page
 * pour toujours : le client verrait « 3 personnes devant vous » alors que c'est
 * son tour. C'est PIRE que pas de cache du tout. Trois regles l'evitent :
 *
 *   1. le nom du cache porte la VERSION DEPLOYEE, lue dans l'adresse de ce
 *      fichier (« /sw.js?v=<commit> »). Une mise en ligne change le nom, donc
 *      le cache entier est reconstruit et les anciens sont effaces ;
 *   2. une PAGE passe toujours par le RESEAU D'ABORD. Le cache n'est servi que
 *      si le reseau ne repond pas, et la page dit alors qu'elle est hors ligne ;
 *   3. l'API n'est JAMAIS mise en cache. Une position dans la file ne se
 *      conserve pas — c'est exactement la donnee qui devient fausse.
 *
 * Les fichiers statiques, eux, portent deja « ?v=<commit> » dans leur adresse :
 * un fichier change a une nouvelle adresse, donc le servir depuis le cache ne
 * peut pas donner une version perimee.
 */

const VERSION = new URL(self.location.href).searchParams.get('v') || 'dev';
const CACHE = 'haron-' + VERSION;

/** Ce qui ne doit jamais entrer dans un cache. */
function jamaisEnCache(url) {
  return url.pathname.startsWith('/api/')
    || url.pathname.startsWith('/gestion')
    || url.pathname === '/healthz'
    // Le QR depend d'un reglage : il se recalcule, il ne se garde pas.
    || url.pathname === '/qr.svg'
    || url.pathname === '/qr.png';
}

const EST_STATIQUE = /\.(css|js|woff2|woff|svg|png|jpg|jpeg|webp|avif|ico|webmanifest)$/;

/**
 * La page servie quand il n'y a ni reseau ni page en cache.
 *
 * Elle est ecrite ici, en dur : aller la chercher sur le reseau serait
 * exactement ce qui ne marche pas. Elle reprend les couleurs du salon pour ne
 * pas avoir l'air d'une erreur du navigateur.
 */
const PAGE_HORS_LIGNE = `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sin conexión — Peluquería HARON</title></head>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#0e1013;color:#f7f2e8;font-family:system-ui,sans-serif;text-align:center;padding:24px">
<div style="max-width:30ch">
<p style="font-size:11px;letter-spacing:.3em;text-transform:uppercase;color:#c8a24a;margin:0 0 10px">Peluquería HARON</p>
<h1 style="font-size:24px;margin:0 0 12px">Sin conexión</h1>
<p style="color:#a9a294;line-height:1.55;margin:0 0 20px">No hemos podido contactar con el salón. Tu turno sigue guardado: vuelve a cargar esta página cuando tengas señal.</p>
<a href="" style="display:inline-block;padding:14px 28px;border-radius:999px;background:#c8a24a;color:#14161a;font-weight:700;font-size:15px;text-decoration:none">Reintentar</a>
</div></body></html>`;

/* ------------------------------------------------------------------ */

self.addEventListener('install', (evenement) => {
  // Prendre la main tout de suite : sans cela, une correction urgente
  // attendrait que tous les onglets du salon soient fermes.
  evenement.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (evenement) => {
  evenement.waitUntil((async () => {
    const noms = await caches.keys();
    await Promise.all(noms.filter((n) => n !== CACHE).map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (evenement) => {
  const requete = evenement.request;
  if (requete.method !== 'GET') return;

  const url = new URL(requete.url);
  if (url.origin !== self.location.origin) return;
  if (jamaisEnCache(url)) return;

  // Le flux temps reel est une connexion qui reste ouverte : l'intercepter la
  // casserait.
  if (requete.headers.get('accept') === 'text/event-stream') return;

  // --- une PAGE : le reseau d'abord, toujours ---
  if (requete.mode === 'navigate') {
    evenement.respondWith((async () => {
      try {
        const reponse = await fetch(requete);
        // On ne garde que la derniere page vue, sous une cle fixe : c'est elle
        // qu'on reservira, et elle ne doit pas s'accumuler.
        if (reponse.ok) {
          const cache = await caches.open(CACHE);
          cache.put('derniere-page', reponse.clone());
        }
        return reponse;
      } catch {
        const cache = await caches.open(CACHE);
        const gardee = await cache.match('derniere-page');
        if (gardee) {
          // La page rendue est FORCEMENT perimee : le script du client le dira
          // a l'ecran grace a cet en-tete.
          const entetes = new Headers(gardee.headers);
          entetes.set('X-Haron-Hors-Ligne', '1');
          return new Response(await gardee.blob(), { status: 200, headers: entetes });
        }
        return new Response(PAGE_HORS_LIGNE, {
          status: 503,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
      }
    })());
    return;
  }

  // --- un FICHIER STATIQUE : le cache d'abord, sans risque ---
  //
  // Son adresse porte « ?v=<commit> » : un fichier modifie a une adresse
  // differente, donc ce qui sort du cache est forcement la bonne version.
  if (EST_STATIQUE.test(url.pathname)) {
    evenement.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const garde = await cache.match(requete);
      if (garde) return garde;
      const reponse = await fetch(requete);
      if (reponse.ok) cache.put(requete, reponse.clone());
      return reponse;
    })());
  }
});
