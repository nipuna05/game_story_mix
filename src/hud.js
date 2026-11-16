import * as THREE from 'three';
import { PACK_ITEMS } from './gear.js';
import { clamp, dist2 } from './util.js';

const $ = (id) => document.getElementById(id);
const _v = new THREE.Vector3();
const TAG_NAMES = { guard: 'GUARD', heavy: 'HEAVY', sniper: 'SNIPER', thug: 'FIGHTER', boss: 'TARGET' };
const RIVAL_HEX = ['e8b020', '2a7ad2', '30a860', 'b040c0'];
const keysets = (L) => ({
  foot: [[`${L('KeyW')} ${L('KeyA')} ${L('KeyS')} ${L('KeyD')}`, 'Move'], ['Mouse', 'Look'], [L('ShiftLeft'), 'Sprint'], [L('KeyC'), 'Crouch'], [L('KeyZ'), 'Crawl (prone)'], [L('KeyV'), 'Sneak walk (hold)'], [L('Space'), 'Jump / stand up'], ['L-click', 'Fire / punch'], ['R-click', 'Aim / block'], [L('KeyR'), 'Reload'], ['1-4', 'Weapons'], [L('KeyF'), 'Kick / takedown'], [L('KeyG'), 'Grenade'], [L('KeyE'), 'Use · pick up · enter'], [L('KeyU'), 'Drop weapon'], [`${L('KeyQ')} ${L('KeyX')} ${L('KeyT')} ${L('KeyY')}`, 'Backpack items'], [L('KeyB'), 'Brightness'], [L('KeyH'), 'Full manual']],
  car: [[`${L('KeyW')} / ${L('KeyS')}`, 'Gas / brake'], [`${L('KeyA')} / ${L('KeyD')}`, 'Steer'], [L('Space'), 'Handbrake'], [L('KeyE'), 'Get out'], [L('KeyB'), 'Brightness']],
  plane: [[`${L('ShiftLeft')} / ${L('KeyC')}`, 'Throttle'], [`${L('KeyS')} / ${L('KeyW')}`, 'Pull up / down'], [`${L('KeyA')} / ${L('KeyD')}`, 'Bank'], [L('KeyJ'), 'Bail out'], [L('KeyE'), 'Exit (landed)']],
  air: [[L('Space'), 'Open parachute'], [`${L('KeyA')} / ${L('KeyD')}`, 'Steer'], [`${L('KeyW')} / ${L('KeyS')}`, 'Dive / flare']],
});
const PACK_NAMES = { med: 'Med', plate: 'Plate', noise: 'Decoy', ammo: 'Ammo' };

export class Hud {
  constructor(g) {
    this.g = g;
    this.el = $('hud');
    this.map = $('minimap').getContext('2d'); this.rmap = $('racemap').getContext('2d');
    this.queue = []; this.radioT = 0; this.bannerT = 0; this.hitT = 0; this.hurtK = 0;
    this.timer = ''; this.big = ''; this.objDirty = true; this.showObj = true; this.frame = 0; this.keysOn = false; this.keysT = 0;
    this.cache = {}; this.tagEls = [];
  }
  show(on) { this.el.classList.toggle('hidden', !on); }
  reset() { this.keysT = 20; this.cache.keysSet = null; this.queue = []; this.radioT = 0; this.bannerT = 0; this.timer = ''; this.big = ''; this.objDirty = true; $('radio').style.display = 'none'; $('banner').style.opacity = 0; this.hurtK = 0; }
  set(id, prop, val) { const k = id + prop; if (this.cache[k] !== val) { this.cache[k] = val; if (prop === 'text') $(id).textContent = val; else $(id).style[prop] = val; } }

  banner(title, sub = '') { $('bannerTitle').textContent = title; $('bannerSub').textContent = sub; $('banner').style.opacity = 1; this.bannerT = 2.6; }
  radio(who, text) { this.queue.push({ who, text }); }
  hurt() { this.hurtK = 1; }
  hitMark(kill) { const h = $('hitmark'); h.classList.toggle('kill', !!kill); this.hitT = kill ? 0.35 : 0.18; }

