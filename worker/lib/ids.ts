const BASE64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

export function newId(): string {
  return crypto.randomUUID();
}

/** Opaque, high-entropy token used as the refresh cookie value. */
export function newOpaqueToken(bytes = 32): string {
  const raw = crypto.getRandomValues(new Uint8Array(bytes));
  let out = '';
  for (const b of raw) out += BASE64URL[b & 63];
  return out;
}

export async function sha256Hex(input: string | ArrayBuffer): Promise<string> {
  const data = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Lowercase, ASCII-only slug. Falls back to a short random suffix when the
 * input has nothing slug-worthy in it (e.g. a title written entirely in CJK).
 */
export function slugify(input: string, fallback = 'untitled'): string {
  const slug = input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
    .replace(/-+$/g, '');
  return slug || `${fallback}-${newOpaqueToken(6).toLowerCase()}`;
}
