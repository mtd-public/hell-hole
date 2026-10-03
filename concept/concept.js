import * as THREE from 'three';
import { DreadPass, STYLES, dreadify } from '../js/render/dread.js';
import * as K from '../js/render/tomb.js';
import * as M from '../js/render/monsters.js';
import * as TX from '../js/render/textures.js';
import { viewmodel, m1911, hand } from '../js/render/guns.js';
import * as W from '../js/render/weapons.js';

// Concept shots, rendered by the real Dread pipeline (no paintovers).
//   concept/?shot=hallway&style=pigment&h=270&scale=4
// tools/render-concepts.mjs drives this page headlessly and saves every shot as a PNG.

const Q = new URLSearchParams(location.search);
const SHOT = Q.get('shot');
const STYLE = STYLES[Q.get('style')] || STYLES.pigment;
const LINES = +(Q.get('h') || 270);

const SHOTS = {
  hallway: { title: 'The Descending Corridor', aspect: 16 / 9, build: hallway },
  hall: { title: 'Hypostyle of Night', aspect: 16 / 9, build: hypostyle },
  descent: { title: 'The Way Down', aspect: 16 / 9, build: descent },
  boss: { title: 'Hall of Two Truths: Ammit', aspect: 16 / 9, build: boss },
  guns: { title: 'Twin 1911s', aspect: 16 / 9, build: guns },
  gunlab: { title: 'gun lab', aspect: 16 / 9, build: gunlab },
  shotgun: { title: 'Trench Gun', aspect: 16 / 9, build: shotgunShot },
  rocket: { title: 'Bazooka', aspect: 16 / 9, build: rocketShot },
  grenade: { title: 'Mk 2 Grenades', aspect: 16 / 9, build: grenadeShot },
  staff: { title: 'Staff of Ra', aspect: 16 / 9, build: staffShot },
  arsenal: { title: 'The Arsenal', aspect: 16 / 9, build: arsenal },
  mummy: { title: 'The Wrapped', aspect: 4 / 5, build: (s, c) => portrait(s, c, M.mummy(2), { h: 1.0, d: 3.2, y: 1.0 }) },
  jackal: { title: 'Jackal Warden', aspect: 4 / 5, build: (s, c) => portrait(s, c, M.jackal(1), { h: 1.4, d: 4.6, y: 1.5 }) },
  ba: { title: 'Ba', aspect: 4 / 5, build: (s, c) => portrait(s, c, lift(M.ba(1, 0.1), 1.6, 1.5), { h: 1.0, d: 3.3, y: 1.4, tilt: 0.25, yaw: 0.2 }) },
  scarab: { title: 'Scarab Swarm', aspect: 4 / 5, build: (s, c) => { M.swarm(s, 0, 0, 34, 0.9, 4); return portrait(s, c, M.scarab(1), { h: 0.9, d: 2.4, y: 0.1, x: 0, z: 0.9, tilt: 0.35 }); } },
  canopic: { title: 'Canopic Mother', aspect: 4 / 5, build: (s, c) => { const j = M.canopic(3); j.position.y = 0.9; const b = M.ba(4, 0.5); b.position.set(0.9, 3.0, 0.6); b.rotation.set(0.3, -0.6, 0.3); s.add(b); return portrait(s, c, j, { h: 1.9, d: 5.4, y: 2.0 }); } },
  scorpion: { title: 'Serqet', aspect: 4 / 5, build: (s, c) => portrait(s, c, M.scorpion(1), { h: 1.0, d: 3.8, y: 0.7, x: 0.1, yaw: -0.55, tilt: 0.3 }) },
  ammit: { title: 'Ammit, Devourer', aspect: 4 / 5, build: (s, c) => portrait(s, c, M.ammit(1), { h: 2.4, d: 9.5, y: 1.9, x: 0.2, z: -0.6, yaw: -0.6, light: 1.8 }) },
};

const lift = (o, y, s = 1) => { o.position.y = y; o.scale.setScalar(s); return o; };

