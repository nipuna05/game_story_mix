// Performance and handling numbers: node tools/perf.mjs   (needs the dev server). Software rendering, so only JS time and draw counts matter.
import { chromium } from 'playwright-core';
const b = await chromium.launch({ channel: 'msedge', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
await page.addInitScript(() => { Element.prototype.requestPointerLock = () => {}; });
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto('http://localhost:5173/'); await page.waitForFunction(() => window.game, null, { timeout: 60000 }); await page.waitForTimeout(1200);
const r = await page.evaluate(async () => {
  const S = await import('/src/story.js'); const g = window.game, out = { scenes: {}, handling: {} };
  const tick = (n) => { for (let i = 0; i < n && g.state === 'playing'; i++) { g.update(1 / 60); g.input.frameEnd(); } };
  for (const [id, label] of [['m1', 'harbor night'], ['m2', 'downtown'], ['m3', 'industrial'], ['m4', 'mountain/forest'], ['m3b', 'forest'], ['m5', 'blackout']]) {
    const def = S.CAMPAIGN.find((m) => m.id === id); g.startMission(def, { approach: 'storm' }); g.god = true; g.hud.show(true);
    if (id === 'm5') { const p = g.player; p.exitVehicle(); p.mode = 'foot'; p.vy = 0; p.pos.set(0, 0, 0); }
    tick(30);
    const t0 = performance.now(); tick(180); const upd = (performance.now() - t0) / 180;
    g.renderer.info.autoReset = false; g.renderer.info.reset(); g.composer.render(); const info = g.renderer.info; g.renderer.info.autoReset = true;
    out.scenes[label] = { updateMs: +upd.toFixed(2), drawCalls: info.render.calls, triangles: info.render.triangles, boxes: g.world.boxes.length, enemies: g.enemies.filter((e) => !e.dead).length, geometries: info.memory.geometries, textures: info.memory.textures };
  }
  // handling: 0-100 km/h, braking distance, turning circle, top speed, for each vehicle
  g.startMission(S.CAMPAIGN[0], {}); g.god = true; g.world.boxes.length = 0; g.world.bound = 1e6; g.world.zMax = 1e6; g.world.waters.length = 0;
  for (const kind of ['sedan', 'sports', 'jeep', 'bike']) {
    const car = g.spawnCar(0, 0, 0, kind); car.driver = g.player; g.player.vehicle = car; g.player.mode = 'car';
    const k = g.input.keys; const res = {};
    car.teleport(60, -200, 0); car.speed = 0; k.KeyW = true; let t = 0, t100 = null, dist = 0;
    for (let i = 0; i < 1800 && t < 30; i++) { const z0 = car.pos.z; car.update(1 / 60); g.world.resolveCircle(car.pos, 0.1, 0, 1); t += 1 / 60; dist += car.pos.z - z0; if (t100 === null && car.speed * 3.6 >= 100) t100 = +t.toFixed(1); }
    res.to100 = t100; res.topKmh = Math.round(car.speed * 3.6);
    k.KeyW = false; k.KeyS = true; const sp0 = car.speed; let bd = 0; for (let i = 0; i < 600 && car.speed > 0.5; i++) { const z0 = car.pos.z; car.update(1 / 60); bd += car.pos.z - z0; }
    res.brakeFrom = Math.round(sp0 * 3.6); res.brakeM = Math.round(bd); k.KeyS = false;
    car.teleport(60, -200, 0); car.speed = 15; k.KeyW = true; k.KeyA = true; let ang = 0, yaw0 = car.yaw, pts = []; for (let i = 0; i < 240; i++) { car.update(1 / 60); pts.push([car.pos.x, car.pos.z]); }
    const xs = pts.map((q) => q[0]), zs = pts.map((q) => q[1]); res.turnDiameterM = Math.round(Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs)));
    k.KeyW = k.KeyA = false; out.handling[kind] = res; car.dead = true; car.mesh.visible = false; car.driver = null;
  }
  g.player.vehicle = null; g.player.mode = 'foot';
  // on foot: time to full speed, and stopping time
  const p = g.player; p.pos.set(60, 0, -250); p.vel.set(0, 0, 0); p.yaw = 0; const k = g.input.keys; k.KeyW = true; let ft = 0, f90 = null;
  for (let i = 0; i < 300; i++) { g.update(1 / 60); ft += 1 / 60; if (f90 === null && p.speed >= 4.5 * 0.9) f90 = +ft.toFixed(2); } k.KeyW = false;
  let st = 0; for (let i = 0; i < 120 && p.speed > 0.2; i++) { g.update(1 / 60); st += 1 / 60; }
  out.foot = { toFullSpeedS: f90, stopS: +st.toFixed(2) };
  return out;
});
console.log(JSON.stringify(r, null, 1)); console.log('errors', errs);
await b.close();
