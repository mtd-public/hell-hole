// sfx-synth.js — the consolidated WebAudio synth every mtd-public game re-wrote.
// No sample files. Merges the best parts of:
//   gig-ambulance js/audio.js      (tone(), two-tone siren loop)
//   finger-skater js/audio.js      (noise bursts, speed-following roll loop, grind scrape loop, scheduled delays)
//   labyrinth-larry js/audio.js    (master gain + mute, shared noise buffer, drone, formant "scream")
//   sub-sinkers src/audio.js       (named SFX table, 40 ms per-name rate limit, attack/decay envelope)
//
// Rules learned the hard way:
//   * Create/resume the AudioContext inside a user gesture (Start button / first key / first pointerdown).
//     Browsers refuse to start audio otherwise. unlock() is idempotent — call it from every start path.
//   * Route everything through one master GainNode so mute is one ramp, not a hunt for live nodes.
//   * Ramp gains with exponentialRampToValueAtTime to 0.0001 (never to 0 — exponential ramps can't hit 0),
//     or setTargetAtTime for loops. Hard gain jumps click.
//   * Rate-limit identical sounds (a shotgun fires 5 missiles in one frame; 5 stacked tones = distortion).
//   * Loops (engine/roll/siren/drone) are started once and modulated every frame; don't start/stop per frame.
//
// Usage:
//   import { Sfx } from './sfx-synth.js';
//   const sfx = new Sfx();
//   startButton.onclick = () => { sfx.unlock(); ... };
//   sfx.play('coin'); sfx.play('boom');
//   sfx.setRoll(speed, grounded);          // per frame, if you use the roll loop
//   sfx.setMuted(true);
export class Sfx {
  constructor({ volume = 0.8 } = {}) {
    this.ctx = null;
    this.master = null;
    this.noise = null;
    this.muted = false;
    this.rate = 1;
    this.volume = volume;
    this.fxVol = 1; // sound-effects level (Options), under the master
    this.last = {};
    this.loops = {};
  }

