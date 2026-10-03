import * as THREE from 'three';
import { role } from './dread.js';
import * as TX from './textures.js';

// The tomb kit: corridors, halls, columns, torches, braziers, stairs, props.
// Everything is a three.js primitive with a procedural texture. Light comes only from fire:
// small wall torches in passages, big bronze braziers in rooms (the house "light pool" from
// labyrinth-larry hands real PointLights to the nearest flames in the game; concept shots
// light every flame).

export const PAL = {
  fireLight: 0xffa458, braziLight: 0xff9a48, muzzleLight: 0xffd08a,
  sand: 0xd8c294, stone: 0xc8b48a, stoneDk: 0x8a7656, basalt: 0x3a3632, bronze: 0x8a5a2a, wood: 0x4a2e1a,
  bone: 0xe8dcc0, linen: 0xcfc2a2, hide: 0x2a2420, steel: 0x6a6e74, brass: 0xc8a050,
};

const cache = new Map();
export function mat(key, make) {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key);
}
export const lambert = (color, opts = {}) => new THREE.MeshLambertMaterial({ color, ...opts });
export const standard = (color, opts = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, ...opts });
export const glow = (color, r = 'fire', opts = {}) => role(new THREE.MeshBasicMaterial({ color, fog: false, ...opts }), r);

let TEX = null;
export function textures() {
  if (TEX) return TEX;
  TEX = {
    wall: TX.stoneWall({ seed: 3 }), wallPlain: TX.stoneWall({ seed: 9, glyphs: false }), hallWall: TX.stoneWall({ seed: 21, lit: 0.22 }),
    floor: TX.floorStone({ seed: 7 }), rough: TX.roughStone({ seed: 11 }), column: TX.columnTex({ seed: 13 }),
    wraps: TX.wraps({ seed: 5 }), hide: TX.hide({ seed: 17 }), scales: TX.scales({}), checker: TX.checker({}),
    frieze: TX.frieze({}), sky: TX.nightSky({}), feathers: TX.feathers({}),
  };
  return TEX;
}

export function mesh(geo, m, x = 0, y = 0, z = 0, o = {}) {
  const me = new THREE.Mesh(geo, m);
  me.position.set(x, y, z);
  if (o.rx) me.rotation.x = o.rx; if (o.ry) me.rotation.y = o.ry; if (o.rz) me.rotation.z = o.rz;
  if (o.s) me.scale.setScalar(o.s);
  if (o.sx || o.sy || o.sz) me.scale.set(o.sx ?? 1, o.sy ?? 1, o.sz ?? 1);
  me.castShadow = o.cast ?? true; me.receiveShadow = o.receive ?? true;
  return me;
}

// Scale a geometry's UVs so a texture repeats once per `tile` metres.
export function uvTile(geo, w, h, tile = 2) {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / tile, uv.getY(i) * h / tile);
  uv.needsUpdate = true;
  return geo;
}

// Textures that carry a glow canvas (glyph walls, columns) light their glyphs from within.
export const GLYPH_GLOW_INTENSITY = 1.0;
function texMat(key, t, color = 0xffffff, extra = {}) {
  const glowMap = t.userData.glow;
  return mat(key, () => lambert(color, { map: t, ...(glowMap ? { emissive: 0xffffff, emissiveMap: glowMap, emissiveIntensity: GLYPH_GLOW_INTENSITY } : {}), ...extra }));
}

// A flat textured slab facing +z (rotated by the caller).
export function slab(w, h, m, tile = 2) {
  return uvTile(new THREE.PlaneGeometry(w, h), w, h, tile);
}

