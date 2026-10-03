import * as THREE from 'three';
import { mat, mesh, standard, lambert, glow, textures, fireLight, PAL } from './tomb.js';
import { role } from './dread.js';
import * as TX from './textures.js';
import { m1911, hand, muzzleFlash } from './guns.js';
import { limb } from './monsters.js';

// The arsenal past the twin 1911s, built 1:1 in metres from primitives, barrel along -z:
//   trench gun  — a Model 1897-pattern pump shotgun: exposed hammer, perforated heat shield
//   bazooka     — an M1-pattern rocket tube: shoulder stock, two grips, a ring sight
//   Mk 2        — the pineapple grenade: cast segments, spoon and ring pin
//   Staff of Ra — a relic: a gold and lapis staff crowned by a falcon head and the sun disk,
//                 which throws a beam of sunlight (the only white light in the underworld)
// Explosions, smoke and the beam are camera-facing cards and fog-free glow, like the torches.

const blued = () => mat('blued', () => standard(0x4a4e58, { metalness: 0.5, roughness: 0.5 }));
const dark = () => mat('dark', () => lambert(0x000000));
const walnut = () => mat('stockWood', () => lambert(0x7a4422, { map: textures().rough }));
const olive = () => mat('olive', () => standard(0x4e5a2e, { roughness: 0.7 }));
const gold = () => mat('gold', () => standard(0xffc030, { metalness: 0.85, roughness: 0.35, emissive: 0x2a1800 }));
const lapis = () => mat('lapis', () => lambert(0x2e56a8));
const glove = () => mat('glove', () => lambert(0x3a2a1e));
const skin = () => mat('skin', () => lambert(0xa87a5a));
const sleeve = () => mat('sleeve', () => lambert(0x8a7a56, { map: textures().wraps }));

const UP = new THREE.Vector3(0, 1, 0);
// A gloved fist at p with the forearm running back along dir (unit, local space) out of frame.
function fist(g, p, dir, w = 0.05) {
  const d = new THREE.Vector3(...dir).normalize();
  g.add(mesh(new THREE.BoxGeometry(w, 0.06, 0.07), glove(), ...p));
  const seg = (from, len, r1, r2, m) => {
    const me = mesh(new THREE.CylinderGeometry(r2, r1, len, 7), m);
    me.position.set(...p).addScaledVector(d, from + len / 2); me.quaternion.setFromUnitVectors(UP, d.clone().negate()); g.add(me);
  };
  seg(0.03, 0.07, 0.034, 0.03, glove());
  seg(0.09, 0.26, 0.042, 0.034, skin());
  seg(0.33, 0.16, 0.055, 0.05, sleeve());
}

// ---- trench gun -------------------------------------------------------------------------
export function trenchGun() {
  const g = new THREE.Group(), B = blued(), W = walnut();
  g.add(mesh(new THREE.BoxGeometry(0.044, 0.07, 0.2), B, 0, 0.02, -0.02));                     // receiver
  g.add(mesh(new THREE.BoxGeometry(0.046, 0.012, 0.08), dark(), 0.0, 0.05, -0.03));            // ejection port
  g.add(mesh(new THREE.BoxGeometry(0.012, 0.03, 0.02), B, 0, 0.06, 0.075, { rx: 0.5 }));       // the exposed hammer
  g.add(limb([0, 0.045, -0.12], [0, 0.045, -0.66], 0.012, 0.012, B, 8));                       // barrel
  g.add(mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.012, 8), dark(), 0, 0.045, -0.664, { rx: Math.PI / 2 }));
  g.add(limb([0, 0.012, -0.12], [0, 0.012, -0.57], 0.011, 0.011, B, 8));                       // magazine tube
  const shield = new THREE.CylinderGeometry(0.021, 0.021, 0.34, 10, 1, true);
  g.add(mesh(shield, mat('shield', () => standard(0x6a6e74, { map: TX.perforated(), metalness: 0.6, roughness: 0.5, side: THREE.DoubleSide })), 0, 0.045, -0.43, { rx: Math.PI / 2 }));
  g.add(mesh(new THREE.BoxGeometry(0.02, 0.03, 0.03), B, 0, 0.022, -0.6));                     // bayonet lug
  const pump = mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.14, 9), W, 0, 0.014, -0.27, { rx: Math.PI / 2 }); g.add(pump);
  for (let k = 0; k < 5; k++) g.add(mesh(new THREE.TorusGeometry(0.024, 0.003, 4, 10), dark(), 0, 0.014, -0.22 - k * 0.025));
  g.add(mesh(new THREE.BoxGeometry(0.01, 0.006, 0.06), B, 0, -0.028, 0.02));                   // trigger guard
  g.add(mesh(new THREE.BoxGeometry(0.006, 0.02, 0.006), B, 0, -0.018, 0.01));
  // stock: wrist dropping to the butt
  const st = new THREE.Group(); st.position.set(0, 0.0, 0.08); st.rotation.x = -0.18; g.add(st);
  st.add(mesh(new THREE.BoxGeometry(0.036, 0.045, 0.12), W, 0, 0, 0.06));
  st.add(mesh(new THREE.BoxGeometry(0.042, 0.12, 0.24), W, 0, -0.03, 0.22, { rx: -0.08 }));
  st.add(mesh(new THREE.BoxGeometry(0.044, 0.125, 0.012), B, 0, -0.035, 0.34, { rx: -0.08 }));
  return g;
}

