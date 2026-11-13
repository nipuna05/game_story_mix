import * as THREE from 'three';
import { makeHumanoid, animateHumanoid, makeChute } from './characters.js';
import { clamp, damp, angDiff, dist2, rnd } from './util.js';

export const WEAPONS = {
  fists: { name: 'Fists', melee: true },
  pistol: { name: 'P9 Suppressed', dmg: 36, rate: 0.2, mag: 12, spread: 0.01, noise: 12, reload: 1.2, recoil: 0.012, snd: 'pistol' },
  rifle: { name: 'AR-7 Carbine', dmg: 27, rate: 0.1, mag: 30, spread: 0.022, noise: 75, reload: 1.8, recoil: 0.009, snd: 'rifle', auto: true },
  sniper: { name: 'LR-50 Longbow', dmg: 160, rate: 1.1, mag: 5, spread: 0.03, noise: 95, reload: 2.5, recoil: 0.05, snd: 'sniper', scope: true },
};
const ORDER = ['fists', 'pistol', 'rifle', 'sniper'];
const _v = new THREE.Vector3(), _d = new THREE.Vector3(), _t = new THREE.Vector3();

export class Player {
  constructor(g) {
    this.g = g;
    this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3(); this.vy = 0;
    this.yaw = 0; this.pitch = 0; this.camYaw = 0;
    this.mode = 'foot'; this.vehicle = null; this.grounded = true; this.crouch = false;
    this.hp = 100; this.armor = 0; this.dead = false; this.regenT = 0;
    this.inv = { fists: {}, pistol: { mag: 12, res: 60 }, rifle: null, sniper: null };
    this.cur = 'pistol'; this.grenades = 2; this.fireCd = 0; this.reloadT = 0; this.meleeCd = 0; this.noiseT = 0;
    this.aiming = false; this.blocking = false; this.lockFists = false; this.speed = 0;
    this.holdT = 0; this.holdObj = null; this.air = { x: 0, z: 0 }; this.fov = 68; this.takedown = null;
    this.h = makeHumanoid({ shirt: 0x3b5876, pants: 0x3a4250, pack: 0x55663f, gun: true });
    this.chute = makeChute(); this.h.group.add(this.chute);
    g.scene.add(this.h.group);
  }
  targetPos() {
    if (this.vehicle) return _t.set(this.vehicle.pos.x, this.vehicle.pos.y + 1, this.vehicle.pos.z);
    return _t.set(this.pos.x, this.pos.y + (this.crouch ? 0.7 : 1.2), this.pos.z);
  }
  give(w, res) {
    const d = WEAPONS[w];
    if (!this.inv[w]) this.inv[w] = { mag: d.mag, res: res ?? d.mag * 3 }; else this.inv[w].res += res ?? d.mag * 2;
  }
  switchTo(w) { if (this.inv[w] && w !== this.cur && !(this.lockFists && w !== 'fists')) { this.cur = w; this.reloadT = 0; this.g.audio.click(); } }

  update(dt) {
    const g = this.g, inp = g.input;
    if (this.dead) { animateHumanoid(this.h, { dead: true }, dt); return; }
    const sens = g.settings.sens * 0.0022;
    this.yaw -= inp.dx * sens;
    this.pitch = clamp(this.pitch - inp.dy * sens * (g.settings.invertY ? -1 : 1), -1.25, 1.2);
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
    if (inp.pressed.KeyC) this.crouch = !this.crouch;
    this.aiming = !!inp.buttons[2] && this.cur !== 'fists';
    this.blocking = !!inp.buttons[2] && this.cur === 'fists';
    const sprint = k.ShiftLeft && f > 0 && !this.crouch && !this.aiming;
    let sp = this.crouch ? 2.3 : sprint ? 7.4 : 4.5;
    if (this.aiming || this.blocking) sp *= 0.6;
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw), rx = -fz, rz = fx;
    let mx = fx * f + rx * s, mz = fz * f + rz * s; const ml = Math.hypot(mx, mz);
    if (ml > 0) { mx /= ml; mz /= ml; }
    this.vel.x = damp(this.vel.x, mx * sp, 12, dt); this.vel.z = damp(this.vel.z, mz * sp, 12, dt);
    const prevY = this.pos.y;
    this.pos.x += this.vel.x * dt; this.pos.z += this.vel.z * dt;
    if (this.grounded && inp.pressed.Space) { this.vy = 6.6; this.grounded = false; this.crouch = false; }
    this.vy -= 20 * dt; this.pos.y += this.vy * dt;
    w.resolveCircle(this.pos, 0.4, Math.max(this.pos.y, 0), this.crouch ? 1.2 : 1.8);
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
    this.noiseT -= dt;
    if (this.noiseT <= 0 && this.speed > 3 && !this.crouch) { this.noiseT = 0.45; g.emitNoise(this.pos, sprint ? 9 : 3.5, false); }

