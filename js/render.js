// ORBITA · render.js — canvas, mise en page, thème, fond pré-rendu, scène, HUD, bandeaux et couche phosphore.
const cvs = $('c'), ctx = cvs.getContext('2d');
const glow = document.createElement('canvas'), gctx = glow.getContext('2d');   // couche phosphore (basse résolution, persistante)
const bg = document.createElement('canvas');                                    // fond statique pré-rendu
// halo large (bloom) : la couche phosphore réduite au quart dans un petit canvas du document (#bloom, ⅛ de la taille de
// l'écran en px CSS), que le navigateur agrandit lui-même (filtrage bilinéaire) et ajoute à l'image (mix-blend-mode
// plus-lighter, index.html) : halo doux sans filtre de flou ni composition plein écran dans le canvas
const bloomB = $('bloom'), bbctx = bloomB ? bloomB.getContext('2d') : null;
let W = 0, H = 0, DPR = 1, SX = 0, SW = 0, cx = 0, cy = 0, R = 60, PL = 60, HEAD = 6, PW = 2, RS = 150, RD = 170, LAUNCH = 0, FLYV = 2000;
let SAT = 0, SAB = 0, bgKey = '', UMAP = [], SENT_HW = 5, RRAD = [0, 0, 0];
const GSC = {}, MSC = { r: 0 };
// profondeur du fond : champ d'étoiles en trois plans qui tourne très lentement autour du centre de visée (parallaxe :
// les plans proches tournent plus vite), et orbites lointaines inclinées parcourues par un satellite. Chaque monde a son
// ciel : densité, dérive, sens (Saphir : plans à contre-sens), orbites. Rien de tout cela n'approche l'éclat du jeu.
// n : étoiles ; w : dérive (rad/s) du plan proche ; ctr : plans alternés à contre-sens ; orbits : [rayon / RD, aplatissement, inclinaison]
const DEEP = [
  { n: 330, w: .012, ctr: false, orbits: [[2.05, .34, -.32], [3.1, .3, -.32]] },                  // Émeraude : calme
  { n: 360, w: .03, ctr: false, orbits: [[1.9, .22, .12], [2.6, .22, .12], [3.5, .22, .12]] },    // Ambre : disque d'accrétion, plus vif
  { n: 300, w: .016, ctr: false, orbits: [[2.2, .42, .62], [2.2, .42, -.62]] },                  // Rubis : orbites croisées, précises
  { n: 340, w: .02, ctr: true, orbits: [[2.1, .3, -.5], [3, .3, .5]] },                          // Saphir : plans à contre-sens
  { n: 200, w: .008, ctr: false, orbits: [[2.4, .26, -.2]] },                                    // Obsidienne : ciel profond, presque vide
  { n: 500, w: .016, ctr: false, orbits: [[1.95, .3, -.4], [2.7, .5, .9], [3.5, .2, -.1]] }      // Cosmos : ciel dense
];
const STAR_MAX = 500, SX_A = new Float32Array(STAR_MAX), SX_U = new Float32Array(STAR_MAX), SX_R = new Float32Array(STAR_MAX), SX_Z = new Uint8Array(STAR_MAX), TWK = new Float32Array(4);
const bgF = { x: 0, y: 0 }, starCol = ['', '', ''];
let starW = -1, starN = 0;
let hero = null, heroTick = 0;
// viseur d'avance : angle à l'écran où tomberait une aiguille lancée maintenant, et zone libre ou non (calculé au rendu)
let leadA = HPI, leadOk = true;
// démo du menu : l'astre du monde en cours se joue tout seul
const demo = { stuck: [], rot: 0, t: 0, cool: .8, fly: null, arcs: [[0, TAU]], gone: 0 };

let PAL = worldInfo(0);
function setTheme(w) {
  PAL = worldInfo(w);
  const s = document.documentElement.style;
  s.setProperty('--c', `rgb(${PAL.rgb})`); s.setProperty('--rgb', PAL.rgb.join(',')); s.setProperty('--hi', `rgb(${PAL.hi})`); s.setProperty('--acc', `rgb(${PAL.acc})`);
  s.setProperty('--alert', `rgb(${PAL.alert})`); s.setProperty('--alert-rgb', PAL.alert.join(',')); s.setProperty('--lab', PAL.lab);
}

function layout() {
  SW = Math.min(W, Math.max(300, Math.round(H * .62)));
  SX = (W - SW) / 2; cx = W / 2;
  const top = Math.max(12, SAT);
  // anneaux à portes dans le couloir de tir, entre le cadran et le pas de tir : sur un écran bas (téléphone en paysage),
  // l'astre est réduit jusqu'à ce que le troisième anneau tienne au-dessus de l'aiguille posée sur le pas de tir ; à défaut
  // (astre au minimum), l'écart entre anneaux est resserré, jamais sous 12 px
  const place = r => {
    R = r; PL = R; HEAD = GAP * (R + PL) / 2; PW = Math.max(1.4, R * .024);
    RS = R + PL + HEAD * 3.3;
    RD = Math.min(RS + HEAD * 2.4, SW / 2 - 9);
    cy = Math.max(H * .36, top + 62 + RD);
    LAUNCH = Math.max(cy + RS + HEAD * 2 + 6, Math.min(H * .83, H - PL - HEAD - 30 - SAB));
    return LAUNCH - cy - (RD + 12 + 2 * Math.max(14, 2.2 * HEAD) + Math.max(2.4, HEAD * .38) / 2 + 8);
  };
  let r0 = Math.max(26, Math.min(SW * .18, H * .112, (H - top - 108 - SAB) / 6.26));
  while (place(r0) < 0 && r0 > 26) r0 = Math.max(26, r0 - .5);
  FLYV = (LAUNCH - (cy + R)) / FLIGHT;
  // demi-épaisseur des sentinelles (et rayon de leur bout arrondi) : tirée de SENT_PAD, pour que le dessin touche la tige
  // de l'aiguille exactement quand la règle déclare l'interception
  SENT_HW = Math.max(1.5, SENT_PAD * RS - Math.max(1.3, R * .022) * .6);   // vitesse moyenne : (LAUNCH − (cy + R)) / FLYV = FLIGHT
  // carte affine par morceaux u → rayon, qui passe exactement par les éléments dessinés de cet écran
  // anneaux à portes : dans le couloir de tir, hors du cadran, écart ≥ 14 px (≥ 2,2 têtes)
  const room = LAUNCH - cy - 8 - Math.max(2.4, HEAD * .38) / 2 - RD, sp = Math.max(14, 2.2 * HEAD), r1 = Math.min(12, Math.max(6, room - 2 * sp));
  const sp2 = Math.max(12, Math.min(sp, (room - r1) / 2));
  for (let k = 0; k < 3; k++) RRAD[k] = RD + r1 + k * sp2;
  UMAP = [[-U.len, LAUNCH + PL + HEAD - cy], [0, LAUNCH - cy], [U.rings[2], RRAD[2]], [U.rings[1], RRAD[1]], [U.rings[0], RRAD[0]],
    [U.dial, RD], [U.sentOut, RS + SENT_HW], [U.sent, RS], [U.sentIn, RS - SENT_HW], [U.head, R + PL + HEAD], [1, R]];
  document.documentElement.style.setProperty('--sx', SX + 'px');
  document.documentElement.style.setProperty('--sw', SW + 'px');
}
// rayon dessiné (distance au centre de l'astre, vers le bas) de la position physique u
function uR(u) {
  const m = UMAP;
  if (u <= m[0][0]) return m[0][1];
  for (let i = 1; i < m.length; i++) if (u <= m[i][0]) { const a = m[i - 1], b = m[i]; return a[1] + (b[1] - a[1]) * (u - a[0]) / (b[0] - a[0]); }
  return m[m.length - 1][1];
}
// ordonnées dessinées de la pointe et de l'extrémité de la tête d'une aiguille en u ; la longueur dessinée ne descend jamais
// sous la longueur réelle (couloirs courts), sans changer les instants où pointe et tête croisent sentinelles et têtes plantées
function pinYs(u, out) {
  const tip = uR(u);
  out[0] = cy + tip; out[1] = cy + Math.max(uR(u - U.len), tip + PL + HEAD);
  return out;
}
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = Math.max(200, innerWidth); H = Math.max(200, innerHeight);
  cvs.width = Math.round(W * DPR); cvs.height = Math.round(H * DPR);
  cvs.style.width = W + 'px'; cvs.style.height = H + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  glow.width = Math.ceil(W * GS); glow.height = Math.ceil(H * GS);
  gctx.setTransform(GS, 0, 0, GS, 0, 0);
  if (bloomB) { bloomB.width = Math.ceil(glow.width / 4); bloomB.height = Math.ceil(glow.height / 4); bloomB.style.width = W + 'px'; bloomB.style.height = H + 'px'; }
  SAT = $('sat').getBoundingClientRect().height; SAB = $('sab').getBoundingClientRect().height;
  layout(); bgKey = ''; hero = null;
  if (state === 'failed') measureSheet();
}

function buildBg(fx, fy) {
  bg.width = cvs.width; bg.height = cvs.height;
  const b = bg.getContext('2d'), rgb = PAL.rgb; b.setTransform(DPR, 0, 0, DPR, 0, 0);
  b.fillStyle = INK; b.fillRect(0, 0, W, H);
  let g = b.createRadialGradient(fx, fy, 0, fx, fy, Math.max(W, H) * .62);
  const am = PAL.amb;
  g.addColorStop(0, col(rgb, am.glow)); g.addColorStop(.4, col(rgb, am.glow * .35)); g.addColorStop(1, col(rgb, 0));
  b.fillStyle = g; b.fillRect(0, 0, W, H);
  // trame de points, alignée sur le centre de visée
  const P = 22; b.fillStyle = col(rgb, am.grid);
  for (let y = fy % P; y < H; y += P) for (let x = fx % P; x < W; x += P) {
    const inS = x > SX - 1 && x < SX + SW + 1; b.globalAlpha = inS ? 1 : .45; b.fillRect(x - .5, y - .5, 1, 1);
  }
  b.globalAlpha = 1;
  // cercles de portée et réticule
  b.strokeStyle = col(rgb, .075); b.lineWidth = 1;
  for (const k of [1.55, 2.3, 3.3, 4.6]) { b.beginPath(); b.arc(fx, fy, RD * k, 0, TAU); b.stroke(); }
  b.beginPath(); b.moveTo(0, fy + .5); b.lineTo(W, fy + .5); b.moveTo(fx + .5, 0); b.lineTo(fx + .5, H); b.stroke();
  // orbites lointaines inclinées (propres à chaque monde), en pointillés très discrets
  const D = DEEP[Math.min(PAL.w, DEEP.length - 1)];
  b.setLineDash([1, 5]); b.strokeStyle = col(rgb, .16);
  for (const o of D.orbits) { b.beginPath(); b.ellipse(fx, fy, RD * o[0], RD * o[0] * o[1], o[2], 0, TAU); b.stroke(); }
  b.setLineDash([]);
  bgF.x = fx; bgF.y = fy;
  // plan le plus lointain du ciel : fixe, peint une fois dans le fond (les deux plans proches tournent, drawSky)
  if (starW !== PAL.w) buildStars();
  const ext = Math.hypot(Math.max(fx, W - fx), Math.max(fy, H - fy)), hudY = LAUNCH - 8;
  b.fillStyle = starCol[0];
  for (let i = 0; i < starN; i++) {
    if (SX_Z[i] !== 0) continue;
    const rr = SX_R[i] * ext, x = fx + SX_A[i] * rr, y = fy + SX_U[i] * rr;
    b.globalAlpha = (.18 + .14 * (i & 3) / 3) * (rr < RD * 1.02 || y > hudY ? .25 : 1); b.fillRect(x - .55, y - .55, 1.1, 1.1);
  }
  b.globalAlpha = 1;
  // cadre de l'écran de jeu : équerres aux coins
  const x0 = SX + 5.5, x1 = SX + SW - 5.5, y0 = Math.max(5, SAT) + .5, y1 = H - Math.max(5, SAB) - .5, k = 12;
  b.strokeStyle = col(rgb, .42); b.beginPath();
  b.moveTo(x0, y0 + k); b.lineTo(x0, y0); b.lineTo(x0 + k, y0); b.moveTo(x1 - k, y0); b.lineTo(x1, y0); b.lineTo(x1, y0 + k);
  b.moveTo(x1, y1 - k); b.lineTo(x1, y1); b.lineTo(x1 - k, y1); b.moveTo(x0 + k, y1); b.lineTo(x0, y1); b.lineTo(x0, y1 - k); b.stroke();
  if (SX > 8) { b.strokeStyle = col(rgb, .1); b.beginPath(); b.moveTo(SX + .5, 0); b.lineTo(SX + .5, H); b.moveTo(SX + SW - .5, 0); b.lineTo(SX + SW - .5, H); b.stroke(); }
  // vignette
  g = b.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .45, W / 2, H / 2, Math.max(W, H) * .8);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.55)');
  b.fillStyle = g; b.fillRect(0, 0, W, H);
}

