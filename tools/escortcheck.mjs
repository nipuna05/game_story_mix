// Escort checks: the VIP dies -> mission fails; nearby alert guards really hurt the VIP: node tools/escortcheck.mjs  (needs the dev server)
import { chromium } from 'playwright-core';
const b = await chromium.launch({ channel: 'msedge', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
await page.addInitScript(() => { Element.prototype.requestPointerLock = () => {}; });
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto('http://localhost:5173/'); await page.waitForFunction(() => window.game, null, { timeout: 60000 }); await page.waitForTimeout(1200);
const r = await page.evaluate(async () => {
  const S = await import('/src/story.js'), g = window.game, out = {};
  const tick = (n) => { for (let i = 0; i < n && g.state === 'playing'; i++) { g.update(1 / 30); g.input.frameEnd(); } };
  const start = () => { g.startMission(S.CAMPAIGN.find((m) => m.id === 'm3h'), {}); g.god = true; tick(5); };
  // 1) guards firing near the VIP
  start(); let v = g.vip, p = g.player; v.free(); p.pos.set(v.pos.x, 0, v.pos.z + 2); tick(3);
  const guards = g.enemies.filter((e) => !e.dead).slice(0, 8);
  guards.forEach((e, i) => { e.pos.set(v.pos.x + 10 + i, 0, v.pos.z + 6); e.alert(p.targetPos()); e.fireCd = 0; e.react = 0; });
  const hp0 = v.hp; tick(240); out.vipHpAfterFire = Math.round(v.hp); out.hpBefore = hp0;
  // 2) VIP dies -> fail
  start(); v = g.vip; v.free(); tick(2); v.damage(500); tick(3); out.stateAfterDeath = g.state; out.vipDead = v.dead;
  return out;
});
console.log(JSON.stringify(r)); console.log('errors', errs); await b.close();
