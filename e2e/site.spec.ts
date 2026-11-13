import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { wedgeAt } from '../src/wheel';

const fixture = (name: string) => path.join(process.cwd(), 'tests/fixtures', name);

function watch(page: Page) {
  const errors: string[] = [];
  const external: string[] = [];
  const verdictPosts: { method: string; body: string | null }[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => {
    const url = new URL(r.url());
    if (url.protocol.startsWith('http') && url.hostname !== '127.0.0.1') external.push(r.url());
    if (url.pathname === '/api/verdict') verdictPosts.push({ method: r.method(), body: r.postData() });
  });
  return { errors, external, verdictPosts };
}

async function stats(page: Page): Promise<number> {
  return ((await (await page.request.get('/api/stats')).json()) as { spies: number }).spies;
}

async function landed(page: Page) {
  const rotation = await page.locator('#wheel').evaluate((el) => parseFloat((el as HTMLElement).style.transform.replace(/[^\d.-]/g, '')));
  return wedgeAt(rotation);
}

/** The wheel stopped on a spy wedge and the verdict names that exact wedge. */
async function expectSpyVerdict(page: Page) {
  const wedge = await landed(page);
  expect(wedge.kind).toBe('spy');
  await expect(page.locator('#verdictTitle')).toHaveText(`Verdict: ${wedge.label}`);
}

