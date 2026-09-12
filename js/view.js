// The maze on canvas, seen from above: hedges, soil paths, lettuce, slime, the
// snail from Snäckmageddon's renderer (rotated to crawl up and down) and the
// four hunters. The hedge picture is painted once per level and resize.
import { drawSnail } from './game/snails.js';
import { THEMES } from './game/themes.js';
import { mulberry32 } from './game/rng.js';
import { drawHunter, drawLettuce, drawBean, drawStrawberry } from './sprites.js';
import { WALL, PATH, DOOR, NEST, LETTUCE, BEAN, tileAt } from './maze.js';
import { posOf, DIRS } from './mover.js';
import { DYING_TIME, CLEAR_TIME, BONUS_TIME } from './engine.js';

export const SNAIL_COLOR = '#f0c419';     // the yellow one, like the arcade
export const SNAIL_STYLE = 'cartoon';
const SLIME = '190,255,150';              // the garden theme's slime, as rgb
const theme = THEMES.garden;

export class View {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.k = 20; this.ox = 0; this.oy = 0;
    this.maze = null;
    this.board = null;
    this.particles = [];
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.ro = new ResizeObserver(() => this.layout());
    this.ro.observe(canvas);
    this.layout();
  }

  setMaze(maze) { this.maze = maze; this.layout(); }

  layout() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(2, devicePixelRatio || 1);
    this.cw = Math.max(1, rect.width);
    this.ch = Math.max(1, rect.height);
    this.canvas.width = Math.round(this.cw * dpr);
    this.canvas.height = Math.round(this.ch * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!this.maze) return;
    const m = this.maze;
    this.k = Math.min(this.cw / m.w, this.ch / m.h);
    this.ox = (this.cw - m.w * this.k) / 2;
    this.oy = (this.ch - m.h * this.k) / 2;
    this.paintBoard();
  }

  sx(x) { return this.ox + x * this.k; }
  sy(y) { return this.oy + y * this.k; }

  // hedges and soil, once
  paintBoard() {
    const m = this.maze;
    const k = this.k;
    const dpr = Math.min(2, devicePixelRatio || 1);
    const c = document.createElement('canvas');
    c.width = Math.round(this.cw * dpr);
    c.height = Math.round(this.ch * dpr);
    const g = c.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const rng = mulberry32(m.w * 131 + m.h);
    // soil under everything
    g.fillStyle = theme.soil[0];
    g.fillRect(this.ox, this.oy, m.w * k, m.h * k);
    g.fillStyle = theme.speckle;
    for (let i = 0; i < m.w * m.h * 2; i++) { g.beginPath(); g.arc(this.ox + rng() * m.w * k, this.oy + rng() * m.h * k, rng() * 1.6 * (k / 20), 0, Math.PI * 2); g.fill(); }
    // hedges: green blocks that merge, lighter on top, darker below
    const at = (x, y) => tileAt(m, x, y);
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
      if (at(x, y) !== WALL) continue;
      const X = this.sx(x), Y = this.sy(y);
      g.fillStyle = '#4c9a3f';
      g.fillRect(X - 0.5, Y - 0.5, k + 1, k + 1);
    }
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
      if (at(x, y) !== WALL) continue;
      const X = this.sx(x), Y = this.sy(y);
      if (at(x, y - 1) !== WALL) { g.fillStyle = '#6cc25a'; g.fillRect(X, Y, k, k * 0.22); }
      if (at(x, y + 1) !== WALL) { g.fillStyle = '#2f7a2b'; g.fillRect(X, Y + k * 0.8, k, k * 0.2); }
      if (at(x - 1, y) !== WALL) { g.fillStyle = 'rgba(255,255,255,0.10)'; g.fillRect(X, Y, k * 0.16, k); }
      if (at(x + 1, y) !== WALL) { g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(X + k * 0.84, Y, k * 0.16, k); }
      // leaves
      for (let i = 0; i < 3; i++) {
        g.fillStyle = rng() < 0.5 ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.10)';
        g.beginPath(); g.ellipse(X + k * (0.15 + rng() * 0.7), Y + k * (0.25 + rng() * 0.55), k * 0.12, k * 0.08, rng() * 3, 0, Math.PI * 2); g.fill();
      }
    }
    // the compost heap
    for (const n of m.nest) {
      g.fillStyle = '#4a2c16';
      g.fillRect(this.sx(n.x), this.sy(n.y), k, k);
      g.strokeStyle = '#c9a377'; g.lineWidth = Math.max(1, k * 0.05);
      for (let i = 0; i < 3; i++) { const yy = this.sy(n.y) + k * (0.25 + rng() * 0.5); g.beginPath(); g.moveTo(this.sx(n.x) + k * rng() * 0.4, yy); g.lineTo(this.sx(n.x) + k * (0.5 + rng() * 0.5), yy + (rng() - 0.5) * k * 0.2); g.stroke(); }
    }
    // the opening: a slat of fence
    g.fillStyle = '#4a2c16';
    g.fillRect(this.sx(m.door.x), this.sy(m.door.y), k, k);
    g.fillStyle = '#e8c56a';
    g.fillRect(this.sx(m.door.x), this.sy(m.door.y) + k * 0.4, k, k * 0.2);
    // tunnel mouths
    for (const y of m.tunnels) {
      for (const [x0, dir] of [[0, 1], [m.w - 1, -1]]) {
        const grad = g.createLinearGradient(this.sx(x0 + (dir < 0 ? 1 : 0)), 0, this.sx(x0 + (dir < 0 ? 1 : 0)) + dir * k * 2, 0);
        grad.addColorStop(0, 'rgba(0,0,0,0.45)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = grad;
        g.fillRect(this.sx(Math.min(x0, x0 + dir * 2 + (dir < 0 ? 1 : 0))), this.sy(y), k * 2, k);
      }
    }
    this.board = c;
  }

  draw(g, time) {
    const ctx = this.ctx;
    const k = this.k;
    const m = g.maze;
    if (this.maze !== m) this.setMaze(m);
    ctx.clearRect(0, 0, this.cw, this.ch);
    if (this.board) ctx.drawImage(this.board, 0, 0, this.cw, this.ch);

    // slime: wet tiles, fading as they dry; neighbours joined so it reads as a trail
    const st = g.slimeTime;
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
      const age = g.slimeAge(x, y);
      if (age >= st) continue;
      const a = 0.62 * Math.pow(1 - age / st, 0.6);
      ctx.fillStyle = `rgba(${SLIME},${a.toFixed(3)})`;
      ctx.strokeStyle = ctx.fillStyle;
      ctx.lineWidth = k * 0.46;
      ctx.lineCap = 'round';
      const cx = this.sx(x + 0.5), cy = this.sy(y + 0.5);
      ctx.beginPath(); ctx.arc(cx, cy, k * 0.23, 0, Math.PI * 2); ctx.fill();
      for (const [dx, dy] of [[1, 0], [0, 1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx >= m.w || ny >= m.h) continue;
        if (g.slimeAge(nx, ny) < st) { ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(this.sx(nx + 0.5), this.sy(ny + 0.5)); ctx.stroke(); }
      }
      // glint
      ctx.fillStyle = `rgba(255,255,255,${(a * 0.5).toFixed(3)})`;
      ctx.beginPath(); ctx.arc(cx - k * 0.07, cy - k * 0.07, k * 0.06, 0, Math.PI * 2); ctx.fill();
    }

    // lettuce and beans
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
      const it = g.items[y * m.w + x];
      if (!it) continue;
      ctx.save();
      ctx.translate(this.sx(x + 0.5), this.sy(y + 0.5));
      if (it === LETTUCE) drawLettuce(ctx, k, time + x * 0.7 + y * 1.3);
      else if (it === BEAN) drawBean(ctx, k, time + x);
      ctx.restore();
    }
    if (g.bonus) {
      ctx.save();
      ctx.translate(this.sx(g.bonus.x + 0.5), this.sy(g.bonus.y + 0.5));
      if (g.bonus.t < 3 && !this.reduced) ctx.globalAlpha = 0.5 + 0.5 * Math.abs(Math.sin(time * 8));
      drawStrawberry(ctx, k, time);
      ctx.restore();
      // its clock
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = Math.max(1, k * 0.06);
      ctx.beginPath(); ctx.arc(this.sx(g.bonus.x + 0.5), this.sy(g.bonus.y + 0.5), k * 0.44, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (g.bonus.t / BONUS_TIME)); ctx.stroke();
    }

    // hunters (eyes last so they float above)
    const hunters = [...g.hunters].sort((a, b) => (a.mode === 'home') - (b.mode === 'home'));
    for (const hu of hunters) this.drawHunterAt(g, hu, time);

    // the snail
    this.drawSnailAt(g, time);

    this.drawParticles(1 / 60);
  }

  drawHunterAt(g, hu, time) {
    const ctx = this.ctx;
    const k = this.k;
    const p = posOf(hu);
    let x = this.sx(p.x), y = this.sy(p.y);
    if (hu.mode === 'nest') y += Math.sin(time * 3 + hu.id.length) * k * 0.06;
    const facing = hu.dir === 'left' ? -1 : hu.dir === 'right' ? 1 : (hu.facing ?? 1);
    hu.facing = facing;
    const o = {
      t: time + hu.id.length, facing,
      frightened: hu.mode === 'frightened',
      blink: hu.mode === 'frightened' && g.caffeine < 2 && !this.reduced && Math.floor(time * 5) % 2 === 0,
      eyes: hu.mode === 'home',
    };
    const draw = (px) => { ctx.save(); ctx.translate(px, y); drawHunter(ctx, hu.id, k, o); ctx.restore(); };
    draw(x);
    // through the tunnel: the other half shows on the other side
    if (g.maze.tunnels.has(hu.ty)) { if (p.x < 1) draw(x + g.maze.w * k); else if (p.x > g.maze.w - 1) draw(x - g.maze.w * k); }
  }

  drawSnailAt(g, time) {
    const ctx = this.ctx;
    const k = this.k;
    const s = g.snail;
    const p = posOf(s);
    const x = this.sx(p.x), y = this.sy(p.y);
    const scale = (k * 0.98) / 48;
    const draw = (px) => {
      ctx.save();
      ctx.translate(px, y);
      if (g.state === 'dying') {
        const f = Math.max(0, g.stateT / DYING_TIME);
        ctx.globalAlpha = 0.3 + 0.7 * f;
        drawSnail(ctx, SNAIL_STYLE, { x: 0, y: k * 0.36, facing: s.facing, color: SNAIL_COLOR, scale, t: time, walking: false, dead: true });
        ctx.restore();
        return;
      }
      let facing = s.facing;
      if (s.dir === 'up') { ctx.rotate(-Math.PI / 2); facing = 1; }
      else if (s.dir === 'down') { ctx.rotate(Math.PI / 2); facing = 1; }
      if (g.caffeine > 0 && !this.reduced) ctx.translate(Math.sin(time * 40) * k * 0.03, Math.cos(time * 37) * k * 0.02);
      if (s.stuck && !this.reduced) { const pulse = 1 + Math.sin(time * 6) * 0.05; ctx.scale(pulse, pulse); }
      const walking = !this.reduced && g.state === 'play' && !s.stuck && s.dir != null;
      drawSnail(ctx, SNAIL_STYLE, { x: 0, y: k * 0.36, facing, color: SNAIL_COLOR, scale, t: time, walking });
      ctx.restore();
    };
    draw(x);
    if (g.maze.tunnels.has(s.ty)) { if (p.x < 1) draw(x + g.maze.w * k); else if (p.x > g.maze.w - 1) draw(x - g.maze.w * k); }
    // the caffeine clock
    if (g.caffeine > 0) {
      const total = Math.max(g.caffeine, g.caffeineTotal || 1);
      ctx.strokeStyle = 'rgba(90,59,34,0.55)'; ctx.lineWidth = Math.max(1.5, k * 0.08);
      ctx.beginPath(); ctx.arc(x, y, k * 0.62, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, g.caffeine / total)); ctx.stroke();
    }
    // stuck: a small "wait" mark
    if (s.stuck && g.state === 'play') {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = `800 ${Math.round(k * 0.5)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      const dots = '.'.repeat(1 + (Math.floor(time * 2) % 3));
      ctx.fillText(dots, x + k * 0.5, y - k * 0.4);
    }
    // level clear: the maze blinks
    if (g.state === 'clear' && !this.reduced) {
      const on = Math.floor((CLEAR_TIME - g.stateT) * 6) % 2 === 0;
      if (on) { ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(this.ox, this.oy, g.maze.w * k, g.maze.h * k); }
    }
  }

  // ---------- effects ----------
  burst(tx, ty, color, n = 12, power = 3) {
    if (this.reduced) return;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = power * (0.4 + Math.random() * 0.8);
      this.particles.push({ x: tx, y: ty, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.4 + Math.random() * 0.4, color, size: 0.06 + Math.random() * 0.08 });
    }
  }
  floatText(tx, ty, text, color = '#fff') {
    this.particles.push({ x: tx, y: ty, vx: 0, vy: -1.2, life: 1.0, text, color, size: 0.7 });
  }
  drawParticles(h) {
    const ctx = this.ctx;
    const k = this.k;
    const alive = [];
    for (const p of this.particles) {
      p.life -= h;
      if (p.life <= 0) continue;
      p.x += p.vx * h; p.y += p.vy * h;
      if (!p.text) { p.vx *= 0.96; p.vy *= 0.96; }
      const x = this.sx(p.x), y = this.sy(p.y);
      ctx.save();
      ctx.globalAlpha = Math.min(1, p.life * 2);
      if (p.text) {
        ctx.font = `800 ${Math.round(p.size * k)}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.strokeText(p.text, x, y);
        ctx.fillStyle = p.color;
        ctx.fillText(p.text, x, y);
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(x, y, p.size * k, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
      alive.push(p);
    }
    this.particles = alive;
  }

  // lives in the HUD: one small snail per spare life
  static drawLives(canvas, n) {
    const dpr = Math.min(2, devicePixelRatio || 1);
    const w = canvas.clientWidth || 72;
    const hgt = canvas.clientHeight || 24;
    if (canvas.width !== Math.round(w * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(hgt * dpr); }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, hgt);
    for (let i = 0; i < Math.min(5, n); i++) {
      drawSnail(ctx, SNAIL_STYLE, { x: 12 + i * 22, y: hgt - 3, facing: 1, color: SNAIL_COLOR, scale: 0.42, t: 0, walking: false });
    }
  }
}

export { DIRS, PATH, DOOR, NEST };
