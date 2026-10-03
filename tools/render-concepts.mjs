// Render every concept shot through the real Dread pipeline and save PNGs.
//   python3 -m http.server 4190 &   # from the repo root
//   node tools/render-concepts.mjs [shot ...]
// Writes concept/shots/<shot>[.<style>].png at native resolution (the pixels the game draws),
// plus concept/shots/x4/ upscaled copies (x3 at 360 lines) for viewing outside a pixelated <img>.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = process.env.BASE || 'http://localhost:4190/';
const OUT = new URL('../concept/shots/', import.meta.url).pathname;
mkdirSync(OUT + 'x4', { recursive: true });

const MAIN = ['hallway', 'hall', 'descent', 'boss', 'guns', 'shotgun', 'rocket', 'grenade', 'staff', 'arsenal', 'mummy', 'jackal', 'ba', 'scarab', 'canopic', 'scorpion', 'ammit'];
const VARIANTS = [['hallway', 'pigment'], ['hallway', 'sincity'], ['hall', 'pigment'], ['hall', 'sincity']];
const only = process.argv.slice(2);
// gunlab (the viewmodel under flat light) only renders when asked for by name
const jobs = [...MAIN.map((s) => [s, 'dagger']), ...VARIANTS, ['gunlab', 'dagger']].filter(([s, st]) => only.length ? only.includes(s) || only.includes(`${s}.${st}`) : s !== 'gunlab');

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium',
  args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1920, height: 1200 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));

for (const [shot, style] of jobs) {
  const t0 = Date.now();
  await page.goto(`${BASE}concept/?shot=${shot}&style=${style}&scale=3`);
  await page.waitForFunction(() => window.__READY === true, null, { timeout: 180000 });
  const name = style === 'dagger' ? shot : `${shot}.${style}`;
  const data = await page.evaluate(() => document.getElementById('shot').toDataURL('image/png'));
  writeFileSync(`${OUT}${name}.png`, Buffer.from(data.split(',')[1], 'base64'));
  await page.locator('#shot').screenshot({ path: `${OUT}x4/${name}.png` });
  console.log(`${name}  ${Date.now() - t0} ms`);
}
await browser.close();
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
