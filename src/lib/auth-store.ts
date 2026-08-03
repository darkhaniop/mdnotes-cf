import { create } from 'zustand';
import type { UserDto } from '@shared/schemas/auth';

type AuthState = {
  /** In memory only — never localStorage. The refresh cookie is what survives a reload. */
  accessToken: string | null;
  user: UserDto | null;
  /** False until the initial /auth/refresh bootstrap has settled. */
  ready: boolean;
  setSession: (session: { accessToken: string; user: UserDto }) => void;
  setUser: (user: UserDto) => void;
  clear: () => void;
  setReady: (ready: boolean) => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  ready: false,
  setSession: ({ accessToken, user }) => set({ accessToken, user, ready: true }),
  setUser: (user) => set({ user }),
  clear: () => set({ accessToken: null, user: null, ready: true }),
  setReady: (ready) => set({ ready }),
}));

export const authStore = useAuthStore;
