// Checks the daily challenge: node tools/dailycheck.mjs   (needs the dev server)
import { chromium } from 'playwright-core';
const b = await chromium.launch({ channel: 'msedge', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
await page.addInitScript(() => { Element.prototype.requestPointerLock = () => {}; });
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto('http://localhost:5173/'); await page.waitForFunction(() => window.game, null, { timeout: 60000 });
const plan = await page.evaluate(async () => { const S = await import('/src/story.js'); const out = []; for (let d = 0; d < 8; d++) { const x = S.dailyDef(20000 + d); out.push(x.id + ':' + x.daily.mod); } return out; });
console.log('8 days:', plan.join(' '));
await page.keyboard.press('Enter'); await page.waitForTimeout(500);
await page.click('[data-a="daily"]'); await page.waitForTimeout(400); await page.screenshot({ path: 'test-shots/daily-screen.png' });
await page.click('[data-a="go"]'); await page.waitForTimeout(2500);
const r = await page.evaluate(async () => {
  const g = window.game, S = await import('/src/story.js'); const out = { mod: g.def.daily.mod, enemies: g.enemies.length, state: g.state };
  // complete it twice (second must not pay again) and fake yesterday's streak
  g.dailyState().last = S.dayNumber() - 1; g.dailyState().streak = 2;
  Object.assign(g.stats, { kills: 3, shots: 10, hits: 6, alarms: 1, deaths: 0, damage: 10 }); g.time = 200; const c0 = g.save.profile.credits; g.missionComplete();
  out.first = { streak: g.dailyState().streak, last: g.dailyState().last === S.dayNumber(), credits: g.save.profile.credits - c0 };
  g.startMission(g.def, {}); Object.assign(g.stats, { kills: 3, shots: 10, hits: 6, alarms: 1, deaths: 0, damage: 10 }); g.time = 200; const c1 = g.save.profile.credits; g.missionComplete();
  out.second = { streak: g.dailyState().streak, credits: g.save.profile.credits - c1 };
  out.unlocked = g.save.unlocked;
  return out;
});
console.log(JSON.stringify(r));
await page.waitForTimeout(2800); await page.screenshot({ path: 'test-shots/daily-debrief.png' });
// ghost twist: alarm = fail; glass doubles damage; bare empties the pack
const t = await page.evaluate(async () => {
  const g = window.game, S = await import('/src/story.js'); const res = {};
  const run = async (mod) => { const d = S.dailyDef(); d.daily = { ...d.daily, mod }; g.startMission(d, {}); await new Promise((r) => setTimeout(r, 800)); return d; };
  await run('glass'); g.god = false; const h = g.player.hp; g.player.armor = 0; g.player.damage(10, null, 'bullet'); res.glass = h - g.player.hp;
  await run('bare'); res.bare = { armor: g.player.armor, pack: Object.values(g.player.pack).reduce((a, b) => a + b, 0) };
  return res;
});
console.log(JSON.stringify(t));
// ghost twist on a fresh page: an alarm ends the mission
await page.reload(); await page.waitForFunction(() => window.game, null, { timeout: 60000 });
console.log('ghost:', await page.evaluate(async () => {
  const g = window.game, S = await import('/src/story.js'); const d = S.dailyDef(); d.daily = { ...d.daily, mod: 'ghost' };
  g.startMission(d, {}); await new Promise((r) => setTimeout(r, 1000));
  const e = g.enemies.find((x) => !x.dead && !x.noAlarm && !x.neutral); e.update = () => {}; e.state = 'alert'; g.mods.alarmDelay = 0;
  await new Promise((r) => setTimeout(r, 1500)); return JSON.stringify({ state: g.state, alarms: g.stats.alarms });
}));
console.log('errors:', errs.length, errs.slice(0, 3).join(' | '));
await b.close();
