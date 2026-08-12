// Service Worker für Challenge App
// Cache-Name bei jeder neuen Version hochzählen (z.B. wenn sich index.html ändert),
// damit Nutzer die neue Version bekommen statt einer alten aus dem Cache.
const CACHE_VERSION = '4.6.5';
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

// Fetch: Zwei unterschiedliche Strategien.
//
// 1) HTML-Seite (Navigation, also das eigentliche Öffnen der App über das
//    Icon) -> Network-first: Es wird IMMER zuerst versucht, die aktuelle
//    Version aus dem Netz zu laden. Nur wenn kein Netz verfügbar ist, greift
//    der Cache als Offline-Fallback. So wird garantiert, dass beim Klick auf
//    das Icon (bei vorhandenem Netz) sofort die neueste Version erscheint,
//    statt erst beim übernächsten Start.
//
// 2) Alle anderen Dateien (Icons, Bilder, Manifest) -> Cache-first mit
//    Hintergrund-Aktualisierung, da sich diese kaum ändern und ein
//    CACHE_VERSION-Bump beim Release ohnehin den kompletten alten Cache
//    verwirft.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // Requests mit Schema wie z.B. "chrome-extension://" (von Browser-Erweiterungen)
  // werden von der Cache API nicht unterstützt ("Failed to execute 'put' on
  // 'Cache': Request scheme ... is unsupported"). Solche Requests einfach
  // unangetastet ans Netzwerk durchreichen, ohne sie zu cachen.
  if (!event.request.url.startsWith('http://') && !event.request.url.startsWith('https://')) {
    return;
  }

  const isHtmlNavigation = event.request.mode === 'navigate' ||
    event.request.destination === 'document' ||
    (event.request.headers.get('accept') || '').includes('text/html');

  if (isHtmlNavigation) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.ok) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
          }
          return networkResponse;
        })
        .catch(() => caches.match(event.request).then((cached) => cached || caches.match('./index.html')))
    );
    return;
  }

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
