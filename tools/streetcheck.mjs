// Close-up of parked cars and street furniture: node tools/streetcheck.mjs  (needs the dev server)
import { chromium } from 'playwright-core';
const b = await chromium.launch({ channel: 'msedge', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
await page.addInitScript(() => { Element.prototype.requestPointerLock = () => {}; });
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto('http://localhost:5173/'); await page.waitForFunction(() => window.game, null, { timeout: 60000 }); await page.waitForTimeout(1200);
for (const id of ['m2', 'm1']) {
  const info = await page.evaluate(async (id) => {
    const S = await import('/src/story.js'); const g = window.game;
    g.startMission(S.CAMPAIGN.find((m) => m.id === id), {}); g.god = true; g.enemies.forEach((e) => { e.dead = true; e.h.group.visible = false; });
    const list = g.world.parkedList || [], c = list[Math.floor(list.length / 2)], p = g.player;
    if (!c) return { parked: 0 };
    p.pos.set(c.x + Math.sin(c.yaw + 1.2) * 9, 0, c.z + Math.cos(c.yaw + 1.2) * 9); p.yaw = Math.atan2(c.x - p.pos.x, c.z - p.pos.z);
    for (let i = 0; i < 40; i++) { g.update(1 / 30); g.input.frameEnd(); }
    return { parked: list.length, at: [Math.round(c.x), Math.round(c.z)] };
  }, id);
  console.log(id, JSON.stringify(info)); await page.waitForTimeout(700); await page.screenshot({ path: `test-shots/street-${id}.png` });
}
console.log('errors', errs); await b.close();
