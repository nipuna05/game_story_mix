// Measures that every sound actually makes noise: node tools/audiocheck.mjs   (needs the dev server)
import { chromium } from 'playwright-core';
const b = await chromium.launch({ channel: 'msedge', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
await page.addInitScript(() => { Element.prototype.requestPointerLock = () => {}; });
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto('http://localhost:5173/'); await page.waitForFunction(() => window.game, null, { timeout: 60000 }); await page.waitForTimeout(1000);
const r = await page.evaluate(async () => {
  const g = window.game, a = g.audio, out = {};
  a.init(); await a.ctx.resume(); await new Promise((r) => setTimeout(r, 2500));
  out.ctx = a.ctx.state; out.samples = Object.keys(a.samples);
  const an = a.ctx.createAnalyser(); an.fftSize = 2048; a.master.connect(an);
  const buf = new Float32Array(an.fftSize);
  const peak = async (ms) => { let p = 0; const end = performance.now() + ms; while (performance.now() < end) { an.getFloatTimeDomainData(buf); for (const v of buf) p = Math.max(p, Math.abs(v)); await new Promise((r) => setTimeout(r, 15)); } return +p.toFixed(3); };
  out.guns = {};
  for (const id of ['usp', 'glock', 'deagle', 'm4a1', 'ak47', 'mp5', 'p90', 'spas12', 'striker', 'l118a']) { a.gun(id, 1, 0, 0, true); out.guns[id] = await peak(350); await new Promise((r) => setTimeout(r, 250)); }
  a.gun('ak47', 0.6, -0.8, 0.8, false); out.farLeft = await peak(300);
  a.reload(1.6); out.reload = await peak(1200); a.explosion(1, 0.3); out.explosion = await peak(500);
  a.step(0.3); out.step = await peak(150); a.hurt(30); out.hurt = await peak(300); a.impact('body', 0.6); out.impactBody = await peak(150);
  out.engineCar = (a.vehicle('sedan', 1, 0.6), await new Promise((r) => setTimeout(r, 400)), await peak(500));
  out.engineBike = (a.vehicle('bike', 1, 0.6), await new Promise((r) => setTimeout(r, 400)), await peak(500));
  a.vehicleOff(); await new Promise((r) => setTimeout(r, 600)); out.engineOff = await peak(300);
  const man = a.ctx.createAnalyser(); man.fftSize = 2048; const mbuf = new Float32Array(man.fftSize);
  g.music.start(); g.music.out.connect(man);
  out.music = {};
  for (const mode of ['calm', 'game', 'intense']) {
    g.music.setMode(mode); await new Promise((r) => setTimeout(r, 1800)); let p = 0; const end = performance.now() + 1500;
    while (performance.now() < end) { man.getFloatTimeDomainData(mbuf); for (const v of mbuf) p = Math.max(p, Math.abs(v)); await new Promise((r) => setTimeout(r, 15)); }
    out.music[mode] = +p.toFixed(3);
  }
  const m0 = g.audio.toggleMute(); g.music.refreshMute(); await new Promise((r) => setTimeout(r, 2500)); let p = 0; man.getFloatTimeDomainData(mbuf); for (const v of mbuf) p = Math.max(p, Math.abs(v)); out.mutedMusic = +p.toFixed(4); g.audio.toggleMute(); g.music.refreshMute();
  return out;
});
console.log(JSON.stringify(r, null, 1)); console.log('errors', errs);
await b.close();
