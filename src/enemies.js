import * as THREE from 'three';
import { makeHumanoid, animateHumanoid } from './characters.js';
import { clamp, angDiff, turnToward, dist2, rnd } from './util.js';

const HOODS = [0x7a2a2a, 0x2a4a7a, 0x4a4a4a, 0x6a5a2a, 0x3a6a4a, 0x5a2a6a];
const TONES = [0xffffff, 0xf4dcc8, 0xe4c4a4, 0xcca684, 0xb08c6c];   // slight skin-tone shifts, so a squad is not made of clones
const CAMO = [[0x4d5a3a, 0x2e3524], [0x5a5240, 0x3a3526], [0x3f4a4f, 0x262d31], [0x4a4e3a, 0x30331f]];
const CIV_SHIRT = [0xd8cdb8, 0x8aa0b8, 0xb8a090, 0x9ab08a, 0xc0a0a0, 0x6a7a8a], CIV_PANTS = [0x55606e, 0x4a4a52, 0x6a5a48, 0x3a4a5a];
const oneOf = (a) => a[Math.floor(Math.random() * a.length)];
const VOICE_OF = { guard: 'ak47', heavy: 'm4a1', sniper: 'l118a', boss: 'ak47' };
const TINTS = [0xffa0a0, 0xa0b8ff, 0xc8c8c8, 0xffe090, 0xa0ffc8, 0xe0a0ff];
export const ENEMY_TYPES = {
  guard: { hp: 100, speed: 4.2, dmg: 7, acc: 0.5, burst: 3, range: 60, gun: true, look: () => {
    const c = oneOf(CAMO), r = Math.random(), gear = r < 0.5 ? [['beret', 0xa81e1e]] : r < 0.7 ? [['cap', 0x2a3520]] : r < 0.85 ? [['cap', 0x6b5a3a]] : [['beret', 0x1e1e22]];
    if (Math.random() < 0.35) gear.push(['pack', 0x34382a]);
    return { shirt: c[0], pants: c[1], hat: 0x8a1c1c, tint: oneOf(TONES), scale: 0.96 + Math.random() * 0.1, gunKind: 'ak47', gearList: gear };
  } },
  heavy: { hp: 220, speed: 3.4, dmg: 12, acc: 0.55, burst: 5, range: 60, gun: true, nade: true, look: () => ({ shirt: 0x2b2b30, pants: 0x1a1a1e, hat: 0x111111, scale: 1.07 + Math.random() * 0.06, tint: 0x6f6f78, gunKind: 'm4a1', gearList: [['pack', 0x2c2c26], ['rig', 0x1a1b1e]] }) },
  sniper: { hp: 80, speed: 0, dmg: 24, acc: 0.5, burst: 1, range: 150, gun: true, static: true, look: () => ({ shirt: 0x3a4a2a, pants: 0x2a3520, hat: 0x2a3520, tint: 0xa8c890, gunKind: 'l118a', gearList: [['boonie', 0x6b6a3e]] }) },
  thug: { hp: 110, speed: 5.0, dmg: 13, melee: true, look: () => { const i = Math.floor(Math.random() * HOODS.length); return { shirt: HOODS[i], pants: 0x22252c, hat: Math.random() < 0.5 ? 0x151515 : null, tint: TINTS[i], gearList: Math.random() < 0.6 ? [['cap', [0x151515, 0x7a2a2a, 0x2a4a7a][i % 3]]] : [] }; } },
  boss: { hp: 480, speed: 3.8, dmg: 13, acc: 0.62, burst: 4, range: 70, gun: true, nade: true, look: () => ({ shirt: 0x151515, pants: 0x101010, hat: 0xb01818, scale: 1.14, tint: 0xb06060, gunKind: 'ak47', gearList: [['beret', 0x0e0e10], ['pack', 0x2a2a2c]] }) },
};

