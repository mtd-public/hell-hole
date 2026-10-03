// Headless checks of the pure rules: node tools/sim-check.mjs
// Proves the maps are finishable and the core numbers do what TUNING says they do.
import { createWorld, step, loadout } from '../js/sim/world.js';
import { spawn } from '../js/sim/enemies.js';
import { DEPTHS } from '../js/sim/levels.js';
import { parseLevel, pathField, isWall } from '../js/sim/level.js';
import { TUNING as T } from '../js/sim/tuning.js';

let fails = 0, passes = 0;
const ok = (cond, msg) => { if (cond) passes++; else { fails++; console.error('FAIL', msg); } };
const DT = 1 / 120;
const idle = () => ({ mx: 0, my: 0, yaw: 0, pitch: 0 });
const run = (w, secs, ctl = idle) => { for (let k = 0; k < secs / DT && w.state === 'play'; k++) step(w, ctl(k), DT); };
const C = T.cell;

// 1. every depth parses; the door and every pickup are reachable from the start
for (const def of DEPTHS) {
  const L = parseLevel(def);
  const dist = pathField(L, L.start.x, L.start.z);
  const at = (x, z) => dist[Math.floor(z / C) * L.w + Math.floor(x / C)];
  ok(at(L.exit.x, L.exit.z) > 0, `${def.id}: exit reachable`);
  for (const p of L.pickups) ok(at(p.x, p.z) >= 0, `${def.id}: pickup ${p.kind} reachable`);
  for (const s of L.spawns) ok(!isWall(L, s.x, s.z), `${def.id}: spawn on floor`);
  ok(L.torches.length > 8, `${def.id}: lit (${L.torches.length} torches)`);
  ok(L.rows === undefined, 'parse ok');
}

// Place a lone mummy in front of the player and aim.
function duel(dist, aimAt) {
  const w = createWorld(0);
  w.enemies = []; w.scarabs = []; w.nests = [];
  const p = w.player;
  // the start corridor runs north: put the mummy straight ahead
  // held in a long windup facing you, so it stands still at the test distance
  const m = { id: 99, type: 'mummy', x: p.x, z: p.z - dist, y: 0, vx: 0, vz: 0, yaw: Math.PI, hp: T.mummy.hp, state: 'windup', t: 99, cd: 9, deadT: 0, phase: 0 };
  w.enemies.push(m);
  const eye = T.player.eye, dy = aimAt - eye;
  p.pitch = Math.atan2(dy, dist - 0.18);
  return { w, m };
}

// 2. one round through the heart scarab drops a mummy
{
  const { w, m } = duel(4, T.mummy.heartY);
  let fired = false;
  run(w, 0.05, () => { const c = { ...idle(), fireR: !fired }; fired = true; return c; });
  ok(m.state === 'dead' && m.how === 'heart', `heart shot kills (state ${m.state}, hp ${m.hp})`);
  ok(w.stats.hearts === 1, 'heart counted');
}

// 3. body shots: it takes TUNING.mummy.hp of them
{
  const { w, m } = duel(5, 0.9);
  let shots = 0, k = 0;
  run(w, 4, () => { k++; const press = k % 40 < 2; return { ...idle(), fireR: press, fireL: false }; });
  shots = w.stats.shots;
  ok(m.state === 'dead' && m.how === 'body', `body shots kill (state ${m.state}, hp ${m.hp}, shots ${shots})`);
  ok(shots >= T.mummy.hp, `needed at least ${T.mummy.hp} body shots (fired ${shots})`);
}

// 4. a magazine empties and reloads from the reserve
{
  const w = createWorld(0); w.enemies = [];
  const p = w.player, start = p.reserve;
  let k = 0;
  run(w, 3.5, () => { k++; return { ...idle(), fireL: k % 20 < 2 }; });
  ok(p.reserve < start, `reserve used by reload (${start} → ${p.reserve})`);
  ok(p.guns.L.mag > 0, `left gun reloaded (mag ${p.guns.L.mag})`);
}

// 5. a mummy that reaches you hurts you, after its windup
{
  const w = createWorld(0); w.scarabs = []; w.nests = [];
  const p = w.player;
  w.enemies = [{ id: 7, type: 'mummy', x: p.x, z: p.z - 3, y: 0, vx: 0, vz: 0, yaw: 0, hp: 7, state: 'chase', t: 0, cd: 0, deadT: 0, phase: 0 }];
  run(w, 4);
  ok(p.hp < T.player.hp, `mummy hurts (hp ${p.hp})`);
  ok(p.hp > T.player.hp - T.mummy.damage * 4, 'mummy cooldown limits damage');
}

