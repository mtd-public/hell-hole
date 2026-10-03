// The rules. createWorld(depth) → world; step(world, control, dt) advances it. Pure: no
// three.js, no DOM. Everything the view and the audio need comes out as world.events.
//
// Conventions: x east, z south, y up (metres). yaw 0 looks north (-z), like a three.js camera
// with rotation.y = yaw; forward = (-sin yaw, -cos yaw).
import { TUNING as T } from './tuning.js';
import { DEPTHS } from './levels.js';
import { parseLevel, pushOut, rayWall, lineOfSight, pathField, downhill, ceilAt, isWall } from './level.js';

export function rng(seed) { // mulberry32
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export function createWorld(depth = 0, { seed = 1 } = {}) {
  const def = DEPTHS[depth], L = parseLevel(def);
  const P = T.pistol, S = T.shotgun;
  const w = {
    L, depth, def, t: 0, rand: rng(seed), state: 'play', events: [], idSeq: 1,
    player: {
      x: L.start.x, z: L.start.z, y: 0, vx: 0, vz: 0, vy: 0, yaw: L.start.yaw, pitch: 0,
      hp: T.player.hp, onGround: true, hurtT: 0, moving: 0,
      weapon: 'pistols', switchT: 0, has: { shotgun: false },
      guns: { L: gun(P.mag + P.chamber), R: gun(P.mag + P.chamber) }, reserve: P.reserveStart,
      sg: { tube: 0, last: -9, held: false, loading: false, lt: 0 }, shells: 0,
      grenades: T.grenade.start, gLast: -9, healing: false,
    },
    enemies: [], scarabs: [], grenades: [],
    nests: L.nests.map((n) => ({ ...n, left: T.nest.count, open: false, acc: 0 })),
    pickups: L.pickups.map((p, k) => ({ ...p, id: k, taken: false })),
    shrines: L.shrines.map((s) => ({ ...s, charge: T.shrine.charge })),
    flow: null, flowCell: -1, flowT: 0,
    stats: { kills: 0, shots: 0, hits: 0, hearts: 0, taken: 0, total: L.spawns.length + L.nests.length * T.nest.count },
  };
  for (const s of L.spawns) w.enemies.push(mummy(w, s.x, s.z));
  return w;
}

function gun(mag) { return { mag, reload: 0, last: -9, held: false }; }

function mummy(w, x, z) {
  return { id: w.idSeq++, type: 'mummy', x, z, y: 0, vx: 0, vz: 0, yaw: w.rand() * 6.28, hp: T.mummy.hp, state: 'idle', t: 0, cd: 0, deadT: 0, phase: w.rand() * 6.28 };
}

function scarab(w, x, z) {
  const a = w.rand() * 6.28;
  return { id: w.idSeq++, type: 'scarab', x: x + Math.cos(a) * 0.4, z: z + Math.sin(a) * 0.4, y: 0, vx: 0, vz: 0, yaw: a, hp: T.scarab.hp, cd: 0, wander: a, deadT: 0, dead: false };
}

const emit = (w, type, data = {}) => w.events.push({ type, t: w.t, ...data });

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
  stepNests(w, dt);
  for (const e of w.enemies) stepMummy(w, e, dt);
  stepScarabs(w, dt);
  separate(w);
  collect(w, dt);
  if (p.hurtT > 0) p.hurtT -= dt;
  const ex = w.L.exit;
  if (Math.hypot(p.x - ex.x, p.z - ex.z) < 1.1) { w.state = 'clear'; w.stats.time = w.t; emit(w, 'exit'); }
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

// ---------------------------------------------------------------------------------- weapons
function weapons(w, c, dt) {
  const p = w.player;
  if (c.weapon === 1 && p.weapon !== 'pistols') switchTo(w, 'pistols');
  if (c.weapon === 2 && p.weapon !== 'shotgun' && p.has.shotgun) switchTo(w, 'shotgun');
  if (c.swap && p.has.shotgun) switchTo(w, p.weapon === 'pistols' ? 'shotgun' : 'pistols');
  if (p.switchT > 0) p.switchT -= dt;
  const ready = p.switchT <= 0;
  // reloads tick whatever is in hand
  for (const side of ['L', 'R']) {
    const g = p.guns[side];
    if (g.reload > 0) { g.reload -= dt; if (g.reload <= 0) finishReload(w, side); }
  }
  if (p.weapon === 'pistols') {
    for (const side of ['L', 'R']) {
      const g = p.guns[side], held = side === 'L' ? !!c.fireL : !!c.fireR, edge = held && !g.held;
      g.held = held;
      if (!ready || !held || g.reload > 0) continue;
      const since = w.t - g.last;
      if (!(edge ? since >= T.pistol.interval : since >= T.pistol.repeat)) continue;
      if (g.mag <= 0) { if (edge) emit(w, 'empty', { gun: side }); startReload(w, side); continue; }
      g.mag--; g.last = w.t; w.stats.shots++;
      const [dx, dy, dz] = aim(w, T.pistol.spread);
      hitscan(w, dx, dy, dz, T.pistol.range, T.pistol.damage);
      emit(w, 'shot', { gun: side });
      hearShot(w);
      if (g.mag === 0) startReload(w, side);
    }
    if (c.reload) { startReload(w, 'L'); startReload(w, 'R'); }
  } else {
    const s = p.sg, held = !!(c.fireL || c.fireR), edge = held && !s.held;
    s.held = held;
    if (s.loading) {
      if (held && s.tube > 0) s.loading = false; // a trigger pull interrupts the load
      else {
        s.lt -= dt;
        if (s.lt <= 0) {
          if (s.tube < T.shotgun.tube && p.shells > 0) { s.tube++; p.shells--; emit(w, 'shell'); s.lt = T.shotgun.reloadShell; }
          if (s.tube >= T.shotgun.tube || p.shells <= 0) s.loading = false;
        }
      }
    }
    if (ready && held && !s.loading && w.t - s.last >= T.shotgun.interval) {
      if (s.tube <= 0) { if (edge) emit(w, 'empty', { gun: 'S' }); startShells(w); }
      else {
        s.tube--; s.last = w.t; w.stats.shots++;
        for (let k = 0; k < T.shotgun.pellets; k++) { const [dx, dy, dz] = aim(w, T.shotgun.spread); hitscan(w, dx, dy, dz, T.shotgun.range, T.shotgun.damage, k > 0); }
        emit(w, 'shot', { gun: 'S' });
        hearShot(w, 1.3);
        if (s.tube === 0) startShells(w);
      }
    }
    if (c.reload) startShells(w);
  }
  // grenades: the left hand throws whatever is in the right
  if (c.grenade && p.grenades > 0 && w.t - p.gLast >= T.grenade.cooldown) {
    p.grenades--; p.gLast = w.t;
    const [dx, dy, dz] = aim(w, 0), G = T.grenade, ey = p.y + T.player.eye - 0.15;
    w.grenades.push({ x: p.x + dx * 0.4, y: ey, z: p.z + dz * 0.4, vx: dx * G.speed + p.vx, vy: dy * G.speed + G.up + p.vy * 0.5, vz: dz * G.speed + p.vz, fuse: G.fuse, spin: 0 });
    emit(w, 'throw');
  }
}

function switchTo(w, weapon) {
  const p = w.player;
  if (p.weapon === weapon) return;
  p.weapon = weapon; p.switchT = 0.35; p.sg.loading = false;
  emit(w, 'switch', { weapon });
}

function startReload(w, side) {
  const p = w.player, g = p.guns[side];
  if (g.reload > 0 || g.mag >= T.pistol.mag + (g.mag > 0 ? T.pistol.chamber : 0) || p.reserve <= 0) return;
  g.reload = T.pistol.reload; emit(w, 'reload', { gun: side });
}
function finishReload(w, side) {
  const p = w.player, g = p.guns[side];
  const cap = T.pistol.mag + (g.mag > 0 ? T.pistol.chamber : 0), take = Math.min(cap - g.mag, p.reserve);
  g.mag += take; p.reserve -= take; g.reload = 0;
  emit(w, 'reloaded', { gun: side });
}
function startShells(w) {
  const p = w.player, s = p.sg;
  if (s.loading || s.tube >= T.shotgun.tube || p.shells <= 0) return;
  s.loading = true; s.lt = T.shotgun.reloadShell;
}

// The eye ray with a random cone of `spread` radians.
function aim(w, spread) {
  const p = w.player;
  const yaw = p.yaw + (w.rand() - 0.5) * 2 * spread, pitch = p.pitch + (w.rand() - 0.5) * 2 * spread;
  const cp = Math.cos(pitch);
  return [-Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp];
}

// Heart of a mummy facing yaw: just in front of the chest.
function heartOf(e) { return [e.x - Math.sin(e.yaw) * 0.18, T.mummy.heartY, e.z - Math.cos(e.yaw) * 0.18]; }

// A bullet from the eye along (dx, dy, dz). The nearest of: wall, floor, ceiling, a body.
function hitscan(w, dx, dy, dz, range, dmg, quiet = false) {
  const p = w.player, L = w.L;
  const ox = p.x, oy = p.y + T.player.eye, oz = p.z;
  const hl = Math.hypot(dx, dz);
  let tEnv = range, nx = 0, ny = 0, nz = 0;
  if (hl > 1e-6) { const r = rayWall(L, ox, oz, dx / hl, dz / hl, range * hl); tEnv = r.t / hl; nx = r.nx; nz = r.nz; }
  if (dy < 0) { const tf = -oy / dy; if (tf < tEnv) { tEnv = tf; nx = 0; ny = 1; nz = 0; } }
  if (dy > 0) { const tc = (ceilAt(L, ox, oz) - oy) / dy; if (tc < tEnv) { tEnv = tc; nx = 0; ny = -1; nz = 0; } }
  let best = null, bt = tEnv, heart = false;
  const test = (e, r, h) => {
    const fx = ox - e.x, fz = oz - e.z, a = dx * dx + dz * dz;
    if (a < 1e-9) return;
    const b = 2 * (fx * dx + fz * dz), cc = fx * fx + fz * fz - r * r, disc = b * b - 4 * a * cc;
    if (disc < 0) return;
    const t = (-b - Math.sqrt(disc)) / (2 * a);
    if (t <= 0 || t >= bt) return;
    const y = oy + dy * t;
    if (y < e.y || y > e.y + h) return;
    bt = t; best = e; heart = false;
  };
  for (const e of w.enemies) {
    if (e.state === 'dead') continue;
    test(e, T.mummy.radius, T.mummy.height);
    // the heart scarab: a small sphere, checked against the body hit
    const [hx, hy, hz] = heartOf(e), fx = ox - hx, fy = oy - hy, fz = oz - hz;
    const b = fx * dx + fy * dy + fz * dz, cc = fx * fx + fy * fy + fz * fz - T.mummy.heartR ** 2, disc = b * b - cc;
    if (disc >= 0) { const t = -b - Math.sqrt(disc); if (t > 0 && t <= bt + 0.25) { bt = Math.min(bt, t); best = e; heart = true; } }
  }
  for (const s of w.scarabs) if (!s.dead) test(s, T.scarab.radius, T.scarab.height);
  if (best) {
    const hx = ox + dx * bt, hy = oy + dy * bt, hz = oz + dz * bt;
    w.stats.hits++;
    if (best.type === 'mummy') {
      if (heart) w.stats.hearts++;
      damage(w, best, heart ? 999 : dmg, heart ? 'heart' : 'body');
      emit(w, 'hit', { x: hx, y: hy, z: hz, kind: best.type, heart, id: best.id, quiet });
    } else {
      damage(w, best, dmg, 'body');
      emit(w, 'hit', { x: hx, y: hy, z: hz, kind: 'scarab', id: best.id, quiet });
    }
  } else if (tEnv < range) {
    emit(w, 'impact', { x: ox + dx * tEnv, y: oy + dy * tEnv, z: oz + dz * tEnv, nx, ny, nz, quiet });
  }
}

function damage(w, e, amount, how) {
  if (e.type === 'mummy') {
    if (e.state === 'dead') return;
    e.hp -= amount;
    if (e.state === 'idle') wake(w, e);
    if (e.hp <= 0) { e.state = 'dead'; e.deadT = 0; e.how = how; w.stats.kills++; emit(w, 'kill', { id: e.id, kind: 'mummy', how, x: e.x, z: e.z }); }
  } else {
    if (e.dead) return;
    e.hp -= amount;
    if (e.hp <= 0) { e.dead = true; e.deadT = 0; w.stats.kills++; emit(w, 'kill', { id: e.id, kind: 'scarab', x: e.x, z: e.z }); }
  }
}

function hearShot(w, k = 1) {
  const p = w.player, r = T.mummy.hearRange * k;
  for (const e of w.enemies) if (e.state === 'idle' && Math.hypot(e.x - p.x, e.z - p.z) < r) wake(w, e);
}
function wake(w, e) { e.state = 'chase'; e.t = 0; emit(w, 'groan', { id: e.id, x: e.x, z: e.z }); }

function hurtPlayer(w, amount, from) {
  const p = w.player;
  if (p.hurtT > 0 || w.state !== 'play') return;
  p.hp -= amount; p.hurtT = T.player.hurtIframes; w.stats.taken += amount;
  emit(w, 'hurt', { amount, from });
  if (p.hp <= 0) { p.hp = 0; w.state = 'dead'; w.stats.time = w.t; emit(w, 'death', { from }); }
}

// ---------------------------------------------------------------------------------- grenades
function stepGrenades(w, dt) {
  const G = T.grenade, L = w.L;
  for (const g of w.grenades) {
    g.fuse -= dt; g.spin += dt * 9;
    g.vy -= G.gravity * dt;
    const nx = g.x + g.vx * dt, nz = g.z + g.vz * dt;
    if (isWall(L, nx, g.z)) { g.vx = -g.vx * G.restitution; emit(w, 'bounce', { x: g.x, y: g.y, z: g.z }); } else g.x = nx;
    if (isWall(L, g.x, nz)) { g.vz = -g.vz * G.restitution; emit(w, 'bounce', { x: g.x, y: g.y, z: g.z }); } else g.z = nz;
    g.y += g.vy * dt;
    if (g.y < 0.06) { g.y = 0.06; if (g.vy < -1.5) emit(w, 'bounce', { x: g.x, y: g.y, z: g.z }); g.vy = Math.abs(g.vy) * G.restitution; g.vx *= G.friction; g.vz *= G.friction; if (g.vy < 0.4) g.vy = 0; }
    if (g.y <= 0.061 && g.vy === 0) { const k = Math.max(0, 1 - G.roll * dt); g.vx *= k; g.vz *= k; }
    const top = ceilAt(L, g.x, g.z) - 0.08;
    if (g.y > top) { g.y = top; g.vy = -Math.abs(g.vy) * G.restitution; }
    for (const s of L.solids) { const dx = g.x - s.x, dz = g.z - s.z, d = Math.hypot(dx, dz); if (d < s.r + 0.05 && d > 1e-6) { g.x = s.x + dx / d * (s.r + 0.05); g.z = s.z + dz / d * (s.r + 0.05); const vn = (g.vx * dx + g.vz * dz) / d; if (vn < 0) { g.vx -= (1 + G.restitution) * vn * dx / d; g.vz -= (1 + G.restitution) * vn * dz / d; } } }
    if (g.fuse <= 0) { g.done = true; explode(w, g.x, g.y, g.z); }
  }
  w.grenades = w.grenades.filter((g) => !g.done);
}

function explode(w, x, y, z) {
  const G = T.grenade, L = w.L, p = w.player;
  emit(w, 'explode', { x, y, z });
  const hurt = (e, h) => {
    const d = Math.hypot(e.x - x, (e.y + h) - y, e.z - z);
    if (d > G.radius || !lineOfSight(L, x, z, e.x, e.z)) return 0;
    return Math.max(1, Math.round(G.damage * (1 - d / G.radius)));
  };
  for (const e of w.enemies) if (e.state !== 'dead') { const dmg = hurt(e, 1); if (dmg) damage(w, e, dmg, 'blast'); }
  for (const s of w.scarabs) if (!s.dead) { const dmg = hurt(s, 0.1); if (dmg) damage(w, s, dmg, 'blast'); }
  for (const n of w.nests) if (!n.open && Math.hypot(n.x - x, n.z - z) < G.radius) openNest(w, n);
  const pd = hurt(p, 1);
  if (pd) { p.hurtT = 0; hurtPlayer(w, Math.round(pd * G.selfScale), 'grenade'); }
  hearShot(w, 1.5);
}

// ---------------------------------------------------------------------------------- enemies
function stepNests(w, dt) {
  const p = w.player;
  for (const n of w.nests) {
    if (!n.open) {
      if (Math.hypot(n.x - p.x, n.z - p.z) < T.nest.trigger && lineOfSight(w.L, n.x, n.z, p.x, p.z)) openNest(w, n);
      continue;
    }
    if (n.left <= 0) continue;
    n.acc += T.nest.rate * dt;
    while (n.acc >= 1 && n.left > 0) { n.acc -= 1; n.left--; w.scarabs.push(scarab(w, n.x, n.z)); }
  }
}
function openNest(w, n) { if (n.open) return; n.open = true; emit(w, 'nest', { x: n.x, z: n.z }); }

function steer(w, e, speed, dt, accel) {
  const p = w.player, d = Math.hypot(p.x - e.x, p.z - e.z);
  let tx = p.x, tz = p.z;
  if (!(d < 9 && lineOfSight(w.L, e.x, e.z, p.x, p.z))) {
    const n = downhill(w.L, w.flow, e.x, e.z);
    if (n) { tx = n.x; tz = n.z; }
  }
  let dx = tx - e.x, dz = tz - e.z; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
  return [dx, dz, d];
}

function stepMummy(w, e, dt) {
  const M = T.mummy, p = w.player;
  if (e.state === 'dead') { e.deadT += dt; return; }
  const d = Math.hypot(p.x - e.x, p.z - e.z);
  if (e.state === 'idle') {
    e.t += dt;
    if (d < M.wakeRange && lineOfSight(w.L, e.x, e.z, p.x, p.z)) wake(w, e);
    return;
  }
  if (e.cd > 0) e.cd -= dt;
  const face = (tx, tz, k) => { const want = Math.atan2(-(tx - e.x), -(tz - e.z)); let da = want - e.yaw; da = Math.atan2(Math.sin(da), Math.cos(da)); e.yaw += da * Math.min(1, k * dt); };
  if (e.state === 'windup') {
    e.t -= dt; face(p.x, p.z, 8);
    if (e.t <= 0) {
      if (d < M.reach + 0.35) hurtPlayer(w, M.damage, 'mummy');
      emit(w, 'swipe', { id: e.id, hit: d < M.reach + 0.35 });
      e.state = 'chase'; e.cd = M.cooldown;
    }
    return;
  }
  // chase: shamble down the path field, straight at you once it can see you
  const [dx, dz] = steer(w, e, M.speed, dt);
  e.vx = dx * M.speed; e.vz = dz * M.speed;
  e.x += e.vx * dt; e.z += e.vz * dt;
  pushOut(w.L, e, M.radius);
  face(e.x + dx, e.z + dz, 4);
  if (d < M.reach && e.cd <= 0) { e.state = 'windup'; e.t = M.windup; emit(w, 'windup', { id: e.id }); }
}

function stepScarabs(w, dt) {
  const S = T.scarab, p = w.player;
  for (const s of w.scarabs) {
    if (s.dead) { s.deadT += dt; continue; }
    if (s.cd > 0) s.cd -= dt;
    const [dx, dz, d] = steer(w, s, S.speed, dt);
    s.wander += (w.rand() - 0.5) * S.jitter * 2 * dt * 6;
    const wob = Math.sin(s.wander) * 0.6;
    const cx = dx * Math.cos(wob) - dz * Math.sin(wob), cz = dx * Math.sin(wob) + dz * Math.cos(wob);
    const tx = cx * S.speed, tz = cz * S.speed, ax = tx - s.vx, az = tz - s.vz, al = Math.hypot(ax, az), m = S.accel * dt;
    if (al > m) { s.vx += ax / al * m; s.vz += az / al * m; } else { s.vx = tx; s.vz = tz; }
    s.x += s.vx * dt; s.z += s.vz * dt;
    pushOut(w.L, s, S.radius * 0.7);
    if (Math.hypot(s.vx, s.vz) > 0.2) s.yaw = Math.atan2(-s.vx, -s.vz);
    if (d < S.reach + T.player.radius && s.cd <= 0 && p.y < 0.5) { s.cd = S.biteCooldown; hurtPlayer(w, S.bite, 'scarab'); emit(w, 'bite', { id: s.id }); }
  }
  // the dead are swept up after their death animation
  if (w.scarabs.length > 40 && w.scarabs.some((s) => s.dead && s.deadT > 2)) w.scarabs = w.scarabs.filter((s) => !s.dead || s.deadT <= 2);
}

// Bodies don't stack: mummies push each other and you; scarabs only each other.
function separate(w) {
  const p = w.player, M = T.mummy;
  const live = w.enemies.filter((e) => e.state !== 'dead');
  for (let a = 0; a < live.length; a++) {
    const e = live[a];
    for (let b = a + 1; b < live.length; b++) {
      const f = live[b], dx = f.x - e.x, dz = f.z - e.z, d = Math.hypot(dx, dz), rr = M.radius * 2;
      if (d < rr && d > 1e-6) { const k = (rr - d) / d * 0.5; e.x -= dx * k; e.z -= dz * k; f.x += dx * k; f.z += dz * k; }
    }
    const dx = p.x - e.x, dz = p.z - e.z, d = Math.hypot(dx, dz), rr = M.radius + T.player.radius;
    if (d < rr && d > 1e-6) { const k = (rr - d) / d; p.x += dx * k * 0.7; p.z += dz * k * 0.7; e.x -= dx * k * 0.3; e.z -= dz * k * 0.3; }
  }
  const S = w.scarabs, r2 = (T.scarab.radius * 1.4) ** 2;
  for (let a = 0; a < S.length; a++) {
    const e = S[a]; if (e.dead) continue;
    for (let b = a + 1; b < S.length; b++) {
      const f = S[b]; if (f.dead) continue;
      const dx = f.x - e.x, dz = f.z - e.z, d2 = dx * dx + dz * dz;
      if (d2 < r2 && d2 > 1e-9) { const d = Math.sqrt(d2), k = (Math.sqrt(r2) - d) / d * 0.5; e.x -= dx * k; e.z -= dz * k; f.x += dx * k; f.z += dz * k; }
    }
  }
}

// ---------------------------------------------------------------------------------- pickups
function collect(w, dt) {
  const p = w.player, K = T.pickup;
  for (const k of w.pickups) {
    if (k.taken || Math.hypot(k.x - p.x, k.z - p.z) > K.radius) continue;
    if (k.kind === 'ammo') { if (p.reserve >= T.pistol.reserveMax) continue; p.reserve = Math.min(T.pistol.reserveMax, p.reserve + K.ammo); }
    else if (k.kind === 'shells') { if (p.shells >= T.shotgun.shellsMax) continue; p.shells = Math.min(T.shotgun.shellsMax, p.shells + K.shells); }
    else if (k.kind === 'grenades') { if (p.grenades >= T.grenade.max) continue; p.grenades = Math.min(T.grenade.max, p.grenades + K.grenades); }
    else if (k.kind === 'shotgun') { p.has.shotgun = true; p.sg.tube = 4; p.shells += 6; switchTo(w, 'shotgun'); }
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