// ciel du monde : positions polaires tirées d'une graine (le même ciel à chaque visite), couleurs par plan
function buildStars() {
  const D = DEEP[Math.min(PAL.w, DEEP.length - 1)], r = rng(9157 + PAL.w * 101), wh = [255, 255, 255];
  starW = PAL.w; starN = D.n;
  for (let i = 0; i < starN; i++) { const a = r() * TAU; SX_A[i] = Math.cos(a); SX_U[i] = Math.sin(a); SX_R[i] = Math.sqrt(r()); SX_Z[i] = r() < .55 ? 0 : r() < .7 ? 1 : 2; }
  for (let z = 0; z < 3; z++) starCol[z] = col(mixRGB(PAL.rgb, wh, .35 + z * .2).map(Math.round), 1);
}
function drawSky(c) {
  if (starW !== PAL.w) buildStars();
  const D = DEEP[Math.min(PAL.w, DEEP.length - 1)], fx = bgF.x, fy = bgF.y, ext = Math.hypot(Math.max(fx, W - fx), Math.max(fy, H - fy)), still = rm();
  const tt = still ? 0 : time, inner = RD * 1.02, hudY = L && state !== 'menu' && state !== 'levels' ? LAUNCH - 8 : 0;   // HUD du bas : ciel estompé
  // une rotation (cos, sin) par plan, quatre phases de scintillement : aucune trigonométrie par étoile
  for (let z = 1; z < 3; z++) {
    const w = D.w * (.35 + z * .45) * (D.ctr && z === 1 ? -1 : 1), base = .3 + z * .2, sz = z === 2 ? 2 : z ? 1.5 : 1.1, cs = Math.cos(tt * w), sn = Math.sin(tt * w);
    for (let k = 0; k < 4; k++) TWK[k] = base * (still ? 1 : .6 + .4 * Math.sin(tt * (1.3 + z * .7) + k * 1.7));
    c.fillStyle = starCol[z];
    for (let i = 0; i < starN; i++) {
      if (SX_Z[i] !== z) continue;
      const rr = SX_R[i] * ext, x = fx + (SX_A[i] * cs - SX_U[i] * sn) * rr, y = fy + (SX_U[i] * cs + SX_A[i] * sn) * rr;
      if (x < -2 || y < -2 || x > W + 2 || y > H + 2) continue;
      // les étoiles s'effacent dans le cadran et sous le HUD du bas : le jeu reste plus net que le décor
      const fade = rr < inner || (hudY && y > hudY) ? .25 : 1;
      c.globalAlpha = TWK[i & 3] * fade; c.fillRect(x - sz / 2, y - sz / 2, sz, sz);
      if (z === 2 && (i & 7) === 0 && fade === 1) { c.globalAlpha *= .55; c.fillRect(x - 3, y - .5, 6, 1); c.fillRect(x - .5, y - 3, 1, 6); }
    }
  }
  // satellites sur les orbites lointaines
  c.fillStyle = col(PAL.rgb, 1);
  for (let k = 0; k < D.orbits.length; k++) {
    const o = D.orbits[k], a = (still ? 1 + k * 2.1 : time * (.05 + .02 * k) * (k & 1 ? -1 : 1)) + k * 2.1, rx = RD * o[0], ry = rx * o[1];
    const ex = Math.cos(a) * rx, ey = Math.sin(a) * ry, co = Math.cos(o[2]), si = Math.sin(o[2]);
    const x = fx + ex * co - ey * si, y = fy + ex * si + ey * co;
    if (x < -4 || y < -4 || x > W + 4 || y > H + 4 || Math.hypot(x - fx, y - fy) < RD * 1.15) continue;
    c.globalAlpha = .45; c.beginPath(); c.arc(x, y, 1.8, 0, TAU); c.fill();
    c.globalAlpha = .12; c.beginPath(); c.arc(x, y, 5, 0, TAU); c.fill();
  }
  c.globalAlpha = 1;
}

/* ---------- lueurs pré-rendues ---------- */
// une tache de lumière (dégradé radial : cœur blanc, couleur, transparent) par couleur, créée une fois et réutilisée ;
// dessinée en mode additif sur le canvas net seulement (jamais dans la couche phosphore : pas de traînée)
const SPR = new Map();
function glowSprite(rgb) {
  const k = rgb[0] << 16 | rgb[1] << 8 | rgb[2]; let s = SPR.get(k);
  if (!s) {
    s = document.createElement('canvas'); s.width = s.height = 64;
    const g = s.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.16, col(rgb, .9)); gr.addColorStop(.42, col(rgb, .3)); gr.addColorStop(1, col(rgb, 0));
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64); SPR.set(k, s);
  }
  return s;
}
function blob(c, rgb, x, y, r, a) {
  if (!(a > 0) || !(r > 0)) return;
  c.globalCompositeOperation = 'lighter'; c.globalAlpha = Math.min(1, a);
  c.drawImage(glowSprite(rgb), x - r, y - r, 2 * r, 2 * r);
  c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
}
// brume colorée (sans cœur blanc) pour la lueur changeante de Cosmos
const HAZE = new Map();
function hazeSprite(rgb) {
  const k = rgb[0] << 16 | rgb[1] << 8 | rgb[2]; let s = HAZE.get(k);
  if (!s) {
    s = document.createElement('canvas'); s.width = s.height = 64;
    const g = s.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, col(rgb, 1)); gr.addColorStop(.5, col(rgb, .35)); gr.addColorStop(1, col(rgb, 0));
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64); HAZE.set(k, s);
  }
  return s;
}
// Cosmos : la lueur du fond change lentement de teinte (cycle de 60 s, plan 5.2), fondu entre deux teintes voisines
const COSMOS_HUES = [[120, 160, 255], [190, 110, 255], [255, 92, 207], [255, 150, 120], [110, 230, 210], [140, 200, 255]];
// (teinte quantifiée en 8 pas entre deux teintes voisines : au plus 48 petites textures, une seule composition par image)
const HAZE_Q = [0, 0, 0];
function drawCosmosHaze(c) {
  const n = COSMOS_HUES.length, ph = (rm() ? 0 : time / 60 * n) % n, i = Math.floor(ph), f = Math.floor((ph - i) * 8) / 8, r = Math.max(W, H) * .62, x = bgF.x, y = bgF.y;
  const a = COSMOS_HUES[i], b = COSMOS_HUES[(i + 1) % n];
  for (let k = 0; k < 3; k++) HAZE_Q[k] = Math.round(a[k] + (b[k] - a[k]) * f);
  c.globalCompositeOperation = 'lighter'; c.globalAlpha = .16;
  c.drawImage(hazeSprite(HAZE_Q), x - r, y - r, 2 * r, 2 * r);
  c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
}
// liseré d'alerte sur les bords de l'écran (échec) : trois cadres concentriques de plus en plus pâles vers l'intérieur
// (seule une bande le long des bords est remplie : bon marché même sans accélération graphique)
function drawAlertEdge(c, rgb, a) {
  c.strokeStyle = col(rgb, 1);
  for (let k = 0; k < 3; k++) { const w = 6 + k * 8; c.globalAlpha = a * (.5 - k * .15); c.lineWidth = w; c.strokeRect(w / 2 - 1, w / 2 - 1, W - w + 2, H - w + 2); }
  c.globalAlpha = 1;
}
// éclairs d'impact : segment du bord qui flashe au point d'impact (angle dans le repère de l'astre)
const HITS = [{ a: 0, life: 0 }, { a: 0, life: 0 }, { a: 0, life: 0 }, { a: 0, life: 0 }];
let hitI = 0;
const HIT_T = .2;
function addHit(a) { const h = HITS[hitI]; hitI = (hitI + 1) % HITS.length; h.a = a; h.life = HIT_T; }

/* ---------- rendu ---------- */
function syncScene() {
  const S = GSC;
  const ro = RV.rot;
  S.drot = sweep(ro, S.rot);
  S.x = cx; S.y = cy - pulse * 3; S.r = R; S.pl = PL; S.head = HEAD; S.rot = ro; S.stuck = stuck;
  if (arcsDirty) { arcs = litArcs(); arcsDirty = false; }
  if (L.zones.length) arcs = litArcsAt(RV.t);   // bord allumé = sûr maintenant, zones actives retirées
  S.arcs = arcs; S.walls = L.walls; S.zones = L.zones; S.orbs = L.orbs; S.sents = L.sents; S.st = RV.t; S.rs = RS; S.trav = L.trav;
  S.rgb = PAL.rgb; S.hi = PAL.hi; S.acc = PAL.acc; S.solid = SOL[PAL.solid]; S.boss = L.boss; S.build = build;
  S.lock = state === 'winning' ? Math.min(1, winT / .26) : 0;
  project(S.solid, ro, TILT, ro * .6 + .4);
  if (S.boss) project(SOL.octa, -ro * 1.3, .8, ro * .9);
  // aiguille en vol : pointe à l'instant présent, et position de l'image précédente pour la traînée du phosphore
  for (const f of flights) { const ys = pinYs(flyU(f), f.ys || (f.ys = [0, 0])); f.pEnd = f.yEnd === undefined ? ys[1] : f.yEnd; f.yTip = ys[0]; f.yEnd = ys[1]; }
  // viseur d'avance : où tomberait une aiguille lancée maintenant (même prédiction que le jeu)
  if (state === 'play') {
    const pr = predict(t), la = pr.a;
    leadA = HPI - (pr.rot - rot); leadOk = true;
    for (const s of stuck) if (angDiff(s.a, la) < GAP || (L.trav && angDiff(s.a, la + Math.PI) < GAP)) { leadOk = false; break; }
    if (leadOk && L.zones.length && (zoneAt(la, pr.tI) || (L.trav && zoneAt(norm(la + Math.PI), pr.tI)))) leadOk = false;
  }
}
function heroRect() {
  if (!hero || --heroTick <= 0) { const q = $('spacer').getBoundingClientRect(); hero = { x: q.left + q.width / 2, y: q.top + q.height / 2, h: q.height }; heroTick = 30; }
  return hero;
}
function syncMenu() {
  const S = MSC, q = heroRect();
  S.r = q.h > 40 ? Math.max(18, Math.min(R * 1.15, (q.h + 6) / 4.75, SW * .2)) : 0;
  S.drot = sweep(demo.rot, S.rot);
  S.x = cx; S.y = q.y; S.pl = S.r; S.head = GAP * S.r; S.rot = demo.rot; S.stuck = demo.stuck; S.arcs = demo.arcs;
  S.walls = NONE; S.zones = NONE; S.orbs = NONE; S.sents = NONE; S.st = 0; S.rs = 0; S.trav = false;
  S.rgb = PAL.rgb; S.hi = PAL.hi; S.acc = PAL.acc; S.solid = SOL[PAL.solid]; S.boss = false; S.build = demo.born === undefined ? 1 : demo.born; S.lock = 0;
  project(S.solid, demo.rot, TILT, demo.rot * .6 + .4);
}
const NONE = [];
// rotation depuis l'image précédente (traînée continue des têtes dans le phosphore) ; nulle après un saut (relance)
function sweep(ro, prev) { const d = prev === undefined ? 0 : ro - prev; return Math.abs(d) < .35 ? d : 0; }

