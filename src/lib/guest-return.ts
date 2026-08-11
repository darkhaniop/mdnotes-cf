/** Landing/auth screens: returning to one of these would be a loop, not an escape. */
const AUTH_PATHS = new Set(['/', '/login', '/signup']);

export const GUEST_RETURN_FALLBACK = '/projects';

/**
 * Resolves where "Continue as guest" should send someone, from the `from` that
 * the header link stashed in the router's location state.
 *
 * Only same-origin absolute paths are honoured — anything else (a full URL, a
 * protocol-relative `//host`, a missing value) falls back to the project list,
 * so a crafted history entry can never bounce a user off-site.
 */
export function resolveGuestReturnPath(state: unknown): string {
  const from = (state as { from?: unknown } | null | undefined)?.from;
  if (typeof from !== 'string') return GUEST_RETURN_FALLBACK;
  if (!from.startsWith('/') || from.startsWith('//')) return GUEST_RETURN_FALLBACK;
  const path = from.split('?')[0]!.split('#')[0]!;
  if (AUTH_PATHS.has(path)) return GUEST_RETURN_FALLBACK;
  return from;
}
