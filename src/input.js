const GAME_KEYS = new Set(['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

// Every rebindable action is identified by its DEFAULT key code, so the rest of the game keeps reading keys.KeyW etc.
// and the input layer translates whatever key the player actually chose into that action.
export const ACTIONS = [
  ['KeyW', 'Move forward · accelerate · dive'], ['KeyS', 'Move back · brake · pull up'], ['KeyA', 'Move / steer left'], ['KeyD', 'Move / steer right'],
  ['ShiftLeft', 'Sprint · aircraft throttle up'], ['KeyC', 'Crouch · aircraft throttle down'], ['KeyZ', 'Crawl (prone)'], ['KeyV', 'Sneak walk (hold)'],
  ['Space', 'Jump · stand up · handbrake · open parachute'], ['KeyR', 'Reload'], ['KeyF', 'Kick · silent takedown'], ['KeyG', 'Throw grenade'],
  ['KeyE', 'Use · enter or leave vehicle · hold to free / plant'], ['KeyJ', 'Bail out of aircraft'],
  ['KeyQ', 'Use medkit'], ['KeyX', 'Use armour plate'], ['KeyT', 'Throw noisemaker'], ['KeyY', 'Use ammo box'], ['KeyU', 'Drop current weapon'],
  ['KeyB', 'Change brightness'], ['KeyK', 'Show / hide key list'], ['KeyH', 'Field manual'], ['Tab', 'Show / hide objectives'],
];
const IDS = new Set(ACTIONS.map((a) => a[0]));
// keys that would trigger browser shortcuts or the OS; not allowed for binding
const FORBIDDEN = new Set(['Escape', 'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight', 'MetaLeft', 'MetaRight', 'ContextMenu', 'F5', 'F11', 'F12']);

export function keyName(code) {
  if (!code) return '—';
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return 'Num ' + code.slice(6);
  const map = { ShiftLeft: 'L-Shift', ShiftRight: 'R-Shift', Space: 'Space', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Backslash: '\\', Tab: 'Tab', Enter: 'Enter', Backspace: 'Backspace', CapsLock: 'Caps' };
  return map[code] || code;
}

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = {};
    this.pressed = {};
    this.buttons = {};
    this.btnPressed = {};
    this.dx = 0; this.dy = 0; this.wheel = 0; this.lockedAt = 0;
    this.locked = false;
    this.active = false; // true while gameplay wants input
    this.onLockLost = null;
    this.setBindings(null);

    window.addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT')) return;
      const act = this.mapCode(e.code);
      if (this.active && (GAME_KEYS.has(e.code) || this.rev[e.code])) e.preventDefault();
      if (act == null) return;
      if (!e.repeat) this.pressed[act] = true;
      this.keys[act] = true;
    });
    window.addEventListener('keyup', (e) => { const act = this.mapCode(e.code); if (act != null) this.keys[act] = false; });
    window.addEventListener('blur', () => { this.keys = {}; this.buttons = {}; });
    canvas.addEventListener('mousedown', (e) => {
      if (!this.active) return;
      if (!this.locked) { this.lock(); return; }
      this.buttons[e.button] = true; this.btnPressed[e.button] = true;
    });
    window.addEventListener('mouseup', (e) => { this.buttons[e.button] = false; });
    window.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      // ignore the first moments after capture and any impossible jump (a known browser glitch)
      if (performance.now() - this.lockedAt < 120) return;
      const x = e.movementX || 0, y = e.movementY || 0;
      if (Math.abs(x) > 250 || Math.abs(y) > 250) return;
      this.dx += x; this.dy += y;
    });
    window.addEventListener('wheel', (e) => { if (this.active) this.wheel += Math.sign(e.deltaY); }, { passive: true });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('pointerlockchange', () => {
      const was = this.locked;
      this.locked = document.pointerLockElement === canvas;
      if (this.locked) { this.lockedAt = performance.now(); this.dx = this.dy = 0; }
      if (was && !this.locked) { this.buttons = {}; if (this.onLockLost) this.onLockLost(); }
    });
  }

  // map = { actionId: physicalCode } for the actions the player changed
  setBindings(map) {
    this.bind = {}; this.rev = {}; this.bindVer = (this.bindVer || 0) + 1;
    const used = new Set();
    for (const [id] of ACTIONS) {
      let code = (map && map[id]) || id;
      if (used.has(code) || FORBIDDEN.has(code)) code = id;   // a broken save can never bind two actions to one key
      this.bind[id] = code; used.add(code);
    }
    // an action left on its default key whose key was taken by another action would clash; repair by freeing the later one
    for (const [id] of ACTIONS) this.rev[this.bind[id]] = id;
  }
  // physical key -> action id, or null when the key belongs to an action that was moved elsewhere
  mapCode(code) {
    if (this.rev[code]) return this.rev[code];
    if (IDS.has(code)) return null;
    return code;
  }
  label(id) { return keyName(this.bind[id] || id); }
  // returns the new bindings map, or an error string
  rebind(map, id, code) {
    if (FORBIDDEN.has(code)) return { error: code === 'Escape' ? 'Esc is reserved for pausing' : 'That key triggers browser or system shortcuts' };
    const next = { ...map }, cur = (m, a) => m[a] || a;
    const other = ACTIONS.find(([a]) => a !== id && cur(next, a) === code);
    if (other) next[other[0]] = cur(next, id); // swap, so no action is ever left without a key
    next[id] = code;
    for (const k of Object.keys(next)) if (next[k] === k) delete next[k];
    return { map: next, swapped: other ? other[1] : null };
  }
  lock() {
    // automated test browsers must never capture the real mouse (it can trap the user's cursor on the desktop)
    if (navigator.webdriver) return;
    try { const p = this.canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch { /* ignore */ }
  }
  unlock() { if (document.pointerLockElement) document.exitPointerLock(); }
  frameEnd() { this.pressed = {}; this.btnPressed = {}; this.dx = 0; this.dy = 0; this.wheel = 0; }
}
