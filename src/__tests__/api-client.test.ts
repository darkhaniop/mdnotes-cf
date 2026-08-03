import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, api, refreshSession } from '@/lib/api-client';
import { authStore } from '@/lib/auth-store';

const user = { id: 'u1', email: null, isGuest: true, createdAt: 0 };

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  authStore.setState({ accessToken: 'stale-token', user, ready: true });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('api()', () => {
  it('attaches the bearer token', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    await api('/projects');

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/projects');
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer stale-token');
  });

  it('throws an ApiError carrying the server code', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ error: 'email_taken', message: 'nope' }, 409)),
    );
    await expect(api('/auth/signup', { method: 'POST', skipRefresh: true })).rejects.toMatchObject({
      status: 409,
      code: 'email_taken',
      message: 'nope',
    });
  });

  it('refreshes once on 401 and replays the request', async () => {
    const calls: string[] = [];
    const fetchMock = vi.fn(async (url: string) => {
      calls.push(url);
      if (url === '/api/auth/refresh') {
        return jsonResponse({ accessToken: 'fresh-token', user, expiresIn: 900 });
      }
      const auth = calls.filter((c) => c === '/api/auth/refresh').length;
      return auth === 0 ? jsonResponse({ error: 'invalid_token' }, 401) : jsonResponse({ ok: true });
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(api('/projects')).resolves.toEqual({ ok: true });
    expect(calls).toEqual(['/api/projects', '/api/auth/refresh', '/api/projects']);
    expect(authStore.getState().accessToken).toBe('fresh-token');
  });

  it('de-duplicates concurrent refreshes into one call', async () => {
    let refreshCount = 0;
    const fetchMock = vi.fn(async (url: string) => {
      if (url === '/api/auth/refresh') {
        refreshCount += 1;
        await new Promise((r) => setTimeout(r, 5));
        return jsonResponse({ accessToken: 'fresh-token', user, expiresIn: 900 });
      }
      return authStore.getState().accessToken === 'fresh-token'
        ? jsonResponse({ ok: true })
        : jsonResponse({ error: 'invalid_token' }, 401);
    });
    vi.stubGlobal('fetch', fetchMock);

    await Promise.all([api('/projects'), api('/documents'), api('/assets')]);
    expect(refreshCount).toBe(1);
  });

  it('clears the session when the refresh itself fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url === '/api/auth/refresh'
          ? jsonResponse({ error: 'invalid_refresh_token' }, 401)
          : jsonResponse({ error: 'invalid_token' }, 401),
      ),
    );

    await expect(api('/projects')).rejects.toBeInstanceOf(ApiError);
    expect(authStore.getState().accessToken).toBeNull();
    expect(authStore.getState().user).toBeNull();
  });

  it('does not attempt a refresh when skipRefresh is set', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ error: 'invalid_credentials' }, 401));
    vi.stubGlobal('fetch', fetchMock);
    await expect(api('/auth/login', { method: 'POST', skipRefresh: true })).rejects.toBeInstanceOf(
      ApiError,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('refreshSession()', () => {
  it('adopts the returned session', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ accessToken: 'abc', user, expiresIn: 900 })),
    );
    await expect(refreshSession()).resolves.toBe(true);
    expect(authStore.getState().accessToken).toBe('abc');
  });

  it('reports failure and clears state on a network error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline');
      }),
    );
    await expect(refreshSession()).resolves.toBe(false);
    expect(authStore.getState().accessToken).toBeNull();
  });
});
