// Hell Hole: boot, loop and glue. The sim (js/sim) owns the rules; this file feeds it input in
// fixed 1/120 s steps, turns its events into sound, effects and HUD, and draws the frame through
// the Dread pass. window.GAME is a debug handle for tools/smoke.mjs.
import * as THREE from 'three';
import { DreadPass, STYLES, dreadify } from './render/dread.js';
import { LevelView } from './render/level-view.js';
import { Actors, Fx } from './render/actors.js';
import { Viewmodel } from './render/viewmodel.js';
import { createWorld, step, loadout } from './sim/world.js';
import { DEPTHS } from './sim/levels.js';
import { TUNING as T } from './sim/tuning.js';
import { Input } from './input/input.js';
import { Audio } from './audio/audio.js';
import { Hud } from './ui/hud.js';
import { MenuNav } from './ui/menu-nav.js';

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
const nav = new MenuNav();

// how deep you've been: the title offers every depth you've reached
const PROGRESS = 'hell-hole.progress';
let reached = 0;
try { reached = Math.min(DEPTHS.length - 1, (JSON.parse(localStorage.getItem(PROGRESS)) || {}).reached || 0); } catch (_) { /* private mode */ }
if (+Q.get('depth')) reached = Math.max(reached, Math.min(DEPTHS.length - 1, +Q.get('depth') - 1));
const saveProgress = () => { try { localStorage.setItem(PROGRESS, JSON.stringify({ reached })); } catch (_) { /* ignore */ } };

let scene, camera, world, level, actors, fx, vm;
let state = 'title', t = 0, acc = 0, last = performance.now(), shake = 0, bobPh = 0, depth = 0;
let entry = { d: 0, carry: null }; // what you came into this depth with: a death restarts from it

function dispose(root) { root?.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }

function build(d = 0, carry = null) {
  dispose(scene);
  depth = d;
  scene = new THREE.Scene(); scene.background = new THREE.Color(0x000000);
  scene.fog = new THREE.FogExp2(0x000000, 0.04);
  scene.add(new THREE.HemisphereLight(0x1a2448, 0x140a04, 0.08)); // the faintest bounce: the dark leans blue, never grey
  camera = new THREE.PerspectiveCamera(70, 16 / 9, 0.03, 120); camera.rotation.order = 'YXZ'; scene.add(camera);
  world = createWorld(d, { seed: (Math.random() * 1e9) | 0, carry });
  level = new LevelView(scene, world.L, { shadows: settings.shadows });
  fx = new Fx(scene); actors = new Actors(scene, fx); vm = new Viewmodel(camera);
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
const BACK = { 's-settings': () => $('b-settings-done').click(), 's-pause': () => resume() };
function showScreen(id) {
  for (const sc of screens) $(sc).hidden = sc !== id;
  nav.set(id ? $(id) : null, BACK[id] || null);
}
let settingsBack = 's-title';

// Depth buttons on the title: every depth you've reached, each with its own starting kit.
function depthButtons() {
  const row = $('depths');
  row.hidden = reached < 1;
  row.innerHTML = '';
  for (let d = 0; d <= reached; d++) {
    const b = document.createElement('button');
    b.textContent = DEPTHS[d].name; b.addEventListener('click', () => play(d));
    row.appendChild(b);
  }
}

function play(d, carry = null) { build(d, carry); entry = { d, carry }; begin(); }
function begin() {
  audio.unlock(); audio.startAmbience();
  state = 'play'; input.enabled = true; showScreen(null); hud.show(true);
  $('touch').hidden = !touch;
  if (!touch) input.requestLock();
  if (touch) try { window.TouchZoomGuard?.enterFullscreen('landscape'); } catch (_) { /* optional */ }
  hud.toast(`${DEPTHS[depth].name.toUpperCase()} · ${DEPTHS[depth].title.toUpperCase()}`, 2.8);
}
const start = () => play(0);
function pause() {
  if (state !== 'play') return;
  state = 'pause'; input.enabled = false; input.reset(); input.releaseLock();
  showScreen('s-pause');
}
function resume() { state = 'play'; input.enabled = true; showScreen(null); if (!touch) input.requestLock(); }

const DEATH = {
  scarab: 'The scarabs took you down to the floor, and then into it.',
  jackal: 'The khopesh came from the dark faster than you turned.',
  ba: 'They came down out of the dark, one after another.',
  backblast: 'You fired with your back to the wall.',
  grenade: 'Your own grenade.', rocket: 'Your own rocket.',
};
function end() {
  state = 'end'; input.enabled = false; input.reset(); input.releaseLock();
  const s = world.stats, won = world.state === 'clear', next = depth + 1 < DEPTHS.length ? depth + 1 : -1;
  const D = DEPTHS[depth];
  $('e-eyebrow').textContent = `${D.name} · ${D.title}`;
  $('e-title').textContent = won ? `${D.name} cleared` : 'You died';
  $('e-blurb').textContent = won
    ? (next > 0 ? `The scarab door opens onto a stair going down. ${DEPTHS[next].name}: ${DEPTHS[next].title}.` : 'The scarab door opens onto a stair going down into the dark. The next depth is still being dug.')
    : DEATH[world.events.find((e) => e.type === 'death')?.from] || 'The tomb keeps what comes into it.';
  const acc = s.shots ? Math.round((s.hits / s.shots) * 100) : 0;
  $('e-stats').innerHTML = [
    ['Time', `${(s.time ?? world.t).toFixed(1)} s`], ['Slain', `${s.kills}`], ['Heart shots', `${s.hearts}`], ['Head shots', `${s.heads}`],
    ['Accuracy', `${acc}%`], ['Damage taken', `${Math.round(s.taken)}`],
  ].map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
  if (won && next > 0) { reached = Math.max(reached, next); saveProgress(); depthButtons(); }
  const again = $('b-again'), replay = $('b-replay');
  again.textContent = won ? (next > 0 ? `Descend to ${DEPTHS[next].name}` : 'Descend again') : 'Try again';
  const carry = won && next > 0 ? loadout(world) : null;
  again.onclick = () => { if (won && next > 0) play(next, carry); else if (won) play(0); else play(entry.d, entry.carry); };
  replay.hidden = !won; replay.textContent = `Replay ${D.name}`;
  replay.onclick = () => play(entry.d, entry.carry);
  hud.show(false); $('touch').hidden = true;
  showScreen('s-end');
}

$('b-start').addEventListener('click', start);
$('b-resume').addEventListener('click', resume);
$('b-restart').addEventListener('click', () => play(entry.d, entry.carry));
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
  bazooka: "THE EXPEDITION'S BAZOOKA · 1943", rockets: `+${T.bazooka.crate}  ROCKETS`,
};
function handleEvents() {
  const p = world.player;
  for (const e of world.events) {
    audio.event(e); vm.event(e);
    switch (e.type) {
      case 'hit':
        if (e.kind === 'scarab') fx.burst('chitin', e.x, e.y, e.z, 6, { speed: 2.5, size: 0.04, life: 0.6 });
        else if (e.crit) { fx.burst('gore', e.x, e.y, e.z, 18, { speed: 3.2, size: 0.05, life: 0.8 }); fx.burst('spark', e.x, e.y, e.z, 6, { speed: 3, size: 0.03, life: 0.25 }); actors.hit(e.id); }
        else if (e.kind === 'ba' || e.kind === 'mother') { fx.burst('chip', e.x, e.y, e.z, 6, { speed: 2.2, size: 0.04, life: 0.6 }); actors.hit(e.id); }
        else { fx.burst('dust', e.x, e.y, e.z, 7, { speed: 1.6, size: 0.06, life: 0.7, up: 0.6 }); actors.hit(e.id); }
        if (!e.quiet || e.crit) hud.hitMarker(e.crit);
        break;
      case 'impact':
        fx.burst('spark', e.x + e.nx * 0.05, e.y + e.ny * 0.05, e.z + e.nz * 0.05, e.quiet ? 2 : 5, { speed: 3, size: 0.03, life: 0.25, dir: [e.nx, e.ny, e.nz] });
        fx.burst('dust', e.x + e.nx * 0.05, e.y + e.ny * 0.05, e.z + e.nz * 0.05, 2, { speed: 0.8, size: 0.05, life: 0.6, dir: [e.nx, e.ny, e.nz] });
        break;
      case 'kill':
        if (e.kind === 'mummy') fx.burst('dust', e.x, 1.0, e.z, 22, { speed: 1.4, size: 0.09, life: 1.3, up: 0.8 });
        else if (e.kind === 'jackal') fx.burst('dust', e.x, 1.4, e.z, 26, { speed: 1.6, size: 0.1, life: 1.4, up: 0.8 });
        else if (e.kind === 'ba') { fx.burst('chip', e.x, e.y, e.z, 12, { speed: 2.5, size: 0.05, life: 0.9 }); fx.burst('gore', e.x, e.y, e.z, 4, { speed: 2, size: 0.04, life: 0.5 }); }
        else if (e.kind === 'mother') {
          fx.burst('chip', e.x, e.y + 1.3, e.z, 70, { speed: 5, size: 0.09, life: 1.6, up: 1.5 });
          fx.burst('gore', e.x, e.y + 1.3, e.z, 30, { speed: 4, size: 0.06, life: 1.0, up: 1.2 });
          fx.flashLight(e.x, e.y + 1.5, e.z, 30, 12, 0.6);
          shake = Math.max(shake, 0.35); hud.toast('THE MOTHER BREAKS', 2);
        } else fx.burst('chitin', e.x, 0.1, e.z, 8, { speed: 2, size: 0.05, life: 0.7, up: 1.5 });
        break;
      case 'birth': fx.burst('gore', e.x, e.y, e.z, 8, { speed: 1.5, size: 0.04, life: 0.6, up: 1 }); actors.hit(e.id); break;
      case 'backblast': hud.toast('BACK-BLAST', 1.4); shake = Math.max(shake, 0.3); break;
      case 'explode': {
        fx.explosion(e.x, e.y, e.z, camera); dreadify(scene);
        const d = Math.hypot(e.x - p.x, e.z - p.z); shake = Math.max(shake, Math.max(0, (e.kind === 'rocket' ? 0.8 : 0.6) - d * 0.04)); input.rumble(0.9, 0.6, 260);
        break;
      }
      case 'hurt': hud.hurt(e.amount); shake = Math.max(shake, 0.12); input.rumble(0.5, 0.4, 110); break;
      case 'shot': shake = Math.max(shake, e.gun === 'B' ? 0.2 : e.gun === 'S' ? 0.08 : 0.025); input.rumble(e.gun === 'S' || e.gun === 'B' ? 0.6 : 0.12, 0.3, 60); break;
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
    if (pad.start && state === 'pause') resume();
    else nav.update(pad, input.pad, dt);
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
depthButtons();
showScreen('s-title');
requestAnimationFrame(frame);
if (Q.get('autostart')) play(Math.max(0, Math.min(DEPTHS.length - 1, (+Q.get('depth') || 1) - 1)));

window.GAME = {
  get world() { return world; }, get state() { return state; }, input, hud, nav, settings, start, play, pause, resume, loadout: () => loadout(world),
  step: (c, secs = 1) => { for (let k = 0; k < secs / STEP; k++) step(world, { mx: 0, my: 0, yaw: 0, pitch: 0, ...c }, STEP); },
};
