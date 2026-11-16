// Headless smoke test. Start the dev server first (npm run dev), then: node tools/smoke.mjs
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const URL = process.env.URL || 'http://localhost:5173/';
mkdirSync('test-shots', { recursive: true });
let browser;
for (const channel of ['msedge', 'chrome']) {
  try { browser = await chromium.launch({ channel, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] }); break; } catch { console.log('no', channel); }
}
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.addInitScript(() => { Element.prototype.requestPointerLock = () => {}; }); // never capture the real mouse
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')));
page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE ' + m.text()); });
await page.goto(URL);
await page.waitForFunction(() => window.game, null, { timeout: 60000 });
await page.waitForTimeout(1500);
await page.screenshot({ path: 'test-shots/00-splash.png' });
await page.mouse.click(640, 360); await page.waitForTimeout(1000);
await page.screenshot({ path: 'test-shots/00-menu.png' });
const run = async (name, fn, arg) => {
  try { const r = await page.evaluate(fn, arg); console.log(name, JSON.stringify(r)); return r; } catch (e) { console.log(name, 'THREW', e.message.split('\n')[0]); }
};
const shot = async (name, wait = 600) => { await page.waitForTimeout(wait); await page.screenshot({ path: `test-shots/${name}.png` }); };

const inject = () => page.evaluate(async () => {
  const S = await import('/src/story.js');
  window.S = S; window.M = (id) => S.CAMPAIGN.find((m) => m.id === id);
  const g = window.game;
  window.tick = (n, dt = 1 / 30) => { for (let i = 0; i < n && g.state === 'playing'; i++) { g.update(dt); g.input.frameEnd(); } };
  window.info = () => ({
    state: g.state, obj: g.mission && g.mission.cur ? g.mission.cur.type + ' ' + g.mission.idx : null, mode: g.player && g.player.mode, hp: g.player && Math.round(g.player.hp),
    pos: g.player && [Math.round(g.player.pos.x), Math.round(g.player.pos.y), Math.round(g.player.pos.z)], en: g.enemies.filter((e) => !e.dead).length, boxes: g.world.boxes.length, nav: g.world.nav.length,
  });
  // drives the current race objective with a simple steering bot
  window.autoRace = (o) => {
    const k = g.input.keys, s = o.st; let frames = 0;
    while (g.mission.cur === o && frames < 6000) {
      if (s.state === 'run') {
        const c = s.cps[Math.min(s.cp, s.cps.length - 1)], car = s.car;
        let d = Math.atan2(c.x - car.pos.x, c.z - car.pos.z) - car.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
        k.KeyA = d > 0.06; k.KeyD = d < -0.06;
        const slow = Math.abs(d) > 0.5 && car.speed > 14; k.KeyW = !slow; k.KeyS = slow;
      }
      window.tick(1); frames++;
    }
    k.KeyW = k.KeyA = k.KeyD = k.KeyS = false;
    return frames;
  };
});
await inject();

for (let i = 0; i < 7; i++) {
  await run('load m' + (i + 1), (n) => { const g = window.game; g.save.flags.ending = 'truth'; g.startMission(window.S.CAMPAIGN[n], { approach: n % 2 ? 'storm' : 'ghost' }); window.tick(90); return window.info(); }, i);
  await shot(`m${i + 1}-start`);
}

// ---- M1 full run: collect, steal jeep, drive, extract
await run('m1 collect', () => {
  const g = window.game; g.startMission(window.S.CAMPAIGN[0], {}); g.god = true;
  for (const it of g.mission.cur.st.items) { g.player.pos.set(it.pos.x, 0, it.pos.z); window.tick(3); }
  window.tick(10); return window.info();
});
await run('m1 drive', () => {
  const g = window.game, p = g.player, car = g.vehicles.find((v) => v.kind === 'jeep');
  p.pos.set(car.pos.x + 2.5, 0, car.pos.z); window.tick(2);
  g.findInteract().act(); g.input.keys.KeyW = true; const z0 = car.pos.z; window.tick(120); g.input.keys.KeyW = false;
  return { ...window.info(), moved: Math.round(car.pos.z - z0), speed: Math.round(car.speed) };
});
await shot('m1-drive');
await run('m1 extract', () => {
  const g = window.game, p = g.player; p.vehicle.teleport(g.P.extract.x + 3, g.P.extract.z, 0); window.tick(5);
  return { ...window.info(), pending: !!g.pendingUI };
});
await shot('m1-debrief', 3000);

// ---- AI: alerted guards must path to the player through the compound
await run('ai chase', () => {
  const g = window.game; g.startMission(window.S.CAMPAIGN[0], {}); g.god = true; const p = g.player;
  p.pos.set(0, 0, 5); window.tick(5);
  const es = g.enemies.filter((e) => !e.def.static);
  for (const e of es) e.alert(p.targetPos());
  const dist = () => es.map((e) => Math.hypot(e.pos.x - p.pos.x, e.pos.z - p.pos.z));
  const d0 = dist(); window.tick(600); const d1 = dist();
  const avg = (a) => Math.round(a.reduce((x, y) => x + y) / a.length);
  return { n: es.length, avg0: avg(d0), avg1: avg(d1), within40: d1.filter((d) => d < 40).length, alarm: g.alarm };
});
await shot('ai-chase');

