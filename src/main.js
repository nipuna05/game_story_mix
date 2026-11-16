import * as THREE from 'three';
import { Input } from './input.js';
import { Sfx } from './audio.js';
import { World } from './world.js';
import { LOCATIONS } from './locations.js';
import { FX } from './fx.js';
import { Player } from './player.js';
import { VARIANTS, ARMORS, PACK_ITEMS, MAX_GRENADES, defaultProfile, mergeProfile, clampCarry, capOf } from './gear.js';
import { Enemy, Hostage } from './enemies.js';
import { Car, Plane } from './vehicles.js';
import { MissionRun } from './mission.js';
import { Hud } from './hud.js';
import { Music } from './music.js';
import { UI } from './ui.js';
import { CAMPAIGN, DEFAULT_CAST, fill } from './story.js';
import { clamp, dist2, rng } from './util.js';
import { cmat, makeGun, makeHumanoid, animateHumanoid } from './characters.js';
import { loadAssets } from './assets.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

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
  const base = { settings: { sens: 1, vol: 0.6, bright: 1.3, music: 0.6, shadows: true, invertY: false, difficulty: 'normal', keys: {} }, profile: defaultProfile(), cast: { ...DEFAULT_CAST }, unlocked: 1, started: false, flags: {}, best: {}, custom: [], approach: 'ghost' };
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
    if (s) return { ...base, ...s, settings: { ...base.settings, ...s.settings }, cast: { ...base.cast, ...s.cast }, profile: mergeProfile(s.profile) };
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
    // post-processing: HDR render -> bloom -> tone mapping
    this.composer = new EffectComposer(this.renderer, new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 }));
    this.renderPass = new RenderPass(new THREE.Scene(), this.camera);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.6, 0.55, 1.0);
    this.composer.addPass(this.renderPass); this.composer.addPass(this.bloom); this.composer.addPass(new OutputPass());
    this.save = loadSave(); this.settings = this.save.settings; this.cast = this.save.cast;
    this.input = new Input(this.canvas); this.audio = new Sfx(); this.music = new Music(this.audio); this.input.setBindings(this.settings.keys);
    this.initPreview();
    this.hud = new Hud(this); this.ui = new UI(this);
    this.state = 'menu'; this.time = 0; this.last = 0;
    this.resetLists();
    this.input.onLockLost = () => { if (this.state === 'playing') this.pause(); };
    // never keep the mouse captured when the window loses focus, the tab is hidden or the page closes
    const release = () => { if (this.state === 'playing') this.pause(); this.input.unlock(); };
    window.addEventListener('blur', release);
    window.addEventListener('pagehide', () => this.input.unlock());
    window.addEventListener('beforeunload', () => this.input.unlock());
    document.addEventListener('visibilitychange', () => { if (document.hidden) release(); });
    document.addEventListener('pointerlockerror', () => { if (this.state === 'playing') this.pause(); });
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && this.state === 'playing' && !this.input.locked) this.pause();
      if (this.input.mapCode(e.code) === 'KeyM' && !(e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName || ''))) {
        const off = this.audio.toggleMute(); this.music.refreshMute(); if (this.state === 'playing') this.hud.banner(off ? 'SOUND OFF' : 'SOUND ON', '');
      }
      if (this.input.mapCode(e.code) === 'KeyB' && this.state === 'playing') { // quick brightness: cycle through 5 levels
        const L = [0.8, 1, 1.3, 1.7, 2.2], i = L.findIndex((v) => v >= this.settings.bright - 0.01);
        this.settings.bright = L[(i + 1) % L.length]; this.applySettings(); this.persist();
        this.hud.banner('BRIGHTNESS ' + (((i + 1) % L.length) + 1) + '/5', 'Press B to change');
      }
      if (this.input.mapCode(e.code) === 'KeyH' && this.state === 'playing') { this.pause(); this.ui.manual(() => this.ui.pause()); }
    });
    this.applySettings(); this.resize();
    this.backdrop(); this.ui.title();
    requestAnimationFrame((t) => this.frame(t));
  }

  resetLists() { this.racePath = null; this.enemies = []; this.hostages = []; this.vehicles = []; this.pickups = []; this.targets = []; this.grenades = []; this.interact = null; this.markerTarget = null; }
  persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.save)); } catch { /* storage may be blocked */ } }
  wipe() { Object.assign(this.save, { unlocked: 1, started: false, flags: {}, best: {} }); this.persist(); }
  newCampaign() { Object.assign(this.save, { unlocked: 1, started: true, flags: {} }); this.persist(); }
  applySettings() {
    this.music.setVolume(this.settings.music ?? 0.6);
    if (this.world) this.renderer.toneMappingExposure = this.world.theme.exposure * (this.settings.bright || 1);
    this.audio.setVol(this.settings.vol);
    this.renderer.shadowMap.enabled = !!this.settings.shadows;
    const pr = Math.min(window.devicePixelRatio || 1, this.settings.shadows ? 1.5 : 1.25);
    this.renderer.setPixelRatio(pr); this.composer.setPixelRatio(pr); this.composer.setSize(window.innerWidth, window.innerHeight);
  }
  resize() {
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.composer.setSize(window.innerWidth, window.innerHeight);
    this.camera.aspect = window.innerWidth / window.innerHeight; this.camera.updateProjectionMatrix();
  }

  // ---------------------------------------------------------------- scene
  buildScene(location, time) {
    if (this.world) this.world.dispose();
    this.audio.quiet();
    this.scene = new THREE.Scene();
    this.resetLists();
    this.world = new World(this.scene, time, { shadows: this.settings.shadows, renderer: this.renderer });
    this.renderer.toneMappingExposure = this.world.theme.exposure * (this.settings.bright || 1);
    this.renderPass.scene = this.scene; this.bloom.strength = this.world.theme.bloom;
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
    if (d.key) mesh.material.color.multiplyScalar(2.2);
    mesh.scale.set(d.key ? 0.5 : 0.45, d.key ? 0.3 : 0.4, d.key ? 0.36 : 0.45);
    const pk = { type, pos: new THREE.Vector3(x, 0.9, z), mesh, taken: false, key: !!d.key, seed: Math.random() * 6 };
    mesh.position.copy(pk.pos); this.scene.add(mesh); this.pickups.push(pk); return pk;
  }
  spawnTarget(x, z, kind) {
    const grp = new THREE.Group(), u = this.world.geo.box;
    const add = (geo, color, sx, sy, sz, px, py, pz, rz) => { const m = new THREE.Mesh(geo, cmat(color)); m.scale.set(sx, sy, sz); m.position.set(px, py, pz); if (rz) m.rotation.x = rz; m.castShadow = true; grp.add(m); return m; };
    if (kind === 'uplink' || kind === 'jammer') {
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
  throwGrenade(p, kind = 'frag') {
    this.audio.throwNade();
    this.camera.getWorldDirection(_v);
    const mesh = new THREE.Mesh(this.world.geo.sph, cmat(kind === 'noise' ? 0xffb020 : 0x2a3a2a)); mesh.scale.setScalar(0.22);
    const gr = { pos: new THREE.Vector3(p.pos.x + _v.x * 0.8, p.pos.y + 1.5, p.pos.z + _v.z * 0.8), vel: new THREE.Vector3(_v.x * 17, _v.y * 17 + 5, _v.z * 17), t: kind === 'noise' ? 1.6 : 2.3, mesh, kind };
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

    const prof = this.save.profile;
    clampCarry(prof);
    const p = this.player = new Player(this);
    p.grenades = storm ? 4 : 2;
    p.armor = Math.max(storm ? 100 : 0, (ARMORS[prof.equip.armor] || ARMORS[0]).start);
    p.pack = { ...prof.carry }; p.packStock = { ...prof.carry }; p.packCap = capOf(prof);
    if (storm) p.give('rifle', 120);
    for (const w of def.loadout || []) if (!p.inv[w]) p.give(w);
    if (p.inv.rifle && storm) p.cur = 'rifle';

    for (const c of P.cars) this.spawnCar(c.x, c.z, c.yaw, c.kind);
    this.spawnPlane(P.plane.x, 0, P.plane.z, P.plane.yaw, false);
    const ins = def.insertion;
    if (ins === 'parachute') {
      const f = P.flyStart, pl = this.spawnPlane(f.x, f.y, f.z, f.yaw, true);
      p.pos.copy(pl.pos); p.enterVehicle(pl);
    } else if (ins === 'boat' && P.boatSpawn) {
      const s = P.boatSpawn, bt = this.spawnCar(s.x, s.z, s.yaw, 'boat');
      p.pos.copy(bt.pos); p.enterVehicle(bt);
    } else if (ins === 'car' || ins === 'bike' || ins === 'boat') {
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
    P.supplies.forEach((s, i) => { if (i % 4 === 2) this.spawnRack(s.x, s.z, 0, 1); else this.spawnPickup(SUPPLY_ORDER[i % SUPPLY_ORDER.length], s.x, s.z); });
    this.world.interiors.forEach((s, i) => {
      if (i % 2 === 0) this.spawnPickup(SUPPLY_ORDER[(i >> 1) % SUPPLY_ORDER.length], s.x, s.z);
      if (i % 3 === 1) { const n = s.door, hn = n.nx ? s.w / 2 : s.d / 2; this.spawnRack(s.cx - n.nx * (hn - 1.0), s.cz - n.nz * (hn - 1.0), n.nx, n.nz); }
    });

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
    this.save.profile.totals.deaths++; this.persist();
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
    const prof = this.save.profile, t = prof.totals, credits = Math.round(score / 6);
    prof.credits += credits; prof.xp += score; t.missions++; t.kills += st.kills; t.headshots += st.headshots; t.takedowns += st.takedowns;
    t.deaths += st.deaths; t.alarms += st.alarms; t.playSec += Math.round(st.time); t.shots += st.shots; t.hits += st.hits; t.earned += credits;
    this.persist();
    const def = this.def, idx = CAMPAIGN.indexOf(def);
    if (idx >= 0) {
      this.save.unlocked = Math.max(this.save.unlocked, idx + 2); this.save.started = true;
      const b = this.save.best[def.id];
      if (!b || score > b.score) this.save.best[def.id] = { score, rank };
      this.persist();
    }
    this.hud.banner('MISSION COMPLETE', '');
    this.pendingUI = () => this.ui.debrief({ stats: st, score, rank, credits });
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
      { const sp = this.spatial(best.pos, 220); this.audio.hitTick(best.dead); this.audio.impact('body', 0.55 * sp.vol, sp.pan); }
      this.fx.sparks(pt, 0xb01818, 6, 2.5, 0.3, 0.09);
      this.hud.hitMark(best.dead);
    } else if (tw < maxT) { this.fx.sparks(pt, 0xd8d0b8, 4, 3, 0.25, 0.07); const sp = this.spatial(pt, 220); this.audio.impact('wall', 0.5 * sp.vol, sp.pan, 'stone'); }
    return pt;
  }
  explode(pos, r, dmg) {
    const p = this.player;
    this.fx.explosion(pos, r * 0.8);
    this.audio.explosion(clamp(1.25 - pos.distanceTo(p.pos) / 160, 0, 1), this.spatial(pos, 220).pan);
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
    if (e.def.gun && !e.noAlarm) {
      const roll = Math.random();
      const vid = e.type === 'guard' ? (roll < 0.55 ? 'ak47' : roll < 0.8 ? 'mp5' : roll < 0.92 ? 'spas12' : 'deagle') : e.type === 'heavy' ? (roll < 0.5 ? 'm4a1' : roll < 0.8 ? 'striker' : 'p90') : { sniper: 'l118a', boss: 'ak47' }[e.type];
      if (vid) { const v = VARIANTS[vid]; this.dropWeapon(vid, Math.max(3, Math.round(v.mag * (0.25 + Math.random() * 0.5))), v.mag, e.pos.x + (e.def.static ? 3.4 : 0), e.pos.z); }
    }
    if (e.pos.y < 1 && !e.noAlarm) { const k = Math.random(); if (k < 0.4) this.spawnPickup('ammo', e.pos.x, e.pos.z); else if (k < 0.52) this.spawnPickup('med', e.pos.x, e.pos.z); }
  }
  // glowing arrows laid along the road for the current race, plus rings at the next two checkpoints
  updateRacePath() {
    const o = this.mission.cur, s = o && o.type === 'race' && o.st.cps ? o.st : null;
    if (!s) { if (this.racePath) { this.scene.remove(this.racePath.group); this.racePath.geo.dispose(); this.racePath.ringGeo.dispose(); this.racePath = null; } return; }
    if (!this.racePath || this.racePath.s !== s) {
      const R = this.P.race, seq = [R[0], ...s.cps], dashes = [];
      for (let i = 0; i < s.cps.length; i++) {
        const a = seq[i], b = seq[i + 1], L = Math.hypot(b.x - a.x, b.z - a.z), yaw = Math.atan2(b.x - a.x, b.z - a.z);
        for (let d = 8; d < L - 10; d += 7) dashes.push({ i, x: a.x + (b.x - a.x) * d / L, z: a.z + (b.z - a.z) * d / L, yaw });
      }
      const geo = new THREE.BoxGeometry(0.9, 0.05, 3.4), mat = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false });
      const im = new THREE.InstancedMesh(geo, mat, Math.max(1, dashes.length)); im.frustumCulled = false;
      const ringGeo = new THREE.RingGeometry(7.2, 9, 44).rotateX(-Math.PI / 2);
      const rings = [0, 1].map((k) => { const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: k ? 0xffb23e : 0x4fd1c5, transparent: true, opacity: 0.9, fog: false, depthWrite: false, side: THREE.DoubleSide })); m.material.color.multiplyScalar(2.4); m.position.y = 0.2; return m; });
      const group = new THREE.Group(); group.add(im, ...rings); this.scene.add(group);
      this.racePath = { s, im, dashes, rings, group, geo, ringGeo, cp: -1 };
    }
    const rp = this.racePath, n = s.cps.length;
    if (rp.cp !== s.cp) {   // re-colour only when the target checkpoint changes
      rp.cp = s.cp;
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), c = new THREE.Color();
      rp.dashes.forEach((d, k) => {
        const hide = d.i < s.cp || d.i > s.cp + 3;
        e.set(0, d.yaw, 0); q.setFromEuler(e);
        m.compose(new THREE.Vector3(d.x, 0.12, d.z), q, new THREE.Vector3(hide ? 0 : 1, 1, hide ? 0 : 1)); rp.im.setMatrixAt(k, m);
        rp.im.setColorAt(k, d.i === s.cp ? c.setRGB(0.4, 2.6, 2.4) : c.setRGB(2.6, 1.6, 0.3));
      });
      rp.im.instanceMatrix.needsUpdate = true; if (rp.im.instanceColor) rp.im.instanceColor.needsUpdate = true;
    }
    for (let k = 0; k < 2; k++) {
      const cpk = s.cps[s.cp + k], r = rp.rings[k];
      r.visible = !!cpk && (s.state === 'run' || s.state === 'count' || s.state === 'wait');
      if (cpk) { r.position.x = cpk.x; r.position.z = cpk.z; r.scale.setScalar(1 + Math.sin(this.time * 4 + k) * 0.06); }
    }
    void n;
  }

  // ---------------------------------------------------------------- guns on the ground, racks, previews
  spawnWeapon(vid, mag, res, x, z) {
    const v = VARIANTS[vid], grp = new THREE.Group(), gun = makeGun(v.model);
    gun.rotation.y = Math.PI / 2; gun.rotation.z = 0.15; grp.add(gun);
    const ring = new THREE.Mesh(this.world.geo.plane, new THREE.MeshBasicMaterial({ color: 0x4fd1c5, map: this.world.radial(), transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    ring.material.color.multiplyScalar(1.8); ring.scale.set(2.6, 1, 2.6); ring.position.y = -0.85; grp.add(ring);
    const pk = { type: 'weapon', variant: vid, mag, res, pos: new THREE.Vector3(x, 0.9, z), mesh: grp, taken: false, key: false, seed: Math.random() * 6 };
    grp.position.copy(pk.pos); this.scene.add(grp); this.pickups.push(pk); return pk;
  }
  dropWeapon(vid, mag, res, x, z) { return this.spawnWeapon(vid, mag, res, x, z); }
  takeWeaponPickup(k) {
    const p = this.player, old = p.takeWeapon(k.variant, k.mag, k.res);
    k.taken = true; this.scene.remove(k.mesh); k.mesh.traverse((o) => { if (o.material && o.material.map) o.material.dispose(); });
    if (old) this.spawnWeapon(old.variant, old.mag, old.res, p.pos.x + Math.sin(p.yaw) * 1.3, p.pos.z + Math.cos(p.yaw) * 1.3);
  }
  // a weapon rack: guns and supplies on a shelf. (fx, fz) is the direction it faces.
  spawnRack(x, z, fx, fz) {
    const u = this.world.geo.box, wood = cmat(0x5a4630), grp = new THREE.Group(), r = Math.atan2(fx, fz);
    const add = (sx, sy, sz, px, py, pz) => { const m = new THREE.Mesh(u, wood); m.scale.set(sx, sy, sz); m.position.set(px, py, pz); m.castShadow = true; grp.add(m); };
    add(2.6, 0.12, 0.5, 0, 0.6, 0); add(2.6, 0.12, 0.5, 0, 1.3, 0); add(0.12, 1.7, 0.5, -1.3, 0.85, 0); add(0.12, 1.7, 0.5, 1.3, 0.85, 0); add(2.6, 1.7, 0.08, 0, 0.85, -0.25);
    grp.position.set(x, 0, z); grp.rotation.y = r; this.scene.add(grp);
    const alongX = Math.abs(fz) > 0.5;
    this.world.solid(x, z, alongX ? 2.7 : 0.7, alongX ? 0.7 : 2.7, 1.8);
    const at = (lx, lz) => [x + lx * Math.cos(r) + lz * Math.sin(r), z - lx * Math.sin(r) + lz * Math.cos(r)];
    const stock = ['glock', 'ak47', 'm4a1', 'mp5', 'spas12', 'deagle', 'p90', 'striker', 'l118a'], pick = () => stock[Math.floor(Math.random() * stock.length)];
    for (const lx of [-0.6, 0.6]) { const vid = pick(), v = VARIANTS[vid], [px, pz] = at(lx, 0.9); this.spawnWeapon(vid, v.mag, v.mag * 2, px, pz); }
    let [px, pz] = at(-1.15, 0.9); this.spawnPickup('ammo', px, pz);
    [px, pz] = at(1.15, 0.9); this.spawnPickup(Math.random() < 0.5 ? 'med' : 'armor', px, pz);
  }
  initPreview() {
    this.pscene = new THREE.Scene();
    this.pscene.add(new THREE.HemisphereLight(0xcfdcff, 0x40403a, 2.4));
    const dl = new THREE.DirectionalLight(0xffffff, 3.2); dl.position.set(2, 4, 3); this.pscene.add(dl);
    const rim = new THREE.DirectionalLight(0x6f8cff, 2.2); rim.position.set(-3, 2, -3); this.pscene.add(rim);
    this.pscene.add(new THREE.Mesh(new THREE.CircleGeometry(1.3, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x0c1118, transparent: true, opacity: 0.75 })));
    this.pcam = new THREE.PerspectiveCamera(28, 1, 0.1, 40);
    this.pFig = null; this.pSig = ''; this.previewOn = false;
  }
  // cfg: { tint, model, finish, supp } - the soldier shown beside the armory screens
  setPreview(cfg) {
    const sig = JSON.stringify(cfg);
    if (sig === this.pSig && this.pFig) return;
    this.pSig = sig;
    if (this.pFig) this.pscene.remove(this.pFig.group);
    this.pFig = makeHumanoid({ tint: cfg.tint, gun: true, gunKind: cfg.model, gunOpts: { finish: cfg.finish, supp: cfg.supp } });
    this.pFig.group.rotation.y = 0.6;
    this.pscene.add(this.pFig.group);
  }
  renderPreview(dt) {
    const r = this.renderer, W = window.innerWidth, H = window.innerHeight, vx = Math.round(W * 0.56), vw = W - vx;
    if (this.previewSpin !== false) this.pFig.group.rotation.y += dt * 0.5;
    animateHumanoid(this.pFig, { speed: 0, aim: true, pitch: 0 }, dt);
    this.pcam.aspect = vw / H; this.pcam.position.set(0, 1.4, 5.4); this.pcam.lookAt(0, 0.95, 0); this.pcam.updateProjectionMatrix();
    r.autoClear = false; r.setScissorTest(true); r.setViewport(vx, 0, vw, H); r.setScissor(vx, 0, vw, H);
    r.clearDepth(); r.render(this.pscene, this.pcam);
    r.setScissorTest(false); r.setViewport(0, 0, W, H); r.autoClear = true;
  }
  useStock(kind) {
    const pr = this.save.profile;
    pr.stock[kind] = Math.max(0, (pr.stock[kind] | 0) - 1);
    pr.carry[kind] = Math.min(pr.carry[kind] | 0, pr.stock[kind]);
    this.persist();
  }

  findInteract() {
    const p = this.player; let best = null, bd = 1e9;
    for (const v of this.vehicles) {
      if (v.dead || v.locked || v.autopilot || (v.type === 'plane' && v.airborne)) continue;
      const d = dist2(v.pos.x, v.pos.z, p.pos.x, p.pos.z);
      if (d < (v.type === 'plane' ? 6.5 : v.r + 2.3) && d < bd) { bd = d; best = { obj: v, text: `[${this.input.label('KeyE')}] ${v.type === 'plane' ? 'Fly aircraft' : v.kind === 'bike' ? 'Ride motorbike' : 'Drive ' + v.name.toLowerCase()}`, act: () => p.enterVehicle(v) }; }
    }
    if (!p.lockFists) for (const k of this.pickups) {
      if (k.taken || k.type !== 'weapon') continue;
      const d = dist2(k.pos.x, k.pos.z, p.pos.x, p.pos.z);
      if (d < 2.1 && d < bd) {
        bd = d; const v = VARIANTS[k.variant], same = p.inv[v.slot] && p.var[v.slot] === k.variant;
        best = { obj: k, text: `[${this.input.label('KeyE')}] ${same ? 'Take ammo for ' : p.inv[v.slot] ? 'Swap for ' : 'Pick up '}${v.name}`, act: () => this.takeWeaponPickup(k) };
      }
    }
    for (const h of this.hostages) {
      if (h.state !== 'captive') continue;
      const d = dist2(h.pos.x, h.pos.z, p.pos.x, p.pos.z) - 2;
      if (d < 0.8 && d < bd) { bd = d; best = { obj: h, hold: 1.1, text: `Hold [${this.input.label('KeyE')}] Cut them free`, act: () => { h.free(); this.audio.blip(700); this.hud.banner('HOSTAGE FREED', 'They will follow you'); } }; }
    }
    for (const t of this.targets) {
      if (t.state !== 'idle') continue;
      const d = dist2(t.pos.x, t.pos.z, p.pos.x, p.pos.z) - 2;
      if (d < 3.6 && d < bd) { bd = d; best = { obj: t, hold: 1.5, text: `Hold [${this.input.label('KeyE')}] ${t.kind === 'uplink' || t.kind === 'jammer' ? 'Plant uplink' : 'Plant charge'}`, act: () => this.armTarget(t) }; }
    }
    return best;
  }

  // which score to play: calm in menus and when paused, driving pulse in play, intense when guards are alerted or you race
  musicMode() {
    if (this.state === 'menu' || this.state === 'paused' || this.state === 'over') return 'calm';
    let hot = !!this.alarm;
    if (!hot) for (const e of this.enemies) if (!e.dead && e.alerted && !e.noAlarm) { hot = true; break; }
    const o = this.mission && this.mission.cur;
    if (o && o.type === 'race' && o.st.state === 'run') hot = true;
    if (hot) this.intenseUntil = this.time + 8;
    return hot || this.time < (this.intenseUntil || 0) ? 'intense' : 'game';
  }
  // pan / distance of a sound at a world position, relative to the camera
  spatial(pos, range = 150) {
    const c = this.camera, dx = pos.x - c.position.x, dz = pos.z - c.position.z, d = Math.hypot(dx, dz) || 1;
    const f = this._sf || (this._sf = new THREE.Vector3()); c.getWorldDirection(f);
    const far = clamp(d / range, 0, 1);
    return { vol: clamp(1 - far * 0.85, 0.05, 1), pan: clamp((dx * -f.z + dz * f.x) / d, -1, 1) * Math.min(1, d / 12), far };
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
      this.world.update(this.camera.position, dt, this.camera.position);
    }
    if (this.settings.shadows) this.composer.render(); else this.renderer.render(this.scene, this.camera);
    if (this.previewOn && this.pFig && this.state === 'menu') this.renderPreview(dt);
    if (this.audio.ctx) { if (!this.music.started) this.music.start(); this.music.setMode(this.musicMode()); }
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
    this.updateRacePath();
    const t = this.markerTarget = this.mission.target();
    if (t) { const r = t.r || 1.2; this.beam.visible = true; this.beam.position.set(t.x, 150, t.z); this.beam.scale.set(r, 300, r); } else this.beam.visible = false;

    // headlight for night driving
    const v = p.vehicle;
    if (v && v.type === 'car' && w.theme.lit !== 0) {
      const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw);
      this.spot.intensity = 450; this.spot.position.set(v.pos.x + fx * 1.5, 1.4, v.pos.z + fz * 1.5); this.spot.target.position.set(v.pos.x + fx * 30, 0, v.pos.z + fz * 30);
    } else this.spot.intensity = 0;

    // looping audio
    if (v && v.type === 'car') {
      this.audio.vehicle(v.kind, 1, Math.abs(v.speed) / v.max);
      this.audio.skid(v.kind !== 'boat' && Math.abs(v.speed) > 12 && (Math.abs(v.steer) > 0.8 || !!this.input.keys.Space), 0.45);
    } else if (v && v.type === 'plane') { this.audio.engine(1, v.throttle, 75); this.audio.vehicleOff(); }
    else { this.audio.engine(0); this.audio.vehicleOff(); }
    this.audio.wind(p.mode === 'fall' ? 1 : p.mode === 'chute' ? 0.4 : p.mode === 'plane' ? 0.3 : 0);

    this.fx.update(dt);
    p.updateCamera(dt);
    w.update(p.vehicle ? p.vehicle.pos : p.pos, dt, this.camera.position);
    this.camera.updateMatrixWorld();
    this.hud.update(dt);
  }

  updateItems(dt) {
    const p = this.player, w = this.world;
    for (const k of this.pickups) {
      if (k.taken) continue;
      k.mesh.rotation.y += dt * 2; k.mesh.position.y = k.pos.y + Math.sin(this.time * 2.5 + k.seed) * 0.12;
      if (k.type === 'weapon') continue; // guns are picked up with the use key, never by walking over them
      if (p.mode !== 'foot' || p.dead || Math.abs(p.pos.y - 0) > 2.5 || dist2(k.pos.x, k.pos.z, p.pos.x, p.pos.z) > 1.7) continue;
      const d = PICKUPS[k.type];
      if (k.type === 'med') { if (p.addPack('med')) this.hud.banner('MEDKIT +1', `Press ${this.input.label('KeyQ')} to use it`); else if (p.hp < 100) p.hp = Math.min(100, p.hp + 50); else continue; }
      else if (k.type === 'armor') { if (p.addPack('plate')) this.hud.banner('ARMOUR PLATE +1', `Press ${this.input.label('KeyX')} to fit it`); else if (p.armor < 100) p.armor = 100; else continue; }
      else if (k.type === 'ammo') { for (const n of ['pistol', 'rifle', 'sniper']) if (p.inv[n]) p.inv[n].res += p.W[n].mag; }
      else if (k.type === 'grenade') p.grenades = Math.min(MAX_GRENADES, p.grenades + 2);
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
      if (g.t <= 0) {
        this.scene.remove(g.mesh); this.grenades.splice(i, 1);
        if (g.kind === 'noise') { this.fx.sparks(g.pos.clone(), 0xffd070, 14, 4, 0.5, 0.12); this.audio.beep(1800); this.emitNoise(g.pos, 80, true); this.hud.banner('DECOY', 'Guards are investigating'); }
        else this.explode(g.pos.clone(), 9, 170);
      }
    }
  }
}

// load the optional model files first; the game still starts (with built-in shapes) if any are missing
const boot = document.createElement('div');
boot.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;color:#ffb23e;font:600 14px Consolas,monospace;letter-spacing:4px;background:#05070a';
boot.textContent = 'LOADING MODELS...'; document.body.appendChild(boot);
loadAssets().catch(() => null).then(() => { boot.remove(); window.game = new Game(); });
