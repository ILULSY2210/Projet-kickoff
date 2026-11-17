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
// 6 irrégulière : somme de 2 ou 3 sinusoïdes de fréquences non multiples (paramètres du niveau P : b, a[], f[], p[])
function patSpeed(p, s, t, P) {
  switch (p) {
    case 6: { let v = P.b; for (let i = 0; i < P.a.length; i++) v += P.a[i] * Math.sin(P.f[i] * t + P.p[i]); return s * v; }
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
// rampe : l'astre accélère avec le temps, de × 1 à × (1 + k) en T secondes depuis le départ du niveau (courbe lisse)
function rampMult(t) { return 1 + L.ramp.k * smooth01((t - L.phase) / L.ramp.T); }
// demi-tours : chacun inverse la rotation en FLIP_T s (rampe lisse). Ceux qui suivent les impacts (toutes les k aiguilles)
// sont notés dans dyn.flips au moment de l'impact, pour un instant à venir (annonce de warn s) ; ceux du rythme tombent aux
// instants t0 + j·P (j ≥ 0)
const FLIP_T = .08;
function flipSign(t) {
  let s = 1;
  const F = dyn.flips;
  for (let i = 0; i < F.length; i++) if (t > F[i]) s *= 1 - 2 * smooth01((t - F[i]) / FLIP_T);
  const R = L.rhythm;
  if (R && t > R.t0) { const j = Math.floor((t - R.t0) / R.P); s *= (j % 2 ? -1 : 1) * (1 - 2 * smooth01((t - R.t0 - j * R.P) / FLIP_T)); }
  return s;
}
function speedAt(t) {
  if (!L) return 0;
  let v = patSpeed(L.pattern, L.speed * L.dir, t, L.irr);
  if (L.accel) v *= accelMult(t);
  if (L.ramp) v *= rampMult(t);
  if (L.demi || L.rhythm || L.inv) v *= flipSign(t);
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
// anneaux réglés par leur fenêtre de passage W (s) et leur période Tp (s) : vitesse et largeur de porte (n portes)
function ringWin(R, W, Tp, n) { R.gates = n; R.ringV = TAU / (n * Tp); R.gateW = W * R.ringV + 2 * RING_PAD[0]; R.ringW = W; }
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

// COSMOS ∞ : les niveaux 301-400 forment une réserve réglée et vérifiée niveau par niveau (DIFFICULTY.tune, tests/sim) ;
// au-delà, le niveau n rejoue le niveau 301 + (n − 301) mod 100 (boss et spéciaux restent à leur place), en miroir un cycle
// sur deux. Le miroir (symétrie gauche-droite de toute la scène, sens de rotation inversé) est exact : même difficulté,
// autre dessin. Aucun niveau sans fin n'échappe ainsi à la mesure du plancher d'équité.
const ENDLESS_POOL = 100;
function makeLevel(n) {
  n = Math.max(1, n | 0);
  if (n <= LAST_LEVEL + ENDLESS_POOL) return genLevel(n);
  const k = LAST_LEVEL + 1 + (n - LAST_LEVEL - 1) % ENDLESS_POOL, cyc = Math.floor((n - LAST_LEVEL - 1) / ENDLESS_POOL);
  const lv = genLevel(k);
  if (cyc % 2) mirrorLevel(lv);
  lv.n = n; lv.src = k; lv.mirror = cyc % 2 === 1;
  return lv;
}
// symétrie par rapport à l'axe vertical de l'écran (le pas de tir est sur l'axe) : un angle a du repère de l'astre devient
// −a, la rotation rot devient π − rot et toutes les vitesses changent de signe (sens de rotation, anneaux, sentinelles,
// zones glissantes) ; les instants (lois, demi-tours, portes pulsées, zones pulsées) ne changent pas
function mirrorLevel(lv) {
  const m = a => Math.round(norm(-a) * 1e9) / 1e9, mp = a => Math.round(norm(Math.PI - a) * 1e9) / 1e9;
  lv.dir = -lv.dir; lv.rot0 = mp(lv.rot0);
  lv.pre = lv.pre.map(m);
  lv.walls = lv.walls.map(wl => { const a0 = m(wl.a1); return { a0, a1: a0 + (wl.a1 - wl.a0) }; });
  lv.blockers = lv.blockers.map(b => Object.assign({}, b, { a: m(b.a) }));
  lv.orbs = lv.orbs.map(o => ({ a: m(o.a), hit: false }));
  lv.sents = lv.sents.map(q => ({ a0: mp(q.a0), w: -q.w, hw: q.hw }));
  lv.zones = lv.zones.map(z => Object.assign({}, z, { c: m(z.c) }, z.kind === 'glide' ? { w: -z.w } : {}));
  lv.rings = lv.rings.map(q => Object.assign({}, q, { a0: mp(q.a0), w: -q.w, gates: q.gates.map(g => ({ c: m(g.c), h: g.h })) }));
  lv.flags = levelFlags(lv);
  return lv;
}
function genLevel(n) {
  const r = rng(n * 7919 + 17 + GEN_VERSION * 104729);
  const pick = (arr, wts) => { let tot = 0; for (let i = 0; i < arr.length; i++) tot += wts ? wts[i] : 1; let x = r() * tot; for (let i = 0; i < arr.length; i++) { x -= wts ? wts[i] : 1; if (x < 0) return arr[i]; } return arr[arr.length - 1]; };
  const w = worldOf(n), wi = Math.min(w, WORLDS.length - 1), DW = DIFFICULTY.worlds[wi], d = levelD(n);
  const boss = isBoss(n), special = !boss && isSpecial(n), sp = special ? specialType(n) : null;
  const teach = teachOf(n), known = learnedAt(n), has = f => known.has(f);
  const inf = n > LAST_LEVEL;
  // --- recette : loi, sens, obstacles, intensité ---
  const R = { law: 0, dir: 1, layout: 'scatter', zones: [], fentes: false, sent: 0, trav: false, orbs: 0, N: 4, F: 0, omega: 1, accel: null, demi: null, rhythm: null, inv: false, ramp: null, irr: null, pulse: 0, glide: 0, rings: 0, gateW: .9, gates: 3, ringV: .6, gatePulse: false };
  R.N = Math.round(lerp(DW.throws[0], DW.throws[1], d)); R.F = lerp(DW.fixed[0], DW.fixed[1], d); R.omega = lerp(DW.speed[0], DW.speed[1], d);
  R.dir = has('sens') ? (r() < .5 ? 1 : -1) : 1;
  R.orbs = has('etoiles') ? (n < 11 ? 2 : 3) : 0;
  const laws = [0], lw = [3];
  if (has('respiration')) { laws.push(1); lw.push(wi === 0 ? 3 : 1); }
  if (has('acoups')) { laws.push(3); lw.push(wi === 1 ? 3 : wi === 2 ? 2 : 1); }
  if (has('arrets')) { laws.push(4); lw.push(wi === 1 ? 3 : wi === 2 ? 2 : 1); }
  if (has('alternee')) { laws.push(2); lw.push(wi === 3 ? 4 : 1.5); }
  if (has('ressac')) { laws.push(5); lw.push(wi === 3 ? 4 : 1.5); }
  if (has('irreg')) { laws.push(6); lw.push(wi >= 5 ? 2.5 : 1); }
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
    if (teach === 'sentinelles2') { R.sent = 2; R.N = 4; }
    if (teach === 'traversantes') { R.trav = true; R.N = 3; R.F = 1; }
    if (teach === 'accel') { R.N = 5; R.accel = { k: .1, cap: 1.5 }; }
    if (teach === 'demitour') { R.N = 5; R.demi = { every: 2, warn: .9 }; }
    if (teach === 'rythme') { R.N = 5; R.rhythm = { P: 3, warn: .6 }; }
    if (teach === 'invImpact') { R.N = 5; R.inv = true; }
    if (teach === 'rampe') { R.N = 5; R.ramp = { k: .6, T: 12 }; }
    if (teach === 'irreg') { R.N = 5; R.law = 6; R.irr = 2; }
    if (teach === 'pulse') { R.N = 5; R.pulse = 1; }
    if (teach === 'glisse') { R.N = 5; R.glide = 1; }
    if (teach === 'anneau') { R.N = 5; R.rings = 1; ringWin(R, 1.3, 2.8, 3); }
    if (teach === 'anneaux2') { R.N = 5; R.rings = 2; ringWin(R, .85, 2.5, 3); }
    if (teach === 'anneaux3') { R.N = 5; R.rings = 3; ringWin(R, .8, 2.5, 3); }
    if (teach === 'portesPulsees') { R.N = 5; R.rings = 1; ringWin(R, .8, 2.4, 3); R.gatePulse = true; }
    // à partir du monde 2, un anneau aussi sur les niveaux d'apprentissage (anti-salve : 3 à 5 aiguilles passent trop
    // facilement à l'aveugle) ; idée déjà apprise, l'idée nouvelle reste la seule nouveauté
    // (fenêtre de 0,45 s qui revient toutes les 1,3 s : plus courte qu'une salve de 5 aiguilles, mais souvent offerte)
    if (wi >= 1 && has('anneau')) { if (!R.rings) { R.rings = 1; ringWin(R, .45, 1.3, 3); } R.N = 5; }
  } else if (boss) {
    const B = BOSSES[bossArch(n)], tier = Math.min(wi, 5);
    R.N = B.throws[tier]; R.omega = B.speed[tier]; R.F = 0; R.orbs = has('etoiles') ? 3 : 0;
    const arch = B.id;
    if (arch === 'reacteur' && has('accel')) R.accel = { k: Math.pow(B.top[tier] / B.speed[tier], 1 / R.N) - 1, cap: B.top[tier] / B.speed[tier] };
    if (arch === 'reacteur') { if (tier === 1 && has('acoups')) R.law = 3; if (tier === 3 && has('alternee')) R.law = 2; if (tier === 2 || tier === 5) R.F = 2; if (tier >= 4 && has('sentinelle')) R.sent = 1; }
    if (arch === 'pendule' && has('demitour')) { R.demi = { every: B.every[tier], warn: B.warn[tier] }; if (tier >= 3 && has('rythme')) R.rhythm = { P: [3, 2.5, 2.2][tier - 3], warn: B.warn[tier] }; }
    if (arch === 'pendule') { R.F = tier >= 1 ? 2 : 3; if (tier === 2) R.zones = [.4]; if (tier >= 4 && has('sentinelle')) R.sent = 1; }
    if (arch === 'forteresse' && tier === 1 && has('rampe')) R.ramp = { k: .5, T: 15 };
    if (arch === 'forteresse') { R.zones = tier === 1 ? [.3, .3, .3] : tier === 0 ? [.45, .45] : [.4, .4]; if (tier === 4 && has('sentinelle')) R.sent = 1; if (has('pulse')) R.pulse = [0, 0, 1, 1, 2, 3][tier]; if (tier === 3 && has('glisse')) R.glide = 1; }
    if (arch === 'anneaux') { R.F = 2; if (tier === 2) R.zones = [.4]; if (tier === 3 && has('alternee')) R.law = 2; if (tier >= 4 && has('sentinelle')) R.sent = 1; }
    if (arch === 'anneaux' && has('anneau')) {
      R.rings = tier === 0 ? 1 : tier === 5 && has('anneaux3') ? 3 : has('anneaux2') ? 2 : 1;
      ringWin(R, [1.1, .55, .5, .48, .46, .45][tier], [2.8, 2.4, 2.3, 2.2, 2.1, 2.6][tier], tier === 5 ? 2 : 3); R.gatePulse = tier === 5 && has('portesPulsees');
    }
    // à partir du palier II, un anneau sur les boss qui n'ont ni anneau ni sentinelle (anti-salve)
    if (tier >= 1 && arch !== 'anneaux' && arch !== 'chaos' && has('anneau')) { R.rings = 1; ringWin(R, .6, 2.2, 3); }
    if (arch === 'chaos' && has('anneau') && tier >= 1 && tier !== 4) { R.rings = tier >= 3 && has('anneaux2') ? 2 : 1; ringWin(R, .7 - .03 * tier, 2.4 - .1 * tier, 3); }
    if (arch === 'chaos') { R.law = has('irreg') ? 6 : has('alternee') ? 2 : has('respiration') ? 1 : 0; R.irr = tier === 0 ? 2 : tier === 5 ? 4 : 3; R.F = 2; if (tier >= 4 && has('sentinelle')) R.sent = has('sentinelles2') ? 2 : 1; }
    R.F += R.zones.length * 2;
  } else {
    R.law = pick(laws, lw);
    if (R.law === 6) R.irr = d < .5 ? 2 : 3;
    if (has('serre') && r() < .35) R.layout = r() < .5 ? 'pairs' : 'fan';
    else if (r() < (wi === 0 ? .7 : .25)) R.layout = 'sym';
    // zones interdites : idée d'Émeraude (29), cœur de Rubis
    const zp = !has('zone') ? 0 : wi === 0 ? .5 : wi === 2 ? .75 : .45;
    if (has('fentes') && r() < (wi === 2 ? .4 : .2)) R.fentes = true;
    else if (r() < zp) R.zones = r() < .3 && wi >= 1 ? [.35, .3] : [.35 + .2 * r()];
    if (has('sentinelle') && r() < (wi >= 4 ? .55 : .2)) R.sent = has('sentinelles2') && r() < (wi >= 4 ? .4 : .2) ? 2 : 1;
    // accélération à chaque aiguille : idée d'Émeraude (9), cœur d'Ambre
    if (has('accel') && r() < (wi === 1 ? .55 : .25)) R.accel = { k: .03 + .04 * d, cap: 1.25 + .3 * d };
    // anneaux à portes (39), deux à contre-sens (81), trois (251), portes pulsées (261) : cœur de Cosmos
    // À partir du monde 2, chaque niveau a au moins un anneau (anti-salve : une salve aveugle ne tient pas dans une fenêtre
    // de passage de 0,45 à 0,75 s qui revient toutes les ~2 s ; plan, 5.10)
    if (has('anneau') && (wi >= 1 || r() < .4)) {
      R.rings = has('anneaux3') && r() < (wi >= 5 ? .3 : .12) ? 3 : has('anneaux2') && r() < (wi >= 5 ? .45 : .25) ? 2 : 1;
      // fenêtre plus courte qu'une salve de N aiguilles à 100 ms
      // (période de passage courte à partir du monde 2 : l'attente d'une fenêtre ne doit pas allonger le niveau)
      // (Obsidienne, Cosmos et COSMOS ∞ : fenêtres plus courtes mais régulières, 0,45 → 0,35 s : elles punissent l'imprécision
      // plus que la vitesse brute, plan 5.10)
      if (wi === 0) ringWin(R, lerp(1.2, .8, d), 2, 3);
      else if (wi >= 4) ringWin(R, inf ? .35 : wi === 4 ? lerp(.45, .38, d) : lerp(.4, .35, d), lerp(1.35, 1.1, d), 3);
      else ringWin(R, clamp(Math.min(lerp(.6, .45, d), (R.N - 1.2) * .1), .42, .6), lerp(1.35, 1.1, d), 3);
      R.gatePulse = has('portesPulsees') && r() < .35;
    }
    // zones pulsées (111) : cœur de Rubis
    if (has('pulse') && r() < (wi === 2 ? .45 : .15)) R.pulse = d > .6 && r() < .5 ? 2 : 1;
    // zone glissante (121) : elle passe sur les aiguilles plantées sans effet
    if (has('glisse') && r() < (wi === 2 ? .35 : .12)) R.glide = 1;
    // rampe (71) : cœur d'Ambre, plutôt sans accélération à l'impact
    if (has('rampe') && !R.accel && r() < (wi === 1 ? .45 : .15)) R.ramp = { k: .35 + .35 * d, T: 10 + 10 * r() };
    // demi-tours annoncés : toutes les k aiguilles (19), au rythme (161) ; cœur de Saphir
    const pd = wi === 3 ? .4 : .2;
    if (has('invImpact') && r() < (wi === 3 ? .3 : .12)) R.inv = true;
    else if (has('rythme') && r() < pd) R.rhythm = { P: 3.2 - .8 * d, warn: Math.max(.45, .7 - .2 * d) };
    else if (has('demitour') && r() < pd) R.demi = { every: d < .5 ? 3 : 2, warn: Math.max(.45, .9 - .4 * d - .1 * wi) };
    // (moins souvent dans les deux derniers mondes : leurs aiguilles remplissent le bord à 7 tirs, et la vitesse plafond
    // ne les rend pas assez durs pour la fin du jeu)
    if (has('traversantes') && r() < (wi >= 5 ? .06 : wi === 4 ? .12 : .15)) { R.trav = true; R.N = Math.max(R.N, 6); R.zones = []; R.fentes = false; }
    // traversantes des deux derniers mondes : deux anneaux (leurs aiguilles remplissent déjà le bord, la difficulté vient
    // des obstacles mobiles)
    if (R.trav && wi >= 4 && has('anneaux2')) R.rings = Math.max(R.rings, 2);
    // une seule source d'arrêts ou d'inversions par niveau : une loi à arrêts ou inversions (alternée, pas à pas, ressac)
    // OU des demi-tours (toutes les k aiguilles, au rythme, à l'impact), jamais les deux (deux systèmes d'annonce à lire
    // en même temps : le joueur qui n'anticipe pas décrochait, plan 5.10)
    if ((R.demi || R.rhythm || R.inv) && [2, 4, 5].includes(R.law)) {
      if (r() < .5) { R.demi = null; R.rhythm = null; R.inv = false; }
      else { const calm = laws.filter(x => x === 0 || x === 1 || x === 3); R.law = calm[Math.floor(r() * calm.length)]; }
    }
    // anti-salve (à partir du monde 2) : au moins deux moyens parmi zones larges, loi à arrêts ou inversions,
    // obstacles mobiles ; à défaut, on ajoute ceux qui sont appris
    if (wi >= 1) {
      const A = () => (R.zones.length || R.fentes ? 1 : 0), Bm = () => ([2, 4, 5].includes(R.law) || R.demi || R.rhythm || R.inv ? 1 : 0), C = () => (R.sent || R.rings ? 1 : 0);
      if (A() + Bm() + C() < 2 && has('zone') && !A() && !R.trav) R.zones = [.35 + .15 * r()];
      if (A() + Bm() + C() < 2) { const stops = laws.filter(x => [2, 4, 5].includes(x)); if (stops.length) { R.law = stops[Math.floor(r() * stops.length)]; R.irr = null; R.demi = null; R.rhythm = null; R.inv = false; } }
    }
    // budget de complexité (dangers simultanés) par monde : au-delà, on retire d'abord ce qui n'est pas le cœur du monde
    // (deuxième sentinelle, accélération ou rampe, demi-tours, zones dynamiques, anneaux en trop, zones fixes)
    const cx = () => R.rings * .8 + R.sent + (R.pulse + R.glide) * .7 + (R.zones.length + (R.fentes ? 1 : 0)) * .5 + (R.trav ? 1.5 : 0) +
      (R.accel || R.ramp ? .5 : 0) + (R.demi || R.rhythm || R.inv ? .5 : 0) + ([2, 4, 5, 6].includes(R.law) ? .4 : 0);
    const CAP = inf ? 3.4 : [2.4, 3, 3.3, 3.4, 3.6, 3.8][wi];
    // COSMOS ∞ (réserve 301-400) : au plus deux anneaux, jamais d'anneaux multiples avec une loi à arrêts et des fentes ;
    // partout : jamais trois anneaux avec la loi pas à pas (difficulté erratique : le plancher à 30 ms n'y tenait pas)
    if (inf) { if (R.rings > 2) R.rings = 2; if (R.rings > 1 && R.fentes && [2, 4, 5].includes(R.law)) R.fentes = false; }
    if (R.rings > 2 && R.law === 4) R.rings = 2;
    const drops = [() => { if (R.sent > 1) R.sent = 1; }, () => { if (R.trav && R.sent) R.sent = 0; }, () => { if (wi !== 1) { R.accel = null; R.ramp = null; } },
      () => { if (R.trav && R.accel) R.accel = null; }, () => { if (wi !== 3) { R.demi = null; R.rhythm = null; R.inv = false; } }, () => { if (wi !== 2) { R.pulse = 0; R.glide = 0; } },
      () => { if (R.rings > 1) R.rings = 1; }, () => { if (wi !== 2) { R.zones = []; R.fentes = false; } }, () => { if (R.sent && wi !== 4) R.sent = 0; },
      () => { R.accel = null; R.ramp = null; R.demi = null; R.rhythm = null; R.inv = false; }, () => { R.pulse = Math.min(R.pulse, 1); R.glide = 0; }];
    for (let i = 0; i < drops.length && cx() > CAP; i++) drops[i]();
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
  // réglage par niveau (tests/sim/tune.js) : [facteur de vitesse, aiguilles en plus ou en moins]
  // un niveau d'apprentissage n'est jamais accéléré (vitesse modérée, plan 5.3)
  const tn0 = DIFFICULTY.tune[n] || [1, 0], tn = teach ? [Math.min(1, tn0[0]), tn0[1]] : tn0;
  let fixed = unitsNow(), throws = Math.max(3, R.N + tn[1]);
  const per = trav ? 2 : 1;
  while (throws * per + fixed > cap && pre.length) { const x = pre.pop(); occ.splice(occ.indexOf(x), 1); fixed = unitsNow(); }
  while (throws * per + fixed > cap && throws > 4) throws--;
  while (throws * per + fixed > cap && walls.length > 1) { const wl = walls.pop(); for (const p of wl.pts) occ.splice(occ.indexOf(p), 1); fixed = unitsNow(); if (R.fentes) R.fentes = walls.length > 1; }
  while (throws * per + fixed > cap && throws > 3) throws--;
  for (const wl of walls) delete wl.pts;
  // --- zones dynamiques : pulsées (période P, annonce de 0,6 s, active ~45 % du temps), loin des obstacles fixes ---
  const zones = [];
  for (let i = 0; i < R.pulse; i++) {
    const c = put(.8), P = Math.round((3.4 - .9 * d) * 1e3) / 1e3, act = Math.round(P * .45 * 1e3) / 1e3;
    if (c != null) zones.push({ kind: 'pulse', c: Math.round(norm(c) * 1e9) / 1e9, hw: Math.round((.2 + .08 * d) * 1e6) / 1e6, P, ann: .6, off: Math.round((P - act - .6) * 1e3) / 1e3, ph: Math.round(r() * P * 1e6) / 1e6 });
  }
  // zones glissantes : arc toujours actif qui glisse lentement le long du bord (dans le repère de l'astre)
  for (let i = 0; i < R.glide; i++) {
    const c = put(.6), w = (r() < .5 ? -1 : 1) * (.22 + .18 * d);
    if (c != null) zones.push({ kind: 'glide', c: Math.round(norm(c) * 1e9) / 1e9, hw: Math.round((.18 + .06 * d) * 1e6) / 1e6, w: Math.round(w * 1e6) / 1e6 });
  }
  // --- vitesse : ω moyenne (facteur de réglage par niveau), normalisée par la loi ---
  // loi irrégulière : 2 ou 3 sinusoïdes (3 fortes pour le Chaos VI), fréquences non multiples, phases tirées au hasard ;
  // elle tourne surtout dans un sens, avec des arrêts et parfois de brefs retours (annoncés par les chevrons)
  let irr = null;
  if (R.law === 6) {
    const k = R.irr || 2, strong = k === 4, m = Math.min(3, k);
    irr = { b: strong ? .45 : .6, a: [strong ? .55 : .42, strong ? .38 : .3, .22].slice(0, m), f: [.9 + .5 * r(), 2.05 + .6 * r(), 3.4 + .8 * r()].slice(0, m), p: [r() * TAU, r() * TAU, r() * TAU].slice(0, m) };
    irr.f = irr.f.map(x => Math.round(x * 1e6) / 1e6); irr.p = irr.p.map(x => Math.round(x * 1e6) / 1e6);
  }
  const lawMean = R.law === 6 ? (() => { let a = 0; for (let i = 0; i < 20000; i++) a += Math.abs(patSpeed(6, 1, i * .01, irr)); return Math.round(a / 20000 * 1e9) / 1e9; })() : LAW_MEAN[R.law];
  const omega = R.omega * tn[0], speed = omega / lawMean;
  const dir = R.dir, phase = r() * 10;
  // --- anneaux à portes. Portes régulièrement espacées, anneaux voisins à contre-sens ; tous les anneaux d'un niveau ont la
  // même période de passage Tp = 2π / (portes × |ω|) (un anneau à 2 portes tourne 1,5 fois plus vite) et leurs portes se
  // rejoignent sur l'axe de tir à t* + j·Tp : une fenêtre de passage commune revient à chaque période. Portes pulsées :
  // période 1,5·Tp, ouvertes la moitié du temps puis annoncées (0,6 s) et fermées : un passage sur trois environ est fermé.
  const rings = [];
  let ringW = 0;
  if (R.rings) {
    // Les anneaux gardent leur fenêtre de passage W et leur période Tp en secondes : le facteur de réglage tn[0] ne change
    // que la vitesse de l'astre (une période de passage étirée allongeait les niveaux ralentis par le réglage).
    // Vitesse des anneaux choisie (±20 %) pour que l'astre ne fasse pas un nombre presque entier de tours par période de
    // passage, à sa vitesse moyenne réglée comme à ses vitesses accélérées : sinon chaque fenêtre de passage présenterait les
    // mêmes angles d'impact, et le bord pourrait ne plus jamais offrir de place au bon moment
    const om0 = R.omega * tn[0], oms = [om0]; if (R.accel) oms.push(om0 * R.accel.cap, om0 * Math.sqrt(R.accel.cap)); if (R.ramp) oms.push(om0 * (1 + R.ramp.k), om0 * (1 + R.ramp.k / 2));
    let bv = R.ringV, bs = -1;
    // (fraction de tour par période loin de 0, 1/4, 1/3, 1/2, 2/3, 3/4 : les fenêtres successives balaient tout le bord)
    const RAT = [0, .25, 1 / 3, .5, 2 / 3, .75, 1];
    // loi pas à pas (arrêts francs, période 2,6 s) : la période de passage ne doit pas non plus être presque commensurable
    // avec la période de la loi, sinon les passages tombent toujours aux mêmes phases (toujours à l'arrêt, ou jamais)
    const lawP = R.law === 4 ? 2.6 : 0;
    for (let f = .8; f <= 1.2001; f += .01) {
      const v = R.ringV * f, T = TAU / (R.gates * v); let m = 1;
      for (const o of oms) { const x = (o * T / TAU) % 1; for (const q of RAT) m = Math.min(m, Math.abs(x - q)); }
      if (lawP) { const x = (lawP / T) % 1; for (const q of RAT) m = Math.min(m, Math.abs(x - q)); }
      if (m > bs + 1e-9) { bs = m; bv = v; }
    }
    R.ringV = Math.round(bv * 1e6) / 1e6;
    // fenêtre de passage commune d'au moins RING_WIN s pour chaque anneau : chaque anneau a ses propres portes, assez larges
    // pour laisser passer l'aiguille pendant W à sa vitesse (l'anneau à deux portes tourne 1,5 fois plus vite)
    ringW = Math.max(RING_WIN, R.ringW);
    const Tp = TAU / (R.gates * R.ringV), tStar = phase + .8 + r() * Tp, s0 = r() < .5 ? 1 : -1;
    for (let k = 0; k < R.rings; k++) {
      const nk = R.gates === 3 && k === 2 ? 2 : R.gates, wk = (k % 2 ? -s0 : s0) * R.gates * R.ringV / nk, h = (ringW * Math.abs(wk) + 2 * RING_PAD[k]) / 2;
      const c0 = r() * TAU, gates = [];
      for (let i = 0; i < nk; i++) gates.push({ c: Math.round(norm(c0 + i * TAU / nk) * 1e9) / 1e9, h: Math.round(h * 1e6) / 1e6 });
      const w = Math.round(wk * 1e6) / 1e6, q = { k, a0: Math.round(norm(HPI - c0 - w * tStar) * 1e9) / 1e9, w, gates, pulse: null };
      if (R.gatePulse) { const P = Math.round(1.5 * Tp * 1e6) / 1e6; q.pulse = { P, open: Math.round(P / 2 * 1e6) / 1e6, ann: .6, ph: Math.round((tStar - P / 4) * 1e6) / 1e6 }; }
      rings.push(q);
    }
  }
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
  // deux sentinelles (221) : en sens opposés, la seconde un peu plus lente
  if (R.sent) { const a0 = r() * TAU, ws = -dir * (.65 + .3 * r()) * (1 + .25 * d), hw = .2 + .08 * d; for (let i = 0; i < R.sent; i++) sents.push({ a0: a0 + i * Math.PI, w: i ? Math.round(-ws * (.75 + .2 * r()) * 1e6) / 1e6 : ws, hw }); }
  // --- orientation de départ (anti-salve) : le plus gros obstacle passe sous le pas de tir 0,2 à 1,5 s après le départ ---
  let rot0 = 0;
  if (occ.length) {
    const tgt = .25 + r() * .9 + FLIGHT;
    let R0 = 0, tt = phase; const h = .005;
    for (let x = 0; x < tgt; x += h) { R0 += h * (patSpeed(R.law, speed * dir, tt, irr) + patSpeed(R.law, speed * dir, tt + h, irr)) / 2; tt += h; }
    const c = walls.length ? (walls[0].a0 + walls[0].a1) / 2 : pre[Math.floor(r() * pre.length)];
    rot0 = Math.round(norm(HPI - R0 - c) * 1e9) / 1e9;   // arrondi : identique d'un moteur JavaScript à l'autre
  }
  let vmax = .1; for (let i = 0; i < 400; i++) vmax = Math.max(vmax, Math.abs(patSpeed(R.law, speed, i * .1, irr)));
  if (R.accel) { R.accel.k = Math.round(R.accel.k * 1e6) / 1e6; R.accel.cap = Math.round(R.accel.cap * 1e6) / 1e6; vmax *= R.accel.cap; }
  if (R.demi) R.demi.warn = Math.round(R.demi.warn * 1e3) / 1e3;
  if (R.ramp) { R.ramp.k = Math.round(R.ramp.k * 1e3) / 1e3; R.ramp.T = Math.round(R.ramp.T * 1e3) / 1e3; vmax *= 1 + R.ramp.k; }
  if (R.rhythm) { R.rhythm.P = Math.round(R.rhythm.P * 1e3) / 1e3; R.rhythm.warn = Math.round(R.rhythm.warn * 1e3) / 1e3; R.rhythm.t0 = Math.round((phase + 1.2 + R.rhythm.P * .5) * 1e6) / 1e6; }
  vmax = Math.round(vmax * 1e6) / 1e6;
  const blockers = pre.map(a => ({ a: norm(a), pre: true, k: 1 }));
  for (const wl of walls) for (const p of wallPoints(wl.a0, wl.a1 - wl.a0)) blockers.push({ a: norm(p), pre: true, wall: true, k: 1 });
  const lv = { n, w, boss, special, sp, teach, throws, pre, walls, orbs, sents, speed, omega, pattern: R.law, dir, phase, rot0, trav, vmax, d,
    layout: R.layout, fentes: R.fentes, fixed: +fixed.toFixed(3), accel: R.accel, demi: R.demi, rhythm: R.rhythm, inv: R.inv, ramp: R.ramp, irr, zones, rings, ringWin: Math.round(ringW * 1e6) / 1e6, blockers };
  lv.flags = levelFlags(lv);
  return lv;
}
// règle de rotation d'un niveau en clair (HUD, bandeau du niveau) : l'idée dynamique dominante (inversion à l'impact,
// demi-tours, accélération, rampe) si le niveau en a une, sinon le nom de sa loi
function rotLabel(lv) {
  const f = lv.inv ? 'invImpact' : lv.rhythm ? 'rythme' : lv.demi ? 'demitour' : lv.accel ? 'accel' : lv.ramp ? 'rampe' : null;
  return f ? TEACH_TEXT[f][0] : 'ROTATION ' + PAT_NAME[lv.pattern];
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
  if (lv.sents.length > 1) f.push('sentinelles2');
  if (lv.rings.length) f.push('anneau');
  if (lv.rings.length > 1) f.push('anneaux2');
  if (lv.rings.length > 2) f.push('anneaux3');
  if (lv.rings.some(q => q.pulse)) f.push('portesPulsees');
  if (lv.trav) f.push('traversantes');
  if (lv.accel) f.push('accel');
  if (lv.demi) f.push('demitour');
  if (lv.rhythm) f.push('rythme');
  if (lv.inv) f.push('invImpact');
  if (lv.ramp) f.push('rampe');
  if (lv.zones.some(z => z.kind === 'pulse')) f.push('pulse');
  if (lv.zones.some(z => z.kind === 'glide')) f.push('glisse');
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
// arcs libres moins des intervalles interdits [a, b] (angles quelconques) : arcs restants de plus de 0,004 rad
function subtractArcs(free, cut) {
  let out = free.map(q => [q[0], q[1]]);
  for (const [c0, c1] of cut) {
    const nx = [];
    for (const [a, b] of out) {
      // intervalle interdit ramené près de [a, b] (périodicité 2π)
      let lo = c0, hi = c1; const k = Math.round(((a + b) / 2 - (c0 + c1) / 2) / TAU); lo += k * TAU; hi += k * TAU;
      if (hi <= a || lo >= b) { nx.push([a, b]); continue; }
      if (lo - a > .004) nx.push([a, lo]);
      if (b - hi > .004) nx.push([hi, b]);
    }
    out = nx;
  }
  return out;
}

