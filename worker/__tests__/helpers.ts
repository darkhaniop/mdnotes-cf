import { SELF } from 'cloudflare:test';

export const ORIGIN = 'https://mdnotes.test';

export type Client = {
  accessToken: string;
  userId: string;
  cookies: string;
  fetch: (path: string, init?: RequestInit) => Promise<Response>;
};

function mergeCookies(existing: string, res: Response): string {
  const jar = new Map<string, string>();
  for (const pair of existing.split('; ').filter(Boolean)) {
    const idx = pair.indexOf('=');
    jar.set(pair.slice(0, idx), pair.slice(idx + 1));
  }
  for (const raw of res.headers.getSetCookie()) {
    const [nameValue] = raw.split(';');
    const idx = nameValue!.indexOf('=');
    const name = nameValue!.slice(0, idx).trim();
    const value = nameValue!.slice(idx + 1);
    if (value === '' || /Max-Age=0/i.test(raw)) jar.delete(name);
    else jar.set(name, value);
  }
  return [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
}

export function apiFetch(path: string, init: RequestInit = {}, cookies = ''): Promise<Response> {
  const headers = new Headers(init.headers);
  if (cookies) headers.set('cookie', cookies);
  return SELF.fetch(`${ORIGIN}${path}`, { ...init, headers, redirect: 'manual' });
}

/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- test helper: callers assert on shape */
export async function json(res: Response): Promise<any> {
  return res.json();
}

/** Signs in as a fresh guest and returns a cookie-carrying, token-carrying client. */
export async function guestClient(): Promise<Client> {
  const res = await apiFetch('/api/auth/guest', { method: 'POST' });
  if (res.status !== 200) throw new Error(`guest login failed: ${res.status}`);
  const body = (await res.json()) as { accessToken: string; user: { id: string } };
  const client: Client = {
    accessToken: body.accessToken,
    userId: body.user.id,
    cookies: mergeCookies('', res),
    fetch: async (path, init = {}) => {
      const headers = new Headers(init.headers);
      headers.set('authorization', `Bearer ${client.accessToken}`);
      const r = await apiFetch(path, { ...init, headers }, client.cookies);
      client.cookies = mergeCookies(client.cookies, r);
      return r;
    },
  };
  return client;
}

export function uniqueEmail(prefix = 'user'): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}@example.com`;
}
