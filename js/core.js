'use strict';
// Outils de base : maths, projection isométrique, couleurs, tampon de pixels, police bitmap.
const G = (window.G = window.G || {});

G.TW = 32; // largeur d'une tuile isométrique (px)
G.TH = 16; // hauteur d'une tuile isométrique (px)

G.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
G.lerp = (a, b, t) => a + (b - a) * t;
G.dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
G.rnd = (a, b) => a + Math.random() * (b - a);
G.irnd = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
G.pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

G.seeded = function (seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

G.hash2 = function (x, y, s) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul((s || 0) | 0, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

// Bruit de valeur lissé (0..1), déterministe : grandes taches de couleur sans motif répétitif.
G.vnoise = function (x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const fx = x - xi, fy = y - yi;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = G.hash2(xi, yi, s), b = G.hash2(xi + 1, yi, s), c = G.hash2(xi, yi + 1, s), d = G.hash2(xi + 1, yi + 1, s);
  return G.lerp(G.lerp(a, b, sx), G.lerp(c, d, sx), sy);
};

// Monde (tuiles) -> écran (px, avant caméra). Le coin haut de la tuile (x,y) est iso(x,y).
G.iso = (x, y) => ({ x: (x - y) * 16, y: (x + y) * 8 });
G.unIso = (sx, sy) => ({ x: (sx / 16 + sy / 8) / 2, y: (sy / 8 - sx / 16) / 2 });

// ---------- Couleurs ----------
const colorCache = {};
G.rgba = function (c) {
  if (colorCache[c]) return colorCache[c];
  const h = c.slice(1);
  let r, g, b, a = 255;
  if (h.length === 3) {
    r = parseInt(h[0] + h[0], 16); g = parseInt(h[1] + h[1], 16); b = parseInt(h[2] + h[2], 16);
  } else {
    r = parseInt(h.slice(0, 2), 16); g = parseInt(h.slice(2, 4), 16); b = parseInt(h.slice(4, 6), 16);
    if (h.length === 8) a = parseInt(h.slice(6, 8), 16);
  }
  return (colorCache[c] = [r, g, b, a]);
};
const hx = (v) => G.clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0');
G.mix = function (c1, c2, t) {
  const a = G.rgba(c1), b = G.rgba(c2);
  return '#' + hx(G.lerp(a[0], b[0], t)) + hx(G.lerp(a[1], b[1], t)) + hx(G.lerp(a[2], b[2], t));
};
G.shade = (c, f) => (f >= 1 ? G.mix(c, '#ffffff', f - 1) : G.mix('#000000', c, f));

// Tramage ordonné (Bayer 4x4) pour des dégradés « pixel art ».
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
G.bayer = (x, y) => (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
G.dither = function (colors, t, x, y) {
  t = G.clamp(t, 0, 0.9999) * (colors.length - 1);
  const i = Math.floor(t);
  const f = t - i;
  return colors[Math.min(colors.length - 1, i + (f > G.bayer(x, y) ? 1 : 0))];
};

// ---------- Tampon de pixels ----------
class PB {
  constructor(w, h) {
    this.w = w; this.h = h;
    this.d = new Array(w * h).fill(null);
  }
  set(x, y, c) {
    x = Math.floor(x); y = Math.floor(y);
    if (!c || x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.d[y * this.w + x] = c;
  }
  get(x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return null;
    return this.d[y * this.w + x];
  }
  rect(x, y, w, h, c) {
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) this.set(x + i, y + j, typeof c === 'function' ? c(x + i, y + j) : c);
  }
  // Remplit un polygone (test du centre des pixels). fn(x,y) -> couleur | null
  poly(pts, fn) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of pts) {
      minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]);
      minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]);
    }
    const n = pts.length;
    for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
      const cy = y + 0.5;
      for (let x = Math.floor(minX); x <= Math.ceil(maxX); x++) {
        const cx = x + 0.5;
        let inside = false;
        for (let i = 0, j = n - 1; i < n; j = i++) {
          const xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
          if ((yi > cy) !== (yj > cy) && cx < ((xj - xi) * (cy - yi)) / (yj - yi) + xi) inside = !inside;
        }
        if (inside) this.set(x, y, typeof fn === 'function' ? fn(x, y) : fn);
      }
    }
  }
  ellipse(cx, cy, rx, ry, fn) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.set(x, y, typeof fn === 'function' ? fn(x, y, dx, dy) : fn);
      }
  }
  line(x0, y0, x1, y1, c) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= n; i++) this.set(Math.round(G.lerp(x0, x1, i / n)), Math.round(G.lerp(y0, y1, i / n)), c);
  }
  // Contour d'1 px autour des pixels pleins (4-voisinage).
  outline(c) {
    const add = [];
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        if (this.get(x, y)) continue;
        if (this.get(x - 1, y) || this.get(x + 1, y) || this.get(x, y - 1) || this.get(x, y + 1)) add.push(x, y);
      }
    for (let i = 0; i < add.length; i += 2) this.set(add[i], add[i + 1], c);
    return this;
  }
  rows(rows, pal, ox, oy) {
    for (let j = 0; j < rows.length; j++)
      for (let i = 0; i < rows[j].length; i++) {
        const ch = rows[j][i];
        if (ch === '.' || ch === ' ') continue;
        this.set((ox || 0) + i, (oy || 0) + j, pal[ch] || '#ff00ff');
      }
    return this;
  }
  canvas() {
    const c = document.createElement('canvas');
    c.width = this.w; c.height = this.h;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(this.w, this.h);
    for (let i = 0; i < this.d.length; i++) {
      const col = this.d[i];
      if (!col) continue;
      const v = G.rgba(col);
      img.data[i * 4] = v[0]; img.data[i * 4 + 1] = v[1]; img.data[i * 4 + 2] = v[2]; img.data[i * 4 + 3] = v[3];
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }
}
G.PB = PB;

