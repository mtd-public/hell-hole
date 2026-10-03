// Gamepad navigation for the DOM menus (after dr-mow's MenuNav, by way of Vertical-Vantage):
// D-pad or left stick up/down moves between the visible controls, left/right changes a
// select, a slider or a checkbox, A presses, B goes back. Keyboard and mouse keep working
// as they always did; this only adds the pad.

const REPEAT = 0.22; // s between repeats while the stick is held

export class MenuNav {
  constructor() { this.screen = null; this.i = 0; this.held = 0; this.repeatT = 0; this.onBack = null; }

  set(screen, onBack = null) {
    this.screen = screen; this.onBack = onBack; this.i = 0;
    if (screen) this.focus();
  }

  items() {
    if (!this.screen) return [];
    return [...this.screen.querySelectorAll('button, select, input')].filter((el) => !el.disabled && el.offsetParent !== null);
  }

  focus() {
    const it = this.items();
    for (const el of this.screen.querySelectorAll('.pad-focus')) el.classList.remove('pad-focus');
    if (!it.length) return;
    this.i = Math.max(0, Math.min(this.i, it.length - 1));
    const el = it[this.i];
    el.classList.add('pad-focus');
    try { el.focus({ preventScroll: true }); el.scrollIntoView({ block: 'nearest' }); } catch (_) { /* ignore */ }
  }

  move(d) { const n = this.items().length; if (!n) return; this.i = (this.i + d + n) % n; this.focus(); }

  adjust(d) {
    const el = this.items()[this.i];
    if (!el) return;
    if (el.tagName === 'SELECT') {
      el.selectedIndex = Math.max(0, Math.min(el.options.length - 1, el.selectedIndex + d));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    } else if (el.type === 'range') {
      const step = +el.step || 0.1;
      el.value = String(Math.max(+el.min, Math.min(+el.max, +el.value + d * step * 2)));
      el.dispatchEvent(new Event('input', { bubbles: true }));
    } else if (el.type === 'checkbox') this.press(el);
    else this.move(d); // a row of buttons: left/right walks along it
  }

  press(el = this.items()[this.i]) {
    if (!el) return;
    if (el.type === 'checkbox') { el.checked = !el.checked; el.dispatchEvent(new Event('change', { bubbles: true })); }
    else el.click();
  }

  // edges: this frame's pad presses (Input.pollPad); pad: held state (Input.pad)
  update(edges, pad, dt) {
    if (!this.screen || !pad) return;
    if (edges.up) this.move(-1);
    if (edges.down) this.move(1);
    if (edges.left) this.adjust(-1);
    if (edges.right) this.adjust(1);
    // the left stick, with repeat
    const v = pad.ly < -0.6 ? -1 : pad.ly > 0.6 ? 1 : 0, h = pad.lx < -0.6 ? -1 : pad.lx > 0.6 ? 1 : 0;
    const dir = v ? `v${v}` : h ? `h${h}` : 0;
    if (dir !== this.held) { this.held = dir; this.repeatT = 0; if (v) this.move(v); else if (h) this.adjust(h); }
    else if (dir) { this.repeatT += dt; if (this.repeatT > REPEAT) { this.repeatT = 0; if (v) this.move(v); else this.adjust(h); } }
    if (edges.a) this.press();
    if (edges.b && this.onBack) this.onBack();
  }
}
