// ORBITA · core.js — état du jeu, règles, collisions, prédiction honnête et simulation (update).
// Aucun accès au DOM, au canvas ni à l'audio : les règles émettent des événements (bus, util.js) que le rendu, les effets,
// le son, l'interface et la sauvegarde écoutent. Chargeable dans Node avec config.js, util.js et levels.js (tests/sim).
/* ---------- état ---------- */
// flights : aiguilles en vol (deux au plus), dans l'ordre des lancers ; flying = la plus récente, ou null
let state = 'menu', L = null, rot = 0, t = 0, stuck = [], left = 0, flying = null, flights = [];
// sous-phase de « play » : 'jeu', ou 'compte' (compte à rebours de REPRENDRE : rotation figée, tirs ignorés)
let playPhase = 'jeu', countT = 0;
// rappel de la cause d'un échec pendant RECALL secondes après la relance : { txt, life }
let recall = null;
let pulse = 0, orbHits = 0, winT = 0, wonT = 0, dieT = 0, exploded = false, spinK = 1;
let intro = 0, wIntro = 0, build = 1, readyK = 1, thrownAny = false, time = 0, lastStars = 0, wipe = 0, headFlash = 0, starFlash = 0;
let arcs = [[0, TAU]], arcsDirty = true, failInfo = null, nearMark = null, nearCount = 0, levelTime = 0, lastWorldSeen = -1;

// Les abonnés de « level:start » sont synchrones : thème, écrans masqués, effets remis à zéro, son (le banc d'essai en dépend).
function startLevel(n, quick) {
  n = Math.max(1, n | 0);
  const retry = !!quick || (L && L.n === n && state !== 'menu' && state !== 'levels');
  const cause = retry && failInfo && L && L.n === n ? failCause(failInfo, L).short : null;
  recall = cause ? { txt: cause, life: RECALL } : null;
  L = makeLevel(n);
  rot = L.rot0 || 0; t = L.phase; spinK = 1; lawVer++;
  stuck = L.blockers; arcsDirty = true;
  left = L.throws; flying = null; flights = [];
  orbHits = 0; winT = 0; wonT = 0; dieT = 0; exploded = false;
  failInfo = null; nearMark = null; nearCount = 0; levelTime = 0; pulse = 0; readyK = 0; thrownAny = false; starFlash = 0;
  const newWorld = !retry && (L.n === firstOfWorld(L.w) || L.w !== lastWorldSeen);
  lastWorldSeen = L.w;
  intro = retry ? 0 : 1.3; wIntro = newWorld ? 2.5 : 0; build = retry ? .7 : 0;
  state = 'play'; playPhase = 'jeu'; countT = 0;
  bus.emit('level:start', L, retry, newWorld);
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
  bus.emit('throw', f);
}

function fail(kind, a, d, who) {
  state = 'dying'; dieT = 0; spinK = 1;
  // lost : aiguilles perdues avec l'échec (celle qui échoue et celle qui vole encore derrière elle)
  failInfo = { kind, a: kind === 'twin' ? norm(a + Math.PI) : a, d, who, sent: kind === 'sent' ? who : null, lost: Math.max(1, flights.length) };
  flights = []; flying = null; nearMark = null;
  bus.emit('fail', failInfo);
}

