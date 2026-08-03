import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router';
import { refreshSession } from '@/lib/api-client';
import { useAuthStore } from '@/lib/auth-store';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Bootstraps the session from the refresh cookie before rendering, so a reload
 * on a deep link doesn't flash the login page.
 */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const ready = useAuthStore((s) => s.ready);
  const [bootstrapping, setBootstrapping] = useState(!ready && !accessToken);
  const location = useLocation();

  useEffect(() => {
    if (ready || accessToken) {
      setBootstrapping(false);
      return;
    }
    let cancelled = false;
    void refreshSession().finally(() => {
      if (!cancelled) setBootstrapping(false);
    });
    return () => {
      cancelled = true;
    };
  }, [ready, accessToken]);

  if (bootstrapping) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-3 p-8" aria-busy="true">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (!accessToken) {
    return <Navigate to="/" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
