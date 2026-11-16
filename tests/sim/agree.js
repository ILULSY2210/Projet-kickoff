// Accord du simulateur : le cœur exécuté dans Node (tests/sim/load.js) joue-t-il exactement le jeu de la page ?
//   node tests/sim/agree.js [--n=2000] [--max=400] [--seed=1]
// 1. Dans Node, le joueur qui vise (tests/sim/driver.js, « aim ») joue N tentatives : niveau tiré dans 1..max (boss et
//    spéciaux compris), imprécision σ tirée dans [0, 100 ms] ; on garde le journal de ses taps et l'issue.
// 2. Chaque journal est rejoué dans Node et dans Chromium (vraie page index.html, mêmes appels startLevel / update(STEP) /
//    throwPin(tSim)) : issue (victoire, échec et sa cause, aiguilles restantes) et angles des aiguilles plantées comparés.
// Seuil : ≥ 99,5 % d'issues identiques entre Chromium et Node (100 % attendus : c'est le même code) ; angles à 1e-9 près.
// Écrit tests/out/sim/agree.json.
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const { load, ROOT } = require('./load');
const { DRIVER } = require('./driver');
const arg = (k, d) => { const a = process.argv.find(x => x.startsWith('--' + k + '=')); return a ? +a.slice(k.length + 3) : d; };
const N = arg('n', 2000), MAXN = arg('max', 400), SEED = arg('seed', 1);
const OUT = path.join(ROOT, 'tests', 'out', 'sim');
fs.mkdirSync(OUT, { recursive: true });
const key = r => r.st + '/' + r.kind + '/' + r.left;
const angErr = (a, b) => a.length !== b.length ? Infinity : Math.max(0, ...a.map((x, i) => Math.abs(x - b[i])));

(async () => {
  const t0 = Date.now();
  const G = load(); G.run(DRIVER); const S = G.run('__sim');
  let x = SEED * 7919 + 13; const R = () => { x = (x * 16807) % 2147483647; return x / 2147483647; };
  const jobs = [];
  for (let i = 0; i < N; i++) {
    const n = 1 + Math.floor(R() * MAXN), sigma = R() * .1, seed = 1 + Math.floor(R() * 1e9);
    const closed = S.aim(n, sigma, seed);
    const node = S.replay(n, closed.taps);
    jobs.push({ n, sigma, seed, taps: closed.taps, closed, node });
  }
  const tNode = Date.now() - t0;
  const b = await chromium.launch();
  const errors = [];
  let web = [];
  try {
    const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 })).newPage();
    p.on('pageerror', e => errors.push('pageerror: ' + e.message));
    await p.goto('file://' + path.join(ROOT, 'index.html'));
    await p.waitForFunction(() => typeof state !== 'undefined' && state === 'menu');
    await p.addScriptTag({ content: DRIVER });
    await p.evaluate(() => { soundOn = false; });
    for (let i = 0; i < jobs.length; i += 100) {
      const part = jobs.slice(i, i + 100).map(j => ({ n: j.n, taps: j.taps }));
      web = web.concat(await p.evaluate(list => { const o = list.map(j => __sim.replay(j.n, j.taps)); showMenu(); return o; }, part));
    }
  } catch (e) { errors.push('harness: ' + (e && e.stack || e)); }
  await b.close();
  let same = 0, sameClosed = 0, worst = 0;
  const diffs = [], stats = { win: 0, fail: 0, open: 0 };
  jobs.forEach((j, i) => {
    const w = web[i];
    if (!w) return;
    stats[j.node.st]++;
    const e = angErr(w.ang, j.node.ang);
    if (key(w) === key(j.node) && e < 1e-9) same++;
    else if (diffs.length < 20) diffs.push({ n: j.n, sigma: +j.sigma.toFixed(4), seed: j.seed, node: key(j.node), web: key(w), angErr: e });
    if (e < Infinity) worst = Math.max(worst, e);
    if (key(j.closed) === key(j.node) && angErr(j.closed.ang, j.node.ang) < 1e-9) sameClosed++;
  });
  const rate = same / jobs.length, pass = errors.length === 0 && web.length === jobs.length && rate >= .995;
  const summary = { pass, attempts: jobs.length, identical: same, rate: +(rate * 100).toFixed(2) + ' %', replayEqualsClosedLoop: sameClosed,
    worstAngle: worst, outcomes: stats, levels: '1..' + MAXN, seed: SEED, nodeSeconds: +(tNode / 1000).toFixed(1), totalSeconds: +((Date.now() - t0) / 1000).toFixed(1), diffs, errors };
  fs.writeFileSync(path.join(OUT, 'agree.json'), JSON.stringify(summary, null, 2));
  console.log(`agree : ${same}/${jobs.length} issues identiques Chromium / Node (${summary.rate}, seuil 99,5 %) ; rejeu = partie jouée : ${sameClosed}/${jobs.length} ; écart d'angle max ${worst} ; ${JSON.stringify(stats)}`);
  for (const d of diffs) console.log('  ≠', JSON.stringify(d));
  for (const e of errors) console.log('  !', e);
  console.log(pass ? 'agree : pass' : 'agree : FAIL');
  process.exit(pass ? 0 : 1);
})();
