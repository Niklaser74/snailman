// The garden's predators and the things on the ground, drawn with canvas
// paths in the same flat cartoon style as the hub's figures (img/*.svg in the
// hub repo): warm ink outline, simple fills. Every hunter is drawn centred on
// (0, 0), facing right, about one tile across; `s` is the tile size in px.
//
//   drawHunter(ctx, id, s, { t, facing, frightened, blink, eyes })
//     frightened  blue and shaky, white saucer eyes
//     blink       fright is about to end: flash pale
//     eyes        sent home: only the eyes are drawn
const INK = '#3a2210';
const FRIGHT = '#3b82f6';
const FRIGHT_PALE = '#dbe9ff';

function outline(ctx, s, w = 0.06) {
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(1, s * w);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
}

function saucerEyes(ctx, s, x, y, gap, r, o) {
  const jitter = o.frightened ? Math.sin(o.t * 30) * s * 0.02 : 0;
  for (const dx of [-gap, gap]) {
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(x + dx + jitter, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = Math.max(1, s * 0.04); ctx.stroke();
    ctx.fillStyle = INK;
    ctx.beginPath(); ctx.arc(x + dx + jitter + (o.frightened ? 0 : r * 0.3), y, r * 0.45, 0, Math.PI * 2); ctx.fill();
  }
}

function blackbird(ctx, s, o) {
  const body = o.frightened ? FRIGHT : '#1f1710';
  const wing = o.frightened ? '#6ea3ff' : '#3a3a3a';
  const flap = Math.sin(o.t * 9) * 0.12;
  outline(ctx, s);
  // tail
  ctx.fillStyle = body;
  ctx.beginPath(); ctx.moveTo(-0.28 * s, -0.02 * s); ctx.lineTo(-0.48 * s, -0.14 * s); ctx.lineTo(-0.42 * s, 0.1 * s); ctx.closePath(); ctx.fill(); ctx.stroke();
  // body
  ctx.beginPath(); ctx.ellipse(-0.02 * s, 0.06 * s, 0.3 * s, 0.2 * s, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // wing
  ctx.fillStyle = wing;
  ctx.beginPath(); ctx.moveTo(-0.18 * s, 0.0 * s); ctx.quadraticCurveTo(0.0 * s, (-0.16 + flap) * s, 0.2 * s, 0.04 * s); ctx.quadraticCurveTo(0.0 * s, (0.14 - flap) * s, -0.18 * s, 0.0 * s); ctx.fill();
  // head
  ctx.fillStyle = body;
  ctx.beginPath(); ctx.arc(0.22 * s, -0.14 * s, 0.14 * s, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // beak
  ctx.fillStyle = o.frightened ? '#ffd7a0' : '#ff9e3d';
  ctx.beginPath(); ctx.moveTo(0.34 * s, -0.16 * s); ctx.lineTo(0.5 * s, -0.12 * s); ctx.lineTo(0.34 * s, -0.07 * s); ctx.closePath(); ctx.fill(); ctx.stroke();
  // legs
  ctx.strokeStyle = '#ff9e3d'; ctx.lineWidth = Math.max(1, s * 0.05);
  ctx.beginPath(); ctx.moveTo(-0.08 * s, 0.24 * s); ctx.lineTo(-0.1 * s, 0.4 * s); ctx.moveTo(0.06 * s, 0.24 * s); ctx.lineTo(0.08 * s, 0.4 * s); ctx.stroke();
  // eye
  if (o.frightened) saucerEyes(ctx, s, 0.22 * s, -0.16 * s, 0.05 * s, 0.06 * s, o);
  else {
    ctx.fillStyle = '#ffd54f'; ctx.beginPath(); ctx.arc(0.26 * s, -0.17 * s, 0.05 * s, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(0.27 * s, -0.17 * s, 0.024 * s, 0, Math.PI * 2); ctx.fill();
  }
}

function hedgehog(ctx, s, o) {
  const spines = o.frightened ? FRIGHT : '#6e4324';
  const body = o.frightened ? '#6ea3ff' : '#8b5a34';
  const face = o.frightened ? FRIGHT_PALE : '#e8c9a0';
  const bob = Math.sin(o.t * 8) * 0.01 * s;
  outline(ctx, s);
  // spines: a jagged dome
  ctx.fillStyle = spines;
  ctx.beginPath();
  ctx.moveTo(-0.42 * s, 0.22 * s);
  const pts = [[-0.44, 0.02], [-0.34, 0.06], [-0.3, -0.16], [-0.2, -0.08], [-0.12, -0.3], [-0.04, -0.14], [0.06, -0.32], [0.12, -0.14], [0.22, -0.26], [0.26, -0.08], [0.36, -0.12], [0.34, 0.06]];
  for (const [x, y] of pts) ctx.lineTo(x * s, (y + bob / s) * s);
  ctx.lineTo(0.34 * s, 0.22 * s); ctx.closePath(); ctx.fill(); ctx.stroke();
  // body
  ctx.fillStyle = body;
  ctx.beginPath(); ctx.ellipse(-0.02 * s, 0.16 * s, 0.38 * s, 0.16 * s, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // face
  ctx.fillStyle = face;
  ctx.beginPath(); ctx.moveTo(0.22 * s, 0.04 * s); ctx.quadraticCurveTo(0.5 * s, 0.08 * s, 0.5 * s, 0.18 * s); ctx.quadraticCurveTo(0.44 * s, 0.28 * s, 0.22 * s, 0.26 * s); ctx.closePath(); ctx.fill(); ctx.stroke();
  // nose
  ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(0.49 * s, 0.18 * s, 0.04 * s, 0, Math.PI * 2); ctx.fill();
  // legs
  ctx.strokeStyle = INK; ctx.lineWidth = Math.max(1, s * 0.05);
  ctx.beginPath(); for (const x of [-0.24, -0.1, 0.1, 0.24]) { ctx.moveTo(x * s, 0.3 * s); ctx.lineTo(x * s, 0.4 * s); } ctx.stroke();
  // eye
  if (o.frightened) saucerEyes(ctx, s, 0.3 * s, 0.1 * s, 0.03 * s, 0.05 * s, o);
  else { ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(0.31 * s, 0.1 * s, 0.028 * s, 0, Math.PI * 2); ctx.fill(); }
}

function gardener(ctx, s, o) {
  const skin = o.frightened ? FRIGHT_PALE : '#f2c9a0';
  const overalls = o.frightened ? FRIGHT : '#3b82f6';
  const shirt = o.frightened ? '#6ea3ff' : '#ff9e3d';
  const hat = o.frightened ? '#9cc0ff' : '#e8c56a';
  const crown = o.frightened ? '#c7dbff' : '#f2d98a';
  const stepA = Math.sin(o.t * 8) * 0.04 * s;
  outline(ctx, s);
  // legs
  ctx.strokeStyle = overalls; ctx.lineWidth = Math.max(1, s * 0.1);
  ctx.beginPath(); ctx.moveTo(-0.08 * s, 0.22 * s); ctx.lineTo(-0.1 * s, 0.42 * s + stepA); ctx.moveTo(0.08 * s, 0.22 * s); ctx.lineTo(0.1 * s, 0.42 * s - stepA); ctx.stroke();
  // body
  outline(ctx, s);
  ctx.fillStyle = overalls;
  ctx.beginPath(); ctx.moveTo(-0.18 * s, 0.28 * s); ctx.lineTo(-0.18 * s, 0.0 * s); ctx.quadraticCurveTo(0, -0.06 * s, 0.18 * s, 0.0 * s); ctx.lineTo(0.18 * s, 0.28 * s); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = shirt;
  ctx.beginPath(); ctx.moveTo(-0.16 * s, -0.02 * s); ctx.quadraticCurveTo(0, -0.1 * s, 0.16 * s, -0.02 * s); ctx.lineTo(0.13 * s, 0.06 * s); ctx.quadraticCurveTo(0, 0.02 * s, -0.13 * s, 0.06 * s); ctx.closePath(); ctx.fill(); ctx.stroke();
  // salt shaker in the raised hand
  ctx.strokeStyle = skin; ctx.lineWidth = Math.max(1, s * 0.07);
  ctx.beginPath(); ctx.moveTo(0.16 * s, 0.02 * s); ctx.lineTo(0.32 * s, -0.16 * s); ctx.stroke();
  outline(ctx, s, 0.04);
  ctx.fillStyle = '#fffaf2'; ctx.fillRect(0.28 * s, -0.36 * s, 0.1 * s, 0.18 * s); ctx.strokeRect(0.28 * s, -0.36 * s, 0.1 * s, 0.18 * s);
  ctx.fillStyle = '#8a7a6a'; ctx.fillRect(0.28 * s, -0.4 * s, 0.1 * s, 0.05 * s);
  // head
  outline(ctx, s);
  ctx.fillStyle = skin;
  ctx.beginPath(); ctx.arc(0, -0.2 * s, 0.14 * s, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // moustache
  ctx.strokeStyle = o.frightened ? '#6ea3ff' : '#6e4324'; ctx.lineWidth = Math.max(1, s * 0.05);
  ctx.beginPath(); ctx.moveTo(-0.08 * s, -0.14 * s); ctx.quadraticCurveTo(0, -0.1 * s, 0.08 * s, -0.14 * s); ctx.stroke();
  // hat
  outline(ctx, s);
  ctx.fillStyle = hat;
  ctx.beginPath(); ctx.ellipse(0, -0.3 * s, 0.26 * s, 0.06 * s, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = crown;
  ctx.beginPath(); ctx.moveTo(-0.14 * s, -0.31 * s); ctx.quadraticCurveTo(-0.14 * s, -0.46 * s, 0, -0.47 * s); ctx.quadraticCurveTo(0.14 * s, -0.46 * s, 0.14 * s, -0.31 * s); ctx.closePath(); ctx.fill(); ctx.stroke();
  // eyes
  if (o.frightened) saucerEyes(ctx, s, 0, -0.22 * s, 0.06 * s, 0.05 * s, o);
  else {
    ctx.fillStyle = INK;
    ctx.beginPath(); ctx.arc(-0.05 * s, -0.22 * s, 0.022 * s, 0, Math.PI * 2); ctx.arc(0.06 * s, -0.22 * s, 0.022 * s, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = Math.max(1, s * 0.03);
    ctx.beginPath(); ctx.moveTo(-0.09 * s, -0.28 * s); ctx.lineTo(-0.02 * s, -0.25 * s); ctx.moveTo(0.1 * s, -0.28 * s); ctx.lineTo(0.03 * s, -0.25 * s); ctx.stroke();
  }
}

function duck(ctx, s, o) {
  // an Indian Runner: upright, like a bowling pin with a beak
  const body = o.frightened ? FRIGHT : '#fffaf2';
  const beak = o.frightened ? '#ffd7a0' : '#ff9e3d';
  const stepA = Math.sin(o.t * 10) * 0.05 * s;
  outline(ctx, s);
  // feet
  ctx.strokeStyle = beak; ctx.lineWidth = Math.max(1, s * 0.06);
  ctx.beginPath(); ctx.moveTo(-0.06 * s, 0.3 * s); ctx.lineTo(-0.1 * s, 0.42 * s + stepA); ctx.moveTo(0.06 * s, 0.3 * s); ctx.lineTo(0.1 * s, 0.42 * s - stepA); ctx.stroke();
  // body
  outline(ctx, s);
  ctx.fillStyle = body;
  ctx.beginPath(); ctx.moveTo(-0.16 * s, 0.32 * s); ctx.quadraticCurveTo(-0.24 * s, 0.1 * s, -0.1 * s, -0.16 * s); ctx.quadraticCurveTo(0.02 * s, -0.3 * s, 0.14 * s, -0.16 * s); ctx.quadraticCurveTo(0.26 * s, 0.1 * s, 0.16 * s, 0.32 * s); ctx.closePath(); ctx.fill(); ctx.stroke();
  // wing
  ctx.fillStyle = o.frightened ? '#6ea3ff' : '#efe6d6';
  ctx.beginPath(); ctx.ellipse(-0.04 * s, 0.08 * s, 0.09 * s, 0.16 * s, 0.2, 0, Math.PI * 2); ctx.fill();
  // head
  ctx.fillStyle = body;
  ctx.beginPath(); ctx.arc(0.1 * s, -0.3 * s, 0.12 * s, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // beak
  ctx.fillStyle = beak;
  ctx.beginPath(); ctx.moveTo(0.2 * s, -0.32 * s); ctx.lineTo(0.4 * s, -0.27 * s); ctx.lineTo(0.2 * s, -0.22 * s); ctx.closePath(); ctx.fill(); ctx.stroke();
  // eye
  if (o.frightened) saucerEyes(ctx, s, 0.1 * s, -0.32 * s, 0.05 * s, 0.05 * s, o);
  else { ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(0.13 * s, -0.33 * s, 0.03 * s, 0, Math.PI * 2); ctx.fill(); }
}

function eyesOnly(ctx, s, o) {
  saucerEyes(ctx, s, 0, -0.08 * s, 0.1 * s, 0.09 * s, { ...o, frightened: false });
}

const DRAW = { blackbird, hedgehog, gardener, duck };

export function drawHunter(ctx, id, s, o) {
  ctx.save();
  ctx.scale(o.facing ?? 1, 1);
  if (o.eyes) eyesOnly(ctx, s, o);
  else {
    if (o.blink) o = { ...o, frightened: true };
    if (o.frightened) ctx.translate(Math.sin(o.t * 26) * s * 0.02, 0);
    DRAW[id](ctx, s, o);
    if (o.blink) { ctx.globalAlpha = 0.55; ctx.fillStyle = FRIGHT_PALE; ctx.beginPath(); ctx.arc(0, 0, 0.42 * s, 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.restore();
}

// ---------- things on the ground ----------
export function drawLettuce(ctx, s, t = 0) {
  const r = s * 0.15;
  const sway = Math.sin(t * 2) * 0.1;
  ctx.save();
  ctx.rotate(sway);
  ctx.fillStyle = '#6cc25a';
  ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.7, -0.4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#bfe37a';
  ctx.beginPath(); ctx.ellipse(-r * 0.15, -r * 0.15, r * 0.55, r * 0.35, -0.4, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#3f8f3b'; ctx.lineWidth = Math.max(1, s * 0.03);
  ctx.beginPath(); ctx.moveTo(-r * 0.8, r * 0.45); ctx.lineTo(r * 0.8, -r * 0.45); ctx.stroke();
  ctx.restore();
}

export function drawBean(ctx, s, t = 0) {
  const pulse = 1 + Math.sin(t * 5) * 0.12;
  const r = s * 0.26 * pulse;
  ctx.save();
  ctx.rotate(-0.6);
  ctx.fillStyle = '#5a3b22';
  ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.7, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#c9a377'; ctx.lineWidth = Math.max(1, s * 0.05); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-r * 0.7, r * 0.1); ctx.quadraticCurveTo(0, -r * 0.5, r * 0.7, 0.05 * r); ctx.stroke();
  ctx.restore();
  // a wisp of steam
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = Math.max(1, s * 0.04);
  const k = (t * 0.8) % 1;
  ctx.globalAlpha = 1 - k;
  ctx.beginPath(); ctx.moveTo(0, -r * 0.8 - k * s * 0.2); ctx.quadraticCurveTo(s * 0.08, -r * 1.2 - k * s * 0.2, 0, -r * 1.6 - k * s * 0.2); ctx.stroke();
  ctx.globalAlpha = 1;
}

export function drawStrawberry(ctx, s, t = 0) {
  const bob = Math.sin(t * 4) * s * 0.03;
  ctx.save();
  ctx.translate(0, bob);
  outline(ctx, s, 0.05);
  ctx.fillStyle = '#e2453c';
  ctx.beginPath(); ctx.moveTo(-0.24 * s, -0.1 * s); ctx.quadraticCurveTo(-0.26 * s, 0.22 * s, 0, 0.32 * s); ctx.quadraticCurveTo(0.26 * s, 0.22 * s, 0.24 * s, -0.1 * s); ctx.quadraticCurveTo(0, -0.22 * s, -0.24 * s, -0.1 * s); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#fff3d6';
  for (const [x, y] of [[-0.1, 0.0], [0.08, -0.02], [-0.02, 0.14], [0.14, 0.12], [-0.14, 0.16], [0.02, -0.12]]) { ctx.beginPath(); ctx.arc(x * s, y * s, 0.02 * s, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = '#3aaa5c';
  ctx.beginPath(); ctx.moveTo(0, -0.14 * s); ctx.lineTo(-0.16 * s, -0.24 * s); ctx.lineTo(-0.04 * s, -0.2 * s); ctx.lineTo(-0.02 * s, -0.36 * s); ctx.lineTo(0.06 * s, -0.22 * s); ctx.lineTo(0.18 * s, -0.26 * s); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
}
