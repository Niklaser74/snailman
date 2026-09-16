// Snailman: the whole game as plain state and a fixed-step simulation. No DOM,
// no canvas, no audio, so test/engine.test.mjs can play whole levels in Node.
// main.js and view.js read sounds and effects off `events` after each frame.
//
// The rule that makes it a snail game: every tile you leave is wet with slime
// for a while, and you may not enter wet slime. No reversing, no retracing —
// every corridor is one-way until it dries. The hunters slip on it.
import { MAZES, parseMaze, PATH, LETTUCE, BEAN, NONE } from './maze.js';
import { mulberry32 } from './game/rng.js';
import { OPP, posOf, dist, reverse, step } from './mover.js';
import { makeHunters, resetHunters, updateHunter, frightenAll, calmAll, applyGlobalMode, isActive, SCATTER_CHASE } from './hunters.js';

export const H = 1 / 120;         // fixed step
export const MAX_SUBSTEPS = 6;    // per frame; beyond this we drop time (tab was hidden)

// ---- tempo: everything is in tiles per second ----
export const SNAIL_SPEED = 3.6;
export const CAFFEINE_SPEED = 1.6;   // multiplier while caffeinated
export const SLIME_TIME = 6;         // seconds a tile stays wet, level 1 (was 10: painted yourself into corners too fast)
export const SLIME_TIME_MAX = 12;
export const CAFFEINE_TIME = 7;      // level 1
export const CAFFEINE_MIN = 3;
export const BONUS_TIME = 10;        // the strawberry waits this long
export const BONUS_AT = [0.3, 0.7];  // share of lettuce eaten when it shows
export const READY_TIME = 1.4;
export const DYING_TIME = 1.6;
export const CLEAR_TIME = 2.2;
export const EAT_FREEZE = 0.5;
export const CATCH_DIST = 0.6;       // tiles
export const START_LIVES = 3;
export const EXTRA_LIFE_AT = 10000;
export const POINTS = { lettuce: 10, bean: 50, hunter: [200, 400, 800, 1600] };
export const bonusPoints = (level) => Math.min(1000, 100 * level);

// hunters relative to the snail: a hair slower at first, never faster
export function hunterFactor(level) { return Math.min(0.95, 0.78 + 0.03 * (level - 1)); }
export function slimeTime(level) { return Math.min(SLIME_TIME_MAX, SLIME_TIME + 0.5 * (level - 1)); }
export function caffeineTime(level) { return Math.max(CAFFEINE_MIN, CAFFEINE_TIME - 0.5 * (level - 1)); }

export class Game {
  constructor({ seed = (Date.now() | 0), level = 1 } = {}) {
    this.seed = seed;
    this.rng = mulberry32(seed);
    this.rngDraws = 0;
    this.level = level;
    this.score = 0;
    this.lives = START_LIVES;
    this.extraLifeGiven = false;
    this.events = [];
    this.acc = 0;
    this.time = 0;
    this.snail = { tx: 0, ty: 0, dir: null, want: null, o: 0, facing: -1, stuck: false };
    this.hunters = null;
    this.loadLevel(level);
  }

  random() { this.rngDraws++; return this.rng(); }

  // ---------- level ----------
  loadLevel(level) {
    this.level = level;
    this.mazeIndex = (level - 1) % MAZES.length;
    this.maze = parseMaze(MAZES[this.mazeIndex]);
    this.items = new Uint8Array(this.maze.items);
    this.lettuceLeft = this.maze.lettuce;
    this.lettuceTotal = this.maze.lettuce;
    this.slime = new Float64Array(this.maze.w * this.maze.h).fill(-1e9);
    this.hunterSpeed = SNAIL_SPEED * hunterFactor(level);
    this.slimeTime = slimeTime(level);
    this.bonus = null;
    this.bonusesShown = 0;
    if (!this.hunters) this.hunters = makeHunters(this.maze);
    else { const fresh = makeHunters(this.maze); this.hunters.forEach((hu, i) => Object.assign(hu, fresh[i])); }
    this.resetPositions();
  }

  resetPositions() {
    const s = this.snail;
    s.tx = this.maze.start.x; s.ty = this.maze.start.y;
    s.dir = null; s.want = null; s.o = 0; s.facing = -1; s.stuck = false;
    this.slime.fill(-1e9);
    this.laySlime(s.tx, s.ty);
    this.modeIndex = 0; this.modeT = 0;
    this.caffeine = 0; this.eatChain = 0; this.freeze = 0;
    resetHunters(this);
    this.state = 'ready';
    this.stateT = READY_TIME;
  }

