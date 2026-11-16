// ORBITA · core.js — état du jeu, règles, collisions, prédiction honnête et simulation (update).
/* ---------- état ---------- */
// flights : aiguilles en vol (deux au plus), dans l'ordre des lancers ; flying = la plus récente, ou null
let state = 'menu', L = null, rot = 0, t = 0, stuck = [], left = 0, flying = null, flights = [];
// sous-phase de « play » : 'jeu', ou 'compte' (compte à rebours de REPRENDRE : rotation figée, tirs ignorés)
let playPhase = 'jeu', countT = 0;
// rappel de la cause d'un échec pendant RECALL secondes après la relance : { txt, life }
let recall = null;
let pulse = 0, orbHits = 0, winT = 0, wonT = 0, dieT = 0, exploded = false, spinK = 1;
let intro = 0, wIntro = 0, build = 1, readyK = 1, thrownAny = false, time = 0, lastStars = 0, wipe = 0, headFlash = 0, starFlash = 0;
let arcs = [[0, TAU]], arcsDirty = true, failInfo = null, nearMark = null, nearCount = 0, levelTime = 0, lastWorldSeen = -1, leadA = HPI, leadOk = true;
const demo = { stuck: [], rot: 0, t: 0, cool: .8, fly: null, arcs: [[0, TAU]], gone: 0 };

function startLevel(n, quick) {
  n = Math.max(1, n | 0);
  const retry = !!quick || (L && L.n === n && state !== 'menu' && state !== 'levels');
  const cause = retry && failInfo && L && L.n === n ? failCause(failInfo, L).short : null;
  recall = cause ? { txt: cause, life: RECALL } : null;
  L = makeLevel(n);
  if (PAL.w !== L.w) { setTheme(L.w); bgKey = ''; }
  rot = 0; t = L.phase; spinK = 1;
  stuck = L.blockers; arcsDirty = true;
  left = L.throws; flying = null; flights = [];
  segs = []; sparks = []; rings = []; texts = []; orbHits = 0; winT = 0; wonT = 0; dieT = 0; exploded = false;
  failInfo = null; nearMark = null; nearCount = 0; levelTime = 0; shake = 0; pulse = 0; readyK = 0; thrownAny = false; starFlash = 0;
  const newWorld = !retry && (L.pos === 0 || L.w !== lastWorldSeen);
  lastWorldSeen = L.w;
  intro = retry ? 0 : 1.3; wIntro = newWorld ? 2.5 : 0; build = retry ? .7 : 0;
  if (!retry && !rm()) wipe = 1;
  state = 'play'; playPhase = 'jeu'; countT = 0;
  hideAll(); $('hudBtn').style.display = 'block';
  if (newWorld) sfx('world'); else if (!retry) sfx(L.boss ? 'boss' : 'start');
}

// throwPin() lance à l'instant simulé courant ; throwPin(tSim) à l'instant tSim (jamais avant le dernier instant simulé).
// Un tir n'est jamais retardé : il part même si une aiguille vole déjà, dans la limite de deux aiguilles en vol.
const MAX_FLIGHTS = 2;
function throwPin(tSim) {
  if (state !== 'play' || playPhase !== 'jeu' || left <= 0 || flights.length >= MAX_FLIGHTS) return;
  launch(tSim > t ? tSim : t);
}
// une aiguille part du pas de tir à l'instant de simulation tL (≥ dernier instant simulé)
function launch(tL) {
  const f = { tL, idx: L.throws - left };
  flights.push(f); flying = f;
  left--; thrownAny = true; readyK = 0;
  if (wIntro > .4) wIntro = .4;
  if (intro > .3) intro = .3;
  sfx('throw', f.idx);
}

