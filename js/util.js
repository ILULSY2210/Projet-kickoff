// ORBITA · util.js — petits utilitaires purs : hasard à graine, angles, interpolation, couleurs.
const $ = id => document.getElementById(id);

/* ---------- utilitaires ---------- */
function rng(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const angDiff = (a, b) => Math.abs(((a - b) % TAU + TAU * 1.5) % TAU - Math.PI);
const norm = a => ((a % TAU) + TAU) % TAU;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, k) => a + (b - a) * k;
const easeOut = k => 1 - Math.pow(1 - k, 3);
const pad2 = n => (n < 10 ? '0' : '') + n;
// petit bus d'événements synchrone : core.js émet (« level:start », « throw », « hit », « near », « star », « fail »,
// « failed », « win », « explode », « won », « tick », « ping », « step ») ; rendu, effets, son, interface et sauvegarde écoutent
const bus = {
  h: {},
  on(ev, fn) { (this.h[ev] || (this.h[ev] = [])).push(fn); },
  emit(ev, a, b, c) { const l = this.h[ev]; if (l) for (let i = 0; i < l.length; i++) l[i](a, b, c); }
};
// contraste WCAG entre deux couleurs [r, g, b] ; mélange linéaire en sRGB (comme la composition du canvas)
function lum(c) { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; return .2126 * f(c[0]) + .7152 * f(c[1]) + .0722 * f(c[2]); }
function contrast(a, b) { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); }
const mixRGB = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
// opacité des libellés secondaires d'un monde : au moins « base », et assez pour un contraste ≥ 4,5:1 sur le fond le plus
// clair (encre + lueur du monde)
function labelAlpha(rgb, glow, base) {
  const bg = mixRGB(INK_RGB, rgb, glow);
  for (let a = base; a < 1; a += .01) if (contrast(mixRGB(bg, rgb, a), bg) >= 4.5) return Math.round(a * 100) / 100;
  return 1;
}
const _cc = new Map();
function col(rgb, a) {
  const ai = (a * 40 + .5) | 0, k = ((rgb[0] << 16 | rgb[1] << 8 | rgb[2]) * 64) + ai;
  let s = _cc.get(k);
  if (!s) { s = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${ai / 40})`; _cc.set(k, s); }
  return s;
}
