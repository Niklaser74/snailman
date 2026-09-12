// The four hunters: the garden's own predators, with the arcade's four
// temperaments. They hunt at snail pace, which is the joke, and they slip on
// wet slime, which is the strategy: a trail between you and them buys time.
//
//   blackbird  chases your tile                         (Blinky)
//   hedgehog   aims four tiles ahead of you             (Pinky)
//   gardener   flanks, using the blackbird's position   (Inky)
//   duck       an Indian Runner: brave far away, shy up close (Clyde)
//
// Modes: nest (waiting in the compost heap) → leaving → scatter/chase/
// frightened → home (sent back, only eyes) → nest again.
import { DIRS, DIR_ORDER, OPP, nextTile, posOf, dist, reverse, step } from './mover.js';
import { tileAt, WALL, DOOR, NEST, inTunnel } from './maze.js';

export const HUNTERS = [
  { id: 'blackbird', release: 0, corner: 0 },
  { id: 'hedgehog', release: 3, corner: 1 },
  { id: 'gardener', release: 7, corner: 2 },
  { id: 'duck', release: 12, corner: 3 },
];

// seconds of scatter, chase, scatter, chase, scatter, then chase for good
export const SCATTER_CHASE = [7, 20, 7, 20, 5, Infinity];
export const SLIP = 0.55;        // speed on wet slime
export const TUNNEL_SLOW = 0.5;  // speed in the tunnel
export const FRIGHT_SLOW = 0.6;  // speed while frightened
export const LEAVE_SLOW = 0.6;   // speed on the way out of the heap
export const HOME_SPEED = 2.0;   // speed of a sent-home hunter (eyes)
export const NEST_WAIT = 1.5;    // pause in the heap before coming out again
export const DUCK_SHY = 8;       // tiles: closer than this, the duck heads for its corner

export function makeHunters(m) {
  // nest slots: the tile under the door first, then outwards
  const slots = [...m.nest].sort((a, b) => Math.abs(a.x - m.door.x) - Math.abs(b.x - m.door.x) || a.x - b.x);
  return HUNTERS.map((def, i) => ({
    id: def.id, corner: m.corners[def.corner], release: def.release,
    slot: i === 0 ? m.exit : slots[Math.min(i - 1, slots.length - 1)],
    mode: 'nest', wait: 0, tx: 0, ty: 0, dir: null, o: 0, path: null,
  }));
}

export function resetHunters(g) {
  const m = g.maze;
  for (const hu of g.hunters) {
    hu.tx = hu.slot.x; hu.ty = hu.slot.y; hu.o = 0; hu.path = null;
    if (hu.id === 'blackbird') { hu.mode = globalMode(g); hu.dir = 'left'; }
    else { hu.mode = 'nest'; hu.wait = hu.release; hu.dir = null; }
  }
  void m;
}

export function globalMode(g) { return g.modeIndex % 2 === 0 ? 'scatter' : 'chase'; }
const active = (hu) => hu.mode === 'scatter' || hu.mode === 'chase' || hu.mode === 'frightened';
export const isActive = active;

// scatter ↔ chase flipped: everyone out in the maze turns around
export function applyGlobalMode(g) {
  const mode = globalMode(g);
  for (const hu of g.hunters) if (hu.mode === 'scatter' || hu.mode === 'chase') { hu.mode = mode; reverse(g.maze, hu); }
}

export function frightenAll(g) {
  for (const hu of g.hunters) if (hu.mode === 'scatter' || hu.mode === 'chase') { hu.mode = 'frightened'; reverse(g.maze, hu); }
}

export function calmAll(g) {
  const mode = globalMode(g);
  for (const hu of g.hunters) if (hu.mode === 'frightened') hu.mode = mode;
}

