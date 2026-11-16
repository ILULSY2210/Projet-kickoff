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

function throwPin() {
  if (state !== 'play' || left <= 0) return;
  if (flying) { queued = true; return; }
  flying = { y: LAUNCH };
  left--; thrownAny = true; readyK = 0;
  if (wIntro > .4) wIntro = .4;
  if (intro > .3) intro = .3;
  sfx('throw', L.throws - left - 1);
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
  const idx = L.throws - left - 1, s = { a, pre: false, k: 0, deg: idx };
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
  else if (queued) { queued = false; throwPin(); }
}

/* ---------- prédiction honnête pour le banc d'essai : même calcul que le jeu, marge 0,7 × GAP ---------- */
function predictRot(travel) { const n = 24, h = travel / n; let r2 = rot, t2 = t; for (let k = 0; k < n; k++) { t2 += h; r2 += speedAt(t2) * h; } return r2; }
window.__botSafe = function () {
  if (state !== 'play' || flying || left <= 0 || !L) return false;
  const M = GAP * 1.7, a = norm(HPI - predictRot((LAUNCH - (cy + R)) / FLYV));
  for (const s of stuck) if (angDiff(s.a, a) <= M) return false;
  if (L.trav) { const b = a + Math.PI; for (const s of stuck) if (angDiff(s.a, b) <= M) return false; }
  if (L.sents.length) {
    const hwY = HEAD * .75, yS = cy + RS;
    const tA = (LAUNCH - (yS + hwY)) / FLYV - .02, tB = (LAUNCH + PL + HEAD - (yS - hwY)) / FLYV + .02;
    for (const q of L.sents) for (let k = 0; k <= 6; k++) { const tt = t + tA + (tB - tA) * k / 6; if (angDiff(q.a0 + q.w * tt, HPI) <= q.hw + SENT_PAD + GAP * .7) return false; }
  }
  return true;
};

/* ---------- boucle ---------- */
function update(dt) {
  time += dt;
  if (wipe > 0) wipe = Math.max(0, wipe - dt * 3.4);
  if (state === 'menu') updDemo(dt);
  if (L && (state === 'play' || state === 'dying' || state === 'winning')) {
    const k = state === 'dying' ? (spinK = Math.max(0, spinK - dt * 4.5)) : 1, prev = rot;
    t += dt * k; rot += speedAt(t) * dt * k;
    // boîte à musique : chaque bloqueur qui passe sous la tête de lecture (en haut) fait tinter sa note
    if (state === 'play' && rot !== prev) {
      for (const s of stuck) {
        const th = -HPI - s.a;
        if (Math.floor((rot - th) / TAU) !== Math.floor((prev - th) / TAU)) {
          headFlash = 1;
          if (soundOn && time - lastPing > .07 && !s.wall) { lastPing = time; sfx('ping', s.pre ? -1 - (Math.round(s.a * 3) % 4) : s.deg); }
        }
      }
    }
  }
  if (state === 'play') {
    intro = Math.max(0, intro - dt); wIntro = Math.max(0, wIntro - dt);
    build = Math.min(1, build + dt * 2.8);
    readyK = Math.min(1, readyK + dt * 10);
    levelTime += dt;
    if (flying) {
      const y0 = flying.y; flying.y -= FLYV * dt; flying.py = y0;
      let dead = false;
      if (L.sents.length) {
        const yS = cy + RS, hwY = HEAD * .75;
        if (flying.y <= yS + hwY && y0 + PL + HEAD >= yS - hwY) {
          for (const q of L.sents) if (angDiff(q.a0 + q.w * t, HPI) < q.hw + SENT_PAD) { fail('sent', 0, 0, q); dead = true; break; }
        }
      }
      if (!dead && flying.y <= cy + R) {
        // instant exact du contact, indépendant de la cadence d'image
        const over = (cy + R - flying.y) / FLYV;
        stick(norm(HPI - (rot - speedAt(t) * over)));
      }
    }
    // viseur d'avance : où tomberait une aiguille lancée maintenant
    const pr = predictRot((LAUNCH - (cy + R)) / FLYV), la = norm(HPI - pr);
    leadA = HPI - (pr - rot); leadOk = true;
    for (const s of stuck) if (angDiff(s.a, la) < GAP || (L.trav && angDiff(s.a, la + Math.PI) < GAP)) { leadOk = false; break; }
  }
  if (state === 'dying') { dieT += dt; if (dieT > .7) showFail(); }
  if (state === 'winning') {
    winT += dt;
    if (winT > .26 && !exploded) {
      syncScene(); explodeScene(GSC, 300); exploded = true; shake = rm() ? 0 : 7; sfx('boom'); vib(50);
    }
    if (winT > 1.15) showWin();
  }
  if (state === 'won') wonT += dt;

  for (const s of stuck) if (s.k < 1) s.k = Math.min(1, s.k + dt * 6);
  for (const p of sparks) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .94; p.vy *= .94; p.life -= dt; }
  for (const p of segs) { p.x += p.vx * dt; p.y += p.vy * dt; p.a += p.va * dt; p.vx *= .985; p.vy *= .985; p.life -= dt; }
  for (const p of rings) { p.r += p.vr * dt; p.life -= dt; }
  for (const x of texts) x.life -= dt;
  if (sparks.length) sparks = sparks.filter(p => p.life > 0);
  if (segs.length) segs = segs.filter(p => p.life > 0);
  if (rings.length) rings = rings.filter(p => p.life > 0);
  if (texts.length) texts = texts.filter(x => x.life > 0);
  if (nearMark && (nearMark.life -= dt) <= 0) nearMark = null;
  shake = Math.max(0, shake - dt * 40);
  pulse = Math.max(0, pulse - dt * 7);
  headFlash = Math.max(0, headFlash - dt * 5);
  starFlash = Math.max(0, starFlash - dt * 2.2);
}

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
