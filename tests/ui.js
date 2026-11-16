// Tests d'interface d'Orbita (Chromium + Playwright).
//   node tests/ui.js [index.html] [--only=smoke,...] [--out=dossier]
// Sections :
//   smoke : chaque bouton visible de chaque écran est cliqué, Espace / Entrée / P / Échap dans chaque état,
//           son basculé, case de niveau, visibilitychange ; 0 erreur console ou page et état attendu après chaque action.
//   migration : vraies clés de la version 1 posées avant le chargement : unlocked 150 → 150, aucune étoile, legacyStars =
//           ancien total, CONTINUER → niveau 1 ; valeurs corrompues (v1 et v2) sans erreur.
//   boot  : démarrage avec les domaines Google bloqués : state défini en < 1 s, aucune requête tierce, polices locales.
//   offline : second chargement sans réseau (service worker) en < 1 s.
//   update  : une nouvelle VERSION du service worker ne s'applique qu'au menu, jamais pendant un niveau.
//   guard   : script invalide ou bloqué → message « touche pour recharger » en ≤ 4 s, jamais d'écran noir muet.
//   ecrans  : sur 320×568, 360×640, 390×664, 390×844 et 430×932 : vol de 60 ± 1 ms ; un même journal de tirs donne les mêmes
//             issues et les mêmes angles à 1e-9 près ; pointe et tête dessinées croisent l'orbite des sentinelles et le
//             cercle des têtes à ± 1 ms de l'instant physique, centre de la tête compris (règle tête contre sentinelle).
//   tir     : lancer horodaté ; vrais taps à des phases aléatoires de l'image : départ à l'instant du tap à 1 ms près,
//             jamais avant le dernier instant simulé ; horodatage « depuis 1970 » et événement en retard bien traités.
//   reprendre : REPRENDRE → compte à rebours de 0,6 s (rotation figée, taps ignorés, throwPin() et __botSafe() inertes,
//               en 320×568 aucun bandeau d’intro sous l’anneau 3-2-1),
//               puis le jeu reprend.
//   echec   : sur 5 écrans : feuille d'échec à 0,45 s ; tap (et Espace) à 0,3 s ignoré, tap à 0,5 s → relance ;
//             tirs ignorés 250 ms après une relance par tap ; cause rappelée près du pas de tir après la relance ;
//             point de collision (aiguille, niveau 3) et sentinelle fautive (niveau 21) ≥ 4 px au-dessus du filet du
//             panneau ; MENU à droite ; HUD aligné sur la colonne de texte de la feuille ; aiguilles restantes annoncées =
//             aiguilles non plantées, avec une ou deux aiguilles en vol. Captures echec-*.png.
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
  S.eq(await p.evaluate(() => JSON.parse(localStorage.getItem('orbita_save')).settings.sfx), !snd0, 'SON sauvegardé');
  await click('#soundBtn', 'menu', 'SON (2)');
  S.eq(await p.evaluate(() => soundOn), snd0, 'SON rebasculé');
  await click('#levelsBtn', 'levels', 'NIVEAUX');
  await look('levels');
  // sections repliables : un clic sur l'en-tête d'un monde le déplie (et replie l'autre), un second clic le replie
  const sec = () => p.evaluate(() => [...document.querySelectorAll('.ws')].map(x => x.classList.contains('open') ? 1 : 0).join(''));
  S.eq(await sec(), '100000', 'NIVEAUX : seule la section du monde en cours est dépliée');
  tested.add('wsh');
  await p.click('.wsh[data-w="1"]'); await p.waitForTimeout(60);
  S.eq(await sec(), '010000', 'en-tête AMBRE → section dépliée, ÉMERAUDE repliée');
  S.eq(await p.evaluate(() => document.querySelectorAll('.ws.open .lv').length), 50, 'section dépliée : 50 cases');
  await p.click('.wsh[data-w="1"]'); await p.waitForTimeout(60);
  S.eq(await sec(), '000000', 'second clic → section repliée');
  await p.click('.wsh[data-w="0"]'); await p.waitForTimeout(60);
  S.eq(await sec(), '100000', 'en-tête ÉMERAUDE → section dépliée');
  S.eq(await st(p), 'levels', 'en-têtes de section : on reste sur NIVEAUX');
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

