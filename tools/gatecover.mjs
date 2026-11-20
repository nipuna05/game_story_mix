// Checks the cover placed around compound gates: every map with gates, driving lane stays clear, screenshot of one gate: node tools/gatecover.mjs (needs dev server)
import { chromium } from 'playwright-core';
const b = await chromium.launch({ channel: 'msedge', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await (await b.newContext({ viewport: { width: 1000, height: 560 } })).newPage();
await page.addInitScript(() => { Element.prototype.requestPointerLock = () => {}; });
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto('http://localhost:5173/'); await page.waitForFunction(() => window.game, null, { timeout: 60000 });
const spots = await page.evaluate(async () => {
  const S = await import('/src/story.js'), g = window.game, out = [];
  for (const loc of Object.keys((await import('/src/locations.js')).LOCATIONS)) {
    const def = S.buildCustom({ title: 't', story: 'x', location: loc, time: 'day', insertion: 'foot', exit: 'reach', objectives: ['collect'], count: 1, enemies: 0.3 });
    g.startMission(def, {}); g.ui.clear();
    const gates = (g.P && g.P.gates) || [];
    let blocked = 0;
    for (const gt of gates) {   // a car-wide lane (half width 4) through the gate, 20 m out and 12 m in, must have no solid box above knee height
      const tx = gt.nz !== 0 ? 1 : 0, tz = gt.nx !== 0 ? 1 : 0;
      for (let d = -12; d <= 20; d += 1) for (let l = -4; l <= 4; l += 1) {
        const x = gt.x + gt.nx * d + tx * l, z = gt.z + gt.nz * d + tz * l;
        if (g.world.boxes.some((q) => x > q.x0 && x < q.x1 && z > q.z0 && z < q.z1 && q.y1 > 0.5 && q.y0 < 1)) blocked++;
      }
    }
    out.push({ loc, gates: gates.length, blocked, first: gates[0] ? { x: gates[0].x, z: gates[0].z, nx: gates[0].nx, nz: gates[0].nz } : null });
  }
  return out;
});
for (const s of spots) console.log(s.loc.padEnd(11), 'gates', s.gates, 'lane cells blocked', s.blocked);
const t = spots.find((q) => q.loc === (process.argv[2] || 'harbor')); await page.evaluate(async (loc) => { const S = await import('/src/story.js'); window.game.startMission(S.buildCustom({ title: 't', story: 'x', location: loc, time: 'day', insertion: 'foot', exit: 'reach', objectives: ['collect'], count: 1, enemies: 0.3 }), {}); window.game.ui.clear(); }, t.loc);
await page.evaluate((s) => {
  const g = window.game, p = g.player, gt = s.first;
  for (const e of [...g.enemies]) { e.dead = true; e.h.group.visible = false; }
  g.god = true; g.hud.show(false);
  const lx = gt.nz ? 1 : 0, lz = gt.nx ? 1 : 0; p.pos.set(gt.x + gt.nx * 26 + lx * 16, p.pos.y, gt.z + gt.nz * 26 + lz * 16); const dx = gt.x + gt.nx * 8 - p.pos.x, dz = gt.z + gt.nz * 8 - p.pos.z; p.yaw = p.camYaw = Math.atan2(dx, dz); p.pitch = 0.12;
}, t);
await page.waitForTimeout(1500); await page.screenshot({ path: 'test-shots/gate-cover.png' });
console.log('errors:', errs.length, errs.slice(0, 2).join(' | '));
await b.close();
