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
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')));
page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE ' + m.text()); });
await page.goto(URL);
await page.waitForFunction(() => window.game, null, { timeout: 60000 });
await page.waitForTimeout(2500);
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
await page.reload(); await page.waitForFunction(() => window.game, null, { timeout: 60000 }); await page.waitForTimeout(2000);
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