// ---- bazooka ----------------------------------------------------------------------------
export function bazooka() {
  const g = new THREE.Group(), O = olive(), B = blued(), W = walnut();
  g.add(limb([0, 0, 0.5], [0, 0, -0.95], 0.042, 0.042, O, 12));
  g.add(mesh(new THREE.CylinderGeometry(0.06, 0.044, 0.12, 12, 1, true), mat('oliveDS', () => standard(0x4e5a2e, { roughness: 0.7, side: THREE.DoubleSide })), 0, 0, -0.99, { rx: -Math.PI / 2 }));
  g.add(mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.012, 12), dark(), 0, 0, -0.95, { rx: Math.PI / 2 }));
  for (const z of [-0.6, -0.1, 0.35]) g.add(mesh(new THREE.TorusGeometry(0.044, 0.006, 4, 12), B, 0, 0, z));
  g.add(mesh(new THREE.BoxGeometry(0.03, 0.06, 0.32), W, 0, -0.06, 0.3));                      // shoulder stock
  g.add(mesh(new THREE.BoxGeometry(0.026, 0.09, 0.04), W, 0, -0.08, -0.05, { rx: 0.2 }));       // pistol grip
  g.add(mesh(new THREE.BoxGeometry(0.026, 0.08, 0.035), W, 0, -0.075, -0.4, { rx: 0.15 }));     // front grip
  g.add(mesh(new THREE.BoxGeometry(0.006, 0.05, 0.004), B, -0.06, 0.03, -0.55));                // ring sight frame
  g.add(mesh(new THREE.TorusGeometry(0.018, 0.0025, 4, 10), B, -0.06, 0.065, -0.55));
  g.add(mesh(new THREE.BoxGeometry(0.004, 0.03, 0.004), B, -0.06, 0.04, -0.1));
  g.add(mesh(new THREE.BoxGeometry(0.03, 0.04, 0.08), B, 0.05, -0.01, 0.1));                    // battery box
  return g;
}

export function rocket() {
  const g = new THREE.Group(), O = olive();
  g.add(limb([0, 0, 0.12], [0, 0, -0.16], 0.03, 0.03, O, 8));
  g.add(mesh(new THREE.ConeGeometry(0.03, 0.12, 8), O, 0, 0, -0.22, { rx: -Math.PI / 2 }));
  for (let k = 0; k < 4; k++) g.add(mesh(new THREE.BoxGeometry(0.004, 0.07, 0.07), O, Math.cos(k * Math.PI / 2) * 0.03, Math.sin(k * Math.PI / 2) * 0.03, 0.14, { rz: k * Math.PI / 2 }));
  return g;
}