// compte-tours de l'accélération (à chaque aiguille, ou rampe avec le temps) : les graduations du cadran s'allument (depuis le haut, dans le sens horaire) à mesure
// que l'astre accélère, jusqu'au plafond
function drawTach(c, g) {
  const A = L.accel, fr = A ? clamp((accelMult(RV.t) - 1) / Math.max(1e-6, A.cap - 1), 0, 1) : clamp((rampMult(RV.t) - 1) / L.ramp.k, 0, 1), n = Math.round(fr * 72);
  if (!n) return;
  c.globalAlpha = g ? .5 : .95; c.strokeStyle = col(PAL.acc, 1); c.lineWidth = g ? 3 : 1.6; c.lineCap = 'round'; c.beginPath();
  for (let i = 0; i < n; i++) {
    const an = -HPI + (i + .5) * TAU / 72, r1 = RD + (i % 6 === 0 ? 8 : 5), cs = Math.cos(an), sn = Math.sin(an);
    if (Math.abs(an - HPI) < .05) continue;
    c.moveTo(cx + cs * (RD + 1.5), cy + sn * (RD + 1.5)); c.lineTo(cx + cs * r1, cy + sn * r1);
  }
  c.stroke(); c.globalAlpha = 1;
}
function drawDial(c, x, y, rd, rgb, a) {
  c.lineWidth = 1; c.strokeStyle = col(rgb, 1);
  c.globalAlpha = .2 * a; c.beginPath(); c.arc(x, y, rd, 0, TAU); c.stroke();
  c.globalAlpha = .55 * a; c.beginPath();
  for (let i = 0; i < 72; i++) {
    if (i === 18) continue;   // l'axe de tir reste dégagé
    const an = i * TAU / 72, r1 = rd + (i % 6 === 0 ? 7 : 3.5), cs = Math.cos(an), sn = Math.sin(an);
    c.moveTo(x + cs * (rd + 1.5), y + sn * (rd + 1.5)); c.lineTo(x + cs * r1, y + sn * r1);
  }
  c.stroke();
  if (rd > 110) {
    c.globalAlpha = .5 * a; c.beginPath();
    for (let i = 1; i < 12; i++) {
      if (i % 3 === 0) continue;
      const an = i * TAU / 12, lab = String((i * 30 + 90) % 360).padStart(3, '0'), tw = vwidth(lab, 5);
      vpath(c, lab, x + Math.cos(an) * (rd + 16) - tw / 2, y + Math.sin(an) * (rd + 16) - 2.5, 5);
    }
    c.stroke();
  }
  // tête de lecture (en haut) et repère de tir (en bas)
  c.globalAlpha = (.5 + .5 * headFlash) * a; c.fillStyle = col(rgb, 1);
  c.beginPath(); c.moveTo(x, y - rd + 7); c.lineTo(x - 4, y - rd - 1); c.lineTo(x + 4, y - rd - 1); c.closePath(); c.fill();
  c.globalAlpha = .8 * a; c.beginPath(); c.moveTo(x - 5, y + rd + 7); c.lineTo(x, y + rd); c.lineTo(x + 5, y + rd + 7); c.stroke();
  c.globalAlpha = 1;
}

function drawBody(c, g, S) {
  const x = S.x, y = S.y, r = S.r, ro = S.rot, rgb = S.rgb, pl = S.pl, hd = S.head, B = S.build, eB = easeOut(B);
  const lw = Math.max(1.3, r * .022), C = col(rgb, 1), HI = col(S.hi, 1), ACC = col(S.acc, 1), rh = r + pl, st = S.stuck;
  c.lineCap = 'round'; c.lineJoin = 'round';
  // --- solide filaire : arêtes arrière atténuées, avant franches ---
  const sol = S.solid, rr = r * (.7 + .3 * eB);
  // profondeur : quatre plans, du fond (fin, estompé) à l'avant (franc, un peu plus épais)
  c.strokeStyle = C;
  if (!g) {
    c.globalAlpha = .16 * B; c.lineWidth = lw * .65; strokeSolidBand(c, sol, x, y, rr, -9, -.6);
    c.globalAlpha = .36 * B; c.lineWidth = lw * .75; strokeSolidBand(c, sol, x, y, rr, -.6, 0);
    c.globalAlpha = .72 * B; c.lineWidth = lw * .9; strokeSolidBand(c, sol, x, y, rr, 0, .6);
    c.globalAlpha = B; c.lineWidth = lw * 1.15; strokeSolidBand(c, sol, x, y, rr, .6, 9);
  } else { c.globalAlpha = .34 * B; c.lineWidth = lw * 2.4; strokeSolid(c, sol, x, y, rr, true); }
  if (S.boss) {
    c.globalAlpha = (g ? .34 : .95) * B; c.strokeStyle = g ? C : HI; strokeSolid(c, SOL.octa, x, y, rr, true);
    if (!g) { c.globalAlpha = .4 * B; strokeSolid(c, SOL.octa, x, y, rr, false); c.strokeStyle = C; c.setLineDash([2, 5]); c.globalAlpha = .7 * B; c.lineWidth = lw; c.beginPath(); c.arc(x, y, r * .93, ro, ro + TAU); c.stroke(); c.setLineDash([]); }
  }
  if (!g && sol.dots) {
    c.globalAlpha = .95 * B; c.fillStyle = HI; c.beginPath();
    for (let i = 0; i < sol.n; i++) if (sol.pz[i] > 0) { const vx = x + sol.px[i] * rr, vy = y + sol.py[i] * rr, q = 1 + sol.pz[i] * 1.1; c.moveTo(vx + q, vy); c.arc(vx, vy, q, 0, TAU); }
    c.fill();
  }
  // --- bord : seuls les arcs LIBRES sont allumés ---
  c.strokeStyle = C;
  if (!g) { c.globalAlpha = .24 * B; c.lineWidth = 1; c.beginPath(); c.arc(x, y, r, 0, TAU); c.stroke(); }
  c.globalAlpha = (g ? .5 : 1) * B; c.lineWidth = g ? lw * 3 : lw * 1.6; c.beginPath();
  const full = S.arcs.length === 1 && S.arcs[0][1] - S.arcs[0][0] >= TAU - .001;
  for (const q of S.arcs) {
    const a0 = q[0] + ro, a1 = q[1] + ro, c0 = Math.cos(a0), s0 = Math.sin(a0);
    c.moveTo(x + c0 * r, y + s0 * r); c.arc(x, y, r, a0, a1);
    if (!g && !full) { const c1 = Math.cos(a1), s1 = Math.sin(a1); c.moveTo(x + c0 * (r - 3.5), y + s0 * (r - 3.5)); c.lineTo(x + c0 * (r + 3.5), y + s0 * (r + 3.5)); c.moveTo(x + c1 * (r - 3.5), y + s1 * (r - 3.5)); c.lineTo(x + c1 * (r + 3.5), y + s1 * (r + 3.5)); }
  }
  c.stroke();
  if (S.lock > 0) { c.globalAlpha = S.lock * (g ? .6 : 1); c.strokeStyle = HI; c.lineWidth = g ? lw * 4 : lw * 2; c.beginPath(); c.arc(x, y, r, 0, TAU); c.stroke(); }
  // --- arcs pleins (zones interdites) ---
  for (const wl of S.walls) {
    const A0 = wl.a0 + ro, A1 = wl.a1 + ro;
    c.beginPath(); c.arc(x, y, rh, A0, A1);
    if (g) { c.globalAlpha = .3 * B; c.strokeStyle = C; c.lineWidth = hd * 2; c.stroke(); continue; }
    c.globalAlpha = B; c.strokeStyle = C; c.lineWidth = hd * 2; c.stroke();
    c.strokeStyle = INK; c.lineWidth = hd * 2 - lw * 2.2; c.stroke();
    c.globalAlpha = .2 * B; c.strokeStyle = C; c.stroke();
    c.globalAlpha = .75 * B; c.lineWidth = lw * .9; c.beginPath();
    const k = Math.max(2, Math.round((A1 - A0) / .16));
    for (let i = 0; i <= k; i++) { const an = A0 + (A1 - A0) * i / k, cs = Math.cos(an), sn = Math.sin(an), edge = i === 0 || i === k; c.moveTo(x + cs * (edge ? r : rh - hd * .55), y + sn * (edge ? r : rh - hd * .55)); c.lineTo(x + cs * (edge ? rh - hd : rh + hd * .55), y + sn * (edge ? rh - hd : rh + hd * .55)); }
    c.stroke();
  }
  // --- zones pulsées : éteinte (pointillés discrets), annoncée (contour pointillé qui clignote), active (bande hachurée) ---
  if (S.zones.length) for (const z of S.zones) if (z.kind === 'pulse') drawZone(c, g, S, z, lw);
  // --- balises pré-placées : tige + tête creuse ---
  c.globalAlpha = (g ? .3 : .85) * B; c.strokeStyle = C; c.lineWidth = g ? lw * 2.2 : lw; c.beginPath();
  for (const s of st) { if (!s.pre || s.wall) continue; const wa = s.a + ro, cs = Math.cos(wa), sn = Math.sin(wa), r1 = r + pl * eB - hd; c.moveTo(x + cs * (r - 2), y + sn * (r - 2)); c.lineTo(x + cs * r1, y + sn * r1); }
  c.stroke();
  // --- aiguilles lancées : tige blanche (têtes : drawHeads) ---
  c.globalAlpha = g ? .45 : 1; c.strokeStyle = HI; c.lineWidth = g ? lw * 2.4 : lw * 1.2; c.beginPath();
  for (const s of st) {
    if (s.pre || s.twin) continue;
    const k = s.k, e = easeOut(k); let wa = s.a + ro; if (k < 1) wa += Math.sin(k * 19) * (1 - k) * .03;
    const cs = Math.cos(wa), sn = Math.sin(wa), r0 = r - 2 - (1 - e) * 5;
    if (s.tr) { const rb = r + pl * easeOut(s.tw.k); c.moveTo(x + cs * rh, y + sn * rh); c.lineTo(x + cs * (r - 2), y + sn * (r - 2)); c.moveTo(x - cs * (r - 2), y - sn * (r - 2)); c.lineTo(x - cs * rb, y - sn * rb); }
    else { c.moveTo(x + cs * r0, y + sn * r0); c.lineTo(x + cs * rh, y + sn * rh); }
  }
  c.stroke();
  if (S.trav && !g) {
    c.globalAlpha = .34; c.setLineDash([3, 4]); c.beginPath();
    for (const s of st) { if (!s.tr) continue; const wa = s.a + ro, cs = Math.cos(wa), sn = Math.sin(wa); c.moveTo(x + cs * (r - 2), y + sn * (r - 2)); c.lineTo(x - cs * (r - 2), y - sn * (r - 2)); }
    c.stroke(); c.setLineDash([]);
  }
  // --- étoiles bonus : éclat à quatre branches + arc de capture sur le bord ---
  for (const o of S.orbs) {
    if (o.hit) continue;
    const wa = o.a + ro, d = r + pl * .55, ox = x + Math.cos(wa) * d, oy = y + Math.sin(wa) * d, pz = 1 + .12 * Math.sin(time * 5 + o.a * 3);
    c.beginPath(); starPath(c, ox, oy, hd * 1.9 * pz, hd * .62 * pz, time * .7 + o.a, 4); c.closePath();
    if (!g) { c.globalAlpha = .28 * B; c.fillStyle = ACC; c.fill(); }
    c.globalAlpha = (g ? .5 : 1) * B; c.strokeStyle = ACC; c.lineWidth = g ? lw * 2.2 : lw * 1.1; c.stroke();
    if (!g) {
      c.globalAlpha = .8 * B; c.lineWidth = lw; c.beginPath(); c.arc(x, y, r + 5, wa - ORBHIT, wa + ORBHIT); c.stroke();
      c.globalAlpha = .4 * B; c.setLineDash([1.5, 4]); c.beginPath(); c.moveTo(x + Math.cos(wa) * (r + 7), y + Math.sin(wa) * (r + 7)); c.lineTo(x + Math.cos(wa) * (d - hd * 2.2), y + Math.sin(wa) * (d - hd * 2.2)); c.stroke(); c.setLineDash([]);
    }
  }
  // --- sentinelles : arcs en orbite extérieure. Codage par la forme (ART-3) : obstacle mobile = barre pleine ; zone
  // interdite = bande hachurée creuse ; bloqueur = tête creuse ; aiguille du joueur = tête pleine ---
  if (S.sents.length) {
    if (!g) { c.setLineDash([1.5, 7]); c.globalAlpha = .45 * B; c.strokeStyle = C; c.lineWidth = 1.2; c.beginPath(); c.arc(x, y, S.rs, 0, TAU); c.stroke(); c.setLineDash([]); }
    for (const q of S.sents) {
      const sa = q.a0 + q.w * S.st, hot = failInfo && failInfo.sent === q;
      c.beginPath(); c.arc(x, y, S.rs, sa - q.hw, sa + q.hw);
      c.strokeStyle = hot ? col(PAL.alert, 1) : HI; c.lineWidth = SENT_HW * 2;
      if (g) { c.globalAlpha = .4 * B; c.stroke(); continue; }
      c.globalAlpha = B; c.stroke();
      // sillage : sens de déplacement de la sentinelle
      const dw = q.w > 0 ? -1 : 1;
      c.globalAlpha = .35 * B; c.lineWidth = 1.2; c.beginPath(); c.arc(x, y, S.rs, Math.min(sa + dw * q.hw, sa + dw * (q.hw + .22)), Math.max(sa + dw * q.hw, sa + dw * (q.hw + .22))); c.stroke();
    }
  }
  c.globalAlpha = 1;
}

