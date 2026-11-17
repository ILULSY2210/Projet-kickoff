// Pilote du simulateur : code injecté tel quel dans le contexte du VRAI jeu (Node : tests/sim/load.js ; Chromium : la page).
// Il ne contient aucune physique : il appelle startLevel, update(STEP), throwPin(tSim), predict et shotSafe du cœur.
// Conventions communes à toutes les politiques :
//   - la simulation avance en pas de STEP, comme la boucle du jeu ; un tap à l'instant tA (absolu) est lancé par
//     throwPin(tA) juste avant le pas qui le contient (t ≤ tA < t + STEP), comme la couche d'entrée ;
//   - les instants des taps sont notés relativement au début du niveau (T0 = t après startLevel) : journal rejouable.
// Politiques :
//   aim      joueur qui vise : à chaque décision, il examine les lancers possibles sur un tour de l'astre (au moins 1,5 s
//            et trois périodes de passage des anneaux, au plus 8 s), avec
//            la même predict() / shotSafe() que __botSafe, garde les instants où le tir survit, mesure pour chacun la marge
//            de temps au plus proche instant mortel, et vise le milieu de la première fenêtre presque aussi large que la
//            meilleure (≥ 85 %), ou déjà assez large pour sa précision (marge ≥ 3 σ : il ne perd pas plus de 0,3 % par tir à
//            ne pas attendre davantage) ; son tap part avec une imprécision gaussienne σ ; il réfléchit THINK = 0,4 s après
//            chaque impact (temps de voir l'aiguille plantée et de relire le bord, comme un joueur réel).
//   reactive joueur qui n'anticipe pas : il extrapole la rotation à vitesse constante et tape RT = 0,2 s après avoir vu
//            une ouverture (seuil qui baisse quand il attend), avec la même imprécision σ, quand l'astre tourne à peu près
//            régulièrement (il voit une accélération en cours, il ne la prévoit pas) ; il ne tire pas pendant que les
//            chevrons annoncent un arrêt ou une inversion (aheadEvent, 0,45 s à l'avance), ni quand les portes des anneaux
//            ne laisseront pas passer l'aiguille (losanges de synchronisation), ni vers une zone active ou annoncée.
//   mash     salve à l'aveugle : un tap toutes les c secondes ± 1 image, dès un départ tiré au hasard dans la première
//            seconde, sans regarder.
//   bot      prédicteur honnête du banc d'essai (__botSafe), comme tests/play.js.
const DRIVER = String.raw`
var __sim = (function () {
  var FIRST = .5, THINK = .4, CAP = .25, RT = .2, MAXT = 90;
  function gaussOf(R) { return function () { var u = 0; while (u === 0) u = R(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * R()); }; }
  // avance en pas de STEP jusqu'au pas qui contient l'instant absolu tA (exclu), tant que l'on joue
  function runTo(tA) { while (state === 'play' && t + STEP <= tA) update(STEP); }
  // laisse voler les aiguilles jusqu'à leur impact (ou la fin)
  function settle() { var g = 0; while (state === 'play' && flights.length && g++ < 400) update(STEP); }
  function result(T0, taps) {
    var st = state === 'winning' || state === 'won' ? 'win' : state === 'dying' || state === 'failed' ? 'fail' : 'open';
    var ang = []; for (var i = 0; i < stuck.length; i++) if (!stuck[i].pre && !stuck[i].twin) ang.push(stuck[i].a);
    return { st: st, kind: failInfo ? failInfo.kind : null, left: left, T: t - T0, ang: ang, taps: taps, orbs: orbHits };
  }
  // rejoue un journal (instants relatifs au début du niveau)
  function replay(n, taps, maxT) {
    startLevel(n); var T0 = t, j = 0; maxT = maxT || MAXT;
    while (state === 'play') {
      if (j < taps.length) { runTo(T0 + taps[j]); if (state !== 'play') break; throwPin(T0 + taps[j]); j++; }
      else { if (!flights.length || t - T0 > maxT) break; update(STEP); }
    }
    return result(T0, taps.slice());
  }
  // choix du joueur qui vise, à l'instant courant (aucune aiguille en vol) : instant de lancer visé, ou -1
  var SAFE = [], MARG = [];
  function planShot(sigma) {
    // horizon : un tour de l'astre, au moins 1,5 s et trois périodes de passage des anneaux, au plus 8 s
    var hz = 1.5;
    for (var qi = 0; qi < L.rings.length; qi++) { var q = L.rings[qi]; hz = Math.max(hz, 3 * TAU / (q.gates.length * Math.abs(q.w))); }
    var t0 = t, g = 2 * STEP, K = Math.ceil(8 / g), kMin = Math.ceil(Math.min(8, hz) / g), cum = 0, prevR = predictRot(t0), n = 0, any = false;
    for (var k = 0; k <= K; k++) {
      var tL = t0 + k * g, s = shotSafe(tL, 0), r = predictRot(tL);
      SAFE[k] = s; if (s) any = true;
      cum += Math.abs(r - prevR); prevR = r; n = k + 1;
      if (k >= kMin && cum >= TAU + .3) break;
    }
    if (!any) return -1;
    // marge de temps au plus proche instant mortel (avant ou après) ; avant le premier instant examiné : inconnu, donc libre
    var d = 1e9;
    for (var k2 = 0; k2 < n; k2++) { if (!SAFE[k2]) d = 0; else d += g; MARG[k2] = d; }
    d = 1e9;
    for (var k3 = n - 1; k3 >= 0; k3--) { if (!SAFE[k3]) d = 0; else d += g; if (d < MARG[k3]) MARG[k3] = d; }
    var mmax = 0, k4;
    for (k4 = 0; k4 < n; k4++) if (SAFE[k4]) { var v = Math.min(MARG[k4], CAP); if (v > mmax) mmax = v; }
    var thr = Math.min(mmax * .85, sigma > 0 ? 3 * sigma : 1e9), js = -1;
    for (k4 = 0; k4 < n; k4++) if (SAFE[k4] && Math.min(MARG[k4], CAP) >= thr) { js = k4; break; }
    var jb = js;
    for (k4 = js + 1; k4 < n && SAFE[k4]; k4++) { if (Math.min(MARG[k4], CAP) > Math.min(MARG[jb], CAP) + 1e-9) jb = k4; else if (MARG[k4] < MARG[jb] - 1e-6) break; }
    return t0 + jb * g;
  }
  function aim(n, sigma, seed, opt) {
    opt = opt || {};
    var R = rng(seed), gauss = gaussOf(R), taps = [];
    startLevel(n); var T0 = t, tDec = T0 + FIRST;
    while (state === 'play' && left > 0) {
      runTo(tDec); if (state !== 'play') break;
      if (t - T0 > MAXT) break;
      var tP = planShot(sigma);
      if (tP < 0) { tDec = t + .5; continue; }
      var tA = tP + sigma * gauss(); if (tA < t) tA = t;
      runTo(tA); if (state !== 'play') break;
      throwPin(tA); taps.push(tA - T0);
      settle();
      tDec = t + THINK;
    }
    if (state === 'play') settle();
    return result(T0, taps);
  }
  // joueur réactif : extrapole à vitesse constante, tape RT après avoir vu l'ouverture
  function clearAt(a) {
    var d = 9, i, x;
    for (i = 0; i < stuck.length; i++) { x = angDiff(stuck[i].a, a); if (x < d) d = x; }
    if (L.trav) for (i = 0; i < stuck.length; i++) { x = angDiff(stuck[i].a, a + Math.PI); if (x < d) d = x; }
    return d - GAP;
  }
  function bestGap() {
    if (!stuck.length) return Math.PI;
    var as = [], i; for (i = 0; i < stuck.length; i++) as.push(norm(L.trav ? stuck[i].a % Math.PI : stuck[i].a));
    as.sort(function (x, y) { return x - y; });
    var C = L.trav ? Math.PI : TAU, bw = 0;
    for (i = 0; i < as.length; i++) { var w = (i + 1 < as.length ? as[i + 1] : as[0] + C) - as[i]; if (w > bw) bw = w; }
    return bw / 2 - GAP;
  }
  function reactive(n, sigma, seed) {
    var R = rng(seed), gauss = gaussOf(R), taps = [];
    startLevel(n); var T0 = t, tDec = T0 + FIRST;
    while (state === 'play' && left > 0) {
      runTo(tDec); if (state !== 'play') break;
      var best = bestGap(), tTap = -1;
      while (state === 'play' && t - T0 < MAXT) {
        var waited = t - tDec, thr = stuck.length ? best * Math.max(.4, .85 - .08 * waited) : -1;
        var a = norm(HPI - (rot + speedAt(t) * (RT + FLIGHT)));
        // il lit les chevrons : pas de tir quand un arrêt ou une inversion est annoncé (0,45 s à l'avance) ; il voit aussi
        // l'astre accélérer ou ralentir : il attend un mouvement à peu près régulier (vitesse qui a changé de moins de 12 %
        // en 0,15 s, tolérance qui grandit quand il attend), sans rien prévoir de la suite
        var v0 = speedAt(t), v1 = speedAt(t - .15), steady = Math.abs(v0 - v1) <= (.12 + .04 * waited) * Math.max(Math.abs(v0), .3);
        var ok = steady && clearAt(a) >= thr && !aheadEvent(t, announceWindow()).kind;
        // il voit les zones : pas de tir vers une zone active (bande hachurée) ou annoncée (pointillés qui clignotent),
        // à l'endroit où tomberait son aiguille (une zone éteinte ne peut pas s'allumer avant l'impact : l'annonce dure
        // 0,6 s, plus que RT + FLIGHT) ; une zone glissante est prise là où elle sera à l'impact
        if (ok && L.zones.length) for (var zi = 0; zi < L.zones.length; zi++) {
          var z = L.zones[zi]; if (zoneState(z, t) < 1) continue;
          var zc = zoneCenter(z, t + RT + FLIGHT), zp = z.hw + GAP / 2 + Math.max(.05, thr);
          if (angDiff(a, zc) < zp || (L.trav && angDiff(a + Math.PI, zc) < zp)) ok = false;
        }
        // il voit les losanges des anneaux (portes alignées) et les portes qui approchent : tir seulement si elles laissent
        // passer une aiguille lancée au moment de son tap, avec une marge de part et d'autre (80 ms, qui baisse jusqu'à 50 ms
        // quand il attend, comme son exigence sur les arcs : il ne tape pas au tout début de l'ouverture)
        if (ok && L.rings.length) { var tR = t + RT, rm = Math.max(.05, .08 - .01 * waited); for (var ri = 0; ri < L.rings.length; ri++) { var rq = L.rings[ri], rw = ringWindow(rq, tR); if (ringHit(rq, rw[0] - rm, rw[1] + rm, RING_PAD[rq.k]) >= 0) ok = false; } }
        if (ok && L.sents.length) { var tL = t + RT, w = sentWindow(); for (var i = 0; i < L.sents.length; i++) { var q = L.sents[i]; if (sentMin(q, tL + w[0] - .12, tL + HEAD_WIN[1] + .12) <= q.hw + SENT_PAD_HEAD) ok = false; } }
        if (ok) { tTap = t + RT; break; }
        update(STEP);
      }
      if (tTap < 0 || state !== 'play') break;
      var tA = tTap + sigma * gauss(); if (tA < t) tA = t;
      runTo(tA); if (state !== 'play') break;
      throwPin(tA); taps.push(tA - T0);
      settle();
      tDec = t + THINK;
    }
    if (state === 'play') settle();
    return result(T0, taps);
  }
  // salve à l'aveugle : cadence c (s) ± 1 image (1/60 s), premier tap dans la première seconde
  function mash(n, c, seed) {
    var R = rng(seed), taps = [];
    startLevel(n); var T0 = t, tA = T0 + R() * 1;
    while (state === 'play' && left > 0 && t - T0 < 60) {
      runTo(tA); if (state !== 'play') break;
      throwPin(tA); taps.push(tA - T0);
      tA += c + (Math.floor(R() * 3) - 1) / 60;
    }
    if (state === 'play') settle();
    return result(T0, taps);
  }
  // salve soutenue pendant D secondes de jeu : relance dès que la feuille d'échec le permet (FAIL_SHEET après la
  // collision), tirs ignorés RETRY_LOCK après la relance (couche d'entrée) ; succès si un niveau est fini avant D secondes
  function mashSustained(n, c, seed, D) {
    var R = rng(seed), tries = 1, elapsed = 0, next = R(), lock = -1;
    startLevel(n); var T0 = t;
    while (next <= D) {
      runTo(T0 + next - elapsed);
      if (state === 'winning' || state === 'won') return { win: true, tries: tries, T: elapsed + t - T0 };
      if (state === 'dying' || state === 'failed') {
        var sheet = elapsed + (t - T0) + FAIL_SHEET;
        while (next < sheet) next += c + (Math.floor(R() * 3) - 1) / 60;
        if (next > D) break;
        elapsed = next; startLevel(n, true); T0 = t; lock = next + RETRY_LOCK; tries++;
      } else if (state === 'play' && next >= lock) throwPin(T0 + next - elapsed);
      next += c + (Math.floor(R() * 3) - 1) / 60;
    }
    return { win: false, tries: tries };
  }
  // prédicteur honnête du banc d'essai, à pas dt ; g > 0 : délais aléatoires entre les tirs
  function bot(n, dt, g, seed) {
    var x = seed, rnd = function () { return (x = (x * 16807) % 2147483647) / 2147483647; };
    startLevel(n); var T = 0, cool = g * .29;
    while (T < 75) {
      if (cool <= 0 && state === 'play' && !flying && left > 0 && window.__botSafe()) { throwPin(); cool = g ? rnd() * .35 : 0; }
      update(dt); T += dt; cool -= dt;
      if (state !== 'play') break;
    }
    return { st: state === 'winning' || state === 'won' ? 'win' : state === 'dying' || state === 'failed' ? 'fail' : 'open', T: T };
  }
  return { replay: replay, aim: aim, reactive: reactive, mash: mash, mashSustained: mashSustained, bot: bot, planShot: planShot };
})();
`;
module.exports = { DRIVER };
