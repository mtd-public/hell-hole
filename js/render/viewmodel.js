import * as THREE from 'three';
import * as K from './tomb.js';
import { m1911, hand, muzzleFlash } from './guns.js';
import * as W from './weapons.js';
import { TUNING } from '../sim/tuning.js';

// The first-person hands. Twin M1911A1s (the left one mirrored), or the Remington 870 in both
// hands. Everything here is presentation: recoil, slide-lock reload dips, the weapon swap,
// the grenade throw, walk bob and look sway. The muzzle light is a real light: firing in the
// dark shows you the room for a frame.

const BASE = { x: 0.2, y: -0.19, z: -0.46, yaw: 0.2, roll: -0.1 };
const dropLights = (g) => { const ls = []; g.traverse((o) => { if (o.isLight) ls.push(o); }); ls.forEach((l) => l.removeFromParent()); };

export class Viewmodel {
  constructor(camera) {
    this.root = new THREE.Group(); camera.add(this.root);
    this.guns = {};
    for (const side of ['R', 'L']) {
      const s = side === 'R' ? 1 : -1, g = new THREE.Group();
      const inner = new THREE.Group(); inner.scale.x = s; inner.add(m1911()); inner.add(hand(s));
      const flash = muzzleFlash(s > 0 ? 1 : 3); flash.position.set(0, 0.03, -0.175); flash.visible = false;
      dropLights(flash); // the one muzzle light lives on the camera
      inner.add(flash); g.add(inner);
      this.root.add(g);
      this.guns[side] = { g, flash, s, kick: 0, flashT: 0, throwT: 0 };
    }
    // the 870
    const sg = new THREE.Group(); const sgi = new THREE.Group(); sg.add(sgi);
    sgi.add(W.remington870());
    W.fistsFor870(sgi);
    const sflash = muzzleFlash(2); sflash.scale.setScalar(1.8); sflash.position.set(0, 0.042, -0.62); sflash.visible = false;
    dropLights(sflash);
    sgi.add(sflash);
    sg.visible = false; this.root.add(sg);
    this.sg = { g: sg, inner: sgi, flash: sflash, kick: 0, flashT: 0 };
    this.light = new THREE.PointLight(K.PAL.muzzleLight, 0, 11, 2); this.light.position.set(0, 0.0, -0.6); camera.add(this.light);
    this.lightT = 0;
    this.carry = new THREE.PointLight(0xffa060, 0.45, 1.2, 2); this.carry.position.set(0, 0.16, -0.32); camera.add(this.carry); // the hands always read
    this.bob = 0; this.swayX = 0; this.swayY = 0; this.lower = 0;
  }

  event(e) {
    if (e.type === 'shot') {
      if (e.gun === 'S') { this.sg.kick = 1; this.sg.flashT = 0.06; this.flashLight(9); }
      else { const g = this.guns[e.gun]; g.kick = 1; g.flashT = 0.045; this.flashLight(6); }
    }
    if (e.type === 'throw') this.guns.L.throwT = 0.45;
  }
  flashLight(i) { this.light.intensity = i; this.lightT = 0.06; }

  update(world, dt, look) {
    const p = world.player, moving = p.onGround ? p.moving : 0;
    this.bob += dt * (6 + moving * 5) * (moving > 0.1 ? 1 : 0.2);
    this.swayX += ((look?.yaw || 0) * 0.6 - this.swayX) * Math.min(1, dt * 10);
    this.swayY += ((look?.pitch || 0) * 0.6 - this.swayY) * Math.min(1, dt * 10);
    const bx = Math.sin(this.bob) * 0.012 * moving, by = -Math.abs(Math.cos(this.bob)) * 0.014 * moving;
    const pist = p.weapon === 'pistols';
    // the swap: the old weapon drops out, the new one comes up
    const sw = p.switchT > 0 ? Math.sin(Math.min(1, p.switchT / 0.35) * Math.PI) : 0;
    for (const side of ['L', 'R']) {
      const G = this.guns[side], gs = p.guns[side], g = G.g;
      g.visible = pist;
      G.kick = Math.max(0, G.kick - dt / 0.12);
      if (G.flashT > 0) G.flashT -= dt;
      G.flash.visible = G.flashT > 0; G.flash.rotation.z = Math.random() * 6;
      // reload: a dip and a twist while the magazine goes in
      let rl = 0;
      if (gs.reload > 0) { const k = 1 - gs.reload / TUNING.pistol.reload; rl = Math.sin(Math.min(1, k) * Math.PI); }
      if (G.throwT > 0) { G.throwT -= dt; rl = Math.max(rl, Math.sin(Math.max(0, G.throwT) / 0.45 * Math.PI)); }
      const k = G.kick * G.kick;
      g.position.set(G.s * BASE.x + bx - this.swayX * 0.05, BASE.y + by - rl * 0.2 - sw * 0.25 + this.swayY * 0.04 + k * 0.012, BASE.z + k * 0.06);
      g.rotation.set(0.02 + k * 0.32 - rl * 0.5, G.s * BASE.yaw + rl * G.s * 0.4, G.s * BASE.roll);
    }
    const S = this.sg;
    S.g.visible = !pist;
    S.kick = Math.max(0, S.kick - dt / 0.22);
    if (S.flashT > 0) S.flashT -= dt;
    S.flash.visible = S.flashT > 0;
    const loading = p.sg.loading ? 1 : 0, k = S.kick * S.kick;
    S.g.position.set(0.17 + bx - this.swayX * 0.05, -0.21 + by - sw * 0.3 + this.swayY * 0.04 - loading * 0.04, -0.3 + k * 0.09);
    S.g.rotation.set(0.05 + k * 0.28, 0.1 + loading * 0.25, -0.1 - loading * 0.35);
    if (this.lightT > 0) { this.lightT -= dt; if (this.lightT <= 0) this.light.intensity = 0; }
  }
}
