import * as THREE from 'three';
import { mat, mesh, lambert, standard, glow, textures, uvTile } from './tomb.js';
import { rng } from './textures.js';

// The bestiary. Built from primitives; origin at the feet, facing +z (toward a camera
// placed down +z). Colour rules (mstr-gme-dsgn-tmpt docs/06): crimson is danger, so every
// eye and weak point glows crimson and nothing else does; gold is reward; fire is the only
// warm light. Every monster must read as a black shape at 40 px (the silhouette test).

const UP = new THREE.Vector3(0, 1, 0);
// A tapered cylinder from point a to point b.
export function limb(a, b, r1, r2, m, seg = 6) {
  const A = new THREE.Vector3(...a), Bv = new THREE.Vector3(...b), d = Bv.clone().sub(A);
  const me = mesh(new THREE.CylinderGeometry(r2, r1, d.length(), seg), m);
  me.position.copy(A).addScaledVector(d, 0.5);
  me.quaternion.setFromUnitVectors(UP, d.normalize());
  return me;
}

const eyeM = () => mat('eye', () => glow(0xff2034, 'blood'));
const darkM = () => mat('dark', () => lambert(0x000000));
const boneM = () => mat('bone', () => lambert(0xe8dcc0));
const goldM = () => mat('gold', () => standard(0xffc030, { metalness: 0.85, roughness: 0.35, emissive: 0x2a1800 }));
const lapisM = () => mat('lapis', () => lambert(0x2e56a8));
const turqM = () => mat('turq', () => lambert(0x2e9a7a));
const redM = () => mat('redOchre', () => lambert(0xb83a1e));

function eyes(g, x, y, z, r = 0.022, gap = 0.05) {
  for (const s of [-1, 1]) g.add(mesh(new THREE.SphereGeometry(r, 6, 4), eyeM(), x + s * gap, y, z, { cast: false }));
}

// A strip of cloth hanging from p, n segments, swaying.
function strip(g, p, len, w, m, seed, n = 4) {
  const r = rng(seed); let [x, y, z] = p; let ax = 0, az = 0;
  for (let k = 0; k < n; k++) {
    const seg = len / n; ax += (r() - 0.5) * 0.5; az += (r() - 0.3) * 0.4;
    const me = mesh(new THREE.PlaneGeometry(w, seg), m, x, y - seg / 2, z, { rx: az * 0.3, rz: ax * 0.3 });
    g.add(me); x += Math.sin(ax) * seg * 0.3; z += Math.sin(az) * seg * 0.3; y -= seg * 0.95;
  }
}