// 6. a nest opens when you look at it, empties, and the swarm bites
{
  const w = createWorld(0); w.enemies = [];
  const p = w.player, n = w.nests[0];
  p.x = n.x; p.z = n.z + 2 * C; // two cells south of a nest in a corridor or room
  if (isWall(w.L, p.x, p.z)) { p.z = n.z - 2 * C; }
  run(w, 3);
  ok(n.open, 'nest opened in sight');
  ok(w.scarabs.length > 0, `scarabs spawned (${w.scarabs.length})`);
  ok(p.hp < T.player.hp, `swarm bites (hp ${p.hp})`);
  ok(p.hp > 0, 'i-frames keep a swarm from deleting you in 3 s');
}

// 7. a grenade lobs 8-12 m, bounces, explodes on its fuse and kills mummies in its radius
{
  const throwOne = (mummies) => {
    const w = createWorld(0); w.scarabs = []; w.nests = []; w.enemies = mummies;
    const p = w.player; p.grenades = 1; p.pitch = 0.1;
    let thrown = false;
    run(w, 3, () => { const c = { ...idle(), grenade: !thrown }; thrown = true; return c; });
    return w;
  };
  const dry = throwOne([]), ex = dry.events.find((e) => e.type === 'explode');
  ok(!!ex, 'grenade exploded');
  const range = ex ? dry.player.z - ex.z : 0;
  ok(range > 7 && range < 16, `grenade range ${range.toFixed(1)} m`);
  const mk = (k) => ({ id: 50 + k, type: 'mummy', x: ex.x + (k - 1) * 0.7, z: ex.z, y: 0, vx: 0, vz: 0, yaw: 0, hp: T.mummy.hp, state: 'windup', t: 99, cd: 9, deadT: 0, phase: 0 });
  const w = throwOne([0, 1, 2].map(mk));
  ok(w.enemies.filter((e) => e.state === 'dead').length >= 2, `grenade killed (${w.enemies.map((e) => e.state + ':' + e.hp).join(' ')})`);
}

// 8. the shotgun: pick it up, it switches, and one blast at close range drops a mummy's worth of hp
{
  const w = createWorld(0); w.enemies = []; w.nests = [];
  const p = w.player, sg = w.pickups.find((k) => k.kind === 'shotgun');
  p.x = sg.x; p.z = sg.z;
  run(w, 0.1);
  ok(p.has.shotgun && p.weapon === 'shotgun', 'shotgun picked up and in hand');
  w.enemies = [{ id: 9, type: 'mummy', x: p.x - 2.0, z: p.z, y: 0, vx: 0, vz: 0, yaw: 0, hp: T.mummy.hp, state: 'idle', t: 0, cd: 9, deadT: 0, phase: 0 }];
  p.yaw = Math.PI / 2; p.pitch = -0.25; // face west, aim at the body
  run(w, 0.6);
  let f = false;
  run(w, 0.05, () => { const c = { ...idle(), fireR: !f }; f = true; return c; });
  ok(w.enemies[0].hp <= T.mummy.hp - 4, `point-blank buckshot (hp left ${w.enemies[0].hp})`);
}

// 9. the shrine heals, once
{
  const w = createWorld(0); w.enemies = []; w.nests = [];
  const p = w.player, s = w.shrines[0];
  p.hp = 30; p.x = s.x; p.z = s.z;
  run(w, 5);
  ok(p.hp > 90, `shrine heals (hp ${p.hp.toFixed(0)})`);
  p.hp = 30; run(w, 3);   // the last 30 of its 100
  p.hp = 30; run(w, 3);
  ok(p.hp < 31 && s.charge <= 0, `a spent shrine heals no more (hp ${p.hp.toFixed(0)})`);
}

// 10. walking the path field from the start reaches the door and clears the depth
{
  const w = createWorld(0); w.enemies = []; w.nests = [];
  const L = w.L, p = w.player, target = pathField(L, L.exit.x, L.exit.z);
  let k = 0;
  run(w, 90, () => {
    k++;
    const i = Math.floor(p.x / C), j = Math.floor(p.z / C), here = target[j * L.w + i];
    let bx = p.x, bz = p.z, best = here;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const d = target[(j + dj) * L.w + i + di];
      if (d >= 0 && d < best) { best = d; bx = (i + di + 0.5) * C; bz = (j + dj + 0.5) * C; }
    }
    if (best === here) { bx = L.exit.x; bz = L.exit.z; }
    const want = Math.atan2(-(bx - p.x), -(bz - p.z));
    const da = Math.atan2(Math.sin(want - p.yaw), Math.cos(want - p.yaw));
    return { mx: 0, my: 1, yaw: da, pitch: 0 };
  });
  ok(w.state === 'clear', `walked to the door (state ${w.state}, t ${w.t.toFixed(1)} s)`);
}

