import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import type { ProjectDto } from '@shared/schemas/project';
import { Breadcrumbs, DocumentBreadcrumbs } from '@/components/layout/Breadcrumbs';
import { projectKeys } from '@/hooks/useProjects';

const PROJECT: ProjectDto = {
  id: 'proj-1',
  name: 'Field Notes',
  slug: 'field-notes',
  description: null,
  createdAt: 0,
  updatedAt: 0,
};

function renderWithProject(project?: ProjectDto) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, queryFn: () => new Promise(() => {}) } },
  });
  if (project) queryClient.setQueryData(projectKeys.detail(project.id), project);
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <DocumentBreadcrumbs
          projectId="proj-1"
          title="Observations"
          currentTestId="document-title"
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Breadcrumbs', () => {
  it('links every ancestor and leaves the current page as plain text', () => {
    render(
      <MemoryRouter>
        <Breadcrumbs
          items={[
            { label: 'Projects', to: '/projects' },
            { label: 'Field Notes', to: '/projects/proj-1' },
            { label: 'Observations', testId: 'document-title' },
          ]}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'Projects' })).toHaveAttribute('href', '/projects');
    expect(screen.getByRole('link', { name: 'Field Notes' })).toHaveAttribute(
      'href',
      '/projects/proj-1',
    );
    // The current page must not be a link.
    expect(screen.queryByRole('link', { name: 'Observations' })).toBeNull();
    const current = screen.getByTestId('document-title');
    expect(current).toHaveTextContent('Observations');
    expect(current).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toBeInTheDocument();
  });

  it('keeps the document-title testid on the current segment', () => {
    renderWithProject(PROJECT);
    expect(screen.getByTestId('document-title')).toHaveTextContent('Observations');
    expect(screen.getByTestId('document-title').tagName).toBe('SPAN');
  });

  it('resolves the project name through the project query', () => {
    renderWithProject(PROJECT);
    expect(screen.getByRole('link', { name: 'Field Notes' })).toHaveAttribute(
      'href',
      '/projects/proj-1',
    );
  });

  it('shows a one-line placeholder for the project name while it loads', () => {
    renderWithProject();
    // No project name yet, but the trail and the current page are already there,
    // so the row keeps its height instead of jumping when the name arrives.
    expect(screen.queryByRole('link', { name: 'Field Notes' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Projects' })).toBeInTheDocument();
    expect(screen.getByTestId('document-title')).toHaveTextContent('Observations');
    expect(screen.getByTestId('breadcrumbs').querySelector('.animate-pulse')).not.toBeNull();
  });
});

describe('Breadcrumbs — editable current segment', () => {
  function EditableTrail({ onCommit }: { onCommit?: (value: string) => void }) {
    const [title, setTitle] = useState('Observations');
    return (
      <MemoryRouter>
        <Breadcrumbs
          items={[
            { label: 'Projects', to: '/projects' },
            { label: 'Field Notes', to: '/projects/proj-1' },
            {
              label: title,
              testId: 'title-input',
              edit: {
                label: 'Document title',
                placeholder: 'Untitled',
                onChange: setTitle,
                onCommit,
              },
            },
          ]}
        />
      </MemoryRouter>
    );
  }

  it('renders the current segment as a named, focusable field', async () => {
    render(<EditableTrail />);
    const field = screen.getByTestId('title-input');
    expect(field).toBe(screen.getByRole('textbox', { name: 'Document title' }));
    expect(field).toHaveValue('Observations');
    expect(field).toHaveAttribute('aria-current', 'page');
    // Reachable without a mouse.
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.tab();
    expect(field).toHaveFocus();
  });

  it('shows the title once — the width mirror is hidden from everyone', () => {
    render(<EditableTrail />);
    const trail = screen.getByTestId('breadcrumbs');

    // The mirror only exists to give the input a content-sized width. It is
    // aria-hidden and `invisible`, so the title reads once, from the field.
    const echoes = [...trail.querySelectorAll('*')].filter(
      (el) => el.children.length === 0 && el.textContent === 'Observations',
    );
    expect(echoes).toHaveLength(1);
    expect(echoes[0]).toHaveAttribute('aria-hidden', 'true');
    expect(echoes[0]).toHaveClass('invisible');
    expect(screen.getAllByDisplayValue('Observations')).toHaveLength(1);
  });

  it('reports every keystroke and commits on Enter', async () => {
    const onCommit = vi.fn();
    render(<EditableTrail onCommit={onCommit} />);
    const field = screen.getByTestId('title-input');

    await userEvent.clear(field);
    await userEvent.type(field, 'Renamed');
    expect(field).toHaveValue('Renamed');
    expect(onCommit).not.toHaveBeenCalled();

    await userEvent.keyboard('{Enter}');
    expect(onCommit).toHaveBeenCalledExactlyOnceWith('Renamed');
    expect(field).not.toHaveFocus();
  });

  it('commits on blur', async () => {
    const onCommit = vi.fn();
    render(<EditableTrail onCommit={onCommit} />);
    const field = screen.getByTestId('title-input');
    await userEvent.type(field, '!');
    await userEvent.tab();
    expect(onCommit).toHaveBeenCalledExactlyOnceWith('Observations!');
  });

  it('reverts to the value it was focused with on Escape', async () => {
    const onCommit = vi.fn();
    render(<EditableTrail onCommit={onCommit} />);
    const field = screen.getByTestId('title-input');

    await userEvent.clear(field);
    await userEvent.type(field, 'Throwaway');
    await userEvent.keyboard('{Escape}');

    expect(field).toHaveValue('Observations');
    // The commit must see the restored value, not the abandoned one.
    expect(onCommit).toHaveBeenCalledExactlyOnceWith('Observations');
  });

  it('keeps a placeholder so an emptied title stays clickable', async () => {
    render(<EditableTrail />);
    const field = screen.getByTestId('title-input');
    await userEvent.clear(field);
    expect(field).toHaveAttribute('placeholder', 'Untitled');
    expect(field).toHaveValue('');
  });
});
