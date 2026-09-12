// Snailman: menu, the frame loop, HUD, saving, sounds and the PWA plumbing.
// The rules live in engine.js and friends; this file only wires them to the page.
import { Game, caffeineTime } from './engine.js';
import { View } from './view.js';
import { bindInput } from './input.js';
import { t, setLang, detectLang } from './i18n.js';
import { setMuted, isMuted, unlockAudio, sfx } from './game/audio.js';
import { APP_VERSION } from './config.js';

const $ = (id) => document.getElementById(id);
const store = {
  get(k, d) { try { const v = localStorage.getItem('snailman.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('snailman.' + k, JSON.stringify(v)); } catch { /* private mode */ } },
  del(k) { try { localStorage.removeItem('snailman.' + k); } catch { /* ignore */ } },
};

setLang(detectLang());
document.querySelectorAll('[data-lang]').forEach((b) => b.addEventListener('click', () => { setLang(b.dataset.lang); refreshBanner(true); }));

let game = null;
let running = false;   // a game exists and is not over
let best = store.get('best', 0);
let lastCaught = null;
let firstLife = true;
const view = new View($('maze'));

// ---------- menu ----------
function showMenu() {
  $('btn-continue').hidden = !(running || store.get('game', null));
  $('menu').hidden = false;
  $('menu-version').textContent = APP_VERSION;
  refreshMute();
}
function hideMenu() { $('menu').hidden = true; }
function paused() { return !$('menu').hidden || !$('help').hidden || !$('over').hidden || document.hidden; }

$('btn-start').addEventListener('click', () => { newGame(); hideMenu(); });
$('btn-continue').addEventListener('click', () => { if (!running) resumeGame(); hideMenu(); });
$('btn-help').addEventListener('click', () => { $('help').hidden = false; });
$('btn-help-close').addEventListener('click', () => { $('help').hidden = true; });
$('btn-menu').addEventListener('click', () => { save(); showMenu(); });
$('btn-again').addEventListener('click', () => { $('over').hidden = true; newGame(); });
$('btn-over-menu').addEventListener('click', () => { $('over').hidden = true; showMenu(); });
$('btn-mute').addEventListener('click', () => { setMuted(!isMuted()); store.set('muted', isMuted()); refreshMute(); });
function refreshMute() {
  const m = isMuted();
  $('btn-mute').textContent = m ? '🔇' : '🔊';
  $('btn-mute').setAttribute('aria-label', t(m ? 'aria.unmute' : 'aria.mute'));
}
setMuted(!!store.get('muted', false));
addEventListener('pointerdown', unlockAudio, { once: true });
addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (!$('help').hidden) { $('help').hidden = true; return; }
    if (!$('over').hidden) return;
    if ($('menu').hidden) { save(); showMenu(); } else if (running || store.get('game', null)) { $('btn-continue').click(); }
  }
});

// ---------- game ----------
function newGame() {
  game = new Game({ seed: (Date.now() ^ (Math.random() * 0xffffffff)) | 0 });
  game.caffeineTotal = caffeineTime(game.level);
  view.setMaze(game.maze);
  view.particles = [];
  running = true;
  firstLife = true;
  store.del('game');
  $('hud').hidden = false;
  $('pad').hidden = false;
  refreshBanner(true);
}
function resumeGame() {
  const saved = store.get('game', null);
  if (!saved) { newGame(); return; }
  try { game = Game.fromJSON(saved); } catch { newGame(); return; }
  game.caffeineTotal = caffeineTime(game.level);
  view.setMaze(game.maze);
  running = game.state !== 'over';
  firstLife = false;
  $('hud').hidden = false;
  $('pad').hidden = false;
  refreshBanner(true);
}
function save() {
  if (!game || !running) return;
  store.set('game', game.toJSON());
}
let saveT = 0;

