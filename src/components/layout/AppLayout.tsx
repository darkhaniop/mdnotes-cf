import { Link, Outlet } from 'react-router';
import { NotebookPen } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';

export function AppLayout() {
  const { user, isGuest, logout } = useAuth();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="bg-background/80 sticky top-0 z-40 border-b backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-3">
          <Link to="/projects" className="flex items-center gap-2 font-semibold">
            <NotebookPen className="size-4" />
            mdnotes
          </Link>
          <div className="flex-1" />
          {isGuest ? (
            <>
              <Badge>Guest</Badge>
              <Button asChild size="sm" variant="outline">
                <Link to="/signup">Save your work</Link>
              </Button>
            </>
          ) : (
            <span className="text-muted-foreground hidden text-sm sm:inline" data-testid="user-email">
              {user?.email}
            </span>
          )}
          <Button size="sm" variant="ghost" onClick={() => void logout()}>
            Log out
          </Button>
        </div>
      </header>
      <main className="flex flex-1 flex-col">
        <Outlet />
      </main>
    </div>
  );
}
