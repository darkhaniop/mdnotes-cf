/**
 * The markdown blocks that are tedious to type from memory. Each `text` is
 * inserted verbatim at the CodeMirror cursor through the same
 * `MarkdownEditorHandle.insertAtCursor` the asset panel uses.
 *
 * Every block example is deliberately a *working* one — a mermaid fence with a
 * real three-node flowchart, a table with real rows — so the preview shows
 * something immediately instead of an empty shell.
 */
export type MarkdownSnippet = {
  id: string;
  label: string;
  text: string;
};

/**
 * Block snippets are padded with a newline on each side so they land on their
 * own lines wherever the cursor happens to be. Inline snippets are not.
 */
function block(...lines: string[]): string {
  return `\n${lines.join('\n')}\n`;
}

export const MARKDOWN_SNIPPETS: MarkdownSnippet[] = [
  {
    id: 'mermaid',
    label: 'Mermaid diagram',
    text: block(
      '```mermaid',
      'flowchart TD',
      '  A[Idea] --> B[Draft]',
      '  B --> C[Publish]',
      '```',
    ),
  },
  {
    id: 'table',
    label: 'Table',
    text: block(
      '| Column A | Column B |',
      '| --- | --- |',
      '| Row 1 | Value |',
      '| Row 2 | Value |',
    ),
  },
  {
    id: 'equation',
    label: 'Block equation',
    // Double backslashes: these are TeX control sequences, not JS escapes.
    text: block('$$', '\\int_0^1 x^2 \\, dx = \\frac{1}{3}', '$$'),
  },
  {
    id: 'inline-math',
    label: 'Inline math',
    text: '$E = mc^2$',
  },
  {
    id: 'code',
    label: 'Code block',
    text: block('```ts', "const answer = 6 * 7;", '```'),
  },
  {
    id: 'blockquote',
    label: 'Blockquote',
    text: block('> A quote worth keeping.'),
  },
  {
    id: 'task-list',
    label: 'Task list',
    text: block('- [ ] First task', '- [x] Finished task'),
  },
  {
    id: 'hr',
    label: 'Horizontal rule',
    text: block('---'),
  },
];