// ---- THE WRAPPED: a mummy that shambles, one arm out. Heart scarab = weak point. --------
export function mummy(seed = 1) {
  const g = new THREE.Group(), T = textures(), r = rng(seed);
  const wrap = mat('wrap', () => lambert(0xd8c8a0, { map: T.wraps }));
  const wrapDS = mat('wrapDS', () => lambert(0xc8b890, { map: T.wraps, side: THREE.DoubleSide }));
  const rot = mat('rot', () => lambert(0x3a2a1a));
  // legs: left forward, right back
  g.add(limb([-0.11, 0.95, 0], [-0.13, 0.5, 0.14], 0.085, 0.07, wrap));
  g.add(limb([-0.13, 0.5, 0.14], [-0.12, 0.06, 0.1], 0.07, 0.05, wrap));
  g.add(limb([0.11, 0.95, 0], [0.12, 0.52, -0.12], 0.085, 0.07, wrap));
  g.add(limb([0.12, 0.52, -0.12], [0.13, 0.08, -0.3], 0.07, 0.05, wrap));
  g.add(mesh(new THREE.BoxGeometry(0.1, 0.07, 0.24), wrap, -0.12, 0.035, 0.18));
  g.add(mesh(new THREE.BoxGeometry(0.1, 0.07, 0.24), wrap, 0.13, 0.05, -0.22, { rx: 0.4 }));
  // pelvis and torso, hunched forward
  g.add(mesh(new THREE.BoxGeometry(0.34, 0.2, 0.22), wrap, 0, 0.98, 0));
  const torso = new THREE.Group(); torso.position.set(0, 1.05, 0); torso.rotation.x = 0.32; g.add(torso);
  const chest = new THREE.CylinderGeometry(0.2, 0.15, 0.62, 8); uvTile(chest, 2, 1.2, 1);
  torso.add(mesh(chest, wrap, 0, 0.31, 0));
  // torn wraps over a dark cavity: the heart scarab shines through
  torso.add(mesh(new THREE.CircleGeometry(0.08, 7), rot, 0.03, 0.42, 0.19, { cast: false }));
  torso.add(mesh(new THREE.SphereGeometry(0.045, 6, 4), eyeM(), 0.03, 0.42, 0.18, { sz: 0.6, cast: false }));
  for (const s of [-1, 1]) torso.add(mesh(new THREE.SphereGeometry(0.09, 6, 5), wrap, s * 0.2, 0.58, 0));
  // head: tipped, jaw hanging, eyes in deep sockets
  const head = new THREE.Group(); head.position.set(0, 0.74, 0.05); head.rotation.set(0.15, 0.2, 0.25); torso.add(head);
  head.add(mesh(new THREE.SphereGeometry(0.125, 8, 7), wrap, 0, 0.1, 0, { sy: 1.12, sz: 1.05 }));
  head.add(mesh(new THREE.BoxGeometry(0.11, 0.07, 0.06), rot, 0, 0.0, 0.1, { rx: 0.4 }));
  for (const s of [-1, 1]) head.add(mesh(new THREE.SphereGeometry(0.035, 6, 4), darkM(), s * 0.05, 0.12, 0.1));
  eyes(head, 0, 0.12, 0.12, 0.016, 0.05);
  // arms: right reaching for you, left hanging
  torso.add(limb([0.22, 0.55, 0], [0.24, 0.42, 0.28], 0.06, 0.05, wrap));
  torso.add(limb([0.24, 0.42, 0.28], [0.18, 0.4, 0.58], 0.05, 0.04, wrap));
  for (let k = 0; k < 4; k++) torso.add(limb([0.18, 0.4, 0.58], [0.14 + k * 0.025, 0.36 + (k % 2) * 0.02, 0.7], 0.012, 0.008, rot, 4));
  torso.add(limb([-0.22, 0.55, 0], [-0.3, 0.22, 0.08], 0.06, 0.05, wrap));
  torso.add(limb([-0.3, 0.22, 0.08], [-0.28, -0.08, 0.18], 0.05, 0.04, wrap));
  // trailing linen
  for (let k = 0; k < 5; k++) strip(g, [(r() - 0.5) * 0.35, 1.0 + r() * 0.4, (r() - 0.6) * 0.2], 0.4 + r() * 0.5, 0.05 + r() * 0.04, wrapDS, seed * 9 + k);
  strip(torso, [0.2, 0.4, 0.5], 0.5, 0.05, wrapDS, seed + 77);
  // a broad collar of faded faience beads: the only colour left on them
  torso.add(mesh(new THREE.TorusGeometry(0.17, 0.035, 4, 12), turqM(), 0, 0.6, 0.02, { rx: Math.PI / 2 - 0.2 }));
  return g;
}

// ---- SCARAB: palm-sized, iridescent, in swarms. -----------------------------------------
export function scarab(seed = 1) {
  const g = new THREE.Group(), r = rng(seed);
  const shell = mat('scarabShell', () => standard(0x1e6e58, { metalness: 0.6, roughness: 0.3, emissive: 0x041a12 }));
  const leg = mat('scarabLeg', () => lambert(0x14100c));
  g.add(mesh(new THREE.SphereGeometry(0.1, 8, 5), shell, 0, 0.05, -0.02, { sx: 1, sy: 0.55, sz: 1.35 }));
  g.add(mesh(new THREE.BoxGeometry(0.004, 0.03, 0.22), leg, 0, 0.1, -0.03));
  g.add(mesh(new THREE.SphereGeometry(0.07, 7, 4), shell, 0, 0.05, 0.1, { sx: 1.2, sy: 0.6, sz: 0.7 }));
  g.add(mesh(new THREE.BoxGeometry(0.08, 0.03, 0.05), leg, 0, 0.04, 0.16));
  for (const s of [-1, 1]) g.add(mesh(new THREE.BoxGeometry(0.012, 0.012, 0.06), leg, s * 0.025, 0.04, 0.2, { ry: -s * 0.4 }));
  for (const s of [-1, 1]) for (let k = 0; k < 3; k++) {
    const z = 0.08 - k * 0.08;
    g.add(limb([s * 0.08, 0.04, z], [s * 0.17, 0.0, z + (k - 1) * 0.05 + (r() - 0.5) * 0.03], 0.008, 0.006, leg, 4));
  }
  eyes(g, 0, 0.055, 0.185, 0.011, 0.03);
  return g;
}