// vraies clés de la version 1 posées avant le chargement : migration, CONTINUER, valeurs corrompues
async function migration(b) {
  const S = section('migration');
  const cases = [
    ['v1 à 150', { orbita_unlocked: '150', orbita_stars: JSON.stringify({ 1: 3, 2: 2, 3: 3, 10: 1, 149: 2 }), orbita_sound: 'true' }],
    ['v1 corrompue', { orbita_unlocked: '"abc"', orbita_stars: '{', orbita_sound: '"oui"' }],
    ['v2 corrompue', { orbita_save: '{"v":2,"progress":{"unlocked":1e9},"levels":[1,2],"settings":5}' }]
  ];
  for (const [name, init] of cases) {
    const c = await b.newContext({ ...devices['iPhone 13'] });
    await c.addInitScript(kv => { if (!sessionStorage.getItem('__init')) { sessionStorage.setItem('__init', 1); for (const k in kv) localStorage.setItem(k, kv[k]); } }, init);
    const p = await c.newPage(); hook(p, 'migration-' + name);
    await p.goto(URL);
    await p.waitForFunction(() => typeof state !== 'undefined' && state === 'menu');
    const r = await p.evaluate(() => ({ unlocked, stars: Object.keys(bestStars).length, legacy: SAVE.legacyStars, go: continueLevel(), saved: JSON.parse(localStorage.getItem('orbita_save') || 'null') }));
    if (name === 'v1 à 150') {
      S.eq(r.unlocked, 150, `${name} : unlocked`);
      S.eq(r.stars, 0, `${name} : aucune étoile attribuée`);
      S.eq(r.legacy, 11, `${name} : legacyStars = ancien total`);
      S.ok(r.saved && r.saved.v === 2 && r.saved.progress.unlocked === 150, `${name} : sauvegarde v2 écrite`);
      await p.click('#playBtn'); await p.waitForTimeout(80);
      S.eq(await p.evaluate(() => state + '/' + L.n), 'play/1', `${name} : CONTINUER → niveau 1 (premier niveau d'apprentissage non fini)`);
      await p.evaluate(() => showLevels()); await p.waitForTimeout(80);
      S.eq(await p.evaluate(() => document.querySelectorAll('.lv:not([disabled])').length), 50, `${name} : grille ouverte (section Émeraude : 50 cases jouables)`);
      S.ok(/★ 11/.test(await p.evaluate(() => $('legacy').textContent)), `${name} : ancien total affiché sur NIVEAUX`);
      await p.screenshot({ path: path.join(OUT, 'migration-niveaux.png') });
    } else {
      S.ok(r.unlocked >= 1 && r.unlocked <= 100000 && Number.isInteger(r.unlocked), `${name} : unlocked valide (${r.unlocked})`);
      await p.click('#playBtn'); await p.waitForTimeout(80);
      S.eq(await st(p), 'play', `${name} : on joue`);
    }
    await c.close();
  }
}

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

