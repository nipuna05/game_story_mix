// Defusal checks: letting the clock run out explodes the bombs and fails the mission: node tools/defusecheck.mjs  (needs the dev server)
import { chromium } from 'playwright-core';
const b = await chromium.launch({ channel: 'msedge', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
await page.addInitScript(() => { Element.prototype.requestPointerLock = () => {}; });
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto('http://localhost:5173/'); await page.waitForFunction(() => window.game, null, { timeout: 60000 }); await page.waitForTimeout(1200);
const r = await page.evaluate(async () => {
  const S = await import('/src/story.js'), g = window.game, out = {};
  const tick = (n) => { for (let i = 0; i < n && g.state === 'playing'; i++) { g.update(1 / 30); g.input.frameEnd(); } };
  g.startMission(S.CAMPAIGN.find((m) => m.id === 'm3i'), {}); g.god = true; tick(5);
  const m = g.mission, o = m.objs.find((x) => x.type === 'defuse');
  for (const it of m.objs[0].st.items) { g.player.pos.set(it.pos.x, 0, it.pos.z); tick(3); }
  out.curType = m.cur.type; out.live = o.st.targets.filter((t) => t.state === 'live').length;
  tick(30 * 140); out.timeLeft = Math.round(o.st.t); out.liveAt140s = o.st.targets.filter((t) => t.state === 'live').length;
  tick(30 * 15); out.state = g.state; out.bombsExploded = o.st.targets.filter((t) => t.state === 'dead').length;
  return out;
});
console.log(JSON.stringify(r)); console.log('errors', errs); await b.close();
