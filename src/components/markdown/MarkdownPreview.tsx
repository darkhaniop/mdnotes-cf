import { memo, useMemo, useState } from 'react';
import Markdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeSanitize from 'rehype-sanitize';
import rehypeKatex from 'rehype-katex';
import rehypeHighlight from 'rehype-highlight';
import { Download, ExternalLink, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isPdfHref, makeUrlTransform, sanitizeSchema } from '@/lib/markdown';
import { MermaidDiagram } from './MermaidDiagram';

function BrokenImage({ alt }: { alt?: string }) {
  return (
    <span
      data-testid="broken-image"
      className="text-muted-foreground bg-muted my-2 inline-flex items-center gap-2 rounded-md border border-dashed px-3 py-2 text-xs"
    >
      <FileText className="size-3" /> Missing file{alt ? `: ${alt}` : ''}
    </span>
  );
}

function AssetImage({ src, alt }: { src?: string; alt?: string }) {
  const [broken, setBroken] = useState(false);
  if (!src || broken) return <BrokenImage alt={alt} />;
  return (
    <img
      src={src}
      alt={alt ?? ''}
      loading="lazy"
      onError={() => setBroken(true)}
      className="my-2 max-w-full rounded-md"
    />
  );
}

function PdfCard({ href, label }: { href: string; label: string }) {
  return (
    <span className="my-3 block rounded-lg border p-3" data-testid="pdf-card">
      <span className="mb-2 flex items-center gap-2 text-sm font-medium">
        <FileText className="size-4" /> {label}
      </span>
      <object data={href} type="application/pdf" className="h-96 w-full rounded">
        <span className="text-muted-foreground text-xs">
          Your browser cannot display PDFs inline.
        </span>
      </object>
      <span className="mt-2 flex gap-3 text-xs">
        <a className="inline-flex items-center gap-1 underline" href={href} target="_blank" rel="noreferrer">
          <ExternalLink className="size-3" /> Open
        </a>
        <a className="inline-flex items-center gap-1 underline" href={href} download={label}>
          <Download className="size-3" /> Download
        </a>
      </span>
    </span>
  );
}

export type MarkdownPreviewProps = {
  content: string;
  projectId: string;
  className?: string;
};

/**
 * Order matters: sanitize first, then let KaTeX and highlight.js emit their own
 * (trusted) markup from already-clean text. Sanitizing afterwards would strip
 * KaTeX's spans.
 */
export const MarkdownPreview = memo(function MarkdownPreview({
  content,
  projectId,
  className,
}: MarkdownPreviewProps) {
  const urlTransform = useMemo(() => makeUrlTransform(projectId), [projectId]);

  const components = useMemo<Components>(
    () => ({
      code({ className: codeClass, children, ...props }) {
        const language = /language-(\w+)/.exec(codeClass ?? '')?.[1];
        if (language === 'mermaid') {
          // MermaidDiagram itself dynamic-imports mermaid, so the ~500 KB
          // library stays out of the main bundle.
          return <MermaidDiagram code={String(children).replace(/\n$/, '')} />;
        }
        return (
          <code className={codeClass} {...props}>
            {children}
          </code>
        );
      },
      img: ({ src, alt }) => <AssetImage src={typeof src === 'string' ? src : undefined} alt={alt} />,
      a: ({ href, children, ...props }) => {
        if (typeof href === 'string' && isPdfHref(href)) {
          const label = typeof children === 'string' && children ? children : 'PDF';
          return <PdfCard href={href} label={label} />;
        }
        return (
          <a href={href} target="_blank" rel="noreferrer noopener" {...props}>
            {children}
          </a>
        );
      },
    }),
    [],
  );

  return (
    <div
      data-testid="markdown-preview"
      className={cn('mdnotes-prose max-w-none text-sm leading-relaxed', className)}
    >
      <Markdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[[rehypeSanitize, sanitizeSchema], rehypeKatex, rehypeHighlight]}
        urlTransform={urlTransform}
        components={components}
      >
        {content}
      </Markdown>
    </div>
  );
});
