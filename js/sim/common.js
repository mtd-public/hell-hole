// Rules shared by the player's weapons and the creatures: events, damage, death, waking,
// hit shapes, steering. Pure: no three.js, no DOM.
import { TUNING as T } from './tuning.js';
import { lineOfSight, downhill } from './level.js';

export const emit = (w, type, data = {}) => w.events.push({ type, t: w.t, ...data });
export const dist2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

export function hurtPlayer(w, amount, from) {
  const p = w.player;
  if (p.hurtT > 0 || w.state !== 'play') return;
  p.hp -= amount; p.hurtT = T.player.hurtIframes; w.stats.taken += amount;
  emit(w, 'hurt', { amount, from });
  if (p.hp <= 0) { p.hp = 0; w.state = 'dead'; w.stats.time = w.t; emit(w, 'death', { from }); }
}

// Wake a sleeper: mummies groan, jackals growl, ba take wing, a mother starts to brood.
export function wake(w, e) {
  if (e.dead || e.state !== 'idle') return;
  e.state = e.type === 'ba' ? 'orbit' : e.type === 'mother' ? 'awake' : 'chase';
  e.t = e.type === 'mother' ? 1.2 : 0;
  emit(w, e.type === 'mummy' ? 'groan' : 'wake', { id: e.id, kind: e.type, x: e.x, z: e.z });
}

export function hearShot(w, k = 1) {
  const p = w.player, r = T.hearRange * k;
  for (const e of w.enemies) if (e.state === 'idle' && dist2(e, p) < r) wake(w, e);
}

export function damage(w, e, amount, how) {
  if (e.dead) return;
  e.hp -= amount; e.recent = (e.recent || 0) + amount;
  if (e.state === 'idle') wake(w, e);
  if (e.hp <= 0) kill(w, e, how);
}

export function kill(w, e, how) {
  if (e.dead) return;
  e.dead = true; e.state = 'dead'; e.deadT = 0; e.how = how; w.stats.kills++;
  emit(w, 'kill', { id: e.id, kind: e.type, how, x: e.x, y: e.y, z: e.z });
  // a mother's brood dies with her
  if (e.type === 'mother') for (const b of w.enemies) if (b.type === 'ba' && b.mother === e.id) kill(w, b, 'mother');
}

// Hit shapes. Bodies are vertical cylinders (y0..y0+h) or spheres; weak points are spheres.
export function bodyOf(e) {
  switch (e.type) {
    case 'mummy': return { cyl: true, r: T.mummy.radius, y0: 0, h: T.mummy.height };
    case 'jackal': return { cyl: true, r: T.jackal.radius, y0: 0, h: T.jackal.height };
    case 'mother': return { cyl: true, r: T.mother.radius, y0: e.y, h: T.mother.height };
    case 'ba': return { cyl: false, r: T.ba.radius, c: [e.x, e.y, e.z] };
    default: return { cyl: true, r: T.scarab.radius, y0: 0, h: T.scarab.height };
  }
}
const ahead = (e, k) => [e.x - Math.sin(e.yaw) * k, e.z - Math.cos(e.yaw) * k];
export function weakOf(e) {
  if (e.type === 'mummy') { const [x, z] = ahead(e, 0.18); return { c: [x, T.mummy.heartY, z], r: T.mummy.heartR, insta: true, how: 'heart' }; }
  if (e.type === 'jackal') { const [x, z] = ahead(e, 0.14); return { c: [x, T.jackal.headY, z], r: T.jackal.headR, mult: T.jackal.headMult, how: 'head' }; }
  return null;
}
// the centre a blast measures to
export function centreOf(e) {
  const b = bodyOf(e);
  return b.cyl ? [e.x, b.y0 + b.h * 0.5, e.z] : b.c;
}

export function faceTo(e, tx, tz, k, dt) {
  const want = Math.atan2(-(tx - e.x), -(tz - e.z));
  const da = Math.atan2(Math.sin(want - e.yaw), Math.cos(want - e.yaw));
  e.yaw += da * Math.min(1, k * dt);
}

// Where a walker heads: straight at you when it can see you and you're close, otherwise down
// the path field. Returns a unit direction and the distance to you.
export function steer(w, e, near = 9) {
  const p = w.player, d = dist2(p, e);
  let tx = p.x, tz = p.z;
  if (!(d < near && lineOfSight(w.L, e.x, e.z, p.x, p.z))) {
    const n = downhill(w.L, w.flow, e.x, e.z);
    if (n) { tx = n.x; tz = n.z; }
  }
  let dx = tx - e.x, dz = tz - e.z; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
  return [dx, dz, d];
}

export function rng(seed) { // mulberry32
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