function win() {
  state = 'winning'; winT = 0; exploded = false;
  const orbN = L.orbs.length;
  // sans étoile bonus sur l'astre, finir le niveau suffit pour 3/3
  lastStars = orbN ? 1 + (orbHits > 0 ? 1 : 0) + (orbHits === orbN ? 1 : 0) : 3;
  bus.emit('win', L, lastStars);
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
  bus.emit('hit', s, idx);
  // frôlement : moins de 2 × GAP d'un voisin
  if (d < GAP * 2) {
    nearCount++;
    const deg = Math.max(1, Math.round((d - GAP) * 180 / Math.PI));
    nearMark = { a1: twinHit ? b : a, a2: who.a, life: .9 };
    bus.emit('near', deg, idx);
  }
  for (const o of L.orbs) {
    if (!o.hit && (angDiff(o.a, a) < ORBHIT || (L.trav && angDiff(o.a, b) < ORBHIT))) {
      o.hit = true; orbHits++; starFlash = 1;
      bus.emit('star', o, idx);
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
// Pour une aiguille lancée à l'instant tL (≥ t), rotation et angle d'impact ; exact au bit près si le jeu avance en pas de
// STEP. Les rotations aux instants t + k·STEP sont gardées en cache tant que l'état (t, rot, niveau, loi : lawVer) ne
// change pas : un planificateur peut interroger des centaines d'instants de lancer pour le prix d'une intégration.
let lawVer = 0;
const PC = { t: NaN, rot: NaN, L: null, ver: -1, n: 0, taus: [], rs: [], vs: [] };
function predict(tL) { const r = predictRot(tL); return { a: norm(HPI - r), rot: r, tI: tL + flightTime() }; }
// rotation de l'astre à l'impact d'une aiguille lancée à tL (sans allocation)
function predictRot(tL) {
  const tI = tL + flightTime();
  if (PC.t !== t || PC.rot !== rot || PC.L !== L || PC.ver !== lawVer) {
    PC.t = t; PC.rot = rot; PC.L = L; PC.ver = lawVer; PC.n = 1; PC.taus[0] = t; PC.rs[0] = rot; PC.vs[0] = speedAt(t);
  }
  const T = PC.taus, Rs = PC.rs, V = PC.vs;
  // même boucle que l'intégration pas à pas : on avance tant que tau + STEP < tI
  let k = Math.max(0, Math.min(PC.n - 1, Math.floor((tI - t) / STEP) - 1));
  while (k > 0 && !(T[k - 1] + STEP < tI)) k--;
  while (T[k] + STEP < tI) {
    if (k + 1 >= PC.n) { const tau = T[k], t2 = tau + STEP, v2 = speedAt(t2); Rs[k + 1] = Rs[k] + (t2 - tau) * (V[k] + v2) / 2; T[k + 1] = t2; V[k + 1] = v2; PC.n = k + 2; }
    k++;
  }
  return Rs[k] + (tI - T[k]) * (V[k] + speedAt(tI)) / 2;
}
// Un tir lancé à tL survit-il, avec une marge de k × GAP au-delà de la règle ? k = 0 : la règle (sentinelles : tige et
// tête prises sur leur fenêtre entière, légèrement prudent) ; k = 0,7 : le prédicteur honnête du banc d'essai.
function shotSafe(tL, k) {
  const a = norm(HPI - predictRot(tL)), G = GAP * (1 + k), M = GAP * k;
  for (const s of stuck) if (angDiff(s.a, a) <= G) return false;
  if (L.trav) { const b = a + Math.PI; for (const s of stuck) if (angDiff(s.a, b) <= G) return false; }
  if (L.sents.length) {
    // tige (marge SENT_PAD) sur toute la traversée, tête (marge SENT_PAD_HEAD) sur sa fenêtre, plus M et 20 ms si k > 0
    const e = k > 0 ? .02 : 0, w = sentWindow(), s0 = tL + w[0] - e, s1 = tL + w[1] + e, h0 = tL + HEAD_WIN[0] - e, h1 = tL + HEAD_WIN[1] + e;
    for (const q of L.sents) {
      if (sentMin(q, s0, s1) <= q.hw + SENT_PAD + M) return false;
      if (sentMin(q, h0, h1) <= q.hw + SENT_PAD_HEAD + M) return false;
    }
  }
  return true;
}
// prédicteur honnête pour le banc d'essai : même calcul que le jeu, marge 0,7 × GAP ; tSim (facultatif) = instant du
// lancer envisagé (≥ t), sinon l'instant simulé courant
window.__botSafe = function (tSim) {
  if (state !== 'play' || playPhase !== 'jeu' || flying || left <= 0 || !L) return false;
  return shotSafe(tSim > t ? tSim : t, .7);
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
  if (state === 'play' && playPhase === 'compte') {
    const c0 = Math.ceil(countT / (COUNTDOWN / 3));
    countT -= h;
    const c1 = Math.ceil(countT / (COUNTDOWN / 3));
    if (countT <= 0) { countT = 0; playPhase = 'jeu'; }
    else if (c1 !== c0) bus.emit('tick', c1);
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
        if (Math.floor((rot - th) / TAU) !== Math.floor((r0 - th) / TAU)) { headFlash = 1; bus.emit('ping', s); }
      }
    }
  }
  if (state === 'play' && playPhase === 'jeu') {
    intro = Math.max(0, intro - h); wIntro = Math.max(0, wIntro - h);
    build = Math.min(1, build + h * 2.8);
    readyK = Math.min(1, readyK + h * 10);
    levelTime += h;
    if (recall && (recall.life -= h) <= 0) recall = null;
  }
  if (state === 'dying') { dieT += h; if (dieT >= FAIL_SHEET) { state = 'failed'; bus.emit('failed'); } }
  if (state === 'winning') {
    winT += h;
    if (winT > .26 && !exploded) { exploded = true; bus.emit('explode'); }
    if (winT > 1.15) { state = 'won'; wonT = 0; bus.emit('won'); }
  }
  if (state === 'won') wonT += h;

  for (const s of stuck) if (s.k < 1) s.k = Math.min(1, s.k + h * 6);
  if (nearMark && (nearMark.life -= h) <= 0) nearMark = null;
  pulse = Math.max(0, pulse - h * 7);
  headFlash = Math.max(0, headFlash - h * 5);
  starFlash = Math.max(0, starFlash - h * 2.2);
  bus.emit('step', h);
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

