import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  copyMarkdownToClipboard,
  downloadMarkdown,
  markdownFilename,
} from '@/lib/document-export';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('markdownFilename', () => {
  it('slugifies the title and adds the extension', () => {
    expect(markdownFilename('Field Notes')).toBe('field-notes.md');
    expect(markdownFilename('Q3 Report — Draft #2!')).toBe('q3-report-draft-2.md');
  });

  it('folds accents rather than splitting them into separators', () => {
    expect(markdownFilename('Ünïcode Notes')).toBe('unicode-notes.md');
  });

  it('collapses runs of separators and trims the ends', () => {
    expect(markdownFilename('  ...Hello   World...  ')).toBe('hello-world.md');
  });

  it('falls back for an empty or unslugifiable title', () => {
    expect(markdownFilename('')).toBe('untitled.md');
    expect(markdownFilename('   ')).toBe('untitled.md');
    expect(markdownFilename('***')).toBe('untitled.md');
    // The placeholder the editor shows already slugifies to the fallback.
    expect(markdownFilename('Untitled')).toBe('untitled.md');
  });

  it('caps the length without leaving a trailing separator', () => {
    const name = markdownFilename(`${'a'.repeat(80)} tail`);
    expect(name).toBe(`${'a'.repeat(80)}.md`);
    expect(name.endsWith('-.md')).toBe(false);
  });
});

describe('downloadMarkdown', () => {
  it('clicks a download link for a markdown blob and revokes the url after', async () => {
    const createObjectURL = vi.fn((_blob: Blob) => 'blob:mock');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', Object.assign(Object.create(URL), { createObjectURL, revokeObjectURL }));

    const clicked: HTMLAnchorElement[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clicked.push(this);
    });

    downloadMarkdown('Field Notes', '# hi');

    expect(clicked).toHaveLength(1);
    expect(clicked[0]!.download).toBe('field-notes.md');
    expect(clicked[0]!.href).toBe('blob:mock');
    const blob = createObjectURL.mock.calls[0]![0];
    expect(blob.type).toBe('text/markdown;charset=utf-8');
    expect(await blob.text()).toBe('# hi');

    // The link never stays in the document, and the url is released next tick.
    expect(document.querySelector('a')).toBeNull();
    expect(revokeObjectURL).not.toHaveBeenCalled();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock');
  });
});

describe('copyMarkdownToClipboard', () => {
  it('writes the source to the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });

    await expect(copyMarkdownToClipboard('# hi')).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith('# hi');
  });

  it('reports failure instead of throwing when the clipboard rejects', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('NotAllowedError'));
    vi.stubGlobal('navigator', { clipboard: { writeText } });

    await expect(copyMarkdownToClipboard('# hi')).resolves.toBe(false);
  });

  it('reports failure when the clipboard api is missing (insecure context)', async () => {
    vi.stubGlobal('navigator', {});
    await expect(copyMarkdownToClipboard('# hi')).resolves.toBe(false);

    // Some environments expose `clipboard` without `writeText`.
    vi.stubGlobal('navigator', { clipboard: {} });
    await expect(copyMarkdownToClipboard('# hi')).resolves.toBe(false);
  });
});
