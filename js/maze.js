// The hedge mazes. ASCII, one character per tile, 19 wide so a phone in
// portrait gets ~20 px tiles. Legend:
//   #  hedge (wall)          .  path with a lettuce leaf
//   o  path with a coffee bean (the power-up)
//      path, nothing on it    S  where the snail starts (path, no leaf)
//   B  where the strawberry shows up (path, no leaf)
//   -  the compost heap's opening: hunters only
//   N  inside the compost heap: hunters only
// A row that is open at both edges is a tunnel: leaving on one side comes
// back on the other.
//
// No dead ends anywhere — with the slime rule a dead end is a ten-second trap,
// and test/rules.test.mjs refuses a maze that has one.
export const WALL = 0;
export const PATH = 1;
export const DOOR = 2;
export const NEST = 3;

export const NONE = 0;
export const LETTUCE = 1;
export const BEAN = 2;

export const MAZES = [
  {
    id: 'hedge',
    rows: [
      '###################',
      '#........#........#',
      '#o##.###.#.###.##o#',
      '#.................#',
      '#.##.#.#####.#.##.#',
      '#....#...#...#....#',
      '####.###.#.###.####',
      '####.#.......#.####',
      '####.#.##-##.#.####',
      '    .  #NNN#  .    ',
      '####.#.#####.#.####',
      '####.#...B...#.####',
      '####.#.#####.#.####',
      '#........#........#',
      '#.##.###.#.###.##.#',
      '#o.#.....S.....#.o#',
      '##.#.#.#####.#.#.##',
      '#....#...#...#....#',
      '#.######.#.######.#',
      '#.................#',
      '###################',
    ],
  },
  {
    id: 'orchard',
    rows: [
      '###################',
      '#........#........#',
      '#.###.##.#.##.###.#',
      '#o..#....#....#..o#',
      '###.#.##.#.##.#.###',
      '#.....#.....#.....#',
      '#.###.#.###.#.###.#',
      '#...#.........#...#',
      '#.#.#.###-###.#.#.#',
      '   ...#NNNNN#...   ',
      '#.#.#.#######.#.#.#',
      '#...#....B....#...#',
      '#.###.#.###.#.###.#',
      '#.....#.....#.....#',
      '###.#.##.#.##.#.###',
      '#o..#....S....#..o#',
      '#.###.#.###.#.###.#',
      '#........#........#',
      '#.######.#.######.#',
      '#.................#',
      '###################',
    ],
  },
];

// Turns an ASCII definition into typed arrays plus the special positions.
// `items` is what the player eats and is the only part that changes during a
// level; the rest is read-only.
export function parseMaze(def) {
  const rows = def.rows;
  const h = rows.length;
  const w = rows[0].length;
  for (const r of rows) if (r.length !== w) throw new Error(`maze ${def.id}: ragged row "${r}"`);
  const tiles = new Uint8Array(w * h);
  const items = new Uint8Array(w * h);
  const nest = [];
  let start = null, door = null, bonus = null;
  let lettuce = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = rows[y][x];
      const i = y * w + x;
      switch (c) {
        case '#': tiles[i] = WALL; break;
        case '-': tiles[i] = DOOR; door = { x, y }; break;
        case 'N': tiles[i] = NEST; nest.push({ x, y }); break;
        case '.': tiles[i] = PATH; items[i] = LETTUCE; lettuce++; break;
        case 'o': tiles[i] = PATH; items[i] = BEAN; break;
        case 'S': tiles[i] = PATH; start = { x, y }; break;
        case 'B': tiles[i] = PATH; bonus = { x, y }; break;
        case ' ': tiles[i] = PATH; break;
        default: throw new Error(`maze ${def.id}: unknown tile "${c}" at ${x},${y}`);
      }
    }
  }
  if (!start || !door || !nest.length || !bonus) throw new Error(`maze ${def.id}: needs S, -, N and B`);
  const tunnels = new Set();
  for (let y = 0; y < h; y++) if (tiles[y * w] === PATH && tiles[y * w + w - 1] === PATH) tunnels.add(y);
  // the tile above the opening is where hunters come out and go back in
  const exit = { x: door.x, y: door.y - 1 };
  const home = nest[Math.floor(nest.length / 2)];
  // scatter corners, one per hunter: the four corners of the maze
  const corners = [{ x: w - 2, y: 0 }, { x: 1, y: 0 }, { x: w - 2, y: h - 1 }, { x: 1, y: h - 1 }];
  return { id: def.id, w, h, tiles, items, lettuce, nest, start, door, exit, home, bonus, tunnels, corners };
}

export function tileAt(m, x, y) {
  if (y < 0 || y >= m.h) return WALL;
  if (x < 0 || x >= m.w) return m.tunnels.has(y) ? PATH : WALL;
  return m.tiles[y * m.w + x];
}

// A tunnel tile is one where the hunters slow down: the outer few tiles of a
// tunnel row, where there is no hedge to hold on to.
export function inTunnel(m, x, y) {
  return m.tunnels.has(y) && (x < 3 || x >= m.w - 3);
}