// Shared ground movement with simple path following and stuck recovery.
class Walker {
  initWalk() { this.path = null; this.pi = 0; this.pathT = 0; this.goal = null; this.stuckT = 0; this.avoidT = 0; this.avoidDir = 1; this.speedNow = 0; }
  moveTo(tx, tz, speed, dt, keepFacing) {
    const p = this.pos;
    if (dist2(p.x, p.z, tx, tz) < 0.9) return true;
    this.pathT -= dt;
    if (this.pathT <= 0 || !this.goal || dist2(this.goal.x, this.goal.z, tx, tz) > 3) {
      this.pathT = 0.8 + Math.random() * 0.5;
      this.goal = { x: tx, z: tz };
      this.path = this.g.world.findPath(p.x, p.z, tx, tz);
      this.pi = 0;
    }
    let wx = tx, wz = tz;
    if (this.path) {
      while (this.pi < this.path.length - 1 && dist2(p.x, p.z, this.path[this.pi].x, this.path[this.pi].z) < 1.3) this.pi++;
      wx = this.path[this.pi].x; wz = this.path[this.pi].z;
    }
    const vx = wx - p.x, vz = wz - p.z, vl = Math.hypot(vx, vz) || 1;
    this.step(vx / vl, vz / vl, speed, dt);
    if (!keepFacing) this.yaw = turnToward(this.yaw, Math.atan2(vx, vz), 7 * dt);
    return false;
  }
  step(nx, nz, speed, dt) {
    if (this.avoidT > 0) {
      this.avoidT -= dt;
      const ax = -nz * this.avoidDir, az = nx * this.avoidDir;
      nx = nx * 0.3 + ax; nz = nz * 0.3 + az;
      const l = Math.hypot(nx, nz) || 1; nx /= l; nz /= l;
    }
    const p = this.pos, ox = p.x, oz = p.z;
    p.x += nx * speed * dt; p.z += nz * speed * dt;
    this.g.world.resolveCircle(p, 0.4, p.y, 1.8);
    const moved = Math.hypot(p.x - ox, p.z - oz);
    if (moved < speed * dt * 0.35) {
      this.stuckT += dt;
      if (this.stuckT > 0.4) { this.stuckT = 0; this.avoidT = 0.7; this.avoidDir = Math.random() < 0.5 ? -1 : 1; this.pathT = 0; }
    } else this.stuckT = 0;
    this.speedNow = dt > 0 ? moved / dt : 0;
  }
}

export class Enemy extends Walker {
  constructor(g, type, x, z, yaw = 0, o = {}) {
    super();
    this.g = g; this.type = type; this.def = ENEMY_TYPES[type];
    this.pos = new THREE.Vector3(x, o.y || 0, z);
    this.yaw = yaw; this.homeYaw = yaw; this.home = { x, z };
    this.hp = this.def.hp * (o.hpMul || 1);
    this.route = o.route || null; this.ri = o.ri || 0; this.wait = 0;
    this.state = this.route ? 'patrol' : 'idle';
    this.aw = 0; this.last = { x, z }; this.lostT = 0; this.alertT = 0; this.searchT = 0; this.lookT = 0;
    this.tagT = 0; this.fireCd = rnd(0.2, 0.8); this.burstN = 0; this.react = 0; this.strafe = 1; this.strafeT = 0;
    this.losT = Math.random() * 0.15; this.sees = false; this.dead = false; this.deadT = 0;
    this.neutral = !!o.neutral; this.noAlarm = !!o.noAlarm; this.name = o.name || null;
    this.stagger = 0; this.windup = 0; this.meleeCd = 0; this.seed = Math.random() * 10;
    this.cover = null; this.coverT = 0; this.coverCd = rnd(1, 4); this.hitT = 0; this.bursts = 0; this.nadeCd = rnd(5, 10); this.crouching = false;
    this.initWalk();
    this.h = makeHumanoid({ ...this.def.look(), gun: this.def.gun, mark: true });
    this.h.group.position.copy(this.pos); this.h.group.rotation.y = yaw;
    g.scene.add(this.h.group);
  }
  get alerted() { return this.state === 'alert'; }

  viewRange(p) {
    const g = this.g;
    let r = g.world.theme.view * (this.type === 'sniper' ? 2.2 : 1) * g.mods.view * g.diff.view;
    if (p.crouch && p.mode === 'foot') r *= 0.6;
    if (p.prone && p.mode === 'foot') r *= 0.55;
    if (p.sneaking) r *= 0.85;
    if (p.hidden) r *= (p.crouch || p.prone) ? 0.3 : 0.65;
    if (p.wet) r *= 0.65;
    if (p.mode === 'car' || p.mode === 'chute') r *= 1.5;
    if (g.alarm) r *= 1.25;
    if (this.state === 'alert') r *= 1.8;
    return r;
  }
  canSee(p, tp, d, dx, dz) {
    if (tp.y - this.pos.y > 45) return false;
    if (d > this.viewRange(p)) return false;
    if (this.state !== 'alert' && d > 2.2 && Math.abs(angDiff(this.yaw, Math.atan2(dx, dz))) > 1.0) return false;
    return this.g.world.los(this.pos.x, this.pos.y + 1.6, this.pos.z, tp.x, tp.y, tp.z);
  }

