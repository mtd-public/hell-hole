// Hell Hole: boot, loop and glue. The sim (js/sim) owns the rules; this file feeds it input in
// fixed 1/120 s steps, turns its events into sound, effects and HUD, and draws the frame through
// the Dread pass. window.GAME is a debug handle for tools/smoke.mjs.
import * as THREE from 'three';
import { DreadPass, STYLES, dreadify } from './render/dread.js';
import { LevelView } from './render/level-view.js';
import { Actors, Fx } from './render/actors.js';
import { Viewmodel } from './render/viewmodel.js';
import { createWorld, step } from './sim/world.js';
import { DEPTHS } from './sim/levels.js';
import { TUNING as T } from './sim/tuning.js';
import { Input } from './input/input.js';
import { Audio } from './audio/audio.js';
import { Hud } from './ui/hud.js';

const STEP = 1 / 120;
const $ = (id) => document.getElementById(id);
const Q = new URLSearchParams(location.search);

// ---------------------------------------------------------------- settings (saved, URL wins)
const KEY = 'hell-hole.settings';
const DEFAULTS = { style: 'dagger', lines: 360, sens: 1, invert: false, shadows: false, muted: false, bright: 1.8 };
function loadSettings() {
  let s = { ...DEFAULTS };
  try { Object.assign(s, JSON.parse(localStorage.getItem(KEY)) || {}); } catch (_) { /* private mode */ }
  if (STYLES[Q.get('style')]) s.style = Q.get('style');
  if (+Q.get('lines')) s.lines = +Q.get('lines');
  if (Q.get('shadows')) s.shadows = Q.get('shadows') === '1';
  if (!STYLES[s.style]) s.style = 'dagger';
  return s;
}
const settings = loadSettings();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch (_) { /* ignore */ } };
const touch = matchMedia('(pointer: coarse)').matches && !Q.get('desktop');
if (touch && !Q.get('shadows')) settings.shadows = false; // phones: no cube shadow maps

