// ORBITA · main.js — démarrage et boucle. Seul fichier qui agit au chargement ; chargé en dernier.
let last = 0;
function loop(now) {
  const dt = Math.min(.033, Math.max(0, (now - last) / 1000)); last = now;
  if (state !== 'pause') update(dt);
  draw(dt);
  requestAnimationFrame(loop);
}

addEventListener('resize', resize);
addEventListener('orientationchange', () => setTimeout(resize, 120));
bindUI();

/* ---------- service worker : précache hors ligne, mise à jour appliquée seulement au menu ---------- */
let swReg = null, swWaiting = null, swAsked = false, swChecked = 0;
function swInit() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:' || !window.isSecureContext) return;
  const sw = navigator.serviceWorker;
  sw.addEventListener('controllerchange', () => { if (swAsked) { swAsked = false; location.reload(); } });
  sw.register('sw.js').then(reg => {
    swReg = reg; swChecked = performance.now();
    if (reg.waiting && sw.controller) swWaiting = reg.waiting;
    reg.addEventListener('updatefound', () => {
      const w = reg.installing; if (!w) return;
      w.addEventListener('statechange', () => { if (w.state === 'installed' && sw.controller) { swWaiting = w; swApply(); } });
    });
    swApply();
  }).catch(() => {});
}
// appelée à l'affichage du menu et des niveaux : jamais pendant un niveau
function swApply() {
  if (!swReg || (state !== 'menu' && state !== 'levels')) return;
  if (swWaiting) { swAsked = true; swWaiting.postMessage('skipWaiting'); swWaiting = null; return; }
  if (performance.now() - swChecked > 30 * 60 * 1000) { swChecked = performance.now(); swReg.update().catch(() => {}); }
}

resize();
showMenu();
requestAnimationFrame(now => { last = now; requestAnimationFrame(loop); });
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { hero = null; }).catch(() => {});
swInit();
// démarrage réussi seulement si aucune erreur n'est survenue avant (le garde-fou d'index.html reste affiché sinon) ;
// un démarrage simplement lent retire le message affiché au bout de 4 s
if (!window.__orbitaBootErr) { window.__orbitaBooted = true; const bf = document.getElementById('bootFail'); if (bf) bf.remove(); }
