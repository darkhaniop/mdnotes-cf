import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { NotebookPen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { authApi } from '@/lib/api-client';
import { useAuthStore } from '@/lib/auth-store';

export function Landing() {
  const navigate = useNavigate();
  const accessToken = useAuthStore((s) => s.accessToken);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (accessToken) void navigate('/projects', { replace: true });
  }, [accessToken, navigate]);

  async function continueAsGuest() {
    setBusy(true);
    try {
      await authApi.guest();
      void navigate('/projects', { replace: true });
    } catch {
      toast.error('Could not start a guest session. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center gap-8 p-6">
      <div className="space-y-3">
        <NotebookPen className="size-8" />
        <h1 className="text-4xl font-semibold tracking-tight">mdnotes</h1>
        <p className="text-muted-foreground">
          Markdown editor with preview. Start writing immediately — no account needed, and you can
          keep everything later by signing up.
        </p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button onClick={() => void continueAsGuest()} disabled={busy} size="lg">
          {busy ? 'Starting…' : 'Continue as guest'}
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link to="/login">Log in</Link>
        </Button>
        <Button asChild variant="ghost" size="lg">
          <Link to="/signup">Sign up</Link>
        </Button>
      </div>
    </main>
  );
}