// ---- grenade ----------------------------------------------------------------------------
export function grenade() {
  const g = new THREE.Group();
  const body = mat('pineapple', () => standard(0x5a6634, { map: TX.pineapple(), roughness: 0.8 }));
  g.add(mesh(new THREE.SphereGeometry(0.029, 10, 8), body, 0, 0, 0, { sy: 1.25 }));
  g.add(mesh(new THREE.CylinderGeometry(0.012, 0.014, 0.025, 8), blued(), 0, 0.045, 0));
  g.add(mesh(new THREE.BoxGeometry(0.012, 0.075, 0.005), blued(), 0.0, 0.02, 0.026, { rx: 0.15 }));   // spoon
  g.add(mesh(new THREE.TorusGeometry(0.013, 0.0022, 4, 10), mat('brass', () => standard(PAL.brass, { metalness: 0.9, roughness: 0.3 })), -0.022, 0.05, 0, { ry: Math.PI / 2 })); // ring pin
  return g;
}

// ---- the Staff of Ra --------------------------------------------------------------------
export function staffOfRa() {
  const g = new THREE.Group(), G = gold(), L = lapis();
  // the shaft runs along -z (the business end), 1.5 m, banded in gold and lapis
  g.add(limb([0, 0, 0.75], [0, 0, -0.62], 0.016, 0.016, mat('ebony', () => lambert(0x2a1a10)), 8));
  for (let k = 0; k < 9; k++) g.add(mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.04, 8), k % 2 ? L : G, 0, 0, 0.6 - k * 0.16, { rx: Math.PI / 2 }));
  // the head: a falcon (Ra-Horakhty) carrying the sun disk, ringed by the uraeus cobra
  const head = new THREE.Group(); head.position.set(0, 0.03, -0.66); g.add(head);
  head.add(mesh(new THREE.SphereGeometry(0.045, 8, 6), G, 0, 0, 0, { sz: 1.3 }));
  head.add(mesh(new THREE.ConeGeometry(0.018, 0.05, 5), G, 0, -0.012, -0.065, { rx: -Math.PI / 2 - 0.5 }));
  for (const s of [-1, 1]) head.add(mesh(new THREE.BoxGeometry(0.02, 0.006, 0.01), L, s * 0.03, 0.01, -0.035, { rz: s * 0.3 }));  // painted eye-lines
  const disk = new THREE.Group(); disk.name = 'sun'; disk.position.set(0, 0.11, -0.01); head.add(disk);
  disk.add(mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.016, 18), mat('sundisk', () => glow(0xffb020, 'gold')), 0, 0, 0, { rx: Math.PI / 2, cast: false }));
  disk.add(mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.02, 14), mat('suncore', () => glow(0xfff4c0, 'gold')), 0, 0, -0.002, { rx: Math.PI / 2, cast: false }));
  const curve = new THREE.CatmullRomCurve3([[0.0, -0.085, 0.01], [0.06, -0.06, 0.012], [0.085, 0.0, 0.012], [0.06, 0.06, 0.012], [0.0, 0.088, 0.014], [-0.02, 0.1, -0.01], [-0.012, 0.12, -0.03]].map((v) => new THREE.Vector3(...v)));
  disk.add(mesh(new THREE.TubeGeometry(curve, 24, 0.008, 5), G));
  return g;
}

// ---- effects ----------------------------------------------------------------------------
const TEX = {};
function card(key, make, w, h, r = 'fire', lit = false) {
  const m = mat('card-' + key, () => {
    TEX[key] = TEX[key] || make();
    const M = lit ? lambert(0xffffff, { map: TEX[key], alphaTest: 0.5, side: THREE.DoubleSide })
      : new THREE.MeshBasicMaterial({ map: TEX[key], alphaTest: 0.5, side: THREE.DoubleSide, fog: false });
    return role(M, r);
  });
  const me = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); me.castShadow = false; me.receiveShadow = false;
  return me;
}
const face = (me, cam) => { me.lookAt(cam.getWorldPosition(new THREE.Vector3())); return me; };

