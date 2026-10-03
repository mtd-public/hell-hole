// Level: parse an ASCII depth into a grid and entity list, plus the grid queries the rules
// need (wall tests, circle push-out, ray casts, a breadth-first path field). Pure: no three.js,
// no DOM, so tools/sim-check.mjs runs it in Node.
import { TUNING } from './tuning.js';

const C = TUNING.cell;
export const WALL = 0, CORRIDOR = 1, ROOM = 2;
const ROOMISH = new Set([',', 'O', 'b', 'T']);
const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]]; // W E N S: torches look for a wall in this order

export function parseLevel(def) {
  const rows = def.map, h = rows.length, w = rows[0].length;
  const cells = new Uint8Array(w * h);
  const L = {
    def, w, h, cells, cell: C,
    start: null, exit: null, torches: [], braziers: [], columns: [], solids: [],
    shrines: [], spawns: [], nests: [], pickups: [],
  };
  const at = (i, j) => (i < 0 || j < 0 || i >= w || j >= h ? '#' : rows[j][i]);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const ch = rows[j][i];
    cells[j * w + i] = ch === '#' ? WALL : ROOMISH.has(ch) ? ROOM : CORRIDOR;
  }
  // a cell next to a room keeps the room's ceiling when it's a room-ish mark (m, s, k... in a room)
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const ch = rows[j][i];
    if (cells[j * w + i] !== CORRIDOR || ch === '.' || ch === 't' || ch === 'D' || ch === 'P') continue;
    let room = 0, corr = 0;
    for (const [di, dj] of DIRS) { const n = at(i + di, j + dj); if (ROOMISH.has(n)) room++; else if (n === '.' || n === 't') corr++; }
    if (room > corr) cells[j * w + i] = ROOM;
  }
  const mount = (i, j) => {
    for (const [di, dj] of DIRS) if (at(i + di, j + dj) === '#') return [di, dj];
    return [0, -1];
  };
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const ch = rows[j][i], x = (i + 0.5) * C, z = (j + 0.5) * C;
    switch (ch) {
      case 'P': L.start = { x, z, yaw: 0 }; break;
      case 'D': {
        const [di, dj] = mount(i, j);
        L.exit = { x, z, i, j, nx: -di, nz: -dj }; break;
      }
      case 't': case 'T': {
        const [di, dj] = mount(i, j);
        L.torches.push({ x: x + di * C / 2, z: z + dj * C / 2, nx: -di, nz: -dj, room: ch === 'T' }); break;
      }
      case 'b': L.braziers.push({ x, z }); L.solids.push({ x, z, r: 0.62 }); break;
      case 'O': L.columns.push({ x, z }); L.solids.push({ x, z, r: 0.78 }); break;
      case 'a': {
        const [di, dj] = mount(i, j);
        L.shrines.push({ x: x + di * (C / 2 - 0.35), z: z + dj * (C / 2 - 0.35), nx: -di, nz: -dj, wx: x + di * C / 2, wz: z + dj * C / 2 }); break;
      }
      case 'm': L.spawns.push({ type: 'mummy', x, z }); break;
      case 'j': L.spawns.push({ type: 'jackal', x, z }); break;
      case 'c': L.spawns.push({ type: 'mother', x, z }); break; // she blocks bodies (separate), not bullets
      case 'v': for (let k = 0; k < 3; k++) L.spawns.push({ type: 'ba', x: x + Math.cos(k * 2.1) * 1.2, z: z + Math.sin(k * 2.1) * 1.2 }); break;
      case 'z': L.pickups.push({ kind: 'bazooka', x, z }); break;
      case 'q': L.pickups.push({ kind: 'rockets', x, z }); break;
      case 's': L.nests.push({ x, z }); break;
      case 'k': L.pickups.push({ kind: 'ammo', x, z }); break;
      case 'r': L.pickups.push({ kind: 'shotgun', x, z }); break;
      case 'e': L.pickups.push({ kind: 'shells', x, z }); break;
      case 'g': L.pickups.push({ kind: 'grenades', x, z }); break;
      default: break;
    }
  }
  if (!L.start) throw new Error(`${def.id}: no start (P)`);
  if (!L.exit) throw new Error(`${def.id}: no exit (D)`);
  return L;
}

export const cellAt = (L, x, z) => {
  const i = Math.floor(x / C), j = Math.floor(z / C);
  return i < 0 || j < 0 || i >= L.w || j >= L.h ? WALL : L.cells[j * L.w + i];
};
export const isWall = (L, x, z) => cellAt(L, x, z) === WALL;
export const ceilAt = (L, x, z) => (cellAt(L, x, z) === ROOM ? TUNING.ceil.room : TUNING.ceil.corridor);

