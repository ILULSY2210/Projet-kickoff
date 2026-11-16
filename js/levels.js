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

/* ---------- lois de rotation ---------- */
// 0 continue, 1 respirante, 2 alternée (inversions douces), 3 à-coups, 4 pas à pas (arrêts francs, rampes lisses),
// 5 ressac (retours en arrière)
function patSpeed(p, s, t) {
  switch (p) {
    case 1: return s * (.45 + .75 * (.5 + .5 * Math.sin(t * 1.6)));
    case 2: return s * 1.1 * Math.tanh(3 * (Math.sin(t * .9) + .3));
    case 3: return s * (.45 + .9 * Math.pow(Math.max(0, Math.sin(t * 1.8)), 6));
    case 4: { // pas à pas : départ en 0,25 s, palier de 1,35 s, arrêt en 0,25 s, pause de 0,75 s (rampes lisses)
      const u = ((t % 2.6) + 2.6) % 2.6, sm = x => x * x * (3 - 2 * x);
      return s * 1.6 * (u < .25 ? sm(u / .25) : u < 1.6 ? 1 : u < 1.85 ? sm((1.85 - u) / .25) : 0);
    }
    case 5: return s * (.5 + .8 * Math.sin(t * 1.3));
    default: return s;
  }
}
// vitesse moyenne |v| de chaque loi pour s = 1 : la vitesse d'un niveau (ω, table DIFFICULTY) est une vitesse moyenne
// (arrondies : les fonctions sin, tanh, pow peuvent différer d'un dernier bit d'un moteur JavaScript à l'autre)
const LAW_MEAN = (() => { const m = []; for (let p = 0; p < 6; p++) { let a = 0; for (let i = 0; i < 20000; i++) a += Math.abs(patSpeed(p, 1, i * .005)); m.push(Math.round(a / 20000 * 1e9) / 1e9); } return m; })();
// multiplicateur d'accélération à l'instant t : × (1 + k) par aiguille plantée, atteint en ACC_RAMP s après l'impact
// (rampe lisse : vitesse continue), plafonné à cap
const ACC_RAMP = .3, smooth01 = x => x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x);
function accelMult(t) {
  const A = L.accel, H = dyn.hits; let m = 1;
  for (let i = 0; i < H.length; i++) m *= 1 + A.k * smooth01((t - H[i]) / ACC_RAMP);
  return m < A.cap ? m : A.cap;
}
function speedAt(t) {
  if (!L) return 0;
  let v = patSpeed(L.pattern, L.speed * L.dir, t);
  if (L.accel) v *= accelMult(t);
  return v;
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

/* ---------- générateur v2 ---------- */
// Une idée à la fois : un niveau n'utilise que les idées apprises à un niveau d'apprentissage ≤ n (TEACH), parmi celles
// déjà réalisées (IMPL) ; un niveau d'apprentissage isole son idée (3 à 5 aiguilles, vitesse modérée).
const IMPL_SET = new Set(IMPL), LEARN = [];
function learnedAt(n) {
  n = Math.min(n, LAST_LEVEL + 1);
  if (!LEARN[n]) { const s = new Set(); for (const k in TEACH) if (+k <= n && IMPL_SET.has(TEACH[k])) s.add(TEACH[k]); LEARN[n] = s; }
  return LEARN[n];
}
const teachOf = n => TEACH[n] && IMPL_SET.has(TEACH[n]) ? TEACH[n] : null;
const specialType = n => SPECIALS[Math.floor((n - 7) / 10) % 3];
const bossArch = n => (Math.floor(n / 10) - 1) % 5;
// difficulté d'un niveau dans son monde, 0..1 : montée par blocs de 10 en dents de scie (respirations en x1-x2)
function levelD(n) {
  if (n > LAST_LEVEL) return 1;
  const k = (n - 1) % LEVELS_PER_WORLD, blk = Math.floor(k / 10), pos = k % 10;
  return clamp(.18 * blk + .1 + .2 * DIFFICULTY.pos[pos], 0, 1);
}
// arcs interdits fixes : bloqueurs invisibles espacés de ≤ 1,9 × GAP (règle d'atterrissage inchangée)
function wallPoints(a0, A) { const k = Math.ceil(A / (GAP * 1.9)), o = []; for (let i = 0; i <= k; i++) o.push(a0 + A * i / k); return o; }
// charge fixe du bord en « équivalents aiguilles » : une aiguille isolée interdit 3,4 × GAP au joueur prudent
function fixedUnits(points, trav) { const all = trav ? points.concat(points.map(a => a + Math.PI)) : points; return unionMeasure(all, GAP * 1.7) / (GAP * 3.4); }

function makeLevel(n) {
  n = Math.max(1, n | 0);
  const r = rng(n * 7919 + 17 + GEN_VERSION * 104729);
  const pick = (arr, wts) => { let tot = 0; for (let i = 0; i < arr.length; i++) tot += wts ? wts[i] : 1; let x = r() * tot; for (let i = 0; i < arr.length; i++) { x -= wts ? wts[i] : 1; if (x < 0) return arr[i]; } return arr[arr.length - 1]; };
  const w = worldOf(n), wi = Math.min(w, WORLDS.length - 1), DW = DIFFICULTY.worlds[wi], d = levelD(n);
  const boss = isBoss(n), special = !boss && isSpecial(n), sp = special ? specialType(n) : null;
  const teach = teachOf(n), known = learnedAt(n), has = f => known.has(f);
  const inf = n > LAST_LEVEL;
  // --- recette : loi, sens, obstacles, intensité ---
  const R = { law: 0, dir: 1, layout: 'scatter', zones: [], fentes: false, sent: 0, trav: false, orbs: 0, N: 4, F: 0, omega: 1, accel: null };
  R.N = Math.round(lerp(DW.throws[0], DW.throws[1], d)); R.F = lerp(DW.fixed[0], DW.fixed[1], d); R.omega = lerp(DW.speed[0], DW.speed[1], d);
  R.dir = has('sens') ? (r() < .5 ? 1 : -1) : 1;
  R.orbs = has('etoiles') ? (n < 11 ? 2 : 3) : 0;
  const laws = [0], lw = [3];
  if (has('respiration')) { laws.push(1); lw.push(wi === 0 ? 3 : 1); }
  if (has('acoups')) { laws.push(3); lw.push(wi === 1 ? 3 : wi === 2 ? 2 : 1); }
  if (has('arrets')) { laws.push(4); lw.push(wi === 1 ? 3 : wi === 2 ? 2 : 1); }
  if (has('alternee')) { laws.push(2); lw.push(wi === 3 ? 4 : 1.5); }
  if (has('ressac')) { laws.push(5); lw.push(wi === 3 ? 4 : 1.5); }
  if (wi >= 3) lw[0] = 1;
  if (teach) {
    // niveau d'apprentissage : l'idée seule, courte et lente ; le reste au plus simple
    R.N = 3 + Math.floor(r() * 3); R.F = n < 3 ? 0 : 1.5 + r(); R.omega = DW.speed[0] * (n < 5 ? .9 : .95);
    if (n === 1) R.N = 4;
    if (n === 2 || n === 3) { R.N = 4; R.F = 2; }
    if (n === 3) R.orbs = 1;
    if (teach === 'sens') R.dir = -1;
    const lawOf = { respiration: 1, acoups: 3, arrets: 4, alternee: 2, ressac: 5 };
    if (teach in lawOf) R.law = lawOf[teach];
    if (teach === 'serre') { R.layout = 'pairs'; R.F = 3; }
    if (teach === 'zone') { R.zones = [.45]; R.F = 2.2; }
    if (teach === 'fentes') { R.fentes = true; R.F = 4; }
    if (teach === 'sentinelle') R.sent = 1;
    if (teach === 'traversantes') { R.trav = true; R.N = 3; R.F = 1; }
    if (teach === 'accel') { R.N = 5; R.accel = { k: .1, cap: 1.5 }; }
  } else if (boss) {
    const B = BOSSES[bossArch(n)], tier = Math.min(wi, 5);
    R.N = B.throws[tier]; R.omega = B.speed[tier]; R.F = 0; R.orbs = has('etoiles') ? 3 : 0;
    const arch = B.id;
    if (arch === 'reacteur' && has('accel')) R.accel = { k: Math.pow(B.top[tier] / B.speed[tier], 1 / R.N) - 1, cap: B.top[tier] / B.speed[tier] };
    if (arch === 'reacteur') { if (tier === 1 && has('acoups')) R.law = 3; if (tier === 3 && has('alternee')) R.law = 2; if (tier === 2 || tier === 5) R.F = 2; if (tier >= 4 && has('sentinelle')) R.sent = 1; }
    if (arch === 'pendule') { if (tier >= 1) R.F = 2; if (tier === 2) R.zones = [.4]; if (tier >= 4 && has('sentinelle')) R.sent = 1; }
    if (arch === 'forteresse') { R.zones = tier === 1 ? [.3, .3, .3] : tier === 0 ? [.45, .45] : [.4, .4]; if (tier === 4 && has('sentinelle')) R.sent = 1; }
    if (arch === 'anneaux') { R.F = 2; if (tier === 2) R.zones = [.4]; if (tier === 3 && has('alternee')) R.law = 2; if (tier >= 4 && has('sentinelle')) R.sent = 1; }
    if (arch === 'chaos') { R.law = has('alternee') ? 2 : has('respiration') ? 1 : 0; R.F = 2; if (tier >= 4 && has('sentinelle')) R.sent = 1; }
    R.F += R.zones.length * 2;
  } else {
    R.law = pick(laws, lw);
    if (has('serre') && r() < .35) R.layout = r() < .5 ? 'pairs' : 'fan';
    else if (r() < .25) R.layout = 'sym';
    // zones interdites : idée d'Émeraude (29), cœur de Rubis
    const zp = !has('zone') ? 0 : wi === 0 ? .35 : wi === 2 ? .75 : .45;
    if (has('fentes') && r() < (wi === 2 ? .4 : .2)) R.fentes = true;
    else if (r() < zp) R.zones = r() < .3 && wi >= 1 ? [.35, .3] : [.35 + .2 * r()];
    if (has('sentinelle') && r() < (wi >= 4 ? .55 : .2)) R.sent = 1;
    // accélération à chaque aiguille : idée d'Émeraude (9), cœur d'Ambre
    if (has('accel') && r() < (wi === 1 ? .55 : .25)) R.accel = { k: .03 + .04 * d, cap: 1.25 + .3 * d };
    if (has('traversantes') && r() < (wi >= 4 ? .3 : .15)) R.trav = true;
    // anti-salve (à partir du monde 2) : au moins deux moyens parmi zones larges, loi à arrêts ou inversions,
    // obstacles mobiles ; à défaut, on ajoute ceux qui sont appris
    if (wi >= 1) {
      const A = () => (R.zones.length || R.fentes ? 1 : 0), Bm = () => ([2, 4, 5].includes(R.law) ? 1 : 0), C = () => (R.sent ? 1 : 0);
      if (A() + Bm() + C() < 2 && has('zone') && !A()) R.zones = [.35 + .15 * r()];
      if (A() + Bm() + C() < 2) { const stops = laws.filter(x => [2, 4, 5].includes(x)); if (stops.length) R.law = stops[Math.floor(r() * stops.length)]; }
    }
    if (special && sp === 'chrono') { R.law = 0; R.omega = lerp(DW.speed[0], DW.speed[1], Math.min(1, d + .3)); R.F = Math.max(R.F, 3); }
    if (special && sp === 'parfait') { R.N = 6; R.F = Math.max(R.F, 2); }
    if (special && sp === 'pluie' && has('etoiles')) R.orbs = 6 + Math.floor(r() * 4);
    if (inf) { R.omega *= .92 + .16 * r(); }
  }
  // --- placement : zones, puis bloqueurs jusqu'à la charge visée, dans la limite de la capacité ---
  const trav = !!R.trav, pre = [], walls = [], occ = [];
  const far = (a, sep) => occ.every(p => angDiff(p, a) > sep) && (!trav || occ.every(p => angDiff(p + Math.PI, a) > sep));
  const put = sep => { for (let i = 0; i < 300; i++) { const a = r() * TAU; if (far(a, sep)) return a; } return null; };
  const single = a => { pre.push(norm(a)); occ.push(norm(a)); };
  const wall = (a0, A) => { const pts = wallPoints(a0, A); walls.push({ a0, a1: a0 + A, pts }); for (const p of pts) occ.push(p); };
  if (R.fentes) {
    // fentes : trois zones séparées par des passages de 3 à 4 GAP
    const A = .26, gap = GAP * (3 + r()); let a = r() * TAU;
    for (let i = 0; i < 3; i++) { wall(a, A); a += A + gap; }
  }
  for (const A of R.zones) { const a = put(.9); if (a != null) wall(a, A); }
  const cap = DIFFICULTY.capacity, unitsNow = () => fixedUnits(occ, trav);
  let blk = Math.max(0, Math.round(R.F - unitsNow()));
  if (n === 1) blk = 0;
  if (R.layout === 'pairs' && blk >= 2) { const np = Math.floor(blk / 2); for (let i = 0; i < np; i++) { const a = put(1); if (a != null) { single(a - GAP * .8); single(a + GAP * .8); } } blk -= 2 * np; }
  else if (R.layout === 'fan' && blk >= 3) { const k = Math.min(blk, 5), a0 = put(1.2); if (a0 != null) for (let i = 0; i < k; i++) single(a0 + (i - (k - 1) / 2) * .3); blk -= k; }
  else if (R.layout === 'sym' && blk >= 2) { const k = Math.min(blk, 5), a0 = r() * TAU; for (let i = 0; i < k; i++) { const a = norm(a0 + i * TAU / k); if (far(a, .3)) single(a); } blk = 0; }
  for (let i = 0; i < blk; i++) { const a = put(.56); if (a != null) single(a); }
  // capacité : tirs (doublés pour les traversantes) + obstacles fixes ≤ 14
  let fixed = unitsNow(), throws = R.N;
  const per = trav ? 2 : 1;
  while (throws * per + fixed > cap && pre.length) { const x = pre.pop(); occ.splice(occ.indexOf(x), 1); fixed = unitsNow(); }
  while (throws * per + fixed > cap && throws > 4) throws--;
  while (throws * per + fixed > cap && walls.length > 1) { const wl = walls.pop(); for (const p of wl.pts) occ.splice(occ.indexOf(p), 1); fixed = unitsNow(); if (R.fentes) R.fentes = walls.length > 1; }
  while (throws * per + fixed > cap && throws > 3) throws--;
  for (const wl of walls) delete wl.pts;
  // --- vitesse : ω moyenne (facteur de réglage par niveau), normalisée par la loi ---
  const omega = R.omega * (DIFFICULTY.tune[n] || 1), speed = omega / LAW_MEAN[R.law];
  const dir = R.dir, phase = r() * 10;
  // --- étoiles bonus : loin des obstacles ; pour les traversantes, seulement là où une capture sûre existe ---
  const orbs = [];
  for (let pass = 0; pass < 2 && orbs.length < R.orbs; pass++) {
    const s1 = pass ? .3 : .42, s2 = R.orbs > 3 ? .45 : pass ? .5 : .75;
    for (let i = 0; i < 500 && orbs.length < R.orbs; i++) { const a = r() * TAU; if (far(a, s1) && orbs.every(o => angDiff(o.a, a) > s2)) orbs.push({ a, hit: false }); }
  }
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
  // --- sentinelles : arcs en orbite extérieure, à contre-sens de l'astre ---
  const sents = [];
  if (R.sent) { const a0 = r() * TAU, ws = -dir * (.65 + .3 * r()) * (1 + .25 * d), hw = .2 + .08 * d; for (let i = 0; i < R.sent; i++) sents.push({ a0: a0 + i * Math.PI, w: ws, hw }); }
  // --- orientation de départ (anti-salve) : le plus gros obstacle passe sous le pas de tir 0,2 à 1,5 s après le départ ---
  let rot0 = 0;
  if (occ.length) {
    const tgt = .25 + r() * .9 + FLIGHT;
    let R0 = 0, tt = phase; const h = .005;
    for (let x = 0; x < tgt; x += h) { R0 += h * (patSpeed(R.law, speed * dir, tt) + patSpeed(R.law, speed * dir, tt + h)) / 2; tt += h; }
    const c = walls.length ? (walls[0].a0 + walls[0].a1) / 2 : pre[Math.floor(r() * pre.length)];
    rot0 = Math.round(norm(HPI - R0 - c) * 1e9) / 1e9;   // arrondi : identique d'un moteur JavaScript à l'autre
  }
  let vmax = .1; for (let i = 0; i < 160; i++) vmax = Math.max(vmax, Math.abs(patSpeed(R.law, speed, i * .1)));
  if (R.accel) { R.accel.k = Math.round(R.accel.k * 1e6) / 1e6; R.accel.cap = Math.round(R.accel.cap * 1e6) / 1e6; vmax *= R.accel.cap; }
  vmax = Math.round(vmax * 1e6) / 1e6;
  const blockers = pre.map(a => ({ a: norm(a), pre: true, k: 1 }));
  for (const wl of walls) for (const p of wallPoints(wl.a0, wl.a1 - wl.a0)) blockers.push({ a: norm(p), pre: true, wall: true, k: 1 });
  const lv = { n, w, boss, special, sp, teach, throws, pre, walls, orbs, sents, speed, omega, pattern: R.law, dir, phase, rot0, trav, vmax, d,
    layout: R.layout, fentes: R.fentes, fixed: +fixed.toFixed(3), accel: R.accel, blockers };
  lv.flags = levelFlags(lv);
  return lv;
}
// idées présentes dans un niveau (test « une idée à la fois », bandeaux de règle)
function levelFlags(lv) {
  const f = ['lancer'];
  if (lv.pre.length) f.push('bloqueurs');
  if (lv.orbs.length) f.push('etoiles');
  if (lv.dir < 0) f.push('sens');
  if (LAW_FLAG[lv.pattern]) f.push(LAW_FLAG[lv.pattern]);
  if (lv.layout === 'pairs' || lv.layout === 'fan') f.push('serre');
  if (lv.walls.length) f.push('zone');
  if (lv.fentes) f.push('fentes');
  if (lv.sents.length) f.push('sentinelle');
  if (lv.trav) f.push('traversantes');
  if (lv.accel) f.push('accel');
  return f;
}
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
