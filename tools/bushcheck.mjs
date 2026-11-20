// Player crouched inside a bush: the leaves around them are cleared so they can look and shoot out; bushes sit by the gates: node tools/bushcheck.mjs [map]  (needs dev server)
import { chromium } from 'playwright-core';
const b = await chromium.launch({ channel: 'msedge', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await (await b.newContext({ viewport: { width: 1000, height: 560 } })).newPage();
await page.addInitScript(() => { Element.prototype.requestPointerLock = () => {}; });
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error' || /THREE.WebGLProgram|shader/i.test(m.text())) errs.push(m.text().slice(0, 200)); });
await page.goto('http://localhost:5173/'); await page.waitForFunction(() => window.game, null, { timeout: 60000 });
const loc = process.argv[2] || 'harbor';
const info = await page.evaluate(async (loc) => {
  const S = await import('/src/story.js'), g = window.game;
  g.startMission(S.buildCustom({ title: 't', story: 'x', location: loc, time: 'day', insertion: 'foot', exit: 'reach', objectives: ['collect'], count: 1, enemies: 0.3 }), {}); g.ui.clear();
  for (const e of [...g.enemies]) { e.dead = true; e.h.group.visible = false; }
  g.god = true; g.hud.show(false);
  const gt = g.P.gates[0], near = g.world.bushes.filter((q) => Math.hypot(q.x - gt.x, q.z - gt.z) < 22).length;
  // the bush nearest the gate, 6+ m out, so the view is not the compound wall
  const bs = g.world.bushes.filter((q) => { const d = (q.x - gt.x) * gt.nx + (q.z - gt.z) * gt.nz; return d > 5 && d < 18 && Math.hypot(q.x - gt.x, q.z - gt.z) < 22; }).sort((a, c) => Math.hypot(a.x - gt.x, a.z - gt.z) - Math.hypot(c.x - gt.x, c.z - gt.z));
  const bsh = bs[0]; const p = g.player; p.pos.set(bsh.x, 0, bsh.z); p.crouch = true; p.yaw = p.camYaw = Math.atan2(-gt.nx, -gt.nz) + 0.0; p.pitch = 0.02;
  return { bushesNearGates: near, bush: bsh };
}, loc);
console.log(loc, 'bushes within 22 m of the first gate:', info.bushesNearGates);
await page.waitForTimeout(1800);
console.log('player hidden in bush:', await page.evaluate(() => [window.game.player.hidden, window.game.world.uClear.value.w]));
await page.screenshot({ path: 'test-shots/bush-in.png' });
await page.evaluate(() => { window.game.player.hidden = false; window.game.world.inBush = () => false; });
await page.waitForTimeout(1200); await page.screenshot({ path: 'test-shots/bush-out.png' });
console.log('errors:', errs.length, errs.slice(0, 3).join(' | '));
await b.close();
