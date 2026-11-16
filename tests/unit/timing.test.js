// Intégration et indépendance au rythme d'image (exécuté dans la vraie page, Chromium + Playwright).
//   node tests/unit/timing.test.js
// 1. Pour chaque loi de rotation : 30 s de jeu en pas fixes, puis un tir ; l'angle d'impact doit être à moins de
//    0,002 rad d'une référence numérique (Simpson, pas de 0,1 ms, erreur < 1e-4 rad vérifiée en divisant le pas par deux).
// 2. Boucle pilotée par une horloge virtuelle à 30, 60, 90, 120 et 144 Hz, même journal de tirs (au début d'un pas, ou
//    à des instants quelconques au milieu d'un pas par throwPin(tSim)) : mêmes issues et mêmes angles d'impact à 1e-9 près.
// 3. Tête de l’aiguille en vol contre une sentinelle (deux premiers niveaux à sentinelle) : pour des lancers interceptés par la tête seule
//    (la tige passe), même instant d'interception à 1e-9 près que la simulation avance par pas de 1/120 s, de 1/60 s, de
//    0,1 ms ou de durées tirées au hasard.
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
    // continue, à-coups, sentinelle, traversantes ; puis les deux premiers niveaux à sentinelle
    const [LEVELS, SENT] = await p.evaluate(() => {
      const fst = (f, from) => { for (let n = from || 1; n < 400; n++) if (f(makeLevel(n))) return n; return 0; };
      const s1 = fst(l => l.sents.length > 0), s2 = fst(l => l.sents.length > 0, s1 + 1);
      return [[8, fst(l => l.pattern === 3), s1, fst(l => l.trav)], [s1, s2]];
    });
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

    /* ---------- 3. tête contre sentinelle : instant d'interception indépendant du découpage en pas ---------- */
    const hd = await p.evaluate(SENT => {
      soundOn = false;
      const ofail = window.fail; let te = -1;
      window.fail = function () { te = t; return ofail.apply(this, arguments); };
      let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      const SLICES = { '1/120': () => STEP, '1/60': () => 1 / 60, '0,1 ms': () => 1e-4, hasard: () => .0005 + rnd() * .02 };
      const run = (n, tL, slice) => {
        startLevel(n); update(1); update(tL - t); throwPin(tL); te = -1;
        for (let i = 0; i < 2000 && state === 'play' && flights.length; i++) update(slice());
        return { st: state, kind: failInfo && failInfo.kind, te };
      };
      const out = { cases: 0, diffs: [] };
      for (const n of SENT) {
        startLevel(n); update(1);
        const T0 = t, w = sentWindow();
        for (let k = 0; k < 4000 && out.cases < 12 * (n === SENT[0] ? 1 : 2); k++) {
          const tL = T0 + .05 + k * .0021;
          // tige seule : pas d'interception ; jeu : interception → la tête seule a touché
          startLevel(n); update(1);
          if (L.sents.some(q => sentHit(q, tL + w[0], tL + w[1], q.hw + SENT_PAD) >= 0)) continue;
          const ref = run(n, tL, SLICES['1/120']);
          if (ref.kind !== 'sent') continue;
          out.cases++;
          for (const [name, f] of Object.entries(SLICES)) {
            const r = run(n, tL, f);
            if (r.kind !== 'sent' || Math.abs(r.te - ref.te) > 1e-9) out.diffs.push(`niveau ${n}, lancer à ${tL.toFixed(4)} : ${name} → ${r.kind} à ${r.te}, référence ${ref.te}`);
          }
        }
      }
      window.fail = ofail; showMenu();
      return out;
    }, SENT);
    check(hd.cases >= 12, `tête contre sentinelle : seulement ${hd.cases} interceptions par la tête trouvées`);
    for (const d of hd.diffs) check(false, 'tête contre sentinelle : ' + d);
    console.log(`tête contre sentinelle : ${hd.cases} interceptions par la tête seule, même instant à 1e-9 près par pas de 1/120, 1/60, 0,1 ms et au hasard`);
    await c.close();
  } catch (e) { fails.push('harness: ' + (e && e.stack || e)); }
  await b.close();
  if (fails.length) { console.log('timing : ÉCHEC\n  ' + fails.join('\n  ')); process.exit(1); }
  console.log('timing : pass');
})();
