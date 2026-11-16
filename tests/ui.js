// Tests d'interface d'Orbita (Chromium + Playwright).
//   node tests/ui.js [index.html] [--only=smoke,...] [--out=dossier]
// Sections :
//   smoke : chaque bouton visible de chaque écran est cliqué, Espace / Entrée / P / Échap dans chaque état,
//           son basculé, case de niveau, visibilitychange ; 0 erreur console ou page et état attendu après chaque action.
//   boot  : démarrage avec les domaines Google bloqués : state défini en < 1 s, aucune requête tierce, polices locales.
//   offline : second chargement sans réseau (service worker) en < 1 s.
//   update  : une nouvelle VERSION du service worker ne s'applique qu'au menu, jamais pendant un niveau.
//   guard   : script invalide ou bloqué → message « touche pour recharger » en ≤ 4 s, jamais d'écran noir muet.
// Écrit <out>/summary.json ({ pass, sections, errors }) et sort avec le code 1 en cas d'échec.
const { chromium, devices } = require('playwright');
const path = require('path'), fs = require('fs');
const { serve } = require('./lib/serve');
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

const waitMenu = (p, timeout = 10000) => p.waitForFunction(() => typeof state !== 'undefined' && state === 'menu' && window.__orbitaBooted, null, { timeout, polling: 10 });
async function poll(fn, timeout = 10000, step = 50) {
  const t0 = Date.now();
  for (;;) { const v = await fn(); if (v) return v; if (Date.now() - t0 > timeout) return v; await new Promise(r => setTimeout(r, step)); }
}
const swActivated = p => p.evaluate(async () => {
  const r = await navigator.serviceWorker.ready;
  if (r.active.state !== 'activated') await new Promise(res => r.active.addEventListener('statechange', () => r.active.state === 'activated' && res()));
  return r.active.state;
});

