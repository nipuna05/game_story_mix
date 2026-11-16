// Drives each car type for a moment and checks seats: node tools/newcars.mjs  (needs the dev server)
import { chromium } from 'playwright-core';
const b = await chromium.launch({ channel: 'msedge', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
await page.addInitScript(() => { Element.prototype.requestPointerLock = () => {}; });
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto('http://localhost:5173/'); await page.waitForFunction(() => window.game, null, { timeout: 60000 }); await page.waitForTimeout(1200);
const r = await page.evaluate(async () => {
  const S = await import('/src/story.js'); const g = window.game, out = {};
  g.startMission(S.CAMPAIGN.find((m) => m.id === 'm1'), {}); g.god = true;
  for (const kind of ['suv', 'pickup', 'van', 'sedan', 'sports', 'jeep']) {
    const p = g.player, car = g.spawnCar(p.pos.x + 4, p.pos.z, 0, kind); p.enterVehicle(car);
    for (let i = 0; i < 40; i++) { g.input.keys.KeyW = true; g.update(1 / 30); g.input.frameEnd(); }
    out[kind] = { speed: +car.speed.toFixed(1), seats: car.seats.length, moved: +Math.hypot(car.pos.x - p.pos.x, car.pos.z - p.pos.z).toFixed(1) };
    g.input.keys.KeyW = false; p.exitVehicle?.(); car.dead = true; car.mesh.visible = false;
  }
  return out;
});
console.log(JSON.stringify(r)); console.log('errors', errs); await b.close();
