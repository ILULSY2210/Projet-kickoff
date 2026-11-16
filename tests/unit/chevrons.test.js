// Chevrons de direction (BAL UX-1) : chaque arrêt et chaque inversion de la rotation est annoncé AHEAD = 0,45 s avant
// (vrai js/core.js dans Node). Pour les lois à arrêts ou inversions (pas à pas, alternée, ressac) : instants réels des
// événements cherchés au pas de 0,1 ms ; aheadEvent annonce l'événement dès te − 0,45 s (à 2 ms près), avec la bonne
// nature (arrêt ou inversion) et le bon délai, et ne l'annonce pas avant te − 0,45 s.
const { load } = require('../sim/load');
const G = load();
const fails = [], check = (c, m) => { if (!c) fails.push(m); };
const A = G.get('AHEAD'), ahead = G.get('aheadEvent'), mk = G.makeLevel;
const want = { 4: 'stop', 2: 'flip', 5: 'flip' };
let tested = 0;
for (const pat of [4, 2, 5]) {
  let n = 1; while (mk(n).pattern !== pat) n++;
  G.startLevel(n);
  const L = G.get('L'), sp = G.speedAt, vm = L.vmax * G.get('STOP_V'), t0 = G.get('t');
  // événements réels : |v| passe sous le seuil (ou change de signe) en venant d'une rotation franche
  let prevSlow = Math.abs(sp(t0)) < vm, dir = Math.sign(sp(t0)), ev = [];
  for (let x = t0; x < t0 + 30 && ev.length < 6; x += 1e-4) {
    const v = sp(x), slow = Math.abs(v) < vm || Math.sign(v) !== dir;
    if (!prevSlow && slow) ev.push(x);
    if (Math.abs(v) >= vm) dir = Math.sign(v);
    prevSlow = Math.abs(v) < vm;
  }
  for (const te of ev) {
    const e1 = ahead(te - A + .002, A);
    check(e1.kind !== null && Math.abs(e1.dt - (A - .002)) < .002, `loi ${pat} (niveau ${n}) : événement à ${te.toFixed(3)} annoncé 0,45 s avant (${e1.kind}, dt ${e1.dt})`);
    check(e1.kind === want[pat], `loi ${pat} : nature annoncée ${e1.kind} (attendu ${want[pat]})`);
    const e0 = ahead(te - A - .01, A);
    check(e0.kind === null || e0.dt < A - .05, `loi ${pat} : événement à ${te.toFixed(3)} annoncé trop tôt (dt ${e0.dt})`);
    tested++;
  }
}
// rotation continue : aucune annonce
{ let n = 1; while (mk(n).pattern !== 0) n++; G.startLevel(n); for (let i = 0; i < 200; i++) { G.update(.05); check(ahead(G.get('t'), A).kind === null, 'rotation continue : annonce intempestive'); } }
check(tested >= 12, `seulement ${tested} événements vérifiés`);
if (fails.length) { console.log('chevrons : ÉCHEC\n  ' + fails.slice(0, 20).join('\n  ')); process.exit(1); }
console.log(`chevrons : pass (${tested} arrêts et inversions annoncés 0,45 s avant)`);