// ---- M2: fight + race
await run('m2 fight', () => {
  const g = window.game; g.startMission(window.S.CAMPAIGN[1], {}); g.god = true; const p = g.player;
  p.pos.set(g.P.arena.x + 20, 0, g.P.arena.z); window.tick(5); const a = window.info();
  p.pos.set(g.P.arena.x, 0, g.P.arena.z); window.tick(30);
  const started = g.mission.cur.st.started, lock = p.lockFists;
  for (const t of g.mission.cur.st.thugs) t.die({ from: 'player' });
  window.tick(5); return { a, started, lock, ...window.info() };
});
await run('m2 race', () => {
  const g = window.game, p = g.player, o = g.mission.cur, s = o.st;
  p.pos.set(s.car.pos.x + 2.6, 0, s.car.pos.z); window.tick(2); g.findInteract().act();
  const frames = window.autoRace(o);
  return { frames, cp: s.cp, of: s.cps.length, time: Math.round(s.time), rivals: s.rivals.map((r) => (r.ai ? r.ai.i : 'done')), ...window.info() };
});
await shot('m2-race');

// ---- M4: bike time trial, rescue, take-off, fly out
await run('m4 bike', () => {
  const g = window.game; g.startMission(window.M('m4'), {}); g.god = true; const p = g.player, o = g.mission.cur, s = o.st;
  p.pos.set(s.car.pos.x + 2, 0, s.car.pos.z); window.tick(2); g.findInteract().act();
  const frames = window.autoRace(o);
  return { frames, cp: s.cp, time: Math.round(s.time), ...window.info() };
});
await run('m4 rescue+fly', () => {
  const g = window.game, p = g.player; p.exitVehicle();
  let o = g.mission.cur;
  for (const it of o.st.items) { p.pos.set(it.pos.x, 0, it.pos.z); window.tick(3); }
  window.tick(5);
  o = g.mission.cur; const h = o.st.hostages[0];
  p.pos.set(h.pos.x + 1.5, 0, h.pos.z); window.tick(2);
  const it = g.findInteract(), txt = it && it.text;
  g.input.keys.KeyE = true; window.tick(45); g.input.keys.KeyE = false; const st = h.state;
  p.pos.set(g.P.plane.x + 5, 0, g.P.plane.z); h.pos.set(g.P.plane.x + 7, 0, g.P.plane.z); window.tick(10);
  const afterRescue = window.info();
  const pl = g.vehicles.find((v) => v.type === 'plane' && !v.dead);
  p.pos.set(pl.pos.x + 4, 0, pl.pos.z); window.tick(2); g.findInteract().act();
  const k = g.input.keys; k.ShiftLeft = true; let f = 0, maxAlt = 0;
  while (g.state === 'playing' && f < 3000) {
    k.KeyS = pl.onGround ? pl.speed > 34 : pl.pitch < 0.2 && pl.pos.y < 200;
    k.KeyW = !pl.onGround && pl.pitch > 0.05 && pl.pos.y > 220;
    window.tick(1); f++; maxAlt = Math.max(maxAlt, pl.pos.y);
  }
  k.ShiftLeft = k.KeyS = k.KeyW = false;
  return { txt, st, afterRescue, f, maxAlt: Math.round(maxAlt), planeDead: pl.dead, ...window.info() };
});
await shot('m4-end', 3000);

// ---- M5: fly in, bail out, parachute, land, shoot
await run('m5 jump', () => {
  const g = window.game; g.save.flags.ending = 'savior'; g.startMission(window.M('m5'), {}); g.god = true; const p = g.player;
  let f = 0; while (g.mission.cur.type === 'fly' && f < 2000) { window.tick(1); f++; }
  const a = window.info();
  p.exitVehicle(); window.tick(60); const fall = window.info();
  g.input.pressed.Space = true; window.tick(1); const ch = p.mode;
  let f2 = 0; while (p.mode !== 'foot' && f2 < 3000 && g.state === 'playing') { window.tick(1); f2++; }
  window.tick(5); return { f, a, fall, ch, f2, ...window.info() };
});
await shot('m5-landed');
await run('m5 shoot', () => {
  const g = window.game, p = g.player, e = g.enemies.find((x) => !x.dead && x.type === 'guard');
  p.pos.set(e.pos.x, 0, e.pos.z - 8); p.yaw = 0; p.pitch = 0; window.tick(3);
  const hp0 = e.hp;
  for (let i = 0; i < 60 && !e.dead; i++) {
    const c = g.camera.position, dx = e.pos.x - c.x, dy = e.pos.y + 1.15 - c.y, dz = e.pos.z - c.z;
    p.yaw = Math.atan2(dx, dz); p.pitch = Math.atan2(dy, Math.hypot(dx, dz));
    g.input.buttons[0] = true; g.input.btnPressed[0] = true; window.tick(1);
  }
  g.input.buttons[0] = false;
  return { hp0, hp1: e.hp, dead: e.dead, shots: g.stats.shots, hits: g.stats.hits, cur: p.cur };
});
await shot('m5-combat');
for (const e of ['savior', 'vengeance', 'truth']) await run('ending ' + e, (k) => window.M('m5').objectives({ ending: k }).map((o) => o.type).join(','), e);


