'use strict';
// Données du jeu : objets, héros, armes, bâtiments, monstres, objectifs.
(function () {
  const D = (G.Data = {});

  D.ITEMS = {
    gold: { name: 'Or', desc: 'La monnaie du camp.' },
    wood: { name: 'Bois', desc: 'Coupé dans la forêt ou produit par la scierie.' },
    stone: { name: 'Pierre', desc: 'Extraite des rochers ou de la carrière.' },
    iron: { name: 'Fer', desc: 'Sert à forger de meilleures armes.' },
    food: { name: 'Provisions', desc: 'Nécessaires pour partir en expédition.' },
    potion: { name: 'Potion de soin', desc: 'Rend 60 % des PV. Touche 3.', use: 'heal' },
    gel: { name: 'Gelée de slime', desc: 'Se revend au marché.', sell: 2 },
    wing: { name: 'Aile de chauve-souris', desc: 'Se revend au marché.', sell: 3 },
    bone: { name: 'Os', desc: 'Se revend au marché.', sell: 4 },
    ear: { name: 'Oreille de gobelin', desc: 'Se revend au marché.', sell: 5 },
    gem: { name: 'Gemme', desc: 'Rare. Nécessaire aux armes légendaires.', sell: 25 },
    bronze: { name: 'Éclat de bronze', desc: 'Arraché à un chevalier maudit.', sell: 30 },
  };
  D.RES = ['gold', 'wood', 'stone', 'iron', 'food'];

  // Arbres d'armes : chaque famille a une progression, le dernier palier offre un choix.
  D.WEAPONS = {
    sword: {
      label: 'Épée', sprite: 'sword', melee: true,
      nodes: [
        { id: 'sw1', name: 'Épée rouillée', tier: 1, dmg: 4, blade: '#a89a8a', accent: '#8a6a3a' },
        { id: 'sw2', name: 'Épée de fer', tier: 2, parent: 'sw1', dmg: 9, blade: '#d0d6e0', accent: '#a08040', cost: { iron: 3, gold: 25 } },
        { id: 'sw3', name: 'Lame du gardien', tier: 3, parent: 'sw2', dmg: 16, def: 3, blade: '#e8eef8', accent: '#e0b040', cost: { iron: 8, gold: 70, gem: 1 } },
        { id: 'sw4a', name: 'Épée flamboyante', tier: 4, parent: 'sw3', dmg: 28, crit: 10, blade: '#ff9a50', accent: '#e04020', cost: { iron: 16, gold: 160, gem: 3 }, note: 'Coups critiques : +10 %' },
        { id: 'sw4b', name: 'Lame du vent', tier: 4, parent: 'sw3', dmg: 21, aspd: 30, blade: '#a8f0ff', accent: '#40a0c0', cost: { iron: 16, gold: 160, gem: 3 }, note: 'Vitesse d’attaque : +30 %' },
      ],
    },
    axe: {
      label: 'Hache', sprite: 'axe', melee: true,
      nodes: [
        { id: 'ax1', name: 'Hache de bûcheron', tier: 1, dmg: 6, blade: '#a8a8b0', accent: '#8a6a3a' },
        { id: 'ax2', name: 'Hache de guerre', tier: 2, parent: 'ax1', dmg: 12, blade: '#d0d6e0', accent: '#8a6a3a', cost: { iron: 4, gold: 30 } },
        { id: 'ax3', name: 'Hache double', tier: 3, parent: 'ax2', dmg: 20, crit: 5, blade: '#e8eef8', accent: '#c0a040', cost: { iron: 9, gold: 80, gem: 1 } },
        { id: 'ax4a', name: 'Hache du Berserker', tier: 4, parent: 'ax3', dmg: 38, crit: 15, aspd: 10, blade: '#f0d070', accent: '#c03020', cost: { iron: 18, gold: 180, gem: 3 }, note: '+10 % vitesse d’attaque sur critique' },
        { id: 'ax4b', name: 'Hache runique', tier: 4, parent: 'ax3', dmg: 30, steal: 8, blade: '#90b0ff', accent: '#6040c0', cost: { iron: 18, gold: 180, gem: 3 }, note: 'Vol de vie : 8 %' },
      ],
    },
    bow: {
      label: 'Arc', sprite: 'bow', melee: false,
      nodes: [
        { id: 'bw1', name: 'Arc court', tier: 1, dmg: 4, blade: '#8a5a32', accent: '#d0d0d0' },
        { id: 'bw2', name: 'Arc long', tier: 2, parent: 'bw1', dmg: 9, blade: '#9a6a3a', accent: '#e0e0e0', cost: { iron: 2, wood: 15, gold: 25 } },
        { id: 'bw3', name: 'Arc composite', tier: 3, parent: 'bw2', dmg: 15, crit: 8, blade: '#6a4a3a', accent: '#e0b040', cost: { iron: 7, gold: 70, gem: 1 } },
        { id: 'bw4a', name: 'Arc du faucon', tier: 4, parent: 'bw3', dmg: 24, crit: 25, blade: '#d8c890', accent: '#f0f0f0', cost: { iron: 14, gold: 160, gem: 3 }, note: 'Coups critiques : +25 %' },
        { id: 'bw4b', name: 'Arc d’épines', tier: 4, parent: 'bw3', dmg: 20, aspd: 35, blade: '#4a8a3a', accent: '#a0e060', cost: { iron: 14, gold: 160, gem: 3 }, note: 'Vitesse d’attaque : +35 %' },
      ],
    },
    staff: {
      label: 'Bâton', sprite: 'staff', melee: false,
      nodes: [
        { id: 'st1', name: 'Bâton de saule', tier: 1, dmg: 5, blade: '#8a5a32', accent: '#60d0a0' },
        { id: 'st2', name: 'Bâton de cristal', tier: 2, parent: 'st1', dmg: 10, blade: '#8a5a32', accent: '#80c0ff', cost: { iron: 2, gold: 30, gem: 1 } },
        { id: 'st3', name: 'Sceptre ardent', tier: 3, parent: 'st2', dmg: 17, blade: '#8a5a32', accent: '#ff8040', cost: { iron: 6, gold: 80, gem: 2 } },
        { id: 'st4a', name: 'Bâton de l’archimage', tier: 4, parent: 'st3', dmg: 30, crit: 10, blade: '#4a3a6a', accent: '#d080ff', cost: { iron: 12, gold: 180, gem: 4 }, note: 'Coups critiques : +10 %' },
        { id: 'st4b', name: 'Bâton de givre', tier: 4, parent: 'st3', dmg: 24, steal: 6, blade: '#6a8aa0', accent: '#c0f0ff', cost: { iron: 12, gold: 180, gem: 4 }, note: 'Vol de vie : 6 %' },
      ],
    },
    hammer: {
      label: 'Marteau', sprite: 'hammer', melee: true,
      nodes: [
        { id: 'hm1', name: 'Maillet', tier: 1, dmg: 7, blade: '#8a8a94', accent: '#8a6a3a' },
        { id: 'hm2', name: 'Marteau de forge', tier: 2, parent: 'hm1', dmg: 13, blade: '#b0b6c0', accent: '#8a6a3a', cost: { iron: 5, gold: 30 } },
        { id: 'hm3', name: 'Marteau runique', tier: 3, parent: 'hm2', dmg: 22, def: 3, blade: '#8090c0', accent: '#c0a040', cost: { iron: 10, gold: 80, gem: 1 } },
        { id: 'hm4a', name: 'Marteau du titan', tier: 4, parent: 'hm3', dmg: 42, aspd: -10, blade: '#d0a060', accent: '#806040', cost: { iron: 20, gold: 180, gem: 3 }, note: 'Énorme, mais lent' },
        { id: 'hm4b', name: 'Marteau sacré', tier: 4, parent: 'hm3', dmg: 30, def: 6, hp: 40, blade: '#fff0b0', accent: '#e0c040', cost: { iron: 20, gold: 180, gem: 3 }, note: '+40 PV, +6 défense' },
      ],
    },
  };
  D.nodeById = function (id) {
    for (const k in D.WEAPONS) for (const n of D.WEAPONS[k].nodes) if (n.id === id) return Object.assign({ family: k }, n);
    return null;
  };

  D.HEROES = {
    bram: {
      name: 'Bram', role: 'Guerrier', weapon: 'sword', cost: 0,
      desc: 'Robuste et polyvalent. Sa compétence Tourbillon frappe tous les ennemis autour de lui.',
      hp: 120, atk: 10, def: 3, speed: 3.3, range: 1.15, aspd: 1.5, crit: 5,
      skill: { id: 'whirl', name: 'Tourbillon', cost: 30, cd: 4 },
      look: { skin: '#f2c9a0', hair: '#e8742a', hairStyle: 'spiky', shirt: '#4f8a3c', cape: '#2e5a2a', pants: '#6b4a2e', boots: '#3b2a1e' },
    },
    lyra: {
      name: 'Lyra', role: 'Archère elfe', weapon: 'bow', cost: 120,
      desc: 'Attaque à distance. Volée tire cinq flèches en éventail.',
      hp: 85, atk: 9, def: 1, speed: 3.6, range: 5.5, aspd: 1.3, crit: 10,
      skill: { id: 'volley', name: 'Volée', cost: 30, cd: 4 },
      look: { skin: '#f5d5b5', hair: '#f0d878', hairStyle: 'long', shirt: '#3f7a48', cape: '#5a3f2a', pants: '#6e5a3a', ears: true },
    },
    sylve: {
      name: 'Sylve', role: 'Mage', weapon: 'staff', cost: 200,
      desc: 'Sorts à distance. Boule de feu explose et brûle un groupe entier.',
      hp: 75, atk: 12, def: 1, speed: 3.2, range: 5, aspd: 1.0, crit: 5,
      skill: { id: 'fireball', name: 'Boule de feu', cost: 35, cd: 5 },
      look: { skin: '#e8c4a8', hair: '#4cc6a0', hairStyle: 'long', shirt: '#6a3f8a', cape: '#3a2350', pants: '#4a2c62' },
    },
    durgan: {
      name: 'Durgan', role: 'Nain forgeron', weapon: 'hammer', cost: 260,
      desc: 'Très résistant. Séisme étourdit les ennemis proches.',
      hp: 160, atk: 11, def: 6, speed: 2.9, range: 1.15, aspd: 1.1, crit: 5,
      skill: { id: 'quake', name: 'Séisme', cost: 35, cd: 6 },
      look: { skin: '#e8b090', hair: '#c24a26', hairStyle: 'short', beard: true, shirt: '#7a5a3a', pants: '#4a3a2a', belt: '#2a1a10' },
    },
    grok: {
      name: 'Grok', role: 'Orque berserker', weapon: 'axe', cost: 380,
      desc: 'Frappe fort et vite. Rage augmente sa vitesse et lui rend des PV à chaque coup.',
      hp: 140, atk: 13, def: 3, speed: 3.3, range: 1.2, aspd: 1.4, crit: 10,
      skill: { id: 'rage', name: 'Rage', cost: 40, cd: 9 },
      look: { skin: '#6aa84a', hair: '#6aa84a', hat: 'horned', metal: '#8a8f99', shirt: '#6b4a2e', pants: '#4a3420', ears: true },
    },
  };
  D.HERO_ORDER = ['bram', 'lyra', 'sylve', 'durgan', 'grok'];

  // Villageois (apparences)
  D.VILLAGERS = [
    { skin: '#f2c9a0', hair: '#5a3a22', hairStyle: 'short', hat: 'straw', shirt: '#c8b48a', pants: '#6b5a3a' },
    { skin: '#e0b090', hair: '#2a1a12', hairStyle: 'short', shirt: '#8a4a3a', pants: '#4a3a2a' },
    { skin: '#f5d5b5', hair: '#c89a50', hairStyle: 'long', shirt: '#4a6a8a', pants: '#3a3a4a' },
    { skin: '#c89070', hair: '#1a1210', hairStyle: 'short', hat: 'straw', shirt: '#7a8a4a', pants: '#5a4a32' },
    { skin: '#f2c9a0', hair: '#8a8a8a', hairStyle: 'short', beard: true, shirt: '#5a4a6a', pants: '#3a3040' },
    { skin: '#e8c4a8', hair: '#a0402a', hairStyle: 'long', shirt: '#a87a4a', pants: '#5a3a2a' },
  ];
  D.VILLAGER_LINES = ['Belle nuit pour forger !', 'Les citrouilles poussent bien.', 'On dit qu’un chevalier hante le 3e étage…', 'Ramène du fer, héros !', 'La taverne serait bien utile ici.', 'Les moutons sont nerveux ce soir.'];

  // Bâtiments
  D.BUILDINGS = {
    house: { name: 'Maison', w: 3, d: 3, cost: { wood: 30, stone: 15 }, desc: 'Accueille 2 villageois de plus. Chaque villageois rapporte 1 or régulièrement.', villagers: 2, prod: { res: 'gold', every: 20, amount: 2 } },
    farm: { name: 'Ferme', w: 3, d: 3, cost: { wood: 15 }, desc: 'Cultive citrouilles et choux : produit des provisions.', prod: { res: 'food', every: 9, amount: 1 }, walkable: true },
    sawmill: { name: 'Scierie', w: 3, d: 2, cost: { wood: 20, stone: 5 }, desc: 'Produit du bois automatiquement.', prod: { res: 'wood', every: 7, amount: 1 } },
    quarry: { name: 'Carrière', w: 2, d: 2, cost: { wood: 25 }, desc: 'Produit de la pierre automatiquement.', prod: { res: 'stone', every: 9, amount: 1 } },
    mine: { name: 'Mine de fer', w: 2, d: 2, cost: { wood: 40, stone: 40, gold: 60 }, desc: 'Produit du fer lentement. Débloquée à l’étage 2.', prod: { res: 'iron', every: 30, amount: 1 }, needFloor: 2 },
    tavern: { name: 'Taverne', w: 4, d: 3, cost: { wood: 60, stone: 40, gold: 80 }, desc: 'Permet de recruter de nouveaux héros.', unique: true },
    lantern: { name: 'Lanterne', w: 1, d: 1, cost: { wood: 3, gold: 5 }, desc: 'Éclaire le camp la nuit.', noUpgrade: true },
    forge: { name: 'Forge', w: 3, d: 3, desc: 'Améliore les armes de tes héros.', unique: true, fixed: true, noUpgrade: true },
    market: { name: 'Marché', w: 2, d: 2, desc: 'Vends ton butin, achète potions et fer.', unique: true, fixed: true, noUpgrade: true },
    pen: { name: 'Enclos', w: 5, d: 4, desc: 'Les animaux fournissent des provisions.', fixed: true, prod: { res: 'food', every: 14, amount: 1 } },
    dungeon: { name: 'Entrée du donjon', w: 2, d: 2, desc: 'Descends affronter les monstres.', fixed: true, noUpgrade: true },
  };
  D.BUILD_ORDER = ['farm', 'sawmill', 'quarry', 'house', 'lantern', 'mine', 'tavern'];
  D.upgradeCost = function (type, lvl) {
    const b = D.BUILDINGS[type];
    const base = b.cost || { wood: 30, stone: 30, gold: 40 };
    const out = {};
    for (const k in base) out[k] = Math.ceil(base[k] * (lvl + 0.5));
    out.gold = (out.gold || 0) + 20 * lvl;
    return out;
  };
  D.MAX_LVL = 3;

  // Monstres
  D.ENEMIES = {
    slime: { name: 'Slime', hp: 22, atk: 5, def: 0, speed: 1.4, xp: 5, range: 0.8, aspd: 0.8, loot: [['gel', 0.7], ['gold', 0.5, 1, 3]], color: '#5ac83a' },
    blueSlime: { name: 'Slime bleu', hp: 34, atk: 7, def: 1, speed: 1.6, xp: 8, range: 0.8, aspd: 0.9, loot: [['gel', 0.8, 1, 2], ['gold', 0.5, 2, 4]], color: '#3a8ae0' },
    bat: { name: 'Chauve-souris', hp: 14, atk: 4, def: 0, speed: 3.0, xp: 4, range: 0.8, aspd: 1.2, loot: [['wing', 0.6], ['gold', 0.3, 1, 2]], flying: true },
    goblin: { name: 'Gobelin', hp: 40, atk: 8, def: 1, speed: 2.4, xp: 10, range: 0.9, aspd: 1.1, loot: [['ear', 0.6], ['gold', 0.7, 2, 6], ['iron', 0.15]], look: { skin: '#7ab648', hair: '#7ab648', ears: true, shirt: '#5a4630', pants: '#4a3a24' }, scale: 0.85, weapon: ['sword', '#8a8a8a', '#5a4a2a'] },
    skeleton: { name: 'Squelette archer', hp: 38, atk: 9, def: 2, speed: 1.9, xp: 13, range: 4.5, ranged: true, aspd: 0.6, loot: [['bone', 0.8, 1, 2], ['iron', 0.3], ['gold', 0.5, 3, 7]], look: { skin: '#e8e4d8', hair: '#e8e4d8', eye: '#c03030', shirt: '#cfc8b4', pants: '#b8b0a0', boots: '#8a8474', belt: '#6a6458' }, weapon: ['bow', '#6a5040', '#c0c0c0'] },
    orc: { name: 'Orque brute', hp: 80, atk: 13, def: 3, speed: 2.0, xp: 22, range: 1.0, aspd: 0.8, loot: [['ear', 0.5, 1, 2], ['iron', 0.4, 1, 2], ['gold', 0.8, 5, 10], ['gem', 0.08]], look: { skin: '#5a9a3a', hair: '#5a9a3a', hat: 'horned', metal: '#6a6a72', shirt: '#4a3a2a', pants: '#3a2a1a', ears: true }, scale: 1.15, weapon: ['axe', '#9a9aa0', '#5a4a2a'] },
    knight: { name: 'Chevalier de bronze', boss: true, hp: 360, atk: 18, def: 5, speed: 2.1, xp: 120, range: 1.3, aspd: 0.7, loot: [['bronze', 1, 2, 3], ['gem', 1, 1, 2], ['iron', 1, 4, 6], ['gold', 1, 40, 60]], look: { skin: '#c8893a', hair: '#c8893a', hat: 'helmet', metal: '#c8893a', eye: '#ffcc55', shirt: '#b87a32', pants: '#9a6428', boots: '#7a4e1e', cape: '#9a2a2a', belt: '#5a3a14' }, scale: 1.6, weapon: ['hammer', '#e0a850', '#8a5a2a'] },
  };
  D.floorEnemies = function (f) {
    const list = ['slime', 'bat'];
    if (f >= 2) list.push('goblin', 'blueSlime');
    if (f >= 3) list.push('skeleton', 'goblin');
    if (f >= 4) list.push('orc', 'skeleton');
    if (f >= 6) list.push('orc');
    return list;
  };
  D.bossName = function (f) {
    return f >= 9 ? 'Chevalier d’or' : f >= 6 ? 'Chevalier d’argent' : 'Chevalier de bronze';
  };
  D.expeditionCost = (f) => 3 + f * 2;

  // Objectifs (tutoriel guidé)
  D.QUESTS = [
    { text: 'Coupe 5 arbres (clique dessus)', done: (s) => s.stats.chopped >= 5, reward: { gold: 15 } },
    { text: 'Construis une scierie', done: (s) => s.buildings.some((b) => b.type === 'sawmill'), reward: { gold: 20, food: 5 } },
    { text: 'Entre dans le donjon (en bas à droite du camp)', done: (s) => s.stats.expeditions >= 1, reward: { potion: 2 } },
    { text: 'Atteins l’étage 2 du donjon', done: (s) => s.maxFloor >= 2, reward: { iron: 3 } },
    { text: 'Améliore ton arme à la forge', done: (s) => s.stats.forged >= 1, reward: { gold: 40 } },
    { text: 'Construis la taverne', done: (s) => s.buildings.some((b) => b.type === 'tavern'), reward: { gold: 60 } },
    { text: 'Recrute un nouveau héros', done: (s) => Object.values(s.heroes).filter((h) => h.owned).length >= 2, reward: { gem: 1 } },
    { text: 'Vaincs le Chevalier de bronze (étage 3)', done: (s) => s.stats.bosses >= 1, reward: { gem: 2, gold: 100 } },
    { text: 'Atteins l’étage 6', done: (s) => s.maxFloor >= 6, reward: { gem: 3 } },
  ];
})();
