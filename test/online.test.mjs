// The online half without a network: the client and the database agree on
// what exists, the push function ranks like the game, and the pure helpers.
//   node test/online.test.mjs
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { standings, nextRound } from '../js/standings.js';
import { RULES_VERSION } from '../js/engine.js';
import { dailySeed, dayKey, cleanName, errorKey, isContestId, inviteLink } from '../js/online.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sqlDir = join(root, 'supabase', 'migrations');
const sql = readdirSync(sqlDir).sort().map((f) => readFileSync(join(sqlDir, f), 'utf8')).join('\n');
const src = (f) => readFileSync(join(root, f), 'utf8');

let failed = 0;
function test(name, fn) {
  try { fn(); console.log(`ok   ${name}`); } catch (e) { failed++; console.log(`FAIL ${name}\n     ${e.message}`); }
}

// ---------- client ↔ database ----------
// In September a migration dropped an RPC signature deployed clients still
// called, and best-effort error handling swallowed it (Snail Story's
// test/cloud.test.mjs has the story). Shared functions (snails_*) live in the
// snailmageddon repo and are only checked by name against a known list.
const SHARED = new Set(['snails_profile', 'snails_save_push']);
const clientSrc = src('js/online.js') + src('js/push.js');
const calls = [...clientSrc.matchAll(/online\.rpc\(\s*'([a-z0-9_]+)'/g)].map((m) => m[1]);

test('every RPC the client calls exists in a migration (or is a shared series function)', () => {
  assert.ok(calls.length >= 12, `found only ${calls.length} RPC calls — did the matching break?`);
  for (const name of new Set(calls)) {
    if (SHARED.has(name)) continue;
    assert.match(sql, new RegExp(`function\\s+public\\.${name}\\s*\\(`), `the client calls ${name}(), and no migration creates it`);
  }
});

test('every argument the client sends is one the function takes', () => {
  // Checked by name, because PostgREST picks the overload by argument names.
  // runArgs() spreads into several calls, so its names count for each of them.
  const spread = [...(/const runArgs = \(run\) => \(\{([^}]*)\}\)/.exec(src('js/online.js')) || [])[1].matchAll(/\b(p_[a-z_]+)\s*:/g)].map((a) => a[1]);
  assert.ok(spread.length === 5, 'runArgs not found');
  for (const m of clientSrc.matchAll(/online\.rpc\(\s*'([a-z0-9_]+)'\s*,\s*\{([^}]*)\}/g)) {
    const [, name, body] = m;
    if (SHARED.has(name)) continue;
    const args = [...body.matchAll(/\b(p_[a-z_]+)\s*:/g)].map((a) => a[1]);
    if (body.includes('...runArgs')) args.push(...spread);
    const all = [...sql.matchAll(new RegExp(`create or replace function\\s+public\\.${name}\\s*\\(([^)]*)\\)`, 'gs'))];
    const decl = all[all.length - 1];
    assert.ok(decl, `no declaration found for ${name}`);
    const declared = [...decl[1].matchAll(/\b(p_[a-z_]+)\b/g)].map((a) => a[1]);
    for (const arg of args) assert.ok(declared.includes(arg), `${name}() is called with ${arg}, which it does not take`);
    for (const arg of declared) assert.ok(args.includes(arg), `${name}() takes ${arg}, which the client never sends`);
  }
});

test('every RPC the client may call is granted to signed-in players', () => {
  for (const name of new Set(calls)) {
    if (SHARED.has(name)) continue;
    assert.match(sql, new RegExp(`'${name}\\(`), `${name} is missing from the grants list`);
  }
});

test('the push function ranks exactly like the game', () => {
  assert.equal(src('supabase/functions/snailman-notify/standings.js'), src('js/standings.js'),
    'copy js/standings.js to supabase/functions/snailman-notify/ and redeploy the function');
});

test('the rules versions the server accepts include the one the game plays', () => {
  const last = [...sql.matchAll(/snailman_rules_ok\(p_rules_version int\)[\s\S]*?array\[([0-9, ]+)\]/g)].pop();
  assert.ok(last, 'snailman_rules_ok not found');
  assert.ok(last[1].split(',').map(Number).includes(RULES_VERSION), `server accepts [${last[1]}], game plays ${RULES_VERSION}`);
});

