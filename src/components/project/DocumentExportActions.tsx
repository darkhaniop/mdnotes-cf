import { useCallback } from 'react';
import { toast } from 'sonner';
import { Copy, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { copyMarkdownToClipboard, downloadMarkdown } from '@/lib/document-export';

export type DocumentExportActionsProps = {
  /** Names the downloaded file; the caller passes the live title in edit mode. */
  title: string;
  /** The markdown source to export — the editor buffer, unsaved edits included. */
  content: string;
};

/**
 * Download / copy-raw pair, shared by the view and edit toolbars. There is no
 * tooltip primitive in `components/ui`, so the hover hint is a plain `title`
 * attribute and the accessible name comes from `aria-label`.
 */
export function DocumentExportActions({ title, content }: DocumentExportActionsProps) {
  const copy = useCallback(async () => {
    if (await copyMarkdownToClipboard(content)) {
      toast.success('Markdown copied to the clipboard');
    } else {
      toast.error(
        'Could not reach the clipboard. Copying needs a secure page (https or localhost) — use Download instead.',
      );
    }
  }, [content]);

  return (
    <>
      <Button
        type="button"
        size="icon"
        variant="outline"
        className="size-8"
        data-testid="download-document"
        aria-label="Download as Markdown"
        title="Download as Markdown"
        onClick={() => downloadMarkdown(title, content)}
      >
        <Download />
      </Button>
      <Button
        type="button"
        size="icon"
        variant="outline"
        className="size-8"
        data-testid="copy-document"
        aria-label="Copy raw Markdown"
        title="Copy raw Markdown"
        onClick={() => void copy()}
      >
        <Copy />
      </Button>
    </>
  );
}
