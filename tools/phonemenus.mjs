// Screenshots the main menus at phone size (844x390) and reports which ones need scrolling: node tools/phonemenus.mjs  (needs the dev server)
import { chromium } from 'playwright-core';
const b = await chromium.launch({ channel: 'msedge', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto('http://localhost:5173/'); await page.waitForFunction(() => window.game, null, { timeout: 60000 });
await page.waitForTimeout(800);
const screens = {
  splash: () => window.game.ui.splash(), title: () => window.game.ui.title(), select: () => window.game.ui.select(), daily: () => window.game.ui.daily(),
  settings: () => window.game.ui.settings(() => {}), armory: () => window.game.ui.armory(), controls: () => window.game.ui.controls(() => {}), builder: () => window.game.ui.builder(),
  manual: () => window.game.ui.manual(() => {}),
};
for (const [name, fn] of Object.entries(screens)) {
  await page.evaluate(`(${fn.toString()})()`); await page.waitForTimeout(500);
  const m = await page.evaluate(() => { const ui = document.getElementById('ui'), pn = ui.querySelector('.panel'); return { panelH: pn ? Math.round(pn.scrollHeight) : 0, vis: pn ? Math.round(pn.clientHeight) : 0, overW: document.documentElement.scrollWidth > innerWidth }; });
  console.log(name.padEnd(9), JSON.stringify(m));
  await page.screenshot({ path: `test-shots/phone-${name}.png` });
}
console.log('errors:', errs.length, errs.slice(0, 3).join(' | '));
await b.close();
