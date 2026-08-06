import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { apiFetch, guestClient, json, uniqueEmail } from './helpers';
import {
  DEFAULT_PBKDF2_ITERATIONS,
  hashPassword,
  resolveIterations,
  verifyPassword,
} from '../lib/password';
import { signAssetCookie, verifyAssetCookie } from '../lib/jwt';

const REFRESH_COOKIE = /mdn_rt=([^;]+)/;

function refreshCookieFrom(res: Response): string {
  const raw = res.headers.getSetCookie().find((c) => c.startsWith('mdn_rt='));
  if (!raw) throw new Error('no refresh cookie set');
  return raw.match(REFRESH_COOKIE)![1]!;
}

describe('password hashing', () => {
  it('round-trips and rejects the wrong password', async () => {
    const hash = await hashPassword('correct horse battery', 10_000);
    expect(hash).toMatch(/^pbkdf2\$sha256\$10000\$/);
    expect(await verifyPassword('correct horse battery', hash)).toBe(true);
    expect(await verifyPassword('wrong', hash)).toBe(false);
  });

  it('rejects malformed stored hashes', async () => {
    expect(await verifyPassword('x', 'garbage')).toBe(false);
    expect(await verifyPassword('x', 'bcrypt$sha256$1$a$b')).toBe(false);
  });

  it('honours the iteration count baked into the stored hash', async () => {
    const hash = await hashPassword('pw', 5_000);
    expect(await verifyPassword('pw', hash)).toBe(true);
  });

  it('resolveIterations falls back to the default for junk input', () => {
    expect(resolveIterations('25000')).toBe(25_000);
    expect(resolveIterations(undefined)).toBe(DEFAULT_PBKDF2_ITERATIONS);
    expect(resolveIterations('12')).toBe(DEFAULT_PBKDF2_ITERATIONS);
  });

  /**
   * The Workers Free plan caps CPU at 10 ms/request. This reports the wall time
   * for one PBKDF2 hash at the configured iteration count so the number is
   * visible in CI output rather than discovered in production.
   */
  it('reports PBKDF2 timing at the configured iteration count', async () => {
    const configured = resolveIterations(env.PBKDF2_ITERATIONS);
    const runs = 5;
    const time = async (iterations: number) => {
      const start = Date.now();
      for (let i = 0; i < runs; i++) await hashPassword('benchmark-password', iterations);
      return (Date.now() - start) / runs;
    };
    const perHash = await time(configured);
    console.log(
      `PBKDF2 ${configured} iterations: ~${perHash.toFixed(1)} ms per hash ` +
        `(Workers Free plan allows 10 ms CPU per request)`,
    );
    console.log(`PBKDF2 100000 iterations: ~${(await time(100_000)).toFixed(1)} ms per hash`);
    expect(perHash).toBeLessThan(2000);
  });
});

describe('asset cookie', () => {
  it('round-trips and rejects tampering', async () => {
    const secret = 'sekrit';
    const value = await signAssetCookie(secret, 'user-1');
    expect(await verifyAssetCookie(secret, value)).toBe('user-1');
    expect(await verifyAssetCookie('other', value)).toBeNull();
    expect(await verifyAssetCookie(secret, value.replace('user-1', 'user-2'))).toBeNull();
  });

  it('rejects an expired cookie', async () => {
    const value = await signAssetCookie('sekrit', 'user-1', -10);
    expect(await verifyAssetCookie('sekrit', value)).toBeNull();
  });
});

describe('POST /api/auth/guest', () => {
  it('creates a guest user with both cookies and a token', async () => {
    const res = await apiFetch('/api/auth/guest', { method: 'POST' });
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.user.isGuest).toBe(true);
    expect(body.user.email).toBeNull();
    expect(body.accessToken).toBeTruthy();
    const cookies = res.headers.getSetCookie().join('\n');
    expect(cookies).toMatch(/mdn_rt=/);
    expect(cookies).toMatch(/mdn_at=/);
    expect(cookies).toMatch(/HttpOnly/i);
  });
});

describe('signup / login', () => {
  it('signs up, rejects a duplicate email, then logs in', async () => {
    const email = uniqueEmail();
    const signup = await apiFetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password: 'hunter2hunter2' }),
    });
    expect(signup.status).toBe(200);
    expect((await json(signup)).user.isGuest).toBe(false);

    const dup = await apiFetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password: 'hunter2hunter2' }),
    });
    expect(dup.status).toBe(409);
    expect((await json(dup)).error).toBe('email_taken');

    const login = await apiFetch('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: email.toUpperCase(), password: 'hunter2hunter2' }),
    });
    expect(login.status).toBe(200);

    const bad = await apiFetch('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password: 'not-the-password' }),
    });
    expect(bad.status).toBe(401);
  });

  it('rejects short passwords and bad emails', async () => {
    const res = await apiFetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'nope', password: 'short' }),
    });
    expect(res.status).toBe(400);
  });
});

