// Whole games in Node: the slime rule, caffeine, catching, scaring, level
// clear, determinism and save/restore.
//   node test/engine.test.mjs
import assert from 'node:assert/strict';
import { Game, READY_TIME, SNAIL_SPEED, POINTS, START_LIVES, DYING_TIME, CLEAR_TIME } from '../js/engine.js';
import { LETTUCE, BEAN, NONE, PATH, tileAt } from '../js/maze.js';
import { posOf, DIR_ORDER } from '../js/mover.js';
import { Hasher } from '../js/game/rng.js';

let failed = 0;
function test(name, fn) {
  try { fn(); console.log(`ok   ${name}`); } catch (e) { failed++; console.log(`FAIL ${name}\n     ${e.stack.split('\n').slice(0, 3).join('\n     ')}`); }
}
function run(g, seconds, each) {
  const dt = 1 / 60;
  for (let t = 0; t < seconds; t += dt) { g.advance(dt); if (each) each(g); }
}
function fresh(seed = 7) { const g = new Game({ seed }); run(g, READY_TIME + 0.01); assert.equal(g.state, 'play'); return g; }
function snapshot(g) {
  const h = new Hasher();
  h.num(g.score).int(g.lives).int(g.level).num(g.time);
  h.int(g.snail.tx).int(g.snail.ty).num(g.snail.o);
  for (const hu of g.hunters) h.int(hu.tx).int(hu.ty).num(hu.o).byte(hu.mode.length);
  h.bytes(g.items);
  return h.hex();
}
// drive the snail with a bot that at every centre picks a random legal direction
function bot(g, rng) {
  const s = g.snail;
  if (s.o !== 0 && s.dir) return;
  const legal = DIR_ORDER.filter((d) => g.canGo(d));
  if (!legal.length) return;
  g.want(legal[Math.floor(rng() * legal.length)]);
}
function lcg(seed) { let a = seed >>> 0; return () => { a = (Math.imul(a, 1664525) + 1013904223) >>> 0; return a / 4294967296; }; }

test('waits for input, then crawls and eats lettuce', () => {
  const g = fresh();
  const { tx, ty } = g.snail;
  run(g, 1);
  assert.deepEqual([g.snail.tx, g.snail.ty], [tx, ty], 'no input, no movement');
  g.want('left');
  run(g, 1.2);
  assert.ok(g.snail.tx < tx, 'moved left');
  assert.ok(g.score >= POINTS.lettuce * 3, `ate on the way: ${g.score}`);
  assert.ok(g.wet(tx, ty), 'the start tile is slimed');
});

test('slime: no turning back until it dries', () => {
  const g = fresh();
  g.want('left');
  run(g, 1.5);
  const at = { ...g.snail };
  g.want('right');
  run(g, 1.0);
  assert.equal(g.snail.dir, 'left', 'still heading left: the tile behind is wet');
  assert.ok(g.snail.tx <= at.tx, 'did not go back');
  // the rest of the row is wet behind us; a legal turn is the only way on
  assert.ok(!g.canGo('right') || g.snail.o > 0);
});

test('slime dries after slimeTime and the way back opens', () => {
  const g = fresh();
  const { tx, ty } = g.snail;
  g.want('left');
  run(g, 0.6);
  assert.ok(g.wet(tx, ty));
  run(g, g.slimeTime + 0.5);
  assert.ok(!g.wet(tx, ty), 'start tile dried');
});

test('boxed in, the snail stands still and is marked stuck', () => {
  const g = fresh();
  // fake it: slime every neighbour of the start tile right now
  const s = g.snail;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) g.laySlime(s.tx + dx, s.ty + dy);
  g.want('left');
  run(g, 0.5);
  assert.deepEqual([s.tx, s.ty, s.o], [g.maze.start.x, g.maze.start.y, 0]);
  assert.ok(s.stuck, 'stuck flag for the view');
});

