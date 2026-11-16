// Enter the first-mission bike like a player and count visible soldier figures around it.
import { chromium } from 'playwright-core';
const b = await chromium.launch({ channel: 'msedge', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
await page.addInitScript(() => { Element.prototype.requestPointerLock = () => {}; });
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto('http://localhost:5173/'); await page.waitForFunction(() => window.game, null, { timeout: 60000 }); await page.waitForTimeout(1500);
const r = await page.evaluate(async () => {
  const S = await import('/src/story.js'); const g = window.game, out = {};
  const tick = (n) => { for (let i = 0; i < n && g.state === 'playing'; i++) { g.update(1 / 30); g.input.frameEnd(); } };
  g.startMission(S.CAMPAIGN[0], {}); g.god = true; const p = g.player;
  for (const it of g.mission.cur.st.items) { p.pos.set(it.pos.x, 0, it.pos.z); tick(3); }
  const bike = g.vehicles.find((v) => v.kind === 'bike'); out.bikeAt = [Math.round(bike.pos.x), Math.round(bike.pos.z)];
  p.pos.set(bike.pos.x + 1.4, 0, bike.pos.z); tick(3);
  const it = g.findInteract(); out.prompt = it && it.text; it.act(); tick(20);
  out.mode = p.mode; out.playerFigureVisible = p.h.group.visible; out.riderVisible = bike.rider && bike.rider.group.visible;
  const near = [];
  g.scene.traverse((o) => { if (o.isSkinnedMesh) { let v = true, q = o; while (q) { if (!q.visible) v = false; q = q.parent; } if (v) { const w = o.getWorldPosition(o.position.clone()); const d = Math.hypot(w.x - bike.pos.x, w.z - bike.pos.z); if (d < 12) near.push(Math.round(d * 10) / 10); } } });
  out.figuresWithin12m = near;
  g.input.keys.KeyW = true; tick(60);
  out.speed = Math.round(bike.speed);
  return out;
});
console.log(JSON.stringify(r)); console.log('errors', errs);
await page.waitForTimeout(500); await page.screenshot({ path: 'test-shots/bike-check.png' });
await b.close();
