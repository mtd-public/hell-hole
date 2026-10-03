import * as THREE from 'three';

// "Dread": the Hell Hole look. Devil Daggers' dithered darkness, in tomb-paint colour, with
// Sin City's ink edges.
//
// It's built on labyrinth-larry's js/ink.js (material roles + one post pass) and dr-mow's
// retro renderer (low internal resolution, 4x4 Bayer dither, point-sampled textures).
//
// The frame renders at low resolution into a half-float target with depth. One post pass then
// quantises it. There are three styles:
//   pigment (default) — full colour, snapped to a fixed palette of Egyptian pigments (lapis,
//            turquoise, ochre, red ochre, gold, bone and a run of warm darks) through an
//            ordered dither. Multi-colour, but every pixel is one of ~32 inks.
//   dagger  — Devil Daggers' near-mono: one warm ramp, fire/danger/reward as accent ramps.
//   sincity — labyrinth-larry's ink: paper, ink, hatching, one accent.
// dagger and sincity need material *roles* (mono / fire / blood / gold): each material writes
// grey or a pure channel at its brightness. One shared uniform switches that off for pigment,
// so all three styles run on the same materials with no recompile.
// Every style draws depth edges in the opposite tone: ink on lit shapes, a faint dithered rim
// on dark ones that fades with distance, so monsters walking out of the dark arrive as
// outlines before they arrive lit.

export const ROLES = { mono: 0, fire: 1, blood: 2, gold: 3 };

// Egyptian pigments plus the darks that torchlight falls off through. Order is irrelevant.
const PIGMENTS = [
  // warm darks → limestone → bone (the bulk of every frame)
  '#000000', '#0c0705', '#1a0f09', '#2a1910', '#3e2516', '#5a3720', '#7c4f2c', '#a06c3c', '#c49258', '#e0b87e', '#f4e2b8',
  // red ochre and the crimson reserved for danger
  '#2e0a06', '#5e160c', '#9a2c16', '#cc4a24', '#7a0612', '#d8142a',
  // lapis
  '#080c1e', '#121c44', '#1e3478', '#3460b0', '#6a92d8',
  // turquoise / malachite
  '#06201a', '#0e3e32', '#1e6e58', '#38a888',
  // glyph glow: turquoise and lapis light
  '#2ab894', '#46e0bc', '#8af0d8', '#5a8ce8',
  // fire and gold
  '#e86a10', '#ffa020', '#ffd048', '#fff4c0',
  // grey-violet shadow and bone-white
  '#262230', '#4a4458',
];

export const STYLES = {
  pigment: {
    name: 'Pigment', mode: 2, palette: PIGMENTS, spread: 0.16, gamma: 1.5, rim: '#5a3720',
    mono: ['#000000', '#1a0f09', '#3e2516', '#7c4f2c', '#c49258', '#f4e2b8'],
  },
  dagger: {
    name: 'Dagger', mode: 0, roles: true, rim: '#3a1a10',
    mono: ['#000000', '#140806', '#3a1a10', '#74401f', '#c08a4a', '#f2dcae'],
    fire: ['#000000', '#5a1004', '#c8380a', '#ff8c1a', '#fff0b0'],
    blood: ['#000000', '#3c0008', '#8e0614', '#ff1e32', '#ffd2c8'],
    gold: ['#000000', '#3a2a06', '#9a6c10', '#ffc838', '#fff6c8'],
    gamma: 1.25,
  },
  sincity: {
    name: 'Sin City', mode: 1, roles: true, rim: '#ffffff',
    mono: ['#000000', '#000000', '#000000', '#ffffff', '#ffffff', '#ffffff'],
    fire: ['#000000', '#000000', '#ff2a1a', '#ff2a1a', '#ffffff'],
    blood: ['#000000', '#000000', '#ff1a2a', '#ff1a2a', '#ff1a2a'],
    gold: ['#000000', '#000000', '#ffffff', '#ffffff', '#ffffff'],
    gamma: 1.0,
  },
};

// 1 = materials write their role; 0 = materials keep their colour (pigment).
export const roleUniform = { value: 0 };

const ROLE_CODE = {
  mono: 'gl_FragColor.rgb = vec3(dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114)));',
  fire: 'gl_FragColor.rgb = vec3(max(gl_FragColor.r, max(gl_FragColor.g, gl_FragColor.b)), 0.0, 0.0);',
  blood: 'gl_FragColor.rgb = vec3(0.0, max(gl_FragColor.r, max(gl_FragColor.g, gl_FragColor.b)), 0.0);',
  gold: 'gl_FragColor.rgb = vec3(0.0, 0.0, max(gl_FragColor.r, max(gl_FragColor.g, gl_FragColor.b)));',
};

