// Tests d'interface d'Orbita (Chromium + Playwright).
//   node tests/ui.js [index.html] [--only=smoke,...] [--out=dossier]
// Sections :
//   smoke : chaque bouton visible de chaque écran est cliqué, Espace / Entrée / P / Échap dans chaque état,
//           son basculé, case de niveau, visibilitychange ; 0 erreur console ou page et état attendu après chaque action.
// Écrit <out>/summary.json ({ pass, sections, errors }) et sort avec le code 1 en cas d'échec.
const { chromium, devices } = require('playwright');
const path = require('path'), fs = require('fs');
const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const opt = k => { const a = args.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : null; };
const HTML = path.resolve(args.find(a => !a.startsWith('--')) || path.join(ROOT, 'index.html'));
const URL = 'file://' + HTML;
const OUT = path.resolve(opt('out') || path.join(ROOT, 'tests', 'out', 'ui'));
const ONLY = opt('only') ? opt('only').split(',') : null;
fs.mkdirSync(OUT, { recursive: true });

const results = {}, errors = [];
function hook(p, tag) {
  p.on('pageerror', e => errors.push(`[${tag}] pageerror: ${e.message}`));
  p.on('console', m => { if (m.type() === 'error') errors.push(`[${tag}] console: ${m.text()}`); });
}
// petit registre de vérifications par section
function section(name) {
  const r = { checks: 0, fails: [] };
  results[name] = r;
  return {
    ok(cond, msg) { r.checks++; if (!cond) r.fails.push(msg); return !!cond; },
    eq(a, b, msg) { r.checks++; if (a !== b) r.fails.push(`${msg} : attendu ${JSON.stringify(b)}, obtenu ${JSON.stringify(a)}`); return a === b; },
    note(k, v) { (r.notes = r.notes || {})[k] = v; }
  };
}
const want = s => !ONLY || ONLY.includes(s);

// aides exécutées dans la page ---------------------------------------------------------------
// jouer vite jusqu'à la victoire avec le prédicteur honnête
const fastWin = p => p.evaluate(() => {
  for (let i = 0; i < 60 * 120; i++) {
    if (state === 'play' && !flying && left > 0 && window.__botSafe()) throwPin();
    update(1 / 60);
    if (state === 'won' || state === 'failed') break;
  }
  return state;
});
// échouer de façon déterministe : tirer quand le point d'impact prévu tombe sur une aiguille déjà plantée
const fastFail = p => p.evaluate(() => {
  const landing = () => typeof predict === 'function' ? predict(t).a : norm(HPI - predictRot((LAUNCH - (cy + R)) / FLYV));
  for (let i = 0; i < 60 * 120; i++) {
    if (state === 'play' && !flying && left > 0) {
      const a = landing();
      if (stuck.some(s => angDiff(s.a, a) < GAP * .4)) throwPin();
      else if (!stuck.length && window.__botSafe()) throwPin();
    }
    update(1 / 60);
    if (state === 'failed' || state === 'won') break;
  }
  return state;
});
const st = p => p.evaluate(() => state);
const visibleButtons = p => p.evaluate(() => [...document.querySelectorAll('button')].filter(b => {
  const r = b.getBoundingClientRect(), cs = getComputedStyle(b);
  return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && b.offsetParent !== null;
}).map(b => b.id || (b.classList.contains('lv') ? 'lv' : b.className)));