// Anneaux à portes : barres pleines (obstacles mobiles) interrompues par les portes, repères aux bords des portes ; portes
// pulsées : annoncées en pointillés qui clignotent, fermées en barre pleine. Losange sur l'axe de tir : plein quand la
// porte de cet anneau sera alignée pour un tir lancé maintenant.
function ringBar() { return Math.max(2.4, HEAD * .38); }
const RING_VIS = .95, RING_FADE = 1.35;
// only : un seul anneau (feuille d'échec) ; clipY : ordonnée à l'écran sous laquelle rien n'est dessiné (filet du panneau)
function drawRings(c, g, only, clipY) {
  const bw = ringBar(), now = RV.t;
  if (clipY) {
    // coupe exprimée dans le repère de la scène, déplacée et réduite par failView
    const e = easeOut(FV.k), s = 1 + (FV.s - 1) * e, dy = FV.dy * e, ys = FV.A + (clipY - (FV.A - dy)) / s;
    c.save(); c.beginPath(); c.rect(-1e4, -1e4, 2e4 + W, ys + 1e4); c.clip();
  }
  c.lineCap = 'butt';
  for (const q of L.rings) {
    if (only && q !== only) continue;
    const rr = RRAD[q.k], th = q.a0 + q.w * now, hot = failInfo && failInfo.ring === q, gs = gateState(q, now), n = q.gates.length;
    const colr = col(hot ? PAL.alert : PAL.rgb, 1), cut = q.gates.map(gt => [th + gt.c - gt.h, th + gt.c + gt.h]);
    // seule la partie basse compte (le couloir de tir) : arc plein sur ±RING_VIS, estompé au-delà, rien en haut de l'écran
    c.strokeStyle = colr; c.lineWidth = g ? bw * 2.6 : bw;
    for (const [span, al] of [[RING_FADE, .3], [RING_VIS, .95]]) {
      c.globalAlpha = (g ? .4 : 1) * al; c.beginPath();
      for (const [a, b] of subtractArcs([[HPI - span, HPI + span]], cut)) { c.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); c.arc(cx, cy, rr, a, b); }
      c.stroke();
    }
    if (!g) {
      // repères aux bords des portes
      c.lineWidth = 1.2; c.globalAlpha = .8; c.beginPath();
      for (const gt of q.gates) for (const e of [-1, 1]) {
        const an = th + gt.c + e * gt.h; if (Math.abs(angSigned(HPI, an)) > RING_FADE) continue;
        const cs = Math.cos(an), sn = Math.sin(an); c.moveTo(cx + cs * (rr - 5), cy + sn * (rr - 5)); c.lineTo(cx + cs * (rr + 5), cy + sn * (rr + 5));
      }
      c.stroke();
    }
    // portes pulsées : annoncées (pointillés qui clignotent) puis fermées (barre pleine)
    if (gs) {
      const bl = gs === 1 ? (rm() ? 1 : .5 + .5 * Math.sin(time * 18)) : 1;
      c.globalAlpha = (g ? .4 : .95) * bl; c.lineWidth = g ? bw * 2.6 : bw; c.setLineDash(gs === 1 ? [4, 4] : []);
      c.beginPath(); for (const gt of q.gates) { if (Math.abs(angSigned(HPI, th + gt.c)) > RING_FADE + gt.h) continue; const a0 = th + gt.c - gt.h, a1 = th + gt.c + gt.h; c.moveTo(cx + Math.cos(a0) * rr, cy + Math.sin(a0) * rr); c.arc(cx, cy, rr, a0, a1); }
      c.stroke(); c.setLineDash([]);
    }
    // losange de synchronisation sur l'axe de tir
    {
      const w = ringWindow(q, now), ok = state === 'play' && ringHit(q, w[0], w[1], RING_PAD[q.k]) < 0, yd = cy + rr, s = 5;
      c.globalAlpha = g ? (ok ? .5 : 0) : 1; c.lineWidth = 1.4; c.strokeStyle = col(ok ? PAL.hi : PAL.rgb, 1); c.fillStyle = INK;
      c.beginPath(); c.moveTo(cx, yd - s); c.lineTo(cx + s, yd); c.lineTo(cx, yd + s); c.lineTo(cx - s, yd); c.closePath();
      if (!g) { c.fill(); if (ok) { c.fillStyle = col(PAL.hi, 1); c.fill(); } }
      c.stroke();
    }
  }
  c.lineCap = 'round'; c.globalAlpha = 1;
  if (clipY) c.restore();
}

// bande d'une zone dynamique sur le cercle des têtes : [centre ± hw] (la tête d'une aiguille qui la touche est perdue)
function drawZone(c, g, S, z, lw) {
  const x = S.x, y = S.y, r = S.r, rh = r + S.pl, hd = S.head, B = S.build, C = col(S.rgb, 1), st = zoneState(z, S.st), zc = zoneCenter(z, S.st) + S.rot;
  const A0 = zc - z.hw, A1 = zc + z.hw;
  if (st < 2) {
    if (g && st === 0) return;
    const bl = st === 1 ? (rm() ? 1 : .55 + .45 * Math.sin(time * 18)) : .3;
    c.globalAlpha = (g ? .3 : 1) * bl * B; c.strokeStyle = C; c.lineWidth = g ? 3 : st === 1 ? 1.6 : 1; c.setLineDash(st === 1 ? [5, 4] : [1.5, 5]);
    c.beginPath(); c.arc(x, y, rh - hd, A0, A1); c.arc(x, y, rh + hd, A1, A0, true); c.closePath(); c.stroke(); c.setLineDash([]);
    c.globalAlpha = 1; return;
  }
  c.beginPath(); c.arc(x, y, rh, A0, A1);
  if (g) { c.globalAlpha = .35 * B; c.strokeStyle = C; c.lineWidth = hd * 2; c.lineCap = 'butt'; c.stroke(); c.lineCap = 'round'; return; }
  c.lineCap = 'butt';
  c.globalAlpha = B; c.strokeStyle = C; c.lineWidth = hd * 2; c.stroke();
  c.strokeStyle = INK; c.lineWidth = hd * 2 - lw * 2.2; c.stroke();
  c.globalAlpha = .25 * B; c.strokeStyle = C; c.stroke();
  c.lineCap = 'round';
  c.globalAlpha = .85 * B; c.lineWidth = lw * .9; c.beginPath();
  const k = Math.max(2, Math.round((A1 - A0) / .12));
  for (let i = 0; i < k; i++) { const a1 = A0 + (A1 - A0) * i / k, a2 = A0 + (A1 - A0) * (i + 1) / k; c.moveTo(x + Math.cos(a1) * (rh - hd * .6), y + Math.sin(a1) * (rh - hd * .6)); c.lineTo(x + Math.cos(a2) * (rh + hd * .6), y + Math.sin(a2) * (rh + hd * .6)); }
  c.stroke(); c.globalAlpha = 1;
}

