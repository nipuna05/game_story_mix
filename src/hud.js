import * as THREE from 'three';
import { WEAPONS } from './player.js';
import { clamp, dist2 } from './util.js';

const $ = (id) => document.getElementById(id);
const _v = new THREE.Vector3();

export class Hud {
  constructor(g) {
    this.g = g;
    this.el = $('hud');
    this.map = $('minimap').getContext('2d');
    this.queue = []; this.radioT = 0; this.bannerT = 0; this.hitT = 0; this.hurtK = 0;
    this.timer = ''; this.big = ''; this.objDirty = true; this.showObj = true; this.frame = 0;
    this.cache = {};
  }
  show(on) { this.el.classList.toggle('hidden', !on); }
  reset() { this.queue = []; this.radioT = 0; this.bannerT = 0; this.timer = ''; this.big = ''; this.objDirty = true; $('radio').style.display = 'none'; $('banner').style.opacity = 0; this.hurtK = 0; }
  set(id, prop, val) { const k = id + prop; if (this.cache[k] !== val) { this.cache[k] = val; if (prop === 'text') $(id).textContent = val; else $(id).style[prop] = val; } }

  banner(title, sub = '') { $('bannerTitle').textContent = title; $('bannerSub').textContent = sub; $('banner').style.opacity = 1; this.bannerT = 2.6; }
  radio(who, text) { this.queue.push({ who, text }); }
  hurt() { this.hurtK = 1; }
  hitMark(kill) { const h = $('hitmark'); h.classList.toggle('kill', !!kill); this.hitT = kill ? 0.35 : 0.18; }

