import { Fragment, useRef } from 'react';
import { Link } from 'react-router';
import { ChevronRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useProject } from '@/hooks/useProjects';

export type CrumbEdit = {
  /** Accessible name for the field — the label text itself is the value. */
  label: string;
  onChange: (next: string) => void;
  /**
   * Enter or blur. Receives the value being committed rather than reading it
   * from the caller's state, which is still the pre-Escape one at that point.
   */
  onCommit?: (value: string) => void;
  placeholder?: string;
  /** Hover hint; falls back to `label`. */
  hint?: string;
};

export type Crumb = {
  label: string;
  /** Omitted for the current page, which renders as plain text rather than a link. */
  to?: string;
  testId?: string;
  /** Shows a fixed-height placeholder in place of the label while it loads. */
  loading?: boolean;
  /** Turns the segment into an in-place editable field. Only valid without `to`. */
  edit?: CrumbEdit;
};

function EditableCrumb({ value, edit, testId }: { value: string; edit: CrumbEdit; testId?: string }) {
  /** The value as of the last focus, restored by Escape. */
  const revertTo = useRef(value);
  /** What blur will commit. Escape rewrites it before blurring. */
  const pending = useRef(value);

  return (
    <span className="relative inline-grid min-w-[5rem] max-w-[16rem] items-center">
      <span
        aria-hidden="true"
        className="invisible col-start-1 row-start-1 truncate px-1.5 font-medium whitespace-pre"
      >
        {value || edit.placeholder || ''}
      </span>
      <input
        type="text"
        value={value}
        data-testid={testId}
        aria-label={edit.label}
        aria-current="page"
        placeholder={edit.placeholder}
        // Nothing else in the header is editable, so the field needs to say so
        // on hover; there is no tooltip primitive in components/ui.
        title={edit.hint ?? edit.label}
        className="text-foreground hover:bg-accent focus:bg-background col-start-1 row-start-1 w-full min-w-0 truncate rounded-md border border-transparent bg-transparent px-1.5 py-0.5 font-medium focus:border-[var(--border)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        onFocus={() => {
          revertTo.current = value;
          pending.current = value;
        }}
        onChange={(event) => {
          pending.current = event.target.value;
          edit.onChange(event.target.value);
        }}
        onBlur={() => edit.onCommit?.(pending.current)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            event.currentTarget.blur();
          } else if (event.key === 'Escape') {
            event.preventDefault();
            pending.current = revertTo.current;
            edit.onChange(revertTo.current);
            event.currentTarget.blur();
          }
        }}
      />
    </span>
  );
}

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
              ) : item.edit ? (
                <EditableCrumb value={item.label} edit={item.edit} testId={item.testId} />
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
  edit,
}: {
  projectId: string;
  title: string;
  className?: string;
  currentTestId?: string;
  edit?: CrumbEdit;
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
        { label: title, testId: currentTestId, edit },
      ]}
    />
  );
}
