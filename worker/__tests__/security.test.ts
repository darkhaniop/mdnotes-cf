import { describe, expect, it } from 'vitest';
import { apiFetch, guestClient } from './helpers';
import { CONTENT_SECURITY_POLICY } from '../middleware/security';

describe('security headers', () => {
  it('are attached to API responses', async () => {
    const res = await apiFetch('/api/health');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('x-frame-options')).toBe('DENY');
    expect(res.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
    expect(res.headers.get('cross-origin-opener-policy')).toBe('same-origin');
  });

  it('set HSTS on https requests', async () => {
    const res = await apiFetch('/api/health');
    expect(res.headers.get('strict-transport-security')).toContain('max-age=31536000');
  });

  it('define a policy that blocks inline and third-party scripts', () => {
    expect(CONTENT_SECURITY_POLICY).toContain("script-src 'self'");
    expect(CONTENT_SECURITY_POLICY).not.toContain("script-src 'self' 'unsafe-inline'");
    expect(CONTENT_SECURITY_POLICY).toContain("frame-ancestors 'none'");
    expect(CONTENT_SECURITY_POLICY).toContain("base-uri 'none'");
    // KaTeX and Mermaid emit inline style attributes, so styles must stay open.
    expect(CONTENT_SECURITY_POLICY).toContain("style-src 'self' 'unsafe-inline'");
  });
});

describe('routing', () => {
  it('404s unknown API routes as JSON rather than falling through to the SPA', async () => {
    const res = await apiFetch('/api/definitely-not-a-route');
    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(await res.json()).toEqual({ error: 'not_found' });
  });

  it('keeps the error envelope shape for handled failures', async () => {
    const client = await guestClient();
    const res = await client.fetch(`/api/projects/${crypto.randomUUID()}`);
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: string; message: string };
    expect(body.error).toBe('project_not_found');
    expect(typeof body.message).toBe('string');
  });
});