// Têtes des bloqueurs (creuses) et des aiguilles plantées (pleines), dessinées par-dessus les aiguilles en vol.
// Rayon extérieur dessiné (trait compris) = S.head = GAP × (R + PL) / 2 : deux têtes se touchent à l'écran
// exactement quand leur écart vaut GAP, l'écart de la règle de collision.
function headRing(lw, hd) { return { r: hd - lw * .625, w: lw * 1.25 }; }   // tête creuse : rayon du trait, épaisseur
function drawHeads(c, g, S) {
  const x = S.x, y = S.y, r = S.r, ro = S.rot, pl = S.pl, hd = S.head, B = S.build, eB = easeOut(B), st = S.stuck;
  const lw = Math.max(1.3, r * .022), hring = headRing(lw, hd);
  c.globalAlpha = (g ? .4 : 1) * B; c.strokeStyle = col(S.rgb, 1); c.lineWidth = g ? lw * 2.2 : hring.w; c.beginPath();
  for (const s of st) { if (!s.pre || s.wall) continue; const wa = s.a + ro, hx = x + Math.cos(wa) * (r + pl * eB), hy = y + Math.sin(wa) * (r + pl * eB), q = hring.r; c.moveTo(hx + q, hy); c.arc(hx, hy, q, 0, TAU); }
  c.stroke();
  const lockP = S.lock > 0 ? 1 + .4 * Math.sin(S.lock * Math.PI) : 1;
  // phosphore : chaque tête balaie l'arc parcouru depuis l'image précédente (traînée continue au lieu de copies
  // successives en escalier)
  if (g && S.drot) {
    const d = S.drot, p = Math.abs(d) > 1e-4;
    if (p) {
      c.lineCap = 'round';
      c.globalAlpha = .22 * B; c.strokeStyle = col(S.rgb, 1); c.lineWidth = hd * 2; c.beginPath();
      for (const s of st) { if (!s.pre || s.wall) continue; const wa = s.a + ro, rb = r + pl * eB; c.moveTo(x + Math.cos(wa - d) * rb, y + Math.sin(wa - d) * rb); c.arc(x, y, rb, wa - d, wa, d < 0); }
      c.stroke();
      c.globalAlpha = .34; c.strokeStyle = col(S.hi, 1); c.lineWidth = hd * 2; c.beginPath();
      for (const s of st) { if (s.pre) continue; const wa = s.a + ro, rb = r + pl * (s.twin ? easeOut(s.k) : 1); c.moveTo(x + Math.cos(wa - d) * rb, y + Math.sin(wa - d) * rb); c.arc(x, y, rb, wa - d, wa, d < 0); }
      c.stroke();
    }
  }
  c.globalAlpha = g ? .6 : 1; c.fillStyle = col(S.hi, 1); c.beginPath();
  const hr = hd * (g ? 1.2 : 1) * lockP;
  for (const s of st) {
    if (s.pre) continue;
    const wa = s.a + ro, rb = r + pl * (s.twin ? easeOut(s.k) : 1), hx = x + Math.cos(wa) * rb, hy = y + Math.sin(wa) * rb;
    c.moveTo(hx + hr, hy); c.arc(hx, hy, hr, 0, TAU);
  }
  c.fill();
  c.globalAlpha = 1;
}

// aiguille libre (pas de tir, vol) : pointe en yt, extrémité de la tête en ye
function drawPin(c, g, x, yt, ye, rgb, a) {
  const lw = Math.max(1.3, R * .022), yh = ye - HEAD;
  c.globalAlpha = a * (g ? .5 : 1); c.strokeStyle = col(rgb, 1); c.lineWidth = g ? lw * 2.4 : lw * 1.2; c.lineCap = 'round';
  c.beginPath(); c.moveTo(x, yt); c.lineTo(x, yh); c.stroke();
  c.fillStyle = col(rgb, 1); c.beginPath(); c.arc(x, yh, HEAD * (g ? 1.2 : 1), 0, TAU); c.fill();
  c.globalAlpha = 1;
}

function drawFx(c, g) {
  c.lineCap = 'round';
  for (const p of segs) {
    const k = clamp(p.life / p.max, 0, 1), dx = Math.cos(p.a) * p.len / 2, dy = Math.sin(p.a) * p.len / 2;
    c.globalAlpha = k * (g ? .35 : 1); c.strokeStyle = col(p.rgb, 1); c.lineWidth = g ? 3.2 : 1.5;
    c.beginPath(); c.moveTo(p.x - dx, p.y - dy); c.lineTo(p.x + dx, p.y + dy); c.stroke();
  }
  for (const p of sparks) {
    const k = clamp(p.life / p.max, 0, 1);
    c.globalAlpha = k * (g ? .4 : 1); c.strokeStyle = col(p.rgb, 1); c.lineWidth = g ? 3 : 1.4;
    c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - p.vx * .035, p.y - p.vy * .035); c.stroke();
  }
  for (const p of rings) {
    const k = clamp(p.life / p.max, 0, 1);
    c.globalAlpha = k * (g ? .22 : .9); c.strokeStyle = col(p.rgb, 1); c.lineWidth = g ? p.lw * 2.2 : p.lw;
    c.beginPath(); c.arc(p.x, p.y, Math.max(.5, p.r), 0, TAU); c.stroke();
  }
  if (!g) for (const x of texts) {
    c.globalAlpha = clamp(x.life * 2.5, 0, 1);
    vtext(c, x.txt, x.x, x.y, x.h, x.al, col(x.rgb, 1), 1.5);
  }
  c.globalAlpha = 1;
}

/* ---------- feuille d'échec : la scène remonte (et se réduit si besoin) pour garder la collision visible ---------- */
let sheetTop = 0;                                   // ordonnée du filet du panneau d'échec (px)
const FV = { k: 0, dy: 0, s: 1, A: 0 };             // avancement de l'animation, décalage vers le haut, échelle, ancre
function measureSheet() { const p = $('failPanel'); sheetTop = p ? p.offsetTop + 18 : 0; FV.k = 0; }
// boîte englobante (coordonnées de la scène) de ce qui doit rester visible : croix d'alerte, tête heurtée, sentinelle fautive
function failMarkBox() {
  if (!failInfo || !L) return null;
  const S = GSC, ro = S.rot === undefined ? rot : S.rot, q = HEAD * 1.9 + 2.4, b = { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 };
  const add = (x, y, r) => { b.x0 = Math.min(b.x0, x - r); b.x1 = Math.max(b.x1, x + r); b.y0 = Math.min(b.y0, y - r); b.y1 = Math.max(b.y1, y + r); };
  const y = cy - pulse * 3;
  if (failInfo.kind === 'ring') add(cx, cy + RRAD[failInfo.ring.k], q);   // interception par un anneau : sur l'axe de tir
  else if (failInfo.kind === 'sent') {
    add(cx, cy + RS, q);
    const qs = failInfo.sent, sa = qs.a0 + qs.w * RV.t;
    for (let i = 0; i <= 16; i++) { const an = sa - qs.hw + 2 * qs.hw * i / 16; add(cx + Math.cos(an) * RS, y + Math.sin(an) * RS, SENT_HW + 1); }
  } else {
    const fa = failInfo.a + ro; add(cx + Math.cos(fa) * (R + PL), y + Math.sin(fa) * (R + PL), q);
    const who = failInfo.who;
    if (who) { const wa = who.a + ro; add(cx + Math.cos(wa) * (R + PL), y + Math.sin(wa) * (R + PL), HEAD + 4); }
  }
  return b;
}
// décalage et échelle visés : d'abord remonter dans la marge libre sous le HUD, puis réduire autour du haut du cadran
function failViewTarget() {
  FV.A = cy - RD - 20; FV.dy = 0; FV.s = 1;
  const b = failMarkBox();
  if (!b || !sheetTop) return;
  const limit = sheetTop - 6;
  if (b.y1 <= limit) return;
  const dyMax = Math.max(0, FV.A - (Math.max(12, SAT) + 44));
  if (b.y1 - dyMax <= limit) { FV.dy = b.y1 - limit; return; }
  FV.dy = dyMax; FV.s = clamp((limit + dyMax - FV.A) / (b.y1 - FV.A), .4, 1);
}
function failView(c) {
  const e = easeOut(FV.k), s = 1 + (FV.s - 1) * e, dy = FV.dy * e;
  c.translate(cx, FV.A - dy); c.scale(s, s); c.translate(-cx, -FV.A);
}
// la même boîte à l'écran, transformation en cours comprise (pour les tests)
function failMarkScreen() {
  const b = failMarkBox(); if (!b) return null;
  const e = easeOut(FV.k), s = 1 + (FV.s - 1) * e, dy = FV.dy * e, X = x => cx + (x - cx) * s, Y = y => FV.A - dy + (y - FV.A) * s;
  return { x0: X(b.x0), y0: Y(b.y0), x1: X(b.x1), y1: Y(b.y1), filet: sheetTop };
}
const hudLeft = sheet => SX + (sheet ? 20 : 68);

