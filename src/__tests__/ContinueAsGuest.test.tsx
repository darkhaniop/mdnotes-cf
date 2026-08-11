import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { UserDto } from '@shared/schemas/auth';
import { ContinueAsGuest } from '@/components/layout/ContinueAsGuest';
import { useAuthStore } from '@/lib/auth-store';
import { resolveGuestReturnPath } from '@/lib/guest-return';

const GUEST: UserDto = {
  id: 'u-1',
  email: null,
  isGuest: true,
  createdAt: 0,
};

function Elsewhere() {
  const location = useLocation();
  return <div data-testid="landed">{location.pathname}</div>;
}

function renderAt(from?: string) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/signup', state: from ? { from } : null }]}>
      <Routes>
        <Route path="/signup" element={<ContinueAsGuest />} />
        <Route path="*" element={<Elsewhere />} />
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => {
  useAuthStore.setState({ accessToken: null, user: null, ready: false });
  vi.restoreAllMocks();
});

describe('resolveGuestReturnPath', () => {
  it('returns the stashed path', () => {
    expect(resolveGuestReturnPath({ from: '/projects/p1/docs/d1' })).toBe('/projects/p1/docs/d1');
    expect(resolveGuestReturnPath({ from: '/projects/p1?tab=files' })).toBe(
      '/projects/p1?tab=files',
    );
  });

  it('falls back to the project list when there is nothing usable', () => {
    expect(resolveGuestReturnPath(undefined)).toBe('/projects');
    expect(resolveGuestReturnPath(null)).toBe('/projects');
    expect(resolveGuestReturnPath({})).toBe('/projects');
    expect(resolveGuestReturnPath({ from: 42 })).toBe('/projects');
  });

  it('never returns to an auth screen or off-site', () => {
    expect(resolveGuestReturnPath({ from: '/signup' })).toBe('/projects');
    expect(resolveGuestReturnPath({ from: '/login' })).toBe('/projects');
    expect(resolveGuestReturnPath({ from: '/' })).toBe('/projects');
    expect(resolveGuestReturnPath({ from: '//evil.example.com' })).toBe('/projects');
    expect(resolveGuestReturnPath({ from: 'https://evil.example.com' })).toBe('/projects');
  });
});

describe('ContinueAsGuest', () => {
  it('is hidden when there is no session', () => {
    renderAt('/projects/p1');
    expect(screen.queryByTestId('continue-as-guest')).toBeNull();
  });

  it('is hidden for a signed-up user', () => {
    useAuthStore.setState({
      accessToken: 'tok',
      user: { ...GUEST, isGuest: false, email: 'a@b.c' },
      ready: true,
    });
    renderAt('/projects/p1');
    expect(screen.queryByTestId('continue-as-guest')).toBeNull();
  });

  it('returns a live guest to where they came from', async () => {
    useAuthStore.setState({ accessToken: 'tok', user: GUEST, ready: true });
    renderAt('/projects/p1/docs/d1');

    await userEvent.click(screen.getByTestId('continue-as-guest'));
    expect(screen.getByTestId('landed')).toHaveTextContent('/projects/p1/docs/d1');
  });

  it('falls back to the project list when it does not know where they came from', async () => {
    useAuthStore.setState({ accessToken: 'tok', user: GUEST, ready: true });
    renderAt();

    await userEvent.click(screen.getByTestId('continue-as-guest'));
    expect(screen.getByTestId('landed')).toHaveTextContent('/projects');
  });

  it('navigates only — it never touches the session', async () => {
    useAuthStore.setState({ accessToken: 'tok', user: GUEST, ready: true });
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    renderAt('/projects/p1');

    await userEvent.click(screen.getByTestId('continue-as-guest'));

    expect(fetchSpy).not.toHaveBeenCalled();
    const state = useAuthStore.getState();
    expect(state.accessToken).toBe('tok');
    expect(state.user).toEqual(GUEST);
  });
});