async function smoke(b) {
  const S = section('smoke');
  const c = await b.newContext({ ...devices['iPhone 13'] });
  const p = await c.newPage(); hook(p, 'smoke');
  await p.goto(URL);
  await p.waitForFunction(() => typeof state !== 'undefined' && state === 'menu', null, { timeout: 10000 });
  await p.waitForTimeout(300);
  const tested = new Set();
  const seen = {};
  const look = async scr => { for (const id of await visibleButtons(p)) { (seen[scr] = seen[scr] || new Set()).add(id); } };
  const click = async (sel, expect, msg) => {
    tested.add(sel.startsWith('#') ? sel.slice(1) : 'lv');
    await p.click(sel); await p.waitForTimeout(60);
    const s = await st(p);
    S.eq(s, expect, `${msg || sel} → état`);
    return s;
  };
  // menu
  await look('menu');
  const snd0 = await p.evaluate(() => soundOn);
  await click('#soundBtn', 'menu', 'SON (1)');
  S.eq(await p.evaluate(() => soundOn), !snd0, 'SON basculé');
  S.eq(await p.evaluate(() => JSON.parse(localStorage.getItem('orbita_sound'))), !snd0, 'SON sauvegardé');
  await click('#soundBtn', 'menu', 'SON (2)');
  S.eq(await p.evaluate(() => soundOn), snd0, 'SON rebasculé');
  await click('#levelsBtn', 'levels', 'NIVEAUX');
  await look('levels');
  await click('#levelsBack', 'menu', 'RETOUR');
  await click('#levelsBtn', 'levels', 'NIVEAUX (2)');
  await click('.lv[data-n="1"]', 'play', 'case niveau 1');
  S.eq(await p.evaluate(() => L.n), 1, 'case niveau 1 → niveau');
  await look('play');
  // pause
  await click('#hudBtn', 'pause', 'bouton pause');
  await look('pause');
  await click('#resumeBtn', 'play', 'REPRENDRE');
  await p.waitForTimeout(700);
  S.eq(await st(p), 'play', 'REPRENDRE → jeu après le compte à rebours');
  await click('#hudBtn', 'pause', 'bouton pause (2)');
  await click('#restartBtn', 'play', 'RECOMMENCER');
  await click('#hudBtn', 'pause', 'bouton pause (3)');
  await click('#pauseMenu', 'menu', 'MENU (pause)');
  // victoire
  await click('#playBtn', 'play', 'JOUER');
  S.eq(await fastWin(p), 'won', 'victoire niveau 1');
  await look('won');
  await click('#nextBtn', 'play', 'SUIVANT');
  S.eq(await p.evaluate(() => L.n), 2, 'SUIVANT → niveau 2');
  S.eq(await fastWin(p), 'won', 'victoire niveau 2');
  await click('#replayBtn', 'play', 'REJOUER');
  S.eq(await p.evaluate(() => L.n), 2, 'REJOUER → même niveau');
  S.eq(await fastWin(p), 'won', 'victoire niveau 2 (bis)');
  await click('#winMenu', 'menu', 'MENU (victoire)');
  // échec
  await click('#playBtn', 'play', 'CONTINUER');
  S.eq(await fastFail(p), 'failed', 'échec provoqué');
  await look('failed');
  await click('#retryBtn', 'play', 'RÉESSAYER');
  S.eq(await fastFail(p), 'failed', 'échec provoqué (2)');
  await click('#failMenu', 'menu', 'MENU (échec)');
  // relance d'un tap sur la feuille d'échec (hors bouton) et sur la scène
  await p.evaluate(() => startLevel(3));
  S.eq(await fastFail(p), 'failed', 'échec provoqué (3)');
  const kick = await p.$('#failKick'); const kb = await kick.boundingBox();
  await p.touchscreen.tap(kb.x + kb.width / 2, kb.y + kb.height / 2); await p.waitForTimeout(80);
  S.eq(await st(p), 'play', 'tap sur la feuille d\'échec → relance');
  S.eq(await fastFail(p), 'failed', 'échec provoqué (4)');
  await p.touchscreen.tap(200, 60); await p.waitForTimeout(80);
  S.eq(await st(p), 'play', 'tap sur la scène → relance');
  // clavier dans chaque état
  const setups = {
    menu: async () => { await p.evaluate(() => showMenu()); },
    levels: async () => { await p.evaluate(() => showLevels()); },
    play: async () => { await p.evaluate(() => startLevel(3)); await p.waitForTimeout(80); },
    pause: async () => { await p.evaluate(() => { startLevel(3); pauseGame(); }); },
    won: async () => { await p.evaluate(() => startLevel(1)); await fastWin(p); },
    failed: async () => { await p.evaluate(() => startLevel(3)); await fastFail(p); }
  };
  const expectKey = {
    menu: { Space: 'play', Enter: 'play', KeyP: 'menu', Escape: 'menu' },
    levels: { Space: 'levels', Enter: 'levels', KeyP: 'menu', Escape: 'menu' },
    play: { Space: 'play', Enter: 'play', KeyP: 'pause', Escape: 'pause' },
    pause: { Space: 'play', Enter: 'play', KeyP: 'play', Escape: 'play' },
    won: { Space: 'play', Enter: 'play', KeyP: 'won', Escape: 'won' },
    failed: { Space: 'play', Enter: 'play', KeyP: 'failed', Escape: 'failed' }
  };
  for (const s in setups) for (const k in expectKey[s]) {
    await setups[s]();
    S.eq(await st(p), s, `préparation ${s} (${k})`);
    await p.evaluate(() => document.activeElement && document.activeElement.blur && document.activeElement.blur());
    const before = await p.evaluate(() => ({ left, n: L ? L.n : 0 }));
    await p.keyboard.press(k); await p.waitForTimeout(60);
    const after = await p.evaluate(() => ({ s: state, left, n: L ? L.n : 0 }));
    S.eq(after.s, expectKey[s][k], `${k} dans « ${s} »`);
    if (s === 'play' && (k === 'Space' || k === 'Enter')) S.eq(after.left, before.left - 1, `${k} en jeu → une aiguille lancée`);
    if (s === 'won' && (k === 'Space' || k === 'Enter')) S.eq(after.n, before.n + 1, `${k} sur la victoire → niveau suivant`);
  }
  // visibilitychange : page masquée → pause ; de retour → toujours en pause
  await p.evaluate(() => startLevel(4)); await p.waitForTimeout(80);
  await p.evaluate(() => { Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
  S.eq(await st(p), 'pause', 'page masquée → pause');
  await p.evaluate(() => { Object.defineProperty(document, 'hidden', { value: false, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
  await p.waitForTimeout(100);
  S.eq(await st(p), 'pause', 'page de retour → reste en pause');
  // aucun bouton visible qui n'ait été actionné
  for (const scr in seen) for (const id of seen[scr]) S.ok(tested.has(id), `bouton visible non testé sur « ${scr} » : ${id}`);
  S.note('boutons', [...tested].sort().join(' '));
  await c.close();
}

(async () => {
  const b = await chromium.launch();
  try {
    if (want('smoke')) await smoke(b);
  } catch (e) { errors.push('harness: ' + (e && e.stack || e)); }
  await b.close();
  const fails = Object.entries(results).flatMap(([k, r]) => r.fails.map(f => `[${k}] ${f}`));
  const summary = { pass: errors.length === 0 && fails.length === 0 && Object.keys(results).length > 0, fails, errors, sections: results };
  fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(summary, null, 2));
  for (const [k, r] of Object.entries(results)) console.log(`${r.fails.length ? 'ÉCHEC' : 'ok   '} ${k} : ${r.checks - r.fails.length}/${r.checks}`);
  for (const f of fails) console.log('  - ' + f);
  for (const e of errors) console.log('  ! ' + e);
  console.log(summary.pass ? 'ui : pass' : 'ui : FAIL');
  process.exit(summary.pass ? 0 : 1);
})();