// ---- combat: guards shoot back, death -> fail screen -> continue from checkpoint; grenades; charges
await run('combat death', () => {
  const g = window.game; g.startMission(window.S.CAMPAIGN[2], { approach: 'storm' }); const p = g.player;
  const e = g.enemies.find((x) => !x.dead && x.type === 'guard' && !x.route);
  p.pos.set(e.pos.x + Math.sin(e.yaw) * 9, 0, e.pos.z + Math.cos(e.yaw) * 9); p.armor = 0;
  let f = 0; while (g.state === 'playing' && f < 3000) { window.tick(1); f++; }
  return { f, hp: Math.round(p.hp), dead: p.dead, state: g.state, alerted: g.enemies.filter((x) => x.alerted).length, alarms: g.stats.alarms };
});
await page.waitForSelector('#ui h2', { timeout: 60000 }); await page.screenshot({ path: 'test-shots/fail.png' });
await run('fail ui', () => document.querySelector('#ui h2') && document.querySelector('#ui h2').textContent);
await page.click('button[data-a="cp"]', { timeout: 60000 });
await run('after continue', () => { const g = window.game; g.god = true; window.tick(10); return window.info(); });
await run('grenade + charge', () => {
  const g = window.game, p = g.player; const t = g.targets[0];
  p.pos.set(t.pos.x + 4, 0, t.pos.z); window.tick(2); const it = g.findInteract(); const txt = it && it.text;
  g.input.keys.KeyE = true; window.tick(60); g.input.keys.KeyE = false; const st = t.state;
  p.pos.set(t.pos.x + 60, 0, t.pos.z); g.input.pressed.KeyG = true; window.tick(1); const gr = g.grenades.length; window.tick(260);
  return { txt, st, after: t.state, gr, grenadesLeft: p.grenades, kills: g.stats.kills, ...window.info() };
});
await shot('m3-combat');
await run('hostage ride', () => {
  const g = window.game, p = g.player, h = g.hostages[0]; h.free();
  const car = g.vehicles.find((v) => v.type === 'car' && !v.dead); p.pos.set(car.pos.x + 2.6, 0, car.pos.z); h.pos.set(car.pos.x + 4, 0, car.pos.z); window.tick(2);
  g.findInteract().act(); window.tick(5); const riding = h.state; car.teleport(g.P.extract.x, g.P.extract.z, 0); window.tick(5);
  return { riding, end: h.state };
});

// ---- real UI flow with mouse clicks
await page.reload(); await page.waitForFunction(() => window.game, null, { timeout: 60000 }); await page.waitForTimeout(1500);
await page.mouse.click(640, 360); await page.waitForTimeout(800);
await page.click('button[data-a="new"]');
await page.fill('input[data-k="hero"]', 'Test <b>Hero</b>');
await shot('ui-cast', 300);
await page.click('button[data-a="ok"]');
await shot('ui-intro', 300);
for (let i = 0; i < 5; i++) await page.click('button[data-a="next"]');
await shot('ui-briefing', 300);
await page.click('button[data-a="go"]');
await page.waitForTimeout(1500);
await run('ui deploy', () => ({ state: window.game.state, hero: window.game.cast.hero, obj: document.getElementById('objectives').textContent.slice(0, 60) }));
await page.evaluate(() => window.game.pause());
await shot('ui-pause', 300);
await page.click('button[data-a="resume"]');
await run('ui resume', () => window.game.state);
await page.evaluate(() => { const g = window.game; g.pause(); g.toMenu(); });
await page.click('button[data-a="builder"]');
await page.fill('#b_title', 'My Op'); await page.fill('#b_story', 'Line one.\nLine two with {hero}.');
await shot('ui-builder', 300);
await page.click('button[data-a="save"]');
await shot('ui-custom-brief', 300);
await page.click('button[data-a="go"]'); await page.waitForTimeout(1000);
await run('ui custom play', () => ({ state: window.game.state, title: window.game.def.title, saved: window.game.save.custom.length }));
await page.evaluate(async () => { window.S = await import('/src/story.js'); const g = window.game; g.pause(); g.toMenu(true); g.ui.ending('truth'); });
await shot('ui-ending', 300);
await page.evaluate(() => { localStorage.clear(); });
await inject();


