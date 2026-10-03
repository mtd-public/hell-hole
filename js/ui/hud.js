// The HUD: DOM over the canvas, updated a few times a second (React-free, but the same rule:
// it only ever reads a snapshot of the world, it owns no game state).
import { TUNING as T } from '../sim/tuning.js';

const $ = (id) => document.getElementById(id);

export class Hud {
  constructor() {
    this.el = $('hud');
    this.hp = $('h-hp'); this.hpBar = $('h-hpbar'); this.time = $('h-time'); this.kills = $('h-kills');
    this.pipsL = $('h-pips-l'); this.pipsR = $('h-pips-r'); this.reserve = $('h-reserve'); this.gren = $('h-gren');
    this.weapon = $('h-weapon'); this.toastEl = $('h-toast'); this.vig = $('h-vignette'); this.heal = $('h-heal');
    this.xhair = $('h-xhair');
    this.last = {}; this.toastT = 0; this.hurtT = 0; this.hitT = 0;
  }

  show(on) { this.el.hidden = !on; }

  toast(text, secs = 2.2) { this.toastEl.textContent = text; this.toastEl.classList.add('on'); this.toastT = secs; }
  hurt(amount) { this.hurtT = Math.min(0.6, 0.2 + amount / 40); }
  hitMarker(heart) { this.hitT = 0.12; this.xhair.classList.toggle('heart', !!heart); }

  // pips: ▮ per round, dim for empty, a gap for the chambered one
  pips(el, n, cap, reloading) {
    const key = `${n}/${cap}/${reloading}`;
    if (el.dataset.k === key) return;
    el.dataset.k = key;
    el.classList.toggle('reloading', !!reloading);
    let s = '';
    for (let k = 0; k < cap; k++) s += `<i class="${k < n ? 'on' : ''}"></i>`;
    el.innerHTML = s;
  }

  update(w, dt) {
    const p = w.player;
    if (this.toastT > 0) { this.toastT -= dt; if (this.toastT <= 0) this.toastEl.classList.remove('on'); }
    if (this.hurtT > 0) this.hurtT -= dt;
    if (this.hitT > 0) this.hitT -= dt;
    this.vig.style.opacity = Math.max(0, this.hurtT * 1.6).toFixed(2);
    this.heal.style.opacity = p.healing ? '1' : '0';
    this.xhair.classList.toggle('hit', this.hitT > 0);
    const hp = Math.ceil(p.hp);
    if (hp !== this.last.hp) { this.hp.textContent = hp; this.hpBar.style.width = `${hp}%`; this.el.classList.toggle('low', hp <= 30); this.last.hp = hp; }
    const tt = w.t.toFixed(1);
    if (tt !== this.last.t) { this.time.textContent = tt; this.last.t = tt; }
    const kills = `${w.stats.kills}`;
    if (kills !== this.last.kills) { this.kills.textContent = kills; this.last.kills = kills; }
    if (p.weapon === 'pistols') {
      const cap = T.pistol.mag + T.pistol.chamber;
      this.pips(this.pipsL, p.guns.L.mag, cap, p.guns.L.reload > 0);
      this.pips(this.pipsR, p.guns.R.mag, cap, p.guns.R.reload > 0);
      this.pipsL.hidden = false;
      this.setText(this.reserve, `.45 ACP  ${p.reserve}`);
      this.setText(this.weapon, 'M1911A1 ×2');
    } else {
      this.pipsL.hidden = true;
      this.pips(this.pipsR, p.sg.tube, T.shotgun.tube, p.sg.loading);
      this.setText(this.reserve, `12 GA  ${p.shells}`);
      this.setText(this.weapon, 'REMINGTON 870');
    }
    this.setText(this.gren, p.grenades ? `MK 2 ×${p.grenades}` : '');
  }
  setText(el, s) { if (el.textContent !== s) el.textContent = s; }
}