    // weapons
    for (let i = 0; i < 4; i++) if (inp.pressed['Digit' + (i + 1)]) this.switchTo(ORDER[i]);
    if (inp.wheel) { let i = ORDER.indexOf(this.cur); for (let n = 0; n < 4; n++) { i = (i + Math.sign(inp.wheel) + 4) % 4; if (this.inv[ORDER[i]]) break; } this.switchTo(ORDER[i]); }
    if (this.lockFists && this.cur !== 'fists') this.cur = 'fists';
    const wd = WEAPONS[this.cur], st = this.inv[this.cur];
    if (this.reloadT > 0) {
      this.reloadT -= dt;
      if (this.reloadT <= 0) { const n = Math.min(wd.mag - st.mag, st.res); st.mag += n; st.res -= n; }
    } else if (wd.melee) {
      if (inp.btnPressed[0] && this.meleeCd <= 0) this.melee(30, 0.36);
    } else {
      if ((wd.auto ? inp.buttons[0] : inp.btnPressed[0]) && this.fireCd <= 0) this.fire(wd, st, sprint);
      if (inp.pressed.KeyR && st.mag < wd.mag && st.res > 0) { this.reloadT = wd.reload; g.audio.click(); }
    }
    if (inp.pressed.KeyF && this.meleeCd <= 0) this.melee(45, 0.75);
    if (inp.pressed.KeyG && this.grenades > 0 && !this.lockFists) { this.grenades--; g.throwGrenade(this); }
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

