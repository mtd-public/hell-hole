import * as THREE from 'three';
import { mergeGeometries } from '../vendor/addons/BufferGeometryUtils.js';
import * as K from './tomb.js';
import * as M from './monsters.js';
import * as W from './weapons.js';
import { m1911 } from './guns.js';
import * as TX from './textures.js';
import { TUNING } from '../sim/tuning.js';
import { WALL, ROOM } from '../sim/level.js';

// The level as geometry: one merged mesh per material for the shell (floors, ceilings, walls,
// lintels where a corridor meets a tall room), then torches, braziers, columns, the scarab door,
// ankh shrines, nests, pickups and set dressing from the tomb kit.
//
// Light pool (labyrinth-larry): torches and braziers carry no light of their own. LIGHTS real
// point lights are handed each frame to the flames nearest the player, so the shader's light
// count never changes and nothing recompiles. The two nearest can cast shadows.

const C = TUNING.cell;
export const LIGHTS = 8;
const SRC = {
  torch: { color: K.PAL.fireLight, intensity: 10, distance: 10, weight: 1 },   // physical units: a torch lights about 4 m of wall
  brazier: { color: K.PAL.braziLight, intensity: 110, distance: 24, weight: 5 }, // and a brazier most of a room // a brazier outranks a nearer torch
};

export class LevelView {
  constructor(scene, L, { shadows = true } = {}) {
    this.L = L; this.scene = scene;
    this.root = new THREE.Group(); scene.add(this.root);
    this.sources = [];
    this.buildShell();
    this.buildProps();
    this.pool = [];
    for (let k = 0; k < LIGHTS; k++) {
      const l = new THREE.PointLight(0xffa458, 0, 7, 2);
      if (shadows && k < 2) { l.castShadow = true; l.shadow.mapSize.set(256, 256); l.shadow.bias = -0.002; l.shadow.normalBias = 0.06; l.shadow.camera.near = 0.1; } // off by default: cube maps at 256 acne across whole rooms
      scene.add(l); this.pool.push(l);
    }
  }

