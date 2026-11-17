// Starts missions over and over and watches GPU/JS memory counters for growth: node tools/leakcheck.mjs  (needs the dev server)
import { chromium } from 'playwright-core';
const b = await chromium.launch({ channel: 'msedge', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--js-flags=--expose-gc'] });
const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
await page.addInitScript(() => { Element.prototype.requestPointerLock = () => {}; });
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto('http://localhost:5173/'); await page.waitForFunction(() => window.game, null, { timeout: 60000 }); await page.waitForTimeout(1200);
const rows = await page.evaluate(async () => {
  const S = await import('/src/story.js'); const g = window.game, rows = [];
  const snap = (label) => { g.composer.render(); const i = g.renderer.info; rows.push({ label, geometries: i.memory.geometries, textures: i.memory.textures, programs: i.programs.length, sceneObjs: (() => { let n = 0; g.scene.traverse(() => n++); return n; })(), heapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null }); };
  const ids = ['m1', 'm2', 'm3', 'm3b', 'm4', 'm3c', 'm3d', 'm1', 'm2', 'm3', 'm3b', 'm4', 'm3c', 'm3d'];
  for (const id of ids) { g.startMission(S.CAMPAIGN.find((m) => m.id === id), {}); g.god = true; for (let i = 0; i < 20; i++) { g.update(1 / 30); g.input.frameEnd(); } snap(id); }
  g.toMenu(true); snap('menu');
  return rows;
});
for (const r of rows) console.log(JSON.stringify(r));
console.log('errors', errs); await b.close();
