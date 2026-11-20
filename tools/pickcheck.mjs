// Phone: aim zoom is tighter, USE glows near a gun and picks it up from 3 m: node tools/pickcheck.mjs (needs dev server)
import { chromium } from 'playwright-core';
const b = await chromium.launch({ channel: 'msedge', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const mk = async (touch) => { const page = await (await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: touch, isMobile: touch })).newPage(); page.on('pageerror', (e) => console.log('ERR', e.message)); await page.goto('http://localhost:5173/' + (touch ? '' : '')); await page.waitForFunction(() => window.game, null, { timeout: 60000 }); return page; };
for (const touch of [true, false]) {
  const page = await mk(touch);
  await page.evaluate(async () => { const S = await import('/src/story.js'), g = window.game; g.startMission(S.CAMPAIGN[0], {}); g.ui.clear(); g.hud.show(true); g.god = true; });
  await page.waitForTimeout(1200);
  const fov = async (aim) => { await page.evaluate((a) => { window.game.input.buttons[2] = a; }, aim); await page.waitForTimeout(1500); return page.evaluate(() => +window.game.camera.fov.toFixed(1)); };
  const f0 = await fov(false), f1 = await fov(true); await page.evaluate(() => { window.game.input.buttons[2] = false; });
  const r = await page.evaluate(async () => {
    const g = window.game, p = g.player, V = await import('/src/gear.js');
    const id = Object.keys(V.VARIANTS).find((k) => V.VARIANTS[k].slot === 'rifle') || Object.keys(V.VARIANTS)[0];
    const pk = g.spawnWeapon(id, 10, 30, p.pos.x, p.pos.z + 2.9); return { made: !!pk };
  });
  await page.waitForTimeout(500);
  const near = await page.evaluate(() => ({ interact: !!window.game.interact, glow: !!document.querySelector('.tbtn.use.ready') }));
  console.log(touch ? 'touch  ' : 'desktop', 'fov hip', f0, 'aim', f1, JSON.stringify(r), JSON.stringify(near));
}
await b.close();
