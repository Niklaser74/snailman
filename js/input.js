// Four directions from three sources — a swipe anywhere on the maze, the
// on-screen cross, and the keyboard — all through one `dir(d)` callback.
// Swipes chain: keep the finger down and swipe again, and the new direction
// counts from where the finger is now, so a corner can be taken in one motion.
const SWIPE = 18; // px before a drag counts as a swipe

export function bindInput({ stage, pad }, handlers) {
  // ---- swipe ----
  let origin = null;
  stage.addEventListener('pointerdown', (e) => {
    if (e.button != null && e.button !== 0) return;
    origin = { x: e.clientX, y: e.clientY, id: e.pointerId };
    try { stage.setPointerCapture(e.pointerId); } catch { /* fine */ }
  });
  stage.addEventListener('pointermove', (e) => {
    if (!origin || e.pointerId !== origin.id) return;
    const dx = e.clientX - origin.x, dy = e.clientY - origin.y;
    if (Math.abs(dx) < SWIPE && Math.abs(dy) < SWIPE) return;
    const d = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
    origin = { x: e.clientX, y: e.clientY, id: e.pointerId };
    handlers.dir(d);
  });
  const end = (e) => { if (origin && e.pointerId === origin.id) origin = null; };
  stage.addEventListener('pointerup', end);
  stage.addEventListener('pointercancel', end);
  stage.addEventListener('contextmenu', (e) => e.preventDefault());

  // ---- the cross ----
  for (const [d, el] of Object.entries(pad)) {
    el.addEventListener('pointerdown', (e) => {
      if (e.button != null && e.button !== 0) return;
      e.preventDefault();
      el.classList.add('pressed');
      handlers.dir(d);
    });
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) el.addEventListener(ev, () => el.classList.remove('pressed'));
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  // ---- keyboard ----
  const KEYS = {
    ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down',
    ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right',
  };
  addEventListener('keydown', (e) => {
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    const d = KEYS[e.key];
    if (!d) return;
    e.preventDefault();
    if (e.repeat) return;
    pad[d].classList.add('pressed');
    handlers.dir(d);
  });
  addEventListener('keyup', (e) => { const d = KEYS[e.key]; if (d) pad[d].classList.remove('pressed'); });
}