const SCREENS = [[320, 568], [360, 640], [390, 664], [390, 844], [430, 932]];
async function ecrans(b) {
  const S = section('ecrans');
  const runs = [];
  for (const [w, h] of SCREENS) {
    const c = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const p = await c.newPage(); hook(p, 'ecrans-' + w + 'x' + h);
    await p.goto(URL);
    await p.waitForFunction(() => typeof state !== 'undefined' && state === 'menu');
    const r = await p.evaluate(() => {
      soundOn = false;
      const o = {};
      // durée du vol : pas de 0,1 ms jusqu'au contact
      startLevel(1); update(1);
      const n0 = stuck.length, t0 = t; throwPin();
      while (stuck.length === n0 && state === 'play') update(1e-4);
      o.vol = (t - t0) * 1000;
      // instants où la pointe et la tête dessinées croisent l'orbite des sentinelles et le cercle des têtes
      const ys = [0, 0], cross = (k, y, dy = 0) => { for (let i = 0; i <= 61000; i++) { const tau = i * 1e-6; pinYs(tau / FLIGHT, ys); if (ys[k] - dy <= y + 1e-6) return tau * 1000; } return -1; };
      // règle de la tête contre les sentinelles : instant où le centre de la tête passe sur l'orbite (ρ = 0)
      const pc = HEAD_PIECES.find(x => x.r0 >= 0 && x.r0 + x.k * (x.t1 - x.t0) <= 0), tC = pc ? (pc.t0 - pc.r0 / pc.k) * 1000 : -99;
      o.croise = {
        pointe_sentinelle: [cross(0, cy + RS), U.sent * FLIGHT * 1000],
        pointe_tetes: [cross(0, cy + R + PL + HEAD), U.head * FLIGHT * 1000],
        tete_sentinelle: [cross(1, cy + RS), (U.sent + U.len) * FLIGHT * 1000],
        centre_tete_sentinelle: [cross(1, cy + RS, HEAD), tC],
        tete_tetes: [cross(1, cy + R + PL + HEAD), (U.head + U.len) * FLIGHT * 1000],
        pointe_contact: [cross(0, cy + R), FLIGHT * 1000]
      };
      // même journal de tirs (numéros de pas depuis le début du niveau) sur plusieurs niveaux
      // continue, à-coups, sentinelle, traversantes
      const fst = (f, from) => { for (let n = from || 1; n < 400; n++) if (f(makeLevel(n))) return n; return 0; };
      o.jeux = [8, fst(l => l.pattern === 3), fst(l => l.sents.length > 0), fst(l => l.trav)].map(n => {
        startLevel(n);
        const journal = [70, 150, 230, 320, 400, 470, 560, 650, 720, 810, 900, 980];
        let j = 0;
        for (let k = 0; k < 12 * 120 && (state === 'play' || state === 'dying'); k++) {
          if (state === 'play' && j < journal.length && k >= journal[j]) { throwPin(); j++; }
          update(STEP);
        }
        return { n, state, angles: stuck.filter(s => !s.pre).map(s => s.a), fail: failInfo && failInfo.kind };
      });
      showMenu();
      return o;
    });
    const tag = w + 'x' + h;
    S.ok(Math.abs(r.vol - 60) <= 1, `${tag} : vol de ${r.vol.toFixed(2)} ms (60 ± 1)`);
    for (const k in r.croise) { const [d, ph] = r.croise[k]; S.ok(d >= 0 && Math.abs(d - ph) <= 1, `${tag} : ${k} dessinée à ${d.toFixed(3)} ms, physique ${ph.toFixed(3)} ms (± 1)`); }
    S.note('vol_' + tag, +r.vol.toFixed(2));
    runs.push([tag, r.jeux]);
    await c.close();
  }
  const [rt, ref] = runs[0];
  for (const [tag, jeux] of runs.slice(1)) jeux.forEach((g, i) => {
    const q = ref[i];
    S.eq(g.state + '/' + g.fail, q.state + '/' + q.fail, `niveau ${g.n} : issue en ${tag} comparée à ${rt}`);
    const d = g.angles.length === q.angles.length ? Math.max(0, ...g.angles.map((a, k) => Math.abs(a - q.angles[k]))) : Infinity;
    S.ok(d < 1e-9, `niveau ${g.n} : angles en ${tag} à ${d} de ${rt} (< 1e-9)`);
  });
  S.note('journal', ref.map(g => `niv ${g.n} : ${g.state}, ${g.angles.length} aiguilles`).join(' ; '));
}

