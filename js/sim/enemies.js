// The creatures. Each kind is a small state machine stepped once per sim step.
//   mummy   idle → chase → windup (arms up) → swipe → chase          (Depth I)
//   scarab  pour from a nest, wander toward you, bite on contact       (Depth I)
//   jackal  idle → chase → crouch (the read) → lunge → windup → slash; heavy damage staggers
//   ba      idle → orbit you → telegraph (screech, hover) → dive at your head → climb → orbit
//   mother  idle → awake: births a ba every few seconds while she can see you; her brood dies with her
// Pure: no three.js, no DOM.
import { TUNING as T } from './tuning.js';
import { pushOut, lineOfSight, ceilAt, isWall } from './level.js';
import { emit, hurtPlayer, wake, steer, faceTo, dist2 } from './common.js';

export function spawn(w, type, x, z, extra = {}) {
  const base = { id: w.idSeq++, type, x, z, y: 0, vx: 0, vz: 0, vy: 0, yaw: w.rand() * 6.28, state: 'idle', t: 0, cd: 0, deadT: 0, dead: false, recent: 0, phase: w.rand() * 6.28 };
  if (type === 'mummy') return { ...base, hp: T.mummy.hp, ...extra };
  if (type === 'jackal') return { ...base, hp: T.jackal.hp, lcd: 0, ...extra };
  if (type === 'mother') return { ...base, hp: T.mother.hp, y: T.mother.y, ...extra };
  if (type === 'ba') return { ...base, hp: T.ba.hp, y: T.ba.alt * 0.8, ang: w.rand() * 6.28, rad: 6, dir: w.rand() < 0.5 ? -1 : 1, cd: 1 + w.rand() * 2, ...extra };
  return { ...base, ...extra };
}

export function scarab(w, x, z) {
  const a = w.rand() * 6.28;
  return { id: w.idSeq++, type: 'scarab', x: x + Math.cos(a) * 0.4, z: z + Math.sin(a) * 0.4, y: 0, vx: 0, vz: 0, yaw: a, hp: T.scarab.hp, cd: 0, wander: a, deadT: 0, dead: false };
}

export function stepEnemies(w, dt) {
  if (w.baGap > 0) w.baGap -= dt;
  for (const e of w.enemies) {
    if (e.dead) { e.deadT += dt; if (e.type === 'ba') { e.vy -= 12 * dt; e.y = Math.max(0.12, e.y + e.vy * dt); } continue; }
    if (e.type === 'mummy') stepMummy(w, e, dt);
    else if (e.type === 'jackal') stepJackal(w, e, dt);
    else if (e.type === 'ba') stepBa(w, e, dt);
    else if (e.type === 'mother') stepMother(w, e, dt);
  }
  stepNests(w, dt);
  stepScarabs(w, dt);
  separate(w);
}

const sees = (w, e, range) => dist2(e, w.player) < range && lineOfSight(w.L, e.x, e.z, w.player.x, w.player.z);

// ---------------------------------------------------------------------------------- mummy
function stepMummy(w, e, dt) {
  const M = T.mummy, p = w.player, d = dist2(p, e);
  if (e.state === 'idle') { if (sees(w, e, M.wakeRange)) wake(w, e); return; }
  if (e.cd > 0) e.cd -= dt;
  if (e.state === 'windup') {
    e.t -= dt; faceTo(e, p.x, p.z, 8, dt);
    if (e.t <= 0) {
      const hit = d < M.reach + 0.35;
      if (hit) hurtPlayer(w, M.damage, 'mummy');
      emit(w, 'swipe', { id: e.id, hit });
      e.state = 'chase'; e.cd = M.cooldown;
    }
    return;
  }
  const [dx, dz] = steer(w, e);
  e.vx = dx * M.speed; e.vz = dz * M.speed;
  e.x += e.vx * dt; e.z += e.vz * dt;
  pushOut(w.L, e, M.radius);
  faceTo(e, e.x + dx, e.z + dz, 4, dt);
  if (d < M.reach && e.cd <= 0) { e.state = 'windup'; e.t = M.windup; emit(w, 'windup', { id: e.id, kind: 'mummy' }); }
}