// ---- fire -----------------------------------------------------------------------------
// Flames are fog-free so a torch 40 m down the dark reads as a pinprick: the path is lit.
const FLAME_TEX = [];
export function flame(scale = 1, seed = 1) {
  const r = TX.rng(seed), g = new THREE.Group();
  if (!FLAME_TEX.length) for (let k = 0; k < 4; k++) FLAME_TEX.push(TX.flameTex(k * 13 + 1));
  // three crossed cards, so the flame has a body from any side; fog-free and unlit
  for (let k = 0; k < 3; k++) {
    const m = mat('flame' + ((seed + k) % 4), () => role(new THREE.MeshBasicMaterial({ map: FLAME_TEX[(seed + k) % 4], alphaTest: 0.5, side: THREE.DoubleSide, fog: false }), 'fire'));
    const me = new THREE.Mesh(new THREE.PlaneGeometry(0.5 * scale, 1.0 * scale), m);
    me.position.y = 0.45 * scale; me.rotation.y = k * Math.PI / 3 + r() * 0.3; me.castShadow = false; me.receiveShadow = false;
    g.add(me);
  }
  // seen from above the cards are edge-on, so a flat rosette and a white-hot core carry it
  const top = new THREE.Mesh(new THREE.PlaneGeometry(0.42 * scale, 0.42 * scale),
    mat('flameTop', () => role(new THREE.MeshBasicMaterial({ map: TX.flameTopTex(5), alphaTest: 0.5, side: THREE.DoubleSide, fog: false }), 'fire')));
  top.rotation.x = -Math.PI / 2; top.rotation.z = r() * 6; top.position.y = 0.32 * scale; top.castShadow = false; g.add(top);
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.07 * scale, 0), glow(0xfff0b0));
  core.position.y = 0.3 * scale; core.scale.y = 1.6; core.castShadow = false; g.add(core);
  // embers rising
  for (let k = 0; k < 6 * scale; k++) {
    const me = new THREE.Mesh(new THREE.BoxGeometry(0.025 * scale, 0.025 * scale, 0.025 * scale), glow(r() < 0.5 ? 0xffa040 : 0xff5010));
    me.position.set((r() - 0.5) * 0.4 * scale, (0.9 + r() * 1.2) * scale, (r() - 0.5) * 0.4 * scale); me.castShadow = false; g.add(me);
  }
  return g;
}

export function fireLight(color, intensity, distance, shadow = false) {
  const l = new THREE.PointLight(color, intensity, distance, 2);
  if (shadow) { l.castShadow = true; l.shadow.mapSize.set(256, 256); l.shadow.bias = -0.004; l.shadow.radius = 0; l.shadow.camera.near = 0.1; }
  return l;
}

// A wall torch: an iron bracket, a bound-reed torch, a flame. Mounted on a wall whose
// room-facing normal is n (unit vector on x or z).
export function wallTorch(root, x, y, z, nx, nz, o = {}) {
  if (o.place) [x, z, nx, nz] = o.place;
  const g = new THREE.Group(); g.position.set(x, y, z);
  const iron = mat('iron', () => standard(0x2a2622, { roughness: 0.6, metalness: 0.5 }));
  const reed = mat('reed', () => lambert(0x6a4a28));
  g.add(mesh(new THREE.BoxGeometry(0.08, 0.3, 0.08), iron, nx * 0.04, -0.25, nz * 0.04));
  g.add(mesh(new THREE.BoxGeometry(Math.abs(nx) > 0 ? 0.3 : 0.05, 0.05, Math.abs(nz) > 0 ? 0.3 : 0.05), iron, nx * 0.15, -0.25, nz * 0.15));
  const stick = mesh(new THREE.CylinderGeometry(0.05, 0.035, 0.55, 6), reed, nx * 0.3, -0.05, nz * 0.3);
  stick.rotation.z = -nx * 0.35; stick.rotation.x = nz * 0.35; g.add(stick);
  g.add(mesh(new THREE.TorusGeometry(0.07, 0.015, 4, 8), iron, nx * 0.3, -0.12, nz * 0.3, { rx: Math.PI / 2 }));
  const f = flame(o.scale ?? 0.55, o.seed ?? (x * 13 + z * 7) | 0); f.position.set(nx * 0.38, 0.2, nz * 0.38); g.add(f);
  const l = fireLight(PAL.fireLight, o.intensity ?? 1.8, o.distance ?? 6.5, o.shadow);
  l.position.set(nx * 0.55, 0.45, nz * 0.55); g.add(l);
  root.add(g);
  return g;
}