  update(dt) {
    const g = this.g, p = g.player, m = g.mission;
    this.frame++;
    // on-screen key list: shown for the first seconds of a mission, toggled with K
    if (g.input.pressed.KeyK) { this.keysOn = !(this.keysOn || this.keysT > 0); this.keysT = 0; }
    this.keysT = Math.max(0, this.keysT - dt);
    const show = this.keysOn || this.keysT > 0, kset = !show ? '' : p.mode === 'foot' ? 'foot' : p.mode === 'car' ? 'car' : p.mode === 'plane' ? 'plane' : 'air';
    const ks = kset ? kset + g.input.bindVer : '';
    if (this.cache.keysSet !== ks) {
      this.cache.keysSet = ks;
      const el = $('keys');
      if (!kset) el.style.display = 'none';
      else { el.innerHTML = '<h4>KEYS <span>K to hide</span></h4>' + keysets((id) => g.input.label(id))[kset].map(([k, v]) => `<div><b>${k}</b>${v}</div>`).join(''); el.style.display = 'block'; }
    }
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
    this.set('stance', 'text', p.mode === 'chute' ? 'PARACHUTE' : p.mode === 'fall' ? 'FREEFALL' : !foot ? '' : p.prone ? (p.hidden ? 'PRONE · IN BRUSH' : 'PRONE · CRAWLING') : p.wet ? 'WADING · HIDDEN' : p.hidden ? (p.crouch ? 'HIDDEN IN BRUSH' : 'IN BRUSH · CROUCH TO HIDE') : p.crouch ? 'CROUCHED · QUIET' : p.sneaking ? 'SNEAKING · QUIET' : 'STANDING');
    const wd = p.W[p.cur], st = p.inv[p.cur];
    this.set('weapon', 'display', foot ? '' : 'none');
    this.set('wName', 'text', wd.name.toUpperCase());
    this.set('wAmmo', 'text', wd.melee ? '—' : p.reloadT > 0 ? 'RELOAD' : `${st.mag} / ${st.res}`);
    this.set('wPack', 'text', Object.entries(p.pack).filter(([k, n]) => n > 0 && PACK_NAMES[k]).map(([k, n]) => `${g.input.label(PACK_ITEMS[k].key)} ${PACK_NAMES[k]} ${n}`).join(' · ') || 'PACK EMPTY');
    this.set('wExtra', 'text', `GRENADES ${p.grenades + (p.pack.nade | 0)}` + (p.lockFists ? ' · NO WEAPONS' : ''));
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
    if (it) prompt = it.text; else if (p.takedown) prompt = `[${g.input.label('KeyF')}] Silent takedown`;
    else if (p.mode === 'plane' && v) prompt = v.airborne ? `[${g.input.label('KeyJ')}] Bail out` : v.speed < 1 ? `Hold ${g.input.label('ShiftLeft')} for throttle · ${g.input.label('KeyS')} to lift off at 120 km/h · [${g.input.label('KeyE')}] get out` : '';
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

    this.updateTags(p);
    if (this.frame % 2 === 0) this.drawMap(t);
    const ro = m && m.cur && m.cur.type === 'race' ? m.cur : null;
    this.set('racemap', 'display', ro ? 'block' : 'none');
    if (ro && this.frame % 2 === 0) this.drawRaceMap(ro);
  }

