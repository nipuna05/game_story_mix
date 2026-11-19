// Checks medals: awarded once, saved, shown in the debrief and profile: node tools/medalcheck.mjs  (needs the dev server)
import { chromium } from 'playwright-core';
const b = await chromium.launch({ channel: 'msedge', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
await page.addInitScript(() => { Element.prototype.requestPointerLock = () => {}; });
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto('http://localhost:5173/'); await page.waitForFunction(() => window.game, null, { timeout: 60000 });
const r = await page.evaluate(async () => {
  const S = await import('/src/story.js'), g = window.game;
  g.startMission(S.CAMPAIGN[0], {}); g.ui.clear(); g.save.profile.medals = [];
  const st = g.stats; Object.assign(st, { kills: 0, headshots: 6, takedowns: 3, shots: 20, hits: 18, alarms: 0, deaths: 0, damage: 5 });
  g.time = 120; g.mission.objs.length = Math.max(1, g.mission.objs.length);
  g.missionComplete();
  const first = [...g.save.profile.medals];
  g.startMission(S.CAMPAIGN[0], {}); Object.assign(g.stats, { kills: 0, headshots: 6, takedowns: 3, shots: 20, hits: 18, alarms: 0, deaths: 0, damage: 5 }); g.time = 120; g.missionComplete();
  return { first, second: [...g.save.profile.medals] };
});
console.log('medals after 1st:', r.first.join(','), '| after repeat:', new Set(r.second).size === r.second.length ? 'no duplicates, extra: ' + r.second.filter((x) => !r.first.includes(x)).join(',') : 'DUPLICATES');
await page.evaluate(() => { const g = window.game; g.pendingUI && g.pendingUI(); });
await page.waitForTimeout(300); await page.screenshot({ path: 'test-shots/medals-debrief.png' });
await page.reload(); await page.waitForFunction(() => window.game, null, { timeout: 60000 }); await page.keyboard.press('Enter'); await page.waitForTimeout(500);
await page.click('[data-a="armory"]');
await page.click('[data-tab="medals"]'); await page.waitForTimeout(300); await page.screenshot({ path: 'test-shots/medals-profile.png' });
console.log('persisted:', await page.evaluate(() => JSON.parse(localStorage.getItem(Object.keys(localStorage).find((k) => localStorage[k].includes('"medals"')))).profile.medals.length));
console.log('errors:', errs.length, errs.slice(0, 3).join(' | '));
await b.close();
