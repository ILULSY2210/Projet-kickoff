// Collision = dessin (exécuté dans la vraie page, sur 5 écrans).
//   node tests/unit/geometry.test.js
// - rayon extérieur dessiné des têtes (pleines et creuses, trait compris) = GAP × (R + PL) / 2 ;
// - deux têtes se touchent à l'écran à un écart de GAP (à 5e-4 rad près : corde contre arc) ;
// - règle : un atterrissage à GAP − 0,002 rad d'une aiguille ou d'un bloqueur est une défaite, à GAP + 0,002 rad non ;
//   et le dessin dit la même chose (têtes qui se recouvrent ⇔ défaite) ;
// - sentinelles : bout arrondi + demi-épaisseur de la tige = SENT_PAD × RS (contact dessiné = interception).
// Captures des deux têtes à GAP ± 0,002 rad (et ± 0,02 rad pour l'œil) dans tests/out/geometry/.
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const ROOT = path.resolve(__dirname, '..', '..');
const URL = 'file://' + path.join(ROOT, 'index.html');
const OUT = path.join(ROOT, 'tests', 'out', 'geometry');
const SCREENS = [[320, 568], [360, 640], [390, 664], [390, 844], [430, 932]];
const fails = [];
const check = (c, m) => { if (!c) fails.push(m); };
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const b = await chromium.launch();
  try {
    for (const [w, h] of SCREENS) {
      const tag = w + 'x' + h;
      const c = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 3 });
      const p = await c.newPage();
      p.on('pageerror', e => fails.push(tag + ' pageerror: ' + e.message));
      await p.addInitScript(() => { window.__vraf = []; window.requestAnimationFrame = cb => { window.__vraf.push(cb); return 1; }; });
      await p.goto(URL);
      await p.waitForFunction(() => typeof state !== 'undefined' && state === 'menu');
      const r = await p.evaluate(() => {
        soundOn = false;
        const lw = Math.max(1.3, R * .022), ring = headRing(lw, HEAD);
        const o = { head: HEAD, want: GAP * (R + PL) / 2, ringOuter: ring.r + ring.w / 2, touch: 2 * Math.asin(HEAD / (R + PL)),
          sent: SENT_HW + lw * .6, sentWant: SENT_PAD * RS, rules: [] };
        // règle d'atterrissage contre une aiguille plantée (niveau 1) et contre un bloqueur (niveau 2)
        for (const [n, kind] of [[1, 'aiguille'], [2, 'bloqueur']]) for (const d of [-.002, .002]) {
          startLevel(n); update(.2);
          let a0;
          if (kind === 'aiguille') { a0 = 1.234; stuck.push({ a: a0, pre: false, k: 1, deg: 0 }); }
          else a0 = stuck.find(s => s.pre && !s.wall).a;
          const a = norm(a0 + GAP + d), chord = 2 * (R + PL) * Math.sin(angDiff(a, a0) / 2);
          stick(a);
          o.rules.push({ kind, d, dead: state === 'dying', overlap: chord < 2 * HEAD });
        }
        showMenu();
        return o;
      });
      check(Math.abs(r.head - r.want) < 1e-9, `${tag} : rayon des têtes ${r.head} ≠ GAP × (R + PL) / 2 = ${r.want}`);
      check(Math.abs(r.ringOuter - r.head) < 1e-9, `${tag} : rayon extérieur des têtes creuses ${r.ringOuter} ≠ ${r.head}`);
      check(Math.abs(r.touch - .115) < 5e-4, `${tag} : contact dessiné à ${r.touch} rad (GAP = 0,115)`);
      check(Math.abs(r.sent - r.sentWant) < 1e-9, `${tag} : sentinelle, bout + tige = ${r.sent} px ≠ SENT_PAD × RS = ${r.sentWant}`);
      for (const x of r.rules) {
        check(x.dead === (x.d < 0), `${tag} : ${x.kind} à GAP ${x.d > 0 ? '+' : '−'} 0,002 : ${x.dead ? 'défaite' : 'planté'} (attendu ${x.d < 0 ? 'défaite' : 'planté'})`);
        check(x.dead === x.overlap, `${tag} : ${x.kind} à GAP ${x.d > 0 ? '+' : '−'} 0,002 : dessin (${x.overlap ? 'contact' : 'écart'}) ≠ règle (${x.dead ? 'défaite' : 'planté'})`);
      }
      // captures : deux aiguilles en bas de l'astre, à GAP ± δ
      for (const d of [-.02, -.002, .002, .02]) {
        const box = await p.evaluate(d => {
          startLevel(1); update(.1);
          const a0 = 2;
          stuck = [{ a: a0, pre: false, k: 1, deg: 0 }, { a: norm(a0 + GAP + d), pre: false, k: 1, deg: 1 }]; arcsDirty = true;
          rot = HPI - a0 - (GAP + d) / 2; left = 3; texts = []; sparks = []; rings = [];
          viewAt(0); for (let i = 0; i < 8; i++) draw(1 / 60);
          return { x: cx - 34, y: cy + R + PL - 22, width: 68, height: 44 };
        }, d);
        await p.screenshot({ path: path.join(OUT, `${tag}-gap${d > 0 ? '+' : ''}${d}.png`), clip: box });
      }
      await c.close();
    }
  } catch (e) { fails.push('harness: ' + (e && e.stack || e)); }
  await b.close();
  if (fails.length) { console.log('geometry : ÉCHEC\n  ' + fails.join('\n  ')); process.exit(1); }
  console.log('geometry : pass (5 écrans, captures dans tests/out/geometry/)');
})();