// ---------------------------------------------------------------- renderer
const canvas = $('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: !!Q.get('capture') });
renderer.setPixelRatio(1);
renderer.shadowMap.enabled = settings.shadows; renderer.shadowMap.type = THREE.BasicShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const pass = new DreadPass(renderer);
pass.setStyle(STYLES[settings.style]); pass.uniforms.uEdgeFar.value = 18; pass.uniforms.uExposure.value = settings.bright;

const input = new Input(canvas);
input.opts.mouseSens = settings.sens; input.opts.invertY = settings.invert; input.touchOn = touch;
const audio = new Audio(); audio.setMuted(settings.muted);
const hud = new Hud();

let scene, camera, world, level, actors, fx, vm;
let state = 'title', t = 0, acc = 0, last = performance.now(), shake = 0, bobPh = 0, depth = 0;

function dispose(root) { root?.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }

function build(d = 0) {
  dispose(scene);
  depth = d;
  scene = new THREE.Scene(); scene.background = new THREE.Color(0x000000);
  scene.fog = new THREE.FogExp2(0x000000, 0.04);
  scene.add(new THREE.HemisphereLight(0x1a2448, 0x140a04, 0.08)); // the faintest bounce: the dark leans blue, never grey
  camera = new THREE.PerspectiveCamera(70, 16 / 9, 0.03, 120); camera.rotation.order = 'YXZ'; scene.add(camera);
  world = createWorld(d, { seed: (Math.random() * 1e9) | 0 });
  level = new LevelView(scene, world.L, { shadows: settings.shadows });
  actors = new Actors(scene); fx = new Fx(scene); vm = new Viewmodel(camera);
  dreadify(scene);
  resize();
  $('h-depth').textContent = DEPTHS[d].name.toUpperCase();
}

function resize() {
  const ar = innerWidth / Math.max(1, innerHeight);
  const H = settings.lines, W = Math.max(2, Math.round(H * ar));
  renderer.setSize(W, H, false); pass.setSize(W, H);
  if (camera) { camera.aspect = W / H; camera.fov = ar < 1.3 ? 84 : 70; camera.updateProjectionMatrix(); }
}
addEventListener('resize', resize);

// ---------------------------------------------------------------- screens
const screens = ['s-title', 's-settings', 's-pause', 's-end'];
function showScreen(id) { for (const s of screens) $(s).hidden = s !== id; }
let settingsBack = 's-title';

function start() {
  audio.unlock(); audio.startAmbience();
  if (state === 'end' || state === 'title' && world.t > 0) build(depth);
  state = 'play'; input.enabled = true; showScreen(null); hud.show(true);
  $('touch').hidden = !touch;
  if (!touch) input.requestLock();
  if (touch) try { window.TouchZoomGuard?.enterFullscreen('landscape'); } catch (_) { /* optional */ }
  hud.toast(DEPTHS[depth].title.toUpperCase(), 2.6);
}
function pause() {
  if (state !== 'play') return;
  state = 'pause'; input.enabled = false; input.reset(); input.releaseLock();
  showScreen('s-pause');
}
function resume() { state = 'play'; input.enabled = true; showScreen(null); if (!touch) input.requestLock(); }
function end() {
  state = 'end'; input.enabled = false; input.reset(); input.releaseLock();
  const s = world.stats, won = world.state === 'clear';
  $('e-eyebrow').textContent = `${DEPTHS[depth].name} · ${DEPTHS[depth].title}`;
  $('e-title').textContent = won ? `${DEPTHS[depth].name} cleared` : 'You died';
  $('e-blurb').textContent = won
    ? 'The scarab door opens onto a stair going down into the dark. Depth II is still being dug.'
    : (world.events.find((e) => e.type === 'death')?.from === 'scarab' ? 'The scarabs took you down to the floor, and then into it.' : 'The tomb keeps what comes into it.');
  const acc = s.shots ? Math.round((s.hits / s.shots) * 100) : 0;
  $('e-stats').innerHTML = [
    ['Time', `${(s.time ?? world.t).toFixed(1)} s`], ['Slain', `${s.kills}`], ['Heart shots', `${s.hearts}`],
    ['Accuracy', `${acc}%`], ['Damage taken', `${Math.round(s.taken)}`],
  ].map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
  $('b-again').textContent = won ? 'Descend again' : 'Try again';
  hud.show(false); $('touch').hidden = true;
  showScreen('s-end');
}

$('b-start').addEventListener('click', start);
$('b-again').addEventListener('click', () => { build(depth); start(); });
$('b-resume').addEventListener('click', resume);
$('b-restart').addEventListener('click', () => { build(depth); start(); });
$('b-settings').addEventListener('click', () => { settingsBack = 's-title'; openSettings(); });
$('b-pause-settings').addEventListener('click', () => { settingsBack = 's-pause'; openSettings(); });
$('b-settings-done').addEventListener('click', () => showScreen(settingsBack));
$('b-mute').addEventListener('click', () => { settings.muted = !settings.muted; audio.setMuted(settings.muted); save(); muteLabel(); });
const muteLabel = () => { $('b-mute').textContent = `Sound: ${settings.muted ? 'off' : 'on'}`; };
muteLabel();

function openSettings() {
  $('o-style').value = settings.style; $('o-lines').value = String(settings.lines);
  $('o-bright').value = String(settings.bright); $('o-sens').value = String(settings.sens); $('o-invert').checked = settings.invert; $('o-shadows').checked = settings.shadows;
  showScreen('s-settings');
}
$('o-style').addEventListener('change', (e) => { settings.style = e.target.value; pass.setStyle(STYLES[settings.style]); save(); });
$('o-lines').addEventListener('change', (e) => { settings.lines = +e.target.value; resize(); save(); });
$('o-bright').addEventListener('input', (e) => { settings.bright = +e.target.value; pass.uniforms.uExposure.value = settings.bright; save(); });
$('o-sens').addEventListener('input', (e) => { settings.sens = +e.target.value; input.opts.mouseSens = settings.sens; save(); });
$('o-invert').addEventListener('change', (e) => { settings.invert = e.target.checked; input.opts.invertY = settings.invert; save(); });
$('o-shadows').addEventListener('change', (e) => {
  settings.shadows = e.target.checked; renderer.shadowMap.enabled = settings.shadows;
  level.pool.slice(0, 2).forEach((l) => { l.castShadow = settings.shadows; if (settings.shadows) { l.shadow.mapSize.set(256, 256); l.shadow.bias = -0.002; l.shadow.normalBias = 0.06; } });
  save();
});

input.onPause = () => pause();
input.onKey = (k) => {
  if ((k === 'p' || k === 'escape') && state === 'play') { pause(); return true; }
  if (k === 'p' && state === 'pause') { resume(); return true; }
  if (k === 'm') { settings.muted = !settings.muted; audio.setMuted(settings.muted); save(); muteLabel(); return true; }
  if ((k === 'enter' || k === ' ') && state === 'title' && $('s-settings').hidden) { start(); return true; }
  return false;
};
canvas.addEventListener('click', () => { if (state === 'play' && !touch && !input.locked) input.requestLock(); });

if (touch) {
  document.body.classList.add('touch');
  input.bindTouch($('t-zone'));
  for (const [id, name] of [['t-fire-l', 'fireL'], ['t-fire-r', 'fireR'], ['t-jump', 'jump'], ['t-reload', 'reload'], ['t-grenade', 'grenade'], ['t-swap', 'swap']]) input.bindButton($(id), name);
  $('t-pause').addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); pause(); });
}
try { window.TouchZoomGuard?.init({ allowSelector: '[data-touch-allow]', onZoomChange: (z) => { if (z) pause(); } }); } catch (_) { /* optional */ }