function targetOf(g, hu) {
  const s = g.snail;
  if (hu.mode === 'scatter') return hu.corner;
  const d = DIRS[s.dir || 'left'];
  switch (hu.id) {
    case 'blackbird': return { x: s.tx, y: s.ty };
    case 'hedgehog': return { x: s.tx + d.dx * 4, y: s.ty + d.dy * 4 };
    case 'gardener': {
      const b = g.hunters[0];
      const px = s.tx + d.dx * 2, py = s.ty + d.dy * 2;
      return { x: 2 * px - b.tx, y: 2 * py - b.ty };
    }
    default: // duck
      return dist(g.maze, { x: hu.tx, y: hu.ty }, { x: s.tx, y: s.ty }) > DUCK_SHY ? { x: s.tx, y: s.ty } : hu.corner;
  }
}

function enterable(g, hu, x, y) {
  const t = tileAt(g.maze, x, y);
  if (t === WALL) return false;
  if (hu.path) return true;                 // scripted through the heap
  if (t === NEST) return false;
  if (t === DOOR) return hu.mode === 'home';
  return true;
}

function decide(g, hu) {
  const m = g.maze;
  if (hu.path && hu.path.length) {
    const p = hu.path[0];
    if (p.x === hu.tx && p.y === hu.ty) { hu.path.shift(); return decide(g, hu); }
    if (p.x !== hu.tx) return p.x > hu.tx ? 'right' : 'left';
    return p.y > hu.ty ? 'down' : 'up';
  }
  if (hu.path) hu.path = null;
  let options = DIR_ORDER.filter((d) => {
    if (hu.dir && d === OPP[hu.dir]) return false;
    const n = nextTile(m, hu.tx, hu.ty, d);
    return enterable(g, hu, n.x, n.y);
  });
  if (!options.length && hu.dir) {
    const n = nextTile(m, hu.tx, hu.ty, OPP[hu.dir]);
    if (enterable(g, hu, n.x, n.y)) options = [OPP[hu.dir]];
  }
  if (!options.length) return null;
  if (hu.mode === 'frightened') return options[Math.floor(g.random() * options.length)];
  // straight-line distance like the arcade: hunters do not know about the tunnel
  const target = hu.mode === 'home' ? m.door : targetOf(g, hu);
  let best = null, bestD = Infinity;
  for (const d of options) {
    const n = nextTile(m, hu.tx, hu.ty, d);
    const dd = (n.x - target.x) ** 2 + (n.y - target.y) ** 2;
    if (dd < bestD) { bestD = dd; best = d; }
  }
  return best;
}

function arrive(g, hu) {
  const m = g.maze;
  if (hu.mode === 'leaving' && hu.tx === m.exit.x && hu.ty === m.exit.y) {
    hu.path = null;
    hu.mode = g.caffeine > 0 ? 'frightened' : globalMode(g);
    hu.dir = 'up'; // so the door behind counts as "reverse" and is never chosen
    return;
  }
  if (hu.mode === 'home' && hu.tx === m.door.x && hu.ty === m.door.y && !hu.path) {
    hu.path = [m.home];
    return;
  }
  if (hu.mode === 'home' && hu.tx === m.home.x && hu.ty === m.home.y) {
    hu.path = null;
    hu.mode = 'nest';
    hu.wait = NEST_WAIT;
    hu.tx = hu.slot.x; hu.ty = hu.slot.y; hu.o = 0; hu.dir = null;
    g.events.push({ type: 'home', id: hu.id });
  }
}

export function updateHunter(g, hu, h) {
  const m = g.maze;
  if (hu.mode === 'nest') {
    hu.wait -= h;
    if (hu.wait <= 0) {
      hu.mode = 'leaving';
      hu.path = [m.home, m.door, m.exit];
      hu.dir = null; hu.o = 0;
    }
    return;
  }
  let speed = g.hunterSpeed;
  if (hu.mode === 'leaving') speed *= LEAVE_SLOW;
  else if (hu.mode === 'home') speed *= HOME_SPEED;
  else {
    if (hu.mode === 'frightened') speed *= FRIGHT_SLOW;
    if (g.wet(hu.tx, hu.ty)) speed *= SLIP;
    if (inTunnel(m, hu.tx, hu.ty)) speed *= TUNNEL_SLOW;
  }
  step(m, hu, speed * h, (e) => decide(g, e), (e) => arrive(g, e));
}

export { posOf };
