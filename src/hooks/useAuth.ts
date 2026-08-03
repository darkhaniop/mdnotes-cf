import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { authApi } from '@/lib/api-client';
import { useAuthStore } from '@/lib/auth-store';

export function useAuth() {
  const user = useAuthStore((s) => s.user);
  const ready = useAuthStore((s) => s.ready);
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const logout = useCallback(async () => {
    await authApi.logout();
    queryClient.clear();
    void navigate('/', { replace: true });
  }, [navigate, queryClient]);

  return {
    user,
    ready,
    isAuthenticated: Boolean(accessToken),
    isGuest: user?.isGuest ?? false,
    logout,
  };
}