  update(dt) {
    const g = this.g, p = g.player;
    if (this.dead) { animateHumanoid(this.h, { dead: true }, dt); return; }
    this.speedNow = 0; if (this.tagT > 0) this.tagT -= dt; if (this.hitT > 0) this.hitT -= dt;
    if (this.stagger > 0) { this.stagger -= dt; this.sync(dt); return; }
    const tp = p.targetPos(), dx = tp.x - this.pos.x, dz = tp.z - this.pos.z, d = Math.hypot(dx, dz);
    if (!this.neutral && !p.dead && !(g.truce && !this.noAlarm)) {
      this.losT -= dt;
      if (this.losT <= 0) { this.losT = 0.12 + Math.random() * 0.06; this.sees = this.canSee(p, tp, d, dx, dz); }
      if (this.sees) {
        const range = this.viewRange(p);
        this.aw += dt * (0.4 + 2.3 * (1 - d / range)) * (this.state === 'search' || this.state === 'suspicious' ? 1.8 : 1) * g.diff.notice;
        if (d < 3) this.aw = 1;
      } else this.aw -= dt * 0.22;
      this.aw = clamp(this.aw, 0, 1);
      if (this.state !== 'alert') {
        if (this.aw >= 1) this.alert(tp);
        else if (this.aw > 0.4 && this.sees && (this.state === 'idle' || this.state === 'patrol')) { this.state = 'suspicious'; this.last = { x: tp.x, z: tp.z }; this.wait = 0.9; this.lookT = 0; }
      }
    } else this.sees = false;

    switch (this.state) {
      case 'idle':
        if (!this.def.static && dist2(this.pos.x, this.pos.z, this.home.x, this.home.z) > 1.5) this.moveTo(this.home.x, this.home.z, 1.8, dt);
        else this.yaw = turnToward(this.yaw, this.homeYaw + Math.sin(g.time * 0.5 + this.seed) * 0.7, 1.5 * dt);
        break;
      case 'patrol':
        if (this.wait > 0) { this.wait -= dt; this.yaw += Math.sin(g.time * 1.3 + this.seed) * dt * 0.8; }
        else { const t = this.route[this.ri]; if (this.moveTo(t.x, t.z, 1.7, dt)) { this.ri = (this.ri + 1) % this.route.length; this.wait = rnd(1, 3); } }
        break;
      case 'suspicious':
        this.wait -= dt;
        if (this.wait > 0 || this.def.static) {
          this.yaw = turnToward(this.yaw, Math.atan2(this.last.x - this.pos.x, this.last.z - this.pos.z), 4 * dt);
          if (this.def.static && this.wait < -4) this.calm();
        } else if (this.moveTo(this.last.x, this.last.z, 2.4, dt)) {
          this.lookT += dt; this.yaw += Math.sin(this.lookT * 2) * dt * 1.6;
          if (this.lookT > 3.5) this.calm();
        }
        break;
      case 'search':
        this.searchT -= dt;
        if (this.def.static) this.yaw = turnToward(this.yaw, Math.atan2(this.last.x - this.pos.x, this.last.z - this.pos.z), 4 * dt);
        else if (this.moveTo(this.last.x, this.last.z, 3.8, dt)) this.last = { x: this.last.x + rnd(-10, 10), z: this.last.z + rnd(-10, 10) };
        if (this.searchT <= 0) this.calm();
        break;
      case 'alert': {
        this.alertT += dt;
        if (this.sees) { this.last = { x: tp.x, z: tp.z }; this.lostT = 0; } else this.lostT += dt;
        if (this.lostT > 7 || p.dead) { this.state = 'search'; this.searchT = 12; break; }
        const face = Math.atan2(dx, dz);
        // tactics: after a few bursts, or when hit, dive for cover and shoot from there; heavies also throw grenades
        if (!this.def.melee && !this.def.static) {
          this.coverCd -= dt; this.nadeCd -= dt;
          if (!this.cover && this.coverCd <= 0 && this.sees && d > 8 && d < 55 && (this.hitT > 0 || this.bursts >= 3)) {
            this.coverCd = rnd(5, 8); this.bursts = 0;
            const c = this.findCover(tp, d);
            if (c) { this.cover = c; this.coverT = rnd(2.4, 4.0); }
          }
          if (this.def.nade && this.sees && this.nadeCd <= 0 && d > 8 && d < 34) { this.nadeCd = rnd(11, 17); g.enemyGrenade(this, tp); }
          if (this.cover) {
            const arrived = this.moveTo(this.cover.x, this.cover.z, 5.0, dt);
            this.crouching = arrived;
            this.coverT -= dt;
            if (this.coverT <= 0) { this.cover = null; this.crouching = false; }
            else if (arrived) this.yaw = turnToward(this.yaw, Math.atan2(this.last.x - this.pos.x, this.last.z - this.pos.z), 5 * dt);
            if (!(arrived && this.sees)) break;   // running to cover: no shooting; sitting in cover: shoot only when we can see
          }
        }
        if (this.def.melee) {
          this.meleeCd -= dt;
          this.yaw = turnToward(this.yaw, face, 8 * dt);
          if (this.windup > 0) {
            this.windup -= dt;
            if (this.windup <= 0) {
              if (d < 2.4 && p.mode === 'foot') { p.damage(this.def.dmg * g.diff.dmg * (p.blocking ? 0.2 : 1), this.pos, 'melee'); g.audio.punch(); }
              this.meleeCd = rnd(0.7, 1.2);
            }
          } else if (d > 1.7) this.moveTo(this.sees ? tp.x : this.last.x, this.sees ? tp.z : this.last.z, this.def.speed, dt, true);
          else if (this.meleeCd <= 0) { this.windup = 0.42; this.h.punchT = 0; }
        } else if (this.sees) {
          this.yaw = turnToward(this.yaw, face, 6 * dt);
          if (!this.def.static && !this.cover) {
            if (d > 32) this.moveTo(tp.x, tp.z, this.def.speed, dt, true);
            else if (d < 7) this.step(-dx / d, -dz / d, 2.4, dt);
            else {
              this.strafeT -= dt;
              if (this.strafeT <= 0) { this.strafeT = rnd(1, 2.5); this.strafe = Math.random() < 0.4 ? -1 : Math.random() < 0.65 ? 1 : 0; }
              if (this.strafe) this.step(-dz / d * this.strafe, dx / d * this.strafe, 1.6, dt);
            }
          }
          this.react -= dt;
          if (this.react <= 0) {
            this.fireCd -= dt;
            if (this.fireCd <= 0) {
              this.fire(d, tp, p);
              if (++this.burstN >= this.def.burst) { this.burstN = 0; this.bursts++; this.fireCd = this.type === 'sniper' ? rnd(2.4, 3.4) : rnd(0.9, 1.7); } else this.fireCd = 0.13;
            }
          }
        } else if (!this.def.static) this.moveTo(this.last.x, this.last.z, this.def.speed, dt);
        break;
      }
    }
    this.sync(dt);
  }