// Push a circle (x, z, r) out of walls and solid round things. Returns true if it touched any.
export function pushOut(L, p, r) {
  let hit = false;
  const i0 = Math.floor((p.x - r) / C), i1 = Math.floor((p.x + r) / C);
  const j0 = Math.floor((p.z - r) / C), j1 = Math.floor((p.z + r) / C);
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    if (!(i < 0 || j < 0 || i >= L.w || j >= L.h) && L.cells[j * L.w + i] !== WALL) continue;
    const bx0 = i * C, bx1 = bx0 + C, bz0 = j * C, bz1 = bz0 + C;
    const cx = Math.max(bx0, Math.min(p.x, bx1)), cz = Math.max(bz0, Math.min(p.z, bz1));
    const dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
    if (d2 >= r * r) continue;
    hit = true;
    if (d2 > 1e-9) { const d = Math.sqrt(d2), k = (r - d) / d; p.x += dx * k; p.z += dz * k; }
    else { // centre inside the block: shove out along the shallowest axis
      const ox = Math.min(p.x - bx0, bx1 - p.x), oz = Math.min(p.z - bz0, bz1 - p.z);
      if (ox < oz) p.x = p.x - bx0 < bx1 - p.x ? bx0 - r : bx1 + r; else p.z = p.z - bz0 < bz1 - p.z ? bz0 - r : bz1 + r;
    }
  }
  for (const s of L.solids) {
    const dx = p.x - s.x, dz = p.z - s.z, rr = r + s.r, d2 = dx * dx + dz * dz;
    if (d2 >= rr * rr || d2 < 1e-9) continue;
    const d = Math.sqrt(d2), k = (rr - d) / d; p.x += dx * k; p.z += dz * k; hit = true;
  }
  return hit;
}

// 2D ray (ox, oz) along unit (dx, dz): distance to the first wall cell or solid, capped at max.
export function rayWall(L, ox, oz, dx, dz, max) {
  let i = Math.floor(ox / C), j = Math.floor(oz / C);
  const si = dx > 0 ? 1 : -1, sj = dz > 0 ? 1 : -1;
  const tdi = dx !== 0 ? Math.abs(C / dx) : Infinity, tdj = dz !== 0 ? Math.abs(C / dz) : Infinity;
  let ti = dx !== 0 ? ((dx > 0 ? (i + 1) * C - ox : ox - i * C) / Math.abs(dx)) : Infinity;
  let tj = dz !== 0 ? ((dz > 0 ? (j + 1) * C - oz : oz - j * C) / Math.abs(dz)) : Infinity;
  let t = 0, nx = 0, nz = 0;
  while (t < max) {
    if (ti < tj) { t = ti; ti += tdi; i += si; nx = -si; nz = 0; } else { t = tj; tj += tdj; j += sj; nx = 0; nz = -sj; }
    if (i < 0 || j < 0 || i >= L.w || j >= L.h || L.cells[j * L.w + i] === WALL) break;
  }
  let best = Math.min(t, max), bnx = nx, bnz = nz;
  for (const s of L.solids) { // round things
    const fx = ox - s.x, fz = oz - s.z, b = fx * dx + fz * dz, c = fx * fx + fz * fz - s.r * s.r;
    const disc = b * b - c;
    if (disc < 0) continue;
    const tt = -b - Math.sqrt(disc);
    if (tt > 0 && tt < best) { best = tt; bnx = (ox + dx * tt - s.x) / s.r; bnz = (oz + dz * tt - s.z) / s.r; }
  }
  return { t: best, nx: bnx, nz: bnz };
}

export function lineOfSight(L, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, d = Math.hypot(dx, dz);
  if (d < 1e-6) return true;
  return rayWall(L, ax, az, dx / d, dz / d, d).t >= d - 0.05;
}

// Breadth-first distance (in cells) from the target cell to every floor cell. Diagonal steps
// only where both orthogonal neighbours are open, so nothing cuts a wall corner.
export function pathField(L, x, z, out) {
  const n = L.w * L.h, dist = out && out.length === n ? out : new Int16Array(n);
  dist.fill(-1);
  const ti = Math.floor(x / C), tj = Math.floor(z / C);
  if (ti < 0 || tj < 0 || ti >= L.w || tj >= L.h) return dist;
  const q = new Int32Array(n); let h = 0, t = 0;
  dist[tj * L.w + ti] = 0; q[t++] = tj * L.w + ti;
  while (h < t) {
    const k = q[h++], i = k % L.w, j = (k / L.w) | 0, d = dist[k] + 1;
    for (const [di, dj] of DIRS) {
      const ni = i + di, nj = j + dj, nk = nj * L.w + ni;
      if (ni < 0 || nj < 0 || ni >= L.w || nj >= L.h || L.cells[nk] === WALL || dist[nk] >= 0) continue;
      dist[nk] = d; q[t++] = nk;
    }
  }
  return dist;
}

// Where to walk from (x, z) to go down the field: the centre of the best neighbouring cell.
export function downhill(L, dist, x, z) {
  const i = Math.floor(x / C), j = Math.floor(z / C), here = dist[j * L.w + i];
  if (here <= 0) return null;
  let best = here, bi = i, bj = j;
  for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
    if (!di && !dj) continue;
    const ni = i + di, nj = j + dj;
    if (ni < 0 || nj < 0 || ni >= L.w || nj >= L.h) continue;
    const d = dist[nj * L.w + ni];
    if (d < 0 || d >= best) continue;
    if (di && dj && (L.cells[j * L.w + ni] === WALL || L.cells[nj * L.w + i] === WALL)) continue;
    best = d; bi = ni; bj = nj;
  }
  return bi === i && bj === j ? null : { x: (bi + 0.5) * C, z: (bj + 0.5) * C };
}
