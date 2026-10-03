import * as THREE from 'three';
import { mergeGeometries } from '../vendor/addons/BufferGeometryUtils.js';
import * as K from './tomb.js';
import * as M from './monsters.js';
import * as W from './weapons.js';
import * as TX from './textures.js';
import { dreadify } from './dread.js';

// Monsters on screen, all baked from the bestiary builders (one mesh per material) and
// animated as whole bodies:
//   mummy   three variants: shamble, rear back for the swipe, fall backward and sink
//   jackal  two poses (blade low, blade raised): stalk, crouch, lunge, slash, reel, fall forward
//   ba      two wing frames swapped at 9 Hz (a PS1 flap): orbit, shiver before the dive, tumble
//   mother  bob, a jolt when she births, gone in a burst of alabaster when she breaks
// Scarabs are instanced: one InstancedMesh per material for the whole swarm. Rockets carry
// one of two pooled lights and leave smoke.

const SCARAB_CAP = 256;
const _o = new THREE.Object3D();
const bake = (g) => { const b = K.bake(g, mergeGeometries); dreadify(b); return b; };

export class Actors {
  constructor(scene, fx) {
    this.scene = scene; this.fx = fx;
    this.T = {
      mummy: [1, 3, 5].map((s) => bake(M.mummy(s))),
      jackalLow: bake(M.jackal(1, 'low')), jackalRaise: bake(M.jackal(1, 'raise')),
      baUp: bake(M.ba(1, 0.0)), baDown: bake(M.ba(1, 0.6)),
      mother: bake(M.canopic(3)),
      rocket: bake(W.rocket()), grenade: bake(W.grenade()),
    };
    this.views = new Map();
    const sb = K.bake(M.scarab(1), mergeGeometries);
    this.swarm = sb.children.map((me) => {
      const im = new THREE.InstancedMesh(me.geometry, me.material, SCARAB_CAP);
      im.count = 0; im.frustumCulled = false; im.castShadow = false; im.receiveShadow = true;
      scene.add(im); return im;
    });
    this.grenadeMeshes = [];
    this.rocketViews = [];
    this.rocketLights = [0, 1].map(() => { const l = new THREE.PointLight(0xffb060, 0, 12, 2); scene.add(l); return l; });
    this.flash = new Map(); // id → seconds of hit jolt left
  }

  hit(id) { this.flash.set(id, 0.12); }

  view(e) {
    let v = this.views.get(e.id);
    if (v) return v;
    const g = new THREE.Group(), T = this.T;
    v = { g };
    if (e.type === 'mummy') { v.body = T.mummy[e.id % 3].clone(); g.add(v.body); }
    else if (e.type === 'jackal') { v.body = new THREE.Group(); v.low = T.jackalLow.clone(); v.raise = T.jackalRaise.clone(); v.body.add(v.low, v.raise); g.add(v.body); }
    else if (e.type === 'ba') { v.body = new THREE.Group(); v.up = T.baUp.clone(); v.down = T.baDown.clone(); v.body.add(v.up, v.down); g.add(v.body); }
    else { v.body = T.mother.clone(); g.add(v.body); }
    this.scene.add(g); this.views.set(e.id, v);
    return v;
  }

  update(world, t, dt) {
    for (const e of world.enemies) {
      const v = this.view(e), g = v.g, body = v.body;
      g.position.set(e.x, e.y || 0, e.z); g.rotation.y = e.yaw + Math.PI; // built facing +z
      body.position.set(0, 0, 0); body.rotation.set(0, 0, 0);
      const f = this.flash.get(e.id) || 0;
      if (f > 0) this.flash.set(e.id, f - dt);
      if (e.type === 'mummy') this.mummy(e, v, t, f);
      else if (e.type === 'jackal') this.jackal(e, v, t, f);
      else if (e.type === 'ba') this.ba(e, v, t, f);
      else this.mother(e, v, t, f);
    }
    this.scarabs(world, t);
    this.projectiles(world, t, dt);
  }

