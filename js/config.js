// ORBITA · config.js — constantes et tables de données (aucune dépendance au DOM).
const TAU = Math.PI * 2, HPI = Math.PI / 2;
const GAP = .115, ORBHIT = .2, GS = .5, TILT = 1.02;
// pas fixe de la simulation (s) : update(dt) avance en pas de STEP, la boucle n'appelle que update(STEP)
const STEP = 1 / 120;
// vol : durée constante et positions physiques u (0 = pas de tir, 1 = contact avec l'astre), les mêmes sur tous les écrans,
// relevées sur la mise en page de référence 390×844. L'aiguille mesure U.len (pointe en u, extrémité de la tête en u − U.len).
const FLIGHT = .060;
const U = { len: .24, head: .76, sentIn: .73, sent: .71, sentOut: .69, dial: .66, rings: [.62, .57, .52] };
// anneaux à portes : demi-largeur angulaire de l'aiguille (tête + demi-épaisseur de l'anneau) au rayon de chaque anneau,
// relevée sur la mise en page de référence 390×844 (une porte doit contenir l'axe de tir ± RING_PAD pendant la traversée)
const RING_PAD = [.048, .044, .041];
// fenêtre de passage commune minimale des anneaux (s)
const RING_WIN = .42;
// marge angulaire des sentinelles (rad) : bout arrondi de leur trait + demi-épaisseur de la tige, mesurée en 390×844
const SENT_PAD = .038;
// tête de l'aiguille en vol (disque) contre une sentinelle. UREF : rayons dessinés de la mise en page de référence 390×844
// aux positions u de la carte, rapportés au rayon RS de l'orbite des sentinelles ; HEAD_REF : rayon de la tête / RS ;
// SENT_PAD_HEAD : demi-épaisseur des sentinelles + rayon de la tête, / RS (rad). Le centre de la tête en vol suit UREF
// (extrémité de la tête en u − U.len, centre HEAD_REF plus près de l'astre) : contact dessiné ⇔ interception en 390×844.
const UREF = [[0, 2.37475], [U.rings[2], 1.39799], [U.rings[1], 1.29166], [U.rings[0], 1.18534], [U.dial, 1.11350], [U.sentOut, 1.03245], [U.sent, 1], [U.sentIn, .96755], [U.head, .88884], [1, .42026]];
const HEAD_REF = .04833, SENT_PAD_HEAD = .08078;
// compte à rebours de REPRENDRE (s) : rotation figée, tirs ignorés
const COUNTDOWN = .6;
// échec : feuille à 0,45 s (taps ignorés avant) ; après une relance par tap, tirs ignorés 0,25 s ; cause rappelée 1,2 s
const FAIL_SHEET = .45, RETRY_LOCK = .25, RECALL = 1.2;
// bandeau de règle d'un niveau d'apprentissage : affiché TEACH_SHOW s (après le bandeau du monde), sans être écourté par un tir
const TEACH_SHOW = 2.6;
// chevrons de direction au pas de tir : arrêt (|v| < STOP_V × vmax) ou inversion annoncés AHEAD s à l'avance
const AHEAD = .45, STOP_V = .12;
const INK = '#04070a', INK_RGB = [4, 7, 10];