// ---------------------------------------------------------------------------------- jackal
function stepJackal(w, e, dt) {
  const J = T.jackal, p = w.player, d = dist2(p, e);
  if (e.state === 'idle') { e.recent = 0; if (sees(w, e, J.wakeRange)) wake(w, e); return; }
  if (e.cd > 0) e.cd -= dt;
  if (e.lcd > 0) e.lcd -= dt;
  if (e.recent >= J.staggerDamage && e.state !== 'stagger') { e.state = 'stagger'; e.t = J.stagger; emit(w, 'stagger', { id: e.id }); }
  e.recent = 0;
  switch (e.state) {
    case 'stagger':
      e.t -= dt; if (e.t <= 0) e.state = 'chase';
      return;
    case 'crouch':
      e.t -= dt; faceTo(e, p.x, p.z, 10, dt);
      if (e.t <= 0) {
        const l = d || 1; e.state = 'lunge'; e.t = J.lungeTime;
        e.vx = (p.x - e.x) / l * J.lunge; e.vz = (p.z - e.z) / l * J.lunge;
        emit(w, 'lunge', { id: e.id });
      }
      return;
    case 'lunge':
      e.t -= dt; e.x += e.vx * dt; e.z += e.vz * dt; pushOut(w.L, e, J.radius);
      if (d < J.reach) { e.state = 'windup'; e.t = J.windup * 0.6; emit(w, 'windup', { id: e.id, kind: 'jackal' }); }
      else if (e.t <= 0) e.state = 'chase';
      return;
    case 'windup':
      e.t -= dt; faceTo(e, p.x, p.z, 8, dt);
      if (e.t <= 0) {
        const hit = d < J.reach + 0.4;
        if (hit) hurtPlayer(w, J.damage, 'jackal');
        emit(w, 'slash', { id: e.id, hit });
        e.state = 'chase'; e.cd = J.cooldown;
      }
      return;
    default: {
      const [dx, dz] = steer(w, e, 12);
      e.vx = dx * J.speed; e.vz = dz * J.speed;
      e.x += e.vx * dt; e.z += e.vz * dt;
      pushOut(w.L, e, J.radius);
      faceTo(e, e.x + dx, e.z + dz, 6, dt);
      if (d < J.reach && e.cd <= 0) { e.state = 'windup'; e.t = J.windup; emit(w, 'windup', { id: e.id, kind: 'jackal' }); }
      else if (d > J.lungeMin && d < J.lungeMax && e.lcd <= 0 && e.cd <= 0 && sees(w, e, J.lungeMax)) {
        e.state = 'crouch'; e.t = J.crouch; e.lcd = J.lungeCooldown; emit(w, 'crouch', { id: e.id });
      }
    }
  }
}

// ---------------------------------------------------------------------------------- ba
function stepBa(w, e, dt) {
  const B = T.ba, p = w.player, eye = p.y + T.player.eye;
  const alt = Math.min(B.alt, ceilAt(w.L, e.x, e.z) - 0.55);
  if (e.state === 'idle') { e.y = alt * 0.85 + Math.sin(w.t * 2 + e.phase) * 0.15; if (sees(w, e, B.wakeRange)) wake(w, e); return; }
  if (e.cd > 0) e.cd -= dt;
  const toward = (tx, ty, tz, speed) => {
    const dx = tx - e.x, dy = ty - e.y, dz = tz - e.z, l = Math.hypot(dx, dy, dz);
    const k = l > 1e-6 ? Math.min(speed * dt, l) / l : 0;
    e.x += dx * k; e.y += dy * k; e.z += dz * k;
  };
  faceTo(e, p.x, p.z, 6, dt);
  switch (e.state) {
    case 'orbit': {
      e.ang += (e.dir * B.speed / e.rad) * dt;
      toward(p.x + Math.cos(e.ang) * e.rad, alt + Math.sin(w.t * 2.3 + e.phase) * 0.3, p.z + Math.sin(e.ang) * e.rad, B.speed);
      pushOut(w.L, e, 0.3);
      if (e.cd <= 0 && w.baGap <= 0 && sees(w, e, 16)) { e.state = 'tele'; e.t = B.telegraph; w.baGap = B.globalGap; emit(w, 'screech', { id: e.id }); }
      break;
    }
    case 'tele':
      e.t -= dt;
      if (e.t <= 0) {
        const dx = p.x - e.x, dy = eye - e.y, dz = p.z - e.z, l = Math.hypot(dx, dy, dz) || 1;
        e.vx = dx / l * B.dive; e.vy = dy / l * B.dive; e.vz = dz / l * B.dive;
        e.state = 'dive'; e.t = B.diveTime; emit(w, 'dive', { id: e.id });
      }
      break;
    case 'dive': {
      e.t -= dt;
      const nx = e.x + e.vx * dt, nz = e.z + e.vz * dt;
      e.y += e.vy * dt;
      if (isWall(w.L, nx, nz) || e.y < 0.4) e.t = 0; else { e.x = nx; e.z = nz; }
      if (Math.hypot(e.x - p.x, e.y - eye, e.z - p.z) < B.hitRange) { hurtPlayer(w, B.damage, 'ba'); emit(w, 'peck', { id: e.id }); e.t = 0; }
      if (e.t <= 0) { e.state = 'climb'; e.t = 0.7; }
      break;
    }
    case 'climb':
      e.t -= dt;
      toward(e.x + e.vx * 0.05, alt, e.z + e.vz * 0.05, B.speed * 0.8);
      if (e.t <= 0) {
        e.state = 'orbit'; e.cd = B.diveGap[0] + w.rand() * (B.diveGap[1] - B.diveGap[0]);
        e.ang = Math.atan2(e.z - p.z, e.x - p.x); e.rad = B.orbit[0] + w.rand() * (B.orbit[1] - B.orbit[0]);
      }
      break;
    default: break;
  }
}

