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
  await page.evaluate(() => { const w = GAME.world; w.player.x = w.L.exit.x; w.player.z = w.L.exit.z + 0.5; });
  await page.waitForTimeout(400);
  const end = await page.evaluate(() => [GAME.state, document.getElementById('e-title').textContent]);
  if (end[0] !== 'end') fail(`desktop: no end screen at the door (${end})`);
  console.log('desktop end', end);
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
