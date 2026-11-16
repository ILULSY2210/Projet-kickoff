// ORBITA · fx.js — particules, éclats, anneaux, textes flottants, secousse et vibrations.
let segs = [], sparks = [], rings = [], texts = [], shake = 0;
const vib = p => { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} };
const RMQ = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
const rm = () => RMQ.matches;

function spark(x, y, n, rgb, sp, spread, dirA) {
  if (rm()) n = Math.ceil(n / 3);
  for (let i = 0; i < n && sparks.length < 140; i++) {
    const a = dirA === undefined ? Math.random() * TAU : dirA + (Math.random() - .5) * spread, v = sp * (.35 + Math.random() * .8), life = .25 + Math.random() * .35;
    sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life, max: life, rgb });
  }
}
function ringFx(x, y, r, vr, life, rgb, lw) { if (rings.length < 10) rings.push({ x, y, r, vr, life, max: life, rgb, lw: lw || 1.5 }); }
function seg(x, y, a, len, vx, vy, va, life, rgb) { if (segs.length < 260) segs.push({ x, y, a, len, vx, vy, va, life, max: life, rgb }); }

// éclatement vectoriel : chaque arête devient un trait libre
function explodeScene(S, power) {
  const sol = S.solid, e = sol.e, step = e.length > 180 ? 2 : 1, rr = S.r * (.7 + .3 * easeOut(S.build));
  if (rm()) return;
  for (let i = 0; i < e.length; i += 2 * step) {
    const a = e[i], b = e[i + 1], x1 = S.x + sol.px[a] * rr, y1 = S.y + sol.py[a] * rr, x2 = S.x + sol.px[b] * rr, y2 = S.y + sol.py[b] * rr;
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, dx = mx - S.x, dy = my - S.y, dl = Math.hypot(dx, dy) || 1, v = power * (.5 + Math.random() * .9);
    seg(mx, my, Math.atan2(y2 - y1, x2 - x1), Math.hypot(x2 - x1, y2 - y1), dx / dl * v + (Math.random() - .5) * 60, dy / dl * v + (Math.random() - .5) * 60, (Math.random() - .5) * 7, .6 + Math.random() * .6, S.rgb);
  }
  for (const s of S.stuck) {
    if (s.wall) continue;
    const wa = s.a + S.rot, d = S.r + S.pl * .5, v = power * (1.1 + Math.random() * .8);
    seg(S.x + Math.cos(wa) * d, S.y + Math.sin(wa) * d, wa, S.pl, Math.cos(wa) * v, Math.sin(wa) * v, (Math.random() - .5) * 5, .7 + Math.random() * .5, s.pre ? S.rgb : S.hi);
    spark(S.x + Math.cos(wa) * (S.r + S.pl), S.y + Math.sin(wa) * (S.r + S.pl), 2, S.hi, power * 1.6, .5, wa);
  }
  ringFx(S.x, S.y, S.r, power * 1.5, .6, S.hi, 2); ringFx(S.x, S.y, S.r * .5, power * 2.4, .5, S.rgb, 1.2);
  spark(S.x, S.y, 26, S.acc, power * 1.7);
}
