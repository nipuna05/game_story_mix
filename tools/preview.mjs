// Makes public/preview.png (1200x630 link-preview image): node tools/preview.mjs   (needs the dev server)
import { chromium } from 'playwright-core';
const b = await chromium.launch({ channel: 'msedge', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await b.newPage({ viewport: { width: 1200, height: 630 } });
await page.addInitScript(() => { Element.prototype.requestPointerLock = () => {}; });
await page.goto('http://localhost:5173/'); await page.waitForFunction(() => window.game, null, { timeout: 60000 }); await page.waitForTimeout(1500);
await page.evaluate(async () => {
  const S = await import('/src/story.js'); const g = window.game;
  g.startMission(S.buildCustom({ title: 'T', story: 'x', location: 'downtown', time: 'dusk', insertion: 'foot', exit: 'reach', objectives: ['collect'], count: 1, enemies: 0.1 }), {});
  g.god = true; g.hud.show(false); g.ui.clear();
  g.player.pos.y += 0; g.state = 'paused';
});
await page.waitForTimeout(1500);
await page.evaluate(() => {
  const g = window.game, p = g.player.pos;
  g.camera.position.set(p.x + 4, p.y + 2.0, p.z + 6); g.camera.lookAt(p.x - 6, p.y + 6, p.z - 40); g.camera.fov = 55; g.camera.updateProjectionMatrix();
  g.world.update(g.camera.position, 0, g.camera.position); g.renderer.render(g.scene, g.camera);
  const d = document.createElement('div');
  d.style.cssText = 'position:fixed;left:0;right:0;bottom:0;padding:40px 60px;background:linear-gradient(transparent,#0b1220ee);font-family:system-ui,sans-serif;color:#fff;z-index:99';
  d.innerHTML = '<div style="font-size:78px;font-weight:800;letter-spacing:4px;color:#ffb23e;line-height:1">NIGHTFALL PROTOCOL</div><div style="font-size:30px;margin-top:10px">Free 3D stealth, shooting, driving &amp; flying - right in your browser</div>';
  document.body.appendChild(d);
});
await page.waitForTimeout(500);
await page.screenshot({ path: 'public/preview.png' });
await b.close(); console.log('saved public/preview.png');
