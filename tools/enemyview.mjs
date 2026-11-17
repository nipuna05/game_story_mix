// Lines up one of each enemy type in front of the player and takes close-up screenshots: node tools/enemyview.mjs
import { chromium } from 'playwright-core';
const b = await chromium.launch({ channel: 'msedge', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
await page.addInitScript(() => { Element.prototype.requestPointerLock = () => {}; });
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto('http://localhost:5173/'); await page.waitForFunction(() => window.game, null, { timeout: 60000 }); await page.waitForTimeout(1200);
await page.evaluate(async () => {
  const S = await import('/src/story.js'); const g = window.game;
  const def = S.buildCustom({ title: 'T', story: 'x', location: 'harbor', time: 'day', insertion: 'foot', exit: 'reach', objectives: ['collect'], count: 1, enemies: 0.1 });
  g.startMission(def, {}); g.god = true; g.hud.show(false);
  g.enemies.forEach((e) => { e.dead = true; e.h.group.visible = false; });
  g.player.h.group.visible = false;
  window.row = (types, ang) => {
    g.enemies.filter((e) => e.showcase).forEach((e) => { g.scene.remove(e.h.group); });
    const out = types.map((t, i) => { const e = g.spawnEnemy(t, 60 + (i - (types.length - 1) / 2) * 2.2, -150, ang); e.showcase = true; e.neutral = true; return e; });
    g.state = 'paused'; g.camera.position.set(60, 1.9, -150 - 6.5); g.camera.lookAt(60, 1.3, -150); g.camera.fov = 38; g.camera.updateProjectionMatrix();
    out.forEach((e) => { e.h.group.position.copy(e.pos); e.h.group.rotation.y = ang; e.h.group.visible = true; });
    g.renderer.toneMappingExposure = 1.0; g.composer.render();
  };
});
for (const [name, types, ang] of [['front', ['guard', 'guard', 'guard', 'guard', 'guard'], Math.PI], ['mix', ['guard', 'heavy', 'sniper', 'thug', 'boss'], Math.PI], ['side', ['guard', 'heavy', 'sniper', 'thug', 'boss'], Math.PI * 0.6], ['back', ['guard', 'heavy', 'sniper', 'thug', 'boss'], 0]]) {
  await page.evaluate(([t, a]) => window.row(t, a), [types, ang]); await page.waitForTimeout(500);
  await page.evaluate(() => window.game.composer.render()); await page.screenshot({ path: `test-shots/enemies-${name}.png` });
}
console.log('errors', errs);
await b.close();