test('a coffee bean frightens the hunters and lets the snail cross its own slime', () => {
  const g = fresh();
  run(g, 6); // hedgehog is out by now
  const outBefore = g.hunters.filter((h) => h.mode === 'scatter' || h.mode === 'chase').length;
  assert.ok(outBefore >= 2, `hunters out: ${outBefore}`);
  // put a bean right next to the snail and eat it
  g.want('left');
  run(g, 0.05);
  g.items[g.idx(g.snail.tx - 1, g.snail.ty)] = BEAN;
  run(g, 0.5);
  assert.ok(g.caffeine > 0, 'caffeinated');
  assert.ok(g.hunters.some((h) => h.mode === 'frightened'), 'somebody is frightened');
  // reversal over wet slime is allowed now
  g.want('right');
  run(g, 0.3);
  assert.equal(g.snail.dir, 'right', 'turned back over own slime');
  run(g, g.caffeine + 0.2);
  assert.equal(g.caffeine, 0);
  assert.ok(!g.hunters.some((h) => h.mode === 'frightened'), 'calm again');
});

test('touching a frightened hunter scores and sends it home; it comes back out', () => {
  const g = fresh();
  g.caffeine = 5;
  const hu = g.hunters[0];
  hu.mode = 'frightened';
  hu.tx = g.snail.tx - 1; hu.ty = g.snail.ty; hu.o = 0; hu.dir = 'right';
  g.want('left');
  run(g, 0.4);
  assert.equal(hu.mode, 'home');
  assert.ok(g.score === POINTS.hunter[0] || g.score === POINTS.hunter[0] + POINTS.lettuce, `score ${g.score}`);
  assert.equal(g.lives, START_LIVES);
  run(g, 25);
  assert.ok(hu.mode === 'scatter' || hu.mode === 'chase' || hu.mode === 'frightened', `back in the maze: ${hu.mode}`);
});

test('caught: a life is lost, positions reset, slime cleared, then ready', () => {
  const g = fresh();
  const hu = g.hunters[0];
  hu.mode = 'chase';
  hu.tx = g.snail.tx - 1; hu.ty = g.snail.ty; hu.o = 0; hu.dir = 'right';
  g.want('left');
  run(g, 0.4);
  assert.equal(g.state, 'dying');
  run(g, DYING_TIME + 0.1);
  assert.equal(g.lives, START_LIVES - 1);
  assert.equal(g.state, 'ready');
  assert.deepEqual([g.snail.tx, g.snail.ty], [g.maze.start.x, g.maze.start.y]);
  assert.equal(g.hunters[1].mode, 'nest');
});

test('third catch is game over', () => {
  const g = fresh();
  for (let i = 0; i < 3; i++) {
    run(g, READY_TIME + 0.05);
    const hu = g.hunters[0];
    hu.mode = 'chase'; hu.tx = g.snail.tx - 1; hu.ty = g.snail.ty; hu.o = 0; hu.dir = 'right';
    g.want('left');
    run(g, DYING_TIME + 0.5);
  }
  assert.equal(g.state, 'over');
  assert.equal(g.lives, 0);
  assert.ok(g.takeEvents().some((e) => e.type === 'over'));
});

test('last leaf clears the level; the next one uses the other maze', () => {
  const g = fresh();
  for (let i = 0; i < g.items.length; i++) if (g.items[i] === LETTUCE) { g.items[i] = NONE; g.lettuceLeft--; }
  g.items[g.idx(g.snail.tx - 1, g.snail.ty)] = LETTUCE; g.lettuceLeft = 1;
  g.want('left');
  run(g, 0.5);
  assert.equal(g.state, 'clear');
  run(g, CLEAR_TIME + 0.1);
  assert.equal(g.level, 2);
  assert.equal(g.mazeIndex, 1);
  assert.equal(g.state, 'ready');
  assert.ok(g.lettuceLeft > 100);
  assert.ok(g.takeEvents().some((e) => e.type === 'level'));
});

