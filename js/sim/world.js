// The rules. createWorld(depth, { carry }) → world; step(world, control, dt) advances it.
// Pure: no three.js, no DOM. Everything the view and the audio need comes out as world.events.
//
// Conventions: x east, z south, y up (metres). yaw 0 looks north (-z), like a three.js camera
// with rotation.y = yaw; forward = (-sin yaw, -cos yaw).
//
//   common.js   events, damage, death, waking, hit shapes, steering
//   arms.js     the 1911s, the 870, the bazooka, grenades, rockets, blasts
//   enemies.js  mummies, scarabs, jackals, ba, the Canopic Mother
import { TUNING as T } from './tuning.js';
import { DEPTHS } from './levels.js';
import { parseLevel, pushOut, pathField } from './level.js';
import { emit, rng } from './common.js';
import { weapons, stepGrenades, stepRockets, switchTo, owned } from './arms.js';
import { spawn, stepEnemies } from './enemies.js';

export { rng, owned };

export function createWorld(depth = 0, { seed = 1, carry = null } = {}) {
  const def = DEPTHS[depth], L = parseLevel(def);
  const P = T.pistol;
  const w = {
    L, depth, def, t: 0, rand: rng(seed), state: 'play', events: [], idSeq: 1, baGap: 0,
    player: {
      x: L.start.x, z: L.start.z, y: 0, vx: 0, vz: 0, vy: 0, yaw: L.start.yaw, pitch: 0,
      hp: T.player.hp, onGround: true, hurtT: 0, moving: 0,
      weapon: 'pistols', switchT: 0, has: { shotgun: false, bazooka: false },
      guns: { L: gun(P.mag + P.chamber), R: gun(P.mag + P.chamber) }, reserve: P.reserveStart,
      sg: { tube: 0, last: -9, held: false, loading: false, lt: 0 }, shells: 0,
      bz: { tube: 0, reload: 0, held: false }, rockets: 0,
      grenades: T.grenade.start, gLast: -9, healing: false,
    },
    enemies: [], scarabs: [], grenades: [], rockets: [],
    nests: L.nests.map((n) => ({ ...n, left: T.nest.count, open: false, acc: 0 })),
    pickups: L.pickups.map((p, k) => ({ ...p, id: k, taken: false })),
    shrines: L.shrines.map((s) => ({ ...s, charge: T.shrine.charge })),
    flow: null, flowCell: -1, flowT: 0,
    stats: { kills: 0, shots: 0, hits: 0, hearts: 0, heads: 0, taken: 0 },
  };
  for (const s of L.spawns) w.enemies.push(spawn(w, s.type, s.x, s.z));
  const kit = carry || def.kit;
  if (kit) applyKit(w.player, kit, !!carry);
  return w;
}

function gun(mag) { return { mag, reload: 0, last: -9, held: false }; }

// What you take down the stairs with you.
export function loadout(w) {
  const p = w.player;
  return {
    hp: Math.round(p.hp), reserve: p.reserve, magL: p.guns.L.mag, magR: p.guns.R.mag,
    shotgun: p.has.shotgun, sgTube: p.sg.tube, shells: p.shells,
    bazooka: p.has.bazooka, bzTube: p.bz.tube, rockets: p.rockets, grenades: p.grenades, weapon: p.weapon,
  };
}

function applyKit(p, k, carried) {
  p.hp = carried ? Math.max(T.carry.minHp, k.hp ?? T.player.hp) : (k.hp ?? T.player.hp);
  if (k.reserve != null) p.reserve = k.reserve;
  if (k.magL != null) p.guns.L.mag = k.magL;
  if (k.magR != null) p.guns.R.mag = k.magR;
  p.has.shotgun = !!k.shotgun; p.sg.tube = k.sgTube ?? 0; p.shells = k.shells ?? 0;
  p.has.bazooka = !!k.bazooka; p.bz.tube = k.bzTube ?? 0; p.rockets = k.rockets ?? 0;
  p.grenades = k.grenades ?? 0;
  if (k.weapon && owned(p).includes(k.weapon)) p.weapon = k.weapon;
}

