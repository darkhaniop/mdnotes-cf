import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
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
