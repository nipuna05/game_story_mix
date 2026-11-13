import * as THREE from 'three';
import { Input } from './input.js';
import { Sfx } from './audio.js';
import { World } from './world.js';
import { LOCATIONS } from './locations.js';
import { FX } from './fx.js';
import { Player, WEAPONS } from './player.js';
import { Enemy, Hostage } from './enemies.js';
import { Car, Plane } from './vehicles.js';
import { MissionRun } from './mission.js';
import { Hud } from './hud.js';
import { UI } from './ui.js';
import { CAMPAIGN, DEFAULT_CAST, fill } from './story.js';
import { clamp, dist2, rng } from './util.js';
import { cmat } from './characters.js';

const SAVE_KEY = 'nightfall_protocol_save_v1';
const DIFFS = { easy: { acc: 0.7, dmg: 0.65 }, normal: { acc: 1, dmg: 1 }, hard: { acc: 1.25, dmg: 1.4 } };
const PICKUPS = {
  intel: { color: 0x4fd1c5, key: true, label: 'Evidence drive secured' }, keycard: { color: 0xffd23c, key: true, label: 'Keycard secured' },
  decoder: { color: 0xd070ff, key: true, label: 'Signal decoder secured' },
  med: { color: 0xf2f2f2, label: 'Medkit +50' }, ammo: { color: 0x6a7a3a, label: 'Ammunition' }, armor: { color: 0x4a8adf, label: 'Body armour' }, grenade: { color: 0x2a4a2a, label: 'Grenades +2' },
};
const SUPPLY_ORDER = ['med', 'ammo', 'armor', 'grenade', 'ammo', 'med'];
const SPHERES = [[1.62, 0.21, true], [1.15, 0.4, false], [0.55, 0.36, false]];
const _v = new THREE.Vector3();

function loadSave() {
  const base = { settings: { sens: 1, vol: 0.6, shadows: true, invertY: false, difficulty: 'normal' }, cast: { ...DEFAULT_CAST }, unlocked: 1, started: false, flags: {}, best: {}, custom: [], approach: 'ghost' };
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
    if (s) return { ...base, ...s, settings: { ...base.settings, ...s.settings }, cast: { ...base.cast, ...s.cast } };
  } catch { /* corrupt or unavailable storage - start fresh */ }
  return base;
}

