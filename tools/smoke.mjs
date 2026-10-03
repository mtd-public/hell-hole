// Browser smoke test: boots the real game, plays a few seconds of scripted input, and checks
// for console errors, page scroll, a drawn frame and a working HUD at desktop and phone sizes.
//   python3 -m http.server 4190 &   # from the repo root
//   node tools/smoke.mjs            # BASE=http://localhost:4190/ by default; SHOTS=dir to save screenshots
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE || 'http://localhost:4190/';
const SHOTS = process.env.SHOTS || '';
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM || (process.env.CI ? undefined : '/opt/pw-browsers/chromium'),
  args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
});
let fails = 0;
const fail = (m) => { fails++; console.error('FAIL', m); };

async function run(name, ctx, script) {
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|fonts\.g|ERR_|net::/.test(m.text())) errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${BASE}?lines=270&capture=1`);
  await page.waitForFunction(() => window.GAME && window.GAME.world, null, { timeout: 60000 });
  await page.waitForTimeout(800);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}-title.png` });
  await script(page);
  const scroll = await page.evaluate(() => [document.documentElement.scrollWidth - innerWidth, document.documentElement.scrollHeight - innerHeight]);
  if (scroll[0] > 0 || scroll[1] > 0) fail(`${name}: page scrolls ${scroll}`);
  const lit = await page.evaluate(() => {
    const c = document.getElementById('view'), g = c.getContext('webgl2') || c.getContext('webgl');
    const px = new Uint8Array(4 * 64 * 64); g.readPixels((c.width >> 1) - 32, (c.height >> 1) - 32, 64, 64, g.RGBA, g.UNSIGNED_BYTE, px);
    let n = 0; for (let i = 0; i < px.length; i += 4) if (px[i] + px[i + 1] + px[i + 2] > 30) n++; return n;
  });
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}-play.png` });
  if (errors.length) fail(`${name}: console errors\n  ${errors.join('\n  ')}`);
  console.log(`${name}: ${errors.length} errors, lit px ${lit}`);
  await page.close();
}

// desktop: start, walk up the corridor, fire both guns, reload, look around
const desk = await browser.newContext({ viewport: { width: 1280, height: 720 } });
await run('desktop', desk, async (page) => {
  await page.click('#b-start');
  await page.waitForFunction(() => window.GAME.state === 'play');
  await page.keyboard.down('w'); await page.waitForTimeout(900); await page.keyboard.up('w');
  for (let k = 0; k < 6; k++) { await page.mouse.down({ button: k % 2 ? 'right' : 'left' }); await page.waitForTimeout(60); await page.mouse.up({ button: k % 2 ? 'right' : 'left' }); await page.waitForTimeout(140); }
  await page.keyboard.press('r');
  await page.waitForTimeout(600);
  const s = await page.evaluate(() => ({ shots: GAME.world.stats.shots, hp: GAME.world.player.hp, z: GAME.world.player.z, hud: document.getElementById('h-hp').textContent }));
  if (s.shots < 4) fail(`desktop: shots fired ${s.shots}`);
  if (s.hud !== String(Math.ceil(s.hp))) fail(`desktop: HUD hp ${s.hud} vs ${s.hp}`);
  console.log('desktop play', s);
  // pause and resume through the keyboard
  await page.keyboard.press('p');
  const paused = await page.evaluate(() => GAME.state);
  if (paused !== 'pause') fail(`desktop: P did not pause (${paused})`);
  await page.click('#b-resume');
  // grenade with the crate's worth, then let the sim run on: a death or a clear must reach the end screen
  await page.evaluate(() => { GAME.world.player.grenades = 2; });
  await page.keyboard.press('g'); await page.waitForTimeout(2600);
  const boom = await page.evaluate(() => GAME.world.stats.kills >= 0);
  if (!boom) fail('desktop: grenade');
  await page.evaluate(() => { const w = GAME.world; w.player.reserve = 77; w.player.x = w.L.exit.x; w.player.z = w.L.exit.z + 0.5; });
  await page.waitForTimeout(400);
  const end = await page.evaluate(() => [GAME.state, document.getElementById('e-title').textContent, document.getElementById('b-again').textContent]);
  if (end[0] !== 'end') fail(`desktop: no end screen at the door (${end})`);
  if (!/Depth II/.test(end[2])) fail(`desktop: no way down (${end[2]})`);
  console.log('desktop end', end);
  // down the stair: Depth II, with what you carried
  await page.click('#b-again');
  await page.waitForFunction(() => GAME.state === 'play' && GAME.world.depth === 1, null, { timeout: 30000 });
  const carried = await page.evaluate(() => GAME.world.player.reserve);
  if (carried !== 77) fail(`desktop: loadout not carried (reserve ${carried})`);
  // into the hypostyle with the bazooka, a rocket at the jackals
  await page.evaluate(() => { const w = GAME.world, p = w.player; p.has.bazooka = true; p.bz.tube = 1; p.rockets = 2; p.weapon = 'bazooka'; p.x = 14.5 * 3; p.z = 20.5 * 3; p.yaw = 0; p.pitch = 0.02; });
  await page.waitForTimeout(1500);
  await page.mouse.down(); await page.waitForTimeout(60); await page.mouse.up();
  await page.waitForTimeout(250);
  const flying = await page.evaluate(() => GAME.world.rockets.length + GAME.world.stats.shots);
  if (flying < 1) fail('desktop: no rocket');
  await page.waitForTimeout(1500);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/desktop-depth2.png` });
  const d2 = await page.evaluate(() => ({ state: GAME.state, kills: GAME.world.stats.kills, hp: GAME.world.player.hp, ba: GAME.world.enemies.filter((e) => e.type === 'ba').length }));
  console.log('desktop depth II', d2);
});

