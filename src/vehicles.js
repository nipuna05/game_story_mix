import * as THREE from 'three';
import { clamp, damp, angDiff, turnToward, dist2 } from './util.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { cmat, makeHumanoid, animateHumanoid } from './characters.js';
import { ASSETS } from './assets.js';
import { buildVehicle, HAS_MODEL } from './carmodels.js';

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const GEO = {
  wheel: new THREE.CylinderGeometry(0.42, 0.42, 0.3, 20).rotateZ(Math.PI / 2),
  rim: new THREE.CylinderGeometry(0.24, 0.24, 0.32, 12).rotateZ(Math.PI / 2),
  bwheel: new THREE.CylinderGeometry(0.4, 0.4, 0.16, 18).rotateZ(Math.PI / 2),
  u: new RoundedBoxGeometry(1, 1, 1, 3, 0.12),
  prop: box(3.4, 0.16, 0.06),
};
const glow = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xfff2c0).multiplyScalar(2.6) });
const tail = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff2a1a).multiplyScalar(2.2) });
const rimMat = new THREE.MeshStandardMaterial({ color: 0xb8bcc2, metalness: 0.9, roughness: 0.25 });
const paints = new Map();
// glossy car paint that reflects the sky
const vmat = (c, rough = 0.3, metal = 0.6) => { const k = c + '|' + rough; let m = paints.get(k); if (!m) { m = new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: metal }); paints.set(k, m); } return m; };
const glass = new THREE.MeshStandardMaterial({ color: 0x1c2a36, roughness: 0.08, metalness: 0.9 });

export const CAR_KINDS = {
  sedan: { name: 'Sedan', max: 34, accel: 13, hp: 180, r: 1.5, colors: [0x7a8a9a, 0x8a3030, 0x2f4f6f, 0xd8d8d0, 0x3a3a3a] },
  sports: { name: 'Street racer', max: 47, accel: 19, hp: 160, r: 1.5, colors: [0xd22b2b, 0xe8b020, 0x2a7ad2, 0x30a860, 0xb040c0] },
  suv: { name: 'SUV', max: 36, accel: 13, hp: 230, r: 1.6, colors: [0x2b2f33, 0xd8d8d0, 0x4a5a4a, 0x7a2a2a, 0x2f4f6f] },
  pickup: { name: 'Pickup truck', max: 33, accel: 12, hp: 250, r: 1.7, colors: [0xb8b0a0, 0x7a3a2a, 0x3f5a3a, 0x2a3f5a] },
  van: { name: 'Van', max: 30, accel: 10, hp: 240, r: 1.8, colors: [0xe8e8e4, 0x9aa4ae, 0x2a3a52] },
  jeep: { name: 'Jeep', max: 31, accel: 12, hp: 280, r: 1.6, colors: [0x4d5a3a, 0x6a6048] },
  bike: { name: 'Motorbike', max: 44, accel: 22, hp: 110, r: 0.8, colors: [0x202020, 0x8a1c1c, 0x1c3c8a] },
  boat: { name: 'Boat', max: 21, accel: 9, hp: 220, r: 1.7, water: true, colors: [0x6a7a52, 0x7a6a4a] },
};

function part(parent, w, h, d, mat, x, y, z) {
  const m = new THREE.Mesh(GEO.u, mat); m.scale.set(w, h, d); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m;
}