  // whole-track map for races: roads, the route with arrows, numbered checkpoints, you and the rivals
  drawRaceMap(o) {
    const g = this.g, p = g.player, s = o.st, c = this.rmap, S = 210, pad = 22, R = g.P.race, n = R.length;
    if (!s.cps) return;
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (const q of R) { x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); z0 = Math.min(z0, q.z); z1 = Math.max(z1, q.z); }
    const span = Math.max(x1 - x0, z1 - z0, 80), sc = (S - 2 * pad) / span, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const X = (x) => S / 2 + (x - cx) * sc, Y = (z) => S / 2 - (z - cz) * sc;
    if (!s.mapBase) { // buildings never move: draw them once
      const b = document.createElement('canvas'); b.width = b.height = S;
      const bc = b.getContext('2d'); bc.fillStyle = 'rgba(150,170,190,0.30)';
      for (const bx of g.world.boxes) {
        if (bx.y1 < 1.5) continue;
        const px = X(bx.x0), py = Y(bx.z1), w = (bx.x1 - bx.x0) * sc, h = (bx.z1 - bx.z0) * sc;
        if (px + w < 0 || px > S || py + h < 0 || py > S) continue;
        bc.fillRect(px, py, Math.max(1, w), Math.max(1, h));
      }
      s.mapBase = b;
    }
    c.clearRect(0, 0, S, S); c.drawImage(s.mapBase, 0, 0);
    const seq = [R[0], ...s.cps], cp = Math.min(s.cp, s.cps.length - 1);
    c.lineCap = 'round'; c.lineJoin = 'round';
    for (let i = 0; i < s.cps.length; i++) {   // route: done = dim, current = cyan, ahead = amber
      const a = seq[i], b = seq[i + 1], done = i < s.cp, cur = i === s.cp;
      c.strokeStyle = done ? 'rgba(255,255,255,0.15)' : cur ? '#4fd1c5' : 'rgba(255,178,62,0.85)';
      c.lineWidth = cur ? 4 : 3; c.beginPath(); c.moveTo(X(a.x), Y(a.z)); c.lineTo(X(b.x), Y(b.z)); c.stroke();
      if (!done) { // direction arrow at the middle of the leg
        const mx = (X(a.x) + X(b.x)) / 2, my = (Y(a.z) + Y(b.z)) / 2, ang = Math.atan2(Y(b.z) - Y(a.z), X(b.x) - X(a.x));
        c.save(); c.translate(mx, my); c.rotate(ang); c.fillStyle = c.strokeStyle; c.beginPath(); c.moveTo(5, 0); c.lineTo(-4, -4); c.lineTo(-4, 4); c.fill(); c.restore();
      }
    }
    c.font = '700 10px Consolas, monospace'; c.textAlign = 'center'; c.textBaseline = 'middle';
    for (let k = 0; k < n; k++) {   // checkpoints: S/F is the start line, then 1, 2, 3 ...
      const q = R[k], isNext = s.state === 'run' && q === s.cps[cp];
      c.fillStyle = k === 0 ? '#ffffff' : isNext ? '#4fd1c5' : '#ffb23e'; c.beginPath(); c.arc(X(q.x), Y(q.z), isNext ? 8 : 6.5, 0, 7); c.fill();
      c.fillStyle = '#111'; c.fillText(k === 0 ? 'S' : String(k), X(q.x), Y(q.z) + 0.5);
    }
    for (let i = 0; i < s.rivals.length; i++) { const r = s.rivals[i]; c.fillStyle = '#' + RIVAL_HEX[i % RIVAL_HEX.length]; c.beginPath(); c.arc(X(r.pos.x), Y(r.pos.z), 3.5, 0, 7); c.fill(); }
    if (p.vehicle !== s.car) { c.fillStyle = '#4fd1c5'; c.fillRect(X(s.car.pos.x) - 4, Y(s.car.pos.z) - 4, 8, 8); }
    const yaw = p.vehicle ? p.vehicle.yaw : p.yaw;
    c.save(); c.translate(X(p.pos.x), Y(p.pos.z)); c.rotate(yaw); c.fillStyle = '#fff'; c.strokeStyle = '#000'; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(0, -7); c.lineTo(5, 6); c.lineTo(0, 3); c.lineTo(-5, 6); c.closePath(); c.fill(); c.stroke(); c.restore();
    c.fillStyle = 'rgba(255,255,255,0.8)'; c.textAlign = 'left'; c.textBaseline = 'top';
    const laps = Math.max(1, Math.round(s.cps.length / n)), lap = Math.min(laps, Math.floor(Math.min(s.cp, s.cps.length - 1) / n) + 1);
    c.fillText('RACE ROUTE' + (laps > 1 ? `  LAP ${lap}/${laps}` : ''), 8, 6);
    c.textAlign = 'right'; c.fillStyle = s.state === 'run' ? '#4fd1c5' : '#ffb23e'; c.fillText(s.state === 'run' ? (((s.cp + 1) % n === 0) ? 'NEXT: FINISH' : `NEXT: CP ${(s.cp + 1) % n}`) : s.state === 'count' ? 'GET READY' : 'GET IN THE CAR', S - 8, 6);
  }

  // name tags over enemies you have zoomed in on
  updateTags(p) {
    const g = this.g, cam = g.camera, W = innerWidth, H = innerHeight;
    let n = 0;
    for (const e of g.enemies) {
      if (e.dead || !(e.tagT > 0) || n >= 12) continue;
      _v.set(e.pos.x, e.pos.y + 2.3, e.pos.z);
      if (_v.clone().applyMatrix4(cam.matrixWorldInverse).z > 0) continue;
      _v.project(cam);
      let el = this.tagEls[n];
      if (!el) { el = document.createElement('div'); $('etags').appendChild(el); this.tagEls[n] = el; }
      el.style.display = 'block'; el.style.transform = `translate(${((_v.x * 0.5 + 0.5) * W) | 0}px,${((-_v.y * 0.5 + 0.5) * H) | 0}px)`;
      const cls = 'etag ' + (e.alerted ? 'hot' : 'cold'); if (el.className !== cls) el.className = cls;
      const txt = `${TAG_NAMES[e.type] || 'ENEMY'} ${Math.round(dist2(e.pos.x, e.pos.z, p.pos.x, p.pos.z))}m${e.alerted ? ' !' : ''}`;
      if (el.textContent !== txt) el.textContent = txt;
      n++;
    }
    for (let i = n; i < this.tagEls.length; i++) this.tagEls[i].style.display = 'none';
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
      if (dist2(e.pos.x, e.pos.z, px, pz) > range * 1.1 && !e.alerted && !(e.tagT > 0)) continue;
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
