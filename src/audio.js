// Sound: layered, per-weapon gunshots with echo tails, impact and footstep sounds, and engine loops made from real
// recordings (public/sounds). Optional real gun recordings: drop public/sounds/guns/<weapon id>.ogg and they are used
// instead of the synthesised shot. Everything else is generated, so the game also runs with no files at all.
const BASE = import.meta.env.BASE_URL;

// crack = supersonic snap, body = the blast, boom = chest thump, tail = how much echo
const VOICES = {
  usp: { crack: 0.55, crackHz: 2600, body: 0.45, bodyHz: 1800, boomHz: 170, dur: 0.16, tail: 0.25 },
  glock: { crack: 0.6, crackHz: 3000, body: 0.4, bodyHz: 2000, boomHz: 190, dur: 0.13, tail: 0.22 },
  deagle: { crack: 0.8, crackHz: 2200, body: 0.9, bodyHz: 1400, boomHz: 110, dur: 0.32, tail: 0.55, sub: 0.5 },
  mp5: { crack: 0.55, crackHz: 3200, body: 0.4, bodyHz: 2200, boomHz: 200, dur: 0.12, tail: 0.2 },
  p90: { crack: 0.5, crackHz: 4200, body: 0.3, bodyHz: 2600, boomHz: 260, dur: 0.09, tail: 0.15 },
  spas12: { crack: 0.7, crackHz: 1800, body: 1.0, bodyHz: 900, boomHz: 80, dur: 0.42, tail: 0.5, sub: 0.6, mech: 'pump' },
  striker: { crack: 0.65, crackHz: 2000, body: 0.9, bodyHz: 1000, boomHz: 90, dur: 0.36, tail: 0.45, sub: 0.5 },
  ak47: { crack: 0.85, crackHz: 2400, body: 0.85, bodyHz: 1200, boomHz: 120, dur: 0.26, tail: 0.45, sub: 0.35 },
  m4a1: { crack: 0.8, crackHz: 3000, body: 0.6, bodyHz: 1700, boomHz: 150, dur: 0.2, tail: 0.38 },
  l118a: { crack: 1.0, crackHz: 2000, body: 0.95, bodyHz: 1100, boomHz: 100, dur: 0.5, tail: 0.75, sub: 0.5, mech: 'bolt' },
};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class Sfx {
  constructor() {
    this.ctx = null; this.vol = 0.6; this.muted = false; this.samples = {}; this.loops = {};
  }
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      const c = this.ctx = new AC();
      this.master = c.createGain(); this.master.gain.value = this.vol;
      const lim = c.createDynamicsCompressor();   // keeps big guns and explosions from distorting
      lim.threshold.value = -9; lim.knee.value = 4; lim.ratio.value = 20; lim.attack.value = 0.001; lim.release.value = 0.15;
      this.master.connect(lim).connect(c.destination);
      const n = c.sampleRate; this.noise = c.createBuffer(1, n, n);
      const d = this.noise.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      // generated echo: a 1.4 s decaying, slightly dull noise tail = a shot bouncing between buildings
      const len = Math.floor(c.sampleRate * 1.4), ir = c.createBuffer(2, len, c.sampleRate);
      for (let ch = 0; ch < 2; ch++) { const x = ir.getChannelData(ch); let lp = 0; for (let i = 0; i < len; i++) { lp += (Math.random() * 2 - 1 - lp) * 0.35; x[i] = lp * Math.pow(1 - i / len, 3.2); } }
      this.wet = c.createConvolver(); this.wet.buffer = ir;
      const wg = c.createGain(); wg.gain.value = 0.7; this.wet.connect(wg).connect(this.master);
      const load = (key, url) => fetch(url).then((r) => (r.ok && /audio|ogg|octet/.test(r.headers.get('content-type') || '') ? r.arrayBuffer() : null))
        .then((ab) => (ab ? c.decodeAudioData(ab) : null)).then((b) => { if (b) this.samples[key] = b; }).catch(() => undefined);
      for (const k of ['engine', 'engine-motorcycle', 'skid', 'impact']) load(k, `${BASE}sounds/${k}.ogg`);
      for (const id of Object.keys(VOICES)) load('gun:' + id, `${BASE}sounds/guns/${id}.ogg`);   // optional real recordings
    } catch { this.ctx = null; }
  }
  setVol(v) { this.vol = v; if (this.master) this.master.gain.value = this.muted ? 0 : v; }
  toggleMute() { this.muted = !this.muted; if (this.master) this.master.gain.value = this.muted ? 0 : this.vol; return this.muted; }

  // ---------------------------------------------------------------- building blocks
  _env(g, t, peak, dur) { g.gain.setValueAtTime(Math.max(0.0001, peak), t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); }
  // where a sound ends up: volume, air absorption (far = duller), stereo pan and a send to the echo
  _bus(vol, pan, far, tail) {
    const c = this.ctx, g = c.createGain(); g.gain.value = vol;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700 + 15000 * Math.pow(1 - far, 2);
    const p = c.createStereoPanner(); p.pan.value = clamp(pan, -1, 1);
    g.connect(lp).connect(p).connect(this.master);
    if (tail > 0) { const s = c.createGain(); s.gain.value = tail * (0.35 + far * 0.65); p.connect(s).connect(this.wet); }
    return g;
  }
  _nz(out, t, type, hz, q, peak, dur) {
    const c = this.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noise; f.type = type; f.frequency.value = hz; f.Q.value = q; this._env(g, t, peak, dur);
    s.connect(f).connect(g).connect(out); s.start(t, Math.random() * 0.5, dur + 0.03);
  }
  _osc(out, t, type, from, to, peak, dur) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(from, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur); this._env(g, t, peak, dur);
    o.connect(g).connect(out); o.start(t); o.stop(t + dur + 0.03);
  }
  _ok() { return this.ctx && this.noise && this.master; }
  // old-style one-liners
  _tone(freq, dur, vol, type = 'sine', to = null) {
    if (!this._ok()) return;
    const t = this.ctx.currentTime, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    this._env(g, t, vol, dur); o.connect(g).connect(this.master); o.start(t); o.stop(t + dur + 0.05);
  }
  _sample(key, out, rate = 1, t = this.ctx.currentTime) {
    const b = this.samples[key]; if (!b) return false;
    const s = this.ctx.createBufferSource(); s.buffer = b; s.playbackRate.value = rate; s.connect(out); s.start(t); return true;
  }

  // ---------------------------------------------------------------- guns and impacts
  // id: weapon id; vol 0..1; pan -1..1; far 0 (next to me) .. 1 (edge of hearing); own: my gun (adds pump / bolt sound)
  gun(id, vol = 1, pan = 0, far = 0, own = false) {
    if (!this._ok() || vol <= 0.02) return;
    const c = this.ctx, v = VOICES[id] || VOICES.usp, t = c.currentTime + 0.004, j = 0.92 + Math.random() * 0.16;
    const out = this._bus(vol, pan, far, v.tail);
    if (this._sample('gun:' + id, out, j, t)) return;   // a real recording beats the synthesised one
    this._nz(out, t, 'bandpass', v.crackHz * j, 0.7, v.crack, 0.045 + v.dur * 0.12);
    this._nz(out, t, 'lowpass', v.bodyHz * j, 0.7, v.body * 0.8, v.dur);
    this._osc(out, t, 'sine', v.boomHz * j, 38, v.body * 0.7, v.dur * 0.9);
    if (v.sub) this._osc(out, t, 'sine', 62 * j, 30, v.sub, v.dur * 1.5);
    if (own && v.mech === 'pump') { this._nz(out, t + 0.4, 'bandpass', 1700, 2, 0.28, 0.03); this._nz(out, t + 0.52, 'bandpass', 1300, 2, 0.32, 0.035); }
    if (own && v.mech === 'bolt') { this._nz(out, t + 0.55, 'bandpass', 2200, 3, 0.3, 0.03); this._osc(out, t + 0.55, 'triangle', 1500, 900, 0.07, 0.05); this._nz(out, t + 0.72, 'bandpass', 1500, 2, 0.3, 0.035); }
  }
  impact(kind, vol = 0.5, pan = 0, mat = 'stone') {
    if (!this._ok() || vol <= 0.03) return;
    const t = this.ctx.currentTime + 0.003, j = 0.9 + Math.random() * 0.2, out = this._bus(vol, pan, 1 - vol, 0.12);
    if (kind === 'body') { this._nz(out, t, 'lowpass', 700, 0.7, 0.7, 0.1); this._osc(out, t, 'sine', 150 * j, 55, 0.6, 0.11); this._nz(out, t, 'bandpass', 2200 * j, 1.2, 0.28, 0.035); }
    else if (mat === 'metal') { this._nz(out, t, 'bandpass', 4200 * j, 1.5, 0.55, 0.04); this._osc(out, t, 'triangle', 2300 * j, 2150 * j, 0.22, 0.32); if (Math.random() < 0.5) this._osc(out, t + 0.012, 'sine', 3300 * j, 1300, 0.08, 0.3); }
    else if (mat === 'wood') { this._nz(out, t, 'lowpass', 1000 * j, 0.8, 0.65, 0.07); this._osc(out, t, 'sine', 230 * j, 110, 0.5, 0.1); this._nz(out, t + 0.012, 'bandpass', 2600 * j, 2, 0.16, 0.025); }
    else { this._nz(out, t, 'bandpass', 3200 * j, 1, 0.6, 0.05); this._osc(out, t, 'triangle', 1900 * j, 900, 0.09, 0.09); if (Math.random() < 0.35) this._osc(out, t + 0.01, 'sine', 2800 * j, 1100, 0.07, 0.24); }
  }
  hitTick(kill = false) {
    if (!this._ok()) return;
    const t = this.ctx.currentTime + 0.002, out = this._bus(kill ? 0.9 : 0.55, 0, 0, 0);
    this._osc(out, t, 'square', kill ? 1500 : 2400, kill ? 800 : 1800, 0.3, 0.05);
    if (kill) { this._osc(out, t, 'sine', 170, 55, 0.9, 0.2); this._nz(out, t, 'lowpass', 900, 0.7, 0.4, 0.12); }
  }
  reload(total = 1.6) {
    if (!this._ok()) return;
    const t = this.ctx.currentTime, out = this._bus(0.8, 0, 0, 0);
    this._nz(out, t + 0.08, 'bandpass', 900, 3, 0.45, 0.05); this._osc(out, t + 0.1, 'triangle', 300, 150, 0.2, 0.08);
    this._nz(out, t + total * 0.55, 'bandpass', 700, 2, 0.5, 0.07); this._osc(out, t + total * 0.55, 'triangle', 220, 120, 0.3, 0.09);
    this._nz(out, t + Math.max(0.3, total - 0.18), 'bandpass', 2000, 3, 0.5, 0.04); this._nz(out, t + Math.max(0.36, total - 0.1), 'bandpass', 1500, 3, 0.45, 0.05);
  }
  dry() { if (!this._ok()) return; const t = this.ctx.currentTime, out = this._bus(0.6, 0, 0, 0); this._nz(out, t, 'bandpass', 2600, 4, 0.5, 0.03); }
  swap() { if (!this._ok()) return; const t = this.ctx.currentTime, out = this._bus(0.6, 0, 0, 0); this._nz(out, t, 'bandpass', 1100, 2, 0.4, 0.06); this._nz(out, t + 0.12, 'bandpass', 1900, 3, 0.4, 0.04); }
  throwNade() { if (!this._ok()) return; const t = this.ctx.currentTime, out = this._bus(0.6, 0, 0, 0); this._nz(out, t, 'bandpass', 700, 1.2, 0.25, 0.18); this._osc(out, t, 'sine', 420, 180, 0.12, 0.15); }
  // a blast: vol 0..1 by distance. Deep boom, crack, rumble, long echo
  explosion(vol = 1, pan = 0) {
    if (!this._ok() || vol <= 0.03) return;
    const t = this.ctx.currentTime + 0.002, out = this._bus(vol, pan, 1 - vol, 0.8);
    this._nz(out, t, 'lowpass', 1400, 0.7, 1.0, 0.7); this._nz(out, t, 'bandpass', 2400, 0.7, 0.8, 0.12);
    this._osc(out, t, 'sine', 95, 30, 1.0, 0.9); this._osc(out, t, 'sine', 55, 25, 0.9, 1.3);
  }
  step(vol = 0.3, wet = false) {
    if (!this._ok()) return;
    const t = this.ctx.currentTime, out = this._bus(vol, 0, 0.5, 0.05);
    if (wet) { this._nz(out, t, 'bandpass', 1400, 0.8, 0.5, 0.12); return; }
    this._nz(out, t, 'bandpass', 380 + Math.random() * 120, 1.2, 0.7, 0.05); this._osc(out, t, 'sine', 90, 55, 0.3, 0.07);
  }
  punch() { if (!this._ok()) return; const t = this.ctx.currentTime, out = this._bus(0.7, 0, 0, 0); this._nz(out, t, 'lowpass', 650, 0.7, 0.7, 0.09); this._osc(out, t, 'sine', 130, 60, 0.5, 0.1); }
  hurt(dmg = 20) {
    if (!this._ok()) return;
    const t = this.ctx.currentTime + 0.002, k = Math.min(1, 0.45 + dmg / 60), out = this._bus(0.9, 0, 0, 0.08);
    this._nz(out, t, 'lowpass', 600, 0.7, 0.8 * k, 0.13); this._osc(out, t, 'sine', 130, 50, 0.7 * k, 0.15);
    const c = this.ctx, o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(150 + Math.random() * 25, t + 0.03); o.frequency.exponentialRampToValueAtTime(90, t + 0.23);
    for (const [hz, q, kk] of [[720, 5, 1], [1150, 6, 0.6]]) { const f = c.createBiquadFilter(), g = c.createGain(); f.type = 'bandpass'; f.frequency.value = hz; f.Q.value = q; g.gain.setValueAtTime(0.0001, t + 0.03); g.gain.exponentialRampToValueAtTime(0.55 * k * kk, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.23); o.connect(f).connect(g).connect(out); }
    o.start(t + 0.03); o.stop(t + 0.26);
  }
  death() { if (!this._ok()) return; const t = this.ctx.currentTime + 0.002, out = this._bus(0.95, 0, 0, 0.15); this._osc(out, t, 'sawtooth', 160, 62, 0.25, 0.55); this._nz(out, t + 0.32, 'lowpass', 260, 0.7, 0.9, 0.3); this._osc(out, t + 0.32, 'sine', 90, 36, 0.8, 0.3); }
  crash(vol = 0.8) { if (!this._ok()) return; const out = this._bus(vol, 0, 0.1, 0.2); if (!this._sample('impact', out, 0.85 + Math.random() * 0.3)) { const t = this.ctx.currentTime; this._nz(out, t, 'lowpass', 900, 0.7, 0.8, 0.25); this._osc(out, t, 'sine', 120, 45, 0.7, 0.25); } }

  // ---------------------------------------------------------------- one-shot UI / game sounds
  click() { this._tone(900, 0.03, 0.12, 'square'); }
  ui() { this._tone(660, 0.06, 0.12, 'triangle'); }
  blip(f = 880) { this._tone(f, 0.09, 0.2, 'triangle'); setTimeout(() => this._tone(f * 1.5, 0.12, 0.2, 'triangle'), 70); }
  radio() { this._tone(1250, 0.05, 0.08, 'square'); setTimeout(() => this._tone(950, 0.05, 0.08, 'square'), 80); }
  beep(f = 1400) { this._tone(f, 0.07, 0.18, 'square'); }
  sting() { this._tone(220, 0.5, 0.3, 'sawtooth', 440); }
  win() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this._tone(f, 0.25, 0.2, 'triangle'), i * 120)); }
  lose() { [330, 262, 196].forEach((f, i) => setTimeout(() => this._tone(f, 0.4, 0.22, 'sawtooth'), i * 220)); }
  chute() { if (!this._ok()) return; const out = this._bus(0.7, 0, 0.2, 0.1); this._nz(out, this.ctx.currentTime, 'bandpass', 900, 0.8, 0.8, 0.6); }
  shot(kind, vol = 1) { this.gun(kind === 'pistol' ? 'usp' : kind === 'sniper' ? 'l118a' : kind === 'shotgun' ? 'spas12' : 'm4a1', vol, 0, 0, false); }   // kept for old callers
  alarm(on) {
    if (!this._ok()) return;
    const c = this.ctx;
    if (on && !this._al) {
      const o = c.createOscillator(), l = c.createOscillator(), lg = c.createGain(), g = c.createGain();
      o.type = 'sawtooth'; o.frequency.value = 620; l.frequency.value = 1.4; lg.gain.value = 170;
      l.connect(lg); lg.connect(o.frequency); g.gain.value = 0.05; o.connect(g); g.connect(this.master);
      o.start(); l.start(); this._al = { o, l, g };
    } else if (!on && this._al) { this._al.o.stop(); this._al.l.stop(); this._al.g.disconnect(); this._al = null; }
  }

  // ---------------------------------------------------------------- loops: engines (real recordings), skid, wind
  _loop(key, sample) {
    if (this.loops[key] || !this.samples[sample]) return this.loops[key] || null;
    const c = this.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.samples[sample]; s.loop = true; f.type = 'lowpass'; f.frequency.value = 6000; g.gain.value = 0;
    s.connect(f).connect(g).connect(this.master); s.start();
    return (this.loops[key] = { s, f, g });
  }
  // kind: car | jeep | sedan | sports | bike | boat; ratio 0..1 of top speed
  vehicle(kind, vol, ratio, braking = false) {
    if (!this._ok()) return;
    const bike = kind === 'bike', boat = kind === 'boat', key = bike ? 'engine-motorcycle' : 'engine';
    const L = this._loop('veh:' + key, key);
    if (!L) return this.engine(vol, ratio, bike ? 85 : 55);   // no recording: synthesised engine
    const t = this.ctx.currentTime;
    const rate = boat ? 0.5 + ratio * 0.7 : (bike ? 0.7 : 0.6) + ratio * (bike ? 1.5 : 1.7);
    L.s.playbackRate.setTargetAtTime(rate, t, 0.08);
    L.g.gain.setTargetAtTime(vol * (0.35 + ratio * 0.5) * (boat ? 0.8 : 1), t, 0.1);
    L.f.frequency.setTargetAtTime(boat ? 1500 : 2500 + ratio * 6000, t, 0.1);
    const other = bike ? 'veh:engine' : 'veh:engine-motorcycle'; if (this.loops[other]) this.loops[other].g.gain.setTargetAtTime(0, t, 0.1);
  }
  skid(on, vol = 0.5) {
    if (!this._ok()) return;
    const L = this._loop('skid', 'skid'); if (!L) return;
    L.g.gain.setTargetAtTime(on ? vol : 0, this.ctx.currentTime, 0.05);
  }
  // synthesised engine (used for aircraft, and as a fallback)
  engine(vol, pitch = 0, base = 55) {
    if (!this._ok()) return;
    if (!this._en) {
      const c = this.ctx, o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
      o.type = 'sawtooth'; f.type = 'lowpass'; f.frequency.value = 500; g.gain.value = 0;
      o.connect(f); f.connect(g); g.connect(this.master); o.start(); this._en = { o, g, f };
    }
    const t = this.ctx.currentTime;
    this._en.g.gain.setTargetAtTime(vol * 0.11, t, 0.08); this._en.o.frequency.setTargetAtTime(base + pitch * 130, t, 0.06); this._en.f.frequency.setTargetAtTime(350 + pitch * 900, t, 0.1);
    for (const k of ['veh:engine', 'veh:engine-motorcycle']) if (this.loops[k] && vol > 0 && base === 75) this.loops[k].g.gain.setTargetAtTime(0, t, 0.1);
  }
  wind(vol) {
    if (!this._ok()) return;
    if (!this._wi) {
      const c = this.ctx, s = c.createBufferSource(); s.buffer = this.noise; s.loop = true;
      const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 600; f.Q.value = 0.6;
      const g = c.createGain(); g.gain.value = 0; s.connect(f); f.connect(g); g.connect(this.master); s.start(); this._wi = { g };
    }
    this._wi.g.gain.setTargetAtTime(vol * 0.5, this.ctx.currentTime, 0.15);
  }
  vehicleOff() { if (!this.ctx) return; const t = this.ctx.currentTime; for (const k of ['veh:engine', 'veh:engine-motorcycle', 'skid']) if (this.loops[k]) this.loops[k].g.gain.setTargetAtTime(0, t, 0.08); }
  quiet() {
    this.engine(0); this.wind(0); this.alarm(false); this.skid(false);
    for (const k in this.loops) this.loops[k].g.gain.setTargetAtTime(0, this.ctx ? this.ctx.currentTime : 0, 0.05);
  }
}