function fail(kind, a, d, who) {
  state = 'dying'; dieT = 0; spinK = 1;
  const yT = kind === 'sent' ? cy + RS : cy + R + PL * .5;
  // lost : aiguilles perdues avec l'échec (celle qui échoue et celle qui vole encore derrière elle)
  failInfo = { kind, a: kind === 'twin' ? norm(a + Math.PI) : a, d, who, sent: kind === 'sent' ? who : null, lost: Math.max(1, flights.length) };
  // l'aiguille se brise en deux traits
  const s1 = Math.random() < .5 ? -1 : 1;
  seg(cx, yT - PL * .25, HPI, PL * .5, s1 * (60 + Math.random() * 80), 120, s1 * 7, .7, PAL.hi);
  seg(cx, yT + PL * .25, HPI, PL * .5, -s1 * (80 + Math.random() * 80), 190, -s1 * 9, .7, PAL.hi);
  const fa = failInfo.a + rot, fr = R + PL;
  const fx = kind === 'sent' ? cx : cx + Math.cos(fa) * fr, fy = kind === 'sent' ? cy + RS : cy + Math.sin(fa) * fr;
  spark(fx, fy, 16, ALERT, 240); ringFx(fx, fy, HEAD, 150, .45, ALERT, 2);
  flights = []; flying = null; shake = rm() ? 0 : 9; nearMark = null;
  sfx('fail'); vib([30, 40, 90]);
}

function win() {
  state = 'winning'; winT = 0; exploded = false;
  const orbN = L.orbs.length;
  lastStars = 1 + (orbHits > 0 ? 1 : 0) + (orbHits === orbN ? 1 : 0);
  const n = L.n;
  if (lastStars > (bestStars[n] || 0)) bestStars[n] = lastStars;
  if (n + 1 > unlocked) unlocked = n + 1;
  store.set('stars', bestStars); store.set('unlocked', unlocked);
  sfx('win', L.throws); vib([20, 30, 20]);
}

// aiguille f plantée à l'angle a (repère de l'astre)
// cause d'un échec, en clair (textes : FAIL_TEXT) : short = rappel près du pas de tir, long = phrase de la feuille d'échec,
// tip = conseil propre à la cause. Une aiguille plantée (ou ressortie) au milieu d'un arc interdit est signalée comme
// telle : la distance au bloqueur invisible le plus proche de l'arc n'aurait aucun sens (« il manquait 4° » pour 20°).
function inZone(a, lv) { return lv.walls.some(wl => angDiff(a, (wl.a0 + wl.a1) / 2) <= (wl.a1 - wl.a0) / 2); }
function failCause(info, lv) {
  const deg = info.kind === 'sent' ? 0 : Math.max(1, Math.ceil((GAP - info.d) * 180 / Math.PI));
  const key = info.kind === 'sent' ? 'sent' : inZone(info.a, lv) ? (info.kind === 'twin' ? 'twinZone' : 'zone') : info.kind === 'twin' ? 'twin' : 'pin';
  const T = FAIL_TEXT[key], f = x => x.replace('{d}', deg);
  return { key, deg, short: f(T.short), long: f(T.long), tip: T.tips[(lv.n + lv.throws) % T.tips.length] };
}
// règle d'atterrissage à l'angle a : occupant le plus proche (et, pour une traversante, de sa sortie opposée)
const LAND = { d: 9, who: null, twin: false };
function landing(a) {
  let d = 9, who = null, twin = false;
  for (const s of stuck) { const x = angDiff(s.a, a); if (x < d) { d = x; who = s; } }
  if (L.trav) { const b = a + Math.PI; for (const s of stuck) { const x = angDiff(s.a, b); if (x < d) { d = x; who = s; twin = true; } } }
  LAND.d = d; LAND.who = who; LAND.twin = twin;
  return LAND;
}
// arcs allumés du bord = angles où une aiguille peut se planter : ±GAP autour de chaque occupant éteint ; pour les
// traversantes, aussi autour des antipodes des bloqueurs (ceux des aiguilles lancées y sont déjà : leur sortie opposée)
function litArcs() {
  return computeArcs(L.trav ? stuck.concat(stuck.filter(s => s.pre).map(s => ({ a: s.a + Math.PI }))) : stuck);
}
function stick(a, f) {
  const ld = landing(a), d = ld.d, who = ld.who, twinHit = ld.twin, b = norm(a + Math.PI);
  if (d < GAP) { fail(twinHit ? 'twin' : 'pin', a, d, who); return; }
  const idx = f ? f.idx : L.throws - left - 1, s = { a, pre: false, k: 0, deg: idx };
  stuck.push(s);
  if (L.trav) { s.tr = true; s.tw = { a: b, pre: false, k: 0, twin: true, deg: idx + 2 }; stuck.push(s.tw); }
  if (f) { flights.splice(flights.indexOf(f), 1); flying = flights.length ? flights[flights.length - 1] : null; }
  arcsDirty = true; pulse = 1;
  sfx('hit', idx); vib(10);
  spark(cx, cy + R, 7, PAL.hi, 210, 2.2, HPI);
  if (L.trav) spark(cx, cy - R, 5, PAL.hi, 180, 2, -HPI);
  // frôlement : moins de 2 × GAP d'un voisin
  if (d < GAP * 2) {
    nearCount++;
    const deg = Math.max(1, Math.round((d - GAP) * 180 / Math.PI));
    nearMark = { a1: twinHit ? b : a, a2: who.a, life: .9 };
    texts = texts.filter(x => !x.near);
    texts.push({ near: 1, x: cx + HEAD * 3.2, y: cy + R + PL + HEAD * 1.75, txt: 'FRÔLÉ · ' + deg + '°', life: 1.1, rgb: PAL.acc, h: 10, al: 0 });
    sfx('near', idx); vib([8, 30, 8]);
  }
  for (const o of L.orbs) {
    if (!o.hit && (angDiff(o.a, a) < ORBHIT || (L.trav && angDiff(o.a, b) < ORBHIT))) {
      o.hit = true; orbHits++; starFlash = 1;
      const wa = o.a + rot, dd = R + PL * .55, ox = cx + Math.cos(wa) * dd, oy = cy + Math.sin(wa) * dd;
      spark(ox, oy, 14, PAL.acc, 230); ringFx(ox, oy, HEAD, 130, .4, PAL.acc, 1.5);
      texts.push({ x: cx - HEAD * 3.2, y: cy + R + PL + HEAD * 1.75, txt: '★ ' + orbHits + '/' + L.orbs.length, life: 1.1, rgb: PAL.acc, h: 10, al: 1 });
      sfx('orb', idx); vib([10, 20, 10]);
    }
  }
  if (left === 0 && !flights.length) win();
}

