// Checks the share card and invite: node tools/sharecheck.mjs   (needs the dev server)
import { chromium } from 'playwright-core';
const b = await chromium.launch({ channel: 'msedge', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, permissions: ['clipboard-read', 'clipboard-write'], acceptDownloads: true });
const page = await ctx.newPage();
await page.addInitScript(() => { Element.prototype.requestPointerLock = () => {}; });
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto('http://localhost:5173/'); await page.waitForFunction(() => window.game, null, { timeout: 60000 });
await page.keyboard.press('Enter'); await page.waitForTimeout(500);
await page.click('[data-a="invite"]'); await page.waitForTimeout(500);
console.log('invite note:', await page.textContent('#inviteNote'), '| clip:', await page.evaluate(() => navigator.clipboard.readText()));
await page.evaluate(async () => {
  const S = await import('/src/story.js'); const g = window.game;
  g.startMission(S.CAMPAIGN[0], {}); g.ui.clear();
  g.ui.debrief({ stats: { time: 134, kills: 6, headshots: 2, takedowns: 1, shots: 40, hits: 28, alarms: 0, deaths: 0 }, score: 5120, rank: 'A', credits: 850 });
});
await page.waitForTimeout(300);
const dl = page.waitForEvent('download', { timeout: 8000 });
await page.click('[data-a="share"]');
const d = await dl; await d.saveAs('test-shots/share-card.png');
console.log('share note:', await page.textContent('#shareNote'));
console.log('clipboard:', await page.evaluate(() => navigator.clipboard.readText()));
console.log('errors:', errs.length, errs.slice(0, 3).join(' | '));
await b.close();