// 11. dt is clamped by the caller, but a zero or tiny step must not blow up
{
  const w = createWorld(0);
  step(w, idle(), 0); step(w, idle(), 1e-6);
  ok(Number.isFinite(w.player.x) && Number.isFinite(w.player.z), 'zero dt is safe');
}


// ---------------------------------------------------------------------------- Depth II
const clear = (w) => { w.enemies = []; w.scarabs = []; w.nests = []; return w; };
const autopilot = (w, secs = 120) => {
  const L = w.L, p = w.player, target = pathField(L, L.exit.x, L.exit.z);
  run(w, secs, () => {
    const i = Math.floor(p.x / C), j = Math.floor(p.z / C), here = target[j * L.w + i];
    let bx = p.x, bz = p.z, best = here;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const d = target[(j + dj) * L.w + i + di];
      if (d >= 0 && d < best) { best = d; bx = (i + di + 0.5) * C; bz = (j + dj + 0.5) * C; }
    }
    if (best === here) { bx = L.exit.x; bz = L.exit.z; }
    const want = Math.atan2(-(bx - p.x), -(bz - p.z));
    return { mx: 0, my: 1, yaw: Math.atan2(Math.sin(want - p.yaw), Math.cos(want - p.yaw)), pitch: 0 };
  });
};

// 12. Depth II is finishable, and its kit starts you with the 870
{
  const w = clear(createWorld(1));
  ok(w.player.has.shotgun && w.player.sg.tube === 7, 'depth II kit: the 870 loaded');
  autopilot(w);
  ok(w.state === 'clear', `walked Depth II to the door (state ${w.state}, t ${w.t.toFixed(1)} s)`);
}

// A lone creature straight north of you at distance d, awake.
function face(type, dist, extra = {}) {
  const w = clear(createWorld(1));
  const p = w.player;
  const e = spawn(w, type, p.x, p.z - dist, { yaw: Math.PI, ...extra });
  w.enemies.push(e);
  return { w, e, p };
}
const shoot = (w, n, side = 'fireR', gap = 30) => { let k = 0; run(w, (n * gap + 5) / 120, () => { k++; return { ...idle(), [side]: k % gap === 1 }; }); };

// 13. jackal: four rounds to the head, twelve to the body
{
  const { w, e, p } = face('jackal', 6, { state: 'stagger', t: 99 });
  p.pitch = Math.atan2(T.jackal.headY - T.player.eye, 6 - 0.14);
  // hold it in place: a stagger that never ends
  let k = 0; run(w, 1.2, () => { k++; e.state = 'stagger'; e.t = 99; return { ...idle(), fireR: k % 30 === 1 }; });
  ok(e.dead && e.how === 'head', `jackal head shots kill (hp ${e.hp}, heads ${w.stats.heads})`);
  ok(w.stats.heads <= 4, `took ${w.stats.heads} head shots`);
  const b = face('jackal', 6, { state: 'stagger', t: 99 });
  b.p.pitch = Math.atan2(1.0 - T.player.eye, 6);
  let n = 0; run(b.w, 4, () => { n++; b.e.state = 'stagger'; b.e.t = 99; return { ...idle(), fireR: n % 20 === 1, fireL: n % 20 === 11 }; });
  ok(b.e.dead && b.w.stats.shots >= T.jackal.hp, `jackal body shots: ${b.w.stats.shots} to kill`);
}

// 14. jackal: crouches, lunges, slashes
{
  const { w, e, p } = face('jackal', 5.5, { state: 'chase' });
  const seen = new Set();
  run(w, 3, () => { seen.add(e.state); return idle(); });
  ok(seen.has('crouch') && seen.has('lunge'), `jackal lunged (${[...seen].join(',')})`);
  ok(p.hp <= T.player.hp - T.jackal.damage, `the khopesh lands (hp ${p.hp})`);
}

// 15. jackal: a point-blank load of buckshot staggers it
{
  const { w, e, p } = face('jackal', 2.2, { state: 'windup', t: 0.5 });
  p.weapon = 'shotgun'; p.pitch = Math.atan2(1.2 - T.player.eye, 2.2);
  let f = false; run(w, 0.05, () => { const c = { ...idle(), fireR: !f }; f = true; return c; });
  ok(e.state === 'stagger', `buckshot staggers (state ${e.state}, hp ${e.hp})`);
}