export function swarm(root, cx, cz, n = 40, radius = 1.6, seed = 1) {
  const r = rng(seed), out = [];
  for (let k = 0; k < n; k++) {
    const a = r() * 6.28, d = Math.sqrt(r()) * radius;
    const s = scarab(k % 4);
    s.position.set(cx + Math.cos(a) * d, 0, cz + Math.sin(a) * d * 1.6);
    s.rotation.y = (r() - 0.5) * 1.2; s.scale.setScalar(0.8 + r() * 0.5);
    root.add(s); out.push(s);
  }
  return out;
}

// ---- JACKAL WARDEN: an Anubis-headed guard, 2.5 m, khopesh raised. ------------------------
export function jackalHead(m, s = 1) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.SphereGeometry(0.15 * s, 8, 6), m, 0, 0, 0, { sx: 1, sy: 0.95, sz: 1.1 }));
  const snout = mesh(new THREE.CylinderGeometry(0.035 * s, 0.09 * s, 0.3 * s, 6), m, 0, -0.04 * s, 0.22 * s, { rx: Math.PI / 2 + 0.15 });
  g.add(snout);
  g.add(mesh(new THREE.BoxGeometry(0.05 * s, 0.03 * s, 0.24 * s), darkM(), 0, -0.09 * s, 0.22 * s, { rx: 0.15 }));
  for (const side of [-1, 1]) {
    const ear = mesh(new THREE.ConeGeometry(0.06 * s, 0.32 * s, 4), m, side * 0.08 * s, 0.24 * s, -0.03 * s, { rz: -side * 0.12, rx: -0.15 });
    g.add(ear);
    g.add(mesh(new THREE.BoxGeometry(0.05 * s, 0.012 * s, 0.022 * s), eyeM(), side * 0.065 * s, 0.03 * s, 0.13 * s, { rz: side * 0.35, cast: false }));
  }
  return g;
}

