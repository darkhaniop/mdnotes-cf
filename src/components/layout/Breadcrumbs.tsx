import { Fragment } from 'react';
import { Link } from 'react-router';
import { ChevronRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useProject } from '@/hooks/useProjects';

export type Crumb = {
  label: string;
  /** Omitted for the current page, which renders as plain text rather than a link. */
  to?: string;
  testId?: string;
  /** Shows a fixed-height placeholder in place of the label while it loads. */
  loading?: boolean;
};

export function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  return (
    <nav aria-label="Breadcrumb" className={cn('min-w-0', className)}>
      {/* leading-5 + an h-4 skeleton keep the row exactly one line tall whether
          or not the ancestor labels have loaded, so nothing jumps. */}
      <ol
        data-testid="breadcrumbs"
        className="text-muted-foreground flex min-w-0 items-center gap-1 text-sm leading-5"
      >
        {items.map((item, index) => (
          <Fragment key={`${index}-${item.to ?? 'current'}`}>
            {index > 0 ? (
              <ChevronRight aria-hidden="true" className="size-3.5 shrink-0 opacity-60" />
            ) : null}
            <li className="min-w-0">
              {item.loading ? (
                <Skeleton className="h-4 w-24" data-testid={item.testId} />
              ) : item.to ? (
                <Link
                  to={item.to}
                  data-testid={item.testId}
                  className="hover:text-foreground block truncate hover:underline"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  aria-current="page"
                  data-testid={item.testId}
                  className="text-foreground block truncate font-medium"
                >
                  {item.label}
                </span>
              )}
            </li>
          </Fragment>
        ))}
      </ol>
    </nav>
  );
}

/**
 * `Projects / <project> / <document>` for both the view and edit routes. The
 * project name comes from the same TanStack query the project screen uses, so
 * arriving from the project page renders it straight from cache.
 */
export function DocumentBreadcrumbs({
  projectId,
  title,
  className,
  currentTestId,
}: {
  projectId: string;
  title: string;
  className?: string;
  currentTestId?: string;
}) {
  const { data: project, isPending } = useProject(projectId);

  return (
    <Breadcrumbs
      className={className}
      items={[
        { label: 'Projects', to: '/projects' },
        {
          label: project?.name ?? '',
          to: `/projects/${projectId}`,
          loading: isPending && !project,
        },
        { label: title, testId: currentTestId },
      ]}
    />
  );
}