// ---------- standings ----------
const P = (id, name) => ({ user_id: id, name });
const R = (id, round, score) => ({ user_id: id, round, score });

test('each round is ranked on its own; ties share', () => {
  const c = { rounds: 2, status: 'open', players: [P('a', 'Anna'), P('b', 'Bo'), P('c', 'Cia')],
    runs: [R('a', 1, 9000), R('b', 1, 100), R('c', 1, 50), R('a', 2, 10), R('b', 2, 500), R('c', 2, 500)] };
  const s = standings(c);
  const by = Object.fromEntries(s.map((r) => [r.name, r]));
  assert.equal(by.Anna.points, 2 + 0);
  assert.equal(by.Bo.points, 1 + 1.5);
  assert.equal(by.Cia.points, 0 + 1.5);
  assert.deepEqual(s.map((r) => r.name), ['Bo', 'Anna', 'Cia'], 'a huge lucky run does not buy it all');
  assert.deepEqual(s.map((r) => r.place), [1, 2, 3]);
});

test('running: rounds only count those who played; finished: missing is 0', () => {
  const base = { rounds: 1, players: [P('a', 'Anna'), P('b', 'Bo')], runs: [R('a', 1, 300)] };
  const running = standings({ ...base, status: 'open' });
  assert.equal(running.find((r) => r.name === 'Anna').points, 0, 'nobody to beat yet');
  assert.deepEqual(running.find((r) => r.name === 'Bo').rounds, [null]);
  const done = standings({ ...base, status: 'finished' });
  assert.equal(done[0].name, 'Anna');
  assert.equal(done[0].points, 1);
  assert.deepEqual(done[1].rounds, [null], 'shown as not played, counted as 0');
});

test('equal points and total share a place', () => {
  const s = standings({ rounds: 1, status: 'finished', players: [P('a', 'A'), P('b', 'B')], runs: [R('a', 1, 70), R('b', 1, 70)] });
  assert.deepEqual(s.map((r) => r.place), [1, 1]);
});

test('next round: in order, none when done, finished or not a member', () => {
  const c = { rounds: 3, status: 'open', players: [P('a', 'A')], runs: [R('a', 1, 10)] };
  assert.equal(nextRound(c, 'a'), 2);
  assert.equal(nextRound(c, 'x'), null);
  assert.equal(nextRound({ ...c, status: 'finished' }, 'a'), null);
  assert.equal(nextRound({ ...c, runs: [R('a', 1, 1), R('a', 2, 1), R('a', 3, 1)] }, 'a'), null);
});

// ---------- helpers ----------
test('the day is Stockholm\'s and the seed follows the day', () => {
  assert.equal(dayKey(new Date('2026-10-02T22:30:00Z')), '2026-10-03', 'half past midnight in Sweden');
  assert.equal(dayKey(new Date('2026-12-31T22:59:00Z')), '2026-12-31', 'winter time: still the 31st');
  const s = dailySeed('2026-10-02');
  assert.equal(s, dailySeed('2026-10-02'));
  assert.notEqual(s, dailySeed('2026-10-03'));
  assert.ok(Number.isInteger(s) && s > 0 && s < 2147483647);
});

test('names, ids, links and errors', () => {
  assert.equal(cleanName('  Anna\u0007 Andersson och hennes snigel  '), 'Anna Andersson och henne');
  assert.ok(isContestId('3f2b6c1e-9a1d-4c3b-8f00-0123456789ab'));
  assert.ok(!isContestId('3f2b6c1e'));
  assert.equal(inviteLink('abc', { origin: 'https://snails.se', pathname: '/snailman/' }), 'https://snails.se/snailman/?contest=abc');
  assert.equal(errorKey(new Error('contest is full')), 'err.full');
  assert.equal(errorKey(new Error('Failed to fetch')), 'err.net');
  assert.equal(errorKey(new Error('anonymous sign-in is disabled')), 'err.disabled');
});

test('the online modules never reach for the DOM', () => {
  for (const f of ['js/online.js', 'js/standings.js']) {
    const code = src(f).replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map((l) => l.replace(/\/\/.*$/, '')).join('\n');
    for (const bad of ['document.', 'window.']) assert.ok(!code.includes(bad), `${f} uses ${bad}`);
  }
});

if (failed) { console.log(`${failed} failed`); process.exit(1); }
