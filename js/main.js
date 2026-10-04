// Snailman: menu, the frame loop, HUD, saving, sounds, the online overlays
// (leaderboard, Snigelpost tournaments, replays) and the PWA plumbing.
// The rules live in engine.js and friends; this file only wires them to the page.
//
// A game is played in one of four modes:
//   free     a new random maze, saved under `game`
//   daily    the day's maze (seed from the date), saved under `daily`; every
//            finished attempt goes to the leaderboard, the best one counts
//   contest  one round of a Snigelpost tournament, saved under `run.<id>`
//   replay   somebody's recorded round played back; nothing is saved or sent
import { Game, Replay, runSummary, caffeineTime, SUPPORTED_RULES } from './engine.js';
import { View } from './view.js';
import { bindInput } from './input.js';
import { t, setLang, detectLang, getLang } from './i18n.js';
import { setMuted, isMuted, unlockAudio, sfx } from './game/audio.js';
import { APP_VERSION } from './config.js';
import { net, dayKey, dailySeed, errorKey, retryable, isContestId, inviteLink, cleanName } from './online.js';
import { standings, nextRound } from './standings.js';
import { push } from './push.js';

const $ = (id) => document.getElementById(id);
const store = {
  get(k, d) { try { const v = localStorage.getItem('snailman.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('snailman.' + k, JSON.stringify(v)); } catch { /* private mode */ } },
  del(k) { try { localStorage.removeItem('snailman.' + k); } catch { /* ignore */ } },
};
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => Number(n || 0).toLocaleString(getLang() === 'sv' ? 'sv-SE' : 'en-GB');

setLang(detectLang());
document.querySelectorAll('[data-lang]').forEach((b) => b.addEventListener('click', () => {
  setLang(b.dataset.lang); refreshBanner(true); refreshDailyLine(); refreshPushButtons();
}));

let game = null;
let running = false;   // a game exists, is not over, and is not a replay
let mode = 'free';
let ctx = null;        // daily: { day }; contest: { contest, round }; replay: { rp, run, contest, speed, acc, verdict }
let best = store.get('best', 0);
let lastCaught = null;
let firstLife = true;
const view = new View($('maze'));
const OVERLAYS = ['menu', 'help', 'over', 'board', 'post', 'contest'];

// ---------- menu ----------
function showMenu() {
  hideOverlays();
  $('btn-continue').hidden = !((running && mode === 'free') || store.get('game', null));
  $('menu').hidden = false;
  $('menu-version').textContent = APP_VERSION;
  refreshMute();
  refreshDailyLine();
}
function hideOverlays() { for (const id of OVERLAYS) $(id).hidden = true; }
function paused() { return OVERLAYS.some((id) => !$(id).hidden) || document.hidden; }

$('btn-start').addEventListener('click', () => { hideOverlays(); startGame('free'); });
$('btn-continue').addEventListener('click', () => {
  hideOverlays();
  if (!(running && mode === 'free')) startGame('free', null, store.get('game', null));
});
$('btn-daily').addEventListener('click', () => { hideOverlays(); playDaily(); });
$('btn-board').addEventListener('click', () => openBoard('today'));
$('btn-post').addEventListener('click', () => openPost());
$('btn-help').addEventListener('click', () => { $('help').hidden = false; });
$('btn-help-close').addEventListener('click', () => { $('help').hidden = true; });
$('btn-menu').addEventListener('click', () => { save(); if (mode === 'replay') endReplay(); else showMenu(); });
$('btn-again').addEventListener('click', () => { hideOverlays(); if (mode === 'daily') playDaily(true); else startGame('free'); });
$('btn-over-menu').addEventListener('click', () => showMenu());
$('btn-over-board').addEventListener('click', () => openBoard('today'));
$('btn-over-contest').addEventListener('click', () => openContest(ctx?.contest?.id || ctx?.contestId));
$('btn-mute').addEventListener('click', () => { setMuted(!isMuted()); store.set('muted', isMuted()); refreshMute(); });
function refreshMute() {
  const m = isMuted();
  $('btn-mute').textContent = m ? '🔇' : '🔊';
  $('btn-mute').setAttribute('aria-label', t(m ? 'aria.unmute' : 'aria.mute'));
}
setMuted(!!store.get('muted', false));
addEventListener('pointerdown', unlockAudio, { once: true });
addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (!$('help').hidden) { $('help').hidden = true; return; }
  if (!$('board').hidden) { $('board').hidden = true; return; }
  if (!$('contest').hidden) { $('contest').hidden = true; if (!game || !running) showMenu(); return; }
  if (!$('post').hidden) { $('post').hidden = true; showMenu(); return; }
  if (!$('over').hidden) return;
  if (mode === 'replay') { endReplay(); return; }
  if ($('menu').hidden) { save(); showMenu(); } else if (running || store.get('game', null)) { $('btn-continue').click(); }
});

// ---------- games ----------
function saveKey() {
  if (mode === 'daily') return 'daily';
  if (mode === 'contest') return 'run.' + ctx.contest.id;
  return 'game';
}
function savedFor(m, c) {
  if (m === 'daily') { const s = store.get('daily', null); return s && s.day === c.day ? s.game : null; }
  if (m === 'contest') { const s = store.get('run.' + c.contest.id, null); return s && s.round === c.round ? s.game : null; }
  return store.get('game', null);
}
function seedFor(m, c) {
  if (m === 'daily') return dailySeed(c.day);
  if (m === 'contest') return c.contest.seeds[c.round - 1];
  return (Date.now() ^ (Math.random() * 0xffffffff)) | 0;
}
// Starts (or resumes, when `saved` is given) a game in a mode.
function startGame(m, c = null, saved = null) {
  mode = m;
  ctx = c;
  game = null;
  if (saved) { try { game = Game.fromJSON(saved); } catch { game = null; } }
  const fresh = !game;
  if (fresh) game = new Game({ seed: seedFor(m, c) });
  game.caffeineTotal = caffeineTime(game.level);
  view.setMaze(game.maze);
  view.particles = [];
  running = game.state !== 'over';
  firstLife = fresh;
  lastCaught = null;
  $('hud').hidden = false;
  $('pad').hidden = false;
  $('replay-bar').hidden = true;
  refreshTarget();
  refreshBanner(true);
  if (fresh) save();
  // A run that ended without its result being handled (the page went away at
  // the wrong moment) is finished now instead of being lost.
  else if (game.state === 'over' && m !== 'free') { running = true; gameOver(); }
}
function save() {
  if (!game || !running || mode === 'replay' || game.state === 'over') return;
  const g = game.toJSON();
  if (mode === 'daily') store.set('daily', { day: ctx.day, game: g });
  else if (mode === 'contest') store.set(saveKey(), { round: ctx.round, game: g });
  else store.set('game', g);
}
let saveT = 0;

function playDaily(again = false) {
  const day = dayKey();
  const saved = again ? null : savedFor('daily', { day });
  startGame('daily', { day }, saved);
}

function handleEvents() {
  const quiet = mode === 'replay' && ctx.speed > 1;
  for (const e of game.takeEvents()) {
    switch (e.type) {
      case 'eat': if (!quiet) sfx.tick(); break;
      case 'bean': if (!quiet) sfx.turn(); game.caffeineTotal = caffeineTime(game.level); view.burst(e.x + 0.5, e.y + 0.5, '#5a3b22', 10, 3); break;
      case 'scare':
        if (!quiet) sfx.crate();
        view.burst(e.x, e.y, '#3b82f6', 14, 4);
        view.floatText(e.x, e.y - 0.4, '+' + e.score, '#fff');
        break;
      case 'bonusShow': if (!quiet) sfx.tickLow(); break;
      case 'stuck': if (!quiet) sfx.splat(); view.burst(e.x + 0.5, e.y + 0.7, '#beff96', 8, 2.5); break;
      case 'bonus': if (!quiet) sfx.jump(); view.burst(e.x + 0.5, e.y + 0.5, '#e2453c', 16, 4); view.floatText(e.x + 0.5, e.y, '+' + e.score, '#fff'); break;
      case 'caught': if (!quiet) sfx.cracked(); lastCaught = e.id; firstLife = false; break;
      case 'clear': if (!quiet) sfx.win(); break;
      case 'level': view.setMaze(game.maze); view.particles = []; game.caffeineTotal = caffeineTime(game.level); break;
      case 'life': if (!quiet) sfx.win(); flashBanner(t('banner.life')); break;
      case 'over': if (mode === 'replay') replayEnded(); else gameOver(); break;
      default: break;
    }
  }
}

function gameOver() {
  running = false;
  store.del(saveKey());
  sfx.sudden();
  const newBest = game.score > best;
  if (newBest) { best = game.score; store.set('best', best); }
  $('over-why').textContent = lastCaught ? t('over.by.' + lastCaught) : '';
  $('over-score').textContent = t('over.score', { score: fmt(game.score) });
  $('over-level').textContent = t('over.level', { level: game.level });
  $('over-best').textContent = newBest ? t('over.newBest') : t('over.best', { best: fmt(best) });
  $('over-best').classList.toggle('new', newBest);
  const online = mode === 'daily' || mode === 'contest';
  $('over-online').hidden = !online;
  $('over-online').textContent = online ? t('over.sending') : '';
  $('btn-again').hidden = mode === 'contest';
  $('btn-over-board').hidden = mode !== 'daily';
  $('btn-over-contest').hidden = mode !== 'contest';
  const run = runSummary(game);
  if (mode === 'daily') sendDaily(ctx.day, run);
  if (mode === 'contest') sendContest(ctx.contest.id, ctx.round, run);
  setTimeout(() => { $('over').hidden = false; }, 700);
}

async function sendDaily(day, run) {
  const name = playerName();
  try {
    const b = await net.daily.submit(day, name, run);
    if (b) dailyCache = b;
    const me = b?.me;
    $('over-online').textContent = !me ? '' : run.score < me.score
      ? t('over.dailyKept', { score: fmt(me.score), rank: me.rank, players: b.players })
      : t('over.dailyRank', { rank: me.rank, players: b.players });
  } catch (e) {
    if (retryable(e)) { net.queue('daily', day, { day, name, run }); $('over-online').textContent = t('over.queued'); }
    else $('over-online').textContent = t(errorKey(e));
  }
}

async function sendContest(id, round, run) {
  try {
    const c = await net.contest.submit(id, round, run);
    if (ctx && mode === 'contest') ctx.contest = c;
    push.notify(id, 'played', round);
    $('over-online').textContent = t('over.contestSent', { round });
  } catch (e) {
    if (retryable(e)) { net.queue('contest', `${id}:${round}`, { contest: id, round, run }); $('over-online').textContent = t('over.queued'); }
    else $('over-online').textContent = t(errorKey(e));
  }
}

// ---------- replays ----------
async function watch(contest, userId, round) {
  $('contest-status').textContent = t('board.loading');
  let r;
  try { r = await net.contest.run(contest.id, userId, round); } catch (e) { $('contest-status').textContent = t(errorKey(e)); return; }
  if (!SUPPORTED_RULES.includes(r.rules_version)) { $('contest-status').textContent = t('replay.old'); return; }
  $('contest-status').textContent = '';
  hideOverlays();
  const rp = new Replay(r.seed, r.inputs);
  mode = 'replay';
  ctx = { rp, run: r, contest, speed: store.get('replaySpeed', 1), acc: 0, verdict: null };
  game = rp.game;
  game.caffeineTotal = caffeineTime(game.level);
  running = false;
  firstLife = false;
  view.setMaze(game.maze);
  view.particles = [];
  $('hud').hidden = false;
  $('pad').hidden = true;
  $('replay-bar').hidden = false;
  $('replay-title').textContent = t('replay.title', { name: r.name, round });
  $('btn-replay-speed').textContent = ctx.speed + '×';
  refreshTarget();
  refreshBanner(true);
}
function replayEnded() {
  const r = ctx.run, g = ctx.rp.game;
  const ok = g.score === r.score && g.ticks === r.ticks;
  ctx.verdict = ok ? t('replay.ok', { score: fmt(r.score) }) : t('replay.bad', { replayed: fmt(g.score), score: fmt(r.score) });
  flashBanner(ctx.verdict, 4000);
}
function endReplay() {
  const c = ctx?.contest;
  $('replay-bar').hidden = true;
  $('pad').hidden = false;
  game = null;
  mode = 'free';
  ctx = null;
  if (c) openContest(c.id); else showMenu();
}
const SPEEDS = [1, 2, 4, 8];
$('btn-replay-speed').addEventListener('click', () => {
  if (mode !== 'replay') return;
  ctx.speed = SPEEDS[(SPEEDS.indexOf(ctx.speed) + 1) % SPEEDS.length];
  store.set('replaySpeed', ctx.speed);
  $('btn-replay-speed').textContent = ctx.speed + '×';
});
$('btn-replay-close').addEventListener('click', () => { if (mode === 'replay') endReplay(); });

// ---------- banner over the maze ----------
let bannerKey = null;
let flashUntil = 0;
function flashBanner(text, ms = 1500) { $('banner').textContent = text; $('banner').hidden = false; flashUntil = performance.now() + ms; bannerKey = 'flash'; }
function refreshBanner(force) {
  if (!game) { $('banner').hidden = true; return; }
  if (bannerKey === 'flash' && performance.now() < flashUntil) return;
  let key = null, text = '';
  if (mode === 'replay' && ctx.verdict) { key = 'verdict'; text = ctx.verdict; }
  else if (game.state === 'ready') { key = firstLife ? 'ready' : 'readyAgain'; text = t(firstLife ? 'banner.ready' : 'banner.readyAgain'); }
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
  dir(d) { if (game && running && mode !== 'replay' && !paused()) { game.want(d); if (navigator.vibrate && game.state === 'ready') navigator.vibrate(6); } },
});

