// ORBITA · config.js — constantes et tables de données (aucune dépendance au DOM).
const TAU = Math.PI * 2, HPI = Math.PI / 2;
const GAP = .115, ORBHIT = .2, GS = .5, TILT = 1.02;
// pas fixe de la simulation (s) : update(dt) avance en pas de STEP, la boucle n'appelle que update(STEP)
const STEP = 1 / 120;
const ALERT = [255, 59, 82], INK = '#04070a';

/* ---------- mondes ---------- */
const WORLDS = [
  { name: 'ÉMERAUDE', rgb: [77, 255, 166], hi: [230, 255, 242], acc: [255, 211, 92], root: 62, scale: [0, 2, 4, 7, 9], rule: 'UN TIR, UNE AIGUILLE' },
  { name: 'AMBRE', rgb: [255, 178, 62], hi: [255, 244, 222], acc: [159, 232, 255], root: 57, scale: [0, 3, 5, 7, 10], rule: 'LA ROTATION S’INVERSE' },
  { name: 'GIVRE', rgb: [127, 212, 255], hi: [236, 249, 255], acc: [255, 207, 122], root: 60, scale: [0, 2, 4, 6, 7, 9, 11], rule: 'ARC PLEIN = ZONE INTERDITE' },
  { name: 'BRAISE', rgb: [255, 122, 80], hi: [255, 238, 228], acc: [255, 233, 163], root: 52, scale: [0, 1, 4, 5, 7, 8, 10], rule: 'ROTATION PAS À PAS' },
  { name: 'IRIS', rgb: [180, 155, 255], hi: [241, 236, 255], acc: [157, 255, 208], root: 55, scale: [0, 2, 3, 5, 7, 9, 10], rule: 'SENTINELLE EN ORBITE' },
  { name: 'SOUFRE', rgb: [226, 248, 74], hi: [250, 255, 224], acc: [217, 204, 255], root: 58, scale: [0, 2, 4, 6, 8, 10], rule: 'AIGUILLES TRAVERSANTES' },
  { name: 'OPALE', rgb: [222, 240, 232], hi: [255, 255, 255], acc: [255, 200, 97], root: 65, scale: [0, 2, 4, 7, 9], rule: 'ARCS ET SENTINELLES' },
  { name: 'COBALT', rgb: [104, 148, 255], hi: [230, 237, 255], acc: [255, 217, 138], root: 57, scale: [0, 2, 3, 7, 8], rule: 'TOUT À LA FOIS' }
];
const SOLIDS = ['ico', 'saturne', 'cristal', 'tesseract', 'dodeca', 'stella', 'armille', 'cubocta'];
const ROMAN = ['', ' II', ' III', ' IV', ' V', ' VI', ' VII', ' VIII', ' IX', ' X'];

const PAT_NAME = ['CONTINU', 'RESPIRATION', 'ALTERNÉE', 'À-COUPS', 'PAS À PAS', 'RESSAC'];
// [rythme, dosage (0 = dense et lent, 1 = rapide et aéré), disposition, sentinelles, traversantes]
const SPEC = [
  [[0, .5, 'none'], [0, .5, 'scatter'], [0, .6, 'scatter'], [1, .4, 'scatter'], [1, .3, 'sym']],
  [[2, .5, 'scatter'], [0, .9, 'fan'], [2, .3, 'pairs'], [1, .6, 'scatter'], [2, .3, 'sym']],
  [[3, .5, 'wall'], [0, .7, 'wall+'], [3, .3, 'scatter'], [2, .4, 'pairs'], [3, .3, 'wall2']],
  [[4, .5, 'scatter'], [1, .8, 'fan'], [4, .3, 'pairs'], [3, .5, 'wall'], [4, .3, 'sym']],
  [[0, .5, 'scatter', 1], [1, .5, 'pairs', 1], [5, .4, 'fan', 1], [2, .4, 'wall', 1], [5, .3, 'sym', 2]],
  [[0, .5, 'none', 0, 1], [1, .5, 'scatter', 0, 1], [5, .5, 'scatter', 0, 1], [4, .4, 'scatter', 0, 1], [2, .4, 'sym', 0, 1]],
  [[5, .5, 'wall'], [3, .5, 'pairs', 1], [4, .4, 'wall+'], [2, .4, 'fan', 2], [3, .3, 'wall2', 2]],
  [[1, .5, 'none', 1, 1], [2, .2, 'pairs'], [4, .5, 'scatter', 0, 1], [5, .5, 'wall', 2], [2, .4, 'scatter', 1, 1]]
];
