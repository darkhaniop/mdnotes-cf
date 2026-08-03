import { Link, useRouteError } from 'react-router';
import { Button } from '@/components/ui/button';

export function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-4 p-6">
      <h1 className="text-3xl font-semibold">Nothing here</h1>
      <p className="text-muted-foreground">That page does not exist.</p>
      <Button asChild className="self-start">
        <Link to="/projects">Back to projects</Link>
      </Button>
    </main>
  );
}

export function RouteErrorBoundary() {
  const error = useRouteError();
  const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-4 p-6">
      <h1 className="text-3xl font-semibold">Something broke</h1>
      <p className="text-muted-foreground text-sm">{message}</p>
      <Button asChild className="self-start">
        <Link to="/projects">Back to projects</Link>
      </Button>
    </main>
  );
}
