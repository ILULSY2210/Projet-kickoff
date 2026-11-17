// Générateur v2 (vrai js/levels.js dans Node) : une idée à la fois, capacité, déterminisme, structure.
//   node tests/unit/levels.test.js
// - pour tout n de 1 à 400, boss et spéciaux compris : drapeaux(n) ⊆ drapeaux(1..n−1) ∪ {TEACH[n]} ;
// - chaque niveau d'apprentissage d'une idée réalisée (IMPL) l'introduit, elle seule, en 3 à 5 aiguilles ;
// - capacité : tirs (doublés pour les traversantes) + obstacles fixes ≤ 14 sur 1..400 ;
// - déterminisme : makeLevel(n) identique d'un appel à l'autre ; boss tous les 10, spéciaux en x7 ;
// - chaque niveau a au moins 3 tirs, une vitesse moyenne d'au plus 1,3 × la vitesse de fin de son monde (réglage compris).
const { load } = require('../sim/load');
const G = load();
const fails = [], check = (c, m) => { if (!c) fails.push(m); };
const TEACH = G.get('TEACH'), IMPL = new Set(G.get('IMPL')), mk = G.makeLevel, cap = G.get('DIFFICULTY').capacity;
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
  const wmax = G.get('DIFFICULTY').worlds[Math.min(5, Math.floor((n - 1) / 50))].speed[1];
  check(L.omega > .4 && L.omega <= 1.3 * wmax * 1.002, `niveau ${n} : vitesse moyenne ${L.omega} (au plus 1,3 × ${wmax})`);
}
for (const k in TEACH) if (IMPL.has(TEACH[k])) check(intro[TEACH[k]] === +k, `« ${TEACH[k]} » apparaît au niveau ${intro[TEACH[k]]}, apprise au niveau ${k}`);
console.log('idées introduites : ' + Object.entries(intro).map(([k, v]) => `${k} ${v}`).join(', '));
if (fails.length) { console.log('levels : ÉCHEC\n  ' + fails.slice(0, 30).join('\n  ') + (fails.length > 30 ? `\n  … ${fails.length} au total` : '')); process.exit(1); }
console.log('levels : pass (1..400)');