// ---- shots ------------------------------------------------------------------------------
function hallway(scene, cam) {
  scene.fog = new THREE.FogExp2(0x000000, 0.055);
  K.corridor(scene, { z0: 2, len: 44, w: 3.2, h: 3.9, torchEvery: 7, seed: 2, shadowTorches: 3 });
  K.doorway(scene, 0, -41.2, 3.2, 3.6);
  K.brazier(scene, 0, -44, { scale: 0.8, shadow: false, intensity: 30 });
  const m1 = M.mummy(1); m1.position.set(-0.35, 0, -4.4); m1.rotation.y = 0.12; scene.add(m1);
  const m2 = M.mummy(3); m2.position.set(0.45, 0, -9.7); m2.rotation.y = -0.3; scene.add(m2);
  const m3 = M.mummy(5); m3.position.set(-0.5, 0, -16.9); m3.rotation.y = 0.2; scene.add(m3);
  M.swarm(scene, 0.4, -2.6, 26, 0.7, 9);
  K.bones(scene, 1.0, -2.0, 3); K.bones(scene, -0.9, -10, 5, 4);
  K.rubble(scene, -1.2, -5.5, 2, 7, 0.7); K.urn(scene, 1.25, -4.4, 1.1, 2); K.urn(scene, 1.3, -9.3, 0.9, 5);
  cam.position.set(0.0, 1.62, 0.6); cam.lookAt(0.15, 1.35, -10);
  viewmodel(cam, { fire: 'right', recoil: 0.025 });
}

function hypostyle(scene, cam) {
  scene.fog = new THREE.FogExp2(0x000000, 0.035);
  K.hall(scene, { z: -8, w: 24, d: 36, h: 10, cols: 5, colH: 10, braziers: [[-3.6, 6.5], [4.2, 4], [-4.4, -3], [4, -6.5], [0, -13]], shadow: 3 });
  K.corridor(scene, { z0: 14, len: 4, w: 3.2, h: 3.9, torchEvery: 99 });
  const j1 = M.jackal(1, 'raise'); j1.position.set(-1.9, 0, -2.6); j1.rotation.y = 0.35; scene.add(j1);
  const j2 = M.jackal(2, 'low'); j2.position.set(2.5, 0, -5.6); j2.rotation.y = -0.45; scene.add(j2);
  const j3 = M.jackal(3, 'low'); j3.position.set(-2.4, 0, -12.5); j3.rotation.y = 0.2; scene.add(j3);
  const jar = M.canopic(2); jar.position.set(1.2, 2.2, -16); jar.rotation.y = -0.3; scene.add(jar);
  for (let k = 0; k < 9; k++) {
    const b = M.ba(k, (k % 3) * 0.25); const a = k * 0.8;
    b.position.set(Math.cos(a) * (1.4 + k * 0.35) + 1.0, 3.0 + Math.sin(k * 1.7) * 1.0, -15 + k * 1.2);
    b.rotation.set(0.15, Math.sin(k) * 0.6 + (k % 2 ? 0.4 : -0.4), 0.3 * Math.sin(k * 2)); scene.add(b);
  }
  M.swarm(scene, 0.6, 0.2, 18, 0.9, 12);
  K.sarcophagus(scene, -7.2, -4, 0.1); K.bones(scene, 3.2, 1.8, 7); K.rubble(scene, -3.5, 2.2, 4, 9, 1.4);
  cam.position.set(0, 1.62, 4.2); cam.lookAt(0.3, 2.5, -10);
  viewmodel(cam, { fire: 'both', recoil: 0.02 });
}

