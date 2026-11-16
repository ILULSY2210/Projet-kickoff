// Lance tous les tests unitaires : chaque tests/unit/*.test.js, puis le contrôle des niveaux (dump.js --check).
//   node tests/unit/run.js
const { spawnSync } = require('child_process');
const path = require('path'), fs = require('fs');
const dir = __dirname;
const jobs = fs.readdirSync(dir).filter(f => f.endsWith('.test.js')).sort().map(f => [f, [path.join(dir, f)]]);
jobs.push(['dump.js --check', [path.join(dir, 'dump.js'), '--check']]);
let failed = 0;
for (const [name, argv] of jobs) {
  const t0 = Date.now();
  const r = spawnSync(process.execPath, argv, { encoding: 'utf8' });
  const ok = r.status === 0;
  if (!ok) failed++;
  console.log(`${ok ? 'ok   ' : 'ÉCHEC'} ${name} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  const out = (r.stdout || '') + (r.stderr || '');
  if (!ok || process.argv.includes('-v')) console.log(out.split('\n').map(l => '    ' + l).join('\n'));
}
console.log(failed ? `unit : ${failed} échec(s)` : 'unit : pass');
process.exit(failed ? 1 : 0);