export function jackal(seed = 1, pose = 'raise') {
  const g = new THREE.Group(), T = textures();
  const skin = mat('jackalSkin', () => lambert(0x4a4440, { map: T.hide }));
  const linen = mat('kilt', () => lambert(0xe8dcc0, { map: T.wraps }));
  // legs, wide stance
  for (const s of [-1, 1]) {
    g.add(limb([s * 0.16, 1.2, 0], [s * 0.24, 0.65, s * 0.12], 0.1, 0.08, skin));
    g.add(limb([s * 0.24, 0.65, s * 0.12], [s * 0.26, 0.08, s * 0.06], 0.075, 0.05, skin));
    g.add(mesh(new THREE.BoxGeometry(0.12, 0.08, 0.28), skin, s * 0.26, 0.04, s * 0.06 + 0.08));
  }
  // kilt: a pleated linen shendyt with a gold apron
  g.add(mesh(new THREE.CylinderGeometry(0.22, 0.34, 0.5, 9, 1, true), mat('kiltDS', () => lambert(0xe8dcc0, { map: T.wraps, side: THREE.DoubleSide })), 0, 1.05, 0));
  g.add(mesh(new THREE.BoxGeometry(0.16, 0.42, 0.02), goldM(), 0, 1.02, 0.26, { rx: -0.08 }));
  g.add(mesh(new THREE.CylinderGeometry(0.23, 0.23, 0.07, 9), redM(), 0, 1.3, 0));
  // torso: a broad V
  g.add(mesh(new THREE.CylinderGeometry(0.34, 0.2, 0.75, 6), skin, 0, 1.68, 0, { sz: 0.7 }));
  // usekh collar: bands of lapis, turquoise, red and gold
  [[0.3, lapisM()], [0.26, turqM()], [0.22, redM()], [0.18, goldM()]].forEach(([rad, m], k) =>
    g.add(mesh(new THREE.CylinderGeometry(rad, rad + 0.04, 0.05, 12), m, 0, 2.05 - k * 0.0, 0.0 + k * 0.012, { rx: 0.18 })));
  g.add(limb([0, 2.0, 0], [0, 2.22, 0.06], 0.09, 0.08, skin));
  const head = jackalHead(skin, 1.15); head.position.set(0, 2.36, 0.08); head.rotation.x = 0.1; g.add(head);
  // arms
  for (const s of [-1, 1]) {
    g.add(mesh(new THREE.SphereGeometry(0.11, 6, 5), skin, s * 0.36, 1.98, 0));
    g.add(mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.06, 8), goldM(), s * 0.4, 1.7, 0.05, { rz: s * 0.3 }));
  }
  const raised = pose === 'raise';
  g.add(limb([0.36, 1.98, 0], raised ? [0.5, 2.3, 0.1] : [0.46, 1.62, 0.12], 0.07, 0.06, skin));
  g.add(limb(raised ? [0.5, 2.3, 0.1] : [0.46, 1.62, 0.12], raised ? [0.42, 2.62, 0.3] : [0.42, 1.36, 0.36], 0.06, 0.05, skin));
  g.add(limb([-0.36, 1.98, 0], [-0.48, 1.62, 0.12], 0.07, 0.06, skin));
  g.add(limb([-0.48, 1.62, 0.12], [-0.42, 1.3, 0.3], 0.06, 0.05, skin));
  // khopesh: a sickle sword in bronze
  const shape = new THREE.Shape();
  shape.moveTo(0, 0); shape.lineTo(0.04, 0); shape.lineTo(0.04, 0.32);
  shape.absarc(0.2, 0.42, 0.2, Math.PI * 1.05, Math.PI * 0.05, true);
  shape.lineTo(0.36, 0.5); shape.absarc(0.2, 0.42, 0.13, Math.PI * 0.1, Math.PI * 0.95, false); shape.lineTo(0, 0.32); shape.closePath();
  const blade = mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.012, bevelEnabled: false }), mat('bronzeBlade', () => standard(0xb87a3a, { metalness: 0.85, roughness: 0.3 })), 0, 0, 0);
  const sword = new THREE.Group(); sword.add(blade);
  sword.position.set(raised ? 0.42 : 0.42, raised ? 2.62 : 1.36, raised ? 0.3 : 0.36); sword.rotation.set(raised ? -0.5 : 0.6, Math.PI / 2, raised ? 0.4 : -0.2); sword.scale.setScalar(1.6);
  g.add(sword);
  void seed; void linen;
  return g;
}

// ---- BA: a human skull on painted falcon wings. They come in flocks. -------------------
export function ba(seed = 1, flap = 0.3) {
  const g = new THREE.Group(), T = textures(), r = rng(seed);
  const feather = mat('feathers', () => lambert(0xffffff, { map: T.feathers, side: THREE.DoubleSide }));
  const B = boneM();
  g.add(mesh(new THREE.SphereGeometry(0.17, 9, 7), B, 0, 0.04, 0, { sy: 0.92, sz: 1.08 }));
  g.add(mesh(new THREE.BoxGeometry(0.17, 0.08, 0.1), B, 0, -0.1, 0.1));
  g.add(mesh(new THREE.BoxGeometry(0.14, 0.04, 0.1), B, 0, -0.18 - flap * 0.1, 0.08, { rx: 0.25 + flap * 0.3 }));
  for (let k = 0; k < 5; k++) g.add(mesh(new THREE.BoxGeometry(0.018, 0.03, 0.01), B, -0.05 + k * 0.025, -0.14, 0.155));
  for (const s of [-1, 1]) g.add(mesh(new THREE.SphereGeometry(0.05, 6, 5), darkM(), s * 0.06, 0.0, 0.135));
  g.add(mesh(new THREE.ConeGeometry(0.025, 0.05, 3), darkM(), 0, -0.06, 0.16, { rx: Math.PI }));
  eyes(g, 0, 0.0, 0.16, 0.017, 0.06);
  // wings: long fans of painted feathers
  for (const s of [-1, 1]) {
    const w = new THREE.Group(); w.position.set(s * 0.12, 0.02, -0.05); w.rotation.z = s * (0.55 + flap * 0.6); w.rotation.y = -s * 0.25; g.add(w);
    for (let k = 0; k < 7; k++) {
      const len = 0.35 + k * 0.08, a = -0.25 + k * 0.1;
      const f = mesh(uvTile(new THREE.PlaneGeometry(0.11, len), 1, 1, 1), feather, s * (0.12 + k * 0.1), -0.02 - k * 0.01, -len * 0.4 + 0.1, { rx: -Math.PI / 2, rz: s * a });
      w.add(f);
    }
    w.add(mesh(new THREE.BoxGeometry(0.8, 0.03, 0.1), mat('wingBone', () => lambert(0x8a6a4a)), s * 0.42, 0, 0.08, { rz: 0 }));
  }
  // tail fan
  for (let k = 0; k < 4; k++) g.add(mesh(new THREE.PlaneGeometry(0.06, 0.28), feather, (k - 1.5) * 0.05, -0.05, -0.28, { rx: -Math.PI / 2 + 0.2, rz: (k - 1.5) * 0.18 }));
  void r;
  return g;
}

