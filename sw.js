// Service worker d'Orbita : précache atomique et versionné.
// - install  : tous les fichiers de la version sont téléchargés d'un bloc (tout ou rien) dans le cache VERSION,
//              en contournant le cache HTTP ; la nouvelle version attend ensuite sans rien remplacer.
// - fetch    : les requêtes GET de même origine sont servies depuis le seul cache VERSION, navigation comprise
//              (jamais un index.html récent avec des scripts anciens) ; le réseau ne sert que si un fichier manque.
// - message  : la page demande l'activation d'une nouvelle version seulement au menu (js/main.js, swApply).
// - activate : supprime les caches Orbita des autres versions.
// Toute modification d'un fichier de FILES exige d'incrémenter VERSION et les ?v= (tests/unit/sw.test.js).
const VERSION = 'orbita-v49';
const FILES = [
  './', 'index.html', 'manifest.webmanifest', 'icon.svg',
  'js/config.js?v=49', 'js/util.js?v=49', 'js/vector.js?v=49', 'js/levels.js?v=49', 'js/store.js?v=49', 'js/core.js?v=49',
  'js/audio.js?v=49', 'js/fx.js?v=49', 'js/render.js?v=49', 'js/ui.js?v=49', 'js/main.js?v=49',
  'fonts/b612-latin-400-normal.woff2', 'fonts/b612-latin-700-normal.woff2',
  'fonts/b612-mono-latin-400-normal.woff2', 'fonts/b612-mono-latin-700-normal.woff2'
];
const OFFLINE = '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Orbita</title>' +
  '<body style="margin:0;height:100vh;display:flex;align-items:center;justify-content:center;background:#04070a;color:#4dffa6;' +
  'font:12px/1.6 monospace;letter-spacing:.16em;text-transform:uppercase;text-align:center" onclick="location.reload()">' +
  'Hors ligne<br>Touche pour réessayer</body>';

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' })))));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('orbita-') && k !== VERSION).map(k => caches.delete(k)))));
});
self.addEventListener('message', e => { if (e.data === 'skipWaiting') self.skipWaiting(); });

const scope = () => new URL(self.registration.scope);
function timeout(ms) { return new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms)); }
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url), sc = scope();
  if (url.origin !== sc.origin) return;
  const nav = req.mode === 'navigate';
  const root = url.pathname === sc.pathname || url.pathname === sc.pathname + 'index.html';
  e.respondWith(caches.open(VERSION).then(async c => {
    const hit = await c.match(nav && root ? 'index.html' : req, { ignoreVary: true });
    if (hit) return hit;
    if (!nav) return fetch(req);
    try { return await Promise.race([fetch(req), timeout(2500)]); }
    catch (err) { return new Response(OFFLINE, { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }); }
  }));
});