// ---- forest: wading, river blocks wheels, boats, boat insertion
await run('forest wade+car', () => {
  const g = window.game; g.startMission(window.M('m3b'), {}); g.god = true; const p = g.player;
  const car = g.vehicles.find((v) => v.type === 'car' && v.kind === 'sedan');
  p.pos.set(0, 0, -90); window.tick(5); const wet = p.wet, spd = (() => { g.input.keys.KeyW = true; window.tick(30); g.input.keys.KeyW = false; return +p.speed.toFixed(1); })();
  car.teleport(-100, -130, 0); p.pos.set(-97.4, 0, -130); window.tick(2); g.findInteract().act(); g.input.keys.KeyW = true; window.tick(150); g.input.keys.KeyW = false;
  const carZ = Math.round(car.pos.z); p.exitVehicle();
  const boat = g.vehicles.find((v) => v.kind === 'boat'); p.pos.set(boat.pos.x + 2.6, 0, boat.pos.z); window.tick(2); g.findInteract().act();
  const bx = boat.pos.x; g.input.keys.KeyW = true; window.tick(150); g.input.keys.KeyW = false;
  return { wet, wadeSpeed: spd, carStoppedAtZ: carZ, boatMoved: Math.round(boat.pos.x - bx), boatZ: Math.round(boat.pos.z), ...window.info() };
});
await shot('forest-boat');
await run('forest bridge', () => {
  const g = window.game, p = g.player; p.exitVehicle();
  const car = g.vehicles.find((v) => v.type === 'car' && v.kind === 'sedan'); car.teleport(-200, -150, 0); car.hp = 999;
  p.pos.set(-197.4, 0, -150); window.tick(2); g.findInteract().act(); g.input.keys.KeyW = true; window.tick(120); g.input.keys.KeyW = false;
  return { carZ: Math.round(car.pos.z) };
});
await run('m4b boat start', () => { const g = window.game; g.startMission(window.M('m4b'), { approach: 'storm' }); window.tick(60); return { kind: g.player.vehicle && g.player.vehicle.kind, ...window.info() }; });
await shot('m4b-start');
await run('forest stand', () => { const g = window.game, p = g.player; g.god = true; p.exitVehicle(); p.pos.set(-200, 0, -40); p.yaw = 0; p.pitch = 0; window.tick(40); return window.info(); });
await shot('forest-foot');
await run('pose aim', () => { const g = window.game, p = g.player; p.cur = 'rifle'; g.input.buttons[2] = true; p.yaw = 2.6; window.tick(20); return p.cur; });
await shot('pose-aim');
await run('pose crouch', () => { const g = window.game, p = g.player; g.input.buttons[2] = false; g.input.pressed.KeyC = true; window.tick(20); return p.crouch; });
await shot('pose-crouch');


// ---- cover: walk-in buildings, brush, crawling, sneaking
await run('interiors', () => {
  const g = window.game; g.startMission(window.M('m1'), {}); g.god = true; const p = g.player, W = g.world;
  const I = W.interiors, it = I[0];
  const out = { count: I.length, bushes: W.bushes.length, boxes: W.boxes.length };
  // walk through the door
  p.pos.set(it.door.x, 0, it.door.z); p.yaw = Math.atan2(-it.door.nx, -it.door.nz); window.tick(3);
  g.input.keys.KeyW = true; window.tick(60); g.input.keys.KeyW = false;
  out.insideAfterWalk = Math.abs(p.pos.x - it.cx) < it.w / 2 && Math.abs(p.pos.z - it.cz) < it.d / 2;
  // walls block sight from the far side, an open door does not
  const back = { x: it.cx - it.door.nx * (it.w / 2 + 4) * (it.door.nx ? 1 : 0) - 0, z: it.cz - it.door.nz * (it.d / 2 + 4) * (it.door.nz ? 1 : 0) };
  out.backBlocked = !W.los(back.x, 1.6, back.z, it.cx, 1.2, it.cz);
  // every interior can be entered and left (no building sealed shut)
  out.sealed = I.filter((q) => { const a = { x: q.door.x, z: q.door.z }; return !W.segClear(a.x, a.z, q.door.x - q.door.nx * 3, q.door.z - q.door.nz * 3, 0.5); }).length;
  p.pos.set(it.door.x - it.door.nx * 3, 0, it.door.z - it.door.nz * 3); window.tick(10);
  window.__door = it; return out;
});
await shot('inside-building');
await run('on the roof', () => {
  const g = window.game, p = g.player, it = window.__door, W = g.world;
  // drop onto the roof from above: should land on it, not fall into the building
  p.pos.set(it.cx, 12, it.cz); p.vy = 0; window.tick(60);
  return { y: +p.pos.y.toFixed(2), roofTop: W.groundAt(it.cx, it.cz, 9) };
});
await run('brush + crawl', () => {
  const g = window.game, p = g.player, W = g.world; p.pos.set(0, 0, 0); p.vy = 0; window.tick(5);
  const e = g.enemies.find((x) => !x.dead && x.type === 'guard');
  const b = W.bushes[0]; p.pos.set(b.x, 0, b.z); window.tick(2);
  const r = {}; r.stand = +e.viewRange(p).toFixed(1); r.hiddenFlag = p.hidden;
  g.input.pressed.KeyC = true; window.tick(2); r.crouchBush = +e.viewRange(p).toFixed(1);
  g.input.pressed.KeyZ = true; window.tick(2); r.prone = p.prone; r.proneBush = +e.viewRange(p).toFixed(1);
  p.pos.set(0, 0, 0); window.tick(2); r.proneOpen = +e.viewRange(p).toFixed(1);
  g.input.keys.KeyW = true; window.tick(60); g.input.keys.KeyW = false; r.crawlSpeed = +p.speed.toFixed(2); r.proneK = +p.proneK.toFixed(2);
  g.input.pressed.Space = true; window.tick(2); r.standUp = !p.prone;
  g.input.pressed.KeyC = false; if (p.crouch) { g.input.pressed.KeyC = true; window.tick(2); }
  g.input.keys.KeyV = true; g.input.keys.KeyW = true; window.tick(40); r.sneakSpeed = +p.speed.toFixed(2); r.sneaking = p.sneaking; g.input.keys.KeyV = g.input.keys.KeyW = false;
  g.hud.keysT = 20; window.tick(3); r.keysPanel = document.getElementById('keys').style.display;
  return r;
});
await run('crawl pose', () => { const g = window.game, p = g.player; p.give('rifle'); p.switchTo('rifle'); g.input.pressed.KeyZ = true; window.tick(30); g.input.keys.KeyW = true; window.tick(25); g.input.keys.KeyW = false; return { prone: p.prone }; });
await shot('crawl');


