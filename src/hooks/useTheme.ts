import { useEffect } from 'react';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useUiStore } from '@/lib/ui-store';
import {
  applyTheme,
  PREFERS_DARK_QUERY,
  resolveTheme,
  type ResolvedTheme,
  type ThemePreference,
} from '@/lib/theme';

/**
 * The theme actually in force. "system" tracks `prefers-color-scheme` live,
 * because useMediaQuery subscribes to the media query rather than reading it
 * once.
 */
export function useResolvedTheme(): ResolvedTheme {
  const theme = useUiStore((s) => s.theme);
  const prefersDark = useMediaQuery(PREFERS_DARK_QUERY);
  return resolveTheme(theme, prefersDark);
}

/** Mounted once, at the app root: keeps the `<html>` class in step. */
export function useApplyTheme(): ResolvedTheme {
  const theme = useUiStore((s) => s.theme);
  const prefersDark = useMediaQuery(PREFERS_DARK_QUERY);

  useEffect(() => {
    applyTheme(theme, prefersDark);
  }, [theme, prefersDark]);

  return resolveTheme(theme, prefersDark);
}

export function useTheme(): {
  theme: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: ThemePreference) => void;
} {
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  return { theme, resolvedTheme: useResolvedTheme(), setTheme };
}
