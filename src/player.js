import * as THREE from 'three';
import { makeHumanoid, animateHumanoid, makeChute, reviveHumanoid } from './characters.js';
import { clamp, damp, angDiff, dist2, rnd } from './util.js';
import { VARIANTS, weaponDef, OUTFITS, PACK_ITEMS } from './gear.js';

const ORDER = ['fists', 'pistol', 'rifle', 'sniper'];
const SLOT_LIST = ['pistol', 'rifle', 'sniper'];
const _v = new THREE.Vector3(), _d = new THREE.Vector3(), _t = new THREE.Vector3(), _f = new THREE.Vector3();

export class Player {
  constructor(g) {
    this.g = g;
    this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3(); this.vy = 0;
    this.yaw = 0; this.pitch = 0; this.camYaw = 0;
    this.mode = 'foot'; this.vehicle = null; this.grounded = true; this.crouch = false;
    this.hp = 100; this.armor = 0; this.dead = false; this.regenT = 0;
    const prof = g.save.profile, eq = prof.equip;
    this.var = { pistol: eq.pistol, rifle: eq.rifle, sniper: eq.sniper };   // the gun currently carried in each slot
    this.W = { fists: { name: 'Fists', melee: true } };
    for (const sl of SLOT_LIST) this.rebuildW(sl);
    this.inv = { fists: {}, pistol: { mag: this.W.pistol.mag, res: this.W.pistol.mag * 5 }, rifle: null, sniper: null };
    this.pack = {}; this.packStock = {}; this.packCap = 6;
    this.cur = 'pistol'; this.grenades = 2; this.fireCd = 0; this.reloadT = 0; this.meleeCd = 0; this.noiseT = 0;
    this.recoil = 0; this.aiming = false; this.blocking = false; this.lockFists = false; this.speed = 0;
    this.holdT = 0; this.holdObj = null; this.air = { x: 0, z: 0 }; this.fov = 68; this.takedown = null;
    this.h = makeHumanoid({ shirt: 0x3b5876, pants: 0x3a4250, pack: 0x55663f, gun: true, gunKind: 'usp', tint: OUTFITS[eq.outfit % OUTFITS.length].c });
    this.wet = false; this.prone = false; this.proneK = 0; this.hidden = false; this.sneaking = false;
    this.chute = makeChute(); this.h.group.add(this.chute);
    g.scene.add(this.h.group);
  }
  targetPos() {
    if (this.vehicle) return _t.set(this.vehicle.pos.x, this.vehicle.pos.y + 1, this.vehicle.pos.z);
    return _t.set(this.pos.x, this.pos.y + (this.prone ? 0.35 : this.crouch ? 0.7 : 1.2), this.pos.z);
  }
  give(w, res) {
    const d = this.W[w];
    if (!this.inv[w]) this.inv[w] = { mag: d.mag, res: res ?? d.mag * 3 }; else this.inv[w].res += res ?? d.mag * 2;
  }
  switchTo(w) { if (this.inv[w] && w !== this.cur && !(this.lockFists && w !== 'fists')) { this.cur = w; this.reloadT = 0; this.g.audio.swap(); } }

  update(dt) {
    const g = this.g, inp = g.input;
    if (this.dead) { animateHumanoid(this.h, { dead: true }, dt); return; }
    // slower turning when zoomed in, so the scope and aim-down-sights stay controllable
    const zoom = Math.tan(this.fov * Math.PI / 360) / Math.tan(34 * Math.PI / 180);
    const sens = g.settings.sens * 0.0022 * clamp(zoom, 0.12, 1);
    this.yaw -= inp.dx * sens;
    this.pitch = clamp(this.pitch - inp.dy * sens * (g.settings.invertY ? -1 : 1), -1.25, 1.2);
    // recoil kicks the aim up, then settles back instead of stacking forever
    if (this.recoil > 0) { const back = Math.min(this.recoil, (this.recoil * 7 + 0.004) * dt); this.recoil -= back; this.pitch -= back; }
    this.fireCd -= dt; this.meleeCd -= dt;
    this.regenT -= dt;
    if (this.regenT <= 0 && this.hp < 45) this.hp = Math.min(45, this.hp + 5 * dt);
    g.interact = null; this.takedown = null;
    if (this.mode === 'foot') this.updateFoot(dt);
    else if (this.mode === 'fall' || this.mode === 'chute') this.updateAir(dt);
    else this.updateVehicle(dt);
  }