async function tir(b) {
  const S = section('tir');
  const c = await b.newContext({ ...devices['iPhone 13'] });
  const p = await c.newPage(); hook(p, 'tir');
  await p.goto(URL);
  await p.waitForFunction(() => typeof state !== 'undefined' && state === 'menu');
  // chaque lancer est noté : instant de l'événement (ms), instant simulé du départ, et horloge globale correspondante
  await p.evaluate(() => {
    soundOn = false; window.__tirs = [];
    addEventListener('pointerdown', e => { window.__ts = e.timeStamp; }, true);
    const orig = window.launch;
    window.launch = function (tL) { window.__tirs.push({ ts: window.__ts, tL, t, E: time + (tL - t) }); window.__ts = undefined; return orig(tL); };
  });
  const rnd = (() => { let x = 12345; return () => (x = (x * 16807) % 2147483647) / 2147483647; })();
  // 1. événements émis à une phase aléatoire entre deux images (minuterie), datés à leur création comme un vrai tap
  let n = 0, bad = 0, past = 0, worst = 0;
  for (let i = 0; i < 24; i++) {
    await p.evaluate(() => startLevel(1));
    await p.waitForTimeout(60);
    await p.evaluate(ms => new Promise(res => requestAnimationFrame(() => setTimeout(() => {
      cvs.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerType: 'touch', isPrimary: true }));
      res();
    }, ms))), rnd() * 16);
    await p.waitForTimeout(30);
    const r = await p.evaluate(() => { const x = window.__tirs[window.__tirs.length - 1]; window.__tirs = []; return x ? { ...x, simWall, time } : null; });
    if (!r || r.ts === undefined) { bad++; continue; }
    n++;
    // à cadence réelle, l'horloge globale « time » avance comme l'horloge murale : (simWall − ts) doit valoir (time − E)
    worst = Math.max(worst, Math.abs((r.simWall - r.ts) / 1000 - (r.time - r.E)) * 1000);
    if (r.tL < r.t) past++;
  }
  S.ok(n === 24 && bad === 0, `taps à phase aléatoire lancés et notés : ${n}/24`);
  S.ok(worst <= 1, `départ à l'instant du tap à ${worst.toFixed(3)} ms près (≤ 1)`);
  // 2. vrais taps tactiles (souvent livrés en retard par le navigateur sans écran) : jamais de départ dans le passé
  let m = 0;
  for (let i = 0; i < 8; i++) {
    await p.evaluate(() => startLevel(1));
    await p.waitForTimeout(60 + Math.floor(rnd() * 17));
    await p.touchscreen.tap(195, 120);
    await p.waitForTimeout(30);
    const r = await p.evaluate(() => { const x = window.__tirs[window.__tirs.length - 1]; window.__tirs = []; return x || null; });
    if (!r) continue;
    m++; if (r.tL < r.t) past++;
  }
  S.ok(m === 8, `vrais taps lancés : ${m}/8`);
  S.eq(past, 0, 'lancers avant le dernier instant simulé');
  S.note('ecart_max_ms', +worst.toFixed(3));
  // horodatage « depuis 1970 » : remplacé par maintenant ; événement en retard : départ au dernier instant simulé
  const g = await p.evaluate(() => {
    startLevel(21); update(.5);
    const o = {};
    let now = performance.now(), exp = t + clamp((now - simWall) / 1000, 0, .1);
    tap(Date.now()); let x = window.__tirs.pop();
    o.epoch = x ? Math.abs(x.tL - exp) * 1000 : -1;
    startLevel(21); update(.5);
    lastTap = -1e9; tap(performance.now() - 300); x = window.__tirs.pop();
    o.late = x ? (x.tL - x.t) * 1000 : -1;
    showMenu();
    return o;
  });
  S.ok(g.epoch >= 0 && g.epoch < 5, `horodatage depuis 1970 : départ à ${g.epoch.toFixed(2)} ms de maintenant`);
  S.ok(g.late === 0, `événement en retard : départ au dernier instant simulé (écart ${g.late} ms)`);
  await c.close();
}

