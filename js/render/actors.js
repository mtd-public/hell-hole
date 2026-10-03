import * as THREE from 'three';
import { mergeGeometries } from '../vendor/addons/BufferGeometryUtils.js';
import * as K from './tomb.js';
import * as M from './monsters.js';
import * as W from './weapons.js';
import * as TX from './textures.js';
import { dreadify } from './dread.js';

// Monsters on screen. Mummies are baked from the bestiary builders (three variants, one mesh
// per material each) and animated as a whole body: shamble, rear back for the swipe, fall
// backward and sink. Scarabs are instanced: one InstancedMesh per material for the whole swarm.

const SCARAB_CAP = 256;
const _o = new THREE.Object3D();

export class Actors {
  constructor(scene) {
    this.scene = scene;
    this.templates = [1, 3, 5].map((s) => K.bake(M.mummy(s), mergeGeometries));
    this.templates.forEach((tp) => dreadify(tp)); // clones share these materials: patch them once here
    this.mummies = new Map();
    const sb = K.bake(M.scarab(1), mergeGeometries);
    this.swarm = sb.children.map((me) => {
      const im = new THREE.InstancedMesh(me.geometry, me.material, SCARAB_CAP);
      im.count = 0; im.frustumCulled = false; im.castShadow = false; im.receiveShadow = true;
      scene.add(im); return im;
    });
    this.grenadeMeshes = [];
    this.grenadeTemplate = K.bake(W.grenade(), mergeGeometries); dreadify(this.grenadeTemplate);
    this.flash = new Map(); // mummy id → seconds of hit jolt left
  }

  hit(id) { this.flash.set(id, 0.12); }

  update(world, t, dt) {
    for (const e of world.enemies) {
      let g = this.mummies.get(e.id);
      if (!g) {
        g = new THREE.Group(); const body = this.templates[e.id % 3].clone(); g.add(body); g.userData.body = body;
        this.scene.add(g); this.mummies.set(e.id, g);
      }
      const body = g.userData.body;
      g.position.set(e.x, 0, e.z); g.rotation.y = e.yaw + Math.PI; // built facing +z
      body.position.set(0, 0, 0); body.rotation.set(0, 0, 0);
      if (e.state === 'dead') {
        const k = Math.min(1, e.deadT / 0.55);
        body.rotation.x = -k * k * Math.PI * 0.48;               // topples backward from the feet
        body.position.y = -Math.max(0, e.deadT - 1.4) * 0.35;    // then the sand takes it
        g.visible = e.deadT < 4;
        continue;
      }
      if (e.state === 'windup') { body.rotation.x = -0.24; body.position.y = 0.04; }
      else if (e.state === 'chase') {
        const ph = t * 4.4 + e.phase;
        body.position.y = Math.abs(Math.sin(ph)) * 0.05;
        body.rotation.z = Math.sin(ph) * 0.08; body.rotation.x = 0.06;
      } else body.rotation.z = Math.sin(t * 0.7 + e.phase) * 0.03;
      const f = this.flash.get(e.id);
      if (f > 0) { body.rotation.x -= f * 1.6; this.flash.set(e.id, f - dt); }
    }
    // the swarm
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
    // grenades in flight
    world.grenades.forEach((gr, k) => {
      let me = this.grenadeMeshes[k];
      if (!me) { me = this.grenadeTemplate.clone(); this.scene.add(me); this.grenadeMeshes[k] = me; }
      me.visible = true; me.position.set(gr.x, gr.y, gr.z); me.rotation.set(gr.spin, gr.spin * 0.7, 0);
    });
    for (let k = world.grenades.length; k < this.grenadeMeshes.length; k++) this.grenadeMeshes[k].visible = false;
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
