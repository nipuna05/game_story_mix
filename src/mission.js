import { dist2, fmtTime } from './util.js';
import { fill } from './story.js';

const RIVAL_COLORS = [0xe8b020, 0x2a7ad2, 0x30a860, 0xb040c0];

// Runs a mission's objective list in order and owns everything objective-specific.
export class MissionRun {
  constructor(g, def, objectives) {
    this.g = g; this.def = def;
    this.objs = objectives.map((o, i) => ({ ...o, i, doneRadio: o.done, done: false, st: {}, text: fill(o.text, g.cast) }));
    this.idx = -1; this.checkpoint = null;
  }
  get cur() { return this.objs[this.idx]; }

  setup() {
    const g = this.g, P = g.P;
    const take = (arr, n) => arr.slice(0, Math.min(n, arr.length));
    let intelUsed = 0;
    for (const o of this.objs) {
      const s = o.st;
      switch (o.type) {
        case 'collect': {
          const spots = P.intel.slice(intelUsed, intelUsed + o.count); intelUsed += o.count; o.count = spots.length;
          s.items = spots.map((p) => g.spawnPickup(o.item || 'intel', p.x, p.z));
          break;
        }
        case 'rescue': s.hostages = take(P.hostages, o.count).map((p) => g.spawnHostage(p.x, p.z)); o.count = s.hostages.length; break;
        case 'destroy': s.targets = take(P.targets, o.count).map((p) => g.spawnTarget(p.x, p.z, o.kind || 'fuel')); o.count = s.targets.length; break;
        case 'kill': {
          const b = P.boss;
          s.boss = g.spawnEnemy(o.enemy || 'boss', b.x, b.z, Math.PI, { name: fill(o.name || 'Target', g.cast) });
          g.spawnEnemy('heavy', b.x - 4, b.z - 2, Math.PI); g.spawnEnemy('heavy', b.x + 4, b.z - 2, Math.PI);
          break;
        }
        case 'fight': {
          const a = P.arena; s.thugs = [];
          for (let k = 0; k < o.count; k++) {
            const t = (k / o.count) * Math.PI * 2;
            s.thugs.push(g.spawnEnemy('thug', a.x + Math.cos(t) * 7, a.z + Math.sin(t) * 7, Math.atan2(-Math.cos(t), -Math.sin(t)), { neutral: true, noAlarm: true }));
          }
          break;
        }
        case 'race': this.setupRace(o); break;
      }
    }
  }

  start() { this.checkpoint = { x: this.g.player.pos.x, z: this.g.player.pos.z }; this.advance(); }
  advance() {
    this.idx++;
    const o = this.cur, g = this.g;
    if (!o) return g.missionComplete();
    for (const [who, text] of o.radio || []) g.hud.radio(fill(who, g.cast), fill(text, g.cast));
    if (o.type === 'rescue') g.rescueZone = g.P[o.at || 'extract'];
    // guards stand down while you are racing, brawling or still in the air
    g.truce = o.type === 'race' || o.type === 'fight' || o.type === 'fly';
    g.hud.objDirty = true;
  }
  complete() {
    const o = this.cur, g = this.g, p = g.player;
    o.done = true;
    g.audio.blip(660);
    g.hud.banner('OBJECTIVE COMPLETE', o.text);
    for (const [who, text] of o.doneRadio || []) g.hud.radio(fill(who, g.cast), fill(text, g.cast));
    if (p.mode === 'foot' || p.mode === 'car') this.checkpoint = { x: p.pos.x, z: p.pos.z };
    this.advance();
  }

  progress(o) {
    const s = o.st;
    if (o.type === 'collect' || o.type === 'rescue' || o.type === 'destroy') return `${s.n || 0}/${o.count}`;
    if (o.type === 'fight' && s.started) return `${s.thugs.filter((t) => t.dead).length}/${o.count}`;
    return '';
  }

