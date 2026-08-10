import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MARKDOWN_SNIPPETS } from '@/components/editor/markdown-snippets';
import { MarkdownPreview } from '@/components/markdown/MarkdownPreview';

vi.mock('@/components/markdown/MermaidDiagram', () => ({
  MermaidDiagram: ({ code }: { code: string }) => (
    <div data-testid="mermaid-diagram" data-code={code} />
  ),
}));

function snippet(id: string): string {
  const found = MARKDOWN_SNIPPETS.find((s) => s.id === id);
  if (!found) throw new Error(`no snippet ${id}`);
  return found.text;
}

/** Mirrors MarkdownEditorHandle.insertAtCursor on a plain string. */
function insertAtCursor(value: string, cursor: number, text: string): string {
  return value.slice(0, cursor) + text + value.slice(cursor);
}

function renderSnippet(id: string) {
  return render(<MarkdownPreview content={snippet(id)} projectId="proj-1" />);
}

describe('markdown snippets', () => {
  it('covers every block the helper panel promises, with unique ids', () => {
    const ids = MARKDOWN_SNIPPETS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(
      expect.arrayContaining([
        'mermaid',
        'table',
        'equation',
        'inline-math',
        'code',
        'blockquote',
        'task-list',
        'hr',
      ]),
    );
    for (const s of MARKDOWN_SNIPPETS) {
      expect(s.label.length).toBeGreaterThan(0);
      expect(s.text.length).toBeGreaterThan(0);
    }
  });

  it('pads block snippets so they survive insertion mid-line', () => {
    const inserted = insertAtCursor('Intro text', 'Intro text'.length, snippet('table'));
    const lines = inserted.split('\n');
    expect(lines[0]).toBe('Intro text');
    // The table starts on its own line and the block is closed off.
    expect(lines[1]).toBe('| Column A | Column B |');
    expect(inserted.endsWith('\n')).toBe(true);
  });

  it('keeps inline math inline', () => {
    expect(snippet('inline-math')).not.toContain('\n');
    expect(insertAtCursor('Recall that ', 12, snippet('inline-math'))).toBe(
      'Recall that $E = mc^2$',
    );
  });

  it('inserts a working three-node mermaid diagram, not an empty fence', () => {
    renderSnippet('mermaid');
    const code = screen.getByTestId('mermaid-diagram').getAttribute('data-code') ?? '';
    expect(code.startsWith('flowchart TD')).toBe(true);
    expect(code).toContain('A[Idea] --> B[Draft]');
    expect(code).toContain('B --> C[Publish]');
    // Three distinct nodes.
    expect(new Set(code.match(/\b[A-C](?=[[\]])/g)).size).toBe(3);
  });

  it('inserts a 2-column, 2-row GFM table', () => {
    renderSnippet('table');
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('columnheader')).toHaveLength(2);
    expect(within(table).getAllByRole('row')).toHaveLength(3); // header + 2 rows
  });

  it('inserts block math that KaTeX renders', () => {
    const { container } = renderSnippet('equation');
    expect(container.querySelector('.katex-display')).not.toBeNull();
  });

  it('inserts inline math that KaTeX renders', () => {
    const { container } = renderSnippet('inline-math');
    expect(container.querySelector('.katex')).not.toBeNull();
    expect(container.querySelector('.katex-display')).toBeNull();
  });

  it('inserts a highlighted code block', () => {
    const { container } = renderSnippet('code');
    expect(container.querySelector('pre code')).not.toBeNull();
    expect(container.querySelector('.hljs-keyword')).not.toBeNull();
  });

  it('inserts a blockquote, a task list and a horizontal rule', () => {
    const { container: quote } = renderSnippet('blockquote');
    expect(quote.querySelector('blockquote')).not.toBeNull();

    const { container: tasks } = renderSnippet('task-list');
    const boxes = tasks.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    expect(boxes).toHaveLength(2);
    expect(boxes[0]!.checked).toBe(false);
    expect(boxes[1]!.checked).toBe(true);

    const { container: rule } = renderSnippet('hr');
    expect(rule.querySelector('hr')).not.toBeNull();
  });
});
