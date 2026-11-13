// Static release checks on the built site: no third-party runtime URLs, no placeholder or rollout copy.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const dist = new URL('../dist/', import.meta.url).pathname;
const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (['.html', '.js', '.css', '.svg', '.txt'].includes(extname(p))) files.push(p);
  }
};
walk(dist);
if (!files.some((f) => f.endsWith('index.html'))) throw new Error('dist/index.html missing: run npm run build first');

const allowedUrl = /^https?:\/\/(aretheyahoneypot\.com(\/|$)|www\.w3\.org\/)/;
const banned = [/\bTODO\b/, /lorem ipsum/i, /\bbeta\b/i, /coming soon/i, /\bMVP\b/, /\bprototype\b/i, /early access/i];
const problems = [];
for (const file of files) {
  const text = readFileSync(file, 'utf8');
  for (const m of text.matchAll(/https?:\/\/[^\s"'`)<>]+/g)) {
    if (!allowedUrl.test(m[0])) problems.push(`${file}: third-party URL ${m[0]}`);
  }
  if (file.endsWith('.html') || file.endsWith('.txt')) {
    for (const re of banned) if (re.test(text)) problems.push(`${file}: banned copy ${re}`);
  }
}
const src = ['src/copy.ts', 'index.html'].map((f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')).join('\n');
for (const re of banned) if (re.test(src)) problems.push(`source: banned copy ${re}`);

if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log(`check: ${files.length} built files clean`);