  update(dt) {
    const g = this.g, p = g.player, m = g.mission;
    this.frame++;
    // radio queue
    this.radioT -= dt;
    if (this.radioT <= 0) {
      const n = this.queue.shift();
      if (n) { $('radioWho').textContent = n.who; $('radioText').textContent = n.text; $('radio').style.display = 'block'; this.radioT = clamp(2.2 + n.text.length * 0.055, 3, 9); g.audio.radio(); }
      else $('radio').style.display = 'none';
    }
    if (this.bannerT > 0) { this.bannerT -= dt; if (this.bannerT <= 0) $('banner').style.opacity = 0; }
    this.hitT -= dt; this.set('hitmark', 'opacity', this.hitT > 0 ? 1 : 0);
    this.hurtK = Math.max(0, this.hurtK - dt * 1.4);
    this.set('vignette', 'opacity', (Math.max(this.hurtK * 0.7, p.hp < 35 ? 0.35 : 0)).toFixed(2));

    if (g.input.pressed.Tab) { this.showObj = !this.showObj; $('objectives').style.display = this.showObj ? '' : 'none'; }
    if (this.objDirty && this.frame % 6 === 0) {
      this.objDirty = false;
      let html = `<h4>${esc(g.def.title).toUpperCase()}</h4>`;
      for (const o of m.objs) {
        if (o.i > m.idx + 1) continue;
        const pr = o.i === m.idx ? m.progress(o) : '';
        html += `<div class="o ${o.done ? 'done' : o.i === m.idx ? 'cur' : ''}"><span>${o.done ? '✔' : o.i === m.idx ? '▶' : '·'}</span><span>${esc(o.text)}</span>${pr ? `<b>${pr}</b>` : ''}</div>`;
      }
      if (this.cache.obj !== html) { this.cache.obj = html; $('objectives').innerHTML = html; }
    }
    this.set('timer', 'text', this.timer); this.timer = '';
    this.set('big', 'text', this.big); this.big = '';

    // status
    this.set('hpBar', 'width', Math.round(clamp(p.hp, 0, 100)) + '%');
    this.set('arBar', 'width', Math.round(clamp(p.armor, 0, 100)) + '%');
    const foot = p.mode === 'foot';
    this.set('stance', 'text', p.mode === 'chute' ? 'PARACHUTE' : p.mode === 'fall' ? 'FREEFALL' : !foot ? '' : p.wet ? 'WADING · HIDDEN' : p.crouch ? 'CROUCHED · QUIET' : 'STANDING');
    const wd = WEAPONS[p.cur], st = p.inv[p.cur];
    this.set('weapon', 'display', foot ? '' : 'none');
    this.set('wName', 'text', wd.name.toUpperCase());
    this.set('wAmmo', 'text', wd.melee ? '—' : p.reloadT > 0 ? 'RELOAD' : `${st.mag} / ${st.res}`);
    this.set('wExtra', 'text', `GRENADES ${p.grenades}` + (p.lockFists ? ' · NO WEAPONS' : ''));
    const scope = foot && p.aiming && wd.scope;
    this.set('scope', 'display', scope ? 'block' : 'none');
    this.set('cross', 'display', foot && !scope ? '' : 'none');

    // vehicle strip
    const v = p.vehicle;
    if (v) {
      this.set('vehicle', 'display', 'block');
      if (v.type === 'plane') this.set('vehicle', 'text', `SPD ${Math.round(v.speed * 3.6)} km/h  ·  ALT ${Math.round(v.pos.y)} m  ·  THR ${Math.round(v.throttle * 100)}%${v.airborne && v.speed < 30 ? '  ·  STALL' : ''}`);
      else this.set('vehicle', 'text', `${Math.round(Math.abs(v.speed) * 3.6)} km/h  ·  ${v.name.toUpperCase()}  ·  HULL ${Math.max(0, Math.round(v.hp / v.def.hp * 100))}%`);
    } else if (p.mode === 'fall' || p.mode === 'chute') {
      this.set('vehicle', 'display', 'block');
      this.set('vehicle', 'text', `ALT ${Math.round(p.pos.y)} m  ·  ${p.mode === 'fall' ? 'PRESS SPACE TO OPEN CHUTE' : 'W DIVE · S FLARE'}`);
    } else this.set('vehicle', 'display', 'none');

    // prompt
    const it = g.interact;
    let prompt = '';
    if (it) prompt = it.text; else if (p.takedown) prompt = '[F] Silent takedown';
    else if (p.mode === 'plane' && v) prompt = v.airborne ? '[J] Bail out' : v.speed < 1 ? 'Hold SHIFT for throttle · S to lift off at 120 km/h · [E] get out' : '';
    this.set('prompt', 'display', prompt ? 'block' : 'none');
    if (prompt) {
      const k = it && it.hold ? Math.round(clamp(p.holdT / it.hold, 0, 1) * 100) : 0;
      const html = esc(prompt) + (it && it.hold ? `<div class="hold" style="width:${k}%"></div>` : '');
      if (this.cache.prompt !== html) { this.cache.prompt = html; $('prompt').innerHTML = html; }
    }

    // detection
    let aw = 0, alert = false;
    for (const e of g.enemies) { if (e.dead || e.neutral) continue; if (e.alerted) alert = true; if (e.aw > aw) aw = e.aw; }
    this.set('detectLabel', 'text', alert ? 'DETECTED' : aw > 0.4 ? 'SUSPICIOUS' : aw > 0.05 ? 'SPOTTED?' : 'HIDDEN');
    this.set('detectLabel', 'color', alert ? '#ff4d4d' : aw > 0.05 ? '#ffb23e' : '#5fd38a');
    this.set('detectBar', 'width', Math.round((alert ? 1 : aw) * 100) + '%');
    this.set('detectBar', 'background', alert ? '#ff4d4d' : '#ffb23e');
    this.set('alarm', 'display', g.alarm ? 'block' : 'none');

    // objective marker
    const t = g.markerTarget;
    if (t) {
      const cam = g.camera, W = innerWidth, H = innerHeight;
      _v.set(t.x, t.y, t.z).applyMatrix4(cam.matrixWorldInverse);
      const behind = _v.z > 0;
      _v.set(t.x, t.y, t.z).project(cam);
      let sx = (_v.x * 0.5 + 0.5) * W, sy = (-_v.y * 0.5 + 0.5) * H;
      if (behind) { sx = W - sx; sy = H - 60; }
      sx = clamp(sx, 40, W - 40); sy = clamp(sy, 110, H - 150);
      const d = Math.hypot(t.x - p.pos.x, t.y - p.pos.y, t.z - p.pos.z);
      const mk = $('marker');
      this.set('marker', 'display', 'block'); mk.style.transform = `translate(${sx.toFixed(0)}px,${sy.toFixed(0)}px)`;
      this.set('markerText', 'text', `${t.label}  ${d > 999 ? (d / 1000).toFixed(1) + ' km' : Math.round(d) + ' m'}`);
    } else this.set('marker', 'display', 'none');

    if (this.frame % 2 === 0) this.drawMap(t);
  }