// ---- CANOPIC SPAWNER: a floating alabaster jar with a son of Horus for a lid. It leaks
// crimson through its cracks and births ba from its mouth. -------------------------------
export function canopic(seed = 1, kind = 'jackal') {
  const g = new THREE.Group(), r = rng(seed);
  const alab = mat('alabaster', () => standard(0xe8dcc8, { roughness: 0.5 }));
  const prof = [0.0, 0.42, 0.62, 0.72, 0.74, 0.7, 0.6, 0.48, 0.42, 0.46].map((q, i) => new THREE.Vector2(q + 0.001, i * 0.2));
  g.add(mesh(new THREE.LatheGeometry(prof, 12), alab, 0, 0, 0));
  // painted bands and a glyph column
  [[0.25, lapisM()], [0.35, goldM()], [1.55, lapisM()], [1.62, redM()]].forEach(([y, m]) =>
    g.add(mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.05, 12, 1, true), m, 0, y + 0.3, 0, { sx: 0.97, sz: 0.97 })));
  for (let k = 0; k < 4; k++) g.add(mesh(new THREE.BoxGeometry(0.08, 0.06, 0.02), [lapisM(), redM(), turqM(), lapisM()][k], 0, 1.3 - k * 0.12, 0.72));
  // cracks: crimson light leaking out
  for (let k = 0; k < 9; k++) {
    const a = r() * 6.28, y = 0.4 + r() * 1.1, rad = 0.72;
    const c = mesh(new THREE.BoxGeometry(0.018, 0.12 + r() * 0.25, 0.02), eyeM(), Math.sin(a) * rad, y, Math.cos(a) * rad, { ry: a, rz: (r() - 0.5) * 1.2, cast: false });
    g.add(c);
  }
  g.add(mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.05, 12), eyeM(), 0, 1.86, 0, { cast: false }));
  // the lid
  const lid = new THREE.Group(); lid.position.set(0, 2.0, 0); lid.rotation.z = 0.12; g.add(lid);
  lid.add(mesh(new THREE.CylinderGeometry(0.4, 0.48, 0.12, 12), alab, 0, -0.06, 0));
  if (kind === 'jackal') { const h = jackalHead(mat('lidPaint', () => lambert(0x3a3632)), 1.7); h.position.y = 0.22; lid.add(h); }
  else { lid.add(mesh(new THREE.SphereGeometry(0.3, 10, 8), alab, 0, 0.25, 0)); eyes(lid, 0, 0.3, 0.27, 0.03, 0.1); }
  // hanging linen tendrils
  const ds = mat('wrapDS', () => lambert(0xc8b890, { map: textures().wraps, side: THREE.DoubleSide }));
  for (let k = 0; k < 7; k++) { const a = k / 7 * 6.28; strip(g, [Math.cos(a) * 0.3, 0.05, Math.sin(a) * 0.3], 0.8 + r() * 0.8, 0.07, ds, seed * 5 + k, 5); }
  return g;
}

