import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { ApiError, authApi } from '@/lib/api-client';
import { CredentialsForm } from '@/components/layout/CredentialsForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuthStore } from '@/lib/auth-store';

export function Signup() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const isGuest = user?.isGuest ?? false;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center p-6">
      <Card>
        <CardHeader>
          <CardTitle>{isGuest ? 'Save your work' : 'Sign up'}</CardTitle>
          <CardDescription>
            {isGuest
              ? 'Add an email and password to this guest session — your projects, documents and uploads will be kept.'
              : 'Create an account to keep your notebooks across devices.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <CredentialsForm
            submitLabel={isGuest ? 'Save my work' : 'Sign up'}
            autoComplete="new-password"
            onSubmit={async (values) => {
              try {
                if (isGuest) {
                  await authApi.upgrade(values);
                  toast.success('Account created — your work has been kept.');
                } else {
                  await authApi.signup(values);
                }
                void navigate('/projects', { replace: true });
              } catch (error) {
                toast.error(
                  error instanceof ApiError ? error.message : 'Could not sign up. Try again.',
                );
              }
            }}
          />
          <p className="text-muted-foreground text-sm">
            Already have an account?{' '}
            <Link className="underline underline-offset-4" to="/login">
              Log in
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
