// Banc d'essai Orbita.  usage: node shoot.js <chemin/index.html> <dossier_sortie> [--quick]
// Joue le jeu avec un bot, prend des captures comparables, écrit summary.json (pass:true/false).
const { chromium, devices } = require('playwright');
const path = require('path'), fs = require('fs');
const [, , html, out, flag] = process.argv;
if (!html || !out) { console.error('usage: node shoot.js <index.html> <outdir> [--quick]'); process.exit(2); }
const QUICK = flag === '--quick';
const url = 'file://' + path.resolve(html);
fs.mkdirSync(out, { recursive: true });
const errors = [], wins = {}, notes = [];
let sim = [], failOk = false;

function hook(p, tag) {
  p.on('pageerror', e => errors.push(`[${tag}] pageerror: ${e.message}`));
  p.on('console', m => { if (m.type() === 'error') errors.push(`[${tag}] console: ${m.text()}`); });
}
const botStep = p => p.evaluate(() => {
  if (state !== 'play') return state;
  if (!flying && left > 0) {
    let ok;
    if (typeof window.__botSafe === 'function') ok = !!window.__botSafe();
    else {
      const travel = (LAUNCH - (cy + R)) / FLYV; let r2 = rot, t2 = t; const n = 20;
      for (let k = 0; k < n; k++) { t2 += travel / n; r2 += speedAt(t2) * travel / n; }
      const a = norm(Math.PI / 2 - r2);
      ok = stuck.every(s => angDiff(s.a, a) > GAP * 1.7);
    }
    if (ok) throwPin();
  }
  return state;
});
// joue jusqu'à la fin (ou jusqu'à ce qu'il reste stopLeft flèches). Retourne l'état final.
async function bot(p, { stopLeft = -1, onWinning = null, maxMs = 90000 } = {}) {
  const t0 = Date.now(); let seenWinning = false, st = 'play';
  while (Date.now() - t0 < maxMs) {
    st = await botStep(p);
    if (st === 'winning' && !seenWinning) { seenWinning = true; if (onWinning) await onWinning(); }
    if (st === 'won' || st === 'failed') return st;
    if (stopLeft >= 0 && st === 'play') {
      const s = await p.evaluate(() => [left, !!flying]);
      if (s[0] <= stopLeft && !s[1]) return 'stopped';
    }
    await p.waitForTimeout(16);
  }
  return 'timeout:' + st;
}
const shot = (p, name) => p.screenshot({ path: path.join(out, name + '.png') });
const start = (p, n) => p.evaluate(n => startLevel(n), n);

