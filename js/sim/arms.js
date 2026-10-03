// The player's weapons: twin 1911s, the 870, the bazooka, Mk 2 grenades. Bullets are
// hitscan; grenades and rockets are bodies that fly and explode. Pure: no three.js, no DOM.
import { TUNING as T } from './tuning.js';
import { rayWall, ceilAt, isWall, lineOfSight } from './level.js';
import { emit, hurtPlayer, damage, hearShot, bodyOf, weakOf, centreOf } from './common.js';

export const WEAPONS = ['pistols', 'shotgun', 'bazooka'];
export const owned = (p) => WEAPONS.filter((k) => k === 'pistols' || p.has[k]);

export function switchTo(w, weapon) {
  const p = w.player;
  if (p.weapon === weapon) return;
  p.weapon = weapon; p.switchT = 0.35; p.sg.loading = false;
  emit(w, 'switch', { weapon });
}

export function weapons(w, c, dt) {
  const p = w.player, mine = owned(p);
  if (c.weapon && mine.includes(WEAPONS[c.weapon - 1])) switchTo(w, WEAPONS[c.weapon - 1]);
  if (c.swap && mine.length > 1) switchTo(w, mine[(mine.indexOf(p.weapon) + 1) % mine.length]);
  if (p.switchT > 0) p.switchT -= dt;
  const ready = p.switchT <= 0;
  // reloads tick whatever is in hand
  for (const side of ['L', 'R']) {
    const g = p.guns[side];
    if (g.reload > 0) { g.reload -= dt; if (g.reload <= 0) finishReload(w, side); }
  }
  const b = p.bz;
  if (b.reload > 0) { b.reload -= dt; if (b.reload <= 0 && p.rockets > 0) { b.tube = 1; p.rockets--; emit(w, 'reloaded', { gun: 'B' }); } }
  const any = !!(c.fireL || c.fireR);
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
  } else if (p.weapon === 'shotgun') {
    const s = p.sg, edge = any && !s.held;
    s.held = any;
    if (s.loading) {
      if (any && s.tube > 0) s.loading = false; // a trigger pull interrupts the load
      else {
        s.lt -= dt;
        if (s.lt <= 0) {
          if (s.tube < T.shotgun.tube && p.shells > 0) { s.tube++; p.shells--; emit(w, 'shell'); s.lt = T.shotgun.reloadShell; }
          if (s.tube >= T.shotgun.tube || p.shells <= 0) s.loading = false;
        }
      }
    }
    if (ready && any && !s.loading && w.t - s.last >= T.shotgun.interval) {
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
  } else if (p.weapon === 'bazooka') {
    const edge = any && !b.held;
    b.held = any;
    if (ready && edge && b.reload <= 0) {
      if (b.tube > 0) launch(w); else emit(w, 'empty', { gun: 'B' });
    }
    if (b.tube === 0 && b.reload <= 0 && p.rockets > 0) { b.reload = T.bazooka.reload; emit(w, 'reload', { gun: 'B' }); }
  }
  // grenades: the left hand throws whatever is in the right
  if (c.grenade && p.grenades > 0 && w.t - p.gLast >= T.grenade.cooldown) {
    p.grenades--; p.gLast = w.t;
    const [dx, dy, dz] = aim(w, 0), G = T.grenade, ey = p.y + T.player.eye - 0.15;
    w.grenades.push({ x: p.x + dx * 0.4, y: ey, z: p.z + dz * 0.4, vx: dx * G.speed + p.vx, vy: dy * G.speed + G.up + p.vy * 0.5, vz: dz * G.speed + p.vz, fuse: G.fuse, spin: 0 });
    emit(w, 'throw');
  }
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
export function aim(w, spread) {
  const p = w.player;
  const yaw = p.yaw + (w.rand() - 0.5) * 2 * spread, pitch = p.pitch + (w.rand() - 0.5) * 2 * spread;
  const cp = Math.cos(pitch);
  return [-Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp];
}

// ray (o, d) against a vertical cylinder / a sphere: entry distance or -1
function rayCyl(o, d, e, b) {
  const fx = o[0] - e.x, fz = o[2] - e.z, a = d[0] * d[0] + d[2] * d[2];
  if (a < 1e-9) return -1;
  const bb = 2 * (fx * d[0] + fz * d[2]), cc = fx * fx + fz * fz - b.r * b.r, disc = bb * bb - 4 * a * cc;
  if (disc < 0) return -1;
  const t = (-bb - Math.sqrt(disc)) / (2 * a), y = o[1] + d[1] * t;
  return t > 0 && y >= b.y0 && y <= b.y0 + b.h ? t : -1;
}
function raySphere(o, d, c, r) {
  const fx = o[0] - c[0], fy = o[1] - c[1], fz = o[2] - c[2];
  const b = fx * d[0] + fy * d[1] + fz * d[2], cc = fx * fx + fy * fy + fz * fz - r * r, disc = b * b - cc;
  if (disc < 0) return -1;
  const t = -b - Math.sqrt(disc);
  return t > 0 ? t : -1;
}

// A bullet from the eye along (dx, dy, dz): the nearest of wall, floor, ceiling, a body or a
// weak point (a weak point just behind the body's skin still counts: it's what you aimed at).
export function hitscan(w, dx, dy, dz, range, dmg, quiet = false) {
  const p = w.player, L = w.L, o = [p.x, p.y + T.player.eye, p.z], d = [dx, dy, dz];
  const hl = Math.hypot(dx, dz);
  let tEnv = range, nx = 0, ny = 0, nz = 0;
  if (hl > 1e-6) { const r = rayWall(L, o[0], o[2], dx / hl, dz / hl, range * hl); tEnv = r.t / hl; nx = r.nx; nz = r.nz; }
  if (dy < 0) { const tf = -o[1] / dy; if (tf < tEnv) { tEnv = tf; nx = 0; ny = 1; nz = 0; } }
  if (dy > 0) { const tc = (ceilAt(L, o[0], o[2]) - o[1]) / dy; if (tc < tEnv) { tEnv = tc; nx = 0; ny = -1; nz = 0; } }
  let best = null, bt = tEnv, weak = null;
  const test = (e) => {
    const b = bodyOf(e), t = b.cyl ? rayCyl(o, d, e, b) : raySphere(o, d, b.c, b.r);
    if (t > 0 && t < bt) { bt = t; best = e; weak = null; }
    const wk = weakOf(e);
    if (wk) { const tw = raySphere(o, d, wk.c, wk.r); if (tw > 0 && tw <= bt + 0.25) { bt = Math.min(bt, tw); best = e; weak = wk; } }
  };
  for (const e of w.enemies) if (!e.dead) test(e);
  for (const s of w.scarabs) if (!s.dead) test(s);
  if (!best) {
    if (tEnv < range) emit(w, 'impact', { x: o[0] + dx * tEnv, y: o[1] + dy * tEnv, z: o[2] + dz * tEnv, nx, ny, nz, quiet });
    return;
  }
  const hx = o[0] + dx * bt, hy = o[1] + dy * bt, hz = o[2] + dz * bt;
  let amount = dmg, how = 'body';
  if (weak) { amount = weak.insta ? 999 : dmg * weak.mult; how = weak.how; }
  else if (best.type === 'mother' && hy >= best.y + T.mother.seamY0 && hy <= best.y + T.mother.seamY1) { amount = dmg * T.mother.seamMult; how = 'seam'; }
  w.stats.hits++;
  if (how === 'heart') w.stats.hearts++;
  if (how === 'head') w.stats.heads++;
  damage(w, best, amount, how);
  emit(w, 'hit', { x: hx, y: hy, z: hz, kind: best.type, how, heart: how === 'heart', crit: how !== 'body', id: best.id, quiet });
}

// ---------------------------------------------------------------------------------- blasts
// A blast at (x, y, z): falls off linearly to the edge, needs a line of sight, opens nests,
// wakes the room. Your own blasts hurt you, scaled.
export function explode(w, x, y, z, { radius, damage: dmg, selfScale, kind = 'grenade' }) {
  const L = w.L, p = w.player;
  emit(w, 'explode', { x, y, z, kind });
  const falloff = (cx, cy, cz) => {
    const d = Math.hypot(cx - x, cy - y, cz - z);
    if (d > radius || !lineOfSight(L, x, z, cx, cz)) return 0;
    return Math.max(1, Math.round(dmg * (1 - d / radius)));
  };
  for (const e of w.enemies) if (!e.dead) { const [cx, cy, cz] = centreOf(e); const dd = falloff(cx, cy, cz); if (dd) damage(w, e, dd, 'blast'); }
  for (const s of w.scarabs) if (!s.dead) { const dd = falloff(s.x, 0.1, s.z); if (dd) damage(w, s, dd, 'blast'); }
  for (const n of w.nests) if (!n.open && Math.hypot(n.x - x, n.z - z) < radius) { n.open = true; emit(w, 'nest', { x: n.x, z: n.z }); }
  const pd = falloff(p.x, p.y + 1, p.z);
  if (pd) { p.hurtT = 0; hurtPlayer(w, Math.max(1, Math.round(pd * selfScale)), kind); }
  hearShot(w, 1.5);
}

// ---------------------------------------------------------------------------------- grenades
export function stepGrenades(w, dt) {
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
    for (const s of L.solids) {
      const dx = g.x - s.x, dz = g.z - s.z, d = Math.hypot(dx, dz);
      if (d < s.r + 0.05 && d > 1e-6) {
        g.x = s.x + dx / d * (s.r + 0.05); g.z = s.z + dz / d * (s.r + 0.05);
        const vn = (g.vx * dx + g.vz * dz) / d;
        if (vn < 0) { g.vx -= (1 + G.restitution) * vn * dx / d; g.vz -= (1 + G.restitution) * vn * dz / d; }
      }
    }
    if (g.fuse <= 0) { g.done = true; explode(w, g.x, g.y, g.z, { radius: G.radius, damage: G.damage, selfScale: G.selfScale, kind: 'grenade' }); }
  }
  w.grenades = w.grenades.filter((g) => !g.done);
}

