import { Link, useParams } from 'react-router';
import { Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { DocumentBreadcrumbs } from '@/components/layout/Breadcrumbs';
import { DocumentExportActions } from '@/components/project/DocumentExportActions';
import { MarkdownPreview } from '@/components/markdown/MarkdownPreview';
import { useDocument } from '@/hooks/useDocuments';

export function DocumentView() {
  const { projectId = '', docId = '' } = useParams();
  const { data: document, isPending, isError } = useDocument(docId);

  if (isPending) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-3 p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isError || !document) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-3 p-6">
        <h1 className="text-2xl font-semibold">Document not found</h1>
        <Button asChild variant="outline">
          <Link to={`/projects/${projectId}`}>Back to the project</Link>
        </Button>
      </div>
    );
  }

  return (
    <article className="mx-auto w-full max-w-3xl flex-1 p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <DocumentBreadcrumbs
          projectId={projectId}
          title={document.title}
          currentTestId="document-title"
          className="min-w-0 flex-1"
        />
        <div className="flex shrink-0 items-center gap-2">
          <DocumentExportActions title={document.title} content={document.content} />
          <Button asChild size="sm" data-testid="edit-document">
            <Link to={`/projects/${projectId}/docs/${docId}/edit`}>
              <Pencil /> Edit
            </Link>
          </Button>
        </div>
      </div>
      {document.content.trim() ? (
        <MarkdownPreview content={document.content} projectId={projectId} />
      ) : (
        <p className="text-muted-foreground text-sm">
          This document is empty. Hit Edit to start writing.
        </p>
      )}
    </article>
  );
}
