// ORBITA · core.js — état du jeu, règles, collisions, prédiction honnête et simulation (update).
/* ---------- état ---------- */
let state = 'menu', L = null, rot = 0, t = 0, stuck = [], left = 0, flying = null, queued = false;
let pulse = 0, orbHits = 0, winT = 0, wonT = 0, dieT = 0, exploded = false, spinK = 1;
let intro = 0, wIntro = 0, build = 1, readyK = 1, thrownAny = false, time = 0, lastStars = 0, wipe = 0, headFlash = 0, starFlash = 0;
let arcs = [[0, TAU]], arcsDirty = true, failInfo = null, nearMark = null, nearCount = 0, levelTime = 0, lastWorldSeen = -1, leadA = HPI, leadOk = true;
const demo = { stuck: [], rot: 0, t: 0, cool: .8, fly: null, arcs: [[0, TAU]], gone: 0 };

function startLevel(n, quick) {
  n = Math.max(1, n | 0);
  const retry = !!quick || (L && L.n === n && state !== 'menu' && state !== 'levels');
  L = makeLevel(n);
  if (PAL.w !== L.w) { setTheme(L.w); bgKey = ''; }
  rot = 0; t = L.phase; spinK = 1;
  stuck = L.blockers; arcsDirty = true;
  left = L.throws; flying = null; queued = false;
  segs = []; sparks = []; rings = []; texts = []; orbHits = 0; winT = 0; wonT = 0; dieT = 0; exploded = false;
  failInfo = null; nearMark = null; nearCount = 0; levelTime = 0; shake = 0; pulse = 0; readyK = 0; thrownAny = false; starFlash = 0;
  const newWorld = !retry && (L.pos === 0 || L.w !== lastWorldSeen);
  lastWorldSeen = L.w;
  intro = retry ? 0 : 1.3; wIntro = newWorld ? 2.5 : 0; build = retry ? .7 : 0;
  if (!retry && !rm()) wipe = 1;
  state = 'play';
  hideAll(); $('hudBtn').style.display = 'block';
  if (newWorld) sfx('world'); else if (!retry) sfx(L.boss ? 'boss' : 'start');
}

// throwPin() lance à l'instant simulé courant ; throwPin(tSim) à l'instant tSim (jamais avant le dernier instant simulé)
function throwPin(tSim) {
  if (state !== 'play' || left <= 0) return;
  if (flying) { queued = true; return; }
  launch(tSim > t ? tSim : t);
}
// une aiguille part du pas de tir à l'instant de simulation tL (≥ dernier instant simulé)
function launch(tL) {
  flying = { tL, idx: L.throws - left };
  left--; thrownAny = true; readyK = 0;
  if (wIntro > .4) wIntro = .4;
  if (intro > .3) intro = .3;
  sfx('throw', flying.idx);
}