// ---------------------------------------------------------------- events → sound, effects, HUD
const PICKUP = {
  ammo: `+${T.pickup.ammo}  .45 ACP`, shells: `+${T.pickup.shells}  12 GAUGE`,
  grenades: 'MK 2 GRENADES · A 1940s CRATE', shotgun: "YOUR SQUAD'S 870. THEY WON'T NEED IT NOW",
};
function handleEvents() {
  const p = world.player;
  for (const e of world.events) {
    audio.event(e); vm.event(e);
    switch (e.type) {
      case 'hit':
        if (e.kind === 'scarab') fx.burst('chitin', e.x, e.y, e.z, 6, { speed: 2.5, size: 0.04, life: 0.6 });
        else if (e.heart) { fx.burst('gore', e.x, e.y, e.z, 18, { speed: 3.2, size: 0.05, life: 0.8 }); fx.burst('spark', e.x, e.y, e.z, 6, { speed: 3, size: 0.03, life: 0.25 }); }
        else { fx.burst('dust', e.x, e.y, e.z, 7, { speed: 1.6, size: 0.06, life: 0.7, up: 0.6 }); actors.hit(e.id); }
        if (!e.quiet || e.heart) hud.hitMarker(e.heart);
        break;
      case 'impact':
        fx.burst('spark', e.x + e.nx * 0.05, e.y + e.ny * 0.05, e.z + e.nz * 0.05, e.quiet ? 2 : 5, { speed: 3, size: 0.03, life: 0.25, dir: [e.nx, e.ny, e.nz] });
        fx.burst('dust', e.x + e.nx * 0.05, e.y + e.ny * 0.05, e.z + e.nz * 0.05, 2, { speed: 0.8, size: 0.05, life: 0.6, dir: [e.nx, e.ny, e.nz] });
        break;
      case 'kill':
        if (e.kind === 'mummy') fx.burst('dust', e.x, 1.0, e.z, 22, { speed: 1.4, size: 0.09, life: 1.3, up: 0.8 });
        else fx.burst('chitin', e.x, 0.1, e.z, 8, { speed: 2, size: 0.05, life: 0.7, up: 1.5 });
        break;
      case 'explode': {
        fx.explosion(e.x, e.y, e.z, camera); dreadify(scene);
        const d = Math.hypot(e.x - p.x, e.z - p.z); shake = Math.max(shake, Math.max(0, 0.6 - d * 0.04)); input.rumble(0.9, 0.6, 260);
        break;
      }
      case 'hurt': hud.hurt(e.amount); shake = Math.max(shake, 0.12); input.rumble(0.5, 0.4, 110); break;
      case 'shot': shake = Math.max(shake, e.gun === 'S' ? 0.08 : 0.025); input.rumble(e.gun === 'S' ? 0.5 : 0.12, 0.3, 60); break;
      case 'pickup': hud.toast(PICKUP[e.kind]); break;
      case 'nest': hud.toast('THE FLOOR IS MOVING', 1.6); break;
      case 'shrineSpent': hud.toast('THE ANKH GOES DARK', 1.6); break;
      default: break;
    }
  }
  world.events.length = 0;
}

