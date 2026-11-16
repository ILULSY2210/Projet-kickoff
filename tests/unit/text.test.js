// Textes du jeu : catalogue des messages d'échec, accords, glyphes de la police vectorielle (vraie page + lecture des sources).
//   node tests/unit/text.test.js
// - aiguille au milieu d'un arc interdit : « zone interdite », et non « il manquait 4° » (UX-3) ; juste au bord de l'arc :
//   les degrés, exacts ; aiguille contre aiguille, sortie opposée, sentinelle : message et conseil propres à la cause ;
// - lois de rotation accordées à « ROTATION » ; plus de « l'oscillo », de « ROTATION CONTINU », de « SON OUI/NON » (UX-6) ;
// - chaque texte dessiné sur le canevas n'utilise que des glyphes de la police « Trace ».
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const ROOT = path.resolve(__dirname, '..', '..');
const URL = 'file://' + path.join(ROOT, 'index.html');
const fails = [];
const check = (c, m) => { if (!c) fails.push(m); };

// 1. lecture des sources : tournures retirées
const src = ['index.html', 'manifest.webmanifest', ...fs.readdirSync(path.join(ROOT, 'js')).map(f => 'js/' + f)]
  .map(f => [f, fs.readFileSync(path.join(ROOT, f), 'utf8')]);
for (const [f, s] of src) {
  for (const [re, why] of [[/oscillo/i, '« l’oscillo » (la jauge s’appelle ROTATION)'], [/'CONTINU'/, 'ROTATION CONTINU (accord)'],
    [/POUR LANCER/, 'verbe « lancer » au lieu de « tirer »'], [/percuté en ressortant/, 'percuter sans complément'],
    [/'OUI' : 'NON'/, 'SON OUI / SON NON']]) check(!re.test(s), `${f} : ${why}`);
}
check(!/l'astre/.test(fs.readFileSync(path.join(ROOT, 'manifest.webmanifest'), 'utf8')), 'manifeste : apostrophe droite');
check(/Espace : tirer · P : pause/.test(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')), 'aide clavier : espaces insécables avant « : »');

(async () => {
  const b = await chromium.launch();
  try {
    const p = await (await b.newContext()).newPage();
    p.on('pageerror', e => fails.push('pageerror: ' + e.message));
    await p.goto(URL);
    await p.waitForFunction(() => typeof state !== 'undefined' && state === 'menu');
    const r = await p.evaluate(() => {
      soundOn = false;
      const o = {};
      o.pat = PAT_NAME.map(x => 'ROTATION ' + x);
      // arc interdit : milieu, puis juste au-delà du bord
      let n = 1; while (!makeLevel(n).walls.length) n++;
      startLevel(n);
      const wl = L.walls[0], mid = norm((wl.a0 + wl.a1) / 2);
      let ld = landing(mid);
      o.zone = failCause({ kind: 'pin', a: mid, d: ld.d, who: ld.who }, L);
      o.zoneWidthDeg = (wl.a1 - wl.a0) * 180 / Math.PI;
      const edge = norm(wl.a1 + GAP * .6);
      ld = landing(edge);
      o.edge = failCause({ kind: 'pin', a: edge, d: ld.d, who: ld.who }, L);
      o.edgeWant = Math.max(1, Math.ceil((GAP - angDiff(edge, wl.a1)) * 180 / Math.PI));
      o.zoneLevel = n;
      // aiguille contre aiguille (niveau 2), sortie opposée (traversantes), sentinelle
      startLevel(2);
      const a2 = norm(stuck[0].a + GAP * .5);
      ld = landing(a2);
      o.pin = failCause({ kind: 'pin', a: a2, d: ld.d, who: ld.who }, L);
      n = 1; while (!makeLevel(n).trav) n++;
      startLevel(n);
      o.twin = failCause({ kind: 'twin', a: 1, d: .03, who: null }, L);
      n = 1; while (!makeLevel(n).sents.length) n++;
      startLevel(n);
      o.sent = failCause({ kind: 'sent', a: 0, d: 0, who: L.sents[0] }, L);
      // tous les textes du canevas : glyphes de la police vectorielle
      const canvas = [...o.pat, ...Object.values(TEACH_TEXT).flat(), ...WORLDS.map(w => w.name), ...WORLDS.map(w => w.theme), ENDLESS.name, ENDLESS.theme, 'MONDE ∞',
        ...Object.values(FAIL_TEXT).map(x => x.short.replace('{d}', '12')),
        'TOUCHE L’ÉCRAN POUR TIRER', 'CLIC OU ESPACE POUR TIRER', 'ARC ALLUMÉ = ZONE LIBRE',
        'NIVEAU', 'BOSS', 'AIGUILLES', 'ROTATION', 'BONUS', 'MONDE 01', 'FRÔLÉ · 3°', '★ 2/3', 'NIVEAU 10 · ROTATION ALTERNÉE'];
      o.missing = [];
      for (const str of canvas) for (const ch of str) if (!FONT[ch]) o.missing.push(`${ch} dans « ${str} »`);
      o.tips = FAIL_TEXT;
      showMenu();
      return o;
    });
    check(JSON.stringify(r.pat) === JSON.stringify(['ROTATION CONTINUE', 'ROTATION RESPIRANTE', 'ROTATION ALTERNÉE', 'ROTATION PAR À-COUPS', 'ROTATION PAS À PAS', 'ROTATION EN RESSAC', 'ROTATION IRRÉGULIÈRE']), 'lois de rotation : ' + r.pat.join(', '));
    check(r.zone.key === 'zone' && /zone interdite/.test(r.zone.long) && !/manquait/.test(r.zone.long), `milieu d'un arc interdit de ${r.zoneWidthDeg.toFixed(1)}° (niveau ${r.zoneLevel}) : « ${r.zone.long} »`);
    check(r.edge.key === 'pin' && r.edge.deg === r.edgeWant && r.edge.long === `Il manquait ${r.edgeWant}° pour passer.`, `bord d'un arc interdit : « ${r.edge.long} » (attendu ${r.edgeWant}°)`);
    check(r.pin.key === 'pin' && r.pin.long === `Il manquait ${r.pin.deg}° pour passer.` && r.pin.deg >= 3 && r.pin.deg <= 4, `aiguille contre bloqueur à GAP/2 : « ${r.pin.long} »`);
    check(r.twin.key === 'twin' && /ressortant en face/.test(r.twin.long), `sortie opposée : « ${r.twin.long} »`);
    check(r.sent.key === 'sent' && /sentinelle/.test(r.sent.long), `sentinelle : « ${r.sent.long} »`);
    check(r.tips.sent.tips.includes(r.sent.tip) && !/arc allumé/.test(r.sent.tip), `conseil de la sentinelle propre à la cause : « ${r.sent.tip} »`);
    check(r.tips.twin.tips.includes(r.twin.tip), `conseil de la sortie opposée : « ${r.twin.tip} »`);
    check(r.missing.length === 0, 'glyphes absents de la police vectorielle : ' + r.missing.join(' ; '));
    console.log(`exemples : « ${r.zone.long} » / « ${r.edge.long} » / « ${r.twin.long} ${r.twin.tip} » / « ${r.sent.long} ${r.sent.tip} »`);
  } catch (e) { fails.push('harness: ' + (e && e.stack || e)); }
  await b.close();
  if (fails.length) { console.log('text : ÉCHEC\n  ' + fails.join('\n  ')); process.exit(1); }
  console.log('text : pass');
})();
