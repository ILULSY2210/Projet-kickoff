// ORBITA · levels.js — mondes, lois de rotation, générateur de niveaux et arcs libres.
// monde d'un niveau : 0..5 pour les niveaux 1..300 (50 par monde), 6 = COSMOS ∞ (301 et suivants)
function worldOf(n) { n = Math.max(1, n | 0); return n > LAST_LEVEL ? WORLDS.length : Math.floor((n - 1) / LEVELS_PER_WORLD); }
const isBoss = n => n % BOSS_EVERY === 0;
const isSpecial = n => n % 10 === 7;
const firstOfWorld = w => w * LEVELS_PER_WORLD + 1;
// palette, nom et thème d'un monde (COSMOS ∞ reprend la palette de Cosmos) ; lab = opacité des libellés secondaires
function worldInfo(w) {
  const inf = w >= WORLDS.length, b = WORLDS[inf ? WORLDS.length - 1 : Math.max(0, w)];
  return { w, id: inf ? 'infini' : b.id, name: inf ? ENDLESS.name : b.name, theme: inf ? ENDLESS.theme : b.theme, solid: b.solid,
    rgb: b.rgb, hi: b.hi, acc: b.acc, alert: b.alert, root: b.root, scale: b.scale, amb: b.amb, lab: labelAlpha(b.rgb, b.amb.glow, .65) };
}

