// ORBITA · vector.js — police vectorielle « Trace », solides filaires et tracés (le canvas est fourni par l'appelant).
/* ---------- police vectorielle « Trace » (traits seuls, grille 4×6) ---------- */
const SPC = 1.5, FONT = {};
(function () {
  const src = {
    A: '0,6 0,2 2,0 4,2 4,6|0,4 4,4', B: '0,6 0,0 3,0 4,1 4,2 3,3 0,3|3,3 4,4 4,5 3,6 0,6', C: '4,1 3,0 1,0 0,1 0,5 1,6 3,6 4,5',
    D: '0,0 2.6,0 4,1.4 4,4.6 2.6,6 0,6 0,0', E: '4,0 0,0 0,6 4,6|0,3 3,3', F: '4,0 0,0 0,6|0,3 3,3',
    G: '4,1 3,0 1,0 0,1 0,5 1,6 3,6 4,5 4,3 2.2,3', H: '0,0 0,6|4,0 4,6|0,3 4,3', I: '2;1,0 1,6|0,0 2,0|0,6 2,6',
    J: '4,0 4,5 3,6 1,6 0,5', K: '0,0 0,6|4,0 0,3.4|1.5,2.3 4,6', L: '0,0 0,6 4,6', M: '0,6 0,0 2,3 4,0 4,6', N: '0,6 0,0 4,6 4,0',
    O: '1,0 3,0 4,1 4,5 3,6 1,6 0,5 0,1 1,0', P: '0,6 0,0 3,0 4,1 4,2.4 3,3.4 0,3.4', Q: '1,0 3,0 4,1 4,5 3,6 1,6 0,5 0,1 1,0|2.6,4.4 4.2,6.3',
    R: '0,6 0,0 3,0 4,1 4,2.4 3,3.4 0,3.4|2.2,3.4 4,6', S: '4,1 3,0 1,0 0,1 0,2 1,3 3,3 4,4 4,5 3,6 1,6 0,5', T: '0,0 4,0|2,0 2,6',
    U: '0,0 0,5 1,6 3,6 4,5 4,0', V: '0,0 2,6 4,0', W: '0,0 1,6 2,3 3,6 4,0', X: '0,0 4,6|4,0 0,6', Y: '0,0 2,3 4,0|2,3 2,6', Z: '0,0 4,0 0,6 4,6',
    0: '1,0 3,0 4,1 4,5 3,6 1,6 0,5 0,1 1,0|1.3,4.3 2.7,1.7', 1: '0.8,1.2 2,0 2,6|0.8,6 3.2,6', 2: '0,1 1,0 3,0 4,1 4,2.2 0,6 4,6',
    3: '0,1 1,0 3,0 4,1 4,2 3,3 4,4 4,5 3,6 1,6 0,5|1.6,3 3,3', 4: '3,6 3,0 0,4 4,4', 5: '4,0 0,0 0,2.6 3,2.6 4,3.6 4,5 3,6 1,6 0,5',
    6: '4,1 3,0 1,0 0,1 0,5 1,6 3,6 4,5 4,3.8 3,2.8 0,2.8', 7: '0,0 4,0 1.6,6', 8: '1,0 3,0 4,1 4,2 3,3 1,3 0,2 0,1 1,0|3,3 4,4 4,5 3,6 1,6 0,5 0,4 1,3',
    9: '0,5 1,6 3,6 4,5 4,1 3,0 1,0 0,1 0,2.2 1,3.2 4,3.2',
    '.': '1;0.5,5.6 0.5,6', ',': '1;0.7,5.4 0.2,6.9', ':': '1;0.5,1.9 0.5,2.3|0.5,4.7 0.5,5.1', '!': '1;0.5,0 0.5,4|0.5,5.6 0.5,6',
    '?': '0,1 1,0 3,0 4,1 4,2 2,3.4 2,4.2|2,5.6 2,6', '-': '0.5,3 3.5,3', '+': '0.6,3 3.4,3|2,1.6 2,4.4', '/': '0.4,6 3.6,0',
    '·': '1;0.5,2.8 0.5,3.2', "'": '1;0.6,0 0.2,1.4', '%': '0.4,6 3.6,0|0.4,0.4 0.4,1.2|3.6,4.8 3.6,5.6', '=': '0.5,2.2 3.5,2.2|0.5,3.8 3.5,3.8',
    '>': '0.6,1.4 3.4,3 0.6,4.6', '<': '3.4,1.4 0.6,3 3.4,4.6', '°': '2;1,0 1.8,0.8 1,1.6 0.2,0.8 1,0', '×': '0.8,1.8 3.2,4.2|3.2,1.8 0.8,4.2',
    '→': '0,3 4,3|2.4,1.4 4,3 2.4,4.6', ' ': '2.2;'
  };
  const parse = s => s ? s.split('|').map(pl => pl.split(/[ ,]/).map(Number)) : [];
  for (const k in src) {
    const m = /^([\d.]+);(.*)$/.exec(src[k]);
    FONT[k] = { w: m ? +m[1] : 4, p: parse(m ? m[2] : src[k]) };
  }
  FONT['’'] = FONT["'"];
  const st = [];   // étoile à cinq branches
  for (let i = 0; i <= 10; i++) { const a = -HPI + i * Math.PI / 5, r = i % 2 ? 1.02 : 2.5; st.push(2.5 + Math.cos(a) * r, 3.2 + Math.sin(a) * r); }
  FONT['★'] = { w: 5, p: [st] };
  const acc = { '´': '1.5,-0.7 2.8,-1.8', '`': '2.5,-0.7 1.2,-1.8', '^': '0.9,-0.6 2,-1.7 3.1,-0.6', '¸': '2,6 2,6.7 1.3,7.3', '¨': '1,-1.3 1,-0.9|3,-1.3 3,-0.9' };
  const comp = { 'É': 'E´', 'È': 'E`', 'Ê': 'E^', 'Ë': 'E¨', 'À': 'A`', 'Â': 'A^', 'Ç': 'C¸', 'Î': 'I^', 'Ï': 'I¨', 'Ô': 'O^', 'Û': 'U^', 'Ù': 'U`', 'Ü': 'U¨' };
  for (const k in comp) {
    const b = FONT[comp[k][0]], dx = (b.w - 4) / 2;
    FONT[k] = { w: b.w, p: b.p.concat(parse(acc[comp[k][1]]).map(pl => pl.map((v, i) => i % 2 ? v : v + dx))) };
  }
})();
function vwidth(str, h) { let w = 0; for (const ch of str) w += (FONT[ch] || FONT[' ']).w + SPC; return Math.max(0, w - SPC) * h / 6; }
function vpath(c, str, x, y, h) {
  const s = h / 6; let px = x;
  for (const ch of str) {
    const g = FONT[ch] || FONT[' '], P = g.p;
    for (let j = 0; j < P.length; j++) {
      const pl = P[j]; c.moveTo(px + pl[0] * s, y + pl[1] * s);
      for (let i = 2; i < pl.length; i += 2) c.lineTo(px + pl[i] * s, y + pl[i + 1] * s);
    }
    px += (g.w + SPC) * s;
  }
  return px;
}
// texte au trait : y = haut des capitales, al = 0 gauche / .5 centre / 1 droite
function vtext(c, str, x, y, h, al, style, lw) {
  if (al) x -= vwidth(str, h) * al;
  c.beginPath(); vpath(c, str, x, y, h);
  c.strokeStyle = style; c.lineWidth = lw; c.stroke();
}
function vsvg(str, h, lw) {
  const s = h / 6, w = vwidth(str, h); let d = '', px = 0;
  const f = v => +v.toFixed(2);
  for (const ch of str) {
    const g = FONT[ch] || FONT[' '];
    for (const pl of g.p) { d += 'M' + f(px + pl[0] * s) + ' ' + f(pl[1] * s); for (let i = 2; i < pl.length; i += 2) d += 'L' + f(px + pl[i] * s) + ' ' + f(pl[i + 1] * s); }
    px += (g.w + SPC) * s;
  }
  return `<svg class="vt" width="${f(w)}" height="${h}" viewBox="0 0 ${f(w)} ${h}" aria-hidden="true"><path d="${d}" fill="none" stroke="currentColor" stroke-width="${lw}" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
const fitH = (str, h, maxW) => Math.min(h, h * maxW / Math.max(1, vwidth(str, h)));
function setVT(el, str, h, lw, maxW) {
  if (maxW) { const h2 = fitH(str, h, maxW); lw *= h2 / h; h = h2; }
  el.innerHTML = vsvg(str, +h.toFixed(1), +lw.toFixed(2)); el.setAttribute('aria-label', str);
}

/* ---------- solides filaires ---------- */
const SOL = {};
(function () {
  const PHI = (1 + Math.sqrt(5)) / 2;
  const add = (name, v, e, dots) => {
    const n = v.length;
    SOL[name] = { v: Float32Array.from(v.flat()), e: Uint16Array.from(e.flat()), n, dots, px: new Float32Array(n), py: new Float32Array(n), pz: new Float32Array(n) };
  };
  const nrm = (v, r) => v.map(p => { const l = Math.hypot(p[0], p[1], p[2]) / r; return [p[0] / l, p[1] / l, p[2] / l]; });
  const near = v => {
    let m = 1e9; const e = [];
    for (let i = 0; i < v.length; i++) for (let j = i + 1; j < v.length; j++) m = Math.min(m, Math.hypot(v[i][0] - v[j][0], v[i][1] - v[j][1], v[i][2] - v[j][2]));
    for (let i = 0; i < v.length; i++) for (let j = i + 1; j < v.length; j++) if (Math.hypot(v[i][0] - v[j][0], v[i][1] - v[j][1], v[i][2] - v[j][2]) < m * 1.02) e.push([i, j]);
    return e;
  };
  const signs = (a, b, c) => { const o = []; for (const i of a ? [1, -1] : [1]) for (const j of b ? [1, -1] : [1]) for (const k of c ? [1, -1] : [1]) o.push([a * i, b * j, c * k]); return o; };
  // cercle dans le plan engendré par u et w
  const ring = (B, r, n, u, w, off) => {
    const o = B.v.length; off = off || [0, 0, 0];
    for (let i = 0; i < n; i++) { const a = i * TAU / n, c = Math.cos(a) * r, s = Math.sin(a) * r; B.v.push([off[0] + u[0] * c + w[0] * s, off[1] + u[1] * c + w[1] * s, off[2] + u[2] * c + w[2] * s]); B.e.push([o + i, o + (i + 1) % n]); }
  };
  const poly = (B, v, e) => { const o = B.v.length; v.forEach(p => B.v.push(p)); e.forEach(q => B.e.push([q[0] + o, q[1] + o])); };
  const X = [1, 0, 0], Y = [0, 1, 0], Z = [0, 0, 1];
  let v, B;
  // icosaèdre
  v = nrm([...signs(0, 1, PHI), ...signs(1, PHI, 0), ...signs(PHI, 0, 1)], .8); add('ico', v, near(v), true);
  // dodécaèdre
  v = nrm([...signs(1, 1, 1), ...signs(0, 1 / PHI, PHI), ...signs(1 / PHI, PHI, 0), ...signs(PHI, 0, 1 / PHI)], .8); add('dodeca', v, near(v), true);
  // octaèdre (noyau des boss)
  v = nrm([...signs(1, 0, 0), ...signs(0, 1, 0), ...signs(0, 0, 1)], .4); add('octa', v, near(v), false);
  // cuboctaèdre
  v = nrm([...signs(1, 1, 0), ...signs(1, 0, 1), ...signs(0, 1, 1)], .8); add('cubocta', v, near(v), true);
  // étoile octangle : deux tétraèdres imbriqués
  B = { v: [], e: [] };
  { const ta = nrm([[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]], .84), te = [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]]; poly(B, ta, te); poly(B, ta.map(p => [-p[0], -p[1], -p[2]]), te); }
  add('stella', B.v, B.e, true);
  // cristal : bipyramide hexagonale allongée
  B = { v: [], e: [] };
  { const hx = []; for (let i = 0; i < 6; i++) hx.push([Math.cos(i * TAU / 6) * .52, 0, Math.sin(i * TAU / 6) * .52]);
    const e = []; for (let i = 0; i < 6; i++) e.push([i, (i + 1) % 6], [i, 6], [i, 7]);
    poly(B, [...hx, [0, .84, 0], [0, -.84, 0]], e);
    const h2 = hx.map(p => [p[0] * .5, .42, p[2] * .5]), e2 = []; for (let i = 0; i < 6; i++) e2.push([i, (i + 1) % 6]); poly(B, h2, e2); poly(B, h2.map(p => [p[0], -.42, p[2]]), e2); }
  add('cristal', B.v, B.e, false);
  // tesseract : cube dans un cube
  B = { v: [], e: [] };
  { const c1 = nrm(signs(1, 1, 1), .8), ce = near(c1); poly(B, c1, ce); poly(B, c1.map(p => [p[0] * .46, p[1] * .46, p[2] * .46]), ce); for (let i = 0; i < 8; i++) B.e.push([i, i + 8]); }
  add('tesseract', B.v, B.e, true);
  // planète annelée : globe + anneaux
  B = { v: [], e: [] };
  ring(B, .46, 26, X, Z); ring(B, .37, 22, X, Z, [0, .27, 0]); ring(B, .37, 22, X, Z, [0, -.27, 0]);
  for (let k = 0; k < 3; k++) { const a = k * Math.PI / 3; ring(B, .46, 26, [Math.cos(a), 0, Math.sin(a)], Y); }
  ring(B, .66, 34, X, Z); ring(B, .8, 40, X, Z);
  add('saturne', B.v, B.e, false);
  // sphère armillaire : trois cercles et un noyau
  B = { v: [], e: [] };
  ring(B, .82, 40, X, Y); ring(B, .82, 40, Y, Z); ring(B, .82, 40, X, Z); ring(B, .56, 30, X, Z, [0, .6, 0]); ring(B, .56, 30, X, Z, [0, -.6, 0]);
  { const o = nrm([...signs(1, 0, 0), ...signs(0, 1, 0), ...signs(0, 0, 1)], .3); poly(B, o, near(o)); poly(B, [[0, .82, 0], [0, -.82, 0]], [[0, 1]]); }
  add('armille', B.v, B.e, false);
})();
function project(sol, rz, tilt, spin) {
  const cz = Math.cos(rz), sz = Math.sin(rz), ct = Math.cos(tilt), st = Math.sin(tilt), cs = Math.cos(spin), ss = Math.sin(spin), v = sol.v;
  for (let i = 0, j = 0; i < sol.n; i++, j += 3) {
    const x = v[j], y = v[j + 1], z = v[j + 2];
    const x1 = x * cs + z * ss, z1 = -x * ss + z * cs;
    const y2 = y * ct - z1 * st, z2 = y * st + z1 * ct;
    const k = 1 / (1 - z2 * .16);
    sol.px[i] = (x1 * cz - y2 * sz) * k; sol.py[i] = (x1 * sz + y2 * cz) * k; sol.pz[i] = z2;
  }
}
function strokeSolid(c, sol, x, y, r, front) {
  const e = sol.e, px = sol.px, py = sol.py, pz = sol.pz;
  c.beginPath();
  for (let i = 0; i < e.length; i += 2) {
    const a = e[i], b = e[i + 1];
    if ((pz[a] + pz[b] > 0) === front) { c.moveTo(x + px[a] * r, y + py[a] * r); c.lineTo(x + px[b] * r, y + py[b] * r); }
  }
  c.stroke();
}
function solidSVG(name, size) {
  const sol = SOL[name], r = size / 2 - 1; project(sol, .35, TILT, .5); let d = '';
  for (let i = 0; i < sol.e.length; i += 2) { const a = sol.e[i], b = sol.e[i + 1]; d += `M${(size / 2 + sol.px[a] * r).toFixed(1)} ${(size / 2 + sol.py[a] * r).toFixed(1)}L${(size / 2 + sol.px[b] * r).toFixed(1)} ${(size / 2 + sol.py[b] * r).toFixed(1)}`; }
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true" style="flex:none"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - .6}" fill="none" stroke="currentColor" stroke-opacity=".45"/><path d="${d}" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round"/></svg>`;
}

function starPath(c, x, y, ro, ri, a0, n) {
  for (let i = 0; i <= n * 2; i++) { const a = a0 + i * Math.PI / n, r = i % 2 ? ri : ro; if (i) c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); else c.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
}