function drawGame(c, g) {
  const S = GSC, rgb = PAL.rgb, hi = PAL.hi, lw = Math.max(1.3, R * .022);
  const sheet = state === 'won' || state === 'failed', moved = state === 'failed' && FV.k > 0;
  if (moved) { c.save(); failView(c); }
  if (L.accel || L.ramp) drawTach(c, g);
  if (!g) {
    drawDial(c, cx, cy, RD, rgb, 1);
    c.setLineDash([2, 6]); c.globalAlpha = .28; c.strokeStyle = col(rgb, 1); c.lineWidth = 1;
    c.beginPath(); c.moveTo(cx, cy + R + PL + HEAD + 8); c.lineTo(cx, LAUNCH - 9); c.stroke(); c.setLineDash([]); c.globalAlpha = 1;
  }
  if (!exploded) {
    drawBody(c, g, S);
    // viseur d'avance : petit index à l'intérieur du bord, plein si la zone est libre
    if (!g && state === 'play') {
      const cs = Math.cos(leadA), sn = Math.sin(leadA), tx = -sn, ty = cs, ra = R - 2.5, rb = R - 10;
      c.beginPath(); c.moveTo(S.x + cs * ra, S.y + sn * ra); c.lineTo(S.x + cs * rb + tx * 4.2, S.y + sn * rb + ty * 4.2); c.lineTo(S.x + cs * rb - tx * 4.2, S.y + sn * rb - ty * 4.2); c.closePath();
      c.lineWidth = 1.3; c.strokeStyle = col(hi, 1); c.fillStyle = col(hi, 1); c.globalAlpha = leadOk ? 1 : .55;
      if (leadOk) c.fill(); c.stroke(); c.globalAlpha = 1;
    }
    // éclairs d'impact : le segment du bord touché flashe, une lueur blanche au point de contact
    if (!g) for (const h of HITS) {
      if (h.life <= 0) continue;
      const k = h.life / HIT_T, wa = h.a + S.rot, sp = .16 + .22 * (1 - k);
      c.globalAlpha = k; c.strokeStyle = col(PAL.hi, 1); c.lineWidth = lw * (1 + 1.8 * k); c.lineCap = 'round';
      c.beginPath(); c.arc(S.x, S.y, R, wa - sp, wa + sp); c.stroke(); c.globalAlpha = 1;
      if (!rm()) blob(c, PAL.hi, S.x + Math.cos(wa) * R, S.y + Math.sin(wa) * R, HEAD * (2.2 + 1.6 * (1 - k)), .85 * k);
    }
    // marque de frôlement : l'intervalle serré, et un arc électrique entre les deux têtes au moment du frôlement
    if (nearMark && !g) {
      const a1 = nearMark.a1 + S.rot, a2 = nearMark.a2 + S.rot; let dlt = ((a2 - a1) % TAU + TAU * 1.5) % TAU - Math.PI;
      c.globalAlpha = clamp(nearMark.life * 2, 0, 1); c.strokeStyle = col(PAL.acc, 1); c.lineWidth = 1.4;
      c.beginPath(); c.arc(S.x, S.y, R + PL + HEAD + 5, Math.min(a1, a1 + dlt), Math.max(a1, a1 + dlt)); c.stroke(); c.globalAlpha = 1;
      const zk = (nearMark.life - .55) / .35;
      if (zk > 0) {
        const rh = R + PL, x1 = S.x + Math.cos(a1) * rh, y1 = S.y + Math.sin(a1) * rh, x2 = S.x + Math.cos(a2) * rh, y2 = S.y + Math.sin(a2) * rh;
        const dx = x2 - x1, dy = y2 - y1, dl = Math.hypot(dx, dy) || 1, nx = -dy / dl, ny = dx / dl, seed = rm() ? 1 : Math.floor(time * 40);
        c.globalAlpha = zk; c.strokeStyle = col(PAL.acc, 1); c.lineWidth = 1.5; c.lineJoin = 'miter'; c.beginPath(); c.moveTo(x1, y1);
        for (let i = 1; i < 5; i++) { const j = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453, o = (j - Math.floor(j) - .5) * HEAD * 1.4; c.lineTo(x1 + dx * i / 5 + nx * o, y1 + dy * i / 5 + ny * o); }
        c.lineTo(x2, y2); c.stroke(); c.lineJoin = 'round'; c.globalAlpha = 1;
        if (!rm()) { blob(c, PAL.acc, x1, y1, HEAD * 2.4, .6 * zk); blob(c, PAL.acc, x2, y2, HEAD * 2.4, .6 * zk); }
      }
    }
  }
  // anneaux : aucun derrière la feuille de victoire ; sur la feuille d'échec, seul l'anneau fautif, coupé au-dessus du filet
  // du panneau (les autres traverseraient les textes de la feuille)
  if (L.rings.length && state !== 'won') {
    if (state !== 'failed') drawRings(c, g);
    else if (failInfo && failInfo.ring) drawRings(c, g, failInfo.ring, sheetTop - 2);
  }
  // --- aiguille en vol / sur le pas de tir ---
  for (const f of flights) {
    if (f.yTip === undefined) continue;
    if (g) {
      c.globalAlpha = .5; c.strokeStyle = col(hi, 1); c.lineWidth = lw * 3; c.lineCap = 'round';
      c.beginPath(); c.moveTo(cx, f.yTip); c.lineTo(cx, Math.min(LAUNCH + PL, f.pEnd - HEAD)); c.stroke(); c.globalAlpha = 1;
    } else drawPin(c, g, cx, f.yTip, f.yEnd, hi, 1);
  }
  // têtes plantées par-dessus l'aiguille en vol, puis la croix d'alerte
  if (!exploded) {
    drawHeads(c, g, S);
    // zones glissantes : hachures dessinées par-dessus les aiguilles plantées (elles passent dessus sans effet)
    if (L.zones.length) for (const z of L.zones) if (z.kind === 'glide') drawZone(c, g, S, z, lw);
    // collision : croix d'alerte
    if (failInfo && (state === 'dying' || state === 'failed' || state === 'pause')) {
      const A = col(PAL.alert, 1); let fx, fy;
      if (failInfo.kind === 'sent') { fx = cx; fy = cy + RS; }
      else if (failInfo.kind === 'ring') { fx = cx; fy = cy + RRAD[failInfo.ring.k]; }
      else { const fa = failInfo.a + S.rot; fx = S.x + Math.cos(fa) * (R + PL); fy = S.y + Math.sin(fa) * (R + PL); }
      const who = failInfo.who, q = HEAD * 1.9, bl = rm() ? 1 : .65 + .35 * Math.sin(time * 14);
      c.strokeStyle = A; c.lineCap = 'round';
      if (who && failInfo.kind !== 'sent') {
        const wa = who.a + S.rot, hx = S.x + Math.cos(wa) * (R + PL), hy = S.y + Math.sin(wa) * (R + PL);
        c.globalAlpha = g ? .5 : bl; c.lineWidth = g ? 5 : 2; c.beginPath(); c.arc(hx, hy, HEAD + 3, 0, TAU);
        if (!who.wall) { c.moveTo(S.x + Math.cos(wa) * R, S.y + Math.sin(wa) * R); c.lineTo(S.x + Math.cos(wa) * (R + PL - HEAD - 3), S.y + Math.sin(wa) * (R + PL - HEAD - 3)); }
        c.stroke();
      }
      // pendant la chute (avant la feuille) : flash au point de contact et croix dédoublée (aberration chromatique) qui se
      // resserre ; la croix nette reste toujours dessinée par-dessus
      if (!g && state === 'dying' && !rm()) {
        const k = clamp(1 - dieT / FAIL_SHEET, 0, 1), o = 3.5 * k;
        blob(c, PAL.alert, fx, fy, HEAD * (3 + 4 * (1 - k)), clamp(1 - dieT / .12, 0, 1) * .95);
        c.globalAlpha = .55 * k; c.lineWidth = 2; c.strokeStyle = col(PAL.rgb, 1);
        c.beginPath(); c.moveTo(fx - q - o, fy - q); c.lineTo(fx + q - o, fy + q); c.moveTo(fx + q - o, fy - q); c.lineTo(fx - q - o, fy + q); c.stroke();
        c.strokeStyle = col(PAL.hi, 1);
        c.beginPath(); c.moveTo(fx - q + o, fy - q); c.lineTo(fx + q + o, fy + q); c.moveTo(fx + q + o, fy - q); c.lineTo(fx - q + o, fy + q); c.stroke();
        c.strokeStyle = A;
      }
      c.globalAlpha = g ? .6 : 1; c.lineWidth = g ? 6 : 2.4;
      c.beginPath(); c.moveTo(fx - q, fy - q); c.lineTo(fx + q, fy + q); c.moveTo(fx + q, fy - q); c.lineTo(fx - q, fy + q); c.stroke();
      c.globalAlpha = 1;
    }
  }
  // victoire : éclair blanc au cœur de l'astre quand il éclate
  if (!g && state === 'winning' && exploded && !rm()) { const k = clamp((winT - .26) / .4, 0, 1); blob(c, hi, cx, cy, R * (1.3 + 2.2 * easeOut(k)), (1 - k) * .7); }
  const counting = state === 'play' && playPhase === 'compte';
  if (state === 'play' && left > 0 && (!flying || flyU(flying) > U.len)) {
    const y = LAUNCH + (1 - easeOut(readyK)) * 26, rk = easeOut(readyK) * (counting ? .45 : 1);
    // aiguille prête : lueur qui respire sous la tête
    if (!g) blob(c, hi, cx, y + PL, HEAD * 3, rk * (rm() ? .3 : .26 + .1 * Math.sin(time * 3.2)));
    drawPin(c, g, cx, y, y + PL + HEAD, hi, rk);
  }
  // compte à rebours de REPRENDRE : 3-2-1 sur le pas de tir, anneau qui se vide, tir verrouillé
  if (counting) {
    const k = countT / COUNTDOWN, d = String(Math.max(1, Math.ceil(countT / (COUNTDOWN / 3)))), rr = 15, yc = LAUNCH - rr - 12, h = 14;
    c.lineCap = 'round';
    if (!g) { c.globalAlpha = .9; c.fillStyle = INK; c.beginPath(); c.arc(cx, yc, rr + 3, 0, TAU); c.fill(); }
    c.globalAlpha = g ? .3 : .35; c.strokeStyle = col(rgb, 1); c.lineWidth = g ? 3 : 1.2; c.beginPath(); c.arc(cx, yc, rr, 0, TAU); c.stroke();
    c.globalAlpha = g ? .6 : 1; c.strokeStyle = col(hi, 1); c.lineWidth = g ? 5 : 2; c.beginPath(); c.arc(cx, yc, rr, -HPI, -HPI + TAU * k); c.stroke();
    c.globalAlpha = g ? .5 : 1; vtext(c, d, cx - vwidth(d, h) / 2, yc - h / 2, h, 0, col(hi, 1), g ? 4 : 2);
    c.globalAlpha = 1;
  }
  if (!g && !sheet && state !== 'pause') {
    // berceau du pas de tir
    const by = LAUNCH + PL, q = HEAD + 5;
    c.globalAlpha = .6; c.strokeStyle = col(rgb, 1); c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(cx - q - 5, by - 4); c.lineTo(cx - q, by - 4); c.lineTo(cx - q, by + q); c.lineTo(cx + q, by + q); c.lineTo(cx + q, by - 4); c.lineTo(cx + q + 5, by - 4); c.stroke(); c.globalAlpha = 1;
  }
  if (state === 'play' && !counting) drawChevrons(c, g);
  drawFx(c, g);
  if (moved) c.restore();
  drawHud(c, g, sheet);
  if (state === 'won') drawWinStars(c, g);
}

// Chevrons de direction de part et d'autre du pas de tir : sens où défile le bord sous le point d'impact (vitesse > 0 :
// vers la gauche). Un arrêt ou une inversion à venir dans AHEAD s les fait clignoter à la couleur d'accent : barres
// « || » pour un arrêt, chevrons qui basculent pour une inversion ; astre arrêté : « || », et la reprise annoncée fait
// clignoter les chevrons dans son sens.
let chevron = { kind: null, dir: 0 };
// géométrie des chevrons et de la jauge ROTATION (dessin et tests de chevauchement)
function chevGeom() { const y = LAUNCH + PL * .4, s = 5.5, gap = HEAD + 9; return { y, s, gap, box: [cx - gap - 7.5, y - s - 1, cx + gap + 7.5, y + s + 1] }; }
function gaugeGeom() { const xr = SX + SW - 16, sw = Math.min(136, SW / 2 - 46), sx = xr - sw, sy = LAUNCH + 18, sh = 38; return { sx, sy, sw, sh, box: [sx, LAUNCH + 4, sx + sw + 9, sy + sh] }; }
function drawChevrons(c, g) {
  // les demi-tours programmés sont annoncés dès leur annonce (jusqu'à 0,9 s avant), les arrêts et inversions de la loi 0,45 s avant
  const ev = aheadEvent(RV.t, announceWindow()); chevron = { kind: ev.kind, dir: ev.dir, dt: ev.dt };
  const G = chevGeom(), y = G.y, s = G.s, gap = G.gap, blink = ev.kind ? (rm() ? 1 : Math.floor(time / .12) % 2) : 0;
  const v = Math.abs(speedAt(RV.t)) / Math.max(.1, L.vmax), base = .35 + .55 * clamp(v, 0, 1);
  let d = ev.dir;
  if (ev.kind === 'flip' && blink) d = -ev.dir;
  c.lineCap = 'round'; c.lineJoin = 'round';
  c.globalAlpha = g ? .45 * (ev.kind ? 1 : base) : ev.kind ? 1 : base;
  c.strokeStyle = col(ev.kind ? PAL.acc : PAL.rgb, 1); c.lineWidth = g ? 3.6 : 1.7;
  c.beginPath();
  for (const side of [-1, 1]) {
    const x0 = cx + side * gap;
    if (ev.kind === 'stop' && blink || d === 0 || ev.kind === 'go' && !blink) { c.moveTo(x0 - 3, y - s); c.lineTo(x0 - 3, y + s); c.moveTo(x0 + 3, y - s); c.lineTo(x0 + 3, y + s); continue; }
    // d > 0 : le bord défile vers la gauche → « < < »
    for (const k of [0, 1]) { const xa = x0 + (k * 7 - 3.5) * (d > 0 ? 1 : -1); c.moveTo(xa + d * s * .7, y - s); c.lineTo(xa - d * s * .7, y); c.lineTo(xa + d * s * .7, y + s); }
  }
  c.stroke(); c.globalAlpha = 1;
  // demi-tour toutes les k aiguilles : aiguilles restantes avant le prochain, sous le berceau du pas de tir
  if (L.demi && !g) {
    const k = L.demi.every - dyn.planted % L.demi.every, msg = 'DEMI-TOUR DANS ' + k, yb = LAUNCH + PL + HEAD + 10;
    vtext(c, msg, cx, yb, 7, .5, col(k === 1 ? PAL.acc : PAL.rgb, k === 1 ? 1 : Math.max(.8, PAL.lab)), 1.15);
  }
}

