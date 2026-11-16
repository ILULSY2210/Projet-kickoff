// Mesures de performance et de régularité d'Orbita (Chromium + Playwright).
//   node tests/perf.js [--only=regularite,charge] [--out=dossier]
// Sections :
//   regularite : boucle pilotée par une horloge virtuelle à 90 et 120 Hz, niveau à rotation continue ;
//                coefficient de variation de l'incrément de rotation dessiné d'une image à l'autre < 5 %.
//   charge     : processeur ralenti ×4 (CDP) ; vitesse de la simulation (temps simulé / temps réel) ≥ 0,98.
// Écrit <out>/summary.json ({ pass, sections }) et sort avec le code 1 en cas d'échec.
const { chromium, devices } = require('playwright');
const path = require('path'), fs = require('fs');
const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const opt = k => { const a = args.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : null; };
const URL = 'file://' + path.join(ROOT, 'index.html');
const OUT = path.resolve(opt('out') || path.join(ROOT, 'tests', 'out', 'perf'));
const ONLY = opt('only') ? opt('only').split(',') : null;
const want = s => !ONLY || ONLY.includes(s);
fs.mkdirSync(OUT, { recursive: true });
const results = {}, errors = [];
function section(name) {
  const r = { checks: 0, fails: [], notes: {} };
  results[name] = r;
  return { ok(c, m) { r.checks++; if (!c) r.fails.push(m); return !!c; }, note(k, v) { r.notes[k] = v; } };
}
const VIRTUAL_RAF = () => {
  window.__vraf = [];
  window.requestAnimationFrame = cb => { window.__vraf.push(cb); return window.__vraf.length; };
  window.__frame = now => { const q = window.__vraf; window.__vraf = []; for (const cb of q) cb(now); };
};
const ready = p => p.waitForFunction(() => typeof state !== 'undefined' && state === 'menu');
const stats = a => { const m = a.reduce((s, x) => s + x, 0) / a.length, sd = Math.sqrt(a.reduce((s, x) => s + (x - m) * (x - m), 0) / a.length); return { m, sd, cv: sd / Math.abs(m) }; };
const pct = (a, q) => { const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };

async function regularite(b) {
  const S = section('regularite');
  const c = await b.newContext({ ...devices['iPhone 13'] });
  const p = await c.newPage(); p.on('pageerror', e => errors.push('regularite: ' + e.message));
  await p.addInitScript(VIRTUAL_RAF);
  await p.goto(URL); await ready(p);
  for (const hz of [90, 120]) {
    const r = await p.evaluate(hz => {
      soundOn = false;
      let now = (window.__vnow || 1000);
      __frame(now += 1000 / hz); __frame(now += 1000 / hz);
      startLevel(1);
      const drawn = [], sim = [], od = window.draw;
      window.draw = function (dt) { drawn.push(RV.rot); sim.push(rot); od(dt); };
      for (let i = 0; i < 2 * hz; i++) __frame(now += 1000 / hz);
      window.draw = od; window.__vnow = now;
      showMenu();
      const inc = a => a.slice(1).map((x, i) => x - a[i]).slice(5);
      return { drawn: inc(drawn), sim: inc(sim) };
    }, hz);
    const d = stats(r.drawn), s = stats(r.sim);
    S.ok(d.cv < .05, `${hz} Hz : coefficient de variation ${(d.cv * 100).toFixed(2)} % (< 5 %)`);
    S.note(hz + 'Hz', { cv_dessin: +(d.cv * 100).toFixed(3) + ' %', cv_sans_interpolation: +(s.cv * 100).toFixed(1) + ' %' });
  }
  await c.close();
}

async function charge(b) {
  const S = section('charge');
  const c = await b.newContext({ ...devices['iPhone 13'] });
  const p = await c.newPage(); p.on('pageerror', e => errors.push('charge: ' + e.message));
  await p.goto(URL); await ready(p);
  const cdp = await c.newCDPSession(p);
  for (const rate of [1, 4]) {
    await cdp.send('Emulation.setCPUThrottlingRate', { rate });
    await p.evaluate(() => { soundOn = false; startLevel(8); });
    await p.waitForTimeout(400);
    const r = await p.evaluate(() => new Promise(res => {
      const fr = [], od = window.draw; let lastF = 0;
      window.draw = function (dt) { const a = performance.now(); od(dt); fr.push(performance.now() - a); };
      const w0 = performance.now(), t0 = t, lt0 = levelTime;
      setTimeout(() => {
        const w1 = performance.now(), o = { speed: (t - t0) / ((w1 - w0) / 1000), lt: (levelTime - lt0) / ((w1 - w0) / 1000), state, frames: fr.length, draw: fr };
        window.draw = od; showMenu(); res(o);
      }, 4000);
    }));
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    if (rate === 4) S.ok(r.speed >= .98 && r.state === 'play', `CPU ×4 : vitesse de simulation ${r.speed.toFixed(3)}× (≥ 0,98), état ${r.state}`);
    S.note('cpu_x' + rate, { vitesse: +r.speed.toFixed(3), images_par_s: +(r.frames / 4).toFixed(1), draw_ms_median: +pct(r.draw, .5).toFixed(2), draw_ms_p95: +pct(r.draw, .95).toFixed(2) });
  }
  await c.close();
}

(async () => {
  const b = await chromium.launch();
  try {
    if (want('regularite')) await regularite(b);
    if (want('charge')) await charge(b);
  } catch (e) { errors.push('harness: ' + (e && e.stack || e)); }
  await b.close();
  const fails = Object.entries(results).flatMap(([k, r]) => r.fails.map(f => `[${k}] ${f}`));
  const summary = { pass: errors.length === 0 && fails.length === 0 && Object.keys(results).length > 0, fails, errors, sections: results };
  fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(summary, null, 2));
  for (const [k, r] of Object.entries(results)) console.log(`${r.fails.length ? 'ÉCHEC' : 'ok   '} ${k} : ${r.checks - r.fails.length}/${r.checks}  ${JSON.stringify(r.notes)}`);
  for (const f of fails) console.log('  - ' + f);
  for (const e of errors) console.log('  ! ' + e);
  console.log(summary.pass ? 'perf : pass' : 'perf : FAIL');
  process.exit(summary.pass ? 0 : 1);
})();
