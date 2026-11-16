// ORBITA · ui.js — écrans DOM, boutons et couche d'entrée (tap, clavier, visibilité).
const TOUCH = window.matchMedia ? matchMedia('(pointer: coarse)').matches : true;

/* ---------- écrans ---------- */
const screens = ['menu', 'levels', 'win', 'fail', 'pause'];
function hideAll() { screens.forEach(s => $(s).classList.remove('show')); }
function show(id) { hideAll(); $(id).classList.add('show'); }
function totalStars() { let s = 0; for (const k in bestStars) s += +bestStars[k] || 0; return s; }
const btn = (id, lbl, aux, big) => { $(id).innerHTML = `<span>${vsvg(lbl, big ? 17 : 11, big ? 2.5 : 1.6)}</span>` + (aux ? `<span class="aux">${aux}</span>` : ''); $(id).setAttribute('aria-label', lbl); };
const ARROW = vsvg('→', 13, 2);

function soundLabel() { btn('soundBtn', 'SON', vsvg(soundOn ? 'OUI' : 'NON', 9, 1.4)); }
function showMenu() {
  state = 'menu'; L = null; sparks = []; segs = []; rings = []; texts = []; failInfo = null; shake = 0; flying = null; flights = [];
  $('hudBtn').style.display = 'none';
  const w = Math.floor((Math.max(1, unlocked) - 1) / 5);
  if (PAL.w !== w) { demo.stuck = []; demo.arcs = [[0, TAU]]; demo.fly = null; demo.gone = 0; demo.born = 0; }
  setTheme(w); bgKey = ''; hero = null;
  btn('playBtn', unlocked > 1 ? 'CONTINUER' : 'JOUER', vsvg('NIV ' + pad2(unlocked), 10, 1.6) + ARROW, true);
  btn('levelsBtn', 'NIVEAUX', vsvg('→', 10, 1.5));
  soundLabel();
  $('mWorldK').textContent = 'Monde ' + pad2(w + 1);
  setVT($('mWorld'), PAL.name, 15, 2, SW * .5);
  setVT($('totalStars'), '★ ' + String(totalStars()).padStart(3, '0'), 15, 2);
  show('menu');
  swApply();
}
function showLevels() {
  state = 'levels';
  const g = $('grid'), maxW = Math.max(4, Math.floor((unlocked - 1) / 5) + 2);
  let html = '';
  for (let w = 0; w < maxW; w++) {
    const wd = worldInfo(w), first = w * 5 + 1, open = unlocked >= first;
    let st = 0; for (let i = 0; i < 5; i++) st += +bestStars[first + i] || 0;
    html += `<section class="ws${open ? '' : ' lock'}" style="--c:rgb(${wd.rgb});--rgb:${wd.rgb};--hi:rgb(${wd.hi})"><header>${solidSVG(wd.solid, 34)}<div class="wn"><small>MONDE ${pad2(w + 1)}</small>${vsvg(wd.name, 12, 1.7)}</div><div class="wst">${vsvg(open ? '★ ' + pad2(st) + '/15' : 'VERROUILLÉ', 8, 1.25)}</div></header><div class="cells">`;
    for (let i = first; i < first + 5; i++) {
      const s = +bestStars[i] || 0, boss = i % 5 === 0;
      html += `<button class="lv${boss ? ' boss' : ''}${i === unlocked ? ' cur' : ''}" data-n="${i}" aria-label="Niveau ${i}"${i > unlocked ? ' disabled' : ''}>${vsvg(String(i), 13, 1.8)}<span class="pips">${[0, 1, 2].map(k => `<i${k < s ? ' class="on"' : ''}></i>`).join('')}</span>${boss ? '<em>BOSS</em>' : ''}</button>`;
    }
    html += '</div></section>';
  }
  g.innerHTML = html;
  setVT($('lvTitle'), 'NIVEAUX', 20, 2.6);
  setVT($('totalStars2'), '★ ' + totalStars() + '/' + Math.max(1, unlocked - 1) * 3, 10, 1.5);
  btn('levelsBack', 'RETOUR', vsvg('<', 10, 1.5));
  show('levels');
  const cur = g.querySelector('.cur'); if (cur) cur.scrollIntoView({ block: 'center' });
  swApply();
}
const winMsgs = ['Sans bavure.', 'Précision d’horloger.', 'Rien à redire.', 'Trajectoire parfaite.', 'Du grand art.'];
function showWin() {
  state = 'won'; wonT = 0;
  $('hudBtn').style.display = 'none';
  $('winKick').textContent = `Niveau ${pad2(L.n)} · ${PAL.name}`;
  const ttl = L.boss ? 'BOSS VAINCU !' : 'RÉUSSI !';
  setVT($('winTitle'), ttl, 26, 3.2, SW - 44);
  const sec = levelTime.toFixed(1).replace('.', ',');
  $('winStats').innerHTML = `<div><span class="kick">Temps</span><b>${vsvg(sec + ' S', 11, 1.6)}</b></div><div><span class="kick">Étoiles</span><b>${vsvg(lastStars + '/3', 11, 1.6)}</b></div><div><span class="kick">Frôlés</span><b>${vsvg(String(nearCount), 11, 1.6)}</b></div>`;
  let msg;
  if (L.boss) msg = `Monde ${pad2(L.w + 1)} bouclé. Cap sur ${worldInfo(L.w + 1).name}.`;
  else if (lastStars === 3) msg = winMsgs[(L.n * 7 + nearCount) % winMsgs.length];
  else msg = orbHits === 0 ? 'Plante une aiguille sous une étoile pour la décrocher.' : 'Encore ' + (L.orbs.length - orbHits) + ' étoile' + (L.orbs.length - orbHits > 1 ? 's' : '') + ' à décrocher pour le 3/3.';
  $('winMsg').textContent = msg;
  btn('nextBtn', 'SUIVANT', vsvg('NIV ' + pad2(L.n + 1), 10, 1.6) + ARROW, true);
  btn('replayBtn', 'REJOUER'); btn('winMenu', 'MENU');
  show('win');
  for (let i = 0; i < lastStars; i++) if (live()) bell(degF(i * 2) * 2, { v: .09, dec: .7, at: .12 + i * .2 });
}
const failMsgs = ['Attends l’ouverture, puis tire.', 'Le rythme, pas la vitesse.', 'Vise un arc allumé.', 'On recalibre et on repart.', 'Respire. Regarde l’oscillo.'];
function showFail() {
  state = 'failed';
  $('hudBtn').style.display = 'none';
  $('failKick').textContent = `Niveau ${pad2(L.n)} · ${left + 1} aiguille${left ? 's' : ''} restante${left ? 's' : ''}`;
  setVT($('failTitle'), 'CONTACT !', 26, 3.2, SW - 44);
  let m;
  if (failInfo && failInfo.kind === 'sent') m = 'Tir intercepté par la sentinelle.';
  else if (failInfo && failInfo.kind === 'twin') m = 'L’aiguille a percuté en ressortant de l’autre côté.';
  else if (failInfo) m = 'Il manquait ' + Math.max(1, Math.ceil((GAP - failInfo.d) * 180 / Math.PI)) + '° pour passer.';
  $('failMsg').textContent = (m ? m + ' ' : '') + failMsgs[(L.n + left * 3) % failMsgs.length];
  btn('retryBtn', 'RÉESSAYER', ARROW, true); btn('failMenu', 'MENU');
  $('failHint').textContent = TOUCH ? 'ou touche l’écran' : 'ou appuie sur Espace';
  show('fail');
}
function pauseGame() {
  if (state !== 'play') return;
  state = 'pause';
  $('pauseKick').textContent = `Niveau ${pad2(L.n)} · ${PAL.name}`;
  setVT($('pauseTitle'), 'PAUSE', 26, 3.2);
  btn('resumeBtn', 'REPRENDRE', ARROW, true); btn('restartBtn', 'RECOMMENCER'); btn('pauseMenu', 'MENU');
  show('pause');
}
function resumeGame() { if (state !== 'pause') return; hideAll(); state = 'play'; last = performance.now(); }
const click = (id, fn) => { $(id).onclick = e => { ac(); sfx('ui'); fn(e); }; };

