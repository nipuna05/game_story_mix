// Does the first shot / grenade compile new shaders (a hitch)? node tools/firelag.mjs  (needs the dev server)
import { chromium } from 'playwright-core';
const b = await chromium.launch({ channel: 'msedge', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
await page.addInitScript(() => { Element.prototype.requestPointerLock = () => {}; });
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto('http://localhost:5173/'); await page.waitForFunction(() => window.game, null, { timeout: 60000 }); await page.waitForTimeout(1200);
const r = await page.evaluate(async () => {
  const S = await import('/src/story.js'); const g = window.game, out = {};
  const tick = (n) => { for (let i = 0; i < n && g.state === 'playing'; i++) { g.update(1 / 30); g.input.frameEnd(); } };
  g.startMission(S.CAMPAIGN.find((m) => m.id === 'm1'), { approach: 'storm' }); g.god = true; g.audio.init(); tick(10);
  const progs = () => g.renderer.info.programs.length;
  const names = () => g.renderer.info.programs.map((q) => q.name + ':' + q.cacheKey);
  let before = null;
  const frame = () => { const t = performance.now(); g.composer.render(); return +(performance.now() - t).toFixed(1); };
  frame(); frame(); out.programsAtStart = progs(); before = new Set(names()); out.frameMsBefore = frame();
  const p = g.player; p.give('rifle'); p.switchTo('rifle'); tick(5);
  g.input.buttons[0] = true; g.input.btnPressed[0] = true; tick(1);
  out.firstShotFrameMs = frame(); out.programsAfterFirstShot = progs(); out.newAfterShot = names().filter((n) => !before.has(n));
  tick(10); out.nextFrameMs = frame(); g.input.buttons[0] = false;
  const mset = () => { const m = new Set(); g.scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((x) => m.add(x)); }); return m; };
  const before2 = new Set(names()); const mats0 = mset(); g.throwGrenade(p); let seen = []; for (let i = 0; i < 75; i++) { tick(1); for (const m of mset()) if (!mats0.has(m) && m.isMeshBasicMaterial || (!mats0.has(m) && m.isLineBasicMaterial)) seen.push(m.type + ' fog:' + m.fog + ' tr:' + m.transparent + ' side:' + m.side + ' vc:' + m.vertexColors + ' map:' + !!m.map + ' tm:' + m.toneMapped); } out.basicSeen = [...new Set(seen)]; out.firstExplosionFrameMs = frame(); out.programsAfterGrenade = progs(); const fresh = names().filter((n) => !before2.has(n)); out.diff = fresh.map((n) => { const a = n.split(','); let best = null; for (const o of before2) { const b = o.split(','); if (b.length !== a.length) continue; const d = []; a.forEach((v, i) => { if (v !== b[i]) d.push(i + ':' + b[i].slice(0, 25) + '->' + v.slice(0, 25)); }); if (!best || d.length < best.length) best = d; } return best; });
  g.fx.sparks(p.pos.clone(), 0xb01818, 6, 2.5, 0.3, 0.09); out.sparkFrameMs = frame(); out.programsAfterSparks = progs();
  return out;
});
console.log(JSON.stringify(r, null, 1)); console.log('errors', errs); await b.close();
