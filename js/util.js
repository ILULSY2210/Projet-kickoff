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
const _cc = new Map();
function col(rgb, a) {
  const ai = (a * 40 + .5) | 0, k = ((rgb[0] << 16 | rgb[1] << 8 | rgb[2]) * 64) + ai;
  let s = _cc.get(k);
  if (!s) { s = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${ai / 40})`; _cc.set(k, s); }
  return s;
}
