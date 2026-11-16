// Salve à l'aveugle (vrai cœur dans Node) : taper sans regarder ne doit plus faire passer de niveau après le monde 1.
//   node tests/sim/mash.js [--from=11] [--to=300] [--starts=200] [--quick]
// Salve : un tap toutes les c secondes ± 1 image (c = 100, 150, 200, 250 ms), premier tap dans la première seconde, sans
// relance ; 200 départs par cadence ; on garde la meilleure cadence de chaque niveau.
//   - niveaux 11-50 : moyenne des meilleures cadences ≤ 30 % ;
//   - à partir du niveau 51 : chaque niveau ≤ 6 départs réussis sur 200 à sa meilleure cadence.
// Salve soutenue (150 ms ± 1 image, 60 s de jeu, relance dès que la feuille d'échec le permet, tirs ignorés 250 ms après
// la relance), 3 parties par niveau : moins de 10 % des niveaux 51-100 finis, moins de 5 % au-delà.
const path = require('path'), fs = require('fs');
const { pool } = require('./pool');
const { ROOT } = require('./load');
const arg = (k, d) => { const a = process.argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const QUICK = process.argv.includes('--quick');
const FROM = +arg('from', 11), TO = +arg('to', 300), STARTS = +arg('starts', QUICK ? 60 : 200);
const SEEDS = JSON.parse(fs.readFileSync(path.join(__dirname, 'seeds.json'), 'utf8'));
const OUT = path.join(ROOT, 'tests', 'out', 'sim');
fs.mkdirSync(OUT, { recursive: true });
const CAD = [.10, .15, .20, .25];
(async () => {
  const t0 = Date.now(), P = pool(), jobs = [];
  for (let n = FROM; n <= TO; n++) for (const c of CAD) jobs.push({ kind: 'mash', n, c, trials: STARTS, seed0: SEEDS.mash + n * 1009 + Math.round(c * 1000) * 100003 });
  const sus = [];
  for (let n = Math.max(51, FROM); n <= TO; n++) sus.push({ kind: 'sustained', n, c: .15, D: 60, trials: 3, seed0: SEEDS.sustained + n * 7 });
  const R = await P.run(jobs), RS = await P.run(sus);
  P.close();
  const best = {};
  R.forEach(r => { const b = best[r.n] || (best[r.n] = { wins: -1 }); if (r.wins > b.wins) { b.wins = r.wins; b.c = jobs[r.id].c; } });
  const fails = [], early = [], late = [];
  for (let n = FROM; n <= TO; n++) {
    const b = best[n];
    if (n <= 50) early.push(b.wins / STARTS);
    else { late.push(b.wins); if (b.wins > 6 * STARTS / 200) fails.push(`niveau ${n} : ${b.wins}/${STARTS} départs réussis à ${b.c * 1000} ms (≤ ${6 * STARTS / 200})`); }
  }
  const meanEarly = early.length ? early.reduce((a, b) => a + b, 0) / early.length : 0;
  if (early.length && meanEarly > .30) fails.unshift(`niveaux ${FROM}-50 : ${(meanEarly * 100).toFixed(1)} % en moyenne à la meilleure cadence (≤ 30 %)`);
  const fin = { a: [0, 0], b: [0, 0] };
  RS.forEach(r => { const g = r.n <= 100 ? fin.a : fin.b; g[1]++; if (r.wins > 0) g[0]++; });
  if (fin.a[1] && fin.a[0] / fin.a[1] >= .10) fails.push(`salve soutenue : ${fin.a[0]}/${fin.a[1]} niveaux 51-100 finis (< 10 %)`);
  if (fin.b[1] && fin.b[0] / fin.b[1] >= .05) fails.push(`salve soutenue : ${fin.b[0]}/${fin.b[1]} niveaux au-delà de 100 finis (< 5 %)`);
  const pass = fails.length === 0;
  const worst = Object.entries(best).filter(([n]) => +n > 50).sort((x, y) => y[1].wins - x[1].wins).slice(0, 8).map(([n, b]) => `${n}:${b.wins}`);
  console.log(`salve aveugle : niveaux ${FROM}-50 ${(meanEarly * 100).toFixed(1)} % en moyenne ; au-delà de 50, pire niveau ${worst.join(' ')} (sur ${STARTS}) ; salve soutenue 60 s : ${fin.a[0]}/${fin.a[1]} niveaux 51-100, ${fin.b[0]}/${fin.b[1]} au-delà`);
  for (const f of fails.slice(0, 40)) console.log('  - ' + f);
  fs.writeFileSync(path.join(OUT, 'mash.json'), JSON.stringify({ pass, starts: STARTS, meanEarly, best, sustained: fin, fails, seeds: { mash: SEEDS.mash, sustained: SEEDS.sustained } }, null, 1));
  console.log(`${pass ? 'mash : pass' : `mash : FAIL (${fails.length})`} — ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  process.exit(pass ? 0 : 1);
})();