  // ---------- slime ----------
  idx(x, y) { return y * this.maze.w + x; }
  laySlime(x, y) { this.slime[this.idx(x, y)] = this.time; }
  slimeAge(x, y) { return this.time - this.slime[this.idx(x, y)]; }
  wet(x, y) { return this.slimeAge(x, y) < this.slimeTime; }
  snailCanEnter(x, y) {
    if (y < 0 || y >= this.maze.h) return false;
    if (x < 0 || x >= this.maze.w) return this.maze.tunnels.has(y);
    if (this.maze.tiles[this.idx(x, y)] !== PATH) return false;
    return this.caffeine > 0 || !this.wet(x, y);
  }
  canGo(dir) {
    const d = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[dir];
    let x = this.snail.tx + d[0];
    const y = this.snail.ty + d[1];
    if (this.maze.tunnels.has(y)) x = (x + this.maze.w) % this.maze.w;
    return this.snailCanEnter(x, y);
  }

  // ---------- input ----------
  want(dir) {
    if (!dir) return;
    this.snail.want = dir;
  }

  // ---------- time ----------
  advance(dt) {
    this.acc += dt;
    let n = 0;
    while (this.acc >= H && n < MAX_SUBSTEPS) { this.tick(H); this.acc -= H; n++; }
    if (this.acc >= H) this.acc = 0;
  }

  tick(h) {
    this.time += h;
    switch (this.state) {
      case 'ready':
        this.stateT -= h;
        if (this.stateT <= 0) this.state = 'play';
        return;
      case 'dying':
        this.stateT -= h;
        if (this.stateT <= 0) {
          this.lives--;
          if (this.lives <= 0) { this.state = 'over'; this.events.push({ type: 'over' }); }
          else this.resetPositions();
        }
        return;
      case 'clear':
        this.stateT -= h;
        if (this.stateT <= 0) { this.loadLevel(this.level + 1); this.events.push({ type: 'level', level: this.level }); }
        return;
      case 'over':
        return;
      default: break;
    }
    if (this.freeze > 0) { this.freeze -= h; return; }

    if (this.caffeine > 0) {
      this.caffeine -= h;
      if (this.caffeine <= 0) { this.caffeine = 0; calmAll(this); this.events.push({ type: 'calm' }); }
    } else {
      this.modeT += h;
      if (this.modeT >= SCATTER_CHASE[this.modeIndex]) { this.modeIndex++; this.modeT = 0; applyGlobalMode(this); }
    }
    if (this.bonus) { this.bonus.t -= h; if (this.bonus.t <= 0) { this.bonus = null; this.events.push({ type: 'bonusGone' }); } }

    this.stepSnail(h);
    for (const hu of this.hunters) updateHunter(this, hu, h);
    this.collide();
    if (this.state === 'play' && this.lettuceLeft === 0) {
      this.state = 'clear'; this.stateT = CLEAR_TIME;
      this.events.push({ type: 'clear', level: this.level });
    }
  }

  // ---------- the snail ----------
  stepSnail(h) {
    const s = this.snail;
    const m = this.maze;
    const speed = SNAIL_SPEED * (this.caffeine > 0 ? CAFFEINE_SPEED : 1);
    // a reversal mid-corridor is only possible over your own wet slime when caffeinated
    if (s.want && s.dir && s.want === OPP[s.dir] && s.o > 0 && this.snailCanEnter(s.tx, s.ty)) { reverse(m, s); s.want = null; }
    const moved = step(m, s, speed * h, (e) => this.snailDecide(e), (e) => this.snailArrive(e));
    s.stuck = moved === 0 && s.o === 0 && (s.dir != null || s.want != null);
    if (s.dir === 'left') s.facing = -1; else if (s.dir === 'right') s.facing = 1;
  }

  snailDecide(s) {
    if (s.want && this.canGo(s.want)) { const d = s.want; s.want = null; return d; }
    if (s.dir && this.canGo(s.dir)) return s.dir;
    return null;
  }

