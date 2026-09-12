// Every maze must be playable with the slime rule: no dead ends (a dead end is
// a ten-second trap), everything reachable from the start, left-right
// symmetric, one compost heap with an opening that leads up into the maze.
//   node test/maze.test.mjs
import assert from 'node:assert/strict';
import { MAZES, parseMaze, tileAt, PATH, WALL, DOOR, NEST } from '../js/maze.js';
import { DIR_ORDER, nextTile } from '../js/mover.js';

let failed = 0;
function test(name, fn) {
  try { fn(); console.log(`ok   ${name}`); } catch (e) { failed++; console.log(`FAIL ${name}\n     ${e.message}`); }
}

for (const def of MAZES) {
  const m = parseMaze(def);
  test(`${def.id}: 19 wide, odd height, hedge all around`, () => {
    assert.equal(m.w, 19);
    assert.equal(m.h % 2, 1);
    for (let x = 0; x < m.w; x++) { assert.equal(m.tiles[x], WALL); assert.equal(m.tiles[(m.h - 1) * m.w + x], WALL); }
  });
  test(`${def.id}: symmetric left to right`, () => {
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
      const a = m.tiles[y * m.w + x], b = m.tiles[y * m.w + (m.w - 1 - x)];
      assert.equal(a, b, `tile ${x},${y} vs mirror`);
    }
  });
  test(`${def.id}: no dead ends`, () => {
    const bad = [];
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
      if (m.tiles[y * m.w + x] !== PATH) continue;
      let open = 0;
      for (const d of DIR_ORDER) { const n = nextTile(m, x, y, d); if (tileAt(m, n.x, n.y) === PATH) open++; }
      if (open < 2) bad.push(`${x},${y}`);
    }
    assert.deepEqual(bad, [], 'dead ends at');
  });
  test(`${def.id}: every path tile reachable from the start`, () => {
    const seen = new Set([m.start.y * m.w + m.start.x]);
    const q = [m.start];
    while (q.length) {
      const p = q.pop();
      for (const d of DIR_ORDER) {
        const n = nextTile(m, p.x, p.y, d);
        if (tileAt(m, n.x, n.y) !== PATH) continue;
        const i = n.y * m.w + n.x;
        if (!seen.has(i)) { seen.add(i); q.push(n); }
      }
    }
    let paths = 0;
    for (const t of m.tiles) if (t === PATH) paths++;
    assert.equal(seen.size, paths);
  });
  test(`${def.id}: compost heap closed except the opening, which leads up`, () => {
    assert.equal(tileAt(m, m.exit.x, m.exit.y), PATH, 'exit tile above the door is a path');
    assert.equal(tileAt(m, m.door.x, m.door.y + 1), NEST, 'nest directly under the door');
    for (const n of m.nest) {
      for (const d of DIR_ORDER) {
        const t = nextTile(m, n.x, n.y, d);
        const k = tileAt(m, t.x, t.y);
        assert.ok(k === WALL || k === NEST || k === DOOR, `nest ${n.x},${n.y} leaks ${d}`);
      }
    }
    assert.ok(m.nest.length >= 3, 'room for the hunters');
  });
  test(`${def.id}: four beans, a tunnel, and enough lettuce to matter`, () => {
    let beans = 0;
    for (const i of m.items) if (i === 2) beans++;
    assert.equal(beans, 4);
    assert.ok(m.tunnels.size >= 1, 'a tunnel row');
    assert.ok(m.lettuce >= 120, `lettuce: ${m.lettuce}`);
  });
}

if (failed) { console.log(`${failed} failed`); process.exit(1); }