// ---- profile, armory, backpack, pickups, controls
await run('profile after missions', () => { const pr = window.game.save.profile; return { credits: pr.credits, xp: pr.xp, missions: pr.totals.missions, kills: pr.totals.kills }; });
await run('armory screens', () => {
  const g = window.game, out = {};
  g.save.profile.credits = 5000; g.toMenu(true);
  for (const [t, sl] of [['profile', 'rifle'], ['weapons', 'pistol'], ['weapons', 'rifle'], ['weapons', 'sniper'], ['armour', 'rifle'], ['pack', 'rifle']]) { g.ui.armory(t, sl, () => g.ui.title()); out[t + ':' + sl] = document.querySelectorAll('#ui [data-a]').length; }
  g.ui.armory('weapons', 'rifle', () => g.ui.title());
  return out;
});
await shot('armory-weapons', 1500);
await page.click('[data-a="buy:ak47"]');
await page.click('[data-tab="att"]'); await page.click('[data-a="att:supp"]');
await page.click('[data-a="att:grip"]');
await page.click('[data-tab="fin"]'); await page.click('[data-a="fin:3"]');
await run('after buying', () => { const pr = window.game.save.profile; return { owns: pr.own.variants, rifle: pr.equip.rifle, att: pr.equip.att.rifle, finish: pr.equip.finish.rifle, credits: pr.credits }; });
await shot('armory-ak', 1200);
await page.click('[data-a="tab:armour"]'); await page.click('[data-a="abuy:2"]'); await page.click('[data-a="outfit:1"]');
await shot('armory-armour', 1200);
await page.click('[data-a="tab:pack"]'); await page.click('[data-a="cap"]'); await page.click('[data-a="stock:med"]'); await page.click('[data-a="pk+:med"]'); await page.click('[data-a="pk+:med"]');
await shot('armory-pack', 1000);
await page.click('[data-a="tab:profile"]');
await shot('armory-profile', 1000);
await run('profile state', () => { const pr = window.game.save.profile; return { armor: pr.equip.armor, outfit: pr.equip.outfit, cap: pr.own.pack, stock: pr.stock, carry: pr.carry }; });
await run('loadout applies', () => {
  const g = window.game; g.startMission(window.M('m3'), { approach: 'storm' }); g.god = false; const p = g.player; window.tick(5);
  const out = { rifle: p.W.rifle.name, dmg: +p.W.rifle.dmg.toFixed(1), supp: p.W.rifle.supp, noise: +p.W.rifle.noise.toFixed(1), armor: p.armor, pack: { ...p.pack }, cap: p.packCap };
  // medkit: take damage, press the key, health goes up and stock goes down
  const before = g.save.profile.stock.med; p.hp = 40; g.input.pressed.KeyQ = true; window.tick(2);
  out.hpAfterMed = Math.round(p.hp); out.stockAfter = g.save.profile.stock.med - before; out.packMed = p.pack.med;
  p.armor = 10; g.input.pressed.KeyX = true; window.tick(2); out.plate = p.armor;
  return out;
});
await run('decoy', () => {
  const g = window.game, p = g.player; p.pack.noise = 1; p.packStock.noise = 1; const n0 = g.save.profile.stock.noise;
  g.input.pressed.KeyT = true; window.tick(2); const thrown = g.grenades.length; window.tick(70);
  return { thrown, stockUsed: n0 - g.save.profile.stock.noise };
});
await run('weapon drops, racks, swap', () => {
  const g = window.game, p = g.player, W0 = g.pickups.filter((k) => k.type === 'weapon').length;
  const e = g.enemies.find((x) => !x.dead && x.type === 'guard' && x.pos.y < 1);
  e.die({ from: 'player' });
  const drop = g.pickups.filter((k) => k.type === 'weapon' && !k.taken).slice(-1)[0];
  const out = { racksAndLoot: W0, dropVariant: drop && drop.variant };
  // stand on the dropped ak47, swap with the carried m4a1-slot gun
  p.give('rifle'); p.switchTo('rifle'); p.var.rifle = 'm4a1'; p.rebuildW('rifle');
  p.pos.set(drop.pos.x + 0.8, 0, drop.pos.z); window.tick(2);
  const it = g.findInteract(); out.prompt = it && it.text; it.act();
  out.now = p.var.rifle; out.cur = p.cur; out.droppedOld = g.pickups.some((k) => k.type === 'weapon' && !k.taken && k.variant === 'm4a1' && Math.hypot(k.pos.x - p.pos.x, k.pos.z - p.pos.z) < 3);
  g.input.pressed.KeyU = true; window.tick(2); out.afterDrop = p.inv.rifle === null; out.curAfterDrop = p.cur;
  return out;
});
await run('rebind', () => {
  const g = window.game; g.settings.keys = {}; const r = g.input.rebind(g.settings.keys, 'KeyW', 'ArrowUp'); g.settings.keys = r.map; g.input.setBindings(g.settings.keys);
  const r2 = g.input.rebind(g.settings.keys, 'KeyS', 'ArrowUp'); // takes a key used by forward: they swap
  return { first: r.map, swapped: r2.swapped, map: r2.map, bad: g.input.rebind(g.settings.keys, 'KeyQ', 'Escape').error };
});
await run('rebind setup', () => { const g = window.game; g.settings.keys = { KeyW: 'KeyP' }; g.input.setBindings(g.settings.keys); g.state = 'playing'; g.input.active = true; return g.input.label('KeyW'); });
await page.keyboard.down('KeyP');
await run('physical P acts as forward', () => ({ forward: !!window.game.input.keys.KeyW }));
await page.keyboard.up('KeyP'); await page.keyboard.down('KeyW');
await run('physical W no longer forward', () => ({ forward: !!window.game.input.keys.KeyW }));
await page.keyboard.up('KeyW');
await run('controls screen', () => { const g = window.game; g.settings.keys = {}; g.input.setBindings({}); g.state = 'menu'; g.ui.controls(() => g.ui.title()); return document.querySelectorAll('#ui .keybtn').length; });
await page.click('[data-tab="fight"]'); await page.click('button[data-a="rb:KeyG"]'); await page.keyboard.press('KeyL');
await run('rebound via screen', () => { const g = window.game; return { label: g.input.label('KeyG'), saved: g.settings.keys }; });
await shot('controls', 800);
await run('reset keys', () => { const g = window.game; g.settings.keys = {}; g.input.setBindings({}); return g.input.label('KeyG'); });


