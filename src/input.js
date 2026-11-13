const GAME_KEYS = new Set(['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD']);

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = {};
    this.pressed = {};
    this.buttons = {};
    this.btnPressed = {};
    this.dx = 0; this.dy = 0; this.wheel = 0;
    this.locked = false;
    this.active = false; // true while gameplay wants input
    this.onLockLost = null;

    window.addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT')) return;
      if (this.active && GAME_KEYS.has(e.code)) e.preventDefault();
      if (!e.repeat) this.pressed[e.code] = true;
      this.keys[e.code] = true;
    });
    window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    window.addEventListener('blur', () => { this.keys = {}; this.buttons = {}; });
    canvas.addEventListener('mousedown', (e) => {
      if (!this.active) return;
      if (!this.locked) { this.lock(); return; }
      this.buttons[e.button] = true; this.btnPressed[e.button] = true;
    });
    window.addEventListener('mouseup', (e) => { this.buttons[e.button] = false; });
    window.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.dx += e.movementX || 0; this.dy += e.movementY || 0;
    });
    window.addEventListener('wheel', (e) => { if (this.active) this.wheel += Math.sign(e.deltaY); }, { passive: true });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('pointerlockchange', () => {
      const was = this.locked;
      this.locked = document.pointerLockElement === canvas;
      if (was && !this.locked) { this.buttons = {}; if (this.onLockLost) this.onLockLost(); }
    });
  }
  lock() {
    try { const p = this.canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch { /* ignore */ }
  }
  unlock() { if (document.pointerLockElement) document.exitPointerLock(); }
  frameEnd() { this.pressed = {}; this.btnPressed = {}; this.dx = 0; this.dy = 0; this.wheel = 0; }
}
