// ORBITA · main.js — démarrage et boucle. Seul fichier qui agit au chargement ; chargé en dernier.
// Boucle à pas fixe : le temps écoulé s'accumule (plafonné à 0,25 s par image) et la simulation avance en pas de STEP ;
// le rendu dessine l'instant présent (viewAt). simWall = heure murale (ms) de l'instant simulé t, pour horodater les taps.
let last = 0, acc = 0, simWall = 0;
function loop(now) {
  let el = (now - last) / 1000; last = now;
  if (!(el > 0)) el = 0; else if (el > .25) el = .25;
  if (state === 'pause') acc = 0;
  else { acc += el; while (acc >= STEP) { update(STEP); acc -= STEP; } }
  simWall = now - acc * 1000;
  viewAt(acc);
  draw(el);
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
