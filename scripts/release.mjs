// Production release: build, apply and verify D1 migrations, deploy, then prove the live SHA.
import { execFileSync } from 'node:child_process';

const required = ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID'];
for (const name of required) if (!process.env[name]) throw new Error(`${name} is required for a release.`);

const sha = process.env.RELEASE_SHA || execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (!/^[0-9a-f]{40}$/.test(sha)) throw new Error('A full 40-character git commit SHA is required.');
const base = (process.env.PRODUCTION_URL || 'https://aretheyahoneypot.com').replace(/\/$/, '');

const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { stdio: 'inherit', ...opts });
const capture = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8' });

run('npm', ['run', 'build']);
run('npx', ['wrangler', 'd1', 'migrations', 'apply', 'aretheyahoneypot', '--remote']);
const pending = capture('npx', ['wrangler', 'd1', 'migrations', 'list', 'aretheyahoneypot', '--remote']);
if (!/No migrations to apply/i.test(pending)) {
  console.error(pending);
  throw new Error('Remote D1 still reports pending migrations; refusing to deploy.');
}
run('npx', ['wrangler', 'deploy', '--var', `RELEASE_SHA:${sha}`]);

const deadline = Date.now() + 180_000;
let last = 'no response';
while (Date.now() < deadline) {
  try {
    const res = await fetch(`${base}/api/health`, { headers: { 'Cache-Control': 'no-cache' } });
    const body = await res.json();
    if (res.ok && body.release === sha) {
      console.log(`Verified ${base} is serving release ${sha}`);
      process.exit(0);
    }
    last = `HTTP ${res.status} release=${body.release}`;
  } catch (err) {
    last = err instanceof Error ? err.message : String(err);
  }
  await new Promise((r) => setTimeout(r, 5000));
}
throw new Error(`Deployed release was not observed at ${base} within 3 minutes (last: ${last}).`);