// Horodatage : instant simulé d'un événement daté ts (ms, horloge de performance.now()). La boucle note simWall, l'heure
// murale de l'instant simulé t ; l'instant est borné à [t, maintenant] (jamais dans le passé, jamais au-delà de 0,1 s).
// Certaines WebView datent leurs événements depuis 1970 : au-delà d'une seconde d'écart, on prend performance.now().
function tapInstant(ts, now, tSim, wall) {
  if (!(ts >= 0) || Math.abs(ts - now) > 1000) ts = now;
  return tSim + clamp((ts - wall) / 1000, 0, clamp((now - wall) / 1000, 0, .1));
}
// un seul geste : lancer, ou relancer aussitôt après un échec ; ts = horodatage de l'événement.
// Anti-rebond : un tap à moins de 40 ms du dernier tap retenu est ignoré (rebond du doigt, deux doigts).
const DEBOUNCE = 40;
let lastTap = -1e9;
function tap(ts) {
  const now = performance.now();
  if (!(ts >= 0) || Math.abs(ts - now) > 1000) ts = now;
  if (ts - lastTap < DEBOUNCE) return;
  lastTap = ts;
  ac();
  if (state === 'play') throwPin(tapInstant(ts, now, t, simWall));
  else if (state === 'failed' || (state === 'dying' && dieT > .28)) startLevel(L.n, true);
}

