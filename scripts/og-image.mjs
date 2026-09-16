#!/usr/bin/env node
// Renders icons/og-1200x630.png: the real game in Chromium, a few seconds in
// so there is a slime trail, hunters placed where they read well, and a title
// panel on the right. Uses the hub repo's Playwright (no dependency here).
//   node scripts/og-image.mjs        (PLAYWRIGHT_DIR=../dev-snails/node_modules/playwright)
import { spawn } from 'node:child_process';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pw = resolve(root, process.env.PLAYWRIGHT_DIR || '../dev-snails/node_modules/playwright');
const { chromium } = await import(pathToFileURL(join(pw, 'index.mjs')).href);
const port = 8098;
const server = spawn(process.execPath, [join(root, 'scripts', 'serve.mjs')], { env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
try {
  await new Promise((r) => setTimeout(r, 600));
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  await page.goto(`http://localhost:${port}/?lang=sv`, { waitUntil: 'networkidle' });
  await page.addStyleTag({ content: `
    #menu, #hud, #pad, #banner, #help { display: none !important; }
    #stage { padding: 18px 0 18px 18px !important; right: auto !important; width: 640px !important; }
    .og { position: fixed; left: 640px; right: 0; top: 0; bottom: 0; display: flex; flex-direction: column; justify-content: center; padding: 0 56px 0 40px; color: #fff; font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
    .og .kicker { text-transform: uppercase; letter-spacing: .14em; font-size: 20px; font-weight: 800; color: #bfe37a; margin: 0 0 10px; }
    .og h1 { font-size: 86px; line-height: 1; margin: 0 0 22px; font-weight: 900; text-shadow: 0 4px 0 rgba(0,0,0,.35); }
    .og p { font-size: 27px; line-height: 1.3; margin: 0 0 14px; color: #f4efe6; }
    .og p.en { color: #cfe3c4; font-size: 22px; }
    .og .url { margin-top: 26px; font-size: 22px; font-weight: 800; color: #ffd54f; }
  ` });
  await page.evaluate(() => {
    document.getElementById('btn-start').click();
    const g = window.snailman.game;
    const run = (s) => { for (let t = 0; t < s; t += 1 / 60) g.advance(1 / 60); };
    run(1.5);                       // past "ready"
    g.want('left'); run(1.0);
    g.want('up'); run(1.0);
    g.want('left'); run(1.0);
    g.want('up'); run(0.6);
    // hunters where they read: one right behind, one in the tunnel row, two just out of the heap
    const [bb, hh, gd, dk] = g.hunters;
    Object.assign(bb, { mode: 'chase', tx: 8, ty: 13, o: 0.5, dir: 'left', path: null });
    Object.assign(hh, { mode: 'chase', tx: 14, ty: 9, o: 0.3, dir: 'left', path: null });
    Object.assign(gd, { mode: 'scatter', tx: 12, ty: 7, o: 0.2, dir: 'right', path: null });
    Object.assign(dk, { mode: 'scatter', tx: 6, ty: 11, o: 0.6, dir: 'left', path: null });
    g.bonus = { x: g.maze.bonus.x, y: g.maze.bonus.y, t: 7 };
    // freeze: the help overlay counts as paused, and the stylesheet hides it
    document.getElementById('help').hidden = false;
    const og = document.createElement('div');
    og.className = 'og';
    og.innerHTML = `<p class="kicker">Snigelspel · snails.se</p><h1>Snailman</h1>
      <p>Pac-Man där jägarna jagar i snigelfart — och du inte får korsa ditt eget slem.</p>
      <p class="en">Pac-Man where the hunters hunt at snail speed, and you may not cross your own slime.</p>
      <p class="url">snails.se/snailman</p>`;
    document.body.appendChild(og);
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(root, 'icons', 'og-1200x630.png'), clip: { x: 0, y: 0, width: 1200, height: 630 } });
  await browser.close();
  console.log('wrote icons/og-1200x630.png');
} finally {
  server.kill();
}