  mummy(e, v, t, f) {
    const b = v.body;
    if (e.dead) {
      const k = Math.min(1, e.deadT / 0.55);
      b.rotation.x = -k * k * Math.PI * 0.48;               // topples backward from the feet
      b.position.y = -Math.max(0, e.deadT - 1.4) * 0.35;    // then the sand takes it
      v.g.visible = e.deadT < 4; return;
    }
    if (e.state === 'windup') { b.rotation.x = -0.24; b.position.y = 0.04; }
    else if (e.state === 'chase') { const ph = t * 4.4 + e.phase; b.position.y = Math.abs(Math.sin(ph)) * 0.05; b.rotation.z = Math.sin(ph) * 0.08; b.rotation.x = 0.06; }
    else b.rotation.z = Math.sin(t * 0.7 + e.phase) * 0.03;
    b.rotation.x -= f * 1.6;
  }

  jackal(e, v, t, f) {
    const b = v.body, raised = e.state === 'windup' || e.state === 'idle';
    v.low.visible = !raised; v.raise.visible = raised;
    if (e.dead) {
      const k = Math.min(1, e.deadT / 0.6);
      b.rotation.x = k * k * Math.PI * 0.47;                // falls forward onto its face
      b.position.y = -Math.max(0, e.deadT - 1.6) * 0.4;
      v.g.visible = e.deadT < 4.5; return;
    }
    const ph = t * 6 + e.phase;
    switch (e.state) {
      case 'crouch': b.position.y = -0.28; b.rotation.x = 0.3; break;          // the read: it drops, then comes
      case 'lunge': b.position.y = -0.12; b.rotation.x = 0.42; break;
      case 'windup': b.rotation.x = -0.12; break;
      case 'stagger': b.rotation.x = -0.35 + Math.sin(t * 40) * 0.05; b.rotation.z = Math.sin(t * 23) * 0.08; break;
      case 'chase': b.position.y = Math.abs(Math.sin(ph)) * 0.06; b.rotation.z = Math.sin(ph) * 0.05; b.rotation.x = 0.1; break;
      default: b.rotation.z = Math.sin(t * 0.6 + e.phase) * 0.02;
    }
    b.rotation.x -= f * 1.2;
  }

  ba(e, v, t, f) {
    const b = v.body, flapFast = e.state === 'tele' || e.state === 'climb';
    const frame = Math.floor(t * (flapFast ? 16 : 9) + e.phase) % 2;
    v.up.visible = frame === 0; v.down.visible = frame === 1;
    if (e.dead) { v.up.visible = true; v.down.visible = false; b.rotation.set(e.deadT * 9, 0, e.deadT * 6); v.g.visible = e.deadT < 2.5; return; }
    if (e.state === 'tele') { b.position.set(Math.sin(t * 70) * 0.04, 0, 0); b.rotation.x = -0.2; }
    else if (e.state === 'dive') b.rotation.x = 0.7;
    else b.rotation.z = Math.sin(t * 3 + e.phase) * 0.2;
    b.rotation.x -= f * 2;
  }

  mother(e, v, t, f) {
    const b = v.body;
    if (e.dead) { v.g.visible = false; return; }
    b.position.y = Math.sin(t * 1.3 + e.phase) * 0.12;
    b.rotation.z = Math.sin(t * 0.9 + e.phase) * 0.04 + f * 0.8;
  }

  scarabs(world, t) {
    let n = 0;
    for (const s of world.scarabs) {
      if (n >= SCARAB_CAP) break;
      if (s.dead && s.deadT > 1.2) continue;
      _o.position.set(s.x, s.dead ? 0.02 : Math.abs(Math.sin(t * 22 + s.id)) * 0.02, s.z);
      _o.rotation.set(0, s.yaw + Math.PI, s.dead ? Math.PI : Math.sin(t * 30 + s.id) * 0.08);
      _o.scale.setScalar(s.dead ? Math.max(0.01, 1 - s.deadT / 1.2) : 1);
      _o.updateMatrix();
      for (const im of this.swarm) im.setMatrixAt(n, _o.matrix);
      n++;
    }
    for (const im of this.swarm) { im.count = n; im.instanceMatrix.needsUpdate = true; }
  }

