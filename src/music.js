// Background music generated live with Web Audio (no audio files): a tense military "mission" score in E minor.
//   calm     - menus, briefings, paused: a low drone, sonar pings, slow brass swells, a distant snare
//   game     - during play: pulsing bass ostinato, string riff in a 3+3+2 rhythm, marching snare, taiko, brass stabs, a ticking clock
//   intense  - guards alerted, alarm, races: faster, snare rolls, a siren-like tritone, everything louder
// Ported from the Fight game's score.

const CHORD = [[52, 55, 59], [48, 52, 55], [50, 54, 57], [47, 51, 54]];   // Em | C | D | B
const BASS = [40, 40, 40, 35];
const BRASS = [64, 60, 62, 59];
const RIFF = [[0, 3, 7], [0, 3, 7], [0, 4, 7], [0, 3, 7]];
const BPM = { off: 100, calm: 84, game: 126, intense: 146 };
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

export class Music {
  constructor(sfx) { this.sfx = sfx; this.ctx = null; this.mode = 'off'; this.vol = 0.55; this.step = 0; this.next = 0; this.started = false; this.timer = 0; }
  start() {
    const a = this.sfx.ctx;
    if (!a || this.started) return;
    this.started = true; this.ctx = a;
    this.out = a.createGain(); this.out.gain.value = 0; this.out.connect(a.destination);
    this.noise = a.createBuffer(1, a.sampleRate, a.sampleRate);
    const d = this.noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.next = a.currentTime + 0.1;
    this.timer = window.setInterval(() => this.tick(), 40);
    this.apply();
  }
  setMode(m) { if (m === this.mode) return; this.mode = m; this.apply(); }
  setVolume(v) { this.vol = Math.max(0, Math.min(1, v)); this.apply(); }
  refreshMute() { this.apply(); }
  apply() {
    if (!this.ctx) return;
    const target = this.mode === 'off' || this.sfx.muted ? 0 : this.vol * 1.15;
    this.out.gain.cancelScheduledValues(this.ctx.currentTime);
    this.out.gain.setTargetAtTime(target, this.ctx.currentTime, 0.6);   // smooth fades between moods
  }
  tick() {
    const c = this.ctx;
    if (!c) return;
    if (c.state === 'suspended') { c.resume(); return; }
    if (this.mode === 'off' || this.sfx.muted || this.vol <= 0.01) { this.next = Math.max(this.next, c.currentTime + 0.05); return; }
    const spb = 60 / BPM[this.mode];
    while (this.next < c.currentTime + 0.25) {
      this.schedule(this.step, this.next, spb);
      this.next += spb / 4;                    // one step = a sixteenth note
      this.step = (this.step + 1) % 64;        // four bars
    }
  }