(async () => {
  const b = await chromium.launch();
  try {
    /* ---------- téléphone principal ---------- */
    const c = await b.newContext({ ...devices['iPhone 13'] });
    const p = await c.newPage(); hook(p, 'iphone13');
    await p.goto(url); await p.waitForTimeout(1200);
    await shot(p, '01-menu');
    await p.click('#playBtn'); await p.waitForTimeout(800);
    await shot(p, '02-play01');
    let r = await bot(p, { onWinning: async () => { await p.waitForTimeout(430); await shot(p, '05-fx'); } });
    wins[1] = r; await p.waitForTimeout(1500); await shot(p, '06-win');

    await start(p, 7); await p.waitForTimeout(300);
    await bot(p, { stopLeft: 3 }); await shot(p, '03-play07');
    wins[7] = await bot(p);

    await start(p, 10); await p.waitForTimeout(300);
    await bot(p, { stopLeft: 5 }); await shot(p, '04-boss10');
    // échec volontaire, déterministe : tirer quand le point d'impact prévu tombe sur une aiguille déjà plantée
    for (let i = 0; i < 1500; i++) {
      const st = await p.evaluate(() => {
        if (state === 'play' && !flying && left > 0) {
          let a;
          if (typeof predict === 'function') a = predict(t).a;
          else {
            const travel = (LAUNCH - (cy + R)) / FLYV; let r2 = rot, t2 = t; const n = 20;
            for (let k = 0; k < n; k++) { t2 += travel / n; r2 += speedAt(t2) * travel / n; }
            a = norm(Math.PI / 2 - r2);
          }
          if (stuck.some(s => angDiff(s.a, a) < GAP * .4)) throwPin();
        }
        return state;
      });
      if (st !== 'play') break; await p.waitForTimeout(10);
    }
    for (let i = 0; i < 100; i++) { if (await p.evaluate(() => state) === 'failed') break; await p.waitForTimeout(50); }
    await p.waitForTimeout(600); await shot(p, '07-fail');
    failOk = await p.evaluate(() => state) === 'failed';
    if (!failOk) notes.push('échec volontaire non obtenu au niveau 10');

    await start(p, 23); await p.waitForTimeout(300);
    await bot(p, { stopLeft: 6 }); await shot(p, '08-play23');
    wins[23] = await bot(p);

    await p.evaluate(() => { unlocked = 24; for (let i = 1; i <= 23; i++) bestStars[i] = 1 + (i * 7) % 3; showMenu(); });
    await p.waitForTimeout(600); await shot(p, '09-menu-progress');
    await p.evaluate(() => showLevels()); await p.waitForTimeout(600); await shot(p, '10-levels');
    await start(p, 12); await p.waitForTimeout(700);
    await p.click('#hudBtn'); await p.waitForTimeout(500); await shot(p, '11-pause');

    // balayage accéléré d'équité : le bot (marge 1.7×GAP, ~30 ms de tolérance) doit gagner chaque niveau en < 75 s de temps de jeu
    sim = await p.evaluate(maxN => {
      const res = []; soundOn = false;
      for (let n = 1; n <= maxN; n++) {
        startLevel(n); let T = 0;
        while (T < 75) {
          if (state === 'play' && !flying && left > 0) {
            let ok;
            if (typeof window.__botSafe === 'function') ok = !!window.__botSafe();
            else {
              const travel = (LAUNCH - (cy + R)) / FLYV; let r2 = rot, t2 = t; const k2 = 20;
              for (let k = 0; k < k2; k++) { t2 += travel / k2; r2 += speedAt(t2) * travel / k2; }
              const a = norm(Math.PI / 2 - r2);
              ok = stuck.every(s => angDiff(s.a, a) > GAP * 1.7);
            }
            if (ok) throwPin();
          }
          update(1 / 60); T += 1 / 60;
          if (state === 'won' || state === 'failed') break;
        }
        res.push({ n, state, T: +T.toFixed(1) });
      }
      showMenu();
      return res;
    }, QUICK ? 12 : 60);
    await c.close();

    /* ---------- petit téléphone ---------- */
    const c2 = await b.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const p2 = await c2.newPage(); hook(p2, 'small');
    await p2.goto(url); await p2.waitForTimeout(1000); await shot(p2, '12-small-menu');
    await start(p2, 9); await p2.waitForTimeout(300);
    await bot(p2, { stopLeft: 3 }); await shot(p2, '13-small-play09');
    wins['small9'] = await bot(p2); await p2.waitForTimeout(1500); await shot(p2, '14-small-win');
    await c2.close();

    /* ---------- bureau ---------- */
    const c3 = await b.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
    const p3 = await c3.newPage(); hook(p3, 'desktop');
    await p3.goto(url); await p3.waitForTimeout(1000); await shot(p3, '15-desk-menu');
    await start(p3, 6); await p3.waitForTimeout(300);
    await bot(p3, { stopLeft: 3 }); await shot(p3, '16-desk-play06');
    wins['desk6'] = await bot(p3);
    await c3.close();
  } catch (e) { errors.push('harness: ' + (e && e.stack || e)); }
  await b.close();
  const lost = Object.entries(wins).filter(([, v]) => v !== 'won').map(([k, v]) => `${k}:${v}`);
  const simLost = sim.filter(x => x.state !== 'won').map(x => `${x.n}:${x.state}`);
  const simTimes = sim.map(x => `${x.n}:${x.T}s`).join(' ');
  const summary = { pass: errors.length === 0 && lost.length === 0 && simLost.length === 0 && sim.length > 0 && failOk, errors, wins, lost, simLost, simTimes, failOk, notes };
  fs.writeFileSync(path.join(out, 'summary.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
  process.exit(summary.pass ? 0 : 1);
})();