  update(dt) {
    const o = this.cur; if (!o) return;
    const g = this.g, p = g.player, P = g.P, s = o.st;
    if (o.timeLimit) {
      s.t = (s.t ?? o.timeLimit) - dt;
      g.hud.timer = 'TIME ' + fmtTime(s.t);
      if (s.t <= 0) return g.fail(fill(o.failText || 'You ran out of time.', g.cast));
    }
    if (o.noAlarm && g.alarm) return g.fail(fill(o.failText || 'The alarm was raised - the plaza is locked down.', g.cast));
    switch (o.type) {
      case 'fly': if (p.mode !== 'plane' || dist2(p.pos.x, p.pos.z, P.lz.x, P.lz.z) < 190) this.complete(); break;
      case 'land': if (p.mode === 'foot' && p.grounded && !p.dead) this.complete(); break;
      case 'collect': s.n = s.items.filter((i) => i.taken).length; if (s.n >= o.count) this.complete(); else g.hud.objDirty = true; break;
      case 'reach': {
        const t = P[o.at || 'extract'];
        if ((p.mode === 'foot' || p.mode === 'car') && dist2(p.pos.x, p.pos.z, t.x, t.z) < (p.mode === 'car' ? 13 : 9)) this.complete();
        break;
      }
      case 'fight': {
        if (!s.started) {
          if (p.mode === 'foot' && dist2(p.pos.x, p.pos.z, P.arena.x, P.arena.z) < 12) {
            s.started = true;
            if (o.fistsOnly) { p.lockFists = true; p.cur = 'fists'; }
            for (const t of s.thugs) { t.neutral = false; t.alert(p.targetPos()); }
            g.hud.banner('FIGHT!', 'LMB punch · RMB block · F kick');
          }
        } else if (s.thugs.every((t) => t.dead)) { p.lockFists = false; if (p.inv.pistol) p.cur = 'pistol'; this.complete(); }
        g.hud.objDirty = true;
        break;
      }
      case 'race': this.updateRace(o, dt); break;
      case 'kill': if (s.boss.dead) this.complete(); break;
      case 'rescue': s.n = s.hostages.filter((h) => h.state === 'safe').length; if (s.n >= o.count) this.complete(); else g.hud.objDirty = true; break;
      case 'destroy': s.n = s.targets.filter((t) => t.state === 'dead').length; if (s.n >= o.count) this.complete(); else g.hud.objDirty = true; break;
      case 'flyout': {
        const v = p.vehicle;
        if (p.mode === 'plane' && v.airborne) { const f = P.flyout; if (dist2(v.pos.x, v.pos.z, f.x, f.z) < 170 && v.pos.y > 50) this.complete(); }
        else if (!g.vehicles.some((x) => x.type === 'plane' && !x.dead && !x.autopilot)) { g.spawnPlane(P.plane.x, 0, P.plane.z, P.plane.yaw, false); g.hud.radio(fill('{hacker}', g.cast), 'Another aircraft just rolled out of the hangar. Get to the airstrip.'); }
        break;
      }
    }
  }

  // world position the HUD marker / light beam should point at
  target() {
    const o = this.cur; if (!o) return null;
    const g = this.g, p = g.player, P = g.P, s = o.st;
    const nearest = (list, label) => {
      let b = null, bd = 1e9;
      for (const it of list) { const d = dist2(it.pos.x, it.pos.z, p.pos.x, p.pos.z); if (d < bd) { bd = d; b = it; } }
      return b ? { x: b.pos.x, y: b.pos.y + 1.5, z: b.pos.z, label } : null;
    };
    const at = (pt, label, y = 1.5, r = 0) => ({ x: pt.x, y, z: pt.z, label, r });
    switch (o.type) {
      case 'fly': return at(P.lz, 'DROP ZONE', p.pos.y, 60);
      case 'land': return at(P.lz, 'LANDING ZONE', 1.5, 20);
      case 'collect': return nearest(s.items.filter((i) => !i.taken), (o.item || 'intel').toUpperCase());
      case 'reach': return at(P[o.at || 'extract'], o.at === 'arena' ? 'THE PIT' : 'EXTRACTION', 1.5, 8);
      case 'fight': return s.started ? nearest(s.thugs.filter((t) => !t.dead), 'FIGHTER') : at(P.arena, 'THE PIT', 1.5, 8);
      case 'race': return s.state === 'run' ? at(s.cps[Math.min(s.cp, s.cps.length - 1)], s.cp === s.cps.length - 1 ? 'FINISH' : 'CHECKPOINT', 1.5, 9) : at(s.car.pos, o.kind === 'bike' ? 'RACE BIKE' : 'RACE CAR');
      case 'kill': return { x: s.boss.pos.x, y: s.boss.pos.y + 2.4, z: s.boss.pos.z, label: s.boss.name.toUpperCase() };
      case 'rescue': return nearest(s.hostages.filter((h) => h.state === 'captive'), 'HOSTAGE') || at(g.rescueZone, 'SAFE ZONE', 1.5, 10);
      case 'destroy': return nearest(s.targets.filter((t) => t.state === 'idle'), 'TARGET');
      case 'flyout': {
        if (p.mode === 'plane') return at(P.flyout, 'EXIT VECTOR', P.flyout.y, 60);
        const pl = g.vehicles.find((x) => x.type === 'plane' && !x.dead && !x.autopilot);
        return pl ? at(pl.pos, 'AIRCRAFT') : null;
      }
    }
    return null;
  }

