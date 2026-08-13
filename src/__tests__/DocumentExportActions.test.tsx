import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { DocumentExportActions } from '@/components/project/DocumentExportActions';
import * as documentExport from '@/lib/document-export';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('DocumentExportActions', () => {
  it('labels both buttons for screen readers and for hover', () => {
    render(<DocumentExportActions title="Field Notes" content="# hi" />);
    for (const [testId, name] of [
      ['download-document', 'Download as Markdown'],
      ['copy-document', 'Copy raw Markdown'],
    ] as const) {
      const button = screen.getByTestId(testId);
      expect(button).toBe(screen.getByRole('button', { name }));
      // No tooltip primitive in components/ui, so `title` is the hover hint.
      expect(button).toHaveAttribute('title', name);
    }
  });

  it('downloads the current buffer under the slugified title', async () => {
    const download = vi.spyOn(documentExport, 'downloadMarkdown').mockImplementation(() => {});
    render(<DocumentExportActions title="Field Notes" content="# unsaved edits" />);

    await userEvent.click(screen.getByTestId('download-document'));
    expect(download).toHaveBeenCalledExactlyOnceWith('Field Notes', '# unsaved edits');
  });

  it('confirms a successful copy with a toast', async () => {
    vi.spyOn(documentExport, 'copyMarkdownToClipboard').mockResolvedValue(true);
    render(<DocumentExportActions title="Field Notes" content="# hi" />);

    await userEvent.click(screen.getByTestId('copy-document'));
    expect(toast.success).toHaveBeenCalledWith('Markdown copied to the clipboard');
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('explains the failure instead of going quiet when the clipboard is unavailable', async () => {
    vi.spyOn(documentExport, 'copyMarkdownToClipboard').mockResolvedValue(false);
    render(<DocumentExportActions title="Field Notes" content="# hi" />);

    await userEvent.click(screen.getByTestId('copy-document'));
    expect(toast.success).not.toHaveBeenCalled();
    expect(vi.mocked(toast.error).mock.calls[0]![0]).toMatch(/secure page.*Download/i);
  });
});
