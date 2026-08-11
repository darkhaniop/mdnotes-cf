import { useEffect, useId, useRef, useState } from 'react';
import { useResolvedTheme } from '@/hooks/useTheme';

let mermaidReady: Promise<typeof import('mermaid').default> | null = null;

/** ~500 KB, so it is only pulled in when a document actually contains a diagram. */
function loadMermaid() {
  mermaidReady ??= import('mermaid').then(({ default: mermaid }) => mermaid);
  return mermaidReady;
}

export function MermaidDiagram({ code }: { code: string }) {
  const reactId = useId();
  const id = `mermaid-${reactId.replace(/[^a-zA-Z0-9]/g, '')}`;
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const container = useRef<HTMLDivElement>(null);
  const theme = useResolvedTheme();

  useEffect(() => {
    let cancelled = false;
    const source = code.trim();
    if (!source) {
      setSvg(null);
      setError(null);
      return;
    }
    void (async () => {
      try {
        const mermaid = await loadMermaid();
        // Re-initialised per render rather than once at import: the diagram has
        // to follow the active theme, and mermaid bakes the palette into the SVG
        // it emits.
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
          theme: theme === 'dark' ? 'dark' : 'default',
          fontFamily: 'inherit',
        });
        const { svg: rendered } = await mermaid.render(id, source);
        if (!cancelled) {
          setSvg(rendered);
          setError(null);
        }
      } catch (err) {
        // Half-typed diagrams throw on every keystroke in the live preview, so
        // this must degrade to an inline card rather than an error boundary.
        if (!cancelled) {
          setSvg(null);
          setError(err instanceof Error ? err.message : 'Could not render this diagram');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code, id, theme]);

  if (error) {
    return (
      <div
        role="note"
        data-testid="mermaid-error"
        className="border-destructive/40 bg-destructive/10 my-3 rounded-md border p-3 text-sm"
      >
        <p className="font-medium">Diagram error</p>
        <pre className="mt-1 text-xs whitespace-pre-wrap">{error}</pre>
      </div>
    );
  }

  return (
    <div
      ref={container}
      data-testid="mermaid-diagram"
      className="my-3 flex justify-center overflow-x-auto"
      // Mermaid output is generated from already-sanitized text with
      // securityLevel: 'strict', which strips scripts and inline handlers.
      dangerouslySetInnerHTML={svg ? { __html: svg } : undefined}
    >
      {svg ? undefined : <span className="text-muted-foreground text-xs">Rendering diagram…</span>}
    </div>
  );
}