// ---------------------------------------------------------------------------------- rockets
function launch(w) {
  const p = w.player, R = T.bazooka, L = w.L;
  const [dx, dy, dz] = aim(w, 0), rx = Math.cos(p.yaw), rz = -Math.sin(p.yaw), ey = p.y + T.player.eye - 0.08;
  w.rockets.push({ id: w.idSeq++, x: p.x + dx * 0.6 + rx * 0.18, y: ey + dy * 0.6, z: p.z + dz * 0.6 + rz * 0.18, vx: dx * R.speed, vy: dy * R.speed, vz: dz * R.speed, life: R.life });
  p.bz.tube = 0; w.stats.shots++;
  emit(w, 'shot', { gun: 'B' });
  hearShot(w, 1.6);
  // back-blast: a wall right behind you throws the exhaust back
  const hl = Math.hypot(dx, dz) || 1, back = rayWall(L, p.x, p.z, -dx / hl, -dz / hl, R.backblast);
  if (back.t < R.backblast) { p.hurtT = 0; hurtPlayer(w, R.backDamage, 'backblast'); emit(w, 'backblast'); }
}

export function stepRockets(w, dt) {
  const R = T.bazooka, L = w.L;
  for (const r of w.rockets) {
    r.life -= dt;
    const nx = r.x + r.vx * dt, ny = r.y + r.vy * dt, nz = r.z + r.vz * dt;
    let hit = null;
    if (isWall(L, nx, nz) || ny < 0.05 || ny > ceilAt(L, nx, nz) - 0.05 || r.life <= 0) hit = 'world';
    for (const s of L.solids) if (!hit && Math.hypot(nx - s.x, nz - s.z) < s.r + 0.05) hit = 'world';
    for (const e of w.enemies) {
      if (hit || e.dead) continue;
      const b = bodyOf(e);
      const inside = b.cyl ? Math.hypot(nx - e.x, nz - e.z) < b.r + 0.12 && ny >= b.y0 && ny <= b.y0 + b.h : Math.hypot(nx - b.c[0], ny - b.c[1], nz - b.c[2]) < b.r + 0.12;
      if (inside) { hit = e; }
    }
    if (hit) {
      r.done = true;
      if (hit !== 'world') damage(w, hit, R.direct, 'rocket');
      explode(w, r.x, r.y, r.z, { radius: R.radius, damage: R.damage, selfScale: R.selfScale, kind: 'rocket' });
    } else { r.x = nx; r.y = ny; r.z = nz; }
  }
  w.rockets = w.rockets.filter((r) => !r.done);
}
