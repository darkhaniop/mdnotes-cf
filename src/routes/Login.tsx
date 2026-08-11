import { Link, useLocation, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { ApiError, authApi } from '@/lib/api-client';
import { ContinueAsGuest } from '@/components/layout/ContinueAsGuest';
import { CredentialsForm } from '@/components/layout/CredentialsForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuthStore } from '@/lib/auth-store';

export function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const hasGuestSession = useAuthStore((s) => Boolean(s.accessToken) && (s.user?.isGuest ?? false));

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center p-6">
      <Card>
        <CardHeader>
          <CardTitle>Log in</CardTitle>
          <CardDescription>Welcome back to your notebooks.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <CredentialsForm
            submitLabel="Log in"
            autoComplete="current-password"
            onSubmit={async (values) => {
              try {
                await authApi.login(values);
                void navigate('/projects', { replace: true });
              } catch (error) {
                toast.error(
                  error instanceof ApiError ? error.message : 'Could not log in. Try again.',
                );
              }
            }}
          />
          <ContinueAsGuest />
          <p className="text-muted-foreground text-sm">
            No account yet?{' '}
            <Link className="underline underline-offset-4" to="/signup" state={location.state}>
              Sign up
            </Link>
            {hasGuestSession ? null : (
              <>
                {' · '}
                <Link className="underline underline-offset-4" to="/">
                  Continue as guest
                </Link>
              </>
            )}
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