// ---------------------------------------------------------------------------------- mother
function stepMother(w, e, dt) {
  const Mo = T.mother, p = w.player;
  faceTo(e, p.x, p.z, 0.8, dt);
  if (e.state === 'idle') { if (sees(w, e, Mo.wakeRange)) wake(w, e); return; }
  e.t -= dt;
  if (e.t > 0) return;
  e.t = Mo.birthEvery;
  const brood = w.enemies.filter((b) => b.type === 'ba' && b.mother === e.id && !b.dead).length;
  if (brood >= Mo.maxBrood || !sees(w, e, Mo.wakeRange * 1.5)) return;
  const b = spawn(w, 'ba', e.x, e.z, { y: e.y + Mo.height + 0.3, state: 'orbit', mother: e.id, cd: 1.2 + w.rand() });
  b.ang = Math.atan2(e.z - p.z, e.x - p.x); b.rad = T.ba.orbit[0] + w.rand() * 2;
  w.enemies.push(b);
  emit(w, 'birth', { id: e.id, x: e.x, y: b.y, z: e.z });
}

// ---------------------------------------------------------------------------------- scarabs
function stepNests(w, dt) {
  const p = w.player;
  for (const n of w.nests) {
    if (!n.open) {
      if (Math.hypot(n.x - p.x, n.z - p.z) < T.nest.trigger && lineOfSight(w.L, n.x, n.z, p.x, p.z)) { n.open = true; emit(w, 'nest', { x: n.x, z: n.z }); }
      continue;
    }
    if (n.left <= 0) continue;
    n.acc += T.nest.rate * dt;
    while (n.acc >= 1 && n.left > 0) { n.acc -= 1; n.left--; w.scarabs.push(scarab(w, n.x, n.z)); }
  }
}

function stepScarabs(w, dt) {
  const S = T.scarab, p = w.player;
  for (const s of w.scarabs) {
    if (s.dead) { s.deadT += dt; continue; }
    if (s.cd > 0) s.cd -= dt;
    const [dx, dz, d] = steer(w, s);
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
  if (w.scarabs.length > 40 && w.scarabs.some((s) => s.dead && s.deadT > 2)) w.scarabs = w.scarabs.filter((s) => !s.dead || s.deadT <= 2);
}

// ---------------------------------------------------------------------------------- bodies
// Walkers push each other and you; a floating mother is a fixed post nobody passes through;
// scarabs only push scarabs; ba fly over all of it.
const RADIUS = { mummy: T.mummy.radius, jackal: T.jackal.radius };
function separate(w) {
  const p = w.player;
  const walkers = w.enemies.filter((e) => !e.dead && RADIUS[e.type]);
  const posts = w.enemies.filter((e) => !e.dead && e.type === 'mother');
  for (let a = 0; a < walkers.length; a++) {
    const e = walkers[a], re = RADIUS[e.type];
    for (let b = a + 1; b < walkers.length; b++) {
      const f = walkers[b], dx = f.x - e.x, dz = f.z - e.z, d = Math.hypot(dx, dz), rr = re + RADIUS[f.type];
      if (d < rr && d > 1e-6) { const k = (rr - d) / d * 0.5; e.x -= dx * k; e.z -= dz * k; f.x += dx * k; f.z += dz * k; }
    }
    const dx = p.x - e.x, dz = p.z - e.z, d = Math.hypot(dx, dz), rr = re + T.player.radius;
    if (d < rr && d > 1e-6) { const k = (rr - d) / d; p.x += dx * k * 0.7; p.z += dz * k * 0.7; e.x -= dx * k * 0.3; e.z -= dz * k * 0.3; }
  }
  for (const m of posts) {
    for (const o of [p, ...walkers]) {
      const r = (o === p ? T.player.radius : RADIUS[o.type]) + T.mother.radius, dx = o.x - m.x, dz = o.z - m.z, d = Math.hypot(dx, dz);
      if (d < r && d > 1e-6) { o.x = m.x + dx / d * r; o.z = m.z + dz / d * r; }
    }
  }
  const S = w.scarabs, r2 = (T.scarab.radius * 1.4) ** 2, r1 = Math.sqrt(r2);
  for (let a = 0; a < S.length; a++) {
    const e = S[a]; if (e.dead) continue;
    for (let b = a + 1; b < S.length; b++) {
      const f = S[b]; if (f.dead) continue;
      const dx = f.x - e.x, dz = f.z - e.z, d2 = dx * dx + dz * dz;
      if (d2 < r2 && d2 > 1e-9) { const d = Math.sqrt(d2), k = (r1 - d) / d * 0.5; e.x -= dx * k; e.z -= dz * k; f.x += dx * k; f.z += dz * k; }
    }
  }
}
