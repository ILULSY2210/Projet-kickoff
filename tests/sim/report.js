// Rapport de difficulté : le joueur simulé qui vise (vrai cœur dans Node, tests/sim/driver.js) sur chaque niveau,
// comparé aux cibles du plan (5.10).
//   node tests/sim/report.js [--from=1] [--to=300] [--endless=100] [--endlessFrom=401] [--trials=300] [--recheck=1000]
//                            [--seed=0] [--quick] [--out=dossier]
// --seed=K décale toutes les graines de K (mesure de contrôle avec des graines neuves, jamais vues par le réglage).
// COSMOS ∞ : niveaux endlessFrom .. endlessFrom + endless − 1 (par défaut 401-500, un cycle que le réglage n'a pas mesuré :
// les niveaux 301-400 forment la réserve de COSMOS ∞, rejouée en miroir un cycle sur deux, levels.js).
// Mesures par niveau : taux de victoire à σ = 30 ms et 70 ms (trials essais), durée d'un niveau propre (victoires à
// 45 ms, aussi sur COSMOS ∞), joueur réactif (n'anticipe pas) à 45 ms (1..300). Tout niveau estimé sous 85 % à 30 ms est remesuré avec 1 000 essais ;
// tout niveau signalé par la règle des falaises est remesuré à 70 ms avec 1 000 essais avant d'échouer.
// Règles vérifiées (plan, 5.10) :
//   plancher   chaque niveau 1..300 et les niveaux de COSMOS ∞ mesurés : ≥ 75 % à 30 ms ET borne basse de Wilson ≥ 72 %
//   mondes     à 30 ms : minimum par niveau et moyenne du monde (table 5.10, ±7 points pour la moyenne) ;
//              à 70 ms : moyenne du premier et du dernier bloc de 10 (niveaux normaux hors apprentissage) contre le début et
//              la fin de la cible (±7 points)
//   falaises   niveau normal ≤ 12 points sous la moyenne de ses 4 voisins normaux à 70 ms ; boss ou spécial ≤ 20 points
//              (voisins : niveaux normaux du même monde, hors niveaux d'apprentissage)
//   respirations  x1-x2 d'un bloc ≥ x8-x9 du bloc précédent + 5 points à 70 ms (x8 seul quand x9 est un apprentissage) ; la cible du plan est
//              « ≈ +10 » : le réglage vise +11, le rapport échoue sous +5 et imprime la moyenne par monde (annexe D)
//   boss       boss et spéciaux de chaque monde à 70 ms : moyenne dans la plage de la table 5.10 (±7 points)
//   infini     COSMOS ∞ : moyenne à 70 ms des niveaux mesurés dans 22-30 % (±7), boss et spéciaux de même
//   réactif    niveaux à arrêts ou inversions : joueur réactif ≤ 15 points sous la moyenne de ses voisins (remesuré avec
//              400 essais avant d'échouer) ; au-delà, la falaise n'est « propre aux arrêts et aux inversions » (échec) que si
//              le même joueur fait aussi plus de 15 points de mieux sur la variante calme du niveau (même niveau, loi
//              continue à la même vitesse moyenne, sans demi-tours : tests/sim/worker.js)
//   apprentissage  niveau d'apprentissage ≥ ses voisins + 12 points à 70 ms (ou ≥ 90 %)
//   durées     médiane du niveau propre (45 ms) dans la plage du monde ; chaque niveau propre au plus au maximum de son monde
//              (1,5 × pour un boss ; COSMOS ∞ : 30 s, durées mesurées aussi sur les niveaux de COSMOS ∞ du rapport)
// Graines : tests/sim/seeds.json. Écrit <out>/report.json et sort avec le code 1 si une règle échoue.
const path = require('path'), fs = require('fs');
const { pool, wilson } = require('./pool');
const { load, ROOT } = require('./load');
const arg = (k, d) => { const a = process.argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const QUICK = process.argv.includes('--quick');
const FROM = +arg('from', 1), TO = +arg('to', 300), ENDLESS = +arg('endless', TO >= 300 ? 100 : 0), EFROM = +arg('endlessFrom', 401);
const SEED = +arg('seed', 0);
const TRIALS = +arg('trials', QUICK ? 100 : 300), RECHECK = +arg('recheck', QUICK ? 0 : 1000);
const OUT = path.resolve(arg('out', path.join(ROOT, 'tests', 'out', 'sim')));
const SEEDS = JSON.parse(fs.readFileSync(path.join(__dirname, 'seeds.json'), 'utf8'));
fs.mkdirSync(OUT, { recursive: true });
const G = load(), D = G.get('DIFFICULTY'), mk = G.makeLevel;
const FLOOR30 = [.95, .90, .85, .82, .78, .75], MEAN30 = [.99, .96, .93, .90, .87, .84];
const DUR = [[6, 15], [10, 18], [12, 22], [12, 24], [14, 28], [15, 30]];
const BOSS70 = [[.75, .85], [.60, .70], [.48, .58], [.38, .48], [.28, .38], [.20, .30]], INF70 = [.22, .30], INFDUR = 30;
const NAMES = G.get('WORLDS').map(w => w.name);
const pc = x => (x * 100).toFixed(1).padStart(5);
const seedOf = (kind, n) => SEEDS[kind] + n * 10007 + SEED;
const CHUNK = 50;

function jobsFor(kind, n, trials, extra) {
  const out = [];
  for (let i = 0; i < trials; i += CHUNK) out.push(Object.assign({ kind: kind.split('_')[0], n, trials: Math.min(CHUNK, trials - i), seed0: seedOf(kind, n) + i }, extra));
  return out;
}
async function measure(P, specs) {
  // specs : [{ key, kind, n, trials, extra }] → { key: { wins, trials, T, why } }
  const jobs = [], owner = [];
  for (const s of specs) for (const j of jobsFor(s.kind, s.n, s.trials, s.extra)) { jobs.push(j); owner.push(s.key); }
  let done = 0; const t0 = Date.now();
  const res = await P.run(jobs, () => { if (++done % 200 === 0) process.stderr.write(`\r  ${done}/${jobs.length} lots, ${((Date.now() - t0) / 1000).toFixed(0)} s`); });
  process.stderr.write('\n');
  const agg = {};
  res.forEach((r, i) => {
    const k = owner[i], a = agg[k] || (agg[k] = { wins: 0, trials: 0, T: [], why: {} });
    a.wins += r.wins; a.trials += r.trials; a.T.push(...r.T);
    for (const w in r.why) a.why[w] = (a.why[w] || 0) + r.why[w];
  });
  return agg;
}
const median = a => { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN;

(async () => {
  const t0 = Date.now(), P = pool();
  const levels = [], info = {};
  for (let n = FROM; n <= TO; n++) levels.push(n);
  for (let n = EFROM; n < EFROM + ENDLESS; n++) levels.push(n);
  for (const n of levels) { const L = mk(n); info[n] = { boss: L.boss, special: L.special, teach: L.teach, pattern: L.pattern, flags: L.flags, throws: L.throws, omega: +L.omega.toFixed(3), stopsOrFlips: [2, 4, 5].includes(L.pattern) || L.flags.some(f => ['demitour', 'rythme', 'invImpact', 'irreg'].includes(f)) }; }
  const specs = [];
  for (const n of levels) {
    specs.push({ key: n + ':30', kind: 'aim_30', n, trials: TRIALS, extra: { sigma: .03 } });
    specs.push({ key: n + ':70', kind: 'aim_70', n, trials: TRIALS, extra: { sigma: .07 } });
    specs.push({ key: n + ':45', kind: 'aim_45', n, trials: QUICK ? 40 : 100, extra: { sigma: .045 } });
    if (n <= 300) specs.push({ key: n + ':r', kind: 'reactive_45', n, trials: QUICK ? 40 : 200, extra: { sigma: .045 } });
  }
  console.error(`report : ${levels.length} niveaux, ${TRIALS} essais à 30 et 70 ms`);
  const M = await measure(P, specs);
  const L = {};
  for (const n of levels) {
    const a = M[n + ':30'], b = M[n + ':70'], c = M[n + ':45'], r = M[n + ':r'];
    L[n] = Object.assign({ n, p30: a.wins / a.trials, n30: a.trials, w30: a.wins, p70: b.wins / b.trials, n70: b.trials, w70: b.wins, why30: a.why, why70: b.why,
      dur45: c ? median(c.T) : null, p45: c ? c.wins / c.trials : null, pr: r ? r.wins / r.trials : null, nr: r ? r.trials : 0, whyr: r ? r.why : null }, info[n]);
  }
  // remesure à 30 ms (1 000 essais) des niveaux sous 85 %
  if (RECHECK) {
    const re = levels.filter(n => L[n].p30 < D.recheckBelow);
    if (re.length) {
      console.error(`remesure à 30 ms de ${re.length} niveau(x) : ${re.join(' ')}`);
      const R = await measure(P, re.map(n => ({ key: n + ':30b', kind: 'aim_r30', n, trials: RECHECK, extra: { sigma: .03 } })));
      for (const n of re) { const a = R[n + ':30b']; Object.assign(L[n], { p30: a.wins / a.trials, n30: a.trials, w30: a.wins, why30: a.why, rechecked30: true }); }
    }
  }
  // falaises (sur les niveaux 1..300) : voisins normaux du même monde. Les niveaux d'apprentissage, volontairement bien
  // plus faciles (courts, vitesse modérée, plan 5.3), ne servent pas de référence à leurs voisins (annexe D) ; ils restent
  // eux-mêmes soumis à la règle
  const normal = n => !L[n].boss && !L[n].special;
  const ref = n => normal(n) && !L[n].teach;
  const neighbors = (n, key) => {
    const w = Math.floor((n - 1) / 50), out = [];
    for (const dir of [-1, 1]) { let m = n, k = 0; while (k < 2) { m += dir; if (m < 1 || m > 300 || Math.floor((m - 1) / 50) !== w || !L[m]) break; if (ref(m)) { out.push(L[m][key]); k++; } } }
    return out;
  };
  const cliffCheck = () => {
    const bad = [];
    for (const n of levels) if (n <= 300) {
      const nb = neighbors(n, 'p70'); if (nb.length < 2) continue;
      const lim = normal(n) ? D.cliff : D.bossCliff, gapv = mean(nb) - L[n].p70;
      if (gapv > lim) bad.push({ n, gap: gapv, lim });
    }
    return bad;
  };
  if (RECHECK) {
    const re = cliffCheck().map(x => x.n);
    if (re.length) {
      console.error(`remesure à 70 ms de ${re.length} niveau(x) signalé(s) par la règle des falaises : ${re.join(' ')}`);
      const R = await measure(P, re.map(n => ({ key: n + ':70b', kind: 'aim_r70', n, trials: RECHECK, extra: { sigma: .07 } })));
      for (const n of re) { const a = R[n + ':70b']; Object.assign(L[n], { p70: a.wins / a.trials, n70: a.trials, w70: a.wins, why70: a.why, rechecked70: true }); }
    }
  }
  // joueur réactif : niveaux à arrêts ou inversions signalés, remesurés avec 400 essais (graines propres) avant d'échouer
  const reactBad = () => levels.filter(n => n <= 300 && L[n].stopsOrFlips && L[n].pr !== null).map(n => { const nb = neighbors(n, 'pr'); return { n, g: nb.length >= 2 ? mean(nb) - L[n].pr : 0 }; }).filter(x => x.g > .15);
  if (RECHECK) {
    const re = reactBad().map(x => x.n);
    if (re.length) {
      console.error(`remesure du joueur réactif sur ${re.length} niveau(x) : ${re.join(' ')}`);
      const R = await measure(P, re.map(n => ({ key: n + ':rb', kind: 'reactive_r45', n, trials: 400, extra: { sigma: .045 } })));
      for (const n of re) { const a = R[n + ':rb']; Object.assign(L[n], { pr: a.wins / a.trials, nr: a.trials, whyr: a.why, recheckedR: true }); }
    }
  }
  // falaise « propre aux arrêts et aux inversions » : le même joueur réactif sur la variante calme du niveau (mêmes anneaux,
  // zones, obstacles et vitesse moyenne, loi continue, sans demi-tours) ; un écart à ses voisins qui ne vient pas des
  // arrêts et des inversions (variante calme aussi basse) n'est pas une falaise propre à eux
  {
    const re = reactBad().map(x => x.n);
    if (re.length) {
      const R = await measure(P, re.map(n => ({ key: n + ':rc', kind: 'reactive_calm45', n, trials: RECHECK ? 400 : 100, extra: { sigma: .045, calm: true } })));
      for (const n of re) { const a = R[n + ':rc']; L[n].prCalm = a.wins / a.trials; L[n].whyCalm = a.why; }
    }
  }
  P.close();
  // --- règles ---
  const fails = [], notes = [];
  const fail = (rule, msg) => fails.push(`[${rule}] ${msg}`);
  for (const n of levels) {
    const x = L[n], ci = wilson(x.w30, x.n30); x.ci30 = ci.map(v => +v.toFixed(4));
    x.ci70 = wilson(x.w70, x.n70).map(v => +v.toFixed(4));
    if (x.p30 < D.floor30 || ci[0] < D.floorLow95) fail('plancher', `niveau ${n} : ${pc(x.p30)} % à 30 ms (IC95 ${pc(ci[0])}-${pc(ci[1])}, ${x.n30} essais, graine ${seedOf(x.rechecked30 ? 'aim_r30' : 'aim_30', n)})`);
  }
  const worlds = [];
  for (let w = 0; w < 6; w++) {
    const ns = levels.filter(n => n <= 300 && Math.floor((n - 1) / 50) === w);
    if (!ns.length) continue;
    // début et fin du monde : niveaux normaux du premier et du dernier bloc, hors niveaux d'apprentissage (comme pour les
    // falaises : volontairement bien plus faciles, ils ne disent rien de la courbe de difficulté)
    const p30 = ns.map(n => L[n].p30), first = ns.filter(n => (n - 1) % 50 < 10 && ref(n)), last = ns.filter(n => (n - 1) % 50 >= 40 && ref(n));
    const T = D.worldTargets70[w], s70 = mean(first.map(n => L[n].p70)), e70 = mean(last.map(n => L[n].p70));
    const bs = ns.filter(n => !normal(n)).map(n => L[n].p70), durs = ns.map(n => L[n].dur45).filter(x => x);
    const row = { w, name: NAMES[w], min30: Math.min(...p30), mean30: mean(p30), start70: s70, end70: e70, mean70: mean(ns.map(n => L[n].p70)), bossSp70: mean(bs), dur45: median(durs), target70: T, floor30: FLOOR30[w], target30: MEAN30[w], boss70: BOSS70[w] };
    worlds.push(row);
    if (row.min30 < FLOOR30[w]) notes.push(`${NAMES[w]} : minimum à 30 ms ${pc(row.min30)} % (table : ≥ ${FLOOR30[w] * 100} %)`);
    if (ns.length === 50) {
      if (Math.abs(row.mean30 - MEAN30[w]) > .07) fail('mondes', `${NAMES[w]} : moyenne à 30 ms ${pc(row.mean30)} % (cible ≈ ${MEAN30[w] * 100} % ± 7)`);
      if (Math.abs(s70 - T[0]) > .07) fail('mondes', `${NAMES[w]} : début à 70 ms ${pc(s70)} % (cible ${T[0] * 100} % ± 7)`);
      if (Math.abs(e70 - T[1]) > .07) fail('mondes', `${NAMES[w]} : fin à 70 ms ${pc(e70)} % (cible ${T[1] * 100} % ± 7)`);
      if (row.dur45 < DUR[w][0] || row.dur45 > DUR[w][1]) fail('durées', `${NAMES[w]} : niveau propre (45 ms) médian ${row.dur45.toFixed(1)} s (plage ${DUR[w][0]}-${DUR[w][1]} s)`);
      if (row.bossSp70 < BOSS70[w][0] - .07 || row.bossSp70 > BOSS70[w][1] + .07) fail('boss', `${NAMES[w]} : boss et spéciaux à 70 ms ${pc(row.bossSp70)} % (table ${BOSS70[w][0] * 100}-${BOSS70[w][1] * 100} % ± 7)`);
    }
  }
  // durée de chaque niveau propre (45 ms, médiane des victoires) : au plus le maximum de son monde (table 5.10 ; 30 s dans
  // COSMOS ∞), 1,5 × pour un boss
  const durCap = n => (n > 300 ? INFDUR : DUR[Math.floor((n - 1) / 50)][1]) * (L[n].boss ? 1.5 : 1);
  for (const n of levels) if (L[n].dur45 > durCap(n)) fail('durées', `niveau ${n}${L[n].boss ? ' (boss)' : ''} : niveau propre (45 ms) en ${L[n].dur45.toFixed(1)} s (au plus ${durCap(n)} s)`);
  // niveaux d'apprentissage : au moins 12 points au-dessus de leurs voisins à 70 ms, ou au moins 90 % (en début de monde,
  // où les voisins sont déjà vers 85 %), sans vitesse ajoutée (plan 5.3 : court, vitesse modérée ; facteur ≤ 1)
  for (const n of levels) if (n <= 300 && L[n].teach) {
    const nb = neighbors(n, 'p70'); if (nb.length < 2) continue;
    const want = Math.min(.90, mean(nb) + .12);
    if (L[n].p70 < want - 1e-9) fail('apprentissage', `niveau ${n} (${L[n].teach}) : ${pc(L[n].p70)} % à 70 ms, ${((L[n].p70 - mean(nb)) * 100).toFixed(1)} points au-dessus de ses voisins (≥ +12, ou ≥ 90 %)`);
  }
  for (const c of cliffCheck()) fail('falaises', `niveau ${c.n}${normal(c.n) ? '' : L[c.n].boss ? ' (boss)' : ' (spécial)'} : ${pc(L[c.n].p70)} % à 70 ms, ${(c.gap * 100).toFixed(1)} points sous ses voisins (limite ${c.lim * 100}) ; IC95 ${pc(L[c.n].ci70[0])}-${pc(L[c.n].ci70[1])}`);
  // respirations : x1-x2 d'un bloc contre x8-x9 du bloc précédent
  const breaths = [];
  for (let b = 1; b < 30; b++) {
    const a1 = b * 10 + 1, a2 = b * 10 + 2, p8 = b * 10 - 2, p9 = b * 10 - 1;
    if (!L[a1] || !L[a2] || !L[p8] || !L[p9]) continue;
    // x8 seul quand x9 est un niveau d'apprentissage (en Émeraude, plan 5.10 : celui de la mécanique du boss)
    const prev = L[p9].teach ? [L[p8].p70] : [L[p8].p70, L[p9].p70], br = mean([L[a1].p70, L[a2].p70]) - mean(prev);
    breaths.push({ b, br, w: Math.floor(b / 5) });
    if (br < .05) fail('respirations', `niveaux ${a1}-${a2} : ${(br * 100).toFixed(1)} points au-dessus de ${L[p9].teach ? p8 : p8 + '-' + p9} (≥ +5 ; cible ≈ +${D.breather * 100})`);
  }
  // joueur réactif : pas de falaise propre aux arrêts et inversions
  for (const x of reactBad()) {
    const c = L[x.n].prCalm, own = c - L[x.n].pr;
    if (own > .15) fail('réactif', `niveau ${x.n} : joueur réactif ${pc(L[x.n].pr)} % (${L[x.n].nr} essais), ${(x.g * 100).toFixed(1)} points sous ses voisins (≤ 15), ${(own * 100).toFixed(1)} sous le même niveau sans arrêts ni inversions (${pc(c)} %) ; échecs ${JSON.stringify(L[x.n].whyr)}`);
    else notes.push(`réactif, niveau ${x.n} : ${pc(L[x.n].pr)} %, ${(x.g * 100).toFixed(1)} points sous ses voisins, mais pas à cause des arrêts et des inversions : ${pc(c)} % sans eux`);
  }
  // COSMOS ∞ : moyenne à 70 ms dans 22-30 % (±7), boss et spéciaux de même
  const infL = levels.filter(n => n > 300);
  if (infL.length >= 20) {
    const m70 = mean(infL.map(n => L[n].p70)), bsi = infL.filter(n => !normal(n)).map(n => L[n].p70), mb = mean(bsi);
    if (m70 < INF70[0] - .07 || m70 > INF70[1] + .07) fail('infini', `COSMOS ∞ (${infL[0]}-${infL[infL.length - 1]}) : moyenne à 70 ms ${pc(m70)} % (cible ${INF70[0] * 100}-${INF70[1] * 100} % ± 7)`);
    if (bsi.length && (mb < INF70[0] - .07 || mb > INF70[1] + .07)) fail('infini', `COSMOS ∞ : boss et spéciaux à 70 ms ${pc(mb)} % (cible ${INF70[0] * 100}-${INF70[1] * 100} % ± 7)`);
  }
  // --- impression ---
  console.log('monde        30 ms min / moy (cible)      70 ms début → fin (cible)        boss+spéciaux 70   niveau propre 45 ms');
  for (const r of worlds) console.log(`${r.name.padEnd(11)} ${pc(r.min30)} / ${pc(r.mean30)} (≥${r.floor30 * 100}/≈${r.target30 * 100})   ${pc(r.start70)} → ${pc(r.end70)} (${r.target70[0] * 100} → ${r.target70[1] * 100})   ${pc(r.bossSp70)}             ${r.dur45.toFixed(1)} s`);
  const inf = levels.filter(n => n > 300);
  if (inf.length) console.log(`COSMOS ∞ (${inf[0]}-${inf[inf.length - 1]}) : 30 ms min ${pc(Math.min(...inf.map(n => L[n].p30)))} %, 70 ms moyenne ${pc(mean(inf.map(n => L[n].p70)))} %, boss et spéciaux ${pc(mean(inf.filter(n => !normal(n)).map(n => L[n].p70)))} %, niveau propre médian ${median(inf.map(n => L[n].dur45).filter(x => x)).toFixed(1)} s`);
  for (let w = 0; w < 6; w++) { const bw = breaths.filter(x => x.w === w); if (bw.length) console.log(`respirations ${NAMES[w].padEnd(11)} : moyenne +${(mean(bw.map(x => x.br)) * 100).toFixed(1)} points, minimum ${(Math.min(...bw.map(x => x.br)) * 100).toFixed(1)}`); }
  for (const nt of notes) console.log('  · ' + nt);
  for (const f of fails) console.log('  - ' + f);
  const pass = fails.length === 0;
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify({ pass, trials: TRIALS, recheck: RECHECK, seeds: SEEDS, seedOffset: SEED, worlds, breaths, fails, notes, levels: L, seconds: (Date.now() - t0) / 1000 }, null, 1));
  console.log(`${pass ? 'report : pass' : `report : FAIL (${fails.length})`} — ${((Date.now() - t0) / 1000).toFixed(0)} s, détail dans ${path.join(OUT, 'report.json')}`);
  process.exit(pass ? 0 : 1);
})();
