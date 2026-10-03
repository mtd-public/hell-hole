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
  // Depth II
  bazooka: (s) => { s.burst(0.6, 600, { q: 0.8, vol: 0.4, f1: 2600 }); s.tone(70, 0.4, 'sine', 0.35, -30); s.burst(0.9, 1800, { q: 1.5, vol: 0.12, f1: 600, delay: 0.1 }); },
  backblast: (s) => { s.burst(0.5, 400, { type: 'lowpass', vol: 0.4, f1: 80 }); s.tone(140, 0.25, 'sawtooth', 0.12, -80); },
  rocketReload: (s) => { s.burst(0.06, 1400, { q: 4, vol: 0.09 }); s.burst(0.05, 2600, { q: 5, vol: 0.08, delay: 0.7 }); s.tone(1800, 0.03, 'square', 0.03, 0, 1.3); },
  growl: (s) => { s.tone(78, 0.9, 'sawtooth', 0.08, -18); s.burst(0.8, 300, { q: 3, vol: 0.1, f1: 180 }); s.tone(156, 0.5, 'square', 0.02, -40, 0.1); },
  snarl: (s) => { s.burst(0.35, 900, { q: 2, vol: 0.12, f1: 2200 }); s.tone(110, 0.3, 'sawtooth', 0.08, 90); },
  lunge: (s) => s.burst(0.22, 700, { q: 1, vol: 0.12, f1: 2400 }),
  slash: (s) => { s.burst(0.16, 4200, { q: 2, vol: 0.12, f1: 1200 }); s.tone(2600, 0.12, 'sine', 0.03, -1800); },
  yelp: (s) => { s.tone(620, 0.18, 'sawtooth', 0.06, -380); s.burst(0.1, 1200, { q: 2, vol: 0.06 }); },
  killJackal: (s) => { s.burst(0.6, 500, { type: 'lowpass', vol: 0.3, f1: 60 }); s.tone(520, 0.9, 'sawtooth', 0.05, -420); },
  screech: (s) => { s.tone(2200, 0.35, 'sawtooth', 0.05, -1400); s.tone(3300, 0.25, 'square', 0.015, -2000, 0.02); s.burst(0.3, 5200, { q: 6, vol: 0.05 }); },
  dive: (s) => s.burst(0.5, 600, { q: 1.5, vol: 0.08, f1: 2800 }),
  peck: (s) => { s.burst(0.05, 3600, { q: 4, vol: 0.1 }); s.tone(900, 0.05, 'square', 0.04, -300); },
  killBa: (s) => { for (let k = 0; k < 4; k++) s.burst(0.04, 2800 + k * 400, { q: 6, vol: 0.06, delay: k * 0.05 }); },
  hum: (s) => { s.tone(55, 1.6, 'sine', 0.12, 3); s.tone(82.4, 1.6, 'triangle', 0.05, -2); },
  birth: (s) => { s.burst(0.25, 500, { q: 2, vol: 0.12, f1: 1400 }); s.tone(1800, 0.3, 'sawtooth', 0.03, -1200, 0.1); },
  shatter: (s) => { for (let k = 0; k < 10; k++) s.burst(0.08, 3000 + Math.random() * 3000, { q: 8, vol: 0.07, delay: k * 0.035 }); s.burst(1.0, 700, { type: 'lowpass', vol: 0.35, f1: 50 }); s.tone(41, 1.4, 'sine', 0.3, -12); },
  hitStone: (s) => s.burst(0.05, 2400, { q: 3, vol: 0.09, f1: 900 }),
});

const EVENT_SFX = {
  shot: (e) => (e.gun === 'S' ? 'shotgun' : e.gun === 'B' ? 'bazooka' : 'pistol'),
  empty: () => 'empty', reload: (e) => (e.gun === 'B' ? 'rocketReload' : 'reload'), shell: () => 'shell', switch: () => 'swap',
  throw: () => 'throw', bounce: () => 'bounce', explode: () => 'explode',
  hit: (e) => (e.quiet ? null : e.kind === 'scarab' ? 'hitScarab' : e.crit ? 'hitHeart' : e.kind === 'mother' ? 'hitStone' : 'hitBody'),
  impact: (e) => (e.quiet || Math.random() < 0.6 ? null : 'ricochet'),
  kill: (e) => ({ mummy: 'killMummy', jackal: 'killJackal', ba: 'killBa', mother: 'shatter' }[e.kind] || 'killScarab'),
  wake: (e) => ({ jackal: 'growl', ba: 'screech', mother: 'hum' }[e.kind] || null),
  crouch: () => 'snarl', lunge: () => 'lunge', slash: () => 'slash', stagger: () => 'yelp',
  screech: () => 'screech', dive: () => 'dive', peck: () => 'peck', birth: () => 'birth', backblast: () => 'backblast',
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
