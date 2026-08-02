import { useEffect, useState } from 'react';

export function App() {
  const [health, setHealth] = useState<string>('checking…');

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then((d) => setHealth(JSON.stringify(d)))
      .catch(() => setHealth('unreachable'));
  }, []);

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-3 p-8">
      <h1 className="text-3xl font-semibold">mdnotes</h1>
      <p className="text-muted-foreground text-sm">Scaffold is up.</p>
      <pre className="bg-card rounded-md border p-3 text-xs">{health}</pre>
    </main>
  );
}