  drawMap(t) {
    const g = this.g, p = g.player, c = this.map, S = 190, h = S / 2;
    const yaw = p.vehicle ? p.vehicle.yaw : p.yaw, range = p.mode === 'plane' || p.mode === 'fall' ? 420 : p.mode === 'car' ? 150 : 85, sc = h / range;
    const cs = Math.cos(yaw), sn = Math.sin(yaw), px = p.pos.x, pz = p.pos.z;
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, S, S);
    c.save(); c.beginPath(); c.arc(h, h, h - 1, 0, 7); c.clip();
    // world -> map: forward is up, right-hand side is +x
    const a = -cs * sc, cc = sn * sc, b = -sn * sc, d = -cs * sc;
    c.setTransform(a, b, cc, d, h - (a * px + cc * pz), h - (b * px + d * pz));
    c.fillStyle = 'rgba(150,170,190,0.55)';
    const R = range * 1.5;
    for (const bx of g.world.boxes) {
      if (bx.y1 < 1.5 || bx.x1 < px - R || bx.x0 > px + R || bx.z1 < pz - R || bx.z0 > pz + R) continue;
      c.fillRect(bx.x0, bx.z0, bx.x1 - bx.x0, bx.z1 - bx.z0);
    }
    const dot = (x, z, r, col) => { c.fillStyle = col; c.beginPath(); c.arc(x, z, r / sc, 0, 7); c.fill(); };
    for (const v of g.vehicles) if (!v.dead && v !== p.vehicle) dot(v.pos.x, v.pos.z, v.type === 'plane' ? 4 : 2.6, v.ai ? '#e8b020' : '#ffffff');
    for (const k of g.pickups) if (!k.taken && k.key) dot(k.pos.x, k.pos.z, 3, '#4fd1c5');
    for (const hs of g.hostages) if (hs.state !== 'riding') dot(hs.pos.x, hs.pos.z, 3, '#5fd38a');
    for (const tg of g.targets) if (tg.state !== 'dead') dot(tg.pos.x, tg.pos.z, 3.4, tg.state === 'armed' ? '#ff4d4d' : '#ffb23e');
    for (const e of g.enemies) {
      if (e.dead || e.neutral) continue;
      if (dist2(e.pos.x, e.pos.z, px, pz) > range * 1.1 && !e.alerted) continue;
      const col = e.alerted ? '#ff3b3b' : e.aw > 0.3 ? '#ffb23e' : '#e06060';
      c.strokeStyle = col; c.lineWidth = 1.2 / sc; c.beginPath(); c.moveTo(e.pos.x, e.pos.z); c.lineTo(e.pos.x + Math.sin(e.yaw) * 5 / sc * 1.4, e.pos.z + Math.cos(e.yaw) * 5 / sc * 1.4); c.stroke();
      dot(e.pos.x, e.pos.z, 2.6, col);
    }
    c.setTransform(1, 0, 0, 1, 0, 0);
    if (t) {
      const dx = t.x - px, dz = t.z - pz;
      let mx = (-cs * dx + sn * dz) * sc, my = (-sn * dx - cs * dz) * sc; const ml = Math.hypot(mx, my);
      if (ml > h - 8) { mx *= (h - 8) / ml; my *= (h - 8) / ml; }
      c.strokeStyle = '#ffb23e'; c.lineWidth = 2; c.beginPath(); c.arc(h + mx, h + my, 5, 0, 7); c.stroke();
    }
    c.fillStyle = '#fff'; c.beginPath(); c.moveTo(h, h - 7); c.lineTo(h + 5, h + 5); c.lineTo(h, h + 2); c.lineTo(h - 5, h + 5); c.fill();
    c.restore();
  }
}

function esc(s) { return String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])); }