function drawHud(c, g, sheet) {
  const rgb = PAL.rgb, hi = PAL.hi, acc = PAL.acc, top = Math.max(12, SAT), x0 = hudLeft(sheet), xr = SX + SW - 16;
  c.lineCap = 'round'; c.lineJoin = 'round';
  // --- haut : niveau, monde, rythme ---
  const num = pad2(L.n), nw = vwidth(num, 20);
  c.globalAlpha = g ? .4 : 1; vtext(c, num, x0, top + 20, 20, 0, col(g ? rgb : hi, 1), g ? 5 : 2.3);
  if (!g) {
    c.globalAlpha = 1;
    if (L.boss) { c.fillStyle = col(hi, 1); c.fillRect(x0 - 1, top + 4, vwidth('BOSS', 7) + 8, 11); vtext(c, 'BOSS', x0 + 3, top + 6, 7, 0, INK, 1.3); }
    else vtext(c, 'NIVEAU', x0, top + 6, 7, 0, col(rgb, PAL.lab), 1.1);
    vtext(c, PAL.name, x0 + nw + 12, top + 20, 8, 0, col(rgb, .95), 1.25);
    // règle de rotation (idée dynamique dominante), réduite si elle déborderait sur les étoiles bonus
    const no = L.orbs.length, so = no > 3 ? Math.min(24, 64 / (no - 1)) : 24, rl = rotLabel(L), rx = x0 + nw + 12;
    const rmax = (no ? xr - 9 - (no - 1) * so - (no > 3 ? 6.5 : 9) - 8 : xr) - rx;
    vtext(c, rl, rx, top + 34, fitH(rl, 6, Math.max(40, rmax)), 0, col(rgb, PAL.lab), 1);
  }
  // --- étoiles bonus ---
  const on = L.orbs.length;
  if (!g) vtext(c, 'BONUS', xr, top + 6, 7, 1, col(rgb, PAL.lab), 1.1);
  const sp = on > 3 ? Math.min(24, 64 / (on - 1)) : 24, r0 = on > 3 ? 6.5 : 9;   // pluie d'étoiles : rangée resserrée
  for (let i = 0; i < on; i++) {
    const sx = xr - 9 - (on - 1 - i) * sp, sy = top + 30, got = i < orbHits, fl = got && i === orbHits - 1 ? starFlash : 0, rr = r0 * (1 + fl * .5);
    c.beginPath(); starPath(c, sx, sy, rr, rr * .42, -HPI, 5); c.closePath();
    if (got) { c.globalAlpha = g ? .5 : .32 + fl * .5; c.fillStyle = col(acc, 1); c.fill(); }
    if (g && !got) continue;
    c.globalAlpha = g ? .5 : got ? 1 : .45; c.strokeStyle = col(got ? acc : rgb, 1); c.lineWidth = g ? 3.5 : 1.4; c.stroke();
  }
  c.globalAlpha = 1;
  // feuilles (victoire, échec) et pause : pas de HUD du bas, que les boutons de la feuille recouvrent
  if (sheet || state === 'pause') return;
  // --- bas gauche : aiguilles restantes ---
  const py = LAUNCH + 4, xl = SX + 18;
  if (!g) vtext(c, 'AIGUILLES', xl, py, 7, 0, col(rgb, PAL.lab), 1.1);
  c.globalAlpha = g ? .4 : 1; vtext(c, pad2(left), xl, py + 14, 22, 0, col(g ? rgb : hi, 1), g ? 5 : 2.4); c.globalAlpha = 1;
  if (!g) {
    const n = L.throws, stp = Math.min(9, (cx - 30 - xl) / n);
    c.lineWidth = 1.3;
    for (let i = 0; i < n; i++) {
      const px = xl + 2 + i * stp, onp = i < left;
      c.globalAlpha = onp ? 1 : .28; c.strokeStyle = c.fillStyle = col(onp ? hi : rgb, 1);
      c.beginPath(); c.moveTo(px, py + 46); c.lineTo(px, py + 54); c.stroke();
      c.beginPath(); c.arc(px, py + 56.5, 2.1, 0, TAU); c.fill();
    }
    c.globalAlpha = 1;
  }
  // --- bas droite : jauge ROTATION, la vitesse de rotation passée et À VENIR ---
  const GG = gaugeGeom(), sw = GG.sw, sx = GG.sx, sy = GG.sy, sh = GG.sh, mid = sy + sh / 2, T0 = -.45, T1 = 1.75, xn = sx + sw * (-T0) / (T1 - T0);
  if (!g) {
    vtext(c, 'ROTATION', sx, py, 7, 0, col(rgb, PAL.lab), 1.1);
    c.strokeStyle = col(rgb, 1); c.lineWidth = 1;
    c.globalAlpha = .5; c.beginPath();
    c.moveTo(sx, sy + 5); c.lineTo(sx, sy); c.lineTo(sx + 5, sy); c.moveTo(sx + sw - 5, sy); c.lineTo(sx + sw, sy); c.lineTo(sx + sw, sy + 5);
    c.moveTo(sx + sw, sy + sh - 5); c.lineTo(sx + sw, sy + sh); c.lineTo(sx + sw - 5, sy + sh); c.moveTo(sx + 5, sy + sh); c.lineTo(sx, sy + sh); c.lineTo(sx, sy + sh - 5); c.stroke();
    c.globalAlpha = .3; c.setLineDash([1.5, 4]); c.beginPath(); c.moveTo(sx + 2, mid); c.lineTo(sx + sw - 2, mid); c.stroke(); c.setLineDash([]);
    c.globalAlpha = .7; c.beginPath(); c.moveTo(xn, sy + 2); c.lineTo(xn, sy + sh - 2); c.stroke();
    vtext(c, '+', sx + sw + 3.5, sy + 1, 5, 0, col(rgb, PAL.lab), 1); vtext(c, '-', sx + sw + 3.5, sy + sh - 6, 5, 0, col(rgb, PAL.lab), 1);
  }
  const N = 46, amp = (sh / 2 - 4) * .66 / L.vmax, frozen = state === 'dying' ? spinK : 1;
  const ty = k => mid - speedAt(RV.t + (T0 + (T1 - T0) * k / N)) * amp * frozen, tx = k => sx + sw * k / N;
  const kn = Math.round(N * (-T0) / (T1 - T0));
  if (!g) { c.globalAlpha = .45; c.strokeStyle = col(rgb, 1); c.lineWidth = 1.2; c.beginPath(); c.moveTo(tx(0), ty(0)); for (let k = 1; k <= kn; k++) c.lineTo(tx(k), ty(k)); c.stroke(); }
  c.globalAlpha = g ? .45 : 1; c.strokeStyle = col(g ? rgb : hi, 1); c.lineWidth = g ? 3.6 : 1.5;
  c.beginPath(); c.moveTo(tx(kn), ty(kn)); for (let k = kn + 1; k <= N; k++) c.lineTo(tx(k), ty(k)); c.stroke();
  c.fillStyle = col(hi, 1); c.beginPath(); c.arc(xn, ty(kn), g ? 3.4 : 2.3, 0, TAU); c.fill();
  c.globalAlpha = 1;
  // --- annonces dans le couloir de tir ---
  drawIntro(c, g);
}