    const h = this.h;
    h.group.visible = !(this.aiming && wd.scope);
    h.gun.visible = this.cur !== 'fists';
    animateHumanoid(h, { speed: this.speed, crouch: this.crouch, aim: this.cur !== 'fists' && (this.aiming || this.fireCd > -0.6), pitch: this.pitch, block: this.blocking }, dt);
    h.group.position.copy(this.pos); h.group.rotation.set(0, this.yaw, 0);
    this.chute.visible = false;
  }

  behind(e) {
    const dx = this.pos.x - e.pos.x, dz = this.pos.z - e.pos.z, d = Math.hypot(dx, dz) || 1;
    return (Math.sin(e.yaw) * dx + Math.cos(e.yaw) * dz) / d < 0.2;
  }

  fire(wd, st, sprint) {
    const g = this.g;
    if (st.mag <= 0) { g.audio.click(); if (st.res > 0) this.reloadT = wd.reload; this.fireCd = 0.25; return; }
    st.mag--; this.fireCd = wd.rate;
    const cam = g.camera; cam.getWorldDirection(_d);
    let sp = wd.spread * (this.aiming ? (wd.scope ? 0.02 : 0.4) : 1) * (this.speed > 2 ? 1.6 : 1) * (this.crouch ? 0.7 : 1) * (sprint ? 2 : 1);
    _d.x += rnd(-sp, sp); _d.y += rnd(-sp, sp); _d.z += rnd(-sp, sp); _d.normalize();
    const head = _v.set(this.pos.x, this.pos.y + 1.5, this.pos.z);
    const tMin = Math.max(0, head.sub(cam.position).dot(_d));
    const hit = g.shootRay(cam.position, _d, 450, tMin, { dmg: wd.dmg, from: 'player' });
    const rx = -Math.cos(this.yaw), rz = Math.sin(this.yaw);
    const mz = new THREE.Vector3(this.pos.x + rx * 0.3 + Math.sin(this.yaw) * 0.7, this.pos.y + (this.crouch ? 1.05 : 1.45), this.pos.z + rz * 0.3 + Math.cos(this.yaw) * 0.7);
    g.fx.tracer(mz, hit, 0xfff0b0);
    if (wd.snd !== 'pistol') g.fx.flash(mz, 0xffc070, 40, 0.06);
    this.pitch += wd.recoil; this.yaw += rnd(-wd.recoil, wd.recoil) * 0.5;
    g.audio.shot(wd.snd, 1);
    g.emitNoise(this.pos, wd.noise, wd.noise > 30);
    g.stats.shots++;
    if (st.mag <= 0 && st.res > 0) this.reloadT = wd.reload;
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
    this.h.group.visible = false; this.crouch = false; this.camYaw = v.yaw; this.yaw = v.yaw; this.pitch = 0; this.vel.set(0, 0, 0);
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
    this.hp -= d; this.regenT = 6;
    this.g.stats.damage += d;
    this.g.hud.hurt(from, this);
    this.g.audio.hurt();
    if (this.hp <= 0) this.die(kind === 'fall' ? 'You fell to your death.' : kind === 'explosion' ? 'Caught in the blast.' : 'You were killed in action.');
  }
  die(reason) {
    if (this.dead) return;
    this.dead = true; this.hp = 0;
    if (this.vehicle) { this.vehicle.driver = null; this.vehicle = null; }
    this.h.group.visible = true; this.chute.visible = false;
    this.g.fail(reason);
  }
  revive(x, z) {
    this.dead = false; this.hp = 100; this.mode = 'foot'; this.vehicle = null; this.vy = 0; this.grounded = true;
    this.pos.set(x, 0, z); this.vel.set(0, 0, 0); this.h.deadT = 0; this.h.group.rotation.set(0, this.yaw, 0); this.h.body.position.y = 0; this.h.group.visible = true;
    for (const w of ['pistol', 'rifle', 'sniper']) if (this.inv[w]) this.inv[w].res = Math.max(this.inv[w].res, WEAPONS[w].mag * 2);
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
      const scope = !air && this.aiming && WEAPONS[this.cur].scope;
      const hy = this.pos.y + (this.crouch ? 1.12 : 1.6);
      if (scope) { cam.position.set(this.pos.x + _d.x * 0.3, hy, this.pos.z + _d.z * 0.3); fov = 13; }
      else {
        const dist = air ? 9 : this.aiming ? 2.0 : 3.5, side = air ? 0 : this.aiming ? 0.55 : 0.75;
        const px = this.pos.x - Math.cos(this.yaw) * side, pz = this.pos.z + Math.sin(this.yaw) * side, py = hy + 0.22;
        const t = w.raycast(px, py, pz, -_d.x, -_d.y, -_d.z, dist + 0.3);
        const dd = Math.max(0.3, Math.min(dist, t - 0.25));
        cam.position.set(px - _d.x * dd, py - _d.y * dd, pz - _d.z * dd);
        fov = this.aiming ? 46 : 68;
      }
      cam.lookAt(cam.position.x + _d.x, cam.position.y + _d.y, cam.position.z + _d.z);
    }
    if (shake > 0) { cam.position.x += rnd(-shake, shake) * 0.4; cam.position.y += rnd(-shake, shake) * 0.4; }
    this.fov = damp(this.fov, fov, 10, dt);
    if (Math.abs(cam.fov - this.fov) > 0.05) { cam.fov = this.fov; cam.updateProjectionMatrix(); }
  }
}
