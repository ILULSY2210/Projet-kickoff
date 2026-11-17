// Processus de calcul du simulateur : charge le vrai cœur (load.js) et les politiques (driver.js), exécute les lots
// envoyés par pool.js. Un lot = une politique, un niveau, des essais aux graines seed0, seed0 + 1, …
const { load } = require('./load');
const { DRIVER } = require('./driver');
const G = load(); G.run(DRIVER);
const S = G.run('__sim');
// variante « calme » d'un niveau (report.js, joueur réactif) : le même niveau sans arrêts ni inversions — loi continue à
// la même vitesse moyenne, sans demi-tours ni inversion à l'impact ; anneaux, zones, sentinelles, obstacles, accélération
// et rampe inchangés. Elle dit quelle part de l'écart du joueur réactif vient des arrêts et des inversions eux-mêmes.
G.run(`var __calm = false, __mkCalm = makeLevel; makeLevel = function (n) { var l = __mkCalm(n); if (__calm) { l.pattern = 0; l.irr = null; l.speed = l.omega; l.demi = null; l.rhythm = null; l.inv = false; l.vmax = Math.round(l.omega * (l.accel ? l.accel.cap : 1) * (l.ramp ? 1 + l.ramp.k : 1) * 1e6) / 1e6; l.flags = levelFlags(l); } return l; };`);
const BASE = JSON.stringify(G.get('DIFFICULTY').tune);
let tuned = '';
process.on('message', job => {
  // réglages par niveau à essayer (tune.js), ajoutés à ceux de config.js sans les remplacer
  const tk = JSON.stringify(job.tune || {});
  if (tk !== tuned) { G.run(`DIFFICULTY.tune = Object.assign(${BASE}, ${tk});`); tuned = tk; }
  G.run(`__calm = ${!!job.calm}`);
  const out = { id: job.id, n: job.n, wins: 0, trials: job.trials, T: [], why: {}, sum: 0 };
  for (let i = 0; i < job.trials; i++) {
    const seed = job.seed0 + i;
    let r;
    if (job.kind === 'aim') r = S.aim(job.n, job.sigma, seed);
    else if (job.kind === 'reactive') r = S.reactive(job.n, job.sigma, seed);
    else if (job.kind === 'mash') r = S.mash(job.n, job.c, seed);
    else if (job.kind === 'sustained') { const x = S.mashSustained(job.n, job.c, seed, job.D); r = { st: x.win ? 'win' : 'fail', T: x.T || 0 }; }
    else if (job.kind === 'bot') r = S.bot(job.n, job.dt, job.g, seed);
    if (r.st === 'win') { out.wins++; out.T.push(+r.T.toFixed(3)); }
    else { const k = r.st + ':' + (r.kind || '') ; out.why[k] = (out.why[k] || 0) + 1; }
  }
  process.send(out);
});
