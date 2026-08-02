import type { Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import {
  ASSET_COOKIE,
  ASSET_COOKIE_PATH,
  ASSET_COOKIE_TTL_SECONDS,
  REFRESH_COOKIE,
  REFRESH_COOKIE_PATH,
  REFRESH_TOKEN_TTL_SECONDS,
} from '@shared/constants';

/**
 * `Secure` is dropped on plain-http localhost so the dev server and Playwright
 * work; everywhere else it is always on.
 */
function isSecureRequest(c: Context): boolean {
  const url = new URL(c.req.url);
  if (url.protocol === 'https:') return true;
  return !(url.hostname === 'localhost' || url.hostname === '127.0.0.1');
}

export function setRefreshCookie(c: Context, token: string): void {
  setCookie(c, REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: isSecureRequest(c),
    sameSite: 'Strict',
    path: REFRESH_COOKIE_PATH,
    maxAge: REFRESH_TOKEN_TTL_SECONDS,
  });
}

export function setAssetCookie(c: Context, value: string): void {
  setCookie(c, ASSET_COOKIE, value, {
    httpOnly: true,
    secure: isSecureRequest(c),
    sameSite: 'Lax',
    path: ASSET_COOKIE_PATH,
    maxAge: ASSET_COOKIE_TTL_SECONDS,
  });
}

export function readRefreshCookie(c: Context): string | undefined {
  return getCookie(c, REFRESH_COOKIE);
}

export function readAssetCookie(c: Context): string | undefined {
  return getCookie(c, ASSET_COOKIE);
}

export function clearAuthCookies(c: Context): void {
  deleteCookie(c, REFRESH_COOKIE, { path: REFRESH_COOKIE_PATH });
  deleteCookie(c, ASSET_COOKIE, { path: ASSET_COOKIE_PATH });
}