// 16. ba: a flock wakes, orbits, dives; dives never start closer together than the global gap
{
  const w = clear(createWorld(1)), p = w.player;
  for (let k = 0; k < 3; k++) { const b = spawn(w, 'ba', p.x + (k - 1), p.z - 6, { state: 'orbit', cd: 0.2 * k }); w.enemies.push(b); }
  const dives = [];
  run(w, 8, () => { for (const e of w.events) if (e.type === 'screech') dives.push(e.t); w.events.length = 0; return idle(); });
  ok(dives.length >= 3, `ba dive (${dives.length} screeches in 8 s)`);
  const gaps = dives.slice(1).map((t, k) => t - dives[k]);
  ok(gaps.every((g) => g >= T.ba.globalGap - 1e-6), `dives spaced by ≥ ${T.ba.globalGap} s (${gaps.map((g) => g.toFixed(2)).join(' ')})`);
  ok(p.hp < T.player.hp, `pecked (hp ${p.hp})`);
}

// 17. the Canopic Mother broods up to her limit, and her brood dies with her
{
  const { w, e, p } = face('mother', 9, { state: 'awake', t: 0.1 });
  run(w, 25, () => { p.hp = 100; return idle(); });
  const brood = w.enemies.filter((b) => b.type === 'ba' && b.mother === e.id && !b.dead).length;
  ok(brood === T.mother.maxBrood, `mother broods ${brood}/${T.mother.maxBrood}`);
  // the seam takes double
  p.pitch = Math.atan2(e.y + (T.mother.seamY0 + T.mother.seamY1) / 2 - T.player.eye, 9 - T.mother.radius);
  const hp0 = e.hp; let f = false; run(w, 0.02, () => { const c = { ...idle(), fireR: !f }; f = true; return c; });
  ok(hp0 - e.hp === T.mother.seamMult, `seam shot takes ${hp0 - e.hp}`);
  e.hp = 1; p.pitch = Math.atan2(e.y + 0.5 - T.player.eye, 9 - T.mother.radius);
  let g = false; run(w, 0.05, () => { const c = { ...idle(), fireL: !g }; g = true; return c; });
  const left = w.enemies.filter((b) => b.type === 'ba' && b.mother === e.id && !b.dead).length;
  ok(e.dead && left === 0, `her brood dies with her (alive ${left})`);
}

// 18. the bazooka: pick it up, a rocket kills a pack, the tube reloads from the reserve
{
  const w = clear(createWorld(1)), p = w.player, bz = w.pickups.find((k) => k.kind === 'bazooka');
  p.x = bz.x; p.z = bz.z; run(w, 0.1);
  ok(p.has.bazooka && p.weapon === 'bazooka' && p.bz.tube === 1 && p.rockets === T.bazooka.found, `bazooka found (tube ${p.bz.tube}, rockets ${p.rockets})`);
  // open floor: put the player in the hypostyle, a pack 9 m north
  p.x = 15.5 * C; p.z = 15.5 * C; p.yaw = 0; p.pitch = Math.atan2(1.0 - T.player.eye, 9);
  w.enemies = [-0.7, 0, 0.7].map((dx) => spawn(w, 'mummy', p.x + dx, p.z - 9, { state: 'windup', t: 99 }));
  run(w, 0.4); let f = false;
  run(w, 1.5, () => { const c = { ...idle(), fireR: !f }; f = true; return c; });
  ok(w.enemies.every((e) => e.dead), `one rocket, three mummies (${w.enemies.map((e) => e.hp).join(' ')})`);
  run(w, 2);
  ok(p.bz.tube === 1 && p.rockets === T.bazooka.found - 1, `reloaded from the reserve (tube ${p.bz.tube}, rockets ${p.rockets})`);
}

// 19. back-blast: firing with your back to a wall hurts
{
  const w = clear(createWorld(1)), p = w.player;
  p.has.bazooka = true; p.weapon = 'bazooka'; p.bz.tube = 1;
  // the arrival corridor runs north; face north with the south end wall behind you
  p.z = (33 + 1) * C - 0.5; p.yaw = 0; p.pitch = 0.2;
  let f = false; run(w, 0.05, () => { const c = { ...idle(), fireR: !f }; f = true; return c; });
  ok(p.hp === T.player.hp - T.bazooka.backDamage, `back-blast (hp ${p.hp})`);
}

// 20. descending keeps your kit
{
  const a = createWorld(0); const p = a.player;
  p.reserve = 33; p.has.shotgun = true; p.sg.tube = 5; p.shells = 9; p.grenades = 3; p.hp = 20; p.weapon = 'shotgun';
  const b = createWorld(1, { carry: loadout(a) });
  const q = b.player;
  ok(q.reserve === 33 && q.has.shotgun && q.sg.tube === 5 && q.shells === 9 && q.grenades === 3 && q.weapon === 'shotgun', 'loadout carried');
  ok(q.hp === T.carry.minHp, `arrive with at least ${T.carry.minHp} hp (${q.hp})`);
}

console.log(`${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
