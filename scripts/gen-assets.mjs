// Renders the committed share image, touch icon and test fixture with headless Chromium.
// Run with `npm run assets` after changing the wheel or the brand. Outputs are committed.
import { chromium } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { wheelSvg } from '../src/wheel-svg.ts';
import { agentSvg, velvetSvg } from '../src/sprites.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const font = (pkg, file) => pathToFileURL(join(root, 'node_modules', pkg, 'files', file)).href;
const fonts = `
@font-face { font-family: 'Lilita One'; src: url('${font('@fontsource/lilita-one', 'lilita-one-latin-400-normal.woff2')}'); }
@font-face { font-family: 'DM Sans'; src: url('${font('@fontsource-variable/dm-sans', 'dm-sans-latin-wght-normal.woff2')}'); font-weight: 100 1000; }
@font-face { font-family: 'Courier Prime'; font-weight: 700; src: url('${font('@fontsource/courier-prime', 'courier-prime-latin-700-normal.woff2')}'); }
body { margin: 0; }`;

// Share card styled like the results screen.
const og = `<!doctype html><html><head><style>${fonts}
.og { width: 1200px; height: 630px; background: #c8202b; position: relative; overflow: hidden; font-family: 'DM Sans'; color: #fff4d6; }
.txt { position: absolute; left: 72px; top: 96px; width: 560px; }
h1 { font-family: 'Lilita One'; font-weight: 400; font-size: 104px; line-height: 0.92; margin: 0 0 34px; }
.honey { color: #ffc21a; -webkit-text-stroke: 4px #1b1b1f; paint-order: stroke fill; text-shadow: 0 6px 0 #1b1b1f; }
h2 { font-family: 'Lilita One'; font-weight: 400; font-size: 64px; line-height: 1; margin: 0; }
.url { position: absolute; left: 72px; bottom: 54px; font-family: 'Courier Prime'; font-weight: 700; font-size: 26px; letter-spacing: 0.06em; }
.wrap { position: absolute; right: 70px; top: 50%; width: 500px; height: 500px; margin-top: -232px; }
.wheel { position: absolute; inset: 0; transform: rotate(-15deg); }
.wheel svg { width: 100%; height: 100%; }
.pointer { position: absolute; left: 50%; top: 0; width: 64px; margin-left: -32px; transform: translateY(-34%); }
.pointer path { fill: #ffc21a; stroke: #1b1b1f; stroke-width: 5; stroke-linejoin: round; }
.pointer circle { fill: #1b1b1f; }
.hub { position: absolute; left: 50%; top: 50%; width: 180px; height: 180px; margin: -90px 0 0 -90px; border-radius: 50%; background: #ffc21a; border: 7px solid #1b1b1f; box-sizing: border-box; overflow: hidden; }
.hub svg { width: 100%; height: 100%; }
.stamp { position: absolute; left: 50%; top: 66%; transform: translate(-50%, -50%) rotate(-12deg); font-family: 'Lilita One'; font-size: 66px; line-height: 1; color: #e63946; background: rgba(255,244,214,0.92); border: 7px solid #e63946; outline: 3px solid #e63946; outline-offset: 4px; border-radius: 10px; padding: 4px 16px 0; }
.spy { position: absolute; bottom: -30px; width: 84px; }
.spy svg { width: 100%; height: auto; display: block; }
.spy.l { left: -24px; } .spy.r { right: -24px; }
</style></head><body><div class="og">
<div class="txt"><h1>Are they a <span class="honey">honeypot?</span></h1><h2>Verdict: <span class="honey">SPY</span></h2></div>
<div class="url">ARETHEYAHONEYPOT.COM</div>
<div class="wrap">
  <div class="wheel">${wheelSvg()}</div>
  <div class="pointer"><svg viewBox="0 0 60 80" style="overflow:visible"><path d="M30 77 L10.4 36 A22 22 0 1 1 49.6 36 Z"/><circle cx="30" cy="26" r="7.5"/></svg></div>
  <div class="hub"><svg viewBox="0 0 200 200"><path d="M28 78 H172" stroke="#1b1b1f" stroke-width="7" stroke-linecap="round"/><rect x="34" y="74" width="56" height="34" rx="12" fill="#1b1b1f"/><rect x="110" y="74" width="56" height="34" rx="12" fill="#1b1b1f"/><path d="M44 82 l10 0 M120 82 l10 0" stroke="#fff4d6" stroke-width="5" stroke-linecap="round"/><path d="M100 128 C88 118 66 116 52 128 C62 128 70 140 84 140 C92 140 98 134 100 132 C102 134 108 140 116 140 C130 140 138 128 148 128 C134 116 112 118 100 128 Z" fill="#1b1b1f"/></svg></div>
  <div class="stamp">SPY</div>
  <div class="spy l">${agentSvg()}</div>
  <div class="spy r">${velvetSvg()}</div>
</div>
</div></body></html>`;

const icon = `<!doctype html><html><head><style>${fonts}
.i { width: 180px; height: 180px; background: #ffc21a; display: grid; place-items: center; }
.w { width: 104px; }
.w svg { width: 100%; height: auto; display: block; }
</style></head><body><div class="i"><div class="w">${agentSvg()}</div></div></body></html>`;

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
