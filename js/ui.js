// ORBITA · ui.js — écrans DOM, boutons et couche d'entrée (tap, clavier, visibilité).
const TOUCH = window.matchMedia ? matchMedia('(pointer: coarse)').matches : true;

/* ---------- écrans ---------- */
const screens = ['menu', 'levels', 'win', 'fail', 'pause'];
function hideAll() { screens.forEach(s => $(s).classList.remove('show')); }
function show(id) { hideAll(); $(id).classList.add('show'); }
// total des étoiles ; max = LAST_LEVEL : seulement les 6 mondes (le compteur /900), COSMOS ∞ ayant son propre total
function totalStars(max) { let s = 0; for (const k in bestStars) if (!max || +k <= max) s += +bestStars[k] || 0; return s; }
const btn = (id, lbl, aux, big) => { $(id).innerHTML = `<span>${vsvg(lbl, big ? 17 : 11, big ? 2.5 : 1.6)}</span>` + (aux ? `<span class="aux">${aux}</span>` : ''); $(id).setAttribute('aria-label', lbl); };
const ARROW = vsvg('→', 13, 2);

function soundLabel() { btn('soundBtn', 'SON', vsvg(soundOn ? 'ACTIF' : 'COUPÉ', 9, 1.4)); $('soundBtn').setAttribute('aria-label', soundOn ? 'Son : actif' : 'Son : coupé'); }
function showMenu() {
  state = 'menu'; L = null; sparks = []; segs = []; rings = []; texts = []; failInfo = null; shake = 0; flying = null; flights = [];
  $('hudBtn').style.display = 'none';
  const go = continueLevel(), w = worldOf(go);
  if (PAL.w !== w) { demo.stuck = []; demo.arcs = [[0, TAU]]; demo.fly = null; demo.gone = 0; demo.born = 0; }
  setTheme(w); bgKey = ''; hero = null;
  btn('playBtn', unlocked > 1 ? 'CONTINUER' : 'JOUER', vsvg('NIV ' + pad2(go), 10, 1.6) + ARROW, true);
  btn('levelsBtn', 'NIVEAUX', vsvg('→', 10, 1.5));
  soundLabel();
  $('mWorldK').textContent = w < WORLDS.length ? 'Monde ' + pad2(w + 1) : 'Sans fin';
  setVT($('mWorld'), PAL.name, 15, 2, SW * .5);
  setVT($('totalStars'), '★ ' + String(totalStars()).padStart(3, '0'), 15, 2);
  show('menu');
  swApply();
}
// sélection des niveaux : une section repliable par monde (50 niveaux, boss tous les 10, spéciaux en x7), puis COSMOS ∞
let openWorld = -1;
function levelCells(a, b) {
  let html = '';
  for (let i = a; i <= b; i++) {
    const s = +bestStars[i] || 0, boss = isBoss(i), sp = !boss && isSpecial(i);
    const tc = !boss && !sp && teachOf(i);
    html += `<button class="lv${boss ? ' boss' : sp ? ' sp' : ''}${i === unlocked ? ' cur' : ''}" data-n="${i}" aria-label="Niveau ${i}${boss ? ', boss' : sp ? ', spécial' : tc ? ', nouvelle idée' : ''}"${i > unlocked ? ' disabled' : ''}>${vsvg(String(i), 12, 1.7)}<span class="pips">${[0, 1, 2].map(k => `<i${k < s ? ' class="on"' : ''}></i>`).join('')}</span>${boss ? '<em>BOSS</em>' : ''}${tc ? '<span class="tdot"></span>' : ''}</button>`;
  }
  return html;
}
// règles relisibles : les idées apprises dans ce monde (niveaux déjà atteints), avec leur niveau d'apprentissage
function worldRules(a, b) {
  let h = '';
  for (const k in TEACH) { const n = +k; if (n < a || n > b || n > unlocked || !teachOf(n)) continue; const [t, r] = TEACH_TEXT[TEACH[k]]; h += `<div><b>${pad2(n)} · ${t}</b>${r}</div>`; }
  return h ? `<div class="wrules">${h}</div>` : '';
}
function showLevels() {
  state = 'levels';
  const g = $('grid'), nW = WORLDS.length + (unlocked > LAST_LEVEL ? 1 : 0), here = worldOf(continueLevel());
  if (openWorld === -1 || openWorld >= nW) openWorld = here;
  let html = '';
  for (let w = 0; w < nW; w++) {
    const wd = worldInfo(w), first = firstOfWorld(w), open = unlocked >= first, inf = w >= WORLDS.length;
    const last = inf ? Math.max(first + 9, Math.ceil(unlocked / 10) * 10) : first + LEVELS_PER_WORLD - 1;
    const lab = inf ? '★ ' + String(worldStars(w)) : open ? '★ ' + String(worldStars(w)).padStart(3, '0') + '/150' : 'VERROUILLÉ';
    html += `<section class="ws${open ? '' : ' lock'}${w === openWorld ? ' open' : ''}" style="--c:rgb(${wd.rgb});--rgb:${wd.rgb};--hi:rgb(${wd.hi});--lab:${wd.lab}">` +
      `<button class="wsh" data-w="${w}" aria-expanded="${w === openWorld}" aria-label="${inf ? 'Cosmos sans fin' : 'Monde ' + (w + 1) + ' ' + wd.name}">${solidSVG(wd.solid, 34)}` +
      `<div class="wn"><small>${inf ? 'NIVEAUX ' + first + ' ET +' : 'MONDE ' + pad2(w + 1) + ' · ' + first + '-' + last}</small>${vsvg(wd.name, 12, 1.7)}<small>${wd.theme}</small></div>` +
      `<div class="wst">${vsvg(lab, 8, 1.25)}<span class="chev">${vsvg(w === openWorld ? '-' : '+', 10, 1.6)}</span></div></button>` +
      `<div class="cells">${w === openWorld ? levelCells(first, last) : ''}</div>${w === openWorld ? worldRules(first, last) : ''}</section>`;
  }
  g.innerHTML = html;
  setVT($('lvTitle'), 'NIVEAUX', 20, 2.6);
  setVT($('totalStars2'), '★ ' + totalStars(LAST_LEVEL) + '/' + LAST_LEVEL * 3, 10, 1.5);
  $('legacy').textContent = SAVE.legacyStars ? `Ancienne version : ★ ${SAVE.legacyStars}` : '';
  btn('levelsBack', 'RETOUR', vsvg('<', 10, 1.5));
  show('levels');
  const cur = g.querySelector('.cur') || g.querySelector('.ws.open');
  if (cur) cur.scrollIntoView({ block: 'center' });
  swApply();
}
// replie ou déplie la section d'un monde (une seule ouverte à la fois)
function toggleWorld(w) {
  openWorld = openWorld === w ? -2 : w;
  const sc = $('grid').scrollTop;
  showLevels();
  const sec = $('grid').querySelector(`.wsh[data-w="${w}"]`);
  if (sec) { $('grid').scrollTop = sc; sec.scrollIntoView({ block: 'nearest' }); }
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
  if (L.boss && L.n % LEVELS_PER_WORLD === 0 && L.n <= LAST_LEVEL) msg = `Monde ${pad2(L.w + 1)} bouclé. Cap sur ${worldInfo(L.w + 1).name}.`;
  else if (L.boss) msg = 'Boss vaincu. Le suivant sera plus coriace.';
  else if (lastStars === 3) msg = winMsgs[(L.n * 7 + nearCount) % winMsgs.length];
  else msg = orbHits === 0 ? 'Plante une aiguille sous une étoile pour la décrocher.' : 'Encore ' + (L.orbs.length - orbHits) + ' étoile' + (L.orbs.length - orbHits > 1 ? 's' : '') + ' à décrocher pour le 3/3.';
  $('winMsg').textContent = msg;
  btn('nextBtn', 'SUIVANT', vsvg('NIV ' + pad2(L.n + 1), 10, 1.6) + ARROW, true);
  btn('replayBtn', 'REJOUER'); btn('winMenu', 'MENU');
  show('win');
  for (let i = 0; i < lastStars; i++) if (live()) bell(degF(i * 2) * 2, { v: .09, dec: .7, at: .12 + i * .2 });
}
function showFail() {
  state = 'failed';
  $('hudBtn').style.display = 'none';
  // aiguilles non plantées : celles qui restaient au pas de tir et celles perdues en vol avec l'échec
  const n = left + (failInfo ? failInfo.lost : 1), pl = n > 1 ? 's' : '';
  $('failKick').textContent = `Niveau ${pad2(L.n)} · ${n} aiguille${pl} restante${pl}`;
  setVT($('failTitle'), 'CONTACT !', 26, 3.2, SW - 44);
  const fc = failInfo ? failCause(failInfo, L) : null;
  $('failMsg').textContent = fc ? fc.long + ' ' + fc.tip : 'Attends l’ouverture, puis tire.';
  btn('retryBtn', 'RÉESSAYER', ARROW, true); btn('failMenu', 'MENU');
  $('failHint').textContent = TOUCH ? 'ou touche l’écran' : 'ou appuie sur Espace';
  show('fail');
  measureSheet();
}
function pauseGame() {
  if (state !== 'play') return;
  state = 'pause';
  $('pauseKick').textContent = `Niveau ${pad2(L.n)} · ${PAL.name}`;
  setVT($('pauseTitle'), 'PAUSE', 26, 3.2);
  // règles du niveau, relisibles (de l'idée la plus récente à la plus ancienne)
  $('pauseRules').innerHTML = levelRules(L, 3).map(([t, r]) => `<div><b>${t}</b>${r}</div>`).join('');
  btn('resumeBtn', 'REPRENDRE', ARROW, true); btn('restartBtn', 'RECOMMENCER'); btn('pauseMenu', 'MENU');
  show('pause');
}
// REPRENDRE : compte à rebours de 0,6 s sur le pas de tir (rotation figée, tirs ignorés), puis le jeu reprend
function resumeGame() {
  if (state !== 'pause') return;
  hideAll(); state = 'play'; playPhase = 'compte'; countT = COUNTDOWN; last = performance.now();
  sfx('tick', 3);
}
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
// Après une relance depuis la feuille d'échec, les tirs sont ignorés RETRY_LOCK secondes (le doigt qui relance n'enchaîne
// pas sur un tir à l'aveugle). Avant la feuille (0,45 s), les taps sont ignorés : on voit toujours pourquoi on a perdu.
const DEBOUNCE = 40;
let lastTap = -1e9, shotLock = -1e9;
// horodatage d'un événement DOM (ms, horloge de performance.now()), ou maintenant s'il est absent ou d'une autre horloge
const evTs = e => (e && e.timeStamp >= 0 && Math.abs(e.timeStamp - performance.now()) < 1000 ? e.timeStamp : performance.now());
// Toute partie lancée depuis l'interface (CONTINUER, SUIVANT, REJOUER, RECOMMENCER, case de niveau, Espace) pose le même
// verrou : le second tap d'un double tap, qui tombe sur le canevas une fois la feuille cachée, ne tire pas à l'aveugle.
function startFromUI(n, replay, ts) { startLevel(n, replay); shotLock = ts + RETRY_LOCK * 1000; lastTap = Math.max(lastTap, ts); }
function retry(ts) { startFromUI(L.n, true, ts); }
function tap(ts) {
  const now = performance.now();
  if (!(ts >= 0) || Math.abs(ts - now) > 1000) ts = now;
  if (ts - lastTap < DEBOUNCE) return;
  lastTap = ts;
  ac();
  if (state === 'play') { if (ts >= shotLock) throwPin(tapInstant(ts, now, t, simWall)); }
  else if (state === 'failed') retry(ts);
}