  snailArrive(s) {
    this.laySlime(s.tx, s.ty);
    const i = this.idx(s.tx, s.ty);
    const item = this.items[i];
    if (item === LETTUCE) {
      this.items[i] = NONE;
      this.lettuceLeft--;
      this.addScore(POINTS.lettuce);
      this.events.push({ type: 'eat', x: s.tx, y: s.ty });
      const eaten = 1 - this.lettuceLeft / this.lettuceTotal;
      if (this.bonusesShown < BONUS_AT.length && eaten >= BONUS_AT[this.bonusesShown] && !this.bonus) {
        this.bonusesShown++;
        this.bonus = { x: this.maze.bonus.x, y: this.maze.bonus.y, t: BONUS_TIME };
        this.events.push({ type: 'bonusShow' });
      }
    } else if (item === BEAN) {
      this.items[i] = NONE;
      this.addScore(POINTS.bean);
      this.caffeine = caffeineTime(this.level);
      this.eatChain = 0;
      frightenAll(this);
      this.events.push({ type: 'bean', x: s.tx, y: s.ty });
    }
    if (this.bonus && this.bonus.x === s.tx && this.bonus.y === s.ty) {
      const pts = bonusPoints(this.level);
      this.addScore(pts);
      this.events.push({ type: 'bonus', x: s.tx, y: s.ty, score: pts });
      this.bonus = null;
    }
  }

  addScore(n) {
    this.score += n;
    if (!this.extraLifeGiven && this.score >= EXTRA_LIFE_AT) { this.extraLifeGiven = true; this.lives++; this.events.push({ type: 'life' }); }
  }

  // ---------- contact ----------
  collide() {
    const sp = posOf(this.snail);
    for (const hu of this.hunters) {
      if (!isActive(hu)) continue;
      if (dist(this.maze, sp, posOf(hu)) >= CATCH_DIST) continue;
      if (hu.mode === 'frightened') {
        const pts = POINTS.hunter[Math.min(this.eatChain, POINTS.hunter.length - 1)];
        this.eatChain++;
        this.addScore(pts);
        hu.mode = 'home'; hu.path = null;
        this.freeze = EAT_FREEZE;
        this.events.push({ type: 'scare', id: hu.id, x: sp.x, y: sp.y, score: pts });
        return;
      }
      this.state = 'dying'; this.stateT = DYING_TIME;
      this.snail.want = null;
      this.events.push({ type: 'caught', id: hu.id });
      return;
    }
  }

  takeEvents() { const e = this.events; this.events = []; return e; }

  // ---------- save / restore ----------
  toJSON() {
    return {
      v: 1, seed: this.seed, rngDraws: this.rngDraws, level: this.level, score: this.score, lives: this.lives,
      extraLifeGiven: this.extraLifeGiven, time: this.time, state: this.state, stateT: this.stateT,
      items: Array.from(this.items), lettuceLeft: this.lettuceLeft, slime: Array.from(this.slime),
      snail: { ...this.snail }, hunters: this.hunters.map((hu) => ({ ...hu, path: hu.path ? hu.path.map((p) => ({ ...p })) : null })),
      modeIndex: this.modeIndex, modeT: this.modeT, caffeine: this.caffeine, eatChain: this.eatChain, freeze: this.freeze,
      bonus: this.bonus ? { ...this.bonus } : null, bonusesShown: this.bonusesShown,
    };
  }

  static fromJSON(j) {
    const g = new Game({ seed: j.seed, level: j.level });
    for (let i = 0; i < j.rngDraws; i++) g.rng();
    g.rngDraws = j.rngDraws;
    g.score = j.score; g.lives = j.lives; g.extraLifeGiven = j.extraLifeGiven;
    g.time = j.time; g.state = j.state; g.stateT = j.stateT;
    g.items = Uint8Array.from(j.items); g.lettuceLeft = j.lettuceLeft;
    g.slime = Float64Array.from(j.slime);
    Object.assign(g.snail, j.snail);
    j.hunters.forEach((hu, i) => { Object.assign(g.hunters[i], hu); g.hunters[i].corner = g.maze.corners[i]; g.hunters[i].slot = i === 0 ? g.maze.exit : g.hunters[i].slot; });
    g.modeIndex = j.modeIndex; g.modeT = j.modeT; g.caffeine = j.caffeine; g.eatChain = j.eatChain; g.freeze = j.freeze;
    g.bonus = j.bonus; g.bonusesShown = j.bonusesShown;
    g.events = [];
    return g;
  }
}
