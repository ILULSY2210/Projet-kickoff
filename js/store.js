// ORBITA · store.js — sauvegarde locale (version 1, inchangée).
/* ---------- sauvegarde ---------- */
const store = {
  get(k, d) { try { const v = localStorage.getItem('orbita_' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('orbita_' + k, JSON.stringify(v)); } catch (e) {} }
};
let unlocked = store.get('unlocked', 1);
let bestStars = store.get('stars', {});
let soundOn = store.get('sound', true);
if (!(unlocked >= 1)) unlocked = 1;
if (!bestStars || typeof bestStars !== 'object') bestStars = {};
