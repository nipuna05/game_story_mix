// How far is the nearest hiding spot from anywhere on each map? node tools/covermap.mjs  (needs the dev server)
import { chromium } from 'playwright-core';
const b = await chromium.launch({ channel: 'msedge', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
await page.addInitScript(() => { Element.prototype.requestPointerLock = () => {}; });
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto('http://localhost:5173/'); await page.waitForFunction(() => window.game, null, { timeout: 60000 }); await page.waitForTimeout(1200);
const r = await page.evaluate(async () => {
  const S = await import('/src/story.js'); const g = window.game, out = {};
  for (const [id, label] of [['m1', 'harbor'], ['m2', 'downtown'], ['m3', 'industrial'], ['m4', 'mountain'], ['m3b', 'forest']]) {
    g.startMission(S.CAMPAIGN.find((m) => m.id === id), {}); g.god = true;
    const W = g.world, hide = [];
    for (const bx of W.boxes) if (bx.y1 >= 0.9 && !bx.roof) hide.push([(bx.x0 + bx.x1) / 2, (bx.z0 + bx.z1) / 2]);
    for (const bu of W.bushes) hide.push([bu.x, bu.z]);
    const ds = []; let far30 = 0, n = 0;
    for (let x = -380; x <= 380; x += 14) for (let z = -380; z <= 380; z += 14) {
      if (z > W.zMax - 4 || W.inside(x, 1, z, 0.5) || W.inWater(x, z)) continue;
      let d = 1e9; for (const h of hide) { const dd = Math.hypot(h[0] - x, h[1] - z); if (dd < d) d = dd; }
      ds.push(d); n++; if (d > 30) far30++;
    }
    ds.sort((a, c) => a - c);
    const within = (m) => Math.round(ds.filter((d) => d <= m).length / n * 100);
    out[label] = { points: n, hideSpots: hide.length, median: Math.round(ds[Math.floor(n / 2)]), p90: Math.round(ds[Math.floor(n * 0.9)]), max: Math.round(ds[n - 1]), within15: within(15) + '%', within25: within(25) + '%', over30m: far30 };
  }
  return out;
});
for (const [k, v] of Object.entries(r)) console.log(k.padEnd(11), JSON.stringify(v));
console.log('errors', errs); await b.close();
