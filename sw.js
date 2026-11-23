/* ═══════════════════════════════════════════════════
   UNBROKEN. — sw.js
   Network-first + auto-actualización sin borrar caché
═══════════════════════════════════════════════════ */

/* Cambia este número cada vez que subas cambios a GitHub.
   El navegador detecta que sw.js cambió y actualiza todo. */
const VERSION = '20261122-1';
const CACHE   = 'unbroken-' + VERSION;

self.addEventListener('install', function(e) {
  /* Tomar control de inmediato, sin esperar */
  self.skipWaiting();
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys
          .filter(function(k) { return k !== CACHE; })
          .map(function(k) { return caches.delete(k); })
      );
    }).then(function() {
      /* Tomar control de todas las pestañas abiertas ahora mismo */
      return self.clients.claim();
    }).then(function() {
      /* Decirle a todas las pestañas que recarguen para ver los cambios */
      return self.clients.matchAll({ type: 'window' }).then(function(clients) {
        clients.forEach(function(client) {
          client.postMessage({ type: 'SW_UPDATED', version: VERSION });
        });
      });
    })
  );
});

self.addEventListener('fetch', function(e) {
  var url = e.request.url;

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

  /* Todo lo demás → Network-first */
  e.respondWith(
    fetch(e.request).then(function(res) {
      if (res && res.status === 200) {
        var clone = res.clone();
        caches.open(CACHE).then(function(c) { c.put(e.request, clone); });
      }
      return res;
    }).catch(function() {
      return caches.match(e.request).then(function(cached) {
        return cached || new Response('Sin conexión', { status: 503 });
      });
    })
  );
});