// Give an object (and everything under it) or a material a role. First role set wins.
export function role(target, r) {
  const set = (m) => { if (!m.userData.role) m.userData.role = r; };
  if (target.isMaterial) set(target);
  else target.traverse((o) => { if (o.material) [].concat(o.material).forEach(set); });
  return target;
}

function patch(m) {
  if (m.userData.dreadPatched || m.isShaderMaterial) return;
  m.userData.dreadPatched = true;
  const r = m.userData.role || 'mono';
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uRoles = roleUniform;
    sh.fragmentShader = 'uniform float uRoles;\n' + sh.fragmentShader.replace('#include <fog_fragment>',
      `#include <fog_fragment>\nif (uRoles > 0.5) { ${ROLE_CODE[r]} }`);
  };
  m.customProgramCacheKey = () => 'dread-' + r;
  m.needsUpdate = true;
}

// Patch every material under root. Call after building anything new.
export function dreadify(root) {
  root.traverse((o) => { if (o.material) [].concat(o.material).forEach(patch); });
}

const ramp = (name, n) => Array.from({ length: n }, (_, i) => `uniform vec3 ${name}${i};`).join('\n');
// pick ramp[i] for a float index without dynamic array indexing
const pick = (name, n) => `vec3 ${name}At(float i) {\n` +
  Array.from({ length: n - 1 }, (_, k) => `  if (i < ${k}.5) return ${name}${k};`).join('\n') + `\n  return ${name}${n - 1};\n}`;

const MAXPAL = 40;
const FRAG = /* glsl */`
  uniform sampler2D tColor; uniform sampler2D tDepth;
  uniform vec2 uRes; uniform float uTime; uniform float uMode; uniform float uGamma; uniform float uSpread;
  uniform float uNear; uniform float uFar; uniform float uEdgeFar; uniform vec3 uRimC;
  uniform vec3 uPal[${MAXPAL}]; uniform int uPalN;
  ${ramp('uM', 6)}
  ${ramp('uF', 5)}
  ${ramp('uB', 5)}
  ${ramp('uG', 5)}
  ${pick('uM', 6)}
  ${pick('uF', 5)}
  ${pick('uB', 5)}
  ${pick('uG', 5)}
  varying vec2 vUv;

  float bayer4(vec2 fc) {
    vec2 bq = mod(floor(fc), 4.0), lo = mod(bq, 2.0), hi = floor(bq / 2.0);
    float b = 4.0 * mod(2.0 * lo.x + 3.0 * lo.y, 4.0) + mod(2.0 * hi.x + 3.0 * hi.y, 4.0);
    return (b + 0.5) / 16.0;
  }
  float viewZ(vec2 uv) {
    float z = texture2D(tDepth, uv).r * 2.0 - 1.0;
    return (2.0 * uNear * uFar) / (uFar + uNear - z * (uFar - uNear));
  }
  vec3 srgb2lin(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }
  float dstep(float v, float n, float b) {
    float x = clamp(v, 0.0, 1.0) * (n - 1.0);
    return floor(x) + step(b, fract(x));
  }
  // nearest palette ink, in gamma space, weighted toward luma so value reads before hue
  vec3 nearest(vec3 s) {
    vec3 best = uPal[0]; float bd = 1e9;
    for (int i = 0; i < ${MAXPAL}; i++) {
      if (i >= uPalN) break;
      vec3 d = s - uPal[i];
      float dist = dot(d * d, vec3(0.36, 0.48, 0.16));
      if (dist < bd) { bd = dist; best = uPal[i]; }
    }
    return best;
  }
  void main() {
    vec3 c = max(texture2D(tColor, vUv).rgb, 0.0);
    vec2 fc = gl_FragCoord.xy;
    float b = bayer4(fc);
    float z = viewZ(vUv);
    vec3 col;
    if (uMode > 1.5) {
      // pigment: colour kept, value curve darkened, ordered dither into the palette
      vec3 s = pow(min(c, 1.0), vec3(1.0 / 2.2));
      float l = dot(s, vec3(0.299, 0.587, 0.114));
      s *= pow(max(l, 1e-4), uGamma - 1.0);                 // deepen the darks, keep hue
      s += (b - 0.5) * uSpread * (0.35 + 0.65 * smoothstep(0.0, 0.25, l));
      col = srgb2lin(nearest(clamp(s, 0.0, 1.0)));
    } else {
      float mx = max(c.r, max(c.g, c.b)), mn = min(c.r, min(c.g, c.b));
      bool accent = mx > 0.0005 && (mx - mn) > 0.6 * mx;
      if (uMode < 0.5) {
        if (accent) {
          float a = pow(mx, 1.0 / 2.2);
          if (c.r >= c.g && c.r >= c.b) col = uFAt(dstep(a, 5.0, b));
          else if (c.g >= c.b) col = uBAt(dstep(a, 5.0, b));
          else col = uGAt(dstep(a, 5.0, b));
        } else {
          col = uMAt(dstep(pow(pow(c.r, 1.0 / 2.2), uGamma), 6.0, b));
        }
      } else {
        vec2 p = fc;
        float h1 = step(0.75, fract((p.x + p.y) / 4.0));
        float h2 = step(0.5, fract((p.x + p.y) / 4.0));
        float h3 = max(h2, step(0.75, fract((p.x - p.y) / 4.0)));
        if (accent) {
          float a = pow(mx, 1.0 / 2.2);
          vec3 acc = (c.r >= c.g && c.r >= c.b) ? uF2 : (c.g >= c.b ? uB2 : uG2);
          vec3 hot = (c.r >= c.g && c.r >= c.b) ? uF4 : (c.g >= c.b ? uB4 : uG4);
          col = a > 0.86 ? hot : a > 0.55 ? acc : a > 0.35 ? mix(uM0, acc, h2) : a > 0.2 ? mix(uM0, acc, h1) : uM0;
        } else {
          float lum = pow(c.r, 1.0 / 2.2);
          float v = lum > 0.5 ? 1.0 : lum > 0.36 ? h3 : lum > 0.24 ? h2 : lum > 0.14 ? h1 : 0.0;
          col = mix(uM0, uM5, v);
        }
      }
    }
    // depth edges, in the opposite tone; dark-side rims fade out with distance
    vec2 px = 1.0 / uRes;
    float zl = viewZ(vUv - vec2(px.x, 0.0)), zr = viewZ(vUv + vec2(px.x, 0.0));
    float zd = viewZ(vUv - vec2(0.0, px.y)), zu = viewZ(vUv + vec2(0.0, px.y));
    float zmin = min(min(zl, zr), min(zd, zu));
    float e = max(abs(zl - zr), abs(zu - zd)) / max(z, 0.001);
    if (e > 0.18 && z <= zmin + 0.02 && z < uEdgeFar) {
      float bright = dot(col, vec3(0.299, 0.587, 0.114));
      if (bright > 0.3) col = uM0;
      else {
        float fade = 1.0 - smoothstep(uEdgeFar * 0.35, uEdgeFar, z);
        if (b < fade * 0.9) col = uRimC;
      }
    }
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }`;

