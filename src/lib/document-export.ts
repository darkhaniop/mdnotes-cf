/**
 * Client-side export of a document's markdown source. Shared by view mode and
 * edit mode so both act on whatever text is on screen — in the editor that is
 * the unsaved buffer, in view mode the loaded document.
 */

const MARKDOWN_MIME = 'text/markdown;charset=utf-8';
const FALLBACK_BASENAME = 'untitled';

export function markdownFilename(title: string): string {
  const base =
    title
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80)
      .replace(/-+$/g, '') || FALLBACK_BASENAME;
  return `${base}.md`;
}

export function downloadMarkdown(title: string, content: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: MARKDOWN_MIME }));
  const link = document.createElement('a');
  link.href = url;
  link.download = markdownFilename(title);
  link.rel = 'noopener';
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export async function copyMarkdownToClipboard(content: string): Promise<boolean> {
  const clipboard = globalThis.navigator?.clipboard;
  if (typeof clipboard?.writeText !== 'function') return false;
  try {
    await clipboard.writeText(content);
    return true;
  } catch {
    return false;
  }
}