// A fireball at p: three ragged cards, smoke behind, embers, a big short light.
export function explosion(root, cam, p, s = 1, seed = 1, o = {}) {
  const g = new THREE.Group(); g.position.set(...p); root.add(g);
  const r = TX.rng(seed);
  for (let k = 0; k < 5; k++) {
    const sm = card('smoke' + (k % 3), () => TX.smokeTex(k * 7 + 3), 1.6 * s, 1.6 * s, 'mono', true);
    sm.position.set((r() - 0.5) * 1.6 * s, (0.3 + r()) * s, (r() - 0.5) * 1.2 * s - 0.4 * s); g.add(sm); face(sm, cam);
  }
  [[1.9, 0, 0, 0], [1.3, 0.45, 0.35, 0.2], [1.1, -0.5, 0.2, 0.25], [0.8, 0.1, 0.7, 0.3]].forEach(([size, x, y, z], k) => {
    const c = card('burst' + k, () => TX.burstTex(k * 11 + 1), size * s, size * s); c.position.set(x * s, y * s, z * s); g.add(c); face(c, cam);
  });
  for (let k = 0; k < 18; k++) {
    const e = new THREE.Mesh(new THREE.BoxGeometry(0.05 * s, 0.05 * s, 0.05 * s), glow(r() < 0.5 ? 0xffc040 : 0xff6010));
    const a = r() * 6.28, b = r() * 3.14; e.position.set(Math.cos(a) * Math.sin(b) * 1.8 * s, Math.abs(Math.cos(b)) * 1.6 * s, Math.sin(a) * Math.sin(b) * 1.8 * s); g.add(e);
  }
  const l = fireLight(0xffa050, o.intensity ?? 60 * s, o.distance ?? 16 * s, o.shadow); l.position.y = 0.5 * s; g.add(l);
  return g;
}

// A rocket in flight from a to b: the round, its exhaust, a smoke trail behind.
export function rocketInFlight(root, cam, at, dir, seed = 1, trail = 5) {
  const g = new THREE.Group(); g.position.set(...at); root.add(g);
  const d = new THREE.Vector3(...dir).normalize();
  g.lookAt(g.position.clone().sub(d));                       // -z of the group along dir... (lookAt points +z away)
  const rk = rocket(); g.add(rk);
  const ex = card('exhaust', () => TX.burstTex(5, 32, ['#c8380a', '#ff8c1a', '#ffd048', '#fff4c0', '#ffffff']), 0.6, 0.6); ex.position.z = 0.22; g.add(ex); face(ex, cam);
  for (let k = 0; k < 3; k++) { const tongue = card('exhaust', null, 0.3, 0.3); tongue.position.z = 0.4 + k * 0.18; tongue.scale.setScalar(1 - k * 0.25); g.add(tongue); face(tongue, cam); }
  const r = TX.rng(seed);
  for (let k = 0; k < trail; k++) {
    const sm = card('smoke' + (k % 3), () => TX.smokeTex(k * 7 + 3), 0.22 + k * 0.08, 0.22 + k * 0.08, 'mono', true);
    sm.position.set((r() - 0.5) * 0.06 * k, (r() - 0.5) * 0.06 * k, 0.55 + k * 0.32); g.add(sm); face(sm, cam);
  }
  const l = fireLight(0xffb060, 16, 12, true); l.position.z = 0.35; g.add(l);
  return g;
}

// A beam of sunlight from a to b: a white-hot core, ragged gold ribbons, rings, lights.
export function sunBeam(root, cam, a, b, seed = 1) {
  const A = new THREE.Vector3(...a), Bv = new THREE.Vector3(...b), d = Bv.clone().sub(A), len = d.length();
  const g = new THREE.Group(); g.position.copy(A).addScaledVector(d, 0.5); g.quaternion.setFromUnitVectors(UP, d.clone().normalize()); root.add(g);
  g.add(mesh(new THREE.CylinderGeometry(0.035, 0.035, len, 6), mat('beamCore', () => glow(0xfff8e0, 'gold')), 0, 0, 0, { cast: false }));
  const ribbon = mat('beamRibbon', () => { const t = TX.beamTex(seed); t.repeat.set(1, 6); return role(new THREE.MeshBasicMaterial({ map: t, alphaTest: 0.5, side: THREE.DoubleSide, fog: false }), 'gold'); });
  for (let k = 0; k < 3; k++) { const me = new THREE.Mesh(new THREE.PlaneGeometry(0.28, len), ribbon); me.rotation.y = k * Math.PI / 3; me.castShadow = false; g.add(me); }
  for (let k = 1; k < len / 1.6; k++) g.add(mesh(new THREE.TorusGeometry(0.12 + (k % 2) * 0.05, 0.012, 4, 14), mat('beamRing', () => glow(0xffd048, 'gold')), 0, -len / 2 + k * 1.6, 0, { rx: Math.PI / 2, cast: false }));
  for (let k = 0; k < 3; k++) { const l = fireLight(0xffe0a0, 7, 9); l.position.y = -len / 2 + (k + 0.5) * len / 3; g.add(l); }
  const hit = card('sunburst', () => TX.burstTex(9, 64, ['#e86a10', '#ffa020', '#ffd048', '#fff4c0', '#ffffff']), 1.4, 1.4, 'gold'); hit.position.copy(Bv); root.add(hit); face(hit, cam);
  const hl = fireLight(0xffe0a0, 30, 12); hl.position.copy(Bv); root.add(hl);
  return g;
}

