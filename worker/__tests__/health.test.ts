import { env, SELF } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

describe('health', () => {
  it('responds ok', async () => {
    const res = await SELF.fetch('https://example.com/api/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, service: 'mdnotes' });
  });

  it('has bindings', () => {
    expect(env.DB).toBeDefined();
    expect(env.BUCKET).toBeDefined();
  });
});
