import { SignJWT, jwtVerify } from 'jose';
import { ACCESS_TOKEN_TTL_SECONDS, ASSET_COOKIE_TTL_SECONDS } from '@shared/constants';

const ISSUER = 'mdnotes';
const AUDIENCE = 'mdnotes-api';

function key(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export type AccessClaims = { sub: string; isGuest: boolean };

export async function signAccessToken(
  secret: string,
  claims: AccessClaims,
  ttlSeconds = ACCESS_TOKEN_TTL_SECONDS,
): Promise<string> {
  return new SignJWT({ isGuest: claims.isGuest })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(claims.sub)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(key(secret));
}

export async function verifyAccessToken(
  secret: string,
  token: string,
): Promise<AccessClaims | null> {
  try {
    const { payload } = await jwtVerify(token, key(secret), {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: ['HS256'],
    });
    if (!payload.sub) return null;
    return { sub: payload.sub, isGuest: payload.isGuest === true };
  } catch {
    return null;
  }
}

/**
 * Stateless `userId.exp.sig` value for the `mdn_at` cookie. `<img>` and
 * `<object>` cannot send an Authorization header, so asset GETs accept this
 * instead. It is deliberately not a JWT: it grants read access only, and only
 * on the asset routes.
 */
export async function signAssetCookie(
  secret: string,
  userId: string,
  ttlSeconds = ASSET_COOKIE_TTL_SECONDS,
): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = `${userId}.${exp}`;
  return `${payload}.${await hmac(secret, payload)}`;
}

export async function verifyAssetCookie(secret: string, value: string): Promise<string | null> {
  const idx = value.lastIndexOf('.');
  if (idx < 0) return null;
  const payload = value.slice(0, idx);
  const sig = value.slice(idx + 1);
  const expected = await hmac(secret, payload);
  if (!constantTimeEqual(sig, expected)) return null;
  const [userId, expRaw] = payload.split('.');
  if (!userId || !expRaw) return null;
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp * 1000 < Date.now()) return null;
  return userId;
}

async function hmac(secret: string, payload: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(payload));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