// branchements des boutons et des entrées (appelé une fois par main.js)
function bindUI() {
  click('playBtn', () => startLevel(unlocked));
  click('levelsBtn', showLevels);
  click('levelsBack', showMenu);
  $('soundBtn').onclick = () => { soundOn = !soundOn; store.set('sound', soundOn); soundLabel(); if (soundOn) { ac(); sfx('start'); } };
  $('grid').onclick = e => { const b = e.target.closest ? e.target.closest('.lv') : null; if (b && !b.disabled) { ac(); sfx('ui'); startLevel(+b.dataset.n); } };
  click('nextBtn', () => startLevel(L.n + 1));
  click('replayBtn', () => startLevel(L.n, true));
  click('winMenu', showMenu);
  click('retryBtn', () => startLevel(L.n, true));
  click('failMenu', showMenu);
  $('hudBtn').onclick = e => { e.stopPropagation(); ac(); sfx('ui'); pauseGame(); };
  click('resumeBtn', resumeGame);
  click('restartBtn', () => startLevel(L.n, true));
  click('pauseMenu', showMenu);
  cvs.addEventListener('pointerdown', e => { e.preventDefault(); tap(e.timeStamp); });
  $('failPanel').addEventListener('pointerdown', e => { if (!(e.target.closest && e.target.closest('button'))) tap(e.timeStamp); });
  addEventListener('keydown', e => {
    if (e.repeat) return;
    if (e.code === 'Space' || e.code === 'Enter') {
      e.preventDefault(); ac();
      if (state === 'play' || state === 'failed' || state === 'dying') tap(e.timeStamp);
      else if (state === 'won') startLevel(L.n + 1);
      else if (state === 'menu') startLevel(unlocked);
      else if (state === 'pause') resumeGame();
    } else if (e.code === 'KeyP' || e.code === 'Escape') {
      if (state === 'play') pauseGame(); else if (state === 'pause') resumeGame(); else if (state === 'levels') showMenu();
    }
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(); else last = performance.now(); });
}