// ---- race route: map + path on the road
await run('race route', () => {
  const g = window.game;
  const def = window.S.buildCustom({ title: 'R', story: 'x', location: 'downtown', time: 'dusk', insertion: 'foot', exit: 'reach', objectives: ['race'], count: 1, enemies: 0.3 });
  g.startMission(def, {}); g.god = true; const p = g.player, o = g.mission.cur, s = o.st;
  window.tick(3);
  const out = { mapBeforeEntering: document.getElementById('racemap').style.display, pathBuilt: !!g.racePath, dashes: g.racePath ? g.racePath.dashes.length : 0 };
  p.pos.set(s.car.pos.x + 2.6, 0, s.car.pos.z); window.tick(2); g.findInteract().act(); window.tick(130);
  out.state = s.state; out.ringsVisible = g.racePath.rings.map((r) => r.visible); out.mapNow = document.getElementById('racemap').style.display;
  const before = g.racePath.cp; const k = g.input.keys; let f = 0;
  while (s.cp < 2 && f < 3000) { const c = s.cps[Math.min(s.cp, s.cps.length - 1)], car = s.car; let d = Math.atan2(c.x - car.pos.x, c.z - car.pos.z) - car.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); k.KeyA = d > 0.06; k.KeyD = d < -0.06; const slow = Math.abs(d) > 0.5 && car.speed > 14; k.KeyW = !slow; k.KeyS = slow; window.tick(1); f++; }
  k.KeyW = k.KeyA = k.KeyD = k.KeyS = false; window.tick(2);
  out.cpAdvanced = g.racePath.cp !== before; out.cp = s.cp; out.rivals = s.rivals.length;
  return out;
});
await shot('race-route', 800);
await run('race route cleaned up', () => { const g = window.game; g.startMission(window.M('m1'), {}); window.tick(3); return { path: g.racePath, map: document.getElementById('racemap').style.display }; });

