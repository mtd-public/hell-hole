// Every number the rules use, each with the reason it has that value.
// (mstr-gme-dsgn-tmpt house rule: a TUNING table with a *why* per value.)

export const TUNING = {
  cell: 3,            // m per map cell: a one-cell corridor is 3 m wide, so a swarm fills it and you can't sidestep forever
  ceil: { corridor: 3.9, room: 7.5 }, // corridors press down on you; rooms open up into the dark

  player: {
    radius: 0.32,     // shoulder width; slips through a doorway with a hand's room either side
    eye: 1.62,        // standing eye height
    speed: 5.8,       // Devil Daggers pace: a mummy (1.35) can never catch you, a scarab (4.4) only nearly
    accel: 55,        // full speed in about 0.1 s: tight, arcade
    airAccel: 16,     // some air steering, less than on the ground
    friction: 14,     // stops in about 0.15 s when you let go
    jumpV: 4.8,       // apex 0.77 m: hops a scarab or a bone pile, never a wall
    gravity: 15,
    hp: 100,
    hurtIframes: 0.25, // a whole swarm biting on one frame can't delete you
  },

  pistol: {           // M1911A1, one per hand
    mag: 7, chamber: 1, // 7 + 1 the first time, 7 per reload after that (the chambered round is spent)
    interval: 0.11,   // fastest a finger works one trigger
    repeat: 0.24,     // holding the trigger refires this often (semi-auto, but forgiving)
    reload: 1.35,     // drop, slap, rack
    spread: 0.008,    // rad: dead on at room distances
    range: 60,
    damage: 1,
    reserveStart: 42, reserveMax: 160,
  },

  shotgun: {          // Remington 870
    tube: 7,
    pellets: 9,       // 00 buck
    spread: 0.07,     // rad: a 1.4 m pattern at 10 m, which covers a jackal or a knot of scarabs
    damage: 1,
    interval: 0.72,   // fire + pump
    reloadShell: 0.42, // shell by shell; any trigger pull interrupts
    shellsStart: 8, shellsMax: 48,
    range: 40,
  },

  grenade: {          // Mk 2, found: a 1940s expedition left a crate of them down here
    start: 0, max: 6,
    speed: 12, up: 3.6, // a lob that clears a mummy's head and lands 8-12 m away
    gravity: 14,
    restitution: 0.42, // two or three bounces off stone
    friction: 0.55,   // each bounce bleeds speed
    roll: 5,          // 1/s drag rolling on stone, so it settles near where it lands
    fuse: 2.0,
    radius: 4.5,
    damage: 14,       // kills a mummy at the centre, wounds at the edge
    selfScale: 0.5,   // your own grenade hurts, but half
    cooldown: 0.6,
  },

  mummy: {
    hp: 7,            // a full magazine to the body...
    speed: 1.35,      // shamble: dangerous in numbers and in corners, never in a straight chase
    wakeRange: 15,    // sees you this far in its line of sight
    hearRange: 13,    // a gunshot wakes every mummy this close, line of sight or not
    reach: 1.15,
    windup: 0.55,     // arms go up first: a read-and-react window
    damage: 18,
    cooldown: 1.3,
    radius: 0.34, height: 1.85,
    heartY: 1.42, heartR: 0.13, // ...or one round through the heart scarab
  },

  scarab: {
    hp: 1,
    speed: 4.4,       // just slower than you: they catch you only if you stop
    accel: 22,
    jitter: 1.8,      // rad/s of wander, so a swarm spreads like spilled oil instead of a conga line
    bite: 4, biteCooldown: 0.7,
    radius: 0.24,     // a touch generous: they're hard to hit on the floor
    reach: 0.55,
    height: 0.25,
  },

  nest: {
    count: 16,        // one nest is a handful; two at once is a problem
    trigger: 9,       // opens when you come this close with a line of sight
    rate: 14,         // scarabs per second while it empties
  },

  jackal: {           // Jackal Warden: 2.5 m, khopesh
    hp: 12,           // a magazine and a half to the body...
    headY: 2.36, headR: 0.24, headMult: 3, // ...or four rounds to the head: aim up
    speed: 2.4,       // walks faster than a mummy, still slower than you
    lunge: 8.5, lungeTime: 0.3, crouch: 0.42, // from 3-7 m it crouches (the read), then covers ~2.5 m in a blink
    lungeMin: 2.8, lungeMax: 7, lungeCooldown: 3.2,
    reach: 1.75, windup: 0.42, damage: 22, cooldown: 1.2, // the khopesh outreaches a mummy's arms
    stagger: 0.6, staggerDamage: 4, // a load of buckshot or a blast knocks it out of any attack
    wakeRange: 18, radius: 0.42, height: 2.55,
  },

  ba: {               // a skull on painted wings
    hp: 2,
    speed: 6.5,       // orbits fast enough that you track it, not lead it
    orbit: [4.5, 7.5], // m from you while circling
    alt: 3.2,         // flies above head height in rooms (corridors clamp it under the ceiling)
    dive: 10.5, diveTime: 1.1, telegraph: 0.38, // a screech and a hover, then a straight dive at where your head was
    diveGap: [1.4, 3.2], // s between one bird's dives
    globalGap: 0.55,  // and never two dives starting closer than this: a flock is pressure, not a wall
    damage: 8, radius: 0.34, hitRange: 0.8,
    wakeRange: 15,
  },

  mother: {           // the Canopic Mother: a floating jar that births ba
    hp: 22,
    y: 1.3, radius: 0.8, height: 2.5,      // floats with her base at 1.3 m, her lid at 3.8 m
    seamY0: 1.75, seamY1: 2.15, seamMult: 2, // the crimson seam under the lid takes double
    birthEvery: 3.2,  // a ba every 3.2 s while she can see you...
    maxBrood: 5,      // ...up to five of hers alive at once
    wakeRange: 20,
  },

  bazooka: {          // M1-pattern, 1943: found at the expedition's camp
    reload: 1.7,      // the loader is you: slide one in, wire it, shoulder it
    rocketsMax: 6, found: 2, crate: 2,
    speed: 17,        // slow enough to see, fast enough to land
    life: 4,
    radius: 3.6, damage: 20, direct: 12, selfScale: 0.6, // blast + direct = 32 breaks a Mother (22) outright; a near miss (20) leaves her cracked
    backblast: 1.1, backDamage: 10, // fire with your back to a wall and the blast comes back at you
  },

  carry: { minHp: 60 }, // descending keeps your kit; you arrive with at least this much health

  shrine: { charge: 100, rate: 32, range: 1.7 }, // a full heal, once, in about three seconds

  pickup: { radius: 0.95, ammo: 21, shells: 8, grenades: 2 },
  hearRange: 13,      // a gunshot wakes anything this close, line of sight or not

  flow: { recompute: 0.25 }, // s between path-field rebuilds (and on every cell change)
};
