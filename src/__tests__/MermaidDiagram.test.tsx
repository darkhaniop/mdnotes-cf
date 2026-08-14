import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const initialize = vi.fn();
const renderDiagram = vi.fn(async (id: string) => ({ svg: `<svg data-id="${id}"></svg>` }));

vi.mock('mermaid', () => ({ default: { initialize, render: renderDiagram } }));

const { MermaidDiagram } = await import('@/components/markdown/MermaidDiagram');

describe('MermaidDiagram', () => {
  beforeEach(() => {
    initialize.mockClear();
    renderDiagram.mockClear();
    // jsdom has no matchMedia, and the component resolves the active theme.
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
  });

  it('pins an explicit font instead of inheriting one', async () => {
    render(<MermaidDiagram code="graph TD; A-->B;" />);
    await waitFor(() => expect(initialize).toHaveBeenCalled());

    const config = initialize.mock.calls[0]![0] as {
      fontFamily?: string;
      themeVariables?: { fontFamily?: string; fontSize?: string };
    };

    // 'inherit' let the surrounding <pre> supply a monospace face that mermaid
    // had not measured against, so labels overflowed their node boxes and were
    // clipped on the right. Measurement and paint have to use one known font.
    expect(config.fontFamily).toBeTruthy();
    expect(config.fontFamily).not.toBe('inherit');
    expect(config.themeVariables?.fontFamily).toBe(config.fontFamily);
    expect(config.themeVariables?.fontSize).toBeTruthy();
  });

  it('degrades to an inline card when the diagram will not parse', async () => {
    renderDiagram.mockRejectedValueOnce(new Error('Parse error on line 2'));
    render(<MermaidDiagram code="graph TD; ???" />);
    await waitFor(() => expect(screen.getByTestId('mermaid-error')).toBeInTheDocument());
    expect(screen.getByTestId('mermaid-error')).toHaveTextContent('Parse error on line 2');
  });
});