  // ------------------------------------------------------------------ shell
  buildShell() {
    const L = this.L, T = K.textures();
    // In play the walls never glow on their own: a lit sign always means something (an ankh
    // over a shrine, the scarab on the way down), so the painted glyphs stay paint.
    const stoneMat = (key, t) => K.mat(key, () => K.lambert(0xffffff, { map: t }));
    const mats = {
      wall: stoneMat('wall-play', T.wall), hallWall: stoneMat('hallWall-play', T.hallWall),
      floor: K.mat('floor', () => K.lambert(0xffffff, { map: T.floor })), sky: K.mat('sky', () => K.lambert(0xffffff, { map: T.sky })),
      frieze: K.mat('frieze', () => K.lambert(0xffffff, { map: T.frieze })), dado: K.mat('dado', () => K.lambert(0x6a1c10)),
    };
    const buf = {};
    const quad = (key, a, b, c, d, n, uv) => {
      const q = buf[key] || (buf[key] = { p: [], n: [], u: [] });
      for (const [v, t] of [[a, uv[0]], [b, uv[1]], [c, uv[2]], [a, uv[0]], [c, uv[2]], [d, uv[3]]]) { q.p.push(...v); q.n.push(...n); q.u.push(...t); }
    };
    // a vertical strip on the edge p0-p1 (floor points) from y0 to y1, facing n
    const wallStrip = (key, p0, p1, y0, y1, n, tile, off = 0) => {
      let [ax, az] = p0, [bx, bz] = p1;
      const tx = bx - ax, tz = bz - az;
      if (-tz * n[0] + tx * n[2] < 0) { [ax, az, bx, bz] = [bx, bz, ax, az]; } // keep the winding facing n
      const ox = n[0] * off, oz = n[2] * off;
      const along = Math.abs(tx) > Math.abs(tz) ? (x, z) => x : (x, z) => z;
      const ua = along(ax, az) / tile, ub = along(bx, bz) / tile;
      quad(key, [ax + ox, y0, az + oz], [bx + ox, y0, bz + oz], [bx + ox, y1, bz + oz], [ax + ox, y1, az + oz], n,
        [[ua, y0 / tile], [ub, y0 / tile], [ub, y1 / tile], [ua, y1 / tile]]);
    };
    const H = (i, j) => (L.cells[j * L.w + i] === ROOM ? TUNING.ceil.room : TUNING.ceil.corridor);
    const solid = (i, j) => i < 0 || j < 0 || i >= L.w || j >= L.h || L.cells[j * L.w + i] === WALL;
    for (let j = 0; j < L.h; j++) for (let i = 0; i < L.w; i++) {
      if (solid(i, j)) continue;
      const x0 = i * C, x1 = x0 + C, z0 = j * C, z1 = z0 + C, h = H(i, j), room = L.cells[j * L.w + i] === ROOM;
      quad('floor', [x0, 0, z1], [x1, 0, z1], [x1, 0, z0], [x0, 0, z0], [0, 1, 0], [[x0 / 2, z1 / 2], [x1 / 2, z1 / 2], [x1 / 2, z0 / 2], [x0 / 2, z0 / 2]]);
      quad('sky', [x0, h, z0], [x1, h, z0], [x1, h, z1], [x0, h, z1], [0, -1, 0], [[x0 / 3, z0 / 3], [x1 / 3, z0 / 3], [x1 / 3, z1 / 3], [x0 / 3, z1 / 3]]);
      const key = room ? 'hallWall' : 'wall', tile = room ? 4.8 : 2.4;
      for (const [di, dj, p0, p1, n] of [
        [-1, 0, [x0, z0], [x0, z1], [1, 0, 0]], [1, 0, [x1, z0], [x1, z1], [-1, 0, 0]],
        [0, -1, [x0, z0], [x1, z0], [0, 0, 1]], [0, 1, [x0, z1], [x1, z1], [0, 0, -1]]]) {
        const ni = i + di, nj = j + dj;
        if (solid(ni, nj)) {
          wallStrip(key, p0, p1, 0, h, n, tile);
          if (room) wallStrip('frieze', p0, p1, h - 1.25, h - 0.55, n, 1.75, 0.012);
          else { wallStrip('frieze', p0, p1, h - 0.75, h - 0.35, n, 1.0, 0.012); wallStrip('dado', p0, p1, 0, 0.5, n, 1, 0.012); }
        } else if (H(ni, nj) < h) wallStrip(key, p0, p1, H(ni, nj), h, n, tile);
      }
    }
    for (const key in buf) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(buf[key].p, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(buf[key].n, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(buf[key].u, 2));
      const me = new THREE.Mesh(g, mats[key]); me.receiveShadow = true; me.castShadow = key !== 'floor' && key !== 'sky';
      this.root.add(me);
    }
  }

