// Island sanity: spawns and objectives are on land, the boat stays in the water: node tools/islandcheck.mjs (needs the dev server)
import { chromium } from 'playwright-core';
const b = await chromium.launch({ channel: 'msedge', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
await page.addInitScript(() => { Element.prototype.requestPointerLock = () => {}; });
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto('http://localhost:5173/'); await page.waitForFunction(() => window.game, null, { timeout: 60000 }); await page.waitForTimeout(1200);
const r = await page.evaluate(async () => {
  const S = await import('/src/story.js'); const g = window.game, out = {};
  g.startMission(S.CAMPAIGN.find((m) => m.id === 'm3d'), {}); g.god = true;
  const P = g.P, w = g.world, wet = (p) => w.inWater(p.x, p.z, true);
  out.spawnsWet = { foot: wet(P.footSpawn), car: wet(P.carSpawn), extract: wet(P.extract), lz: wet(P.lz), plane: wet(P.plane), boat: wet(P.boatSpawn) };
  out.intelWet = P.intel.filter(wet).length; out.targetsWet = P.targets.filter(wet).length; out.hostagesWet = P.hostages.filter(wet).length; out.guardsWet = g.enemies.filter((e) => wet(e.pos)).length;
  const p = g.player, boat = p.vehicle || g.vehicles.find((v) => v.kind === 'boat');
  out.inBoat = !!p.vehicle; out.boatStart = [Math.round(boat.pos.x), Math.round(boat.pos.z)];
  boat.yaw = Math.PI / 2;
  for (let i = 0; i < 360; i++) { g.input.keys.KeyW = true; g.update(1 / 30); g.input.frameEnd(); }
  out.boatAfter = [Math.round(boat.pos.x), Math.round(boat.pos.z)]; out.boatStillWet = wet(boat.pos); out.speed = +boat.speed.toFixed(1);
  g.input.keys.KeyW = false;
  return out;
});
console.log(JSON.stringify(r, null, 1)); console.log('errors', errs); await b.close();