// A great bronze brazier on a tripod, for rooms.
export function brazier(root, x, z, o = {}) {
  const s = o.scale ?? 1, g = new THREE.Group(); g.position.set(x, o.y ?? 0, z);
  const bronze = mat('bronze', () => standard(PAL.bronze, { roughness: 0.45, metalness: 0.7 }));
  for (let k = 0; k < 3; k++) {
    const a = k / 3 * Math.PI * 2;
    const leg = mesh(new THREE.CylinderGeometry(0.04 * s, 0.06 * s, 1.3 * s, 5), bronze, Math.cos(a) * 0.35 * s, 0.6 * s, Math.sin(a) * 0.35 * s);
    leg.rotation.z = Math.cos(a) * 0.28; leg.rotation.x = -Math.sin(a) * 0.28; g.add(leg);
    g.add(mesh(new THREE.BoxGeometry(0.12 * s, 0.06 * s, 0.12 * s), bronze, Math.cos(a) * 0.5 * s, 0.03 * s, Math.sin(a) * 0.5 * s));
  }
  const bowl = mesh(new THREE.CylinderGeometry(0.75 * s, 0.35 * s, 0.45 * s, 10, 1, true), bronze, 0, 1.35 * s, 0);
  bowl.material = mat('bronzeDS', () => standard(PAL.bronze, { roughness: 0.45, metalness: 0.7, side: THREE.DoubleSide })); g.add(bowl);
  g.add(mesh(new THREE.TorusGeometry(0.75 * s, 0.05 * s, 4, 12), bronze, 0, 1.57 * s, 0, { rx: Math.PI / 2 }));
  g.add(mesh(new THREE.CylinderGeometry(0.7 * s, 0.7 * s, 0.05, 10), glow(0x7a1a04), 0, 1.5 * s, 0, { cast: false }));
  for (let k = 0; k < 3; k++) {
    const f = flame(1.6 * s * (k ? 0.7 : 1), (o.seed ?? 1) + k * 31);
    f.position.set(k ? Math.cos(k * 2.4) * 0.3 * s : 0, 1.5 * s, k ? Math.sin(k * 2.4) * 0.3 * s : 0); g.add(f);
  }
  const l = fireLight(PAL.braziLight, o.intensity ?? 30, o.distance ?? 20, o.shadow);
  l.position.set(0, 2.6 * s, 0); g.add(l);
  root.add(g);
  return g;
}

// ---- architecture ---------------------------------------------------------------------
// A straight passage running from z0 toward -z for len metres, centred on x.
export function corridor(root0, { y = 0, x = 0, z0 = 0, len = 30, w = 3, h = 3.6, torchEvery = 7, torchY = 2.1, seed = 1, shadowTorches = 2, torchSkip = [], endWall = false } = {}) {
  const T = textures();
  const root = new THREE.Group(); root.position.y = y; root0.add(root);
  const wallM = texMat('wall', T.wall), floorM = texMat('floor', T.floor), ceilM = texMat('sky', T.sky);
  const zc = z0 - len / 2;
  root.add(mesh(slab(w, len, floorM, 2), floorM, x, 0, zc, { rx: -Math.PI / 2 }));
  root.add(mesh(slab(w, len, ceilM, 2), ceilM, x, h, zc, { rx: Math.PI / 2 }));
  root.add(mesh(slab(len, h, wallM, 2.4), wallM, x - w / 2, h / 2, zc, { ry: Math.PI / 2 }));
  root.add(mesh(slab(len, h, wallM, 2.4), wallM, x + w / 2, h / 2, zc, { ry: -Math.PI / 2 }));
  // ceiling beams of stone every 3 m: they give the long hall its rhythm (the "speed read")
  const beamM = texMat('beam', T.rough, 0x9a8666);
  for (let z = z0 - 1.5; z > z0 - len; z -= 3) root.add(mesh(new THREE.BoxGeometry(w, 0.3, 0.5), beamM, x, h - 0.15, z));
  if (endWall) root.add(mesh(slab(w, h, wallM, 2.4), wallM, x, h / 2, z0 - len));
  // a dado band along the foot of the walls
  const dadoM = mat('dado', () => lambert(0x6a1c10));
  const friezeM = texMat('frieze', T.frieze);
  for (const s of [-1, 1]) {
    root.add(mesh(new THREE.BoxGeometry(0.06, 0.5, len), dadoM, x + s * (w / 2 - 0.03), 0.25, zc));
    root.add(mesh(uvTile(new THREE.PlaneGeometry(len, 0.4), len, 0.4, 1.0), friezeM, x + s * (w / 2 - 0.01), h - 0.55, zc, { ry: -s * Math.PI / 2, cast: false }));
  }
  let k = 0, lit = 0;
  for (let z = z0 - torchEvery / 2; z > z0 - len; z -= torchEvery, k++) {
    if (torchSkip.includes(k)) continue;
    const s = k % 2 ? 1 : -1;
    wallTorch(root, x + s * (w / 2), torchY, z, -s, 0, { seed: seed * 17 + k, shadow: lit++ < shadowTorches });
  }
  return root;
}