  projectiles(world, t, dt) {
    world.grenades.forEach((gr, k) => {
      let me = this.grenadeMeshes[k];
      if (!me) { me = this.T.grenade.clone(); this.scene.add(me); this.grenadeMeshes[k] = me; }
      me.visible = true; me.position.set(gr.x, gr.y, gr.z); me.rotation.set(gr.spin, gr.spin * 0.7, 0);
    });
    for (let k = world.grenades.length; k < this.grenadeMeshes.length; k++) this.grenadeMeshes[k].visible = false;
    // rockets: the round, its exhaust, its own light, a smoke trail
    world.rockets.forEach((r, k) => {
      let v = this.rocketViews[k];
      if (!v) {
        const g = new THREE.Group(); g.add(this.T.rocket.clone());
        const fl = K.flame(0.45, 5); fl.rotation.x = Math.PI / 2; fl.position.z = 0.2; g.add(fl); dreadify(fl);
        this.scene.add(g); v = this.rocketViews[k] = { g };
      }
      v.g.visible = true; v.g.position.set(r.x, r.y, r.z);
      v.g.lookAt(r.x - r.vx, r.y - r.vy, r.z - r.vz);
      if (this.fx && Math.random() < dt * 40) this.fx.burst('smoke', r.x - r.vx * 0.02, r.y, r.z - r.vz * 0.02, 1, { speed: 0.3, size: 0.22, life: 1.1, up: 0.5 });
      const l = this.rocketLights[k];
      if (l) { l.position.set(r.x, r.y, r.z); l.intensity = 14 + Math.sin(t * 50) * 3; }
    });
    for (let k = world.rockets.length; k < this.rocketViews.length; k++) this.rocketViews[k].g.visible = false;
    for (let k = world.rockets.length; k < this.rocketLights.length; k++) this.rocketLights[k].intensity = 0;
  }
}

// ---------------------------------------------------------------------------------- fx
// Particles: four instanced pools (sparks, linen dust, heart gore, chitin), each a few hundred
// cubes with velocity and gravity. Explosions: camera-facing fire cards, rising smoke, embers
// and one of two pooled lights.
const KINDS = {
  spark: { mat: () => K.glow(0xffc060), grav: 9, cap: 192 },
  dust: { mat: () => K.lambert(0xc8b890), grav: 2.5, cap: 192 },
  gore: { mat: () => K.glow(0xff2034, 'blood'), grav: 9, cap: 128 },
  chitin: { mat: () => K.lambert(0x1e6e58), grav: 12, cap: 128 },
  ember: { mat: () => K.glow(0xff7a20), grav: -1.5, cap: 128 },
  smoke: { mat: () => K.lambert(0x5a5048), grav: -0.4, cap: 256 },
  chip: { mat: () => K.lambert(0xe8dcc8), grav: 10, cap: 192 }, // alabaster and bone
};

export class Fx {
  constructor(scene) {
    this.scene = scene; this.pools = {};
    const box = new THREE.BoxGeometry(1, 1, 1);
    for (const [k, d] of Object.entries(KINDS)) {
      const im = new THREE.InstancedMesh(box, K.mat('fx-' + k, d.mat), d.cap);
      im.count = 0; im.frustumCulled = false; im.castShadow = false; im.receiveShadow = false; scene.add(im);
      this.pools[k] = { im, d, list: [] };
    }
    this.lights = [0, 1].map(() => { const l = new THREE.PointLight(0xffa050, 0, 14, 2); scene.add(l); return l; });
    this.lightT = [0, 0]; this.lightNext = 0;
    this.booms = [];
    this.rand = TX.rng(99);
  }

  burst(kind, x, y, z, n, { speed = 2, size = 0.04, life = 0.5, up = 1, dir = null } = {}) {
    const P = this.pools[kind], r = this.rand;
    for (let k = 0; k < n; k++) {
      if (P.list.length >= P.d.cap) P.list.shift();
      let vx = (r() - 0.5) * 2, vy = (r() - 0.2) * up, vz = (r() - 0.5) * 2;
      if (dir) { vx = vx * 0.6 + dir[0] * 1.4; vy = vy * 0.6 + dir[1] * 1.4; vz = vz * 0.6 + dir[2] * 1.4; }
      const s = speed * (0.4 + r() * 0.8);
      P.list.push({ x, y, z, vx: vx * s, vy: vy * s, vz: vz * s, life: life * (0.6 + r() * 0.6), age: 0, size: size * (0.6 + r() * 0.8) });
    }
  }

