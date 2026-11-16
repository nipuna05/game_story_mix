// All sound is synthesised with WebAudio - no audio files needed.
export class Sfx {
  constructor() { this.ctx = null; this.vol = 0.6; }
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.vol;
      this.master.connect(this.ctx.destination);
      const n = this.ctx.sampleRate;
      this.noise = this.ctx.createBuffer(1, n, n);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    } catch { this.ctx = null; }
  }
  setVol(v) { this.vol = v; if (this.master) this.master.gain.value = v; }
  _env(vol, dur) {
    const g = this.ctx.createGain(), t = this.ctx.currentTime;
    g.gain.setValueAtTime(Math.max(0.0001, vol), t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(this.master);
    return g;
  }
  _noise(dur, freq, vol, type = 'lowpass') {
    if (!this.ctx) return;
    const s = this.ctx.createBufferSource(); s.buffer = this.noise;
    const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq;
    s.connect(f); f.connect(this._env(vol, dur));
    s.start(0, Math.random() * 0.5, dur + 0.05);
  }
  _tone(freq, dur, vol, type = 'sine', to = null) {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator(), t = this.ctx.currentTime;
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    o.connect(this._env(vol, dur)); o.start(t); o.stop(t + dur + 0.05);
  }
  shot(kind, vol = 1) {
    if (vol < 0.03) return;
    if (kind === 'pistol') { this._noise(0.09, 1500, 0.3 * vol); this._tone(300, 0.05, 0.1 * vol, 'square', 120); }
    else if (kind === 'shotgun') { this._noise(0.3, 1700, 1.1 * vol); this._tone(95, 0.22, 0.6 * vol, 'sawtooth', 38); }
    else if (kind === 'sniper') { this._noise(0.45, 2200, 1.0 * vol); this._tone(110, 0.3, 0.6 * vol, 'sawtooth', 35); }
    else { this._noise(0.16, 3000, 0.6 * vol); this._tone(160, 0.1, 0.35 * vol, 'sawtooth', 55); }
  }
  explosion(vol = 1) { if (vol < 0.03) return; this._noise(1.3, 480, 1.4 * vol); this._tone(70, 0.9, 0.9 * vol, 'sine', 24); }
  punch() { this._noise(0.08, 650, 0.6); this._tone(130, 0.08, 0.4, 'sine', 60); }
  hurt() { this._tone(180, 0.18, 0.3, 'sawtooth', 80); }
  click() { this._tone(900, 0.03, 0.12, 'square'); }
  ui() { this._tone(660, 0.06, 0.12, 'triangle'); }
  blip(f = 880) { this._tone(f, 0.09, 0.2, 'triangle'); setTimeout(() => this._tone(f * 1.5, 0.12, 0.2, 'triangle'), 70); }
  radio() { this._tone(1250, 0.05, 0.08, 'square'); setTimeout(() => this._tone(950, 0.05, 0.08, 'square'), 80); }
  beep(f = 1400) { this._tone(f, 0.07, 0.18, 'square'); }
  sting() { this._tone(220, 0.5, 0.3, 'sawtooth', 440); }
  win() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this._tone(f, 0.25, 0.2, 'triangle'), i * 120)); }
  lose() { [330, 262, 196].forEach((f, i) => setTimeout(() => this._tone(f, 0.4, 0.22, 'sawtooth'), i * 220)); }
  chute() { this._noise(0.6, 900, 0.7, 'bandpass'); }
  alarm(on) {
    if (!this.ctx) return;
    if (on && !this._al) {
      const o = this.ctx.createOscillator(), l = this.ctx.createOscillator(), lg = this.ctx.createGain(), g = this.ctx.createGain();
      o.type = 'sawtooth'; o.frequency.value = 620; l.frequency.value = 1.4; lg.gain.value = 170;
      l.connect(lg); lg.connect(o.frequency); g.gain.value = 0.05; o.connect(g); g.connect(this.master);
      o.start(); l.start(); this._al = { o, l, g };
    } else if (!on && this._al) { this._al.o.stop(); this._al.l.stop(); this._al.g.disconnect(); this._al = null; }
  }
  // persistent loops: engine (pitch 0..1) and wind (0..1)
  engine(vol, pitch = 0, base = 55) {
    if (!this.ctx) return;
    if (!this._en) {
      const o = this.ctx.createOscillator(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
      o.type = 'sawtooth'; f.type = 'lowpass'; f.frequency.value = 500; g.gain.value = 0;
      o.connect(f); f.connect(g); g.connect(this.master); o.start(); this._en = { o, g, f };
    }
    const t = this.ctx.currentTime;
    this._en.g.gain.setTargetAtTime(vol * 0.11, t, 0.08);
    this._en.o.frequency.setTargetAtTime(base + pitch * 130, t, 0.06);
    this._en.f.frequency.setTargetAtTime(350 + pitch * 900, t, 0.1);
  }
  wind(vol) {
    if (!this.ctx) return;
    if (!this._wi) {
      const s = this.ctx.createBufferSource(); s.buffer = this.noise; s.loop = true;
      const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 600; f.Q.value = 0.6;
      const g = this.ctx.createGain(); g.gain.value = 0;
      s.connect(f); f.connect(g); g.connect(this.master); s.start(); this._wi = { g };
    }
    this._wi.g.gain.setTargetAtTime(vol * 0.5, this.ctx.currentTime, 0.15);
  }
  quiet() { this.engine(0); this.wind(0); this.alarm(false); }
}
