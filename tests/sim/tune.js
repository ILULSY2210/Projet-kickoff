// Réglage de la difficulté niveau par niveau sur le vrai cœur (joueur simulé qui vise) : pour chaque niveau, un facteur de
// vitesse (et au besoin une aiguille de moins) qui amène son taux de victoire à 70 ms sur la cible du plan (5.10), puis
// vérification du plancher à 30 ms. Le résultat va dans DIFFICULTY.tune (js/config.js) avec --write.
//   node tests/sim/tune.js [--from=1] [--to=300] [--trials=160] [--iters=6] [--write]
// Cible à 70 ms : droite du monde (début → fin, table worldTargets70) + décalage selon la place dans le bloc de 10
// (respirations en x1-x2, montée jusqu'au boss) ; niveaux d'apprentissage plus doux ; COSMOS ∞ : 26 %.
// Méthode : itérations synchrones sur tous les niveaux (un processus par cœur), mêmes graines d'une itération à l'autre
// (variations dues au seul réglage), sécante en log(facteur) bornée par bissection ; facteur dans [0,45 ; 2,4].
const path = require('path'), fs = require('fs');
const { pool } = require('./pool');
const { load, ROOT } = require('./load');
const arg = (k, d) => { const a = process.argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const FROM = +arg('from', 1), TO = +arg('to', 300), M = +arg('trials', 160), ITERS = +arg('iters', 6), WRITE = process.argv.includes('--write');
const ENDLESS = +arg('endless', 0);
const SEEDS = JSON.parse(fs.readFileSync(path.join(__dirname, 'seeds.json'), 'utf8'));
const G = load(), D = G.get('DIFFICULTY'), TEACH = G.get('TEACH'), IMPL = new Set(G.get('IMPL'));
const OFF = [.07, .05, .02, .01, 0, -.01, -.02, -.03, -.04, -.05];
function target70(n) {
  if (n > 300) return .26;
  const w = Math.floor((n - 1) / 50), k = (n - 1) % 50, [a, b] = D.worldTargets70[w], line = a + (b - a) * k / 49;
  let T = line + OFF[k % 10];
  if (TEACH[n] && IMPL.has(TEACH[n])) T = Math.max(T, line + .12);
  return Math.min(.995, Math.max(.05, T));
}
const CHUNK = 40;
function jobs(n, f, dn, sigma, trials, key) {
  const o = [];
  for (let i = 0; i < trials; i += CHUNK) o.push({ kind: 'aim', n, sigma, trials: Math.min(CHUNK, trials - i), seed0: SEEDS.tune + n * 10007 + key * 1000003 + i, tune: { [n]: [f, dn] } });
  return o;
}
async function measureAll(P, specs) {
  const all = [], own = [];
  specs.forEach((s, i) => { for (const j of jobs(s.n, s.f, s.dn, s.sigma, s.trials, s.key)) { all.push(j); own.push(i); } });
  const res = await P.run(all), out = specs.map(() => ({ w: 0, t: 0 }));
  res.forEach((r, i) => { out[own[i]].w += r.wins; out[own[i]].t += r.trials; });
  return out.map(x => x.w / x.t);
}
(async () => {
  const t0 = Date.now(), P = pool();
  const ns = []; for (let n = FROM; n <= TO; n++) ns.push(n); for (let n = 301; n < 301 + ENDLESS; n++) ns.push(n);
  const st = {};
  // vitesse plafonnée à 1,3 × la vitesse de fin du monde (table DIFFICULTY.worlds) ; un niveau encore trop facile à ce
  // plafond reçoit une aiguille de plus (jusqu'à 2)
  // (et fenêtre commune des anneaux d'au moins 0,3 s une fois accélérée)
  const hiOf = (n, dn) => { const w = Math.min(5, Math.floor((n - 1) / 50)), cur = D.tune[n] || [1, 0]; G.run(`DIFFICULTY.tune[${n}] = [1, ${dn}]`); const l = G.makeLevel(n), om = l.omega, rw = l.ringWin; G.run(`DIFFICULTY.tune[${n}] = ${JSON.stringify(cur)}`); return Math.max(1, Math.min(2.4, 1.3 * D.worlds[w].speed[1] / om, rw ? rw / .3 : 9)); };
  for (const n of ns) {
    const cur = D.tune[n] || [1, 0];
    st[n] = { n, T: target70(n), f: cur[0], dn: cur[1], lo: .45, hi: hiOf(n, cur[1]), best: null, done: false, hist: [] };
    st[n].f = Math.min(st[n].f, st[n].hi); st[n].cap = st[n].hi;
  }
  for (let pass = 0; pass < 3; pass++) {
    for (let it = 0; it < ITERS; it++) {
      const act = ns.filter(n => !st[n].done);
      if (!act.length) break;
      const p = await measureAll(P, act.map(n => ({ n, f: st[n].f, dn: st[n].dn, sigma: .07, trials: M, key: 1 })));
      act.forEach((n, i) => {
        const s = st[n], v = p[i]; s.hist.push([+s.f.toFixed(4), +v.toFixed(3)]);
        if (!s.best || Math.abs(v - s.T) < Math.abs(s.best.p - s.T)) s.best = { f: s.f, p: v };
        const teachLv = TEACH[n] && IMPL.has(TEACH[n]);   // niveaux d'apprentissage : 3 à 5 aiguilles, nombre inchangé
        if (v > s.T + .05 && s.f >= s.cap - 1e-9 && s.dn < 2 && !teachLv) { s.dn++; s.lo = .45; s.hi = s.cap = hiOf(n, s.dn); s.f = Math.min(1, s.cap); s.best = null; s.hist = []; return; }
        if (Math.abs(v - s.T) <= .025 || (v >= s.T && s.f >= s.hi - 1e-9) || (v <= s.T && s.f <= s.lo + 1e-9)) { s.done = true; return; }
        // trop facile → plus vite ; trop dur → plus lent
        if (v > s.T) s.lo = Math.max(s.lo, s.f); else s.hi = Math.min(s.hi, s.f);
        const h = s.hist, k = h.length;
        let nf;
        if (k >= 2 && Math.abs(h[k - 1][1] - h[k - 2][1]) > .02) { const sl = (h[k - 1][1] - h[k - 2][1]) / (Math.log(h[k - 1][0]) - Math.log(h[k - 2][0])); nf = Math.exp(Math.log(s.f) + (s.T - v) / sl); }
        else nf = s.f * Math.exp(Math.max(-.3, Math.min(.3, (v - s.T) * 1.2)));
        if (!(nf > s.lo && nf < s.hi)) nf = Math.sqrt(Math.max(s.lo, .45) * Math.min(s.hi, s.cap));
        s.f = Math.min(s.cap, Math.max(.45, nf));
      });
      process.stderr.write(`passe ${pass + 1}, itération ${it + 1} : ${act.length} niveaux à régler, ${((Date.now() - t0) / 1000).toFixed(0)} s\n`);
    }
    for (const n of ns) { st[n].f = st[n].best.f; st[n].p70 = st[n].best.p; }
    // plancher à 30 ms : en dessous de 82 %, une aiguille de moins et on recommence le réglage de ce niveau
    const p30 = await measureAll(P, ns.map(n => ({ n, f: st[n].f, dn: st[n].dn, sigma: .03, trials: M, key: 2 })));
    let redo = 0;
    ns.forEach((n, i) => { st[n].p30 = p30[i]; if (p30[i] < .82 && st[n].dn > -3 && pass < 2 && !(TEACH[n] && IMPL.has(TEACH[n]))) { st[n].dn--; st[n].done = false; st[n].lo = .45; st[n].hi = st[n].cap = hiOf(n, st[n].dn); st[n].f = Math.min(st[n].f, st[n].cap); st[n].best = null; st[n].hist = []; redo++; } });
    process.stderr.write(`plancher : ${redo} niveau(x) avec une aiguille de moins\n`);
    if (!redo) break;
  }
  P.close();
  const tune = {};
  for (const n of ns) { const s = st[n]; if (Math.abs(s.f - 1) > 1e-3 || s.dn) tune[n] = [Math.floor(s.f * 1000) / 1000, s.dn]; }
  const rows = ns.map(n => st[n]);
  fs.mkdirSync(path.join(ROOT, 'tests', 'out', 'sim'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'tests', 'out', 'sim', 'tune.json'), JSON.stringify(rows.map(s => ({ n: s.n, T: s.T, f: s.f, dn: s.dn, p70: s.p70, p30: s.p30, hist: s.hist })), null, 1));
  const off = rows.filter(s => Math.abs(s.p70 - s.T) > .05);
  console.log(`tune : ${rows.length} niveaux, ${off.length} à plus de 5 points de leur cible ; plus faible à 30 ms : ${Math.min(...rows.map(s => s.p30)).toFixed(3)} — ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  for (const s of off.slice(0, 20)) console.log(`  niveau ${s.n} : ${(s.p70 * 100).toFixed(0)} % à 70 ms pour ${(s.T * 100).toFixed(0)} % visés (facteur ${s.f.toFixed(3)}, ${s.dn} aiguille)`);
  if (WRITE) {
    const cfgP = path.join(ROOT, 'js', 'config.js'); let cfg = fs.readFileSync(cfgP, 'utf8');
    const merged = Object.assign({}, D.tune);
    for (const n of ns) delete merged[n];
    Object.assign(merged, tune);
    const keys = Object.keys(merged).map(Number).sort((a, b) => a - b);
    const items = keys.map(k => `${k}: [${merged[k][0]}, ${merged[k][1]}]`), lines = [];
    for (let i = 0; i < items.length; i += 8) lines.push('    ' + items.slice(i, i + 8).join(', '));
    cfg = cfg.replace(/  tune: \{[^}]*\}/, `  tune: {\n${lines.join(',\n')}\n  }`);
    fs.writeFileSync(cfgP, cfg);
    console.log(`tune : DIFFICULTY.tune écrit dans js/config.js (${keys.length} niveaux réglés)`);
  }
})();
