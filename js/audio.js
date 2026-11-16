// ORBITA · audio.js — son de synthèse (WebAudio), chaque coup est une note de la gamme du monde.
/* ---------- son : synthèse pure, chaque coup est une note de la gamme du monde ---------- */
let AC = null, MASTER = null, SEND = null, NOISE = null, lastPing = 0;
function ac() {
  if (!AC) {
    try {
      AC = new (window.AudioContext || window.webkitAudioContext)();
      const comp = AC.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 5; comp.attack.value = .004; comp.release.value = .2;
      MASTER = AC.createGain(); MASTER.gain.value = .85; MASTER.connect(comp); comp.connect(AC.destination);
      const dl = AC.createDelay(.8), fb = AC.createGain(), lp = AC.createBiquadFilter();
      dl.delayTime.value = .23; fb.gain.value = .34; lp.type = 'lowpass'; lp.frequency.value = 2400;
      SEND = AC.createGain(); SEND.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(MASTER);
      NOISE = AC.createBuffer(1, AC.sampleRate * .5 | 0, AC.sampleRate);
      const ch = NOISE.getChannelData(0); for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
    } catch (e) { AC = null; }
  }
  if (AC && AC.state === 'suspended') { try { const p = AC.resume(); if (p && p.catch) p.catch(() => {}); } catch (e) {} }
  return AC;
}
const live = () => soundOn && AC && AC.state === 'running';
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
function degF(deg) { const sc = PAL.scale, n = sc.length, o = Math.floor(deg / n); return mtof(PAL.root + sc[((deg % n) + n) % n] + 12 * o); }
function voice(f, o) {
  if (!live()) return;
  const type = o.type || 'sine', v = o.v || .1, atk = o.atk || .004, dec = o.dec || .2, t0 = AC.currentTime + (o.at || 0);
  const osc = AC.createOscillator(), g = AC.createGain();
  osc.type = type; osc.frequency.setValueAtTime(f, t0);
  if (o.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(28, f * o.slide), t0 + atk + dec);
  if (o.det) osc.detune.value = o.det;
  g.gain.setValueAtTime(.0001, t0); g.gain.exponentialRampToValueAtTime(v, t0 + atk); g.gain.exponentialRampToValueAtTime(.0001, t0 + atk + dec);
  let node = osc;
  if (o.lp) { const fl = AC.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.setValueAtTime(o.lp, t0); if (o.lpTo) fl.frequency.exponentialRampToValueAtTime(o.lpTo, t0 + atk + dec); osc.connect(fl); node = fl; }
  node.connect(g); g.connect(MASTER);
  if (o.send) { const s = AC.createGain(); s.gain.value = o.send; g.connect(s); s.connect(SEND); }
  osc.start(t0); osc.stop(t0 + atk + dec + .05);
}
// cloche FM : porteuse sinus, modulante inharmonique dont l'indice s'éteint
function bell(f, o) {
  if (!live()) return;
  const v = o.v || .1, dec = o.dec || .6, t0 = AC.currentTime + (o.at || 0);
  const car = AC.createOscillator(), mod = AC.createOscillator(), mg = AC.createGain(), g = AC.createGain();
  car.frequency.value = f; mod.frequency.value = f * (o.ratio || 3.51);
  mg.gain.setValueAtTime(f * 1.6, t0); mg.gain.exponentialRampToValueAtTime(f * .02, t0 + dec * .7);
  mod.connect(mg); mg.connect(car.frequency);
  g.gain.setValueAtTime(.0001, t0); g.gain.exponentialRampToValueAtTime(v, t0 + .004); g.gain.exponentialRampToValueAtTime(.0001, t0 + dec);
  car.connect(g); g.connect(MASTER); const s = AC.createGain(); s.gain.value = .45; g.connect(s); s.connect(SEND);
  car.start(t0); mod.start(t0); car.stop(t0 + dec + .05); mod.stop(t0 + dec + .05);
}
function noise(o) {
  if (!live()) return;
  const t0 = AC.currentTime + (o.at || 0), dec = o.dec || .1, src = AC.createBufferSource(), fl = AC.createBiquadFilter(), g = AC.createGain();
  src.buffer = NOISE; fl.type = o.type || 'bandpass'; fl.frequency.setValueAtTime(o.f || 2000, t0); if (o.fTo) fl.frequency.exponentialRampToValueAtTime(o.fTo, t0 + dec); fl.Q.value = o.q || 1.2;
  g.gain.setValueAtTime(o.v || .1, t0); g.gain.exponentialRampToValueAtTime(.0001, t0 + dec);
  src.connect(fl); fl.connect(g); g.connect(MASTER); src.start(t0); src.stop(t0 + dec + .03);
}
function sfx(k, x) {
  if (!soundOn) return; ac(); if (!live()) return;
  x = x || 0;
  switch (k) {
    case 'ui': voice(degF(5), { v: .05, dec: .06, send: .2 }); break;
    case 'throw': noise({ v: .05, dec: .05, f: 3200, fTo: 7000 }); voice(degF(x) * 2, { type: 'triangle', v: .03, dec: .05, slide: 1.5 }); break;
    case 'hit': { const f = degF(x);
      voice(f, { type: 'triangle', v: .17, dec: .34, send: .4 }); voice(f * 2, { v: .05, dec: .2, send: .3, det: 6 }); voice(f / 2, { v: .1, dec: .11 });
      noise({ v: .04, dec: .03, f: 2200 }); break; }
    case 'near': { const f = degF(x) * 2; voice(f * 1.5, { v: .05, dec: .09, at: .05, send: .6 }); voice(f * 2, { v: .05, dec: .2, at: .1, send: .6 }); break; }
    case 'orb': bell(degF(x + 2) * 2, { v: .12, dec: .7 }); bell(degF(x + 4) * 2, { v: .09, dec: .8, at: .09 }); break;
    case 'ping': voice(degF(x) * 2, { v: .017, dec: .1, send: .7 }); break;
    case 'fail':
      voice(mtof(PAL.root - 12), { type: 'sawtooth', v: .13, dec: .5, slide: .4, lp: 2200, lpTo: 180, send: .2 });
      voice(mtof(PAL.root - 11), { type: 'sawtooth', v: .1, dec: .46, slide: .38, lp: 1800, lpTo: 160 });
      noise({ v: .16, dec: .16, f: 1400, fTo: 300, q: .7 }); voice(82, { v: .22, dec: .22, slide: .5 }); break;
    case 'win': { const n = Math.max(3, x);
      for (let i = 0; i < n; i++) voice(degF(i), { type: 'triangle', v: .09, dec: .16, at: i * .042, send: .4 });
      const t1 = n * .042 + .04, len = PAL.scale.length;
      bell(degF(len), { v: .13, dec: 1.1, at: t1 }); bell(degF(len + 2), { v: .09, dec: 1.1, at: t1 + .05 }); bell(degF(len * 2), { v: .08, dec: 1.3, at: t1 + .1 });
      voice(degF(0) / 2, { v: .12, dec: .9, at: t1 }); break; }
    case 'boom': noise({ v: .2, dec: .5, f: 2600, fTo: 140, q: .6, type: 'lowpass' }); voice(64, { v: .25, dec: .4, slide: .45 }); break;
    case 'world': { const sc = PAL.scale.length;
      voice(degF(0) / 2, { v: .08, atk: .35, dec: 1.6, send: .3 }); voice(degF(0) / 2 * 1.498, { v: .05, atk: .45, dec: 1.5, send: .3 });
      [0, 2, 4, sc].forEach((dg, i) => bell(degF(dg), { v: .07, dec: .9, at: .12 + i * .13 })); break; }
    case 'start': voice(degF(0), { type: 'triangle', v: .07, dec: .12, send: .4 }); voice(degF(2), { type: 'triangle', v: .07, dec: .18, at: .08, send: .4 }); break;
    case 'boss': voice(mtof(PAL.root - 24), { type: 'sawtooth', v: .12, atk: .05, dec: .9, lp: 600, lpTo: 120 }); voice(mtof(PAL.root - 23), { type: 'sawtooth', v: .08, atk: .05, dec: .9, lp: 500, lpTo: 120 }); voice(degF(0), { type: 'triangle', v: .07, dec: .3, at: .1, send: .5 }); break;
    case 'tick': voice(degF(x === 1 ? 7 : 4) * 2, { type: 'triangle', v: .05, dec: .05, send: .3 }); break;
    case 'star': bell(degF(x * 2) * 2, { v: .1, dec: .7 }); break;
  }
}

// abonnements aux événements du cœur (appelé une fois par main.js)
function bindAudio() {
  bus.on('level:start', (lv, retry, newWorld) => { if (newWorld) sfx('world'); else if (!retry) sfx(lv.boss ? 'boss' : 'start'); });
  bus.on('throw', f => sfx('throw', f.idx));
  bus.on('hit', (s, idx) => sfx('hit', idx));
  bus.on('near', (deg, idx) => sfx('near', idx));
  bus.on('star', (o, idx) => sfx('orb', idx));
  bus.on('fail', () => sfx('fail'));
  bus.on('win', lv => sfx('win', lv.throws));
  bus.on('explode', () => sfx('boom'));
  bus.on('tick', c => sfx('tick', c));
  bus.on('flip:warn', () => sfx('tick', 2));
  // boîte à musique : chaque bloqueur qui passe sous la tête de lecture (en haut) fait tinter sa note
  bus.on('ping', s => { if (soundOn && time - lastPing > .07 && !s.wall) { lastPing = time; sfx('ping', s.pre ? -1 - (Math.round(s.a * 3) % 4) : s.deg); } });
}