// branchements des boutons, des entrées et des événements du cœur (appelé une fois par main.js)
function bindUI() {
  bus.on('level:start', () => { hideAll(); $('hudBtn').style.display = 'block'; });
  bus.on('failed', showFail);
  bus.on('won', showWin);
  click('playBtn', e => startFromUI(continueLevel(), false, evTs(e)));
  click('levelsBtn', showLevels);
  click('levelsBack', showMenu);
  $('soundBtn').onclick = () => { soundOn = !soundOn; saveNow(); soundLabel(); if (soundOn) { ac(); sfx('start'); } };
  $('grid').onclick = e => {
    const h = e.target.closest ? e.target.closest('.wsh') : null;
    if (h) { ac(); sfx('ui'); toggleWorld(+h.dataset.w); return; }
    const b = e.target.closest ? e.target.closest('.lv') : null; if (b && !b.disabled) { ac(); sfx('ui'); startFromUI(+b.dataset.n, false, evTs(e)); }
  };
  click('nextBtn', e => startFromUI(L.n + 1, false, evTs(e)));
  click('replayBtn', e => startFromUI(L.n, true, evTs(e)));
  click('winMenu', showMenu);
  click('retryBtn', e => retry(evTs(e)));
  click('failMenu', showMenu);
  $('hudBtn').onclick = e => { e.stopPropagation(); ac(); sfx('ui'); pauseGame(); };
  click('resumeBtn', resumeGame);
  click('restartBtn', e => startFromUI(L.n, true, evTs(e)));
  click('pauseMenu', showMenu);
  cvs.addEventListener('pointerdown', e => { e.preventDefault(); tap(e.timeStamp); });
  $('failPanel').addEventListener('pointerdown', e => { if (!(e.target.closest && e.target.closest('button'))) tap(e.timeStamp); });
  addEventListener('keydown', e => {
    if (e.repeat) return;
    if (e.code === 'Space' || e.code === 'Enter') {
      e.preventDefault(); ac();
      if (state === 'play' || state === 'failed' || state === 'dying') tap(e.timeStamp);
      else if (state === 'won') startFromUI(L.n + 1, false, evTs(e));
      else if (state === 'menu') startFromUI(continueLevel(), false, evTs(e));
      else if (state === 'pause') resumeGame();
    } else if (e.code === 'KeyP' || e.code === 'Escape') {
      if (state === 'play') pauseGame(); else if (state === 'pause') resumeGame(); else if (state === 'levels') showMenu();
    }
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(); else last = performance.now(); });
}