export class Car {
  constructor(g, x, z, yaw, kind = 'sedan', color) {
    this.g = g; this.type = 'car'; this.kind = kind; this.def = CAR_KINDS[kind];
    this.pos = new THREE.Vector3(x, 0, z); this.yaw = yaw; this.speed = 0; this.steer = 0;
    this.hp = this.def.hp; this.max = this.def.max; this.r = this.def.r;
    this.driver = null; this.ai = null; this.frozen = false; this.locked = false; this.dead = false; this.lean = 0;
    this.name = this.def.name; this.seats = []; this.occ = [];
    const c = color ?? this.def.colors[Math.floor(Math.random() * this.def.colors.length)];
    const grp = this.mesh = new THREE.Group(); grp.rotation.order = 'YXZ';
    const body = this.body = new THREE.Group(); grp.add(body);
    const bm = vmat(c), dk = vmat(0x15171a, 0.7, 0.2);
    this.wheels = [];
    if (HAS_MODEL[kind]) {
      const m = buildVehicle(kind, c); body.add(m.group); this.wheelSet = m.wheels;
      if (m.seat) { // a driver you can see sitting inside
        this.rider = makeHumanoid({ shirt: 0x3b5876, pants: 0x3a4250, tint: 0xb9c8e6 });
        this.rider.group.position.set(m.seat.x, m.seat.y, m.seat.z); this.rider.group.visible = false; body.add(this.rider.group);
        this.seatPose = { kneel: !!m.seat.kneel, hands: 'drive' };
        this.seats = m.seats;
      }
    } else if (kind === 'bike' && ASSETS.bike) {
      const m = ASSETS.bike.clone(true); body.add(m);
      this.rider = makeHumanoid({ shirt: 0x3b5876, pants: 0x3a4250, tint: 0xb9c8e6 });
      this.rider.group.position.set(0, 0.18, -0.3); this.rider.group.visible = false; body.add(this.rider.group);
      this.seats = [{ x: 0, y: 0.18, z: -0.3 }, { x: 0, y: 0.2, z: -0.88, kneel: false, crouch: true, hands: 'drive' }];
    } else if (kind === 'bike') {
      part(body, 0.34, 0.5, 1.5, bm, 0, 0.78, 0); part(body, 0.3, 0.16, 0.7, dk, 0, 1.08, -0.35);
      part(body, 0.7, 0.08, 0.08, dk, 0, 1.25, 0.55); part(body, 0.12, 0.6, 0.12, dk, 0, 0.9, 0.62);
      part(body, 0.2, 0.16, 0.06, glow, 0, 1.08, 0.78);
      for (const z of [0.85, -0.8]) { const w = new THREE.Mesh(GEO.bwheel, dk); w.position.set(0, 0.4, z); w.castShadow = true; body.add(w); this.wheels.push(w); }
      this.rider = makeHumanoid({ shirt: 0x3b5876, pants: 0x3a4250, hat: 0x101010, tint: 0xb9c8e6 });
      this.rider.group.position.set(0, 0.18, -0.3); this.rider.group.visible = false; body.add(this.rider.group);
    }
    grp.position.copy(this.pos); grp.rotation.y = yaw;
    g.scene.add(grp);
  }

