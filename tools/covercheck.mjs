// Why does a guard (not) take cover? node tools/covercheck.mjs  (needs the dev server)
import { chromium } from 'playwright-core';
const b = await chromium.launch({ channel: 'msedge', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
await page.addInitScript(() => { Element.prototype.requestPointerLock = () => {}; });
await page.goto('http://localhost:5173/'); await page.waitForFunction(() => window.game, null, { timeout: 60000 }); await page.waitForTimeout(1200);
const r = await page.evaluate(async () => {
  const S = await import('/src/story.js'); const g = window.game, out = { tries: [] };
  const tick = (n) => { for (let i = 0; i < n && g.state === 'playing'; i++) { g.update(1 / 30); g.input.frameEnd(); } };
  for (const id of ['m1', 'm3', 'm5']) {
    g.startMission(S.CAMPAIGN.find((m) => m.id === id), { approach: 'storm' }); g.god = true; const p = g.player, W = g.world;
    tick(3); if (id === 'm5') { p.exitVehicle(); p.mode = 'foot'; p.vy = 0; }
    for (const e of g.enemies) {
      if (e.dead || e.def.static || e.pos.y > 1 || e.def.melee) continue;
      for (const [ox, oz] of [[0, -22], [0, 22], [-22, 0], [22, 0]]) {
        if (!(W.los(e.pos.x + ox, 1.6, e.pos.z + oz, e.pos.x, 1.3, e.pos.z) && !W.inside(e.pos.x + ox, 1, e.pos.z + oz))) continue;
        p.pos.set(e.pos.x + ox, 0, e.pos.z + oz); tick(3);
        const tp = p.targetPos(), d = Math.hypot(tp.x - e.pos.x, tp.z - e.pos.z), c = e.findCover(tp, d);
        out.tries.push({ id, type: e.type, d: Math.round(d), cover: c ? [Math.round(c.x - e.pos.x), Math.round(c.z - e.pos.z)] : null });
        if (c) {
          e.alert(tp); e.hitT = 2; e.coverCd = 0; e.react = 0; let went = false, crouched = false, fired = 0;
          for (let i = 0; i < 150; i++) { tick(1); if (e.cover) went = true; if (e.crouching) crouched = true; }
          out.found = { id, type: e.type, wentToCover: went, crouched, hpPlayer: p.hp };
          return out;
        }
      }
      if (out.tries.length > 40) return out;
    }
  }
  return out;
});
console.log(JSON.stringify(r, null, 1).slice(0, 2500)); await b.close();
