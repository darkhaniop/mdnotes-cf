import type { AuthResponse, UserDto } from '@shared/schemas/auth';
import { authStore } from './auth-store';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: unknown;
  /** Set for FormData / raw bodies that must not be JSON-encoded. */
  raw?: boolean;
  /** Skips the 401 → refresh → replay dance (used by the auth calls themselves). */
  skipRefresh?: boolean;
};

const BASE = '/api';

/**
 * A single in-flight refresh shared by every concurrent 401, so a burst of
 * parallel queries produces one rotation rather than N racing ones (which would
 * invalidate each other, since refresh tokens are single-use).
 */
let refreshInFlight: Promise<boolean> | null = null;

export function refreshSession(): Promise<boolean> {
  refreshInFlight ??= (async () => {
    try {
      const res = await fetch(`${BASE}/auth/refresh`, {
        method: 'POST',
        credentials: 'same-origin',
      });
      if (!res.ok) {
        authStore.getState().clear();
        return false;
      }
      const body = (await res.json()) as AuthResponse;
      authStore.getState().setSession({ accessToken: body.accessToken, user: body.user });
      return true;
    } catch {
      authStore.getState().clear();
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

async function toApiError(res: Response): Promise<ApiError> {
  let code = 'http_error';
  let message = res.statusText || 'Request failed';
  let details: unknown;
  try {
    const body = (await res.json()) as { error?: string; message?: string; details?: unknown };
    code = body.error ?? code;
    message = body.message ?? message;
    details = body.details;
  } catch {
    /* non-JSON error body */
  }
  return new ApiError(res.status, code, message, details);
}

async function send(path: string, options: RequestOptions): Promise<Response> {
  const { body, raw, skipRefresh: _skip, headers, ...rest } = options;
  const h = new Headers(headers);
  const token = authStore.getState().accessToken;
  if (token) h.set('authorization', `Bearer ${token}`);
  let payload: BodyInit | undefined;
  if (body !== undefined) {
    if (raw) payload = body as BodyInit;
    else {
      h.set('content-type', 'application/json');
      payload = JSON.stringify(body);
    }
  }
  return fetch(`${BASE}${path}`, {
    ...rest,
    headers: h,
    body: payload,
    credentials: 'same-origin',
  });
}

export async function apiFetch(path: string, options: RequestOptions = {}): Promise<Response> {
  let res = await send(path, options);
  if (res.status === 401 && !options.skipRefresh) {
    const ok = await refreshSession();
    if (ok) res = await send(path, options);
  }
  return res;
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const res = await apiFetch(path, options);
  if (!res.ok) throw await toApiError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

function adoptSession(body: AuthResponse): AuthResponse {
  authStore.getState().setSession({ accessToken: body.accessToken, user: body.user });
  return body;
}

export const authApi = {
  guest: () =>
    api<AuthResponse>('/auth/guest', { method: 'POST', skipRefresh: true }).then(adoptSession),
  signup: (input: { email: string; password: string }) =>
    api<AuthResponse>('/auth/signup', { method: 'POST', body: input, skipRefresh: true }).then(
      adoptSession,
    ),
  login: (input: { email: string; password: string }) =>
    api<AuthResponse>('/auth/login', { method: 'POST', body: input, skipRefresh: true }).then(
      adoptSession,
    ),
  upgrade: (input: { email: string; password: string }) =>
    api<AuthResponse>('/auth/upgrade', { method: 'POST', body: input }).then(adoptSession),
  me: () => api<{ user: UserDto }>('/auth/me'),
  logout: async () => {
    try {
      await api('/auth/logout', { method: 'POST', skipRefresh: true });
    } finally {
      authStore.getState().clear();
    }
  },
};