async function boot(b) {
  const S = section('boot');
  for (const mode of ['file', 'http']) {
    const s = mode === 'http' ? await serve(ROOT) : null;
    const c = await b.newContext({ ...devices['iPhone 13'] });
    await c.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    const p = await c.newPage(); hook(p, 'boot-' + mode);
    const reqs = [];
    p.on('request', r => reqs.push(r.url()));
    const t0 = Date.now();
    await p.goto(s ? s.url : URL, { waitUntil: 'commit' });
    await waitMenu(p, 5000);
    const dt = Date.now() - t0;
    S.ok(dt < 1000, `${mode} : state défini en ${dt} ms (< 1000)`);
    S.note('demarrage_' + mode + '_ms', dt);
    const fams = await p.evaluate(() => document.fonts.ready.then(() => [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family.replace(/"/g, '') + ' ' + f.weight)));
    S.ok(fams.includes('B612 Mono 400') && fams.includes('B612 400'), `${mode} : polices B612 locales chargées (${fams.join(', ')})`);
    await p.waitForTimeout(300);
    const third = reqs.filter(u => /googleapis|gstatic/.test(u));
    S.eq(third.length, 0, `${mode} : requêtes vers Google`);
    const foreign = reqs.filter(u => !(s ? u.startsWith(s.url) : u.startsWith('file://')) && !u.startsWith('data:'));
    S.eq(foreign.join(' '), '', `${mode} : requêtes hors du jeu`);
    await c.close();
    if (s) await s.close();
  }
}

async function offline(b) {
  const S = section('offline');
  const s = await serve(ROOT);
  const c = await b.newContext({ ...devices['iPhone 13'] });
  const p = await c.newPage(); hook(p, 'offline');
  await p.goto(s.url); await waitMenu(p);
  S.eq(await swActivated(p), 'activated', 'service worker activé après la première visite');
  S.eq((await p.evaluate(() => caches.keys())).join(' '), await p.evaluate(() => 'orbita-v' + [...document.scripts].map(x => x.src).find(x => /\?v=/.test(x)).split('?v=')[1]), 'un seul cache, celui de la version');
  await s.close();   // plus de serveur : seul le service worker peut répondre
  const t0 = Date.now();
  await p.reload({ waitUntil: 'commit' });
  await waitMenu(p, 5000);
  const dt = Date.now() - t0;
  S.ok(dt < 1000, `second chargement hors ligne en ${dt} ms (< 1000)`);
  S.note('hors_ligne_ms', dt);
  S.ok(await p.evaluate(() => !!navigator.serviceWorker.controller), 'page contrôlée par le service worker');
  S.ok(await p.evaluate(() => document.fonts.ready.then(() => document.fonts.check('12px "B612 Mono"'))), 'polices disponibles hors ligne');
  await p.click('#playBtn'); await p.waitForTimeout(100);
  S.eq(await st(p), 'play', 'on joue hors ligne');
  await c.close();
}

async function update(b) {
  const S = section('update');
  const s = await serve(ROOT);
  const swSrc = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  const ver = /const VERSION = '([^']+)'/.exec(swSrc)[1], ver2 = ver + '-essai';
  const c = await b.newContext({ ...devices['iPhone 13'] });
  const p = await c.newPage(); hook(p, 'update');
  await p.goto(s.url); await waitMenu(p); await swActivated(p);
  await p.reload(); await waitMenu(p);
  S.ok(await p.evaluate(() => !!navigator.serviceWorker.controller), 'page contrôlée');
  await p.evaluate(() => { startLevel(3); window.__marque = 42; });
  s.override('/sw.js', { body: swSrc.replace(`'${ver}'`, `'${ver2}'`) });
  await p.evaluate(() => navigator.serviceWorker.getRegistration().then(r => r.update()));
  const waiting = await poll(() => p.evaluate(() => navigator.serviceWorker.getRegistration().then(r => !!r.waiting)));
  S.ok(waiting, 'nouvelle version installée et en attente');
  await p.waitForTimeout(800);
  S.eq(await p.evaluate(() => window.__marque), 42, 'aucun rechargement pendant le niveau');
  S.eq(await st(p), 'play', 'toujours en jeu');
  S.eq((await p.evaluate(() => caches.keys())).sort().join(' '), [ver, ver2].sort().join(' '), 'les deux versions coexistent tant que le joueur est en jeu');
  await p.evaluate(() => pauseGame());
  await p.waitForTimeout(500);
  S.eq(await p.evaluate(() => window.__marque), 42, 'aucun rechargement en pause');
  const nav = p.waitForEvent('load', { timeout: 10000 }).then(() => true, () => false);
  await p.click('#pauseMenu');
  S.ok(await nav, 'rechargement au retour au menu');
  await waitMenu(p);
  S.eq(await p.evaluate(() => window.__marque), undefined, 'page rechargée');
  S.eq((await p.evaluate(() => caches.keys())).join(' '), ver2, 'seul le cache de la nouvelle version reste');
  await c.close(); await s.close();
}

async function guard(b) {
  const S = section('guard');
  const cases = [
    ['script invalide', '/js/core.js', { body: 'ceci n\'est pas du ( javascript' }, 4000],
    ['script bloqué', '/js/render.js', { delay: 6000 }, 4000]
  ];
  for (const [name, file, ov, lim] of cases) {
    const s = await serve(ROOT); s.override(file, ov);
    const c = await b.newContext({ ...devices['iPhone 13'] });
    const p = await c.newPage();   // erreurs attendues : pas de hook
    const t0 = Date.now();
    await p.goto(s.url, { waitUntil: 'commit' });
    const el = await p.waitForSelector('#bootFail', { timeout: 6000 }).catch(() => null);
    const dt = el ? Math.round(await p.evaluate(() => window.__orbitaBootFailAt)) : Date.now() - t0;   // depuis l'ouverture de la page
    S.ok(!!el && dt <= lim, `${name} : message affiché en ${dt} ms (≤ ${lim})`);
    if (el) {
      const txt = (await el.innerText()).toUpperCase();
      S.ok(/PAS D.MARR/.test(txt) && /TOUCHE POUR RECHARGER/.test(txt), `${name} : texte du message (${txt.replace(/\s+/g, ' ')})`);
      await p.screenshot({ path: path.join(OUT, 'guard-' + file.replace(/\W/g, '') + '.png') });
    }
    if (ov.delay) {
      await waitMenu(p, 8000).catch(() => {});
      S.ok(await p.evaluate(() => !document.getElementById('bootFail') && state === 'menu'), `${name} : le message disparaît si le jeu finit par démarrer`);
    } else {
      s.clear();
      const nav = p.waitForEvent('load', { timeout: 5000 }).then(() => true, () => false);
      await p.click('#bootFail');
      S.ok(await nav, `${name} : toucher le message recharge la page`);
      await waitMenu(p).catch(() => {});
      S.eq(await st(p).catch(() => null), 'menu', `${name} : après correction, le rechargement démarre le jeu`);
    }
    await c.close(); await s.close();
  }
}

(async () => {
  const b = await chromium.launch();
  try {
    if (want('smoke')) await smoke(b);
    if (want('boot')) await boot(b);
    if (want('offline')) await offline(b);
    if (want('update')) await update(b);
    if (want('guard')) await guard(b);
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
