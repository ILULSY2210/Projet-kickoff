// Cohérence du service worker (précache atomique et versionné).
//   node tests/unit/sw.test.js            vérifie
//   node tests/unit/sw.test.js --update   réécrit tests/ref/sw-hashes.json (seulement après un changement de VERSION)
//   node tests/unit/sw.test.js --bump     incrémente VERSION et tous les ?v= (sw.js, index.html), puis --update
// Échoue si : un fichier précaché a changé sans changement de VERSION ; un fichier référencé par index.html
// (scripts, polices, icône, manifeste) ou par le manifeste manque dans FILES ; un fichier de FILES n'existe pas ;
// un ?v= ne correspond pas à VERSION ; un script de index.html n'a pas de ?v= ; la référence n'est pas à jour.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const ROOT = path.resolve(__dirname, '..', '..');
const REF = path.join(ROOT, 'tests', 'ref', 'sw-hashes.json');
const rd = f => fs.readFileSync(path.join(ROOT, f));
const sha = b => crypto.createHash('sha256').update(b).digest('hex');

function parseSW(src) {
  const m = /const VERSION = '(orbita-v(\d+))';/.exec(src);
  if (!m) throw new Error("VERSION introuvable dans sw.js (forme attendue : const VERSION = 'orbita-vN';)");
  const f = /const FILES = (\[[\s\S]*?\]);/.exec(src);
  if (!f) throw new Error('FILES introuvable dans sw.js');
  const files = new Function('return ' + f[1])();
  return { version: m[1], n: m[2], files };
}
function referenced(html, manifest) {
  const out = new Set();
  for (const m of html.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)) out.add(m[1]);
  for (const m of html.matchAll(/<link[^>]*\shref="([^"]+)"/g)) out.add(m[1]);
  for (const m of html.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) out.add(m[1]);
  for (const ic of (manifest.icons || [])) out.add(ic.src);
  return [...out].filter(u => !/^(https?:|data:|#)/.test(u));
}
function snapshot(sw) {
  const files = { 'sw.js': sha(rd('sw.js')) };
  for (const f of sw.files) { if (f === './') continue; const p = f.split('?')[0]; files[p] = sha(rd(p)); }
  return { version: sw.version, files };
}
function check() {
  const errs = [];
  const swSrc = rd('sw.js').toString(), html = rd('index.html').toString();
  const sw = parseSW(swSrc), manifest = JSON.parse(rd('manifest.webmanifest'));
  const set = new Set(sw.files);
  for (const f of sw.files) {
    if (f === './') continue;
    const [p, q] = f.split('?');
    if (!fs.existsSync(path.join(ROOT, p))) errs.push(`FILES : fichier absent du dépôt : ${p}`);
    if (q && q !== 'v=' + sw.n) errs.push(`FILES : ${f} ne correspond pas à ${sw.version}`);
  }
  for (const u of referenced(html, manifest)) {
    if (!set.has(u)) errs.push(`fichier référencé absent de FILES : ${u}`);
  }
  for (const m of html.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)) {
    const q = m[1].split('?')[1];
    if (q !== 'v=' + sw.n) errs.push(`index.html : ${m[1]} devrait porter ?v=${sw.n}`);
  }
  for (const m of html.matchAll(/\?v=(\d+)/g)) if (m[1] !== sw.n) errs.push(`index.html : ?v=${m[1]} ne correspond pas à ${sw.version}`);
  for (const k of ['./', 'index.html', 'manifest.webmanifest', 'icon.svg']) if (!set.has(k)) errs.push(`FILES doit contenir ${k}`);
  return { errs, sw };
}

const arg = process.argv[2];
if (arg === '--bump') {
  const swSrc = rd('sw.js').toString(), sw = parseSW(swSrc), n = +sw.n + 1;
  fs.writeFileSync(path.join(ROOT, 'sw.js'), swSrc.replace(`'${sw.version}'`, `'orbita-v${n}'`).replace(new RegExp('\\?v=' + sw.n + "'", 'g'), `?v=${n}'`));
  const html = rd('index.html').toString();
  fs.writeFileSync(path.join(ROOT, 'index.html'), html.replace(new RegExp('\\?v=' + sw.n + '"', 'g'), `?v=${n}"`));
  console.log(`VERSION : ${sw.version} → orbita-v${n}`);
}
const { errs, sw } = check();
const cur = snapshot(sw);
if (arg === '--update' || arg === '--bump') {
  if (errs.length) { console.error('sw : incohérences, référence non écrite :\n  ' + errs.join('\n  ')); process.exit(1); }
  if (fs.existsSync(REF)) {
    const ref = JSON.parse(fs.readFileSync(REF, 'utf8'));
    if (ref.version === cur.version && JSON.stringify(ref.files) !== JSON.stringify(cur.files)) {
      console.error(`sw : des fichiers ont changé mais VERSION est toujours ${cur.version} : incrémente VERSION (--bump) au lieu de réécrire la référence.`);
      process.exit(1);
    }
  }
  fs.writeFileSync(REF, JSON.stringify(cur, null, 1) + '\n');
  console.log(`sw : référence écrite pour ${cur.version} (${Object.keys(cur.files).length} fichiers)`);
  process.exit(0);
}
if (!fs.existsSync(REF)) errs.push('référence absente : lancer node tests/unit/sw.test.js --update');
else {
  const ref = JSON.parse(fs.readFileSync(REF, 'utf8'));
  if (ref.version !== cur.version) errs.push(`référence pour ${ref.version}, VERSION vaut ${cur.version} : lancer node tests/unit/sw.test.js --update`);
  else {
    for (const k of new Set([...Object.keys(ref.files), ...Object.keys(cur.files)])) {
      if (ref.files[k] !== cur.files[k]) errs.push(`${k} a changé sans changement de VERSION (${cur.version}) : lancer node tests/unit/sw.test.js --bump`);
    }
  }
}
if (errs.length) { console.error('sw : ÉCHEC\n  ' + errs.join('\n  ')); process.exit(1); }
console.log(`sw : ${cur.version}, ${sw.files.length} fichiers précachés, cohérent`);