test('the strawberry shows at 30 % eaten and is worth points', () => {
  const g = fresh();
  const target = Math.ceil(g.lettuceTotal * 0.3);
  let n = 0;
  for (let i = 0; i < g.items.length && n < target - 1; i++) if (g.items[i] === LETTUCE) { g.items[i] = NONE; g.lettuceLeft--; n++; }
  g.want('left');
  run(g, 0.5);
  assert.ok(g.bonus, 'strawberry out');
  assert.ok(g.takeEvents().some((e) => e.type === 'bonusShow'));
  g.bonus.x = g.snail.tx - 1; g.bonus.y = g.snail.ty;
  const before = g.score;
  run(g, 0.5);
  assert.ok(g.score - before >= 100, 'bonus scored');
  assert.equal(g.bonus, null);
});

test('all four hunters leave the heap and roam', () => {
  const g = fresh();
  g.want('left');
  run(g, 16, (gg) => { if (gg.state === 'dying') { gg.state = 'play'; } });
  const out = g.hunters.filter((h) => h.mode === 'scatter' || h.mode === 'chase');
  assert.equal(out.length, 4, g.hunters.map((h) => h.id + ':' + h.mode).join(' '));
  for (const h of g.hunters) assert.equal(tileAt(g.maze, h.tx, h.ty), PATH, `${h.id} is out of the heap`);
});

test('hunters slip on wet slime', () => {
  const g = fresh();
  const hu = g.hunters[0];
  hu.mode = 'chase'; hu.tx = 1; hu.ty = 3; hu.o = 0; hu.dir = 'right';
  const dry = new Game({ seed: 7 }); run(dry, READY_TIME + 0.01);
  const hd = dry.hunters[0]; hd.mode = 'chase'; hd.tx = 1; hd.ty = 3; hd.o = 0; hd.dir = 'right';
  for (let x = 1; x < 18; x++) g.laySlime(x, 3);
  g.snail.tx = 17; g.snail.ty = 3; dry.snail.tx = 17; dry.snail.ty = 3;
  run(g, 1); run(dry, 1);
  assert.ok(posOf(hu).x < posOf(hd).x - 1, `slipped: ${posOf(hu).x} vs ${posOf(hd).x}`);
});

test('deterministic: same seed and inputs, same game', () => {
  const play = (seed) => {
    const g = new Game({ seed });
    const r = lcg(99 + seed);
    run(g, 40, (gg) => bot(gg, r));
    return snapshot(g);
  };
  assert.equal(play(3), play(3));
  assert.notEqual(play(3), play(4));
});

test('save and restore continue identically', () => {
  const g = new Game({ seed: 11 });
  const r = lcg(5);
  run(g, 12, (gg) => bot(gg, r));
  const copy = Game.fromJSON(JSON.parse(JSON.stringify(g.toJSON())));
  assert.equal(snapshot(copy), snapshot(g));
  run(g, 3); run(copy, 3);
  assert.equal(snapshot(copy), snapshot(g), 'same after three more seconds');
});

test('a random bot survives long enough to be a game, and the game ends', () => {
  let ended = 0, scores = [];
  for (let seed = 1; seed <= 6; seed++) {
    const g = new Game({ seed });
    const r = lcg(seed * 31);
    run(g, 240, (gg) => bot(gg, r));
    if (g.state === 'over') ended++;
    scores.push(g.score);
  }
  assert.ok(ended >= 4, `games over within four minutes: ${ended}/6`);
  assert.ok(Math.max(...scores) >= 300, `scores: ${scores.join(' ')}`);
});

test('tempo sanity: a snail crosses a row in a few seconds, not a minute', () => {
  assert.ok(SNAIL_SPEED >= 3 && SNAIL_SPEED <= 5, 'tiles per second');
});

if (failed) { console.log(`${failed} failed`); process.exit(1); }