G.spr = function (rows, pal) {
  return new PB(rows[0].length, rows.length).rows(rows, pal).canvas();
};

G.newCanvas = function (w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  return c;
};

// Version blanche d'un sprite (flash de dégât), mise en cache.
const flashCache = new WeakMap();
G.flashOf = function (cv) {
  let f = flashCache.get(cv);
  if (!f) {
    f = G.newCanvas(cv.width, cv.height);
    const x = f.getContext('2d');
    x.drawImage(cv, 0, 0);
    x.globalCompositeOperation = 'source-atop';
    x.fillStyle = '#ffffff';
    x.fillRect(0, 0, f.width, f.height);
    flashCache.set(cv, f);
  }
  return f;
};

// ---------- Police bitmap 3x5 (textes flottants dans le monde) ----------
const GLYPHS = {
  '0': '111101101101111', '1': '010110010010111', '2': '111001111100111', '3': '111001111001111',
  '4': '101101111001001', '5': '111100111001111', '6': '111100111101111', '7': '111001001001001',
  '8': '111101111101111', '9': '111101111001111', '+': '000010111010000', '-': '000000111000000',
  '!': '010010010000010', ' ': '000000000000000', '.': '000000000000010', '/': '001001010100100',
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110',
  E: '111100110100111', F: '111100110100100', G: '011100101101011', H: '101101111101101',
  I: '111010010010111', J: '001001001101010', K: '101101110101101', L: '100100100100111',
  M: '101111111101101', N: '110101101101101', O: '010101101101010', P: '110101110100100',
  Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
  U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101',
  Y: '101101010010010', Z: '111001010100111',
};
const ACCENTS = { 'É': 'E', 'È': 'E', 'Ê': 'E', 'À': 'A', 'Â': 'A', 'Ô': 'O', 'Û': 'U', 'Ù': 'U', 'Ç': 'C', 'Î': 'I' };
const textCache = {};
G.textSprite = function (text, color) {
  const key = text + '|' + color;
  if (textCache[key]) return textCache[key];
  const str = text.toUpperCase();
  const w = str.length * 4 + 1, h = 7;
  const pb = new PB(w, h);
  for (let i = 0; i < str.length; i++) {
    const g = GLYPHS[ACCENTS[str[i]] || str[i]] || GLYPHS[' '];
    for (let p = 0; p < 15; p++) if (g[p] === '1') pb.set(1 + i * 4 + (p % 3), 1 + Math.floor(p / 3), color);
  }
  pb.outline('#120c18');
  return (textCache[key] = pb.canvas());
};

// ---------- Sons (WebAudio, très simples) ----------
G.audio = {
  ctx: null,
  muted: false,
  init() {
    if (this.ctx) return;
    try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { this.ctx = null; }
  },
  play(kind) {
    if (this.muted || !this.ctx) return;
    const presets = {
      hit: [220, 110, 0.08, 'square', 0.05],
      hurt: [140, 60, 0.15, 'sawtooth', 0.06],
      pick: [660, 990, 0.08, 'square', 0.035],
      coin: [880, 1320, 0.1, 'square', 0.03],
      chop: [180, 120, 0.06, 'triangle', 0.08],
      build: [262, 523, 0.25, 'triangle', 0.08],
      level: [523, 1046, 0.4, 'square', 0.05],
      skill: [300, 900, 0.2, 'sawtooth', 0.04],
      shoot: [700, 400, 0.07, 'triangle', 0.05],
      boom: [120, 40, 0.35, 'sawtooth', 0.08],
      ui: [500, 500, 0.04, 'square', 0.025],
    };
    const p = presets[kind];
    if (!p) return;
    try {
      const t = this.ctx.currentTime;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = p[3];
      o.frequency.setValueAtTime(p[0], t);
      o.frequency.exponentialRampToValueAtTime(p[1], t + p[2]);
      g.gain.setValueAtTime(p[4], t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + p[2]);
      o.connect(g).connect(this.ctx.destination);
      o.start(t);
      o.stop(t + p[2] + 0.02);
    } catch (e) { /* audio indisponible */ }
  },
};
