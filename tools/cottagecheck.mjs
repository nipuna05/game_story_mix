// Screenshots of the village cottages: node tools/cottagecheck.mjs  (needs the dev server)
import { chromium } from 'playwright-core';
const b = await chromium.launch({ channel: 'msedge', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
await page.addInitScript(() => { Element.prototype.requestPointerLock = () => {}; });
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto('http://localhost:5173/'); await page.waitForFunction(() => window.game, null, { timeout: 60000 }); await page.waitForTimeout(1200);
for (const loc of ['forest', 'mountain']) {
  const info = await page.evaluate(async (loc) => {
    const S = await import('/src/story.js'); const g = window.game;
    const def = S.buildCustom({ title: 'T', story: 'x', location: loc, time: 'day', insertion: 'foot', exit: 'reach', objectives: ['collect'], count: 1, enemies: 0.1 });
    g.startMission(def, {}); g.god = true; g.enemies.forEach((e) => { e.dead = true; e.h.group.visible = false; });
    const W = g.world, I = W.interiors.filter((q) => q.w <= 10 && q.d <= 10), it = I[0], p = g.player;
    window.__it = it; window.tick = (n) => { for (let i = 0; i < n && g.state === 'playing'; i++) { g.update(1 / 30); g.input.frameEnd(); } };
    const dist = 11; p.pos.set(it.cx + it.door.nx * dist, 0, it.cz + it.door.nz * dist); p.yaw = Math.atan2(-it.door.nx, -it.door.nz) + 0.5; p.pitch = 0.05; window.tick(30);
    return { cottages: I.length, boxes: W.boxes.length, at: [Math.round(it.cx), Math.round(it.cz)], size: [it.w, it.d] };
  }, loc);
  console.log(loc, JSON.stringify(info));
  await page.waitForTimeout(700); await page.screenshot({ path: `test-shots/cottage-${loc}-out.png` });
  await page.evaluate(() => { const g = window.game, it = window.__it, p = g.player; p.pos.set(it.door.x - it.door.nx * 0.5, 0, it.door.z - it.door.nz * 0.5); p.yaw = Math.atan2(-it.door.nx, -it.door.nz); window.tick(50); });
  await page.waitForTimeout(500); await page.screenshot({ path: `test-shots/cottage-${loc}-in.png` });
}
console.log('errors', errs);
await b.close();