function descent(scene, cam) {
  scene.fog = new THREE.FogExp2(0x000000, 0.02);
  const depth = 28;
  K.shaft(scene, { x: 0, z: 0, w: 6.4, depth, seed: 4, shadows: 3 });
  // the bottom: a brazier, a gilded door with the scarab lit on its jambs, the next depth
  K.brazier(scene, 0.6, -0.4, { y: -depth, scale: 1.2, intensity: 40, shadow: false });
  const dd = K.doorway(scene, 0, -3.2, 2.6, 3.2, { sign: 7, signColor: '#46e0bc' }); dd.position.y = -depth;
  K.bones(scene, -1.4, 1.2, 4, 6); dd.children.forEach(() => 0);
  const bl = new THREE.Group(); bl.position.y = -depth; scene.add(bl); K.bones(bl, 1.6, 1.6, 8, 5);
  // the ba nest in the shaft
  [[-1.2, -9, 0.6], [1.4, -14, -0.8], [0.2, -5, -1.6]].forEach(([bx, by, bz], k) => { const b = M.ba(k + 3, 0.2 + k * 0.2); b.position.set(bx, by, bz); b.rotation.set(-0.9, k * 1.7, 0.2); scene.add(b); });
  // the rim: a doorway behind you, a torch, the last of the light
  K.bones(scene, 2.4, 4.6, 2, 5); K.rubble(scene, -3.8, 4.2, 3, 6, 1.0);
  K.wallTorch(scene, 3.2 + 2.2, 2.0, 5.0, -1, 0, { seed: 91, intensity: 2 });
  cam.position.set(-0.5, 1.62, 3.05); cam.lookAt(0.4, -20, -5.5);
  viewmodel(cam, { fire: 'none', drop: -0.27, depth: -0.44, spread: 0.24 });
}

function boss(scene, cam) {
  scene.fog = new THREE.FogExp2(0x000000, 0.03);
  K.hall(scene, { z: -6, w: 28, d: 34, h: 13, cols: 3, colH: 13, braziers: [[-3.8, 3.4], [4.6, 2.6], [-7, -8], [7, -8]], shadow: 3 });
  const a = M.ammit(1); a.position.set(0.3, 0, -6.2); a.rotation.y = -0.18; a.scale.setScalar(1.25); scene.add(a);
  scales(scene, -6.2, -13);
  for (const s of [-1, 1]) colossus(scene, s * 11.5, -16, -s * 0.25);
  M.swarm(scene, 2.8, -1.2, 14, 1.1, 21);
  K.bones(scene, -2.2, 1.8, 9); K.bones(scene, 2.0, 0.4, 10, 4);
  cam.position.set(-0.6, 1.62, 4.6); cam.lookAt(0.3, 2.7, -6);
  viewmodel(cam, { fire: 'left', recoil: 0.025 });
}

function guns(scene, cam) {
  scene.fog = new THREE.FogExp2(0x000000, 0.06);
  K.corridor(scene, { z0: 3, len: 30, w: 3.2, h: 3.9, torchEvery: 7, seed: 8, shadowTorches: 2 });
  K.wallTorch(scene, 1.6, 2.0, 0.4, -1, 0, { seed: 77, intensity: 4 });
  const m = M.mummy(7); m.position.set(-0.3, 0, -4.2); m.rotation.y = 0.25; scene.add(m);
  cam.position.set(0, 1.62, 1.2); cam.lookAt(0, 1.45, -6); cam.fov = 58; cam.updateProjectionMatrix();
  viewmodel(cam, { fire: 'left', recoil: 0.03, spread: 0.17, drop: -0.15, depth: -0.4, yaw: 0.3 });
}

// ---- the arsenal ----------------------------------------------------------------------
function shotgunShot(scene, cam) {
  scene.fog = new THREE.FogExp2(0x000000, 0.055);
  cam.position.set(0, 1.62, 1.0); cam.lookAt(-0.2, 1.95, -6);
  K.corridor(scene, { z0: 3, len: 30, w: 3.4, h: 4.0, torchEvery: 7, seed: 12, shadowTorches: 2 });
  const j = M.jackal(4, 'raise'); j.position.set(-0.35, 0, -2.6); j.rotation.y = -0.1; scene.add(j);
  const r = TX.rng(5);
  for (let k = 0; k < 9; k++) { // pellet hits: sparks on the chest
    const sp = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.04), K.glow(0xffd070)); sp.position.set(-0.35 + (r() - 0.5) * 0.5, 1.75 + (r() - 0.5) * 0.45, -2.25); scene.add(sp);
  }
  const m = M.mummy(9); m.position.set(-0.6, 0, -9.5); m.rotation.y = 0.2; scene.add(m);
  W.viewTrench(cam, { fire: true });
}