  // ---------------------------------------------------------------- racing
  setupRace(o) {
    const g = this.g, R = g.P.race, n = R.length, a = R[0], b = R[1];
    let dx = b.x - a.x, dz = b.z - a.z; const L = Math.hypot(dx, dz); dx /= L; dz /= L;
    const yaw = Math.atan2(dx, dz), cps = [];
    for (let lap = 0; lap < (o.laps || 1); lap++) for (let k = 1; k <= n; k++) cps.push(R[k % n]);
    const slot = (k) => ({ x: a.x + dx * (k * 8 - 4) + -dz * (k % 2 ? -3.4 : 3.4), z: a.z + dz * (k * 8 - 4) + dx * (k % 2 ? -3.4 : 3.4) });
    const s = o.st;
    Object.assign(s, { cps, yaw, slot, state: 'wait', cp: 0, time: 0, t: 0, rivals: [] });
    const p0 = slot(0);
    s.car = g.spawnCar(p0.x, p0.z, yaw, o.kind || 'sports', o.kind === 'bike' ? 0x8a1c1c : 0xd22b2b);
    for (let k = 1; k <= (o.rivals || 0); k++) {
      const q = slot(k), c = g.spawnCar(q.x, q.z, yaw, 'sports', RIVAL_COLORS[k - 1]);
      c.ai = { route: cps, i: 0, max: 31 + k * 1.6 }; c.frozen = true; c.locked = true;
      s.rivals.push(c);
    }
  }
  resetRace(o) {
    const s = o.st, g = this.g;
    if (s.car.dead) { const q = s.slot(0); s.car = g.spawnCar(q.x, q.z, s.yaw, o.kind || 'sports', 0xd22b2b); }
    else if (g.player.vehicle === s.car || !g.player.vehicle) { const q = s.slot(0); s.car.teleport(q.x, q.z, s.yaw); if (g.player.vehicle === s.car) g.player.camYaw = s.yaw; }
    s.rivals.forEach((c, k) => { const q = s.slot(k + 1); if (!c.dead) { c.teleport(q.x, q.z, s.yaw); c.ai.i = 0; c.frozen = true; c.hp = c.def.hp; } });
    s.cp = 0; s.time = 0; s.state = 'wait';
  }
  updateRace(o, dt) {
    const s = o.st, g = this.g, p = g.player, hud = g.hud;
    if (s.car.dead) { hud.banner('RACE VEHICLE DESTROYED', 'A new one is on the grid'); this.resetRace(o); return; }
    if (s.state === 'wait') {
      if (p.vehicle === s.car) { s.state = 'count'; s.t = 3.6; s.car.frozen = true; const q = s.slot(0); s.car.teleport(q.x, q.z, s.yaw); p.camYaw = s.yaw; }
    } else if (s.state === 'count') {
      const before = Math.ceil(s.t); s.t -= dt;
      hud.big = s.t > 0.6 ? String(Math.ceil(s.t - 0.6)) : 'GO!';
      if (Math.ceil(s.t) !== before) g.audio.beep(s.t > 0.6 ? 900 : 1500);
      if (s.t <= 0) { s.state = 'run'; s.car.frozen = false; for (const c of s.rivals) c.frozen = false; hud.big = ''; }
    } else if (s.state === 'run') {
      s.time += dt;
      const c = s.cps[s.cp];
      if (p.vehicle === s.car && dist2(s.car.pos.x, s.car.pos.z, c.x, c.z) < 14) { s.cp++; g.audio.blip(990); }
      const prog = (car, i) => (i >= s.cps.length ? 1e6 - 0 : i * 1000 - dist2(car.pos.x, car.pos.z, s.cps[i].x, s.cps[i].z));
      const mine = prog(s.car, Math.min(s.cp, s.cps.length - 1)) + (s.cp >= s.cps.length ? 1e6 : 0);
      const ahead = s.rivals.filter((r) => prog(r, r.ai.i) > mine).length;
      const finishedRivals = s.rivals.filter((r) => r.ai.i >= s.cps.length).length;
      if (o.timeTrial) {
        const left = o.timeTrial - s.time;
        hud.timer = `TIME ${fmtTime(left)}  ·  CP ${s.cp}/${s.cps.length}`;
        if (left <= 0) { hud.banner('TOO SLOW', 'The sweep caught you - back to the grid'); this.resetRace(o); return; }
      } else hud.timer = `POS ${ahead + 1}/${s.rivals.length + 1}  ·  CP ${s.cp}/${s.cps.length}  ·  ${fmtTime(s.time)}`;
      if (s.cp >= s.cps.length) {
        const place = finishedRivals + 1;
        if (o.timeTrial || place === 1) {
          for (const r of s.rivals) { r.ai = null; r.locked = false; }
          g.stats.raceTime = s.time;
          this.complete();
        } else { hud.banner(`YOU FINISHED ${place}${['', 'st', 'nd', 'rd', 'th'][Math.min(place, 4)]}`, 'First place only - back to the grid'); this.resetRace(o); }
      }
    }
  }
}