async function reprendre(b) {
  const S = section('reprendre');
  const c = await b.newContext({ ...devices['iPhone 13'] });
  const p = await c.newPage(); hook(p, 'reprendre');
  await p.goto(URL);
  await p.waitForFunction(() => typeof state !== 'undefined' && state === 'menu');
  for (const via of ['bouton', 'clavier']) {
    await p.evaluate(() => { soundOn = false; startLevel(8); });
    await p.waitForTimeout(500);
    await p.click('#hudBtn'); await p.waitForTimeout(150);
    S.eq(await st(p), 'pause', `${via} : pause`);
    // relevés pendant le compte à rebours : instant, phase, rotation, aiguilles restantes
    await p.evaluate(() => {
      window.__cd = { t0: 0, end: 0, rots: [], phases: [] };
      const od = window.draw;
      window.draw = function (dt) { const w = window.__cd; if (w.t0 && !w.end && state === 'play') { if (playPhase === 'compte' && !w.seen) { w.seen = true; w.f0 = last; } if (w.seen) { w.rots.push(rot); if (playPhase === 'jeu') w.end = last; } } od(dt); };
      window.__cdRestore = () => { window.draw = od; };
    });
    if (via === 'bouton') { await p.evaluate(() => { window.__cd.t0 = performance.now(); }); await p.click('#resumeBtn'); }
    else { await p.evaluate(() => { document.activeElement && document.activeElement.blur && document.activeElement.blur(); window.__cd.t0 = performance.now(); }); await p.keyboard.press('Space'); }
    await p.waitForTimeout(120);
    const mid = await p.evaluate(() => ({ s: state, ph: playPhase, left }));
    S.eq(mid.s + '/' + mid.ph, 'play/compte', `${via} : état pendant le compte à rebours`);
    if (via === 'bouton') await p.screenshot({ path: path.join(OUT, 'reprendre-compte.png') });
    await p.touchscreen.tap(195, 120); await p.waitForTimeout(40);
    const inert = await p.evaluate(() => { const a = window.__botSafe(); throwPin(); return { safe: a, left, fl: flights.length }; });
    S.eq(inert.left, mid.left, `${via} : tap et throwPin() ignorés pendant le compte à rebours`);
    S.eq(inert.safe, false, `${via} : __botSafe() faux pendant le compte à rebours`);
    await p.waitForTimeout(650);
    const r = await p.evaluate(() => { const w = window.__cd; window.__cdRestore(); return { s: state, ph: playPhase, dur: w.end - w.f0, frozen: w.rots.slice(0, -1).every(x => x === w.rots[0]), n: w.rots.length }; });
    S.eq(r.s + '/' + r.ph, 'play/jeu', `${via} : le jeu reprend après le compte à rebours`);
    S.ok(r.dur > 570 && r.dur < 660, `${via} : compte à rebours de ${Math.round(r.dur)} ms d'image en image (0,6 s)`);
    S.ok(r.frozen && r.n > 20, `${via} : rotation figée pendant le compte à rebours (${r.n} images)`);
    const after = await p.evaluate(() => { const l = left; throwPin(); return l - left; });
    S.eq(after, 1, `${via} : throwPin() relance après le compte à rebours`);
  }
  await c.close();
  // pause pendant un bandeau d'intro (monde, niveau, boss) en 320×568 : pendant le compte à rebours, aucun texte dessiné
  // ne chevauche l'anneau 3-2-1 ; le bandeau reprend ensuite là où il s'était arrêté
  const c2 = await b.newContext({ viewport: { width: 320, height: 568 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p2 = await c2.newPage(); hook(p2, 'reprendre-320');
  await p2.goto(URL);
  await p2.waitForFunction(() => typeof state !== 'undefined' && state === 'menu');
  for (const [n, wait] of [[51, 1500], [15, 700], [101, 1500]]) {
    await p2.evaluate(n => { soundOn = false; showMenu(); startLevel(n); }, n);
    await p2.waitForTimeout(wait);
    await p2.evaluate(() => {
      pauseGame(); resumeGame();
      window.__ov = { boxes: [], frames: 0, pending: wIntro > 0 || intro > 0 };
      const ov = window.vtext;
      window.vtext = function (c, str, x, y, h, al) {
        const x0 = x - (al ? vwidth(str, h) * al : 0);
        if (state === 'play' && playPhase === 'compte' && c === ctx) window.__ov.boxes.push({ str, x0, y0: y, x1: x0 + vwidth(str, h), y1: y + h });
        return ov.apply(this, arguments);
      };
      window.__ovRestore = () => { window.vtext = ov; };
    });
    await p2.waitForTimeout(300);
    const o = await p2.evaluate(() => {
      const w = window.__ov; window.__ovRestore();
      const rr = 15, yc = LAUNCH - rr - 12, ring = { x0: cx - rr - 3, y0: yc - rr - 3, x1: cx + rr + 3, y1: yc + rr + 3 };
      const hit = w.boxes.filter(b => !/^[123]$/.test(b.str) && b.x0 < ring.x1 && b.x1 > ring.x0 && b.y0 < ring.y1 && b.y1 > ring.y0);
      return { pending: w.pending, n: w.boxes.length, hit: [...new Set(hit.map(b => b.str))], ph: playPhase, still: wIntro > 0 || intro > 0 };
    });
    S.ok(o.pending, `320×568, niveau ${n} : bandeau en cours au moment de la pause`);
    S.ok(o.n > 0 && !o.hit.length, `320×568, niveau ${n} : aucun texte sous l'anneau du compte à rebours (${o.hit.join(' | ') || 'aucun'})`);
    S.ok(o.ph === 'compte' && o.still, `320×568, niveau ${n} : bandeau gardé pour après le compte à rebours`);
  }
  await c2.close();
}

async function echec(b) {
  const S = section('echec');
  for (const [w, h] of SCREENS) {
    const tag = w + 'x' + h;
    const c = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const p = await c.newPage(); hook(p, 'echec-' + tag);
    await p.goto(URL);
    await p.waitForFunction(() => typeof state !== 'undefined' && state === 'menu');
    const r = await p.evaluate(async () => {
      const frame = () => new Promise(res => requestAnimationFrame(() => res()));
      const until = async cond => { for (let i = 0; i < 1200 && !cond(); i++) await frame(); return cond(); };
      const sleep = ms => new Promise(res => setTimeout(res, ms));
      const tapNow = () => cvs.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerType: 'touch', isPrimary: true }));
      const o = {};
      soundOn = false; lastTap = -1e9;
      startLevel(3);
      // échec déterministe : tir quand l'impact prévu tombe sur une aiguille
      let tFail = 0;
      await until(() => {
        if (state === 'play' && !flying && left > 0 && stuck.some(s => angDiff(s.a, predict(t).a) < GAP * .4)) throwPin();
        if (state === 'dying' && !tFail) tFail = performance.now() - dieT * 1000;
        return state === 'dying';
      });
      await until(() => dieT >= .3);
      o.d03 = dieT; tapNow(); await sleep(20);
      o.s03 = state;
      document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true })); await sleep(20);
      o.k03 = state;
      await until(() => state === 'failed');
      o.sheet = dieT;
      while (performance.now() - tFail < 500) await frame();
      o.at05 = (performance.now() - tFail) / 1000;
      const t0 = performance.now(); tapNow();
      o.s05 = state; o.recall = recall && recall.txt; o.recallLife = recall && recall.life;
      const l0 = left;
      while (performance.now() - t0 < 100) await frame();
      tapNow(); o.lock100 = l0 - left;
      while (performance.now() - t0 < 300) await frame();
      lastTap = -1e9; tapNow(); o.lock300 = l0 - left;
      showMenu();
      return o;
    });
    S.eq(r.s03, 'dying', `${tag} : tap à ${r.d03.toFixed(2)} s ignoré`);
    S.eq(r.k03, 'dying', `${tag} : Espace à 0,3 s ignoré`);
    S.ok(r.sheet >= .45 && r.sheet < .48, `${tag} : feuille d'échec à ${r.sheet.toFixed(3)} s (0,45)`);
    S.eq(r.s05, 'play', `${tag} : tap à ${r.at05.toFixed(2)} s → relance`);
    S.ok(!!r.recall && Math.abs(r.recallLife - 1.2) < .05, `${tag} : cause rappelée après la relance (« ${r.recall} »)`);
    S.eq(r.lock100, 0, `${tag} : tir ignoré 100 ms après la relance par tap`);
    S.eq(r.lock300, 1, `${tag} : tir accepté 300 ms après la relance par tap`);
    // mise en page de la feuille d'échec, collision contre une aiguille puis interception par une sentinelle
    const nSent = await p.evaluate(() => { for (let n = 1; n < 400; n++) if (makeLevel(n).sents.length) return n; });
    for (const [n, kind] of [[3, 'pin'], [nSent, 'sent']]) {
      const ok = await p.evaluate(async ([n, kind]) => {
        const frame = () => new Promise(res => requestAnimationFrame(() => res()));
        startLevel(n);
        for (let i = 0; i < 1200 && state === 'play'; i++) {
          if (!flying && left > 0) {
            const a = predict(t).a, w = sentWindow();
            if (kind === 'pin' ? stuck.some(s => angDiff(s.a, a) < GAP * .4) : L.sents.some(q => sentMin(q, t + w[0], t + w[1]) < q.hw * .5)) throwPin();
          }
          await frame();
        }
        return failInfo && failInfo.kind;
      }, [n, kind]);
      S.eq(ok, kind, `${tag} : échec provoqué au niveau ${n}`);
      await p.waitForFunction(() => state === 'failed');
      await p.waitForTimeout(450);
      const g = await p.evaluate(() => {
        const box = failMarkScreen(), pr = $('failPanel').getBoundingClientRect(), mr = $('failMenu').getBoundingClientRect(),
          hr = $('failHint').getBoundingClientRect(), kr = $('failKick').getBoundingClientRect();
        return { y1: box && box.y1, filet: pr.top + 18, menuL: mr.left, hintL: hr.left, mid: pr.left + pr.width / 2, hud: hudLeft(true), kick: kr.left, s: FV.s, dy: FV.dy,
          kickN: parseInt($('failKick').textContent.split('·')[1], 10), notPlanted: L.throws - stuck.filter(s => !s.pre).length };
      });
      S.eq(g.kickN, g.notPlanted, `${tag} : niveau ${n}, aiguilles restantes annoncées = aiguilles non plantées`);
      await p.screenshot({ path: path.join(OUT, `echec-${tag}-${kind}.png`) });
      S.ok(g.y1 !== null && g.y1 <= g.filet - 4, `${tag} : ${kind === 'pin' ? 'point de collision' : 'sentinelle fautive'} ${(g.filet - g.y1).toFixed(1)} px au-dessus du filet (≥ 4 ; scène remontée de ${g.dy.toFixed(1)} px, échelle ${g.s.toFixed(2)})`);
      S.ok(g.menuL > g.mid && g.hintL < g.menuL, `${tag} : MENU à droite de la feuille d'échec (MENU à ${g.menuL}, milieu ${g.mid})`);
      S.ok(Math.abs(g.hud - g.kick) <= 1, `${tag} : HUD aligné sur la feuille (${g.hud} contre ${g.kick})`);
      await p.evaluate(() => showMenu());
    }
    // deux aiguilles en vol : la première échoue, la seconde est perdue avec elle ; la feuille les compte toutes les deux
    if (tag === SCREENS[0].join('x')) {
      const k = await p.evaluate(() => {
        const o = [];
        for (const n of [3, 8]) {
          startLevel(n); update(.5);
          for (let i = 0; i < 2000 && !window.__botSafe(); i++) update(STEP);
          throwPin(); update(.2);
          for (let i = 0; i < 4000 && !stuck.some(s => !s.pre && angDiff(s.a, predict(t).a) < GAP * .3); i++) update(STEP);
          throwPin(); update(.041); throwPin();
          const fl = flights.length;
          for (let i = 0; i < 200 && state !== 'failed'; i++) update(STEP);
          o.push({ n, fl, st: state, kickN: parseInt($('failKick').textContent.split('·')[1], 10), notPlanted: L.throws - stuck.filter(s => !s.pre).length });
          showMenu();
        }
        return o;
      });
      for (const x of k) {
        S.eq(x.fl + '/' + x.st, '2/failed', `niveau ${x.n} : échec avec deux aiguilles en vol`);
        S.eq(x.kickN, x.notPlanted, `niveau ${x.n}, deux en vol : aiguilles restantes annoncées = aiguilles non plantées`);
      }
    }
    await c.close();
  }
}

(async () => {
  const b = await chromium.launch();
  try {
    if (want('smoke')) await smoke(b);
    if (want('migration')) await migration(b);
    if (want('boot')) await boot(b);
    if (want('offline')) await offline(b);
    if (want('update')) await update(b);
    if (want('guard')) await guard(b);
    if (want('ecrans')) await ecrans(b);
    if (want('tir')) await tir(b);
    if (want('reprendre')) await reprendre(b);
    if (want('echec')) await echec(b);
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