/* ---------- temps de vol et sentinelles ---------- */
const angSigned = (a, b) => ((b - a) % TAU + TAU * 1.5) % TAU - Math.PI;   // écart signé b − a dans [−π, π)
function flightTime() { return FLIGHT; }
// intervalle [début, fin] (s après le lancer) pendant lequel l'aiguille, de la pointe à la tête, occupe l'orbite des sentinelles
const SENT_WIN = [U.sentOut * FLIGHT, (U.sentIn + U.len) * FLIGHT];
function sentWindow() { return SENT_WIN; }
// premier instant de [s0, s1] où la sentinelle q couvre l'axe de tir (écart < H), ou −1 ; mouvement uniforme
function sentHit(q, s0, s1, H) {
  if (s1 < s0) return -1;
  const d0 = angSigned(HPI, q.a0 + q.w * s0);
  if (Math.abs(d0) < H) return s0;
  if (!q.w) return -1;
  const dt = ((d0 > 0 ? H : -H) - d0) / q.w;
  return dt >= 0 && s0 + dt <= s1 ? s0 + dt : -1;
}
// Tête de l'aiguille en vol : disque dont le centre s'écarte de l'orbite des sentinelles de ρ (en rayons d'orbite, > 0 côté
// pas de tir), affine par morceaux en τ (temps depuis le lancer) d'après UREF. Morceaux { t0, t1, r0, k } : ρ = r0 + k (τ − t0),
// limités à la fenêtre |ρ| ≤ SENT_PAD_HEAD où la tête peut toucher une sentinelle (HEAD_WIN = [début, fin]).
const HEAD_PIECES = (() => {
  const P = SENT_PAD_HEAD, out = [];
  for (let i = 1; i < UREF.length; i++) {
    let ta = (UREF[i - 1][0] + U.len) * FLIGHT, tb = Math.min(FLIGHT, (UREF[i][0] + U.len) * FLIGHT);
    if (!(tb > ta)) continue;
    const ra = UREF[i - 1][1] - HEAD_REF - 1, k = (UREF[i][1] - UREF[i - 1][1]) / ((UREF[i][0] - UREF[i - 1][0]) * FLIGHT);
    let r0 = ra;
    if (r0 > P) { const d = (P - r0) / k; ta += d; r0 = P; }
    const rb = r0 + k * (tb - ta);
    if (rb < -P) tb = ta + (-P - r0) / k;
    if (tb > ta && r0 >= -P && r0 + k * (tb - ta) <= P) out.push({ t0: ta, t1: tb, r0, k });
  }
  return out;
})();
const HEAD_WIN = [HEAD_PIECES[0].t0, HEAD_PIECES[HEAD_PIECES.length - 1].t1];
// premier instant de [s0, s1] où la tête de l'aiguille lancée à tL touche la sentinelle q, ou −1. Contact : distance du
// centre de la tête à l'arc de la sentinelle (corps ou bout arrondi) < SENT_PAD_HEAD, en rayons d'orbite ; mouvement
// uniforme de la sentinelle, ρ affine sur chaque morceau : intervalles et racines exacts, indépendants du découpage en pas.
function sentHeadHit(q, tL, s0, s1) {
  const P = SENT_PAD_HEAD, hw = q.hw, w = q.w;
  for (const pc of HEAD_PIECES) {
    const a = tL + pc.t0, lo = Math.max(a, s0), hi = Math.min(tL + pc.t1, s1);
    if (lo > hi) continue;
    // à l'instant a + s : ρ = r0 + k s ; écart signé du milieu de la sentinelle à l'axe de tir : d = d0 + w s
    const d0 = angSigned(HPI, q.a0 + w * a), r0 = pc.r0, k = pc.k;
    let best = Infinity;
    const take = (x0, x1) => { const e = Math.max(a + x0, lo); if (e <= hi && e < a + x1 && e < best) best = e; };
    // corps de l'arc : |d| ≤ hw et |ρ| < P (k ≠ 0 : la tête avance toujours)
    let b0 = Math.min((P - r0) / k, (-P - r0) / k), b1 = Math.max((P - r0) / k, (-P - r0) / k);
    if (w) { b0 = Math.max(b0, Math.min((hw - d0) / w, (-hw - d0) / w)); b1 = Math.min(b1, Math.max((hw - d0) / w, (-hw - d0) / w)); }
    else if (Math.abs(d0) > hw) b1 = -Infinity;
    if (b0 < b1) take(b0, b1);
    // bouts arrondis (milieu ± hw) : ρ² + (d ∓ hw)² < P²
    for (const c of [hw, -hw]) {
      const e0 = d0 - c, A = k * k + w * w, B = 2 * (r0 * k + e0 * w), C = r0 * r0 + e0 * e0 - P * P, D = B * B - 4 * A * C;
      if (D > 0) { const sq = Math.sqrt(D); take((-B - sq) / (2 * A), (-B + sq) / (2 * A)); }
    }
    if (best < Infinity) return best;
  }
  return -1;
}
// écart minimal entre la sentinelle q et l'axe de tir sur [s0, s1]
function sentMin(q, s0, s1) {
  const d0 = angSigned(HPI, q.a0 + q.w * s0), d1 = d0 + q.w * (s1 - s0);
  return (d0 > 0) !== (d1 > 0) ? 0 : Math.min(Math.abs(d0), Math.abs(d1));
}