// A papyrus-bundle column: base, shaft with the glyph register, bands, a closed-bud capital.
export function column(root, x, z, h = 7, r = 0.6, o = {}) {
  const T = textures(), g = new THREE.Group(); g.position.set(x, 0, z);
  const colM = texMat('column', T.column), stoneM = mat('colStone', () => lambert(0xb89a6a, { map: T.rough }));
  g.add(mesh(new THREE.CylinderGeometry(r * 1.35, r * 1.45, 0.35, 12), stoneM, 0, 0.175, 0));
  const shaft = new THREE.CylinderGeometry(r, r * 1.08, h * 0.78, 12, 1, true);
  uvTile(shaft, 3, h * 0.78 / 2.2, 1);
  g.add(mesh(shaft, colM, 0, 0.35 + h * 0.39, 0));
  for (let k = 0; k < 3; k++) g.add(mesh(new THREE.CylinderGeometry(r * 1.03, r * 1.03, 0.1, 12), stoneM, 0, h * 0.8 - k * 0.16, 0));
  const cap = new THREE.LatheGeometry([0, 0.9, 1.15, 1.2, 1.05, 0.8, 0.5].map((q, i) => new THREE.Vector2(r * q + (i ? 0 : 0.001), i * h * 0.035)), 12);
  g.add(mesh(cap, stoneM, 0, h * 0.81, 0));
  g.add(mesh(new THREE.BoxGeometry(r * 2.4, h * 0.03, r * 2.4), stoneM, 0, h - h * 0.015, 0));
  root.add(g);
  return g;
}

// A rectangular hall with columns in two rows, a dark ceiling of Nut, and braziers.
export function hall(root, { x = 0, z = 0, w = 22, d = 30, h = 8, cols = 4, colH, braziers = [], shadow = 2 } = {}) {
  const T = textures();
  const wallM = texMat('hallWall', T.hallWall), floorM = texMat('floor', T.floor), ceilM = texMat('sky', T.sky);
  const friezeM = texMat('frieze', T.frieze);
  for (const [px, pz, ry, len] of [[x - w / 2 + 0.01, z, Math.PI / 2, d], [x + w / 2 - 0.01, z, -Math.PI / 2, d], [x, z - d / 2 + 0.01, 0, w]]) {
    root.add(mesh(uvTile(new THREE.PlaneGeometry(len, 0.7), len, 0.7, 1.75), friezeM, px, h - 0.9, pz, { ry, cast: false }));
  }
  root.add(mesh(slab(w, d, floorM, 2), floorM, x, 0, z, { rx: -Math.PI / 2 }));
  root.add(mesh(slab(w, d, ceilM, 2), ceilM, x, h, z, { rx: Math.PI / 2 }));
  root.add(mesh(slab(d, h, wallM, 4.8), wallM, x - w / 2, h / 2, z, { ry: Math.PI / 2 }));
  root.add(mesh(slab(d, h, wallM, 4.8), wallM, x + w / 2, h / 2, z, { ry: -Math.PI / 2 }));
  root.add(mesh(slab(w, h, wallM, 4.8), wallM, x, h / 2, z - d / 2));
  for (let k = 0; k < cols; k++) for (const s of [-1, 1]) column(root, x + s * w * 0.24, z + d / 2 - (k + 0.75) * d / (cols + 0.5), colH ?? h, 0.65);
  braziers.forEach(([bx, bz], i) => brazier(root, x + bx, z + bz, { seed: 7 + i * 13, shadow: i < shadow }));
}

// Stairs descending toward -z: n steps of rise/run from (x, y0, z0), walled, with a
// glow far below (the next level calling).
export function stairsDown(root, { x = 0, y0 = 0, z0 = 0, n = 24, rise = 0.28, run = 0.5, w = 3, wallH = 4.2 } = {}) {
  const T = textures();
  const stepM = mat('step', () => lambert(0xffffff, { map: T.floor })), wallM = texMat('wall', T.wall);
  for (let k = 0; k < n; k++) {
    const y = y0 - k * rise, z = z0 - k * run - run / 2;
    root.add(mesh(new THREE.BoxGeometry(w, rise, run), stepM, x, y - rise / 2, z));
  }
  const len = n * run, drop = n * rise, zc = z0 - len / 2;
  for (const s of [-1, 1]) {
    const g = new THREE.PlaneGeometry(len + 2, wallH + drop);
    uvTile(g, len + 2, wallH + drop, 2.4);
    root.add(mesh(g, wallM, x + s * w / 2, y0 + wallH / 2 - drop / 2, zc - 1, { ry: -s * Math.PI / 2 }));
  }
  // sloped ceiling following the stairs
  const ceil = mesh(uvTile(new THREE.PlaneGeometry(w, Math.hypot(len, drop) + 2), w, Math.hypot(len, drop) + 2, 2), texMat('sky', T.sky), x, y0 + wallH - drop / 2, zc - 1);
  ceil.rotation.x = Math.PI / 2 + Math.atan2(drop, len); root.add(ceil);
}