  // ------------------------------------------------------------------ props
  buildProps() {
    const L = this.L, R = this.root, r = TX.rng(7);
    L.torches.forEach((t, k) => {
      const g = K.wallTorch(R, t.x, t.room ? 2.6 : 2.1, t.z, t.nx, t.nz, { light: false, seed: k * 5 + 1 });
      this.sources.push({ ...SRC.torch, pos: g.userData.lightAt, phase: r() * 10 });
    });
    L.braziers.forEach((b, k) => {
      const g = K.brazier(R, b.x, b.z, { light: false, seed: k * 13 + 7 });
      this.sources.push({ ...SRC.brazier, pos: g.userData.lightAt, phase: r() * 10 });
    });
    for (const c of L.columns) K.column(R, c.x, c.z, TUNING.ceil.room, 0.65);
    // the way down: a pylon door on the wall, a black opening, the scarab lit on its jambs
    const ex = L.exit, door = K.doorway(R, ex.x - ex.nx * (C / 2 - 0.62), ex.z - ex.nz * (C / 2 - 0.62), 2.2, 2.6, { sign: 7, signColor: '#46e0bc', ry: Math.atan2(ex.nx, ex.nz) });
    const hole = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.6), K.mat('void', () => new THREE.MeshBasicMaterial({ color: 0x000000, fog: false })));
    hole.position.set(0, 1.3, -0.6); door.add(hole);
    // firelight rising up the stair from somewhere below: the way down is the one warm doorway
    this.sources.push({ color: 0xff7a2a, intensity: 14, distance: 9, weight: 3, pos: new THREE.Vector3(ex.x - ex.nx * 1.2, 0.4, ex.z - ex.nz * 1.2), phase: 3 });
    const ember = K.flame(0.5, 9); ember.position.set(0, -0.2, -0.5); ember.scale.set(2.4, 0.5, 1); door.add(ember);
    // ankh shrines: an offering table against the wall, the ankh lit above it while it has life left
    this.shrineSigns = L.shrines.map((s) => {
      const g = new THREE.Group(); g.position.set(s.wx, 0, s.wz); g.rotation.y = Math.atan2(s.nx, s.nz); R.add(g);
      g.add(K.mesh(new THREE.BoxGeometry(1.1, 0.9, 0.55), K.mat('granite', () => K.lambert(0x5a524a, { map: K.textures().rough })), 0, 0.45, 0.3));
      g.add(K.mesh(new THREE.BoxGeometry(1.25, 0.08, 0.65), K.mat('goldLeaf', () => K.role(K.standard(0xffc030, { metalness: 0.9, roughness: 0.35, emissive: 0x3a2400 }), 'gold')), 0, 0.94, 0.3));
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1), K.mat('sign0', () => K.role(new THREE.MeshBasicMaterial({ map: TX.signTex(0, '#46e0bc'), alphaTest: 0.5, fog: false }), 'glyph')));
      sign.position.set(0, 2.0, 0.02); g.add(sign);
      return sign;
    });
    // nests: a cracked pit in the floor
    for (const n of L.nests) {
      R.add(K.mesh(new THREE.CircleGeometry(0.7, 9), K.mat('pit', () => K.lambert(0x050302)), n.x, 0.01, n.z, { rx: -Math.PI / 2, cast: false }));
      K.rubble(R, n.x, n.z, Math.round(n.x * 7 + n.z), 7, 1.8);
    }
    // pickups, each with a gold glint so it reads in the dark
    this.pickups = L.pickups.map((p) => {
      const g = new THREE.Group(); g.position.set(p.x, 0, p.z); R.add(g);
      const body = pickupModel(p.kind); g.add(body);
      const glint = new THREE.Mesh(new THREE.OctahedronGeometry(0.07, 0), K.mat('glint', () => K.glow(0xffd048, 'gold')));
      glint.position.y = 0.75; g.add(glint);
      if (p.kind === 'shotgun') fallenSoldier(R, p.x, p.z);
      return { g, glint, body };
    });
    // set dressing: bones by the torches, urns along room walls, a sarcophagus in the big hall
    L.torches.forEach((t, k) => { if (r() < 0.45) K.bones(R, t.x + t.nx * 0.9 + (r() - 0.5), t.z + t.nz * 0.9 + (r() - 0.5), k + 3, 4); });
    for (let j = 1; j < L.h - 1; j++) for (let i = 1; i < L.w - 1; i++) {
      if (L.cells[j * L.w + i] !== ROOM || r() > 0.12) continue;
      const nearWall = [[1, 0], [-1, 0], [0, 1], [0, -1]].find(([di, dj]) => L.cells[(j + dj) * L.w + i + di] === WALL);
      if (!nearWall || L.def.map[j][i] !== ',') continue;
      K.urn(R, (i + 0.5 + nearWall[0] * 0.35) * C, (j + 0.5 + nearWall[1] * 0.35) * C, 0.8 + r() * 0.5, i * 31 + j);
    }
  }

  // ------------------------------------------------------------------ per frame
  update(world, t, px, pz) {
    // the light pool: the best-scoring flames get the real lights
    const scored = this.sources.map((s) => { const d2 = (s.pos.x - px) ** 2 + (s.pos.z - pz) ** 2; return [s, d2 / s.weight]; })
      .filter(([s, sc]) => sc * s.weight < (s.distance + 12) ** 2).sort((a, b) => a[1] - b[1]);
    this.pool.forEach((l, k) => {
      const e = scored[k];
      if (!e) { l.intensity = 0; return; }
      const s = e[0];
      l.position.copy(s.pos); l.color.setHex(s.color); l.distance = s.distance;
      const f = 0.86 + 0.08 * Math.sin(t * 9.3 + s.phase) + 0.06 * Math.sin(t * 23.1 + s.phase * 2.3);
      l.intensity = s.intensity * f;
    });
    world.pickups.forEach((p, k) => {
      const v = this.pickups[k];
      v.g.visible = !p.taken;
      if (!p.taken) { v.glint.position.y = 0.75 + Math.sin(t * 2.4 + k) * 0.06; v.glint.rotation.y = t * 2; }
    });
    world.shrines.forEach((s, k) => { this.shrineSigns[k].visible = s.charge > 0; }); // a spent ankh goes dark
  }
}

