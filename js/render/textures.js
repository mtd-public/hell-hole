import * as THREE from 'three';

// Procedural canvas textures: small, point-sampled, no mipmaps (the PS1 texel, after dr-mow).
// The post pass only reads their brightness, so they are drawn in values, not colours.

export function rng(seed = 1) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

function canvas(w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

function tex(c, repeat = true) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

const grey = (v) => `rgb(${v | 0},${v | 0},${v | 0})`;

function speckle(g, w, h, r, base, amp, n) {
  for (let i = 0; i < n; i++) {
    const v = base + (r() - 0.5) * amp;
    g.fillStyle = grey(v);
    g.fillRect((r() * w) | 0, (r() * h) | 0, 1 + ((r() * 2) | 0), 1);
  }
}

// ---- hieroglyphs: each draws into a unit cell (0..1) with the given transform ----------
// Kept to signs anyone recognises from tomb walls: ankh, wedjat eye, vulture, reed, water,
// horned viper, sun disk, scarab, feather of Ma'at, djed pillar, was sceptre, loaf, hand.
const GLYPHS = [
  (g) => { g.beginPath(); g.ellipse(0.5, 0.24, 0.16, 0.18, 0, 0, Math.PI * 2); g.moveTo(0.5, 0.42); g.lineTo(0.5, 0.95); g.moveTo(0.2, 0.46); g.lineTo(0.8, 0.46); g.stroke(); }, // ankh
  (g) => { g.beginPath(); g.ellipse(0.5, 0.4, 0.3, 0.13, 0, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.arc(0.5, 0.4, 0.07, 0, 7); g.fill(); g.beginPath(); g.moveTo(0.2, 0.28); g.lineTo(0.85, 0.22); g.moveTo(0.42, 0.53); g.lineTo(0.38, 0.85); g.moveTo(0.55, 0.53); g.quadraticCurveTo(0.8, 0.9, 0.6, 0.85); g.stroke(); }, // wedjat
  (g) => { g.beginPath(); g.moveTo(0.25, 0.3); g.quadraticCurveTo(0.35, 0.15, 0.45, 0.3); g.lineTo(0.8, 0.55); g.lineTo(0.85, 0.75); g.lineTo(0.35, 0.7); g.closePath(); g.fill(); g.beginPath(); g.moveTo(0.45, 0.7); g.lineTo(0.42, 0.92); g.moveTo(0.58, 0.72); g.lineTo(0.6, 0.92); g.stroke(); }, // vulture
  (g) => { g.beginPath(); g.moveTo(0.5, 0.95); g.quadraticCurveTo(0.35, 0.5, 0.5, 0.05); g.quadraticCurveTo(0.65, 0.5, 0.5, 0.95); g.fill(); }, // reed
  (g) => { g.beginPath(); g.moveTo(0.05, 0.5); for (let k = 0; k < 6; k++) g.lineTo(0.12 + k * 0.16, k % 2 ? 0.42 : 0.58); g.stroke(); g.beginPath(); g.moveTo(0.05, 0.7); for (let k = 0; k < 6; k++) g.lineTo(0.12 + k * 0.16, k % 2 ? 0.62 : 0.78); g.stroke(); }, // water
  (g) => { g.beginPath(); g.moveTo(0.1, 0.75); g.bezierCurveTo(0.4, 0.95, 0.5, 0.5, 0.8, 0.7); g.lineTo(0.85, 0.5); g.moveTo(0.78, 0.55); g.lineTo(0.72, 0.4); g.moveTo(0.86, 0.52); g.lineTo(0.9, 0.38); g.stroke(); }, // horned viper
  (g) => { g.beginPath(); g.arc(0.5, 0.42, 0.13, 0, 7); g.fill(); g.beginPath(); g.moveTo(0.2, 0.62); g.lineTo(0.8, 0.62); g.stroke(); }, // sun on the horizon
  (g) => { g.beginPath(); g.ellipse(0.5, 0.55, 0.2, 0.28, 0, 0, 7); g.fill(); g.beginPath(); g.arc(0.5, 0.22, 0.1, 0, 7); g.fill(); g.beginPath(); for (const s of [-1, 1]) { g.moveTo(0.5 + s * 0.18, 0.45); g.lineTo(0.5 + s * 0.4, 0.32); g.moveTo(0.5 + s * 0.2, 0.62); g.lineTo(0.5 + s * 0.42, 0.62); g.moveTo(0.5 + s * 0.16, 0.78); g.lineTo(0.5 + s * 0.36, 0.95); } g.stroke(); }, // scarab
  (g) => { g.beginPath(); g.moveTo(0.48, 0.95); g.quadraticCurveTo(0.3, 0.4, 0.52, 0.05); g.quadraticCurveTo(0.72, 0.4, 0.56, 0.95); g.fill(); }, // feather
  (g) => { g.fillRect(0.4, 0.3, 0.2, 0.65); for (let k = 0; k < 4; k++) g.fillRect(0.22, 0.08 + k * 0.08, 0.56, 0.045); }, // djed
  (g) => { g.beginPath(); g.moveTo(0.5, 0.95); g.lineTo(0.5, 0.18); g.lineTo(0.68, 0.1); g.moveTo(0.5, 0.95); g.lineTo(0.42, 0.88); g.lineTo(0.58, 0.85); g.stroke(); }, // was sceptre
  (g) => { g.beginPath(); g.ellipse(0.5, 0.62, 0.36, 0.16, 0, Math.PI, 0); g.fill(); }, // loaf
  (g) => { g.fillRect(0.12, 0.5, 0.6, 0.12); g.fillRect(0.6, 0.38, 0.12, 0.24); g.fillRect(0.72, 0.48, 0.16, 0.06); }, // hand
];

// Tomb paint: the five pigments the scribes had (lapis, turquoise, red ochre, carbon black,
// yellow ochre). The post pass snaps to a palette built round the same inks.
export const PAINT = ['#2e56a8', '#2e9a7a', '#b83a1e', '#20140c', '#d09a30'];

// Glowing glyphs: the old spells still burn in turquoise and lapis. Only the signs that mean
// something ever light (ankh, wedjat eye, scarab) and only a few of those, so a lit sign is
// an event. Colour only (the glow canvas is black elsewhere); it drives the emissiveMap.
export const GLOW_KINDS = [0, 1, 7];
export const GLYPH_GLOW = ['#46e0bc', '#46e0bc', '#5a8ce8', '#46e0bc', '#8af0d8'];

// A glyph carved into stone: a dark sunken cut with a lit upper-left lip, painted if paint.
// glow: [ctx, colour] also draws it into the emissive canvas.
function carve(g, kind, x, y, s, dark, lip, paint, glow) {
  const draw = (dx, dy, col) => {
    g.save(); g.translate(x + dx, y + dy); g.scale(s, s);
    g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 1.6 / s * (s > 20 ? 1.3 : 1);
    GLYPHS[kind % GLYPHS.length](g);
    g.restore();
  };
  draw(-1, -1, lip);
  draw(0, 0, dark);
  if (paint) draw(0.5, 0.5, paint);
  if (glow) {
    const [gc, col] = glow;
    gc.save(); gc.translate(x + 0.5, y + 0.5); gc.scale(s, s);
    gc.strokeStyle = col; gc.fillStyle = col; gc.lineWidth = 1.6 / s * (s > 20 ? 1.3 : 1);
    GLYPHS[kind % GLYPHS.length](gc); gc.restore();
  }
}

// Sandstone in courses. glyphs: vertical registers of carved signs.
const tint = (v, [r, g, b]) => `rgb(${(v * r) | 0},${(v * g) | 0},${(v * b) | 0})`;
const SANDSTONE = [1.0, 0.86, 0.64];

export function stoneWall({ seed = 3, glyphs = true, size = 128, base = 104, paint = true, lit = 0.3 } = {}) {
  const r = rng(seed); const [c, g] = canvas(size, size);
  const [gcv, gc] = canvas(size, size); gc.fillStyle = '#000'; gc.fillRect(0, 0, size, size);
  g.fillStyle = tint(base, SANDSTONE); g.fillRect(0, 0, size, size);
  for (let i = 0; i < size * size * 0.5; i++) {
    g.fillStyle = tint(base + (r() - 0.5) * 70, SANDSTONE); g.fillRect((r() * size) | 0, (r() * size) | 0, 1 + ((r() * 2) | 0), 1);
  }
  const rowH = size / 4;
  for (let row = 0; row < 4; row++) {
    const y = row * rowH, off = (row % 2) * size / 4;
    g.fillStyle = grey(base * 0.35); g.fillRect(0, y, size, 1);
    g.fillStyle = grey(Math.min(255, base * 1.2)); g.fillRect(0, y + 1, size, 1);
    for (let x = off; x < size + off; x += size / 2) { g.fillStyle = grey(base * 0.35); g.fillRect(x % size, y, 1, rowH); }
    // block-to-block tone drift
    for (let x = off; x < size + off; x += size / 2) { g.fillStyle = `rgba(0,0,0,${r() * 0.18})`; g.fillRect((x % size) + 1, y + 2, size / 2 - 2, rowH - 2); }
  }
  // cracks
  for (let k = 0; k < 5; k++) {
    let x = r() * size, y = r() * size; g.strokeStyle = grey(base * 0.3); g.lineWidth = 1; g.beginPath(); g.moveTo(x, y);
    for (let s = 0; s < 6; s++) { x += (r() - 0.5) * 10; y += r() * 7; g.lineTo(x, y); } g.stroke();
  }
  if (glyphs) {
    const cols = 4, cw = size / cols, gs = cw * 0.62;
    for (let i = 0; i < cols; i++) {
      g.fillStyle = grey(base * 0.4); g.fillRect(i * cw, 0, 1, size); // register dividers, carved
      for (let j = 0; j < 5; j++) {
        if (r() < 0.12) continue;
        const p = paint && r() < 0.8 ? PAINT[(r() * 4) | 0] : null;
        const kind = (r() * GLYPHS.length) | 0;
        const glow = GLOW_KINDS.includes(kind) && r() < lit ? [gc, GLYPH_GLOW[(r() * GLYPH_GLOW.length) | 0]] : null;
        carve(g, kind, i * cw + (cw - gs) / 2, j * (size / 5) + 3, gs, grey(base * 0.28), tint(Math.min(255, base * 1.35), SANDSTONE), p, glow);
      }
    }
  }
  // paint flaked away in patches: three thousand years of damp
  for (let k = 0; k < 6; k++) { g.fillStyle = `rgba(140,118,84,${0.25 + r() * 0.3})`; g.beginPath(); g.ellipse(r() * size, r() * size, 4 + r() * 12, 3 + r() * 8, r() * 3, 0, 7); g.fill(); }
  const t = tex(c); t.userData.glow = tex(gcv);
  return t;
}

export function floorStone({ seed = 7, size = 128, base = 92 } = {}) {
  const r = rng(seed); const [c, g] = canvas(size, size);
  g.fillStyle = tint(base, SANDSTONE); g.fillRect(0, 0, size, size);
  for (let i = 0; i < size * size * 0.6; i++) {
    g.fillStyle = tint(base + (r() - 0.5) * 60, SANDSTONE); g.fillRect((r() * size) | 0, (r() * size) | 0, 1 + ((r() * 2) | 0), 1);
  }
  const n = 2, s = size / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    g.fillStyle = `rgba(0,0,0,${r() * 0.22})`; g.fillRect(i * s + 1, j * s + 1, s - 2, s - 2);
    g.fillStyle = grey(base * 0.3); g.fillRect(i * s, j * s, s, 1); g.fillRect(i * s, j * s, 1, s);
  }
  // drifted sand
  for (let k = 0; k < 300; k++) { g.fillStyle = `rgba(255,240,210,${0.05 + r() * 0.08})`; const x = r() * size, y = r() * size; g.fillRect(x, y, 2 + r() * 6, 1); }
  return tex(c);
}

export function roughStone({ seed = 11, size = 64, base = 80 } = {}) {
  const r = rng(seed); const [c, g] = canvas(size, size);
  g.fillStyle = grey(base); g.fillRect(0, 0, size, size);
  speckle(g, size, size, r, base, 80, size * size);
  return tex(c);
}

// Linen wrappings: diagonal overlapping bands with frayed edges and stains.
export function wraps({ seed = 5, size = 64 } = {}) {
  const r = rng(seed); const [c, g] = canvas(size, size);
  g.fillStyle = grey(170); g.fillRect(0, 0, size, size);
  for (let y = -size; y < size * 2; y += 5 + ((r() * 4) | 0)) {
    g.strokeStyle = grey(70 + r() * 40); g.lineWidth = 1;
    g.beginPath(); g.moveTo(0, y); g.lineTo(size, y + size * 0.35); g.stroke();
    g.strokeStyle = grey(200 + r() * 40); g.beginPath(); g.moveTo(0, y + 1); g.lineTo(size, y + 1 + size * 0.35); g.stroke();
  }
  speckle(g, size, size, r, 140, 120, size * size * 0.3);
  for (let k = 0; k < 6; k++) { g.fillStyle = `rgba(20,10,0,${0.2 + r() * 0.3})`; g.beginPath(); g.ellipse(r() * size, r() * size, 3 + r() * 8, 2 + r() * 5, r() * 3, 0, 7); g.fill(); }
  return tex(c);
}

// Papyrus column: horizontal bands top and bottom, a register of glyphs between.
export function columnTex({ seed = 13, w = 64, h = 128, base = 118 } = {}) {
  const r = rng(seed); const [c, g] = canvas(w, h);
  const [gcv, gc] = canvas(w, h); gc.fillStyle = '#000'; gc.fillRect(0, 0, w, h);
  g.fillStyle = grey(base); g.fillRect(0, 0, w, h);
  speckle(g, w, h, r, base, 60, w * h * 0.5);
  for (let k = 0; k < 4; k++) { g.fillStyle = PAINT[[0, 2, 1, 4][k]]; g.fillRect(0, 4 + k * 3, w, 2); g.fillRect(0, h - 14 + k * 3, w, 2); }
  for (let j = 0; j < 5; j++) for (let i = 0; i < 3; i++) {
    const kind = (r() * GLYPHS.length) | 0;
    carve(g, kind, 3 + i * 21, 20 + j * 19, 14, grey(base * 0.3), grey(Math.min(255, base * 1.3)), PAINT[(i + j) % 4],
      GLOW_KINDS.includes(kind) && r() < 0.3 ? [gc, GLYPH_GLOW[(r() * GLYPH_GLOW.length) | 0]] : null);
  }
  const t = tex(c); t.userData.glow = tex(gcv);
  return t;
}

// Checkered walnut for the 1911 grip panels.
export function checker({ size = 16 } = {}) {
  const [c, g] = canvas(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) { g.fillStyle = grey(((x + y) % 2) ? 110 : 60); g.fillRect(x, y, 1, 1); }
  return tex(c);
}

// Hide: dark skin with faint mottling (jackals, the Devourer).
export function hide({ seed = 17, size = 64, base = 150 } = {}) {
  const r = rng(seed); const [c, g] = canvas(size, size);
  g.fillStyle = grey(base); g.fillRect(0, 0, size, size);
  speckle(g, size, size, r, base, 50, size * size * 0.7);
  for (let k = 0; k < 20; k++) { g.fillStyle = `rgba(0,0,0,${0.15 + r() * 0.2})`; g.beginPath(); g.ellipse(r() * size, r() * size, 2 + r() * 5, 1 + r() * 3, r() * 3, 0, 7); g.fill(); }
  return tex(c);
}

// Scales: rows of overlapping scutes (crocodile head, Apep).
export function scales({ size = 64, base = 150 } = {}) {
  const [c, g] = canvas(size, size);
  g.fillStyle = grey(base * 0.5); g.fillRect(0, 0, size, size);
  for (let y = 0; y < size + 8; y += 6) for (let x = (y / 6) % 2 ? 0 : 4; x < size + 8; x += 8) {
    g.fillStyle = grey(base); g.beginPath(); g.ellipse(x, y, 4, 3.4, 0, 0, Math.PI); g.fill();
    g.fillStyle = grey(base * 1.4); g.fillRect(x - 2, y + 1, 3, 1);
  }
  return tex(c);
}

// The kheker frieze that crowns a painted wall: bundled reeds in alternating pigments.
export function frieze({ w = 64, h = 16 } = {}) {
  const [c, g] = canvas(w, h);
  g.fillStyle = '#c49a5a'; g.fillRect(0, 0, w, h);
  for (let x = 0; x < w; x += 8) {
    g.fillStyle = PAINT[(x / 8) % 3]; g.fillRect(x + 1, 3, 6, h - 6);
    g.fillStyle = '#20140c'; g.fillRect(x + 2, 1, 4, 3); g.fillRect(x + 3, h - 6, 2, 2);
  }
  g.fillStyle = PAINT[0]; g.fillRect(0, h - 2, w, 2); g.fillStyle = PAINT[2]; g.fillRect(0, 0, w, 1);
  return tex(c);
}

// The ceiling of Nut: lapis night with yellow five-pointed stars in a grid.
export function nightSky({ seed = 19, size = 64 } = {}) {
  const r = rng(seed); const [c, g] = canvas(size, size);
  g.fillStyle = '#16245a'; g.fillRect(0, 0, size, size);
  for (let i = 0; i < size * size * 0.3; i++) { g.fillStyle = `rgba(0,0,20,${r() * 0.4})`; g.fillRect((r() * size) | 0, (r() * size) | 0, 1, 1); }
  for (let y = 4; y < size; y += 16) for (let x = (y / 16) % 2 ? 12 : 4; x < size; x += 16) {
    g.fillStyle = '#e8b840'; g.fillRect(x - 3, y, 7, 1); g.fillRect(x, y - 3, 1, 7); g.fillRect(x - 1, y - 1, 3, 3);
  }
  return tex(c);
}

// Egyptian wing feathers: rows of rounded feathers in lapis, turquoise and red.
export function feathers({ w = 32, h = 64 } = {}) {
  const [c, g] = canvas(w, h);
  const rows = [PAINT[0], PAINT[1], PAINT[2], PAINT[0], PAINT[1]];
  rows.forEach((col, k) => {
    for (let x = 0; x < w; x += 6) {
      g.fillStyle = col; g.fillRect(x, k * (h / rows.length), 5, h / rows.length - 1);
      g.fillStyle = '#20140c'; g.fillRect(x + 5, k * (h / rows.length), 1, h / rows.length);
    }
    g.fillStyle = '#e8d8b0'; g.fillRect(0, (k + 1) * (h / rows.length) - 2, w, 1);
  });
  return tex(c);
}

// A torch flame card: teardrop layers from ember to white-hot, cut out with alpha.
export function flameTex(seed = 1, w = 32, h = 64) {
  const r = rng(seed); const [c, g] = canvas(w, h);
  const drop = (cx, by, rw, top, col) => {
    g.fillStyle = col; g.beginPath(); g.moveTo(cx - rw, by);
    g.bezierCurveTo(cx - rw * 1.1, by - (by - top) * 0.45, cx - rw * 0.2 + (r() - 0.5) * 4, top + (by - top) * 0.25, cx + (r() - 0.5) * 5, top);
    g.bezierCurveTo(cx + rw * 0.3 + (r() - 0.5) * 4, top + (by - top) * 0.3, cx + rw * 1.1, by - (by - top) * 0.45, cx + rw, by);
    g.closePath(); g.fill();
  };
  drop(w / 2, h - 2, w * 0.44, 4, '#c8380a');
  for (let k = 0; k < 3; k++) drop(w / 2 + (r() - 0.5) * 10, h - 8 - r() * 10, w * 0.16, 2 + r() * 12, '#c8380a');
  drop(w / 2, h - 3, w * 0.34, 14, '#ff8c1a');
  drop(w / 2, h - 4, w * 0.24, 26, '#ffd048');
  drop(w / 2, h - 5, w * 0.13, 38, '#fff4c0');
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
  return t;
}

// A lone glowing sign on transparent ground, for lintels and shrines (beacons: fog-free).
export function signTex(kind = 7, col = '#46e0bc', size = 32) {
  const [c, g] = canvas(size, size);
  g.save(); g.scale(size, size); g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 2.2 / size;
  GLYPHS[kind % GLYPHS.length](g); g.restore();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
  return t;
}

// The same flame seen from above: a ragged rosette, ember outside, white-hot in the middle.
export function flameTopTex(seed = 1, size = 32) {
  const r = rng(seed); const [c, g] = canvas(size, size);
  const ring = (rad, col, jag) => {
    g.fillStyle = col; g.beginPath();
    for (let k = 0; k <= 14; k++) { const a = k / 14 * Math.PI * 2, rr = rad * (1 - jag + r() * jag * 2); g.lineTo(size / 2 + Math.cos(a) * rr, size / 2 + Math.sin(a) * rr); }
    g.closePath(); g.fill();
  };
  ring(size * 0.46, '#c8380a', 0.35); ring(size * 0.34, '#ff8c1a', 0.3); ring(size * 0.22, '#ffd048', 0.25); ring(size * 0.11, '#fff4c0', 0.2);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
  return t;
}

// A fireball / burst seen face-on: ragged rings from ember to white-hot. pal picks the ramp.
export function burstTex(seed = 1, size = 64, pal = ['#7a1404', '#c8380a', '#ff8c1a', '#ffd048', '#fff4c0']) {
  const r = rng(seed); const [c, g] = canvas(size, size);
  const ring = (rad, col, jag, n = 18) => {
    g.fillStyle = col; g.beginPath();
    for (let k = 0; k <= n; k++) { const a = k / n * Math.PI * 2, rr = rad * (1 - jag + r() * jag * 2); g.lineTo(size / 2 + Math.cos(a) * rr, size / 2 + Math.sin(a) * rr); }
    g.closePath(); g.fill();
  };
  ring(size * 0.48, pal[0], 0.35, 22); ring(size * 0.4, pal[1], 0.3); ring(size * 0.3, pal[2], 0.28); ring(size * 0.19, pal[3], 0.25); ring(size * 0.09, pal[4], 0.2, 10);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
  return t;
}

// A smoke puff: a ragged grey blob with darker lumps.
export function smokeTex(seed = 1, size = 32) {
  const r = rng(seed); const [c, g] = canvas(size, size);
  for (let k = 0; k < 7; k++) {
    g.fillStyle = grey(70 + r() * 70); g.beginPath();
    g.ellipse(size / 2 + (r() - 0.5) * size * 0.4, size / 2 + (r() - 0.5) * size * 0.4, size * (0.16 + r() * 0.14), size * (0.14 + r() * 0.12), r() * 3, 0, 7); g.fill();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
  return t;
}

// The sun beam's cross-section: gold edges, white-hot centre, ragged sides (u across, v along).
export function beamTex(seed = 1, w = 32, h = 64) {
  const r = rng(seed); const [c, g] = canvas(w, h);
  for (let y = 0; y < h; y++) {
    const j = (r() - 0.5) * 3;
    const band = (half, col) => { g.fillStyle = col; g.fillRect(Math.round(w / 2 - half + j), y, Math.round(half * 2), 1); };
    band(w * 0.46 + (r() - 0.5) * 4, '#ffa020'); band(w * 0.34 + (r() - 0.5) * 3, '#ffd048'); band(w * 0.22, '#fff4c0'); band(w * 0.1, '#ffffff');
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
  t.wrapT = THREE.RepeatWrapping;
  return t;
}

// Perforated steel: the trench gun's heat shield.
export function perforated({ w = 32, h = 32 } = {}) {
  const [c, g] = canvas(w, h);
  g.fillStyle = grey(120); g.fillRect(0, 0, w, h);
  for (let y = 2; y < h; y += 6) for (let x = (y / 6) % 2 ? 5 : 2; x < w; x += 6) { g.fillStyle = grey(10); g.fillRect(x, y, 3, 3); }
  return tex(c);
}

// A pineapple grenade's cast segments.
export function pineapple({ size = 32 } = {}) {
  const [c, g] = canvas(size, size);
  g.fillStyle = grey(130); g.fillRect(0, 0, size, size);
  for (let k = 0; k < size; k += 6) { g.fillStyle = grey(40); g.fillRect(k, 0, 1, size); g.fillRect(0, k, size, 1); }
  return tex(c);
}

// M81 woodland: the 1980s BDU. Four-colour blobs (light green, field drab, forest green, black).
export function woodland({ seed = 23, size = 64 } = {}) {
  const r = rng(seed); const [c, g] = canvas(size, size);
  g.fillStyle = '#6e7a4a'; g.fillRect(0, 0, size, size);
  const blobs = (col, n, rmin, rmax) => {
    g.fillStyle = col;
    for (let k = 0; k < n; k++) {
      const x = r() * size, y = r() * size, a = r() * 3;
      for (const [dx, dy] of [[0, 0], [size, 0], [-size, 0], [0, size], [0, -size]]) {
        g.beginPath(); g.ellipse(x + dx, y + dy, rmin + r() * (rmax - rmin), (rmin + r() * (rmax - rmin)) * 0.45, a, 0, 7); g.fill();
      }
    }
  };
  blobs('#5e4630', 9, 6, 13); blobs('#2e3e22', 10, 6, 14); blobs('#121410', 12, 2, 6);
  return tex(c);
}
