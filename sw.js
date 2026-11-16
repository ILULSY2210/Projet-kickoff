// Réseau d'abord (pour recevoir les mises à jour), cache en secours (pour jouer hors-ligne).
const CACHE = 'orbita-v3';
const FILES = ['./', 'index.html', 'manifest.webmanifest', 'icon.svg',
  'js/config.js', 'js/util.js', 'js/vector.js', 'js/levels.js', 'js/store.js', 'js/core.js',
  'js/audio.js', 'js/fx.js', 'js/render.js', 'js/ui.js', 'js/main.js'];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then(r => {
      if (r && (r.ok || r.type === 'opaque')) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {}); }
      return r;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
