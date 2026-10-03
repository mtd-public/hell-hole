import * as THREE from 'three';
import { mat, mesh, standard, lambert, glow, textures, flame, fireLight, PAL } from './tomb.js';
import { role } from './dread.js';

// Twin M1911A1s, held akimbo. Built 1:1 in metres (the real pistol is 216 mm long and
// 135 mm tall), barrel along -z, origin at the trigger. The left gun is the right one
// mirrored (three.js flips the winding for a negative scale).

function blued() { return mat('blued', () => standard(0x70747e, { metalness: 0.35, roughness: 0.5 })); }
function dark() { return mat('dark', () => lambert(0x000000)); }

export function m1911() {
  const g = new THREE.Group(), B = blued(), D = dark();
  const T = textures();
  const walnut = mat('walnut', () => lambert(0x6a3a1e, { map: T.checker }));
  // slide
  g.add(mesh(new THREE.BoxGeometry(0.024, 0.031, 0.212), B, 0, 0.034, -0.062));
  for (let k = 0; k < 8; k++) for (const s of [-1, 1]) g.add(mesh(new THREE.BoxGeometry(0.002, 0.024, 0.0018), D, s * 0.0125, 0.034, 0.038 - k * 0.0042));
  g.add(mesh(new THREE.BoxGeometry(0.003, 0.016, 0.036), D, 0.0115, 0.04, -0.03));          // ejection port
  g.add(mesh(new THREE.BoxGeometry(0.004, 0.007, 0.008), B, 0, 0.053, -0.158));             // front sight
  for (const s of [-1, 1]) g.add(mesh(new THREE.BoxGeometry(0.008, 0.007, 0.006), B, s * 0.006, 0.053, 0.036)); // rear sight
  g.add(mesh(new THREE.CylinderGeometry(0.0115, 0.0115, 0.008, 10), B, 0, 0.03, -0.169, { rx: Math.PI / 2 }));    // bushing
  g.add(mesh(new THREE.CylinderGeometry(0.0055, 0.0055, 0.01, 8), D, 0, 0.03, -0.172, { rx: Math.PI / 2 }));      // bore
  // frame, dust cover, trigger guard, trigger
  g.add(mesh(new THREE.BoxGeometry(0.022, 0.017, 0.11), B, 0, 0.011, -0.108));
  g.add(mesh(new THREE.BoxGeometry(0.022, 0.02, 0.07), B, 0, 0.01, -0.012));
  g.add(mesh(new THREE.BoxGeometry(0.009, 0.005, 0.05), B, 0, -0.026, -0.04));
  g.add(mesh(new THREE.BoxGeometry(0.009, 0.03, 0.005), B, 0, -0.012, -0.064, { rx: -0.25 }));
  g.add(mesh(new THREE.BoxGeometry(0.006, 0.018, 0.005), B, 0, -0.007, -0.03, { rx: 0.2 }));
  // grip: an 18 degree rake; walnut panels; beavertail and hammer
  const grip = new THREE.Group(); grip.position.set(0, -0.006, 0.026); grip.rotation.x = -0.31; g.add(grip);
  grip.add(mesh(new THREE.BoxGeometry(0.026, 0.108, 0.046), B, 0, -0.05, 0));
  for (const s of [-1, 1]) grip.add(mesh(new THREE.BoxGeometry(0.004, 0.084, 0.04), walnut, s * 0.014, -0.05, 0));
  grip.add(mesh(new THREE.BoxGeometry(0.026, 0.008, 0.05), B, 0, -0.106, 0.002));
  g.add(mesh(new THREE.BoxGeometry(0.02, 0.008, 0.03), B, 0, 0.018, 0.05, { rx: 0.25 }));
  g.add(mesh(new THREE.BoxGeometry(0.008, 0.02, 0.01), B, 0, 0.052, 0.058, { rx: 0.5 }));
  // slide stop and thumb safety (left side)
  g.add(mesh(new THREE.BoxGeometry(0.003, 0.006, 0.03), B, -0.0125, 0.015, -0.04));
  g.add(mesh(new THREE.BoxGeometry(0.004, 0.005, 0.018), B, -0.013, 0.026, 0.035));
  return g;
}

