// Charge le VRAI cœur du jeu dans Node : js/config.js, js/util.js, js/levels.js et js/core.js, exécutés tels quels dans
// un contexte vm (scripts classiques : leurs déclarations de premier niveau partagent une seule portée, comme dans la page).
// Aucune copie de la physique : le simulateur pilote startLevel / throwPin(tSim) / update exactement comme la page.
//   const { load } = require('./load');  const G = load();  G.startLevel(12); G.update(1 / 60); G.get('state')
const vm = require('vm'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const FILES = ['js/config.js', 'js/util.js', 'js/levels.js', 'js/core.js'];
// accès en lecture et en écriture aux identifiants globaux du jeu, et quelques aides exécutées dans le contexte
const API = `
var __api = {
  get(k) { return eval(k); },
  set(k, v) { __v = v; eval(k + ' = __v'); },
  startLevel, throwPin, update, predict, makeLevel, speedAt, failCause,
  safe: (tSim) => window.__botSafe(tSim),
  snap() { return { state, left, t, rot, flights: flights.length, stuck: stuck.length, n: L && L.n, fail: failInfo && failInfo.kind }; }
};
var __v;
`;
let SRC = null;
function source() {
  if (!SRC) SRC = FILES.map(f => fs.readFileSync(path.join(ROOT, f), 'utf8') + '\n;\n').join('');
  return SRC;
}
function load() {
  const ctx = { console, Math, JSON };
  ctx.window = ctx;
  vm.createContext(ctx);
  // un seul script : même portée lexicale de premier niveau que plusieurs scripts classiques dans la page
  vm.runInContext(source() + API, ctx, { filename: 'orbita-core.js' });
  const A = ctx.__api;
  A.ctx = ctx;
  A.run = code => vm.runInContext(code, ctx);
  return A;
}
module.exports = { load, FILES, ROOT };
if (require.main === module) {
  const G = load();
  G.startLevel(1);
  console.log('cœur chargé dans Node :', JSON.stringify(G.snap()), 'GAP', G.get('GAP'));
}
