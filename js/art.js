'use strict';
// Génération procédurale de tout le pixel-art : tuiles, personnages, bâtiments, décors, icônes.
(function () {
  const PB = G.PB;
  const A = (G.Art = {});
  const K = '#1b1424';
  const shMemo = {};
  const sh = (c, f) => { const k = c + '|' + f; return shMemo[k] || (shMemo[k] = G.shade(c, f)); };
  const shaded = (fn, f) => (a, b, c) => { const col = fn(a, b, c); return col && f !== 1 ? sh(col, f) : col; };
  A.sh = sh;

  // ======================= TUILES =======================
  function diamond(fn) {
    const pb = new PB(32, 16);
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 32; x++) {
        const dx = Math.abs(x + 0.5 - 16) / 16, dy = Math.abs(y + 0.5 - 8) / 8;
        if (dx + dy <= 1.0001) {
          const sx = x + 0.5 - 16, sy = y + 0.5;
          pb.set(x, y, fn(x, y, (sx / 16 + sy / 8) / 2, (sy / 8 - sx / 16) / 2));
        }
      }
    return pb;
  }

  function grass(seed, flowers) {
    const cols = ['#2d5428', '#35602c', '#3e6c31', '#477836', '#53853b'];
    return diamond((x, y, u, v) => {
      const n = G.hash2(x, y, seed);
      if (n > 0.975) return '#6e9c48';
      if (n < 0.02) return '#26482a';
      if (flowers) {
        const f = G.hash2(x, y, seed + 50);
        if (f > 0.988) return '#efe7cf';
        if (f > 0.982) return '#e9c54a';
      }
      const t = 0.45 + 0.18 * Math.sin(u * 5 + seed) * Math.cos(v * 4 - seed) + (n - 0.5) * 0.55;
      return G.dither(cols, t, x, y);
    }).canvas();
  }
  function noiseTile(seed, cols, speck) {
    return diamond((x, y) => {
      const n = G.hash2(x, y, seed);
      if (speck && n > 0.965) return speck;
      return G.dither(cols, 0.2 + n * 0.6, x, y);
    }).canvas();
  }
  function water(frame) {
    return diamond((x, y, u, v) => {
      const n = G.hash2(x, y, 7);
      const w = Math.sin((u * 2 + v) * 6.283 + frame * 2.094);
      if (n > 0.93 && w > 0.6) return '#6f9ccc';
      return G.dither(['#16304e', '#1d3b5e', '#25486e', '#2d557c'], 0.45 + w * 0.25 + (n - 0.5) * 0.3, x, y);
    }).canvas();
  }
  function field(seed) {
    return diamond((x, y, u, v) => {
      const n = G.hash2(x, y, seed);
      const f = (v * 4) % 1;
      if (f < 0.22) return n > 0.5 ? '#3a2818' : '#42301d';
      return G.dither(['#5a4029', '#674a30', '#735437'], 0.3 + n * 0.5 + (f > 0.7 ? 0.2 : 0), x, y);
    }).canvas();
  }
  function cobble(seed, pal, mortar) {
    const r = G.seeded(seed);
    const pts = [];
    for (let i = 0; i < 7; i++) pts.push([r(), r(), r()]);
    return diamond((x, y, u, v) => {
      let d1 = 9, d2 = 9, id = 0;
      for (let i = 0; i < pts.length; i++)
        for (let ox = -1; ox <= 1; ox++)
          for (let oy = -1; oy <= 1; oy++) {
            const dx = u - (pts[i][0] + ox), dy = v - (pts[i][1] + oy);
            const d = dx * dx + dy * dy;
            if (d < d1) { d2 = d1; d1 = d; id = i; } else if (d < d2) d2 = d;
          }
      const e = Math.sqrt(d2) - Math.sqrt(d1);
      if (e < 0.05) return mortar;
      return G.dither(pal, pts[id][2] * 0.65 + (e < 0.1 ? -0.1 : 0.15) + G.hash2(x, y, seed) * 0.2, x, y);
    }).canvas();
  }

  // ======================= DESSIN ISO =======================
  function isoDraw(pb, ox, oy) {
    const P = (x, y, z) => [ox + (x - y) * 16, oy + (x + y) * 8 - (z || 0)];
    const I = {
      P,
      polyY(yv, pts, fn) {
        pb.poly(pts.map((p) => P(p[0], yv, p[1])), (px, py) => {
          const x = (px + 0.5 - ox) / 16 + yv;
          return fn(x, oy + (x + yv) * 8 - (py + 0.5));
        });
      },
      polyX(xv, pts, fn) {
        pb.poly(pts.map((p) => P(xv, p[0], p[1])), (px, py) => {
          const y = xv - (px + 0.5 - ox) / 16;
          return fn(y, oy + (xv + y) * 8 - (py + 0.5));
        });
      },
      slope(pts, z0, kx, ky, fn) {
        pb.poly(pts.map((p) => P(p[0], p[1], p[2])), (px, py) => {
          const a = (px + 0.5 - ox) / 16, c = py + 0.5 - oy + z0;
          const y = (c - (8 - kx) * a) / (8 - kx + (8 - ky));
          const x = a + y;
          return fn(x, y, z0 + kx * x + ky * y);
        });
      },
      box(x0, y0, x1, y1, z0, z1, f) {
        if (f.left) I.polyY(y1, [[x0, z0], [x1, z0], [x1, z1], [x0, z1]], (x, z) => f.left(x - x0, z - z0));
        if (f.right) I.polyX(x1, [[y0, z0], [y1, z0], [y1, z1], [y0, z1]], (y, z) => f.right(y - y0, z - z0));
        if (f.top) I.slope([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], z1, 0, 0, (x, y) => f.top(x - x0, y - y0));
      },
    };
    return I;
  }

  const T = {
    logs(c) {
      const c1 = sh(c, 0.86), ln = sh(c, 0.48), knot = sh(c, 0.62);
      return (a, z) => {
        const zi = Math.floor(z);
        if (zi % 4 === 3) return ln;
        if (G.hash2(Math.floor(a * 16), zi, 4) > 0.97) return knot;
        return Math.floor(zi / 4) % 2 ? c : c1;
      };
    },
    bricks(pal, mortar, bw, bh) {
      bw = bw || 8; bh = bh || 4;
      return (a, z) => {
        const zi = Math.floor(z), row = Math.floor(zi / bh);
        const u = Math.floor(a * 16 + (row % 2) * (bw / 2));
        if (zi % bh === 0 || u % bw === 0) return mortar;
        return pal[Math.floor(G.hash2(Math.floor(u / bw), row, 3) * pal.length)];
      };
    },
    planks(c) {
      const dark = sh(c, 0.6), c1 = sh(c, 0.9);
      return (a, z) => {
        const u = Math.floor(a * 16);
        if (u % 4 === 0) return dark;
        return G.hash2(u >> 2, Math.floor(z / 7), 5) > 0.5 ? c : c1;
      };
    },
    plaster(c, beam) {
      return (a, z) => {
        const u = a * 16;
        if (z < 2 || z > 13 || u % 12 < 2) return beam;
        if (Math.abs((u % 12) - 2 - (z - 2) * 0.8) < 0.9 && (u % 24) < 12) return beam;
        return G.hash2(Math.floor(u), Math.floor(z), 8) > 0.9 ? sh(c, 0.92) : c;
      };
    },
    roof(pal, edge, rowsPerTile, cols) {
      return (s, t) => {
        const rows = t * rowsPerTile, row = Math.floor(rows);
        if (rows - row < 0.2) return edge;
        const col = Math.floor(s * cols + (row % 2) * 0.5);
        if ((s * cols + (row % 2) * 0.5) % 1 < 0.12) return edge;
        return pal[Math.floor(G.hash2(col, row, 11) * pal.length)];
      };
    },
  };

  function glassLit(ax, az, w, h) {
    const d = Math.hypot(ax - w / 2, az - h / 2) / Math.max(w, h);
    return d < 0.25 ? '#ffe9a0' : d < 0.4 ? '#ffd36a' : '#f2a640';
  }
  function windowY(I, yv, a0, a1, z0, z1, frame) {
    const wp = (a1 - a0) * 16, hp = z1 - z0;
    I.polyY(yv, [[a0, z0], [a1, z0], [a1, z1], [a0, z1]], (x, z) => {
      const ax = (x - a0) * 16, az = z - z0;
      if (ax < 1 || ax > wp - 1 || az < 1 || az > hp - 1) return frame;
      if (Math.abs(ax - wp / 2) < 0.6 || Math.abs(az - hp / 2) < 0.6) return frame;
      return glassLit(ax, az, wp, hp);
    });
  }
  function windowX(I, xv, b0, b1, z0, z1, frame) {
    const wp = (b1 - b0) * 16, hp = z1 - z0;
    I.polyX(xv, [[b0, z0], [b1, z0], [b1, z1], [b0, z1]], (y, z) => {
      const ax = (y - b0) * 16, az = z - z0;
      if (ax < 1 || ax > wp - 1 || az < 1 || az > hp - 1) return frame;
      if (Math.abs(ax - wp / 2) < 0.6 || Math.abs(az - hp / 2) < 0.6) return frame;
      return sh(glassLit(ax, az, wp, hp), 0.9);
    });
  }
  function doorY(I, yv, a0, a1, h, wood, frame) {
    const wp = (a1 - a0) * 16;
    I.polyY(yv, [[a0, 0], [a1, 0], [a1, h], [a0, h]], (x, z) => {
      const ax = (x - a0) * 16;
      if (ax < 1 || ax > wp - 1 || z > h - 1) return frame;
      if (Math.floor(ax) % 3 === 0) return sh(wood, 0.7);
      if (Math.abs(ax - wp + 3) < 0.8 && Math.abs(z - h / 2) < 0.8) return '#e0b040';
      return wood;
    });
  }

  // Bâtiment à pignon générique. Retourne {c, ox, oy, lights, smoke}
  function gable(o) {
    const { w, d, h, r } = o;
    const e = o.e != null ? o.e : 0.2;
    const k = r / (d / 2), s = k * e;
    const m = 4, extraTop = o.extraTop || 16;
    const W = Math.ceil((w + d + 2 * e) * 16) + 2 * m;
    const H = Math.ceil((w + d + 2 * e) * 8) + h + r + extraTop + 2 * m;
    const ox = Math.round((d + e) * 16) + m, oy = h + r + extraTop + m + Math.round(e * 8);
    const pb = new PB(W, H);
    const I = isoDraw(pb, ox, oy);
    const out = { lights: [], smoke: [] };
    I.polyY(d, [[0, 0], [w, 0], [w, h], [0, h]], (x, z) => o.wall(x, z, 'L'));
    I.polyX(w, [[0, 0], [d, 0], [d, h], [d / 2, h + r], [0, h]], shaded((y, z) => (o.gableWall || o.wall)(y, z, 'R'), 0.8));
    if (o.details) o.details(I, out, pb);
    const roof = T.roof(o.roofPal, o.roofEdge, o.roofRows || 6, o.roofCols || 5);
    I.slope([[-e, -e, h - s], [w + e, -e, h - s], [w + e, d / 2, h + r], [-e, d / 2, h + r]], h + r - (k * d) / 2, 0, k,
      shaded((x, y) => roof(x, y + e), 0.82));
    if (o.chimney) {
      const c = o.chimney;
      I.box(c.x, c.y, c.x + c.s, c.y + c.s, h, h + r + c.top, {
        left: T.bricks(['#6d6870', '#7a757e', '#615c66'], '#3a3640', 6, 3),
        right: shaded(T.bricks(['#6d6870', '#7a757e', '#615c66'], '#3a3640', 6, 3), 0.75),
        top: () => '#231d26',
      });
      out.smoke.push({ x: c.x + c.s / 2, y: c.y + c.s / 2, z: h + r + c.top + 2 });
    }
    I.slope([[-e, d / 2, h + r], [w + e, d / 2, h + r], [w + e, d + e, h - s], [-e, d + e, h - s]], h + r + (k * d) / 2, 0, -k,
      (x, y) => roof(x, d + e - y));
    const fas = sh(o.roofEdge, 0.85);
    I.polyX(w + e, [[-e, h - s], [d / 2, h + r], [d + e, h - s], [d + e, h - s - 2], [d / 2, h + r - 2], [-e, h - s - 2]], () => fas);
    if (o.after) o.after(I, out, pb);
    out.c = pb.outline(K).canvas();
    out.ox = ox; out.oy = oy;
    return out;
  }

  function sprite(pb, ox, oy, extra) {
    return Object.assign({ c: pb.canvas(), ox, oy, lights: [], smoke: [] }, extra || {});
  }

  // ======================= BÂTIMENTS =======================
  const B = {};
  B.house = () => gable({
    w: 3, d: 3, h: 22, r: 18,
    wall: (x, z) => (z < 4 ? T.bricks(['#6a6870', '#5d5b63'], '#38363e', 6, 4)(x, z) : T.logs('#7a5434')(x, z)),
    gableWall: (y, z) => (z < 4 ? T.bricks(['#6a6870', '#5d5b63'], '#38363e', 6, 4)(y, z) : T.logs('#7a5434')(y, z)),
    roofPal: ['#2b3854', '#344465', '#3d4f75', '#465a82'], roofEdge: '#1d2538',
    chimney: { x: 0.5, y: 0.6, s: 0.45, top: 6 },
    details(I, out) {
      windowY(I, 3, 0.35, 0.9, 8, 17, '#3b2717');
      windowY(I, 3, 2.1, 2.65, 8, 17, '#3b2717');
      doorY(I, 3, 1.2, 1.8, 15, '#5a3a20', '#3b2717');
      windowX(I, 3, 1.15, 1.85, 9, 18, '#3b2717');
      out.lights.push({ x: 0.62, y: 3.1, z: 12 }, { x: 2.4, y: 3.1, z: 12 }, { x: 3.1, y: 1.5, z: 13 });
    },
  });
  B.forge = () => gable({
    w: 3, d: 3, h: 20, r: 12,
    wall: T.bricks(['#6c6a70', '#76737a', '#5f5d64', '#807d84'], '#3a3840'),
    roofPal: ['#6e4a2c', '#7a5432', '#644226'], roofEdge: '#3a2616', roofRows: 5, roofCols: 4,
    chimney: { x: 0.3, y: 0.4, s: 0.7, top: 16 },
    details(I, out) {
      // grande ouverture de l'atelier (face gauche)
      I.polyY(3, [[0.5, 0], [2.0, 0], [2.0, 13], [0.5, 13]], (x, z) => {
        const ax = (x - 0.5) * 16;
        if (ax < 1.2 || ax > 22.8 || z > 12) return '#3b2717';
        const g = 1 - z / 13;
        return G.dither(['#2a1610', '#5a2a14', '#a8481c', '#f08a2a'], g * 0.8 * (1 - Math.abs(ax - 12) / 16), Math.floor(ax), Math.floor(z));
      });
      // four rougeoyant (face droite)
      I.polyX(3, [[1.0, 0], [2.2, 0], [2.2, 9], [1.6, 12], [1.0, 9]], (y, z) => {
        const t = 1 - z / 12;
        return G.dither(['#5a1a0c', '#c0441a', '#ff9a2a', '#ffe070'], t * 0.9 + G.hash2(Math.floor(y * 16), Math.floor(z), 2) * 0.15, Math.floor(y * 16), Math.floor(z));
      });
      out.lights.push({ x: 3.2, y: 1.6, z: 5, big: true, color: 'fire' }, { x: 1.25, y: 3.2, z: 6, color: 'fire' });
    },
  });
  B.tavern = () => gable({
    w: 4, d: 3, h: 30, r: 18,
    wall: (x, z) => (z < 13 ? T.bricks(['#6c6a70', '#76737a', '#5f5d64'], '#3a3840')(x, z) : T.plaster('#cdb68a', '#4a3020')(x, z - 13)),
    roofPal: ['#7c2f24', '#8c3a2a', '#9a4430', '#6e2a20'], roofEdge: '#3c1612',
    chimney: { x: 2.8, y: 0.5, s: 0.5, top: 7 },
    details(I, out) {
      windowY(I, 3, 0.4, 1.0, 4, 11, '#3b2717');
      windowY(I, 3, 2.9, 3.5, 4, 11, '#3b2717');
      doorY(I, 3, 1.65, 2.35, 12, '#5a3a20', '#3b2717');
      windowY(I, 3, 0.5, 1.1, 16, 25, '#4a3020');
      windowY(I, 3, 1.7, 2.3, 16, 25, '#4a3020');
      windowY(I, 3, 2.9, 3.5, 16, 25, '#4a3020');
      windowX(I, 4, 1.1, 1.9, 16, 26, '#4a3020');
      out.lights.push({ x: 0.7, y: 3.1, z: 8 }, { x: 3.2, y: 3.1, z: 8 }, { x: 2.0, y: 3.1, z: 20 }, { x: 4.1, y: 1.5, z: 20 });
    },
    after(I, out, pb) {
      // enseigne
      const p = I.P(4, 2.6, 18);
      pb.rect(p[0], p[1] - 1, 6, 1, '#3b2717');
      pb.rect(p[0] + 1, p[1], 5, 5, '#8a5a32');
      pb.rect(p[0] + 2, p[1] + 1, 3, 3, '#e0b040');
    },
  });
  B.sawmill = () => gable({
    w: 3, d: 2, h: 14, r: 10,
    wall: T.planks('#8a6038'),
    roofPal: ['#6e4a2c', '#7a5432', '#5e3e24'], roofEdge: '#3a2616', roofRows: 5, roofCols: 4,
    details(I) {
      I.polyY(2, [[0.6, 0], [2.4, 0], [2.4, 11], [0.6, 11]], (x, z) => (z > 10 || (x - 0.6) * 16 < 1 || (x - 0.6) * 16 > 27.8 ? '#3a2616' : '#24170e'));
    },
    after(I, out, pb) {
      // tas de bûches devant
      for (let i = 0; i < 5; i++) {
        const row = i < 3 ? 0 : 1;
        const col = i < 3 ? i : i - 3 + 0.5;
        const p = I.P(0.55 + col * 0.42, 2.25, 3 + row * 5);
        pb.ellipse(p[0], p[1], 3, 3, (x, y, dx, dy) => (dx * dx + dy * dy < 0.3 ? (Math.hypot(dx, dy) < 0.25 ? '#a8763c' : '#c89a5e') : '#7a5030'));
      }
    },
  });

  B.market = () => {
    const m = 6, w = 2, d = 2;
    const W = (w + d) * 16 + 2 * m, H = (w + d) * 8 + 34 + 2 * m;
    const ox = d * 16 + m, oy = 34 + m;
    const pb = new PB(W, H);
    const I = isoDraw(pb, ox, oy);
    const wood = { left: T.planks('#7a5432'), right: shaded(T.planks('#7a5432'), 0.75), top: () => '#8f6640' };
    const pole = (x, y, z1) => I.box(x, y, x + 0.12, y + 0.12, 0, z1, { left: () => '#5a3a20', right: () => '#3e2716', top: () => '#6a4a2a' });
    pole(0.08, 0.08, 26); pole(1.8, 0.08, 26);
    // caisses arrière
    I.box(0.3, 0.3, 0.8, 0.8, 0, 7, wood);
    I.box(1.2, 0.25, 1.75, 0.8, 0, 9, wood);
    // comptoir
    I.box(0.15, 1.1, 1.85, 1.75, 0, 9, wood);
    const goods = [['#d0402a', '#8a2418'], ['#7ab048', '#4a7a30'], ['#f09030', '#b05a18'], ['#d8b860', '#a08030']];
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        const p = I.P(0.3 + i * 0.38 + (j % 2) * 0.12, 1.25 + (j >> 1) * 0.22, 10);
        pb.ellipse(p[0], p[1], 1.6, 1.3, (x, y, dx, dy) => (dy < -0.2 && dx < 0 ? goods[i][0] : dy > 0.3 ? goods[i][1] : goods[i][0]));
      }
    }
    pole(0.08, 1.8, 18); pole(1.8, 1.8, 18);
    // auvent rayé
    const kz = -9 / 2.1;
    I.slope([[-0.05, -0.05, 26], [2.05, -0.05, 26], [2.05, 2.05, 26 + kz * 2.1], [-0.05, 2.05, 26 + kz * 2.1]], 26 + 0.05 * kz * -1 * 0, 0, kz, (x, y) => {
      const st = Math.floor((x + 0.05) * 5) % 2;
      const base = st ? '#c8b07a' : '#9a2e26';
      return (y * 8) % 1 < 0.1 ? sh(base, 0.85) : base;
    });
    // bord festonné
    const p0 = I.P(-0.05, 2.05, 26 + kz * 2.1);
    for (let i = 0; i < 34; i++) {
      const st = Math.floor((i / 16) * 5) % 2;
      const x = p0[0] + i, y = p0[1] + i / 2;
      pb.set(x, y + 1, st ? '#c8b07a' : '#9a2e26');
      if (i % 3 !== 2) pb.set(x, y + 2, st ? '#a8905a' : '#7a2018');
    }
    pb.outline(K);
    return sprite(pb, ox, oy);
  };

  B.quarry = () => {
    const m = 4, W = 4 * 16 + 2 * m, H = 4 * 8 + 26 + 2 * m, ox = 32 + m, oy = 26 + m;
    const pb = new PB(W, H);
    const I = isoDraw(pb, ox, oy);
    const rocks = [[0.6, 0.6, 9], [1.4, 0.5, 8], [1.0, 1.1, 11], [0.5, 1.5, 7], [1.5, 1.5, 8], [1.1, 1.7, 6]];
    const pal = ['#4a4a54', '#5e5e68', '#76767f', '#9090a0', '#acacba'];
    for (const r of rocks) {
      const p = I.P(r[0], r[1], 0);
      const rx = r[2], ry = r[2] * 0.8;
      pb.ellipse(p[0], p[1] - ry * 0.6, rx, ry, (x, y, dx, dy) => G.dither(pal, 0.75 - (dx + dy) * 0.35 + G.hash2(x, y, 9) * 0.15, x, y));
    }
    // pioche plantée
    const p = I.P(1.2, 1.2, 14);
    pb.line(p[0], p[1], p[0] + 5, p[1] + 9, '#6a4a2a');
    pb.line(p[0] - 3, p[1] + 1, p[0] + 3, p[1] - 2, '#c0c8d0');
    pb.outline(K);
    return sprite(pb, ox, oy);
  };

  B.mine = () => {
    const m = 4, W = 4 * 16 + 2 * m, H = 4 * 8 + 34 + 2 * m, ox = 32 + m, oy = 34 + m;
    const pb = new PB(W, H);
    const I = isoDraw(pb, ox, oy);
    const pal = ['#3e3a44', '#514c58', '#66606c', '#7c7684', '#948e9c'];
    const c = I.P(1, 1, 0);
    pb.ellipse(c[0], c[1] - 12, 30, 20, (x, y, dx, dy) => G.dither(pal, 0.65 - (dx + dy) * 0.3 + G.hash2(x >> 1, y >> 1, 3) * 0.25, x, y));
    // entrée
    const e = I.P(0.9, 2, 0);
    pb.ellipse(e[0], e[1] - 4, 8, 11, (x, y, dx, dy) => (dy > 0.35 ? null : Math.hypot(dx, dy) > 0.82 ? '#6a4a2a' : '#120c10'));
    pb.rect(e[0] - 8, e[1] - 14, 2, 14, '#6a4a2a');
    pb.rect(e[0] + 6, e[1] - 14, 2, 14, '#6a4a2a');
    pb.rect(e[0] - 9, e[1] - 15, 18, 2, '#7a5432');
    // filon de fer
    for (let i = 0; i < 14; i++) pb.set(c[0] + 6 + (i % 5) * 3, c[1] - 20 + Math.floor(i / 5) * 4 + (i % 2), '#c8d0dc');
    pb.outline(K);
    return sprite(pb, ox, oy, { lights: [{ x: 0.7, y: 2.2, z: 10, color: 'fire' }] });
  };

  B.dungeon = () => {
    const m = 4, W = 4 * 16 + 2 * m, H = 4 * 8 + 44 + 2 * m, ox = 32 + m, oy = 44 + m;
    const pb = new PB(W, H);
    const I = isoDraw(pb, ox, oy);
    const st = { left: T.bricks(['#5a5660', '#646068', '#504c56'], '#2e2a34', 6, 4), right: shaded(T.bricks(['#5a5660', '#646068', '#504c56'], '#2e2a34', 6, 4), 0.72), top: () => '#6e6a74' };
    // fosse d'escalier
    I.slope([[0.2, 0.2, 0], [1.8, 0.2, 0], [1.8, 1.8, 0], [0.2, 1.8, 0]], 0, 0, 0, (x, y) => {
      const t = (x + y - 0.4) / 3.2;
      const step = Math.floor((x + y) * 3) % 2;
      return G.dither(['#08060a', '#16121a', '#2a2430', '#3c3644'], t * (step ? 0.9 : 0.7), Math.floor(x * 16), Math.floor(y * 16));
    });
    // murets arrière
    I.box(0.05, 0.05, 1.95, 0.3, 0, 10, st);
    I.box(0.05, 0.3, 0.3, 1.95, 0, 10, st);
    // piliers + linteau
    I.box(0.0, 1.55, 0.45, 2.0, 0, 30, st);
    I.box(1.55, 1.55, 2.0, 2.0, 0, 30, st);
    I.box(0.0, 1.55, 2.0, 2.0, 30, 37, st);
    // rune
    const r = I.P(1, 2, 33);
    pb.rect(r[0] - 1, r[1] - 2, 3, 3, '#b07aff');
    pb.set(r[0], r[1] - 3, '#e0c8ff');
    // torches
    for (const tx of [0.22, 1.78]) {
      const p = I.P(tx, 2.02, 20);
      pb.rect(p[0], p[1], 1, 4, '#5a3a20');
      pb.rect(p[0] - 1, p[1] - 3, 3, 3, '#ffb040');
      pb.set(p[0], p[1] - 4, '#ffe080');
    }
    pb.outline(K);
    return sprite(pb, ox, oy, { lights: [{ x: 0.22, y: 2.05, z: 24, color: 'fire' }, { x: 1.78, y: 2.05, z: 24, color: 'fire' }, { x: 1, y: 1, z: 2, color: 'magic' }] });
  };

  B.lantern = () => {
    const pb = new PB(16, 32);
    pb.rect(7, 6, 2, 26, '#4a3020');
    pb.rect(7, 6, 1, 26, '#5e3e26');
    pb.rect(7, 5, 6, 2, '#4a3020');
    pb.rect(11, 7, 1, 2, '#2a1a10');
    pb.rect(9, 9, 5, 7, '#2a1a10');
    pb.rect(10, 10, 3, 5, '#ffd36a');
    pb.set(11, 11, '#fff2c0');
    pb.rect(6, 30, 4, 2, '#3a2616');
    pb.outline(K);
    return sprite(pb, 8, 31, { lights: [{ x: 0.12, y: 0.12, z: 19, color: 'lamp' }] });
  };

  // Ferme : pas de bâtiment, juste un épouvantail (les cultures sont des objets séparés)
  B.farm = () => {
    const pb = new PB(16, 30);
    pb.rect(7, 8, 2, 22, '#5a3a20');
    pb.rect(2, 12, 12, 2, '#5a3a20');
    pb.rect(5, 12, 6, 9, '#7a4a8a');
    pb.rect(4, 11, 8, 1, '#5a2e6a');
    pb.ellipse(8, 7, 3.5, 3.5, '#d8b860');
    pb.rect(3, 3, 10, 2, '#a8823a');
    pb.rect(5, 0, 6, 3, '#a8823a');
    pb.set(7, 7, K); pb.set(9, 7, K);
    pb.outline(K);
    return sprite(pb, 8, 29);
  };

  B.pen = () => null; // l'enclos est fait de segments de clôture

  A.buildings = {};
  A.buildingSprite = function (type) {
    if (!(type in A.buildings)) A.buildings[type] = B[type] ? B[type]() : null;
    return A.buildings[type];
  };

  // ======================= MUR DE DONJON =======================
  function wallBlock(variant, low) {
    const m = 1, h = low ? 7 : 28;
    const pb = new PB(32 + 2 * m, 16 + h + 2 * m);
    const ox = 16 + m, oy = h + m;
    const I = isoDraw(pb, ox, oy);
    const pal = ['#4a4550', '#544e5a', '#5e5864', '#423e48'];
    I.box(0, 0, 1, 1, 0, h, {
      left: T.bricks(pal, '#24202a', 8, 5),
      right: shaded(T.bricks(pal, '#24202a', 8, 5), 0.7),
      top: (x, y) => G.dither(['#2a2630', '#34303a', '#3e3a44'], G.hash2(Math.floor(x * 16), Math.floor(y * 16), 2), Math.floor(x * 16), Math.floor(y * 16)),
    });
    if (variant === 'banner') {
      I.polyY(1, [[0.3, 6], [0.7, 6], [0.7, 24], [0.5, 20], [0.3, 24]], (x, z) => (z > 22 ? '#c8a040' : Math.abs((x - 0.5) * 16) < 1.2 && z > 12 && z < 17 ? '#e0c060' : '#8a2a2a'));
    }
    return { c: pb.canvas(), ox, oy };
  }

  // ======================= ARBRES / ROCHERS =======================
  function pine(seed, tall) {
    const r = G.seeded(seed);
    const W = 30, H = tall ? 58 : 48;
    const pb = new PB(W, H);
    const cx = W / 2;
    pb.rect(cx - 2, H - 9, 4, 8, '#5a3a22');
    pb.rect(cx + 1, H - 9, 1, 8, '#3e2716');
    const pal = ['#5c9a4c', '#43803e', '#2f6634', '#214a28', '#183820'];
    const n = 4;
    for (let i = n - 1; i >= 0; i--) {
      const top = 2 + i * ((H - 16) / n) * 0.82;
      const bottom = top + (H - 14) / n + 6 + i * 1.5;
      const hw = 5 + i * 3.1 + r() * 1.5;
      pb.poly([[cx, top], [cx + hw, bottom], [cx - hw, bottom]], (px, py) => {
        const jag = (px + i) % 4 < 2 ? 0 : 1.5;
        if (py > bottom - jag) return null;
        const t = 0.25 + ((px - cx) / hw) * 0.35 + ((py - top) / (bottom - top)) * 0.35 + (G.hash2(px, py, seed) - 0.5) * 0.25;
        return G.dither(pal, t, px, py);
      });
    }
    pb.outline(K);
    return { c: pb.canvas(), ox: cx, oy: H - 2 };
  }
  const LEAVES = {
    red: ['#f08a5a', '#d85a34', '#b23e26', '#82281e', '#541a18'],
    orange: ['#f6c060', '#e8963a', '#c46a24', '#8e4618', '#5a2c14'],
    yellow: ['#f6e27a', '#e2c04a', '#c09a30', '#8a6a22', '#5a4418'],
    green: ['#86c25a', '#62a046', '#467e38', '#30602c', '#1f4222'],
  };
  function roundTree(seed, kind) {
    const r = G.seeded(seed);
    const W = 34, H = 46, cx = W / 2, cy = 17;
    const pb = new PB(W, H);
    pb.rect(cx - 2, 26, 5, H - 28, '#5a3a22');
    pb.rect(cx + 1, 26, 2, H - 28, '#3e2716');
    pb.rect(cx - 4, 30, 2, 1, '#5a3a22');
    const pal = LEAVES[kind];
    const blobs = [[0, 0, 12], [-7, 4, 8], [7, 4, 8], [-4, -6, 8], [5, -5, 8], [0, 7, 9]];
    for (const b of blobs) {
      const bx = cx + b[0] + (r() - 0.5) * 2, by = cy + b[1] + (r() - 0.5) * 2, br = b[2];
      pb.ellipse(bx, by, br, br * 0.92, (x, y, dx, dy) => {
        const t = 0.3 + ((x - cx) + (y - cy)) / 34 + (dx + dy) * 0.12 + (G.hash2(x >> 1, y >> 1, seed) - 0.5) * 0.35;
        return G.dither(pal, t, x, y);
      });
    }
    pb.outline(K);
    return { c: pb.canvas(), ox: cx, oy: H - 2 };
  }
  function boulder(seed) {
    const pb = new PB(20, 16);
    const pal = ['#4a4a54', '#5e5e68', '#76767f', '#9090a0', '#acacba'];
    pb.ellipse(10, 9, 8, 6, (x, y, dx, dy) => G.dither(pal, 0.75 - (dx + dy) * 0.35 + G.hash2(x, y, seed) * 0.15, x, y));
    pb.ellipse(6, 11, 4, 3, (x, y, dx, dy) => G.dither(pal, 0.7 - (dx + dy) * 0.3, x, y));
    for (let i = 0; i < 6; i++) pb.set(6 + i * 2, 5 + (i % 2), '#5a8a3e');
    pb.outline(K);
    return { c: pb.canvas(), ox: 10, oy: 14 };
  }
  function stump() {
    const pb = new PB(12, 8);
    pb.rect(2, 3, 8, 4, '#5a3a22');
    pb.ellipse(6, 3, 4, 2, (x, y, dx, dy) => (Math.hypot(dx, dy) < 0.5 ? '#a8763c' : '#c89a5e'));
    pb.outline(K);
    return { c: pb.canvas(), ox: 6, oy: 7 };
  }
  function bush(seed) {
    const pb = new PB(18, 12);
    const pal = LEAVES.green;
    pb.ellipse(9, 7, 8, 5, (x, y, dx, dy) => G.dither(pal, 0.35 + (dx + dy) * 0.3 + (G.hash2(x, y, seed) - 0.5) * 0.3, x, y));
    if (seed % 2) { pb.set(6, 5, '#e05050'); pb.set(11, 7, '#e05050'); pb.set(9, 4, '#e05050'); }
    pb.outline(K);
    return { c: pb.canvas(), ox: 9, oy: 11 };
  }

  // ======================= PROPS =======================
  const PROPS = {
    barrel: { rows: [
      '.kkkkkk.',
      'kBBBBBBk',
      'kMMMMMMk',
      'kBbBBBbk',
      'kBbBBBbk',
      'kMMMMMMk',
      'kBbBBBbk',
      'kBBBBBBk',
      '.kkkkkk.',
    ], pal: { k: K, B: '#8a5a32', b: '#6a4426', M: '#5a5a62' }, oy: 8 },
    anvil: { rows: [
      'kkkkkkkkkkk.',
      'kMMMMMMMMMMk',
      '.kmmmmmmmmk.',
      '...kMMMMk...',
      '...kmmmmk...',
      '..kMMMMMMk..',
      '.kBBBBBBBBk.',
      '.kbbbbbbbbk.',
      '..kkkkkkkk..',
    ], pal: { k: K, M: '#6a6e78', m: '#4a4e58', B: '#6a4426', b: '#4a2e1a' }, oy: 8 },
    pumpkin: { rows: [
      '...kk...',
      '..kGk...',
      '.kkOkkk.',
      'kOoOOoOk',
      'kOoOOoOk',
      'koOooOok',
      '.kkkkkk.',
    ], pal: { k: K, G: '#4a7a30', O: '#f08a2a', o: '#c0601a' }, oy: 6 },
    cabbage: { rows: [
      '..kkkk..',
      '.kGgGGk.',
      'kGgLLgGk',
      'kgLLLLgk',
      'kGgLLgGk',
      '.kkkkkk.',
    ], pal: { k: K, G: '#3e7a34', g: '#2c5e28', L: '#8ac860' }, oy: 5 },
    sprout: { rows: [
      '.k.k.',
      'kGkGk',
      '.kGk.',
      '..k..',
    ], pal: { k: K, G: '#6aa848' }, oy: 3 },
    torch: { rows: [
      '.kYk.',
      'kYWYk',
      'kOYOk',
      '.kOk.',
      '.kBk.',
      '.kBk.',
      '.kBk.',
      '..k..',
    ], pal: { k: K, Y: '#ffc040', W: '#fff0b0', O: '#f07020', B: '#5a3a20' }, oy: 7 },
    bones: { rows: [
      'k..kk...k',
      'Wk.kWk.kW',
      '.WWWkWWW.',
      'k.kWWk..k',
      '..kk.kk..',
    ], pal: { k: '#3a3440', W: '#d8d0bc' }, oy: 4 },
    crateTop: null,
  };
  function propSprite(name) {
    const p = PROPS[name];
    const c = G.spr(p.rows, p.pal);
    return { c, ox: Math.floor(c.width / 2), oy: p.oy };
  }
  function crate() {
    const pb = new PB(20, 20);
    const I = isoDraw(pb, 10, 11);
    const wood = T.planks('#8f6438');
    I.box(-0.25, -0.25, 0.25, 0.25, 0, 9, { left: wood, right: shaded(wood, 0.72), top: (x, y) => ((x * 16) % 8 < 1 ? '#6a4426' : '#a07448') });
    pb.outline(K);
    return { c: pb.canvas(), ox: 10, oy: 11 };
  }
  function chest(open) {
    const pb = new PB(24, 22);
    const I = isoDraw(pb, 12, 14);
    const wood = T.planks('#8a5a2a');
    const band = (f) => (a, z) => (z > 2.5 && z < 4 ? '#c8a040' : f(a, z));
    I.box(-0.3, -0.2, 0.3, 0.2, 0, 7, { left: band(wood), right: shaded(band(wood), 0.72), top: () => (open ? '#1a120c' : '#a06a34') });
    if (!open) I.box(-0.3, -0.2, 0.3, 0.2, 7, 10, { left: wood, right: shaded(wood, 0.72), top: () => '#b07a40' });
    else {
      I.polyY(-0.2, [[-0.3, 7], [0.3, 7], [0.3, 15], [-0.3, 15]], () => '#7a4a20');
      for (let i = 0; i < 4; i++) pb.set(10 + i * 2, 6 - (i % 2), '#ffe070');
    }
    const lk = I.P(0, 0.2, 5);
    pb.rect(lk[0] - 1, lk[1] - 1, 2, 3, '#ffd040');
    pb.outline(K);
    return { c: pb.canvas(), ox: 12, oy: 14 };
  }
  function stairsDown() {
    const pb = new PB(36, 22);
    const I = isoDraw(pb, 18, 3);
    I.slope([[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]], 0, 0, 0, (x, y) => {
      const s = Math.floor((x + y) * 4);
      return G.dither(['#060408', '#18141c', '#2c2632', '#44404a'], 0.85 - s * 0.12, Math.floor(x * 16), Math.floor(y * 16));
    });
    for (let i = 0; i < 4; i++) {
      const a = I.P(0, 0.25 * i, 0), b = I.P(1, 0.25 * i, 0);
      pb.line(a[0] - i * 4 + 4, a[1] + 2 + i * 2, b[0] - i * 4, b[1] + 2 + i * 2, '#5a5464');
    }
    pb.outline(K);
    return { c: pb.canvas(), ox: 18, oy: 11 };
  }
  function portal(f) {
    const pb = new PB(30, 20);
    pb.ellipse(15, 12, 13, 6.5, (x, y, dx, dy) => {
      const d = Math.hypot(dx, dy);
      const a = Math.atan2(dy, dx) + f * 0.9;
      if (d > 0.78) return Math.sin(a * 3) > 0 ? '#b07aff' : '#7040d0';
      return G.dither(['#1a1040', '#3a2a90', '#6a5ae0', '#b0a0ff'], 1 - d + Math.sin(a * 2 + d * 6) * 0.15, x, y);
    });
    pb.outline('#20103a');
    return { c: pb.canvas(), ox: 15, oy: 13 };
  }
  function pool() {
    const pb = new PB(48, 26);
    const I = isoDraw(pb, 24, 2);
    I.slope([[0, 0, 0], [1.4, 0, 0], [1.4, 1.4, 0], [0, 1.4, 0]], 0, 0, 0, (x, y) => {
      const ex = Math.min(x, 1.4 - x, y, 1.4 - y);
      if (ex < 0.12) return G.dither(['#3a3640', '#4a4650', '#5a5660'], G.hash2(Math.floor(x * 16), Math.floor(y * 16), 4), Math.floor(x * 16), Math.floor(y * 16));
      const n = G.hash2(Math.floor(x * 16), Math.floor(y * 16), 6);
      return n > 0.94 ? '#8ac8f0' : G.dither(['#1a4a7a', '#2462a0', '#3a80c0'], 0.4 + ex * 0.8 + (n - 0.5) * 0.2, Math.floor(x * 16), Math.floor(y * 16));
    });
    return { c: pb.canvas(), ox: 24, oy: 13 };
  }
  function fenceSeg(axis) {
    const pb = new PB(20, 22);
    const I = isoDraw(pb, axis === 'x' ? 2 : 18, 12);
    const a = [0, 0], b = axis === 'x' ? [1, 0] : [0, 1];
    for (const z of [3, 7]) {
      const p0 = I.P(a[0], a[1], z), p1 = I.P(b[0], b[1], z);
      pb.line(p0[0], p0[1], p1[0], p1[1], '#8a6038');
      pb.line(p0[0], p0[1] + 1, p1[0], p1[1] + 1, '#5e3e22');
    }
    for (const p of [a, b]) {
      const q = I.P(p[0], p[1], 0);
      pb.rect(q[0] - 1, q[1] - 10, 2, 11, '#6e4a2a');
      pb.set(q[0], q[1] - 10, '#9a7044');
    }
    pb.outline(K);
    return { c: pb.canvas(), ox: axis === 'x' ? 2 : 18, oy: 12 };
  }

  // ======================= PERSONNAGES =======================
  const HEAD_F = ['............', '....kkkk....', '...kSSSSk...', '..kSSSSSSk..', '..kSSSSSSk..', '..kSESSESk..', '..kSSSSSsk..', '...kkSSkk...'];
  const HEAD_B = ['............', '....kkkk....', '...kHHHHk...', '..kHHHHHHk..', '..kHHHHHHk..', '..kHHHHHHk..', '..khHHHHhk..', '...kkSSkk...'];
  const BODY_F = ['..kTTTTTTk..', '.kTkTTTTtkTk', '.kSkTTTTtkSk', '..kLLlLLLk..'];
  const BODY_B = ['..kTTTTTTk..', '.kTkTTTTTkTk', '.kSkTTTTTkSk', '..kLLLLLLk..'];
  const LEGS = {
    s: ['..kPPPPPPk..', '..kPPkkPPk..', '..kPPkkPPk..', '..kBBkkBBk..', '.kBBBkkBBBk.', '.kkkk..kkkk.'],
    a: ['..kPPPPPPk..', '..kPPkkPPk..', '.kBBBkkPPk..', '.kkkk.kBBk..', '......kBBBk.', '.......kkkk.'],
    b: ['..kPPPPPPk..', '..kPPkkPPk..', '..kPPkkBBBk.', '..kBBk.kkkk.', '.kBBBk......', '.kkkk.......'],
  };
  const CAPE_F = ['kCC......CCk', 'kCC......CCk', 'kCCC....CCCk', '.kkk....kkk.'];
  const CAPE_B = ['...kkkkkk...', '..kCCCCCCk..', '..kCCCCCCk..', '..kCCCCCCk..', '..kCCcCCCk..', '..kCcCCcCk..', '..kkkkkkkk..'];
  const EARS = ['............', '............', '............', '............', 'kk........kk', 'kSk......kSk', '.k........k.'];
  const BEARD = ['............', '............', '............', '............', '............', '............', '..kHHHHHHk..', '..kHHHHHHk..', '...kHHHHk...', '....kHHk....'];
  const HAIR = {
    short: { f: ['............', '....kkkk....', '...kHHHHk...', '..kHHHHHHk..', '..kHh..hHk..'], b: [] },
    spiky: {
      f: ['...k.kk.k...', '..kHkHHkHk..', '.kHHHHHHHHk.', '..kHHHHHHHk.', '..kHhHHhHk..'],
      b: ['...k.kk.k...', '..kHkHHkHk..', '.kHHHHHHHHk.', '..kHHHHHHHk.'],
    },
    long: {
      f: ['............', '....kkkk....', '...kHHHHk...', '..kHHHHHHk..', '.kHHh..hHHk.', '.kHk....kHk.', '.kHk....kHk.', '.kHHk..kHHk.', '..kHk..kHk..', '...k....k...'],
      b: ['............', '............', '............', '............', '.kHH....HHk.', '.kHHHHHHHHk.', '.kHHHHHHHHk.', '.kHHHHHHHHk.', '..kHHHHHHk..', '...kHHHHk...', '....kkkk....'],
    },
  };
  const HATS = {
    straw: { f: ['.....kk.....', '....kYYk....', '..kkYYYYkk..', 'kkYYYyYYYYkk', '.kkkkkkkkkk.'] },
    helmet: {
      f: ['....kkkk....', '...kMMMMk...', '..kMMmMMMk..', '..kMMMMMMk..', '..kMkkkkMk..', '..kMEkkEMk..', '..kMMMMMmk..', '...kkMMkk...'],
      b: ['....kkkk....', '...kMMMMk...', '..kMMMMMMk..', '..kMMMMMMk..', '..kMMMMMMk..', '..kMMMMMMk..', '..kmMMMMmk..', '...kkMMkk...'],
    },
    horned: {
      f: ['kk........kk', 'kWk.kkkk.kWk', '.kWkMMMMkWk.', '..kMMMmMMk..', '..kMkkkkMk..'],
      b: ['kk........kk', 'kWk.kkkk.kWk', '.kWkMMMMkWk.', '..kMMMmMMk..', '..kMMMMMMk..'],
    },
    hood: {
      f: ['....kkkk....', '...kCCCCk...', '..kCCCCCCk..', '.kCCCCCCCCk.', '.kCc....cCk.', '.kCk....kCk.', '.kCk....kCk.', '.kCCk..kCCk.'],
      b: ['....kkkk....', '...kCCCCk...', '..kCCCCCCk..', '.kCCCCCCCCk.', '.kCCCCCCCCk.', '.kCCCCCCCCk.', '.kCCCCCCCCk.', '.kCCCCCCCCk.', '..kCCCCCCk..'],
    },
  };

  const humCache = {};
  A.humanoid = function (key, look) {
    if (humCache[key]) return humCache[key];
    const cape = look.cape || look.shirt;
    const metal = look.metal || '#9aa0aa';
    const pal = {
      k: K, S: look.skin, s: sh(look.skin, 0.82), E: look.eye || '#20141c', H: look.hair, h: sh(look.hair, 0.75),
      T: look.shirt, t: sh(look.shirt, 0.78), L: look.belt || '#3b2a1e', l: '#e0b040', P: look.pants, p: sh(look.pants, 0.8),
      B: look.boots || '#3b2a1e', C: cape, c: sh(cape, 0.75), Y: '#d9b25a', y: '#a8823a', M: metal, m: sh(metal, 0.7), W: '#ece2c8',
    };
    const make = (back, legs, bob) => {
      const pb = new PB(14, 20);
      const O = 1;
      if (!back && look.cape) pb.rows(CAPE_F, pal, O, O + 11 + bob);
      pb.rows(LEGS[legs], pal, O, O + 12);
      pb.rows(back ? BODY_B : BODY_F, pal, O, O + 8 + bob);
      if (back && look.cape) pb.rows(CAPE_B, pal, O, O + 8 + bob);
      pb.rows(back ? HEAD_B : HEAD_F, pal, O, O + bob);
      if (look.ears) pb.rows(EARS, pal, O, O + bob);
      const hair = HAIR[look.hairStyle];
      if (hair) pb.rows(back ? hair.b : hair.f, pal, O, O + bob);
      if (!back && look.beard) pb.rows(BEARD, pal, O, O + bob);
      const hat = HATS[look.hat];
      if (hat) pb.rows(back && hat.b ? hat.b : hat.f, pal, O, O + bob);
      return pb.canvas();
    };
    return (humCache[key] = {
      front: [make(false, 's', 0), make(false, 'a', 1), make(false, 's', 0), make(false, 'b', 1)],
      back: [make(true, 's', 0), make(true, 'a', 1), make(true, 's', 0), make(true, 'b', 1)],
      w: 14, h: 20,
    });
  };

  // ======================= ARMES =======================
  const WEAPON_ROWS = {
    sword: { rows: ['..k..', '.kWk.', '.kWk.', '.kWk.', '.kWk.', '.kWk.', '.kWk.', 'kGGGk', '.kBk.', '.kBk.', '..k..'], px: 2.5, py: 8.5 },
    axe: { rows: ['...k...', '.kkBkk.', 'kWWBWWk', 'kWWBWWk', '.kWBWk.', '..kBk..', '..kBk..', '..kBk..', '..kBk..', '..kBk..', '..kBk..', '...k...'], px: 3.5, py: 9 },
    hammer: { rows: ['kkkkkkk', 'kWWWWWk', 'kWWWWWk', 'kkkBkkk', '..kBk..', '..kBk..', '..kBk..', '..kBk..', '..kBk..', '..kBk..', '...k...'], px: 3.5, py: 8.5 },
    staff: { rows: ['.kkk.', 'kOOOk', 'kOwOk', '.kOk.', '.kBk.', '.kBk.', '.kBk.', '.kBk.', '.kBk.', '.kBk.', '.kBk.', '.kBk.', '..k..'], px: 2.5, py: 9 },
  };
  const wCache = {};
  A.weapon = function (kind, blade, accent) {
    const key = kind + blade + accent;
    if (wCache[key]) return wCache[key];
    let c, px, py;
    if (kind === 'bow') {
      const pb = new PB(7, 15);
      for (let y = 0; y < 15; y++) {
        const x = Math.round(1 + 3.2 * Math.sin((Math.PI * y) / 14));
        pb.set(x + 1, y, blade);
        pb.set(x + 2, y, sh(blade, 0.75));
      }
      for (let y = 1; y < 14; y++) pb.set(1, y, '#e8e0d0');
      pb.set(4, 7, accent);
      pb.outline(K);
      c = pb.canvas(); px = 4; py = 7.5;
    } else {
      const d = WEAPON_ROWS[kind];
      c = G.spr(d.rows, { k: K, W: blade, G: accent, B: '#6a4426', O: accent, w: '#ffffff' });
      px = d.px; py = d.py;
    }
    return (wCache[key] = { c, px, py });
  };

  // ======================= ANIMAUX & MONSTRES =======================
  const ANIMALS = {
    sheep: {
      f: [['...kkkkk....', '..kWWWWWkkk.', '.kWWWWWWkDDk', 'kWWWWWWWkDEk', 'kWwWWWWWkDDk', 'kWWwwWWWWkk.', '.kkWWWWWWk..', '..kDk.kDk...', '..kk...kk...'],
        ['...kkkkk....', '..kWWWWWkkk.', '.kWWWWWWkDDk', 'kWWWWWWWkDEk', 'kWwWWWWWkDDk', 'kWWwwWWWWkk.', '.kkWWWWWWk..', '...kDkkDk...', '...kk.kk....']],
      pal: { k: K, W: '#ece8e0', w: '#c8c2b8', D: '#3a3340', E: '#e8e0d0' },
    },
    pig: {
      f: [['...kkkkkkk..', '..kPPPPPPPkk', '.kPPPPPPPPPk', 'kPPPPPPPPEPk', 'kPpPPPPPPPNk', 'kPPPPPPPPPNk', '.kpppppppkk.', '..kPk..kPk..', '..kk....kk..'],
        ['...kkkkkkk..', '..kPPPPPPPkk', '.kPPPPPPPPPk', 'kPPPPPPPPEPk', 'kPpPPPPPPPNk', 'kPPPPPPPPPNk', '.kpppppppkk.', '...kPkkPk...', '...kk..kk...']],
      pal: { k: K, P: '#f0a0a8', p: '#d07888', N: '#d8707f', E: K },
    },
    chicken: {
      f: [['....kRk..', '...kWWWk.', 'k..kWEWOk', 'kWkkWWWk.', 'kWWWWWWk.', '.kWWwWWk.', '..kkkkk..', '...O..O..'],
        ['....kRk..', '...kWWWk.', 'k..kWEWOk', 'kWkkWWWk.', 'kWWWWWWk.', '.kWWwWWk.', '..kkkkk..', '....OO...']],
      pal: { k: K, W: '#f4f0e8', w: '#cfc8bc', R: '#d83030', E: K, O: '#e8a030' },
    },
  };
  const SLIME = ['............', '....kkkk....', '..kkGGLGkk..', '.kGGGGGLLGk.', '.kGGEGGEGGk.', 'kGGGEGGEGGGk', 'kGGGGGGGGGgk', 'kgGGGGGGGggk', '.kggggggggk.', '..kkkkkkkk..'];
  const BAT = [
    ['k..........k', 'kWk......kWk', 'kWWk.kk.kWWk', '.kWWkBBkWWk.', '..kkBEEBkk..', '....kBBk....', '.....kk.....'],
    ['............', '....k..k....', '...kBkkBk...', '.kkkBEEBkkk.', 'kWWWkBBkWWWk', 'kWWk.kk.kWWk', 'kk........kk'],
  ];
  const aCache = {};
  A.animal = function (kind) {
    if (aCache[kind]) return aCache[kind];
    const d = ANIMALS[kind];
    return (aCache[kind] = d.f.map((rows) => G.spr(rows, d.pal)));
  };
  A.slime = function (color) {
    const key = 'slime' + color;
    if (aCache[key]) return aCache[key];
    const pal = { k: K, G: color, g: sh(color, 0.7), L: sh(color, 1.35), E: K };
    const f0 = G.spr(SLIME, pal);
    const f1 = G.newCanvas(12, 10);
    f1.getContext('2d').drawImage(f0, 0, 1, 12, 9, 0, 2, 12, 8);
    return (aCache[key] = [f0, f1]);
  };
  A.bat = function () {
    if (aCache.bat) return aCache.bat;
    const pal = { k: K, W: '#5a3a6a', B: '#3a2440', E: '#ff5040' };
    return (aCache.bat = BAT.map((r) => G.spr(r, pal)));
  };

  // ======================= ICÔNES =======================
  const ICONS = {
    gold: { rows: ['...kkkk...', '..kYYYYk..', '.kYwYYYyk.', 'kYwYyyYYyk', 'kYYyYYyYyk', 'kYYYyyYYyk', 'kYYYYYYYyk', '.kYYYYYyk.', '..kyyyyk..', '...kkkk...'], pal: { k: K, Y: '#f2c94c', y: '#c9962c', w: '#fff3b0' } },
    potion: { rows: ['...kkkk...', '...kBBk...', '...kGGk...', '..kGwGGk..', '.kRwRRRRk.', 'kRRwRRRRrk', 'kRRRRRRRrk', 'kRRRRRRrrk', '.krrrrrrk.', '..kkkkkk..'], pal: { k: K, B: '#8a5a32', G: '#bfe3f0', w: '#ffffff', R: '#d83c3c', r: '#a02828' } },
    gem: { rows: ['..........', '..kkkkkk..', '.kwVVVVvk.', 'kwwVVVVvvk', 'kkkkkkkkkk', '.kVVVVVvk.', '..kVVVvk..', '...kVvk...', '....kk....', '..........'], pal: { k: K, V: '#a066f0', v: '#6a3aa8', w: '#e8d8ff' } },
    iron: { rows: ['..........', '..........', '..kkkkkk..', '.kwwwwwIk.', 'kIIIIIIIik', 'kIIIIIIiik', 'kiiiiiiiik', '.kkkkkkkk.', '..........', '..........'], pal: { k: K, I: '#b8c0cc', i: '#7d8694', w: '#eef2f8' } },
    stone: { rows: ['..........', '...kkkk...', '..kwGGGk..', '.kwGGGGGk.', 'kGGGGGGGgk', 'kGGGGGGggk', 'kgGGGGgggk', '.kggggggk.', '..kkkkkk..', '..........'], pal: { k: K, G: '#8a8a94', g: '#62626c', w: '#b8b8c2' } },
    food: { rows: ['..........', '..........', '..kkkkkk..', '.kwBBwBBk.', 'kwBBwBBwBk', 'kBBwBBwBbk', 'kBBBBBBBbk', '.kbbbbbbk.', '..kkkkkk..', '..........'], pal: { k: K, B: '#d89a50', b: '#a86a30', w: '#f4c886' } },
    gel: { rows: ['..........', '..........', '....kk....', '...kGGk...', '..kGwGGk..', '.kGwGGGGk.', 'kGGGGGGGgk', 'kgGGGGGggk', '.kkkkkkkk.', '..........'], pal: { k: K, G: '#6ad04a', g: '#3e9a2e', w: '#d8ffc0' } },
    bone: { rows: ['kk.kk.....', 'kbkbk.....', '.kbbbk....', '..kbbbk...', '...kbbbk..', '....kbbbk.', '.....kbkbk', '.....kk.kk', '..........', '..........'], pal: { k: K, b: '#efe6d0' } },
    ear: { rows: ['........k.', '.......kGk', '......kGGk', '.....kGGgk', '...kkGGGgk', '..kGGGGgk.', '.kGGGgggk.', 'kGGgggkk..', 'kgggkk....', 'kkkk......'], pal: { k: K, G: '#8ac850', g: '#5a9a34' } },
    bronze: { rows: ['....k.....', '...kwk....', '...kwOk...', '..kwOOOk..', '..kOOOOk..', '.kOOOOOok.', '.kOOOOoook', 'kOOOooook.', 'kkkkkkkk..', '..........'], pal: { k: K, O: '#d08a40', o: '#9a5a24', w: '#f8d098' } },
    wing: { rows: ['k.........', 'kWk.......', 'kWWk......', 'kWWWkk....', '.kWWWWk...', '.kWWWWWkk.', '..kWWWWWWk', '...kkWWWWk', '.....kkkk.', '..........'], pal: { k: K, W: '#6a4a7a' } },
  };
  A.icons = {};
  A.icon = function (id) {
    if (A.icons[id]) return A.icons[id];
    let c;
    if (id === 'wood') {
      const pb = new PB(10, 10);
      pb.rect(1, 3, 6, 5, '#8a5a32');
      pb.rect(1, 3, 6, 1, '#a87444');
      pb.rect(1, 7, 6, 1, '#6a4426');
      pb.ellipse(7.5, 5.5, 2.5, 2.5, (x, y, dx, dy) => (Math.hypot(dx, dy) < 0.5 ? '#b07a44' : '#d8a868'));
      pb.outline(K);
      c = pb.canvas();
    } else if (ICONS[id]) c = G.spr(ICONS[id].rows, ICONS[id].pal);
    else c = G.spr(ICONS.gem.rows, ICONS.gem.pal);
    return (A.icons[id] = c);
  };
  A.iconURL = function (id, scale) {
    const key = id + '@' + (scale || 3);
    if (A.urls[key]) return A.urls[key];
    const src = A.icon(id);
    return (A.urls[key] = A.toURL(src, scale || 3));
  };
  A.urls = {};
  A.toURL = function (src, scale, w, h) {
    w = w || src.width; h = h || src.height;
    const c = G.newCanvas(w * scale, h * scale);
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    x.drawImage(src, Math.floor((w - src.width) / 2) * scale, Math.floor((h - src.height) / 2) * scale, src.width * scale, src.height * scale);
    return c.toDataURL();
  };

  // ======================= CONSTRUCTION GLOBALE =======================
  A.build = function () {
    const S = (G.S = {});
    S.tiles = {
      grass: [grass(1), grass(2), grass(3, true), grass(4), grass(5, true)],
      dirt: [noiseTile(11, ['#5a4230', '#664c36', '#72563c', '#7c6044'], '#8a7a6a'), noiseTile(12, ['#5a4230', '#664c36', '#72563c', '#7c6044'], '#4a3626')],
      sand: [noiseTile(21, ['#a89068', '#b8a076', '#c6ae84', '#d2bc90'], '#e8dcc0'), noiseTile(22, ['#a89068', '#b8a076', '#c6ae84', '#d2bc90'])],
      water: [water(0), water(1), water(2)],
      field: [field(31), field(32)],
      plaza: [cobble(41, ['#5e5a52', '#6c675e', '#7a7468', '#868074'], '#3a3630'), cobble(42, ['#5e5a52', '#6c675e', '#7a7468', '#868074'], '#3a3630')],
      floor: [cobble(51, ['#3e3a40', '#48434a', '#524c54', '#5a545c'], '#1e1a20'), cobble(52, ['#3e3a40', '#48434a', '#524c54', '#5a545c'], '#1e1a20'), cobble(53, ['#3e3a40', '#48434a', '#524c54', '#5a545c'], '#1e1a20')],
    };
    S.wall = [wallBlock(), wallBlock(), wallBlock('banner')];
    S.wallLow = wallBlock(null, true);
    S.pine = [pine(1), pine(2, true), pine(3), pine(4, true)];
    S.tree = { red: roundTree(5, 'red'), orange: roundTree(6, 'orange'), yellow: roundTree(7, 'yellow'), green: roundTree(8, 'green') };
    S.boulder = [boulder(1), boulder(2)];
    S.stump = stump();
    S.bush = [bush(1), bush(2)];
    S.crate = crate();
    S.chest = chest(false);
    S.chestOpen = chest(true);
    S.stairs = stairsDown();
    S.portal = [portal(0), portal(1), portal(2), portal(3)];
    S.pool = pool();
    S.fenceX = fenceSeg('x');
    S.fenceY = fenceSeg('y');
    for (const k of ['barrel', 'anvil', 'pumpkin', 'cabbage', 'sprout', 'torch', 'bones']) S[k] = propSprite(k);
    // ombre
    const sp = new PB(14, 6);
    sp.ellipse(7, 3, 6.5, 2.6, '#00000060');
    S.shadow = sp.canvas();
    const bsp = new PB(30, 12);
    bsp.ellipse(15, 6, 14, 5.5, '#00000060');
    S.bigShadow = bsp.canvas();
  };

  // Vignette d'un bâtiment (pour le menu de construction)
  A.buildingThumb = function (type) {
    const key = 'b:' + type;
    if (A.urls[key]) return A.urls[key];
    const s = A.buildingSprite(type);
    const src = s ? s.c : G.S.pine[0].c;
    const size = 48;
    const sc = Math.min(size / src.width, size / src.height);
    const c = G.newCanvas(size, size);
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    if (type === 'farm') {
      x.drawImage(G.S.tiles.field[0], 8, 26, 32, 16);
      x.drawImage(G.S.pumpkin.c, 12, 26);
      x.drawImage(G.S.cabbage.c, 28, 30);
    }
    x.drawImage(src, (size - src.width * sc) / 2, (size - src.height * sc) / 2, src.width * sc, src.height * sc);
    return (A.urls[key] = A.toURL(c, 2));
  };
})();