  fire(d, tp, p) {
    const g = this.g, def = this.def;
    let ch = def.acc * clamp(1.15 - d / def.range, 0.12, 1) * g.diff.acc;
    if (p.crouch) ch *= 0.8;
    if (p.speed > 5) ch *= 0.7;
    if (p.mode === 'car') ch *= 0.7;
    if (p.mode === 'chute') ch *= 0.45;
    const hit = Math.random() < ch;
    const mz = new THREE.Vector3(this.pos.x + Math.sin(this.yaw) * 0.6, this.pos.y + 1.45, this.pos.z + Math.cos(this.yaw) * 0.6);
    const end = new THREE.Vector3(tp.x, tp.y, tp.z);
    if (!hit) { end.x += rnd(-1.6, 1.6); end.y += rnd(-0.6, 1.4); end.z += rnd(-1.6, 1.6); end.sub(mz).multiplyScalar(1.4).add(mz); }
    g.fx.tracer(mz, end, 0xffc070);
    g.fx.flash(mz, 0xffb060, 30, 0.06);
    { const sp = g.spatial(this.pos, 170); g.audio.gun(VOICE_OF[this.type] || 'ak47', sp.vol * 0.9, sp.pan, sp.far, false); }
    if (hit) p.damage(def.dmg * g.diff.dmg, this.pos, 'gun');
    const vip = g.vip;   // an escorted VIP in range draws fire too
    if (vip && !vip.dead && vip.state !== 'safe' && vip.state !== 'captive' && dist2(this.pos.x, this.pos.z, vip.pos.x, vip.pos.z) < def.range * 0.7 && Math.random() < 0.22) {
      const ve = new THREE.Vector3(vip.pos.x, 1.2, vip.pos.z); g.fx.tracer(mz, ve, 0xffc070);
      if (Math.random() < 0.5) vip.damage(def.dmg * 0.7);
    }
    if (this.burstN === 0) g.shout(this, 45, tp);
  }

