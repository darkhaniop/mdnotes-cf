import { act, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { useApplyTheme, useResolvedTheme } from '@/hooks/useTheme';
import { applyTheme, PREFERS_DARK_QUERY, resolveTheme } from '@/lib/theme';
import { useUiStore } from '@/lib/ui-store';

/** jsdom has no matchMedia; this one is controllable and fires change events. */
function mockPrefersDark(initial: boolean) {
  const listeners = new Set<(e: MediaQueryListEvent) => void>();
  let matches = initial;
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      media: query,
      get matches() {
        return query === PREFERS_DARK_QUERY ? matches : false;
      },
      addEventListener: (_: string, cb: (e: MediaQueryListEvent) => void) => void listeners.add(cb),
      removeEventListener: (_: string, cb: (e: MediaQueryListEvent) => void) =>
        void listeners.delete(cb),
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })),
  );
  return {
    set(next: boolean) {
      matches = next;
      for (const cb of listeners) cb({ matches: next } as MediaQueryListEvent);
    },
  };
}

beforeEach(() => {
  document.documentElement.classList.remove('dark', 'light');
  useUiStore.setState({ theme: 'system' });
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('resolveTheme', () => {
  it('follows the system preference when set to system', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });

  it('ignores the system preference for an explicit choice', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });
});

describe('applyTheme', () => {
  it('writes the resolved theme onto <html>', () => {
    const root = document.documentElement;

    expect(applyTheme('dark', false)).toBe('dark');
    expect(root.classList.contains('dark')).toBe(true);
    expect(root.classList.contains('light')).toBe(false);

    expect(applyTheme('light', true)).toBe('light');
    expect(root.classList.contains('light')).toBe(true);
    expect(root.classList.contains('dark')).toBe(false);
  });

  it('resolves system before writing the class, so `dark` reflects what is in force', () => {
    const root = document.documentElement;
    applyTheme('system', true);
    expect(root.classList.contains('dark')).toBe(true);
    applyTheme('system', false);
    expect(root.classList.contains('dark')).toBe(false);
    expect(root.classList.contains('light')).toBe(true);
  });
});

describe('the ui store', () => {
  it('defaults to system and persists a change to localStorage', () => {
    expect(useUiStore.getState().theme).toBe('system');
    act(() => useUiStore.getState().setTheme('dark'));
    expect(useUiStore.getState().theme).toBe('dark');
    expect(JSON.parse(localStorage.getItem('mdnotes-ui')!).state.theme).toBe('dark');
  });
});

describe('useApplyTheme', () => {
  it('follows prefers-color-scheme live while set to system', () => {
    const media = mockPrefersDark(false);
    const { result } = renderHook(() => useApplyTheme());

    expect(result.current).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);

    act(() => media.set(true));
    expect(result.current).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('stops following the system once a theme is chosen', () => {
    const media = mockPrefersDark(true);
    const { result } = renderHook(() => useApplyTheme());
    expect(result.current).toBe('dark');

    act(() => useUiStore.getState().setTheme('light'));
    expect(result.current).toBe('light');
    expect(document.documentElement.classList.contains('light')).toBe(true);

    act(() => media.set(false));
    expect(result.current).toBe('light');
  });
});

describe('useResolvedTheme', () => {
  it('reports what mermaid and CodeMirror should render as', () => {
    mockPrefersDark(true);
    const { result } = renderHook(() => useResolvedTheme());
    expect(result.current).toBe('dark');
    act(() => useUiStore.getState().setTheme('light'));
    expect(result.current).toBe('light');
  });
});

describe('ThemeToggle', () => {
  it('offers system, light and dark, and records the choice', async () => {
    mockPrefersDark(false);
    render(<ThemeToggle />);

    await userEvent.click(screen.getByTestId('theme-toggle'));
    expect(screen.getByTestId('theme-system')).toBeInTheDocument();
    expect(screen.getByTestId('theme-light')).toBeInTheDocument();

    await userEvent.click(screen.getByTestId('theme-dark'));
    expect(useUiStore.getState().theme).toBe('dark');
    expect(screen.getByTestId('theme-toggle')).toHaveAttribute('data-theme', 'dark');
  });
});