function typed(str, k) { const n = [...str]; return k >= 1 ? str : n.slice(0, Math.ceil(n.length * k)).join(''); }
// bas des anneaux d'un niveau (bandeaux et messages restent dessous), ou 0
function ringsBottom() { return L && L.rings.length ? cy + RRAD[L.rings.length - 1] + ringBar() / 2 + 6 : 0; }
function drawIntro(c, g) {
  const rgb = PAL.rgb, hi = PAL.hi;
  let rb = ringsBottom(), yT = Math.max(cy + RD + 13, rb), yB = LAUNCH - 14, hC = yB - yT, xl = SX + 24, maxW = SW - 48, yL = LAUNCH;
  // écran bas et large (téléphone en paysage) : couloir trop court sous les anneaux, bandeaux dans la marge de gauche
  if (hC < 30 && SX >= 150) { xl = 24; maxW = SX - 48; yT = cy - 70; yB = cy + 70; hC = yB - yT; rb = 0; yL = yB + 20; }
  // pendant le compte à rebours de REPRENDRE, le couloir est laissé à l'anneau 3-2-1 ; bandeaux et rappel, dont les minuteries
  // sont figées, reprennent ensuite là où ils s'étaient arrêtés
  if (state !== 'play' || playPhase === 'compte' || hC < 30) return;
  if (wIntro > 0) {
    const el = 2.5 - wIntro, a = clamp(wIntro / .35, 0, 1), nm = PAL.name;
    // couloir étroit (sous trois anneaux, petit écran) : thème omis, titre réduit, tout sous le haut du couloir
    const tight = hC < 58;
    let hN = tight ? clamp(hC - 22, 12, 18) : clamp(hC * .4, 16, 42); hN = fitH(nm, hN, maxW);
    const y0 = tight ? yT + 13 : yT + (hC - hN) / 2 + 2, yk = tight ? yT : y0 - hN * .3 - 13;
    c.globalAlpha = a * (g ? .45 : 1);
    vtext(c, typed(nm, el / .42), xl, y0, hN, 0, col(g ? rgb : hi, 1), g ? hN * .15 : Math.max(2, hN * .085));
    if (!g) {
      c.globalAlpha = a; c.strokeStyle = col(rgb, 1); c.lineWidth = 1.5; c.beginPath(); c.moveTo(xl - 9, yk); c.lineTo(xl - 9, y0 + hN + (tight ? 2 : 17)); c.stroke();
      vtext(c, L.w < WORLDS.length ? 'MONDE ' + pad2(L.w + 1) : 'MONDE ∞', xl, yk, 7, 0, col(rgb, Math.max(.8, PAL.lab)), 1.15);
      if (el > .35 && !tight) vtext(c, typed(PAL.theme, (el - .35) / .5), xl, y0 + hN + 10, 7, 0, col(rgb, .95), 1.15);
    }
    c.globalAlpha = 1; return;
  }
  // bandeau de règle d'un niveau d'apprentissage : titre et règle (≥ 10 px), au-dessus du pas de tir, TEACH_SHOW s
  if (teachT > 0 && L.teach && TEACH_TEXT[L.teach] && !intro) {
    const [ttl, rule] = TEACH_TEXT[L.teach], a = clamp(teachT / .35, 0, 1) * clamp((TEACH_SHOW - teachT) / .2, 0, 1);
    const lines = wrapV(rule, 10, maxW - 30), lh = rb ? 13.5 : 15;
    // sous les anneaux s'il y en a, au-dessus du pas de tir ; interlignes resserrés si la place manque
    const y0 = Math.max(yL - 34 - (lines.length - 1) * 15 - 17, rb), y1 = y0 + (rb ? 15 : 17);
    c.globalAlpha = a * (g ? .45 : 1);
    vtext(c, typed(ttl, (TEACH_SHOW - teachT) / .3), xl, y0, 10, 0, col(g ? PAL.acc : PAL.acc, 1), g ? 3 : 1.5);
    lines.forEach((ln, i) => vtext(c, ln, xl, y1 + i * lh, 10, 0, col(g ? rgb : hi, 1), g ? 3 : 1.45));
    if (!g) { c.globalAlpha = a; c.strokeStyle = col(PAL.acc, 1); c.lineWidth = 1.5; c.beginPath(); c.moveTo(xl - 9, y0 - 2); c.lineTo(xl - 9, y1 + (lines.length - 1) * lh + 12); c.stroke(); }
    c.globalAlpha = 1; return;
  }
  if (intro > 0) {
    const el = 1.3 - intro, a = clamp(intro / .3, 0, 1), big = L.boss ? 'BOSS' : 'NIVEAU ' + pad2(L.n), hN = fitH(big, clamp(hC * .34, 14, 30), maxW), y0 = yT + (hC - hN) / 2 - 2;
    c.globalAlpha = a * (g ? .45 : 1);
    vtext(c, typed(big, el / .3), xl, y0, hN, 0, col(g ? rgb : hi, 1), g ? hN * .16 : Math.max(1.8, hN * .09));
    if (!g) {
      c.globalAlpha = a; c.strokeStyle = col(rgb, 1); c.lineWidth = 1.5; c.beginPath(); c.moveTo(xl - 9, y0 - 2); c.lineTo(xl - 9, y0 + hN + 16); c.stroke();
      const sub = L.teach && TEACH_TEXT[L.teach] ? 'NOUVEAU · ' + TEACH_TEXT[L.teach][0] : (L.boss ? 'NIVEAU ' + pad2(L.n) + ' · ' : '') + rotLabel(L);
      vtext(c, sub, xl, y0 + hN + 9, 7, 0, col(L.teach ? PAL.acc : rgb, .95), 1.15);
    }
    c.globalAlpha = 1; return;
  }
  // rappel de la cause de l'échec précédent, juste au-dessus du pas de tir
  if (recall) {
    const msg = recall.txt, h = fitH(msg, 9, maxW - 40), y = yL - 34;
    c.globalAlpha = clamp(recall.life / .3, 0, 1) * (g ? .45 : 1);
    vtext(c, msg, xl, y, h, 0, col(PAL.alert, 1), g ? 3 : 1.4);
    if (!g) { c.strokeStyle = col(PAL.alert, 1); c.lineWidth = 1.5; c.beginPath(); c.moveTo(xl - 9, y - 4); c.lineTo(xl - 9, y + h + 4); c.stroke(); }
    c.globalAlpha = 1; return;
  }
  if (!thrownAny && L.n <= 2 && !g) {
    const msg = L.n === 1 ? (TOUCH ? 'TOUCHE L’ÉCRAN POUR TIRER' : 'CLIC OU ESPACE POUR TIRER') : 'ARC ALLUMÉ = ZONE LIBRE';
    c.globalAlpha = rm() ? 1 : .6 + .4 * Math.sin(time * 5);
    vtext(c, msg, xl, yT + hC / 2 - 4, fitH(msg, 9, maxW), 0, col(hi, 1), 1.4);
    c.strokeStyle = col(rgb, 1); c.lineWidth = 1.5; c.beginPath(); c.moveTo(xl - 9, yT + hC / 2 - 8); c.lineTo(xl - 9, yT + hC / 2 + 9); c.stroke();
    c.globalAlpha = 1;
  }
}

// trois grandes étoiles tracées au centre du cadran
function drawWinStars(c, g) {
  const acc = PAL.acc, rgb = PAL.rgb;
  c.lineJoin = 'round'; c.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const mid = i === 1, ro = R * (mid ? .62 : .48), sx = cx + (i - 1) * R * 1.22, sy = cy + (mid ? -R * .16 : R * .1), got = i < lastStars;
    const k = clamp((wonT - .1 - i * .2) / .3, 0, 1);
    if (!got) { if (g) continue; c.globalAlpha = .4 * clamp(wonT / .3, 0, 1); c.setLineDash([3, 5]); c.strokeStyle = col(rgb, 1); c.lineWidth = 1.3; c.beginPath(); starPath(c, sx, sy, ro, ro * .42, -HPI, 5); c.closePath(); c.stroke(); c.setLineDash([]); continue; }
    if (k <= 0) continue;
    const e = easeOut(k), r2 = ro * (.6 + .4 * e) * (1 + (1 - k) * .25);
    c.beginPath(); starPath(c, sx, sy, r2, r2 * .42, -HPI + (1 - e) * .6, 5); c.closePath();
    c.globalAlpha = (g ? .16 : .26) * e; c.fillStyle = col(acc, 1); c.fill();
    c.globalAlpha = (g ? .5 : 1) * e; c.strokeStyle = col(acc, 1); c.lineWidth = g ? 4.4 : 2.2; c.stroke();
    if (!g) { c.globalAlpha = e; c.beginPath(); starPath(c, sx, sy, r2 * .45, r2 * .19, -HPI, 5); c.closePath(); c.lineWidth = 1.2; c.stroke(); }
  }
  c.globalAlpha = 1;
}

function drawMenuScene(c, g) {
  const S = MSC; if (!S.r) return;
  if (!g) drawDial(c, S.x, S.y, S.r * 2.32, PAL.rgb, .9);
  if (demo.gone <= 0) drawBody(c, g, S);
  if (demo.fly) {
    const k = demo.fly.k, lw = Math.max(1.3, R * .022), yt = lerp(S.y + S.r * 2.5, S.y + S.r, easeOut(Math.min(1, k)));
    c.globalAlpha = (g ? .5 : 1) * Math.min(1, k * 3); c.strokeStyle = c.fillStyle = col(PAL.hi, 1); c.lineWidth = g ? lw * 2.4 : lw * 1.2; c.lineCap = 'round';
    c.beginPath(); c.moveTo(S.x, yt); c.lineTo(S.x, yt + S.pl); c.stroke(); c.beginPath(); c.arc(S.x, yt + S.pl, S.head * (g ? 1.2 : 1), 0, TAU); c.fill(); c.globalAlpha = 1;
  }
  if (demo.gone <= 0) drawHeads(c, g, S);
  drawFx(c, g);
}

function draw(dt) {
  const inGame = L && state !== 'menu' && state !== 'levels';
  if (inGame) syncScene(); else if (state === 'menu') syncMenu();
  if (state === 'failed') { failViewTarget(); FV.k = rm() ? 1 : Math.min(1, FV.k + dt / .15); } else FV.k = 0;
  const fy = inGame ? cy : (MSC.r ? MSC.y : cy), key = PAL.w + ':' + Math.round(fy) + ':' + W + 'x' + H + ':' + DPR;
  if (key !== bgKey) { bgKey = key; buildBg(cx, fy); }
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  ctx.drawImage(bg, 0, 0, W, H);
  if (PAL.w >= 5) drawCosmosHaze(ctx);
  drawSky(ctx);
  // couche phosphore : on efface un peu (rémanence), on redessine les traits vifs en gras et en basse résolution
  gctx.globalCompositeOperation = 'destination-out'; gctx.globalAlpha = 1;
  gctx.fillStyle = `rgba(0,0,0,${rm() ? .6 : clamp(1 - Math.exp(-dt / PAL.amb.decay), .12, 1)})`; gctx.fillRect(0, 0, W, H);
  gctx.globalCompositeOperation = 'source-over';
  if (inGame) drawGame(gctx, true); else if (state === 'menu') drawMenuScene(gctx, true);
  ctx.save();
  if (shake > 0) ctx.translate((Math.random() - .5) * shake, (Math.random() - .5) * shake);
  ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .95;
  ctx.drawImage(glow, 0, 0, W, H);
  updBloom();
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  if (inGame) drawGame(ctx, false); else if (state === 'menu') drawMenuScene(ctx, false);
  ctx.restore();
  // échec : liseré d'alerte sur les bords de l'écran, qui s'éteint avant la feuille
  if (state === 'dying' && !rm()) drawAlertEdge(ctx, PAL.alert, clamp(1 - dieT / FAIL_SHEET, 0, 1));
  // balayage de retrace entre deux écrans
  if (wipe > 0) {
    const y = (1 - wipe) * H;
    ctx.globalAlpha = wipe * .5; ctx.fillStyle = col(PAL.rgb, 1); ctx.fillRect(0, y - 1, W, 2);
    ctx.globalAlpha = wipe * .1; ctx.fillRect(0, y - 26, W, 26); ctx.globalAlpha = 1;
  }
}

function updBloom() {
  if (!bbctx) return;
  bbctx.globalCompositeOperation = 'copy'; bbctx.globalAlpha = PAL.amb.glow < .07 ? .65 : .8;
  bbctx.drawImage(glow, 0, 0, bloomB.width, bloomB.height);
}

// mode démo du menu : l'astre du monde en cours se joue tout seul
function updDemo(dt) {
  const D = demo;
  D.t += dt;
  const sp = .95 * (.55 + .45 * Math.sin(D.t * .8));
  D.rot += sp * dt;
  for (const s of D.stuck) if (s.k < 1) s.k = Math.min(1, s.k + dt * 6);
  if (D.gone > 0) { D.gone -= dt; if (D.gone <= 0) { D.stuck = []; D.arcs = [[0, TAU]]; D.cool = .7; D.born = 0; } return; }
  D.born = Math.min(1, (D.born || 0) + dt * 2.2);
  if (D.fly) {
    D.fly.k += dt * 6;
    if (D.fly.k >= 1) {
      D.stuck.push({ a: norm(HPI - D.rot), pre: false, k: 0 }); D.fly = null; D.arcs = computeArcs(D.stuck);
      if (D.stuck.length >= 9) {
        if (rm()) { D.gone = .01; }
        else if (MSC.r) { syncMenu(); explodeScene(MSC, 210); D.gone = 1.3; }
        else D.gone = .01;
      }
    }
  } else if ((D.cool -= dt) <= 0) {
    const a = norm(HPI - (D.rot + sp / 6));
    if (D.stuck.every(s => angDiff(s.a, a) > GAP * 2.6)) { D.fly = { k: 0 }; D.cool = .5 + Math.random() * .6; }
  }
}

// abonnements aux événements du cœur (appelé une fois par main.js, avant les autres : le thème précède le son)
function bindRender() {
  bus.on('level:start', (lv, retry) => {
    if (PAL.w !== lv.w) { setTheme(lv.w); bgKey = ''; }
    if (!retry && !rm()) wipe = 1;
  });
  bus.on('explode', () => { syncScene(); explodeScene(GSC, 300); });
  bus.on('hit', s => { addHit(s.a); if (s.tw) addHit(s.tw.a); });
  bus.on('level:start', () => { for (const h of HITS) h.life = 0; });
  bus.on('step', h => { if (state === 'menu') updDemo(h); for (const x of HITS) if (x.life > 0) x.life -= h; });
}
