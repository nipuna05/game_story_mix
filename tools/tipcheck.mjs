// Phone tip popup: shows small, dismissible by tap: node tools/tipcheck.mjs (needs dev server)
import { chromium } from 'playwright-core';
const b = await chromium.launch({ channel: 'msedge', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await (await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto('http://localhost:5173/'); await page.waitForFunction(() => window.game, null, { timeout: 60000 });
await page.evaluate(async () => { const S = await import('/src/story.js'), g = window.game; g.startMission(S.CAMPAIGN[0], {}); g.ui.clear(); g.hud.show(true); g.hud.tip('Hold the use button next to a hostage to free them, then lead them to the exit marker. Enemies nearby will hear you if you sprint.'); g.hud.tip('Second tip'); g.hud.radio && g.hud.radio('JUNO', 'You do not know me yet. Call me Juno - Elena Cross told me to watch your back if she ever went dark. The yard is north of you. Stay low.'); });
await page.waitForTimeout(1500);
const vis = () => page.evaluate(() => { const t = document.getElementById('tip'), r = t.getBoundingClientRect(); return [t.style.display, Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)]; });
console.log('tip:', await vis()); await page.screenshot({ path: 'test-shots/touch-tip.png' });
const r = await vis(); await page.evaluate(([x, y]) => document.elementFromPoint(x, y).dispatchEvent(new PointerEvent('pointerdown', { pointerId: 9, clientX: x, clientY: y, bubbles: true, cancelable: true })), [r[1] + 20, r[2] + 10]);
await page.waitForTimeout(300); console.log('after tap:', await vis(), 'queue:', await page.evaluate(() => window.game.hud.tipQueue.length));
console.log('errors:', errs.length); await b.close();
