// ORBITA · store.js — sauvegarde locale versionnée (v2) et migration de la version 1.
// Clé principale orbita_save (JSON) :
//   { v: 2, gen: 2, progress: { unlocked }, legacyStars, settings: { sfx }, levels: { "n": { stars } }, meta: { created, updated } }
// Les étapes suivantes n'ajoutent que des champs (une sauvegarde plus ancienne en est simplement dépourvue).
// Version 1 (clés orbita_unlocked, orbita_stars, orbita_sound) : migrée une fois, sans étoile offerte (les anciens numéros
// ne désignent plus les mêmes niveaux) ; l'ancien total d'étoiles devient legacyStars ; les anciennes clés restent en place.
const store = {
  get(k, d) { try { const v = localStorage.getItem('orbita_' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('orbita_' + k, JSON.stringify(v)); return true; } catch (e) { return false; } }
};
const isObj = o => !!o && typeof o === 'object' && !Array.isArray(o);
const intIn = (v, a, b) => typeof v === 'number' && isFinite(v) && Math.floor(v) === v && v >= a && v <= b;
function freshSave() {
  const now = Date.now();
  return { v: SAVE_VERSION, gen: GEN_VERSION, progress: { unlocked: 1 }, legacyStars: 0, settings: { sfx: true }, levels: {}, meta: { created: now, updated: now } };
}
// lecture défensive : tout champ absent ou invalide prend sa valeur par défaut, sans exception
function validSave(o) {
  const S = freshSave();
  if (!isObj(o)) return S;
  if (isObj(o.progress) && intIn(o.progress.unlocked, 1, MAX_UNLOCK)) S.progress.unlocked = o.progress.unlocked;
  if (intIn(o.legacyStars, 0, 3 * MAX_UNLOCK)) S.legacyStars = o.legacyStars;
  if (isObj(o.settings) && typeof o.settings.sfx === 'boolean') S.settings.sfx = o.settings.sfx;
  if (isObj(o.levels)) for (const k in o.levels) {
    const n = +k, x = o.levels[k];
    if (intIn(n, 1, MAX_UNLOCK) && isObj(x)) { const y = Object.assign({}, x); if (!intIn(y.stars, 0, 3)) delete y.stars; S.levels[n] = y; }
  }
  if (isObj(o.meta)) { if (intIn(o.meta.created, 0, 1e15)) S.meta.created = o.meta.created; if (o.meta.migrated) S.meta.migrated = 1; }
  for (const k in o) if (!(k in S)) S[k] = o[k];   // champs d'une version plus récente : conservés tels quels
  return S;
}
// migration de la version 1 : accès gardé jusqu'à l'ancien niveau débloqué (borné à 300), aucune étoile attribuée
function migrateV1() {
  const u = store.get('unlocked', null), st = store.get('stars', null), so = store.get('sound', null);
  if (u == null && st == null && so == null) return null;
  const S = freshSave();
  const un = Math.floor(+u);
  S.progress.unlocked = un >= 1 ? Math.min(un, LAST_LEVEL) : 1;
  let tot = 0;
  if (isObj(st)) for (const k in st) { const v = Math.floor(+st[k]); if (intIn(+k, 1, MAX_UNLOCK) && v >= 1 && v <= 3) tot += v; }
  S.legacyStars = tot;
  if (typeof so === 'boolean') S.settings.sfx = so;
  S.meta.migrated = 1;
  return S;
}
function loadSave() {
  const raw = store.get('save', null);
  if (isObj(raw) && raw.v >= SAVE_VERSION) return validSave(raw);
  const m = migrateV1();
  if (m) store.set('save', m);
  return m || freshSave();
}
let SAVE = loadSave();
// vues utilisées par l'interface et le banc d'essai (contrat de test) : unlocked, bestStars[n] (0..3), soundOn
let unlocked = SAVE.progress.unlocked, bestStars = {}, soundOn = SAVE.settings.sfx;
for (const k in SAVE.levels) if (SAVE.levels[k].stars) bestStars[k] = SAVE.levels[k].stars;
// écriture : recopie les vues dans la sauvegarde puis l'écrit (try/catch : quota, navigation privée)
function saveNow() {
  SAVE.progress.unlocked = intIn(unlocked, 1, MAX_UNLOCK) ? unlocked : clamp(Math.floor(+unlocked) || 1, 1, MAX_UNLOCK);
  SAVE.settings.sfx = !!soundOn;
  for (const k in bestStars) {
    const n = +k, s = Math.floor(+bestStars[k]);
    if (intIn(n, 1, MAX_UNLOCK) && s >= 1 && s <= 3) (SAVE.levels[n] || (SAVE.levels[n] = {})).stars = s;
  }
  SAVE.meta.updated = Date.now();
  return store.set('save', SAVE);
}
// niveau proposé par CONTINUER : le premier niveau d'apprentissage pas encore fini avant le niveau débloqué, sinon ce
// dernier (un ancien joueur migré au niveau 150 revoit d'abord les mécaniques d'Émeraude et d'Ambre)
function continueLevel() {
  for (const k in TEACH) { const n = +k; if (n > unlocked) break; if (!(bestStars[n] >= 1) && n < unlocked) return n; }
  return unlocked;
}
// total d'étoiles d'un monde (sur 150) et de toute la progression
function worldStars(w) { const a = firstOfWorld(w), b = a + LEVELS_PER_WORLD; let s = 0; for (let n = a; n < b; n++) s += +bestStars[n] || 0; return s; }

// abonnements aux événements du cœur (appelé une fois par main.js)
function bindStore() {
  bus.on('win', (lv, stars) => {
    const n = lv.n;
    if (stars > (bestStars[n] || 0)) bestStars[n] = stars;
    if (n + 1 > unlocked) unlocked = Math.min(MAX_UNLOCK, n + 1);
    saveNow();
  });
  addEventListener('pagehide', saveNow);
}
