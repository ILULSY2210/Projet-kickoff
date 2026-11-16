// Mécaniques du générateur v2 (vrai js/core.js dans Node) : pour chaque idée, prédiction exacte et règles propres.
//   node tests/unit/mechanics.test.js
// Pour chaque mécanique réalisée, sur les premiers niveaux qui l'utilisent : des tirs lancés à des instants quelconques
// (au milieu d'un pas) tombent exactement où predict() l'avait annoncé juste avant (écart < 1e-9 rad), et la règle propre
// à la mécanique est vérifiée :
//   accel : après chaque aiguille plantée, la vitesse est multipliée par (1 + k) en 0,3 s (continue), jusqu'au plafond.
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
console.log(out.join('\n'));
if (fails.length) { console.log('mechanics : ÉCHEC\n  ' + fails.slice(0, 20).join('\n  ')); process.exit(1); }
console.log('mechanics : pass');
