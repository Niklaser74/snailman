// Invariants that are cheap to lock: the balance constants keep their meaning,
// the hunters are the four garden figures, and every UI string exists in both
// languages.
//   node test/rules.test.mjs
import assert from 'node:assert/strict';
import { hunterFactor, slimeTime, caffeineTime, SNAIL_SPEED, CAFFEINE_SPEED, POINTS, START_LIVES, EXTRA_LIFE_AT } from '../js/engine.js';
import { HUNTERS, SLIP, TUNNEL_SLOW, FRIGHT_SLOW, HOME_SPEED, SCATTER_CHASE } from '../js/hunters.js';
import { keysOf } from '../js/i18n.js';

let failed = 0;
function test(name, fn) {
  try { fn(); console.log(`ok   ${name}`); } catch (e) { failed++; console.log(`FAIL ${name}\n     ${e.message}`); }
}

test('hunters never outrun the snail, but get closer to it with every level', () => {
  let prev = 0;
  for (let level = 1; level <= 30; level++) {
    const f = hunterFactor(level);
    assert.ok(f < 1, `level ${level}: ${f}`);
    assert.ok(f >= prev, 'never slower than the level before');
    prev = f;
  }
  assert.ok(hunterFactor(1) >= 0.7, 'level one is not a walk');
  assert.ok(SLIP < 1 && TUNNEL_SLOW < 1 && FRIGHT_SLOW < 1 && HOME_SPEED > 1);
  assert.ok(CAFFEINE_SPEED > 1);
});

test('slime lasts longer and caffeine shorter as levels go up, both bounded', () => {
  for (let level = 1; level < 30; level++) {
    assert.ok(slimeTime(level + 1) >= slimeTime(level));
    assert.ok(caffeineTime(level + 1) <= caffeineTime(level));
  }
  assert.ok(slimeTime(99) <= 20);
  assert.ok(caffeineTime(99) >= 2);
  assert.ok(slimeTime(1) > 19 / SNAIL_SPEED, 'a full row stays wet longer than it takes to crawl it');
});

test('the four hunters are the garden figures, released one after another', () => {
  assert.deepEqual(HUNTERS.map((h) => h.id), ['blackbird', 'hedgehog', 'gardener', 'duck']);
  for (let i = 1; i < HUNTERS.length; i++) assert.ok(HUNTERS[i].release > HUNTERS[i - 1].release);
  assert.deepEqual(new Set(HUNTERS.map((h) => h.corner)).size, 4, 'own corner each');
  assert.equal(SCATTER_CHASE.at(-1), Infinity, 'chase for good at the end');
});

test('scoring doubles per scared hunter, like the arcade', () => {
  assert.deepEqual(POINTS.hunter, [200, 400, 800, 1600]);
  assert.ok(POINTS.bean > POINTS.lettuce);
  assert.equal(START_LIVES, 3);
  assert.equal(EXTRA_LIFE_AT, 10000);
});

test('i18n: sv and en have the same keys, and every hunter has an epitaph', () => {
  const sv = keysOf('sv').sort();
  const en = keysOf('en').sort();
  assert.deepEqual(en, sv);
  for (const h of HUNTERS) assert.ok(sv.includes('over.by.' + h.id), h.id);
});

if (failed) { console.log(`${failed} failed`); process.exit(1); }
