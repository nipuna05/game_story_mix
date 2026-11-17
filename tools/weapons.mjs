// Fires every heavy-slot weapon in a real mission and checks damage, ammo use and the launcher shell: node tools/weapons.mjs  (needs the dev server)
import { chromium } from 'playwright-core';
const b = await chromium.launch({ channel: 'msedge', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
await page.addInitScript(() => { Element.prototype.requestPointerLock = () => {}; });
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto('http://localhost:5173/'); await page.waitForFunction(() => window.game, null, { timeout: 60000 }); await page.waitForTimeout(1200);
for (const id of ['l118a', 'm110', 'm249', 'gl40']) {
  const r = await page.evaluate(async (id) => {
    const S = await import('/src/story.js'), G = await import('/src/gear.js'), g = window.game;
    const prof = g.save.profile; if (!prof.own.variants.includes(id)) prof.own.variants.push(id); prof.equip.sniper = id;
    g.startMission(S.CAMPAIGN.find((m) => m.id === 'm3'), {}); g.god = true;
    const tick = (n) => { for (let i = 0; i < n && g.state === 'playing'; i++) { g.update(1 / 30); g.input.frameEnd(); } };
    tick(5); const p = g.player; p.give('sniper'); p.cur = 'sniper'; tick(2);
    const wd = p.W.sniper, st = p.inv.sniper;
    // a lone guard 22 m ahead of the camera, nobody else
    for (const e of g.enemies) if (e !== null) e.die({});
    g.camera.getWorldDirection(g.camera.position.clone());
    const d = g.camera.getWorldDirection(new g.camera.position.constructor()); d.y = 0; d.normalize();
    const e = g.spawnEnemy('guard', p.pos.x + d.x * 22, p.pos.z + d.z * 22, 0); e.hp = 100;
    const mag0 = st.mag; let shots = 0;
    for (let i = 0; i < 12; i++) { p.fireCd = 0; p.reloadT = 0; if (st.mag <= 0) st.mag = wd.mag; g.camera.position.set(p.pos.x, p.pos.y + 1.6, p.pos.z); g.camera.lookAt(e.pos.x, e.pos.y + 1.2, e.pos.z); g.camera.updateMatrixWorld(true); p.fire(wd, st, false); shots++; tick(wd.launch ? 40 : 2); if (e.dead) break; }
    return { id, name: wd.name, launch: !!wd.launch, shots, magUsed: mag0 - st.mag, enemyDead: e.dead, enemyHp: Math.round(e.hp), shellsLeft: g.grenades.length, playerHp: Math.round(p.hp) };
  }, id);
  console.log(JSON.stringify(r));
}
console.log('errors', errs.length, errs.slice(0, 4)); await b.close();