/* ---------- prédiction : même intégrateur et même grille de pas que le jeu ---------- */
// pour une aiguille lancée à l'instant tL (≥ t), rotation et angle d'impact ; exact au bit près si le jeu avance en pas de STEP
function predict(tL) {
  const tI = tL + flightTime();
  let r = rot, tau = t, v = speedAt(tau);
  while (tau + STEP < tI) { const t2 = tau + STEP, v2 = speedAt(t2); r += (t2 - tau) * (v + v2) / 2; tau = t2; v = v2; }
  r += (tI - tau) * (v + speedAt(tI)) / 2;
  return { a: norm(HPI - r), rot: r, tI };
}
// prédicteur honnête pour le banc d'essai : même calcul que le jeu, marge 0,7 × GAP ; tSim (facultatif) = instant du
// lancer envisagé (≥ t), sinon l'instant simulé courant
window.__botSafe = function (tSim) {
  if (state !== 'play' || playPhase !== 'jeu' || flying || left <= 0 || !L) return false;
  const tL = tSim > t ? tSim : t, M = GAP * 1.7, a = predict(tL).a;
  for (const s of stuck) if (angDiff(s.a, a) <= M) return false;
  if (L.trav) { const b = a + Math.PI; for (const s of stuck) if (angDiff(s.a, b) <= M) return false; }
  if (L.sents.length) {
    // tige (marge SENT_PAD) sur toute la traversée, tête (marge SENT_PAD_HEAD) sur sa fenêtre, plus 0,7 × GAP et 20 ms
    const w = sentWindow(), s0 = tL + w[0] - .02, s1 = tL + w[1] + .02, h0 = tL + HEAD_WIN[0] - .02, h1 = tL + HEAD_WIN[1] + .02;
    for (const q of L.sents) {
      if (sentMin(q, s0, s1) <= q.hw + SENT_PAD + GAP * .7) return false;
      if (sentMin(q, h0, h1) <= q.hw + SENT_PAD_HEAD + GAP * .7) return false;
    }
  }
  return true;
};