// ---------------------------------------------------------------------------------- step
export function step(w, c, dt) {
  if (w.state !== 'play') return;
  w.t += dt;
  const p = w.player;
  p.yaw += c.yaw || 0;
  p.pitch = Math.max(-1.45, Math.min(1.45, p.pitch + (c.pitch || 0)));
  movePlayer(w, c, dt);
  updateFlow(w, dt);
  weapons(w, c, dt);
  stepGrenades(w, dt);
  stepRockets(w, dt);
  stepEnemies(w, dt);
  collect(w, dt);
  if (p.hurtT > 0) p.hurtT -= dt;
  const ex = w.L.exit;
  if (w.state === 'play' && Math.hypot(p.x - ex.x, p.z - ex.z) < 1.1) { w.state = 'clear'; w.stats.time = w.t; emit(w, 'exit'); }
}

function movePlayer(w, c, dt) {
  const p = w.player, P = T.player;
  const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw), rx = Math.cos(p.yaw), rz = -Math.sin(p.yaw);
  let wx = (c.mx || 0) * rx + (c.my || 0) * fx, wz = (c.mx || 0) * rz + (c.my || 0) * fz;
  const wl = Math.hypot(wx, wz);
  if (wl > 1) { wx /= wl; wz /= wl; }
  const a = p.onGround ? P.accel : P.airAccel;
  const tx = wx * P.speed, tz = wz * P.speed;
  const ddx = tx - p.vx, ddz = tz - p.vz, dl = Math.hypot(ddx, ddz), maxd = a * dt;
  if (dl > maxd) { p.vx += (ddx / dl) * maxd; p.vz += (ddz / dl) * maxd; } else { p.vx = tx; p.vz = tz; }
  if (wl < 0.01 && p.onGround) { const k = Math.max(0, 1 - P.friction * dt); p.vx *= k; p.vz *= k; }
  p.x += p.vx * dt; p.z += p.vz * dt;
  pushOut(w.L, p, P.radius);
  if (c.jump && p.onGround) { p.vy = P.jumpV; p.onGround = false; emit(w, 'jump'); }
  if (!p.onGround) {
    p.vy -= P.gravity * dt; p.y += p.vy * dt;
    if (p.y <= 0) { if (p.vy < -3) emit(w, 'land'); p.y = 0; p.vy = 0; p.onGround = true; }
  }
  p.moving = Math.hypot(p.vx, p.vz) / P.speed;
}

function updateFlow(w, dt) {
  const p = w.player, C = T.cell;
  const cell = Math.floor(p.z / C) * w.L.w + Math.floor(p.x / C);
  w.flowT -= dt;
  if (cell !== w.flowCell || w.flowT <= 0 || !w.flow) {
    w.flow = pathField(w.L, p.x, p.z, w.flow); w.flowCell = cell; w.flowT = T.flow.recompute;
  }
}

// ---------------------------------------------------------------------------------- pickups
function collect(w, dt) {
  const p = w.player, K = T.pickup, B = T.bazooka;
  for (const k of w.pickups) {
    if (k.taken || Math.hypot(k.x - p.x, k.z - p.z) > K.radius) continue;
    if (k.kind === 'ammo') { if (p.reserve >= T.pistol.reserveMax) continue; p.reserve = Math.min(T.pistol.reserveMax, p.reserve + K.ammo); }
    else if (k.kind === 'shells') { if (p.shells >= T.shotgun.shellsMax) continue; p.shells = Math.min(T.shotgun.shellsMax, p.shells + K.shells); }
    else if (k.kind === 'grenades') { if (p.grenades >= T.grenade.max) continue; p.grenades = Math.min(T.grenade.max, p.grenades + K.grenades); }
    else if (k.kind === 'rockets') { if (p.rockets >= B.rocketsMax) continue; p.rockets = Math.min(B.rocketsMax, p.rockets + B.crate); }
    else if (k.kind === 'shotgun') { p.has.shotgun = true; p.sg.tube = Math.max(p.sg.tube, 4); p.shells += 6; switchTo(w, 'shotgun'); }
    else if (k.kind === 'bazooka') { p.has.bazooka = true; p.bz.tube = 1; p.rockets = Math.min(B.rocketsMax, p.rockets + B.found); switchTo(w, 'bazooka'); }
    k.taken = true;
    emit(w, 'pickup', { kind: k.kind, id: k.id });
  }
  p.healing = false;
  for (const s of w.shrines) {
    if (s.charge <= 0 || p.hp >= T.player.hp || Math.hypot(s.x - p.x, s.z - p.z) > T.shrine.range) continue;
    const h = Math.min(T.shrine.rate * dt, s.charge, T.player.hp - p.hp);
    p.hp += h; s.charge -= h; p.healing = true;
    if (s.charge <= 0) emit(w, 'shrineSpent');
  }
}
