// ORBITA · config.js — constantes et tables de données (aucune dépendance au DOM).
const TAU = Math.PI * 2, HPI = Math.PI / 2;
const GAP = .115, ORBHIT = .2, GS = .5, TILT = 1.02;
// pas fixe de la simulation (s) : update(dt) avance en pas de STEP, la boucle n'appelle que update(STEP)
const STEP = 1 / 120;
// vol : durée constante et positions physiques u (0 = pas de tir, 1 = contact avec l'astre), les mêmes sur tous les écrans,
// relevées sur la mise en page de référence 390×844. L'aiguille mesure U.len (pointe en u, extrémité de la tête en u − U.len).
const FLIGHT = .060;
const U = { len: .24, head: .76, sentIn: .73, sent: .71, sentOut: .69, dial: .66 };
// marge angulaire des sentinelles (rad) : bout arrondi de leur trait + demi-épaisseur de la tige, mesurée en 390×844
const SENT_PAD = .038;
// tête de l'aiguille en vol (disque) contre une sentinelle. UREF : rayons dessinés de la mise en page de référence 390×844
// aux positions u de la carte, rapportés au rayon RS de l'orbite des sentinelles ; HEAD_REF : rayon de la tête / RS ;
// SENT_PAD_HEAD : demi-épaisseur des sentinelles + rayon de la tête, / RS (rad). Le centre de la tête en vol suit UREF
// (extrémité de la tête en u − U.len, centre HEAD_REF plus près de l'astre) : contact dessiné ⇔ interception en 390×844.
const UREF = [[0, 2.37475], [U.dial, 1.11350], [U.sentOut, 1.03245], [U.sent, 1], [U.sentIn, .96755], [U.head, .88884], [1, .42026]];
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
  'alternee', 'ressac', 'sentinelle', 'traversantes'];
// Difficulté : tirs, obstacles fixes (en « équivalents aiguilles », capacité tirs + obstacles ≤ 14) et vitesse moyenne ω
// (rad/s) au début et à la fin de chaque monde ; pos = progression dans un bloc de 10 (x1..x10 : respirations en x1-x2,
// montée, spécial en x7, boss en x10) ; tune = facteurs de vitesse par niveau réglés par tests/sim/report.js.
const DIFFICULTY = {
  capacity: 14, floor30: .75, floorLow95: .72,
  worldTargets70: [[.97, .80], [.80, .65], [.68, .52], [.58, .42], [.45, .32], [.35, .22]], endless70: [.22, .30],
  breather: .10, cliff: .12, bossCliff: .20, mashEarly: .30, mashLate: 6 / 200, trials: 300, trialsRecheck: 1000, recheckBelow: .85,
  worlds: [
    { throws: [4, 8], fixed: [0, 4], speed: [1.1, 2.2] },
    { throws: [6, 9], fixed: [2, 5], speed: [1.6, 2.8] },
    { throws: [6, 9], fixed: [3, 5], speed: [1.8, 3.0] },
    { throws: [7, 10], fixed: [2, 4], speed: [1.9, 3.2] },
    { throws: [7, 10], fixed: [2, 4], speed: [2.1, 3.5] },
    { throws: [8, 11], fixed: [2, 3], speed: [2.3, 3.8] }
  ],
  pos: [-.55, -.35, .15, .3, .45, .55, .45, .7, .8, .9],
  tune: {}
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
  sent: { short: 'INTERCEPTÉE PAR LA SENTINELLE', long: 'Tir intercepté par la sentinelle.',
    tips: ['Tire quand elle a quitté l’axe.', 'Regarde où elle sera dans un instant.'] }
};
