import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MarkdownPreview } from '@/components/markdown/MarkdownPreview';

// mermaid pulls in ~500 KB and needs real layout APIs; the component contract
// (a fence with language-mermaid renders the diagram component) is what matters.
vi.mock('@/components/markdown/MermaidDiagram', () => ({
  MermaidDiagram: ({ code }: { code: string }) => (
    <div data-testid="mermaid-diagram" data-code={code} />
  ),
}));

function renderMd(content: string) {
  return render(<MarkdownPreview content={content} projectId="proj-1" />);
}

describe('MarkdownPreview', () => {
  it('renders headings and inline formatting', () => {
    renderMd('# Title\n\nSome **bold** text.');
    expect(screen.getByRole('heading', { level: 1, name: 'Title' })).toBeInTheDocument();
    expect(screen.getByText('bold').tagName).toBe('STRONG');
  });

  it('renders GFM tables', () => {
    renderMd('| a | b |\n| - | - |\n| 1 | 2 |');
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getAllByRole('columnheader')).toHaveLength(2);
    expect(screen.getByRole('cell', { name: '1' })).toBeInTheDocument();
  });

  it('renders GFM task lists', () => {
    const { container } = renderMd('- [x] done\n- [ ] todo');
    const boxes = container.querySelectorAll('input[type="checkbox"]');
    expect(boxes).toHaveLength(2);
    expect((boxes[0] as HTMLInputElement).checked).toBe(true);
  });

  it('renders inline and display math through KaTeX', () => {
    // remark-math only treats a $$ fence on its own lines as display math.
    const { container } = renderMd('Energy is $E=mc^2$ and\n\n$$\n\\int_0^1 x\\,dx\n$$');
    expect(container.querySelectorAll('.katex').length).toBeGreaterThanOrEqual(2);
    expect(container.querySelector('.katex-display')).not.toBeNull();
  });

  it('highlights fenced code', () => {
    const { container } = renderMd('```js\nconst x = 1;\n```');
    expect(container.querySelector('code.language-js')).not.toBeNull();
    expect(container.querySelector('.hljs-keyword')).not.toBeNull();
  });

  it('routes mermaid fences to the diagram component', () => {
    renderMd('```mermaid\ngraph TD; A-->B;\n```');
    const diagram = screen.getByTestId('mermaid-diagram');
    expect(diagram).toBeInTheDocument();
    expect(diagram.dataset.code).toBe('graph TD; A-->B;');
  });

  it('rewrites bare image references to the project asset route', () => {
    renderMd('![a diagram](diagram.png)');
    const img = screen.getByAltText('a diagram');
    expect(img.getAttribute('src')).toBe('/api/projects/proj-1/assets/by-name/diagram.png');
    expect(img.getAttribute('loading')).toBe('lazy');
  });

  it('renders a PDF link as an inline preview card', () => {
    renderMd('[spec](spec.pdf)');
    const card = screen.getByTestId('pdf-card');
    expect(card).toBeInTheDocument();
    expect(card.querySelector('object')?.getAttribute('data')).toBe(
      '/api/projects/proj-1/assets/by-name/spec.pdf',
    );
  });

  it('strips script tags', () => {
    const { container } = renderMd('before\n\n<script>window.pwned = 1</script>\n\nafter');
    expect(container.querySelector('script')).toBeNull();
    expect(container.textContent).toContain('before');
  });

  it('does not render raw HTML at all, so inline event handlers never reach the DOM', () => {
    const { container } = renderMd('<img src="x" onerror="window.pwned = 1">\n\nafter');
    expect(container.querySelector('img')).toBeNull();
    expect(container.innerHTML).not.toContain('onerror');
    expect(container.textContent).toContain('after');
  });

  it('drops javascript: links', () => {
    renderMd('[click](javascript:alert(1))');
    const link = screen.getByText('click').closest('a');
    expect(link?.getAttribute('href') ?? '').toBe('');
  });

  it('renders nothing harmful for empty content', () => {
    const { container } = renderMd('');
    expect(container.querySelector('[data-testid="markdown-preview"]')?.textContent).toBe('');
  });
});
