import { Link, useParams } from 'react-router';
import { ChevronLeft, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
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
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link
          to={`/projects/${projectId}`}
          className="text-muted-foreground inline-flex items-center gap-1 text-sm hover:underline"
        >
          <ChevronLeft className="size-4" /> Back
        </Link>
        <Button asChild size="sm" data-testid="edit-document">
          <Link to={`/projects/${projectId}/docs/${docId}/edit`}>
            <Pencil /> Edit
          </Link>
        </Button>
      </div>
      <h1 className="mb-4 text-3xl font-semibold tracking-tight" data-testid="document-title">
        {document.title}
      </h1>
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