// ---------- HUD ----------
let lastLives = -1;
function refreshHud() {
  if (!game) return;
  $('hud-score').textContent = game.score;
  $('hud-best').textContent = Math.max(best, mode === 'replay' ? 0 : game.score);
  $('hud-level').textContent = game.level;
  const spare = Math.max(0, game.lives - 1);
  if (spare !== lastLives) { lastLives = spare; View.drawLives($('hud-lives'), spare); }
}
// In a tournament round: the best score the others have in this round.
// In the day's maze: the best on the board today.
function refreshTarget() {
  let label = '', value = null;
  if (mode === 'contest') {
    const others = (ctx.contest.runs || []).filter((r) => r.round === ctx.round && r.user_id !== net.userId());
    if (others.length) { label = t('hud.target'); value = Math.max(...others.map((r) => r.score)); }
  } else if (mode === 'daily' && dailyCache && dailyCache.day === ctx.day && dailyCache.top?.length) {
    label = t('hud.daily'); value = dailyCache.top[0].score;
  }
  $('hud-target-box').hidden = value == null;
  $('hud-target-label').textContent = label;
  $('hud-target').textContent = value == null ? '' : value;
}

// ---------- names ----------
function playerName() { return cleanName(store.get('name', '')) || t('post.defaultName'); }
// One name for the player, the account's (snails.se/account/). The local copy
// is only for playing offline and before there is an account; the server
// shows the profile name whenever the player has chosen one.
async function fillName(input) {
  const n = (await net.profileName()) || cleanName(store.get('name', ''));
  if (n) store.set('name', n);
  input.value = n;
}
for (const id of ['opt-name', 'opt-join-name']) {
  $(id).addEventListener('change', (e) => {
    const n = cleanName(e.target.value);
    store.set('name', n);
    if (n) net.setName(n).catch(() => { /* offline: the next result carries it */ });
  });
}
// the account's name, fetched once per visit so the boards and the HUD agree with it
if (net.signedIn()) net.profileName().then((n) => { if (n) store.set('name', n); });