function rocketShot(scene, cam) {
  scene.fog = new THREE.FogExp2(0x000000, 0.035);
  cam.position.set(0, 1.62, 6.5); cam.lookAt(0.2, 2.0, -10);
  K.hall(scene, { z: -8, w: 24, d: 36, h: 10, cols: 5, colH: 10, braziers: [[-4.6, 9.5], [-4.6, -9], [4.4, -12]], shadow: 2 });
  W.rocketInFlight(scene, cam, [0.1, 1.85, 0.8], [-0.03, -0.01, -1], 3, 6);
  const j1 = M.jackal(5, 'raise'); j1.position.set(-0.8, 0, -9); j1.rotation.y = 0.15; scene.add(j1);
  const j2 = M.jackal(6, 'low'); j2.position.set(1.6, 0, -10.5); j2.rotation.y = -0.25; scene.add(j2);
  const sc = M.scorpion(2); sc.position.set(-3.2, 0, -5.5); sc.rotation.y = 0.7; scene.add(sc);
  W.viewBazooka(cam);
}

function grenadeShot(scene, cam) {
  scene.fog = new THREE.FogExp2(0x000000, 0.05);
  cam.position.set(0, 1.62, 1.2); cam.lookAt(0, 1.2, -8);
  K.corridor(scene, { z0: 3, len: 30, w: 3.4, h: 4.0, torchEvery: 7, seed: 14, shadowTorches: 2 });
  M.swarm(scene, -0.2, -5.5, 30, 1.1, 31);
  W.explosion(scene, cam, [0.2, 0.6, -7.8], 1.1, 4);
  const r = TX.rng(9);
  for (let k = 0; k < 9; k++) { const sc = M.scarab(k); sc.position.set((r() - 0.5) * 2.4, 0.8 + r() * 1.8, -7.2 + (r() - 0.5) * 2); sc.rotation.set(r() * 6, r() * 6, r() * 6); scene.add(sc); }
  const m = M.mummy(11); m.position.set(0.7, 0, -11.5); m.rotation.y = -0.3; scene.add(m);
  W.viewGrenade(cam);
}

function staffShot(scene, cam) {
  scene.fog = new THREE.FogExp2(0x000000, 0.035);
  cam.position.set(0, 1.62, 5.5); cam.lookAt(-0.6, 2.4, -10);
  K.hall(scene, { z: -8, w: 24, d: 36, h: 10, cols: 5, colH: 10, braziers: [[-4.6, 4], [4.4, -9]], shadow: 2 });
  const jar = M.canopic(5); jar.position.set(-2.4, 2.0, -7.0); jar.rotation.y = 0.3; scene.add(jar);
  for (let k = 0; k < 8; k++) {
    const b = M.ba(k + 20, (k % 3) * 0.25); const a = k * 0.9;
    b.position.set(Math.cos(a) * (1.5 + k * 0.3) - 2.0, 3.1 + Math.sin(k * 1.7) * 0.9, -7.5 + k * 0.7);
    b.rotation.set(0.15, Math.sin(k) * 0.6, 0.3 * Math.sin(k * 2)); scene.add(b);
  }
  const j = M.jackal(7, 'low'); j.position.set(1.6, 0, -4.5); j.rotation.y = -0.4; scene.add(j);
  const vm = W.viewStaff(cam);
  cam.updateMatrixWorld(true);
  const from = vm.getObjectByName('sun').getWorldPosition(new THREE.Vector3());
  W.sunBeam(scene, cam, from.toArray(), [-2.3, 3.0, -6.4], 2);
}