/* ---------- simulation à pas fixe ---------- */
// update(dt) avance la simulation de dt secondes exactement : pas entiers de STEP, puis un pas fractionnaire s'il reste
function update(dt) {
  if (!(dt > 0)) return;
  const n = Math.floor(dt / STEP + 1e-6);
  let r = dt - n * STEP; if (r < 1e-9) r = 0;
  for (let i = 0; i < n; i++) step(STEP);
  if (r > 0) step(r);
}
// un pas : rotation intégrée par la méthode des trapèzes ; vol, sentinelles et impact traités à leur instant exact dans le pas
function step(h) {
  time += h;
  if (wipe > 0) wipe = Math.max(0, wipe - h * 3.4);
  if (state === 'menu') updDemo(h);
  if (state === 'play' && playPhase === 'compte') {
    const c0 = Math.ceil(countT / (COUNTDOWN / 3));
    countT -= h;
    const c1 = Math.ceil(countT / (COUNTDOWN / 3));
    if (countT <= 0) { countT = 0; playPhase = 'jeu'; }
    else if (c1 !== c0) sfx('tick', c1);
  }
  else if (L && (state === 'play' || state === 'dying' || state === 'winning')) {
    const k = state === 'dying' ? (spinK = Math.max(0, spinK - h * 4.5)) : 1;
    const t0 = t, r0 = rot, v0 = speedAt(t0), t1 = t0 + h * k, r1 = r0 + (t1 - t0) * (v0 + speedAt(t1)) / 2;
    if (state === 'play' && flights.length) {
      // événements du pas (sentinelle, contact), traités dans l'ordre chronologique
      const ev = [];
      for (const f of flights) {
        const tI = f.tL + flightTime();
        let tS = -1, who = null;
        if (L.sents.length) {
          const w = sentWindow(), s0 = Math.max(t0, f.tL + w[0]), s1 = Math.min(t1, f.tL + w[1], tI);
          for (const q of L.sents) {
            // tige et tête (disque) : premier contact dessiné
            const x = sentHit(q, s0, s1, q.hw + SENT_PAD), y = sentHeadHit(q, f.tL, s0, s1), z = x < 0 ? y : y < 0 ? x : Math.min(x, y);
            if (z >= 0 && (tS < 0 || z < tS)) { tS = z; who = q; }
          }
        }
        if (tS >= 0) ev.push({ te: tS, f, who });
        else if (tI <= t1) ev.push({ te: tI, f, who: null });
      }
      if (ev.length > 1) ev.sort((x, y) => x.te - y.te);
      for (const e of ev) {
        if (state !== 'play') break;
        // instant exact de l'événement : rotation intégrée jusqu'à lui dans le pas
        t = e.te; rot = r0 + (e.te - t0) * (v0 + speedAt(e.te)) / 2;
        if (e.who) fail('sent', 0, 0, e.who); else stick(norm(HPI - rot), e.f);
      }
    }
    t = t1; rot = r1;
    // boîte à musique : chaque bloqueur qui passe sous la tête de lecture (en haut) fait tinter sa note
    if (state === 'play' && rot !== r0) {
      for (const s of stuck) {
        const th = -HPI - s.a;
        if (Math.floor((rot - th) / TAU) !== Math.floor((r0 - th) / TAU)) {
          headFlash = 1;
          if (soundOn && time - lastPing > .07 && !s.wall) { lastPing = time; sfx('ping', s.pre ? -1 - (Math.round(s.a * 3) % 4) : s.deg); }
        }
      }
    }
  }
  if (state === 'play' && playPhase === 'jeu') {
    intro = Math.max(0, intro - h); wIntro = Math.max(0, wIntro - h);
    build = Math.min(1, build + h * 2.8);
    readyK = Math.min(1, readyK + h * 10);
    levelTime += h;
    if (recall && (recall.life -= h) <= 0) recall = null;
    // viseur d'avance : où tomberait une aiguille lancée maintenant
    const pr = predict(t), la = pr.a;
    leadA = HPI - (pr.rot - rot); leadOk = true;
    for (const s of stuck) if (angDiff(s.a, la) < GAP || (L.trav && angDiff(s.a, la + Math.PI) < GAP)) { leadOk = false; break; }
  }
  if (state === 'dying') { dieT += h; if (dieT >= FAIL_SHEET) showFail(); }
  if (state === 'winning') {
    winT += h;
    if (winT > .26 && !exploded) {
      syncScene(); explodeScene(GSC, 300); exploded = true; shake = rm() ? 0 : 7; sfx('boom'); vib(50);
    }
    if (winT > 1.15) showWin();
  }
  if (state === 'won') wonT += h;

  for (const s of stuck) if (s.k < 1) s.k = Math.min(1, s.k + h * 6);
  for (const p of sparks) { p.x += p.vx * h; p.y += p.vy * h; p.vx *= .94; p.vy *= .94; p.life -= h; }
  for (const p of segs) { p.x += p.vx * h; p.y += p.vy * h; p.a += p.va * h; p.vx *= .985; p.vy *= .985; p.life -= h; }
  for (const p of rings) { p.r += p.vr * h; p.life -= h; }
  for (const x of texts) x.life -= h;
  if (sparks.length) sparks = sparks.filter(p => p.life > 0);
  if (segs.length) segs = segs.filter(p => p.life > 0);
  if (rings.length) rings = rings.filter(p => p.life > 0);
  if (texts.length) texts = texts.filter(x => x.life > 0);
  if (nearMark && (nearMark.life -= h) <= 0) nearMark = null;
  shake = Math.max(0, shake - h * 40);
  pulse = Math.max(0, pulse - h * 7);
  headFlash = Math.max(0, headFlash - h * 5);
  starFlash = Math.max(0, starFlash - h * 2.2);
}

