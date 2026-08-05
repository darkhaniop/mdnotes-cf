import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../index';

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'none'",
  "form-action 'self'",
].join('; ');

const HEADERS: Record<string, string> = {
  'content-security-policy': CSP,
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'x-frame-options': 'DENY',
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  'cross-origin-opener-policy': 'same-origin',
};

export const CONTENT_SECURITY_POLICY = CSP;

const isDev = Boolean(import.meta.env?.DEV);

export const securityHeaders: MiddlewareHandler<AppEnv> = async (c, next) => {
  await next();

  const original = c.res;
  const headers = new Headers(original.headers);

  for (const [name, value] of Object.entries(HEADERS)) {
    if (name === 'content-security-policy' && isDev) continue;
    if (!headers.has(name)) headers.set(name, value);
  }
  // HSTS only makes sense once the response is actually over TLS.
  if (new URL(c.req.url).protocol === 'https:') {
    headers.set('strict-transport-security', 'max-age=31536000; includeSubDomains');
  }

  c.res = new Response(original.body, {
    status: original.status,
    statusText: original.statusText,
    headers,
  });
};