describe('refresh rotation', () => {
  it('rotates the token and rejects the old one', async () => {
    const first = await apiFetch('/api/auth/guest', { method: 'POST' });
    const original = refreshCookieFrom(first);

    const rotated = await apiFetch(
      '/api/auth/refresh',
      { method: 'POST' },
      `mdn_rt=${original}`,
    );
    expect(rotated.status).toBe(200);
    const next = refreshCookieFrom(rotated);
    expect(next).not.toBe(original);

    const replay = await apiFetch('/api/auth/refresh', { method: 'POST' }, `mdn_rt=${original}`);
    expect(replay.status).toBe(401);

    const fresh = await apiFetch('/api/auth/refresh', { method: 'POST' }, `mdn_rt=${next}`);
    expect(fresh.status).toBe(200);
  });

  it('401s with no cookie at all', async () => {
    const res = await apiFetch('/api/auth/refresh', { method: 'POST' });
    expect(res.status).toBe(401);
  });

  it('logout invalidates the refresh token', async () => {
    const first = await apiFetch('/api/auth/guest', { method: 'POST' });
    const token = refreshCookieFrom(first);
    const out = await apiFetch('/api/auth/logout', { method: 'POST' }, `mdn_rt=${token}`);
    expect(out.status).toBe(200);
    const after = await apiFetch('/api/auth/refresh', { method: 'POST' }, `mdn_rt=${token}`);
    expect(after.status).toBe(401);
  });
});

describe('GET /api/auth/me', () => {
  it('requires a bearer token', async () => {
    expect((await apiFetch('/api/auth/me')).status).toBe(401);
    expect(
      (await apiFetch('/api/auth/me', { headers: { authorization: 'Bearer nonsense' } })).status,
    ).toBe(401);
  });

  it('returns the current user', async () => {
    const client = await guestClient();
    const res = await client.fetch('/api/auth/me');
    expect(res.status).toBe(200);
    expect((await json(res)).user.id).toBe(client.userId);
  });
});

describe('POST /api/auth/upgrade', () => {
  it('upgrades the guest row in place and keeps the same user id', async () => {
    const client = await guestClient();
    const email = uniqueEmail('upgraded');
    const res = await client.fetch('/api/auth/upgrade', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password: 'hunter2hunter2' }),
    });
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.user.id).toBe(client.userId);
    expect(body.user.isGuest).toBe(false);
    expect(body.user.email).toBe(email);

    const login = await apiFetch('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password: 'hunter2hunter2' }),
    });
    expect(login.status).toBe(200);
    expect((await json(login)).user.id).toBe(client.userId);
  });

  it('409s when the caller is already registered', async () => {
    const client = await guestClient();
    await client.fetch('/api/auth/upgrade', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: uniqueEmail(), password: 'hunter2hunter2' }),
    });
    const again = await client.fetch('/api/auth/upgrade', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: uniqueEmail(), password: 'hunter2hunter2' }),
    });
    expect(again.status).toBe(409);
    expect((await json(again)).error).toBe('already_registered');
  });

  it('409s when the email belongs to someone else', async () => {
    const email = uniqueEmail('taken');
    await apiFetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password: 'hunter2hunter2' }),
    });
    const client = await guestClient();
    const res = await client.fetch('/api/auth/upgrade', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password: 'hunter2hunter2' }),
    });
    expect(res.status).toBe(409);
    expect((await json(res)).error).toBe('email_taken');
  });

  it('requires authentication', async () => {
    const res = await apiFetch('/api/auth/upgrade', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: uniqueEmail(), password: 'hunter2hunter2' }),
    });
    expect(res.status).toBe(401);
  });
});

describe('rate limiting', () => {
  it('429s after too many failed logins from one client', async () => {
    let sawLimit = false;
    for (let i = 0; i < 14; i++) {
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.9' },
        body: JSON.stringify({ email: 'nobody@example.com', password: 'whatever123' }),
      });
      if (res.status === 429) {
        sawLimit = true;
        expect(res.headers.get('Retry-After')).toBeTruthy();
        break;
      }
    }
    expect(sawLimit).toBe(true);
  });
});