function fail(kind, a, d, who) {
  state = 'dying'; dieT = 0; spinK = 1; queued = false;
  const yT = kind === 'sent' ? cy + RS : cy + R + PL * .5;
  failInfo = { kind, a: kind === 'twin' ? norm(a + Math.PI) : a, d, who, sent: kind === 'sent' ? who : null };
  // l'aiguille se brise en deux traits
  const s1 = Math.random() < .5 ? -1 : 1;
  seg(cx, yT - PL * .25, HPI, PL * .5, s1 * (60 + Math.random() * 80), 120, s1 * 7, .7, PAL.hi);
  seg(cx, yT + PL * .25, HPI, PL * .5, -s1 * (80 + Math.random() * 80), 190, -s1 * 9, .7, PAL.hi);
  const fa = failInfo.a + rot, fr = R + PL;
  const fx = kind === 'sent' ? cx : cx + Math.cos(fa) * fr, fy = kind === 'sent' ? cy + RS : cy + Math.sin(fa) * fr;
  spark(fx, fy, 16, ALERT, 240); ringFx(fx, fy, HEAD, 150, .45, ALERT, 2);
  flying = null; shake = rm() ? 0 : 9; nearMark = null;
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

function stick(a) {
  let d = 9, who = null, twinHit = false;
  for (const s of stuck) { const x = angDiff(s.a, a); if (x < d) { d = x; who = s; } }
  const b = norm(a + Math.PI);
  if (L.trav) for (const s of stuck) { const x = angDiff(s.a, b); if (x < d) { d = x; who = s; twinHit = true; } }
  if (d < GAP) { fail(twinHit ? 'twin' : 'pin', a, d, who); return; }
  const idx = flying ? flying.idx : L.throws - left - 1, s = { a, pre: false, k: 0, deg: idx };
  stuck.push(s);
  if (L.trav) { s.tr = true; s.tw = { a: b, pre: false, k: 0, twin: true, deg: idx + 2 }; stuck.push(s.tw); }
  flying = null; arcsDirty = true; pulse = 1;
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
  if (left === 0) win();
  else if (queued) { queued = false; launch(t); }
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
// prédicteur honnête pour le banc d'essai : même calcul que le jeu, marge 0,7 × GAP
window.__botSafe = function () {
  if (state !== 'play' || flying || left <= 0 || !L) return false;
  const M = GAP * 1.7, a = predict(t).a;
  for (const s of stuck) if (angDiff(s.a, a) <= M) return false;
  if (L.trav) { const b = a + Math.PI; for (const s of stuck) if (angDiff(s.a, b) <= M) return false; }
  if (L.sents.length) {
    const w = sentWindow(), s0 = t + w[0] - .02, s1 = t + w[1] + .02;
    for (const q of L.sents) if (sentMin(q, s0, s1) <= q.hw + SENT_PAD + GAP * .7) return false;
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
  if (L && (state === 'play' || state === 'dying' || state === 'winning')) {
    const k = state === 'dying' ? (spinK = Math.max(0, spinK - h * 4.5)) : 1;
    const t0 = t, r0 = rot, v0 = speedAt(t0), t1 = t0 + h * k, r1 = r0 + (t1 - t0) * (v0 + speedAt(t1)) / 2;
    if (state === 'play' && flying) {
      const f = flying, tI = f.tL + flightTime();
      let tS = -1;
      if (L.sents.length) {
        const w = sentWindow(), s0 = Math.max(t0, f.tL + w[0]), s1 = Math.min(t1, f.tL + w[1], tI);
        for (const q of L.sents) { const x = sentHit(q, s0, s1, q.hw + SENT_PAD); if (x >= 0 && (tS < 0 || x < tS)) { tS = x; f.sent = q; } }
      }
      if (tS >= 0) { t = tS; rot = r0 + (tS - t0) * (v0 + speedAt(tS)) / 2; fail('sent', 0, 0, f.sent); }
      else if (tI <= t1) {
        // instant exact du contact : rotation intégrée jusqu'à tI dans le pas
        t = tI; rot = r0 + (tI - t0) * (v0 + speedAt(tI)) / 2;
        stick(norm(HPI - rot));
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
  if (state === 'play') {
    intro = Math.max(0, intro - h); wIntro = Math.max(0, wIntro - h);
    build = Math.min(1, build + h * 2.8);
    readyK = Math.min(1, readyK + h * 10);
    levelTime += h;
    // viseur d'avance : où tomberait une aiguille lancée maintenant
    const pr = predict(t), la = pr.a;
    leadA = HPI - (pr.rot - rot); leadOk = true;
    for (const s of stuck) if (angDiff(s.a, la) < GAP || (L.trav && angDiff(s.a, la + Math.PI) < GAP)) { leadOk = false; break; }
  }
  if (state === 'dying') { dieT += h; if (dieT > .7) showFail(); }
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
  if (!L || !(a > 0) || !(state === 'play' || state === 'dying' || state === 'winning')) return;
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
