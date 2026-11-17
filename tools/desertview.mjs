// Screenshots of the Redrock Canyon district: node tools/desertview.mjs  (needs the dev server)
import { chromium } from 'playwright-core';
const b = await chromium.launch({ channel: 'msedge', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
await page.addInitScript(() => { Element.prototype.requestPointerLock = () => {}; });
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto('http://localhost:5173/'); await page.waitForFunction(() => window.game, null, { timeout: 60000 }); await page.waitForTimeout(1200);
for (const [id, yaw] of (process.argv[2] ? process.argv[2].split(',').map((s) => [s.split(':')[0], +s.split(':')[1]]) : [['m3c', 0.4], ['m3c', 2.6], ['m4c', 1.0]])) {
  const info = await page.evaluate(async ([id, yaw]) => {
    const S = await import('/src/story.js'); const g = window.game;
    g.startMission(S.CAMPAIGN.find((m) => m.id === id), {}); g.god = true; g.hud.show(false);
    const p = g.player; p.yaw = yaw; p.pitch = 0.05;
    for (let i = 0; i < 30; i++) { g.update(1 / 30); g.input.frameEnd(); }
    return { state: g.state, enemies: g.enemies.length, vehicles: g.vehicles.length, obj: g.mission.cur?.type };
  }, [id, yaw]);
  console.log(id, JSON.stringify(info));
  await page.waitForTimeout(600); await page.screenshot({ path: `test-shots/desert-${id}-${yaw}.png` });
}
console.log('errors', errs); await b.close();