// ---- SERQET: a scorpion the size of a horse; the stinger is the weak point. ------------
export function scorpion(seed = 1) {
  const g = new THREE.Group(), T = textures();
  const chitin = mat('chitin', () => standard(0xb06a38, { map: T.scales, roughness: 0.45, metalness: 0.2 }));
  g.add(mesh(new THREE.SphereGeometry(0.4, 9, 6), chitin, 0, 0.45, 0.35, { sy: 0.45, sz: 1.2 }));
  for (let k = 0; k < 5; k++) g.add(mesh(new THREE.SphereGeometry(0.36 - k * 0.03, 8, 5), chitin, 0, 0.45, -0.15 - k * 0.24, { sy: 0.4, sz: 0.6 }));
  // tail: arcs up and over toward you
  let y = 0.5, z = -1.25, a = 0.3;
  for (let k = 0; k < 6; k++) {
    const r0 = 0.16 - k * 0.012; a += 0.42; const ny = y + Math.sin(a) * 0.32, nz = z - Math.cos(a) * 0.32 * 0.3 + (k > 2 ? 0.25 : 0);
    g.add(limb([0, y, z], [0, ny, nz], r0, r0 * 0.85, chitin, 7)); g.add(mesh(new THREE.SphereGeometry(r0, 7, 5), chitin, 0, ny, nz));
    y = ny; z = nz;
  }
  g.add(mesh(new THREE.SphereGeometry(0.12, 7, 6), chitin, 0, y + 0.05, z + 0.12, { sz: 1.3 }));
  g.add(mesh(new THREE.ConeGeometry(0.05, 0.3, 6), eyeM(), 0, y - 0.05, z + 0.32, { rx: Math.PI / 2 + 0.7, cast: false }));
  // claws
  for (const s of [-1, 1]) {
    g.add(limb([s * 0.25, 0.45, 0.6], [s * 0.55, 0.55, 0.85], 0.07, 0.06, chitin));
    g.add(limb([s * 0.55, 0.55, 0.85], [s * 0.45, 0.5, 1.25], 0.06, 0.05, chitin));
    g.add(mesh(new THREE.SphereGeometry(0.14, 7, 5), chitin, s * 0.44, 0.5, 1.38, { sx: 0.8, sy: 0.6, sz: 1.3 }));
    g.add(mesh(new THREE.ConeGeometry(0.05, 0.3, 5), chitin, s * 0.48, 0.5, 1.62, { rx: Math.PI / 2, rz: s * 0.2 }));
    g.add(mesh(new THREE.ConeGeometry(0.04, 0.24, 5), chitin, s * 0.38, 0.48, 1.58, { rx: Math.PI / 2, rz: -s * 0.25 }));
    for (let k = 0; k < 4; k++) {
      const z0 = 0.4 - k * 0.22;
      g.add(limb([s * 0.3, 0.45, z0], [s * 0.7, 0.6, z0 + 0.05], 0.035, 0.03, chitin, 5));
      g.add(limb([s * 0.7, 0.6, z0 + 0.05], [s * 0.85, 0.0, z0 - 0.05 + (k - 1.5) * 0.08], 0.03, 0.015, chitin, 5));
    }
  }
  eyes(g, 0, 0.6, 0.85, 0.025, 0.07);
  eyes(g, 0, 0.62, 0.7, 0.018, 0.12);
  void seed;
  return g;
}

