import { defaultSchema } from 'rehype-sanitize';

const SAFE_ABSOLUTE = /^(https?:|mailto:|tel:)/i;
const SAFE_DATA_IMAGE = /^data:image\/(png|jpeg|gif|webp);base64,/i;

/**
 * Mirrors worker/lib/assetName.ts:referenceToFilename. The two must agree, or a
 * reference the client rewrites will not resolve on the server.
 */
export function referenceToFilename(reference: string): string {
  const aliases: Record<string, string> = { jpeg: 'jpg' };
  let value = reference;
  try {
    value = decodeURIComponent(reference);
  } catch {
    /* malformed escapes: use the raw value */
  }
  const bare = value.split(/[?#]/)[0]!.split(/[\\/]/).pop() ?? value;
  const dot = bare.lastIndexOf('.');
  const rawBase = dot > 0 ? bare.slice(0, dot) : bare;
  const rawExt = dot > 0 ? bare.slice(dot + 1).toLowerCase() : '';
  const ext = aliases[rawExt] ?? rawExt;
  const base =
    rawBase
      .normalize('NFKD')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80)
      .replace(/-+$/g, '') || 'file';
  return ext ? `${base}.${ext}` : base;
}

/**
 * react-markdown `urlTransform`. Absolute and data-image URLs pass through (and
 * are then sanitized); everything else is treated as a reference into this
 * project's flat asset name space.
 */
export function makeUrlTransform(projectId: string) {
  return (url: string): string => {
    if (!url) return '';
    const trimmed = url.trim();
    if (trimmed.startsWith('#')) return trimmed;
    if (SAFE_ABSOLUTE.test(trimmed)) return trimmed;
    if (SAFE_DATA_IMAGE.test(trimmed)) return trimmed;
    // Any other scheme (javascript:, vbscript:, data:text/html, …) is dropped.
    if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return '';
    if (trimmed.startsWith('/api/projects/')) return trimmed;
    return `/api/projects/${projectId}/assets/by-name/${encodeURIComponent(
      referenceToFilename(trimmed),
    )}`;
  };
}

const MATH_CLASSES = [
  ['className', 'math', 'math-inline', 'math-display', 'language-math'],
] as const;

/**
 * rehype-sanitize runs BEFORE katex and highlight, so the schema only has to
 * survive user input — but it must keep the `math-inline` / `math-display`
 * class names remark-math emits, otherwise rehype-katex cannot find the nodes,
 * and `language-*` so highlight.js can pick a grammar.
 */
export const sanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    span: [...(defaultSchema.attributes?.span ?? []), ...MATH_CLASSES],
    div: [...(defaultSchema.attributes?.div ?? []), ...MATH_CLASSES],
    // remark-math emits `<pre><code class="language-math math-display">` for
    // block math, so the math classes have to survive on code/pre too.
    code: [...(defaultSchema.attributes?.code ?? []), ...MATH_CLASSES],
    pre: [...(defaultSchema.attributes?.pre ?? []), ...MATH_CLASSES],
    img: [...(defaultSchema.attributes?.img ?? []), 'loading', 'width', 'height'],
    input: [...(defaultSchema.attributes?.input ?? []), 'checked', 'disabled', 'type'],
  },
  tagNames: [...(defaultSchema.tagNames ?? [])],
};

/** True for links that point at a PDF, before or after the url transform. */
export function isPdfHref(href: string | undefined): boolean {
  if (!href) return false;
  let value = href;
  try {
    value = decodeURIComponent(href);
  } catch {
    /* keep the raw value */
  }
  return /\.pdf($|[?#])/i.test(value);
}