  env(g, t, peak, attack, hold, release) {
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.setValueAtTime(peak, t + attack + hold); g.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + release);
  }
  tone(type, midi, t, peak, attack, hold, release, cutoff, detune = 0) {
    const c = this.ctx, o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
    o.type = type; o.frequency.value = mtof(midi); o.detune.value = detune;
    f.type = 'lowpass'; f.frequency.value = cutoff;
    this.env(g, t, peak, attack, hold, release);
    o.connect(f).connect(g).connect(this.out); o.start(t); o.stop(t + attack + hold + release + 0.05);
  }
  hit(t, type, hz, peak, dur, q = 0.8) {
    const c = this.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noise; f.type = type; f.frequency.value = hz; f.Q.value = q;
    g.gain.setValueAtTime(peak, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(this.out); s.start(t, Math.random() * 0.4, dur + 0.02);
  }
  boom(t, from, to, peak, dur) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(from, t); o.frequency.exponentialRampToValueAtTime(to, t + dur * 0.8);
    g.gain.setValueAtTime(peak, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.out); o.start(t); o.stop(t + dur + 0.03);
  }
  snare(t, peak) { this.hit(t, 'bandpass', 2100, peak, 0.12, 0.9); this.hit(t, 'highpass', 5000, peak * 0.5, 0.07); this.boom(t, 220, 140, peak * 0.4, 0.08); }
  ping(t, peak) { for (const [dt, k] of [[0, 1], [0.34, 0.45], [0.68, 0.2]]) this.tone('sine', 88, t + dt, peak * k, 0.004, 0.02, 1.0, 5000); }
  brass(notes, t, peak, attack, hold, release, cutoff) { for (const n of notes) for (const dt of [-7, 7]) this.tone('sawtooth', n, t, peak, attack, hold, release, cutoff, dt); }

  schedule(step, t, spb) {
    const m = this.mode, bar = (step >> 4) & 3, s = step & 15;
    const calm = m === 'calm', intense = m === 'intense';
    const chord = CHORD[bar], root = BASS[bar];
    if (calm) {
      if (s === 0) {
        for (const n of [root - 12, root, root + 7]) this.tone('sawtooth', n, t, 0.024, 1.6, spb * 3, spb * 1.6, 220, n === root ? 5 : -5);
        this.brass([BRASS[bar]], t, 0.012, 1.2, spb * 2, spb * 1.2, 1300);
        if (bar === 0 || bar === 2) this.ping(t + spb * 0.5, 0.05);
        if (bar === 3) this.boom(t + spb * 3, 70, 38, 0.2, 0.9);
      }
      if (bar === 3 && s >= 8 && s % 2 === 0) this.hit(t, 'bandpass', 1900, 0.014 + (s - 8) * 0.004, 0.06);
      if (s % 8 === 4) this.boom(t, 90, 45, 0.1, 0.5);
      return;
    }
    const accent = s === 0 || s === 3 || s === 6 || s === 8 || s === 11 || s === 14;     // 3 + 3 + 2, twice a bar
    if (s % 2 === 0) this.tone('sine', 108, t, s % 4 === 0 ? 0.045 : 0.025, 0.002, 0.004, 0.03, 9000);   // ticking clock
    if (accent) this.tone('sawtooth', root + (s === 14 ? 12 : 0), t, intense ? 0.13 : 0.11, 0.004, spb * 0.2, spb * 0.2, intense ? 520 : 430);
    if (s === 0) this.boom(t, 80, 40, 0.34, 0.5);
    if (s === 8 && bar !== 1) this.boom(t, 90, 45, 0.22, 0.4);
    if (intense && s % 4 === 0) this.boom(t, 90, 45, 0.18, 0.3);
    if (accent) {
      const k = s === 0 || s === 8 ? 0 : s === 3 || s === 11 ? 1 : 2, note = chord[0] + RIFF[bar][k] + 12;
      this.tone('sawtooth', note, t, intense ? 0.05 : 0.04, 0.005, spb * 0.18, spb * 0.22, 1900);
      this.tone('square', note + 12, t, 0.012, 0.005, spb * 0.12, spb * 0.2, 2600);
    }
    if (s === 4 || s === 12) this.snare(t, intense ? 0.2 : 0.16);
    if (s === 7 || s === 15) this.hit(t, 'bandpass', 2100, 0.035, 0.05);
    if (intense && s % 2 === 1) this.hit(t, 'bandpass', 2100, 0.03, 0.04);
    if (bar === 3 && s >= 12) this.snare(t, 0.07 + (s - 12) * 0.045);
    if (s === 0) this.brass(chord, t, intense ? 0.02 : 0.016, 0.012, spb * 0.5, spb * 0.9, 1500);
    if (s === 10) this.brass(chord, t, 0.013, 0.01, spb * 0.25, spb * 0.5, 1400);
    if (intense && s === 0) this.tone('sawtooth', 88 + (bar & 1 ? 6 : 0), t, 0.012, 0.3, spb * 2.5, spb, 3000);   // siren-like tritone
  }
}
