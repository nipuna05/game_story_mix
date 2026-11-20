// On-screen touch controls for phones and tablets. They only write into the same Input fields the keyboard, mouse and gamepad use
// (keys / pressed / buttons / dx / dy / wheel), so the rest of the game does not know the difference.
// Layout (landscape): left thumb = floating move stick (push to the edge to sprint), right thumb = drag anywhere to look,
// action buttons around the right edge. The fire button also looks while it is held, so one thumb can aim and shoot.

export const isTouchDevice = () => {
  try { return matchMedia('(pointer: coarse)').matches || /[?&]touch\b/.test(location.search); } catch { return false; }
};

const LOOK = 1.5;      // finger pixels -> mouse-like pixels (a thumb needs more reach than a mouse)
const RADIUS = 56;     // stick travel in CSS pixels

// kind: hold = down while pressed, tap = one press, toggle = flips each tap, key = a keyboard action id, btn = mouse button, wheel = next weapon
const BUTTONS = [
  { id: 'fire',   label: 'FIRE',   cls: 'fire',   kind: 'hold',   btn: 0, look: true },
  { id: 'aim',    label: 'AIM',    cls: 'aim',    kind: 'toggle', btn: 2 },
  { id: 'jump',   label: 'JUMP',   cls: 'jump',   kind: 'hold',   key: 'Space' },
  { id: 'reload', label: 'RELOAD', cls: 'reload', kind: 'tap',    key: 'KeyR' },
  { id: 'use',    label: 'USE',    cls: 'use',    kind: 'hold',   key: 'KeyE' },
  { id: 'crouch', label: 'CROUCH', cls: 'crouch', kind: 'hold',   key: 'KeyC', air: 'THR -' },
  { id: 'kick',   label: 'KICK',   cls: 'kick',   kind: 'tap',    key: 'KeyF' },
  { id: 'gren',   label: 'GREN',   cls: 'gren',   kind: 'tap',    key: 'KeyG' },
  { id: 'swap',   label: 'SWAP',   cls: 'swap',   kind: 'wheel' },
  { id: 'thr',    label: 'THR +',  cls: 'thr',    kind: 'hold',   key: 'ShiftLeft', airOnly: true },
  { id: 'prone',  label: 'PRONE',  cls: 'prone',  kind: 'tap',    key: 'KeyZ' },
  { id: 'med',    label: '+',      cls: 'pk',     kind: 'tap',    key: 'KeyQ', title: 'Medkit' },
  { id: 'plate',  label: 'ARM',    cls: 'pk',     kind: 'tap',    key: 'KeyX', title: 'Armour plate' },
  { id: 'noise',  label: 'NOISE',  cls: 'pk',     kind: 'tap',    key: 'KeyT', title: 'Noisemaker' },
  { id: 'ammo',   label: 'AMMO',   cls: 'pk',     kind: 'tap',    key: 'KeyY', title: 'Ammo box' },
  { id: 'pause',  label: 'II',     cls: 'pause',  kind: 'pause',  title: 'Pause' },
];

