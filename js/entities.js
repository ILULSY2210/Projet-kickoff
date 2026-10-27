'use strict';
// Entités : héros, monstres, villageois, animaux, projectiles, butin, particules.
(function () {
  const D = G.Data;
  const E = (G.Ent = {});

  class Actor {
    constructor(x, y) {
      this.x = x; this.y = y;
      this.r = 0.28;
      this.dir = 'front'; this.flip = false;
      this.anim = Math.random() * 10; this.moving = false;
      this.flash = 0; this.kbx = 0; this.kby = 0;
      this.dead = false; this.swing = 0; this.path = null;
    }
    moveBy(scene, dx, dy) {
      const ox = this.x, oy = this.y;
      if (scene.canStand(this.x + dx, this.y, this.r)) this.x += dx;
      if (scene.canStand(this.x, this.y + dy, this.r)) this.y += dy;
      return Math.abs(this.x - ox) + Math.abs(this.y - oy);
    }
    face(dx, dy) {
      const sx = dx - dy, sy = dx + dy;
      if (Math.abs(sx) > 0.05) this.flip = sx < 0;
      if (sy < -0.05) this.dir = 'back';
      else if (sy > 0.05) this.dir = 'front';
    }
    // Avance vers (tx,ty) à la vitesse sp. Retourne true si arrivé.
    stepTo(scene, tx, ty, sp, dt) {
      const dx = tx - this.x, dy = ty - this.y;
      const d = Math.hypot(dx, dy);
      if (d < 0.06) return true;
      const st = Math.min(d, sp * dt);
      this.face(dx, dy);
      this.moving = true;
      this.moveBy(scene, (dx / d) * st, (dy / d) * st);
      return d <= sp * dt;
    }
    followPath(scene, sp, dt) {
      if (!this.path || !this.path.length) { this.path = null; return true; }
      const n = this.path[0];
      if (this.stepTo(scene, n.x, n.y, sp, dt)) this.path.shift();
      return !this.path.length;
    }
    applyKnockback(scene, dt) {
      if (Math.abs(this.kbx) + Math.abs(this.kby) > 0.01) {
        this.moveBy(scene, this.kbx * dt, this.kby * dt);
        this.kbx *= Math.pow(0.002, dt); this.kby *= Math.pow(0.002, dt);
      }
    }
  }
  E.Actor = Actor;

  // Dessin d'un humanoïde + arme
  E.drawHumanoid = function (ctx, a, sx, sy, frames, scale, weapon) {
    scale = scale || 1;
    sx = Math.round(sx); sy = Math.round(sy);
    // marche (1-3), respiration au repos (alterne 0 et 4)
    const seq = a.moving ? 1 + (Math.floor(a.anim * 9) % 3) : frames[a.dir][4] && Math.floor(a.anim * 1.6) % 2 ? 4 : 0;
    const f = frames[a.dir][seq];
    const img = a.flash > 0 ? G.flashOf(f) : f;
    const w = 14 * scale, h = 20 * scale;
    // élan vers l'avant pendant un coup
    const lunge = a.swing > 0 && !(weapon && weapon.ranged) ? Math.round(Math.sin(a.swing * Math.PI) * 2 * scale) * (a.flip ? -1 : 1) : 0;
    sx += lunge;
    const dx = Math.round(sx - w / 2), dy = Math.round(sy - h + 1 * scale);
    const drawW = () => {
      if (!weapon) return;
      let hx = dx + 11.5 * scale, hy = dy + 11 * scale + (seq % 2 || seq === 4 ? scale : 0);
      if (a.flip) hx = 2 * sx - hx;
      let ang;
      if (weapon.ranged) ang = 0.15 - a.swing * 0.3;
      else if (a.spin > 0) ang = a.spin * Math.PI * 4;
      else ang = a.swing > 0 ? G.lerp(1.9, -1.4, a.swing) : 0.45;
      ctx.save();
      ctx.translate(Math.round(hx), Math.round(hy));
      if (a.flip) ctx.scale(-1, 1);
      ctx.rotate(ang);
      const wc = weapon.spr;
      ctx.drawImage(a.flash > 0 ? G.flashOf(wc.c) : wc.c, -wc.px * scale, -wc.py * scale, wc.c.width * scale, wc.c.height * scale);
      ctx.restore();
    };
    if (a.dir === 'back') drawW();
    ctx.save();
    if (a.flip) { ctx.translate(Math.round(sx) * 2, 0); ctx.scale(-1, 1); }
    ctx.drawImage(img, dx, dy, w, h);
    ctx.restore();
    if (a.dir !== 'back') drawW();
  };

  // ============================== HÉROS ==============================
  class Hero extends Actor {
    constructor(id, x, y) {
      super(x, y);
      this.id = id;
      this.def = D.HEROES[id];
      this.frames = G.Art.humanoid('hero:' + id, this.def.look);
      this.cd = 0; this.skillCd = 0; this.energy = 100;
      this.inv = 0; this.rage = 0; this.spin = 0;
      this.lastDir = { x: 1, y: 1 };
      this.target = null; this.interact = null;
      this.refresh();
      this.hp = this.maxHp;
    }
    get st() { return G.state.heroes[this.id]; }
    refresh() {
      const s = this.st, b = this.def;
      const wn = D.nodeById(s.weapon) || {};
      this.weaponNode = wn;
      const fam = D.WEAPONS[b.weapon];
      this.weapon = { spr: G.Art.weapon(fam.sprite, wn.blade || '#ccc', wn.accent || '#888'), ranged: !fam.melee };
      this.maxHp = b.hp + (s.lvl - 1) * 12 + (wn.hp || 0);
      this.atk = b.atk + (s.lvl - 1) * 2 + (wn.dmg || 0);
      this.defn = b.def + Math.floor(s.lvl / 3) + (wn.def || 0);
      this.crit = b.crit + (wn.crit || 0);
      this.steal = wn.steal || 0;
      this.baseAspd = b.aspd * (1 + (wn.aspd || 0) / 100);
      this.range = b.range;
      this.speed = b.speed;
      if (this.hp > this.maxHp) this.hp = this.maxHp;
    }
    get aspd() { return this.baseAspd * (this.rage > 0 ? 1.6 : 1); }
    xpNeeded() { return Math.floor(25 * Math.pow(this.st.lvl, 1.5)); }
    addXp(n) {
      const s = this.st;
      s.xp += n;
      while (s.xp >= this.xpNeeded()) {
        s.xp -= this.xpNeeded();
        s.lvl++;
        this.refresh();
        this.hp = this.maxHp;
        G.game.floatText(this.x, this.y, 'NIVEAU ' + s.lvl + ' !', '#ffe070', 30);
        G.audio.play('level');
        G.ui.toast(this.def.name + ' passe au niveau ' + s.lvl + ' !');
      }
    }
    rollDamage(mult) {
      let dmg = this.atk * G.rnd(0.85, 1.15) * (mult || 1);
      const crit = Math.random() * 100 < this.crit;
      if (crit) dmg *= 1.8;
      return { dmg, crit };
    }
    update(dt, g) {
      const scene = g.scene;
      this.anim += dt;
      this.moving = false;
      this.cd -= dt; this.skillCd -= dt; this.inv -= dt; this.flash -= dt;
      this.swing = Math.max(0, this.swing - dt * 4);
      this.spin = Math.max(0, this.spin - dt * 2.5);
      if (this.rage > 0) {
        this.rage -= dt;
        if (Math.random() < dt * 12) g.particle(this.x, this.y, 10, { color: '#ff4030', vz: 20, life: 0.5 });
      }
      this.energy = Math.min(100, this.energy + dt * (scene.kind === 'camp' ? 25 : 9));
      if (scene.kind === 'camp') this.hp = Math.min(this.maxHp, this.hp + dt * 8);
      this.applyKnockback(scene, dt);
      if (this.dead) return;

      const k = g.input.moveVec();
      if (k) {
        this.path = null; this.target = null; this.interact = null;
        this.face(k.x, k.y);
        this.lastDir = k;
        this.moving = true;
        this.moveBy(scene, k.x * this.speed * dt, k.y * this.speed * dt);
      } else if (this.target) {
        const t = this.target;
        if (t.dead || !scene.actors.includes(t)) { this.target = null; this.path = null; }
        else {
          const d = G.dist(this.x, this.y, t.x, t.y);
          const visible = this.weapon.ranged ? scene.los(this.x, this.y, t.x, t.y) : true;
          if (d <= this.range + t.r && visible) {
            this.path = null;
            this.face(t.x - this.x, t.y - this.y);
            this.lastDir = { x: (t.x - this.x) / (d || 1), y: (t.y - this.y) / (d || 1) };
            if (this.cd <= 0) this.attack(t, g);
          } else {
            this.repath = (this.repath || 0) - dt;
            if (!this.path || this.repath <= 0) { this.path = scene.path(this.x, this.y, t.x, t.y, 2500); this.repath = 0.35; }
            if (this.path && this.path.length) this.followPath(scene, this.speed, dt);
            else this.stepTo(scene, t.x, t.y, this.speed, dt);
          }
        }
      } else if (this.path) {
        const dx = this.path.length ? this.path[0].x - this.x : 0, dy = this.path.length ? this.path[0].y - this.y : 0;
        if (this.followPath(scene, this.speed, dt)) this.path = null;
        if (Math.hypot(dx, dy) > 0.01) this.lastDir = { x: dx / Math.hypot(dx, dy), y: dy / Math.hypot(dx, dy) };
      }
      if (this.interact) {
        const o = this.interact;
        if (G.game.distToObj(this, o) < 1.25) {
          this.path = null;
          this.face(o.x - this.x, o.y - this.y);
          if (this.cd <= 0) { this.interact = null; g.interactWith(o); }
        } else if (!this.path) this.interact = null;
      }
      // Attaque automatique si un ennemi est collé au héros et qu'on ne fait rien
      if (scene.kind === 'dungeon' && !this.target && !k && !this.path) {
        const e = g.nearestEnemy(this.x, this.y, this.weapon.ranged ? this.range : 1.4);
        if (e && (!this.weapon.ranged || scene.los(this.x, this.y, e.x, e.y))) this.target = e;
      }
    }
    attack(t, g) {
      this.cd = 1 / this.aspd;
      this.swing = 1;
      if (this.weapon.ranged) {
        const r = this.rollDamage();
        const kind = this.def.weapon === 'staff' ? 'bolt' : 'arrow';
        g.shoot(this.x, this.y, t.x, t.y, { from: 'hero', dmg: r.dmg, crit: r.crit, kind, speed: kind === 'bolt' ? 8 : 11 });
        G.audio.play('shoot');
      } else {
        const r = this.rollDamage();
        g.hitEnemy(t, r.dmg, r.crit, this);
        G.audio.play('hit');
      }
    }
    useSkill(g) {
      const sk = this.def.skill;
      if (this.skillCd > 0) { G.ui.toast('Compétence en recharge…'); return; }
      if (this.energy < sk.cost) { G.ui.toast('Pas assez d’énergie'); return; }
      if (g.scene.kind !== 'dungeon') { G.ui.toast('Les compétences servent au donjon !'); return; }
      this.energy -= sk.cost;
      this.skillCd = sk.cd;
      G.audio.play('skill');
      const t = this.target && !this.target.dead ? this.target : g.nearestEnemy(this.x, this.y, 7);
      let dir = this.lastDir;
      if (t) { const d = G.dist(this.x, this.y, t.x, t.y) || 1; dir = { x: (t.x - this.x) / d, y: (t.y - this.y) / d }; this.face(dir.x, dir.y); }
      if (sk.id === 'whirl') {
        this.spin = 1;
        g.ring(this.x, this.y, 1.9, '#ffe9a0');
        for (const e of g.enemiesIn(this.x, this.y, 1.9)) { const r = this.rollDamage(1.6); g.hitEnemy(e, r.dmg, r.crit, this); }
      } else if (sk.id === 'volley') {
        const a0 = Math.atan2(dir.y, dir.x);
        for (let i = -2; i <= 2; i++) {
          const a = a0 + i * 0.2;
          const r = this.rollDamage(0.9);
          g.shoot(this.x, this.y, this.x + Math.cos(a) * 6, this.y + Math.sin(a) * 6, { from: 'hero', dmg: r.dmg, crit: r.crit, kind: 'arrow', speed: 12 });
        }
        this.swing = 1;
      } else if (sk.id === 'fireball') {
        const r = this.rollDamage(2.2);
        g.shoot(this.x, this.y, this.x + dir.x * 6, this.y + dir.y * 6, { from: 'hero', dmg: r.dmg, crit: r.crit, kind: 'fire', speed: 7, aoe: 1.8 });
        this.swing = 1;
      } else if (sk.id === 'quake') {
        g.shake = 0.35;
        g.ring(this.x, this.y, 2.6, '#d8b070');
        for (const e of g.enemiesIn(this.x, this.y, 2.6)) { const r = this.rollDamage(1.3); g.hitEnemy(e, r.dmg, r.crit, this); e.stun = 1.8; }
        G.audio.play('boom');
      } else if (sk.id === 'rage') {
        this.rage = 6;
        g.ring(this.x, this.y, 1.2, '#ff5040');
        G.ui.toast('RAGE !');
      }
    }
    hurt(dmg, g, fromX, fromY) {
      if (this.inv > 0 || this.dead) return;
      const real = Math.max(1, Math.round(dmg - this.defn * 0.6));
      this.hp -= real;
      this.inv = 0.35; this.flash = 0.12;
      const d = G.dist(this.x, this.y, fromX, fromY) || 1;
      this.kbx = ((this.x - fromX) / d) * 4; this.kby = ((this.y - fromY) / d) * 4;
      g.floatText(this.x, this.y, '-' + real, '#ff6060');
      g.shake = Math.max(g.shake, 0.12);
      G.audio.play('hurt');
      if (this.hp <= 0) { this.hp = 0; this.dead = true; g.onHeroDeath(); }
    }
    draw(ctx, sx, sy) {
      E.drawHumanoid(ctx, this, sx, sy, this.frames, 1, this.weapon);
    }
  }
  E.Hero = Hero;

  // ============================== MONSTRES ==============================
  class Enemy extends Actor {
    constructor(type, x, y, floor, opts) {
      super(x, y);
      this.type = type;
      const d = (this.def = D.ENEMIES[type]);
      const k = 1 + 0.32 * (floor - 1);
      const elite = opts && opts.elite;
      this.boss = !!d.boss;
      this.elite = elite;
      this.name = this.boss ? D.bossName(floor) : (elite ? d.name + ' (élite)' : d.name);
      this.maxHp = Math.round(d.hp * k * (elite ? 2.2 : 1) * (this.boss ? 1 + 0.5 * Math.floor((floor - 3) / 3) : 1));
      this.hp = this.maxHp;
      this.atk = d.atk * (1 + 0.22 * (floor - 1)) * (elite ? 1.3 : 1);
      this.defn = d.def + Math.floor(floor / 3);
      this.speed = d.speed;
      this.range = d.range;
      this.scale = (d.scale || 1) * (elite ? 1.15 : 1);
      this.r = 0.3 * this.scale;
      this.xp = Math.round(d.xp * (1 + 0.3 * (floor - 1)) * (elite ? 2.5 : 1));
      this.floor = floor;
      this.cd = G.rnd(0.5, 1.5);
      this.aggro = false;
      this.home = { x, y };
      this.wander = null; this.wait = G.rnd(0, 2);
      this.stun = 0; this.windup = 0; this.special = 5;
      if (d.look) {
        let look = d.look;
        if (this.boss && floor >= 6) look = Object.assign({}, look, floor >= 9 ? { metal: '#f0c840', shirt: '#d8a830', pants: '#b88a20', skin: '#f0c840', hair: '#f0c840' } : { metal: '#c0c8d8', shirt: '#a0a8b8', pants: '#8890a0', skin: '#c0c8d8', hair: '#c0c8d8' });
        this.frames = G.Art.humanoid('enemy:' + type + (this.boss ? floor : ''), look);
      } else if (type === 'bat') this.frames = G.Art.bat();
      else this.frames = G.Art.slime(d.color);
      if (d.weapon) this.weapon = { spr: G.Art.weapon(d.weapon[0], d.weapon[1], d.weapon[2]), ranged: !!d.ranged };
    }
    update(dt, g) {
      const scene = g.scene, h = g.hero;
      this.anim += dt;
      this.flash -= dt;
      this.moving = false;
      this.swing = Math.max(0, this.swing - dt * 3);
      this.applyKnockback(scene, dt);
      if (this.stun > 0) { this.stun -= dt; return; }
      this.cd -= dt;
      const d = G.dist(this.x, this.y, h.x, h.y);
      if (!this.aggro && !h.dead && d < 6.5 && scene.los(this.x, this.y, h.x, h.y)) {
        this.aggro = true;
        for (const o of g.enemiesIn(this.x, this.y, 4)) o.aggro = true;
      }
      if (h.dead) this.aggro = false;
      const sp = this.speed * (this.boss && this.hp < this.maxHp / 2 ? 1.35 : 1);

      if (this.windup > 0) {
        this.windup -= dt;
        if (this.windup <= 0) this.resolveAttack(g);
        return;
      }
      if (!this.aggro) {
        this.wait -= dt;
        if (this.wait <= 0) {
          if (!this.wander) this.wander = { x: this.home.x + G.rnd(-2, 2), y: this.home.y + G.rnd(-2, 2) };
          if (this.stepTo(scene, this.wander.x, this.wander.y, sp * 0.4, dt) || Math.random() < dt * 0.3) { this.wander = null; this.wait = G.rnd(1, 3); }
        }
        return;
      }
      // Attaque spéciale du boss : onde de choc
      if (this.boss) {
        this.special -= dt;
        if (this.special <= 0 && d < 4) {
          this.special = this.hp < this.maxHp / 2 ? 4 : 6;
          this.windup = 0.9; this.slam = true;
          g.telegraph(this.x, this.y, 2.4, 0.9);
          return;
        }
      }
      const see = scene.los(this.x, this.y, h.x, h.y);
      if (this.def.ranged) {
        if (d < 2.2 && see) {
          const ax = (this.x - h.x) / (d || 1), ay = (this.y - h.y) / (d || 1);
          this.face(-ax, -ay); this.moving = true;
          this.moveBy(scene, ax * sp * dt, ay * sp * dt);
        } else if (d > this.range * 0.9 || !see) this.approach(g, sp, dt);
        else this.face(h.x - this.x, h.y - this.y);
        if (see && d <= this.range && this.cd <= 0) {
          this.cd = 1 / this.def.aspd;
          this.swing = 1;
          g.shoot(this.x, this.y, h.x, h.y, { from: 'enemy', dmg: this.atk, kind: 'bone', speed: 6.5 });
        }
      } else {
        if (d > this.range + h.r) this.approach(g, sp, dt);
        else if (this.cd <= 0) {
          this.face(h.x - this.x, h.y - this.y);
          this.windup = this.boss ? 0.45 : 0.25;
          this.cd = 1 / this.def.aspd;
          this.swing = 1;
        }
      }
    }
    approach(g, sp, dt) {
      const scene = g.scene, h = g.hero;
      let spd = sp;
      if (this.type === 'slime' || this.type === 'blueSlime') spd *= Math.sin(this.anim * 7) > 0 ? 1.7 : 0.25;
      if (scene.los(this.x, this.y, h.x, h.y)) {
        this.path = null;
        let tx = h.x, ty = h.y;
        if (this.type === 'bat') { tx += Math.sin(this.anim * 5) * 0.8; ty += Math.cos(this.anim * 4) * 0.8; }
        this.stepTo(scene, tx, ty, spd, dt);
      } else {
        this.repath = (this.repath || 0) - dt;
        if (!this.path || this.repath <= 0) { this.path = scene.path(this.x, this.y, h.x, h.y, 1500); this.repath = 0.8; }
        if (this.path && this.path.length) this.followPath(scene, spd, dt);
      }
    }
    resolveAttack(g) {
      const h = g.hero;
      if (this.slam) {
        this.slam = false;
        g.shake = 0.3;
        g.ring(this.x, this.y, 2.4, '#ffb050');
        G.audio.play('boom');
        if (G.dist(this.x, this.y, h.x, h.y) < 2.4 + h.r) h.hurt(this.atk * 1.6, g, this.x, this.y);
        return;
      }
      if (G.dist(this.x, this.y, h.x, h.y) <= this.range + h.r + 0.3) h.hurt(this.atk, g, this.x, this.y);
    }
    draw(ctx, sx, sy) {
      if (this.def.look) {
        E.drawHumanoid(ctx, this, sx, sy, this.frames, this.scale, this.weapon);
        if (this.stun > 0) for (let i = 0; i < 3; i++) {
          const a = this.anim * 4 + (i * Math.PI * 2) / 3;
          ctx.fillStyle = '#ffe070';
          ctx.fillRect(Math.round(sx + Math.cos(a) * 6), Math.round(sy - 22 * this.scale + Math.sin(a) * 2), 1, 1);
        }
        return;
      }
      const fr = this.frames[Math.floor(this.anim * (this.type === 'bat' ? 10 : 4)) % 2];
      const img = this.flash > 0 ? G.flashOf(fr) : fr;
      const fly = this.type === 'bat' ? 10 + Math.sin(this.anim * 6) * 2 : 0;
      ctx.save();
      if (this.flip) { ctx.translate(Math.round(sx) * 2, 0); ctx.scale(-1, 1); }
      ctx.drawImage(img, Math.round(sx - (fr.width * this.scale) / 2), Math.round(sy - fr.height * this.scale + 1 - fly), fr.width * this.scale, fr.height * this.scale);
      ctx.restore();
    }
  }
  E.Enemy = Enemy;

  // ============================== VILLAGEOIS ==============================
  class Villager extends Actor {
    constructor(x, y, look, key, opts) {
      super(x, y);
      this.frames = G.Art.humanoid(key, look);
      this.wait = G.rnd(0, 3);
      this.speed = 1.3;
      this.bubble = 0;
      this.heroId = opts && opts.heroId;
      this.name = opts && opts.name;
      if (opts && opts.weapon) this.weapon = opts.weapon;
    }
    update(dt, g) {
      const scene = g.scene;
      this.anim += dt;
      this.moving = false;
      this.bubble -= dt;
      if (this.path) {
        if (this.followPath(scene, this.speed, dt)) { this.path = null; this.wait = G.rnd(2, 6); }
        return;
      }
      this.wait -= dt;
      if (this.wait <= 0) {
        const P = G.World.PLAZA;
        for (let a = 0; a < 8; a++) {
          const tx = G.irnd(P.x0 - 7, P.x1 + 6), ty = G.irnd(P.y0 - 7, P.y1 + 6);
          if (!scene.isSolid(tx, ty) && scene.tile(tx, ty) !== 'water') {
            this.path = scene.path(this.x, this.y, tx, ty, 1500);
            break;
          }
        }
        this.wait = G.rnd(2, 5);
        if (!this.heroId && Math.random() < 0.3) this.bubble = 2.5;
      }
    }
    draw(ctx, sx, sy) {
      E.drawHumanoid(ctx, this, sx, sy, this.frames, 1, this.weapon);
      if (this.bubble > 0) {
        const b = G.Art.bubble || (G.Art.bubble = G.spr(['.kkkkkkkk.', 'kWWWWWWWWk', 'kWkWWkWkWk', 'kWWWWWWWWk', '.kkkWkkkk.', '...kk.....'], { k: '#1b1424', W: '#f4f0e8' }));
        ctx.drawImage(b, Math.round(sx - 2), Math.round(sy - 30));
      }
    }
  }
  E.Villager = Villager;

  // ============================== ANIMAUX ==============================
  class Animal extends Actor {
    constructor(kind, x, y, bounds) {
      super(x, y);
      this.kind = kind;
      this.frames = G.Art.animal(kind);
      this.bounds = bounds;
      this.wait = G.rnd(0, 4);
      this.speed = kind === 'chicken' ? 1.2 : 0.6;
      this.r = 0.2;
    }
    update(dt, g) {
      this.anim += dt;
      this.moving = false;
      if (this.goal) {
        const dx = this.goal.x - this.x, dy = this.goal.y - this.y, d = Math.hypot(dx, dy);
        if (d < 0.05) { this.goal = null; this.wait = G.rnd(1, 5); return; }
        const st = Math.min(d, this.speed * dt);
        this.x += (dx / d) * st; this.y += (dy / d) * st;
        this.face(dx, dy);
        this.moving = true;
        return;
      }
      this.wait -= dt;
      if (this.wait <= 0) {
        const b = this.bounds;
        for (let a = 0; a < 6; a++) {
          const gx = G.rnd(b.x0, b.x1), gy = G.rnd(b.y0, b.y1);
          if (b.free || !g.scene.isSolid(gx, gy)) { this.goal = { x: gx, y: gy }; break; }
        }
        this.wait = 1;
      }
    }
    draw(ctx, sx, sy) {
      const fr = this.frames[this.moving ? Math.floor(this.anim * 6) % 2 : 0];
      ctx.save();
      if (this.flip) { ctx.translate(Math.round(sx) * 2, 0); ctx.scale(-1, 1); }
      ctx.drawImage(fr, Math.round(sx - fr.width / 2), Math.round(sy - fr.height + 1));
      ctx.restore();
    }
  }
  E.Animal = Animal;
})();
