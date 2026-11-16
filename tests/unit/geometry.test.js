// Collision = dessin (exécuté dans la vraie page, sur 5 écrans).
//   node tests/unit/geometry.test.js
// - rayon extérieur dessiné des têtes (pleines et creuses, trait compris) = GAP × (R + PL) / 2 ;
// - deux têtes se touchent à l'écran à un écart de GAP (à 5e-4 rad près : corde contre arc) ;
// - règle : un atterrissage à GAP − 0,002 rad d'une aiguille ou d'un bloqueur est une défaite, à GAP + 0,002 rad non ;
//   et le dessin dit la même chose (têtes qui se recouvrent ⇔ défaite) ;
// - sentinelles : bout arrondi + demi-épaisseur de la tige = SENT_PAD × RS (contact dessiné = interception) ;
// - tête de l'aiguille en vol (disque) contre une sentinelle : en 390×844, UREF, HEAD_REF et SENT_PAD_HEAD sont ceux de la
//   mise en page ; lancers sur une grille de 0,5 ms autour des passages des sentinelles sur l’axe (deux premiers niveaux à sentinelle) :
//   jamais de recouvrement dessiné de la tête sans interception (≤ 0,1 px en 390×844, ≤ 2 px sur les autres écrans, dont
//   le couloir de tir diffère), et la tête dessinée touche la sentinelle à l'instant d'une interception par la tête
//   (écart ≤ 0,3 px en 390×844, ≤ 1 px ailleurs).
// Captures des deux têtes à GAP ± 0,002 rad (et ± 0,02 rad pour l'œil) dans tests/out/geometry/.
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const ROOT = path.resolve(__dirname, '..', '..');
const URL = 'file://' + path.join(ROOT, 'index.html');
const OUT = path.join(ROOT, 'tests', 'out', 'geometry');
const SCREENS = [[320, 568], [360, 640], [390, 664], [390, 844], [430, 932]];
const fails = [];
// valeurs de référence lues dans js/config.js (UREF, HEAD_REF, SENT_PAD_HEAD)
const CFG = fs.readFileSync(path.join(ROOT, 'js', 'config.js'), 'utf8');
const U_ = new Function(/const U = (\{[^}]*\});/.exec(CFG)[0].replace('const U = ', 'return '))();
const UREF_ = new Function('U', 'return ' + /const UREF = (\[[^;]*\]);/.exec(CFG)[1])(U_);
const UREF_U = UREF_.map(x => x[0]), UREF_V = UREF_.map(x => x[1]);
const HEAD_REF_V = +/HEAD_REF = ([\d.]+)/.exec(CFG)[1], PAD_HEAD_V = +/SENT_PAD_HEAD = ([\d.]+)/.exec(CFG)[1];
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
        // tête en vol contre une sentinelle : instant exact de l'interception (fail est appelé à l'instant de l'événement)
        o.ref = { umap: UMAP.map(x => [x[0], x[1] / RS]), head: HEAD / RS, pad: (SENT_HW + HEAD) / RS };
        const ofail = window.fail; let te = -1;
        window.fail = function () { te = t; return ofail.apply(this, arguments); };
        const ys = [0, 0], sh = lw * .6;
        const segD = (px, py, ax, ay, bx, by) => { const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy, u = clamp(L2 ? ((px - ax) * dx + (py - ay) * dy) / L2 : 0, 0, 1); return Math.hypot(px - ax - u * dx, py - ay - u * dy); };
        // écarts dessinés (px, < 0 : recouvrement) de la sentinelle q à la tête et à la tige, τ après le lancer tL
        const gaps = (q, tL, tau) => {
          pinYs(clamp(tau / FLIGHT, 0, 1), ys);
          const rt = ys[0] - cy, rh = ys[1] - HEAD - cy, d = angSigned(HPI, q.a0 + q.w * (tL + tau));
          if (Math.abs(d) <= q.hw) return [Math.abs(rh - RS) - SENT_HW - HEAD, (RS >= rt && RS <= rh ? 0 : Math.min(Math.abs(RS - rt), Math.abs(RS - rh))) - SENT_HW - sh];
          const ea = HPI + (d > 0 ? d - q.hw : d + q.hw), ex = Math.cos(ea) * RS, ey = Math.sin(ea) * RS;
          return [Math.hypot(ex, ey - rh) - SENT_HW - HEAD, segD(ex, ey, 0, rt, 0, rh) - SENT_HW - sh];
        };
        const hs = { n: 0, hits: 0, headHits: 0, overlap: 0, gapAtHit: 0 };
        const fst = (f, from) => { for (let n = from || 1; n < 400; n++) if (f(makeLevel(n))) return n; return 0; };
        const s1 = fst(l => l.sents.length > 0), s2 = fst(l => l.sents.length > 0, s1 + 1);
        for (const n of [s1, s2]) {
          startLevel(n); update(1);
          const T0 = t, edges = [];
          for (const q of L.sents) { let pv = null; for (let x = T0 + .1; x < T0 + 9 && edges.length < 4; x += .001) { const v = Math.abs(angSigned(HPI, q.a0 + q.w * x)) - q.hw; if (pv !== null && (pv > 0) !== (v > 0)) edges.push(x); pv = v; } }
          for (const tc of edges) for (let k = 0; k < 500; k++) {
            const tL = tc - .1 + k * .0005;
            startLevel(n); update(1); update(tL - t); throwPin(tL); te = -1;
            for (let i = 0; i < 700 && state === 'play' && flights.length; i++) update(1e-4);
            const hit = state === 'dying' && failInfo.kind === 'sent', tend = hit ? te - tL : FLIGHT;
            hs.n++;
            for (let tau = .68 * FLIGHT; tau < tend - 1e-6; tau += 2e-5) for (const q of L.sents) hs.overlap = Math.max(hs.overlap, -gaps(q, tL, tau)[0]);
            if (hit) { hs.hits++; const g = gaps(failInfo.who, tL, te - tL); if (g[0] < g[1]) { hs.headHits++; hs.gapAtHit = Math.max(hs.gapAtHit, g[0]); } }
          }
        }
        window.fail = ofail;
        o.headSent = hs;
        showMenu();
        return o;
      });
      check(Math.abs(r.head - r.want) < 1e-9, `${tag} : rayon des têtes ${r.head} ≠ GAP × (R + PL) / 2 = ${r.want}`);
      check(Math.abs(r.ringOuter - r.head) < 1e-9, `${tag} : rayon extérieur des têtes creuses ${r.ringOuter} ≠ ${r.head}`);
      check(Math.abs(r.touch - .115) < 5e-4, `${tag} : contact dessiné à ${r.touch} rad (GAP = 0,115)`);
      check(Math.abs(r.sent - r.sentWant) < 1e-9, `${tag} : sentinelle, bout + tige = ${r.sent} px ≠ SENT_PAD × RS = ${r.sentWant}`);
      if (tag === '390x844') {
        const um = r.ref.umap.filter(x => x[0] >= 0), dm = Math.max(...um.map(([u, v]) => { const k = UREF_U.indexOf(u); return k < 0 ? 1 : Math.abs(v - UREF_V[k]); }));
        check(dm < 1e-4, `${tag} : UREF diffère de la carte u → rayon / RS de la mise en page (écart ${dm})`);
        check(Math.abs(r.ref.head - HEAD_REF_V) < 1e-5, `${tag} : HEAD_REF = ${HEAD_REF_V} ≠ HEAD / RS = ${r.ref.head}`);
        check(Math.abs(r.ref.pad - PAD_HEAD_V) < 1e-5, `${tag} : SENT_PAD_HEAD = ${PAD_HEAD_V} ≠ (SENT_HW + HEAD) / RS = ${r.ref.pad}`);
      }
      const hs = r.headSent, ref = tag === '390x844';
      check(hs.n > 1500 && hs.headHits > 50, `${tag} : tête contre sentinelle, échantillon trop maigre (${hs.n} lancers, ${hs.headHits} interceptions par la tête)`);
      check(hs.overlap <= (ref ? .1 : 2), `${tag} : tête dessinée sur une sentinelle sans interception, recouvrement ${hs.overlap.toFixed(3)} px (≤ ${ref ? .1 : 2})`);
      check(hs.gapAtHit <= (ref ? .3 : 1), `${tag} : interception par la tête avec ${hs.gapAtHit.toFixed(3)} px d'écart dessiné (≤ ${ref ? .3 : 1})`);
      console.log(`${tag} : tête/sentinelle, ${hs.n} lancers, ${hs.hits} interceptions dont ${hs.headHits} par la tête ; recouvrement sans interception ${hs.overlap.toFixed(3)} px, écart à l'interception ${hs.gapAtHit.toFixed(3)} px`);
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