/* ---------- structure : 6 mondes de 50 niveaux (1..300), puis COSMOS ∞ (301 et suivants) ---------- */
const GEN_VERSION = 2, SAVE_VERSION = 2, LEVELS_PER_WORLD = 50, BOSS_EVERY = 10, LAST_LEVEL = 300, MAX_UNLOCK = 100000;
// Chaque monde fixe 4 couleurs : trait principal (rgb), blanc chaud (hi : aiguilles, chiffres), accent (acc : étoiles,
// FRÔLÉ) et alerte (collision) ; son solide, sa gamme, et son ambiance (amb : lueur du fond, trame, rémanence du phosphore).
// Obsidienne : #b48cff, ou #9a6bff au choix du porteur du projet (planche docs/reference/obsidienne-violets.png).
const WORLDS = [
  { id: 'emeraude', name: 'ÉMERAUDE', theme: 'DÉCOUVERTE', rgb: [77, 255, 166], hi: [230, 255, 242], acc: [255, 211, 92], alert: [255, 59, 82],
    solid: 'ico', root: 62, scale: [0, 2, 4, 7, 9], amb: { glow: .1, grid: .2, decay: .042 } },
  { id: 'ambre', name: 'AMBRE', theme: 'ACCÉLÉRATION', rgb: [255, 178, 62], hi: [255, 244, 222], acc: [159, 232, 255], alert: [255, 59, 82],
    solid: 'saturne', root: 57, scale: [0, 3, 5, 7, 10], amb: { glow: .1, grid: .2, decay: .042 } },
  { id: 'rubis', name: 'RUBIS', theme: 'PRÉCISION', rgb: [255, 79, 106], hi: [255, 238, 241], acc: [255, 211, 92], alert: [95, 243, 255],
    solid: 'cristal', root: 60, scale: [0, 2, 3, 5, 7, 8, 10], amb: { glow: .09, grid: .2, decay: .042 } },
  { id: 'saphir', name: 'SAPHIR', theme: 'ROTATIONS INVERSÉES', rgb: [74, 168, 255], hi: [234, 245, 255], acc: [255, 207, 122], alert: [255, 59, 82],
    solid: 'dodeca', root: 55, scale: [0, 2, 4, 6, 7, 9, 11], amb: { glow: .1, grid: .2, decay: .042 } },
  { id: 'obsidienne', name: 'OBSIDIENNE', theme: 'DIFFICULTÉ ÉLEVÉE', rgb: [180, 140, 255], hi: [241, 236, 255], acc: [157, 255, 208], alert: [255, 59, 82],
    solid: 'tesseract', root: 52, scale: [0, 1, 3, 5, 7, 8, 10], amb: { glow: .05, grid: .12, decay: .032 } },
  { id: 'cosmos', name: 'COSMOS', theme: 'DÉFIS EXTRÊMES', rgb: [223, 243, 255], hi: [255, 255, 255], acc: [255, 92, 207], alert: [255, 59, 82],
    solid: 'armille', root: 58, scale: [0, 2, 4, 6, 8, 10], amb: { glow: .08, grid: .16, decay: .042 } }
];
// variante d'Obsidienne soumise au choix du porteur (même ambiance, violet plus sombre)
const OBSIDIENNE_ALT = [154, 107, 255];
// COSMOS ∞ : palette de Cosmos, sans fin
const ENDLESS = { name: 'COSMOS ∞', theme: 'SANS FIN' };
// niveaux d'apprentissage : chacun introduit une seule idée nouvelle (plan, 5.3) ; leur bandeau reste relisible
const TEACH = { 1: 'lancer', 2: 'bloqueurs', 3: 'etoiles', 4: 'sens', 6: 'parfait', 7: 'pluie', 8: 'combo', 9: 'accel',
  11: 'respiration', 17: 'chrono', 19: 'demitour', 21: 'serre', 27: 'parfaitSp', 29: 'zone', 39: 'anneau', 49: 'irreg',
  51: 'acoups', 61: 'arrets', 71: 'rampe', 81: 'anneaux2', 101: 'fentes', 111: 'pulse', 121: 'glisse',
  151: 'alternee', 161: 'rythme', 171: 'invImpact', 181: 'ressac', 201: 'sentinelle', 211: 'traversantes', 221: 'sentinelles2',
  251: 'anneaux3', 261: 'portesPulsees' };
const SOLIDS = ['ico', 'saturne', 'cristal', 'tesseract', 'dodeca', 'stella', 'armille', 'cubocta'];
const ROMAN = ['', ' II', ' III', ' IV', ' V', ' VI', ' VII', ' VIII', ' IX', ' X'];