function arsenal(scene, cam) {
  scene.fog = new THREE.FogExp2(0x000000, 0.04);
  cam.position.set(0, 2.05, 1.35); cam.lookAt(0, 0.95, 0.0); cam.fov = 44; cam.updateProjectionMatrix();
  const T = K.textures();
  const st = K.mat('granite', () => K.lambert(0x5a524a, { map: T.rough }));
  scene.add(K.mesh(K.uvTile(new THREE.PlaneGeometry(14, 14), 14, 14, 2), K.mat('floor', () => K.lambert(0xffffff, { map: T.floor })), 0, 0, 0, { rx: -Math.PI / 2 }));
  scene.add(K.mesh(K.uvTile(new THREE.PlaneGeometry(10, 5), 10, 5, 2.4), K.mat('wall', () => K.lambert(0xffffff, { map: T.wall })), 0, 2.5, -1.6));
  scene.add(K.mesh(new THREE.BoxGeometry(2.5, 0.85, 1.3), st, 0, 0.425, 0));     // the altar
  scene.add(K.mesh(new THREE.BoxGeometry(2.7, 0.08, 1.45), st, 0, 0.89, 0));
  scene.add(K.mesh(K.uvTile(new THREE.PlaneGeometry(2.2, 1.25), 2.2, 1.25, 0.6), K.mat('shroud', () => K.lambert(0xe8dcc0, { map: T.wraps })), 0, 0.932, 0, { rx: -Math.PI / 2 }));
  const lay = (o, x, z, ry, s = 1, y = 0.93) => { o.position.set(x, y, z); o.rotation.set(-Math.PI / 2 * 0, ry, 0); o.scale.setScalar(s); scene.add(o); return o; };
  const side = (o) => { o.rotation.z = Math.PI / 2; return o; };
  // weapons lie on their sides, barrels to the right
  const tg = side(lay(W.trenchGun(), -0.1, -0.45, -Math.PI / 2)); tg.position.y = 0.96;
  const bz = side(lay(W.bazooka(), 0.05, -0.12, -Math.PI / 2 + 0.04)); bz.position.y = 0.98;
  const st1 = lay(W.staffOfRa(), 0.0, 0.18, -Math.PI / 2 - 0.05); st1.position.y = 0.955;
  const p1 = side(lay(m1911(), -0.7, 0.45, -Math.PI / 2 + 0.3)); p1.position.y = 0.947;
  const p2 = side(lay(m1911(), -0.38, 0.5, -Math.PI / 2 - 0.2)); p2.position.y = 0.947;
  [[0.2, 0.47], [0.33, 0.42], [0.27, 0.56]].forEach(([x, z], k) => { const g = lay(W.grenade(), x, z, k * 1.3); g.position.y = 0.965; if (k === 2) g.rotation.z = 1.4; });
  for (let k = 0; k < 6; k++) { const c = K.mesh(new THREE.CylinderGeometry(0.0095, 0.0095, 0.06, 8), K.mat('shell', () => K.standard(0xb03020, { roughness: 0.6 })), 0.55 + k * 0.03, 0.942, 0.5 + (k % 2) * 0.02, { rz: Math.PI / 2, ry: 0.4 }); scene.add(c); }
  K.wallTorch(scene, -1.7, 2.0, -1.6, 0, 1, { seed: 3, intensity: 3.2, shadow: true });
  K.wallTorch(scene, 1.7, 2.0, -1.6, 0, 1, { seed: 8, intensity: 3.2, shadow: true });
  const sign = K.mesh(new THREE.PlaneGeometry(0.7, 0.7), K.mat('sign0', () => new THREE.MeshBasicMaterial({ map: TX.signTex(0, '#46e0bc'), alphaTest: 0.5, fog: false })), 0, 2.2, -1.58, { cast: false });
  scene.add(sign);
  K.brazier(scene, -2.2, 0.6, { scale: 0.9, intensity: 26, distance: 12, shadow: true });
  const fill = K.fireLight(0xffb070, 3, 4, false); fill.position.set(0.9, 1.9, 1.2); scene.add(fill);
}