// ---------- leaderboard ----------
let dailyCache = null; // the last board seen for a day, for the menu line and the HUD
let boardTab = 'today';
async function openBoard(tab) {
  hideOverlays();
  boardTab = tab;
  $('board').hidden = false;
  document.querySelectorAll('[data-board]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.board === tab)));
  $('board-list').innerHTML = '';
  $('board-lead').textContent = '';
  $('board-me').textContent = '';
  $('board-status').textContent = t('board.loading');
  if (!net.available()) { $('board-status').textContent = t('err.disabled'); return; }
  try {
    let b;
    if (tab === 'records') b = await net.daily.records();
    else {
      const today = dayKey();
      const day = tab === 'today' ? today : dayKey(new Date(Date.parse(today + 'T12:00:00Z') - 86400000));
      b = await net.daily.board(day);
      if (tab === 'today') dailyCache = b;
    }
    if (boardTab !== tab) return;
    renderBoard(tab, b);
    $('board-status').textContent = '';
  } catch (e) { if (boardTab === tab) $('board-status').textContent = t(errorKey(e)); }
}
function renderBoard(tab, b) {
  $('board-lead').textContent = tab === 'records' ? t('board.leadRecords', { players: b.players }) : t('board.leadDay', { day: b.day, players: b.players });
  $('board-list').innerHTML = b.top.length
    ? b.top.map((r) => `<li class="${r.mine ? 'mine' : ''}"><span class="rank">${r.rank}</span><span class="who">${esc(r.name)}<small>${t('board.level', { level: r.level })}${r.day && tab === 'records' ? ' · ' + esc(r.day) : ''}</small></span><span class="pts">${fmt(r.score)}</span></li>`).join('')
    : `<li class="none">${t('board.empty')}</li>`;
  $('board-me').textContent = b.me ? t('board.me', { rank: b.me.rank, score: fmt(b.me.score) }) : t('board.meNone');
}
document.querySelectorAll('[data-board]').forEach((b) => b.addEventListener('click', () => openBoard(b.dataset.board)));
$('btn-board-play').addEventListener('click', () => { hideOverlays(); playDaily(); });
$('btn-board-close').addEventListener('click', () => { $('board').hidden = true; if (!game || !running) showMenu(); });

// The line under the menu buttons. Only asks the server when this browser
// already has an account: opening the menu never creates one.
async function refreshDailyLine() {
  const line = $('daily-line');
  const today = dayKey();
  const show = (b) => {
    line.textContent = b?.me && b.day === today ? t('menu.dailyBest', { score: fmt(b.me.score), rank: b.me.rank, players: b.players }) : t('menu.dailyNone');
  };
  show(dailyCache);
  if (!net.available() || !net.signedIn()) return;
  if (dailyCache && dailyCache.day === today && Date.now() - (dailyCache.at || 0) < 60000) return;
  try { dailyCache = { ...(await net.daily.board(today)), at: Date.now() }; show(dailyCache); } catch { /* the line is a nicety */ }
}

// ---------- Snigelpost ----------
let openContestId = null;
let contestPoll = 0;
async function openPost() {
  hideOverlays();
  $('post').hidden = false;
  $('post-status').textContent = t('board.loading');
  $('post-list').innerHTML = '';
  refreshPushButtons();
  if (!net.available()) { $('post-status').textContent = t('err.disabled'); return; }
  await fillName($('opt-name'));
  $('opt-rounds').value = String(store.get('rounds', 3));
  $('opt-players').value = String(store.get('players', 2));
  try {
    const list = await net.contest.mine();
    const me = net.userId();
    $('post-list').innerHTML = list.length ? list.map((c) => contestRow(c, me)).join('') : `<li class="none">${t('post.none')}</li>`;
    $('post-status').textContent = '';
  } catch (e) { $('post-status').textContent = t(errorKey(e)); }
}
function contestRow(c, me) {
  const others = c.players.filter((p) => p.user_id !== me).map((p) => p.name);
  const who = others.length ? t('post.vs', { names: others.map(esc).join(', ') }) : t('post.alone');
  let state;
  const next = nextRound(c, me);
  if (c.status === 'finished') {
    const row = standings(c).find((r) => r.user_id === me);
    state = row && row.place === 1 ? t('post.state.won') : t('post.state.done', { place: row?.place ?? '–', of: c.players.length });
  } else state = next ? t('post.state.play', { round: next }) : t('post.state.wait');
  return `<li class="prow${next ? ' turn' : ''}" data-id="${c.id}"><span class="who">${who}<small>${t('rounds.' + c.rounds)} · ${state}</small></span>` +
    `<button class="btn secondary popen">${t('post.open')}</button></li>`;
}
$('post-list').addEventListener('click', (e) => { const row = e.target.closest('li[data-id]'); if (row) openContest(row.dataset.id); });
$('opt-rounds').addEventListener('change', () => store.set('rounds', Number($('opt-rounds').value)));
$('opt-players').addEventListener('change', () => store.set('players', Number($('opt-players').value)));
$('btn-post-create').addEventListener('click', async () => {
  store.set('name', cleanName($('opt-name').value));
  $('post-status').textContent = t('board.loading');
  try {
    const c = await net.contest.create(playerName(), Number($('opt-rounds').value) || 3, Number($('opt-players').value) || 2);
    renderContest(c);
  } catch (e) { $('post-status').textContent = t(errorKey(e)); }
});
$('btn-post-close').addEventListener('click', () => showMenu());

async function openContest(id) {
  if (!isContestId(id)) { showMenu(); return; }
  hideOverlays();
  $('contest').hidden = false;
  openContestId = id;
  $('contest-status').textContent = t('board.loading');
  try { renderContest(await net.contest.get(id)); } catch (e) { $('contest-status').textContent = t(errorKey(e)); }
}
let shownContest = null;
function renderContest(c) {
  hideOverlays();
  $('contest').hidden = false;
  shownContest = c;
  openContestId = c.id;
  const me = net.userId();
  const member = c.players.some((p) => p.user_id === me);
  const open = c.status !== 'finished';
  const next = nextRound(c, me);
  const rows = standings(c);
  const played = (u, r) => c.runs.some((x) => x.user_id === u && x.round === r);

  $('contest-meta').textContent = open
    ? t('contest.meta', { rounds: t('rounds.' + c.rounds), players: c.players.length, max: c.max_players, deadline: new Date(c.deadline).toLocaleDateString(getLang() === 'sv' ? 'sv-SE' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) })
    : t('contest.metaDone', { rounds: t('rounds.' + c.rounds), players: c.players.length });
  const link = inviteLink(c.id);
  $('contest-invite').hidden = !(open && member && c.players.length < c.max_players);
  $('contest-link').value = link;
  $('btn-contest-share').hidden = !navigator.share;

  const head = `<tr><th></th><th>${t('contest.player')}</th>${Array.from({ length: c.rounds }, (_, i) => `<th>${t('contest.round', { n: i + 1 })}</th>`).join('')}<th>${t('contest.points')}</th></tr>`;
  const body = rows.map((r) => `<tr class="${r.user_id === me ? 'mine' : ''}"><td class="place">${open && !r.played ? '' : r.place}</td><td class="who">${esc(r.name)}</td>` +
    r.rounds.map((s, i) => {
      const round = i + 1;
      if (s == null) return `<td class="none">–</td>`;
      const canWatch = member && (!open || r.user_id === me || played(me, round));
      return canWatch ? `<td><button class="cell" data-user="${r.user_id}" data-round="${round}" aria-label="▶ ${esc(r.name)} ${round}">${fmt(s)} ▶</button></td>` : `<td>${fmt(s)}</td>`;
    }).join('') + `<td class="pts">${fmt(r.points)}</td></tr>`).join('');
  $('contest-table').innerHTML = `<thead>${head}</thead><tbody>${body}</tbody>`;

  let note;
  if (!open) {
    const top = rows.filter((r) => r.place === 1);
    note = t('contest.finished') + ' ' + (top.some((r) => r.user_id === me) && top.length === 1 ? t('contest.youWon') : t('contest.winner', { name: top.map((r) => r.name).join(' & ') }));
  } else if (!member) note = t('contest.joinNote');
  else if (!next) note = t('contest.waitAll') + ' ' + t('contest.watchNote');
  else note = t('contest.oneRoundNote') + ' ' + t('contest.watchNote');
  $('contest-note').textContent = note;

  const saved = next && savedFor('contest', { contest: c, round: next });
  $('btn-contest-play').hidden = !next;
  if (next) $('btn-contest-play').textContent = t(saved ? 'contest.resume' : 'contest.play', { round: next });
  const canJoin = !member && open && c.players.length < c.max_players;
  $('btn-contest-join').hidden = !canJoin;
  $('contest-join-name').hidden = !canJoin;
  if (canJoin) fillName($('opt-join-name'));
  $('btn-contest-end').hidden = !(open && c.host === me);
  const hostWithOthers = open && c.host === me && c.players.length > 1;
  $('btn-contest-leave').hidden = !member || hostWithOthers;
  $('btn-contest-leave').textContent = t(open ? 'contest.leave' : 'contest.hide');
  $('contest-status').textContent = '';
  refreshPushButtons();
  clearInterval(contestPoll);
  if (open) contestPoll = setInterval(() => { if (!$('contest').hidden && !document.hidden) refreshContest(); }, 20000);
}
async function refreshContest() {
  if (!openContestId) return;
  try { const c = await net.contest.get(openContestId); if (!$('contest').hidden) renderContest(c); } catch { /* next time */ }
}
$('contest-table').addEventListener('click', (e) => {
  const b = e.target.closest('button.cell');
  if (b && shownContest) watch(shownContest, b.dataset.user, Number(b.dataset.round));
});
$('btn-contest-play').addEventListener('click', () => {
  const c = shownContest;
  const round = nextRound(c, net.userId());
  if (!round) return;
  clearInterval(contestPoll);
  hideOverlays();
  startGame('contest', { contest: c, round }, savedFor('contest', { contest: c, round }));
});
$('btn-contest-join').addEventListener('click', async () => {
  store.set('name', cleanName($('opt-join-name').value));
  $('contest-status').textContent = t('board.loading');
  try {
    const c = await net.contest.join(shownContest.id, playerName());
    push.notify(c.id, 'joined');
    renderContest(c);
  } catch (e) { $('contest-status').textContent = t(errorKey(e)); }
});
$('btn-contest-end').addEventListener('click', async () => {
  if (!confirm(t('contest.endConfirm'))) return;
  try { const c = await net.contest.close(shownContest.id); push.notify(c.id, 'closed'); renderContest(c); }
  catch (e) { $('contest-status').textContent = t(errorKey(e)); }
});
$('btn-contest-leave').addEventListener('click', async () => {
  const open = shownContest.status !== 'finished';
  if (open && !confirm(t('contest.leaveConfirm'))) return;
  try { await net.contest.leave(shownContest.id); store.del('run.' + shownContest.id); openPost(); }
  catch (e) { $('contest-status').textContent = t(errorKey(e)); }
});
$('btn-contest-back').addEventListener('click', () => { clearInterval(contestPoll); openContestId = null; openPost(); });
$('btn-contest-copy').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText($('contest-link').value); } catch { $('contest-link').select(); document.execCommand?.('copy'); }
  $('btn-contest-copy').textContent = t('contest.copied');
  setTimeout(() => { $('btn-contest-copy').textContent = t('contest.copy'); }, 1500);
});
$('btn-contest-share').addEventListener('click', () => {
  navigator.share?.({ title: 'Snailman', text: t('contest.shareText'), url: $('contest-link').value }).catch(() => {});
});