/* ---------- niveaux ---------- */
function patSpeed(p, s, t) {
  switch (p) {
    case 1: return s * (.45 + .75 * (.5 + .5 * Math.sin(t * 1.6)));
    case 2: return s * 1.1 * Math.tanh(3 * (Math.sin(t * .9) + .3));
    case 3: return s * (.45 + .9 * Math.pow(Math.max(0, Math.sin(t * 1.8)), 6));
    case 4: return s * 1.5 * Math.max(0, Math.sin(t * 2.2) + .25) / 1.25;
    case 5: return s * (.5 + .8 * Math.sin(t * 1.3));
    default: return s;
  }
}
// mesure de l'union des arcs [a-half, a+half]
function unionMeasure(angles, half) {
  if (!angles.length) return 0;
  const s = angles.map(norm).sort((a, b) => a - b); let m = 0, st = s[0] - half, en = s[0] + half;
  for (let i = 1; i < s.length; i++) { if (s[i] - half <= en) en = Math.max(en, s[i] + half); else { m += en - st; st = s[i] - half; en = s[i] + half; } }
  m += en - st;
  const over = (en - TAU) - (s[0] - half); if (over > 0) m -= over;
  return clamp(m, 0, TAU);
}
function makeLevel(n) {
  n = Math.max(1, n | 0);
  const r = rng(n * 7919 + 17);
  // recette de la version 1 (5 niveaux par ancien monde, 8 anciens mondes puis cycles) ; le monde affiché est le nouveau
  const ow = Math.floor((n - 1) / 5), pos = (n - 1) % 5, boss = pos === 4, wd = { wi: ow % 8, cyc: Math.floor(ow / 8) };
  // difficulté : monte en douceur, plafonne, respire après chaque boss
  const d = clamp(1 - Math.exp(-(n - 1) / 26) + [-.12, -.04, .01, .05, .1][pos], 0, 1);
  let pat, mix, lay, sentN, trav;
  if (wd.cyc === 0) { const sp = SPEC[wd.wi][pos]; pat = sp[0]; mix = sp[1]; lay = sp[2]; sentN = sp[3] || 0; trav = sp[4] || 0; }
  else {
    pat = boss ? 2 + Math.floor(r() * 4) : Math.floor(r() * 6);
    mix = boss ? .2 + r() * .3 : r();
    const ls = boss ? ['sym', 'wall2', 'pairs'] : ['scatter', 'pairs', 'fan', 'wall', 'wall+', 'scatter'];
    lay = ls[Math.floor(r() * ls.length)];
    trav = r() < .22 ? 1 : 0;
    sentN = r() < .4 ? (r() < .4 ? 2 : 1) : 0;
    if (trav && sentN > 1) sentN = 1;
  }
  // budget de bloqueurs : jamais plus de 14 obstacles « utiles » sur l'astre (dense et lent, ou aéré et rapide)
  let T = Math.min(14, lerp(7 + 6 * d, 6 + 3.5 * d, mix) + (boss ? 1.5 : 0));
  if (n === 1) T = 6;
  const dir = r() < .5 ? 1 : -1, phase = r() * 10;
  const pre = [], walls = [], occ = [];
  const far = (a, sep) => occ.every(p => angDiff(p, a) > sep);
  const put = (sep) => { for (let i = 0; i < 300; i++) { const a = r() * TAU; if (far(a, sep)) return a; } return null; };
  const single = a => { pre.push(a); occ.push(a); };
  const wall = (a0, A) => { walls.push({ a0, a1: a0 + A }); const k = Math.ceil(A / (GAP * 1.9)); for (let i = 0; i <= k; i++) occ.push(a0 + A * i / k); };
  const scatter = k => { for (let i = 0; i < k; i++) { const a = put(.56); if (a != null) single(a); } };
  if (lay === 'scatter') scatter(trav ? Math.min(2, Math.round(.6 + 2 * d)) : clamp(Math.round(1 + 3.5 * d), 1, 5));
  else if (lay === 'pairs') { const np = 1 + Math.round(1.6 * d); for (let i = 0; i < np; i++) { const a = put(.95); if (a != null) { single(a - GAP * .8); single(a + GAP * .8); } } }
  else if (lay === 'fan') { const k = 3 + Math.round(2 * d), a0 = r() * TAU; for (let i = 0; i < k; i++) single(norm(a0 + (i - (k - 1) / 2) * .3)); }
  else if (lay === 'sym') { const k = trav ? 2 : 3 + Math.round(2.5 * d), a0 = r() * TAU, st = trav ? HPI : TAU / k; for (let i = 0; i < k; i++) single(norm(a0 + i * st)); }
  else if (lay === 'wall' || lay === 'wall+') { wall(r() * TAU, .45 + .3 * d); if (lay === 'wall+') scatter(Math.round(1 + 2 * d)); }
  else if (lay === 'wall2') { const a0 = r() * TAU, A = .4 + .15 * d; wall(a0, A); wall(a0 + Math.PI + (r() - .5) * .8, A); scatter(1 + Math.round(d)); }
  // charge déjà occupée, en « équivalent aiguilles » (une aiguille isolée interdit 3,4 × GAP au joueur prudent)
  const occAll = trav ? occ.concat(occ.map(a => a + Math.PI)) : occ;
  const eff = unionMeasure(occAll, GAP * 1.7) / (GAP * 3.4);
  let throws;
  if (trav) throws = clamp(Math.round((T - eff) / 2), 3, Math.min(6, Math.floor((16 - occ.length) / 2)));
  else throws = clamp(Math.round(T - eff), 4, Math.max(4, 16 - occ.length));
  // vitesse : déduite de la FENÊTRE DE TIR visée. Même avec un placement parfait, la dernière aiguille doit garder
  // au moins « tau » secondes de marge de part et d'autre ; tau fond en douceur de ~0,4 s vers un plancher de 0,1 s (0,08 s pour un boss),
  // et la vitesse reste bornée entre 1,3 et 2,9 rad/s quel que soit N.
  const tau = (.1 + .24 * Math.exp(-(n - 1) / 13)) * [1.18, 1.06, 1, .94, .8][pos] * (1 + .06 * sentN);
  const units = eff + throws * (trav ? 2 : 1);
  const v = clamp((Math.PI / Math.max(3, units - (trav ? 2 : 1)) - GAP) / tau, 1.3 + .35 * d, 2.9);
  const speed = Math.min(v / [1, .95, 1.1, .75, 1.15, 1.05][pat], pat === 3 ? 2.5 : 3);
  // étoiles bonus
  const orbN = n < 3 ? 1 : n < 11 ? 2 : 3, orbs = [];
  for (let pass = 0; pass < 2 && orbs.length < orbN; pass++) {
    const s1 = pass ? .3 : .42, s2 = pass ? .5 : .75;
    for (let i = 0; i < 500 && orbs.length < orbN; i++) { const a = r() * TAU; if (far(a, s1) && orbs.every(o => angDiff(o.a, a) > s2)) orbs.push({ a, hit: false }); }
  }
  // aiguilles traversantes : une étoile n'est gardée que si un impact sûr la capture (aiguille ET sortie opposée à plus de
  // 1,7 × GAP de tout bloqueur, marge du prédicteur) ; sinon elle glisse vers l'angle sûr le plus proche, ou disparaît.
  // Passe sans tirage aléatoire : le reste du niveau (sentinelles comprises) ne change pas.
  if (trav) {
    const both = occ.concat(occ.map(a => a + Math.PI)), M = GAP * 1.7;
    const clear = a => both.every(p => angDiff(p, a) >= M);
    const capturable = a => { for (let x = -ORBHIT * .9; x <= ORBHIT * .9 + 1e-9; x += .005) if (clear(a + x)) return true; return false; };
    for (let i = 0; i < orbs.length; i++) {
      const o = orbs[i];
      if (capturable(o.a)) continue;
      let to = -1;
      for (let k = 1; k <= 315 && to < 0; k++) for (const sg of [1, -1]) {
        const a = norm(o.a + sg * k * .01);
        if (clear(a) && orbs.every(q => q === o || angDiff(q.a, a) > .5)) { to = a; break; }
      }
      if (to >= 0) o.a = to; else orbs.splice(i--, 1);
    }
  }
  // sentinelles : arcs en orbite extérieure, à contre-sens
  const sents = [];
  if (sentN) { const a0 = r() * TAU, ws = -dir * (.65 + .3 * r()), hw = .2 + .08 * d; for (let i = 0; i < sentN; i++) sents.push({ a0: a0 + i * Math.PI, w: ws, hw }); }
  let vmax = .1; for (let i = 0; i < 160; i++) vmax = Math.max(vmax, Math.abs(patSpeed(pat, speed, i * .1)));
  return { n, w: worldOf(n), boss: isBoss(n), special: isSpecial(n), throws, pre, walls, orbs, sents, speed, pattern: pat, dir, phase, trav: !!trav, vmax, d, tau,
    blockers: (() => { const b = pre.map(a => ({ a: norm(a), pre: true, k: 1 })); for (const wl of walls) { const A = wl.a1 - wl.a0, k = Math.ceil(A / (GAP * 1.9)); for (let i = 0; i <= k; i++) b.push({ a: norm(wl.a0 + A * i / k), pre: true, wall: true, k: 1 }); } return b; })() };
}
function speedAt(t) { return L ? patSpeed(L.pattern, L.speed * L.dir, t) : 0; }

// arcs libres du bord : complément des zones interdites (±GAP autour de chaque bloqueur)
function computeArcs(list) {
  if (!list.length) return [[0, TAU]];
  const s = list.map(q => norm(q.a)).sort((a, b) => a - b), bl = [];
  let st = s[0] - GAP, en = s[0] + GAP;
  for (let i = 1; i < s.length; i++) { if (s[i] - GAP <= en) en = Math.max(en, s[i] + GAP); else { bl.push([st, en]); st = s[i] - GAP; en = s[i] + GAP; } }
  bl.push([st, en]);
  if (bl.length > 1 && bl[bl.length - 1][1] - TAU >= bl[0][0]) { bl[0][0] = bl[bl.length - 1][0] - TAU; bl.pop(); }
  const free = [];
  for (let i = 0; i < bl.length; i++) { const a = bl[i][1], b = i + 1 < bl.length ? bl[i + 1][0] : bl[0][0] + TAU; if (b - a > .004) free.push([a, b]); }
  return free;
}