/* ---------- vue au présent pour le rendu ---------- */
// La simulation est en retard de « a » secondes (reste de l'accumulateur, < STEP) sur l'horloge ; le rendu dessine l'instant
// présent en prolongeant le pas en cours par les mêmes lois (rotation par trapèze), sans rien décider : pas de retard d'affichage.
const RV = { rot: 0, t: 0 };
function viewAt(a) {
  RV.rot = rot; RV.t = t;
  if (!L || !(a > 0) || !(state === 'play' && playPhase === 'jeu' || state === 'dying' || state === 'winning')) return;
  const h = a * (state === 'dying' ? Math.max(0, spinK - a * 4.5) : 1), t1 = t + h;
  RV.t = t1; RV.rot = rot + h * (speedAt(t) + speedAt(t1)) / 2;
}
// position u de l'aiguille en vol à l'instant présent
function flyU(f) { return clamp((RV.t - f.tL) / FLIGHT, 0, 1); }

// mode démo du menu : l'astre du monde en cours se joue tout seul
function updDemo(dt) {
  const D = demo;
  D.t += dt;
  const sp = .95 * (.55 + .45 * Math.sin(D.t * .8));
  D.rot += sp * dt;
  for (const s of D.stuck) if (s.k < 1) s.k = Math.min(1, s.k + dt * 6);
  if (D.gone > 0) { D.gone -= dt; if (D.gone <= 0) { D.stuck = []; D.arcs = [[0, TAU]]; D.cool = .7; D.born = 0; } return; }
  D.born = Math.min(1, (D.born || 0) + dt * 2.2);
  if (D.fly) {
    D.fly.k += dt * 6;
    if (D.fly.k >= 1) {
      D.stuck.push({ a: norm(HPI - D.rot), pre: false, k: 0 }); D.fly = null; D.arcs = computeArcs(D.stuck);
      if (D.stuck.length >= 9) {
        if (rm()) { D.gone = .01; }
        else if (MSC.r) { syncMenu(); explodeScene(MSC, 210); D.gone = 1.3; }
        else D.gone = .01;
      }
    }
  } else if ((D.cool -= dt) <= 0) {
    const a = norm(HPI - (D.rot + sp / 6));
    if (D.stuck.every(s => angDiff(s.a, a) > GAP * 2.6)) { D.fly = { k: 0 }; D.cool = .5 + Math.random() * .6; }
  }
}