async function noHorizontalOverflow(page: Page) {
  // Sample through the verdict shake as well as at rest.
  for (let i = 0; i < 6; i++) {
    const o = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(o).toBeLessThanOrEqual(0);
    await page.waitForTimeout(60);
  }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

test('no flavor text claims the wheel itself is the authority', async ({ page }) => {
  const source = readFileSync(path.join(process.cwd(), 'src/copy.ts'), 'utf8');
  const strings = [...source.matchAll(/'([^'\n]*)'/g)].map((m) => m[1]).join('\n');
  expect(strings).toContain('WIA');
  expect(strings).not.toMatch(/(the|a bigger|our) wheel (has|is|would|suspects|knows|says|never)/i);
  expect(strings).not.toMatch(/stop asking|go outside|double agent|act natural/i);
  await page.goto('/');
  await expect(page.locator('.sub, .hint')).toHaveCount(0);
});

test('a photo goes in, SPY comes out, and the photo never leaves the page', async ({ page }) => {
  const w = watch(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('honeypot');
  await noHorizontalOverflow(page);
  const before = await stats(page);

  await page.locator('#file').setInputFiles(fixture('suspect.png'));
  await expect(page.locator('body')).toHaveAttribute('data-state', 'scanning');
  await expect(page.locator('#upload')).toBeDisabled();
  await expect(page.locator('#terminal')).toBeVisible();
  await expect(page.locator('#terminal')).toContainText('wia scan');
  await expect(page.locator('#rain')).toHaveClass(/on/);
  await expect(page.locator('#verdictTitle')).toBeVisible({ timeout: 25_000 });
  await noHorizontalOverflow(page);
  await expect(page.locator('body')).toHaveAttribute('data-state', 'verdict');
  await expectSpyVerdict(page);
  // The first round never does the "probably fine" stall.
  await expect(page.locator('#wheelWrap')).toHaveAttribute('data-near-miss', '');
  await expect(page.locator('#terminal')).toBeHidden();
  await expect(page.locator('#hubPhoto')).toBeVisible();
  await expect(page.locator('#agent svg')).toBeVisible();
  await expect(page.locator('#flavor, .briefing, .bubble')).toHaveCount(0);

  const after = await stats(page);
  expect(after).toBe(before + 1);
  await expect(page.locator('#count')).toHaveText(after.toLocaleString('en-US'));
  await expect(page.locator('#announce')).toContainText(`Case HP-${String(after).padStart(6, '0')}`);
  await expect(page.locator('#announce')).toContainText('Verdict:');

  expect(w.verdictPosts).toEqual([{ method: 'POST', body: null }]);
  expect(w.external).toEqual([]);
  expect(w.errors).toEqual([]);
  await noHorizontalOverflow(page);
});

test('a file that is not even an image is still a spy', async ({ page }) => {
  const w = watch(page);
  await page.goto('/');
  await page.locator('#file').setInputFiles(fixture('not-an-image.txt'));
  await expect(page.locator('#hubRedacted')).toBeVisible();
  await expect(page.locator('#caption')).toContainText('won’t even open');
  await expect(page.locator('#verdictTitle')).toBeVisible({ timeout: 25_000 });
  await expectSpyVerdict(page);
  expect(w.errors).toEqual([]);
});

test('every other second opinion stalls on PROBABLY FINE, and none inflate the counter', async ({ page }) => {
  await page.goto('/');
  await page.locator('#file').setInputFiles(fixture('suspect.png'));
  await expect(page.locator('#verdictTitle')).toBeVisible({ timeout: 25_000 });
  const count = await stats(page);
  const second = page.getByRole('button', { name: 'Get a second opinion' });

  await second.click();
  await expect(page.locator('body')).toHaveAttribute('data-state', 'scanning');
  await expect(page.locator('#terminal')).toBeVisible();
  await expect(page.locator('#caption')).toContainText('Probably fine…?', { timeout: 15_000 });
  await expect(page.locator('body')).toHaveAttribute('data-state', 'verdict', { timeout: 25_000 });
  await expectSpyVerdict(page);
  await expect(page.locator('#wheelWrap')).toHaveAttribute('data-near-miss', 'PROBABLY FINE');
  await expect(page.locator('#caption .sr-only')).toHaveText('Probably fine was right there. Spy.');

  await second.click();
  await expect(page.locator('body')).toHaveAttribute('data-state', 'verdict', { timeout: 25_000 });
  await expectSpyVerdict(page);
  await expect(page.locator('#wheelWrap')).toHaveAttribute('data-near-miss', '');
  await expect(page.locator('#caption .sr-only')).toHaveText('Opinion #3: spy. The WIA double-checked.');

  await second.click();
  await expect(page.locator('#caption')).toContainText('Probably fine…?', { timeout: 15_000 });
  await expect(page.locator('body')).toHaveAttribute('data-state', 'verdict', { timeout: 25_000 });
  await expectSpyVerdict(page);
  await expect(second).toBeEnabled();
  expect(await stats(page)).toBe(count);
});

test('the verdict survives the API being down', async ({ page }) => {
  const w = watch(page);
  await page.route('**/api/verdict', (route) => route.abort());
  await page.goto('/');
  await page.locator('#file').setInputFiles(fixture('suspect.png'));
  await expect(page.locator('#verdictTitle')).toBeVisible({ timeout: 25_000 });
  await expectSpyVerdict(page);
  await expect(page.locator('#announce')).toContainText(/Case HP-\d{6}\./);
  expect(w.errors.filter((e) => !e.includes('net::ERR_FAILED'))).toEqual([]);
});

test('reduced motion skips the theatrics but keeps the verdict', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const started = Date.now();
  await page.locator('#file').setInputFiles(fixture('suspect.png'));
  await expect(page.locator('#verdictTitle')).toBeVisible({ timeout: 6_000 });
  expect(Date.now() - started).toBeLessThan(6_000);
  await expectSpyVerdict(page);
});

test('the dossier downloads as a PNG and the reset flow works', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'touch devices use the share sheet');
  await page.goto('/');
  await page.locator('#file').setInputFiles(fixture('suspect.png'));
  await expect(page.locator('#verdictTitle')).toBeVisible({ timeout: 25_000 });
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Save the dossier' }).click()]);
  expect(download.suggestedFilename()).toMatch(/^dossier-HP-\d{6}\.png$/);
  const bytes = readFileSync(await download.path());
  expect(bytes.subarray(1, 4).toString()).toBe('PNG');
  expect(bytes.length).toBeGreaterThan(50_000);

  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Check someone else' }).click();
  await chooser;
  await expect(page.locator('body')).toHaveAttribute('data-state', 'idle');
  await expect(page.locator('#hubPhoto')).toBeHidden();
  await expect(page.locator('#upload')).toBeEnabled();
});

test('keyboard users can start an investigation', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'keyboard flow');
  await page.goto('/');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await expect(page.locator('#upload')).toBeFocused();
  const chooser = page.waitForEvent('filechooser');
  await page.keyboard.press('Enter');
  await (await chooser).setFiles(fixture('suspect.png'));
  await expect(page.locator('#verdictTitle')).toBeFocused({ timeout: 25_000 });
});
