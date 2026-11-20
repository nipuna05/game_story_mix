// Touch aim assist: aim 3 degrees off a guard, hold fire, the aim should drift onto them; on desktop it must not: node tools/assistcheck.mjs (needs dev server)
import { chromium } from 'playwright-core';
const b = await chromium.launch({ channel: 'msedge', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
for (const touch of [true, false]) {
  const page = await (await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: touch, isMobile: touch })).newPage();
  await page.addInitScript(() => { Element.prototype.requestPointerLock = () => {}; });
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('http://localhost:5173/' + (touch ? '' : '?x=1')); await page.waitForFunction(() => window.game, null, { timeout: 60000 });
  const r = await page.evaluate(async (touch) => {
    const S = await import('/src/story.js'), g = window.game;
    g.startMission(S.buildCustom({ title: 't', story: 'x', location: 'harbor', time: 'day', insertion: 'foot', exit: 'reach', objectives: ['collect'], count: 1, enemies: 0.1 }), {}); g.ui.clear();
    for (const e of [...g.enemies]) { e.dead = true; e.h.group.visible = false; }
    g.god = true; g.hud.show(false); if (!touch) g.input.touchMode = false;
    const p = g.player; p.crouch = false; p.pos.y = 0;
    const e = g.spawnEnemy('guard', p.pos.x, p.pos.z + 25, Math.PI, {}); e.update = () => {};
    const want = () => Math.atan2(e.pos.x - p.pos.x, e.pos.z - p.pos.z);
    p.yaw = p.camYaw = want() + 0.05; p.pitch = 0;
    return { before: +(p.yaw - want()).toFixed(4) };
  }, touch);
  await page.evaluate(() => { window.game.input.buttons[0] = true; });
  await page.waitForTimeout(2500);
  const after = await page.evaluate(() => { const g = window.game, p = g.player, e = g.enemies.find((x) => !x.dead); g.input.buttons[0] = false; return e ? +(p.yaw - Math.atan2(e.pos.x - p.pos.x, e.pos.z - p.pos.z)).toFixed(4) : 'enemy dead'; });
  console.log(touch ? 'touch  ' : 'desktop', 'yaw error before', r.before, 'after', after, 'errors', errs.length);
  await page.close();
}
await b.close();
