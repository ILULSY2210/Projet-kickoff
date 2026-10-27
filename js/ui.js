'use strict';
// Interface HTML : HUD, barre d'actions, panneaux (inventaire, construction, forge, marché, héros…).
(function () {
  const D = G.Data;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const icon = (id, cls) => '<img class="px ' + (cls || '') + '" alt="" src="' + G.Art.iconURL(id, 3) + '">';
  const costHTML = (cost) => Object.keys(cost).map((k) => {
    const ok = (G.state.inv[k] || 0) >= cost[k];
    return '<span class="cost ' + (ok ? '' : 'missing') + '">' + icon(k, 'ic-s') + cost[k] + '</span>';
  }).join('');

  const portraitCache = {};
  function portrait(id, look, scale) {
    const key = id + scale;
    if (portraitCache[key]) return portraitCache[key];
    const fr = G.Art.humanoid('hero:' + id, look).front[0];
    return (portraitCache[key] = G.Art.toURL(fr, scale || 4));
  }
  function headPortrait(id) {
    const key = 'head' + id;
    if (portraitCache[key]) return portraitCache[key];
    const fr = G.Art.humanoid('hero:' + id, D.HEROES[id].look).front[0];
    const c = G.newCanvas(14, 12);
    c.getContext('2d').drawImage(fr, 0, 0, 14, 12, 0, 0, 14, 12);
    return (portraitCache[key] = G.Art.toURL(c, 4));
  }
  function spriteURL(canvas, scale) {
    if (!canvas.__url) canvas.__url = {};
    if (!canvas.__url[scale]) canvas.__url[scale] = G.Art.toURL(canvas, scale);
    return canvas.__url[scale];
  }

  const ui = (G.ui = {
    current: null,
    init() {
      $('btn-menu').addEventListener('click', () => this.togglePanel('menu'));
      $('panel').addEventListener('pointerdown', (e) => { if (e.target.id === 'panel') this.close(); });
      $('panel-close').addEventListener('click', () => this.close());
      $('panel-body').addEventListener('click', (e) => this.onPanelClick(e));
      $('hotbar').addEventListener('click', (e) => {
        const b = e.target.closest('[data-act]');
        if (b) { G.audio.init(); this.hotbarAction(b.dataset.act); }
      });
      $('build-ok').addEventListener('click', () => G.game.confirmBuild());
      $('build-cancel').addEventListener('click', () => G.game.cancelBuild());
      $('title-new').addEventListener('click', () => {
        if (G.loadSave()) {
          this.titleConfirm();
          return;
        }
        this.startGame(true);
      });
      $('title-continue').addEventListener('click', () => this.startGame(false));
      $('title-continue').hidden = !G.loadSave();
      this.buildTitleArt();
    },
    titleConfirm() {
      const box = $('title-confirm');
      box.hidden = false;
      $('title-yes').onclick = () => { box.hidden = true; this.startGame(true); };
      $('title-no').onclick = () => { box.hidden = true; };
    },
    startGame(fresh) {
      G.audio.init();
      if (fresh) { G.clearSave(); G.state = G.newState(); }
      G.game.enterCamp(true);
      $('title').hidden = true;
      $('hud').hidden = false;
      this.refresh();
      if (fresh) this.banner('BASTION DES LANTERNES', 'Construis ton camp, conquiers le donjon, choisis tes héros.');
      G.save();
    },
    buildTitleArt() {
      $('feat-camp').src = G.Art.buildingThumb('house');
      const k = G.Art.humanoid('enemy:knight3', D.ENEMIES.knight.look).front[0];
      $('feat-dungeon').src = spriteURL(k, 4);
      $('feat-heroes').src = portrait('bram', D.HEROES.bram.look, 4);
      const row = $('title-heroes');
      row.innerHTML = D.HERO_ORDER.map((id) => '<img class="px" alt="' + esc(D.HEROES[id].name) + '" src="' + portrait(id, D.HEROES[id].look, 4) + '">').join('');
    },

    // ---------------- HUD ----------------
    onScene() {
      const dungeon = G.game.scene.kind === 'dungeon';
      if (G.game.build) { G.game.build = null; this.onBuildMode(); }
      $('minimap').hidden = !dungeon;
      $('floor-tag').hidden = !dungeon;
      if (dungeon) $('floor-tag').textContent = 'Étage ' + G.game.scene.floor;
      this.close();
      this.renderHotbar();
      this.refresh();
    },
    renderHotbar() {
      const g = G.game, h = g.hero;
      const btn = (act, img, label, key) => '<button class="slot" data-act="' + act + '" title="' + esc(label) + '"><img class="px" alt="" src="' + img + '"><span class="slot-label">' + esc(label) + '</span>' + (key ? '<kbd>' + key + '</kbd>' : '') + '<span class="slot-count" id="cnt-' + act + '"></span></button>';
      let html = '';
      const wIcon = spriteURL(h.weapon.spr.c, 3);
      if (g.scene.kind === 'dungeon') {
        html += btn('attack', wIcon, 'Attaque', '1');
        html += btn('skill', this.skillIcon(h.def.skill.id), h.def.skill.name, '2');
        html += btn('potion', G.Art.iconURL('potion', 3), 'Potion', '3');
        html += btn('inventory', this.bagIcon(), 'Sac', 'I');
      } else {
        html += btn('build', spriteURL(G.Art.weapon('hammer', '#b0b6c0', '#8a6a3a').c, 3), 'Construire', 'B');
        html += btn('inventory', this.bagIcon(), 'Inventaire', 'I');
        html += btn('heroes', headPortrait(G.state.active), 'Héros', 'H');
        html += btn('forge', spriteURL(G.S.anvil.c, 3), 'Forge', 'F');
        html += btn('market', G.Art.iconURL('gold', 3), 'Marché', 'M');
        html += btn('expedition', spriteURL(G.S.stairs.c, 2), 'Donjon', '');
      }
      $('hotbar').innerHTML = html;
      $('portrait').src = headPortrait(G.state.active);
      $('hero-name').textContent = h.def.name;
    },
    skillIcon(id) {
      const key = 'skill' + id;
      if (G.Art.urls[key]) return G.Art.urls[key];
      const pb = new G.PB(12, 12);
      const col = { whirl: '#ffe9a0', volley: '#c8a070', fireball: '#ff7030', quake: '#d8b070', rage: '#ff4030' }[id];
      if (id === 'volley') for (let i = 0; i < 3; i++) { pb.line(1 + i * 3, 10, 6 + i * 3, 2, col); pb.set(6 + i * 3, 1, '#e0e0e8'); }
      else if (id === 'fireball') { pb.ellipse(6, 6, 5, 5, (x, y, dx, dy) => (Math.hypot(dx, dy) < 0.5 ? '#ffe070' : col)); }
      else if (id === 'rage') { pb.poly([[6, 0], [11, 11], [1, 11]], col); pb.rect(5, 4, 2, 4, '#ffe070'); pb.set(5, 9, '#ffe070'); pb.set(6, 9, '#ffe070'); }
      else { for (let a = 0; a < 40; a++) { const t = (a / 40) * Math.PI * 2; pb.set(6 + Math.cos(t) * 5, 6 + Math.sin(t) * (id === 'quake' ? 3 : 5), col); } pb.rect(5, 5, 2, 2, col); }
      pb.outline('#1b1424');
      return (G.Art.urls[key] = G.Art.toURL(pb.canvas(), 3));
    },
    bagIcon() {
      if (G.Art.urls.bag) return G.Art.urls.bag;
      const c = G.spr(['...kkkk...', '..kBkkBk..', '..k....k..', '.kkkkkkkk.', 'kBBBBBBBBk', 'kBbBBBBbBk', 'kBBByyBBBk', 'kBBBBBBBBk', 'kbbbbbbbbk', '.kkkkkkkk.'], { k: '#1b1424', B: '#9a6a3a', b: '#6a4426', y: '#e0b040' });
      return (G.Art.urls.bag = G.Art.toURL(c, 3));
    },
    hotbarAction(act) {
      const g = G.game;
      if (act === 'attack') g.heroAttackKey();
      else if (act === 'skill') g.hero.useSkill(g);
      else if (act === 'potion') g.usePotion();
      else this.togglePanel(act);
    },
    refresh() {
      const inv = G.state.inv;
      $('res').innerHTML = D.RES.map((k) => '<span class="res" title="' + D.ITEMS[k].name + '">' + icon(k, 'ic-s') + '<b>' + (inv[k] || 0) + '</b></span>').join('');
      const g = G.game;
      if (g.run) {
        const n = Object.values(g.run.loot).reduce((a, b) => a + b, 0);
        $('res').innerHTML += '<span class="res bag" title="Butin de l’expédition">' + '<img class="px ic-s" alt="" src="' + this.bagIcon() + '"><b>' + n + '</b></span>';
      }
      const pc = $('cnt-potion');
      if (pc) pc.textContent = (inv.potion || 0) + (g.run && g.run.loot.potion ? g.run.loot.potion : 0);
      this.renderQuest();
      if (this.current && this.current !== 'menu' && this.current !== 'confirm' && this.current !== 'summary') this.render(this.current, this.arg, true);
    },
    renderQuest() {
      const st = G.state;
      const q = D.QUESTS[st.quest];
      $('quest').innerHTML = q ? '<div class="q-head">Objectif</div><div class="q-text">' + esc(q.text) + '</div>' : '<div class="q-head">Objectifs terminés</div><div class="q-text">Descends toujours plus bas !</div>';
    },
    tick() {
      const h = G.game.hero;
      if (!h) return;
      const set = (id, v) => { const el = $(id); if (el.__v !== v) { el.__v = v; el.textContent = v; } };
      const bar = (id, f) => { const el = $(id); const v = Math.round(G.clamp(f, 0, 1) * 1000) / 10 + '%'; if (el.__w !== v) { el.__w = v; el.style.width = v; } };
      bar('hp-fill', h.hp / h.maxHp);
      set('hp-text', 'PV ' + Math.ceil(h.hp) + '/' + h.maxHp);
      bar('en-fill', h.energy / 100);
      set('en-text', 'Énergie ' + Math.floor(h.energy) + '/100');
      bar('xp-fill', h.st.xp / h.xpNeeded());
      set('lvl', 'NIV ' + h.st.lvl);
      const sk = document.querySelector('[data-act="skill"]');
      if (sk) sk.classList.toggle('cooling', h.skillCd > 0 || h.energy < h.def.skill.cost);
      // boss
      const g = G.game;
      let boss = null;
      if (g.scene.kind === 'dungeon') for (const a of g.scene.actors) if (a.boss && a.aggro) boss = a;
      $('bossbar').hidden = !boss;
      if (boss) { set('boss-name', boss.name); bar('boss-fill', boss.hp / boss.maxHp); }
      if (g.scene.kind === 'dungeon') this.drawMinimap();
      // horloge
      const t = G.state.dayTime;
      const hh = Math.floor(t * 24), mm = Math.floor((t * 24 - hh) * 60 / 10) * 10;
      set('clock', g.scene.kind === 'dungeon' ? 'Profondeurs' : String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0'));
    },
    drawMinimap() {
      this.mmT = (this.mmT || 0) + 1;
      if (this.mmT % 6) return;
      const c = $('minimap'), s = G.game.scene, h = G.game.hero;
      const ctx = c.getContext('2d');
      const sz = 2;
      c.width = s.w * sz; c.height = s.h * sz;
      ctx.fillStyle = '#0c0a12';
      ctx.fillRect(0, 0, c.width, c.height);
      for (let y = 0; y < s.h; y++)
        for (let x = 0; x < s.w; x++) {
          const i = s.idx(x, y);
          if (!s.explored[i]) continue;
          const t = s.tiles[i];
          if (t === 'floor') ctx.fillStyle = '#5a5264';
          else if (t === 'wall') ctx.fillStyle = '#2a2430';
          else continue;
          ctx.fillRect(x * sz, y * sz, sz, sz);
        }
      const st = s.stairs;
      if (!st.hidden && s.explored[s.idx(Math.floor(st.x), Math.floor(st.y))]) { ctx.fillStyle = '#b07aff'; ctx.fillRect(Math.floor(st.x) * sz - 1, Math.floor(st.y) * sz - 1, 4, 4); }
      ctx.fillStyle = '#5ae05a';
      ctx.fillRect(Math.floor(h.x) * sz - 1, Math.floor(h.y) * sz - 1, 4, 4);
    },
    toast(msg) {
      const box = $('toasts');
      const el = document.createElement('div');
      el.className = 'toast';
      el.textContent = msg;
      box.appendChild(el);
      while (box.children.length > 3) box.removeChild(box.firstChild);
      setTimeout(() => el.classList.add('out'), 2200);
      setTimeout(() => el.remove(), 2700);
    },
    banner(title, sub) {
      const b = $('banner');
      b.innerHTML = '<div class="b-title">' + esc(title) + '</div>' + (sub ? '<div class="b-sub">' + esc(sub) + '</div>' : '');
      b.hidden = false;
      b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
      clearTimeout(this.bannerT);
      this.bannerT = setTimeout(() => { b.hidden = true; }, 3200);
    },
    questDone(q) {
      const r = Object.keys(q.reward).map((k) => q.reward[k] + ' ' + D.ITEMS[k].name).join(', ');
      this.toast('Objectif accompli ! Récompense : ' + r);
      G.audio.play('level');
      this.renderQuest();
    },
    onBuildMode() {
      const b = G.game.build;
      $('buildbar').hidden = !b;
      $('hotbar').hidden = !!b;
      if (b) $('build-name').textContent = D.BUILDINGS[b.type].name + ' — touche le sol pour placer, puis valide';
    },

    // ---------------- Panneaux ----------------
    panelOpen() { return !$('panel').hidden; },
    togglePanel(name, arg) {
      if (this.current === name && this.panelOpen()) this.close();
      else this.open(name, arg);
    },
    open(name, arg) {
      const g = G.game;
      if (g.scene.kind === 'dungeon' && ['build', 'forge', 'market', 'expedition', 'building'].includes(name)) { this.toast('Disponible au camp seulement'); return; }
      if (g.build && name !== 'menu') g.cancelBuild();
      this.current = name; this.arg = arg;
      if (name === 'forge' && !arg) this.arg = G.state.active;
      this.render(name, this.arg);
      $('panel').hidden = false;
      g.paused = name === 'menu';
      G.audio.play('ui');
    },
    close() {
      $('panel').hidden = true;
      this.current = null;
      G.game.paused = false;
    },
    render(name, arg, soft) {
      const body = $('panel-body');
      const scroll = body.scrollTop;
      const r = this['p_' + name](arg);
      $('panel-title').textContent = r.title;
      $('panel-box').className = 'panel-box ' + (r.cls || '');
      body.innerHTML = r.html;
      if (soft) body.scrollTop = scroll;
    },
    confirm(msg, yes) {
      this.confirmYes = yes;
      this.open('confirm', msg);
    },
    summary(dead, lines) {
      this.open('summary', { dead, lines });
    },
    onPanelClick(e) {
      const b = e.target.closest('[data-do]');
      if (!b || b.disabled) return;
      const a = b.dataset.do, v = b.dataset.v;
      const g = G.game, st = G.state;
      G.audio.play('ui');
      switch (a) {
        case 'close': this.close(); break;
        case 'yes': { const f = this.confirmYes; this.close(); if (f) f(); break; }
        case 'build': this.close(); g.startBuild(v); break;
        case 'upgrade': {
          const o = this.arg, cost = D.upgradeCost(o.b.type, o.b.lvl);
          if (G.pay(cost)) { o.b.lvl++; this.toast(D.BUILDINGS[o.b.type].name + ' niveau ' + o.b.lvl + ' !'); G.audio.play('build'); G.save(); this.render('building', o); }
          break;
        }
        case 'forge-hero': this.arg = v; this.render('forge', v); break;
        case 'craft': {
          const n = D.nodeById(v), hs = st.heroes[this.arg];
          if (G.pay(n.cost)) {
            hs.unlocked.push(v); hs.weapon = v; st.stats.forged++;
            if (this.arg === st.active) { g.hero.refresh(); this.renderHotbar(); }
            G.audio.play('build');
            this.toast(n.name + ' forgée !');
            G.save();
            this.render('forge', this.arg);
          }
          break;
        }
        case 'equip': {
          st.heroes[this.arg].weapon = v;
          if (this.arg === st.active) { g.hero.refresh(); this.renderHotbar(); }
          this.render('forge', this.arg);
          break;
        }
        case 'sell': {
          const it = D.ITEMS[v], n = st.inv[v] || 0;
          if (n > 0) { st.inv[v] = 0; G.give({ gold: n * it.sell }); G.audio.play('coin'); this.toast('Vendu : ' + n + ' × ' + it.name + ' (+' + n * it.sell + ' or)'); }
          break;
        }
        case 'sellall': {
          let total = 0;
          for (const k in D.ITEMS) if (D.ITEMS[k].sell && st.inv[k]) { total += st.inv[k] * D.ITEMS[k].sell; st.inv[k] = 0; }
          if (total) { G.give({ gold: total }); G.audio.play('coin'); this.toast('Butin vendu : +' + total + ' or'); }
          break;
        }
        case 'buy': {
          const offer = MARKET[v];
          if (G.pay({ gold: offer.price })) { G.give({ [offer.item]: offer.n }); G.audio.play('coin'); }
          else this.toast('Pas assez d’or');
          break;
        }
        case 'hero-pick': {
          st.active = v;
          g.enterCamp(false);
          const p = g.hero; p.x = 17.5; p.y = 18.5; g.snapCam();
          this.toast(D.HEROES[v].name + ' prend la tête de l’expédition !');
          G.save();
          break;
        }
        case 'recruit': {
          const h = D.HEROES[v];
          if (G.pay({ gold: h.cost })) {
            st.heroes[v].owned = true;
            G.audio.play('level');
            this.toast(h.name + ' rejoint ton camp !');
            G.save();
            const P = G.World.PLAZA;
            const wn = D.nodeById(st.heroes[v].weapon);
            g.scene.actors.push(new G.Ent.Villager(G.rnd(P.x0, P.x1), G.rnd(P.y0, P.y1), h.look, 'hero:' + v, { heroId: v, name: h.name, weapon: { spr: G.Art.weapon(D.WEAPONS[h.weapon].sprite, wn.blade, wn.accent), ranged: !D.WEAPONS[h.weapon].melee } }));
            this.render('heroes');
          } else this.toast('Pas assez d’or');
          break;
        }
        case 'go': { const f = +v; if (g.startExpedition(f)) this.close(); break; }
        case 'potion': g.usePotion(); this.render('inventory'); break;
        case 'save': G.save(); this.toast('Partie sauvegardée'); break;
        case 'sound': G.audio.muted = !G.audio.muted; this.render('menu'); break;
        case 'flee': this.close(); this.confirm('Abandonner l’expédition ? Tu perdras la moitié du butin.', () => g.leaveDungeon(true)); break;
        case 'newgame': this.render('newgame'); break;
        case 'reset': G.clearSave(); G.state = G.newState(); this.close(); g.enterCamp(true); this.refresh(); this.banner('NOUVELLE PARTIE', 'Bonne chance, héros !'); G.save(); break;
        case 'help': this.render('help'); break;
        case 'menu': this.render('menu'); break;
      }
    },

    p_menu() {
      const dungeon = G.game.scene.kind === 'dungeon';
      return {
        title: 'Menu', cls: 'narrow',
        html: '<div class="menu-list">' +
          '<button class="btn" data-do="close">Reprendre</button>' +
          '<button class="btn" data-do="help">Commandes</button>' +
          '<button class="btn" data-do="save">Sauvegarder</button>' +
          '<button class="btn" data-do="sound">Son : ' + (G.audio.muted ? 'coupé' : 'activé') + '</button>' +
          (dungeon ? '<button class="btn warn" data-do="flee">Abandonner l’expédition</button>' : '') +
          '<button class="btn danger" data-do="newgame">Nouvelle partie</button></div>',
      };
    },
    p_newgame() {
      return { title: 'Nouvelle partie', cls: 'narrow', html: '<p>Ta progression actuelle sera effacée. Continuer ?</p><div class="row-btns"><button class="btn danger" data-do="reset">Effacer et recommencer</button><button class="btn" data-do="menu">Retour</button></div>' };
    },
    p_help() {
      const rows = [
        ['Se déplacer', 'ZQSD / WASD / flèches, ou toucher le sol'],
        ['Interagir', 'Toucher un arbre, un rocher, un bâtiment, un coffre…'],
        ['Attaquer', 'Toucher un monstre, ou Espace / 1'],
        ['Compétence', '2 ou E'],
        ['Potion', '3 ou R'],
        ['Inventaire / Héros', 'I / H'],
        ['Construire / Forge / Marché', 'B / F / M (au camp)'],
        ['Menu', 'Échap'],
      ];
      return {
        title: 'Commandes', cls: 'narrow',
        html: '<table class="keys">' + rows.map((r) => '<tr><th>' + esc(r[0]) + '</th><td>' + esc(r[1]) + '</td></tr>').join('') + '</table>' +
          '<p class="muted">La partie est sauvegardée automatiquement dans ce navigateur. Les bâtiments produisent même pendant tes expéditions.</p><button class="btn" data-do="menu">Retour</button>',
      };
    },
    p_confirm(msg) {
      return { title: 'Confirmer', cls: 'narrow', html: '<p>' + esc(msg) + '</p><div class="row-btns"><button class="btn primary" data-do="yes">Oui</button><button class="btn" data-do="close">Non</button></div>' };
    },
    p_summary(a) {
      return {
        title: a.dead ? 'Vaincu…' : 'Retour au camp', cls: 'narrow',
        html: '<p>' + (a.dead ? 'Tes villageois t’ont ramené au camp. Tu as perdu la moitié du butin.' : 'Expédition réussie ! Tout le butin est rangé.') + '</p>' +
          (a.lines.length ? '<ul class="loot-list">' + a.lines.map((l) => '<li>' + esc(l) + '</li>').join('') + '</ul>' : '<p class="muted">Aucun butin rapporté.</p>') +
          '<button class="btn primary" data-do="close">Continuer</button>',
      };
    },
    p_inventory() {
      const st = G.state, g = G.game;
      const slots = (inv) => {
        const keys = Object.keys(D.ITEMS).filter((k) => inv[k] > 0);
        let html = keys.map((k) => '<div class="inv-slot" title="' + esc(D.ITEMS[k].name + ' — ' + D.ITEMS[k].desc) + '">' + icon(k) + '<span class="n">' + inv[k] + '</span></div>').join('');
        for (let i = keys.length; i < Math.max(15, Math.ceil(keys.length / 5) * 5); i++) html += '<div class="inv-slot empty"></div>';
        return '<div class="inv-grid">' + html + '</div>';
      };
      const h = g.hero;
      const wn = h.weaponNode;
      let html = '<div class="equip"><img class="px" alt="" src="' + spriteURL(h.weapon.spr.c, 4) + '"><div><b>' + esc(wn.name) + '</b><div class="muted">' + esc(h.def.name) + ' · ' + esc(h.def.role) + '</div><div class="stats">ATQ ' + Math.round(h.atk) + ' · DEF ' + h.defn + ' · CRIT ' + h.crit + ' % · VIT ' + h.aspd.toFixed(2) + '/s</div></div></div>';
      if (g.run) html += '<h3>Butin de l’expédition</h3>' + slots(g.run.loot);
      html += '<h3>Réserve du camp</h3>' + slots(st.inv);
      html += '<div class="inv-foot"><span class="gold">' + icon('gold', 'ic-s') + (st.inv.gold || 0) + ' or</span><button class="btn" data-do="potion"' + ((st.inv.potion || 0) + (g.run && g.run.loot.potion || 0) ? '' : ' disabled') + '>Boire une potion</button></div>';
      return { title: 'Inventaire', html };
    },
    p_build() {
      const st = G.state;
      let html = '<p class="muted">Choisis un bâtiment, puis touche le sol pour le placer.</p><div class="cards">';
      for (const t of D.BUILD_ORDER) {
        const b = D.BUILDINGS[t];
        const owned = st.buildings.some((x) => x.type === t);
        const locked = b.needFloor && st.maxFloor < b.needFloor;
        const dis = (b.unique && owned) || locked || !G.has(b.cost);
        const why = b.unique && owned ? 'Déjà construite' : locked ? 'Atteins l’étage ' + b.needFloor : !G.has(b.cost) ? 'Ressources insuffisantes' : 'Construire';
        html += '<div class="card"><img class="px thumb" alt="" src="' + G.Art.buildingThumb(t) + '"><div class="card-body"><b>' + esc(b.name) + '</b><div class="muted">' + esc(b.desc) + '</div><div class="costs">' + costHTML(b.cost) + '</div></div><button class="btn ' + (dis ? '' : 'primary') + '" data-do="build" data-v="' + t + '"' + (dis ? ' disabled' : '') + '>' + why + '</button></div>';
      }
      return { title: 'Construire', html: html + '</div>' };
    },
    p_building(o) {
      const b = o.b, def = D.BUILDINGS[b.type];
      let html = '<div class="card solo"><img class="px thumb" alt="" src="' + G.Art.buildingThumb(b.type) + '"><div class="card-body"><b>' + esc(def.name) + (def.noUpgrade ? '' : ' — niveau ' + b.lvl) + '</b><div class="muted">' + esc(def.desc) + '</div>';
      if (def.prod) {
        const every = def.prod.every / (1 + 0.6 * (b.lvl - 1));
        html += '<div class="stats">Produit ' + def.prod.amount + ' ' + esc(D.ITEMS[def.prod.res].name.toLowerCase()) + ' toutes les ' + every.toFixed(1) + ' s</div>';
      }
      html += '</div></div>';
      if (!def.noUpgrade) {
        if (b.lvl >= D.MAX_LVL) html += '<p class="muted">Niveau maximum atteint.</p>';
        else {
          const cost = D.upgradeCost(b.type, b.lvl);
          html += '<div class="upgrade"><span>Améliorer au niveau ' + (b.lvl + 1) + ' (+60 % de production)</span><div class="costs">' + costHTML(cost) + '</div><button class="btn primary" data-do="upgrade"' + (G.has(cost) ? '' : ' disabled') + '>Améliorer</button></div>';
        }
      }
      return { title: def.name, cls: 'narrow', html };
    },
    p_forge(heroId) {
      const st = G.state;
      heroId = heroId || st.active;
      const hd = D.HEROES[heroId], hs = st.heroes[heroId];
      const fam = D.WEAPONS[hd.weapon];
      let html = '<div class="tabs">' + D.HERO_ORDER.filter((id) => st.heroes[id].owned).map((id) => '<button class="tab ' + (id === heroId ? 'on' : '') + '" data-do="forge-hero" data-v="' + id + '"><img class="px" alt="" src="' + headPortrait(id) + '">' + esc(D.HEROES[id].name) + '</button>').join('') + '</div>';
      html += '<p class="muted">Arbre de l’arme : ' + esc(fam.label.toLowerCase()) + '. Le dernier palier propose deux voies.</p><div class="tree">';
      const tiers = [1, 2, 3, 4];
      for (const t of tiers) {
        const nodes = fam.nodes.filter((n) => n.tier === t);
        html += '<div class="tier">';
        for (const n of nodes) {
          const unlocked = hs.unlocked.includes(n.id);
          const equipped = hs.weapon === n.id;
          const avail = !unlocked && (!n.parent || hs.unlocked.includes(n.parent));
          const otherBranch = t === 4 && fam.nodes.some((m) => m.tier === 4 && m.id !== n.id && hs.unlocked.includes(m.id));
          const spr = G.Art.weapon(fam.sprite, n.blade, n.accent);
          let stats = 'Dégâts ' + n.dmg;
          if (n.crit) stats += ' · Crit +' + n.crit + ' %';
          if (n.aspd) stats += ' · Vitesse ' + (n.aspd > 0 ? '+' : '') + n.aspd + ' %';
          if (n.def) stats += ' · Déf +' + n.def;
          if (n.hp) stats += ' · PV +' + n.hp;
          if (n.steal) stats += ' · Vol de vie ' + n.steal + ' %';
          let action;
          if (equipped) action = '<span class="tag on">Équipée</span>';
          else if (unlocked) action = '<button class="btn" data-do="equip" data-v="' + n.id + '">Équiper</button>';
          else if (avail && !otherBranch) action = '<div class="costs">' + costHTML(n.cost) + '</div><button class="btn primary" data-do="craft" data-v="' + n.id + '"' + (G.has(n.cost) ? '' : ' disabled') + '>Forger</button>';
          else action = '<span class="tag">' + (otherBranch ? 'Autre voie choisie' : 'Verrouillée') + '</span>';
          html += '<div class="node ' + (equipped ? 'equipped ' : '') + (unlocked ? 'unlocked' : avail ? 'avail' : 'locked') + '"><div class="node-head"><img class="px" alt="" src="' + spriteURL(spr.c, 3) + '"><div><b>' + esc(n.name) + '</b><div class="stars">' + '★'.repeat(n.tier) + '<span>' + '★'.repeat(4 - n.tier) + '</span></div></div></div><div class="stats">' + stats + '</div>' + (n.note ? '<div class="muted small">' + esc(n.note) + '</div>' : '') + '<div class="node-act">' + action + '</div></div>';
        }
        html += '</div>';
      }
      return { title: 'Forge', cls: 'wide', html: html + '</div>' };
    },
    p_market() {
      const st = G.state;
      const sellable = Object.keys(D.ITEMS).filter((k) => D.ITEMS[k].sell && st.inv[k] > 0);
      let html = '<h3>Vendre</h3>';
      if (!sellable.length) html += '<p class="muted">Rien à vendre. Rapporte du butin du donjon !</p>';
      else {
        html += '<div class="list">' + sellable.map((k) => '<div class="li">' + icon(k) + '<span class="grow">' + esc(D.ITEMS[k].name) + ' × ' + st.inv[k] + '</span><span class="muted">' + D.ITEMS[k].sell + ' or/u</span><button class="btn" data-do="sell" data-v="' + k + '">Vendre</button></div>').join('') + '</div>';
        html += '<button class="btn primary" data-do="sellall">Tout vendre</button>';
      }
      html += '<h3>Acheter</h3><div class="list">' + Object.keys(MARKET).map((k) => {
        const o = MARKET[k];
        return '<div class="li">' + icon(o.item) + '<span class="grow">' + esc(o.label) + '</span><span class="cost ' + ((st.inv.gold || 0) >= o.price ? '' : 'missing') + '">' + icon('gold', 'ic-s') + o.price + '</span><button class="btn" data-do="buy" data-v="' + k + '"' + ((st.inv.gold || 0) >= o.price ? '' : ' disabled') + '>Acheter</button></div>';
      }).join('') + '</div>';
      return { title: 'Marché', cls: 'narrow', html };
    },
    p_heroes() {
      const st = G.state, g = G.game;
      const tavern = st.buildings.some((b) => b.type === 'tavern');
      const dungeon = g.scene.kind === 'dungeon';
      let html = '<p class="muted">' + (tavern ? 'Recrute des héros à la taverne et choisis celui qui part en expédition.' : 'Construis la taverne pour recruter de nouveaux héros.') + '</p><div class="heroes">';
      for (const id of D.HERO_ORDER) {
        const h = D.HEROES[id], hs = st.heroes[id];
        const active = st.active === id;
        const wn = D.nodeById(hs.weapon);
        let act;
        if (active) act = '<span class="tag on">En expédition</span>';
        else if (hs.owned) act = '<button class="btn primary" data-do="hero-pick" data-v="' + id + '"' + (dungeon ? ' disabled' : '') + '>Choisir</button>';
        else if (!tavern) act = '<span class="tag">Taverne requise</span>';
        else act = '<button class="btn primary" data-do="recruit" data-v="' + id + '"' + ((st.inv.gold || 0) >= h.cost && !dungeon ? '' : ' disabled') + '>' + icon('gold', 'ic-s') + h.cost + ' Recruter</button>';
        html += '<div class="hero-card ' + (active ? 'active ' : '') + (hs.owned ? '' : 'unowned') + '"><img class="px hero-img" alt="" src="' + portrait(id, h.look, 4) + '"><div class="hero-info"><b>' + esc(h.name) + '</b> <span class="muted">' + esc(h.role) + (hs.owned ? ' · niv ' + hs.lvl : '') + '</span>' +
          '<div class="stats">PV ' + (h.hp + (hs.lvl - 1) * 12) + ' · ATQ ' + (h.atk + (hs.lvl - 1) * 2 + wn.dmg) + ' · DEF ' + h.def + ' · ' + (D.WEAPONS[h.weapon].melee ? 'Mêlée' : 'Distance') + '</div>' +
          '<div class="muted small">' + esc(h.desc) + '</div><div class="small">Arme : ' + esc(wn.name) + ' · Compétence : ' + esc(h.skill.name) + '</div></div><div class="hero-act">' + act + '</div></div>';
      }
      return { title: 'Héros', cls: 'wide', html: html + '</div>' };
    },
    p_expedition() {
      const st = G.state;
      let html = '<p>Chaque expédition consomme des provisions. Le butin n’est rangé au camp que si tu reviens par le portail : si tu tombes, tu en perds la moitié.</p><div class="floors">';
      for (let f = 1; f <= st.maxFloor; f++) {
        const c = D.expeditionCost(f);
        const ok = (st.inv.food || 0) >= c;
        html += '<button class="floor ' + (f % 3 === 0 ? 'boss' : '') + '" data-do="go" data-v="' + f + '"' + (ok ? '' : ' disabled') + '><b>Étage ' + f + '</b><span>' + icon('food', 'ic-s') + c + '</span>' + (f % 3 === 0 ? '<em>Boss</em>' : '') + '</button>';
      }
      html += '</div><p class="muted small">Héros actif : ' + esc(D.HEROES[st.active].name) + '. Change-le dans le panneau Héros.</p>';
      return { title: 'Expédition', cls: 'narrow', html };
    },
  });

  const MARKET = {
    potion: { item: 'potion', n: 1, price: 15, label: 'Potion de soin' },
    iron: { item: 'iron', n: 1, price: 14, label: 'Lingot de fer' },
    food: { item: 'food', n: 5, price: 8, label: '5 provisions' },
    wood: { item: 'wood', n: 10, price: 12, label: '10 bois' },
    gem: { item: 'gem', n: 1, price: 90, label: 'Gemme' },
  };
})();