// A hand round the grip and a forearm running back out of frame. The hero is a 1980s soldier:
// black leather fingerless gloves, M81 woodland sleeves rolled to the elbow, a digital watch.
export function hand(side) {
  const g = new THREE.Group();
  const glove = mat('glove', () => lambert(0x1e1a18)), sleeve = mat('sleeve', () => lambert(0xffffff, { map: textures().woodland }));
  const skin = mat('skin', () => lambert(0xa87a5a));
  const H = new THREE.Group(); H.position.set(0, -0.006, 0.026); H.rotation.x = -0.31; g.add(H);
  H.add(mesh(new THREE.BoxGeometry(0.03, 0.08, 0.034), glove, 0.012, -0.05, 0.03));            // palm on the back strap, right side
  for (let k = 0; k < 3; k++) H.add(mesh(new THREE.BoxGeometry(0.036, 0.019, 0.02), glove, 0.004, -0.034 - k * 0.022, -0.03)); // fingers round the front strap
  for (let k = 0; k < 3; k++) H.add(mesh(new THREE.BoxGeometry(0.014, 0.016, 0.012), skin, -0.017, -0.034 - k * 0.022, -0.04)); // bare fingertips
  g.add(mesh(new THREE.BoxGeometry(0.014, 0.014, 0.05), glove, -0.018, 0.022, -0.006, { ry: 0.1 }));  // thumb over the safety
  g.add(mesh(new THREE.BoxGeometry(0.014, 0.012, 0.036), glove, 0.004, -0.012, -0.026));              // index on the trigger
  // wrist below and behind the grip; the forearm runs back and down out of frame
  const wrist = new THREE.Group(); wrist.position.set(0.01, -0.09, 0.07); g.add(wrist);
  const dir = new THREE.Vector3(0.08, -0.42, 0.9).normalize();
  const along = (len, r1, r2, m, from) => {
    const me = mesh(new THREE.CylinderGeometry(r2, r1, len, 7), m);
    me.position.copy(dir).multiplyScalar(from + len / 2); me.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().negate());
    wrist.add(me);
  };
  along(0.07, 0.034, 0.03, glove, -0.02);  // glove cuff
  along(0.26, 0.042, 0.034, skin, 0.04);   // forearm
  along(0.16, 0.055, 0.05, sleeve, 0.28);  // rolled sleeve
  const watch = mesh(new THREE.TorusGeometry(0.036, 0.009, 4, 8), mat('watch', () => standard(0x1a1a1a, { metalness: 0.2, roughness: 0.6 })), 0, 0, 0);
  watch.position.copy(dir).multiplyScalar(0.07); watch.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir); wrist.add(watch);
  void side;
  return g;
}

// Muzzle flash: a white-hot core, a star of fire petals round the muzzle (it faces you, as
// seen from behind the gun), a forward plume, sparks, and a short-lived light.
function petal(len, w, col) {
  const sh = new THREE.Shape(); sh.moveTo(-w / 2, 0); sh.lineTo(w / 2, 0); sh.lineTo(0, len); sh.closePath();
  const me = new THREE.Mesh(new THREE.ShapeGeometry(sh), glow(col, 'fire', { side: THREE.DoubleSide }));
  me.castShadow = false; return me;
}
export function muzzleFlash(seed = 1) {
  const g = new THREE.Group();
  for (let k = 0; k < 7; k++) {
    const pv = new THREE.Group(); pv.rotation.z = k / 7 * Math.PI * 2 + seed; pv.position.z = -0.01;
    pv.add(petal(0.05 + ((k * 5 + seed) % 3) * 0.025, 0.022, k % 2 ? 0xffb040 : 0xffe080)); g.add(pv);
  }
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.014, 6, 4), glow(0xfff6d8)); core.castShadow = false; g.add(core);
  for (const rz of [0, Math.PI / 2]) {
    const pl = petal(0.13, 0.03, 0xff9a30); pl.rotation.set(-Math.PI / 2, 0, 0); const pv = new THREE.Group(); pv.rotation.z = rz; pv.add(pl); g.add(pv);
  }
  for (let k = 0; k < 6; k++) {
    const sp = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.005, 0.005), glow(0xffc060));
    sp.position.set(Math.sin(k * 7 + seed) * 0.05, Math.cos(k * 5 + seed) * 0.04, -0.05 - k * 0.03); g.add(sp);
  }
  const l = fireLight(PAL.muzzleLight, 8, 10); l.position.z = -0.3; g.add(l);
  return g;
}

export function casing() {
  const c = mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.023, 8), mat('brass', () => standard(PAL.brass, { metalness: 0.9, roughness: 0.3 })), 0, 0, 0, { cast: false });
  return c;
}

// The viewmodel: both guns, hands, a faint carried light so the hero always reads.
// fire: 'none' | 'left' | 'right' | 'both'.
export function viewmodel(camera, { fire = 'none', spread = 0.2, drop = -0.19, depth = -0.46, recoil = 0.0, yaw = 0.2 } = {}) {
  const root = new THREE.Group(); camera.add(root);
  for (const side of [1, -1]) {
    const g = new THREE.Group();
    const firing = fire === 'both' || (fire === 'right' && side > 0) || (fire === 'left' && side < 0);
    g.position.set(side * spread, drop + (firing ? recoil * 0.4 : 0), depth + (firing ? recoil : 0));
    g.rotation.set(firing ? recoil * 3 : 0.02, side * yaw, side * -0.1);
    g.scale.x = side;
    g.add(m1911()); g.add(hand(side));
    if (firing) {
      const f = muzzleFlash(side > 0 ? 1 : 3); f.position.set(0, 0.03, -0.175); g.add(f);
      const c = casing(); c.position.set(0.05, 0.08, -0.02); c.rotation.set(0.6, 0.3, 1.2); g.add(c);
    }
    root.add(g);
  }
  const carry = new THREE.PointLight(0xffa060, 0.12, 1.0, 2); carry.position.set(0, 0.1, -0.22); root.add(carry);
  return root;
}

export { role, flame };