// noms des lois de rotation, accordés à « ROTATION » (bandeaux et HUD : « ROTATION » + nom) ; drapeau de chaque loi
const PAT_NAME = ['CONTINUE', 'RESPIRANTE', 'ALTERNÉE', 'PAR À-COUPS', 'PAS À PAS', 'EN RESSAC', 'IRRÉGULIÈRE'];
const LAW_FLAG = ['', 'respiration', 'alternee', 'acoups', 'arrets', 'ressac', 'irreg'];
// bandeau de chaque idée apprise : titre et règle (niveau d'apprentissage, pause, sélection des niveaux)
const TEACH_TEXT = {
  lancer: ['UN TAP, UNE AIGUILLE', 'PLANTE TOUTES TES AIGUILLES SANS CONTACT'],
  bloqueurs: ['AIGUILLES DÉJÀ PLANTÉES', 'ARC ALLUMÉ = ZONE LIBRE'],
  etoiles: ['ÉTOILES BONUS', 'PLANTE SOUS UNE ÉTOILE POUR LA PRENDRE'],
  sens: ['L’AUTRE SENS', 'L’ASTRE TOURNE DANS LES DEUX SENS'],
  accel: ['ACCÉLÉRATION', 'L’ASTRE ACCÉLÈRE À CHAQUE AIGUILLE'],
  respiration: ['RESPIRATION', 'LA VITESSE VARIE DOUCEMENT'],
  demitour: ['DEMI-TOUR ANNONCÉ', 'CHEVRONS QUI CLIGNOTENT = DEMI-TOUR'],
  serre: ['DISPOSITIONS SERRÉES', 'PAIRES ET ÉVENTAILS : VISE LES GRANDS ARCS'],
  zone: ['ZONE INTERDITE', 'LES ARCS HACHURÉS SONT INTERDITS'],
  anneau: ['ANNEAU À PORTES', 'PASSE PAR UNE PORTE DE L’ANNEAU'],
  irreg: ['ROTATION IRRÉGULIÈRE', 'RIEN NE TOURNE DEUX FOIS PAREIL'],
  acoups: ['À-COUPS', 'LA ROTATION AVANCE PAR À-COUPS'],
  arrets: ['PAS À PAS', 'L’ASTRE S’ARRÊTE PUIS REPART'],
  rampe: ['RAMPE', 'L’ASTRE ACCÉLÈRE AVEC LE TEMPS'],
  anneaux2: ['DEUX ANNEAUX', 'DEUX ANNEAUX À CONTRE-SENS'],
  fentes: ['FENTES', 'ENFILE LES PASSAGES ENTRE LES ZONES'],
  pulse: ['ZONE PULSÉE', 'POINTILLÉS = BIENTÔT INTERDITE'],
  glisse: ['ZONE GLISSANTE', 'LA ZONE GLISSE SUR LE BORD'],
  alternee: ['ALTERNÉE', 'LA ROTATION S’INVERSE EN DOUCEUR'],
  rythme: ['DEMI-TOUR EN RYTHME', 'DEMI-TOUR À INTERVALLES FIXES'],
  invImpact: ['INVERSION À L’IMPACT', 'CHAQUE AIGUILLE INVERSE LA ROTATION'],
  ressac: ['RESSAC', 'LA ROTATION REVIENT EN ARRIÈRE'],
  sentinelle: ['SENTINELLE', 'TIRE QUAND ELLE A QUITTÉ L’AXE'],
  traversantes: ['TRAVERSANTES', 'L’AIGUILLE RESSORT EN FACE'],
  sentinelles2: ['DEUX SENTINELLES', 'ELLES TOURNENT EN SENS OPPOSÉS'],
  anneaux3: ['TROIS ANNEAUX', 'TROIS PORTES À ENFILER'],
  portesPulsees: ['PORTES PULSÉES', 'LES PORTES S’OUVRENT ET SE FERMENT']
};
// idées du générateur déjà réalisées (les autres arrivent chacune avec son commit ; d'ici là, leur niveau d'apprentissage
// est un niveau ordinaire qui n'introduit rien)
const IMPL = ['lancer', 'bloqueurs', 'etoiles', 'sens', 'accel', 'demitour', 'rythme', 'invImpact', 'rampe', 'irreg', 'pulse', 'glisse', 'respiration', 'serre', 'zone', 'acoups', 'arrets', 'fentes',
  'alternee', 'ressac', 'sentinelle', 'traversantes', 'sentinelles2', 'anneau', 'anneaux2', 'anneaux3', 'portesPulsees'];