// ---------- notifications ----------
function refreshPushButtons() {
  for (const b of [$('btn-push'), $('btn-contest-push')]) {
    if (!push.supported()) { b.hidden = true; continue; }
    b.hidden = false;
    if (push.needsInstall()) { b.textContent = t('push.install'); b.disabled = true; continue; }
    const p = push.permission();
    if (p === 'denied') { b.hidden = true; continue; } // nothing the button can do; the browser settings can
    b.disabled = p === 'granted';
    b.textContent = p === 'denied' ? t('push.denied') : p === 'granted' ? t('push.on') : t('push.ask');
    if (p === 'granted') push.current().then((s) => { if (!s) { b.disabled = false; b.textContent = t('push.ask'); } });
  }
}
for (const id of ['btn-push', 'btn-contest-push']) {
  $(id).addEventListener('click', async () => {
    try { await push.subscribe(getLang()); } catch { /* denied or blocked: the label says so */ }
    refreshPushButtons();
  });
}

// ---------- results waiting for the network ----------
async function flushPending() {
  if (!net.available() || !Object.keys(net.pending()).length) return;
  for (const d of await net.flush()) {
    if (d.sent && d.id.startsWith('contest:')) push.notify(d.p.contest, 'played', d.p.round);
  }
}
addEventListener('online', flushPending);

