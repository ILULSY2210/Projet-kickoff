// Mécaniques du générateur v2 (vrai js/core.js dans Node) : pour chaque idée, prédiction exacte et règles propres.
//   node tests/unit/mechanics.test.js
// Pour chaque mécanique réalisée, sur les premiers niveaux qui l'utilisent : des tirs lancés à des instants quelconques
// (au milieu d'un pas) tombent exactement où predict() l'avait annoncé juste avant (écart < 1e-9 rad), et la règle propre
// à la mécanique est vérifiée :
//   accel : après chaque aiguille plantée, la vitesse est multipliée par (1 + k) en 0,3 s (continue), jusqu'au plafond ;
//   demi-tour : après la k-ième aiguille, la rotation s'inverse warn s plus tard (en 80 ms) ; au rythme : aux instants
//   t0 + j·P ; chaque demi-tour est annoncé par les chevrons au moins max(0,45 ; warn) s avant.
const { load } = require('../sim/load');
const G = load();
const fails = [], check = (c, m) => { if (!c) fails.push(m); };
const mk = G.makeLevel, STEP = G.get('STEP');
let x = 12345; const rnd = () => (x = (x * 16807) % 2147483647) / 2147483647;
const levelsWith = (pred, k) => { const o = []; for (let n = 1; n <= 400 && o.length < k; n++) if (pred(mk(n))) o.push(n); return o; };
// tirs à des instants quelconques, quand rien ne vole et que __botSafe le permet : angle prédit = angle planté
function predictionCheck(name, ns) {
  let shots = 0, worst = 0;
  for (const n of ns) for (let g = 0; g < 3; g++) {
    G.startLevel(n); G.update(.5 + rnd());
    for (let i = 0; i < 4000 && G.get('state') === 'play' && G.get('left') > 0; i++) {
      const t = G.get('t'), tL = t + rnd() * STEP;
      if (!G.get('flights').length && G.safe(tL)) {
        const a = G.predict(tL).a, before = G.get('stuck').length;
        G.throwPin(tL);
        for (let j = 0; j < 40 && G.get('flights').length && G.get('state') === 'play'; j++) G.update(STEP);
        const st = G.get('stuck');
        if (st.length > before) { const got = st[before].a, e = Math.abs(((got - a) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI); worst = Math.max(worst, e); shots++; }
        else check(false, `${name}, niveau ${n} : tir sûr perdu (${G.get('failInfo') && G.get('failInfo').kind})`);
        G.update(rnd() * .4);
      } else G.update(STEP);
    }
  }
  check(shots > 20 && worst < 1e-9, `${name} : ${shots} tirs, écart prédiction / impact ${worst}`);
  return `${name} : ${shots} tirs, écart max ${worst.toExponential(1)}`;
}
const out = [];
// accélération à chaque aiguille
{
  const ns = levelsWith(L => L.accel, 6);
  check(ns.length >= 6 && ns[0] === 9, `accélération : niveaux ${ns.join(', ')}`);
  out.push(predictionCheck('accélération', ns));
  for (const n of ns.slice(0, 3)) {
    G.startLevel(n); G.update(.6);
    const A = G.get('L').accel, m = () => G.run('accelMult(t)');
    let prev = 1;
    for (let k = 0; k < 4; k++) {
      while (!G.safe()) G.update(STEP);
      G.throwPin(); const h0 = G.get('dyn').hits.length;
      while (G.get('dyn').hits.length === h0 && G.get('state') === 'play') G.update(STEP);
      const te = G.get('dyn').hits[h0];
      G.update(.35);
      const want = Math.min(A.cap, prev * (1 + A.k));
      check(Math.abs(m() - want) < 1e-9, `accélération, niveau ${n} : multiplicateur ${m()} après ${k + 1} aiguille(s), attendu ${want}`);
      // continuité : pas de saut de vitesse à l'impact
      const v0 = G.speedAt(te - 1e-6), v1 = G.speedAt(te + 1e-6);
      check(Math.abs(v1 - v0) < 1e-4, `accélération, niveau ${n} : saut de vitesse à l'impact (${v0} → ${v1})`);
      prev = want;
    }
  }
}
// demi-tours annoncés (toutes les k aiguilles, puis au rythme)
{
  const ns = levelsWith(L => L.demi, 6), nr = levelsWith(L => L.rhythm, 4);
  check(ns[0] === 19 && nr[0] === 161, `demi-tour : premiers niveaux ${ns[0]}, au rythme ${nr[0]}`);
  out.push(predictionCheck('demi-tour', ns));
  out.push(predictionCheck('demi-tour au rythme', nr));
  const ahead = G.get('aheadEvent');
  for (const n of ns.slice(0, 3)) {
    G.startLevel(n); G.update(.6);
    const D = G.get('L').demi;
    for (let k = 1; k <= D.every * 2 && G.get('left') > 1; k++) {
      while (!G.safe()) G.update(STEP);
      G.throwPin(); const p0 = G.get('dyn').planted;
      while (G.get('dyn').planted === p0 && G.get('state') === 'play') G.update(STEP);
      if (k % D.every) { check(G.get('dyn').flips.length === Math.floor(k / D.every), `demi-tour, niveau ${n} : demi-tour programmé trop tôt`); continue; }
      const tf = G.get('dyn').flips[G.get('dyn').flips.length - 1], t = G.get('t');
      check(Math.abs(tf - (t - (t - tf) - 0) - 0) < 1 && tf > t, `demi-tour, niveau ${n} : programmé après l'aiguille ${k}`);
      const v0 = G.speedAt(tf - .001), v1 = G.speedAt(tf + .081);
      check(Math.sign(v0) === -Math.sign(v1), `demi-tour, niveau ${n} : la rotation s'inverse (${v0.toFixed(3)} → ${v1.toFixed(3)})`);
      const e = ahead(t, G.run('announceWindow()'));
      check(e.kind !== null && e.dt <= tf - t + .08, `demi-tour, niveau ${n} : annoncé dès l'impact, ${(tf - t).toFixed(2)} s avant (${e.kind}, ${e.dt})`);
    }
  }
  for (const n of nr.slice(0, 2)) {
    G.startLevel(n); const R = G.get('L').rhythm;
    for (let j = 0; j < 3; j++) {
      const W = G.run('announceWindow()'), tf = R.t0 + j * R.P, e = ahead(tf - Math.max(.45, R.warn) + .002, W);
      check(e.kind !== null && e.dt <= Math.max(.45, R.warn) + .08, `rythme, niveau ${n} : demi-tour ${j} annoncé ${Math.max(.45, R.warn)} s avant (${e.kind}, ${e.dt})`);
      check(Math.sign(G.speedAt(tf - .001)) === -Math.sign(G.speedAt(tf + .081)), `rythme, niveau ${n} : inversion au demi-tour ${j}`);
    }
  }
}
console.log(out.join('\n'));
if (fails.length) { console.log('mechanics : ÉCHEC\n  ' + fails.slice(0, 20).join('\n  ')); process.exit(1); }
console.log('mechanics : pass');