  update(dt) {
    if (this.dead) return;
    const g = this.g, k = g.input.keys;
    let thr = 0, st = 0, hb = false;
    if (this.frozen) { this.speed = 0; }
    else if (this.driver) {
      thr = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0);
      st = (k.KeyA || k.ArrowLeft ? 1 : 0) - (k.KeyD || k.ArrowRight ? 1 : 0);
      hb = !!k.Space;
    } else if (this.ai) [thr, st] = this.aiDrive(dt);
    const max = this.max, sp = this.speed;
    if (thr > 0) this.speed += (sp < 0 ? 28 : this.def.accel * (1 - Math.max(0, sp) / max)) * dt;
    else if (thr < 0) this.speed -= (sp > 1 ? 17 : 9) * dt;
    this.speed -= (this.speed * (thr > 0 ? 0.03 : 0.3) + Math.sign(this.speed) * 0.5) * dt;
    if (hb) this.speed -= this.speed * 1.6 * dt;
    if (!thr && Math.abs(this.speed) < 0.3) this.speed = 0;
    this.speed = clamp(this.speed, -11, max);
    this.steer = damp(this.steer, st, 8, dt);
    const a = Math.abs(this.speed);
    const rate = this.steer * (this.kind === 'bike' ? 2.7 : 2.3) * clamp(a / 7, 0, 1) * (1 - 0.55 * clamp(a / max, 0, 1)) * Math.sign(this.speed) * (hb ? 1.5 : 1);
    this.yaw += rate * dt;
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    const bx = this.pos.x, bz = this.pos.z;
    this.pos.x += fx * this.speed * dt; this.pos.z += fz * this.speed * dt;
    // wheels cannot enter the river; boats cannot leave it
    if (g.world.waters.length) {
      const wet = this.def.water ? g.world.inWater(this.pos.x, this.pos.z, true) : g.world.inWater(this.pos.x, this.pos.z);
      if (this.def.water ? !wet : wet) {
        this.pos.x = bx; this.pos.z = bz; this.speed *= -0.15;
        if (this.driver && !this.def.water && g.time - (this.wetWarn || -9) > 5) { this.wetWarn = g.time; g.hud.banner('TOO DEEP TO DRIVE', 'Use a bridge, a boat, or wade across on foot'); }
      }
    }
    const ax = this.pos.x, az = this.pos.z;
    if (g.world.resolveCircle(this.pos, this.r, 0, 1.6)) {
      let nx = this.pos.x - ax, nz = this.pos.z - az; const nl = Math.hypot(nx, nz);
      if (nl > 1e-4) {
        nx /= nl; nz /= nl;
        const into = -(fx * nx + fz * nz) * this.speed; // speed driven into the surface
        if (into > 0) {
          this.speed *= clamp(1 - Math.abs(fx * nx + fz * nz) * 1.1, 0, 1);
          if (into > 9) this.hit((into - 9) * 5, true);
        }
      }
    }
    // run people over
    if (a > 5) for (const e of g.enemies) {
      if (!e.dead && e.pos.y < 2 && dist2(e.pos.x, e.pos.z, this.pos.x, this.pos.z) < this.r + 0.6) { e.damage(a * 9, { vehicle: true, from: this.driver ? 'player' : null }); this.speed *= 0.92; }
    }
    this.lean = damp(this.lean, -this.steer * clamp(a / 20, 0, 1) * (this.kind === 'bike' ? 0.5 : 0.06), 6, dt);
    this.mesh.position.set(this.pos.x, 0, this.pos.z);
    this.mesh.rotation.y = this.yaw; this.body.rotation.z = this.lean;
    if (this.wheelSet) for (const w of this.wheelSet) { if (w.front) w.pivot.rotation.y = this.steer * 0.45; w.spin.rotation.x += this.speed * dt / w.r; }
    if (this.rider) { this.rider.group.visible = !!(this.driver || this.ai); if (this.rider.group.visible) animateHumanoid(this.rider, this.seatPose || { crouch: true, hands: 'drive' }, dt); }
    if (this.def.water) this.mesh.position.y = -0.12 + Math.sin(g.time * 1.7 + this.pos.x) * 0.05;
    for (let i = 1; i < this.occ.length; i++) if (this.occ[i]) { const s = this.seats[i]; animateHumanoid(this.occ[i].h, { kneel: !!s.kneel, crouch: !!s.crouch, hands: s.hands || null }, dt); }
  }

  // passengers: hostages sit in the free seats
  seatsFree() { let n = 0; for (let i = 1; i < this.seats.length; i++) if (!this.occ[i]) n++; return n; }
  takeSeat(h) {
    for (let i = 1; i < this.seats.length; i++) {
      if (this.occ[i]) continue;
      const s = this.seats[i]; this.occ[i] = h;
      h.h.group.position.set(s.x, s.y, s.z); h.h.group.rotation.set(0, 0, 0); h.h.group.visible = true; this.body.add(h.h.group);
      return i;
    }
    return -1;
  }
  freeSeat(h) { for (let i = 1; i < this.occ.length; i++) if (this.occ[i] === h) this.occ[i] = null; }
  aiDrive(dt) {
    const ai = this.ai, n = ai.route.length;
    if (ai.i >= n) return [this.speed > 1 ? -1 : 0, 0];
    const t = ai.route[ai.i], d = dist2(this.pos.x, this.pos.z, t.x, t.z);
    if (d < 11) { ai.i++; return [1, 0]; }
    if (ai.rev > 0) { ai.rev -= dt; return [-1, ai.revSt]; }
    const want = Math.atan2(t.x - this.pos.x, t.z - this.pos.z), df = angDiff(this.yaw, want);
    let target = ai.max;
    const nx = ai.route[ai.i + 1];
    if (nx) { const corner = Math.abs(angDiff(want, Math.atan2(nx.x - t.x, nx.z - t.z))); if (corner > 0.5 && d < 10 + this.speed * 1.1) target = 13; }
    if (Math.abs(df) > 0.5) target = Math.min(target, 11);
    if (this.speed < 1.2) { ai.stuck = (ai.stuck || 0) + dt; if (ai.stuck > 1.6) { ai.stuck = 0; ai.rev = 1.1; ai.revSt = df > 0 ? -1 : 1; } } else ai.stuck = 0;
    return [this.speed < target ? 1 : this.speed > target + 3 ? -1 : 0, clamp(df * 2.4, -1, 1)];
  }

  hit(dmg, crash) {
    if (this.dead) return;
    this.hp -= dmg;
    if (this.driver) { this.g.player.damage(dmg * (crash ? (this.kind === 'bike' ? 0.5 : 0.22) : 0.3), this.pos, 'crash'); if (crash) this.g.audio.crash(clamp(dmg / 30, 0.4, 1)); }
    if (this.hp <= 0) this.destroy();
  }
  destroy() {
    if (this.dead) return;
    this.dead = true; this.speed = 0;
    const g = this.g, p = g.player;
    if (this.driver) { p.exitVehicle(true); p.damage(45, this.pos, 'explosion'); }
    g.fx.explosion(new THREE.Vector3(this.pos.x, 1, this.pos.z), 7);
    g.audio.explosion(clamp(1.2 - this.pos.distanceTo(p.pos) / 150, 0, 1), g.spatial(this.pos, 220).pan);
    this.mesh.traverse((o) => { if (o.isMesh) o.material = cmat(0x161616); });
    if (this.rider) this.rider.group.visible = false;
  }
  teleport(x, z, yaw) { this.pos.set(x, 0, z); this.yaw = yaw; this.speed = 0; this.steer = 0; this.mesh.position.copy(this.pos); this.mesh.rotation.y = yaw; }
}

