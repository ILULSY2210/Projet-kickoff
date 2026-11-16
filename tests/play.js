// Jeu accéléré dans la vraie page (Chromium + Playwright) : mesures de gameplay de l'étape 1.
//   node tests/play.js [--only=doubletap,vol,predicteur] [--out=dossier]
// Sections :
//   doubletap  : après un tir sûr, un second tap 8 ms plus tard par tap() (rebond, deux doigts) : 0 mort sur 40
//                aux niveaux 1, 2, 3, 8, 21 et au premier niveau à sentinelle.
//   vol        : un second tap 60 à 200 ms après le premier part à son instant exact ; jamais plus de deux aiguilles
//                en vol (rafales de taps, appels directs de throwPin()).
//   predicteur : le prédicteur honnête (__botSafe) finit les niveaux 1..300, 4 parties chacun, à dt 1/60 et 1/120 :
//                0 mort, 0 blocage (niveau fini en moins de 75 s de jeu).
//   traversantes : niveaux 1..300, au départ puis après 2 et 4 aiguilles du prédicteur : part du bord allumé où un
//                atterrissage serait mortel = 0 % (échantillonnage tous les 0,001 rad) ; chaque étoile a un angle de
//                capture sûr.
// Les taps passent par la vraie couche d'entrée (tap(ts)) ; la boucle est pilotée par une horloge virtuelle à 60 Hz
// (requestAnimationFrame et performance.now remplacés avant le chargement de la page).
// Écrit <out>/summary.json ({ pass, sections }) et sort avec le code 1 en cas d'échec.
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const opt = k => { const a = args.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : null; };
const URL = 'file://' + path.join(ROOT, 'index.html');
const OUT = path.resolve(opt('out') || path.join(ROOT, 'tests', 'out', 'play'));
const ONLY = opt('only') ? opt('only').split(',') : null;
const want = s => !ONLY || ONLY.includes(s);
fs.mkdirSync(OUT, { recursive: true });
const results = {}, errors = [];
function section(name) {
  const r = { checks: 0, fails: [], notes: {} };
  results[name] = r;
  return { ok(c, m) { r.checks++; if (!c) r.fails.push(m); return !!c; }, note(k, v) { r.notes[k] = v; } };
}
// horloge virtuelle : la page ne voit le temps avancer que lorsque le test le décide
const VCLOCK = () => {
  let vnow = 0;
  performance.now = () => vnow;
  window.__vraf = [];
  window.requestAnimationFrame = cb => { window.__vraf.push(cb); return window.__vraf.length; };
  window.__frame = now => { vnow = now; const q = window.__vraf; window.__vraf = []; for (const cb of q) cb(now); };
  window.__at = now => { vnow = now; };
  window.__now = () => vnow;
};
// aides installées dans la page
const HELPERS = () => {
  soundOn = false;
  // une image sur six est dessinée : le rendu reste exercé (erreurs détectées) sans dominer la durée du test
  const od = window.draw; let k = 0;
  window.draw = function (dt) { if (++k % 6 === 0) od(dt); };
  window.__fps = 60;
  window.__next = () => __frame(__now() + 1000 / __fps);
  window.__run = sec => { const n = Math.round(sec * __fps); for (let i = 0; i < n; i++) __next(); };
  // tap au temps virtuel T (ms), entre deux images
  window.__tapAt = T => { __at(T); tap(T); };
  // premier instant (ms, après maintenant + d) où un tap partirait en sécurité ; avance les images au besoin
  window.__safeTap = (d, maxSec) => {
    for (let i = 0; i < maxSec * __fps; i++) {
      const T = __now() + d, tS = tapInstant(T, T, t, simWall);
      if (state === 'play' && window.__botSafe(tS)) return T;
      __next();
    }
    return -1;
  };
};
async function page(b) {
  // rendu à DPR 1 : les images sont dessinées (erreurs de rendu détectées) sans le coût d'un écran Retina logiciel
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const p = await c.newPage();
  p.on('pageerror', e => errors.push('pageerror: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await p.addInitScript(VCLOCK);
  await p.goto(URL);
  await p.evaluate(() => { for (let i = 0; i < 3; i++) __frame(__now() + 16); });
  await p.waitForFunction(() => typeof state !== 'undefined' && state === 'menu');
  await p.evaluate(HELPERS);
  return [c, p];
}

async function doubletap(b) {
  const S = section('doubletap');
  const [c, p] = await page(b);
  const res = await p.evaluate(() => {
    const out = {};
    let nSent = 1; while (!makeLevel(nSent).sents.length) nSent++;
    for (const n of [1, 2, 3, 8, 21, nSent]) {
      let dead = 0, done = 0;
      for (let k = 0; k < 40; k++) {
        startLevel(n); __run(.6 + (k % 10) * .137);
        const T = __safeTap(1 + (k * 7) % 15, 6);
        if (T < 0) continue;
        const before = L.throws - left;
        __tapAt(T); __tapAt(T + 8);
        const thrown = L.throws - left - before;
        __run(.35);
        done++;
        if (state === 'dying' || state === 'failed') dead++;
        if (thrown !== 1) dead += 100;   // un seul lancer attendu
      }
      out[n] = { dead, done };
    }
    showMenu();
    return out;
  });
  for (const n in res) S.ok(res[n].done === 40 && res[n].dead === 0, `niveau ${n} : ${res[n].dead} mort(s) sur ${res[n].done} doubles taps à 8 ms`);
  S.note('morts', Object.entries(res).map(([n, r]) => `${n}: ${r.dead}/${r.done}`).join(', '));
  await c.close();
}

async function vol(b) {
  const S = section('vol');
  const [c, p] = await page(b);
  const r = await p.evaluate(() => {
    const o = { exact: [], maxFl: 0, burst: 0, direct: 0 };
    const orig = window.launch, log = [];
    window.launch = function (tL) { log.push(tL); return orig(tL); };
    const watch = sec => { const n = Math.round(sec * __fps); for (let i = 0; i < n; i++) { __next(); o.maxFl = Math.max(o.maxFl, flights.length); } };
    // second tap 60 à 200 ms après le premier : il part à son instant exact, même si le premier vole encore
    for (const d of [60, 75, 90, 105, 120, 140, 160, 180, 200]) for (const n of [1, 6, 22]) {
      startLevel(n); __run(.5);
      const T = __safeTap(3, 6); if (T < 0) { o.exact.push({ n, d, err: 'pas de fenêtre' }); continue; }
      log.length = 0;
      __tapAt(T);
      // les images passent jusqu'au second tap
      while (__now() + 1000 / __fps < T + d) { __next(); o.maxFl = Math.max(o.maxFl, flights.length); }
      if (state === 'play') { __tapAt(T + d); watch(.3); }
      if (log.length === 2) o.exact.push({ n, d, err: Math.abs((log[1] - log[0]) - d / 1000) * 1000 });
      else if (log.length === 1 && state !== 'play') o.exact.push({ n, d, err: 0, note: 'fin avant le second tap' });
      else o.exact.push({ n, d, err: 'lancers : ' + log.length });
    }
    // rafale de taps espacés de 41 ms : jamais plus de deux aiguilles en vol
    startLevel(24); __run(.5);
    let T = __now() + 2;
    for (let i = 0; i < 8 && state === 'play'; i++) { __tapAt(T); T += 41; while (__now() + 1000 / __fps < T && state === 'play') { __next(); o.burst = Math.max(o.burst, flights.length); } }
    // appels directs : trois throwPin() au même instant
    startLevel(24); __run(.5);
    throwPin(); throwPin(); throwPin();
    o.direct = flights.length;
    window.launch = orig;
    showMenu();
    return o;
  });
  const bad = r.exact.filter(x => typeof x.err !== 'number' || x.err > 1e-6);
  S.ok(bad.length === 0, `second tap à son instant exact : ${r.exact.length - bad.length}/${r.exact.length} ${bad.length ? JSON.stringify(bad.slice(0, 3)) : ''}`);
  S.ok(r.maxFl <= 2 && r.burst <= 2 && r.direct <= 2, `aiguilles en vol au plus : ${r.maxFl} (taps), ${r.burst} (rafale à 41 ms), ${r.direct} (trois throwPin())`);
  S.ok(r.burst === 2, `la rafale fait bien voler deux aiguilles à la fois (${r.burst})`);
  await c.close();
}

async function predicteur(b) {
  const S = section('predicteur');
  const [c, p] = await page(b);
  for (const dt of [1 / 60, 1 / 120]) {
    const r = await p.evaluate(({ dt, N }) => {
      const out = { deaths: [], blocks: [], times: [] };
      for (let n = 1; n <= N; n++) for (let g = 0; g < 4; g++) {
        let x = n * 977 + g * 131 + 7;
        const rnd = () => (x = (x * 16807) % 2147483647) / 2147483647;
        startLevel(n);
        let T = 0, cool = g * .29;
        while (T < 75) {
          if (cool <= 0 && state === 'play' && !flying && left > 0 && window.__botSafe()) { throwPin(); cool = g ? rnd() * .35 : 0; }
          update(dt); T += dt; cool -= dt;
          if (state !== 'play') break;
        }
        if (state === 'dying' || state === 'failed') out.deaths.push(n + '/' + g);
        else if (state === 'play') out.blocks.push(n + '/' + g);
        out.times.push(T);
      }
      showMenu();
      return { deaths: out.deaths, blocks: out.blocks, maxT: Math.max(...out.times), meanT: out.times.reduce((a, b) => a + b, 0) / out.times.length };
    }, { dt, N: 300 });
    const tag = dt === 1 / 60 ? '1/60' : '1/120';
    S.ok(r.deaths.length === 0, `dt ${tag} : ${r.deaths.length} mort(s) sur 800 parties ${r.deaths.slice(0, 8).join(' ')}`);
    S.ok(r.blocks.length === 0, `dt ${tag} : ${r.blocks.length} blocage(s) sur 800 parties ${r.blocks.slice(0, 8).join(' ')}`);
    S.note('dt_' + tag, { duree_max_s: +r.maxT.toFixed(1), duree_moyenne_s: +r.meanT.toFixed(2) });
  }
  await c.close();
}

async function traversantes(b) {
  const S = section('traversantes');
  const [c, p] = await page(b);
  const r = await p.evaluate(() => {
    const o = { lit: 0, deadly: [], travLit: 0, stars: 0, noCapture: [] };
    const scan = (n, when) => {
      const arcs = litArcs();
      for (const [a0, a1] of arcs) for (let x = a0 + .0005; x < a1; x += .001) {
        o.lit++; if (L.trav) o.travLit++;
        if (landing(x).d < GAP) { o.deadly.push(n + '/' + when + '@' + x.toFixed(3)); if (o.deadly.length > 50) return; }
      }
    };
    for (let n = 1; n <= 300; n++) {
      startLevel(n);
      scan(n, 0);
      for (const st of L.orbs) {
        o.stars++;
        let ok = false;
        for (let x = st.a - ORBHIT + .0005; x < st.a + ORBHIT && !ok; x += .001) if (landing(x).d >= GAP) ok = true;
        if (!ok) o.noCapture.push(n);
      }
      // après 2 puis 4 aiguilles du prédicteur
      for (const k of [2, 4]) {
        for (let i = 0; i < 60 * 30 && state === 'play' && (L.throws - left < k || flights.length); i++) {
          if (!flying && L.throws - left < k && window.__botSafe()) throwPin();
          update(1 / 60);
        }
        if (state !== 'play') break;
        arcsDirty = true; scan(n, k);
      }
    }
    showMenu();
    return o;
  });
  S.ok(r.deadly.length === 0, `bord allumé mortel : ${r.deadly.length} échantillon(s) sur ${r.lit} (${r.travLit} sur les niveaux à traversantes) ${r.deadly.slice(0, 6).join(' ')}`);
  S.ok(r.noCapture.length === 0, `étoiles sans angle de capture sûr : ${r.noCapture.length} sur ${r.stars} (niveaux ${r.noCapture.join(', ')})`);
  S.note('echantillons_allumes', r.lit);
  S.note('dont_traversantes', r.travLit);
  S.note('etoiles', r.stars);
  await c.close();
}

(async () => {
  const b = await chromium.launch();
  try {
    if (want('doubletap')) await doubletap(b);
    if (want('vol')) await vol(b);
    if (want('predicteur')) await predicteur(b);
    if (want('traversantes')) await traversantes(b);
  } catch (e) { errors.push('harness: ' + (e && e.stack || e)); }
  await b.close();
  const fails = Object.entries(results).flatMap(([k, r]) => r.fails.map(f => `[${k}] ${f}`));
  const summary = { pass: errors.length === 0 && fails.length === 0 && Object.keys(results).length > 0, fails, errors, sections: results };
  fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(summary, null, 2));
  for (const [k, r] of Object.entries(results)) console.log(`${r.fails.length ? 'ÉCHEC' : 'ok   '} ${k} : ${r.checks - r.fails.length}/${r.checks}  ${JSON.stringify(r.notes)}`);
  for (const f of fails) console.log('  - ' + f);
  for (const e of errors) console.log('  ! ' + e);
  console.log(summary.pass ? 'play : pass' : 'play : FAIL');
  process.exit(summary.pass ? 0 : 1);
})();
