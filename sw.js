/* ═══════════════════════════════════════════════════
   UNBROKEN. — sw.js  (Service Worker)
   Cache-first para assets, network-first para datos
═══════════════════════════════════════════════════ */

const CACHE = 'unbroken-v1';
const ASSETS = [
  './',
  './index.html',
  './app.css',
  './app.js',
  './auth.js',
  './data.js',
  './inventario.js',
  './contabilidad.js',
  './manifest.json'
];

// Instalar: pre-cachear assets
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Activar: limpiar caches viejas
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: cache-first para assets, network-first para GitHub API
self.addEventListener('fetch', e => {
  const url = e.request.url;

  // GitHub API → siempre red
  if (url.includes('api.github.com')) {
    e.respondWith(fetch(e.request).catch(() => new Response('{"error":"offline"}', { headers: { 'Content-Type': 'application/json' } })));
    return;
  }

  // Assets → cache first
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res && res.status === 200 && res.type === 'basic') {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      });
    })
  );
});
