// Input: keyboard + mouse (pointer lock), standard gamepads, touch. Folds into one control
// object per sim step:  { mx, my, yaw, pitch, fireL, fireR, jump, reload, grenade, swap, weapon }
// Look arrives as radians, already scaled. Edges (jump, reload, grenade, swap) are latched until
// a step consumes them, so a press is never lost on a frame that runs zero sim steps.
//
// Adapted from Vertical-Vantage js/input/input.js (itself from dr-mow, gig-ambulance and
// cosmic-calamity-assault): pointer-lock spike filter, radial deadzones, trigger hysteresis,
// a floating thumbstick where a new touch always takes the stick, reset on blur / hide.
//
// Twin 1911s: each trigger fires its own gun. Mouse: left button = right gun, right button =
// left gun (the hand on that side of the mouse is the one you hold it with). Gamepad: RT / LT.

const PAD = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, VIEW: 8, START: 9, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.opts = { mouseSens: 1, padSens: 1, touchSens: 1, invertY: false };
    this.keys = new Set();
    this.mouse = { L: false, R: false };
    this.press = { L: false, R: false }; // a click or tap shorter than a frame still fires once
    this.lookYaw = 0; this.lookPitch = 0;
    this.edges = { jump: false, reload: false, grenade: false, swap: false, weapon: 0 };
    this.locked = false; this.lockT = 0;
    this.enabled = false;
    this.onPause = null; this.onKey = null;
    this.pad = null; this.padPrev = {}; this.trig = { L: false, R: false }; this.padUsedT = -1;
    this.touchOn = false;
    this.stick = { id: null, bx: 0, by: 0, tx: 0, ty: 0, x: 0, y: 0, active: false };
    this.lookId = null; this.lookX = 0; this.lookY = 0;
    this.held = { fireL: false, fireR: false };
    this._buttons = [];
    this._bind();
  }

  _bind() {
    const el = this.canvas;
    window.addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'tab'].includes(k)) e.preventDefault();
      if (!e.repeat) {
        if (this.onKey && this.onKey(k, e)) return;
        if (this.enabled) {
          if (k === ' ') this.edges.jump = true;
          if (k === 'r') this.edges.reload = true;
          if (k === 'g' || k === 'f') this.edges.grenade = true;
          if (k === 'q' || k === 'tab') this.edges.swap = true;
          if (k === '1') this.edges.weapon = 1;
          if (k === '2') this.edges.weapon = 2;
        }
      }
      this.keys.add(k);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    el.addEventListener('mousedown', (e) => {
      if (!this.enabled) return;
      if (!this.locked && !this.touchOn) { this.requestLock(); }
      if (e.button === 0) this.mouse.R = this.press.R = true;
      if (e.button === 2) this.mouse.L = this.press.L = true;
      if (e.button === 1) { this.edges.grenade = true; e.preventDefault(); }
    });
    window.addEventListener('mouseup', (e) => { if (e.button === 0) this.mouse.R = false; if (e.button === 2) this.mouse.L = false; });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('wheel', (e) => { if (this.enabled && this.locked && Math.abs(e.deltaY) > 4) this.edges.swap = true; }, { passive: true });
    document.addEventListener('mousemove', (e) => {
      if (!this.locked || !this.enabled) return;
      if (performance.now() - this.lockT < 120) return; // the first move after locking spikes in Chromium
      const dx = e.movementX || 0, dy = e.movementY || 0;
      if (Math.abs(dx) > 300 || Math.abs(dy) > 300) return;
      const k = 0.0022 * this.opts.mouseSens;
      this.lookYaw -= dx * k;
      this.lookPitch -= dy * k * (this.opts.invertY ? -1 : 1);
    });
    document.addEventListener('pointerlockchange', () => {
      const was = this.locked;
      this.locked = document.pointerLockElement === el;
      this.lockT = performance.now();
      if (was && !this.locked && this.enabled && this.onPause) this.onPause('unlock');
    });
    window.addEventListener('blur', () => this.reset());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.reset(); });
    window.addEventListener('pagehide', () => this.reset());
  }

  requestLock() {
    if (this.touchOn || !this.canvas.requestPointerLock) return;
    const quiet = (r) => { if (r && r.catch) r.catch(() => {}); };
    try {
      const r = this.canvas.requestPointerLock({ unadjustedMovement: true });
      // unadjustedMovement is unsupported on some platforms: retry plain, unless the browser wants a gesture first
      if (r && r.catch) r.catch((e) => { if (e && e.name === 'NotAllowedError') return; try { quiet(this.canvas.requestPointerLock()); } catch (_) { /* ignore */ } });
    } catch (_) { try { quiet(this.canvas.requestPointerLock()); } catch (_) { /* ignore */ } }
  }
  releaseLock() { if (document.pointerLockElement) document.exitPointerLock(); }

  // Drop everything held: a stuck stick or trigger after a pause is the classic bug.
  reset() {
    this.keys.clear(); this.mouse.L = this.mouse.R = false; this.press.L = this.press.R = false;
    this.lookYaw = this.lookPitch = 0;
    this.edges = { jump: false, reload: false, grenade: false, swap: false, weapon: 0 };
    this.stick.id = null; this.stick.active = false; this.stick.x = this.stick.y = 0;
    this.lookId = null; this.held.fireL = this.held.fireR = false;
    for (const b of this._buttons) b.classList.remove('down');
    this.trig.L = this.trig.R = false;
  }

  // ------------------------------------------------------------------ gamepad
  pollPad(dt) {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let gp = null;
    for (const p of pads) if (p && p.connected && (!gp || p.mapping === 'standard')) gp = p;
    if (!gp) { this.pad = null; this.padPrev = {}; return {}; }
    const down = (i) => { const q = gp.buttons[i]; return !!q && (q.pressed || q.value > 0.5); };
    const dz = (x, y, d) => { const m = Math.hypot(x, y); if (m < d) return [0, 0, 0]; const k = Math.min(1, (m - d) / (1 - d)); return [x / m, y / m, k]; };
    const [lx, ly, lm] = dz(gp.axes[0] || 0, gp.axes[1] || 0, 0.2);
    const [rx, ry, rm] = dz(gp.axes[2] || 0, gp.axes[3] || 0, 0.12);
    for (const [side, i] of [['R', PAD.RT], ['L', PAD.LT]]) { // analog triggers with hysteresis
      const v = gp.buttons[i]?.value ?? 0;
      this.trig[side] = this.trig[side] ? v > 0.2 : v >= 0.35;
    }
    const now = { a: down(PAD.A), b: down(PAD.B), x: down(PAD.X), y: down(PAD.Y), lb: down(PAD.LB), rb: down(PAD.RB), start: down(PAD.START), view: down(PAD.VIEW), up: down(PAD.UP), down: down(PAD.DOWN), left: down(PAD.LEFT), right: down(PAD.RIGHT) };
    const was = this.padPrev, edges = {};
    for (const k in now) if (now[k] && !was[k]) edges[k] = true;
    this.padPrev = now;
    this.pad = { lx: lx * lm, ly: ly * lm, lm, rx, ry, rm, ...now };
    if (lm > 0.4 || rm > 0.4 || this.trig.L || this.trig.R || Object.keys(edges).length) this.padUsedT = performance.now();
    if (this.enabled) {
      if (edges.a) this.edges.jump = true;
      if (edges.x) this.edges.reload = true;
      if (edges.b || edges.rb) this.edges.grenade = true;
      if (edges.y || edges.lb || edges.right || edges.left) this.edges.swap = true;
      if (rm > 0) {
        const k = rm * rm * this.opts.padSens;
        this.lookYaw -= rx * k * 3.6 * dt;
        this.lookPitch -= ry * k * 2.4 * dt * (this.opts.invertY ? -1 : 1);
      }
    }
    return edges;
  }

  rumble(strong = 0.5, weak = 0.5, ms = 120) {
    try {
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      for (const p of pads) if (p && p.connected && p.vibrationActuator) p.vibrationActuator.playEffect('dual-rumble', { duration: ms, strongMagnitude: strong, weakMagnitude: weak });
    } catch (_) { /* not supported */ }
  }

  // ------------------------------------------------------------------ touch
  // zone: the full-screen layer under the HUD. Left 45 % = floating move stick, right = drag to look.
  bindTouch(zone) {
    zone.style.touchAction = 'none';
    zone.addEventListener('pointerdown', (e) => {
      if (!this.enabled) return;
      e.preventDefault();
      const r = zone.getBoundingClientRect(), x = e.clientX - r.left;
      if (x < r.width * 0.45) Object.assign(this.stick, { id: e.pointerId, bx: e.clientX, by: e.clientY, tx: e.clientX, ty: e.clientY, x: 0, y: 0, active: true });
      else { this.lookId = e.pointerId; this.lookX = e.clientX; this.lookY = e.clientY; }
      try { zone.setPointerCapture(e.pointerId); } catch (_) { /* synthetic */ }
    }, { passive: false });
    zone.addEventListener('pointermove', (e) => {
      if (e.pointerId === this.stick.id) { e.preventDefault(); this._moveStick(e.clientX, e.clientY); }
      else if (e.pointerId === this.lookId) { e.preventDefault(); this._dragLook(e.clientX, e.clientY); }
    }, { passive: false });
    const end = (e) => {
      if (e.pointerId === this.stick.id) { this.stick.id = null; this.stick.active = false; this.stick.x = this.stick.y = 0; }
      if (e.pointerId === this.lookId) this.lookId = null;
    };
    zone.addEventListener('pointerup', end); zone.addEventListener('pointercancel', end); zone.addEventListener('lostpointercapture', end);
  }
  _moveStick(x, y) {
    const S = this.stick, R = 60;
    let dx = x - S.bx, dy = y - S.by;
    const d = Math.hypot(dx, dy);
    if (d > R) { S.bx += (dx / d) * (d - R); S.by += (dy / d) * (d - R); dx = x - S.bx; dy = y - S.by; }
    S.tx = x; S.ty = y;
    const dd = Math.hypot(dx, dy), dead = 8;
    if (dd > dead) { const k = Math.min(1, (dd - dead) / (R * 0.8 - dead)); S.x = (dx / dd) * k; S.y = (dy / dd) * k; } else S.x = S.y = 0;
  }
  _dragLook(x, y) {
    const k = 0.0062 * this.opts.touchSens;
    this.lookYaw -= (x - this.lookX) * k;
    this.lookPitch -= (y - this.lookY) * k * (this.opts.invertY ? -1 : 1);
    this.lookX = x; this.lookY = y;
  }
  // Hold buttons (fireL / fireR) and tap buttons (jump, reload, grenade, swap), each with its own pointer.
  // The fire buttons also aim while you drag them, so a thumb never has to leave.
  bindButton(el, name) {
    this._buttons.push(el);
    el.style.touchAction = 'none';
    let owner = null, lx = 0, ly = 0;
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation();
      owner = e.pointerId; lx = e.clientX; ly = e.clientY;
      if (name in this.held) { this.held[name] = true; this.press[name === 'fireL' ? 'L' : 'R'] = true; } else this.edges[name] = true;
      el.classList.add('down');
      try { el.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
    }, { passive: false });
    el.addEventListener('pointermove', (e) => {
      if (e.pointerId !== owner || !(name in this.held)) return;
      const k = 0.0062 * this.opts.touchSens;
      this.lookYaw -= (e.clientX - lx) * k; this.lookPitch -= (e.clientY - ly) * k * (this.opts.invertY ? -1 : 1);
      lx = e.clientX; ly = e.clientY;
    });
    const off = (e) => { if (owner !== null && e.pointerId !== owner) return; owner = null; if (name in this.held) this.held[name] = false; el.classList.remove('down'); };
    el.addEventListener('pointerup', off); el.addEventListener('pointercancel', off); el.addEventListener('lostpointercapture', off);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  // ------------------------------------------------------------------ per step
  peekLook() { return { yaw: this.lookYaw, pitch: this.lookPitch }; }

  control(dt) {
    const k = this.keys, pad = this.pad;
    let mx = 0, my = 0;
    if (k.has('a')) mx -= 1; if (k.has('d')) mx += 1;
    if (k.has('w')) my += 1; if (k.has('s')) my -= 1;
    if (!mx && !my && this.stick.active) { mx = this.stick.x; my = -this.stick.y; }
    if (!mx && !my && pad && pad.lm > 0) { mx = pad.lx; my = -pad.ly; }
    if (k.has('arrowleft')) this.lookYaw += 2.4 * dt;
    if (k.has('arrowright')) this.lookYaw -= 2.4 * dt;
    if (k.has('arrowup')) this.lookPitch += 1.6 * dt;
    if (k.has('arrowdown')) this.lookPitch -= 1.6 * dt;
    const c = {
      mx, my, yaw: this.lookYaw, pitch: this.lookPitch,
      fireR: this.mouse.R || this.press.R || this.trig.R || this.held.fireR || k.has('j') || k.has('control'),
      fireL: this.mouse.L || this.press.L || this.trig.L || this.held.fireL || k.has('k') || k.has('alt'),
      jump: this.edges.jump, reload: this.edges.reload, grenade: this.edges.grenade, swap: this.edges.swap, weapon: this.edges.weapon,
    };
    this.lookYaw = this.lookPitch = 0;
    this.edges = { jump: false, reload: false, grenade: false, swap: false, weapon: 0 };
    this.press.L = this.press.R = false;
    return c;
  }
}
