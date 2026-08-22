const CACHE_NAME = 'ig-resizer-v6'; // ⚠️ à incrémenter à CHAQUE déploiement
const ASSETS = [
  './',
  './index.html',
  './styles.css?v=5',
  './app.js?v=5',
  './manifest.json',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;

  // Network-first pour le HTML (point d'entrée) → toujours la dernière version
  if (e.request.mode === 'navigate' || e.request.url.endsWith('.html') || e.request.url.endsWith('/')) {
    e.respondWith(
      fetch(e.request).then((res) => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
        return res;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  // Cache-first pour le reste (JS/CSS versionnés, images…)
  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request))
  );
});
});