  // a reachable spot close by that is out of the player's line of sight and not nearer to the player
  findCover(tp, d) {
    const w = this.g.world;
    let best = null, bd = 1e9;
    for (let k = 0; k < 14; k++) {
      const a = (k / 14) * Math.PI * 2, r = 4 + (k % 3) * 2.5, x = this.pos.x + Math.sin(a) * r, z = this.pos.z + Math.cos(a) * r;
      const q = { x, y: 0, z }; w.resolveCircle(q, 0.5, this.pos.y, 1.8);
      if (Math.abs(q.x - x) > 0.05 || Math.abs(q.z - z) > 0.05) continue;           // that spot is inside something
      if (Math.hypot(tp.x - x, tp.z - z) < d * 0.8 - 1) continue;                   // do not run toward the player
      if (!w.segClear(this.pos.x, this.pos.z, x, z)) continue;
      if (w.los(x, 0.95, z, tp.x, tp.y, tp.z)) continue;                            // still visible when crouched
      if (r < bd) { bd = r; best = { x, z }; }
    }
    return best;
  }

  alert(tp) {
    if (this.dead || this.neutral) return;
    const was = this.state === 'alert';
    this.state = 'alert'; this.aw = 1; this.last = { x: tp.x, z: tp.z }; this.lostT = 0;
    if (!was) { this.alertT = 0; this.react = 0.7; this.g.onEnemyAlert(this); }
  }
  hear(pos, loud) {
    if (this.dead || this.neutral || this.state === 'alert') return;
    this.last = { x: pos.x, z: pos.z };
    if (loud) { this.state = 'search'; this.searchT = 12; this.aw = Math.max(this.aw, 0.6); }
    else if (this.state === 'idle' || this.state === 'patrol') { this.state = 'suspicious'; this.wait = 0.8; this.lookT = 0; }
  }
  calm() { this.state = this.route ? 'patrol' : 'idle'; this.aw = 0; this.path = null; this.goal = null; this.wait = 0; }

  damage(d, info = {}) {
    if (this.dead) return;
    this.hp -= d; this.hitT = 2;
    if (this.neutral) this.neutral = false;
    if (this.hp <= 0) return this.die(info);
    if (info.melee) this.stagger = 0.3;
    if (this.state !== 'alert') this.alert(this.g.player.targetPos());
  }
  die(info = {}) {
    if (this.dead) return;
    this.dead = true; this.state = 'dead'; this.hp = 0;
    this.g.onEnemyKilled(this, info);
  }

  sync(dt) {
    const h = this.h;
    const g = this.g, pp = g.player.pos;
    if (h.setLod) h.setLod(!this.dead && Math.hypot(pp.x - this.pos.x, pp.z - this.pos.z) > 100);
    animateHumanoid(h, { speed: this.speedNow, aim: this.def.gun && this.state === 'alert', crouch: this.crouching, far: Math.abs(pp.x - this.pos.x) + Math.abs(pp.z - this.pos.z) > 110 }, dt);
    h.group.position.copy(this.pos); h.group.rotation.y = this.yaw;
    if (g.world.waters.length && this.pos.y < 0.5 && g.world.inWater(this.pos.x, this.pos.z)) h.group.position.y -= 0.75;
    const m = h.mark;
    if (this.state === 'alert') { m.visible = true; m.material.color.setHex(0xff3030); m.scale.setScalar(1.2); }
    else if (this.aw > 0.12 || this.state === 'search' || this.state === 'suspicious') { m.visible = true; m.material.color.setHex(0xffd23c); m.scale.setScalar(0.5 + this.aw * 0.7); }
    else m.visible = false;
    m.rotation.y += dt * 3;
  }
  remove() { this.g.scene.remove(this.h.group); }
}

