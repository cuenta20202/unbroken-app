/* ═══════════════════════════════════════════════════
   UNBROKEN. — sw.js  (Service Worker)
═══════════════════════════════════════════════════ */

const CACHE = 'unbroken-v2';
const ASSETS = [
  './',
  './index.html',
  './app.css',
  './app.js',
  './auth.js',
  './data.js',
  './inventario.js',
  './manifest.json'
];

self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE).then(function(cache) {
      return Promise.all(
        ASSETS.map(function(url) {
          return cache.add(url).catch(function() { /* ignorar si falla */ });
        })
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE; }).map(function(k) { return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function(e) {
  var url = e.request.url;

  /* Solo manejar http y https — ignorar chrome-extension, data:, etc. */
  if (!url.startsWith('http://') && !url.startsWith('https://')) return;

  /* GitHub API → siempre red, nunca cachear */
  if (url.includes('api.github.com')) {
    e.respondWith(
      fetch(e.request).catch(function() {
        return new Response('{"error":"offline"}', {
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  /* Assets → cache first, luego red */
  e.respondWith(
    caches.match(e.request).then(function(cached) {
      if (cached) return cached;
      return fetch(e.request).then(function(res) {
        if (res && res.status === 200 && res.type === 'basic') {
          var clone = res.clone();
          caches.open(CACHE).then(function(c) { c.put(e.request, clone); });
        }
        return res;
      }).catch(function() {
        return new Response('', { status: 503 });
      });
    })
  );
});