export class Plane {
  constructor(g, x, y, z, yaw, airborne) {
    this.g = g; this.type = 'plane'; this.name = 'Aircraft';
    this.pos = new THREE.Vector3(x, airborne ? y : 1.3, z); this.yaw = yaw; this.pitch = 0; this.roll = 0;
    this.speed = airborne ? 58 : 0; this.throttle = airborne ? 0.6 : 0; this.onGround = !airborne;
    this.vy = 0; this.driver = null; this.autopilot = false; this.dead = false; this.r = 3; this.hp = 200; this.gone = 0; this.warnT = 0;
    const grp = this.mesh = new THREE.Group(); grp.rotation.order = 'YXZ';
    const bm = vmat(0x9aa2a8, 0.35, 0.7), dk = vmat(0x2a3a4a, 0.4, 0.5);
    part(grp, 1.3, 1.3, 7, bm, 0, 0, 0); part(grp, 1.0, 1.0, 1.4, dk, 0, 0, 4.0);
    part(grp, 11, 0.16, 1.7, bm, 0, 0.55, 0.9); part(grp, 1.1, 0.7, 1.6, glass, 0, 0.75, 0.9);
    part(grp, 3.8, 0.12, 1.0, bm, 0, 0.3, -3.1); part(grp, 0.14, 1.5, 1.1, dk, 0, 0.95, -3.1);
    part(grp, 0.12, 0.9, 0.12, dk, -1.2, -0.8, 1); part(grp, 0.12, 0.9, 0.12, dk, 1.2, -0.8, 1);
    for (const sx of [-1.2, 1.2]) { const w = new THREE.Mesh(GEO.wheel, cmat(0x15171a)); w.scale.setScalar(0.7); w.position.set(sx, -1.05, 1); grp.add(w); }
    this.prop = new THREE.Mesh(GEO.prop, cmat(0x15171a)); this.prop.position.set(0, 0, 4.75); grp.add(this.prop);
    g.scene.add(grp); this.sync();
  }
  get airborne() { return !this.onGround; }

