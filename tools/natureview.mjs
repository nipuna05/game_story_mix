// Screenshots of the vegetation and rocks in each district: node tools/natureview.mjs  (needs the dev server)
import { chromium } from 'playwright-core';
const b = await chromium.launch({ channel: 'msedge', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
await page.addInitScript(() => { Element.prototype.requestPointerLock = () => {}; });
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto('http://localhost:5173/'); await page.waitForFunction(() => window.game, null, { timeout: 60000 }); await page.waitForTimeout(1200);
for (const [loc, time, yaws] of [['forest', 'day', [0, 2.2]], ['mountain', 'dawn', [0.6]], ['harbor', 'day', [1.2]], ['industrial', 'day', [0.5]]]) {
  for (const yaw of yaws) {
    await page.evaluate(async ([loc, time, yaw]) => {
      const S = await import('/src/story.js'); const g = window.game;
      if (!window.__cur || window.__cur !== loc + time) {
        g.startMission(S.buildCustom({ title: 'T', story: 'x', location: loc, time, insertion: 'foot', exit: 'reach', objectives: ['collect'], count: 1, enemies: 0.1 }), {});
        g.god = true; g.hud.show(false); g.enemies.forEach((e) => { e.dead = true; e.h.group.visible = false; }); window.__cur = loc + time;
      }
      const p = g.player; p.pitch = 0.05; p.yaw = yaw; p.pos.x += 0; g.input.frameEnd();
      for (let i = 0; i < 30; i++) { g.update(1 / 30); g.input.frameEnd(); }
    }, [loc, time, yaw]);
    await page.waitForTimeout(600); await page.screenshot({ path: `test-shots/nature-${loc}-${yaw}.png` });
  }
}
console.log('errors', errs); await b.close();
