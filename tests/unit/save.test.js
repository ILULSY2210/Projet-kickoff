// Sauvegarde v2 et migration de la version 1 (js/store.js, vrai code, dans Node avec un localStorage simulé).
//   node tests/unit/save.test.js
// - migration : ancien unlocked 150 → unlocked 150, aucune étoile, legacyStars = ancien total, son conservé, CONTINUER →
//   niveau 1 (premier niveau d'apprentissage non fini) ; anciennes clés laissées en place ; sauvegarde v2 écrite ;
// - valeurs corrompues (texte, nombres absurdes, objets cassés, JSON invalide) : aucune exception, valeurs par défaut,
//   unlocked borné (1 .. 300 à la migration, 1 .. 100 000 ensuite) ;
// - aller-retour : une victoire est écrite et relue ; un joueur ordinaire continue au niveau débloqué.
const vm = require('vm'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const SRC = ['js/config.js', 'js/util.js', 'js/levels.js', 'js/store.js'].map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n;\n');
function boot(init) {
  const mem = Object.assign({}, init || {});
  const ls = { getItem: k => k in mem ? mem[k] : null, setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } };
  const ctx = { console, Math, JSON, Date, localStorage: ls, addEventListener() {} };
  ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext(SRC + '\n;var __g = k => eval(k);', ctx);
  return { g: ctx.__g, mem };
}
const fails = [], check = (c, m) => { if (!c) fails.push(m); };
// 1. vraie sauvegarde v1 à 150
{
  const old = { orbita_unlocked: '150', orbita_stars: JSON.stringify({ 1: 3, 2: 2, 3: 3, 10: 1, 149: 2 }), orbita_sound: 'false' };
  const { g, mem } = boot(old);
  check(g('unlocked') === 150, `migration : unlocked ${g('unlocked')} (150)`);
  check(Object.keys(g('bestStars')).length === 0, 'migration : aucune étoile attribuée');
  check(g('SAVE').legacyStars === 11, `migration : legacyStars ${g('SAVE').legacyStars} (11)`);
  check(g('soundOn') === false, 'migration : son coupé conservé');
  check(g('continueLevel()') === 1, `migration : CONTINUER → niveau ${g('continueLevel()')} (1)`);
  check(mem.orbita_unlocked === '150' && mem.orbita_stars === old.orbita_stars, 'migration : anciennes clés laissées en place');
  const sv = JSON.parse(mem.orbita_save || 'null');
  check(sv && sv.v === 2 && sv.gen === 2 && sv.progress.unlocked === 150 && sv.meta.migrated === 1, 'migration : sauvegarde v2 écrite');
  // relecture : la migration ne se refait pas, et une victoire est gardée
  const b = boot(mem);
  b.g('bestStars[1] = 2; unlocked = 150; saveNow()');
  const c = boot(b.mem);
  check(c.g('bestStars[1]') === 2 && c.g('SAVE.legacyStars') === 11 && c.g('unlocked') === 150, 'relecture après migration et victoire');
  check(c.g('continueLevel()') === 2, `après le niveau 1, CONTINUER → niveau ${c.g('continueLevel()')} (2, deuxième niveau d'apprentissage)`);
}
// 1 bis. CONTINUER ne propose que des niveaux qui enseignent déjà une idée réalisée (teachOf) : migré à 160, 1-4 finis
{
  const { g } = boot({ orbita_unlocked: '160' });
  g('for (let i = 1; i <= 4; i++) bestStars[i] = 1');
  const seq = []; for (let i = 0; i < 12; i++) { const n = g('continueLevel()'); seq.push(n); g(`bestStars[${n}] = 1`); }
  check(seq.every(n => g(`teachOf(${n})`)), `CONTINUER après migration : niveaux sans idée nouvelle proposés (${seq.join(' ')})`);
  check(seq[0] === 9, `CONTINUER après migration, 1-4 finis → niveau ${seq[0]} (9, accélération)`);
}
// 2. au-delà de 300 : borné à 300 à la migration
{ const { g } = boot({ orbita_unlocked: '500000' }); check(g('unlocked') === 300, `migration d'un unlocked absurde → ${g('unlocked')} (300)`); }
// 3. valeurs corrompues
const bad = [
  { orbita_unlocked: '"abc"', orbita_stars: '"x"', orbita_sound: '"oui"' },
  { orbita_unlocked: '-3', orbita_stars: '[1,2,3]', orbita_sound: '1' },
  { orbita_unlocked: '{', orbita_stars: '{', orbita_sound: '{' },
  { orbita_unlocked: 'null', orbita_stars: JSON.stringify({ 4: 99, 5: -1, x: 2, 6: '3' }) },
  { orbita_save: '{"v":2,"progress":{"unlocked":"12"},"levels":{"3":{"stars":7},"abc":{"stars":2},"4":5},"settings":{"sfx":"no"},"legacyStars":-4}' },
  { orbita_save: '{"v":2,"progress":{"unlocked":1e9}}' },
  { orbita_save: '{"v":2,"progress":null,"levels":[1,2]}' },
  { orbita_save: '"texte"', orbita_unlocked: '7' },
  { orbita_save: '{' }
];
for (const [i, init] of bad.entries()) {
  try {
    const { g } = boot(init);
    const u = g('unlocked');
    check(Number.isInteger(u) && u >= 1 && u <= 100000, `corrompu ${i} : unlocked ${u}`);
    check(typeof g('soundOn') === 'boolean', `corrompu ${i} : soundOn booléen`);
    const bs = g('bestStars');
    check(Object.entries(bs).every(([k, v]) => +k >= 1 && v >= 1 && v <= 3), `corrompu ${i} : étoiles valides ${JSON.stringify(bs)}`);
    check(g('continueLevel()') >= 1, `corrompu ${i} : CONTINUER`);
    g('saveNow()');
  } catch (e) { fails.push(`corrompu ${i} : exception ${e.message}`); }
}
{ const { g } = boot(bad[3]); check(g('SAVE.legacyStars') === 3, `étoiles v1 partiellement invalides : legacyStars ${g('SAVE.legacyStars')} (3)`); }
{ const { g } = boot(bad[7]); check(g('unlocked') === 7, `sauvegarde v2 illisible, clés v1 présentes : migration (${g('unlocked')})`); }
// 4. joueur neuf, puis joueur ordinaire
{
  const { g, mem } = boot();
  check(g('unlocked') === 1 && g('continueLevel()') === 1 && g('soundOn') === true, 'joueur neuf : niveau 1, son actif');
  g('for (let i = 1; i <= 22; i++) bestStars[i] = 1; unlocked = 23; saveNow()');
  const b = boot(mem);
  check(b.g('continueLevel()') === 23, `joueur ordinaire : CONTINUER → ${b.g('continueLevel()')} (23)`);
}
// 5. valeurs limites (recette de l'étape 2, Q8) : « 1e400 » n'ouvre pas tout ; une progression illisible avec des étoiles
//    rouvre jusqu'au niveau qui suit le dernier niveau étoilé
{ const { g } = boot({ orbita_unlocked: '1e400' }); check(g('unlocked') === 1, `v1 unlocked « 1e400 » : unlocked ${g('unlocked')} (1)`); }
for (const u of ['9', 12.5, -3, null]) {
  const { g } = boot({ orbita_save: JSON.stringify({ v: 2, gen: 2, progress: { unlocked: u }, levels: { 4: { stars: 2 }, 2: { stars: 1 } } }) });
  check(g('unlocked') === 5 && g('bestStars[4]') === 2, `v2 unlocked ${JSON.stringify(u)} avec étoiles jusqu'au 4 : unlocked ${g('unlocked')} (5)`);
}
// 6. compteurs d'étoiles au-delà du niveau 300 : COSMOS ∞ compte tous les niveaux > LAST_LEVEL
{
  const { g } = boot();
  g('for (let i = 1; i <= 449; i++) bestStars[i] = 3');
  check(g('worldStars(0)') === 150 && g('worldStars(5)') === 150, `mondes 1 et 6 : ${g('worldStars(0)')}, ${g('worldStars(5)')} (150)`);
  check(g('worldStars(WORLDS.length)') === 3 * (449 - 300), `COSMOS ∞ : ${g('worldStars(WORLDS.length)')} (${3 * 149})`);
}
if (fails.length) { console.log('save : ÉCHEC\n  ' + fails.join('\n  ')); process.exit(1); }
console.log('save : pass');