// Debug: the gun and hand under flat light, from the side and from the player's eye.
function gunlab(scene, cam) {
  scene.add(new THREE.HemisphereLight(0xffffff, 0x404040, 2.5));
  const d = new THREE.DirectionalLight(0xffffff, 2); d.position.set(1, 2, 1); scene.add(d);
  const side = new THREE.Group(); side.add(m1911()); side.add(hand(1)); side.position.set(-0.25, 0, 0); side.rotation.y = Math.PI / 2; scene.add(side);
  const top = new THREE.Group(); top.add(m1911()); top.add(hand(1)); top.position.set(0.25, 0, 0); top.rotation.y = -Math.PI / 2 + 0.6; scene.add(top);
  cam.position.set(0, 0.05, 0.7); cam.lookAt(0, -0.02, 0); cam.fov = 40; cam.updateProjectionMatrix();
}

// The scales of Ma'at: a heart against a feather.
function scales(scene, x, z) {
  const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
  const gold = K.mat('goldLeaf', () => K.standard(0xffc030, { metalness: 0.9, roughness: 0.35, emissive: 0x3a2400 }));
  const wood = K.mat('ebony', () => K.lambert(0x2a1a10));
  g.add(K.mesh(new THREE.BoxGeometry(1.2, 0.4, 1.2), wood, 0, 0.2, 0));
  g.add(K.mesh(new THREE.CylinderGeometry(0.1, 0.12, 4.2, 8), wood, 0, 2.3, 0));
  g.add(K.mesh(new THREE.BoxGeometry(3.4, 0.12, 0.12), gold, 0, 4.3, 0, { rz: 0.12 }));
  for (const s of [-1, 1]) {
    const px = s * 1.6, py = 4.3 + s * -0.2 - 1.6;
    for (const d of [-1, 1]) g.add(M.limb([px, py + 1.6, 0], [px + d * 0.35, py + 0.05, 0], 0.01, 0.01, gold, 3));
    g.add(K.mesh(new THREE.CylinderGeometry(0.45, 0.3, 0.1, 10), gold, px, py, 0));
  }
  g.add(K.mesh(new THREE.SphereGeometry(0.17, 8, 6), K.glow(0xff2034, 'blood'), -1.6, 4.3 + 0.2 - 1.6 + 0.18, 0, { sy: 1.2 }));
  const feather = K.mesh(new THREE.ConeGeometry(0.12, 0.9, 4), K.mat('feather', () => K.lambert(0xf4ead0)), 1.6, 4.3 - 0.2 - 1.6 + 0.5, 0, { rz: 0.15 });
  g.add(feather);
  g.add(K.mesh(new THREE.BoxGeometry(0.4, 0.3, 0.06), gold, 0, 4.5, 0));
}

// A seated Anubis colossus against the side wall.
function colossus(scene, x, z, ry) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g);
  const st = K.mat('basalt', () => K.lambert(0x3a3632, { map: K.textures().rough }));
  g.add(K.mesh(new THREE.BoxGeometry(3.5, 2.5, 4), st, 0, 1.25, 0));
  g.add(K.mesh(new THREE.BoxGeometry(2.6, 2.4, 2.0), st, 0, 3.6, -0.6));
  g.add(K.mesh(new THREE.BoxGeometry(2.8, 3.2, 1.8), st, 0, 4.8, -0.9));
  for (const s of [-1, 1]) { g.add(K.mesh(new THREE.BoxGeometry(0.8, 2.6, 0.8), st, s * 0.9, 3.3, 1.4)); g.add(K.mesh(new THREE.BoxGeometry(0.7, 0.5, 2.4), st, s * 1.5, 2.8, 0.4)); }
  const h = M.jackalHead(st, 7); h.position.set(0, 7.5, -0.7); g.add(h);
  [[2.1, K.mat('lapis', () => K.lambert(0x2e56a8))], [1.8, K.mat('goldLeaf', () => K.standard(0xffc030, { metalness: 0.9, roughness: 0.35 }))]].forEach(([rr, m], k) =>
    g.add(K.mesh(new THREE.CylinderGeometry(rr, rr + 0.3, 0.3, 14), m, 0, 6.3 - k * 0.3, -0.7)));
}