  update(dt) {
    if (this.dead) return;
    const g = this.g, k = g.input.keys;
    let pi = 0, ro = 0;
    if (this.driver) {
      pi = (k.KeyS || k.ArrowDown ? 1 : 0) - (k.KeyW || k.ArrowUp ? 1 : 0);
      ro = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0);
      this.throttle = clamp(this.throttle + ((k.ShiftLeft || k.ShiftRight ? 1 : 0) - (k.KeyC ? 1 : 0)) * 0.6 * dt, 0, 1);
    } else if (this.autopilot) {
      this.throttle = 0.75; this.pitch = damp(this.pitch, 0.1, 1, dt); this.roll = damp(this.roll, 0, 2, dt);
      this.gone += dt; if (this.gone > 40) { this.dead = true; this.mesh.visible = false; return; }
    } else if (this.onGround) this.throttle = 0;
    if (this.onGround) {
      this.speed += (this.throttle * 17 - 1.2 - this.speed * 0.26) * dt;
      if (this.throttle < 0.05) this.speed -= 10 * dt;
      this.speed = Math.max(0, this.speed);
      this.yaw -= ro * 0.9 * clamp(this.speed / 8, 0, 1) * dt;
      this.pitch = damp(this.pitch, 0, 5, dt); this.roll = damp(this.roll, 0, 5, dt);
      this.pos.x += Math.sin(this.yaw) * this.speed * dt; this.pos.z += Math.cos(this.yaw) * this.speed * dt; this.pos.y = 1.3;
      const ax = this.pos.x, az = this.pos.z;
      if (g.world.resolveCircle(this.pos, 3, 0, 3)) { if (this.speed > 14 && Math.hypot(this.pos.x - ax, this.pos.z - az) > 0.05) return this.crash(); this.speed *= 0.9; }
      if (this.speed > 33 && pi > 0) { this.onGround = false; this.pitch = 0.14; this.pos.y += 0.4; }
    } else {
      this.pitch = clamp(this.pitch + pi * 0.8 * dt, -1.1, 1.1);
      this.roll = clamp(this.roll + ro * 1.6 * dt, -1.25, 1.25);
      if (!ro) this.roll = damp(this.roll, 0, 1.3, dt);
      this.yaw -= Math.sin(this.roll) * 0.85 * dt;
      const target = 28 + this.throttle * 52;
      this.speed += ((target - this.speed) * 0.45 - Math.sin(this.pitch) * 14) * dt;
      this.speed = clamp(this.speed, 12, 95);
      if (this.speed < 27) this.pitch -= (27 - this.speed) * 0.05 * dt * 8;
      if (this.pos.y > 850 && this.pitch > 0) this.pitch = damp(this.pitch, -0.1, 2, dt);
      const R = Math.hypot(this.pos.x, this.pos.z);
      if (R > 2500 && this.driver) {
        this.yaw = turnToward(this.yaw, Math.atan2(-this.pos.x, -this.pos.z), 0.9 * dt);
        this.warnT -= dt; if (this.warnT <= 0) { this.warnT = 6; g.hud.banner('LEAVING OPERATION AREA', 'Autopilot is turning you back'); }
      }
      const cp = Math.cos(this.pitch);
      this.vy = Math.sin(this.pitch) * this.speed - Math.max(0, 30 - this.speed) * 0.9;
      this.pos.x += Math.sin(this.yaw) * cp * this.speed * dt; this.pos.z += Math.cos(this.yaw) * cp * this.speed * dt; this.pos.y += this.vy * dt;
      if (g.world.inside(this.pos.x, this.pos.y, this.pos.z, 1.5)) return this.crash();
      if (this.pos.y <= 1.3) {
        if (this.vy > -10 && Math.abs(this.roll) < 0.6 && this.pitch > -0.38) { this.onGround = true; this.pos.y = 1.3; if (this.driver) g.hud.banner('TOUCHDOWN', ''); }
        else return this.crash();
      }
    }
    this.prop.rotation.z += dt * (6 + this.throttle * 40);
    this.sync();
  }
  sync() { this.mesh.position.copy(this.pos); this.mesh.rotation.set(-this.pitch, this.yaw, this.roll); }
  hit(d) { this.hp -= d; if (this.hp <= 0) this.crash(); }
  crash() {
    if (this.dead) return;
    this.dead = true;
    const g = this.g;
    g.fx.explosion(this.pos.clone(), 12);
    g.audio.explosion(clamp(1.2 - this.pos.distanceTo(g.player.pos) / 300, 0, 1));
    this.mesh.visible = false;
    if (this.driver) { this.driver = null; g.player.die('You went down with the aircraft.'); }
  }
}
