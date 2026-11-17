// Réglage de la difficulté niveau par niveau sur le vrai cœur (joueur simulé qui vise). Deux leviers par niveau, écrits dans
// DIFFICULTY.tune (js/config.js) avec --write : [facteur de vitesse de l'astre, aiguilles en plus ou en moins].
//   node tests/sim/tune.js [--from=1] [--to=300] [--endless=0] [--only=n,…] [--target=n:T,…] [--trials=200] [--trials30=300]
//                          [--iters=7] [--fresh] [--write]
// Cible à 70 ms (target70) : droite du monde (début → fin, table worldTargets70) + décalage selon la place dans le bloc de 10
// (respirations en x1-x2 : +9 et +7 points, soit ≈ +10 sur x8-x9 du bloc précédent ; montée jusqu'au boss : −5) ; niveaux
// d'apprentissage au moins 12 points au-dessus de la droite ; réserve de COSMOS ∞ (301-400) : 26 %.
// Plancher à 30 ms (floor30) : 95, 90, 85, 82 puis 80 % (minimum par niveau de la table 5.10, et 5 points de marge sur le
// plancher d'équité de 75 % dans les deux derniers mondes et COSMOS ∞).
// Méthode, pour chaque niveau :
//   1. facteur de vitesse f réglé sur la cible à 70 ms (sécante en log f, bornée par bissection, mêmes graines d'une
//      itération à l'autre) ; f borné : au plus 1,45 × la vitesse prévue et 1,15 × la vitesse de fin du monde (table
//      DIFFICULTY.worlds), au plus 1 pour un niveau d'apprentissage (vitesse modérée, plan 5.3) ;
//   2. encore trop facile à la vitesse plafond : une aiguille de plus (jusqu'à +5) ; trop dur à la vitesse plancher : une de
//      moins ;
//   3. plancher à 30 ms manqué : une aiguille de PLUS, et f réglé à nouveau (plus lent). À difficulté égale à 70 ms, plus
//      d'aiguilles moins rapides font plus de tirs moyennement difficiles et moins de tirs très étroits : le joueur précis y
//      gagne davantage (plan 5.10 : leviers qui punissent l'imprécision plutôt que la vitesse brute). Si la capacité
//      (tirs + obstacles fixes ≤ 14) l'interdit, f baisse jusqu'au plancher, prioritaire sur la cible.
//   4. durée d'un niveau propre (45 ms, 100 essais) au-delà de 92 % de son plafond (maximum du monde de la table 5.10,
//      1,5 × pour un boss, 30 s dans COSMOS ∞) : autant d'aiguilles en moins que la durée l'exige, f réglé à nouveau, et plus
//      d'aiguille ajoutée ensuite (trop facile au plafond de vitesse, le niveau le reste).
// Les niveaux d'apprentissage gardent leur nombre d'aiguilles (3 à 5).
const path = require('path'), fs = require('fs');
const { pool } = require('./pool');
const { load, ROOT } = require('./load');
const arg = (k, d) => { const a = process.argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const FROM = +arg('from', 1), TO = +arg('to', 300), M = +arg('trials', 200), M30 = +arg('trials30', 300), ITERS = +arg('iters', 7);
const ENDLESS = +arg('endless', 0), WRITE = process.argv.includes('--write'), FRESH = process.argv.includes('--fresh');
const ONLY = arg('only', '') ? arg('only', '').split(',').map(Number) : null;
// --target=n:T,… : cible à 70 ms imposée pour ces niveaux (reprise d'une falaise contre la moyenne de ses voisins)
const TGT = {}; for (const x of arg('target', '').split(',').filter(Boolean)) { const [n, T] = x.split(':'); TGT[+n] = +T; }
const SEEDS = JSON.parse(fs.readFileSync(path.join(__dirname, 'seeds.json'), 'utf8'));
const G = load(), D = G.get('DIFFICULTY'), TEACH = G.get('TEACH'), IMPL = new Set(G.get('IMPL'));
const OFF = [.09, .07, .02, .01, 0, -.01, -.02, -.03, -.04, -.05];
const FLOOR30 = [.95, .90, .85, .82, .80, .80, .80];
const isTeach = n => !!(TEACH[n] && IMPL.has(TEACH[n]));
// plafond de durée d'un niveau propre (45 ms) : maximum de son monde (plan 5.10), 1,5 × pour un boss ; marge DURK
const DURMAX = [15, 18, 22, 24, 28, 30, 30], DURK = .92, durCap = n => DURMAX[worldOf(n)] * (n % 10 === 0 ? 1.5 : 1);
function target70(n) {
  if (TGT[n] !== undefined) return TGT[n];
  if (n > 300) return .26;
  const w = Math.floor((n - 1) / 50), k = (n - 1) % 50, [a, b] = D.worldTargets70[w], line = a + (b - a) * k / 49;
  let T = line + OFF[k % 10];
  if (isTeach(n)) T = Math.max(T, line + .12);
  return Math.min(.995, Math.max(.05, T));
}
const worldOf = n => Math.min(6, Math.floor((n - 1) / 50));
// niveau généré avec un réglage donné (sans toucher au réglage des autres niveaux)
function levelWith(n, f, dn) {
  const cur = D.tune[n];
  G.run(`DIFFICULTY.tune[${n}] = [${f}, ${dn}]`);
  const l = G.makeLevel(n);
  G.run(cur ? `DIFFICULTY.tune[${n}] = ${JSON.stringify(cur)}` : `delete DIFFICULTY.tune[${n}]`);
  return l;
}
// bornes du facteur de vitesse pour dn aiguilles en plus
function bounds(n, dn) {
  const l = levelWith(n, 1, dn), om = l.omega, wmax = D.worlds[Math.min(5, worldOf(n))].speed[1], wmin = D.worlds[Math.min(5, worldOf(n))].speed[0];
  const hi = isTeach(n) ? 1 : Math.max(1, Math.min(1.45, 1.15 * wmax / om));
  const lo = Math.min(hi, Math.max(.45, .6 * wmin / om));
  return { lo, hi, throws: l.throws };
}
const CHUNK = 40;
function jobs(n, f, dn, sigma, trials, key) {
  const o = [], base = (FRESH ? SEEDS.tune * 7 : SEEDS.tune) + n * 10007 + key * 1000003 + (dn + 5) * 77777;
  for (let i = 0; i < trials; i += CHUNK) o.push({ kind: 'aim', n, sigma, trials: Math.min(CHUNK, trials - i), seed0: base + i, tune: { [n]: [f, dn] } });
  return o;
}
async function measureAll(P, specs) {
  const all = [], own = [];
  specs.forEach((s, i) => { for (const j of jobs(s.n, s.f, s.dn, s.sigma, s.trials, s.key)) { all.push(j); own.push(i); } });
  const res = await P.run(all), out = specs.map(() => ({ w: 0, t: 0, T: [] }));
  res.forEach((r, i) => { out[own[i]].w += r.wins; out[own[i]].t += r.trials; out[own[i]].T.push(...r.T); });
  return out.map(x => ({ p: x.w / x.t, T: x.T }));
}
const median = a => { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const q3 = f => Math.floor(f * 1000 + 1e-9) / 1000;

(async () => {
  const t0 = Date.now(), P = pool();
  let ns = []; for (let n = FROM; n <= TO; n++) ns.push(n); for (let n = 301; n < 301 + ENDLESS; n++) ns.push(n);
  if (ONLY) ns = ONLY;
  const st = {};
  // f est arrondi au millième AVANT d'être mesuré : la valeur écrite dans config.js est exactement celle qui a été mesurée
  // (la vitesse des anneaux dépend de la vitesse réglée de l'astre : un facteur arrondi après coup peut donner un autre niveau)
  const reset = (s, dn, f) => { const b = bounds(s.n, dn); Object.assign(s, { dn, lo: b.lo, hi: b.hi, cap: b.hi, flo: b.lo, throws: b.throws, f: q3(Math.min(b.hi, Math.max(b.lo, f))), best: null, hist: [], done: false }); };
  for (const n of ns) {
    const cur = D.tune[n] || [1, 0], s = st[n] = { n, T: target70(n), F30: FLOOR30[worldOf(n)], tries: 0, log: [] };
    reset(s, isTeach(n) ? 0 : Math.max(0, cur[1]), cur[0]);
  }
  // passes sur une liste de niveaux : facteur réglé sur la cible à 70 ms, puis plancher à 30 ms
  async function passes(list) {
  for (let pass = 0; pass < 4; pass++) {
    for (let it = 0; it < ITERS; it++) {
      const act = list.filter(n => !st[n].done);
      if (!act.length) break;
      const p = await measureAll(P, act.map(n => ({ n, f: st[n].f, dn: st[n].dn, sigma: .07, trials: M, key: 1 })));
      act.forEach((n, i) => {
        const s = st[n], v = p[i].p; s.hist.push([+s.f.toFixed(4), +v.toFixed(3)]);
        if (!s.best || Math.abs(v - s.T) < Math.abs(s.best.p - s.T)) s.best = { f: s.f, p: v };
        const canUp = !isTeach(n) && s.dn < 5 && bounds(n, s.dn + 1).throws > s.throws;
        const canDown = !isTeach(n) && s.dn > -3 && s.throws > 3;
        // trop facile à la vitesse plafond : une aiguille de plus ; trop dur à la vitesse plancher : une de moins
        if (v > s.T + .04 && s.f >= s.cap * .999 && canUp && !s.noUp) { s.log.push(`+1 (facile au plafond, ${v.toFixed(2)})`); reset(s, s.dn + 1, s.f); return; }
        if (v < s.T - .04 && s.f <= s.flo + 1e-9 && canDown && !s.noDown) { s.log.push(`-1 (dur au plancher, ${v.toFixed(2)})`); reset(s, s.dn - 1, s.f); return; }
        if (Math.abs(v - s.T) <= .025 || (v >= s.T && s.f >= s.hi * .999 && (s.hi < s.cap * .999 || !canUp)) || (v <= s.T && s.f <= s.lo * 1.001)) { s.done = true; return; }
        // trop facile → plus vite ; trop dur → plus lent
        if (v > s.T) s.lo = Math.max(s.lo, s.f); else s.hi = Math.min(s.hi, s.f);
        const h = s.hist, k = h.length;
        let nf;
        if (k >= 2 && Math.abs(h[k - 1][1] - h[k - 2][1]) > .02 && h[k - 1][0] !== h[k - 2][0]) { const sl = (h[k - 1][1] - h[k - 2][1]) / (Math.log(h[k - 1][0]) - Math.log(h[k - 2][0])); nf = Math.exp(Math.log(s.f) + (s.T - v) / sl); }
        else nf = s.f * Math.exp(Math.max(-.3, Math.min(.3, (v - s.T) * 1.2)));
        // hors de l'intervalle : bissection ; encore trop facile avec le plafond pour borne : le plafond lui-même (sinon f s'en
        // approche sans jamais l'atteindre, et l'aiguille de plus n'arrive jamais)
        if (!(nf > s.lo && nf < s.hi)) nf = v > s.T && s.hi >= s.cap * .999 && nf >= s.hi ? s.cap : Math.sqrt(s.lo * s.hi);
        s.f = q3(Math.min(s.cap, Math.max(s.flo, nf)));
      });
      process.stderr.write(`passe ${pass + 1}, itération ${it + 1} : ${act.length} niveaux à régler, ${((Date.now() - t0) / 1000).toFixed(0)} s\n`);
    }
    for (const n of list) { const s = st[n]; if (s.best) { s.f = s.best.f; s.p70 = s.best.p; } }
    // plancher à 30 ms (niveaux réglés à nouveau pendant cette passe seulement) : sous le plancher, une aiguille de plus et
    // on règle de nouveau ; à défaut, plus lent
    const chk = list.filter(n => st[n].p30 === undefined || st[n].changed);
    const p30 = await measureAll(P, chk.map(n => ({ n, f: st[n].f, dn: st[n].dn, sigma: .03, trials: M30, key: 2 })));
    let redo = 0;
    for (const n of list) st[n].changed = false;
    chk.forEach((n, i) => {
      const s = st[n]; s.p30 = p30[i].p;
      if (s.p30 >= s.F30 || pass === 3) return;
      redo++;
      const canUp = !isTeach(n) && s.dn < 5 && bounds(n, s.dn + 1).throws > s.throws;
      s.changed = true;
      // l'aiguille de plus a empiré le plancher (bord saturé) : on revient en arrière et on ralentit
      if (s.lastUp && s.p30 < s.lastUp.p30) { s.log.push(`retour à ${s.lastUp.dn} (plancher 30 ms : ${s.p30.toFixed(2)})`); s.noUp = true; reset(s, s.lastUp.dn, s.lastUp.f * .9); s.T = Math.min(.995, s.lastUp.p70 + .06); s.lastUp = null; return; }
      if (canUp && !s.noUp && s.tries < 3) { s.tries++; s.log.push(`+1 (plancher 30 ms : ${s.p30.toFixed(2)})`); s.noDown = true; s.lastUp = { dn: s.dn, f: s.f, p30: s.p30, p70: s.p70 }; reset(s, s.dn + 1, s.f * .9); }
      else { s.log.push(`plus lent (plancher 30 ms : ${s.p30.toFixed(2)})`); s.T = Math.min(.995, s.p70 + .06); s.hi = s.f; s.lo = s.flo; s.f = q3(Math.max(s.flo, s.f * .88)); s.best = null; s.hist = []; s.done = false; }
    });
    process.stderr.write(`plancher à 30 ms : ${redo} niveau(x) repris\n`);
    if (!redo) break;
  }
  }
  await passes(ns);
  // durée d'un niveau propre (victoires à 45 ms, 100 essais) : au-delà de DURK × son plafond (plan 5.10 : maximum du monde,
  // 1,5 × pour un boss, 30 s dans COSMOS ∞), des aiguilles en moins (autant que la durée l'exige) et le facteur réglé à
  // nouveau, sans aiguille ajoutée ensuite (le plancher à 30 ms passe alors par un astre plus lent)
  for (let round = 0; round < 3; round++) {
    const p45 = await measureAll(P, ns.map(n => ({ n, f: st[n].f, dn: st[n].dn, sigma: .045, trials: 100, key: 4 })));
    ns.forEach((n, i) => { st[n].dur45 = median(p45[i].T); });
    const over = round < 2 ? ns.filter(n => !isTeach(n) && st[n].dur45 > DURK * durCap(n) && st[n].throws > 3) : [];
    if (!over.length) break;
    for (const n of over) {
      const s = st[n], k = Math.max(1, Math.ceil(s.throws * (1 - DURK * durCap(n) / s.dur45))), dn = s.dn - Math.min(k, s.throws - 3);
      s.log.push(`${dn - s.dn} (durée ${s.dur45.toFixed(1)} s, plafond ${durCap(n)} s)`); s.noUp = true; s.p30 = undefined; s.lastUp = null; reset(s, dn, s.f);
    }
    process.stderr.write(`durées : ${over.length} niveau(x) trop long(s) repris avec moins d'aiguilles : ${over.join(' ')}\n`);
    await passes(over);
  }
  P.close();
  const tune = {};
  for (const n of ns) { const s = st[n]; if (Math.abs(s.f - 1) > 1e-9 || s.dn) tune[n] = [q3(s.f), s.dn]; }
  const rows = ns.map(n => st[n]);
  fs.mkdirSync(path.join(ROOT, 'tests', 'out', 'sim'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'tests', 'out', 'sim', 'tune.json'), JSON.stringify(rows.map(s => ({ n: s.n, T: s.T, f: s.f, dn: s.dn, p70: s.p70, p30: s.p30, dur45: s.dur45, log: s.log, hist: s.hist })), null, 1));
  const off = rows.filter(s => Math.abs(s.p70 - s.T) > .05), low = rows.filter(s => s.p30 < s.F30);
  console.log(`tune : ${rows.length} niveaux, ${off.length} à plus de 5 points de leur cible à 70 ms, ${low.length} sous leur plancher à 30 ms ; plus faible à 30 ms : ${Math.min(...rows.map(s => s.p30)).toFixed(3)} — ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  for (const s of off.slice(0, 30)) console.log(`  niveau ${s.n} : ${(s.p70 * 100).toFixed(0)} % à 70 ms pour ${(s.T * 100).toFixed(0)} % visés (facteur ${s.f.toFixed(3)}, ${s.dn} aiguille(s), ${(s.p30 * 100).toFixed(0)} % à 30 ms)`);
  for (const s of low.slice(0, 30)) console.log(`  niveau ${s.n} : ${(s.p30 * 100).toFixed(0)} % à 30 ms (plancher ${s.F30 * 100})`);
  if (WRITE) {
    const cfgP = path.join(ROOT, 'js', 'config.js'); let cfg = fs.readFileSync(cfgP, 'utf8');
    const merged = Object.assign({}, D.tune);
    for (const n of ns) delete merged[n];
    Object.assign(merged, tune);
    const keys = Object.keys(merged).map(Number).sort((a, b) => a - b);
    const items = keys.map(k => `${k}: [${merged[k][0]}, ${merged[k][1]}]`), lines = [];
    for (let i = 0; i < items.length; i += 8) lines.push('    ' + items.slice(i, i + 8).join(', '));
    cfg = cfg.replace(/  tune: \{[^}]*\}/, `  tune: {\n${lines.join(',\n')}\n  }`);
    fs.writeFileSync(cfgP, cfg);
    console.log(`tune : DIFFICULTY.tune écrit dans js/config.js (${keys.length} niveaux réglés)`);
  }
})();