// ---- aiming zooms in and tags enemies
await run('aim zoom + tags', () => {
  const g = window.game; g.startMission(window.M('m5'), { approach: 'storm' }); g.god = true; const p = g.player, W = g.world;
  window.tick(3); p.exitVehicle(); p.mode = 'foot'; p.vy = 0;
  let pick = null;
  for (const e of g.enemies) { if (e.dead || e.def.static || e.pos.y > 1) continue; for (const [ox, oz] of [[0, -30], [0, 30], [-30, 0], [30, 0], [0, -45], [0, 45]]) { if (W.los(e.pos.x + ox, 1.6, e.pos.z + oz, e.pos.x, 1.3, e.pos.z) && !W.inside(e.pos.x + ox, 1, e.pos.z + oz)) { pick = { e, ox, oz }; break; } } if (pick) break; }
  if (!pick) return { error: 'no enemy with a clear sight line found' };
  const { e, ox, oz } = pick; p.pos.set(e.pos.x + ox, 0, e.pos.z + oz); p.give('rifle'); p.switchTo('rifle'); window.tick(3);
  const out = { fovBefore: Math.round(g.camera.fov), taggedBefore: e.tagT > 0 };
  g.input.buttons[2] = true;
  for (let i = 0; i < 40; i++) { p.yaw = Math.atan2(e.pos.x - p.pos.x, e.pos.z - p.pos.z); const c = g.camera.position, dy = e.pos.y + 1.3 - c.y; p.pitch = Math.atan2(dy, Math.hypot(e.pos.x - c.x, e.pos.z - c.z)); window.tick(1); }
  out.fovAiming = Math.round(g.camera.fov); out.tagged = e.tagT > 0; out.tagShown = [...document.querySelectorAll('.etag')].filter((n) => n.style.display === 'block').map((n) => n.textContent);
  g.input.buttons[2] = false; window.tick(40); out.fovAfter = Math.round(g.camera.fov);
  for (const [w, slot] of [['pistol', 'pistol'], ['rifle', 'rifle']]) { p.switchTo(slot); g.input.buttons[2] = true; window.tick(40); out['fov_' + w] = Math.round(g.camera.fov); g.input.buttons[2] = false; }
  return out;
});
await shot('aim-zoom', 600);

// ---- new weapons: shotgun pellets, previews
await run('shotgun pellets', () => {
  const g = window.game, p = g.player; g.save.profile.own.variants.push('spas12', 'mp5', 'deagle', 'p90', 'striker');
  p.var.rifle = 'spas12'; p.rebuildW('rifle'); p.inv.rifle = { mag: 6, res: 24 }; p.switchTo('rifle'); window.tick(2);
  const W = g.world; const e = g.enemies.find((x) => !x.dead && x.pos.y < 1 && W.los(x.pos.x, 1.5, x.pos.z - 6, x.pos.x, 1.3, x.pos.z) && !W.inside(x.pos.x, 1, x.pos.z - 6, 0.5)) || g.enemies.find((x) => !x.dead && x.pos.y < 1), s0 = g.stats.shots, h0 = g.stats.hits;
  p.pos.set(e.pos.x, 0, e.pos.z - 6); const c = g.camera.position;
  for (let i = 0; i < 6; i++) { const cc = g.camera.position, dx = e.pos.x - cc.x, dy = e.pos.y + 1.3 - cc.y, dz = e.pos.z - cc.z; p.yaw = Math.atan2(dx, dz); p.pitch = Math.atan2(dy, Math.hypot(dx, dz)); window.tick(1); }
  const hp0 = e.hp, s1 = g.stats.shots, h1 = g.stats.hits; g.input.btnPressed[0] = true; window.tick(1);
  return { name: p.W.rifle.name, pellets: p.W.rifle.pellets, shots: g.stats.shots - s1, hits: g.stats.hits - h1, damage: Math.round(hp0 - e.hp), mag: p.inv.rifle.mag };
});
await run('weapon previews', () => { const g = window.game; g.toMenu(true); g.save.profile.credits = 9000; g.save.profile.equip.rifle = 'spas12'; g.save.profile.equip.pistol = 'deagle'; g.ui.armory('weapons', 'rifle', () => g.ui.title()); return document.querySelectorAll('#ui [data-a]').length; });
await shot('weapon-spas12', 1500);
await run('preview mp5', () => { const g = window.game; g.save.profile.equip.rifle = 'mp5'; g.ui.armory('weapons', 'rifle', () => g.ui.title()); return 1; });
await shot('weapon-mp5', 1500);
await run('preview deagle', () => { const g = window.game; g.ui.armory('weapons', 'pistol', () => g.ui.title()); return 1; });
await shot('weapon-deagle', 1500);
await run('preview p90+striker', () => { const g = window.game; g.save.profile.equip.rifle = 'striker'; g.ui.armory('weapons', 'rifle', () => g.ui.title()); return 1; });
await shot('weapon-striker', 1500);
await run('restore gear', () => { const g = window.game; const e = g.save.profile.equip; e.rifle = 'm4a1'; e.pistol = 'usp'; return 1; });