// Difficulté : tirs, obstacles fixes (en « équivalents aiguilles », capacité tirs + obstacles ≤ 14) et vitesse moyenne ω
// (rad/s) au début et à la fin de chaque monde ; pos = progression dans un bloc de 10 (x1..x10 : respirations en x1-x2,
// montée, spécial en x7, boss en x10) ; tune = facteurs de vitesse par niveau réglés par tests/sim/report.js.
const DIFFICULTY = {
  capacity: 14, floor30: .75, floorLow95: .72,
  worldTargets70: [[.97, .80], [.80, .65], [.68, .52], [.58, .42], [.45, .32], [.35, .22]], endless70: [.22, .30],
  breather: .10, cliff: .12, bossCliff: .20, mashEarly: .30, mashLate: 6 / 200, trials: 300, trialsRecheck: 1000, recheckBelow: .85,
  worlds: [
    { throws: [4, 8], fixed: [3, 5], speed: [1.1, 2.2] },
    { throws: [6, 9], fixed: [2, 5], speed: [1.6, 2.8] },
    { throws: [6, 9], fixed: [3, 5], speed: [1.8, 3.0] },
    { throws: [6, 9], fixed: [2, 4], speed: [1.9, 3.2] },
    { throws: [6, 9], fixed: [2, 4], speed: [2.1, 3.5] },
    { throws: [7, 9], fixed: [2, 3], speed: [2.3, 3.8] }
  ],
  pos: [-.55, -.35, .15, .3, .45, .55, .45, .7, .8, .9],
  tune: {
    5: [2.139, 0], 6: [1.93, 0], 7: [2.181, 0], 8: [1.932, 0], 10: [1.496, 0], 13: [1.717, 0], 14: [1.876, 0], 15: [1.893, 0],
    16: [1.869, 0], 18: [1.825, 0], 20: [1.982, 0], 22: [1.537, 0], 23: [1.744, 0], 24: [1.709, 0], 25: [1.666, 0], 26: [1.617, 0],
    28: [1.619, 0], 30: [1.894, 0], 31: [1.626, 0], 32: [1.653, 0], 33: [1.539, 0], 34: [1.481, 0], 35: [1.464, 0], 36: [1.266, 0],
    37: [1.501, 0], 38: [1.459, 0], 39: [2.186, 0], 40: [2.372, 0], 41: [0.842, 0], 42: [1.485, 0], 44: [1.287, 0], 45: [0.941, 0],
    46: [1.169, 0], 47: [1.15, 0], 48: [1.179, 0], 50: [2.036, 0], 52: [1.185, 0], 53: [2.071, 0], 54: [1.528, 0], 55: [0.961, 0],
    56: [0.925, 0], 57: [1.985, 0], 58: [0.967, 0], 59: [0.995, 0], 61: [1.108, 0], 62: [1.661, 0], 63: [1.246, 0], 65: [1.338, 0],
    66: [1.69, 0], 67: [1.566, 0], 68: [1.683, 0], 69: [1.147, 0], 70: [1.323, 0], 71: [0.991, 0], 72: [0.868, 0], 74: [0.796, 0],
    75: [0.899, 0], 76: [0.687, 0], 77: [0.708, 0], 78: [0.463, 0], 79: [0.916, 0], 80: [0.82, 0], 81: [2.291, 0], 83: [0.571, 0],
    84: [0.641, 0], 85: [0.674, 0], 86: [0.743, 0], 87: [1.22, 0], 88: [1.243, 0], 89: [0.896, 0], 90: [1.953, 0], 91: [0.464, 0],
    92: [0.52, 0], 94: [0.784, 0], 95: [0.553, 0], 96: [0.764, 0], 97: [0.467, 0], 98: [0.578, 0], 99: [0.557, 0], 100: [2.021, 0],
    101: [0.941, 0], 102: [0.957, 0], 103: [0.889, 0], 104: [1.92, 0], 105: [1.147, 0], 106: [1.537, 0], 107: [0.953, 0], 108: [1.834, 0],
    109: [0.867, 0], 110: [0.945, -1], 111: [1.73, 0], 112: [0.818, 0], 113: [1.425, 0], 114: [1.543, 0], 115: [1.219, 0], 116: [1.696, 0],
    117: [1.731, 0], 119: [1.675, 0], 120: [1.106, 0], 121: [2.268, 0], 122: [1.312, 0], 123: [1.184, 0], 124: [0.847, 0], 125: [1.361, 0],
    127: [0.794, 0], 128: [0.997, 0], 129: [0.972, 0], 130: [1.53, -1], 131: [0.634, 0], 132: [0.854, 0], 133: [1.37, 0], 135: [1.034, 0],
    136: [1.013, 0], 137: [1.238, 0], 139: [1.172, 0], 140: [1.589, 0], 141: [0.717, 0], 142: [1.126, 0], 143: [0.649, 0], 144: [0.686, 0],
    145: [1.003, 0], 146: [0.863, 0], 147: [1, -2], 148: [0.888, 0], 149: [0.888, 0], 150: [1.848, 0], 151: [2.267, 0], 152: [0.741, 0],
    153: [1.35, 0], 154: [1.748, 0], 155: [1.873, 0], 156: [1.914, 0], 157: [1.934, 0], 158: [1.845, 0], 159: [1.654, 0], 160: [1.58, 0],
    161: [0.973, 0], 162: [1.47, 0], 163: [1.715, 0], 164: [1.734, 0], 165: [1.74, 0], 166: [1.339, 0], 167: [1.417, 0], 168: [1.7, -1],
    169: [1.507, 0], 170: [1.247, 0], 171: [2.261, 0], 172: [1.728, 0], 173: [1.504, -1], 175: [1.421, 0], 177: [1.465, 0], 178: [1.422, -1],
    180: [1.198, 0], 181: [1.764, 0], 182: [1.469, 0], 183: [1.161, 0], 184: [1.393, 0], 185: [1.35, 0], 187: [1.45, 0], 190: [1.764, 0],
    191: [1.47, 0], 192: [1.446, 0], 193: [0.506, 0], 194: [0.909, 0], 195: [0.997, 0], 196: [1.326, -1], 197: [1.013, 0], 198: [0.75, 0],
    200: [1.727, 0], 201: [2.156, 0], 202: [2.04, 0], 203: [1.791, 0], 204: [1.957, 0], 205: [1.84, 0], 206: [1.88, 0], 207: [1.912, 0],
    208: [1.588, 0], 209: [1.844, 0], 210: [1.396, 0], 211: [2.131, 0], 212: [1.88, 0], 213: [1.782, 0], 214: [1.35, 0], 215: [1.684, 0],
    216: [1.619, 0], 217: [1.731, 0], 218: [1.692, 0], 219: [1.35, 0], 221: [2.276, 0], 222: [1.255, 0], 223: [1.612, 0], 224: [1.112, 0],
    225: [1.479, 0], 226: [1.555, 0], 227: [1.369, -1], 228: [1.049, 0], 229: [1.506, 0], 230: [1.605, -2], 231: [1.601, 0], 232: [1.3, 0],
    233: [1.102, 0], 234: [1.474, 0], 235: [1.457, 0], 236: [1.444, 0], 237: [1.454, 0], 238: [1.375, -1], 239: [1.405, 0], 240: [1.457, 0],
    241: [1.229, 0], 242: [1.432, 0], 243: [1.379, 0], 244: [1.326, 0], 245: [1.289, -2], 246: [1.244, 0], 247: [1.016, 0], 249: [0.977, 0],
    250: [1.674, -1], 251: [2.246, 0], 252: [2.103, 0], 253: [1.933, 0], 254: [1.942, 0], 255: [1.747, -1], 256: [1.869, 0], 257: [1.482, -2],
    258: [1.82, 0], 259: [1.824, -2], 260: [1.382, -1], 261: [2.257, 0], 262: [1.782, 0], 263: [1.553, -1], 264: [0.989, -1], 265: [1.626, -1],
    266: [1.71, 0], 267: [1.708, 0], 268: [1.667, -1], 269: [1.625, 0], 270: [0.971, -1], 271: [1.739, -1], 272: [0.974, -2], 273: [1.628, 0],
    274: [1.536, 0], 275: [1.461, 0], 276: [1.518, 0], 277: [1.58, 0], 278: [1.444, 0], 279: [1.437, -2], 280: [1.478, 0], 281: [1, -1],
    282: [1.218, -1], 283: [1.46, 0], 284: [1.27, -2], 285: [1.444, 0], 286: [1.419, -2], 287: [1.295, 0], 288: [1.419, -1], 289: [1.35, 0],
    290: [1.397, -2], 292: [1.442, -1], 293: [1.348, -2], 294: [1.35, -2], 295: [1.299, 0], 296: [1.273, -2], 297: [1.161, -2], 299: [1.269, -2],
    300: [1.588, -2], 301: [1.184, 0], 302: [0.889, -1], 303: [0.992, 0], 304: [1.255, -1], 305: [1.35, -2], 306: [1.221, -1], 307: [1.198, -2],
    308: [0.912, 0], 309: [0.979, 0], 310: [1.79, -2], 311: [1.272, 0], 312: [0.969, 0], 313: [1.319, 0], 314: [1.348, -2], 315: [1.348, -1],
    316: [1.21, -2], 317: [1.363, -2], 318: [0.878, 0], 319: [1.329, -2], 320: [0.957, -1], 321: [1.195, 0], 322: [1.194, -2], 323: [1.265, 0],
    324: [1.27, -2], 325: [1.117, -1], 327: [1.357, 0], 328: [1.31, 0], 329: [1.196, -2], 330: [1.605, -2], 331: [0.95, 0], 332: [1.284, 0],
    333: [1.328, -1], 334: [1.32, 0], 335: [0.688, -1], 336: [1.216, -2], 337: [0.841, 0], 339: [1.137, -2], 340: [1.066, 0]
  }
};
// boss : archétype k au niveau 10·k de chaque monde, palier = monde (I..VI) ; jusqu'à l'étape 4, ils se jouent comme un
// niveau normal avec la mécanique de leur archétype aux paramètres de leur palier
const BOSSES = [
  { id: 'reacteur', name: 'LE RÉACTEUR', flag: 'accel', throws: [10, 11, 11, 12, 12, 12], speed: [1.1, 1.5, 1.7, 1.9, 2.0, 2.2], top: [2.0, 2.6, 3.0, 3.3, 3.5, 3.9] },
  { id: 'pendule', name: 'LE PENDULE', flag: 'demitour', throws: [8, 9, 10, 11, 12, 13], speed: [1.4, 1.8, 2.1, 2.4, 2.8, 3.2], every: [4, 3, 3, 3, 2, 2], warn: [.9, .8, .7, .6, .5, .45] },
  { id: 'forteresse', name: 'LA FORTERESSE', flag: 'zone', throws: [8, 8, 9, 9, 9, 9], speed: [1.4, 1.8, 2.1, 2.4, 2.7, 3.0] },
  { id: 'anneaux', name: 'LES ANNEAUX', flag: 'anneau', throws: [8, 9, 10, 10, 11, 11], speed: [1.2, 1.6, 1.9, 2.2, 2.5, 2.8] },
  { id: 'chaos', name: 'LE CHAOS', flag: 'irreg', throws: [9, 10, 10, 11, 11, 12], speed: [1.4, 1.8, 2.1, 2.4, 2.7, 3.0] }
];
// spéciaux (x7) dans l'ordre PLUIE, CHRONO, PARFAIT ; jusqu'à l'étape 4, joués comme des niveaux normaux sur leur terrain
const SPECIALS = ['pluie', 'chrono', 'parfait'];

