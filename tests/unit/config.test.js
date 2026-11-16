// Tables de données (js/config.js) et structure des mondes, dans Node (vrai code chargé par tests/sim/load.js).
//   node tests/unit/config.test.js
// - 6 mondes de 50 niveaux (1..300) puis COSMOS ∞ ; boss tous les 10 niveaux, spéciaux en x7 ;
// - palettes : 4 couleurs par monde, trait ≥ 4,5:1 sur le fond, libellés secondaires (opacité lab) ≥ 4,5:1 sur le fond le
//   plus clair (encre + lueur), blanc chaud ≥ 7:1 ; les deux violets d'Obsidienne mesurés ;
// - positions u dans l'ordre (pas de tir < cadran < sentinelles < têtes < contact) ; TEACH : niveaux croissants, uniques.
const { load } = require('../sim/load');
const G = load();
const fails = [], check = (c, m) => { if (!c) fails.push(m); };
const W = G.get('WORLDS'), INK = G.get('INK_RGB'), contrast = G.get('contrast'), mixRGB = G.get('mixRGB');
check(W.length === 6, `6 mondes (${W.length})`);
check(JSON.stringify(W.map(w => w.id)) === '["emeraude","ambre","rubis","saphir","obsidienne","cosmos"]', 'ordre des mondes : ' + W.map(w => w.id).join(','));
check(G.get('LEVELS_PER_WORLD') === 50 && G.get('LAST_LEVEL') === 300 && G.get('BOSS_EVERY') === 10, 'structure 6 × 50, boss tous les 10');
const worldOf = G.get('worldOf'), isBoss = G.get('isBoss'), isSpecial = G.get('isSpecial'), worldInfo = G.get('worldInfo');
for (const [n, w] of [[1, 0], [50, 0], [51, 1], [100, 1], [101, 2], [250, 4], [251, 5], [300, 5], [301, 6], [5000, 6]]) check(worldOf(n) === w, `worldOf(${n}) = ${worldOf(n)} (attendu ${w})`);
let nb = 0, ns = 0; for (let n = 1; n <= 300; n++) { if (isBoss(n)) nb++; if (isSpecial(n)) ns++; }
check(nb === 30 && ns === 30, `30 boss et 30 spéciaux sur 1..300 (${nb}, ${ns})`);
check(worldInfo(6).name === 'COSMOS ∞' && worldInfo(6).rgb === W[5].rgb, 'COSMOS ∞ : palette de Cosmos');
const lines = [];
for (let w = 0; w < 6; w++) {
  const p = worldInfo(w), bg = mixRGB(INK, p.rgb, p.amb.glow);
  for (const k of ['rgb', 'hi', 'acc', 'alert']) check(Array.isArray(p[k]) && p[k].length === 3 && p[k].every(v => v >= 0 && v <= 255), `${p.name} : couleur ${k}`);
  const cT = contrast(p.rgb, INK), cL = contrast(mixRGB(bg, p.rgb, p.lab), bg), cH = contrast(p.hi, bg), cA = contrast(p.alert, bg);
  check(cT >= 4.5, `${p.name} : trait ${cT.toFixed(2)}:1 (≥ 4,5)`);
  check(cL >= 4.5, `${p.name} : libellés à ${p.lab} : ${cL.toFixed(2)}:1 (≥ 4,5)`);
  check(cH >= 7, `${p.name} : blanc chaud ${cH.toFixed(2)}:1 (≥ 7)`);
  check(cA >= 4.5, `${p.name} : alerte ${cA.toFixed(2)}:1 (≥ 4,5)`);
  const dRGB = Math.hypot(p.alert[0] - p.rgb[0], p.alert[1] - p.rgb[1], p.alert[2] - p.rgb[2]);
  check(dRGB >= 100, `${p.name} : alerte distincte du trait (écart ${dRGB.toFixed(0)} ≥ 100)`);
  lines.push(`${p.name} trait ${cT.toFixed(1)}:1, libellés (${p.lab}) ${cL.toFixed(1)}:1`);
}
const alt = G.get('OBSIDIENNE_ALT');
lines.push(`Obsidienne #9a6bff : trait ${contrast(alt, INK).toFixed(1)}:1, libellés (${G.get('labelAlpha')(alt, W[4].amb.glow, .65)})`);
const U = G.get('U');
check(0 < U.dial && U.dial < U.sentOut && U.sentOut < U.sent && U.sent < U.sentIn && U.sentIn < U.head && U.head < 1, 'positions u dans l\'ordre');
const T = G.get('TEACH'), keys = Object.keys(T).map(Number);
check(keys.every((k, i) => !i || k > keys[i - 1]) && new Set(Object.values(T)).size === keys.length, 'TEACH : niveaux croissants, une idée par niveau');
check(keys.every(k => k >= 1 && k <= 300), 'TEACH dans 1..300');
console.log(lines.join('\n'));
if (fails.length) { console.log('config : ÉCHEC\n  ' + fails.join('\n  ')); process.exit(1); }
console.log('config : pass');
