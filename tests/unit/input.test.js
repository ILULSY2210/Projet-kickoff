// Horodatage des taps : tapInstant(ts, now, t, simWall) (couche d'entrée, js/ui.js), exécuté dans la vraie page.
//   node tests/unit/input.test.js
// Propriétés vérifiées sur 20 000 tirages : le départ n'est jamais avant le dernier instant simulé ni après « maintenant »
// (et jamais plus de 0,1 s après lui) ; un événement daté entre les deux part exactement à son instant ; un horodatage
// « depuis 1970 », absent ou invalide est remplacé par maintenant ; un événement en retard part au dernier instant simulé.
const { chromium } = require('playwright');
const path = require('path');
const URL = 'file://' + path.resolve(__dirname, '..', '..', 'index.html');
(async () => {
  const b = await chromium.launch();
  let fails = [];
  try {
    const p = await (await b.newContext()).newPage();
    p.on('pageerror', e => fails.push('pageerror: ' + e.message));
    await p.goto(URL);
    await p.waitForFunction(() => typeof state !== 'undefined' && state === 'menu');
    fails = fails.concat(await p.evaluate(() => {
      const f = [], R = (() => { let x = 7; return () => (x = (x * 16807) % 2147483647) / 2147483647; })();
      const near = (a, b) => Math.abs(a - b) < 1e-9;
      for (let i = 0; i < 20000; i++) {
        const wall = 1000 + R() * 1e6, now = wall + R() * 60, tSim = R() * 100;
        const kind = i % 5;
        const ts = kind === 0 ? wall + (now - wall) * R()          // entre l'instant simulé et maintenant
          : kind === 1 ? wall - R() * 300                            // en retard
          : kind === 2 ? 1.7e12 + R() * 1e10                         // depuis 1970
          : kind === 3 ? (R() < .5 ? undefined : NaN)                // absent
          : now + 2000 + R() * 1e5;                                  // aberrant, dans le futur
        const x = tapInstant(ts, now, tSim, wall), hi = tSim + Math.min(.1, (now - wall) / 1000);
        if (!(x >= tSim - 1e-12 && x <= hi + 1e-12)) f.push(`hors bornes : ts=${ts} → ${x} ∉ [${tSim}, ${hi}]`);
        if (kind === 0 && !near(x, tSim + Math.min(.1, (ts - wall) / 1000))) f.push(`instant faux : ${x}`);
        if (kind === 1 && x !== tSim) f.push(`événement en retard : ${x} ≠ ${tSim}`);
        if (kind >= 2 && !near(x, hi)) f.push(`horodatage invalide (${ts}) non remplacé par maintenant : ${x} ≠ ${hi}`);
        if (f.length > 5) break;
      }
      return f;
    }));
  } catch (e) { fails.push('harness: ' + (e && e.stack || e)); }
  await b.close();
  if (fails.length) { console.log('input : ÉCHEC\n  ' + fails.join('\n  ')); process.exit(1); }
  console.log('input : pass (20 000 tirages)');
})();
