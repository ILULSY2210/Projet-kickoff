'use strict';
// Boucle de jeu, rendu isométrique, éclairage jour/nuit, entrées, scènes et sauvegarde.
(function () {
  const D = G.Data, W = G.World, E = G.Ent;
  const SAVE_KEY = 'bastion-lanternes-v1';
  const DAY_LEN = 300; // secondes pour un cycle jour/nuit complet

  // ============================== ÉTAT ==============================
  G.newState = function () {
    const heroes = {};
    for (const id of D.HERO_ORDER) {
      const fam = D.WEAPONS[D.HEROES[id].weapon];
      heroes[id] = { owned: id === 'bram', lvl: 1, xp: 0, weapon: fam.nodes[0].id, unlocked: [fam.nodes[0].id] };
    }
    return {
      v: 1,
      inv: { gold: 30, wood: 10, stone: 5, iron: 0, food: 15, potion: 2 },
      heroes, active: 'bram',
      buildings: W.defaultBuildings(),
      chopped: {},
      maxFloor: 1,
      quest: 0,
      stats: { chopped: 0, kills: 0, expeditions: 0, forged: 0, bosses: 0 },
      clock: 0,
      dayTime: 0.82,
      saved: Date.now(),
    };
  };
  G.save = function () {
    if (!G.state) return;
    G.state.saved = Date.now();
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(G.state)); } catch (e) { /* stockage indisponible */ }
  };
  G.loadSave = function () {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      return s && s.v === 1 ? s : null;
    } catch (e) { return null; }
  };
  G.clearSave = function () { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ } };

  G.has = (cost) => Object.keys(cost).every((k) => (G.state.inv[k] || 0) >= cost[k]);
  G.pay = function (cost) {
    if (!G.has(cost)) return false;
    for (const k in cost) G.state.inv[k] -= cost[k];
    G.ui.refresh();
    return true;
  };
  G.give = function (items) {
    for (const k in items) G.state.inv[k] = (G.state.inv[k] || 0) + items[k];
    G.ui.refresh();
  };

  // ============================== QUALITÉ GRAPHIQUE ==============================
  // auto : passe en qualité réduite si l'appareil n'arrive pas à suivre ; high / low : forcé par le joueur.
  const GFX_KEY = 'bastion-gfx';
  G.gfx = { mode: 'auto', hq: true, samples: [], slow: 0 };
  try { const m = localStorage.getItem(GFX_KEY); if (m === 'high' || m === 'low' || m === 'auto') G.gfx.mode = m; } catch (e) { /* stockage indisponible */ }
  G.gfx.hq = G.gfx.mode !== 'low';
  G.gfx.setMode = function (m) {
    this.mode = m; this.hq = m !== 'low'; this.slow = 0; this.samples = [];
    try { localStorage.setItem(GFX_KEY, m); } catch (e) { /* ignore */ }
  };
  G.gfx.sample = function (ms) {
    if (this.mode !== 'auto' || !this.hq) return;
    this.samples.push(ms);
    if (this.samples.length < 120) return;
    const avg = this.samples.reduce((a, b) => a + b, 0) / this.samples.length;
    this.samples = [];
    this.slow = avg > 26 ? this.slow + 1 : 0;
    if (this.slow >= 2) { this.hq = false; G.ui && G.ui.toast('Graphismes allégés automatiquement pour garder le jeu fluide'); }
  };

  // ============================== ENTRÉES ==============================
  const input = {
    keys: {},
    moveVec() {
      const k = this.keys;
      let sx = 0, sy = 0;
      if (k.KeyW || k.ArrowUp) sy -= 1;
      if (k.KeyS || k.ArrowDown) sy += 1;
      if (k.KeyA || k.ArrowLeft) sx -= 1;
      if (k.KeyD || k.ArrowRight) sx += 1;
      if (!sx && !sy) return null;
      // direction écran -> direction monde isométrique
      const x = (sx + 2 * sy) / 2, y = (2 * sy - sx) / 2;
      const d = Math.hypot(x, y);
      return { x: x / d, y: y / d };
    },
  };

  // ============================== JEU ==============================
  const game = (G.game = {
    input,
    scene: null, hero: null,
    cam: { x: 0, y: 0 },
    shake: 0, time: 0,
    mode: 'title', // title | camp | dungeon
    build: null, // mode construction {type, x, y}
    run: null, // expédition en cours {floor, loot}
    paused: false,

    init() {
      this.canvas = document.getElementById('game');
      this.ctx = this.canvas.getContext('2d');
      this.light = document.createElement('canvas');
      this.lctx = this.light.getContext('2d');
      this.ecan = document.createElement('canvas');
      this.ectx = this.ecan.getContext('2d');
      this.resize();
      window.addEventListener('resize', () => this.resize());
      this.bindInput();
      G.state = G.loadSave() || G.newState();
      this.enterCamp(true);
      this.mode = 'title';
      let last = performance.now();
      const loop = (t) => {
        const dt = G.clamp((t - last) / 1000, 0, 0.05);
        last = t;
        const t0 = performance.now();
        this.update(dt);
        this.render();
        if (this.mode !== 'title') G.gfx.sample(performance.now() - t0 + 8);
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
      setInterval(() => { if (this.mode !== 'title') G.save(); }, 10000);
      window.addEventListener('beforeunload', () => { if (this.mode !== 'title') G.save(); });
    },

    resize() {
      const w = window.innerWidth, h = window.innerHeight;
      this.scale = Math.max(2, Math.round(Math.sqrt((w * h) / (430 * 250))));
      this.vw = Math.ceil(w / this.scale);
      this.vh = Math.ceil(h / this.scale);
      this.canvas.width = this.vw; this.canvas.height = this.vh;
      this.canvas.style.width = this.vw * this.scale + 'px';
      this.canvas.style.height = this.vh * this.scale + 'px';
      this.light.width = this.vw; this.light.height = this.vh;
      this.ecan.width = this.vw; this.ecan.height = this.vh;
      this.ectx.imageSmoothingEnabled = false;
      this.ctx.imageSmoothingEnabled = false;
    },

    // ---------------- Scènes ----------------
    enterCamp(first) {
      const st = G.state;
      this.mode = 'camp';
      this.run = null;
      const s = (this.scene = W.buildCamp(st));
      const spawn = first ? s.spawn : (() => { const d = st.buildings.find((b) => b.type === 'dungeon'); const p = W.doorOf(d); return { x: p.x + 0.5, y: p.y + 0.6 }; })();
      this.hero = new E.Hero(st.active, spawn.x, spawn.y);
      s.actors.push(this.hero);
      this.populateCamp();
      this.snapCam();
      G.ui && G.ui.onScene();
    },
    populateCamp() {
      const s = this.scene, st = G.state;
      const houses = st.buildings.filter((b) => b.type === 'house').length;
      const n = 2 + houses * 2;
      for (let i = 0; i < n; i++) {
        const P = W.PLAZA;
        const v = new E.Villager(G.rnd(P.x0, P.x1), G.rnd(P.y0, P.y1), D.VILLAGERS[i % D.VILLAGERS.length], 'vil' + (i % D.VILLAGERS.length));
        s.actors.push(v);
      }
      // Héros recrutés qui flânent au camp
      for (const id of D.HERO_ORDER) {
        if (id === st.active || !st.heroes[id].owned) continue;
        const h = D.HEROES[id];
        const wn = D.nodeById(st.heroes[id].weapon);
        const v = new E.Villager(G.rnd(15, 20), G.rnd(14, 19), h.look, 'hero:' + id, {
          heroId: id, name: h.name,
          weapon: { spr: G.Art.weapon(D.WEAPONS[h.weapon].sprite, wn.blade, wn.accent), ranged: !D.WEAPONS[h.weapon].melee },
        });
        v.speed = 1.6;
        s.actors.push(v);
      }
      const pen = st.buildings.find((b) => b.type === 'pen');
      if (pen) {
        const b = { x0: pen.x + 0.5, y0: pen.y + 0.5, x1: pen.x + 4.5, y1: pen.y + 3.5, free: true };
        const kinds = ['sheep', 'sheep', 'pig', 'pig', 'chicken', 'sheep'];
        for (const k of kinds) s.actors.push(new E.Animal(k, G.rnd(b.x0, b.x1), G.rnd(b.y0, b.y1), b));
      }
      const farm = st.buildings.find((b) => b.type === 'farm');
      if (farm) for (let i = 0; i < 3; i++) s.actors.push(new E.Animal('chicken', farm.x + 3.5, farm.y + 3.2, { x0: farm.x, y0: farm.y + 3, x1: farm.x + 6, y1: farm.y + 6 }));
    },
    startExpedition(floor) {
      const cost = D.expeditionCost(floor);
      if ((G.state.inv.food || 0) < cost) { G.ui.toast('Il faut ' + cost + ' provisions pour cette expédition.'); return false; }
      G.state.inv.food -= cost;
      G.state.stats.expeditions++;
      this.run = { floor, loot: {}, kills: 0 };
      this.enterFloor(floor);
      G.save();
      return true;
    },
    enterFloor(floor) {
      this.mode = 'dungeon';
      const s = (this.scene = W.buildDungeon(floor));
      const hp = this.hero ? this.hero.hp : null;
      const energy = this.hero ? this.hero.energy : 100;
      this.hero = new E.Hero(G.state.active, s.spawn.x, s.spawn.y);
      if (hp != null && this.run && this.run.floor !== floor) { this.hero.hp = Math.max(1, hp); this.hero.energy = energy; }
      s.actors.push(this.hero);
      for (const sp of s.enemySpawns) s.actors.push(new E.Enemy(sp.type, sp.x, sp.y, floor, sp));
      this.run.floor = floor;
      if (floor > G.state.maxFloor) G.state.maxFloor = floor;
      this.snapCam();
      G.ui.onScene();
      G.ui.banner('ÉTAGE ' + floor, floor % 3 === 0 ? 'Un ' + D.bossName(floor) + ' garde l’escalier…' : 'Trouve l’escalier qui descend');
    },
    leaveDungeon(dead) {
      const loot = this.run ? this.run.loot : {};
      const kept = {};
      for (const k in loot) {
        const n = dead ? Math.floor(loot[k] / 2) : loot[k];
        if (n > 0) kept[k] = n;
      }
      G.give(kept);
      const lines = Object.keys(kept).map((k) => kept[k] + ' × ' + D.ITEMS[k].name);
      this.enterCamp(false);
      G.ui.summary(dead, lines);
      G.save();
    },
    onHeroDeath() {
      setTimeout(() => this.leaveDungeon(true), 1200);
    },

    // ---------------- Interactions ----------------
    distToObj(a, o) {
      if (o.fp && !o.anchorPoint) {
        const cx = G.clamp(a.x, o.fp.x0, o.fp.x1), cy = G.clamp(a.y, o.fp.y0, o.fp.y1);
        return G.dist(a.x, a.y, cx, cy);
      }
      return G.dist(a.x, a.y, o.x, o.y) - (o.fp ? 0.5 : 0);
    },
    interactWith(o) {
      const st = G.state;
      if (o.kind === 'tree' && !o.cut) {
        o.hits = (o.hits || 0) + 1;
        this.hero.swing = 1;
        o.shake = 0.25;
        G.audio.play('chop');
        for (let i = 0; i < 4; i++) this.particle(o.x, o.y, 14, { color: G.pick(['#7a5434', '#4f8a3c', '#c89a5e']), vz: 30, life: 0.6 });
        if (o.hits >= 3) {
          o.cut = true; o.spr = G.S.stump; o.solid = false;
          this.scene.solid[this.scene.idx(o.fp.x0, o.fp.y0)] = 0;
          st.chopped[o.key] = st.clock + 180;
          st.stats.chopped++;
          this.dropLoot(o.x, o.y, 'wood', G.irnd(2, 4));
          if (Math.random() < 0.25) this.dropLoot(o.x, o.y, 'food', 1);
        } else this.hero.interact = o;
        this.hero.cd = 0.45;
        return;
      }
      if (o.kind === 'rock' && !o.cut) {
        o.hits = (o.hits || 0) + 1;
        this.hero.swing = 1;
        o.shake = 0.25;
        G.audio.play('hit');
        for (let i = 0; i < 4; i++) this.particle(o.x, o.y, 8, { color: '#9090a0', vz: 30, life: 0.5 });
        if (o.hits >= 4) {
          o.cut = true; o.spr = null; o.solid = false;
          this.scene.solid[this.scene.idx(o.fp.x0, o.fp.y0)] = 0;
          st.chopped[o.key] = st.clock + 240;
          this.dropLoot(o.x, o.y, 'stone', G.irnd(2, 4));
          if (Math.random() < 0.2) this.dropLoot(o.x, o.y, 'iron', 1);
        } else this.hero.interact = o;
        this.hero.cd = 0.45;
        return;
      }
      if (o.kind === 'building') {
        const t = o.type;
        if (t === 'forge') G.ui.open('forge');
        else if (t === 'market') G.ui.open('market');
        else if (t === 'tavern') G.ui.open('heroes');
        else if (t === 'dungeon') G.ui.open('expedition');
        else G.ui.open('building', o);
        return;
      }
      if (o.kind === 'chest' && !o.opened) {
        o.opened = true; o.spr = G.S.chestOpen;
        G.audio.play('coin');
        const f = this.scene.floor;
        this.dropLoot(o.x, o.y, 'gold', G.irnd(8, 15) * f);
        this.dropLoot(o.x, o.y, 'iron', G.irnd(1, 2) + Math.floor(f / 2));
        if (Math.random() < 0.6) this.dropLoot(o.x, o.y, 'potion', 1);
        if (Math.random() < 0.3 + f * 0.05) this.dropLoot(o.x, o.y, 'gem', 1);
        return;
      }
      if (o.kind === 'portal') { G.ui.confirm('Retourner au camp avec ton butin ?', () => this.leaveDungeon(false)); return; }
      if (o.kind === 'stairs' && !o.hidden) {
        const next = this.scene.floor + 1;
        G.ui.confirm('Descendre à l’étage ' + next + ' ? (le butin te suit)', () => this.enterFloor(next));
        return;
      }
      if (o.kind === 'prop' && o.breakable) {
        this.hero.swing = 1;
        G.audio.play('hit');
        for (let i = 0; i < 6; i++) this.particle(o.x, o.y, 6, { color: '#8a5a32', vz: 40, life: 0.6 });
        this.scene.removeObject(o);
        if (Math.random() < 0.6) this.dropLoot(o.x, o.y, 'gold', G.irnd(1, 4));
        if (Math.random() < 0.12) this.dropLoot(o.x, o.y, 'potion', 1);
      }
    },

    // ---------------- Combat ----------------
    nearestEnemy(x, y, r) {
      let best = null, bd = r;
      for (const a of this.scene.actors) {
        if (!(a instanceof E.Enemy) || a.dead) continue;
        const d = G.dist(x, y, a.x, a.y);
        if (d < bd) { bd = d; best = a; }
      }
      return best;
    },
    enemiesIn(x, y, r) {
      return this.scene.actors.filter((a) => a instanceof E.Enemy && !a.dead && G.dist(x, y, a.x, a.y) <= r + a.r);
    },
    hitEnemy(e, dmg, crit, from) {
      if (e.dead) return;
      const real = Math.max(1, Math.round(dmg - e.defn * 0.6));
      e.hp -= real;
      e.flash = 0.1;
      e.aggro = true;
      const d = G.dist(e.x, e.y, from.x, from.y) || 1;
      const kb = e.boss ? 0.6 : 3.5;
      e.kbx = ((e.x - from.x) / d) * kb; e.kby = ((e.y - from.y) / d) * kb;
      this.floatText(e.x, e.y, (crit ? 'CRIT ' : '') + real, crit ? '#ffd040' : '#ffffff', 16 * e.scale);
      for (let i = 0; i < 3; i++) this.particle(e.x, e.y, 8 * e.scale, { color: e.def.color || (e.def.look ? '#e8e0d0' : '#a080c0'), vz: 25, life: 0.4 });
      const h = this.hero;
      const steal = h.steal + (h.rage > 0 ? 15 : 0);
      if (steal && from === h) h.hp = Math.min(h.maxHp, h.hp + (real * steal) / 100);
      if (e.hp <= 0) this.killEnemy(e);
    },
    killEnemy(e) {
      e.dead = true;
      const s = this.scene;
      s.actors.splice(s.actors.indexOf(e), 1);
      G.state.stats.kills++;
      if (this.run) this.run.kills++;
      this.hero.addXp(e.xp);
      for (let i = 0; i < 10; i++) this.particle(e.x, e.y, 8 * e.scale, { color: G.pick(['#ffffff', '#c0b0d0', e.def.color || '#8a7a9a']), vz: 45, life: 0.7 });
      for (const l of e.def.loot) {
        const chance = l[1] * (e.elite ? 1.5 : 1);
        if (Math.random() < chance) this.dropLoot(e.x, e.y, l[0], l[2] ? G.irnd(l[2], l[3]) * (l[0] === 'gold' ? Math.ceil(e.floor / 2) : 1) : 1);
      }
      if (e.elite && Math.random() < 0.4) this.dropLoot(e.x, e.y, 'gem', 1);
      if (e.boss) {
        G.state.stats.bosses++;
        s.stairs.hidden = false;
        this.shake = 0.5;
        G.ui.banner('VICTOIRE !', e.name + ' est vaincu. L’escalier est révélé.');
        G.audio.play('level');
      }
    },
    shoot(x, y, tx, ty, o) {
      const d = G.dist(x, y, tx, ty) || 1;
      this.scene.projectiles.push(Object.assign({ x, y, z: 9, vx: ((tx - x) / d) * o.speed, vy: ((ty - y) / d) * o.speed, life: 1.6 }, o));
    },
    ring(x, y, r, color) { this.scene.effects.push({ type: 'ring', x, y, r, color, t: 0, life: 0.35 }); },
    telegraph(x, y, r, life) { this.scene.effects.push({ type: 'tele', x, y, r, t: 0, life }); },
    particle(x, y, z, o) {
      this.scene.particles.push({ x, y, z, vx: G.rnd(-1, 1) * (o.spread || 1.2), vy: G.rnd(-1, 1) * (o.spread || 1.2), vz: G.rnd(0.5, 1) * (o.vz || 20), life: o.life || 0.6, max: o.life || 0.6, color: o.color, smoke: o.smoke, size: o.size || 1, grav: o.grav != null ? o.grav : o.smoke ? -6 : 90, glow: o.glow, firefly: o.firefly, seed: Math.random() * 10 });
    },
    floatText(x, y, text, color, z) {
      this.scene.texts.push({ x, y, z: z || 18, text, color, life: 1, spr: G.textSprite(text, color) });
    },
    dropLoot(x, y, item, count) {
      if (!count) return;
      this.scene.loot.push({ x: x + G.rnd(-0.3, 0.3), y: y + G.rnd(-0.3, 0.3), z: 6, vz: 50, vx: G.rnd(-1, 1), vy: G.rnd(-1, 1), item, count, t: 0 });
    },
    pickLoot(l) {
      if (this.run) this.run.loot[l.item] = (this.run.loot[l.item] || 0) + l.count;
      else G.give({ [l.item]: l.count });
      this.floatText(this.hero.x, this.hero.y, '+' + l.count + ' ' + D.ITEMS[l.item].name, '#c8f0a0', 22);
      G.audio.play(l.item === 'gold' ? 'coin' : 'pick');
      G.ui.refresh();
    },
    usePotion() {
      const h = this.hero;
      const have = (G.state.inv.potion || 0) + (this.run && this.run.loot.potion ? this.run.loot.potion : 0);
      if (!have) { G.ui.toast('Aucune potion'); return; }
      if (h.hp >= h.maxHp) { G.ui.toast('PV déjà au maximum'); return; }
      if (this.run && this.run.loot.potion) this.run.loot.potion--;
      else G.state.inv.potion--;
      h.hp = Math.min(h.maxHp, h.hp + h.maxHp * 0.6);
      this.floatText(h.x, h.y, '+SOIN', '#70f070', 24);
      for (let i = 0; i < 8; i++) this.particle(h.x, h.y, 10, { color: '#80ff80', vz: 30, life: 0.7, smoke: true });
      G.audio.play('pick');
      G.ui.refresh();
    },
    heroAttackKey() {
      const h = this.hero;
      if (this.scene.kind !== 'dungeon') return;
      const e = this.nearestEnemy(h.x, h.y, h.weapon.ranged ? h.range + 1 : 2.5);
      if (e) { h.target = e; h.path = null; }
      else if (h.cd <= 0) { h.swing = 1; h.cd = 1 / h.aspd; }
    },

    // ---------------- Construction ----------------
    startBuild(type) {
      this.build = { type, x: Math.floor(this.hero.x) + 1, y: Math.floor(this.hero.y) + 1 };
      G.ui.onBuildMode();
    },
    cancelBuild() { this.build = null; G.ui.onBuildMode(); },
    confirmBuild() {
      const b = this.build;
      if (!b) return;
      const def = D.BUILDINGS[b.type];
      if (!W.canPlace(this.scene, b.type, b.x, b.y)) { G.ui.toast('Emplacement impossible'); return; }
      if (!G.pay(def.cost)) { G.ui.toast('Ressources insuffisantes'); return; }
      const nb = { type: b.type, x: b.x, y: b.y, lvl: 1 };
      G.state.buildings.push(nb);
      const o = W.addBuilding(this.scene, nb);
      if (b.type !== 'lantern') W.carvePath(this.scene, nb);
      for (let i = 0; i < 16; i++) this.particle(o.x + def.w / 2, o.y + def.d / 2, 4, { color: '#c8b48a', vz: 30, life: 0.8, smoke: true, spread: 2 });
      G.audio.play('build');
      G.ui.toast(def.name + ' construite !');
      if (b.type === 'house') this.populateMore(2);
      this.build = null;
      G.ui.onBuildMode();
      G.save();
    },
    populateMore(n) {
      for (let i = 0; i < n; i++) {
        const k = G.irnd(0, D.VILLAGERS.length - 1);
        this.scene.actors.push(new E.Villager(17, 17, D.VILLAGERS[k], 'vil' + k));
      }
    },

    // ---------------- Mise à jour ----------------
    update(dt) {
      this.time += dt;
      const st = G.state;
      const s = this.scene;
      if (!s) return;
      const live = this.mode !== 'title' && !this.paused;
      if (live) {
        st.clock += dt;
        st.dayTime = (st.dayTime + dt / DAY_LEN) % 1;
      } else if (this.mode === 'title') st.dayTime = 0.9;
      // Production des bâtiments (même pendant une expédition)
      if (live) this.produce(dt);
      if (live) {
        for (const a of s.actors.slice()) a.update(dt, this);
        if (s.kind === 'dungeon') this.separate();
      } else if (this.mode === 'title') {
        for (const a of s.actors) if (a !== this.hero) a.update(dt, this);
      }
      this.updateFx(dt);
      if (live && s.kind === 'camp') this.regrow();
      if (live && s.kind === 'dungeon') this.explore();
      // Caméra
      const h = this.hero;
      const tgt = G.iso(h.x, h.y);
      if (this.mode === 'title') { tgt.x = G.iso(17, 13).x + Math.sin(this.time * 0.1) * 60; tgt.y = G.iso(17, 13).y; }
      this.cam.x = G.lerp(this.cam.x, tgt.x, Math.min(1, dt * 6));
      this.cam.y = G.lerp(this.cam.y, tgt.y - 10, Math.min(1, dt * 6));
      this.shake = Math.max(0, this.shake - dt);
      if (live && G.ui) {
        G.ui.tick(dt);
        if (st.quest < D.QUESTS.length && D.QUESTS[st.quest].done(st)) {
          const q = D.QUESTS[st.quest];
          G.give(q.reward);
          st.quest++;
          G.ui.questDone(q);
        }
      }
    },
    produce(dt) {
      const st = G.state;
      for (const b of st.buildings) {
        const def = D.BUILDINGS[b.type];
        if (!def.prod) continue;
        b.t = (b.t || 0) + dt;
        const every = def.prod.every / (1 + 0.6 * (b.lvl - 1));
        if (b.t >= every) {
          b.t -= every;
          st.inv[def.prod.res] = (st.inv[def.prod.res] || 0) + def.prod.amount;
          if (this.scene.kind === 'camp') {
            const p = { x: b.x + def.w / 2, y: b.y + def.d / 2 };
            this.floatText(p.x, p.y, '+' + def.prod.amount + ' ' + D.ITEMS[def.prod.res].name, '#f0e0a0', 34);
          }
          G.ui.refresh();
        }
      }
    },
    regrow() {
      const st = G.state;
      for (const o of this.scene.objects) {
        if ((o.kind !== 'tree' && o.kind !== 'rock') || !o.cut) continue;
        if (st.chopped[o.key] && st.chopped[o.key] > st.clock) continue;
        if (Math.floor(this.hero.x) === o.fp.x0 && Math.floor(this.hero.y) === o.fp.y0) continue;
        o.cut = false; o.hits = 0; o.spr = o.full; o.solid = true;
        this.scene.solid[this.scene.idx(o.fp.x0, o.fp.y0)] = 1;
        delete st.chopped[o.key];
      }
    },
    explore() {
      const s = this.scene, h = this.hero;
      const R = 6;
      for (let y = Math.floor(h.y - R); y <= h.y + R; y++)
        for (let x = Math.floor(h.x - R); x <= h.x + R; x++)
          if (s.inside(x, y) && G.dist(x + 0.5, y + 0.5, h.x, h.y) < R) s.explored[s.idx(x, y)] = 1;
    },
    separate() {
      const en = this.scene.actors.filter((a) => a instanceof E.Enemy);
      for (let i = 0; i < en.length; i++)
        for (let j = i + 1; j < en.length; j++) {
          const a = en[i], b = en[j];
          const d = G.dist(a.x, a.y, b.x, b.y), m = a.r + b.r;
          if (d > 0 && d < m) {
            const p = (m - d) / 2, nx = (a.x - b.x) / d, ny = (a.y - b.y) / d;
            a.moveBy(this.scene, nx * p, ny * p);
            b.moveBy(this.scene, -nx * p, -ny * p);
          }
        }
    },
    updateFx(dt) {
      const s = this.scene, h = this.hero;
      // projectiles
      for (const p of s.projectiles) {
        p.life -= dt;
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.kind === 'fire' && Math.random() < 0.6) this.particle(p.x, p.y, p.z, { color: G.pick(['#ffb040', '#ff6020', '#ffe080']), vz: 10, life: 0.35, smoke: true });
        if (s.isWall(p.x, p.y)) { p.life = 0; this.impact(p); continue; }
        if (p.from === 'hero') {
          for (const a of s.actors) {
            if (!(a instanceof E.Enemy) || a.dead) continue;
            if (G.dist(p.x, p.y, a.x, a.y) < a.r + 0.25) { p.life = 0; if (!p.aoe) this.hitEnemy(a, p.dmg, p.crit, p); this.impact(p); break; }
          }
        } else if (!h.dead && G.dist(p.x, p.y, h.x, h.y) < h.r + 0.2) { p.life = 0; h.hurt(p.dmg, this, p.x - p.vx, p.y - p.vy); }
      }
      s.projectiles = s.projectiles.filter((p) => p.life > 0);
      // particules
      for (const p of s.particles) {
        p.life -= dt;
        if (p.firefly) {
          p.vx += G.rnd(-1, 1) * dt * 2; p.vy += G.rnd(-1, 1) * dt * 2;
          p.vx *= 0.98; p.vy *= 0.98;
          p.z = 7 + Math.sin(this.time * 1.3 + p.seed) * 4;
        }
        p.x += p.vx * dt * 0.5; p.y += p.vy * dt * 0.5;
        p.z += p.vz * dt; p.vz -= p.grav * dt;
        if (p.z < 0) { p.z = 0; p.vz = 0; p.vx *= 0.5; p.vy *= 0.5; }
      }
      s.particles = s.particles.filter((p) => p.life > 0);
      for (const t of s.texts) { t.life -= dt; t.z += dt * 14; }
      s.texts = s.texts.filter((t) => t.life > 0);
      for (const e of s.effects) e.t += dt;
      s.effects = s.effects.filter((e) => e.t < e.life);
      // butin
      for (const l of s.loot) {
        l.t += dt;
        l.z += l.vz * dt; l.vz -= 160 * dt;
        if (l.z <= 0) { l.z = 0; l.vz = Math.abs(l.vz) > 25 ? -l.vz * 0.4 : 0; l.vx *= 0.6; l.vy *= 0.6; }
        l.x += l.vx * dt; l.y += l.vy * dt;
        if (this.mode === 'title' || h.dead) continue;
        const d = G.dist(l.x, l.y, h.x, h.y);
        if (l.t > 0.4 && d < 2.6) { l.x = G.lerp(l.x, h.x, dt * 8); l.y = G.lerp(l.y, h.y, dt * 8); }
        if (l.t > 0.4 && d < 0.45) { l.done = true; this.pickLoot(l); }
      }
      s.loot = s.loot.filter((l) => !l.done);
      this.ambientFx(dt);
      // fumée des cheminées
      if (s.kind === 'camp') {
        for (const o of s.objects) {
          if (o.kind === 'tree' || o.kind === 'rock') o.shake = Math.max(0, (o.shake || 0) - dt);
          if (o.kind !== 'building' || !o.spr || !o.spr.smoke.length) continue;
          for (const sm of o.spr.smoke) if (Math.random() < dt * 3) this.particle(o.fp.x0 + sm.x, o.fp.y0 + sm.y, sm.z, { color: G.pick(['#9a96a0', '#7a7680', '#b0acb4']), vz: 14, life: 2.4, smoke: true, spread: 0.4, size: 2 });
        }
      }
    },
    // Particules d'ambiance : braises des feux, lucioles la nuit, poussière du donjon, poussière de marche
    ambientFx(dt) {
      const s = this.scene, h = this.hero;
      if (!h || this.paused) return;
      const hq = G.gfx.hq, dark = this.darkness();
      const near = (o) => Math.abs(o.x - h.x) < 12 && Math.abs(o.y - h.y) < 12;
      for (const o of s.objects) {
        if (!(o.flames || (o.spr && (o.spr.flames || o.spr.fire)))) continue;
        if (!near(o)) continue;
        const src = this.flamesOf(o).concat(o.spr && o.spr.fire ? o.spr.fire.map((f) => ({ x: o.fp.x0 + f.x, y: o.fp.y0 + f.y, z: f.z })) : []);
        for (const f of src)
          if (Math.random() < dt * (hq ? 2.2 : 0.8)) this.particle(f.x, f.y, f.z + 4, { color: G.pick(['#ffb040', '#ff7020', '#ffe080']), vz: 14, grav: -4, life: G.rnd(0.6, 1.3), spread: 0.35, glow: true });
      }
      if (s.kind === 'camp' && hq && dark > 0.4 && s.particles.length < 160) {
        let n = 0;
        for (const p of s.particles) if (p.firefly) n++;
        if (n < 22 && Math.random() < dt * 4) {
          const x = h.x + G.rnd(-9, 9), y = h.y + G.rnd(-9, 9);
          if (s.tile(Math.floor(x), Math.floor(y)) === 'grass') this.particle(x, y, 8, { color: G.pick(['#d8ff70', '#f0ff9a', '#c0f060']), vz: 0, grav: 0, life: G.rnd(4, 8), spread: 0.6, glow: true, firefly: true });
        }
      }
      if (s.kind === 'dungeon' && Math.random() < dt * (hq ? 3 : 1)) this.particle(h.x + G.rnd(-3, 3), h.y + G.rnd(-3, 3), G.rnd(4, 24), { color: '#c8c0b0', vz: 2, grav: -1, life: G.rnd(2, 4), spread: 0.3 });
      if (h.moving && Math.random() < dt * 6) {
        const t = s.tile(Math.floor(h.x), Math.floor(h.y));
        const c = { dirt: '#8a7050', sand: '#c8b48a', grass: '#4e7a38', field: '#6a4a30' }[t] || '#6a6470';
        this.particle(h.x, h.y, 1, { color: c, vz: 6, life: 0.45, smoke: true, spread: 0.5 });
      }
    },
    impact(p) {
      if (p.aoe) {
        this.ring(p.x, p.y, p.aoe, '#ff9a40');
        this.shake = 0.2;
        G.audio.play('boom');
        for (let i = 0; i < 14; i++) this.particle(p.x, p.y, 6, { color: G.pick(['#ffb040', '#ff6020', '#ffe080', '#5a4a4a']), vz: 40, life: 0.6, spread: 2.5 });
        for (const e of this.enemiesIn(p.x, p.y, p.aoe)) this.hitEnemy(e, p.dmg, p.crit, p);
      } else for (let i = 0; i < 3; i++) this.particle(p.x, p.y, p.z, { color: '#d0c8b8', vz: 20, life: 0.3 });
    },

    // ---------------- Rendu ----------------
    snapCam() {
      const t = G.iso(this.hero.x, this.hero.y);
      this.cam.x = t.x; this.cam.y = t.y - 10;
    },
    toScreen(x, y, z) {
      const p = G.iso(x, y);
      return { x: Math.round(p.x - this.ox), y: Math.round(p.y - this.oy - (z || 0)) };
    },
    toWorld(px, py) {
      return G.unIso(px + this.ox, py + this.oy);
    },
    darkness() {
      if (this.scene.kind === 'dungeon') return 0.86;
      const t = G.state.dayTime;
      const day = 0.5 - 0.5 * Math.cos(t * Math.PI * 2); // 0 minuit, 1 midi
      return G.clamp(0.72 - day * 0.95, 0.04, 0.72);
    },
    render() {
      const ctx = this.ctx, s = this.scene;
      if (!s) return;
      const vw = this.vw, vh = this.vh;
      const hq = G.gfx.hq;
      const sh = this.shake > 0 ? (Math.random() - 0.5) * this.shake * 14 : 0;
      this.ox = Math.round(this.cam.x - vw / 2 + sh);
      this.oy = Math.round(this.cam.y - vh / 2 + sh * 0.5);
      ctx.fillStyle = s.ambientBg;
      ctx.fillRect(0, 0, vw, vh);
      const dark = this.darkness();
      if (s.kind === 'camp' && dark > 0.35) this.drawStars(ctx, (dark - 0.35) / 0.37);

      // Tuiles visibles : seule l'eau est animée, le reste du sol vient d'un cache pré-rendu
      const c0 = this.toWorld(0, -32), c1 = this.toWorld(vw, -32), c2 = this.toWorld(0, vh + 64), c3 = this.toWorld(vw, vh + 64);
      const x0 = Math.max(0, Math.floor(Math.min(c0.x, c1.x, c2.x, c3.x)) - 1), x1 = Math.min(s.w - 1, Math.ceil(Math.max(c0.x, c1.x, c2.x, c3.x)) + 1);
      const y0 = Math.max(0, Math.floor(Math.min(c0.y, c1.y, c2.y, c3.y)) - 1), y1 = Math.min(s.h - 1, Math.ceil(Math.max(c0.y, c1.y, c2.y, c3.y)) + 1);
      if (s.kind === 'camp') {
        const wf = Math.floor(this.time * 1.5) % 3;
        const WT = G.S.tiles.water;
        for (let y = y0; y <= y1; y++)
          for (let x = x0; x <= x1; x++) {
            if (s.tiles[s.idx(x, y)] !== 'water') continue;
            const p = this.toScreen(x, y);
            ctx.drawImage(WT[(wf + x + y) % 3], p.x - 16, p.y);
          }
      }
      if (!s.ground || s.groundDirty) this.buildGround(s);
      ctx.drawImage(s.ground, -s.gx - this.ox, -s.gy - this.oy);
      if (s.kind === 'camp') this.drawShore(ctx, x0, x1, y0, y1);

      // Objets plats (au sol)
      const draw = [];
      const vis = (x, y) => { const p = this.toScreen(x, y); return p.x > -80 && p.x < vw + 80 && p.y > -40 && p.y < vh + 120; };
      for (const o of s.objects) {
        if (o.hidden) continue;
        const cx = o.fp && !o.anchorPoint ? (o.fp.x0 + o.fp.x1) / 2 : o.x, cy = o.fp && !o.anchorPoint ? (o.fp.y0 + o.fp.y1) / 2 : o.y;
        if (!vis(cx, cy)) continue;
        if (o.flat) { this.drawObject(ctx, o); continue; }
        draw.push(o);
      }
      for (const a of s.actors) if (vis(a.x, a.y)) draw.push(a);
      for (const l of s.loot) draw.push({ kind: 'loot', l, x: l.x, y: l.y });
      for (const p of s.projectiles) draw.push({ kind: 'proj', p, x: p.x, y: p.y });
      // Ombres portées et ombres de contact
      this.drawShadows(ctx, draw);
      // Effets au sol
      for (const e of s.effects) this.drawEffect(ctx, e);
      // Fantôme de construction
      if (this.build) this.drawGhost(ctx);
      sortDepth(draw);
      // Couche émissive (vitres, flammes, braises) : tout ce qui est dessiné devant l'efface, pour respecter l'occlusion
      const em = dark > 0.12 ? this.ectx : null;
      if (em) em.clearRect(0, 0, vw, vh);
      const h = this.hero;
      for (const d of draw) {
        if (d.kind === 'loot') this.drawLoot(ctx, d.l);
        else if (d.kind === 'proj') this.drawProj(ctx, d.p);
        else if (d instanceof E.Actor) {
          const p = this.toScreen(d.x, d.y);
          d.draw(ctx, p.x, p.y);
          if (d instanceof E.Enemy && d.hp < d.maxHp && !d.boss) this.drawHpBar(ctx, p.x, p.y - 22 * d.scale, d.hp / d.maxHp);
          if (em && hq) { em.globalCompositeOperation = 'destination-out'; d.draw(em, p.x, p.y); em.globalCompositeOperation = 'source-over'; }
        } else {
          const r = this.objDraw(d);
          if (!r) continue;
          const fade = d.isWall && d.tall && h && d.x + d.y > h.x + h.y + 0.4 && d.x + d.y - (h.x + h.y) < 4 && Math.abs(d.x - d.y - (h.x - h.y)) < 2.2;
          if (fade) ctx.globalAlpha = 0.35;
          ctx.drawImage(r[0].c, r[1], r[2]);
          ctx.globalAlpha = 1;
          if (em) {
            if (!fade && hq) { em.globalCompositeOperation = 'destination-out'; em.drawImage(r[0].c, r[1], r[2]); em.globalCompositeOperation = 'source-over'; }
            if (r[0].emis) em.drawImage(r[0].emis, r[1], r[2]);
          }
          if (d.flames || (d.spr && d.spr.flames)) this.drawFlames(ctx, em, d);
        }
      }
      // le héros reste visible en transparence derrière les arbres et bâtiments
      if (h && this.mode !== 'title') {
        const q = this.toScreen(h.x, h.y);
        ctx.globalAlpha = 0.4;
        h.draw(ctx, q.x, q.y);
        ctx.globalAlpha = 1;
      }
      // particules (fumée, poussière, éclats) : éclairées par la scène
      for (const p of s.particles) {
        if (p.glow) continue;
        const q = this.toScreen(p.x, p.y, p.z);
        ctx.globalAlpha = p.smoke ? G.clamp(p.life / p.max, 0, 0.8) : 1;
        ctx.fillStyle = p.color;
        const sz = p.smoke ? Math.ceil(p.size * (1.5 - p.life / p.max)) : p.size;
        ctx.fillRect(q.x, q.y, sz, sz);
      }
      ctx.globalAlpha = 1;

      this.drawLighting(ctx, dark);
      if (em) {
        ctx.globalAlpha = G.clamp(dark * 1.5, 0, 1);
        ctx.drawImage(this.ecan, 0, 0);
        ctx.globalAlpha = 1;
      }
      // particules lumineuses (braises, lucioles) : au-dessus de l'éclairage
      for (const p of s.particles) {
        if (!p.glow) continue;
        const q = this.toScreen(p.x, p.y, p.z);
        const a = p.firefly ? 0.35 + 0.65 * Math.max(0, Math.sin(this.time * 5 + p.seed)) : G.clamp(p.life / p.max * 1.5, 0, 1);
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        ctx.fillRect(q.x, q.y, 1, 1);
        if (p.firefly && a > 0.7 && hq) { ctx.globalAlpha = a * 0.3; ctx.fillRect(q.x - 1, q.y, 3, 1); ctx.fillRect(q.x, q.y - 1, 1, 3); }
      }
      ctx.globalAlpha = 1;
      if (hq && s.kind === 'camp' && dark > 0.25) this.drawMist(ctx, (dark - 0.25) / 0.47);

      // textes flottants (au-dessus de l'éclairage)
      for (const t of s.texts) {
        const q = this.toScreen(t.x, t.y, t.z);
        ctx.globalAlpha = Math.min(1, t.life * 2);
        ctx.drawImage(t.spr, Math.round(q.x - t.spr.width / 2), q.y);
      }
      ctx.globalAlpha = 1;
      // indicateur de cible
      if (h && h.target && !h.target.dead) {
        const q = this.toScreen(h.target.x, h.target.y);
        ctx.strokeStyle = '#ff5040';
        ctx.beginPath(); ctx.ellipse(q.x + 0.5, q.y + 0.5, 7 * (h.target.scale || 1), 3.5 * (h.target.scale || 1), 0, 0, Math.PI * 2); ctx.stroke();
      }
      if (h && !h.dead && this.mode !== 'title') {
        const q = this.toScreen(h.x, h.y);
        const bob = Math.round(Math.sin(this.time * 4));
        ctx.fillStyle = '#5ae05a';
        ctx.fillRect(q.x - 1, q.y - 27 + bob, 3, 1);
        ctx.fillRect(q.x, q.y - 26 + bob, 1, 1);
      }
      if (this.dest && this.time - this.dest.t < 0.5) {
        const q = this.toScreen(this.dest.x, this.dest.y);
        const r = 2 + (this.time - this.dest.t) * 10;
        ctx.strokeStyle = '#f0e0a0';
        ctx.beginPath(); ctx.ellipse(q.x, q.y, r * 2, r, 0, 0, Math.PI * 2); ctx.stroke();
      }
    },
    // Cache du sol : tuiles, bordures naturelles entre terrains et décalques, recalculé seulement si la carte change
    buildGround(s) {
      const W = (s.w + s.h) * 16 + 64, H = (s.w + s.h) * 8 + 64;
      if (!s.ground) s.ground = G.newCanvas(W, H);
      const g = s.ground.getContext('2d');
      g.clearRect(0, 0, W, H);
      s.gx = s.h * 16 + 32; s.gy = 32;
      const T = G.S.tiles, F = G.S.fringe;
      const floorSet = s.kind === 'dungeon' ? T['floor' + s.tier] : T.floor;
      const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];
      for (let y = 0; y < s.h; y++)
        for (let x = 0; x < s.w; x++) {
          const i = s.idx(x, y), t = s.tiles[i];
          const px = (x - y) * 16 + s.gx - 16, py = (x + y) * 8 + s.gy;
          if (t === 'water') {
            DIRS.forEach((d, k) => { if (s.tile(x + d[0], y + d[1]) === 'sand') g.drawImage(F.sand[k], px, py); });
            continue;
          }
          if (t === 'void' || t === 'wall') continue;
          let img;
          if (t === 'grass') {
            const tone = G.clamp(Math.floor(G.vnoise(x * 0.16, y * 0.16, 3) * 3.4 - 0.2), 0, 2);
            img = T.grass[tone * 4 + (s.variant[i] % 4)];
          } else if (t === 'floor') {
            const lk = s.look[i];
            img = lk === 2 ? T.carpet[0] : lk === 1 ? T.bossfloor[s.variant[i] % 2] : floorSet[s.variant[i] % floorSet.length];
          } else {
            const set = T[t];
            if (!set) continue;
            img = set[s.variant[i] % set.length];
          }
          g.drawImage(img, px, py);
          if (t !== 'grass' && s.kind === 'camp') DIRS.forEach((d, k) => { if (s.tile(x + d[0], y + d[1]) === 'grass') g.drawImage(F.grass[k], px, py); });
        }
      for (const d of s.decals) {
        const px = (d.x - d.y) * 16 + s.gx, py = (d.x + d.y) * 8 + s.gy;
        g.drawImage(d.spr.c, Math.round(px - d.spr.ox), Math.round(py - d.spr.oy));
      }
      s.groundDirty = false;
    },
    drawShadows(ctx, draw) {
      for (const o of draw) {
        if (o.kind === 'building' && !o.anchorPoint && o.spr && o.spr.shadow) {
          const p = this.toScreen(o.fp.x0, o.fp.y0), sd = o.spr.shadow;
          ctx.drawImage(sd.c, p.x - sd.ox, p.y - sd.oy);
        } else if (o.kind === 'tree' && !o.cut) {
          const p = this.toScreen(o.x, o.y), sd = G.S.treeShadow;
          ctx.drawImage(sd.c, p.x - sd.ox, p.y - sd.oy);
        }
      }
      for (const a of this.scene.actors) {
        const p = this.toScreen(a.x, a.y);
        const big = a.scale > 1.3;
        ctx.drawImage(big ? G.S.bigShadow : G.S.shadow, p.x - (big ? 15 : 7), p.y - (big ? 6 : 3));
      }
    },
    flamesOf(o) {
      const out = o.flames ? o.flames.slice() : [];
      if (o.spr && o.spr.flames && o.fp) for (const f of o.spr.flames) out.push({ x: o.fp.x0 + f.x, y: o.fp.y0 + f.y, z: f.z });
      return out;
    },
    drawFlames(ctx, em, o) {
      this.flamesOf(o).forEach((f, i) => {
        const fr = G.S.flame[(Math.floor(this.time * 10) + i + Math.floor(f.x * 7 + f.y * 3)) % 4];
        const q = this.toScreen(f.x, f.y, f.z);
        ctx.drawImage(fr.c, q.x - fr.ox, q.y - fr.oy);
        if (em) em.drawImage(fr.c, q.x - fr.ox, q.y - fr.oy);
      });
    },
    drawMist(ctx, a) {
      const m = G.S.mist;
      const ox = Math.floor(this.time * 3 + this.ox * 0.6), oy = Math.floor(this.oy * 0.6);
      ctx.globalAlpha = 0.07 * a;
      for (let y = -(((oy % 64) + 64) % 64); y < this.vh; y += 64)
        for (let x = -(((ox % 128) + 128) % 128); x < this.vw; x += 128) ctx.drawImage(m, x, y);
      ctx.globalAlpha = 1;
    },
    drawStars(ctx, a) {
      ctx.fillStyle = '#e8eaff';
      for (let i = 0; i < 70; i++) {
        const x = Math.floor(G.hash2(i, 1, 5) * this.vw * 1.5 - this.ox * 0.05) % this.vw;
        const y = Math.floor(G.hash2(i, 2, 5) * this.vh * 0.5);
        const tw = Math.sin(this.time * 2 + i) > 0.6 ? 1 : 0.5;
        ctx.globalAlpha = a * tw;
        ctx.fillRect((x + this.vw) % this.vw, y, 1, 1);
      }
      ctx.globalAlpha = 1;
    },
    drawShore(ctx, x0, x1, y0, y1) {
      const s = this.scene;
      ctx.fillStyle = '#c8e0f0';
      for (let y = y0; y <= y1; y++)
        for (let x = x0; x <= x1; x++) {
          if (s.tile(x, y) !== 'water') continue;
          if (s.tile(x + 1, y) === 'sand' || s.tile(x, y + 1) === 'sand') {
            const p = this.toScreen(x + 1, y + 1);
            const off = Math.round(Math.sin(this.time * 2 + x + y) * 1.5);
            if (s.tile(x + 1, y) === 'sand') for (let i = 0; i < 12; i += 2) ctx.fillRect(p.x + i + off, p.y - 8 + i / 2 - 1, 1, 1);
            if (s.tile(x, y + 1) === 'sand') for (let i = 0; i < 12; i += 2) ctx.fillRect(p.x - i + off - 2, p.y - 8 + i / 2 - 1, 1, 1);
          }
        }
    },
    // Sprite et position écran d'un objet : [sprite, x, y]
    objDraw(o) {
      if (o.kind === 'portal') {
        const f = G.S.portal[Math.floor(this.time * 6) % 4];
        const p = this.toScreen(o.x, o.y);
        return [f, p.x - f.ox, p.y - f.oy];
      }
      const spr = o.kind === 'pool' ? G.S.poolFrames[Math.floor(this.time * 2.5) % 3] : o.spr;
      if (!spr) return null;
      let p;
      if ((o.kind === 'building' && !o.anchorPoint) || o.isWall) p = this.toScreen(o.fp.x0, o.fp.y0);
      else if (o.kind === 'fence') p = this.toScreen(o.ax, o.ay);
      else if (o.kind === 'pool') { p = this.toScreen(o.fp.x0, o.fp.y0); return [spr, p.x - 24, p.y - 2]; }
      else {
        p = this.toScreen(o.x, o.y);
        if (o.shake) p.x += Math.round(Math.sin(this.time * 60) * 2 * o.shake * 4);
        if (o.kind === 'tree' || o.kind === 'rock') p.y += 3;
      }
      return [spr, p.x - spr.ox, p.y - spr.oy];
    },
    drawObject(ctx, o) {
      const r = this.objDraw(o);
      if (r) ctx.drawImage(r[0].c, r[1], r[2]);
    },
    drawLoot(ctx, l) {
      const p = this.toScreen(l.x, l.y, l.z + 3 + Math.sin(l.t * 5 + l.x) * 1.5);
      const ic = G.Art.icon(l.item);
      ctx.drawImage(G.S.shadow, p.x - 4, p.y + 7 + Math.round(l.z), 8, 3);
      ctx.drawImage(ic, p.x - 5, p.y - 5);
    },
    drawProj(ctx, p) {
      const q = this.toScreen(p.x, p.y, p.z);
      const s = G.iso(p.vx, p.vy);
      const d = Math.hypot(s.x, s.y) || 1;
      if (p.kind === 'arrow' || p.kind === 'bone') {
        ctx.strokeStyle = p.kind === 'bone' ? '#e8e0d0' : '#c8a070';
        ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(q.x - (s.x / d) * 6, q.y - (s.y / d) * 6); ctx.stroke();
        ctx.fillStyle = '#e0e0e8'; ctx.fillRect(q.x, q.y, 1, 1);
      } else if (p.kind === 'bolt') {
        ctx.fillStyle = '#80e0ff'; ctx.fillRect(q.x - 2, q.y - 2, 4, 4);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(q.x - 1, q.y - 1, 2, 2);
      } else if (p.kind === 'fire') {
        ctx.fillStyle = '#ff6020'; ctx.fillRect(q.x - 3, q.y - 3, 6, 6);
        ctx.fillStyle = '#ffd060'; ctx.fillRect(q.x - 2, q.y - 2, 4, 4);
      }
    },
    drawEffect(ctx, e) {
      const q = this.toScreen(e.x, e.y);
      if (e.type === 'ring') {
        const k = e.t / e.life;
        ctx.globalAlpha = 1 - k;
        ctx.strokeStyle = e.color;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(q.x, q.y, e.r * 16 * (0.3 + k * 0.7) * 1.41, e.r * 8 * (0.3 + k * 0.7) * 1.41, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.lineWidth = 1; ctx.globalAlpha = 1;
      } else if (e.type === 'tele') {
        const k = e.t / e.life;
        ctx.globalAlpha = 0.25 + 0.35 * Math.abs(Math.sin(e.t * 12));
        ctx.fillStyle = '#ff3020';
        ctx.beginPath(); ctx.ellipse(q.x, q.y, e.r * 16 * 1.41 * k, e.r * 8 * 1.41 * k, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#ff6040';
        ctx.beginPath(); ctx.ellipse(q.x, q.y, e.r * 16 * 1.41, e.r * 8 * 1.41, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 1;
      }
    },
    drawHpBar(ctx, x, y, f) {
      ctx.fillStyle = '#1b1424'; ctx.fillRect(x - 7, y, 14, 3);
      ctx.fillStyle = '#d83030'; ctx.fillRect(x - 6, y + 1, Math.max(1, Math.round(12 * f)), 1);
    },
    drawGhost(ctx) {
      const b = this.build, def = D.BUILDINGS[b.type];
      const ok = W.canPlace(this.scene, b.type, b.x, b.y) && G.has(def.cost);
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = ok ? '#60ff80' : '#ff4040';
      for (let y = b.y; y < b.y + def.d; y++)
        for (let x = b.x; x < b.x + def.w; x++) {
          const p = this.toScreen(x, y);
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + 16, p.y + 8); ctx.lineTo(p.x, p.y + 16); ctx.lineTo(p.x - 16, p.y + 8); ctx.closePath(); ctx.fill();
        }
      const spr = G.Art.buildingSprite(b.type);
      if (spr) {
        ctx.globalAlpha = 0.7;
        if (b.type === 'lantern' || b.type === 'farm') {
          const p = b.type === 'farm' ? this.toScreen(b.x + def.w - 0.6, b.y + 0.6) : this.toScreen(b.x + 0.5, b.y + 0.5);
          ctx.drawImage(spr.c, p.x - spr.ox, p.y - spr.oy);
        } else {
          const p = this.toScreen(b.x, b.y);
          ctx.drawImage(spr.c, p.x - spr.ox, p.y - spr.oy);
        }
      }
      ctx.globalAlpha = 1;
    },
    collectLights() {
      const s = this.scene, out = [];
      const night = this.darkness();
      for (const o of s.objects) {
        if (o.kind === 'building' && o.spr && o.spr.lights) {
          for (const l of o.spr.lights) {
            const bx = o.anchorPoint ? o.x - 0.12 : o.fp.x0, by = o.anchorPoint ? o.y - 0.12 : o.fp.y0;
            out.push({ x: bx + l.x, y: by + l.y, z: l.z, r: l.big ? 84 : l.color === 'lamp' ? 66 : l.color === 'fire' ? 70 : 46, color: l.color || 'window' });
          }
        } else if (o.light) out.push({ x: o.light.x != null ? o.light.x : o.x, y: o.light.y != null ? o.light.y : o.y, z: o.light.z != null ? o.light.z : 16, r: o.light.r, color: o.light.color });
        else if (o.kind === 'portal') out.push({ x: o.x, y: o.y, z: 4, r: 64, color: 'magic' });
        else if (o.kind === 'stairs' && !o.hidden) out.push({ x: o.x, y: o.y, z: 2, r: 34, color: 'magic' });
        else if (o.kind === 'chest' && o.opened) out.push({ x: o.x, y: o.y, z: 6, r: 26, color: 'lamp' });
      }
      const h = this.hero;
      if (h) out.push({ x: h.x, y: h.y, z: 10, r: s.kind === 'dungeon' ? 92 : 44 + night * 24, color: 'hero' });
      for (const p of s.projectiles) if (p.kind === 'fire' || p.kind === 'bolt') out.push({ x: p.x, y: p.y, z: p.z, r: 44, color: p.kind === 'fire' ? 'fire' : 'magic' });
      for (const e of s.effects) if (e.type === 'ring') out.push({ x: e.x, y: e.y, z: 4, r: 70 * (1 - e.t / e.life), color: 'fire' });
      return out;
    },
    // Éclairage : carte de lumière multipliée sur la scène. Bleu nuit ambiant, dégradés en paliers
    // (aspect pixel-art, pas de flou), lumières chaudes pour lanternes, fenêtres et feux.
    drawLighting(ctx, dark) {
      if (dark < 0.05) return;
      const l = this.lctx, vw = this.vw, vh = this.vh;
      const dungeon = this.scene.kind === 'dungeon';
      const k = dungeon ? 1 : G.clamp(dark / 0.72, 0, 1);
      const amb = dungeon ? [44, 38, 66] : [Math.round(255 - k * 192), Math.round(255 - k * 174), Math.round(255 - k * 112)];
      l.globalCompositeOperation = 'source-over';
      l.fillStyle = 'rgb(' + amb.join(',') + ')';
      l.fillRect(0, 0, vw, vh);
      l.globalCompositeOperation = 'lighter';
      const TINT = { fire: [255, 140, 60], lamp: [255, 200, 110], window: [255, 180, 95], magic: [150, 110, 255], hero: [190, 180, 165] };
      const lights = this.collectLights();
      const flick = (i) => 1 + Math.sin(this.time * 9 + i * 3.1) * 0.05 + Math.sin(this.time * 23 + i) * 0.03;
      const vis = [];
      lights.forEach((L, i) => {
        const q = this.toScreen(L.x, L.y, L.z);
        const r = L.r * (L.color === 'fire' || L.color === 'lamp' ? flick(i) : 1);
        if (q.x < -r || q.y < -r || q.x > vw + r || q.y > vh + r) return;
        vis.push({ q, r, L });
        const c = TINT[L.color].join(',');
        const a = (dungeon ? 1 : 0.35 + 0.65 * k) * (L.color === 'hero' && !dungeon ? 0.55 : 1);
        const g = l.createRadialGradient(q.x, q.y, 0, q.x, q.y, r);
        g.addColorStop(0, 'rgba(' + c + ',' + a + ')');
        g.addColorStop(0.32, 'rgba(' + c + ',' + a + ')');
        g.addColorStop(0.33, 'rgba(' + c + ',' + a * 0.66 + ')');
        g.addColorStop(0.62, 'rgba(' + c + ',' + a * 0.66 + ')');
        g.addColorStop(0.63, 'rgba(' + c + ',' + a * 0.3 + ')');
        g.addColorStop(1, 'rgba(' + c + ',0)');
        l.fillStyle = g;
        l.fillRect(q.x - r, q.y - r, r * 2, r * 2);
      });
      ctx.globalCompositeOperation = 'multiply';
      ctx.drawImage(this.light, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      if (!G.gfx.hq) return;
      // petit halo chaud au cœur des flammes et lanternes
      ctx.globalCompositeOperation = 'lighter';
      for (const v of vis) {
        if (v.L.color === 'hero' || v.L.color === 'window') continue;
        const r = v.r * 0.3, c = TINT[v.L.color].join(',');
        const g = ctx.createRadialGradient(v.q.x, v.q.y, 0, v.q.x, v.q.y, r);
        g.addColorStop(0, 'rgba(' + c + ',' + 0.28 * k + ')');
        g.addColorStop(0.5, 'rgba(' + c + ',' + 0.28 * k + ')');
        g.addColorStop(0.51, 'rgba(' + c + ',' + 0.1 * k + ')');
        g.addColorStop(1, 'rgba(' + c + ',0)');
        ctx.fillStyle = g;
        ctx.fillRect(v.q.x - r, v.q.y - r, r * 2, r * 2);
      }
      ctx.globalCompositeOperation = 'source-over';
    },

    // ---------------- Entrées ----------------
    bindInput() {
      window.addEventListener('keydown', (e) => {
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
        input.keys[e.code] = true;
        if (this.mode === 'title') return;
        if (e.code === 'Escape') { if (this.build) this.cancelBuild(); else G.ui.togglePanel('menu'); }
        if (G.ui.panelOpen()) return;
        if (e.code === 'Space') { e.preventDefault(); this.heroAttackKey(); }
        if (e.code === 'Digit1') this.heroAttackKey();
        if (e.code === 'Digit2' || e.code === 'KeyE') this.hero.useSkill(this);
        if (e.code === 'Digit3' || e.code === 'KeyR') this.usePotion();
        if (e.code === 'KeyI') G.ui.togglePanel('inventory');
        if (e.code === 'KeyH') G.ui.togglePanel('heroes');
        if (this.mode === 'camp') {
          if (e.code === 'KeyB') G.ui.togglePanel('build');
          if (e.code === 'KeyF') G.ui.togglePanel('forge');
          if (e.code === 'KeyM') G.ui.togglePanel('market');
          if (e.code === 'Enter' && this.build) this.confirmBuild();
        }
        if (e.code.startsWith('Arrow') || ['KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code)) e.preventDefault();
      });
      window.addEventListener('keyup', (e) => { input.keys[e.code] = false; });
      window.addEventListener('blur', () => { input.keys = {}; });
      const cv = this.canvas;
      const pos = (e) => {
        const r = cv.getBoundingClientRect();
        return { x: ((e.clientX - r.left) / r.width) * this.vw, y: ((e.clientY - r.top) / r.height) * this.vh };
      };
      cv.addEventListener('pointermove', (e) => {
        if (!this.build || e.pointerType !== 'mouse') return;
        const p = pos(e), w = this.toWorld(p.x, p.y);
        const def = D.BUILDINGS[this.build.type];
        this.build.x = Math.floor(w.x - def.w / 2 + 0.5);
        this.build.y = Math.floor(w.y - def.d / 2 + 0.5);
      });
      cv.addEventListener('pointerdown', (e) => {
        G.audio.init();
        if (this.mode === 'title' || G.ui.panelOpen()) return;
        const p = pos(e);
        this.tap(p.x, p.y, e.pointerType);
      });
      cv.addEventListener('contextmenu', (e) => e.preventDefault());
    },
    tap(px, py, ptype) {
      const s = this.scene, h = this.hero;
      if (h.dead) return;
      const w = this.toWorld(px, py);
      if (this.build) {
        const def = D.BUILDINGS[this.build.type];
        const nx = Math.floor(w.x - def.w / 2 + 0.5), ny = Math.floor(w.y - def.d / 2 + 0.5);
        if (nx === this.build.x && ny === this.build.y && (ptype === 'mouse' || this.build.armed)) this.confirmBuild();
        else { this.build.x = nx; this.build.y = ny; this.build.armed = true; }
        return;
      }
      // 1) ennemi ou personnage sous le pointeur (boîte écran)
      let best = null, bd = 1e9;
      for (const a of s.actors) {
        if (a === h) continue;
        const q = this.toScreen(a.x, a.y);
        const sc = a.scale || 1;
        if (px > q.x - 8 * sc && px < q.x + 8 * sc && py > q.y - 20 * sc && py < q.y + 3) {
          const d = Math.abs(px - q.x) + Math.abs(py - (q.y - 8));
          if (d < bd) { bd = d; best = a; }
        }
      }
      if (best instanceof E.Enemy) { h.target = best; h.path = null; h.interact = null; return; }
      if (best instanceof E.Villager) {
        if (best.heroId) { G.ui.open('heroes'); return; }
        best.bubble = 3;
        G.ui.toast('« ' + G.pick(D.VILLAGER_LINES) + ' »');
        return;
      }
      // 2) objet interactif (sprite ou tuile)
      const tx = Math.floor(w.x), ty = Math.floor(w.y);
      let obj = null;
      for (const o of s.objects) {
        if (!(o.kind === 'tree' || o.kind === 'rock' || o.kind === 'chest' || o.kind === 'portal' || o.kind === 'stairs' || (o.kind === 'prop' && o.breakable))) continue;
        if (o.cut || o.hidden) continue;
        const q = this.toScreen(o.x, o.y);
        const tall = o.kind === 'tree' ? 40 : 14;
        if (px > q.x - 10 && px < q.x + 10 && py > q.y - tall && py < q.y + 6) {
          const d = Math.abs(px - q.x) + Math.abs(py - q.y);
          if (!obj || d < obj.d) obj = { o, d };
        }
      }
      let o = obj && obj.o;
      if (!o && s.inside(tx, ty)) {
        const occ = s.occ[s.idx(tx, ty)];
        if (occ && occ.kind === 'building') o = occ;
      }
      if (!o) {
        // clic sur un bâtiment (sprite en hauteur)
        for (const b of s.objects) {
          if (b.kind !== 'building' || !b.spr || b.anchorPoint) continue;
          const q = this.toScreen(b.fp.x0, b.fp.y0);
          const x0 = q.x - b.spr.ox, y0 = q.y - b.spr.oy;
          if (px >= x0 && py >= y0 && px < x0 + b.spr.c.width && py < y0 + b.spr.c.height) {
            const cx = Math.floor(px - x0), cy = Math.floor(py - y0);
            const data = b.spr.c.getContext('2d').getImageData(cx, cy, 1, 1).data;
            if (data[3] > 0) { o = b; break; }
          }
        }
      }
      if (o) {
        if (this.distToObj(h, o) < 1.25) { this.interactWith(o); return; }
        const gx = o.fp ? G.clamp(h.x, o.fp.x0 - 0.5, o.fp.x1 + 0.5) : o.x, gy = o.fp ? G.clamp(h.y, o.fp.y0 - 0.5, o.fp.y1 + 0.5) : o.y;
        const target = o.kind === 'building' && o.fp ? (() => { const d = W.doorOf(o.b); return { x: d.x + 0.5, y: d.y + 0.5 }; })() : { x: gx, y: gy };
        h.path = s.path(h.x, h.y, target.x, target.y, 4000);
        h.target = null;
        h.interact = o;
        this.dest = { x: target.x, y: target.y, t: this.time };
        if (!h.path) h.interact = null;
        return;
      }
      // 3) déplacement
      if (!s.inside(tx, ty)) return;
      h.target = null; h.interact = null;
      h.path = s.path(h.x, h.y, w.x, w.y, 4000);
      if (h.path && h.path.length) { const last = h.path[h.path.length - 1]; if (!s.isSolid(w.x, w.y)) { last.x = w.x; last.y = w.y; } }
      this.dest = { x: w.x, y: w.y, t: this.time };
    },
  });

  // Tri en profondeur isométrique : clé x+y, puis correction locale des points autour des grandes emprises.
  function box(a) {
    if (a.fp && !a.anchorPoint) return a.fp;
    return null;
  }
  function key(a) {
    const b = box(a);
    if (!b) return a.x + a.y;
    return b.x0 + b.y0 + Math.min(b.x1 - b.x0, b.y1 - b.y0) - 0.05;
  }
  // true si le point p est derrière la boîte
  function pointVsBox(p, bx) {
    return !(p.x >= bx.x1 - 0.02 || p.y >= bx.y1 - 0.02);
  }
  function sortDepth(list) {
    for (const d of list) d._k = key(d);
    list.sort((a, b) => a._k - b._k);
    const big = list.filter((d) => { const b = box(d); return b && (b.x1 - b.x0) * (b.y1 - b.y0) > 1; });
    for (const o of big) {
      const b = o.fp;
      for (let i = 0; i < list.length; i++) {
        const p = list[i];
        if (box(p) || p.x < b.x0 - 2 || p.x > b.x1 + 2 || p.y < b.y0 - 2 || p.y > b.y1 + 2) continue;
        const bi = list.indexOf(o);
        const behind = pointVsBox(p, b);
        if (behind && i > bi) { list.splice(i, 1); list.splice(bi, 0, p); }
        else if (!behind && i < bi) { list.splice(i, 1); list.splice(list.indexOf(o) + 1, 0, p); i--; }
      }
    }
  }
})();
