import { describe, expect, it } from 'vitest';
import worker, { caseNumber, isAllowedOrigin, type Env } from '../src/worker';

function makeEnv(opts: { limited?: boolean; dbFails?: boolean; start?: number } = {}) {
  let spies = opts.start ?? 0;
  const limiterKeys: string[] = [];
  const statements: string[] = [];
  const DB = {
    prepare(sql: string) {
      statements.push(sql);
      return {
        async first<T>() {
          if (opts.dbFails) throw new Error('D1 unavailable');
          if (sql.startsWith('UPDATE')) { spies += 1; return { value: spies } as T; }
          return { value: spies } as T;
        },
      };
    },
  };
  const env = {
    DB,
    ASSETS: { fetch: async (req: Request) => new Response(`asset:${new URL(req.url).pathname}`, { headers: { 'Content-Type': 'text/html' } }) },
    SPIN_LIMITER: { limit: async ({ key }: { key: string }) => { limiterKeys.push(key); return { success: !opts.limited }; } },
    RELEASE_SHA: 'abc123',
  } as unknown as Env;
  return { env, limiterKeys, statements, get spies() { return spies; } };
}

const call = (env: Env, path: string, init: RequestInit = {}, host = 'aretheyahoneypot.com') =>
  worker.fetch(new Request(`https://${host}${path}`, init), env);

describe('worker routing', () => {
  it('reports health with the release SHA', async () => {
    const { env } = makeEnv();
    const res = await call(env, '/api/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, release: 'abc123' });
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(res.headers.get('x-request-id')).toMatch(/[0-9a-f-]{36}/);
  });

  it('returns the real spy count', async () => {
    const { env } = makeEnv({ start: 41 });
    const res = await call(env, '/api/stats');
    expect(await res.json()).toEqual({ spies: 41 });
  });

  it('increments the counter on a verdict and returns a case number', async () => {
    const ctx = makeEnv({ start: 9 });
    const res = await call(ctx.env, '/api/verdict', { method: 'POST', headers: { Origin: 'https://aretheyahoneypot.com', 'CF-Connecting-IP': '203.0.113.9' } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ spies: 10, caseNumber: 'HP-000010' });
    expect(ctx.spies).toBe(10);
    expect(ctx.limiterKeys).toEqual(['203.0.113.9']);
    expect(ctx.statements.some((s) => s.includes('RETURNING value'))).toBe(true);
  });

  it('rejects cross-site verdicts without touching the counter', async () => {
    const ctx = makeEnv();
    const res = await call(ctx.env, '/api/verdict', { method: 'POST', headers: { Origin: 'https://evil.example' } });
    expect(res.status).toBe(403);
    expect(ctx.spies).toBe(0);
    expect(ctx.limiterKeys).toHaveLength(0);
  });

  it('rate limits verdicts', async () => {
    const ctx = makeEnv({ limited: true });
    const res = await call(ctx.env, '/api/verdict', { method: 'POST' });
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('60');
    expect(ctx.spies).toBe(0);
  });

  it('returns JSON 500 when D1 fails', async () => {
    const { env } = makeEnv({ dbFails: true });
    const res = await call(env, '/api/verdict', { method: 'POST' });
    expect(res.status).toBe(500);
    expect((await res.json()) as object).toHaveProperty('error');
  });

  it('enforces methods with an Allow header', async () => {
    const { env } = makeEnv();
    const verdict = await call(env, '/api/verdict');
    expect(verdict.status).toBe(405);
    expect(verdict.headers.get('Allow')).toBe('POST');
    const stats = await call(env, '/api/stats', { method: 'POST' });
    expect(stats.status).toBe(405);
    expect(stats.headers.get('Allow')).toBe('GET, HEAD');
  });

  it('404s unknown API routes as JSON', async () => {
    const { env } = makeEnv();
    const res = await call(env, '/api/nope');
    expect(res.status).toBe(404);
    expect(res.headers.get('Content-Type')).toContain('application/json');
  });

  it('redirects www to the apex preserving path and query', async () => {
    const { env } = makeEnv();
    const res = await call(env, '/some/path?x=1', {}, 'www.aretheyahoneypot.com');
    expect(res.status).toBe(301);
    expect(res.headers.get('Location')).toBe('https://aretheyahoneypot.com/some/path?x=1');
  });

  it('serves assets with security headers', async () => {
    const { env } = makeEnv();
    const res = await call(env, '/');
    expect(await res.text()).toBe('asset:/');
    const csp = res.headers.get('Content-Security-Policy')!;
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("script-src 'self' https://static.cloudflareinsights.com");
    expect(csp).toContain('img-src \'self\' blob: data:');
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    const api = await call(env, '/api/health');
    expect(api.headers.get('Content-Security-Policy')).toBe(csp);
  });
});

describe('helpers', () => {
  it('formats case numbers', () => {
    expect(caseNumber(1)).toBe('HP-000001');
    expect(caseNumber(1234567)).toBe('HP-1234567');
  });

  it('allows only the product and local origins', () => {
    const prod = 'https://aretheyahoneypot.com';
    expect(isAllowedOrigin(null, prod)).toBe(true);
    expect(isAllowedOrigin(prod, prod)).toBe(true);
    expect(isAllowedOrigin(prod, 'https://aretheyahoneypot.michael-cd6.workers.dev')).toBe(true);
    expect(isAllowedOrigin('https://aretheyahoneypot.michael-cd6.workers.dev', 'https://aretheyahoneypot.michael-cd6.workers.dev')).toBe(true);
    expect(isAllowedOrigin('http://localhost:8790', 'http://aretheyahoneypot.com')).toBe(true);
    expect(isAllowedOrigin('http://127.0.0.1:5173', prod)).toBe(true);
    expect(isAllowedOrigin('https://www.aretheyahoneypot.com', prod)).toBe(false);
    expect(isAllowedOrigin('https://aretheyahoneypot.com.evil.example', prod)).toBe(false);
    expect(isAllowedOrigin('http://aretheyahoneypot.com', prod)).toBe(false);
    expect(isAllowedOrigin('null', prod)).toBe(false);
  });
});
