// Close-up of the grass in the forest: node tools/grassview.mjs  (needs the dev server)
import { chromium } from 'playwright-core';
const b = await chromium.launch({ channel: 'msedge', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
await page.addInitScript(() => { Element.prototype.requestPointerLock = () => {}; });
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto('http://localhost:5173/'); await page.waitForFunction(() => window.game, null, { timeout: 60000 }); await page.waitForTimeout(1200);
const r = await page.evaluate(async () => {
  const S = await import('/src/story.js'); const g = window.game;
  g.startMission(S.buildCustom({ title: 'T', story: 'x', location: 'forest', time: 'day', insertion: 'foot', exit: 'reach', objectives: ['collect'], count: 1, enemies: 0.1 }), {});
  g.god = true; g.hud.show(false); g.enemies.forEach((e) => { e.dead = true; e.h.group.visible = false; });
  const spots = []; g.scene.traverse((o) => { if (o.isInstancedMesh && o.geometry === g.world.nat.geo.tuft) for (let i = 0; i < o.count; i++) spots.push([o.instanceMatrix.array[i * 16 + 12], o.instanceMatrix.array[i * 16 + 14]]); });
  const p = g.player, s = spots[Math.floor(spots.length / 3)];
  p.pos.set(s[0] - 4, 0, s[1] - 4); p.yaw = Math.atan2(4, 4); p.pitch = 0.18; for (let i = 0; i < 20; i++) { g.update(1 / 30); g.input.frameEnd(); }
  return { tufts: spots.length, at: s };
});
console.log(JSON.stringify(r)); await page.waitForTimeout(700); await page.screenshot({ path: 'test-shots/grass.png' }); console.log('errors', errs); await b.close();