export class DreadPass {
  constructor(renderer) {
    this.renderer = renderer;
    this.rt = new THREE.WebGLRenderTarget(4, 4, {
      type: THREE.HalfFloatType, depthTexture: new THREE.DepthTexture(4, 4),
      minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter,
    });
    const u = {
      tColor: { value: this.rt.texture }, tDepth: { value: this.rt.depthTexture },
      uRes: { value: new THREE.Vector2(4, 4) }, uTime: { value: 0 }, uMode: { value: 2 }, uGamma: { value: 1 },
      uSpread: { value: 0.16 }, uNear: { value: 0.05 }, uFar: { value: 200 }, uEdgeFar: { value: 16 },
      uRimC: { value: new THREE.Color() },
      uPal: { value: Array.from({ length: MAXPAL }, () => new THREE.Vector3()) }, uPalN: { value: 1 },
    };
    for (let i = 0; i < 6; i++) u['uM' + i] = { value: new THREE.Color() };
    for (const k of ['uF', 'uB', 'uG']) for (let i = 0; i < 5; i++) u[k + i] = { value: new THREE.Color() };
    this.uniforms = u;
    this.mat = new THREE.ShaderMaterial({
      uniforms: u, depthTest: false, depthWrite: false,
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: FRAG,
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat);
    this.quad.frustumCulled = false;
    this.scene = new THREE.Scene(); this.scene.add(this.quad);
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }

  setSize(w, h) {
    this.rt.setSize(w, h);
    this.uniforms.uRes.value.set(w, h);
  }

  setStyle(s) {
    const u = this.uniforms;
    roleUniform.value = s.roles ? 1 : 0;
    u.uMode.value = s.mode; u.uGamma.value = s.gamma; u.uSpread.value = s.spread ?? 0.16;
    u.uRimC.value.set(s.rim);
    s.mono.forEach((c, i) => u['uM' + i].value.set(c));
    for (const [k, key] of [['uF', 'fire'], ['uB', 'blood'], ['uG', 'gold']]) (s[key] || s.mono).slice(0, 5).forEach((c, i) => u[k + i].value.set(c));
    // the palette is matched in gamma space, so it is stored as raw sRGB triples
    const pal = s.palette || [];
    pal.forEach((hex, i) => { const n = parseInt(hex.slice(1), 16); u.uPal.value[i].set((n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255); });
    u.uPalN.value = pal.length;
  }

  render(scene, camera, t = 0) {
    const r = this.renderer, u = this.uniforms;
    u.uTime.value = t; u.uNear.value = camera.near; u.uFar.value = camera.far;
    r.setRenderTarget(this.rt); r.render(scene, camera);
    r.setRenderTarget(null); r.render(this.scene, this.cam);
  }
}
