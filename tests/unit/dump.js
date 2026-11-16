// Vidage des niveaux et de la mise en page, et comparaison avec la référence ad561a3.
//   node tests/unit/dump.js <index.html> <sortie.json>          écrit le vidage
//   node tests/unit/dump.js --check [index.html] [--strict]    compare avec tests/ref/levels-ad561a3.json
// Le vidage contient JSON.stringify(makeLevel(n)) pour n = 1..200 et la mise en page sur 5 écrans.
// --check compare les niveaux ; seule exception admise (commit 1.9) : le placement des étoiles sur les niveaux
// à aiguilles traversantes. --strict exige aussi l'égalité de ces étoiles et de la mise en page (commit 1.1).
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const ROOT = path.resolve(__dirname, '..', '..');
const REF = path.join(ROOT, 'tests', 'ref', 'levels-ad561a3.json');
const SCREENS = [[320, 568], [360, 640], [390, 664], [390, 844], [430, 932]];
const NLEV = 200;

async function dump(html) {
  const url = 'file://' + path.resolve(html);
  const b = await chromium.launch();
  const out = { levels: [], layout: {} };
  try {
    for (const [w, h] of SCREENS) {
      const c = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
      const p = await c.newPage();
      const errs = [];
      p.on('pageerror', e => errs.push(e.message));
      await p.goto(url);
      await p.waitForFunction(() => typeof state !== 'undefined' && state === 'menu', null, { timeout: 10000 });
      if (!out.levels.length) out.levels = await p.evaluate(N => { const a = []; for (let n = 1; n <= N; n++) a.push(JSON.stringify(makeLevel(n))); return a; }, NLEV);
      out.layout[w + 'x' + h] = await p.evaluate(() => JSON.stringify({ W, H, SW, SX, cx, cy, R, PL, HEAD, PW, RS, RD, LAUNCH, FLYV, SENT_PAD }));
      if (errs.length) throw new Error(w + 'x' + h + ' : ' + errs.join(' | '));
      await c.close();
    }
  } finally { await b.close(); }
  return out;
}

function compare(cur, ref, strict) {
  const diffs = [];
  for (let i = 0; i < ref.levels.length; i++) {
    if (cur.levels[i] === ref.levels[i]) continue;
    const a = JSON.parse(cur.levels[i] || 'null'), r = JSON.parse(ref.levels[i]);
    if (!strict && a && r.trav && a.trav) {
      delete a.orbs; delete r.orbs;
      if (JSON.stringify(a) === JSON.stringify(r)) continue;
    }
    diffs.push('niveau ' + (i + 1));
  }
  if (strict) for (const k in ref.layout) if (cur.layout[k] !== ref.layout[k]) diffs.push('mise en page ' + k);
  return diffs;
}

(async () => {
  const args = process.argv.slice(2), check = args.includes('--check'), strict = args.includes('--strict');
  const pos = args.filter(a => !a.startsWith('--'));
  if (check) {
    const html = pos[0] || path.join(ROOT, 'index.html');
    const cur = await dump(html), ref = JSON.parse(fs.readFileSync(REF, 'utf8'));
    const diffs = compare(cur, ref, strict);
    console.log(diffs.length ? 'dump : DIFFÉRENT — ' + diffs.join(', ') : `dump : ${ref.levels.length} niveaux identiques à ad561a3` + (strict ? ' (strict, mise en page comprise)' : ' (hors étoiles des niveaux traversants)'));
    process.exit(diffs.length ? 1 : 0);
  }
  if (pos.length < 2) { console.error('usage: node dump.js <index.html> <sortie.json> | --check [index.html] [--strict]'); process.exit(2); }
  const out = await dump(pos[0]);
  fs.writeFileSync(pos[1], JSON.stringify(out));
  console.log('vidage écrit :', pos[1]);
})().catch(e => { console.error(e); process.exit(1); });