export class Hostage extends Walker {
  constructor(g, x, z, o = {}) {
    super();
    this.g = g; this.pos = new THREE.Vector3(x, 0, z); this.yaw = Math.random() * 6.28;
    this.state = 'captive'; this.initWalk();
    this.vip = !!o.vip; this.hp = 100; this.dead = false;
    this.h = makeHumanoid(this.vip ? { shirt: 0x1c2a4a, pants: 0x1c1c24, tint: 0xe8d4b8, scale: 1.0, gearList: [] }
      : { shirt: oneOf(CIV_SHIRT), pants: oneOf(CIV_PANTS), tint: oneOf(TONES), scale: 0.94 + Math.random() * 0.12, gearList: Math.random() < 0.3 ? [['cap', oneOf([0x2a4a7a, 0x7a2a2a, 0x3a3a3a])]] : [] });
    this.h.group.position.copy(this.pos); g.scene.add(this.h.group);
  }
  free() { if (this.state === 'captive') this.state = 'follow'; }
  // only the escort VIP can be hurt; other hostages are never targeted
  damage(n) {
    if (!this.vip || this.dead || this.state === 'safe' || this.state === 'captive') return;
    this.hp -= n; this.g.audio.hurt(n);
    if (this.hp <= 0) {
      this.hp = 0; this.dead = true; this.state = 'dead';
      if (this.ridingIn) this.getOff();
      this.state = 'dead'; this.h.group.visible = true; this.h.group.rotation.set(-Math.PI / 2, this.yaw, 0); this.h.group.position.set(this.pos.x, 0.25, this.pos.z);
    }
  }
  getOff() {
    const v = this.ridingIn; this.ridingIn = null;
    if (v) {
      v.freeSeat(this); this.g.scene.add(this.h.group);
      this.pos.set(v.pos.x + Math.cos(v.yaw) * (v.r + 1.4), 0, v.pos.z - Math.sin(v.yaw) * (v.r + 1.4)); this.g.world.resolveCircle(this.pos, 0.4, 0, 1.8);
    }
    this.h.group.visible = true; this.h.group.rotation.set(0, this.yaw, 0); this.state = 'follow';
  }
  update(dt) {
    const g = this.g, p = g.player;
    this.speedNow = 0;
    if (this.dead) return;
    if (this.state === 'follow' || this.state === 'riding') {
      const z = g.rescueZone, v = p.vehicle;
      const canBoard = p.mode === 'car' && v && !v.dead && (this.state === 'riding' || (dist2(this.pos.x, this.pos.z, p.pos.x, p.pos.z) < 9 && v.seatsFree() > 0));
      if (canBoard && this.state !== 'riding') {
        const i = v.takeSeat(this);
        if (i >= 0) { this.state = 'riding'; this.ridingIn = v; g.audio.click(); }
      }
      if (this.state === 'riding' && (!canBoard || this.ridingIn !== v || this.ridingIn.dead)) this.getOff();
      if (this.state === 'riding') this.pos.copy(this.ridingIn.pos);
      else {
        const d = dist2(this.pos.x, this.pos.z, p.pos.x, p.pos.z);
        if (p.mode === 'foot' && d > 3) this.moveTo(p.pos.x, p.pos.z, Math.min(7.4, 2 + d * 0.8), dt);
      }
      if (z && dist2(this.pos.x, this.pos.z, z.x, z.z) < 11) {
        if (this.state === 'riding') this.getOff();
        this.state = 'safe'; this.h.group.visible = true;
        this.pos.set(z.x + rnd(-4, 4), 0, z.z + rnd(-4, 4));
        g.audio.blip(700);
      }
    }
    if (this.state === 'riding') return;   // the vehicle animates and positions its passengers
    animateHumanoid(this.h, { speed: this.speedNow, kneel: this.state === 'captive' || this.state === 'safe', hands: this.state === 'captive' ? 'tied' : null }, dt);
    this.h.group.position.copy(this.pos); this.h.group.rotation.y = this.yaw;
    if (g.world.waters.length && g.world.inWater(this.pos.x, this.pos.z)) this.h.group.position.y -= 0.75;
  }
}
