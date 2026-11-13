export interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  DB: D1Database;
  SPIN_LIMITER: { limit(options: { key: string }): Promise<{ success: boolean }> };
  RELEASE_SHA: string;
}

const APEX = 'aretheyahoneypot.com';

const CSP = [
  "default-src 'self'",
  // Cloudflare Web Analytics (cookieless, aggregate) is injected at the edge for this zone.
  "script-src 'self' https://static.cloudflareinsights.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  "connect-src 'self' blob: https://cloudflareinsights.com",
  "media-src 'self' blob: data:",
  "object-src 'none'",
  "base-uri 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
].join('; ');

const SECURITY_HEADERS: Record<string, string> = {
  'Content-Security-Policy': CSP,
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

function withSecurityHeaders(response: Response): Response {
  const out = new Response(response.body, response);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) out.headers.set(name, value);
  return out;
}

function json(body: unknown, status: number, requestId: string, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'x-request-id': requestId,
      ...extra,
    },
  });
}

export function isAllowedOrigin(origin: string | null, requestOrigin: string): boolean {
  if (origin === null) return true; // non-browser clients send no Origin; the rate limit still applies
  if (origin === requestOrigin || origin === `https://${APEX}`) return true;
  try {
    const url = new URL(origin);
    return url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1');
  } catch {
    return false;
  }
}

export function caseNumber(count: number): string {
  return `HP-${String(count).padStart(6, '0')}`;
}

async function readSpies(db: D1Database): Promise<number> {
  const row = await db.prepare("SELECT value FROM counters WHERE name = 'spies'").first<{ value: number }>();
  return row?.value ?? 0;
}

async function handleApi(request: Request, env: Env, url: URL, requestId: string): Promise<Response> {
  const route = url.pathname;
  const method = request.method;

  if (route === '/api/health') {
    if (method !== 'GET' && method !== 'HEAD') return json({ error: 'Method not allowed' }, 405, requestId, { Allow: 'GET, HEAD' });
    return json({ ok: true, release: env.RELEASE_SHA }, 200, requestId);
  }

  if (route === '/api/stats') {
    if (method !== 'GET' && method !== 'HEAD') return json({ error: 'Method not allowed' }, 405, requestId, { Allow: 'GET, HEAD' });
    return json({ spies: await readSpies(env.DB) }, 200, requestId);
  }

  if (route === '/api/verdict') {
    if (method !== 'POST') return json({ error: 'Method not allowed' }, 405, requestId, { Allow: 'POST' });
    if (!isAllowedOrigin(request.headers.get('Origin'), url.origin)) {
      return json({ error: 'Foreign interference detected.' }, 403, requestId);
    }
    const key = request.headers.get('CF-Connecting-IP') ?? 'unknown';
    const { success } = await env.SPIN_LIMITER.limit({ key });
    if (!success) {
      return json({ error: 'Slow down, agent. Even counterintelligence needs a coffee break.' }, 429, requestId, { 'Retry-After': '60' });
    }
    const row = await env.DB
      .prepare("UPDATE counters SET value = value + 1 WHERE name = 'spies' RETURNING value")
      .first<{ value: number }>();
    if (!row) return json({ error: 'The evidence locker is jammed.' }, 500, requestId);
    return json({ spies: row.value, caseNumber: caseNumber(row.value) }, 200, requestId);
  }

  return json({ error: 'Not found' }, 404, requestId);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.hostname === `www.${APEX}`) {
      return withSecurityHeaders(Response.redirect(`https://${APEX}${url.pathname}${url.search}`, 301));
    }

    if (url.pathname.startsWith('/api/')) {
      const requestId = crypto.randomUUID();
      const started = Date.now();
      let response: Response;
      try {
        response = await handleApi(request, env, url, requestId);
      } catch {
        response = json({ error: 'Something went sideways in the war room.' }, 500, requestId);
      }
      console.log(JSON.stringify({ route: url.pathname, method: request.method, status: response.status, ms: Date.now() - started, requestId }));
      return withSecurityHeaders(response);
    }

    return withSecurityHeaders(await env.ASSETS.fetch(request));
  },
};
