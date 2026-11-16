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

resize();
showMenu();
requestAnimationFrame(now => { last = now; requestAnimationFrame(loop); });
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { hero = null; }).catch(() => {});
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
