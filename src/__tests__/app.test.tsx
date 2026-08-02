import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { App } from '@/App';

describe('App', () => {
  it('renders the title', () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response('{}'))));
    render(<App />);
    expect(screen.getByRole('heading', { name: 'mdnotes' })).toBeInTheDocument();
  });
});
