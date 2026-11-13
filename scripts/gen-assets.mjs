// Renders the committed share image, touch icon and test fixture with headless Chromium.
// Run with `npm run assets` after changing the wheel or the brand. Outputs are committed.
import { chromium } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { wheelSvg } from '../src/wheel-svg.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const font = (pkg, file) => pathToFileURL(join(root, 'node_modules', pkg, 'files', file)).href;
const fonts = `
@font-face { font-family: 'Lilita One'; src: url('${font('@fontsource/lilita-one', 'lilita-one-latin-400-normal.woff2')}'); }
@font-face { font-family: 'DM Sans'; src: url('${font('@fontsource-variable/dm-sans', 'dm-sans-latin-wght-normal.woff2')}'); font-weight: 100 1000; }
@font-face { font-family: 'Courier Prime'; font-weight: 700; src: url('${font('@fontsource/courier-prime', 'courier-prime-latin-700-normal.woff2')}'); }
body { margin: 0; }`;

const og = `<!doctype html><html><head><style>${fonts}
.og { width: 1200px; height: 630px; background: #fff4d6; position: relative; overflow: hidden; font-family: 'DM Sans'; color: #1b1b1f; }
.txt { position: absolute; left: 72px; top: 92px; width: 600px; }
h1 { font-family: 'Lilita One'; font-weight: 400; font-size: 112px; line-height: 0.92; margin: 0 0 26px; }
h1 span { color: #ffc21a; -webkit-text-stroke: 4px #1b1b1f; paint-order: stroke fill; text-shadow: 0 7px 0 #1b1b1f; }
p { font-size: 34px; font-weight: 600; margin: 0; line-height: 1.25; }
.url { position: absolute; left: 72px; bottom: 56px; font-family: 'Courier Prime'; font-weight: 700; font-size: 28px; letter-spacing: 0.04em; }
.wheel { position: absolute; right: -80px; top: 50%; width: 600px; height: 600px; transform: translateY(-50%) rotate(-24deg); filter: drop-shadow(0 12px 0 #1b1b1f); }
.wheel svg { width: 100%; height: 100%; }
.hub { position: absolute; right: 122px; top: 50%; width: 196px; height: 196px; margin-top: -98px; border-radius: 50%; background: #ffc21a; border: 9px solid #1b1b1f; box-sizing: border-box; display: grid; place-items: center; font-family: 'Lilita One'; font-size: 120px; }
.stamp { position: absolute; right: 64px; top: 50%; transform: translateY(-50%) rotate(-14deg); font-family: 'Lilita One'; font-size: 150px; line-height: 1; color: #e63946; background: rgba(255,244,214,0.92); border: 10px solid #e63946; outline: 4px solid #e63946; outline-offset: 6px; border-radius: 18px; padding: 8px 26px 0; }
</style></head><body><div class="og">
<div class="txt"><h1>Are they a <span>honeypot?</span></h1><p>Upload a photo of anyone. Or anything. The wheel knows.</p></div>
<div class="url">ARETHEYAHONEYPOT.COM</div>
<div class="wheel">${wheelSvg()}</div>
<div class="hub">?</div>
<div class="stamp">SPY</div>
</div></body></html>`;

const icon = `<!doctype html><html><head><style>${fonts}
.i { width: 180px; height: 180px; background: #ffc21a; display: grid; place-items: center; }
.w { width: 156px; height: 156px; }
</style></head><body><div class="i"><div class="w">${wheelSvg()}</div></div></body></html>`;

const fixture = `<!doctype html><html><head><style>${fonts}
.f { width: 480px; height: 480px; background: linear-gradient(135deg, #2ec4b6, #ff8fc7); display: grid; place-items: center; font-size: 280px; }
</style></head><body><div class="f">🥪</div></body></html>`;

async function shot(browser, html, width, height, out) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  const file = join(tmpdir(), `ath-${width}x${height}.html`);
  writeFileSync(file, html);
  await page.goto(pathToFileURL(file).href);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: out, clip: { x: 0, y: 0, width, height } });
  await page.close();
  console.log(`wrote ${out}`);
}

const browser = await chromium.launch();
mkdirSync(join(root, 'tests/fixtures'), { recursive: true });
await shot(browser, og, 1200, 630, join(root, 'public/og.png'));
await shot(browser, icon, 180, 180, join(root, 'public/apple-touch-icon.png'));
await shot(browser, fixture, 480, 480, join(root, 'tests/fixtures/suspect.png'));
await browser.close();
