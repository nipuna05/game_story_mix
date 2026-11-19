// Records docs/demo.gif (short scripted gameplay clip) with the test browser: node tools/gif.mjs   (needs the dev server)
// The game loop is driven by hand (requestAnimationFrame is replaced), so the clip is smooth no matter how slow the software renderer is.
import { chromium } from 'playwright-core';
import { PNG } from 'pngjs';
import gifenc from 'gifenc';
const { GIFEncoder, quantize, applyPalette } = gifenc;
import fs from 'node:fs';

const W = 720, H = 405, FRAMES = 70, SIM_PER_FRAME = 2, DT = 50;   // 70 frames x 100 ms = 7 s of game time
const b = await chromium.launch({ channel: 'msedge', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await b.newPage({ viewport: { width: W, height: H } });
await page.addInitScript(() => {
  Element.prototype.requestPointerLock = () => {};
  const real = window.requestAnimationFrame.bind(window); window.__raf = null; window.__hold = false;
  window.requestAnimationFrame = (f) => { if (window.__hold) { window.__raf = f; return 1; } return real(f); };
});
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto('http://localhost:5173/'); await page.waitForFunction(() => window.game, null, { timeout: 60000 });
await page.evaluate(() => { window.__hold = true; });
await page.waitForFunction(() => window.__raf, null, { timeout: 20000 });
await page.evaluate(() => { window.__t = 1000; window.__step = () => { const f = window.__raf; if (f) { window.__raf = null; window.__t += 50; f(window.__t); } }; });

await page.evaluate(async (LOC) => {
  const S = await import('/src/story.js'), g = window.game;
  const def = S.buildCustom({ title: 'Demo', story: 'x', location: LOC, time: 'dusk', insertion: 'foot', exit: 'reach', objectives: ['collect'], count: 1, enemies: 0.1 });
  g.startMission(def, {}); g.god = true; g.ui.clear(); g.hud.show(true); const st = document.createElement('style'); st.textContent = '#keys,#hint,#tip,#banner,#big{display:none!important}'; document.head.appendChild(st);
  for (const e of [...g.enemies]) { e.dead = true; e.h.group.visible = false; }
  const p = g.player; p.yaw = p.camYaw = 0.0; p.pitch = 0;
  window.__spawned = [];
  window.__script = (i) => {
    const inp = g.input; inp.keys.KeyW = i < 26 || i > 52; inp.keys.ShiftLeft = false; inp.buttons[2] = i >= 30 && i <= 52; inp.buttons[0] = false;
    if (i === 12) for (const [dx, dz] of [[-5, 30], [6, 36]]) { const e = g.spawnEnemy('guard', p.pos.x + dx, p.pos.z + dz, Math.PI, {}); window.__spawned.push(e); }
    const live = window.__spawned.filter((e) => !e.dead);
    if (i >= 28 && i <= 52 && live.length) {   // aim at the nearest guard and fire in bursts
      const e = live[0], dx = e.pos.x - p.pos.x, dz = e.pos.z - p.pos.z, d = Math.hypot(dx, dz), ty = Math.atan2(dx, dz), tp = Math.atan2(1.5 - 1.6, d);
      p.yaw = p.camYaw = ty; p.pitch = tp; if (i % 3 === 0) { inp.buttons[0] = true; inp.btnPressed[0] = true; }
    }
  };
}, process.argv[2] || 'downtown');

const enc = GIFEncoder();
for (let i = 0; i < FRAMES; i++) {
  await page.evaluate(([i, n]) => { window.__script(i); for (let k = 0; k < n; k++) window.__step(); }, [i, SIM_PER_FRAME]);
  const png = PNG.sync.read(await page.screenshot({ type: 'png' }));
  const rgba = new Uint8Array(png.data.buffer, png.data.byteOffset, png.data.length);
  const palette = quantize(rgba, 128, { format: 'rgb565' }), index = applyPalette(rgba, palette, 'rgb565');
  enc.writeFrame(index, png.width, png.height, { palette, delay: DT * SIM_PER_FRAME });
  if (i === 40 || i === 12 || i === 64) fs.writeFileSync(`test-shots/gif-frame-${process.argv[2] || 'downtown'}-${i}.png`, PNG.sync.write(png));
}
enc.finish(); fs.mkdirSync('docs', { recursive: true }); fs.writeFileSync('docs/demo.gif', enc.bytes());
console.log('saved docs/demo.gif', (enc.bytes().length / 1048576).toFixed(1) + ' MB', 'errors:', errs.length, errs.slice(0, 2).join(' | '));
await b.close();