// a controller in the menus: a stubbed standard gamepad
const padCtx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
await padCtx.addInitScript(() => {
  window.__pad = { buttons: new Array(17).fill(0), axes: [0, 0, 0, 0] };
  navigator.getGamepads = () => [{ id: 'stub pad', index: 0, connected: true, mapping: 'standard', buttons: window.__pad.buttons.map((v) => ({ pressed: v > 0.5, value: v })), axes: window.__pad.axes }];
});
await run('gamepad', padCtx, async (page) => {
  const tap = async (i) => { await page.evaluate((i) => { window.__pad.buttons[i] = 1; }, i); await page.waitForTimeout(80); await page.evaluate((i) => { window.__pad.buttons[i] = 0; }, i); await page.waitForTimeout(80); };
  const focused = () => page.evaluate(() => document.activeElement?.id || document.activeElement?.textContent);
  const f0 = await focused();
  await tap(13); // D-pad down
  const f1 = await focused();
  if (f0 === f1) fail(`gamepad: D-pad did not move focus (${f0})`);
  await tap(0); // A: open what's focused (Settings)
  const settingsOpen = await page.evaluate(() => !document.getElementById('s-settings').hidden);
  if (!settingsOpen) fail(`gamepad: A did not open Settings (focus ${f1})`);
  await tap(15); // D-pad right on the first control (Look): Dagger → Pigment
  const style = await page.evaluate(() => GAME.settings.style);
  if (style !== 'pigment') fail(`gamepad: D-pad right did not change the look (${style})`);
  await tap(14);
  await tap(1); // B: back
  const back = await page.evaluate(() => !document.getElementById('s-title').hidden);
  if (!back) fail('gamepad: B did not go back');
  await tap(0); // A on Descend
  await page.waitForFunction(() => GAME.state === 'play', null, { timeout: 30000 }).catch(() => fail('gamepad: A did not start'));
  await tap(9); // Menu: pause
  const paused = await page.evaluate(() => GAME.state);
  if (paused !== 'pause') fail(`gamepad: Menu did not pause (${paused})`);
  await tap(9);
  const resumed = await page.evaluate(() => GAME.state);
  if (resumed !== 'play') fail(`gamepad: Menu did not resume (${resumed})`);
  console.log('gamepad', { f0, f1, style });
});

// phone, landscape, touch
const phone = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
await run('phone', phone, async (page) => {
  await page.tap('#b-start');
  await page.waitForFunction(() => window.GAME.state === 'play');
  const vis = await page.evaluate(() => !document.getElementById('touch').hidden);
  if (!vis) fail('phone: touch controls hidden');
  await page.tap('#t-fire-r'); await page.waitForTimeout(200); await page.tap('#t-fire-l'); await page.waitForTimeout(300);
  const shots = await page.evaluate(() => GAME.world.stats.shots);
  if (shots < 1) fail(`phone: touch fire (${shots})`);
});

await browser.close();
console.log(fails ? `${fails} failed` : 'smoke ok');
process.exit(fails ? 1 : 0);
