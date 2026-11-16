// Vidage des niveaux (générateur v2) et de la mise en page, et contrôles.
//   node tests/unit/dump.js --check          niveaux 1..400 identiques entre Chromium (vraie page) et Node (vrai code,
//                                            tests/sim/load.js), et identiques à la référence tests/ref/levels-gen2.json
//   node tests/unit/dump.js --update         réécrit la référence (à verser dans le même commit que le changement voulu)
//   node tests/unit/dump.js <index.html> <sortie.json>   écrit le vidage (niveaux et mise en page sur 5 écrans)
// Un niveau qui change sans mise à jour de la référence fait échouer le contrôle : aucun changement de niveau involontaire.
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const { load } = require('../sim/load');
const ROOT = path.resolve(__dirname, '..', '..');
const REF = path.join(ROOT, 'tests', 'ref', 'levels-gen2.json');
const SCREENS = [[320, 568], [360, 640], [390, 664], [390, 844], [430, 932]];
const NLEV = 400;

async function dump(html) {
  const url = 'file://' + path.resolve(html);
  const b = await chromium.launch();
  const out = { gen: 0, levels: [], layout: {} };
  try {
    for (const [w, h] of SCREENS) {
      const c = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
      const p = await c.newPage();
      const errs = [];
      p.on('pageerror', e => errs.push(e.message));
      await p.goto(url);
      await p.waitForFunction(() => typeof state !== 'undefined' && state === 'menu', null, { timeout: 10000 });
      if (!out.levels.length) { out.gen = await p.evaluate(() => GEN_VERSION); out.levels = await p.evaluate(N => { const a = []; for (let n = 1; n <= N; n++) a.push(JSON.stringify(makeLevel(n))); return a; }, NLEV); }
      out.layout[w + 'x' + h] = await p.evaluate(() => JSON.stringify({ W, H, SW, SX, cx, cy, R, PL, HEAD, PW, RS, RD, LAUNCH, FLYV, SENT_PAD }));
      if (errs.length) throw new Error(w + 'x' + h + ' : ' + errs.join(' | '));
      await c.close();
    }
  } finally { await b.close(); }
  return out;
}
const nodeLevels = () => { const G = load(), a = []; for (let n = 1; n <= NLEV; n++) a.push(JSON.stringify(G.makeLevel(n))); return a; };

(async () => {
  const args = process.argv.slice(2), pos = args.filter(a => !a.startsWith('--'));
  if (args.includes('--check') || args.includes('--update')) {
    const cur = await dump(path.join(ROOT, 'index.html')), node = nodeLevels(), diffs = [];
    for (let i = 0; i < NLEV; i++) if (cur.levels[i] !== node[i]) diffs.push('Node ≠ Chromium au niveau ' + (i + 1));
    if (args.includes('--update')) {
      if (diffs.length) { console.error('dump : ' + diffs.slice(0, 5).join(', ')); process.exit(1); }
      fs.writeFileSync(REF, JSON.stringify({ gen: cur.gen, levels: cur.levels }));
      console.log(`dump : référence écrite (GEN_VERSION ${cur.gen}, ${NLEV} niveaux)`);
      process.exit(0);
    }
    if (!fs.existsSync(REF)) diffs.push('référence absente : node tests/unit/dump.js --update');
    else {
      const ref = JSON.parse(fs.readFileSync(REF, 'utf8'));
      if (ref.gen !== cur.gen) diffs.push(`référence pour GEN_VERSION ${ref.gen}, jeu en ${cur.gen}`);
      const changed = [];
      for (let i = 0; i < NLEV; i++) if (cur.levels[i] !== ref.levels[i]) changed.push(i + 1);
      if (changed.length) diffs.push(`${changed.length} niveau(x) différent(s) de la référence (${changed.slice(0, 12).join(', ')}${changed.length > 12 ? '…' : ''}) : changement voulu → node tests/unit/dump.js --update`);
    }
    console.log(diffs.length ? 'dump : DIFFÉRENT — ' + diffs.slice(0, 8).join(' ; ') : `dump : ${NLEV} niveaux identiques entre Chromium, Node et la référence (GEN_VERSION ${cur.gen})`);
    process.exit(diffs.length ? 1 : 0);
  }
  if (pos.length < 2) { console.error('usage: node dump.js --check | --update | <index.html> <sortie.json>'); process.exit(2); }
  const out = await dump(pos[0]);
  fs.writeFileSync(pos[1], JSON.stringify(out));
  console.log('vidage écrit :', pos[1]);
})().catch(e => { console.error(e); process.exit(1); });
