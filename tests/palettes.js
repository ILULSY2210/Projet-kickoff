// Planche des palettes : un niveau de chaque monde en 360×640 (après quelques aiguilles du prédicteur honnête), plus
// Obsidienne avec la variante #9a6bff, et l'écran des niveaux.
//   node tests/palettes.js [--out=dossier]      puis la planche est composée par PIL (python3) :
//   <out>/palettes.png (7 mondes) et docs/reference/obsidienne-violets.png (les deux violets côte à côte, pour le porteur).
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs'), { execFileSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..');
const a = process.argv.find(x => x.startsWith('--out='));
const OUT = path.resolve(a ? a.slice(6) : path.join(ROOT, 'tests', 'out', 'palettes'));
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch(), errors = [];
  const c = await b.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await c.newPage();
  p.on('pageerror', e => errors.push(e.message));
  await p.goto('file://' + path.join(ROOT, 'index.html'));
  await p.waitForFunction(() => typeof state !== 'undefined' && state === 'menu');
  const shots = [];
  const cases = [[0, 33], [1, 63], [2, 103], [3, 153], [4, 203], [4, 203, 'alt'], [5, 253]];
  for (const [w, n, alt] of cases) {
    await p.evaluate(([n, alt]) => {
      soundOn = false;
      if (!window.__orig) window.__orig = WORLDS[4].rgb;
      WORLDS[4].rgb = alt ? OBSIDIENNE_ALT : window.__orig;
      showMenu(); PAL = { w: -1 }; startLevel(n); update(2.6);
      for (let i = 0; i < 60 * 20 && L.throws - left < 4; i++) { if (window.__botSafe()) throwPin(); update(1 / 60); }
      update(.3);
    }, [n, !!alt]);
    await p.waitForTimeout(250);
    const f = path.join(OUT, `monde${w + 1}${alt ? '-alt' : ''}.png`);
    await p.screenshot({ path: f }); shots.push(f);
  }
  await p.evaluate(() => { WORLDS[4].rgb = window.__orig; unlocked = 260; showLevels(); });
  await p.waitForTimeout(300);
  await p.screenshot({ path: path.join(OUT, 'niveaux.png') }); shots.push(path.join(OUT, 'niveaux.png'));
  await b.close();
  const py = `
import sys
from PIL import Image, ImageDraw
def sheet(files, labels, out, cols):
    ims = [Image.open(f).convert('RGB').resize((360, 640), Image.LANCZOS) for f in files]
    rows = -(-len(ims) // cols)
    o = Image.new('RGB', (cols * 368 + 8, rows * 670 + 8), (30, 30, 30)); d = ImageDraw.Draw(o)
    for k, im in enumerate(ims):
        x = 8 + (k % cols) * 368; y = 8 + (k // cols) * 670
        d.text((x + 2, y + 6), labels[k], fill=(255, 255, 255)); o.paste(im, (x, y + 24))
    o.save(out)
f = sys.argv[1:]
sheet(f, ['EMERAUDE #4dffa6', 'AMBRE #ffb23e', 'RUBIS #ff4f6a', 'SAPHIR #4aa8ff', 'OBSIDIENNE #b48cff', 'OBSIDIENNE #9a6bff', 'COSMOS #dff3ff', 'NIVEAUX'], '${OUT}/palettes.png', 4)
sheet([f[4], f[5]], ['OBSIDIENNE #b48cff (par defaut)', 'OBSIDIENNE #9a6bff (variante)'], '${path.join(ROOT, 'docs', 'reference', 'obsidienne-violets.png')}', 2)
`;
  execFileSync('python3', ['-c', py, ...shots], { stdio: 'inherit' });
  console.log(errors.length ? 'palettes : erreurs ' + errors.join(' | ') : 'palettes : planches écrites (' + OUT + '/palettes.png, docs/reference/obsidienne-violets.png)');
  process.exit(errors.length ? 1 : 0);
})();