// A bestiary portrait: dark floor, a brazier behind one shoulder, a torch in front.
function portrait(scene, cam, actor, { h = 1, d = 3, y = 1, x = 0, z = 0, yaw = 0.35, tilt = 0.08, light = 1 } = {}) {
  scene.fog = new THREE.FogExp2(0x000000, 0.045 / Math.max(1, light));
  const T = K.textures();
  const floorM = K.mat('floor', () => K.lambert(0xffffff, { map: T.floor }));
  scene.add(K.mesh(K.uvTile(new THREE.PlaneGeometry(40, 40), 40, 40, 2), floorM, 0, 0, 0, { rx: -Math.PI / 2 }));
  const wallM = K.mat('wall', () => K.lambert(0xffffff, { map: T.wall }));
  scene.add(K.mesh(K.uvTile(new THREE.PlaneGeometry(30, 12), 30, 12, 2.4), wallM, 0, 6, -3.5 * light));
  actor.rotation.y += yaw; scene.add(actor);
  K.brazier(scene, -2.4 * light, -2.2 * light, { scale: 0.9 * Math.min(light, 1.4), intensity: 40 * light, distance: 22 * light, shadow: true });
  const key = K.fireLight(0xffb070, 36 * light * light, 12 * light, true); key.position.set(2.2 * light, 2.4 * light, 2.6 * light); scene.add(key);
  const f = K.flame(0.55, 3); f.position.copy(key.position).add(new THREE.Vector3(0, -0.4, 0)); scene.add(f);
  cam.position.set(x + d * Math.sin(-0.12), y + h * tilt * 3, z + d); cam.lookAt(x, y, z);
  return actor;
}

// ---- boot -------------------------------------------------------------------------------
function boot() {
  const shot = SHOTS[SHOT];
  if (!shot) return menu();
  const W = Math.round(LINES * shot.aspect), H = LINES;
  const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1); renderer.setSize(W, H, false);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.BasicShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const cv = renderer.domElement; cv.id = 'shot';
  const scale = +(Q.get('scale') || 0);
  if (scale) { cv.style.width = W * scale + 'px'; cv.style.height = H * scale + 'px'; } else cv.className = 'fit';
  document.body.appendChild(cv);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x000000);
  const cam = new THREE.PerspectiveCamera(66, W / H, 0.03, 120); scene.add(cam);
  scene.add(new THREE.HemisphereLight(0x1a2448, 0x140a04, 0.02)); // the faintest bounce: darkness fades blue, not grey
  shot.build(scene, cam);
  if (Q.get('debug')) { scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 3)); scene.fog = null; }
  dreadify(scene);
  const pass = new DreadPass(renderer); pass.setSize(W, H); pass.setStyle(STYLE);
  pass.uniforms.uEdgeFar.value = 18;
  let n = 0;
  const frame = () => {
    pass.render(scene, cam, n / 60);
    if (++n < 3) requestAnimationFrame(frame);
    else { window.__READY = true; document.title = `${shot.title} · ${STYLE.name}`; }
  };
  requestAnimationFrame(frame);
  window.__SHOT = { W, H, title: shot.title, style: STYLE.name }; window.__scene = scene;
}

function menu() {
  document.body.classList.add('menu');
  const list = Object.entries(SHOTS).map(([id, s]) => `<li><a href="?shot=${id}">${s.title}</a> · ${Object.keys(STYLES).map((k) => `<a href="?shot=${id}&style=${k}">${STYLES[k].name}</a>`).join(' ')}</li>`).join('');
  document.body.innerHTML = `<h1>HELL HOLE · concept shots</h1><ul>${list}</ul>`;
}

boot();
