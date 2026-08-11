import { useLocation, useNavigate } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/lib/auth-store';
import { resolveGuestReturnPath } from '@/lib/guest-return';

/**
 * Escape hatch from /signup and /login for a guest who only wanted a look at
 * the form. Rendered only when a live guest session exists.
 *
 * This is navigation and nothing else: no `/auth/guest` call, no logout, no
 * store mutation. The in-memory access token and the refresh cookie are left
 * exactly as they were, so the same guest lands back on their own work.
 */
export function ContinueAsGuest() {
  const navigate = useNavigate();
  const location = useLocation();
  const accessToken = useAuthStore((s) => s.accessToken);
  const isGuest = useAuthStore((s) => s.user?.isGuest ?? false);

  if (!accessToken || !isGuest) return null;

  const to = resolveGuestReturnPath(location.state);

  return (
    <Button
      type="button"
      variant="ghost"
      className="w-full"
      data-testid="continue-as-guest"
      onClick={() => void navigate(to, { replace: true })}
    >
      <ArrowLeft /> Continue as guest
    </Button>
  );
}
