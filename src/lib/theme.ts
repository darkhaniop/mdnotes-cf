export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_PREFERENCES = ['system', 'light', 'dark'] as const satisfies ThemePreference[];

export const PREFERS_DARK_QUERY = '(prefers-color-scheme: dark)';

export function resolveTheme(preference: ThemePreference, prefersDark: boolean): ResolvedTheme {
  if (preference === 'light' || preference === 'dark') return preference;
  return prefersDark ? 'dark' : 'light';
}

export function prefersDarkNow(): boolean {
  return typeof window !== 'undefined' && window.matchMedia(PREFERS_DARK_QUERY).matches;
}

/**
 * Writes the resolved theme onto `<html>` as the `dark` / `light` class pair.
 *
 * The class is always set from the *resolved* value, never the preference, so
 * `dark:` variants and `.dark` overrides work identically for an explicit dark
 * choice and for "system" on a dark machine.
 *
 * Before this runs, `<html>` carries neither class and `index.css` falls back to
 * `light-dark()` under `color-scheme: light dark` — which is what keeps the very
 * first paint correct without an inline script (the CSP forbids one).
 */
export function applyTheme(preference: ThemePreference, prefersDark: boolean): ResolvedTheme {
  const resolved = resolveTheme(preference, prefersDark);
  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    root.classList.toggle('dark', resolved === 'dark');
    root.classList.toggle('light', resolved === 'light');
  }
  return resolved;
}
