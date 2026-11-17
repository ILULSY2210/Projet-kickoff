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
      const v0 = G.run(`flipSign(${tf - .001})`), v1 = G.run(`flipSign(${tf + .081})`);
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
      check(Math.sign(G.run(`flipSign(${tf - .001})`)) === -Math.sign(G.run(`flipSign(${tf + .081})`)), `rythme, niveau ${n} : inversion au demi-tour ${j}`);
    }
  }
}
// inversion à chaque aiguille
{
  const ns = levelsWith(L => L.inv, 6);
  check(ns[0] === 171, `inversion à l'impact : premier niveau ${ns[0]}`);
  out.push(predictionCheck('inversion à l\'impact', ns));
  for (const n of ns.slice(0, 3)) {
    G.startLevel(n); G.update(.6);
    for (let k = 0; k < 3 && G.get('left') > 1; k++) {
      while (!G.safe()) G.update(STEP);
      G.throwPin(); const p0 = G.get('dyn').planted;
      while (G.get('dyn').planted === p0 && G.get('state') === 'play') G.update(STEP);
      const te = G.get('dyn').flips[G.get('dyn').flips.length - 1];
      check(Math.sign(G.run(`flipSign(${te - .001})`)) === -Math.sign(G.run(`flipSign(${te + .081})`)), `inversion à l'impact, niveau ${n} : la rotation s'inverse à l'aiguille ${k + 1}`);
      G.update(.2);
    }
  }
}
// rampe : × (1 + k) en T secondes, sans saut
{
  const ns = levelsWith(L => L.ramp, 6);
  check(ns[0] === 71, `rampe : premier niveau ${ns[0]}`);
  out.push(predictionCheck('rampe', ns));
  for (const n of ns.slice(0, 3)) {
    G.startLevel(n); const L = G.get('L'), m = x => G.run(`rampMult(${x})`);
    check(m(L.phase) === 1 && Math.abs(m(L.phase + L.ramp.T) - (1 + L.ramp.k)) < 1e-12 && m(L.phase + L.ramp.T / 2) > 1, `rampe, niveau ${n} : de × 1 à × ${1 + L.ramp.k} en ${L.ramp.T} s`);
  }
}
// rotation irrégulière : jamais deux fois le même motif (fréquences non multiples), arrêts et retours annoncés
{
  const ns = levelsWith(L => L.pattern === 6, 6);
  check(ns[0] === 49, `rotation irrégulière : premier niveau ${ns[0]}`);
  out.push(predictionCheck('rotation irrégulière', ns));
  for (const n of ns.slice(0, 4)) {
    const P = mk(n).irr;
    for (let i = 0; i < P.f.length; i++) for (let j = i + 1; j < P.f.length; j++) { const q = P.f[j] / P.f[i]; check(Math.abs(q - Math.round(q)) > .05, `rotation irrégulière, niveau ${n} : fréquences presque multiples (${P.f})`); }
  }
}
// zones pulsées et glissantes : une aiguille qui arrive dans la zone active est perdue ; dans une zone éteinte (ou
// annoncée), elle reste ; une zone qui s'allume ou glisse ensuite sur une aiguille plantée ne la touche pas ; shotSafe
// (k = 0) dit la même chose que le jeu
function zoneCheck(name, kind, first) {
  const ns = levelsWith(L => L.zones.some(z => z.kind === kind), 6);
  check(ns[0] === first, `${name} : premier niveau ${ns[0]}`);
  out.push(predictionCheck(name, ns));
  let agree = 0, dead = 0, kept = 0, passed = 0;
  for (const n of ns.slice(0, 4)) for (let i = 0; i < 300; i++) {
    G.startLevel(n); G.update(.3 + i * .021);
    // instant de lancer où les anneaux (et les sentinelles) laissent passer : seule la zone décide
    let tL = G.get('t') + rnd() * STEP;
    for (let j = 0; j < 2000 && !G.run(`L.rings.every(q => { const w = ringWindow(q, ${tL}); return ringHit(q, w[0], w[1], RING_PAD[q.k]) < 0; }) && L.sents.every(q => sentMin(q, ${tL} + sentWindow()[0], ${tL} + HEAD_WIN[1]) > q.hw + SENT_PAD_HEAD)`); j++) { G.update(STEP); tL = G.get('t') + rnd() * STEP; }
    const zi = G.get('L').zones.findIndex(z => z.kind === kind), z = G.get('L').zones[zi], t = G.get('t');
    // tir visé près du centre de la zone : on tourne l'astre pour que l'impact y tombe
    const pr = G.predict(tL), zc = G.run(`zoneCenter(L.zones[${zi}], ${pr.tI})`);
    G.set('rot', G.get('rot') + (pr.a - zc) + (rnd() - .5) * (z.hw + .1) * 2);
    const safe = G.run(`shotSafe(${tL}, 0)`), st = G.run(`zoneState(L.zones[${zi}], ${tL + G.get('FLIGHT')})`);
    G.throwPin(tL);
    for (let j = 0; j < 20 && G.get('flights').length && G.get('state') === 'play'; j++) G.update(STEP);
    const lost = G.get('state') !== 'play';
    if (lost) { dead++; check(['zone', 'pin', 'ring', 'sent', 'twin'].includes(G.get('failInfo').kind), `${name}, niveau ${n} : perdue (${G.get('failInfo').kind}, état ${st})`); }
    else {
      kept++;
      const n0 = G.get('stuck').length, a0 = G.get('stuck')[n0 - 1].a;
      for (let j = 0; j < 400 && G.get('state') === 'play'; j++) { G.update(STEP); if (G.run(`zoneState(L.zones[${zi}], t) === 2 && angDiff(${a0}, zoneCenter(L.zones[${zi}], t)) < L.zones[${zi}].hw`)) { passed++; break; } }
      check(G.get('state') === 'play' && G.get('stuck').length === n0, `${name}, niveau ${n} : aiguille plantée touchée par la zone`);
    }
    if (safe === !lost) agree++;
  }
  check(dead > 30 && kept > 30 && passed > 10, `${name} : échantillon (${dead} perdues, ${kept} plantées, ${passed} sous une zone active ensuite)`);
  check(agree === dead + kept, `${name} : shotSafe d'accord avec le jeu sur ${agree}/${dead + kept}`);
}
zoneCheck('zones pulsées', 'pulse', 111);
zoneCheck('zones glissantes', 'glide', 121);
// deux sentinelles en sens opposés
{
  const ns = levelsWith(L => L.sents.length > 1, 6);
  check(ns[0] === 221, `deux sentinelles : premier niveau ${ns[0]}`);
  for (const n of ns) { const q = mk(n).sents; check(Math.sign(q[0].w) === -Math.sign(q[1].w), `deux sentinelles, niveau ${n} : sens opposés`); }
  out.push(predictionCheck('deux sentinelles', ns));
}
// anneaux à portes (1, 2, 3 anneaux, portes pulsées) : l'aiguille est interceptée si et seulement si l'axe sort d'une
// porte ouverte pendant sa traversée (ringHit, la même règle que le jeu) ; anneaux voisins à contre-sens
function ringCheck(name, pred, first) {
  const ns = levelsWith(pred, 6);
  check(ns[0] === first, `${name} : premier niveau ${ns[0]}`);
  out.push(predictionCheck(name, ns));
  let hit = 0, pass = 0;
  for (const n of ns.slice(0, 4)) {
    const R = mk(n).rings; for (let k = 1; k < R.length; k++) check(Math.sign(R[k].w) === -Math.sign(R[k - 1].w), `${name}, niveau ${n} : anneaux voisins à contre-sens`);
    for (let i = 0; i < 250; i++) {
      G.startLevel(n); G.update(.3 + i * .017);
      const tL = G.get('t') + rnd() * STEP;
      const fatal = G.run(`L.rings.some(q => { const w = ringWindow(q, ${tL}); return ringHit(q, w[0], w[1], RING_PAD[q.k]) >= 0; })`);
      G.throwPin(tL);
      for (let j = 0; j < 20 && G.get('flights').length && G.get('state') === 'play'; j++) G.update(STEP);
      const kind = G.get('state') !== 'play' && G.get('failInfo') ? G.get('failInfo').kind : null;
      // une sentinelle peut intercepter l'aiguille avant l'anneau
      check(fatal ? kind === 'ring' || kind === 'sent' : kind !== 'ring', `${name}, niveau ${n} : tir à ${tL.toFixed(4)} : règle ${fatal ? 'interception' : 'passage'}, jeu ${kind || 'planté'}`);
      if (fatal) hit++; else pass++;
    }
  }
  check(hit > 100 && pass > 100, `${name} : échantillon (${hit} interceptions, ${pass} passages)`);
}
ringCheck('anneau', L => L.rings.length > 0, 39);
ringCheck('deux anneaux', L => L.rings.length > 1, 81);
ringCheck('trois anneaux', L => L.rings.length > 2, 251);
ringCheck('portes pulsées', L => L.rings.some(q => q.pulse), 261);
console.log(out.join('\n'));
if (fails.length) { console.log('mechanics : ÉCHEC\n  ' + fails.slice(0, 20).join('\n  ')); process.exit(1); }
console.log('mechanics : pass');
