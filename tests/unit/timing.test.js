// Intégration et indépendance au rythme d'image (exécuté dans la vraie page, Chromium + Playwright).
//   node tests/unit/timing.test.js
// 1. Pour chaque loi de rotation : 30 s de jeu en pas fixes, puis un tir ; l'angle d'impact doit être à moins de
//    0,002 rad d'une référence numérique (Simpson, pas de 0,1 ms, erreur < 1e-4 rad vérifiée en divisant le pas par deux).
// 2. Boucle pilotée par une horloge virtuelle à 30, 60, 90, 120 et 144 Hz, même journal de tirs (au début d'un pas, ou
//    à des instants quelconques au milieu d'un pas par throwPin(tSim)) : mêmes issues et mêmes angles d'impact à 1e-9 près.
const { chromium } = require('playwright');
const path = require('path');
const URL = 'file://' + path.resolve(__dirname, '..', '..', 'index.html');
const RATES = [30, 60, 90, 120, 144];
const fails = [];
const check = (cond, msg) => { if (!cond) fails.push(msg); return cond; };

// remplace requestAnimationFrame par une file pilotée par le test (horloge virtuelle)
const VIRTUAL_RAF = () => {
  window.__vraf = [];
  window.requestAnimationFrame = cb => { window.__vraf.push(cb); return window.__vraf.length; };
  window.__frame = now => { const q = window.__vraf; window.__vraf = []; for (const cb of q) cb(now); };
};

(async () => {
  const b = await chromium.launch();
  try {
    const c = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
    const p = await c.newPage();
    p.on('pageerror', e => fails.push('pageerror: ' + e.message));
    await p.addInitScript(VIRTUAL_RAF);
    await p.goto(URL);
    await p.waitForFunction(() => typeof state !== 'undefined' && state === 'menu');

    /* ---------- 1. précision de l'intégration, une loi de rotation à la fois ---------- */
    const acc = await p.evaluate(() => {
      soundOn = false;
      const out = [];
      for (let pat = 0; pat < 6; pat++) {
        let n = 1; while (makeLevel(n).pattern !== pat) n++;
        startLevel(n);
        const t0 = t, r0 = rot;
        for (let i = 0; i < 30 * 120; i++) update(STEP);
        const before = stuck.length;
        throwPin();
        const tL = t;
        let guard = 0; while (stuck.length === before && state === 'play' && guard++ < 600) update(STEP);
        const got = stuck[stuck.length - 1];
        const tI = tL + flightTime();
        // référence : Simpson composite sur [t0, tI]
        const simpson = h => {
          const N = 2 * Math.ceil((tI - t0) / h / 2), dh = (tI - t0) / N;
          let s = speedAt(t0) + speedAt(tI);
          for (let k = 1; k < N; k++) s += (k % 2 ? 4 : 2) * speedAt(t0 + k * dh);
          return s * dh / 3;
        };
        const I1 = simpson(1e-4), I2 = simpson(5e-5);
        const ref = norm(HPI - (r0 + I2));
        out.push({ pat, n, state, refErr: Math.abs(I1 - I2), err: got && stuck.length > before ? angDiff(got.a, ref) : null, failed: state !== 'play' && state !== 'winning' });
      }
      showMenu();
      return out;
    });
    for (const r of acc) {
      check(r.refErr < 1e-4, `loi ${r.pat} (niveau ${r.n}) : référence imprécise (${r.refErr})`);
      check(r.err !== null && r.err < .002, `loi ${r.pat} (niveau ${r.n}) : écart d'impact ${r.err} rad (≥ 0,002) ; état ${r.state}`);
    }
    console.log('intégration : ' + acc.map(r => `loi ${r.pat} niv ${r.n} écart ${r.err === null ? '—' : r.err.toExponential(1)}`).join(' ; '));

    /* ---------- 2. même journal de tirs à 30/60/90/120/144 Hz ---------- */
    const LEVELS = [8, 13, 21, 26];   // continue, à-coups, sentinelle, traversantes
    for (const n of LEVELS) for (const mode of ['pas', 'instants']) {
      const res = [];
      for (const hz of RATES) {
        const r = await p.evaluate(({ n, hz, mode }) => {
          soundOn = false;
          // tirs injectés au début d'un pas, à des numéros de pas fixés (journal), quel que soit le découpage en images
          const journal = mode === 'pas' ? [70, 150, 230, 320, 400, 470, 560, 650, 720, 810, 900, 980] : [];
          // seconde moitié du journal : instants de simulation quelconques (au milieu d'un pas), lancés par throwPin(tSim)
          // entre deux images, avant que la simulation ne les dépasse
          const instants = mode === 'pas' ? [] : [.52, 1.237, 1.9811, 2.7303, 3.4417, 4.1, 4.86, 5.5133, 6.2, 6.97, 7.71, 8.4];
          const orig = window.update;
          let k = 0, j = 0, q = 0, t0 = 0;
          window.update = function (dt) { if (state === 'play' && j < journal.length && k >= journal[j]) { throwPin(); j++; } k++; orig(dt); };
          let now = window.__vnow || 1000;
          __frame(now += 1000 / hz); __frame(now += 1000 / hz);   // recale l'horloge de la boucle
          startLevel(n); k = 0; t0 = t;                           // le journal compte les pas depuis le début du niveau
          for (let i = 0; i < Math.ceil(14 * hz) && (state === 'play' || state === 'dying'); i++) {
            if (state === 'play' && q < instants.length && t0 + instants[q] - t <= .05) { throwPin(t0 + instants[q]); q++; }
            __frame(now += 1000 / hz);
          }
          window.update = orig; window.__vnow = now;
          const o = { state, steps: k, angles: stuck.filter(s => !s.pre).map(s => s.a), fail: failInfo && { kind: failInfo.kind, a: failInfo.a } };
          showMenu();
          return o;
        }, { n, hz, mode });
        res.push([hz, r]);
      }
      const [, ref] = res[0];
      for (const [hz, r] of res.slice(1)) {
        check(r.state === ref.state, `niveau ${n} (${mode}) : issue à ${hz} Hz (${r.state}) ≠ 30 Hz (${ref.state})`);
        check(r.angles.length === ref.angles.length, `niveau ${n} : ${r.angles.length} aiguilles à ${hz} Hz contre ${ref.angles.length}`);
        const d = Math.max(0, ...r.angles.map((a, i) => Math.abs(a - ref.angles[i])));
        check(d < 1e-9, `niveau ${n} : angles différents à ${hz} Hz (écart ${d})`);
        if (ref.fail || r.fail) check(!!ref.fail && !!r.fail && ref.fail.kind === r.fail.kind && Math.abs(ref.fail.a - r.fail.a) < 1e-9, `niveau ${n} : échec différent à ${hz} Hz`);
      }
      console.log(`niveau ${n} (${mode}) : ${ref.state}, ${ref.angles.length} aiguilles, identique sur ${RATES.join('/')} Hz`);
    }
    await c.close();
  } catch (e) { fails.push('harness: ' + (e && e.stack || e)); }
  await b.close();
  if (fails.length) { console.log('timing : ÉCHEC\n  ' + fails.join('\n  ')); process.exit(1); }
  console.log('timing : pass');
})();
