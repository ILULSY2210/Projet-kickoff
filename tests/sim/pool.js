// Réservoir de processus de calcul (un par cœur) pour le simulateur : run(jobs) → résultats dans l'ordre des lots.
const { fork } = require('child_process');
const os = require('os'), path = require('path');
function pool(n) {
  n = n || Math.max(1, os.cpus().length);
  const ws = [], queue = [], busy = new Map();
  let next = 0, waiting = null;
  for (let i = 0; i < n; i++) {
    const w = fork(path.join(__dirname, 'worker.js'));
    w.on('message', m => { const cb = busy.get(w); busy.delete(w); cb(m); pump(); });
    ws.push(w);
  }
  function pump() {
    for (const w of ws) {
      if (busy.has(w) || !queue.length) continue;
      const { job, cb } = queue.shift();
      busy.set(w, cb); w.send(job);
    }
  }
  return {
    run(jobs, onDone) {
      return new Promise(res => {
        const out = new Array(jobs.length); let left = jobs.length;
        if (!left) return res(out);
        jobs.forEach((job, i) => queue.push({ job: Object.assign({ id: i }, job), cb: m => { out[i] = m; if (onDone) onDone(m, i); if (--left === 0) res(out); } }));
        pump();
      });
    },
    close() { for (const w of ws) w.kill(); }
  };
}
// intervalle de confiance de Wilson à 95 %
function wilson(k, n, z = 1.96) {
  if (!n) return [0, 1];
  const p = k / n, d = 1 + z * z / n, c = p + z * z / (2 * n), m = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n));
  return [(c - m) / d, (c + m) / d];
}
module.exports = { pool, wilson };
