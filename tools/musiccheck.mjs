// Real-flow music check: click through the menu like a player and measure the music level. node tools/musiccheck.mjs
import { chromium } from 'playwright-core';
const b = await chromium.launch({ channel: 'msedge', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
await page.addInitScript(() => { Element.prototype.requestPointerLock = () => {}; });
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto('http://localhost:5173/'); await page.waitForFunction(() => window.game, null, { timeout: 60000 });
const probe = (label) => page.evaluate(async (label) => {
  const g = window.game, m = g.music, out = { label, ctx: g.audio.ctx && g.audio.ctx.state, started: m.started, mode: m.mode, setting: g.settings.music, gain: m.out ? +m.out.gain.value.toFixed(3) : null, muted: g.audio.muted };
  if (m.out) {
    if (!m._an) { m._an = g.audio.ctx.createAnalyser(); m._an.fftSize = 4096; m.out.connect(m._an); }
    const buf = new Float32Array(m._an.fftSize); let peak = 0, sum = 0, n = 0; const end = performance.now() + 2500;
    while (performance.now() < end) { m._an.getFloatTimeDomainData(buf); for (const v of buf) { peak = Math.max(peak, Math.abs(v)); sum += v * v; n++; } await new Promise((r) => setTimeout(r, 20)); }
    out.peak = +peak.toFixed(3); out.rms = +Math.sqrt(sum / n).toFixed(4);
  }
  return out;
}, label);
console.log(JSON.stringify(await probe('splash, no click yet')));
await page.mouse.click(640, 360); await page.waitForTimeout(1200);
console.log(JSON.stringify(await probe('home screen after the splash click')));
await page.click('button[data-a="new"]'); await page.waitForTimeout(300);
console.log(JSON.stringify(await probe('after first click (cast screen)')));
await page.click('button[data-a="ok"]'); for (let i = 0; i < 5; i++) await page.click('button[data-a="next"]');
await page.click('button[data-a="go"]'); await page.waitForTimeout(1500);
console.log(JSON.stringify(await probe('in the mission')));
await page.evaluate(() => { const g = window.game; for (const e of g.enemies) if (!e.dead && !e.def.static) { e.alert(g.player.targetPos()); break; } });
await page.waitForTimeout(1200);
console.log(JSON.stringify(await probe('a guard alerted')));
console.log('errors', errs);
await b.close();
