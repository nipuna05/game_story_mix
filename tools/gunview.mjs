// Side view of every gun in the armory preview: node tools/gunview.mjs
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
mkdirSync('test-shots/guns', { recursive: true });
const b = await chromium.launch({ channel: 'msedge', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
await page.addInitScript(() => { Element.prototype.requestPointerLock = () => {}; });
await page.goto('http://localhost:5173/'); await page.waitForFunction(() => window.game, null, { timeout: 60000 }); await page.waitForTimeout(1500);
for (const [id, slot] of [['usp', 'pistol'], ['glock', 'pistol'], ['deagle', 'pistol'], ['m4a1', 'rifle'], ['ak47', 'rifle'], ['mp5', 'rifle'], ['p90', 'rifle'], ['spas12', 'rifle'], ['striker', 'rifle'], ['l118a', 'sniper']]) {
  await page.evaluate(([id, slot]) => { const g = window.game; g.toMenu(true); g.save.profile.equip[slot] = id; g.ui.armory('weapons', slot, () => g.ui.title()); g.previewSpin = false; g.pFig.group.rotation.y = Math.PI / 2; }, [id, slot]);
  await page.waitForTimeout(700);
  await page.screenshot({ path: `test-shots/guns/${id}.png`, clip: { x: 760, y: 120, width: 520, height: 330 } });
}
await b.close();
