'use strict';
// Génération procédurale de tout le pixel-art : tuiles, transitions, végétation, bâtiments,
// personnages, donjon, icônes. Tout est calculé une seule fois au lancement puis mis en cache.
(function () {
  const PB = G.PB;
  const A = (G.Art = {});
  const K = '#1b1424';
  const shMemo = {};
  const sh = (c, f) => { const k = c + '|' + f; return shMemo[k] || (shMemo[k] = G.shade(c, f)); };
  const shaded = (fn, f) => (a, b, c) => { const col = fn(a, b, c); return col && f !== 1 ? sh(col, f) : col; };
  A.sh = sh;
  // Couleurs « émissives » (vitres éclairées, braises, flammes) : redessinées par-dessus l'éclairage de nuit.
  const EMIT = new Set();
  const emit = (c) => { EMIT.add(c); return c; };
  const inside = (pb, x, y) => pb.get(x, y) != null;

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

  const GRASS = [
    ['#233f22', '#294a26', '#30552a', '#375f2e', '#406a33'],
    ['#2b5227', '#325d2b', '#3a682f', '#437434', '#4e8139'],
    ['#31592a', '#39652f', '#427234', '#4c7f3a', '#5a8d41'],
  ];
  A.GRASS = GRASS;
  function grass(seed, tone, flowers) {
    const cols = GRASS[tone];
    const pb = diamond((x, y, u, v) => {
      const n = G.hash2(x, y, seed);
      const t = 0.42 + 0.16 * Math.sin(u * 6 + seed * 1.7) * Math.cos(v * 5 - seed) + (n - 0.5) * 0.55;
      return G.dither(cols, t, x, y);
    });
    const r = G.seeded(seed * 31 + tone * 7 + 3);
    // brins d'herbe en relief
    for (let i = 0; i < 10; i++) {
      const x = 3 + Math.floor(r() * 26), y = 3 + Math.floor(r() * 11);
      if (!inside(pb, x, y) || !inside(pb, x, y - 2) || !inside(pb, x + 1, y)) continue;
      pb.set(x, y, cols[0]);
      pb.set(x, y - 1, cols[3]);
      pb.set(x, y - 2, cols[4]);
      if (r() < 0.6) { pb.set(x - 1, y - 1, cols[4]); pb.set(x + 1, y, cols[1]); }
      if (r() < 0.4 && inside(pb, x + 1, y - 2)) pb.set(x + 1, y - 2, cols[4]);
    }
    if (flowers) {
      const set = [['#efe7cf', '#e9c54a'], ['#e9c54a', '#c8762a'], ['#c8a0e8', '#f4ecff'], ['#e86a6a', '#f4d870']][Math.floor(r() * 4)];
      for (let i = 0; i < 3; i++) {
        const x = 6 + Math.floor(r() * 20), y = 4 + Math.floor(r() * 8);
        if (![[x, y], [x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]].every((p) => inside(pb, p[0], p[1]))) continue;
        pb.set(x, y + 1, cols[0]);
        pb.set(x - 1, y, set[0]); pb.set(x + 1, y, set[0]); pb.set(x, y - 1, set[0]);
        pb.set(x, y, set[1]);
      }
    }
    return pb.canvas();
  }
  function dirt(seed) {
    const cols = ['#4c3828', '#58422f', '#644c36', '#70563d', '#7c6145'];
    const pb = diamond((x, y, u, v) => {
      const n = G.hash2(x, y, seed);
      const m = G.vnoise(u * 3 + seed, v * 3, seed);
      return G.dither(cols, 0.22 + m * 0.5 + (n - 0.5) * 0.35, x, y);
    });
    const r = G.seeded(seed * 13);
    for (let i = 0; i < 6; i++) {
      const x = 4 + Math.floor(r() * 24), y = 3 + Math.floor(r() * 10);
      if (!inside(pb, x, y) || !inside(pb, x + 2, y + 1)) continue;
      pb.set(x, y, '#a0907a'); pb.set(x + 1, y, '#84735e');
      pb.set(x, y + 1, '#3a2a1e'); pb.set(x + 1, y + 1, '#3a2a1e');
      if (r() < 0.35) { pb.set(x + 2, y, '#84735e'); pb.set(x + 2, y + 1, '#3a2a1e'); }
    }
    for (let i = 0; i < 2; i++) {
      const x = 6 + Math.floor(r() * 18), y = 5 + Math.floor(r() * 6);
      if (inside(pb, x, y) && inside(pb, x + 3, y + 1)) { pb.set(x, y, '#443020'); pb.set(x + 1, y, '#443020'); pb.set(x + 3, y + 1, '#443020'); }
    }
    return pb.canvas();
  }
  function sand(seed) {
    const cols = ['#a08a64', '#b09a72', '#c0aa80', '#ccb78c', '#d8c49a'];
    const pb = diamond((x, y, u, v) => {
      const n = G.hash2(x, y, seed);
      const rip = (u * 6 + Math.sin(v * 9 + seed) * 0.5) % 1;
      if (rip < 0.1 && n > 0.3) return cols[4];
      if (rip > 0.92 && n > 0.4) return cols[1];
      return G.dither(cols, 0.3 + n * 0.45, x, y);
    });
    const r = G.seeded(seed * 3);
    for (let i = 0; i < 3; i++) {
      const x = 6 + Math.floor(r() * 20), y = 4 + Math.floor(r() * 8);
      if (inside(pb, x, y) && inside(pb, x + 1, y)) { pb.set(x, y, '#f0e4d0'); pb.set(x + 1, y, '#d8b8a0'); }
    }
    return pb.canvas();
  }
  function water(frame) {
    return diamond((x, y, u, v) => {
      const n = G.hash2(x, y, 7);
      const w = Math.sin((u * 2 + v) * 6.283 + frame * 2.094) + 0.5 * Math.sin((v * 3 - u) * 6.283 - frame * 2.094);
      if (n > 0.95 && w > 0.9) return '#7fb0dc';
      return G.dither(['#122844', '#17324f', '#1d3c5c', '#244769', '#2c5377'], 0.45 + w * 0.2 + (n - 0.5) * 0.3, x, y);
    }).canvas();
  }
  function field(seed) {
    const pb = diamond((x, y, u, v) => {
      const n = G.hash2(x, y, seed);
      const f = (v * 4) % 1;
      if (f < 0.2) return n > 0.5 ? '#36251a' : '#3e2b1c';
      if (f < 0.32) return '#4a3524';
      return G.dither(['#553c27', '#62462e', '#6e5034', '#7a5a3a'], 0.3 + n * 0.5 + (f > 0.7 ? 0.25 : 0), x, y);
    });
    const r = G.seeded(seed);
    for (let i = 0; i < 3; i++) {
      const x = 6 + Math.floor(r() * 20), y = 4 + Math.floor(r() * 8);
      if (inside(pb, x, y) && inside(pb, x, y - 1)) { pb.set(x, y, '#3e6a2e'); pb.set(x, y - 1, '#5a8a3e'); }
    }
    return pb.canvas();
  }
  // Pierres irrégulières (diagramme de Voronoï) avec biseau éclairé en haut et ombré en bas.
  function stones(seed, o) {
    const r = G.seeded(seed);
    const pts = [];
    for (let i = 0; i < o.n; i++) pts.push({ u: r(), v: r(), s: r(), crack: r() < (o.cracks || 0), a: r() * Math.PI });
    const pb = diamond((x, y, u, v) => {
      let d1 = 9, d2 = 9, best = pts[0], bu = 0, bv = 0;
      for (const p of pts)
        for (let ox = -1; ox <= 1; ox++)
          for (let oy = -1; oy <= 1; oy++) {
            const du = u - (p.u + ox), dv = v - (p.v + oy);
            const d = du * du + dv * dv;
            if (d < d1) { d2 = d1; d1 = d; best = p; bu = du; bv = dv; } else if (d < d2) d2 = d;
          }
      const e = Math.sqrt(d2) - Math.sqrt(d1);
      const n = G.hash2(x, y, seed);
      if (e < o.mw) return o.moss && G.hash2(Math.floor(u * 6), Math.floor(v * 6), seed) > 0.7 ? (n > 0.6 ? o.moss[0] : o.moss[1]) : o.mortar;
      if (best.crack && Math.sqrt(d1) < 0.13 && Math.abs(bu * Math.cos(best.a) + bv * Math.sin(best.a)) < 0.011) return o.mortar;
      let t = best.s * 0.6 + 0.2 + (n - 0.5) * 0.2;
      if (e < o.mw * 2.4) t += bu + bv < 0 ? 0.3 : -0.28;
      return G.dither(o.pal, t, x, y);
    });
    return pb.canvas();
  }
  // Bordure naturelle (herbe qui déborde sur un chemin, sable mouillé sur l'eau…)
  // dir : 0 = voisin (x, y-1), 1 = (x+1, y), 2 = (x, y+1), 3 = (x-1, y)
  function fringe(dir, seed, cols, edge, foam) {
    return diamond((x, y, u, v) => {
      const d = dir === 0 ? v : dir === 1 ? 1 - u : dir === 2 ? 1 - v : u;
      const along = dir % 2 === 0 ? u : v;
      const lim = 0.12 + 0.07 * Math.sin(along * 17 + seed) + 0.05 * Math.sin(along * 41 + seed * 3) + G.hash2(x, y, seed) * 0.05;
      if (d < lim - 0.045) return G.dither(cols, 0.35 + G.hash2(x, y, seed + 1) * 0.45, x, y);
      if (d < lim) return edge;
      if (foam && d < lim + 0.05 && G.hash2(x, y, seed + 9) > 0.35) return foam;
      return null;
    }).canvas();
  }

  // ======================= DÉCALQUES AU SOL =======================
  function scatter(w, h, seed, n, pick) {
    const pb = new PB(w, h);
    const r = G.seeded(seed);
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r());
      const x = w / 2 + Math.cos(a) * d * (w / 2 - 1), y = h / 2 + Math.sin(a) * d * (h / 2 - 1);
      pick(pb, Math.floor(x), Math.floor(y), r);
    }
    return { c: pb.canvas(), ox: w / 2, oy: h / 2 };
  }
  function leaves(pal, seed) {
    return scatter(26, 12, seed, 34, (pb, x, y, r) => {
      const c = pal[Math.floor(r() * 3)];
      pb.set(x, y, c);
      if (r() < 0.5) pb.set(x + 1, y, sh(c, 0.8));
    });
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
      // boîte « matière » : mêmes couleurs, face droite plus sombre, dessus plus clair
      solid(x0, y0, x1, y1, z0, z1, tex, top) {
        I.box(x0, y0, x1, y1, z0, z1, { left: tex, right: shaded(tex, 0.74), top: top || ((a, b) => sh(tex(a * 16, b * 16), 1.12)) });
      },
    };
    return I;
  }

  const T = {
    logs(c) {
      const c1 = sh(c, 0.86), ln = sh(c, 0.45), knot = sh(c, 0.6), hi = sh(c, 1.14);
      return (a, z) => {
        const zi = Math.floor(z);
        if (zi % 4 === 3) return ln;
        if (zi % 4 === 0) return hi;
        if (G.hash2(Math.floor(a * 16), zi, 4) > 0.965) return knot;
        return Math.floor(zi / 4) % 2 ? c : c1;
      };
    },
    bricks(pal, mortar, bw, bh, opt) {
      bw = bw || 8; bh = bh || 4;
      opt = opt || {};
      return (a, z) => {
        const zi = Math.floor(z), row = Math.floor(zi / bh);
        const u = Math.floor(a * 16 + (row % 2) * (bw / 2));
        const col = Math.floor(u / bw);
        if (zi % bh === 0 || u % bw === 0) return opt.moss && z < 6 && G.hash2(u >> 2, zi, 21) > 0.72 ? opt.moss : mortar;
        const n = G.hash2(col, row, 3);
        let c = pal[Math.floor(n * pal.length)];
        if (opt.cracks && G.hash2(col, row, 5) > 0.9 && (u % bw) === (zi % bh) + 2) return mortar;
        if (opt.moss && z < 4 && G.hash2(u >> 1, zi, 22) > 0.8) c = opt.moss;
        if (zi % bh === bh - 1) c = sh(c, 1.15); // arête supérieure éclairée
        else if (zi % bh === 1) c = sh(c, 0.86);
        return c;
      };
    },
    planks(c) {
      const dark = sh(c, 0.58), c1 = sh(c, 0.9), hi = sh(c, 1.12);
      return (a, z) => {
        const u = Math.floor(a * 16);
        if (u % 4 === 0) return dark;
        if (u % 4 === 1) return hi;
        if (G.hash2(u, Math.floor(z), 9) > 0.97) return dark;
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
    roof(pal, edge, rowsPerTile, cols, moss) {
      return (s, t) => {
        const rows = t * rowsPerTile, row = Math.floor(rows), f = rows - row;
        if (f < 0.16) return edge;
        const cf = s * cols + (row % 2) * 0.5;
        if (cf % 1 < 0.1) return edge;
        const col = Math.floor(cf);
        let c = pal[Math.floor(G.hash2(col, row, 11) * pal.length)];
        if (moss && G.hash2(col, row, 12) > 0.95) c = moss;
        if (f > 0.72) c = sh(c, 0.8); // ombre de la rangée supérieure
        else if (f < 0.36) c = sh(c, 1.14); // bord inférieur éclairé
        return c;
      };
    },
  };

  const GLASS = ['#fff2b8', '#ffe08a', '#ffc85a', '#f2a640'];
  GLASS.forEach(emit);
  function glassLit(ax, az, w, h) {
    const d = Math.hypot(ax - w / 2, az - h / 2) / Math.max(w, h);
    return d < 0.2 ? GLASS[0] : d < 0.32 ? GLASS[1] : d < 0.44 ? GLASS[2] : GLASS[3];
  }
  function windowFace(I, face, pos, b0, b1, z0, z1, o) {
    o = o || {};
    const frame = o.frame || '#3b2717';
    const wp = (b1 - b0) * 16, hp = z1 - z0;
    const fn = (b, z) => {
      const ax = (b - b0) * 16, az = z - z0;
      if (ax < 1 || ax > wp - 1 || az < 1 || az > hp - 1) return frame;
      if (Math.abs(ax - wp / 2) < 0.6 || Math.abs(az - hp / 2) < 0.6) return frame;
      return glassLit(ax, az, wp, hp);
    };
    const poly = face === 'L' ? I.polyY : I.polyX;
    if (o.shutters) {
      const sw = 0.13;
      const shut = (b, z) => (Math.floor(z) % 3 === 0 ? sh(o.shutters, 0.65) : o.shutters);
      poly(pos, [[b0 - sw, z0], [b0, z0], [b0, z1], [b0 - sw, z1]], shut);
      poly(pos, [[b1, z0], [b1 + sw, z0], [b1 + sw, z1], [b1, z1]], shut);
    }
    poly(pos, [[b0, z0], [b1, z0], [b1, z1], [b0, z1]], fn);
    if (o.flowers) {
      poly(pos, [[b0 - 0.05, z0 - 3], [b1 + 0.05, z0 - 3], [b1 + 0.05, z0], [b0 - 0.05, z0]], () => '#5a3a20');
      poly(pos, [[b0, z0], [b1, z0], [b1, z0 + 2], [b0, z0 + 2]], (b, z) => {
        const h = G.hash2(Math.floor(b * 16), Math.floor(z), 4);
        return h > 0.7 ? '#e05050' : h > 0.45 ? '#f0d060' : h > 0.25 ? '#4a8a3a' : null;
      });
    }
  }
  function doorFace(I, face, pos, b0, b1, h, wood, frame) {
    const wp = (b1 - b0) * 16;
    const poly = face === 'L' ? I.polyY : I.polyX;
    poly(pos, [[b0, 0], [b1, 0], [b1, h], [(b0 + b1) / 2, h + 2], [b0, h]], (b, z) => {
      const ax = (b - b0) * 16;
      if (ax < 1 || ax > wp - 1 || z > h - 0.5) return frame;
      if (Math.abs(z - 3) < 0.7 || Math.abs(z - h + 3) < 0.7) return '#4a4a52'; // pentures en fer
      if (Math.floor(ax) % 3 === 0) return sh(wood, 0.68);
      if (Math.abs(ax - wp + 2.5) < 0.8 && Math.abs(z - h / 2) < 0.8) return '#e0b040';
      return wood;
    });
  }

  // Ombre portée au sol (lumière venant du haut-gauche → ombre vers le bas-droite de l'écran)
  function groundShadow(w, d, hpx) {
    const s = Math.min(2.4, (hpx / 16) * 0.7);
    const m = 4;
    const W = Math.ceil((w + d + s) * 16) + m * 2, H = Math.ceil((w + d + s) * 8) + m * 2;
    const ox = d * 16 + m, oy = m;
    const pb = new PB(W, H);
    const I = isoDraw(pb, ox, oy);
    I.slope([[0, 0, 0], [w + s, 0.25, 0], [w + s, d + 0.15, 0], [0, d, 0]], 0, 0, 0, (x, y) => {
      const k = x > w ? (x - w) / s : 0;
      if (k > 0.55 && ((Math.floor(x * 16) + Math.floor(y * 16)) & 1)) return null;
      return '#0a0c2266';
    });
    return { c: pb.canvas(), ox, oy };
  }

  // Bâtiment à pignon générique. Retourne {c, ox, oy, lights, smoke, emis, shadow}
  function gable(o) {
    const { w, d, h, r } = o;
    const e = o.e != null ? o.e : 0.2;
    const k = r / (d / 2), s = k * e;
    const m = 18, extraTop = o.extraTop || 16;
    const W = Math.ceil((w + d + 2 * e) * 16) + 2 * m;
    const H = Math.ceil((w + d + 2 * e) * 8) + h + r + extraTop + 2 * m;
    const ox = Math.round((d + e) * 16) + m, oy = h + r + extraTop + m + Math.round(e * 8);
    const pb = new PB(W, H);
    const I = isoDraw(pb, ox, oy);
    const out = { lights: [], smoke: [] };
    const beam = o.beam || '#3e2a1a';
    const plinthTex = T.bricks(['#6a6870', '#5d5b63', '#74727a'], '#38363e', 6, 4);
    const post = (a, len, z) => (o.posts && (a < 0.09 || a > len - 0.09 || (o.posts > 1 && Math.abs(a - Math.round(a)) < 0.045 && z > (o.plinth || 0)) || Math.abs(z - h + 2) < 1) ? beam : null);
    const wallL = (x, z) => (z < (o.plinth || 0) ? plinthTex(x, z) : post(x, w, z) || o.wall(x, z, 'L'));
    const wallR = (y, z) => (z < (o.plinth || 0) ? plinthTex(y, z) : post(y, d, z) || (o.gableWall || o.wall)(y, z, 'R'));
    I.polyY(d, [[0, 0], [w, 0], [w, h], [0, h]], wallL);
    I.polyX(w, [[0, 0], [d, 0], [d, h], [d / 2, h + r], [0, h]], shaded(wallR, 0.78));
    if (o.details) o.details(I, out, pb);
    const roof = T.roof(o.roofPal, o.roofEdge, o.roofRows || 6, o.roofCols || 5, o.moss);
    const tmax = d / 2 + e;
    const ridge = sh(o.roofEdge, 1.6);
    const withRidge = (fn) => (x, t) => (tmax - t < 0.1 ? (tmax - t < 0.05 ? ridge : o.roofEdge) : fn(x, t));
    I.slope([[-e, -e, h - s], [w + e, -e, h - s], [w + e, d / 2, h + r], [-e, d / 2, h + r]], h + r - (k * d) / 2, 0, k,
      shaded((x, y) => withRidge(roof)(x, y + e), 0.8));
    if (o.chimney) {
      const c = o.chimney;
      const tex = T.bricks(['#6d6870', '#7a757e', '#615c66'], '#3a3640', 6, 3);
      I.solid(c.x, c.y, c.x + c.s, c.y + c.s, h, h + r + c.top, tex, () => '#231d26');
      I.solid(c.x - 0.05, c.y - 0.05, c.x + c.s + 0.05, c.y + c.s + 0.05, h + r + c.top, h + r + c.top + 2, () => '#4a4650', () => '#1a1418');
      out.smoke.push({ x: c.x + c.s / 2, y: c.y + c.s / 2, z: h + r + c.top + 3 });
    }
    I.slope([[-e, d / 2, h + r], [w + e, d / 2, h + r], [w + e, d + e, h - s], [-e, d + e, h - s]], h + r + (k * d) / 2, 0, -k,
      (x, y) => withRidge(roof)(x, d + e - y));
    const fas = sh(o.roofEdge, 0.85);
    I.polyX(w + e, [[-e, h - s], [d / 2, h + r], [d + e, h - s], [d + e, h - s - 2], [d / 2, h + r - 2], [-e, h - s - 2]], (y, z) => (Math.abs(z - (h + r - 1)) < 1.5 ? ridge : fas));
    if (o.after) o.after(I, out, pb);
    finishBuilding(pb, out, ox, oy, w, d, h + r);
    return out;
  }
  function finishBuilding(pb, out, ox, oy, w, d, hpx) {
    pb.outline(K);
    out.c = pb.canvas();
    out.emis = emissiveOf(pb);
    out.ox = ox; out.oy = oy;
    out.shadow = groundShadow(w, d, hpx);
  }
  function emissiveOf(pb) {
    const e = new PB(pb.w, pb.h);
    let any = false;
    for (let i = 0; i < pb.d.length; i++) if (pb.d[i] && EMIT.has(pb.d[i])) { e.d[i] = pb.d[i]; any = true; }
    return any ? e.canvas() : null;
  }
  function sprite(pb, ox, oy, extra, w, d, hpx) {
    const out = Object.assign({ lights: [], smoke: [] }, extra || {});
    if (w) finishBuilding(pb, out, ox, oy, w, d, hpx);
    else { pb.outline(K); out.c = pb.canvas(); out.emis = emissiveOf(pb); out.ox = ox; out.oy = oy; }
    return out;
  }
  function lanternAt(pb, x, y) {
    pb.rect(x - 2, y, 5, 6, '#2a1a10');
    pb.rect(x - 1, y + 1, 3, 4, emit('#ffd36a'));
    pb.set(x, y + 2, emit('#fff2c0'));
    pb.rect(x - 1, y - 1, 3, 1, '#2a1a10');
  }

  // ======================= BÂTIMENTS =======================
  const B = {};
  B.house = () => gable({
    w: 3, d: 3, h: 22, r: 18, plinth: 4, posts: 2, beam: '#3a2616',
    wall: (x, z) => T.logs('#7d5636')(x, z),
    roofPal: ['#2b3854', '#344465', '#3d4f75', '#465a82'], roofEdge: '#1d2538', moss: '#3e5a3a',
    chimney: { x: 0.5, y: 0.6, s: 0.45, top: 6 },
    details(I, out) {
      windowFace(I, 'L', 3, 0.3, 0.85, 8, 17, { shutters: '#4a6a3a', flowers: true });
      windowFace(I, 'L', 3, 2.15, 2.7, 8, 17, { shutters: '#4a6a3a', flowers: true });
      doorFace(I, 'L', 3, 1.2, 1.8, 15, '#5a3a20', '#3b2717');
      windowFace(I, 'R', 3, 1.15, 1.85, 9, 18, { shutters: '#4a6a3a' });
      out.lights.push({ x: 0.6, y: 3.2, z: 12 }, { x: 2.4, y: 3.2, z: 12 }, { x: 3.2, y: 1.5, z: 13 });
    },
    after(I, out, pb) {
      // porche en bois avec rambarde et marche
      const deck = T.planks('#8a6238');
      I.box(0.55, 3, 2.45, 3.6, 0, 3, { left: deck, right: shaded(deck, 0.72), top: (a) => (Math.floor(a * 16) % 3 === 0 ? '#5e4024' : '#9a7044') });
      I.solid(1.2, 3.6, 1.8, 3.85, 0, 1.5, deck);
      const postTex = () => '#5a3a20';
      for (const px of [0.55, 2.35]) I.solid(px, 3.5, px + 0.1, 3.6, 3, 13, postTex, () => '#7a5232');
      for (const seg of [[0.55, 1.15], [1.85, 2.45]]) I.box(seg[0], 3.52, seg[1], 3.58, 10, 11.5, { left: () => '#6e4a2a', top: () => '#8a6238' });
      for (const seg of [[0.55, 1.15], [1.85, 2.45]]) for (let x = seg[0] + 0.15; x < seg[1]; x += 0.2) I.box(x, 3.53, x + 0.05, 3.57, 3, 10, { left: () => '#5e4024' });
      const l = I.P(2.4, 3.55, 14);
      lanternAt(pb, Math.round(l[0]), Math.round(l[1]));
      out.lights.push({ x: 2.4, y: 3.6, z: 12, color: 'lamp' });
    },
  });
  B.forge = () => gable({
    w: 3, d: 3, h: 20, r: 12, posts: 1, beam: '#3a2616',
    wall: T.bricks(['#6c6a70', '#76737a', '#5f5d64', '#807d84'], '#3a3840', 8, 4, { cracks: true }),
    roofPal: ['#6e4a2c', '#7a5432', '#644226', '#82603a'], roofEdge: '#3a2616', roofRows: 5, roofCols: 4, moss: '#4a5a32',
    chimney: { x: 0.3, y: 0.4, s: 0.7, top: 16 },
    details(I, out) {
      const glow = ['#2a1610', '#5a2a14', '#a8481c', '#f08a2a'];
      glow.slice(2).forEach(emit);
      // grand atelier ouvert (face gauche)
      I.polyY(3, [[0.5, 0], [2.0, 0], [2.0, 13], [0.5, 13]], (x, z) => {
        const ax = (x - 0.5) * 16;
        if (ax < 1.2 || ax > 22.8 || z > 12) return '#3b2717';
        if (z > 10.5) return '#5a3a20'; // linteau
        if (Math.abs(ax - 6) < 1 && z > 5 && z < 10) return '#8a8f99'; // outils suspendus
        if (Math.abs(ax - 9) < 0.6 && z > 4 && z < 10) return '#6a4426';
        const g = (1 - z / 13) * (1 - Math.abs(ax - 15) / 16);
        return G.dither(glow, g * 1.1, Math.floor(ax), Math.floor(z));
      });
      // four rougeoyant (face droite)
      const fire = ['#5a1a0c', '#c0441a', '#ff9a2a', '#ffe070'];
      fire.slice(1).forEach(emit);
      I.polyX(3, [[0.95, 0], [2.25, 0], [2.25, 9], [1.6, 13], [0.95, 9]], (y, z) => (Math.abs(y - 0.95) < 0.07 || Math.abs(y - 2.25) < 0.07 || z > 11.5 ? '#3a3840' : null));
      I.polyX(3, [[1.05, 0], [2.15, 0], [2.15, 8.5], [1.6, 11.5], [1.05, 8.5]], (y, z) => {
        const t = 1 - z / 12;
        return G.dither(fire, t * 0.95 + G.hash2(Math.floor(y * 16), Math.floor(z), 2) * 0.15, Math.floor(y * 16), Math.floor(z));
      });
      out.lights.push({ x: 3.25, y: 1.6, z: 5, big: true, color: 'fire' }, { x: 1.25, y: 3.25, z: 6, color: 'fire' });
      out.fire = [{ x: 3.05, y: 1.6, z: 3 }];
    },
    after(I, out, pb) {
      // outils accrochés sur le pignon
      const p = I.P(3, 0.4, 16);
      pb.line(p[0], p[1], p[0] + 1, p[1] + 6, '#6a4426');
      pb.rect(p[0] - 1, p[1] + 5, 4, 2, '#9aa0aa');
      const q = I.P(3, 0.7, 16);
      pb.line(q[0], q[1], q[0] + 2, q[1] + 7, '#8a8f99');
      pb.line(q[0] + 2, q[1], q[0], q[1] + 7, '#8a8f99');
    },
  });
  B.tavern = () => gable({
    w: 4, d: 3, h: 30, r: 18, posts: 1, beam: '#3a2414',
    wall: (x, z) => (z < 13 ? T.bricks(['#6c6a70', '#76737a', '#5f5d64'], '#3a3840')(x, z) : T.plaster('#d2bc90', '#4a3020')(x, z - 13)),
    roofPal: ['#7c2f24', '#8c3a2a', '#9a4430', '#6e2a20'], roofEdge: '#3c1612', moss: '#5a5a30',
    chimney: { x: 2.8, y: 0.5, s: 0.5, top: 7 },
    details(I, out) {
      windowFace(I, 'L', 3, 0.35, 0.95, 4, 11, {});
      windowFace(I, 'L', 3, 3.05, 3.65, 4, 11, {});
      doorFace(I, 'L', 3, 1.6, 2.4, 11, '#5a3a20', '#3b2717');
      windowFace(I, 'L', 3, 0.45, 1.05, 16, 25, { shutters: '#7a2a20', flowers: true });
      windowFace(I, 'L', 3, 1.7, 2.3, 16, 25, { shutters: '#7a2a20', flowers: true });
      windowFace(I, 'L', 3, 2.95, 3.55, 16, 25, { shutters: '#7a2a20', flowers: true });
      windowFace(I, 'R', 4, 1.1, 1.9, 16, 26, { frame: '#4a3020' });
      windowFace(I, 'R', 4, 1.15, 1.85, 3, 10, { frame: '#3b2717' });
      out.lights.push({ x: 0.7, y: 3.2, z: 8 }, { x: 3.3, y: 3.2, z: 8 }, { x: 2.0, y: 3.2, z: 20 }, { x: 4.2, y: 1.5, z: 20 });
    },
    after(I, out, pb) {
      // enseigne à la chope
      const p = I.P(4, 2.6, 19);
      pb.rect(p[0], p[1] - 1, 8, 1, '#3b2717');
      pb.rect(p[0] + 2, p[1], 1, 2, '#3b2717');
      pb.rect(p[0] + 1, p[1] + 2, 7, 6, '#8a5a32');
      pb.rect(p[0] + 3, p[1] + 3, 3, 4, '#e0b040');
      pb.rect(p[0] + 3, p[1] + 3, 3, 1, '#fff6dc');
      pb.set(p[0] + 6, p[1] + 4, '#e0b040'); pb.set(p[0] + 6, p[1] + 5, '#e0b040');
      // lanternes de part et d'autre de la porte
      for (const lx of [1.4, 2.6]) { const l = I.P(lx, 3.05, 12); lanternAt(pb, Math.round(l[0]), Math.round(l[1])); }
      out.lights.push({ x: 1.4, y: 3.2, z: 10, color: 'lamp' }, { x: 2.6, y: 3.2, z: 10, color: 'lamp' });
    },
  });
  B.sawmill = () => gable({
    w: 3, d: 2, h: 14, r: 10, posts: 1,
    wall: T.planks('#8a6038'),
    roofPal: ['#6e4a2c', '#7a5432', '#5e3e24', '#86603a'], roofEdge: '#3a2616', roofRows: 5, roofCols: 4, moss: '#4a5a32',
    details(I) {
      I.polyY(2, [[0.6, 0], [2.4, 0], [2.4, 11], [0.6, 11]], (x, z) => (z > 10 || (x - 0.6) * 16 < 1 || (x - 0.6) * 16 > 27.8 ? '#3a2616' : z < 2 ? '#c8a060' : '#24170e'));
    },
    after(I, out, pb) {
      for (let i = 0; i < 6; i++) {
        const row = i < 3 ? 0 : i < 5 ? 1 : 2;
        const col = i < 3 ? i : i < 5 ? i - 3 + 0.5 : 1;
        const p = I.P(0.6 + col * 0.42, 2.2, 3 + row * 5);
        pb.ellipse(p[0], p[1], 3, 3, (x, y, dx, dy) => { const d = Math.hypot(dx, dy); return d < 0.3 ? '#a8763c' : d < 0.6 ? '#d8aa6e' : d < 0.8 ? '#c89a5e' : '#6a4426'; });
      }
      // lame de scie circulaire sur le pignon
      const s = I.P(3, 1, 9);
      pb.ellipse(s[0] + 1, s[1], 4, 4, (x, y, dx, dy) => (Math.hypot(dx, dy) < 0.3 ? '#5a3a20' : (Math.floor(Math.atan2(dy, dx) * 3) % 2 ? '#c8ccd4' : '#9aa0aa')));
    },
  });

  B.market = () => {
    const m = 8, w = 2, d = 2;
    const W = (w + d) * 16 + 2 * m, H = (w + d) * 8 + 36 + 2 * m;
    const ox = d * 16 + m, oy = 36 + m;
    const pb = new PB(W, H);
    const I = isoDraw(pb, ox, oy);
    const wood = { left: T.planks('#7a5432'), right: shaded(T.planks('#7a5432'), 0.75), top: (a) => (Math.floor(a * 16) % 4 === 0 ? '#6a4426' : '#8f6640') };
    const pole = (x, y, z1) => I.box(x, y, x + 0.12, y + 0.12, 0, z1, { left: () => '#5a3a20', right: () => '#3e2716', top: () => '#6a4a2a' });
    pole(0.08, 0.08, 26); pole(1.8, 0.08, 26);
    I.box(0.25, 0.25, 0.8, 0.8, 0, 7, wood);
    I.box(1.15, 0.2, 1.75, 0.8, 0, 9, wood);
    // sacs de grain
    for (const sx of [0.35, 0.6]) { const p = I.P(sx, 0.55, 9); pb.ellipse(p[0], p[1], 3.5, 3, (x, y, dx, dy) => (dy < -0.3 ? '#e0cca0' : dy > 0.4 ? '#a08a60' : '#c8b48a')); }
    I.box(0.15, 1.1, 1.85, 1.75, 0, 9, wood);
    const goods = [['#d0402a', '#8a2418', '#ff8a6a'], ['#7ab048', '#4a7a30', '#b0e080'], ['#f09030', '#b05a18', '#ffc070'], ['#d8b860', '#a08030', '#fff0a0']];
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 5; j++) {
        const p = I.P(0.3 + i * 0.38 + (j % 2) * 0.12, 1.22 + (j >> 1) * 0.18, 10 + (j === 4 ? 2 : 0));
        pb.ellipse(p[0], p[1], 1.6, 1.3, (x, y, dx, dy) => (dy < -0.3 && dx < 0 ? goods[i][2] : dy > 0.3 ? goods[i][1] : goods[i][0]));
      }
    pole(0.08, 1.8, 18); pole(1.8, 1.8, 18);
    const kz = -9 / 2.1;
    I.slope([[-0.05, -0.05, 26.2], [2.05, -0.05, 26.2], [2.05, 2.05, 26 + kz * 2.05], [-0.05, 2.05, 26 + kz * 2.05]], 26, 0, kz, (x, y) => {
      const st = Math.floor((x + 0.05) * 5) % 2;
      const base = st ? '#d8c08a' : '#a8322a';
      const f = (y * 8) % 1;
      return f < 0.12 ? sh(base, 0.82) : f > 0.85 ? sh(base, 1.1) : base;
    });
    const p0 = I.P(-0.05, 2.05, 26 + kz * 2.05);
    for (let i = 0; i < 34; i++) {
      const st = Math.floor((i / 16) * 5) % 2;
      const x = p0[0] + i, y = p0[1] + i / 2;
      pb.set(x, y + 1, st ? '#d8c08a' : '#a8322a');
      if (i % 3 !== 2) pb.set(x, y + 2, st ? '#a8905a' : '#7a2018');
    }
    const l = I.P(1.86, 1.95, 15);
    lanternAt(pb, Math.round(l[0]), Math.round(l[1]));
    return sprite(pb, ox, oy, { lights: [{ x: 1.9, y: 2.0, z: 12, color: 'lamp' }] }, 2, 2, 26);
  };

  B.quarry = () => {
    const m = 6, W = 4 * 16 + 2 * m, H = 4 * 8 + 28 + 2 * m, ox = 32 + m, oy = 28 + m;
    const pb = new PB(W, H);
    const I = isoDraw(pb, ox, oy);
    const pal = ['#44444e', '#58586a', '#70707c', '#8a8a98', '#a8a8b6'];
    const rocks = [[0.55, 0.55, 10], [1.4, 0.5, 8], [1.0, 1.0, 11], [0.45, 1.35, 7]];
    for (const r of rocks) {
      const p = I.P(r[0], r[1], 0);
      const rx = r[2], ry = r[2] * 0.8;
      pb.ellipse(p[0], p[1] - ry * 0.6, rx, ry, (x, y, dx, dy) => (G.hash2(x >> 1, y >> 1, 5) > 0.93 ? '#5a7a40' : G.dither(pal, 0.78 - (dx + dy) * 0.38 + G.hash2(x, y, 9) * 0.15, x, y)));
    }
    // blocs taillés
    const block = T.bricks(['#8a8a96', '#9696a2'], '#5a5a66', 16, 6);
    I.solid(1.35, 1.3, 1.85, 1.8, 0, 6, block, () => '#acacb8');
    I.solid(1.45, 1.4, 1.8, 1.75, 6, 11, block, () => '#b8b8c4');
    const p = I.P(0.95, 1.5, 15);
    pb.line(p[0], p[1], p[0] + 5, p[1] + 9, '#6a4a2a');
    pb.line(p[0] - 3, p[1] + 1, p[0] + 3, p[1] - 2, '#c0c8d0');
    return sprite(pb, ox, oy, {}, 2, 2, 18);
  };

  B.mine = () => {
    const m = 6, W = 4 * 16 + 2 * m, H = 4 * 8 + 36 + 2 * m, ox = 32 + m, oy = 36 + m;
    const pb = new PB(W, H);
    const I = isoDraw(pb, ox, oy);
    const pal = ['#3a3640', '#4c4854', '#605a68', '#76707e', '#8e8896'];
    const c = I.P(1, 1, 0);
    pb.ellipse(c[0], c[1] - 12, 30, 20, (x, y, dx, dy) => (G.hash2(x >> 1, y >> 1, 6) > 0.95 ? '#3e5a2e' : G.dither(pal, 0.42 - (dx + dy) * 0.3 + (G.hash2(x >> 2, y >> 2, 3) - 0.5) * 0.3, x, y)));
    for (let i = 0; i < 16; i++) pb.set(c[0] + 6 + (i % 5) * 3, c[1] - 20 + Math.floor(i / 5) * 4 + (i % 2), i % 3 ? '#c8d0dc' : '#e8b060');
    const e = I.P(0.9, 2, 0);
    pb.ellipse(e[0], e[1] - 4, 8, 11, (x, y, dx, dy) => (dy > 0.35 ? null : Math.hypot(dx, dy) > 0.8 ? '#6a4a2a' : G.dither(['#080608', '#140e12', '#2a1c16'], 0.6 - dy * 0.5, x, y)));
    pb.rect(e[0] - 8, e[1] - 15, 2, 15, '#7a5432'); pb.rect(e[0] - 8, e[1] - 15, 1, 15, '#9a7044');
    pb.rect(e[0] + 6, e[1] - 15, 2, 15, '#7a5432'); pb.rect(e[0] + 6, e[1] - 15, 1, 15, '#9a7044');
    pb.rect(e[0] - 10, e[1] - 17, 20, 3, '#7a5432'); pb.rect(e[0] - 10, e[1] - 17, 20, 1, '#9a7044');
    // rails qui sortent de la mine
    for (let i = 0; i < 12; i++) {
      const q = I.P(0.9 + 0.02 * i, 2 + i * 0.06, 0);
      pb.set(q[0] - 3, q[1], '#8a8f99'); pb.set(q[0] + 3, q[1], '#8a8f99');
      if (i % 3 === 0) pb.rect(q[0] - 4, q[1] + 1, 9, 1, '#5a3a20');
    }
    lanternAt(pb, e[0] + 10, e[1] - 18);
    return sprite(pb, ox, oy, { lights: [{ x: 0.6, y: 2.2, z: 14, color: 'lamp' }] }, 2, 2, 32);
  };

  B.dungeon = () => {
    const m = 6, W = 4 * 16 + 2 * m, H = 4 * 8 + 48 + 2 * m, ox = 32 + m, oy = 48 + m;
    const pb = new PB(W, H);
    const I = isoDraw(pb, ox, oy);
    const bt = T.bricks(['#5a5660', '#646068', '#504c56', '#6a6670'], '#2e2a34', 6, 4, { cracks: true, moss: '#3e5a32' });
    I.slope([[0.2, 0.2, 0], [1.8, 0.2, 0], [1.8, 1.8, 0], [0.2, 1.8, 0]], 0, 0, 0, (x, y) => {
      const t = (x + y - 0.4) / 3.2;
      const step = Math.floor((x + y) * 3) % 2;
      return G.dither(['#08060a', '#16121a', '#2a2430', '#3c3644'], t * (step ? 0.9 : 0.7), Math.floor(x * 16), Math.floor(y * 16));
    });
    I.solid(0.05, 0.05, 1.95, 0.3, 0, 10, bt);
    I.solid(0.05, 0.3, 0.3, 1.95, 0, 10, bt);
    I.solid(0.0, 1.55, 0.45, 2.0, 0, 30, bt);
    I.solid(1.55, 1.55, 2.0, 2.0, 0, 30, bt);
    I.solid(-0.05, 1.5, 2.05, 2.05, 30, 37, bt);
    // crâne sculpté et runes
    const r = I.P(1, 2.05, 33);
    pb.rect(r[0] - 2, r[1] - 3, 5, 4, '#d8d0bc'); pb.set(r[0] - 1, r[1] - 2, K); pb.set(r[0] + 1, r[1] - 2, K); pb.rect(r[0] - 1, r[1] + 1, 3, 1, '#b8b0a0');
    for (const rx of [0.22, 1.78]) { const q = I.P(rx, 2.02, 8); pb.rect(q[0], q[1] - 6, 1, 4, emit('#b07aff')); }
    for (const tx of [0.22, 1.78]) {
      const p = I.P(tx, 2.03, 20);
      pb.rect(p[0] - 1, p[1] + 2, 3, 1, '#4a4a52');
      pb.rect(p[0], p[1], 1, 4, '#5a3a20');
    }
    return sprite(pb, ox, oy, {
      lights: [{ x: 0.22, y: 2.1, z: 24, color: 'fire' }, { x: 1.78, y: 2.1, z: 24, color: 'fire' }, { x: 1, y: 1, z: 2, color: 'magic' }],
      flames: [{ x: 0.22, y: 2.05, z: 25 }, { x: 1.78, y: 2.05, z: 25 }],
    }, 2, 2, 37);
  };

  B.lantern = () => {
    const pb = new PB(16, 32);
    pb.rect(7, 6, 2, 26, '#4a3020');
    pb.rect(7, 6, 1, 26, '#6a4a30');
    pb.rect(7, 5, 6, 2, '#4a3020');
    pb.rect(11, 7, 1, 2, '#2a1a10');
    lanternAt(pb, 11, 9);
    pb.rect(5, 29, 6, 3, '#5a5660');
    pb.rect(5, 29, 6, 1, '#7a7680');
    return sprite(pb, 8, 31, { lights: [{ x: 0.12, y: 0.12, z: 19, color: 'lamp' }] });
  };

  B.farm = () => {
    const pb = new PB(18, 32);
    pb.rect(8, 9, 2, 23, '#5a3a20');
    pb.rect(2, 13, 14, 2, '#5a3a20');
    pb.rect(5, 13, 8, 9, '#7a4a8a');
    pb.rect(5, 13, 8, 1, '#9a6aaa');
    pb.rect(7, 16, 4, 3, '#c89a40'); // pièce rapiécée
    pb.rect(4, 12, 10, 1, '#5a2e6a');
    pb.set(2, 15, '#d8b860'); pb.set(15, 15, '#d8b860'); pb.set(1, 16, '#d8b860'); pb.set(16, 16, '#d8b860');
    pb.ellipse(9, 8, 3.5, 3.5, '#d8b860');
    pb.rect(3, 4, 12, 2, '#a8823a');
    pb.rect(5, 0, 8, 4, '#a8823a');
    pb.rect(5, 3, 8, 1, '#7a5a20');
    pb.set(8, 8, K); pb.set(10, 8, K); pb.rect(8, 10, 3, 1, '#7a5a20');
    return sprite(pb, 9, 31);
  };

  B.pen = () => null;

  A.buildings = {};
  A.buildingSprite = function (type) {
    if (!(type in A.buildings)) A.buildings[type] = B[type] ? B[type]() : null;
    return A.buildings[type];
  };

  // ======================= DONJON : MURS =======================
  const TIERS = [
    { wall: ['#4a4550', '#544e5a', '#5e5864', '#423e48'], mortar: '#24202a', top: ['#2a2630', '#34303a', '#3e3a44'], banner: ['#8a2a2a', '#c8a040'],
      floor: { pal: ['#3c383e', '#464148', '#504a52', '#5a545c'], mortar: '#1c181e', moss: null } },
    { wall: ['#54483c', '#5e5244', '#685a4a', '#4a4036'], mortar: '#2a221c', top: ['#2e2620', '#382e26', '#42362c'], banner: ['#2a5a2a', '#c8a040'], moss: '#4a6a34',
      floor: { pal: ['#3e362c', '#4a4034', '#564a3c', '#605444'], mortar: '#1e1812', moss: ['#5a7a3a', '#3e5a2a'] } },
    { wall: ['#463e58', '#504662', '#5a506e', '#3e3650'], mortar: '#221c2e', top: ['#26202e', '#302838', '#3a3244'], banner: ['#4a2a6a', '#c8a040'],
      floor: { pal: ['#36303e', '#403848', '#4a4254', '#544c5e'], mortar: '#18141e', moss: ['#5a8aa0', '#3a5a70'] } },
  ];
  A.TIERS = TIERS;
  function wallBlock(tier, variant, low) {
    const td = TIERS[tier];
    const m = 1, h = low ? 7 : 28;
    const pb = new PB(32 + 2 * m, 16 + h + 2 * m);
    const ox = 16 + m, oy = h + m;
    const I = isoDraw(pb, ox, oy);
    const tex = T.bricks(td.wall, td.mortar, 8, 5, { cracks: variant === 'cracked' || tier > 0, moss: td.moss });
    I.box(0, 0, 1, 1, 0, h, {
      left: tex,
      right: shaded(tex, 0.7),
      top: (x, y) => {
        const px = Math.floor(x * 16), py = Math.floor(y * 16);
        if (x < 0.06 || y < 0.06 || x > 0.94 || y > 0.94) return td.top[2];
        return G.hash2(px >> 2, py >> 2, 2) > 0.85 ? td.wall[3] : G.dither(td.top, G.hash2(px, py, 2), px, py);
      },
    });
    const out = { ox, oy };
    // Décor sur la face gauche (L, tournée vers +y) ou droite (R, tournée vers +x)
    const face = variant && variant.slice(-1);
    const kind = variant && variant.slice(0, -1);
    const P = (a, z) => (face === 'L' ? I.P(a, 1, z) : I.P(1, a, z));
    const poly = (pts, fn) => (face === 'L' ? I.polyY(1, pts, fn) : I.polyX(1, pts, fn));
    if (kind === 'banner') {
      const [cb, ca] = td.banner;
      poly([[0.3, 6], [0.7, 6], [0.7, 25], [0.5, 21], [0.3, 25]], (a, z) => {
        if (z > 23) return '#4a3020';
        if (Math.abs(a - 0.5) * 16 < 1.4 && z > 12 && z < 18) return ca;
        if (Math.abs(a - 0.3) * 16 < 0.8 || Math.abs(a - 0.7) * 16 < 0.8) return ca;
        return z < 10 ? sh(cb, 0.8) : cb;
      });
    } else if (kind === 'door') {
      poly([[0.22, 0], [0.78, 0], [0.78, 17], [0.5, 21], [0.22, 17]], (a, z) => {
        const ax = (a - 0.22) * 16;
        if (ax < 1 || ax > 8 || z > 18.5) return td.mortar;
        if (Math.abs(z - 4) < 0.8 || Math.abs(z - 13) < 0.8) return '#5a5a64';
        if (Math.floor(ax) % 3 === 0) return '#3e2816';
        if (Math.abs(ax - 6.5) < 0.8 && Math.abs(z - 9) < 1.2) return '#c8a040';
        return '#5e3e22';
      });
    } else if (kind === 'weapons') {
      const c = P(0.5, 15);
      const t = face === 'L' ? 3 : -3;
      pb.line(c[0] - 6, c[1] - 6 + t, c[0] + 6, c[1] + 6 + t, '#c8ccd4');
      pb.line(c[0] - 6, c[1] + 6 + t, c[0] + 6, c[1] - 6 + t, '#c8ccd4');
      pb.ellipse(c[0], c[1], 4.5, 5.5, (x, y, dx, dy) => (Math.hypot(dx, dy) > 0.8 ? '#8a8f99' : Math.abs(dx) < 0.18 || Math.abs(dy) < 0.15 ? '#c8a040' : td.banner[0]));
    } else if (kind === 'chains') {
      for (const a of [0.3, 0.7]) for (let z = 27; z > 12; z -= 2) { const p = P(a, z); pb.set(p[0], p[1], '#6a6a74'); pb.set(p[0], p[1] + 1, '#3a3a44'); }
      const p = P(0.5, 13); pb.rect(p[0] - 5, p[1], 11, 2, '#6a6a74');
    } else if (kind === 'torch') {
      const p = P(0.5, 14);
      pb.rect(p[0] - 2, p[1] + 3, 5, 2, '#3a3a44');
      pb.rect(p[0], p[1], 1, 4, '#5a3a20');
      pb.rect(p[0] - 1, p[1] - 1, 3, 2, '#2a1a10');
      out.flame = face === 'L' ? { x: 0.5, y: 1.05, z: 17 } : { x: 1.05, y: 0.5, z: 17 };
    }
    out.c = pb.canvas();
    out.emis = null;
    return out;
  }

  // ======================= VÉGÉTATION =======================
  const PINES = [['#5c9a4c', '#43803e', '#2f6634', '#214a28', '#183820'], ['#5a9a7a', '#3f7e62', '#2c624c', '#1f4a3a', '#16382c']];
  function pine(seed, tall, pal) {
    const r = G.seeded(seed);
    const W = 32, H = tall ? 60 : 50;
    const pb = new PB(W, H);
    const cx = W / 2;
    // tronc avec racines
    pb.rect(cx - 2, H - 10, 4, 9, '#5a3a22');
    pb.rect(cx + 1, H - 10, 1, 9, '#3e2716');
    pb.rect(cx - 2, H - 10, 1, 9, '#7a5232');
    pb.rect(cx - 4, H - 3, 2, 1, '#5a3a22'); pb.rect(cx + 2, H - 3, 3, 1, '#4a2e1a');
    const n = tall ? 5 : 4;
    for (let i = n - 1; i >= 0; i--) {
      const top = 2 + i * ((H - 16) / n) * 0.82;
      const bottom = top + (H - 14) / n + 6 + i * 1.4;
      const hw = 5 + i * (tall ? 2.6 : 3.1) + r() * 1.5;
      pb.poly([[cx, top], [cx + hw, bottom], [cx - hw, bottom]], (px, py) => {
        const jag = (px + i * 2) % 4 < 2 ? 0 : 1.6;
        if (py > bottom - jag) return null;
        const rel = (py - top) / (bottom - top);
        let t = 0.18 + ((px - cx) / hw) * 0.38 + rel * 0.3 + (G.hash2(px >> 1, py, seed) - 0.5) * 0.3;
        if (rel > 0.82) t += 0.25; // dessous de chaque étage plus sombre
        if (px < cx && rel < 0.5 && G.hash2(px, py, seed + 3) > 0.8) t -= 0.3; // reflets
        return G.dither(pal, t, px, py);
      });
    }
    pb.outline(K);
    return { c: pb.canvas(), ox: cx, oy: H - 2, h: H };
  }
  const LEAVES = {
    red: ['#f2946a', '#d85a34', '#b23e26', '#82281e', '#541a18'],
    orange: ['#f8c868', '#e8963a', '#c46a24', '#8e4618', '#5a2c14'],
    yellow: ['#f8e888', '#e2c04a', '#c09a30', '#8a6a22', '#5a4418'],
    green: ['#8ec862', '#62a046', '#467e38', '#30602c', '#1f4222'],
    oak: ['#7ab656', '#5a9440', '#407434', '#2c5628', '#1c3a1c'],
  };
  function roundTree(seed, kind, big) {
    const r = G.seeded(seed);
    const W = big ? 46 : 36, H = big ? 56 : 48, cx = W / 2, cy = big ? 20 : 17;
    const pb = new PB(W, H);
    const trunkC = kind === 'birch' ? '#e4e0d4' : '#5a3a22';
    const tw = big ? 6 : 5;
    pb.rect(cx - tw / 2, 24, tw, H - 26, trunkC);
    pb.rect(cx + tw / 2 - 2, 24, 2, H - 26, kind === 'birch' ? '#a8a49a' : '#3e2716');
    pb.rect(cx - tw / 2, 24, 1, H - 26, kind === 'birch' ? '#ffffff' : '#7a5232');
    if (kind === 'birch') for (let y = 26; y < H - 3; y += 3) pb.rect(cx - tw / 2 + Math.floor(G.hash2(y, 1, seed) * 3), y, 2, 1, K);
    // branches visibles et racines
    pb.line(cx, 30, cx - 7, 23, trunkC); pb.line(cx + 1, 29, cx + 7, 22, trunkC);
    pb.rect(cx - tw / 2 - 2, H - 3, 2, 1, trunkC); pb.rect(cx + tw / 2, H - 3, 3, 1, sh(trunkC, 0.7));
    const pal = LEAVES[kind === 'birch' ? 'yellow' : kind];
    const S = big ? 1.3 : 1;
    const blobs = [[0, 0, 12], [-8, 4, 8], [8, 4, 8], [-5, -6, 8], [5, -6, 8], [0, 7, 9], [-10, -1, 6], [10, -1, 6]];
    for (const b of blobs) {
      const bx = cx + b[0] * S + (r() - 0.5) * 2, by = cy + b[1] * S + (r() - 0.5) * 2, br = b[2] * S;
      pb.ellipse(bx, by, br, br * 0.9, (x, y, dx, dy) => {
        const cl = G.hash2(Math.floor(x / 3), Math.floor(y / 3), seed); // grappes de feuilles
        let t = 0.28 + ((x - cx) + (y - cy)) / (34 * S) + (dx + dy) * 0.14 + (cl - 0.5) * 0.42;
        if (y > cy + 6 * S) t += 0.18;
        return G.dither(pal, t, x, y);
      });
    }
    for (let i = 0; i < 14; i++) { const x = Math.floor(cx - 10 * S + r() * 12 * S), y = Math.floor(cy - 10 * S + r() * 10 * S); if (pb.get(x, y)) pb.set(x, y, pal[0]); }
    pb.outline(K);
    return { c: pb.canvas(), ox: cx, oy: H - 2, h: H };
  }
  function boulder(seed) {
    const pb = new PB(22, 17);
    const pal = ['#44444e', '#58586a', '#70707c', '#8a8a98', '#a8a8b6'];
    pb.ellipse(11, 9, 9, 6.5, (x, y, dx, dy) => G.dither(pal, 0.75 - (dx + dy) * 0.38 + G.hash2(x, y, seed) * 0.15, x, y));
    pb.ellipse(6, 12, 4, 3, (x, y, dx, dy) => G.dither(pal, 0.7 - (dx + dy) * 0.3, x, y));
    for (let i = 0; i < 9; i++) pb.set(5 + i * 1.5, 4 + (i % 2) + (i > 5 ? 1 : 0), i % 2 ? '#4f7e38' : '#6a9a48');
    pb.line(12, 7, 15, 11, '#44444e');
    pb.outline(K);
    return { c: pb.canvas(), ox: 11, oy: 15 };
  }
  function stump() {
    const pb = new PB(14, 9);
    pb.rect(3, 3, 8, 5, '#5a3a22');
    pb.rect(9, 3, 2, 5, '#3e2716');
    pb.rect(1, 7, 3, 1, '#5a3a22'); pb.rect(10, 7, 3, 1, '#4a2e1a');
    pb.ellipse(7, 3, 4, 2, (x, y, dx, dy) => { const d = Math.hypot(dx, dy); return d < 0.35 ? '#a8763c' : d < 0.7 ? '#c89a5e' : '#b8884e'; });
    pb.set(4, 5, '#5a8a3e'); pb.set(5, 6, '#5a8a3e');
    pb.outline(K);
    return { c: pb.canvas(), ox: 7, oy: 8 };
  }
  function bush(seed, berries) {
    const pb = new PB(20, 13);
    const pal = LEAVES.green;
    pb.ellipse(10, 8, 9, 5.5, (x, y, dx, dy) => G.dither(pal, 0.32 + (dx + dy) * 0.3 + (G.hash2(x >> 1, y >> 1, seed) - 0.5) * 0.4, x, y));
    if (berries) for (const p of [[6, 5], [12, 7], [9, 4], [14, 9], [5, 9]]) { pb.set(p[0], p[1], '#e04848'); pb.set(p[0] - 1, p[1] - 1, '#ff9090'); }
    pb.outline(K);
    return { c: pb.canvas(), ox: 10, oy: 12 };
  }
  function fern(seed) {
    const pb = new PB(18, 12);
    const r = G.seeded(seed);
    for (let i = 0; i < 6; i++) {
      const a = Math.PI * (0.15 + (i / 5) * 0.7) + (r() - 0.5) * 0.2;
      const len = 6 + r() * 3;
      for (let t = 0; t < len; t++) {
        const x = 9 - Math.cos(a) * t, y = 11 - Math.sin(a) * t * 0.9 + (t * t) / 18;
        pb.set(x, y, t < 2 ? '#2e5a28' : '#4e8a3a');
        if (t % 2 && t > 1) { pb.set(x, y - 1, '#6aa848'); pb.set(x + (Math.cos(a) > 0 ? -1 : 1), y, '#3e7030'); }
      }
    }
    pb.outline(K);
    return { c: pb.canvas(), ox: 9, oy: 11 };
  }
  function mushrooms(red) {
    const pb = new PB(12, 9);
    const cap = red ? ['#d83c3c', '#f06060', '#a02828'] : ['#a07a4a', '#c89a64', '#7a5a34'];
    for (const m of [[3, 5, 2.6], [8, 6, 2]]) {
      pb.rect(m[0], m[1], 1, 9 - m[1] - 1, '#ece4d0');
      pb.ellipse(m[0] + 0.5, m[1], m[2], m[2] * 0.75, (x, y, dx, dy) => (dy > 0.3 ? cap[2] : dx < -0.2 && dy < -0.2 ? cap[1] : cap[0]));
      if (red) { pb.set(m[0] - 1, m[1] - 1, '#ffffff'); pb.set(m[0] + 1, m[1], '#ffffff'); }
    }
    pb.outline(K);
    return { c: pb.canvas(), ox: 6, oy: 8 };
  }
  function tallGrass(seed) {
    const pb = new PB(14, 12);
    const r = G.seeded(seed);
    const cols = ['#3e7030', '#5a9040', '#7ab056', '#a0c870'];
    for (let i = 0; i < 9; i++) {
      const x0 = 2 + r() * 10, lean = (r() - 0.5) * 4, len = 5 + r() * 6;
      for (let t = 0; t < len; t++) pb.set(x0 + (lean * t) / len, 11 - t, cols[Math.min(3, Math.floor((t / len) * 4))]);
    }
    if (seed % 2) { pb.set(4, 3, '#f0d060'); pb.set(10, 2, '#f0d060'); }
    return { c: pb.canvas(), ox: 7, oy: 11 };
  }
  function fallenLog() {
    const pb = new PB(26, 12);
    pb.poly([[2, 6], [20, -3], [24, 1], [6, 10]], (x, y) => (y < 3 + (20 - x) / 2.2 ? '#7a5232' : '#5a3a22'));
    pb.ellipse(4, 8, 3, 2.5, (x, y, dx, dy) => (Math.hypot(dx, dy) < 0.45 ? '#a8763c' : '#c89a5e'));
    for (let i = 0; i < 6; i++) pb.set(9 + i * 2, 3 - i * 0.9 + 2, '#5a8a3e');
    pb.outline(K);
    return { c: pb.canvas(), ox: 13, oy: 9 };
  }

  // ======================= PROPS =======================
  const PROPS = {
    barrel: { rows: ['.kkkkkk.', 'kwBBBBbk', 'kMmmmmMk', 'kwBbBBbk', 'kBBbBBbk', 'kwBbBBbk', 'kMmmmmMk', 'kBBBBBbk', '.kkkkkk.'], pal: { k: K, B: '#8a5a32', b: '#6a4426', w: '#a87444', M: '#6a6a72', m: '#4a4a52' }, oy: 8 },
    anvil: { rows: ['kkkkkkkkkkk.', 'kWMMMMMMMMMk', '.kmmmmmmmmk.', '...kMMMMk...', '...kmmmmk...', '..kMMMMMMk..', '.kBBBBBBBBk.', '.kbbbbbbbbk.', '..kkkkkkkk..'], pal: { k: K, M: '#6a6e78', m: '#4a4e58', W: '#a8acb8', B: '#6a4426', b: '#4a2e1a' }, oy: 8 },
    pumpkin: { rows: ['...kk...', '..kGk...', '.kkOkkk.', 'kOwOOoOk', 'kOoOOoOk', 'koOooOok', '.kkkkkk.'], pal: { k: K, G: '#4a7a30', O: '#f08a2a', o: '#c0601a', w: '#ffb060' }, oy: 6 },
    cabbage: { rows: ['..kkkk..', '.kGgGGk.', 'kGgLLgGk', 'kgLwLLgk', 'kGgLLgGk', '.kkkkkk.'], pal: { k: K, G: '#3e7a34', g: '#2c5e28', L: '#8ac860', w: '#c0f090' }, oy: 5 },
    sprout: { rows: ['.k.k.', 'kGkGk', '.kGk.', '..k..'], pal: { k: K, G: '#6aa848' }, oy: 3 },
    wheat: { rows: ['.Y.Y..Y', 'kYkYkkY', '.Y.YY.Y', '.G.G.G.', '.G.G.G.', '.G.GG.G', 'kGkGkkG'], pal: { k: '#7a5a20', Y: '#e8c050', G: '#a89040' }, oy: 6 },
    carrot: { rows: ['G.G.G', '.GGG.', '..G..', '.kOk.'], pal: { k: K, G: '#5aa040', O: '#f08a2a' }, oy: 3 },
    torch: { rows: ['.kYk.', 'kYWYk', 'kOYOk', '.kOk.', '.kBk.', '.kBk.', '.kBk.', '..k..'], pal: { k: K, Y: '#ffc040', W: '#fff0b0', O: '#f07020', B: '#5a3a20' }, oy: 7 },
    bones: { rows: ['k..kk...k', 'Wk.kWk.kW', '.WWWkWWW.', 'k.kWWk..k', '..kk.kk..'], pal: { k: '#3a3440', W: '#d8d0bc' }, oy: 4 },
    hay: { rows: ['..kkkkkkkk..', '.kYYyYYyYYk.', 'kYyYYYyYYyYk', 'kYYYyYYYyYYk', 'kRRRRRRRRRRk', 'kyYYyYYyYYyk', '.kyyyyyyyyk.', '..kkkkkkkk..'], pal: { k: '#5a4418', Y: '#e8c860', y: '#c8a040', R: '#8a3a2a' }, oy: 7 },
    basket: { rows: ['.kRRkRk.', 'kRwRRwRk', 'kkkkkkkk', 'kBbBbBbk', 'kbBbBbBk', '.kkkkkk.'], pal: { k: '#4a3018', R: '#d84030', w: '#ff9080', B: '#b08040', b: '#8a6030' }, oy: 5 },
    sack: { rows: ['..kk..', '.kSSk.', 'kSsSSk', 'kSSSsk', 'kSsSSk', '.kkkk.'], pal: { k: '#4a3a24', S: '#c8b48a', s: '#a8946a' }, oy: 5 },
    bucket: { rows: ['.kkkk.', 'kwWWWk', 'kMMMMk', 'kWWWWk', '.kkkk.'], pal: { k: K, W: '#8a5a32', w: '#5a8ac0', M: '#6a6a72' }, oy: 4 },
    flowers: { rows: ['.R..Y..W.', 'RrR.YyWwW', '.R.kYkkWk', '.G..G..G.', 'kGk.Gk.G.'], pal: { k: '#2e5a28', R: '#e05050', r: '#ffe080', Y: '#f0d060', y: '#c87a2a', W: '#f0e8f8', w: '#f0d060', G: '#4a8a3a' }, oy: 4 },
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
    const edge = (f) => (a, z) => (a < 0.06 || a > 0.44 || z < 1 || z > 8 ? '#5a3a20' : f(a, z));
    I.box(-0.25, -0.25, 0.25, 0.25, 0, 9, { left: edge(wood), right: shaded(edge(wood), 0.72), top: (x, y) => (x < 0.05 || y < 0.05 || x > 0.45 || y > 0.45 ? '#6a4426' : (x * 16) % 8 < 1 ? '#7a5432' : '#a87a4a') });
    pb.outline(K);
    return { c: pb.canvas(), ox: 10, oy: 11 };
  }
  function chest(open) {
    const pb = new PB(26, 24);
    const I = isoDraw(pb, 13, 15);
    const wood = T.planks('#8a5a2a');
    const iron = (f) => (a, z) => (Math.abs(a - 0.1) < 0.04 || Math.abs(a - 0.5) < 0.04 || z < 1 ? '#4a4a54' : (z > 2.5 && z < 4 ? '#c8a040' : f(a, z)));
    I.box(-0.3, -0.2, 0.3, 0.2, 0, 7, { left: iron(wood), right: shaded(iron(wood), 0.72), top: () => (open ? '#1a120c' : '#a06a34') });
    if (!open) {
      I.box(-0.3, -0.2, 0.3, 0.2, 7, 10, { left: iron(wood), right: shaded(iron(wood), 0.72), top: (x) => (Math.abs(x - 0.1) < 0.05 || Math.abs(x - 0.5) < 0.05 ? '#5a5a64' : '#b07a40') });
    } else {
      I.polyY(-0.2, [[-0.3, 7], [0.3, 7], [0.3, 16], [-0.3, 16]], (x) => (Math.abs(x) < 0.04 ? '#4a4a54' : '#7a4a20'));
      for (let i = 0; i < 6; i++) pb.set(10 + i * 1.5, 7 - (i % 2), emit('#ffe070'));
    }
    const lk = I.P(0, 0.2, 5);
    pb.rect(lk[0] - 1, lk[1] - 1, 3, 3, '#ffd040');
    pb.set(lk[0], lk[1], K);
    pb.outline(K);
    return { c: pb.canvas(), ox: 13, oy: 15, emis: open ? emissiveOf(pb) : null };
  }
  function stairsDown() {
    const pb = new PB(36, 24);
    const I = isoDraw(pb, 18, 3);
    I.slope([[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]], 0, 0, 0, (x, y) => {
      if (x < 0.08 || y < 0.08 || x > 0.92 || y > 0.92) return '#6a6470';
      const s = Math.floor((x + y) * 4);
      return G.dither(['#060408', '#18141c', '#2c2632', '#44404a'], 0.85 - s * 0.12, Math.floor(x * 16), Math.floor(y * 16));
    });
    for (let i = 0; i < 4; i++) {
      const a = I.P(0.08, 0.1 + 0.22 * i, 0), b = I.P(0.92, 0.1 + 0.22 * i, 0);
      pb.line(a[0] - i * 3 + 3, a[1] + 2 + i * 2, b[0] - i * 3, b[1] + 2 + i * 2, '#5a5464');
    }
    pb.outline(K);
    return { c: pb.canvas(), ox: 18, oy: 11 };
  }
  function portal(f) {
    const pb = new PB(30, 20);
    pb.ellipse(15, 12, 13, 6.5, (x, y, dx, dy) => {
      const d = Math.hypot(dx, dy);
      const a = Math.atan2(dy, dx) + f * 0.9;
      if (d > 0.78) return emit(Math.sin(a * 3) > 0 ? '#b07aff' : '#7040d0');
      return emit(G.dither(['#1a1040', '#3a2a90', '#6a5ae0', '#b0a0ff'], 1 - d + Math.sin(a * 2 + d * 6) * 0.15, x, y));
    });
    pb.outline('#20103a');
    const c = pb.canvas();
    return { c, ox: 15, oy: 13, emis: c };
  }
  function pool(frame) {
    const pb = new PB(48, 26);
    const I = isoDraw(pb, 24, 2);
    I.slope([[0, 0, 0], [1.4, 0, 0], [1.4, 1.4, 0], [0, 1.4, 0]], 0, 0, 0, (x, y) => {
      const ex = Math.min(x, 1.4 - x, y, 1.4 - y);
      const px = Math.floor(x * 16), py = Math.floor(y * 16);
      if (ex < 0.12) return G.dither(['#3a3640', '#4a4650', '#5a5660', '#6a6670'], G.hash2(px >> 1, py >> 1, 4) + (ex < 0.05 ? 0.2 : 0), px, py);
      const n = G.hash2(px, py, 6);
      const w = Math.sin((x * 3 + y * 2) * 6 + frame * 2.1);
      if (n > 0.9 && w > 0.5) return '#9ad8ff';
      if (ex < 0.17) return '#16304a';
      return G.dither(['#163e6a', '#1e5490', '#2a6aa8', '#3a80c0'], 0.35 + ex * 0.8 + w * 0.12 + (n - 0.5) * 0.2, px, py);
    });
    return { c: pb.canvas(), ox: 24, oy: 13 };
  }
  function fenceSeg(axis) {
    const pb = new PB(20, 22);
    const I = isoDraw(pb, axis === 'x' ? 2 : 18, 12);
    const a = [0, 0], b = axis === 'x' ? [1, 0] : [0, 1];
    for (const z of [3, 7]) {
      const p0 = I.P(a[0], a[1], z), p1 = I.P(b[0], b[1], z);
      pb.line(p0[0], p0[1] - 1, p1[0], p1[1] - 1, '#a87a48');
      pb.line(p0[0], p0[1], p1[0], p1[1], '#8a6038');
      pb.line(p0[0], p0[1] + 1, p1[0], p1[1] + 1, '#5e3e22');
    }
    for (const p of [a, b]) {
      const q = I.P(p[0], p[1], 0);
      pb.rect(q[0] - 1, q[1] - 10, 2, 11, '#6e4a2a');
      pb.rect(q[0] - 1, q[1] - 10, 1, 11, '#8a6038');
      pb.set(q[0] - 1, q[1] - 11, '#9a7044');
    }
    pb.outline(K);
    return { c: pb.canvas(), ox: axis === 'x' ? 2 : 18, oy: 12 };
  }
  function trough() {
    const pb = new PB(26, 16);
    const I = isoDraw(pb, 13, 6);
    const wood = T.planks('#7a5432');
    I.box(-0.4, -0.15, 0.4, 0.15, 0, 6, { left: wood, right: shaded(wood, 0.72), top: (x, y) => (x < 0.06 || y < 0.05 || x > 0.74 || y > 0.25 ? '#8a6038' : '#3a6a9a') });
    pb.outline(K);
    return { c: pb.canvas(), ox: 13, oy: 6 };
  }
  function sawhorse() {
    const pb = new PB(26, 18);
    pb.line(5, 16, 9, 6, '#6a4426'); pb.line(9, 16, 5, 6, '#6a4426');
    pb.line(17, 16, 21, 6, '#6a4426'); pb.line(21, 16, 17, 6, '#6a4426');
    pb.rect(3, 6, 20, 3, '#9a6a3a'); pb.rect(3, 6, 20, 1, '#c89a5e');
    pb.ellipse(23, 7.5, 1.5, 1.5, '#c89a5e');
    pb.rect(12, 2, 7, 2, '#c8ccd4'); pb.rect(18, 1, 3, 3, '#6a4426');
    pb.outline(K);
    return { c: pb.canvas(), ox: 13, oy: 16 };
  }
  function minecart() {
    const pb = new PB(20, 16);
    const I = isoDraw(pb, 10, 8);
    const iron = (a, z) => (z > 6 || z < 1 ? '#3a3a44' : Math.floor(a * 16) % 5 === 0 ? '#4a4a54' : '#6a6a74');
    I.box(-0.3, -0.2, 0.3, 0.2, 2, 9, { left: iron, right: shaded(iron, 0.75), top: () => '#2a2420' });
    for (let i = 0; i < 6; i++) pb.set(6 + i * 1.5, 3 + (i % 2), i % 2 ? '#8a8a98' : '#c8d0dc');
    pb.ellipse(5, 13, 2, 2, '#2a2a30'); pb.ellipse(13, 13, 2, 2, '#2a2a30');
    pb.outline(K);
    return { c: pb.canvas(), ox: 10, oy: 13 };
  }
  function bench() {
    const pb = new PB(26, 14);
    const I = isoDraw(pb, 13, 6);
    const wood = T.planks('#8a6038');
    I.box(-0.45, -0.1, 0.45, 0.1, 4, 6, { left: wood, right: shaded(wood, 0.72), top: () => '#a87a48' });
    for (const x of [-0.4, 0.35]) I.box(x, -0.08, x + 0.08, 0.08, 0, 4, { left: () => '#5a3a20', right: () => '#3e2716' });
    pb.outline(K);
    return { c: pb.canvas(), ox: 13, oy: 6 };
  }
  function woodpile() {
    const pb = new PB(24, 16);
    for (let row = 0; row < 3; row++)
      for (let i = 0; i < 4 - row; i++) {
        const x = 5 + i * 5 + row * 2.5, y = 12 - row * 4;
        pb.ellipse(x, y, 2.6, 2.6, (px, py, dx, dy) => { const d = Math.hypot(dx, dy); return d < 0.35 ? '#a8763c' : d < 0.75 ? '#d8aa6e' : '#7a5232'; });
      }
    pb.outline(K);
    return { c: pb.canvas(), ox: 12, oy: 14 };
  }
  function coalPile() {
    const pb = new PB(16, 9);
    const hot = ['#ff9a2a', '#ffd060', '#c0441a'].map(emit);
    pb.ellipse(8, 5, 7, 3.5, (x, y) => { const n = G.hash2(x, y, 3); return n > 0.82 ? hot[0] : n > 0.76 ? hot[1] : n > 0.7 ? hot[2] : n > 0.4 ? '#2a2428' : '#1a1418'; });
    pb.outline(K);
    return { c: pb.canvas(), ox: 8, oy: 7, emis: emissiveOf(pb) };
  }
  function grindstone() {
    const pb = new PB(16, 18);
    pb.rect(3, 10, 2, 8, '#5a3a20'); pb.rect(11, 10, 2, 8, '#5a3a20');
    pb.ellipse(8, 9, 5, 5, (x, y, dx, dy) => (Math.hypot(dx, dy) < 0.25 ? '#4a4a54' : dx + dy < -0.3 ? '#b0b0bc' : '#8a8a96'));
    pb.rect(2, 9, 12, 1, '#6a4426');
    pb.outline(K);
    return { c: pb.canvas(), ox: 8, oy: 17 };
  }
  function weaponRack() {
    const pb = new PB(22, 26);
    pb.rect(2, 4, 2, 22, '#5a3a20'); pb.rect(18, 4, 2, 22, '#5a3a20');
    pb.rect(1, 6, 20, 2, '#7a5232'); pb.rect(1, 18, 20, 2, '#7a5232');
    pb.rect(1, 6, 20, 1, '#9a7044');
    pb.outline(K);
    const c = pb.canvas();
    const x = c.getContext('2d');
    const ws = [A.weapon('sword', '#d0d6e0', '#c0a040'), A.weapon('axe', '#b0b6c0', '#8a6a3a'), A.weapon('staff', '#8a5a32', '#60d0a0')];
    ws.forEach((w, i) => x.drawImage(w.c, 5 + i * 5, 5));
    return { c, ox: 11, oy: 25 };
  }
  function workbench() {
    const pb = new PB(36, 26);
    const I = isoDraw(pb, 18, 12);
    const wood = T.planks('#7a5432');
    for (const p of [[-0.55, -0.2], [0.45, -0.2], [-0.55, 0.15], [0.45, 0.15]]) I.box(p[0], p[1], p[0] + 0.08, p[1] + 0.06, 0, 8, { left: () => '#4a2e1a', right: () => '#3a2416' });
    I.box(-0.6, -0.25, 0.6, 0.25, 8, 10, { left: wood, right: shaded(wood, 0.72), top: (x) => (Math.floor(x * 16) % 5 === 0 ? '#6a4426' : '#a07448') });
    const t = I.P(-0.1, 0, 11);
    pb.rect(t[0] - 6, t[1] - 1, 5, 1, '#8a8f99'); pb.rect(t[0] - 2, t[1] - 2, 2, 3, '#6a4426');
    pb.rect(t[0] + 3, t[1], 3, 2, '#c8a040');
    pb.line(t[0] + 7, t[1] - 3, t[0] + 10, t[1] + 1, '#8a8f99');
    pb.outline(K);
    return { c: pb.canvas(), ox: 18, oy: 12 };
  }
  function brazier() {
    const pb = new PB(14, 14);
    pb.line(3, 13, 5, 7, '#3a3a44'); pb.line(10, 13, 8, 7, '#3a3a44'); pb.line(7, 13, 7, 8, '#3a3a44');
    pb.ellipse(7, 6, 6, 2.5, (x, y, dx, dy) => (dy < -0.2 ? emit('#ff9a2a') : '#5a5a64'));
    pb.rect(2, 7, 11, 1, '#6a6a74');
    pb.outline(K);
    return { c: pb.canvas(), ox: 7, oy: 13 };
  }
  function flameFrames() {
    const out = [];
    const cols = ['#c0441a', '#ff8a2a', '#ffc040', '#fff0b0'];
    for (let f = 0; f < 4; f++) {
      const pb = new PB(7, 10);
      const r = G.seeded(f * 7 + 1);
      for (let y = 0; y < 10; y++)
        for (let x = 0; x < 7; x++) {
          const dx = (x + 0.5 - 3.5) / (3.2 * (y / 10) + 0.4), dy = y / 10;
          const wob = Math.sin(y * 1.3 + f * 1.6) * 0.35;
          const v = 1 - Math.abs(dx + wob) - (1 - dy) * 0.35 + (r() - 0.5) * 0.2;
          if (v > 0.15) pb.set(x, y, cols[Math.min(3, Math.floor(v * 3.2))]);
        }
      out.push({ c: pb.canvas(), ox: 3, oy: 9 });
    }
    return out;
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
  const ROBE = {
    s: ['..kTTTTTTk..', '..kTTtTTTk..', '.kTTTtTTTTk.', '.kTTTtTTTTk.', 'kTTTTtTTTTTk', 'kkBBkkkkBBkk'],
    a: ['..kTTTTTTk..', '..kTTtTTTk..', '.kTTTtTTTTk.', 'kTTTTtTTTTk.', 'kTTTTtTTTTk.', 'kBBkkkkkBBk.'],
    b: ['..kTTTTTTk..', '..kTTtTTTk..', '.kTTTtTTTTk.', '.kTTTTtTTTTk', '.kTTTTtTTTTk', '.kBBkkkkkBBk'],
  };
  const CAPE_F = ['kCC......CCk', 'kCC......CCk', 'kCCC....CCCk', '.kkk....kkk.'];
  const CAPE_B = ['...kkkkkk...', '..kCCCCCCk..', '..kCCCCCCk..', '..kCCCCCCk..', '..kCCcCCCk..', '..kCcCCcCk..', '..kkkkkkkk..'];
  const PAULDRONS = ['.kMMk..kMMk.', '.kmMk..kMmk.'];
  const RIBS = ['............', '....k..k....', '....k..k....'];
  const POUCH = ['.........kk.', '........kPPk', '........kkk.'];
  const EARS = ['............', '............', '............', '............', 'kk........kk', 'kSk......kSk', '.k........k.'];
  const BEARD = ['............', '............', '............', '............', '............', '............', '..kHHHHHHk..', '..kHHjHHHk..', '...kHHHHk...', '....kHHk....'];
  const HAIR = {
    short: { f: ['............', '....kkkk....', '...kHjHHk...', '..kHjHHHHk..', '..kHh..hHk..'], b: [] },
    spiky: {
      f: ['...k.kk.k...', '..kHkjHkHk..', '.kHjHHHHHHk.', '..kHjHHHHHk.', '..kHhHHhHk..'],
      b: ['...k.kk.k...', '..kHkjHkHk..', '.kHjHHHHHHk.', '..kHHHHHHHk.'],
    },
    long: {
      f: ['............', '....kkkk....', '...kHjHHk...', '..kHjHHHHk..', '.kHHh..hHHk.', '.kHk....kHk.', '.kHk....kHk.', '.kHHk..kHHk.', '..kHk..kHk..', '...k....k...'],
      b: ['............', '............', '............', '............', '.kHH....HHk.', '.kHjHHHHHHk.', '.kHjHHHHHHk.', '.kHHHHHHHHk.', '..kHHHHHHk..', '...kHHHHk...', '....kkkk....'],
    },
  };
  const HATS = {
    straw: { f: ['.....kk.....', '....kYYk....', '..kkYyYYkk..', 'kkYYYyYYYYkk', '.kkkkkkkkkk.'] },
    helmet: {
      f: ['....kkkk....', '...kMjMMk...', '..kMjmMMMk..', '..kMMMMMMk..', '..kMkkkkMk..', '..kMEkkEMk..', '..kMMMMMmk..', '...kkMMkk...'],
      b: ['....kkkk....', '...kMjMMk...', '..kMjMMMMk..', '..kMMMMMMk..', '..kMMMMMMk..', '..kMMMMMMk..', '..kmMMMMmk..', '...kkMMkk...'],
    },
    horned: {
      f: ['kk........kk', 'kWk.kkkk.kWk', '.kWkMjMMkWk.', '..kMMMmMMk..', '..kMkkkkMk..'],
      b: ['kk........kk', 'kWk.kkkk.kWk', '.kWkMjMMkWk.', '..kMMMmMMk..', '..kMMMMMMk..'],
    },
    hood: {
      f: ['....kkkk....', '...kCCCCk...', '..kCCCCCCk..', '.kCCCCCCCCk.', '.kCc....cCk.', '.kCk....kCk.', '.kCk....kCk.', '.kCCk..kCCk.'],
      b: ['....kkkk....', '...kCCCCk...', '..kCCCCCCk..', '.kCCCCCCCCk.', '.kCCCCCCCCk.', '.kCCCCCCCCk.', '.kCCCCCCCCk.', '.kCCCCCCCCk.', '..kCCCCCCk..'],
    },
  };

  // Volume automatique : ombre en bas/à droite, reflet en haut/à gauche, contours colorés (« selout »).
  function volume(pb) {
    const w = pb.w, h = pb.h, src = pb.d.slice();
    const empty = (x, y) => x < 0 || y < 0 || x >= w || y >= h || !src[y * w + x] || src[y * w + x] === K;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = y * w + x, c = src[i];
        if (!c) continue;
        if (c === K) {
          if (y + 1 >= h || !src[i + w]) continue; // contour du bas : reste foncé pour ancrer au sol
          const n = [[x - 1, y], [x, y - 1], [x + 1, y]].map((p) => (empty(p[0], p[1]) ? null : src[p[1] * w + p[0]])).find(Boolean);
          if (n) pb.d[i] = G.mix(K, n, 0.28);
          continue;
        }
        if (empty(x + 1, y) || empty(x, y + 1)) pb.d[i] = sh(c, 0.84);
        else if (empty(x - 1, y) && empty(x, y - 1)) pb.d[i] = sh(c, 1.18);
      }
    return pb;
  }
  A.volume = volume;

  const humCache = {};
  A.humanoid = function (key, look) {
    if (humCache[key]) return humCache[key];
    const cape = look.cape || look.shirt;
    const metal = look.metal || '#9aa0aa';
    const pal = {
      k: K, S: look.skin, s: sh(look.skin, 0.82), E: look.eye || '#20141c', H: look.hair, h: sh(look.hair, 0.75), j: sh(look.hair, 1.3),
      T: look.shirt, t: sh(look.shirt, 0.78), L: look.belt || '#3b2a1e', l: '#e0b040', P: look.pants, p: sh(look.pants, 0.8),
      B: look.boots || '#3b2a1e', C: cape, c: sh(cape, 0.75), Y: '#d9b25a', y: '#a8823a', M: metal, m: sh(metal, 0.7), W: '#ece2c8',
    };
    const pauldronPal = Object.assign({}, pal, { M: look.pauldron || metal, m: sh(look.pauldron || metal, 0.7) });
    const pouchPal = Object.assign({}, pal, { P: '#7a5232' });
    const make = (back, legs, bob) => {
      const pb = new PB(14, 20);
      const O = 1;
      if (!back && look.cape) pb.rows(CAPE_F, pal, O, O + 11 + bob);
      pb.rows((look.robe ? ROBE : LEGS)[legs], pal, O, O + 12);
      pb.rows(back ? BODY_B : BODY_F, pal, O, O + 8 + bob);
      if (look.ribs && !back) pb.rows(RIBS, { k: '#8a8474' }, O, O + 8 + bob);
      if (look.pauldrons) pb.rows(PAULDRONS, pauldronPal, O, O + 8 + bob);
      if (look.pouch && !back) pb.rows(POUCH, pouchPal, O, O + 9 + bob);
      if (back && look.cape) pb.rows(CAPE_B, pal, O, O + 8 + bob);
      pb.rows(back ? HEAD_B : HEAD_F, pal, O, O + bob);
      if (look.ears) pb.rows(EARS, pal, O, O + bob);
      const hair = HAIR[look.hairStyle];
      if (hair) pb.rows(back ? hair.b : hair.f, pal, O, O + bob);
      if (!back && look.beard) pb.rows(BEARD, pal, O, O + bob);
      const hat = HATS[look.hat];
      if (hat) pb.rows(back && hat.b ? hat.b : hat.f, pal, O, O + bob);
      return volume(pb).canvas();
    };
    // 0 debout · 1-3 marche · 4 respiration (repos)
    return (humCache[key] = {
      front: [make(false, 's', 0), make(false, 'a', 1), make(false, 's', 0), make(false, 'b', 1), make(false, 's', 1)],
      back: [make(true, 's', 0), make(true, 'a', 1), make(true, 's', 0), make(true, 'b', 1), make(true, 's', 1)],
      w: 14, h: 20,
    });
  };

  // ======================= ARMES =======================
  const WEAPON_ROWS = {
    sword: { rows: ['..k..', '.kwk.', '.kWk.', '.kwW.', '.kWk.', '.kwk.', '.kWk.', 'kGgGk', '.kBk.', '.kbk.', '..k..'], px: 2.5, py: 8.5 },
    axe: { rows: ['...k...', '.kkBkk.', 'kwWBWWk', 'kWWBWdk', '.kdBWk.', '..kBk..', '..kbk..', '..kBk..', '..kbk..', '..kBk..', '..kbk..', '...k...'], px: 3.5, py: 9 },
    hammer: { rows: ['kkkkkkk', 'kwWWWWk', 'kWWWWdk', 'kkkBkkk', '..kBk..', '..kbk..', '..kBk..', '..kbk..', '..kBk..', '..kbk..', '...k...'], px: 3.5, py: 8.5 },
    staff: { rows: ['.kkk.', 'kOwOk', 'kOOOk', '.kGk.', '.kBk.', '.kbk.', '.kBk.', '.kbk.', '.kBk.', '.kbk.', '.kBk.', '.kbk.', '..k..'], px: 2.5, py: 9 },
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
        pb.set(x + 1, y, sh(blade, 1.2));
        pb.set(x + 2, y, sh(blade, 0.75));
      }
      for (let y = 1; y < 14; y++) pb.set(1, y, '#e8e0d0');
      pb.set(4, 6, accent); pb.set(4, 7, accent); pb.set(4, 8, accent);
      pb.outline(K);
      c = pb.canvas(); px = 4; py = 7.5;
    } else {
      const d = WEAPON_ROWS[kind];
      c = G.spr(d.rows, { k: K, W: blade, w: sh(blade, 1.3), d: sh(blade, 0.72), G: accent, g: sh(accent, 0.7), B: '#6a4426', b: '#4a2e1a', O: accent });
      px = d.px; py = d.py;
    }
    return (wCache[key] = { c, px, py });
  };

  // ======================= ANIMAUX & MONSTRES =======================
  const ANIMALS = {
    sheep: {
      f: [['...kkkkk....', '..kwWWWwkkk.', '.kWWwWWWkDDk', 'kWWWWWwWkDEk', 'kWwWWWWWkDDk', 'kWWwwWWWWkk.', '.kkWWWWWWk..', '..kDk.kDk...', '..kk...kk...'],
        ['...kkkkk....', '..kwWWWwkkk.', '.kWWwWWWkDDk', 'kWWWWWwWkDEk', 'kWwWWWWWkDDk', 'kWWwwWWWWkk.', '.kkWWWWWWk..', '...kDkkDk...', '...kk.kk....']],
      pal: { k: K, W: '#ece8e0', w: '#c8c2b8', D: '#3a3340', E: '#e8e0d0' },
    },
    pig: {
      f: [['...kkkkkkk..', '..kPPPPPPPkk', '.kPPPPPPPPPk', 'kPPPPPPPPEPk', 'kPpPPPPPPPNk', 'kPPPPPPPPPNk', '.kpppppppkk.', '..kPk..kPk..', '..kk....kk..'],
        ['...kkkkkkk..', '..kPPPPPPPkk', '.kPPPPPPPPPk', 'kPPPPPPPPEPk', 'kPpPPPPPPPNk', 'kPPPPPPPPPNk', '.kpppppppkk.', '...kPkkPk...', '...kk..kk...']],
      pal: { k: K, P: '#f0a0a8', p: '#d07888', N: '#d8707f', E: K },
    },
    chicken: {
      f: [['....kRk..', '...kWWWk.', 'k..kWEWOk', 'kWkkWWWk.', 'kWWWWWWk.', '.kWWwWWk.', '..kkkkk..', '...O..O..'],
        ['.........', '....kRk..', '...kWWWk.', 'k..kWEWOk', 'kWkkWWWk.', 'kWWWwWWk.', '..kkkkk..', '....OO...']],
      pal: { k: K, W: '#f4f0e8', w: '#cfc8bc', R: '#d83030', E: K, O: '#e8a030' },
    },
  };
  const SLIME = ['............', '....kkkk....', '..kkGGLGkk..', '.kGGGGGLwGk.', '.kGGEGGEGGk.', 'kGGGEGGEGGGk', 'kGGGGGGGGGgk', 'kgGGGGGGGggk', '.kggggggggk.', '..kkkkkkkk..'];
  const BAT = [
    ['k..........k', 'kWk......kWk', 'kWWk.kk.kWWk', '.kWWkBBkWWk.', '..kkBEEBkk..', '....kBBk....', '.....kk.....'],
    ['............', '....k..k....', '...kBkkBk...', '.kkkBEEBkkk.', 'kWWWkBBkWWWk', 'kWWk.kk.kWWk', 'kk........kk'],
  ];
  const aCache = {};
  A.animal = function (kind) {
    if (aCache[kind]) return aCache[kind];
    const d = ANIMALS[kind];
    return (aCache[kind] = d.f.map((rows) => volume(new PB(rows[0].length, rows.length).rows(rows, d.pal)).canvas()));
  };
  A.slime = function (color) {
    const key = 'slime' + color;
    if (aCache[key]) return aCache[key];
    const pal = { k: K, G: color, g: sh(color, 0.7), L: sh(color, 1.35), w: '#ffffff', E: K };
    const f0 = volume(new PB(12, 10).rows(SLIME, pal)).canvas();
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
    return (A.urls[key] = A.toURL(A.icon(id), scale || 3));
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

  // Brume : bruit tramé, répété en mosaïque et décalé lentement à l'écran
  function mist() {
    const pb = new PB(128, 64);
    for (let y = 0; y < 64; y++)
      for (let x = 0; x < 128; x++) {
        const v = G.vnoise(x / 22, y / 11, 4) * 0.7 + G.vnoise(x / 9, y / 5, 9) * 0.3;
        if (v > 0.55 && G.bayer(x, y) < (v - 0.55) * 3) pb.set(x, y, '#9ab0e0');
      }
    return pb.canvas();
  }

  // ======================= CONSTRUCTION GLOBALE =======================
  A.build = function () {
    const S = (G.S = {});
    const grassSet = [];
    for (let tone = 0; tone < 3; tone++) for (let i = 0; i < 4; i++) grassSet.push(grass(i + 1 + tone * 10, tone, i === 2 || (i === 3 && tone === 2)));
    const floorSets = TIERS.map((t, i) => [0, 1, 2].map((j) => stones(51 + i * 10 + j, { n: 6 + j, pal: t.floor.pal, mortar: t.floor.mortar, mw: 0.045, cracks: 0.35, moss: t.floor.moss })));
    S.tiles = {
      grass: grassSet,
      dirt: [dirt(11), dirt(12), dirt(13)],
      sand: [sand(21), sand(22)],
      water: [water(0), water(1), water(2)],
      field: [field(31), field(32)],
      plaza: [0, 1, 2].map((j) => stones(41 + j, { n: 7 + j, pal: ['#5a564e', '#68635a', '#767066', '#827c70', '#8e887a'], mortar: '#36322c', mw: 0.05, cracks: 0.15, moss: ['#4a6a34', '#3e5a2c'] })),
      floor: floorSets[0], floor0: floorSets[0], floor1: floorSets[1], floor2: floorSets[2],
      bossfloor: [0, 1].map((j) => stones(91 + j, { n: 4, pal: ['#3a2830', '#46303a', '#523844', '#5e4250'], mortar: '#140c10', mw: 0.04, cracks: 0.5 })),
      carpet: [diamond((x, y, u, v) => (v < 0.12 || v > 0.88 ? '#c8a040' : v < 0.18 || v > 0.82 ? '#5a1a1a' : G.dither(['#6a1a1a', '#7a2222', '#8a2a2a'], 0.4 + G.hash2(x, y, 3) * 0.3 + (Math.abs(u - 0.5) < 0.08 ? 0.4 : 0), x, y))).canvas()],
    };
    S.fringe = {
      grass: [0, 1, 2, 3].map((d) => fringe(d, 5 + d, GRASS[1], '#223d20')),
      sand: [0, 1, 2, 3].map((d) => fringe(d, 15 + d, ['#a08a64', '#b09a72', '#c0aa80'], '#8a7656', '#d8e8f0')),
    };
    S.decal = {
      leavesRed: leaves(LEAVES.red, 1), leavesOrange: leaves(LEAVES.orange, 2), leavesYellow: leaves(LEAVES.yellow, 3), leavesGreen: leaves(LEAVES.green, 4),
      needles: leaves(['#3a5a2a', '#4a3a24', '#2e4a26'], 5),
      pebbles: scatter(16, 8, 6, 7, (pb, x, y) => { pb.set(x, y, '#8a8a92'); pb.set(x, y + 1, '#3a3a40'); }),
      rubble: scatter(20, 10, 7, 12, (pb, x, y, r) => { const c = ['#5a5660', '#6e6a74', '#46424c'][Math.floor(r() * 3)]; pb.set(x, y, c); if (r() < 0.5) pb.set(x + 1, y, c); pb.set(x, y + 1, '#1a161e'); }),
      stain: scatter(22, 11, 8, 40, (pb, x, y) => pb.set(x, y, '#1a161c90')),
      moss: scatter(18, 9, 9, 26, (pb, x, y, r) => pb.set(x, y, r() < 0.5 ? '#3e5a2a' : '#4e6e34')),
      flowersW: scatter(14, 7, 10, 6, (pb, x, y) => { pb.set(x, y, '#efe7cf'); pb.set(x + 1, y + 1, '#2e5028'); }),
      flowersY: scatter(14, 7, 11, 6, (pb, x, y) => { pb.set(x, y, '#f0cc4a'); pb.set(x + 1, y + 1, '#2e5028'); }),
      flowersP: scatter(14, 7, 12, 6, (pb, x, y) => { pb.set(x, y, '#c8a0e8'); pb.set(x + 1, y + 1, '#2e5028'); }),
    };
    S.wallSets = TIERS.map((t, i) => {
      const set = {};
      for (const v of ['plain', 'plain2', 'cracked', 'bannerL', 'bannerR', 'doorL', 'doorR', 'weaponsL', 'weaponsR', 'chainsL', 'chainsR', 'torchL', 'torchR']) set[v] = wallBlock(i, v.startsWith('plain') ? null : v);
      set.low = wallBlock(i, null, true);
      return set;
    });
    S.wall = [S.wallSets[0].plain, S.wallSets[0].plain2, S.wallSets[0].bannerL];
    S.wallLow = S.wallSets[0].low;
    S.pine = [pine(1, false, PINES[0]), pine(2, true, PINES[0]), pine(3, false, PINES[1]), pine(4, true, PINES[1])];
    S.tree = { red: roundTree(5, 'red'), orange: roundTree(6, 'orange'), yellow: roundTree(7, 'yellow'), green: roundTree(8, 'green'), oak: roundTree(9, 'oak', true), birch: roundTree(10, 'birch') };
    S.boulder = [boulder(1), boulder(2)];
    S.stump = stump();
    S.bush = [bush(1, false), bush(2, true)];
    S.fern = [fern(1), fern(2)];
    S.mushrooms = [mushrooms(true), mushrooms(false)];
    S.tallGrass = [tallGrass(1), tallGrass(2), tallGrass(3)];
    S.log = fallenLog();
    S.crate = crate();
    S.chest = chest(false);
    S.chestOpen = chest(true);
    S.stairs = stairsDown();
    S.portal = [portal(0), portal(1), portal(2), portal(3)];
    S.poolFrames = [pool(0), pool(1), pool(2)];
    S.pool = S.poolFrames[0];
    S.fenceX = fenceSeg('x');
    S.fenceY = fenceSeg('y');
    for (const k of Object.keys(PROPS)) S[k] = propSprite(k);
    S.trough = trough(); S.sawhorse = sawhorse(); S.minecart = minecart(); S.bench = bench(); S.woodpile = woodpile();
    S.coal = coalPile(); S.grindstone = grindstone(); S.weaponRack = weaponRack(); S.workbench = workbench(); S.brazier = brazier();
    const armor = A.humanoid('armorstand', { skin: '#8a8f99', hair: '#8a8f99', hat: 'helmet', metal: '#9aa0aa', eye: '#1b1424', shirt: '#8a8f99', pants: '#5a3a20', boots: '#5a3a20', pauldrons: true });
    const ac = G.newCanvas(14, 22);
    const ax = ac.getContext('2d');
    ax.drawImage(armor.front[0], 0, 0);
    ax.fillStyle = '#4a2e1a'; ax.fillRect(3, 19, 8, 3); ax.fillStyle = '#6a4426'; ax.fillRect(3, 19, 8, 1);
    S.armorStand = { c: ac, ox: 7, oy: 21 };
    S.flame = flameFrames();
    S.mist = mist();
    // ombres de contact
    const sp = new PB(14, 6);
    sp.ellipse(7, 3, 6.5, 2.6, '#00000066');
    S.shadow = sp.canvas();
    const bsp = new PB(30, 12);
    bsp.ellipse(15, 6, 14, 5.5, '#00000066');
    S.bigShadow = bsp.canvas();
    const tsp = new PB(40, 16);
    tsp.ellipse(20, 8, 19, 7, (x, y, dx, dy) => (Math.hypot(dx, dy) > 0.75 && (x + y) & 1 ? null : '#0a0c2266'));
    S.treeShadow = { c: tsp.canvas(), ox: 14, oy: 8 };
  };

  // Vignette d'un bâtiment (pour le menu de construction)
  A.buildingThumb = function (type) {
    const key = 'b:' + type;
    if (A.urls[key]) return A.urls[key];
    const s = A.buildingSprite(type);
    const src = s ? s.c : G.S.pine[0].c;
    const size = 48;
    const sc = Math.min(size / src.width, size / src.height) * (s && s.c.width > 100 ? 1.25 : 1);
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