class Game {
  constructor() {
    this.canvas = document.getElementById('c');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.camera = new THREE.PerspectiveCamera(68, 1, 0.25, 9000);
    this.save = loadSave(); this.settings = this.save.settings; this.cast = this.save.cast;
    this.input = new Input(this.canvas); this.audio = new Sfx();
    this.hud = new Hud(this); this.ui = new UI(this);
    this.state = 'menu'; this.time = 0; this.last = 0;
    this.resetLists();
    this.input.onLockLost = () => { if (this.state === 'playing') this.pause(); };
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && this.state === 'playing' && !this.input.locked) this.pause();
      if (e.code === 'KeyH' && this.state === 'playing') { this.pause(); this.ui.manual(() => this.ui.pause()); }
    });
    this.applySettings(); this.resize();
    this.backdrop(); this.ui.title();
    requestAnimationFrame((t) => this.frame(t));
  }

  resetLists() { this.enemies = []; this.hostages = []; this.vehicles = []; this.pickups = []; this.targets = []; this.grenades = []; this.interact = null; this.markerTarget = null; }
  persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.save)); } catch { /* storage may be blocked */ } }
  wipe() { Object.assign(this.save, { unlocked: 1, started: false, flags: {}, best: {} }); this.persist(); }
  newCampaign() { Object.assign(this.save, { unlocked: 1, started: true, flags: {} }); this.persist(); }
  applySettings() {
    this.audio.setVol(this.settings.vol);
    this.renderer.shadowMap.enabled = !!this.settings.shadows;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.settings.shadows ? 1.75 : 1.25));
  }
  resize() {
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.camera.aspect = window.innerWidth / window.innerHeight; this.camera.updateProjectionMatrix();
  }

  // ---------------------------------------------------------------- scene
  buildScene(location, time) {
    if (this.world) this.world.dispose();
    this.audio.quiet();
    this.scene = new THREE.Scene();
    this.resetLists();
    this.world = new World(this.scene, time, { shadows: this.settings.shadows });
    this.renderer.toneMappingExposure = this.world.theme.exposure;
    this.P = LOCATIONS[location].build(this.world, rng(location.length * 7919 + 13));
    this.world.finalize();
    this.fx = new FX(this.scene);
    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 20, 1, true), new THREE.MeshBasicMaterial({ color: 0xffc040, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false, fog: false }));
    this.beam.visible = false; this.scene.add(this.beam);
    this.spot = new THREE.SpotLight(0xfff0d0, 0, 90, 0.55, 0.6, 1.3); this.scene.add(this.spot); this.scene.add(this.spot.target);
  }
  backdrop() { this.buildScene('downtown', 'dusk'); this.camera.fov = 55; this.camera.updateProjectionMatrix(); }
  toMenu(silent) {
    this.state = 'menu'; this.input.active = false; this.input.unlock(); this.hud.show(false);
    this.mission = null; this.player = null;
    this.backdrop();
    if (!silent) this.ui.title();
  }

  // ---------------------------------------------------------------- spawning
  spawnEnemy(type, x, z, yaw, o) { const e = new Enemy(this, type, x, z, yaw, o); this.enemies.push(e); return e; }
  spawnHostage(x, z) { const h = new Hostage(this, x, z); this.hostages.push(h); return h; }
  spawnCar(x, z, yaw, kind, color) { const c = new Car(this, x, z, yaw, kind, color); this.vehicles.push(c); return c; }
  spawnPlane(x, y, z, yaw, air) { const p = new Plane(this, x, y, z, yaw, air); this.vehicles.push(p); return p; }
  spawnPickup(type, x, z) {
    const d = PICKUPS[type];
    const mesh = new THREE.Mesh(this.world.geo.box, new THREE.MeshBasicMaterial({ color: d.color }));
    mesh.scale.set(d.key ? 0.5 : 0.45, d.key ? 0.3 : 0.4, d.key ? 0.36 : 0.45);
    const pk = { type, pos: new THREE.Vector3(x, 0.9, z), mesh, taken: false, key: !!d.key, seed: Math.random() * 6 };
    mesh.position.copy(pk.pos); this.scene.add(mesh); this.pickups.push(pk); return pk;
  }
  spawnTarget(x, z, kind) {
    const grp = new THREE.Group(), u = this.world.geo.box;
    const add = (geo, color, sx, sy, sz, px, py, pz, rz) => { const m = new THREE.Mesh(geo, cmat(color)); m.scale.set(sx, sy, sz); m.position.set(px, py, pz); if (rz) m.rotation.x = rz; m.castShadow = true; grp.add(m); return m; };
    if (kind === 'uplink') {
      add(u, 0x4a525c, 2.4, 2.2, 2.4, 0, 1.1, 0); add(this.world.geo.cyl, 0x8a929c, 0.25, 3.4, 0.25, 0, 3.9, 0);
      add(this.world.geo.cone, 0xd8dde2, 2.6, 1, 2.6, 0, 5.6, 0.3, 1.9);
      this.world.solid(x, z, 2.4, 2.4, 2.2);
    } else {
      add(u, 0x3a4a3a, 2.5, 2.3, 2.2, 0, 1.45, 2.9); add(this.world.geo.cyl, 0xb0372a, 2.5, 5.2, 2.5, 0, 1.85, -0.6, Math.PI / 2);
      add(u, 0x1c1e22, 2.6, 0.5, 8, 0, 0.45, 0.4);
      this.world.solid(x, z, 2.7, 8.2, 3.1);
    }
    grp.position.set(x, 0, z); this.scene.add(grp);
    const lamp = new THREE.Mesh(this.world.geo.sph, new THREE.MeshBasicMaterial({ color: 0xff3030 })); lamp.scale.setScalar(0.45); lamp.position.set(0, kind === 'uplink' ? 2.6 : 3.5, 0); lamp.visible = false; grp.add(lamp);
    const t = { pos: new THREE.Vector3(x, 0, z), kind, state: 'idle', t: 0, beepT: 0, mesh: grp, lamp };
    this.targets.push(t); return t;
  }
  armTarget(t) {
    if (t.state !== 'idle') return;
    if (t.kind === 'uplink') { t.state = 'dead'; t.lamp.visible = true; t.lamp.material.color.setHex(0x40ff80); this.audio.blip(1200); this.hud.banner('UPLINK ACTIVE', ''); return; }
    t.state = 'armed'; t.t = 6; t.lamp.visible = true;
    this.hud.banner('CHARGE PLANTED', 'Get clear - 6 seconds');
  }
  throwGrenade(p) {
    this.camera.getWorldDirection(_v);
    const mesh = new THREE.Mesh(this.world.geo.sph, cmat(0x2a3a2a)); mesh.scale.setScalar(0.22);
    const gr = { pos: new THREE.Vector3(p.pos.x + _v.x * 0.8, p.pos.y + 1.5, p.pos.z + _v.z * 0.8), vel: new THREE.Vector3(_v.x * 17, _v.y * 17 + 5, _v.z * 17), t: 2.3, mesh };
    this.scene.add(mesh); this.grenades.push(gr);
  }

  // ---------------------------------------------------------------- mission flow
  startMission(def, opts = {}) {
    this.audio.init(); this.ui.clear();
    this.def = def; this.approach = opts.approach || 'ghost';
    const storm = this.approach === 'storm';
    this.buildScene(def.location, def.time);
    const P = this.P, r = rng(def.id.length * 131 + 7);
    this.stats = { time: 0, kills: 0, headshots: 0, takedowns: 0, shots: 0, hits: 0, alarms: 0, deaths: 0, damage: 0, detected: 0 };
    this.time = 0; this.alarm = false; this.alarmT = 0; this.alertHold = 0; this.stingT = 0; this.rescueZone = P.extract; this.god = false; this.truce = false;
    this.diff = DIFFS[this.settings.difficulty] || DIFFS.normal;
    this.mods = { view: storm ? 1 : 0.85, alarmDelay: 4 };

    const p = this.player = new Player(this);
    p.grenades = storm ? 4 : 2;
    if (storm) { p.give('rifle', 120); p.armor = 100; }
    for (const w of def.loadout || []) if (!p.inv[w]) p.give(w);
    if (p.inv.rifle && storm) p.cur = 'rifle';

    for (const c of P.cars) this.spawnCar(c.x, c.z, c.yaw, c.kind);
    this.spawnPlane(P.plane.x, 0, P.plane.z, P.plane.yaw, false);
    const ins = def.insertion;
    if (ins === 'parachute') {
      const f = P.flyStart, pl = this.spawnPlane(f.x, f.y, f.z, f.yaw, true);
      p.pos.copy(pl.pos); p.enterVehicle(pl);
    } else if (ins === 'car' || ins === 'bike') {
      const s = P.carSpawn; this.spawnCar(s.x, s.z, s.yaw, ins === 'bike' ? 'bike' : 'sedan');
      p.pos.set(s.x + Math.cos(s.yaw) * 2.8, 0, s.z - Math.sin(s.yaw) * 2.8); p.yaw = s.yaw;
    } else { p.pos.set(P.footSpawn.x, 0, P.footSpawn.z); p.yaw = P.footSpawn.yaw; }
    this.world.resolveCircle(p.pos, 0.4, 0, 1.8);

    const objectives = typeof def.objectives === 'function' ? def.objectives(this.save.flags) : def.objectives;
    this.mission = new MissionRun(this, def, objectives);
    this.mission.setup();

    const D = (def.enemies || 1) * (storm ? 1.15 : 1);
    P.guards.forEach((s, i) => { if (r() < Math.min(1, 0.72 * D)) this.spawnEnemy(i % 5 === 4 ? 'heavy' : 'guard', s.x, s.z, s.yaw); });
    P.patrols.forEach((route) => {
      const n = D > 1.1 ? 2 : 1;
      for (let k = 0; k < n; k++) { const ri = Math.floor(k * route.length / n), pt = route[ri]; this.spawnEnemy('guard', pt.x, pt.z, 0, { route, ri: (ri + 1) % route.length }); }
    });
    P.snipers.forEach((s, i) => { if (i % 2 === 0 || D > 1.1) this.spawnEnemy('sniper', s.x, s.z, s.yaw, { y: s.y }); });
    P.supplies.forEach((s, i) => this.spawnPickup(SUPPLY_ORDER[i % SUPPLY_ORDER.length], s.x, s.z));

    this.hud.reset(); this.hud.show(true);
    this.mission.start();
    this.state = 'playing'; this.input.active = true; this.input.frameEnd(); this.input.lock();
    p.camYaw = p.yaw;
    this.hud.banner(fill(def.title, this.cast).toUpperCase(), LOCATIONS[def.location].name);
  }
  pause() { if (this.state !== 'playing') return; this.state = 'paused'; this.input.active = false; this.input.unlock(); this.audio.quiet(); this.ui.pause(); }
  resume() { this.ui.clear(); this.state = 'playing'; this.input.active = true; this.input.frameEnd(); this.input.lock(); if (this.alarm) this.audio.alarm(true); }
  fail(reason) {
    if (this.state !== 'playing') return;
    this.state = 'over'; this.overT = 1.6; this.audio.quiet(); this.audio.lose();
    const t = this.mission.cur ? this.mission.cur.type : '';
    this.pendingUI = () => this.ui.fail(reason, t !== 'fly' && t !== 'land' && t !== 'flyout' && !!this.mission.checkpoint);
  }
  continueCheckpoint() {
    const cp = this.mission.checkpoint, p = this.player, o = this.mission.cur;
    this.ui.clear(); this.stats.deaths++;
    p.revive(cp.x, cp.z); this.world.resolveCircle(p.pos, 0.4, 0, 1.8);
    for (const e of this.enemies) if (!e.dead && !e.neutral) { e.calm(); e.sees = false; }
    this.alarm = false; this.alertHold = 0; this.audio.alarm(false);
    if (o) { if (o.timeLimit) o.st.t = o.timeLimit; if (o.type === 'race') this.mission.resetRace(o); if (o.type === 'fight' && o.st.started) for (const t of o.st.thugs) if (!t.dead) t.alert(p.targetPos()); }
    this.hud.reset(); this.hud.show(true);
    this.state = 'playing'; this.input.active = true; this.input.frameEnd(); this.input.lock();
  }
  missionComplete() {
    if (this.state !== 'playing') return;
    this.state = 'over'; this.overT = 2.2; this.audio.quiet(); this.audio.win();
    const st = this.stats, n = this.mission.objs.length;
    st.time = this.time;
    const score = Math.max(0, Math.round(n * 1000 + Math.max(0, 1500 - st.time * 2) + (st.alarms === 0 ? 1500 : 0) + (st.shots ? (st.hits / st.shots) * 500 : 250) + st.takedowns * 100 + st.headshots * 50 - st.deaths * 600));
    const k = score / (n * 1000 + 3500), rank = k >= 0.82 ? 'S' : k >= 0.68 ? 'A' : k >= 0.5 ? 'B' : 'C';
    const def = this.def, idx = CAMPAIGN.indexOf(def);
    if (idx >= 0) {
      this.save.unlocked = Math.max(this.save.unlocked, idx + 2); this.save.started = true;
      const b = this.save.best[def.id];
      if (!b || score > b.score) this.save.best[def.id] = { score, rank };
      this.persist();
    }
    this.hud.banner('MISSION COMPLETE', '');
    this.pendingUI = () => this.ui.debrief({ stats: st, score, rank });
  }

  // ---------------------------------------------------------------- combat helpers
  shootRay(o, d, maxT, tMin, info) {
    const tw = tMin + this.world.raycast(o.x + d.x * tMin, o.y + d.y * tMin, o.z + d.z * tMin, d.x, d.y, d.z, maxT - tMin);
    let best = null, bt = tw, head = false;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const ex = e.pos.x - o.x, ez = e.pos.z - o.z;
      const along = ex * d.x + ez * d.z + (e.pos.y + 1 - o.y) * d.y;
      if (along < tMin - 1 || along > bt + 1) continue;
      for (const [yo, r, hd] of SPHERES) {
        const cy = e.pos.y + yo - o.y, tca = ex * d.x + cy * d.y + ez * d.z;
        if (tca < 0) continue;
        const d2 = ex * ex + cy * cy + ez * ez - tca * tca;
        if (d2 > r * r) continue;
        const t = tca - Math.sqrt(r * r - d2);
        if (t > tMin && t < bt) { bt = t; best = e; head = hd; }
      }
    }
    const pt = new THREE.Vector3(o.x + d.x * bt, o.y + d.y * bt, o.z + d.z * bt);
    if (best) {
      best.damage(info.dmg * (head ? 2.5 : 1), { from: 'player', head });
      this.stats.hits++; if (head && best.dead) this.stats.headshots++;
      this.fx.sparks(pt, 0xb01818, 6, 2.5, 0.3, 0.09);
      this.hud.hitMark(best.dead);
    } else if (tw < maxT) this.fx.sparks(pt, 0xd8d0b8, 4, 3, 0.25, 0.07);
    return pt;
  }
  explode(pos, r, dmg) {
    const p = this.player;
    this.fx.explosion(pos, r * 0.8);
    this.audio.explosion(clamp(1.25 - pos.distanceTo(p.pos) / 160, 0, 1));
    for (const e of this.enemies) { if (e.dead) continue; const d = e.pos.distanceTo(pos); if (d < r) e.damage(dmg * (1 - d / r) + 25, { from: 'player', explosion: true }); }
    for (const v of this.vehicles) { if (v.dead || v.type !== 'car') continue; const d = v.pos.distanceTo(pos); if (d < r) v.hit(dmg * (1 - d / r)); }
    const dp = p.pos.distanceTo(pos);
    if (dp < r && !p.vehicle) p.damage(dmg * 0.5 * (1 - dp / r), pos, 'explosion');
    this.emitNoise(pos, 130, true);
  }
  emitNoise(pos, radius, loud) { for (const e of this.enemies) if (!e.dead && dist2(e.pos.x, e.pos.z, pos.x, pos.z) < radius) e.hear(pos, loud); }
  shout(from, radius, tp) { for (const e of this.enemies) if (e !== from && !e.dead && !e.alerted && dist2(e.pos.x, e.pos.z, from.pos.x, from.pos.z) < radius) e.hear(tp, true); }
  onEnemyAlert(e) {
    this.shout(e, 28, e.last); this.stats.detected++;
    if (this.stingT <= 0 && !e.noAlarm) { this.stingT = 3; this.audio.sting(); }
  }
  onEnemyKilled(e, info) {
    if (info.from === 'player') this.stats.kills++;
    if (!info.silent) this.emitNoise(e.pos, 12, false);
    if (e.pos.y < 1 && !e.noAlarm) { const k = Math.random(); if (k < 0.4) this.spawnPickup('ammo', e.pos.x, e.pos.z); else if (k < 0.52) this.spawnPickup('med', e.pos.x, e.pos.z); }
  }
  findInteract() {
    const p = this.player; let best = null, bd = 1e9;
    for (const v of this.vehicles) {
      if (v.dead || v.locked || v.autopilot || (v.type === 'plane' && v.airborne)) continue;
      const d = dist2(v.pos.x, v.pos.z, p.pos.x, p.pos.z);
      if (d < (v.type === 'plane' ? 6.5 : v.r + 2.3) && d < bd) { bd = d; best = { obj: v, text: `[E] ${v.type === 'plane' ? 'Fly aircraft' : v.kind === 'bike' ? 'Ride motorbike' : 'Drive ' + v.name.toLowerCase()}`, act: () => p.enterVehicle(v) }; }
    }
    for (const h of this.hostages) {
      if (h.state !== 'captive') continue;
      const d = dist2(h.pos.x, h.pos.z, p.pos.x, p.pos.z) - 2;
      if (d < 0.8 && d < bd) { bd = d; best = { obj: h, hold: 1.1, text: 'Hold [E] Cut them free', act: () => { h.free(); this.audio.blip(700); this.hud.banner('HOSTAGE FREED', 'They will follow you'); } }; }
    }
    for (const t of this.targets) {
      if (t.state !== 'idle') continue;
      const d = dist2(t.pos.x, t.pos.z, p.pos.x, p.pos.z) - 2;
      if (d < 3.6 && d < bd) { bd = d; best = { obj: t, hold: 1.5, text: t.kind === 'uplink' ? 'Hold [E] Plant uplink' : 'Hold [E] Plant charge', act: () => this.armTarget(t) }; }
    }
    return best;
  }

  // ---------------------------------------------------------------- loop
  frame(t) {
    requestAnimationFrame((n) => this.frame(n));
    const dt = Math.min(0.05, (t - this.last) / 1000 || 0.016); this.last = t;
    if (this.state === 'playing') this.update(dt);
    else if (this.state === 'over') {
      this.fx.update(dt); if (this.player && this.player.dead) this.player.update(dt); for (const e of this.enemies) if (e.dead) e.update(dt);
      this.overT -= dt;
      if (this.overT <= 0 && this.pendingUI) { this.input.active = false; this.input.unlock(); this.hud.show(false); const f = this.pendingUI; this.pendingUI = null; f(); }
    } else if (this.state === 'menu') {
      const a = t * 0.00004;
      this.camera.position.set(Math.cos(a) * 360, 95, Math.sin(a) * 360); this.camera.lookAt(120, 50, 120);
      this.world.update(this.camera.position);
    }
    this.renderer.render(this.scene, this.camera);
    this.input.frameEnd();
  }

  update(dt) {
    const p = this.player, w = this.world;
    this.time += dt; this.stingT -= dt;
    p.update(dt);
    for (const v of this.vehicles) v.update(dt);
    // vehicles push each other apart
    for (let i = 0; i < this.vehicles.length; i++) for (let j = i + 1; j < this.vehicles.length; j++) {
      const a = this.vehicles[i], b = this.vehicles[j];
      if (a.type !== 'car' || b.type !== 'car' || (a.speed === 0 && b.speed === 0)) continue;
      const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z, d = Math.hypot(dx, dz), R = a.r + b.r;
      if (d < R && d > 0.01) {
        const push = (R - d) / 2, nx = dx / d, nz = dz / d, am = a.dead || a.frozen ? 0 : 1, bm = b.dead || b.frozen ? 0 : 1;
        a.pos.x -= nx * push * am; a.pos.z -= nz * push * am; b.pos.x += nx * push * bm; b.pos.z += nz * push * bm;
        a.speed *= 0.97; b.speed *= 0.97;
      }
    }
    p.syncVehicle();
    for (const e of this.enemies) e.update(dt);
    for (let i = 0; i < this.enemies.length; i++) {
      const a = this.enemies[i]; if (a.dead || a.def.static) continue;
      for (let j = i + 1; j < this.enemies.length; j++) {
        const b = this.enemies[j]; if (b.dead || b.def.static) continue;
        const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z, d2 = dx * dx + dz * dz;
        if (d2 < 0.64 && d2 > 1e-4) { const d = Math.sqrt(d2), k = (0.8 - d) / 2 / d; a.pos.x -= dx * k; a.pos.z -= dz * k; b.pos.x += dx * k; b.pos.z += dz * k; }
      }
    }
    for (const h of this.hostages) h.update(dt);
    this.updateItems(dt);
    this.mission.update(dt);
    if (this.state !== 'playing') { this.hud.update(dt); return; }

    // alarm logic
    let anyAlert = false;
    for (const e of this.enemies) if (!e.dead && e.alerted && !e.noAlarm) { anyAlert = true; break; }
    if (anyAlert) {
      this.alertHold += dt; this.alarmT = 0;
      if (!this.alarm && this.alertHold > this.mods.alarmDelay) {
        this.alarm = true; this.stats.alarms++; this.audio.alarm(true);
        this.hud.banner('ALARM RAISED', 'Reinforcements are converging on you');
        for (const e of this.enemies) if (!e.dead && !e.noAlarm && dist2(e.pos.x, e.pos.z, p.pos.x, p.pos.z) < 120) e.hear(p.pos, true);
      }
    } else {
      this.alertHold = 0;
      if (this.alarm) { this.alarmT += dt; if (this.alarmT > 20) { this.alarm = false; this.audio.alarm(false); this.hud.radio(fill('{hacker}', this.cast), 'They have lost you. Alarm is winding down.'); } }
    }

    // objective marker + light beam
    const t = this.markerTarget = this.mission.target();
    if (t) { const r = t.r || 1.2; this.beam.visible = true; this.beam.position.set(t.x, 150, t.z); this.beam.scale.set(r, 300, r); } else this.beam.visible = false;

    // headlight for night driving
    const v = p.vehicle;
    if (v && v.type === 'car' && w.theme.lit !== 0) {
      const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw);
      this.spot.intensity = 2600; this.spot.position.set(v.pos.x + fx * 1.5, 1.4, v.pos.z + fz * 1.5); this.spot.target.position.set(v.pos.x + fx * 30, 0, v.pos.z + fz * 30);
    } else this.spot.intensity = 0;

    // looping audio
    if (v && v.type === 'car') this.audio.engine(1, Math.abs(v.speed) / v.max, v.kind === 'bike' ? 85 : 55);
    else if (v && v.type === 'plane') this.audio.engine(1, v.throttle, 75);
    else this.audio.engine(0);
    this.audio.wind(p.mode === 'fall' ? 1 : p.mode === 'chute' ? 0.4 : p.mode === 'plane' ? 0.3 : 0);

    this.fx.update(dt);
    p.updateCamera(dt);
    w.update(p.vehicle ? p.vehicle.pos : p.pos);
    this.camera.updateMatrixWorld();
    this.hud.update(dt);
  }

  updateItems(dt) {
    const p = this.player, w = this.world;
    for (const k of this.pickups) {
      if (k.taken) continue;
      k.mesh.rotation.y += dt * 2; k.mesh.position.y = k.pos.y + Math.sin(this.time * 2.5 + k.seed) * 0.12;
      if (p.mode !== 'foot' || p.dead || Math.abs(p.pos.y - 0) > 2.5 || dist2(k.pos.x, k.pos.z, p.pos.x, p.pos.z) > 1.7) continue;
      const d = PICKUPS[k.type];
      if (k.type === 'med') { if (p.hp >= 100) continue; p.hp = Math.min(100, p.hp + 50); }
      else if (k.type === 'armor') { if (p.armor >= 100) continue; p.armor = 100; }
      else if (k.type === 'ammo') { for (const n of ['pistol', 'rifle', 'sniper']) if (p.inv[n]) p.inv[n].res += WEAPONS[n].mag; }
      else if (k.type === 'grenade') p.grenades += 2;
      k.taken = true; this.scene.remove(k.mesh); k.mesh.material.dispose();
      this.audio.blip(d.key ? 880 : 620);
      if (d.key) this.hud.banner(d.label.toUpperCase(), '');
    }
    for (const t of this.targets) {
      if (t.state !== 'armed') continue;
      t.t -= dt; t.beepT -= dt;
      if (t.beepT <= 0) { t.beepT = Math.max(0.12, t.t / 8); t.lamp.visible = !t.lamp.visible; this.audio.beep(1500); }
      if (t.t <= 0) {
        t.state = 'dead'; t.lamp.visible = false;
        t.mesh.traverse((o) => { if (o.isMesh) o.material = cmat(0x141414); }); t.mesh.scale.y = 0.6;
        this.explode(new THREE.Vector3(t.pos.x, 1.5, t.pos.z), 15, 230);
      }
    }
    for (let i = this.grenades.length - 1; i >= 0; i--) {
      const g = this.grenades[i];
      g.vel.y -= 20 * dt;
      const ox = g.pos.x, oz = g.pos.z;
      g.pos.addScaledVector(g.vel, dt);
      if (g.pos.y < 0.15) { g.pos.y = 0.15; g.vel.y *= -0.35; g.vel.x *= 0.6; g.vel.z *= 0.6; }
      if (w.inside(g.pos.x, g.pos.y, g.pos.z)) { g.pos.x = ox; g.pos.z = oz; g.vel.x *= -0.35; g.vel.z *= -0.35; }
      g.mesh.position.copy(g.pos);
      g.t -= dt;
      if (g.t <= 0) { this.scene.remove(g.mesh); this.grenades.splice(i, 1); this.explode(g.pos.clone(), 9, 170); }
    }
  }
}

window.game = new Game();