// messages d'échec par cause : short = rappel près du pas de tir (police vectorielle, {d} = degrés manquants),
// long = phrase de la feuille d'échec, tips = conseils propres à la cause
const FAIL_TEXT = {
  pin: { short: 'IL MANQUAIT {d}°', long: 'Il manquait {d}° pour passer.',
    tips: ['Attends l’ouverture, puis tire.', 'Vise un arc allumé.', 'Le rythme, pas la vitesse.', 'Respire. Regarde la jauge ROTATION.'] },
  zone: { short: 'EN PLEINE ZONE INTERDITE', long: 'Aiguille plantée en pleine zone interdite.',
    tips: ['Vise un arc allumé.', 'Les arcs hachurés sont interdits.'] },
  twin: { short: 'CONTACT EN RESSORTANT · {d}°', long: 'L’aiguille en a touché une autre en ressortant en face.',
    tips: ['Vérifie aussi le côté opposé.', 'Un arc allumé est sûr des deux côtés.'] },
  twinZone: { short: 'SORTIE EN ZONE INTERDITE', long: 'L’aiguille est ressortie en pleine zone interdite.',
    tips: ['Vérifie aussi le côté opposé.', 'Un arc allumé est sûr des deux côtés.'] },
  ring: { short: 'INTERCEPTÉE PAR L’ANNEAU', long: 'Tir intercepté par l’anneau.',
    tips: ['Tire quand une porte passe sur l’axe.', 'Le losange s’allume quand la porte sera alignée.'] },
  sent: { short: 'INTERCEPTÉE PAR LA SENTINELLE', long: 'Tir intercepté par la sentinelle.',
    tips: ['Tire quand elle a quitté l’axe.', 'Regarde où elle sera dans un instant.'] }
};