// A square burial shaft, w across and depth deep, centred on (x, z), opening at y = 0. A
// stair of bare steps spirals down the walls with no rail (the void is the hazard); a torch
// burns over every corner landing, so the way down reads as a spiral of fire pools.
export function shaft(root, { x = 0, z = 0, w = 6, depth = 30, stepW = 1.25, run = 0.5, rise = 0.3, seed = 3, shadows = 2 } = {}) {
  const T = textures();
  const wallM = texMat('wall', T.wall), floorM = texMat('floor', T.floor), stepM = mat('step', () => lambert(0xffffff, { map: T.floor }));
  const H = depth + 0.5, half = w / 2;
  // walls (inward-facing)
  for (const [nx, nz, ry] of [[0, -1, 0], [0, 1, Math.PI], [-1, 0, Math.PI / 2], [1, 0, -Math.PI / 2]]) {
    const g = uvTile(new THREE.PlaneGeometry(w, H), w, H, 2.4);
    root.add(mesh(g, wallM, x + nx * half, -H / 2 + 0.25, z + nz * half, { ry }));
  }
  // the floor round the mouth: a 6 m apron, split into four slabs round the hole
  const ap = 6;
  root.add(mesh(slab(w + ap * 2, ap, floorM, 2), floorM, x, 0, z + half + ap / 2, { rx: -Math.PI / 2 }));
  root.add(mesh(slab(w + ap * 2, ap, floorM, 2), floorM, x, 0, z - half - ap / 2, { rx: -Math.PI / 2 }));
  root.add(mesh(slab(ap, w, floorM, 2), floorM, x - half - ap / 2, 0, z, { rx: -Math.PI / 2 }));
  root.add(mesh(slab(ap, w, floorM, 2), floorM, x + half + ap / 2, 0, z, { rx: -Math.PI / 2 }));
  // the bottom
  root.add(mesh(slab(w, w, floorM, 2), floorM, x, -depth, z, { rx: -Math.PI / 2 }));
  // spiral: from the near-left corner, along the left wall, the far wall, the right wall, the
  // near wall, and round again. Corner landings; n steps cantilevered from the wall between.
  const dirs = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  const n = Math.max(1, Math.round((w - 2 * stepW) / run)), r = (w - 2 * stepW) / n, thick = 0.35;
  let cx = x - half + stepW / 2, cz = z + half - stepW / 2, y = -rise, side = 0, lit = 0;
  while (y > -depth + 1) {
    const [dx, dz] = dirs[side % 4], [px, pz] = dirs[(side + 3) % 4];
    root.add(mesh(new THREE.BoxGeometry(stepW, thick, stepW), stepM, cx, y - thick / 2, cz));
    wallTorch(root, cx + px * stepW / 2, y + 1.9, cz + pz * stepW / 2, -px, -pz, { seed: seed * 7 + side, shadow: lit++ < shadows, intensity: 3.4, distance: 7.5 });
    for (let i = 0; i < n; i++) {
      const t = stepW / 2 + r * (i + 0.5), top = y - rise * (i + 1);
      root.add(mesh(new THREE.BoxGeometry(dx ? r : stepW, thick, dz ? r : stepW), stepM, cx + dx * t, top - thick / 2, cz + dz * t));
    }
    cx += dx * (w - stepW); cz += dz * (w - stepW); y -= rise * (n + 1); side++;
  }
  return { bottom: -depth };
}

