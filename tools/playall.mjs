// Plays every mission end to end with a scripted "player" and reports softlocks: node tools/playall.mjs [id,id...]  (needs the dev server)
import { chromium } from 'playwright-core';
const only = process.argv[2] ? process.argv[2].split(',') : null;
const b = await chromium.launch({ channel: 'msedge', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
await page.addInitScript(() => { Element.prototype.requestPointerLock = () => {}; });
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto('http://localhost:5173/'); await page.waitForFunction(() => window.game, null, { timeout: 60000 }); await page.waitForTimeout(1200);
const ids = await page.evaluate(async () => (await import('/src/story.js')).CAMPAIGN.map((m) => m.id));
for (const id of ids) {
  if (only && !only.includes(id)) continue;
  const r = await page.evaluate(async ([id, real, ending]) => {
    const S = await import('/src/story.js'); const g = window.game, def = S.CAMPAIGN.find((m) => m.id === id), out = { id, steps: [] };
    const flags = id === 'm5' ? { ending: ending } : {};
    g.save.flags = { ...g.save.flags, ...flags };
    const t0 = g.save.profile.totals.missions;
    try {
      g.startMission(def, id === 'm5' ? { ending: ending } : {}); g.god = true;
      const p = g.player, P = g.P;
      const tick = (n) => { for (let i = 0; i < n && g.state === 'playing'; i++) { g.update(1 / 30); g.input.frameEnd(); } };
      const foot = () => { if (p.vehicle && p.mode !== 'plane') { p.exitVehicle(); tick(2); } };
      tick(5);
      for (let guard = 0; guard < 60 && g.state === 'playing'; guard++) {
        const m = g.mission, o = m.cur; if (!o) break; const s = o.st; out.steps.push(o.type); const before = m.idx;
        if (o.type === 'fly') { const v = p.vehicle; v.pos.set(P.lz.x, 330, P.lz.z); tick(3); }
        else if (o.type === 'land') {
          if (p.mode === 'plane') { p.vehicle.airborne = true; p.exitVehicle(); }
          tick(6); g.input.pressed.Space = true; tick(1);
          let n = 0; while (g.state === 'playing' && !(p.mode === 'foot' && p.grounded) && n++ < 3000) { if (n % 40 === 0) g.input.pressed.Space = true; tick(1); }
          out.landTicks = n;
        }
        else if (o.type === 'collect') { foot(); for (const it of s.items.filter((i) => !i.taken)) { p.pos.set(it.pos.x, 0, it.pos.z); tick(3); } }
        else if (o.type === 'rescue') {
          foot(); const z = g.rescueZone;
          for (const h of s.hostages) { if (h.state === 'captive') h.free(); }
          tick(2); for (const h of s.hostages) h.pos.set(z.x + 2, 0, z.z + 2); p.pos.set(z.x, 0, z.z); tick(6);
        }
        else if (o.type === 'destroy') {
          foot(); for (const t of s.targets.filter((q) => q.state === 'idle')) { p.pos.set(t.pos.x + 3, 0, t.pos.z); tick(1); g.armTarget(t); p.pos.set(t.pos.x + 40, 0, t.pos.z); tick(230); }
        }
        else if (o.type === 'kill') { s.boss.damage(99999, {}); tick(3); if (!s.boss.dead) s.boss.die({}); tick(3); }
        else if (o.type === 'fight') { foot(); p.pos.set(P.arena.x, 0, P.arena.z); tick(4); for (const t of s.thugs) t.damage(99999, {}); tick(4); }
        else if (o.type === 'race') {
          p.enterVehicle(s.car); tick(130);
          for (const c of s.cps) { if (g.state !== 'playing' || m.cur !== o) break; s.car.teleport(c.x, c.z, s.yaw); tick(2); }
          out.raceState = s.state;
        }
        else if (o.type === 'flyout') {
          foot(); const pl = g.vehicles.find((x) => x.type === 'plane' && !x.dead && !x.autopilot);
          p.pos.set(pl.pos.x + 4, 0, pl.pos.z); p.enterVehicle(pl); tick(3);
          if (real) {   // a real take-off: throttle, pull back at speed, climb, then level out toward the exit vector
            const k = g.input.keys; k.ShiftLeft = true; let f = 0, maxAlt = 0, rolled = 0;
            while (g.state === 'playing' && m.cur === o && f < 4000) {
              if (pl.onGround) rolled = Math.max(rolled, Math.hypot(pl.pos.x - P.plane.x, pl.pos.z - P.plane.z));
              k.KeyS = pl.onGround ? pl.speed > 34 : pl.pitch < 0.2 && pl.pos.y < 200; k.KeyW = !pl.onGround && pl.pitch > 0.05 && pl.pos.y > 220;
              tick(1); f++; maxAlt = Math.max(maxAlt, pl.pos.y);
            }
            k.ShiftLeft = k.KeyS = k.KeyW = false; out.flight = { frames: f, maxAlt: Math.round(maxAlt), rollMeters: Math.round(rolled), dead: pl.dead };
          } else { pl.onGround = false; pl.speed = 60; pl.pos.set(P.flyout.x, 120, P.flyout.z); tick(4); }
        }
        else if (o.type === 'reach') { foot(); const t = P[o.at || 'extract']; p.pos.set(t.x, 0, t.z); tick(4); }
        if (m.idx === before) { out.stuckAt = o.type + ' ' + o.text; break; }
      }
      out.completed = g.save.profile.totals.missions > t0; out.state = g.state;
    } catch (e) { out.error = String(e && e.stack || e).split('\n').slice(0, 3).join(' | '); }
    return out;
  }, [id, !!process.env.REALFLY, process.env.ENDING || 'truth']);
  console.log(JSON.stringify(r));
}
console.log('errors', errs.length, errs.slice(0, 5));
await b.close();
