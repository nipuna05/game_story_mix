// Can the time trials be beaten? An AI driver (about 85% of top speed, brakes for corners) runs the route: node tools/timetrial.mjs (needs the dev server)
import { chromium } from 'playwright-core';
const b = await chromium.launch({ channel: 'msedge', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
await page.addInitScript(() => { Element.prototype.requestPointerLock = () => {}; });
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto('http://localhost:5173/'); await page.waitForFunction(() => window.game, null, { timeout: 60000 }); await page.waitForFunction(() => window.game); await page.waitForTimeout(1200);
const r = await page.evaluate(async () => {
  const S = await import('/src/story.js'); const g = window.game, out = {};
  for (const id of ['m3c', 'm4', 'm2']) {
    const def = S.CAMPAIGN.find((m) => m.id === id); g.startMission(def, {}); g.god = true; g.truce = true;
    const o = g.mission.objs.find((x) => x.type === 'race'); if (!o) continue; const s = o.st;
    g.mission.idx = g.mission.objs.indexOf(o) - 1; g.mission.advance();   // jump to the race
    const q = s.slot(0), kind = o.kind || 'sports', car = g.spawnCar(q.x, q.z, s.yaw, kind);
    let len = 0; for (let i = 0; i < s.cps.length; i++) { const a = i ? s.cps[i - 1] : { x: q.x, z: q.z }; len += Math.hypot(s.cps[i].x - a.x, s.cps[i].z - a.z); }
    const res = {};
    for (const pct of [0.7, 0.85, 1.0]) {
      car.teleport(q.x, q.z, s.yaw); car.speed = 0; car.hp = 9999; car.ai = { route: s.cps, i: 0, max: car.def.max * pct }; car.frozen = false;
      let t = 0; while (car.ai.i < s.cps.length && t < 400) { g.update(1 / 30); g.input.frameEnd(); t += 1 / 30; }
      res['at' + Math.round(pct * 100) + '%'] = car.ai.i >= s.cps.length ? +t.toFixed(1) : 'DNF (stuck at cp ' + car.ai.i + ')';
    }
    out[id] = { kind, limit: o.timeTrial || 'vs rivals', laps: o.laps, routeMeters: Math.round(len), ...res };
  }
  return out;
});
console.log(JSON.stringify(r, null, 1)); console.log('errors', errs); await b.close();