  updateFoot(dt) {
    const g = this.g, inp = g.input, k = inp.keys, w = g.world;
    const f = (k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0), s = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0);
    if (inp.pressed.KeyC) { if (this.prone) { this.prone = false; this.crouch = true; } else this.crouch = !this.crouch; }
    if (inp.pressed.KeyZ && this.grounded) { this.prone = !this.prone; if (this.prone) this.crouch = false; }
    if (this.prone && inp.pressed.Space) { this.prone = false; inp.pressed.Space = false; }
    this.sneaking = !!k.KeyV && !this.crouch && !this.prone;
    this.aiming = !!inp.buttons[2] && this.cur !== 'fists';
    this.blocking = !!inp.buttons[2] && this.cur === 'fists';
    const sprint = k.ShiftLeft && f > 0 && !this.crouch && !this.prone && !this.aiming;
    let sp = this.prone ? 1.25 : this.crouch ? 2.3 : this.sneaking ? 2.6 : sprint ? 7.4 : 4.5;
    if (this.aiming || this.blocking) sp *= 0.6;
    this.wet = w.waters.length > 0 && this.pos.y < 0.3 && w.inWater(this.pos.x, this.pos.z);
    if (this.wet) { sp = Math.min(sp, 2.6); this.prone = false; }
    this.hidden = w.bushes.length > 0 && this.pos.y < 0.3 && w.inBush(this.pos.x, this.pos.z);
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw), rx = -fz, rz = fx;
    let mx = fx * f + rx * s, mz = fz * f + rz * s; const ml = Math.hypot(mx, mz);
    if (ml > 0) { mx /= ml; mz /= ml; }
    this.vel.x = damp(this.vel.x, mx * sp, 12, dt); this.vel.z = damp(this.vel.z, mz * sp, 12, dt);
    const prevY = this.pos.y;
    this.pos.x += this.vel.x * dt; this.pos.z += this.vel.z * dt;
    if (this.grounded && inp.pressed.Space) { this.vy = 6.6; this.grounded = false; this.crouch = false; }
    this.vy -= 20 * dt; this.pos.y += this.vy * dt;
    w.resolveCircle(this.pos, 0.4, Math.max(this.pos.y, 0), this.prone ? 0.7 : this.crouch ? 1.2 : 1.8);
    for (const v of g.vehicles) {
      if (v.dead && v.type === 'plane') continue;
      const d = dist2(this.pos.x, this.pos.z, v.pos.x, v.pos.z), R = v.r + 0.3;
      if (d < R && d > 0.01 && this.pos.y < 1.5 && v.pos.y < 3) { this.pos.x += (this.pos.x - v.pos.x) / d * (R - d); this.pos.z += (this.pos.z - v.pos.z) / d * (R - d); }
    }
    const gy = w.groundAt(this.pos.x, this.pos.z, prevY);
    if (this.pos.y <= gy) {
      if (this.vy < -13) this.damage((-this.vy - 13) * 7, null, 'fall');
      this.pos.y = gy; this.vy = 0; this.grounded = true;
    } else this.grounded = this.pos.y - gy < 0.05;
    this.speed = Math.hypot(this.vel.x, this.vel.z);
    this.stepT = (this.stepT || 0) - dt * this.speed;
    if (this.stepT <= 0 && this.speed > 1.2 && this.grounded && !this.prone) { this.stepT = 2.2; g.audio.step(this.crouch ? 0.12 : this.sneaking ? 0.14 : sprint ? 0.5 : 0.3, this.wet); }
    this.noiseT -= dt;
    if (this.noiseT <= 0 && this.speed > 3 && !this.crouch && !this.prone && !this.sneaking && !this.wet) { this.noiseT = 0.45; g.emitNoise(this.pos, sprint ? 9 : 3.5, false); }

    // weapons
    for (let i = 0; i < 4; i++) if (inp.pressed['Digit' + (i + 1)]) this.switchTo(ORDER[i]);
    if (inp.wheel) { let i = ORDER.indexOf(this.cur); for (let n = 0; n < 4; n++) { i = (i + Math.sign(inp.wheel) + 4) % 4; if (this.inv[ORDER[i]]) break; } this.switchTo(ORDER[i]); }
    if (this.lockFists && this.cur !== 'fists') this.cur = 'fists';
    const wd = this.W[this.cur], st = this.inv[this.cur];
    if (this.aiming && this.cur !== 'fists') this.scanTargets(wd);
    if (this.reloadT > 0) {
      this.reloadT -= dt;
      if (this.reloadT <= 0) { const n = Math.min(wd.mag - st.mag, st.res); st.mag += n; st.res -= n; }
    } else if (wd.melee) {
      if (inp.btnPressed[0] && this.meleeCd <= 0) this.melee(30, 0.36);
    } else {
      if ((wd.auto ? inp.buttons[0] : inp.btnPressed[0]) && this.fireCd <= 0) this.fire(wd, st, sprint);
      if (inp.pressed.KeyR && st.mag < wd.mag && st.res > 0) { this.reloadT = wd.reload; g.audio.reload(wd.reload); }
    }
    if (inp.pressed.KeyF && this.meleeCd <= 0) this.melee(45, 0.75);
    if (inp.pressed.KeyG && !this.lockFists) {
      if (this.grenades > 0) { this.grenades--; g.throwGrenade(this); }
      else if (this.pack.nade > 0) { this.takeFromPack('nade'); g.throwGrenade(this); }
    }
    if (inp.pressed.KeyQ) this.usePack('med');
    if (inp.pressed.KeyX) this.usePack('plate');
    if (inp.pressed.KeyT) this.usePack('noise');
    if (inp.pressed.KeyY) this.usePack('ammo');
    if (inp.pressed.KeyU) this.dropWeapon();
    // stealth takedown hint
    for (const e of g.enemies) {
      if (e.dead || e.neutral || e.alerted || e.pos.y > 1) continue;
      if (dist2(e.pos.x, e.pos.z, this.pos.x, this.pos.z) < 2.3 && this.behind(e)) { this.takedown = e; break; }
    }
    // interaction
    const it = g.interact = g.findInteract();
    if (it) {
      if (it.hold) {
        if (k.KeyE) {
          if (this.holdObj !== it.obj) { this.holdObj = it.obj; this.holdT = 0; }
          this.holdT += dt;
          if (this.holdT >= it.hold) { it.act(); this.holdT = 0; this.holdObj = null; }
        } else this.holdT = 0;
      } else if (inp.pressed.KeyE) it.act();
    } else this.holdT = 0;

    if (this.mode !== 'foot') return;   // the use key just put us in a vehicle: do not show the soldier standing outside it
    const h = this.h;
    h.group.visible = !(this.aiming && wd.scope);
    h.gun.visible = this.cur !== 'fists';
    if (this.cur !== 'fists') h.setGun(this.W[this.cur].model, { finish: this.W[this.cur].finish, supp: this.W[this.cur].supp });
    this.proneK = damp(this.proneK, this.prone ? 1 : 0, 10, dt);
    animateHumanoid(h, { speed: this.speed, crouch: this.crouch && !this.wet, prone: this.prone, aim: this.cur !== 'fists' && (this.aiming || this.fireCd > -0.6), pitch: this.pitch, block: this.blocking }, dt);
    h.group.position.copy(this.pos); h.group.rotation.set(this.proneK * Math.PI / 2, this.yaw, 0);
    if (this.proneK > 0.001) { h.group.position.x -= Math.sin(this.yaw) * 0.85 * this.proneK; h.group.position.z -= Math.cos(this.yaw) * 0.85 * this.proneK; h.group.position.y += 0.2 * this.proneK; }
    if (this.wet) h.group.position.y -= 0.75;
    this.chute.visible = false;
  }

  // zooming in lets you identify enemies: anything near the crosshair in line of sight gets tagged for a few seconds
  scanTargets(wd) {
    const g = this.g, cam = g.camera, w = g.world, f = _f;
    cam.getWorldDirection(f);
    const cosT = Math.cos((cam.fov * Math.PI / 360) * 0.85), range = wd.scope ? 280 : 160;
    for (const e of g.enemies) {
      if (e.dead || e.neutral) continue;
      const dx = e.pos.x - cam.position.x, dy = e.pos.y + 1.3 - cam.position.y, dz = e.pos.z - cam.position.z, d = Math.hypot(dx, dy, dz);
      if (d > range || d < 2 || (dx * f.x + dy * f.y + dz * f.z) / d < cosT) continue;
      if (w.los(cam.position.x, cam.position.y, cam.position.z, e.pos.x, e.pos.y + 1.3, e.pos.z)) e.tagT = 6;
    }
  }
  rebuildW(slot) { this.W[slot] = weaponDef(this.var[slot], this.g.save.profile, this.var[slot] === this.g.save.profile.equip[slot]); }
  packUsed() { return Object.values(this.pack).reduce((a, b) => a + b, 0); }
  addPack(kind) { if (this.packUsed() >= this.packCap) return false; this.pack[kind] = (this.pack[kind] || 0) + 1; return true; }
  takeFromPack(kind) {
    this.pack[kind]--;
    if ((this.packStock[kind] || 0) > 0) { this.packStock[kind]--; this.g.useStock(kind); }   // only what came from your own stock is spent
  }
  usePack(kind) {
    const g = this.g, item = PACK_ITEMS[kind];
    if (!(this.pack[kind] > 0)) { g.hud.banner('NO ' + item.name.toUpperCase(), 'Buy more in the armory'); return; }
    if (kind === 'med') { if (this.hp >= 100) { g.hud.banner('HEALTH FULL', ''); return; } this.hp = Math.min(100, this.hp + 60); this.regenT = 0; g.audio.blip(520); g.hud.banner('MEDKIT USED', '+60 health'); }
    else if (kind === 'plate') { if (this.armor >= 100) { g.hud.banner('ARMOUR FULL', ''); return; } this.armor = Math.min(100, this.armor + 50); g.audio.blip(480); g.hud.banner('ARMOUR PLATE FITTED', '+50 armour'); }
    else if (kind === 'noise') { if (this.lockFists) return; g.throwGrenade(this, 'noise'); }
    else if (kind === 'ammo') { for (const sl of SLOT_LIST) if (this.inv[sl]) this.inv[sl].res += this.W[sl].mag * 2; g.audio.blip(700); g.hud.banner('AMMO BOX USED', 'Reserves refilled'); }
    else return;
    this.takeFromPack(kind);
  }
  // pick up a gun: it replaces the gun you carry in that slot, which is dropped on the ground
  takeWeapon(vid, mag, res) {
    const v = VARIANTS[vid], slot = v.slot, g = this.g, old = this.inv[slot];
    if (old && this.var[slot] === vid) { old.res += mag + res; g.hud.banner(v.name.toUpperCase(), 'Ammo added'); g.audio.click(); return null; }
    const dropped = old ? { variant: this.var[slot], mag: old.mag, res: old.res } : null;
    this.var[slot] = vid; this.rebuildW(slot);
    const cap = this.W[slot].mag;
    this.inv[slot] = { mag: Math.min(mag, cap), res: res + Math.max(0, mag - cap) };
    this.cur = slot; this.reloadT = 0; g.audio.click();
    g.hud.banner(v.name.toUpperCase(), dropped ? 'Swapped - you dropped the ' + VARIANTS[dropped.variant].name : 'Picked up');
    return dropped;
  }
  dropWeapon() {
    const slot = this.cur, g = this.g;
    if (slot === 'fists' || !this.inv[slot] || this.lockFists) return;
    const st = this.inv[slot], vid = this.var[slot];
    g.dropWeapon(vid, st.mag, st.res, this.pos.x + Math.sin(this.yaw) * 1.4, this.pos.z + Math.cos(this.yaw) * 1.4);
    this.inv[slot] = null; this.reloadT = 0;
    this.cur = this.inv.pistol ? 'pistol' : this.inv.rifle ? 'rifle' : this.inv.sniper ? 'sniper' : 'fists';
    g.hud.banner('DROPPED ' + VARIANTS[vid].name.toUpperCase(), '');
  }

  behind(e) {
    const dx = this.pos.x - e.pos.x, dz = this.pos.z - e.pos.z, d = Math.hypot(dx, dz) || 1;
    return (Math.sin(e.yaw) * dx + Math.cos(e.yaw) * dz) / d < 0.2;
  }

  fire(wd, st, sprint) {
    const g = this.g;
    if (st.mag <= 0) { if (st.res > 0) { this.reloadT = wd.reload; g.audio.reload(wd.reload); } else g.audio.dry(); this.fireCd = 0.25; return; }
    st.mag--; this.fireCd = wd.rate;
    const cam = g.camera; cam.getWorldDirection(_d);
    let sp = wd.spread * (this.aiming ? (wd.scope ? 0.02 : 0.4) : 1) * (this.speed > 2 ? 1.6 : 1) * (this.prone ? 0.5 : this.crouch ? 0.7 : 1) * (sprint ? 2 : 1);
    const base = _d.clone(), n = wd.pellets || 1, h0 = g.stats.hits, ends = [];
    for (let i = 0; i < (wd.launch ? 0 : n); i++) {   // shotguns fire several pellets; each one can hit
      _d.copy(base); _d.x += rnd(-sp, sp); _d.y += rnd(-sp, sp); _d.z += rnd(-sp, sp); _d.normalize();
      const head = _v.set(this.pos.x, this.pos.y + 1.5, this.pos.z);
      const tMin = Math.max(0, head.sub(cam.position).dot(_d));
      ends.push(g.shootRay(cam.position, _d, wd.range || 450, tMin, { dmg: wd.dmg, from: 'player' }));
    }
    if (g.stats.hits - h0 > 1) g.stats.hits = h0 + 1;   // accuracy counts shots, not pellets
    const rx = -Math.cos(this.yaw), rz = Math.sin(this.yaw);
    const mz = new THREE.Vector3(this.pos.x + rx * 0.14 + Math.sin(this.yaw) * 0.9, this.pos.y + (this.prone ? 0.4 : this.wet ? 0.8 : this.crouch ? 1.05 : 1.5), this.pos.z + rz * 0.14 + Math.cos(this.yaw) * 0.9);
    if (wd.launch) g.launchShell(wd, base, mz);
    for (let i = 0; i < ends.length; i += (n > 3 ? 2 : 1)) g.fx.tracer(mz, ends[i], 0xfff0b0);
    if (wd.snd !== 'pistol' && !wd.supp) g.fx.flash(mz, 0xffc070, 40, 0.06);
    this.pitch += wd.recoil; this.recoil = Math.min(0.2, (this.recoil || 0) + wd.recoil); this.yaw += rnd(-wd.recoil, wd.recoil) * 0.25;
    g.audio.gun(wd.id, wd.supp ? 0.55 : 1, 0, wd.supp ? 0.55 : 0, true);
    g.emitNoise(this.pos, wd.noise, wd.noise > 30);
    if (!wd.launch) g.stats.shots++;
    if (st.mag <= 0 && st.res > 0) { this.reloadT = wd.reload; g.audio.reload(wd.reload); }
  }

  melee(dmg, cd) {
    const g = this.g;
    this.meleeCd = cd; this.h.punchT = 0;
    let best = null, bd = 2.4;
    for (const e of g.enemies) {
      if (e.dead || Math.abs(e.pos.y - this.pos.y) > 1.5) continue;
      const dx = e.pos.x - this.pos.x, dz = e.pos.z - this.pos.z, d = Math.hypot(dx, dz);
      if (d < bd && Math.abs(angDiff(this.yaw, Math.atan2(dx, dz))) < 1.0) { bd = d; best = e; }
    }
    if (!best) return;
    g.audio.punch();
    g.fx.sparks(new THREE.Vector3(best.pos.x, best.pos.y + 1.3, best.pos.z), 0xffe0a0, 5, 3, 0.25, 0.08);
    if (!best.alerted && !best.neutral && this.behind(best)) { g.stats.takedowns++; best.die({ from: 'player', silent: true, takedown: true }); g.hud.banner('TAKEDOWN', ''); }
    else best.damage(dmg, { from: 'player', melee: true });
    g.hud.hitMark(best.dead);
  }

  updateAir(dt) {
    const g = this.g, inp = g.input, k = inp.keys, w = g.world;
    const prevY = this.pos.y;
    const f = (k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0), s = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0);
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    if (this.mode === 'fall') {
      this.vy = Math.max(-55, this.vy - 24 * dt);
      this.air.x = damp(this.air.x, 0, 0.6, dt); this.air.z = damp(this.air.z, 0, 0.6, dt);
      this.pos.x += (this.air.x + (fx * f - fz * s) * 14) * dt; this.pos.z += (this.air.z + (fz * f + fx * s) * 14) * dt;
      const alt = this.pos.y - w.groundAt(this.pos.x, this.pos.z, this.pos.y);
      if (inp.pressed.Space || alt < 55) {
        this.mode = 'chute'; g.audio.chute(); this.pitch = -0.35;
        g.hud.banner(alt < 55 ? 'RESERVE CHUTE!' : 'CANOPY OPEN', 'W dive · S flare · mouse to steer');
      }
    } else {
      this.yaw += -s * 1.1 * dt;
      const fw = f > 0 ? 14 : f < 0 ? 4 : 8.5, sink = f > 0 ? 8 : f < 0 ? 3.2 : 5.2;
      this.vy = damp(this.vy, -sink, 3, dt);
      this.pos.x += fx * fw * dt; this.pos.z += fz * fw * dt;
    }
    this.pos.y += this.vy * dt;
    w.resolveCircle(this.pos, 0.5, Math.max(0, this.pos.y), 1.8);
    const gy = w.groundAt(this.pos.x, this.pos.z, prevY);
    if (this.pos.y <= gy) {
      this.pos.y = gy;
      const hard = this.mode === 'fall';
      this.mode = 'foot'; this.grounded = true; this.vel.set(0, 0, 0);
      if (hard || this.vy < -20) { this.vy = 0; return this.die('Your parachute never opened.'); }
      if (this.vy < -7) this.damage(8, null, 'fall');
      this.vy = 0; this.pitch = 0;
      g.emitNoise(this.pos, 5, false);
    }
    this.speed = 8;
    const h = this.h; h.group.visible = true; h.gun.visible = false;
    this.chute.visible = this.mode === 'chute';
    animateHumanoid(h, { speed: 0, hands: this.mode === 'chute' ? 'up' : null }, dt);
    h.group.position.copy(this.pos);
    h.group.rotation.set(this.mode === 'fall' ? 1.1 : 0, this.yaw, 0);
  }

  updateVehicle(dt) {
    const g = this.g, inp = g.input, v = this.vehicle;
    this.h.group.visible = false;   // you are the driver shown inside the vehicle
    if (!v || v.dead) { if (v) this.exitVehicle(true); return; }
    if (v.type === 'plane') {
      if (v.airborne) { if (inp.pressed.KeyJ || inp.pressed.KeyE) this.exitVehicle(); }
      else if (inp.pressed.KeyE) { if (v.speed < 8) this.exitVehicle(); else g.hud.banner('', 'Stop the aircraft before getting out'); }
    } else if (inp.pressed.KeyE && !v.frozen) this.exitVehicle();
  }
  syncVehicle() {
    if (this.vehicle) { this.pos.copy(this.vehicle.pos); if (this.vehicle.type === 'car') this.pos.y = 0; this.speed = Math.abs(this.vehicle.speed); }
  }
  enterVehicle(v) {
    this.vehicle = v; v.driver = this; v.autopilot = false; this.mode = v.type;
    this.h.group.visible = false; this.crouch = false; this.prone = false; this.proneK = 0; this.camYaw = v.yaw; this.yaw = v.yaw; this.pitch = 0; this.vel.set(0, 0, 0);
    this.g.audio.click();
  }
  exitVehicle() {
    const v = this.vehicle; if (!v) return;
    v.driver = null; this.vehicle = null; this.h.group.visible = true;
    if (v.type === 'plane' && v.airborne) {
      this.mode = 'fall'; this.pos.copy(v.pos); this.pos.y -= 2.5; this.vy = Math.min(0, v.vy || 0);
      this.air.x = Math.sin(v.yaw) * v.speed * 0.7; this.air.z = Math.cos(v.yaw) * v.speed * 0.7;
      v.autopilot = !v.dead; this.yaw = v.yaw; this.pitch = -0.7;
      this.g.hud.banner('FREEFALL', 'Press SPACE to open your parachute');
    } else {
      this.mode = 'foot';
      const lx = Math.cos(v.yaw), lz = -Math.sin(v.yaw), sp = v.type === 'car' ? Math.abs(v.speed) : 0;
      this.pos.set(v.pos.x + lx * (v.r + 1.1), 0, v.pos.z + lz * (v.r + 1.1));
      this.g.world.resolveCircle(this.pos, 0.4, 0, 1.8);
      this.yaw = v.yaw; this.vy = 0; this.grounded = true;
      if (sp > 14) this.damage((sp - 14) * 2.2, null, 'fall');
    }
  }

  damage(d, from, kind) {
    if (this.dead || this.g.god) return;
    if (this.armor > 0 && kind !== 'fall') { const a = Math.min(this.armor, d * 0.6); this.armor -= a; d -= a; }
    if (this.g.def && this.g.def.daily && this.g.def.daily.mod === 'glass') d *= 2;
    this.hp -= d; this.regenT = 6;
    this.g.stats.damage += d;
    this.g.hud.hurt(from, this);
    this.g.audio.hurt(d);
    if (this.hp <= 0) this.die(kind === 'fall' ? 'You fell to your death.' : kind === 'explosion' ? 'Caught in the blast.' : 'You were killed in action.');
  }
  die(reason) {
    if (this.dead) return;
    this.dead = true; this.hp = 0; this.g.audio.death();
    if (this.vehicle) { this.vehicle.driver = null; this.vehicle = null; }
    this.h.group.visible = true; this.chute.visible = false;
    this.g.fail(reason);
  }
  revive(x, z) {
    this.dead = false; this.prone = false; this.proneK = 0; this.hp = 100; this.mode = 'foot'; this.vehicle = null; this.vy = 0; this.grounded = true;
    this.pos.set(x, 0, z); this.vel.set(0, 0, 0); reviveHumanoid(this.h); this.h.group.rotation.set(0, this.yaw, 0); this.h.group.visible = true;
    for (const w of ['pistol', 'rifle', 'sniper']) if (this.inv[w]) this.inv[w].res = Math.max(this.inv[w].res, this.W[w].mag * 2);
  }

  updateCamera(dt) {
    const g = this.g, cam = g.camera, w = g.world;
    let fov = 68;
    const shake = g.fx.shake;
    if (this.mode === 'car' && this.vehicle) {
      const v = this.vehicle;
      this.camYaw += angDiff(this.camYaw, v.yaw) * (1 - Math.exp(-4.5 * dt));
      const back = v.kind === 'bike' ? 6.2 : 8.2, fx = Math.sin(this.camYaw), fz = Math.cos(this.camYaw);
      cam.position.set(v.pos.x - fx * back, 3.3, v.pos.z - fz * back);
      cam.lookAt(v.pos.x + fx * 4, 1.3, v.pos.z + fz * 4);
      fov = 66 + clamp(Math.abs(v.speed) / v.max, 0, 1) * 16;
    } else if (this.mode === 'plane' && this.vehicle) {
      const v = this.vehicle;
      this.camYaw += angDiff(this.camYaw, v.yaw) * (1 - Math.exp(-3.5 * dt));
      const cp = Math.cos(v.pitch * 0.6), fx = Math.sin(this.camYaw) * cp, fz = Math.cos(this.camYaw) * cp, fy = Math.sin(v.pitch * 0.6);
      cam.position.set(v.pos.x - fx * 17, Math.max(1.2, v.pos.y - fy * 17 + 4.6), v.pos.z - fz * 17);
      cam.lookAt(v.pos.x + fx * 12, v.pos.y + fy * 12 + 1, v.pos.z + fz * 12);
      fov = 72;
    } else {
      const cp = Math.cos(this.pitch);
      _d.set(Math.sin(this.yaw) * cp, Math.sin(this.pitch), Math.cos(this.yaw) * cp);
      const air = this.mode !== 'foot' || this.dead;
      const wdc = this.W[this.cur], scope = !air && this.aiming && wdc.scope;
      const hy = this.pos.y + (this.prone ? 0.55 : this.wet ? 0.95 : this.crouch ? 1.12 : 1.6);
      if (scope) { cam.position.set(this.pos.x + _d.x * 0.3, hy, this.pos.z + _d.z * 0.3); fov = wdc.zoom || 13; }
      else {
        const dist = air ? 9 : this.aiming ? 2.0 : 3.5, side = air ? 0 : this.aiming ? 0.55 : 0.75;
        const px = this.pos.x - Math.cos(this.yaw) * side, pz = this.pos.z + Math.sin(this.yaw) * side, py = hy + 0.22;
        const t = w.raycast(px, py, pz, -_d.x, -_d.y, -_d.z, dist + 0.3);
        const dd = Math.max(0.3, Math.min(dist, t - 0.25));
        cam.position.set(px - _d.x * dd, py - _d.y * dd, pz - _d.z * dd);
        fov = this.aiming ? (wdc.zoom || wdc.aimFov || 46) : 68;
      }
      cam.lookAt(cam.position.x + _d.x, cam.position.y + _d.y, cam.position.z + _d.z);
    }
    if (shake > 0) { cam.position.x += rnd(-shake, shake) * 0.4; cam.position.y += rnd(-shake, shake) * 0.4; }
    this.fov = damp(this.fov, fov, 10, dt);
    if (Math.abs(cam.fov - this.fov) > 0.05) { cam.fov = this.fov; cam.updateProjectionMatrix(); }
  }
}
