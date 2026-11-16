// Prédicteur honnête (window.__botSafe, marge 0,7 × GAP) sur le vrai cœur dans Node : 0 mort et 0 blocage.
//   node tests/sim/bot.js [--from=1] [--to=300] [--endless=50]
// 4 parties par niveau (délais aléatoires entre les tirs pour les parties 1 à 3), à dt 1/60 et 1/120 ; une partie qui
// n'est pas finie après 75 s de jeu est un blocage.
const { pool } = require('./pool');
const arg = (k, d) => { const a = process.argv.find(x => x.startsWith('--' + k + '=')); return a ? +a.slice(k.length + 3) : d; };
const FROM = arg('from', 1), TO = arg('to', 300), ENDLESS = arg('endless', 50);
(async () => {
  const t0 = Date.now(), P = pool(), jobs = [];
  const ns = []; for (let n = FROM; n <= TO; n++) ns.push(n); for (let n = 301; n < 301 + ENDLESS; n++) ns.push(n);
  for (const n of ns) for (const dt of [1 / 60, 1 / 120]) for (let g = 0; g < 4; g++) jobs.push({ kind: 'bot', n, dt, g, trials: 1, seed0: n * 977 + g * 131 + 7 });
  const R = await P.run(jobs); P.close();
  const deaths = [], blocks = [];
  R.forEach(r => { const j = jobs[r.id]; if (r.wins) return; const k = Object.keys(r.why)[0] || ''; (k.startsWith('fail') ? deaths : blocks).push(`${j.n}/${j.g}@${j.dt > .01 ? '60' : '120'}`); });
  console.log(`bot : ${R.length} parties, ${deaths.length} mort(s) ${deaths.slice(0, 12).join(' ')}, ${blocks.length} blocage(s) ${blocks.slice(0, 12).join(' ')} — ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  const pass = !deaths.length && !blocks.length;
  console.log(pass ? 'bot : pass' : 'bot : FAIL');
  process.exit(pass ? 0 : 1);
})();