// ---------------------------------------------------------------- loop
function updateCamera(dt) {
  const p = world.player;
  if (state === 'title') {
    camera.position.set(p.x, T.player.eye, p.z);
    camera.rotation.set(0.05 + Math.sin(t * 0.21) * 0.06, p.yaw + Math.sin(t * 0.13) * 0.35, 0);
    vm.root.visible = false;
    return;
  }
  vm.root.visible = true;
  const look = state === 'play' ? input.peekLook() : { yaw: 0, pitch: 0 };
  const moving = p.onGround ? p.moving : 0;
  bobPh += dt * 9.5 * moving;
  shake = Math.max(0, shake - dt * 1.6);
  const sx = (Math.random() - 0.5) * shake * 0.12, sy = (Math.random() - 0.5) * shake * 0.12;
  camera.position.set(p.x, p.y + T.player.eye + Math.sin(bobPh * 2) * 0.03 * moving, p.z);
  camera.rotation.set(Math.max(-1.45, Math.min(1.45, p.pitch + look.pitch)) + sy, p.yaw + look.yaw + sx, Math.sin(bobPh) * 0.006 * moving);
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.max(0, Math.min((now - last) / 1000, 1 / 15)); // clamp at both ends
  last = now; t += dt;
  const pad = input.pollPad(dt);
  if (state === 'play') {
    if (pad.start) pause();
    acc += dt; let n = 0;
    while (acc >= STEP && n < 10) { step(world, input.control(STEP), STEP); acc -= STEP; n++; }
    if (acc >= STEP) acc = 0;
    handleEvents();
    if (world.state !== 'play') end();
  } else {
    world.events.length = 0;
    if (pad.a || pad.start) { if (state === 'title' && $('s-settings').hidden) start(); else if (state === 'pause') resume(); else if (state === 'end') { build(depth); start(); } }
  }
  updateCamera(dt);
  level.update(world, t, camera.position.x, camera.position.z);
  actors.update(world, t, dt); fx.update(dt, camera);
  vm.update(world, dt, state === 'play' ? input.peekLook() : null);
  pass.render(scene, camera, t);
  if (state === 'play') hud.update(world, dt);
  if (touch) {
    const s = input.stick, el = $('t-stick');
    el.classList.toggle('on', s.active);
    if (s.active) { el.style.left = `${s.bx}px`; el.style.top = `${s.by}px`; $('t-knob').style.transform = `translate(${s.x * 40}px, ${s.y * 40}px)`; }
  }
}

build(0);
showScreen('s-title');
requestAnimationFrame(frame);
if (Q.get('autostart')) start();

window.GAME = {
  get world() { return world; }, get state() { return state; }, input, hud, settings, start, pause, resume,
  step: (c, secs = 1) => { for (let k = 0; k < secs / STEP; k++) step(world, { mx: 0, my: 0, yaw: 0, pitch: 0, ...c }, STEP); },
};
