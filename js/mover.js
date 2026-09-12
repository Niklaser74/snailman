// Grid movement shared by the snail and the hunters. An entity sits on a tile
// (tx, ty) and is `o` tiles along `dir` towards the next one, 0 ≤ o < 1. It can
// only change course at a tile centre (o === 0), except for a reversal, which
// just swaps which tile it is leaving and which it is heading for. Positions
// are derived, never stored, so there is nothing to drift.
import { tileAt, WALL } from './maze.js';

export const DIRS = {
  up: { dx: 0, dy: -1 },
  left: { dx: -1, dy: 0 },
  down: { dx: 0, dy: 1 },
  right: { dx: 1, dy: 0 },
};
export const DIR_ORDER = ['up', 'left', 'down', 'right']; // tie-break order, like the arcade
export const OPP = { up: 'down', down: 'up', left: 'right', right: 'left' };

export function nextTile(m, tx, ty, dir) {
  const d = DIRS[dir];
  let x = tx + d.dx;
  const y = ty + d.dy;
  if (m.tunnels.has(y)) x = (x + m.w) % m.w;
  return { x, y };
}

export function isWall(m, x, y) { return tileAt(m, x, y) === WALL; }

// Where the entity is, in tile units (centre of tile (0,0) is (0.5, 0.5)).
export function posOf(e) {
  const d = e.dir ? DIRS[e.dir] : { dx: 0, dy: 0 };
  return { x: e.tx + 0.5 + d.dx * e.o, y: e.ty + 0.5 + d.dy * e.o };
}

// Distance between two positions on a maze that wraps horizontally.
export function dist(m, a, b) {
  let dx = Math.abs(a.x - b.x);
  dx = Math.min(dx, m.w - dx);
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function reverse(m, e) {
  if (!e.dir) return;
  if (e.o > 0) {
    const n = nextTile(m, e.tx, e.ty, e.dir);
    e.tx = n.x; e.ty = n.y;
    e.o = 1 - e.o;
  }
  e.dir = OPP[e.dir];
}

// Moves `e` by `distance` tiles. `decide(e)` runs at every tile centre and
// returns the direction to take (or null to stand still); `arrive(e)` runs
// when a new tile is reached. Returns the distance actually covered.
export function step(m, e, distance, decide, arrive) {
  let left = distance;
  let guard = 16;
  while (left > 1e-9 && guard-- > 0) {
    if (e.o === 0) {
      const d = decide(e);
      if (!d) return distance - left;
      e.dir = d;
    }
    const room = 1 - e.o;
    if (left < room) { e.o += left; return distance; }
    left -= room;
    const n = nextTile(m, e.tx, e.ty, e.dir);
    e.tx = n.x; e.ty = n.y; e.o = 0;
    arrive(e);
  }
  return distance - left;
}
