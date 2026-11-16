// Renders the vehicles close up: node tools/showroom.mjs   (needs the dev server)
import { chromium } from 'playwright-core';
const b = await chromium.launch({ channel: 'msedge', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
await page.addInitScript(() => { Element.prototype.requestPointerLock = () => {}; });
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto('http://localhost:5173/'); await page.waitForFunction(() => window.game, null, { timeout: 60000 }); await page.waitForTimeout(1500);
const info = await page.evaluate(async () => {
  const S = await import('/src/story.js'); const g = window.game;
  const def = S.buildCustom({ title: 'T', story: 'x', location: 'harbor', time: 'day', insertion: 'foot', exit: 'reach', objectives: ['collect'], count: 1, enemies: 0.1 });
  g.startMission(def, {}); g.god = true; g.hud.show(false);
  for (const v of [...g.vehicles]) if (v.type === 'car') { v.mesh.visible = false; v.dead = true; }
  g.enemies.forEach((e) => { e.h.group.visible = false; e.dead = true; });
  window.show = (kind, ang, dist = 7.5, h = 2.4, driven = false) => {
    for (const v of g.vehicles) if (v.showcase) { g.scene.remove(v.mesh); v.dead = true; }
    const car = g.spawnCar(0, 0, 0, kind); car.showcase = true; car.ai = { route: [], i: 0, max: 0 }; car.pos.set(60, 0, -150); car.mesh.position.copy(car.pos);
    g.player.pos.set(60, 0, -128); g.player.h.group.visible = false;
    for (let i = 0; i < 6; i++) car.update(0.03);
    g.state = 'paused';
    const cx = 60 + Math.sin(ang) * dist, cz = -150 + Math.cos(ang) * dist;
    g.camera.position.set(cx, h, cz); g.camera.lookAt(60, 0.9, -150); g.camera.fov = 40; g.camera.updateProjectionMatrix();
    g.world.update(g.camera.position, 0, g.camera.position); g.renderer.toneMappingExposure = 1.0;
    g.renderer.render(g.scene, g.camera);
    return car;
  };
  return { vehicles: g.vehicles.length };
});
console.log(JSON.stringify(info));
const shots = [['sedan', 0.7], ['sedan', 2.5], ['sports', 0.7], ['sports', 3.4], ['jeep', 0.7], ['jeep', 2.4], ['boat', 0.8], ['bike', 0.9], ['bike', 2.4]];
for (const [k, a] of shots) {
  await page.evaluate(([k, a]) => { window.show(k, a, k === 'boat' ? 10 : k === 'bike' ? 4.5 : 8, k === 'bike' ? 1.6 : 2.6); }, [k, a]);
  await page.waitForTimeout(500);
  await page.evaluate(() => { const g = window.game; g.composer.render(); });
  await page.screenshot({ path: `test-shots/car-${k}-${a}.png` });
}
console.log('errors', errs.length, errs.slice(0, 5));
await b.close();
