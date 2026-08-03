import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { ApiError, authApi } from '@/lib/api-client';
import { CredentialsForm } from '@/components/layout/CredentialsForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function Login() {
  const navigate = useNavigate();

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
          <p className="text-muted-foreground text-sm">
            No account yet?{' '}
            <Link className="underline underline-offset-4" to="/signup">
              Sign up
            </Link>
            {' · '}
            <Link className="underline underline-offset-4" to="/">
              Continue as guest
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