// ---- viewmodels -------------------------------------------------------------------------
export function viewTrench(cam, { fire = true } = {}) {
  const root = new THREE.Group(); cam.add(root);
  const g = new THREE.Group(); g.position.set(0.17, -0.21, -0.3); g.rotation.set(fire ? 0.1 : 0.05, 0.1, -0.1); root.add(g);
  g.add(trenchGun());
  fist(g, [0.0, -0.035, 0.1], [0.12, -0.45, 0.85]);      // right hand on the wrist
  fist(g, [-0.004, -0.008, -0.27], [-0.35, -0.5, 0.75]); // left hand on the pump
  if (fire) { const f = muzzleFlash(2); f.scale.setScalar(1.8); f.position.set(0, 0.045, -0.68); g.add(f); }
  const carry = new THREE.PointLight(0xffa060, 0.3, 1.4, 2); carry.position.set(0.05, 0.05, -0.3); root.add(carry);
  return root;
}

export function viewBazooka(cam) {
  const root = new THREE.Group(); cam.add(root);
  const g = new THREE.Group(); g.position.set(0.3, -0.15, -0.1); g.rotation.set(0.03, 0.1, -0.04); root.add(g);
  g.add(bazooka());
  const carry = new THREE.PointLight(0xffa060, 0.3, 1.6, 2); carry.position.set(0.05, 0.1, -0.5); g.add(carry);
  fist(g, [0.0, -0.11, -0.05], [0.1, -0.5, 0.85]);
  fist(g, [0.0, -0.1, -0.4], [-0.45, -0.45, 0.75]);
  // back-blast and the light of the launch round the muzzle
  const f = muzzleFlash(4); f.scale.setScalar(2.2); f.position.set(0, 0, -1.02); g.add(f);
  return root;
}

export function viewGrenade(cam) {
  const root = new THREE.Group(); cam.add(root);
  // right: the 1911 held ready
  const pg = new THREE.Group(); pg.position.set(0.2, -0.2, -0.46); pg.rotation.set(0.02, 0.2, -0.1); pg.add(m1911()); pg.add(hand(1)); root.add(pg);
  // left: the grenade raised by the ear, pin already out
  const gl = new THREE.Group(); gl.position.set(-0.2, -0.06, -0.32); gl.rotation.set(0.3, 0.3, 0.2); root.add(gl);
  const gr = grenade(); gr.scale.setScalar(1.15); gl.add(gr);
  for (let k = 0; k < 3; k++) gl.add(mesh(new THREE.BoxGeometry(0.06, 0.018, 0.02), glove(), 0.005, 0.0 - k * 0.022, -0.03));
  fist(gl, [0.02, -0.03, 0.02], [-0.3, -0.75, 0.6], 0.055);
  root.add(new THREE.PointLight(0xffa060, 0.12, 1.0, 2));
  return root;
}

export function viewStaff(cam) {
  const root = new THREE.Group(); cam.add(root);
  const g = new THREE.Group(); g.position.set(0.24, -0.22, -0.3); g.rotation.set(0.12, 0.05, 0.3); root.add(g);
  g.add(staffOfRa());
  fist(g, [0.0, -0.02, 0.18], [0.35, -0.55, 0.75]);
  fist(g, [0.0, -0.02, -0.25], [-0.5, -0.55, 0.65]);
  return root;
}