  unlock() {
    if (this.ctx) { // 'suspended' (never started) or iOS's 'interrupted' (a call, Siri, app switch)
      if (this.ctx.state !== 'running') { this.ctx.resume().catch(() => {}); this.kick(); }
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    // iOS / iPadOS: game audio, so play even with the ring / silent switch on (Safari 16.4+)
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (_) { /* ignore */ }
    try { this.ctx = new AC(); } catch (_) { this.ctx = null; return; }
    const c = this.ctx;
    if (c.state !== 'running') c.resume().catch(() => {});
    this.kick();
    this.master = c.createGain();
    this.master.gain.value = this.muted ? 0 : this.volume;
    // slow-mo "tape": a low-pass after everything (sfx and music) that closes in while time is slowed
    this.tape = c.createBiquadFilter(); this.tape.type = 'lowpass'; this.tape.frequency.value = 20000; this.tape.Q.value = 0.8;
    // a brick-wall-ish limiter last, so a slam, a rocket and the drop landing together never clip
    this.limiter = c.createDynamicsCompressor();
    this.limiter.threshold.value = -6; this.limiter.knee.value = 4; this.limiter.ratio.value = 20; this.limiter.attack.value = 0.002; this.limiter.release.value = 0.12;
    this.master.connect(this.tape).connect(this.limiter).connect(c.destination);
    this.fx = c.createGain(); this.fx.gain.value = this.fxMuted ? 0 : this.fxVol; this.fx.connect(this.master); // sound effects (music goes straight to master)
    const len = c.sampleRate * 2;
    this.noise = c.createBuffer(1, len, c.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  // A silent one-sample sound started inside the gesture: older iOS only opens audio output this way.
  kick() {
    try { const c = this.ctx, src = c.createBufferSource(); src.buffer = c.createBuffer(1, 1, 22050); src.connect(c.destination); src.start(0); } catch (_) { /* ignore */ }
  }

  // Resume on every real user gesture: a click the controller synthesised doesn't count as one, so audio
  // may still be waiting when the first tap / key / press arrives mid-game.
  autoUnlock() {
    const go = () => this.unlock();
    for (const ev of ['pointerdown', 'pointerup', 'touchend', 'keydown', 'click']) window.addEventListener(ev, go, { capture: true, passive: true });
    document.addEventListener('visibilitychange', () => { if (!document.hidden && this.ctx && this.ctx.state !== 'running') this.ctx.resume().catch(() => {}); });
  }

  // Slow-mo: every sound plays pitched down and stretched (like tape slowing), muffled by the tape filter.
  setRate(k) {
    if (this.rate === k) return;
    this.rate = k;
    if (this.tape) this.tape.frequency.setTargetAtTime(k < 1 ? 1600 : 20000, this.ctx.currentTime, 0.12);
  }

  // Silence just the sound effects (music keeps playing).
  setFxMuted(m) {
    this.fxMuted = m;
    if (this.fx) this.fx.gain.setTargetAtTime(m ? 0 : this.fxVol, this.ctx.currentTime, 0.05);
  }
  setFxVolume(v) {
    this.fxVol = v;
    if (this.fx) this.fx.gain.setTargetAtTime(this.fxMuted ? 0 : v, this.ctx.currentTime, 0.05);
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : this.volume, this.ctx.currentTime, 0.05);
  }

  // ---------------------------------------------------------------- primitives
  /** Oscillator blip. slide = Hz to glide by over the duration. */
  tone(freq, dur, type = 'square', vol = 0.08, slide = 0, delay = 0) {
    const c = this.ctx;
    if (!c) return;
    const k = this.rate || 1; freq *= k; slide *= k; dur /= k; delay /= k; // (slow-mo: lower and longer)
    const t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.fx);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  /** Filtered noise burst (whoosh, crash, splash, crumble). f1 = filter sweep target. */
  burst(dur, freq, { q = 1, vol = 0.2, type = 'bandpass', f1 = freq, delay = 0 } = {}) {
    const c = this.ctx;
    if (!c) return;
    const k = this.rate || 1; dur /= k; freq *= k; f1 *= k; delay /= k;
    const t = c.currentTime + delay;
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noise;
    s.loop = true;
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(freq, t);
    if (f1 !== freq) f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(this.fx);
    s.start(t);
    s.stop(t + dur + 0.05);
  }

  /** Arpeggio — pickups, level clear, power-ups. */
  arp(freqs, step = 0.06, dur = 0.1, type = 'triangle', vol = 0.08) {
    freqs.forEach((f, i) => this.tone(f, dur, type, vol, 0, i * step));
  }

  // ---------------------------------------------------------------- named sfx
  play(name) {
    if (!this.ctx || this.muted || this.fxMuted) return;
    const fn = SFX[name];
    if (!fn) return;
    const now = this.ctx.currentTime;
    if (this.last[name] && now - this.last[name] < 0.04) return; // rate limit
    this.last[name] = now;
    fn(this);
  }

  // ---------------------------------------------------------------- loops
  /** Rolling / engine bed: looped low-passed noise; call setRoll every frame. */
  setRoll(speed, grounded = true, { maxSpeed = 14, vol = 0.12 } = {}) {
    const c = this.ctx;
    if (!c) return;
    if (!this.loops.roll) {
      const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      s.buffer = this.noise; s.loop = true;
      f.type = 'lowpass'; f.frequency.value = 300; g.gain.value = 0;
      s.connect(f).connect(g).connect(this.fx); s.start();
      this.loops.roll = { f, g };
    }
    const k = grounded ? Math.min(1, speed / maxSpeed) : 0;
    this.loops.roll.g.gain.setTargetAtTime(k * vol, c.currentTime, 0.05);
    this.loops.roll.f.frequency.setTargetAtTime(200 + k * 700, c.currentTime, 0.08);
  }

  /** Small-engine putt-putt (Dr. Mow): a low saw whose loudness is chopped by a
   *  square LFO. level 0..1 = idle..full; 0 fades it out. Call every frame. */
  setEngine(level) {
    const c = this.ctx;
    if (!c) return;
    if (!this.loops.engine) {
      const o = c.createOscillator(), lp = c.createBiquadFilter(), g = c.createGain(), chop = c.createGain();
      const lfo = c.createOscillator(), lg = c.createGain();
      o.type = 'sawtooth'; o.frequency.value = 58;
      lp.type = 'lowpass'; lp.frequency.value = 420;
      lfo.type = 'square'; lfo.frequency.value = 13; lg.gain.value = 0.5;
      chop.gain.value = 0.5; lfo.connect(lg).connect(chop.gain);
      g.gain.value = 0;
      o.connect(lp).connect(chop).connect(g).connect(this.fx);
      o.start(); lfo.start();
      this.loops.engine = { o, lfo, g, lp };
    }
    const e = this.loops.engine, t = c.currentTime;
    e.g.gain.setTargetAtTime(level > 0 ? 0.05 + level * 0.05 : 0, t, 0.08);
    e.o.frequency.setTargetAtTime((52 + level * 26) * (this.rate || 1), t, 0.1);
    e.lfo.frequency.setTargetAtTime(11 + level * 9, t, 0.1);
    e.lp.frequency.setTargetAtTime(360 + level * 420, t, 0.1);
  }

  /** Two-tone siren (gig-ambulance): square LFO wobbling a triangle oscillator. */
  setSiren(on) {
    const c = this.ctx;
    if (!c) return;
    if (on && !this.loops.siren) {
      const o = c.createOscillator(), lfo = c.createOscillator(), lg = c.createGain(), g = c.createGain();
      o.type = 'triangle'; o.frequency.value = 760;
      lfo.type = 'square'; lfo.frequency.value = 1.6; lg.gain.value = 130;
      lfo.connect(lg).connect(o.frequency);
      g.gain.value = 0.025;
      o.connect(g).connect(this.fx);
      o.start(); lfo.start();
      this.loops.siren = { o, lfo, g };
    } else if (!on && this.loops.siren) {
      const { o, lfo, g } = this.loops.siren;
      g.gain.setTargetAtTime(0, c.currentTime, 0.05);
      o.stop(c.currentTime + 0.3); lfo.stop(c.currentTime + 0.3);
      this.loops.siren = null;
    }
  }

  /** Metallic scrape (finger-skater grind): narrow band-passed noise. */
  setScrape(on) {
    const c = this.ctx;
    if (!c) return;
    if (on && !this.loops.scrape) {
      const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      s.buffer = this.noise; s.loop = true;
      f.type = 'bandpass'; f.frequency.value = 3200; f.Q.value = 6; g.gain.value = 0.12;
      s.connect(f).connect(g).connect(this.fx); s.start();
      this.loops.scrape = { s, g };
    } else if (!on && this.loops.scrape) {
      const { s, g } = this.loops.scrape;
      g.gain.setTargetAtTime(0, c.currentTime, 0.03);
      s.stop(c.currentTime + 0.2);
      this.loops.scrape = null;
    }
  }

  /** Ambient drone (labyrinth-larry): beating saws under a low-pass. Start once. */
  startDrone(freqs = [55, 55.7, 82.4], vol = 0.05) {
    const c = this.ctx;
    if (!c || this.loops.drone) return;
    const g = c.createGain(), lp = c.createBiquadFilter();
    g.gain.value = vol; lp.type = 'lowpass'; lp.frequency.value = 400;
    const oscs = freqs.map((fr) => { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = fr; o.connect(lp); o.start(); return o; });
    lp.connect(g).connect(this.fx);
    this.loops.drone = { g, oscs };
  }

  /** A human-ish yell (labyrinth-larry): pitch-bent saw through vowel formants + breath noise. */
  scream(intensity = 1) {
    const c = this.ctx;
    if (!c || this.muted) return 0;
    const t = c.currentTime, dur = 0.55 + Math.random() * 0.6;
    const base = 330 + Math.random() * 220;
    const o = c.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(base * 0.8, t);
    o.frequency.exponentialRampToValueAtTime(base * (1.25 + Math.random() * 0.3), t + 0.12);
    o.frequency.exponentialRampToValueAtTime(base * 0.7, t + dur);
    const vib = c.createOscillator(), vg = c.createGain();
    vib.frequency.value = 6 + Math.random() * 4; vg.gain.value = base * 0.035;
    vib.connect(vg).connect(o.frequency);
    const out = c.createGain();
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(0.16 * intensity, t + 0.04);
    out.gain.setValueAtTime(0.16 * intensity, t + dur * 0.7);
    out.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const vowel = Math.random() < 0.5 ? [800, 1150, 2900] : [700, 1800, 2600]; // "AH" / "AE"
    vowel.forEach((fr, i) => {
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = fr; bp.Q.value = 6;
      const g = c.createGain(); g.gain.value = [1.4, 0.8, 0.35][i];
      o.connect(bp).connect(g).connect(out);
    });
    const n = c.createBufferSource(), nf = c.createBiquadFilter(), ng = c.createGain();
    n.buffer = this.noise; n.loop = true;
    nf.type = 'bandpass'; nf.frequency.value = 1500; ng.gain.value = 0.25;
    n.connect(nf).connect(ng).connect(out);
    out.connect(this.fx);
    o.start(t); vib.start(t); n.start(t);
    o.stop(t + dur); vib.stop(t + dur); n.stop(t + dur);
    return dur;
  }
}

// The shared sound vocabulary. Each entry is (sfx) => void. Add your own freely.
export const SFX = {
  // pickups / rewards (gig-ambulance, finger-skater, labyrinth-larry)
  coin: (s) => { s.tone(988, 0.07, 'square', 0.05); s.tone(1319, 0.12, 'square', 0.05, 0, 0.06); },
  power: (s) => s.arp([523, 659, 784, 1047], 0.055, 0.1, 'triangle', 0.08),
  bonus: (s) => s.arp([659, 784, 1047], 0.06, 0.12, 'square', 0.05),
  deliver: (s) => s.arp([523, 659, 784, 1047, 1319], 0.08, 0.16, 'square', 0.06),
  checkpoint: (s) => s.arp([392, 523, 784], 0.09, 0.25, 'sine', 0.1),
  clear: (s) => s.arp([392, 523, 659, 784, 1046], 0.1, 0.14, 'square', 0.05),
  charged: (s) => s.tone(1200, 0.06, 'triangle', 0.05),
  slowIn: (s) => { s.tone(660, 0.35, 'sine', 0.06, -420); s.tone(330, 0.4, 'triangle', 0.04, -200, 0.05); }, // pitch-down 'time bends' swoop
  slowOut: (s) => s.tone(300, 0.2, 'sine', 0.05, 500),
  tick: (s) => s.tone(1200, 0.05, 'square', 0.05),
  // weapons (sub-sinkers)
  shoot: (s) => { s.tone(520, 0.09, 'square', 0.06, -340); s.burst(0.12, 2000, { q: 2, vol: 0.05, f1: 400 }); },
  missile: (s) => s.burst(0.3, 400, { q: 3, vol: 0.09, f1: 3000 }),
  enemyShot: (s) => s.tone(900, 0.08, 'triangle', 0.05, -600),
  // impacts
  hit: (s) => { s.burst(0.25, 300, { q: 0.8, vol: 0.3 }); s.tone(160, 0.3, 'sawtooth', 0.1, -90); },
  bonk: (s) => s.tone(520, 0.08, 'triangle', 0.08, -300),
  bumper: (s) => { s.tone(880, 0.09, 'square', 0.06, 600); s.tone(1760, 0.06, 'triangle', 0.04, 0, 0.03); }, // pinball 'ding-pop'
  crash: (s) => { s.tone(110, 0.25, 'sawtooth', 0.12, -60); s.tone(70, 0.3, 'square', 0.08, -30); },
  boom: (s) => { s.burst(0.6, 1200, { type: 'lowpass', vol: 0.35, f1: 60 }); s.tone(90, 0.5, 'sine', 0.25, -60); },
  bigBoom: (s) => { s.burst(1.4, 900, { type: 'lowpass', vol: 0.5, f1: 40 }); s.tone(70, 1.2, 'sine', 0.4, -50); },
  clank: (s) => { s.tone(200, 0.25, 'square', 0.05, -80); s.tone(1600, 0.12, 'triangle', 0.04); s.burst(0.08, 2500, { q: 2, vol: 0.12 }); },
  splash: (s) => s.burst(0.35, 3000, { type: 'highpass', vol: 0.12, f1: 600 }),
  // movement
  jump: (s) => s.tone(300, 0.25, 'triangle', 0.07, 500),
  ollie: (s) => { s.burst(0.08, 2200, { vol: 0.25 }); s.tone(300, 0.18, 'triangle', 0.06, 300); },
  land: (s) => { s.burst(0.12, 500, { vol: 0.3 }); s.tone(90, 0.1, 'square', 0.05, -30); },
  // states
  fail: (s) => s.tone(330, 0.4, 'sawtooth', 0.06, -200),
  hurt: (s) => { s.tone(240, 0.35, 'sawtooth', 0.12, -190); s.burst(0.3, 800, { type: 'lowpass', vol: 0.15, f1: 100 }); },
  gameOver: (s) => { s.burst(0.6, 250, { vol: 0.5 }); [392, 330, 262, 196].forEach((f, i) => s.tone(f, 0.22, 'sawtooth', 0.07, 0, i * 0.14)); },
  warn: (s) => [0, 0.3, 0.6].forEach((d) => { s.tone(880, 0.12, 'square', 0.05, 0, d); s.tone(660, 0.12, 'square', 0.05, 0, d + 0.15); }),
  sonar: (s) => s.tone(1320, 0.9, 'sine', 0.05, -20),
  portal: (s) => { s.tone(80, 1.6, 'sawtooth', 0.12, 400); s.arp([262, 311, 392, 466, 523], 0.12, 0.35, 'square', 0.05); },
  // Dr. Mow
  ready: (s) => s.tone(660, 0.12, 'square', 0.05),
  go: (s) => s.arp([523, 784, 1047], 0.05, 0.14, 'square', 0.06),
  gold: (s) => { s.arp([784, 988, 1175, 1568, 1976], 0.07, 0.2, 'triangle', 0.09); s.tone(2637, 0.5, 'sine', 0.03, 0, 0.35); },
  rank: (s) => s.arp([392, 494, 587, 784], 0.09, 0.22, 'square', 0.05),
  achieve: (s) => s.arp([880, 1109, 1319], 0.07, 0.16, 'triangle', 0.07),
  ui: (s) => s.tone(740, 0.05, 'triangle', 0.05),
  honk: (s) => { s.tone(415, 0.18, 'square', 0.04); s.tone(349, 0.18, 'square', 0.04); },
};