  flashLight(x, y, z, intensity, distance, ttl) {
    const k = this.lightNext; this.lightNext = 1 - k;
    const l = this.lights[k]; l.position.set(x, y, z); l.intensity = intensity; l.distance = distance;
    this.lightT[k] = { t: ttl, ttl, i: intensity };
  }

  explosion(x, y, z, camera) {
    const cards = [];
    [[1.9, 0, 0.1, 0], [1.3, 0.45, 0.45, 0.2], [1.1, -0.5, 0.3, 0.25], [0.8, 0.1, 0.8, 0.3]].forEach(([size, ox, oy, oz], k) => {
      const m = K.mat('boom' + k, () => K.role(new THREE.MeshBasicMaterial({ map: TX.burstTex(k * 11 + 1), alphaTest: 0.5, side: THREE.DoubleSide, fog: false }), 'fire'));
      const me = new THREE.Mesh(new THREE.PlaneGeometry(size, size), m); me.position.set(x + ox, Math.max(0.6, y + oy), z + oz); me.userData.size = size;
      this.scene.add(me); cards.push(me);
    });
    const smoke = [];
    for (let k = 0; k < 5; k++) {
      const m = K.mat('smoke' + (k % 3), () => K.lambert(0xffffff, { map: TX.smokeTex(k * 7 + 3), alphaTest: 0.5, side: THREE.DoubleSide }));
      const me = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4), m);
      me.position.set(x + (this.rand() - 0.5) * 1.6, Math.max(0.8, y + 0.4 + this.rand()), z + (this.rand() - 0.5) * 1.6);
      this.scene.add(me); smoke.push(me);
    }
    this.booms.push({ cards, smoke, age: 0 });
    this.burst('ember', x, y + 0.3, z, 26, { speed: 7, size: 0.06, life: 1.1, up: 2 });
    this.burst('spark', x, y + 0.3, z, 20, { speed: 9, size: 0.04, life: 0.5, up: 2 });
    this.flashLight(x, Math.max(1, y + 0.8), z, 70, 16, 0.5);
    void camera;
  }

  update(dt, camera) {
    for (const P of Object.values(this.pools)) {
      const g = P.d.grav;
      P.list = P.list.filter((p) => (p.age += dt) < p.life);
      P.list.forEach((p, k) => {
        p.vy -= g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        if (p.y < 0.01) { p.y = 0.01; p.vy *= -0.3; p.vx *= 0.6; p.vz *= 0.6; }
        const s = p.size * (1 - p.age / p.life * 0.6);
        _o.position.set(p.x, p.y, p.z); _o.rotation.set(p.age * 7, p.age * 5, 0); _o.scale.setScalar(s); _o.updateMatrix();
        P.im.setMatrixAt(k, _o.matrix);
      });
      P.im.count = P.list.length; P.im.instanceMatrix.needsUpdate = true;
    }
    this.booms = this.booms.filter((b) => {
      b.age += dt;
      const k = b.age / 0.5;
      b.cards.forEach((c, i) => { c.lookAt(camera.position); c.scale.setScalar(0.5 + k * 0.9 + i * 0.05); c.visible = k < 1 - i * 0.1; });
      b.smoke.forEach((s) => { s.lookAt(camera.position); s.position.y += dt * 0.5; s.scale.setScalar(1 + b.age * 0.5); s.visible = b.age < 1.8; });
      if (b.age > 1.8) { for (const c of [...b.cards, ...b.smoke]) { this.scene.remove(c); c.geometry.dispose(); } return false; }
      return true;
    });
    this.lights.forEach((l, k) => {
      const s = this.lightT[k];
      if (!s || s.t <= 0) { l.intensity = 0; return; }
      s.t -= dt; l.intensity = s.i * Math.max(0, s.t / s.ttl) ** 1.5;
    });
  }
}