export class Touch {
  constructor(game) {
    this.g = game; this.on = false; this.mode = null; this._k = {}; this.btnEl = {}; this.toggled = {};
    this.stick = { id: null, ox: 0, oy: 0 }; this.look = { id: null, x: 0, y: 0 }; this.fsTries = 0;
    const mk = (cls, html = '') => { const d = document.createElement('div'); d.className = cls; d.innerHTML = html; return d; };
    const root = this.root = mk('', ''); root.id = 'touch'; root.style.display = 'none';
    const zl = this.zl = mk('tzone l'), zr = this.zr = mk('tzone r');
    this.base = mk('tbase', '<i></i>'); this.knob = this.base.firstChild;
    root.append(zl, zr, this.base);
    this.base.classList.add('rest');
    zl.addEventListener('pointerdown', (e) => this.stickDown(e));
    zr.addEventListener('pointerdown', (e) => this.lookDown(e));
    for (const z of [zl, zr]) { z.addEventListener('pointermove', (e) => this.move(e)); z.addEventListener('pointerup', (e) => this.up(e)); z.addEventListener('pointercancel', (e) => this.up(e)); }
    for (const d of BUTTONS) {
      const b = mk('tbtn ' + d.cls, d.label); b.dataset.id = d.id; if (d.title) b.title = d.title;
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); try { b.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ } b.classList.add('down'); this.press(d, b, e); });
      const end = (e) => { b.classList.remove('down'); this.release(d, b, e); };
      b.addEventListener('pointerup', end); b.addEventListener('pointercancel', end);
      if (d.look) b.addEventListener('pointermove', (e) => { if (this.look.id === e.pointerId) this.lookMove(e); });
      root.appendChild(b); this.btnEl[d.id] = b;
    }
    document.body.appendChild(root);
    root.addEventListener('contextmenu', (e) => e.preventDefault());
    // the first touch goes full screen in landscape (Chrome on Android); iPhone Safari has no such API and just ignores it
    window.addEventListener('pointerup', () => this.fullscreen(), { capture: true });
  }

  get input() { return this.g.input; }

  fullscreen() {
    if (this.fsTries >= 2 || document.fullscreenElement || !document.documentElement.requestFullscreen) return;
    this.fsTries++;
    try {
      const p = document.documentElement.requestFullscreen({ navigationUI: 'hide' });
      if (p && p.then) p.then(() => { try { return screen.orientation.lock('landscape'); } catch { return null; } }).catch(() => {});
    } catch { /* not allowed */ }
  }

  setKey(act, want) {
    const i = this.input; if (want === !!this._k[act]) return;
    this._k[act] = want; i.keys[act] = want; if (want) i.pressed[act] = true;
  }

  // ---- move stick
  stickDown(e) {
    e.preventDefault(); const s = this.stick; if (s.id != null) return;
    s.id = e.pointerId; s.ox = e.clientX; s.oy = e.clientY;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
    this.base.classList.remove('rest'); this.base.style.left = s.ox + 'px'; this.base.style.top = s.oy + 'px'; this.knob.style.transform = 'translate(-50%,-50%)';
  }
  stickMove(e) {
    const s = this.stick; let dx = e.clientX - s.ox, dy = e.clientY - s.oy, d = Math.hypot(dx, dy);
    if (d > RADIUS * 1.5) { const k = (d - RADIUS * 1.5) / d; s.ox += dx * k; s.oy += dy * k; dx = e.clientX - s.ox; dy = e.clientY - s.oy; d = Math.hypot(dx, dy); this.base.style.left = s.ox + 'px'; this.base.style.top = s.oy + 'px'; }
    const k = d > RADIUS ? RADIUS / d : 1, x = dx * k / RADIUS, y = dy * k / RADIUS;
    this.knob.style.transform = `translate(calc(-50% + ${(dx * k).toFixed(1)}px), calc(-50% + ${(dy * k).toFixed(1)}px))`;
    this.setKey('KeyW', y < -0.3); this.setKey('KeyS', y > 0.3); this.setKey('KeyA', x < -0.3); this.setKey('KeyD', x > 0.3);
    this.setKey('ShiftLeft', !this.air() && Math.hypot(x, y) > 0.96 && y < -0.3);   // pushed to the rim = sprint (the throttle button owns Shift in aircraft)
  }
  stickUp() {
    this.stick.id = null; this.base.classList.add('rest'); this.base.style.left = ''; this.base.style.top = ''; this.knob.style.transform = 'translate(-50%,-50%)';
    for (const a of ['KeyW', 'KeyS', 'KeyA', 'KeyD']) this.setKey(a, false);
    if (!this.air()) this.setKey('ShiftLeft', false);
  }

  // ---- look
  lookDown(e) {
    e.preventDefault(); if (this.look.id != null) return;
    this.look.id = e.pointerId; this.look.x = e.clientX; this.look.y = e.clientY;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
  }
  lookMove(e) {
    const l = this.look, i = this.input;
    i.dx += (e.clientX - l.x) * LOOK; i.dy += (e.clientY - l.y) * LOOK; l.x = e.clientX; l.y = e.clientY;
  }
  move(e) { if (e.pointerId === this.stick.id) this.stickMove(e); else if (e.pointerId === this.look.id) this.lookMove(e); }
  up(e) { if (e.pointerId === this.stick.id) this.stickUp(); else if (e.pointerId === this.look.id) this.look.id = null; }

  // ---- buttons
  air() { const m = this.g.player && this.g.player.mode; return m === 'plane' || m === 'heli'; }
  press(d, el, e) {
    const i = this.input;
    if (d.look && this.look.id == null) { this.look.id = e.pointerId; this.look.x = e.clientX; this.look.y = e.clientY; }
    if (d.kind === 'pause') { this.g.pause(); return; }
    if (d.kind === 'wheel') { i.wheel += 1; return; }
    if (d.kind === 'toggle') { const on = !this.toggled[d.id]; this.toggled[d.id] = on; el.classList.toggle('on', on); i.buttons[d.btn] = on; if (on) i.btnPressed[d.btn] = true; return; }
    if (d.btn != null) { i.buttons[d.btn] = true; i.btnPressed[d.btn] = true; return; }
    if (d.kind === 'tap') { i.pressed[d.key] = true; return; }
    this.setKey(d.key, true);
  }
  release(d, el, e) {
    const i = this.input;
    if (d.look && this.look.id === e.pointerId) this.look.id = null;
    if (d.kind === 'hold' && d.btn != null) i.buttons[d.btn] = false;
    else if (d.kind === 'hold') this.setKey(d.key, false);
  }
  releaseAll() {
    const i = this.input;
    for (const a in this._k) if (this._k[a]) { this._k[a] = false; i.keys[a] = false; }
    i.buttons[0] = false; i.buttons[2] = false; this.toggled = {}; for (const id in this.btnEl) this.btnEl[id].classList.remove('on', 'down');
    this.stick.id = null; this.look.id = null; this.stickUp();
  }

  // called every frame: show the controls only while a mission is being played, and adapt the labels to the vehicle
  sync() {
    const g = this.g, on = g.state === 'playing' && g.input.active;
    if (on !== this.on) { this.on = on; this.root.style.display = on ? 'block' : 'none'; if (!on) { this.releaseAll(); this.mode = null; } }
    if (!on) return;
    const m = g.player && g.player.mode;
    if (m !== this.mode) {
      this.mode = m; const air = this.air(), foot = m === 'foot' || !m;
      for (const d of BUTTONS) {
        const el = this.btnEl[d.id];
        if (d.airOnly) el.style.display = air ? '' : 'none';
        if (d.air) el.textContent = air ? d.air : d.label;
        if (d.id === 'prone' || d.id === 'kick' || d.id === 'gren' || d.id === 'swap' || d.id === 'reload' || d.cls === 'pk') el.style.display = foot ? '' : 'none';
        if (d.id === 'aim') el.style.display = foot ? '' : 'none';
        if (d.id === 'jump') { el.textContent = foot ? 'JUMP' : m === 'fall' || m === 'chute' ? 'CHUTE' : 'BRAKE'; el.style.display = air ? 'none' : ''; }
        if (d.id === 'use') el.textContent = foot ? 'USE' : 'EXIT';
      }
      if (!foot && this.toggled.aim) { this.toggled.aim = false; this.input.buttons[2] = false; this.btnEl.aim.classList.remove('on'); }
    }
  }
}
