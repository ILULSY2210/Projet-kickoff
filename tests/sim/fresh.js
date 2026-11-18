// Contrôle des marges sur graines neuves (recette 3, Q5) : les règles de report.js les plus exposées au hasard des
// mesures, rejouées avec un jeu de graines que ni le réglage (tune.js) ni le rapport officiel n'ont vu.
//   node tests/sim/fresh.js K [--trials=400] [--recheck=1000] [--worlds=1,2,3,4,5,6] [--inf=1] [--out=dossier]
// K décale toutes les graines de seeds.json (comme report.js --seed=K) ; lancer au moins deux K différents.
//   plancher      p30 (30 ms) de 1..300, de 401..500 (COSMOS ∞ du rapport) et des sources de réserve 321, 368, 397 :
//                 ≥ 75 % ET borne basse de Wilson ≥ 72 % ; à moins de 3 points d'une limite (p30 < 78 % ou Wilson < 75 %),
//                 remesure à --recheck essais (graines aim_r30 + K), qui remplace la première mesure (comme report.js)
//   réactif       règle « réactif » de report.js (niveau à arrêts ou inversions ≤ 15 points sous la moyenne de ses voisins,
//                 sinon variante calme : échec si elle fait plus de 15 points de mieux) ; plus de 12 points sous ses
//                 voisins : le niveau et ses voisins sont remesurés à --recheck essais, puis sa variante calme
//   respirations  x1-x2 contre x8-x9 du bloc précédent à 70 ms, ≥ +5 (cible ≈ +10) ; sous +8 : les quatre niveaux
//                 remesurés à --recheck essais
// --worlds : mondes entiers seulement (les voisins du joueur réactif restent dans leur monde) ; --inf=0 : sans COSMOS ∞.
// Chaque étape est écrite dans <out>/K<K>_<étape>.json et reprise telle quelle si le fichier existe (mesure longue,
// reprise après un arrêt) : changer de dossier après avoir changé un réglage. Résumé dans <out>/K<K>_summary.txt et
// <out>/K<K>_result.json ; code de sortie 1 si une règle échoue.
const fs = require('fs'), path = require('path');
const { pool, wilson } = require('./pool');
const { load, ROOT } = require('./load');
const SEEDS = require('./seeds.json');
const arg = (k, d) => { const a = process.argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const K = +process.argv[2], N = +arg('trials', 400), NR = +arg('recheck', 1000);
const WORLDS = arg('worlds', '1,2,3,4,5,6').split(',').map(Number), INFON = +arg('inf', 1);
const OUT = path.resolve(arg('out', path.join(ROOT, 'tests', 'out', 'sim', 'fresh')));
fs.mkdirSync(OUT, { recursive: true });
const G = load(), D = G.get('DIFFICULTY');
const CHUNK = 50;
const info = {};
const lv = n => info[n] || (info[n] = (L => ({ boss: L.boss, special: L.special, teach: L.teach,
  sf: [2, 4, 5].includes(L.pattern) || L.flags.some(f => ['demitour', 'rythme', 'invImpact', 'irreg'].includes(f)) }))(G.makeLevel(n)));
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
const pc = x => (x * 100).toFixed(1);
let P = null;
async function measure(name, specs) {
  // specs : [{ n, sk, sigma, trials, calm }] → { n: { w, t, why } } ; étape écrite sur disque, reprise si elle existe
  const f = path.join(OUT, `K${K}_${name}.json`);
  if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf8'));
  if (!P) P = pool();
  const jobs = [], own = [];
  for (const s of specs) for (let i = 0; i < s.trials; i += CHUNK) {
    jobs.push({ kind: s.kind || 'aim', n: s.n, sigma: s.sigma, trials: Math.min(CHUNK, s.trials - i), seed0: SEEDS[s.sk] + s.n * 10007 + K + i, calm: !!s.calm });
    own.push(s.n);
  }
  const t0 = Date.now(); let done = 0;
  const res = await P.run(jobs, () => { if (++done % 200 === 0) process.stderr.write(`\r  ${name} ${done}/${jobs.length} lots, ${((Date.now() - t0) / 1000).toFixed(0)} s`); });
  process.stderr.write(`\r  ${name} ${jobs.length} lots, ${((Date.now() - t0) / 1000).toFixed(0)} s\n`);
  const o = {};
  res.forEach((r, i) => { const x = o[own[i]] = o[own[i]] || { w: 0, t: 0, why: {} }; x.w += r.wins; x.t += r.trials; for (const q in r.why) x.why[q] = (x.why[q] || 0) + r.why[q]; });
  fs.writeFileSync(f, JSON.stringify(o));
  return o;
}
(async () => {
  const t0 = Date.now();
  const R300 = []; for (let n = 1; n <= 300; n++) if (WORLDS.includes(Math.floor((n - 1) / 50) + 1)) R300.push(n);
  const INF = []; if (INFON) for (let n = 401; n <= 500; n++) INF.push(n);
  const RES = INFON ? [321, 368, 397] : [];
  const floorL = [...R300, ...INF, ...RES];
  floorL.forEach(lv);
  // --- plancher ---
  const a30 = await measure('p30', floorL.map(n => ({ n, sk: 'aim_30', sigma: .03, trials: N })));
  const F = {};
  for (const n of floorL) F[n] = { w: a30[n].w, t: a30[n].t, first: a30[n].w / a30[n].t };
  const near30 = n => { const ci = wilson(F[n].w, F[n].t); return F[n].w / F[n].t < D.floor30 + .03 || ci[0] < D.floorLow95 + .03; };
  const re30 = floorL.filter(near30);
  if (re30.length) {
    const b = await measure('p30r', re30.map(n => ({ n, sk: 'aim_r30', sigma: .03, trials: NR })));
    for (const n of re30) Object.assign(F[n], { w: b[n].w, t: b[n].t, rechecked: true });
  }
  // --- réactif ---
  R300.forEach(lv);
  const ar = await measure('pr', R300.map(n => ({ n, kind: 'reactive', sk: 'reactive_45', sigma: .045, trials: N })));
  const pr = {}, nr = {}, whyr = {};
  for (const n of R300) { pr[n] = ar[n].w / ar[n].t; nr[n] = ar[n].t; whyr[n] = ar[n].why; }
  const ref = n => !info[n].boss && !info[n].special && !info[n].teach;
  const nbIds = n => { const w = Math.floor((n - 1) / 50), out = []; for (const d of [-1, 1]) { let m = n, k = 0; while (k < 2) { m += d; if (m < 1 || m > 300 || Math.floor((m - 1) / 50) !== w || pr[m] === undefined) break; if (ref(m)) { out.push(m); k++; } } } return out; };
  const nb = n => nbIds(n).map(m => pr[m]);
  const gap = n => { const x = nb(n); return x.length >= 2 ? mean(x) - pr[n] : 0; };
  const firstPr = Object.assign({}, pr);
  // niveau signalé ET ses voisins remesurés (comme report.js : la règle compare le niveau à la moyenne de ses voisins)
  const flagR = R300.filter(n => info[n].sf && gap(n) > .12), reR = [...new Set(flagR.concat(...flagR.map(nbIds)))];
  if (reR.length) {
    const b = await measure('prr', reR.map(n => ({ n, kind: 'reactive', sk: 'reactive_r45', sigma: .045, trials: NR })));
    for (const n of reR) { pr[n] = b[n].w / b[n].t; nr[n] = b[n].t; whyr[n] = b[n].why; }
  }
  const reC = R300.filter(n => info[n].sf && gap(n) > .15);
  const calm = {};
  if (reC.length) {
    const b = await measure('prc', reC.map(n => ({ n, kind: 'reactive', sk: 'reactive_calm45', sigma: .045, trials: NR, calm: true })));
    for (const n of reC) calm[n] = b[n].w / b[n].t;
  }
  // --- respirations ---
  const BR = []; for (let b = 1; b < 30; b++) if (R300.includes(b * 10 + 1) && R300.includes(b * 10 - 2)) BR.push(b);
  const bl = b => [b * 10 - 2, b * 10 - 1, b * 10 + 1, b * 10 + 2];
  const brL = [...new Set(BR.flatMap(bl))];
  brL.forEach(lv);
  const a70 = await measure('p70', brL.map(n => ({ n, sk: 'aim_70', sigma: .07, trials: N })));
  const p70 = {}, n70 = {}; for (const n of brL) { p70[n] = a70[n].w / a70[n].t; n70[n] = a70[n].t; }
  const brv = b => { const [p8, p9, a1, a2] = bl(b), prev = info[p9].teach ? [p70[p8]] : [p70[p8], p70[p9]]; return mean([p70[a1], p70[a2]]) - mean(prev); };
  const firstBr = {}; for (const b of BR) firstBr[b] = brv(b);
  const reB = BR.filter(b => brv(b) < .08);
  if (reB.length) {
    const ns = [...new Set(reB.flatMap(bl))];
    const x = await measure('p70r', ns.map(n => ({ n, sk: 'aim_r70', sigma: .07, trials: NR })));
    for (const n of ns) { p70[n] = x[n].w / x[n].t; n70[n] = x[n].t; }
  }
  if (P) P.close();
  // --- verdict ---
  const fails = [], close = [], lines = [];
  for (const n of floorL) {
    const x = F[n], p = x.w / x.t, ci = wilson(x.w, x.t);
    x.p = p; x.lo = ci[0];
    if (p < D.floor30 || ci[0] < D.floorLow95) fails.push(`plancher ${n} : ${pc(p)} % (Wilson ${pc(ci[0])}, ${x.t} essais)`);
    else if (p < D.floor30 + .03 || ci[0] < D.floorLow95 + .03) close.push(`plancher ${n} : ${pc(p)} % (Wilson ${pc(ci[0])}, ${x.t} essais)`);
  }
  const react = [];
  for (const n of R300) if (info[n].sf) {
    const g = gap(n);
    const row = { n, pr: pr[n], nr: nr[n], gap: g, first: firstPr[n], calm: calm[n] };
    react.push(row);
    if (g > .15) {
      const own = calm[n] - pr[n];
      row.own = own;
      if (own > .15) fails.push(`réactif ${n} : ${pc(pr[n])} % (${nr[n]} essais), ${pc(g)} points sous ses voisins, ${pc(own)} sous la variante calme (${pc(calm[n])} %) ${JSON.stringify(whyr[n])}`);
      else close.push(`réactif ${n} : ${pc(g)} points sous ses voisins, mais calme ${pc(calm[n])} % (${pc(own)} points, ${own > .12 ? 'à moins de 3 points de la limite' : 'pas propre aux arrêts'})`);
    } else if (g > .12) close.push(`réactif ${n} : ${pc(pr[n])} % (${nr[n]} essais), ${pc(g)} points sous ses voisins`);
  }
  const breaths = [];
  for (const b of BR) {
    const v = brv(b), [p8, p9, a1, a2] = bl(b);
    breaths.push({ b, br: v, first: firstBr[b], p8: p70[p8], p9: p70[p9], a1: p70[a1], a2: p70[a2], n: n70[a1] });
    if (v < .05) fails.push(`respiration ${a1}-${a2} : +${pc(v)} points (${n70[a1]} essais)`);
    else if (v < .08) close.push(`respiration ${a1}-${a2} : +${pc(v)} points (${n70[a1]} essais)`);
  }
  const named = [4, 19, 24].map(b => breaths.find(x => x.b === b)).filter(Boolean);
  lines.push(`K=${K} : ${N} essais, remesures à ${NR} ; ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  const minF = floorL.slice().sort((a, b) => F[a].p - F[b].p).slice(0, 8);
  lines.push('plancher, les 8 plus bas : ' + minF.map(n => `${n}=${pc(F[n].p)} (W ${pc(F[n].lo)}, ${F[n].t})`).join('  '));
  if (INFON) lines.push('COSMOS ∞ et réserve : ' + [421, 468, 497, 321, 368, 397].map(n => `${n}=${pc(F[n].p)} (W ${pc(F[n].lo)}, ${F[n].t})`).join('  '));
  lines.push(`${INFON ? `COSMOS ∞ 401-500 : minimum ${pc(Math.min(...INF.map(n => F[n].p)))} % ; ` : ''}mondes ${WORLDS.join(',')} : minimum ${pc(Math.min(...R300.map(n => F[n].p)))} %`);
  const topR = react.slice().sort((a, b) => b.gap - a.gap).slice(0, 8);
  lines.push('réactif, les 8 écarts les plus grands : ' + topR.map(r => `${r.n}=${pc(r.pr)} (${pc(r.gap)} pts, ${r.nr}${r.calm !== undefined ? ', calme ' + pc(r.calm) : ''})`).join('  '));
  lines.push('respirations nommées : ' + named.map(x => `${x.b * 10 + 1}-${x.b * 10 + 2} +${pc(x.br)} (${x.n} essais)`).join('  '));
  lines.push('respirations, les 6 plus basses : ' + breaths.slice().sort((a, b) => a.br - b.br).slice(0, 6).map(x => `${x.b * 10 + 1}-${x.b * 10 + 2} +${pc(x.br)} (${x.n})`).join('  '));
  lines.push(`à moins de 3 points d'une limite (${close.length}) :\n    ` + close.join('\n    '));
  lines.push(`ÉCHECS (${fails.length}) :\n    ` + fails.join('\n    '));
  const txt = lines.join('\n');
  console.log(txt);
  fs.writeFileSync(path.join(OUT, `K${K}_summary.txt`), txt + '\n');
  fs.writeFileSync(path.join(OUT, `K${K}_result.json`), JSON.stringify({ K, N, NR, pass: !fails.length, fails, close, floor: F, react, breaths }, null, 1));
  process.exit(fails.length ? 1 : 0);
})();