// ---- AMMIT, DEVOURER OF THE DEAD: crocodile head, lion's mane and forequarters, hippo's
// hindquarters. The boss of the Hall of Two Truths. ~5 m long. ------------------------------
export function ammit(seed = 1) {
  const g = new THREE.Group(), T = textures(), r = rng(seed);
  const croc = mat('croc', () => standard(0x7a9a4a, { map: T.scales, roughness: 0.6, metalness: 0.05 }));
  const mane = mat('mane', () => lambert(0xe09040, { map: T.hide }));
  const lion = mat('lion', () => lambert(0xf0b070, { map: T.hide }));
  const hippo = mat('hippo', () => lambert(0xa89aa8, { map: T.hide }));
  const tooth = boneM(), maw = mat('maw', () => glow(0x7a0612, 'blood'));
  // hindquarters (hippo)
  g.add(mesh(new THREE.SphereGeometry(1.1, 12, 9), hippo, 0, 1.3, -1.6, { sx: 1.05, sy: 0.9, sz: 1.2 }));
  for (const s of [-1, 1]) g.add(limb([s * 0.65, 1.0, -1.9], [s * 0.7, 0.0, -1.8], 0.36, 0.32, hippo, 8));
  g.add(limb([0, 1.5, -2.8], [0, 0.9, -3.4], 0.18, 0.06, hippo));
  // forequarters (lion), rearing slightly
  g.add(mesh(new THREE.SphereGeometry(0.95, 12, 9), lion, 0, 1.75, 0.1, { sx: 1, sy: 1.05, sz: 1.2 }));
  for (const s of [-1, 1]) {
    g.add(limb([s * 0.6, 1.5, 0.5], [s * 0.75, 0.75, 1.05], 0.3, 0.24, lion, 8));
    g.add(limb([s * 0.75, 0.75, 1.05], [s * 0.72, 0.12, 1.25], 0.22, 0.2, lion, 8));
    g.add(mesh(new THREE.SphereGeometry(0.26, 8, 6), lion, s * 0.72, 0.12, 1.4, { sy: 0.5, sz: 1.3 }));
    for (let k = 0; k < 4; k++) g.add(mesh(new THREE.ConeGeometry(0.04, 0.18, 4), tooth, s * 0.72 + (k - 1.5) * 0.09, 0.06, 1.72, { rx: Math.PI / 2 }));
  }
  // mane: a ruff of tongues radiating round the neck
  const neck = new THREE.Group(); neck.position.set(0, 2.4, 0.75); neck.rotation.x = 0.35; g.add(neck);
  for (let k = 0; k < 22; k++) {
    const a = k / 22 * Math.PI * 2, len = 0.7 + r() * 0.5;
    const c = mesh(new THREE.ConeGeometry(0.2, len, 4), mane, Math.cos(a) * 0.55, Math.sin(a) * 0.55, -0.1, { rz: a - Math.PI / 2 });
    c.rotation.x = 0.4; neck.add(c);
  }
  neck.add(mesh(new THREE.SphereGeometry(0.62, 10, 8), mane, 0, 0, -0.1));
  // crocodile head, jaws agape, gullet glowing
  const head = new THREE.Group(); head.position.set(0, 0.05, 0.45); head.rotation.x = -0.25; neck.add(head);
  head.add(mesh(new THREE.BoxGeometry(0.75, 0.42, 0.6), croc, 0, 0.12, 0.1));
  const upper = new THREE.Group(); upper.rotation.x = -0.42; head.add(upper);
  upper.add(mesh(new THREE.BoxGeometry(0.56, 0.2, 1.5), croc, 0, 0.18, 0.95, { sx: 1 }));
  upper.add(mesh(new THREE.BoxGeometry(0.4, 0.1, 1.4), maw, 0, 0.07, 0.95, { cast: false }));
  const lower = new THREE.Group(); lower.rotation.x = 0.32; head.add(lower);
  lower.add(mesh(new THREE.BoxGeometry(0.52, 0.16, 1.45), croc, 0, -0.14, 0.92));
  lower.add(mesh(new THREE.BoxGeometry(0.38, 0.06, 1.35), maw, 0, -0.05, 0.92, { cast: false }));
  for (let k = 0; k < 9; k++) for (const s of [-1, 1]) {
    upper.add(mesh(new THREE.ConeGeometry(0.035, 0.14 + (k % 3) * 0.04, 4), tooth, s * 0.24, 0.02, 0.35 + k * 0.14, { rx: Math.PI }));
    lower.add(mesh(new THREE.ConeGeometry(0.035, 0.12 + ((k + 1) % 3) * 0.04, 4), tooth, s * 0.22, 0.0, 0.38 + k * 0.14));
  }
  for (const s of [-1, 1]) {
    head.add(mesh(new THREE.SphereGeometry(0.1, 7, 5), croc, s * 0.26, 0.38, 0.2));
    head.add(mesh(new THREE.SphereGeometry(0.06, 6, 4), eyeM(), s * 0.27, 0.42, 0.26, { cast: false }));
  }
  // a gold and lapis pectoral: Ammit is a goddess, after all
  g.add(mesh(new THREE.CylinderGeometry(0.7, 0.8, 0.08, 12, 1, true), goldM(), 0, 2.25, 0.62, { rx: 0.9, sz: 0.7 }));
  g.add(mesh(new THREE.CylinderGeometry(0.62, 0.7, 0.06, 12, 1, true), lapisM(), 0, 2.18, 0.66, { rx: 0.9, sz: 0.7 }));
  return g;
}
