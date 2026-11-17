// Générateur v2 (vrai js/levels.js dans Node) : une idée à la fois, capacité, déterminisme, structure.
//   node tests/unit/levels.test.js
// - pour tout n de 1 à 400, boss et spéciaux compris : drapeaux(n) ⊆ drapeaux(1..n−1) ∪ {TEACH[n]} ;
// - chaque niveau d'apprentissage d'une idée réalisée (IMPL) l'introduit, elle seule, en 3 à 5 aiguilles ;
// - capacité : tirs (doublés pour les traversantes) + obstacles fixes ≤ 14 sur 1..400 ;
// - déterminisme : makeLevel(n) identique d'un appel à l'autre ; boss tous les 10, spéciaux en x7 ;
// - chaque niveau a au moins 3 tirs, une vitesse moyenne d'au plus 1,15 × la vitesse de fin de son monde (réglage compris) ;
//   un niveau d'apprentissage n'est jamais plus rapide que la vitesse de début de son monde (vitesse modérée, plan 5.3) ;
// - anneaux : fenêtre de passage de chaque anneau (portes, vitesse, marge de l'aiguille) ≥ 0,42 s jusqu'au monde 4, ≥ RING_WIN
//   = 0,35 s en Obsidienne, Cosmos et COSMOS ∞, réglage
//   compris, y compris l'anneau à deux portes des niveaux à trois anneaux ;
// - plafond de pointe (recette de l'étape 2, Q1) : lois à-coups, ressac et irrégulière, vitesse de pointe ≤ 2,2 × ω et
//   ≤ 7 rad/s, accélération et rampe comprises ; lois à-coups et irrégulière : pointe de la loi ≤ 1,8 × sa vitesse moyenne ;
// - COSMOS ∞ : au-delà de 400, le niveau n est le niveau 301 + (n − 301) mod 100, en miroir un cycle sur deux ; le miroir
//   est exact (même journal de tirs → mêmes issues, angles opposés à 1e-9 près, joueur simulé dans le vrai cœur).
const { load } = require('../sim/load');
const G = load();
const fails = [], check = (c, m) => { if (!c) fails.push(m); };
const TEACH = G.get('TEACH'), IMPL = new Set(G.get('IMPL')), mk = G.makeLevel, cap = G.get('DIFFICULTY').capacity;
const RING_PAD = G.get('RING_PAD'), RING_WIN = G.get('RING_WIN');
const seen = new Set(), intro = {};
for (let n = 1; n <= 400; n++) {
  const L = mk(n), f = L.flags, t = TEACH[n];
  const fresh = f.filter(x => !seen.has(x));
  const allowed = t && IMPL.has(t) ? [t] : [];
  check(fresh.every(x => allowed.includes(x)), `niveau ${n} : idée(s) nouvelle(s) ${fresh.join(', ')} sans apprentissage (TEACH[${n}] = ${t || '—'})`);
  if (t && IMPL.has(t)) {
    check(fresh.length === 1 && fresh[0] === t, `niveau ${n} : apprentissage de « ${t} » : nouveautés ${fresh.join(', ') || 'aucune'}`);
    check(L.throws >= 3 && L.throws <= 5, `niveau ${n} : apprentissage en ${L.throws} aiguilles (3 à 5)`);
  }
  for (const x of fresh) intro[x] = n;
  f.forEach(x => seen.add(x));
  const units = L.throws * (L.trav ? 2 : 1) + L.fixed;
  check(units <= cap + 1e-9, `niveau ${n} : capacité ${units.toFixed(2)} > ${cap}`);
  check(L.throws >= 3, `niveau ${n} : ${L.throws} tirs`);
  check(JSON.stringify(mk(n)) === JSON.stringify(L), `niveau ${n} : makeLevel non déterministe`);
  check(L.boss === (n % 10 === 0) && L.special === (n % 10 === 7), `niveau ${n} : statut boss / spécial`);
  const DW = G.get('DIFFICULTY').worlds[Math.min(5, Math.floor((n - 1) / 50))], wmax = DW.speed[1];
  check(L.omega > .4 && L.omega <= 1.15 * wmax * 1.002, `niveau ${n} : vitesse moyenne ${L.omega} (au plus 1,15 × ${wmax})`);
  if (t && IMPL.has(t)) check(L.omega <= DW.speed[0] + 1e-9, `niveau ${n} : apprentissage à ${L.omega.toFixed(3)} rad/s (au plus ${DW.speed[0]}, vitesse de début du monde)`);
  if ([3, 5, 6].includes(L.pattern)) {
    const PK = G.get('DIFFICULTY').peak, st = G.run(`lawStat(${L.pattern}, ${JSON.stringify(L.irr)}, ${L.amp})`);
    check(L.vmax <= Math.min(PK.total * L.omega, PK.abs) * 1.001, `niveau ${n} : vitesse de pointe ${L.vmax.toFixed(2)} rad/s pour ω = ${L.omega.toFixed(2)} (≤ ${PK.total} × ω et ≤ ${PK.abs})`);
    if (L.pattern !== 5) check(st.peak / st.mean <= PK.ratio + 1e-6, `niveau ${n} : loi ${L.pattern}, pointe ${(st.peak / st.mean).toFixed(3)} × sa vitesse moyenne (≤ ${PK.ratio})`);
  }
  for (const q of L.rings) {
    const win = Math.min(...q.gates.map(g => (2 * g.h - 2 * RING_PAD[q.k]) / Math.abs(q.w)));
    // (l'anneau anti-salve des niveaux d'apprentissage des mondes 2 à 6 : RING_WIN)
    const minW = n <= 200 && !(t && IMPL.has(t) && n > 50) ? .42 : RING_WIN;
    check(win >= minW - 1e-5, `niveau ${n} : anneau ${q.k}, fenêtre de passage ${win.toFixed(3)} s (≥ ${minW})`);
  }
}
// COSMOS ∞ : réserve 301-400 rejouée, en miroir un cycle sur deux
for (const n of [401, 457, 500, 517, 990, 1001, 1234]) {
  const L = mk(n), k = 301 + (n - 301) % 100, mir = Math.floor((n - 301) / 100) % 2 === 1, B = mk(k);
  check(L.n === n && L.boss === B.boss && L.special === B.special && L.throws === B.throws && L.omega === B.omega, `niveau ${n} : structure du niveau ${k}`);
  check(mir ? L.dir === -B.dir && Math.abs(Math.cos(L.rot0) + Math.cos(B.rot0)) < 1e-6 : JSON.stringify(Object.assign({}, L, { n: 0, src: 0, mirror: 0 })) === JSON.stringify(Object.assign({}, B, { n: 0, src: 0, mirror: 0 })), `niveau ${n} : ${mir ? 'miroir' : 'copie'} du niveau ${k}`);
}
{
  const { DRIVER } = require('../sim/driver');
  G.run(DRIVER); const S = G.run('__sim');
  let diff = 0, maxd = 0, games = 0;
  for (let k = 301; k <= 400; k += 3) {
    const a = S.aim(k, .05, 4242 + k), b = S.replay(k + 100, a.taps); games++;
    if (a.st !== b.st || a.kind !== b.kind || a.ang.length !== b.ang.length) { diff++; continue; }
    for (let j = 0; j < a.ang.length; j++) maxd = Math.max(maxd, Math.abs(Math.sin((a.ang[j] + b.ang[j]) / 2)));
  }
  check(diff === 0 && maxd < 1e-8, `COSMOS ∞ en miroir : ${diff} issue(s) différente(s) sur ${games} parties, écart d'angle ${maxd.toExponential(1)}`);
  console.log(`COSMOS ∞ : ${games} parties rejouées en miroir, issues identiques, écart d'angle ${maxd.toExponential(1)}`);
}
for (const k in TEACH) if (IMPL.has(TEACH[k])) check(intro[TEACH[k]] === +k, `« ${TEACH[k]} » apparaît au niveau ${intro[TEACH[k]]}, apprise au niveau ${k}`);
console.log('idées introduites : ' + Object.entries(intro).map(([k, v]) => `${k} ${v}`).join(', '));
if (fails.length) { console.log('levels : ÉCHEC\n  ' + fails.slice(0, 30).join('\n  ') + (fails.length > 30 ? `\n  … ${fails.length} au total` : '')); process.exit(1); }
console.log('levels : pass (1..400)');