function handleEvents() {
  for (const e of game.takeEvents()) {
    switch (e.type) {
      case 'eat': sfx.tick(); break;
      case 'bean': sfx.turn(); game.caffeineTotal = caffeineTime(game.level); view.burst(e.x + 0.5, e.y + 0.5, '#5a3b22', 10, 3); break;
      case 'scare':
        sfx.crate();
        view.burst(e.x, e.y, '#3b82f6', 14, 4);
        view.floatText(e.x, e.y - 0.4, '+' + e.score, '#fff');
        break;
      case 'bonusShow': sfx.tickLow(); break;
      case 'bonus': sfx.jump(); view.burst(e.x + 0.5, e.y + 0.5, '#e2453c', 16, 4); view.floatText(e.x + 0.5, e.y, '+' + e.score, '#fff'); break;
      case 'caught': sfx.cracked(); lastCaught = e.id; firstLife = false; break;
      case 'clear': sfx.win(); break;
      case 'level': view.setMaze(game.maze); view.particles = []; game.caffeineTotal = caffeineTime(game.level); break;
      case 'life': sfx.win(); flashBanner(t('banner.life')); break;
      case 'over': gameOver(); break;
      default: break;
    }
  }
}

function gameOver() {
  running = false;
  store.del('game');
  sfx.sudden();
  const newBest = game.score > best;
  if (newBest) { best = game.score; store.set('best', best); }
  $('over-why').textContent = lastCaught ? t('over.by.' + lastCaught) : '';
  $('over-score').textContent = t('over.score', { score: game.score });
  $('over-level').textContent = t('over.level', { level: game.level });
  $('over-best').textContent = newBest ? t('over.newBest') : t('over.best', { best });
  $('over-best').classList.toggle('new', newBest);
  setTimeout(() => { $('over').hidden = false; }, 700);
}

// ---------- banner over the maze ----------
let bannerKey = null;
let flashUntil = 0;
function flashBanner(text) { $('banner').textContent = text; $('banner').hidden = false; flashUntil = performance.now() + 1500; bannerKey = 'flash'; }
function refreshBanner(force) {
  if (!game) { $('banner').hidden = true; return; }
  if (bannerKey === 'flash' && performance.now() < flashUntil) return;
  let key = null, text = '';
  if (game.state === 'ready') { key = firstLife ? 'ready' : 'readyAgain'; text = t(firstLife ? 'banner.ready' : 'banner.readyAgain'); }
  else if (game.state === 'clear') { key = 'clear'; text = t('banner.clear'); }
  else if (game.state === 'dying') { key = 'caught'; text = t('banner.caught'); }
  if (key !== bannerKey || force) {
    bannerKey = key;
    $('banner').hidden = !key;
    $('banner').textContent = text;
  }
}

// ---------- input ----------
bindInput({ stage: $('stage'), pad: { up: $('btn-up'), down: $('btn-down'), left: $('btn-left'), right: $('btn-right') } }, {
  dir(d) { if (game && running && !paused()) { game.want(d); if (navigator.vibrate && game.state === 'ready') navigator.vibrate(6); } },
});

// ---------- HUD ----------
let lastLives = -1;
function refreshHud() {
  if (!game) return;
  $('hud-score').textContent = game.score;
  $('hud-best').textContent = Math.max(best, game.score);
  $('hud-level').textContent = game.level;
  const spare = Math.max(0, game.lives - 1);
  if (spare !== lastLives) { lastLives = spare; View.drawLives($('hud-lives'), spare); }
}

// ---------- loop ----------
let last = 0;
function frame(ts) {
  const dt = Math.min(0.1, last ? (ts - last) / 1000 : 0);
  last = ts;
  if (game) {
    if (running && !paused()) {
      game.advance(dt);
      handleEvents();
      saveT += dt;
      if (saveT > 2) { saveT = 0; save(); }
    }
    view.draw(game, ts / 1000);
    refreshHud();
    refreshBanner(false);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
addEventListener('visibilitychange', () => { if (document.hidden) save(); });
addEventListener('pagehide', save);

// ---------- PWA ----------
let deferredPrompt = null;
addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; $('btn-install').hidden = false; });
$('btn-install').addEventListener('click', async () => { if (!deferredPrompt) return; deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt = null; $('btn-install').hidden = true; });
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').then(() => { $('offline-hint').textContent = t('menu.offline'); }).catch(() => {});
  });
}

// for browser tests and debugging
window.snailman = { get game() { return game; }, get view() { return view; }, get running() { return running; }, newGame };

showMenu();