// A pylon doorway: battered jambs, a lintel with the winged sun.
export function doorway(root, x, z, w = 3, h = 3.6, o = {}) {
  const T = textures(), g = new THREE.Group(); g.position.set(x, 0, z); if (o.ry) g.rotation.y = o.ry;
  const m = mat('pylon', () => lambert(0xffffff, { map: T.wallPlain }));
  for (const s of [-1, 1]) g.add(mesh(new THREE.BoxGeometry(1.2, h + 0.8, 1.2), m, s * (w / 2 + 0.6), (h + 0.8) / 2, 0));
  g.add(mesh(new THREE.BoxGeometry(w + 2.6, 1.0, 1.3), m, 0, h + 0.5, 0));
  g.add(mesh(new THREE.BoxGeometry(w + 2.9, 0.2, 1.45), m, 0, h + 1.1, 0));
  // winged sun: a gold disc with long wings, the only gold on the wall: it marks the way on
  const gold = mat('goldLeaf', () => role(standard(0xffc030, { metalness: 0.9, roughness: 0.35, emissive: 0x3a2400 }), 'gold'));
  g.add(mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.08, 14), gold, 0, h + 0.5, 0.66, { rx: Math.PI / 2 }));
  for (const s of [-1, 1]) for (let k = 0; k < 3; k++) g.add(mesh(new THREE.BoxGeometry(1.1 - k * 0.25, 0.08, 0.04), gold, s * (0.85 - k * 0.12), h + 0.58 - k * 0.11, 0.66));
  // a lit sign carved into a jamb: the scarab (Khepri, the sun that goes under the world)
  // marks the way down
  if (o.sign !== undefined) {
    const sm = mat('sign' + o.sign, () => new THREE.MeshBasicMaterial({ map: TX.signTex(o.sign, o.signColor), alphaTest: 0.5, fog: false }));
    for (const s of [-1, 1]) g.add(mesh(new THREE.PlaneGeometry(0.9, 0.9), sm, s * (w / 2 + 0.6), h * 0.62, 0.61, { cast: false }));
  }
  root.add(g);
  return g;
}

// ---- props ----------------------------------------------------------------------------
export function sarcophagus(root, x, z, ry = 0) {
  const T = textures(), g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry;
  const m = mat('granite', () => lambert(0x5a524a, { map: T.rough }));
  g.add(mesh(new THREE.BoxGeometry(1.1, 0.9, 2.4), m, 0, 0.45, 0));
  const lid = mesh(new THREE.BoxGeometry(1.0, 0.25, 2.3), m, 0.25, 0.98, 0.1, { ry: 0.25 });
  lid.rotation.z = 0.08; g.add(lid);
  g.add(mesh(new THREE.BoxGeometry(0.06, 0.6, 2.2), mat('dark', () => lambert(0x000000)), -0.58, 0.45, 0));
  root.add(g);
  return g;
}

export function urn(root, x, z, s = 1, seed = 1) {
  const r = TX.rng(seed);
  const prof = [0.0, 0.18, 0.28, 0.3, 0.26, 0.16, 0.12, 0.16].map((q, i) => new THREE.Vector2(q * s + 0.001, i * 0.12 * s));
  const me = mesh(new THREE.LatheGeometry(prof, 8), mat('clay', () => lambert(0x8a5a3a, { map: textures().rough })), x, 0, z, { ry: r() * 3 });
  if (r() < 0.3) { me.rotation.z = Math.PI / 2 - 0.2; me.position.y = 0.25 * s; }
  root.add(me);
  return me;
}

// Bones and skulls on the floor: the last people who came this way.
export function bones(root, x, z, seed = 1, n = 6) {
  const r = TX.rng(seed), bm = mat('bone', () => lambert(PAL.bone));
  for (let k = 0; k < n; k++) {
    const b = mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.35 + r() * 0.15, 5), bm, x + (r() - 0.5) * 1.2, 0.03, z + (r() - 0.5) * 1.2, { rz: Math.PI / 2, ry: r() * 6 });
    b.rotation.order = 'YXZ'; root.add(b);
  }
  const sk = new THREE.Group(); sk.position.set(x + (r() - 0.5) * 0.5, 0.1, z + (r() - 0.5) * 0.5); sk.rotation.y = r() * 6;
  sk.add(mesh(new THREE.SphereGeometry(0.11, 8, 6), bm, 0, 0.02, 0, { sy: 0.9 }));
  sk.add(mesh(new THREE.BoxGeometry(0.12, 0.06, 0.1), bm, 0, -0.05, 0.05));
  const hole = mat('dark', () => lambert(0x000000));
  for (const s of [-1, 1]) sk.add(mesh(new THREE.SphereGeometry(0.03, 5, 4), hole, s * 0.04, 0.02, 0.09));
  root.add(sk);
}

export function rubble(root, x, z, seed = 1, n = 8, spread = 1.5) {
  const r = TX.rng(seed), m = mat('rubble', () => lambert(0xa8946e, { map: textures().rough }));
  for (let k = 0; k < n; k++) {
    const s = 0.12 + r() * 0.35;
    root.add(mesh(new THREE.DodecahedronGeometry(s, 0), m, x + (r() - 0.5) * spread, s * 0.5, z + (r() - 0.5) * spread, { ry: r() * 6, rx: r() * 6 }));
  }
}