// ---- getting into a vehicle with the use key: only the driver inside is visible, not a second soldier outside
await run('enter with the E key', () => {
  const g = window.game; g.startMission(window.M('m1'), {}); g.god = true; const p = g.player;
  const bike = g.vehicles.find((v) => v.kind === 'bike'); p.pos.set(bike.pos.x + 1.4, 0, bike.pos.z); window.tick(3);
  g.input.pressed.KeyE = true; window.tick(1);
  const out = { mode: p.mode, playerVisibleAfter1: p.h.group.visible };
  window.tick(20); out.playerVisibleAfter20 = p.h.group.visible; out.riderVisible = bike.rider.group.visible;
  const seen = []; g.scene.traverse((o) => { if (o.isSkinnedMesh) { let v = true, q = o; while (q) { if (!q.visible) v = false; q = q.parent; } if (v && Math.hypot(o.getWorldPosition(o.position.clone()).x - bike.pos.x, o.getWorldPosition(o.position.clone()).z - bike.pos.z) < 8) seen.push(1); } });
  out.soldiersNearBike = seen.length;
  g.input.pressed.KeyE = true; window.tick(2); out.afterExit = { mode: p.mode, visible: p.h.group.visible };
  return out;
});


// ---- menus: every screen and every tab must fit without scrolling at 1280 x 720
await run('menu fit', () => {
  const g = window.game, ui = g.ui, bad = [], seen = [];
  g.toMenu(true); g.save.profile.credits = 5000;
  const measure = (name) => {
    const panel = document.querySelector('#ui .panel'); if (!panel) { bad.push(name + ' (no panel)'); return; }
    seen.push(name); if (panel.scrollHeight > panel.clientHeight + 2) bad.push(`${name} ${panel.scrollHeight}>${panel.clientHeight}`);
  };
  const eachTab = (name, id, fn) => { const keys = [...document.querySelectorAll(`.tabs[data-tabs="${id}"] [data-tab]`)].map((b) => b.dataset.tab); for (const k of keys) { document.querySelector(`.tabs[data-tabs="${id}"] [data-tab="${k}"]`).click(); measure(name + ':' + k); } if (fn) fn(); };
  ui.title(); measure('title');
  ui.castEditor(() => {}, true); eachTab('cast', 'cast');
  ui.select(); measure('select');
  const m = window.S.CAMPAIGN; ui.briefing(m[0]); eachTab('brief-m1', 'brief'); ui.briefing(m[4], true); eachTab('brief-m5', 'brief');
  ui.manual(() => {}); eachTab('manual', 'manual');
  ui.settings(() => {}); eachTab('settings', 'settings');
  ui.builder(); eachTab('builder', 'builder');
  for (const t of ['profile', 'weapons', 'armour', 'pack']) { ui.armory(t, 'rifle', () => {}); if (t === 'profile') eachTab('armory-profile', 'pf'); else if (t === 'weapons') eachTab('armory-weapons', 'wp'); else measure('armory-' + t); }
  ui.armory('weapons', 'sniper', () => {}); eachTab('armory-sniper', 'wp');
  ui.controls(() => {}); measure('controls');
  return { screens: seen.length, overflowing: bad };
});


// ---- graphics quality levels
await run('quality levels', () => {
  const g = window.game, out = {};
  for (const q of ['medium', 'low', 'high']) {
    g.settings.quality = q; g.applySettings(); g.startMission(window.M('m2'), {}); window.tick(20);
    g.composer.render();
    out[q] = { shadows: g.renderer.shadowMap.enabled, mapSize: g.world.sun.shadow ? g.world.sun.shadow.mapSize.x : 0, pixelRatio: g.renderer.getPixelRatio(), parked: Object.keys(g.world.custom || {}).filter((k) => k.startsWith('pk:')).length, state: g.state };
  }
  return out;
});

// ---- custom builder mission in every district
for (const loc of ['harbor', 'downtown', 'industrial', 'mountain', 'forest']) {
  await run('custom ' + loc, (l) => {
    const g = window.game;
    const def = window.S.buildCustom({ title: 'T', story: 'x', location: l, time: 'day', insertion: 'parachute', exit: 'flyout', objectives: ['fight', 'race', 'collect', 'rescue', 'destroy', 'kill'], count: 3, enemies: 1.4 });
    g.startMission(def, { approach: 'storm' }); window.tick(120); return window.info();
  }, loc);
}
await shot('custom-mountain');
console.log('ERRORS', errors.length);
for (const e of errors.slice(0, 12)) console.log(e);
await browser.close();