function pickupModel(kind) {
  const g = new THREE.Group();
  if (kind === 'ammo') { // an M2A1 can of .45
    const od = K.mat('ammoCan', () => K.standard(0x4e5a2e, { roughness: 0.7 }));
    g.add(K.mesh(new THREE.BoxGeometry(0.3, 0.19, 0.16), od, 0, 0.095, 0));
    g.add(K.mesh(new THREE.BoxGeometry(0.31, 0.03, 0.17), od, 0, 0.2, 0));
    g.add(K.mesh(new THREE.BoxGeometry(0.12, 0.015, 0.02), K.mat('stencil', () => K.lambert(0xd8c890)), 0, 0.12, 0.082));
  } else if (kind === 'shells') {
    g.add(K.mesh(new THREE.BoxGeometry(0.22, 0.1, 0.14), K.mat('shellBox', () => K.lambert(0xa83020)), 0, 0.05, 0));
    for (let k = 0; k < 4; k++) g.add(K.mesh(new THREE.CylinderGeometry(0.0095, 0.0095, 0.06, 8), K.mat('shell', () => K.standard(0xb03020, { roughness: 0.6 })), 0.17 + k * 0.025, 0.012, 0.05, { rz: Math.PI / 2 }));
  } else if (kind === 'grenades') { // a 1940s crate, stencilled, lid off
    const wood = K.mat('crate', () => K.lambert(0x7a5a34, { map: K.textures().rough }));
    g.add(K.mesh(new THREE.BoxGeometry(0.6, 0.3, 0.4), wood, 0, 0.15, 0));
    g.add(K.mesh(new THREE.BoxGeometry(0.62, 0.03, 0.42), wood, 0.1, 0.33, 0.25, { ry: 0.5, rz: 0.2 }));
    for (let k = 0; k < 3; k++) { const gr = W.grenade(); gr.position.set(-0.15 + k * 0.15, 0.34, 0); gr.rotation.z = 0.3 * (k - 1); g.add(gr); }
  } else if (kind === 'shotgun') {
    const s = W.remington870(); s.rotation.set(0, 0.6, Math.PI / 2); s.position.y = 0.03; g.add(s);
  }
  return g;
}

// The first of your squad you find: bones already, in woodland, a PASGT helmet beside them.
function fallenSoldier(R, x, z) {
  const T = K.textures();
  const bdu = K.mat('bdu', () => K.lambert(0xffffff, { map: T.woodland, side: THREE.DoubleSide }));
  R.add(K.mesh(new THREE.PlaneGeometry(0.7, 1.0), bdu, x + 0.55, 0.02, z + 0.1, { rx: -Math.PI / 2, rz: 0.4, cast: false }));
  K.bones(R, x + 0.6, z + 0.2, 77, 6);
  const helm = K.mesh(new THREE.SphereGeometry(0.15, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), K.mat('helm', () => K.lambert(0xffffff, { map: T.woodland, side: THREE.DoubleSide })), x + 0.2, 0.0, z + 0.7, { rx: 0.4 });
  R.add(helm);
  const p = m1911(); p.position.set(x - 0.4, 0.015, z + 0.5); p.rotation.set(0, 1.2, Math.PI / 2); R.add(p);
}

export { mergeGeometries };
