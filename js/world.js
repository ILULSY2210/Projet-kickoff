'use strict';
// Cartes : le camp (construit depuis la sauvegarde) et le donjon (généré procéduralement).
(function () {
  const W = (G.World = {});
  const D = G.Data;

  class Scene {
    constructor(kind, w, h) {
      this.kind = kind;
      this.w = w; this.h = h;
      this.tiles = new Array(w * h).fill('void');
      this.variant = new Uint8Array(w * h);
      this.solid = new Uint8Array(w * h);
      this.occ = new Array(w * h).fill(null); // objet qui occupe la tuile
      this.objects = [];
      this.actors = [];
      this.projectiles = [];
      this.particles = [];
      this.loot = [];
      this.texts = [];
      this.effects = [];
      for (let i = 0; i < w * h; i++) this.variant[i] = Math.floor(G.hash2(i % w, Math.floor(i / w), 77) * 255);
    }
    idx(x, y) { return y * this.w + x; }
    inside(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
    tile(x, y) { return this.inside(x, y) ? this.tiles[this.idx(x, y)] : 'void'; }
    setTile(x, y, t) { if (this.inside(x, y)) this.tiles[this.idx(x, y)] = t; }
    isSolid(x, y) {
      x = Math.floor(x); y = Math.floor(y);
      return !this.inside(x, y) || this.solid[this.idx(x, y)] === 1;
    }
    canStand(x, y, r) {
      return !this.isSolid(x - r, y - r) && !this.isSolid(x + r, y - r) && !this.isSolid(x - r, y + r) && !this.isSolid(x + r, y + r);
    }
    isWall(x, y) {
      const t = this.tile(Math.floor(x), Math.floor(y));
      return t === 'wall' || t === 'void' || t === 'water';
    }
    los(ax, ay, bx, by) {
      const n = Math.ceil(G.dist(ax, ay, bx, by) * 4);
      for (let i = 1; i < n; i++) if (this.isWall(G.lerp(ax, bx, i / n), G.lerp(ay, by, i / n))) return false;
      return true;
    }
    addObject(o) {
      this.objects.push(o);
      if (o.fp) {
        for (let y = o.fp.y0; y < o.fp.y1; y++)
          for (let x = o.fp.x0; x < o.fp.x1; x++) {
            if (!this.inside(x, y)) continue;
            this.occ[this.idx(x, y)] = o;
            if (o.solid) this.solid[this.idx(x, y)] = 1;
          }
      }
      return o;
    }
    removeObject(o) {
      const i = this.objects.indexOf(o);
      if (i >= 0) this.objects.splice(i, 1);
      if (o.fp) {
        for (let y = o.fp.y0; y < o.fp.y1; y++)
          for (let x = o.fp.x0; x < o.fp.x1; x++) {
            if (!this.inside(x, y) || this.occ[this.idx(x, y)] !== o) continue;
            this.occ[this.idx(x, y)] = null;
            this.solid[this.idx(x, y)] = this.baseSolid(x, y) ? 1 : 0;
          }
      }
    }
    baseSolid(x, y) {
      const t = this.tile(x, y);
      return t === 'water' || t === 'wall' || t === 'void';
    }
    // A* 8 directions sans couper les coins. Retourne une liste de centres de tuiles.
    path(sx, sy, tx, ty, maxNodes) {
      sx = Math.floor(sx); sy = Math.floor(sy); tx = Math.floor(tx); ty = Math.floor(ty);
      if (!this.inside(tx, ty)) return null;
      if (sx === tx && sy === ty) return [];
      const w = this.w, N = this.w * this.h;
      const g = new Float32Array(N).fill(Infinity);
      const from = new Int32Array(N).fill(-1);
      const closed = new Uint8Array(N);
      const heap = [];
      const push = (i, f) => {
        heap.push([f, i]);
        let c = heap.length - 1;
        while (c > 0) {
          const p = (c - 1) >> 1;
          if (heap[p][0] <= heap[c][0]) break;
          [heap[p], heap[c]] = [heap[c], heap[p]];
          c = p;
        }
      };
      const pop = () => {
        const top = heap[0], last = heap.pop();
        if (heap.length) {
          heap[0] = last;
          let c = 0;
          for (;;) {
            const l = c * 2 + 1, r = l + 1;
            let m = c;
            if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
            if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
            if (m === c) break;
            [heap[m], heap[c]] = [heap[c], heap[m]];
            c = m;
          }
        }
        return top;
      };
      const h = (x, y) => { const dx = Math.abs(x - tx), dy = Math.abs(y - ty); return Math.max(dx, dy) + 0.41 * Math.min(dx, dy); };
      const s = sy * w + sx, goal = ty * w + tx;
      const goalSolid = this.solid[goal] === 1;
      g[s] = 0;
      push(s, h(sx, sy));
      let count = 0, best = s, bestH = h(sx, sy);
      while (heap.length && count++ < (maxNodes || 5000)) {
        const cur = pop()[1];
        if (closed[cur]) continue;
        closed[cur] = 1;
        const cx = cur % w, cy = (cur / w) | 0;
        const hh = h(cx, cy);
        if (hh < bestH) { bestH = hh; best = cur; }
        if (cur === goal) { best = cur; break; }
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            const nx = cx + dx, ny = cy + dy;
            if (!this.inside(nx, ny)) continue;
            const ni = ny * w + nx;
            if (closed[ni]) continue;
            const blocked = this.solid[ni] === 1 && !(ni === goal && goalSolid);
            if (blocked) continue;
            if (dx && dy && (this.solid[cy * w + nx] || this.solid[ny * w + cx])) continue;
            const ng = g[cur] + (dx && dy ? 1.41 : 1);
            if (ng < g[ni]) { g[ni] = ng; from[ni] = cur; push(ni, ng + h(nx, ny)); }
          }
      }
      if (best === s) return null;
      const out = [];
      let c = best;
      while (c !== s && c !== -1) {
        if (!(c === goal && goalSolid)) out.push({ x: (c % w) + 0.5, y: ((c / w) | 0) + 0.5 });
        c = from[c];
      }
      return out.reverse();
    }
  }
  W.Scene = Scene;

  // ===================================================================
  //                               CAMP
  // ===================================================================
  W.CAMP_W = 34; W.CAMP_H = 34;
  W.PLAZA = { x0: 15, y0: 14, x1: 20, y1: 19 };
  W.defaultBuildings = function () {
    return [
      { type: 'forge', x: 10, y: 16, lvl: 1 },
      { type: 'house', x: 20, y: 9, lvl: 1 },
      { type: 'market', x: 16, y: 20, lvl: 1 },
      { type: 'pen', x: 13, y: 6, lvl: 1 },
      { type: 'farm', x: 6, y: 11, lvl: 1 },
      { type: 'dungeon', x: 25, y: 25, lvl: 1 },
      { type: 'lantern', x: 14, y: 13, lvl: 1 },
      { type: 'lantern', x: 21, y: 18, lvl: 1 },
      { type: 'lantern', x: 13, y: 21, lvl: 1 },
      { type: 'lantern', x: 24, y: 23, lvl: 1 },
    ];
  };

  W.doorOf = function (b) {
    const def = D.BUILDINGS[b.type];
    return { x: b.x + Math.floor(def.w / 2), y: b.y + def.d };
  };

  W.addBuilding = function (scene, b) {
    const def = D.BUILDINGS[b.type];
    const o = {
      kind: 'building', b, type: b.type, x: b.x, y: b.y,
      fp: { x0: b.x, y0: b.y, x1: b.x + def.w, y1: b.y + def.d },
      solid: !def.walkable, spr: G.Art.buildingSprite(b.type), t: Math.random() * 5,
    };
    if (b.type === 'farm') {
      for (let y = b.y; y < b.y + def.d; y++)
        for (let x = b.x; x < b.x + def.w; x++) {
          scene.setTile(x, y, 'field');
          const kind = (x + y) % 3 === 0 ? 'cabbage' : (x * 7 + y) % 4 === 0 ? 'sprout' : 'pumpkin';
          scene.objects.push({ kind: 'crop', x: x + 0.5, y: y + 0.5, spr: G.S[kind], deco: true, farm: o });
        }
      o.x = b.x + def.w - 0.6; o.y = b.y + 0.6; // épouvantail
      o.anchorPoint = true;
    }
    if (b.type === 'lantern') { o.x = b.x + 0.5; o.y = b.y + 0.5; o.anchorPoint = true; }
    if (b.type === 'pen') {
      const { x0, y0, x1, y1 } = o.fp;
      for (let x = x0; x < x1; x++) {
        scene.objects.push({ kind: 'fence', x: x + 0.5, y: y0, spr: G.S.fenceX, ax: x, ay: y0 });
        scene.objects.push({ kind: 'fence', x: x + 0.5, y: y1, spr: G.S.fenceX, ax: x, ay: y1 });
      }
      for (let y = y0; y < y1; y++) {
        scene.objects.push({ kind: 'fence', x: x0, y: y + 0.5, spr: G.S.fenceY, ax: x0, ay: y });
        scene.objects.push({ kind: 'fence', x: x1, y: y + 0.5, spr: G.S.fenceY, ax: x1, ay: y });
      }
      o.spr = null;
    }
    if (b.type === 'forge') {
      scene.objects.push({ kind: 'prop', x: b.x + 1.2, y: b.y + 3.6, spr: G.S.anvil, deco: true });
      scene.objects.push({ kind: 'prop', x: b.x + 3.4, y: b.y + 2.6, spr: G.S.barrel, deco: true });
    }
    if (b.type === 'market') {
      scene.objects.push({ kind: 'prop', x: b.x + 2.4, y: b.y + 0.4, spr: G.S.barrel, deco: true });
      scene.objects.push({ kind: 'prop', x: b.x + 2.4, y: b.y + 1.2, spr: G.S.crate, deco: true });
    }
    scene.addObject(o);
    return o;
  };

  W.carvePath = function (scene, b) {
    const door = W.doorOf(b);
    const P = W.PLAZA;
    const tx = G.clamp(door.x, P.x0, P.x1 - 1), ty = G.clamp(door.y, P.y0, P.y1 - 1);
    const p = scene.path(door.x, door.y, tx, ty, 3000);
    const set = (x, y) => {
      const t = scene.tile(x, y);
      if (t === 'grass' || t === 'sand') scene.setTile(x, y, 'dirt');
    };
    set(door.x, door.y);
    if (p) for (const n of p) set(Math.floor(n.x), Math.floor(n.y));
  };

  W.buildCamp = function (state) {
    const s = new Scene('camp', W.CAMP_W, W.CAMP_H);
    const w = s.w, h = s.h;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        let t = 'grass';
        if (x < 2 || y < 2) t = 'water';
        else if (x === 2 || y === 2) t = 'sand';
        s.setTile(x, y, t);
        if (t === 'water') s.solid[s.idx(x, y)] = 1;
      }
    const P = W.PLAZA;
    for (let y = P.y0; y < P.y1; y++) for (let x = P.x0; x < P.x1; x++) s.setTile(x, y, 'plaza');

    for (const b of state.buildings) W.addBuilding(s, b);
    for (const b of state.buildings) if (b.type !== 'lantern' && b.type !== 'pen') W.carvePath(s, b);

    // Zone réservée : bâtiments + 1 tuile de marge + chemins
    const reserved = (x, y) => {
      if (s.tile(x, y) !== 'grass') return true;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          if (!s.inside(x + dx, y + dy)) continue;
          const o = s.occ[s.idx(x + dx, y + dy)];
          if (o && o.kind === 'building') return true;
          if (s.tile(x + dx, y + dy) === 'plaza' || s.tile(x + dx, y + dy) === 'dirt') return true;
        }
      return false;
    };
    // Arbres et rochers déterministes (pour que les souches restent à leur place)
    const rnd = G.seeded(1234);
    for (let y = 3; y < h; y++)
      for (let x = 3; x < w; x++) {
        const r = rnd(), r2 = rnd(), r3 = rnd();
        if (reserved(x, y)) continue;
        const edge = x >= w - 3 || y >= h - 3;
        const north = y < 6 || x < 5;
        const density = edge ? 0.75 : north ? 0.42 : 0.07;
        const key = x + ',' + y;
        const cut = state.chopped[key] && state.chopped[key] > state.clock;
        if (r < density) {
          const isPine = r2 < 0.6;
          const spr = isPine ? G.S.pine[Math.floor(r3 * 4)] : G.S.tree[['red', 'orange', 'yellow', 'green'][Math.floor(r3 * 4)]];
          s.addObject({ kind: 'tree', x: x + 0.5, y: y + 0.5, fp: { x0: x, y0: y, x1: x + 1, y1: y + 1 }, solid: !cut, spr: cut ? G.S.stump : spr, full: spr, cut, key, anchorPoint: true });
        } else if (r < density + 0.025 && !edge) {
          s.addObject({ kind: 'rock', x: x + 0.5, y: y + 0.5, fp: { x0: x, y0: y, x1: x + 1, y1: y + 1 }, solid: !cut, spr: cut ? null : G.S.boulder[Math.floor(r3 * 2)], full: G.S.boulder[Math.floor(r3 * 2)], cut, key, anchorPoint: true });
        } else if (r < density + 0.06 && !edge) {
          s.objects.push({ kind: 'prop', x: x + 0.5, y: y + 0.5, spr: G.S.bush[Math.floor(r3 * 2)], deco: true });
        }
      }
    s.spawn = { x: 17.5, y: 17.5 };
    s.ambientBg = '#0f2340';
    return s;
  };

  W.canPlace = function (scene, type, x, y) {
    const def = D.BUILDINGS[type];
    for (let j = y; j < y + def.d; j++)
      for (let i = x; i < x + def.w; i++) {
        if (!scene.inside(i, j)) return false;
        const t = scene.tile(i, j);
        if (t !== 'grass' && t !== 'dirt') return false;
        if (scene.occ[scene.idx(i, j)]) return false;
        if (scene.solid[scene.idx(i, j)]) return false;
      }
    // la porte doit rester accessible
    const door = { x: x + Math.floor(def.w / 2), y: y + def.d };
    if (type !== 'lantern' && (scene.isSolid(door.x, door.y) || scene.tile(door.x, door.y) === 'water')) return false;
    return true;
  };

  // ===================================================================
  //                              DONJON
  // ===================================================================
  W.buildDungeon = function (floor) {
    const size = 40 + Math.min(floor, 6) * 2;
    const s = new Scene('dungeon', size, size);
    s.floor = floor;
    s.solid.fill(1);
    const rooms = [];
    const target = 6 + Math.min(floor, 5);
    for (let a = 0; a < 400 && rooms.length < target; a++) {
      const rw = G.irnd(5, 9), rh = G.irnd(5, 9);
      const rx = G.irnd(2, size - rw - 3), ry = G.irnd(2, size - rh - 3);
      let ok = true;
      for (const r of rooms) if (rx < r.x + r.w + 3 && rx + rw + 3 > r.x && ry < r.y + r.h + 3 && ry + rh + 3 > r.y) { ok = false; break; }
      if (ok) rooms.push({ x: rx, y: ry, w: rw, h: rh, cx: rx + Math.floor(rw / 2), cy: ry + Math.floor(rh / 2) });
    }
    const carve = (x, y) => { if (s.inside(x, y)) { s.setTile(x, y, 'floor'); s.solid[s.idx(x, y)] = 0; } };
    for (const r of rooms) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) carve(x, y);
    // Relie chaque salle à la plus proche déjà connectée (couloirs de 2 tuiles)
    const connected = [rooms[0]];
    const rest = rooms.slice(1);
    while (rest.length) {
      let bi = 0, bj = 0, bd = Infinity;
      for (let i = 0; i < rest.length; i++)
        for (let j = 0; j < connected.length; j++) {
          const d = Math.abs(rest[i].cx - connected[j].cx) + Math.abs(rest[i].cy - connected[j].cy);
          if (d < bd) { bd = d; bi = i; bj = j; }
        }
      const a = rest[bi], b = connected[bj];
      const horizFirst = Math.random() < 0.5;
      const cx = horizFirst ? b.cx : a.cx, cy = horizFirst ? a.cy : b.cy;
      for (let x = Math.min(a.cx, b.cx); x <= Math.max(a.cx, b.cx); x++) { carve(x, cy); carve(x, cy + 1); }
      for (let y = Math.min(a.cy, b.cy); y <= Math.max(a.cy, b.cy); y++) { carve(cx, y); carve(cx + 1, y); }
      connected.push(a);
      rest.splice(bi, 1);
    }
    // Murs visibles autour du sol. Ceux qui sont devant le sol (côté caméra) restent bas pour ne pas masquer la salle.
    const walls = [];
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        if (s.tile(x, y) !== 'void') continue;
        let near = false;
        for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1; dx++) if (s.tile(x + dx, y + dy) === 'floor') { near = true; break; }
        if (near) {
          s.setTile(x, y, 'wall');
          walls.push([x, y]);
        }
      }
    const isFloor = (x, y) => s.tile(x, y) === 'floor';
    for (const [x, y] of walls) {
      const behind = isFloor(x + 1, y) || isFloor(x, y + 1) || isFloor(x + 1, y + 1);
      const v = G.hash2(x, y, floor) > 0.93 ? 2 : 0;
      s.objects.push({ kind: 'wall', x: x + 0.5, y: y + 0.5, fp: { x0: x, y0: y, x1: x + 1, y1: y + 1 }, spr: behind ? G.S.wall[v] : G.S.wallLow, isWall: true, tall: behind });
    }
    // Salle de départ = première ; salle finale = la plus éloignée
    const start = rooms[0];
    let far = rooms[rooms.length - 1], fd = -1;
    for (const r of rooms) {
      const d = Math.abs(r.cx - start.cx) + Math.abs(r.cy - start.cy);
      if (d > fd) { fd = d; far = r; }
    }
    s.rooms = rooms;
    s.spawn = { x: start.cx + 0.5, y: start.cy + 1.5 };
    s.addObject({ kind: 'portal', x: start.cx + 0.5, y: start.cy + 0.5, spr: null, interact: true, t: 0 });
    const isBoss = floor % 3 === 0;
    s.stairs = { kind: 'stairs', x: far.cx + 0.5, y: far.cy + 0.5, spr: G.S.stairs, interact: true, hidden: isBoss, flat: true };
    s.addObject(s.stairs);

    const free = (r, margin) => {
      for (let a = 0; a < 30; a++) {
        const x = G.irnd(r.x + margin, r.x + r.w - 1 - margin), y = G.irnd(r.y + margin, r.y + r.h - 1 - margin);
        if (!s.solid[s.idx(x, y)] && !s.occ[s.idx(x, y)] && !(x === far.cx && y === far.cy) && !(x === start.cx && y === start.cy)) return { x, y };
      }
      return null;
    };
    // Décor
    for (const r of rooms) {
      // torches le long des murs
      const torches = [[r.x, r.y], [r.x + r.w - 1, r.y], [r.x, r.y + r.h - 1]];
      for (const t of torches) {
        if (s.occ[s.idx(t[0], t[1])]) continue;
        s.addObject({ kind: 'torch', x: t[0] + 0.5, y: t[1] + 0.5, fp: { x0: t[0], y0: t[1], x1: t[0] + 1, y1: t[1] + 1 }, solid: true, spr: G.S.torch, light: { color: 'fire', r: 70 }, anchorPoint: true });
      }
      const n = G.irnd(1, 3);
      for (let i = 0; i < n; i++) {
        const p = free(r, 0);
        if (!p) continue;
        if (p.x !== r.x && p.x !== r.x + r.w - 1 && p.y !== r.y && p.y !== r.y + r.h - 1) continue; // contre les murs
        const kind = G.pick(['barrel', 'crate', 'barrel']);
        s.addObject({ kind: 'prop', x: p.x + 0.5, y: p.y + 0.5, fp: { x0: p.x, y0: p.y, x1: p.x + 1, y1: p.y + 1 }, solid: true, spr: G.S[kind], anchorPoint: true, breakable: true, hp: 1 });
      }
      if (Math.random() < 0.5) {
        const p = free(r, 1);
        if (p) s.objects.push({ kind: 'prop', x: p.x + 0.5, y: p.y + 0.5, spr: G.S.bones, deco: true, flat: true });
      }
      if (r !== start && r !== far && r.w >= 7 && r.h >= 7 && Math.random() < 0.35) {
        const px = r.cx - 1, py = r.cy - 1;
        let ok = true;
        for (let y = py; y < py + 2; y++) for (let x = px; x < px + 2; x++) if (s.occ[s.idx(x, y)]) ok = false;
        if (ok) s.addObject({ kind: 'pool', x: px, y: py, fp: { x0: px, y0: py, x1: px + 2, y1: py + 2 }, solid: true, spr: G.S.pool, flat: true });
      }
    }
    // Coffres
    const chestRooms = rooms.filter((r) => r !== start);
    for (let i = 0; i < 1 + (Math.random() < 0.5 ? 1 : 0) && chestRooms.length; i++) {
      const r = chestRooms.splice(G.irnd(0, chestRooms.length - 1), 1)[0];
      const p = free(r, 1);
      if (p) s.addObject({ kind: 'chest', x: p.x + 0.5, y: p.y + 0.5, fp: { x0: p.x, y0: p.y, x1: p.x + 1, y1: p.y + 1 }, solid: true, spr: G.S.chest, interact: true, anchorPoint: true });
    }
    // Monstres
    s.enemySpawns = [];
    const pool = D.floorEnemies(floor);
    for (const r of rooms) {
      if (r === start) continue;
      const count = G.irnd(2, 3) + Math.floor(floor / 2);
      for (let i = 0; i < count; i++) {
        const p = free(r, 1);
        if (p) s.enemySpawns.push({ type: G.pick(pool), x: p.x + 0.5, y: p.y + 0.5 });
      }
    }
    if (isBoss) s.enemySpawns.push({ type: 'knight', x: far.cx + 0.5, y: far.cy - 0.5, boss: true });
    else s.enemySpawns.push({ type: floor >= 4 ? 'orc' : 'goblin', x: far.cx + 0.5, y: far.cy - 0.5, elite: true });
    s.ambientBg = '#07060a';
    s.explored = new Uint8Array(size * size);
    return s;
  };
})();
