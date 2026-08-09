// Service Worker für Challenge App
// Cache-Name bei jeder neuen Version hochzählen (z.B. wenn sich index.html ändert),
// damit Nutzer die neue Version bekommen statt einer alten aus dem Cache.
const CACHE_VERSION = '3.0.5';
const CACHE_NAME = 'challenge-app-' + CACHE_VERSION;

const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  './og-image.png',
  './img/search-heart.svg',
  './img/info-circle.svg',
  './img/info-circle-fill.svg',
  './img/person-hearts.svg'
];

// Installation: alle Kern-Dateien in den Cache legen
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.allSettled(
        ASSETS_TO_CACHE.map((url) => cache.add(url).catch((err) => {
          console.warn('Konnte nicht cachen:', url, err);
        }))
      );
    }).then(() => self.skipWaiting())
  );
});

// Aktivierung: alte Caches von früheren Versionen aufräumen
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key.startsWith('challenge-app-') && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Cache-first, damit die App garantiert offline funktioniert.
// Im Hintergrund wird versucht, den Cache aktuell zu halten (stale-while-revalidate).
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const networkFetch = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.ok) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || networkFetch;
    })
  );
});
