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
    { throws: [5, 10], fixed: [3, 5], speed: [1.1, 2.2] },
    { throws: [6, 9], fixed: [2, 5], speed: [1.6, 2.8] },
    { throws: [6, 9], fixed: [3, 5], speed: [1.8, 3.0] },
    { throws: [6, 9], fixed: [2, 4], speed: [1.9, 3.2] },
    { throws: [6, 9], fixed: [2, 4], speed: [2.1, 3.5] },
    { throws: [7, 9], fixed: [2, 3], speed: [2.3, 3.8] }
  ],
  pos: [-.55, -.35, .15, .3, .45, .55, .45, .7, .8, .9],
  tune: {
    5: [1.3, 2], 6: [1.3, 3], 7: [1.3, 3], 8: [1.3, 3], 10: [1.3, 1], 13: [1.3, 3], 14: [1.3, 2], 15: [1.3, 3],
    16: [1.3, 3], 17: [1.288, 0], 18: [1.3, 1], 20: [1.233, 3], 22: [1.3, 0], 23: [1.3, 2], 24: [1.3, 2], 25: [1.3, 1],
    26: [1.3, 3], 28: [1.3, 3], 30: [1.3, 1], 31: [1.3, 0], 32: [1.3, 2], 33: [1.3, 2], 34: [1.3, 1], 35: [1.3, 1],
    36: [1.27, 0], 37: [1.3, 2], 38: [1.292, 3], 40: [1.3, 3], 41: [0.718, 0], 42: [1.257, 1], 43: [0.953, 0], 44: [1.144, 0],
    45: [0.941, 0], 46: [1.12, 0], 47: [1.068, 0], 48: [1.109, 1], 50: [1.3, 3], 51: [0.968, 0], 52: [1.264, 1], 53: [1.225, 3],
    54: [1.256, 0], 55: [1.251, 0], 56: [1.202, 0], 57: [1.3, 3], 58: [1.15, 0], 59: [1.3, 2], 60: [1.144, 0], 62: [1.265, 0],
    63: [1.3, 3], 65: [1.3, 3], 66: [1.3, 2], 67: [1.3, 2], 68: [1.215, 2], 69: [1.226, 0], 70: [1.22, 1], 71: [0.97, 0],
    72: [0.643, 0], 73: [0.872, 0], 74: [0.789, 0], 75: [0.932, 0], 76: [0.655, 0], 77: [0.477, 0], 78: [0.541, 0], 79: [1.24, 0],
    80: [0.89, 0], 82: [0.964, 0], 83: [0.742, 0], 84: [0.829, 0], 85: [0.674, 0], 86: [0.527, 0], 87: [1.154, 0], 88: [1.179, 0],
    89: [1.065, 0], 90: [1.3, 2], 91: [0.453, 0], 92: [0.653, 0], 93: [1.001, 0], 94: [0.817, 0], 95: [0.453, 0], 96: [0.572, 0],
    97: [0.45, -1], 98: [0.453, 0], 99: [0.557, 0], 100: [1.3, 3], 101: [0.798, 0], 102: [1.292, 0], 103: [1.293, 0], 104: [1.299, 1],
    105: [1.291, 0], 106: [1.213, 1], 107: [1.182, 0], 108: [1.299, 1], 109: [1.195, 0], 110: [0.802, 0], 112: [0.993, 0], 113: [1.268, 0],
    114: [1.287, 0], 115: [1.08, 0], 116: [1.3, 1], 117: [1.3, 3], 119: [1.207, 2], 120: [1.119, 0], 122: [0.908, 2], 123: [1.294, 0],
    124: [1.027, 0], 125: [1.263, 0], 126: [1.207, 1], 127: [0.891, 0], 128: [0.997, 0], 129: [1.031, 0], 130: [1.3, 0], 131: [0.49, 0],
    132: [1.026, 0], 133: [1.218, 0], 134: [1.031, 0], 135: [1.095, 0], 136: [0.88, 0], 137: [1.149, 1], 138: [1.102, 0], 139: [1.074, 0],
    140: [1.3, 1], 141: [0.797, 0], 142: [1.183, 0], 143: [0.891, 0], 144: [0.698, 0], 145: [0.676, 0], 146: [0.661, 0], 147: [1.184, 0],
    148: [0.888, 0], 149: [0.65, 0], 150: [1.3, 3], 152: [1.275, 0], 153: [1.3, 3], 154: [1.299, 0], 155: [1.3, 3], 156: [1.3, 3],
    157: [1.3, 3], 158: [1.3, 3], 159: [1.211, 2], 160: [1.277, 0], 162: [0.958, 0], 163: [1.3, 1], 164: [1.291, 0], 165: [1.3, 3],
    166: [1.3, 1], 167: [1.295, 1], 168: [1.3, 1], 169: [1.26, 0], 170: [1.196, 0], 172: [1.3, 3], 173: [1.264, 0], 174: [1.278, 0],
    175: [1.244, 1], 177: [1.3, 2], 178: [1.266, 0], 179: [1.278, 0], 180: [1.139, 0], 182: [1.3, 1], 183: [0.931, 0], 184: [1.296, 0],
    185: [1.169, 0], 186: [1.224, 0], 187: [1.291, 3], 188: [1.204, 0], 189: [1.191, 1], 190: [1.266, 0], 191: [0.607, 0], 192: [0.828, 2],
    193: [0.594, 0], 194: [0.722, 0], 195: [0.94, 0], 196: [0.926, 1], 197: [1.061, 0], 198: [0.777, 0], 199: [0.904, 1], 200: [1.299, 1],
    202: [1.284, 1], 203: [1.3, 2], 204: [1.3, 3], 205: [1.3, 3], 206: [1.3, 3], 207: [1.214, 2], 208: [1.3, 3], 209: [1.3, 3],
    210: [1.288, 0], 212: [1.3, 3], 213: [1.089, 3], 214: [1.3, 3], 215: [1.227, 2], 216: [1.3, 3], 217: [1.227, 0], 218: [1.3, 3],
    219: [1.3, 3], 220: [1.049, 0], 222: [1.3, 0], 223: [0.525, 2], 224: [1.3, 1], 225: [1.282, 1], 226: [1.3, 0], 227: [1.223, 0],
    228: [1.187, 0], 229: [1.3, 0], 230: [1.269, 0], 231: [1.3, 0], 232: [1.265, 0], 233: [1.264, 0], 234: [1.181, 1], 235: [1.289, 3],
    236: [1.191, 2], 237: [1.289, 3], 238: [1.26, 1], 239: [1.244, 2], 240: [1.19, 0], 241: [1.143, 0], 242: [1.135, 1], 243: [1.223, 0],
    244: [0.817, 1], 245: [0.817, 2], 246: [1.183, 0], 247: [1.133, 0], 248: [1.073, 0], 249: [1.159, 2], 250: [1.3, 3], 252: [1.3, 3],
    253: [1.3, 3], 254: [1.3, 3], 255: [1.098, 2], 256: [1.3, 3], 257: [1.3, 3], 258: [1.3, 3], 259: [1.3, 0], 260: [1.078, 0],
    262: [1.272, 2], 263: [1.3, 3], 264: [1.3, 1], 265: [1.3, 2], 266: [1.3, 2], 267: [1.3, 3], 268: [1.296, 0], 269: [0.878, 3],
    270: [1.101, 0], 271: [1.296, 1], 272: [1.298, 0], 273: [1.3, 3], 274: [1.3, 0], 275: [1.3, 3], 276: [0.465, 3], 277: [1.297, 1],
    278: [1.3, 1], 279: [1.3, 0], 280: [1.3, 0], 281: [0.48, 0], 282: [1.282, 0], 283: [0.865, 3], 284: [1.296, 0], 285: [1.205, 0],
    286: [1.272, 0], 287: [1.15, 2], 288: [1.259, 0], 289: [1.248, 0], 290: [1.232, 0], 291: [1.298, 3], 292: [1.269, 0], 293: [1.222, 0],
    294: [1.206, 0], 295: [1.192, 0], 296: [0.469, 1], 297: [1.192, 1], 298: [1.168, 0], 299: [0.781, 3], 300: [1.3, 2], 301: [1.073, 0],
    302: [0.942, 0], 303: [1.2, 0], 304: [1.099, 1], 305: [1.087, 0], 306: [1.081, 2], 307: [0.849, 1], 308: [0.768, 0], 309: [1.131, 0],
    310: [1.102, 0], 311: [1.143, 0], 312: [1.141, 0], 313: [1.17, 0], 314: [1.159, 0], 315: [1.197, 1], 316: [0.875, 0], 317: [1.083, 0],
    318: [0.784, 0], 319: [1.184, 0], 320: [0.994, 0], 321: [1.168, 0], 322: [1.083, 0], 323: [1, 1], 324: [1.197, 0], 325: [1.117, 0],
    326: [1.161, 1], 327: [1.097, 1], 328: [1.196, 1], 329: [0.96, 1], 330: [1.216, 0], 331: [1.095, 0], 332: [1.244, 1], 333: [1.199, 0],
    334: [1.169, 0], 335: [1.043, 0], 336: [1.127, 2], 337: [1.122, 0], 339: [1.058, 1], 340: [1.262, 0], 341: [1.009, 0], 342: [1.092, 0],
    343: [1.144, 0], 344: [1.18, 0], 345: [0.734, 0], 346: [1.065, 0], 348: [1.18, 1], 349: [1.099, 0], 350: [0.88, 0], 351: [0.877, 0],
    353: [0.7, 1], 354: [1.061, 0], 355: [1.051, 0], 356: [0.956, 0], 358: [1.089, 0], 359: [0.597, 0], 360: [1.03, 0], 361: [1.158, 0],
    362: [1.11, 1], 363: [0.699, 1], 364: [1.186, 0], 365: [1.061, 0], 366: [1.086, 0], 367: [1.235, 0], 370: [0.946, 1], 371: [0.498, 0],
    372: [1.115, 0], 374: [0.789, 0], 375: [1.249, 0], 376: [0.997, 0], 377: [0.808, 0], 378: [1.187, 0], 379: [1.187, 0], 380: [1.283, 0],
    381: [1.146, 0], 382: [0.86, 0], 383: [1.096, 1], 384: [1.218, 0], 385: [1.084, 0], 386: [0.949, 1], 387: [1.067, 0], 389: [1.162, 0],
    390: [1.193, 0], 391: [1.047, 0], 392: [0.566, 0], 393: [1.068, 0], 394: [1.163, 0], 395: [1.032, 0], 396: [1.105, 0], 397: [0.951, 0],
    398: [0.88, 1], 399: [1.209, 0]
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