// ---------- loop ----------
let last = 0;
function frame(ts) {
  const dt = Math.min(0.1, last ? (ts - last) / 1000 : 0);
  last = ts;
  update(dt, ts / 1000, paused());
  requestAnimationFrame(frame);
}
// One frame's worth of game. Split out so browser tests can drive it while the
// page is in the background (no animation frames then).
function update(dt, now, isPaused) {
  if (game) {
    if (mode === 'replay') {
      if (!isPaused && !ctx.rp.done) {
        ctx.acc += dt * 120 * ctx.speed;
        const n = Math.floor(ctx.acc);
        ctx.acc -= n;
        ctx.rp.step(n);
        handleEvents();
      }
    } else if (running && !isPaused) {
      game.advance(dt);
      handleEvents();
      saveT += dt;
      if (saveT > 2) { saveT = 0; save(); }
    }
    view.draw(game, now);
    refreshHud();
    refreshBanner(false);
  }
}
requestAnimationFrame(frame);
addEventListener('visibilitychange', () => {
  if (document.hidden) save();
  else if (!$('contest').hidden) refreshContest();
});
addEventListener('pagehide', save);

// ---------- PWA ----------
let deferredPrompt = null;
addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; $('btn-install').hidden = false; });
$('btn-install').addEventListener('click', async () => { if (!deferredPrompt) return; deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt = null; $('btn-install').hidden = true; });
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').then(() => { $('offline-hint').textContent = t('menu.offline'); push.resubscribe(getLang()); }).catch(() => {});
  });
}

// for browser tests and debugging
window.snailman = {
  get game() { return game; }, get view() { return view; }, get running() { return running; }, get mode() { return mode; }, get ctx() { return ctx; },
  newGame: () => startGame('free'),
  // advance as if seconds of frames had passed, overlays or not (tests only)
  pump(seconds, dt = 1 / 60) { for (let t = 0; t < seconds; t += dt) update(dt, performance.now() / 1000, false); },
};

// ---------- links: ?contest=ID (an invitation or a notification), ?daily=1 ----------
showMenu();
{
  const q = new URLSearchParams(location.search);
  const id = q.get('contest');
  const daily = q.get('daily');
  if (id || daily) history.replaceState(null, '', location.pathname);
  if (id && isContestId(id)) openContest(id);
  else if (daily) openBoard('today');
}
if (net.signedIn()) flushPending();
