// Game audio: dr-mow's synth (sfx-synth.js, via Vertical-Vantage) and this game's sound
// vocabulary. No sample files. Events from the sim map to sounds in EVENT_SFX.
import { Sfx, SFX } from './sfx-synth.js';

Object.assign(SFX, {
  // .45 ACP: a hard crack over a low thump
  pistol: (s) => { s.burst(0.09, 2600, { q: 0.7, vol: 0.32, f1: 700 }); s.tone(150, 0.14, 'sine', 0.32, -95); s.tone(1100, 0.03, 'square', 0.03, -700); },
  // 12 gauge: wider, longer, then the pump
  shotgun: (s) => { s.burst(0.32, 1500, { q: 0.6, vol: 0.5, f1: 180 }); s.tone(85, 0.3, 'sine', 0.45, -45); s.burst(0.05, 3800, { q: 4, vol: 0.08, delay: 0.32 }); s.burst(0.06, 2400, { q: 4, vol: 0.08, delay: 0.42 }); },
  empty: (s) => s.tone(1900, 0.025, 'square', 0.04, -900),
  reload: (s) => { s.burst(0.04, 3200, { q: 5, vol: 0.07 }); s.burst(0.05, 1800, { q: 5, vol: 0.09, delay: 0.55 }); s.burst(0.05, 2600, { q: 6, vol: 0.09, delay: 1.05 }); },
  shell: (s) => s.burst(0.04, 2200, { q: 6, vol: 0.07 }),
  swap: (s) => { s.burst(0.05, 1400, { q: 3, vol: 0.06 }); s.tone(420, 0.05, 'triangle', 0.03, 120); },
  throw: (s) => { s.tone(2400, 0.03, 'square', 0.03, 0); s.burst(0.18, 900, { q: 1, vol: 0.06, f1: 2400, delay: 0.05 }); },
  bounce: (s) => s.tone(620, 0.06, 'triangle', 0.05, -240),
  explode: (s) => { s.burst(1.3, 900, { type: 'lowpass', vol: 0.65, f1: 40 }); s.tone(52, 1.0, 'sine', 0.55, -28); s.burst(0.25, 3000, { q: 0.6, vol: 0.2, f1: 400 }); },
  // flesh, linen and chitin
  hitBody: (s) => { s.burst(0.07, 700, { q: 1.2, vol: 0.18, f1: 260 }); },
  hitHeart: (s) => { s.burst(0.12, 900, { q: 1, vol: 0.25, f1: 200 }); s.tone(880, 0.25, 'sawtooth', 0.05, -620); s.tone(1320, 0.18, 'sine', 0.04, -900, 0.02); },
  hitScarab: (s) => s.burst(0.05, 4200, { q: 3, vol: 0.1, f1: 1800 }),
  ricochet: (s) => { s.tone(2600 + Math.random() * 1400, 0.12, 'sine', 0.03, -1400); s.burst(0.04, 3000, { q: 2, vol: 0.06 }); },
  killMummy: (s) => { s.burst(0.7, 500, { type: 'lowpass', vol: 0.3, f1: 60 }); s.tone(70, 0.6, 'sawtooth', 0.06, -30); },
  killScarab: (s) => s.burst(0.06, 5200, { q: 4, vol: 0.08, f1: 2600 }),
  // the dead, waking: a low throat rattle through a vowel-ish band
  groan: (s) => { s.tone(62 + Math.random() * 20, 1.1, 'sawtooth', 0.07, -16); s.burst(1.0, 380, { q: 4, vol: 0.08, f1: 260 }); },
  windup: (s) => { s.tone(95, 0.45, 'sawtooth', 0.06, 50); s.burst(0.4, 600, { q: 3, vol: 0.06, f1: 1200 }); },
  swipe: (s) => s.burst(0.18, 1600, { q: 1, vol: 0.12, f1: 500 }),
  nest: (s) => { for (let k = 0; k < 14; k++) s.burst(0.025, 3400 + Math.random() * 1800, { q: 6, vol: 0.05, delay: k * 0.045 }); s.burst(0.8, 300, { type: 'lowpass', vol: 0.15, f1: 60 }); },
  bite: (s) => { s.burst(0.04, 3800, { q: 5, vol: 0.07 }); s.burst(0.03, 4600, { q: 5, vol: 0.05, delay: 0.05 }); },
  hurt: (s) => { s.tone(170, 0.18, 'sawtooth', 0.12, -70); s.burst(0.14, 800, { q: 1, vol: 0.12 }); },
  death: (s) => { s.tone(110, 1.6, 'sawtooth', 0.14, -70); s.burst(1.4, 500, { type: 'lowpass', vol: 0.25, f1: 40 }); },
  pickup: (s) => { s.burst(0.05, 2200, { q: 4, vol: 0.08 }); s.arp([523, 659, 784], 0.04, 0.08, 'square', 0.035); },
  pickupGun: (s) => { s.burst(0.05, 2400, { q: 5, vol: 0.09 }); s.burst(0.06, 1700, { q: 5, vol: 0.1, delay: 0.16 }); s.arp([392, 523, 659, 784], 0.06, 0.12, 'square', 0.04); },
  shrine: (s) => s.arp([523, 659, 784, 1047], 0.09, 0.4, 'sine', 0.05),
  jump: (s) => s.burst(0.08, 900, { q: 1, vol: 0.05 }),
  land: (s) => s.burst(0.1, 500, { type: 'lowpass', vol: 0.12, f1: 120 }),
  exit: (s) => { s.arp([784, 659, 523, 392, 262], 0.12, 0.5, 'triangle', 0.07); s.tone(55, 2.2, 'sawtooth', 0.08, -20); },
});

const EVENT_SFX = {
  shot: (e) => (e.gun === 'S' ? 'shotgun' : 'pistol'),
  empty: () => 'empty', reload: () => 'reload', shell: () => 'shell', switch: () => 'swap',
  throw: () => 'throw', bounce: () => 'bounce', explode: () => 'explode',
  hit: (e) => (e.quiet ? null : e.kind === 'scarab' ? 'hitScarab' : e.heart ? 'hitHeart' : 'hitBody'),
  impact: (e) => (e.quiet || Math.random() < 0.6 ? null : 'ricochet'),
  kill: (e) => (e.kind === 'mummy' ? 'killMummy' : 'killScarab'),
  groan: () => 'groan', windup: () => 'windup', swipe: () => 'swipe', nest: () => 'nest', bite: () => 'bite',
  hurt: () => 'hurt', death: () => 'death', jump: () => 'jump', land: () => 'land', exit: () => 'exit',
  pickup: (e) => (e.kind === 'shotgun' ? 'pickupGun' : 'pickup'),
};

export class Audio {
  constructor() { this.sfx = new Sfx({ volume: 0.75 }); this.droning = false; }
  unlock() { this.sfx.unlock(); this.sfx.autoUnlock(); }
  setMuted(m) { this.sfx.setMuted(m); }
  get muted() { return this.sfx.muted; }
  startAmbience() {
    if (this.droning || !this.sfx.ctx) return;
    this.sfx.startDrone([41.2, 41.6, 61.7], 0.035); // a low beating E, felt more than heard
    this.droning = true;
  }
  event(e) {
    const f = EVENT_SFX[e.type];
    const name = f && f(e);
    if (name) this.sfx.play(name);
  }
}
