// Where are the remaining open gaps? node tools/farpoints.mjs  (needs the dev server)
import { chromium } from 'playwright-core';
const b = await chromium.launch({ channel: 'msedge', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
await page.addInitScript(() => { Element.prototype.requestPointerLock = () => {}; });
await page.goto('http://localhost:5173/'); await page.waitForFunction(() => window.game, null, { timeout: 60000 }); await page.waitForTimeout(1200);
const r = await page.evaluate(async () => {
  const S = await import('/src/story.js'); const g = window.game, out = {};
  for (const [id, label] of [['m1', 'harbor'], ['m2', 'downtown']]) {
    g.startMission(S.CAMPAIGN.find((m) => m.id === id), {}); g.god = true;
    const W = g.world, hide = [];
    for (const bx of W.boxes) if (bx.y1 >= 0.9 && !bx.roof) hide.push([(bx.x0 + bx.x1) / 2, (bx.z0 + bx.z1) / 2]);
    for (const bu of W.bushes) hide.push([bu.x, bu.z]);
    const grid = {}; let far = 0, n = 0, inTown = 0;
    for (let x = -380; x <= 380; x += 14) for (let z = -380; z <= 380; z += 14) {
      if (z > W.zMax - 4 || W.inside(x, 1, z, 0.5) || W.inWater(x, z)) continue;
      let d = 1e9; for (const h of hide) { const dd = Math.hypot(h[0] - x, h[1] - z); if (dd < d) d = dd; }
      n++; if (d > 30) { far++; const k = Math.floor(x / 100) * 100 + ',' + Math.floor(z / 100) * 100; grid[k] = (grid[k] || 0) + 1; }
    }
    out[label] = { far, n, buckets: Object.entries(grid).sort((a, c) => c[1] - a[1]).slice(0, 10) };
  }
  return out;
});
console.log(JSON.stringify(r)); await b.close();
