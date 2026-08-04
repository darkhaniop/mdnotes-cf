import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { FilePlus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useCreateDocument, useDeleteDocument, useDocuments } from '@/hooks/useDocuments';

export function DocumentList({ projectId }: { projectId: string }) {
  const { data: documents, isPending } = useDocuments(projectId);
  const createDocument = useCreateDocument(projectId);
  const deleteDocument = useDeleteDocument(projectId);
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [pendingDelete, setPendingDelete] = useState<{ id: string; title: string } | null>(null);

  return (
    <section aria-label="Documents" className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">Documents</h2>
        <Button
          size="sm"
          data-testid="new-document"
          onClick={() => {
            setTitle('');
            setCreating(true);
          }}
        >
          <FilePlus /> New document
        </Button>
      </div>

      {isPending ? (
        <div className="space-y-2">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      ) : documents && documents.length > 0 ? (
        <ul className="space-y-2" data-testid="document-list">
          {documents.map((doc) => (
            <li key={doc.id}>
              <Card className="hover:border-[var(--ring)] flex items-center gap-3 p-4 transition-colors">
                <div className="min-w-0 flex-1">
                  <CardTitle className="truncate text-base">
                    <Link
                      to={`/projects/${projectId}/docs/${doc.id}`}
                      className="hover:underline"
                      data-testid="document-link"
                    >
                      {doc.title}
                    </Link>
                  </CardTitle>
                  <CardDescription className="line-clamp-1">
                    {doc.excerpt || 'Empty document'}
                  </CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Delete ${doc.title}`}
                  onClick={() => setPendingDelete({ id: doc.id, title: doc.title })}
                >
                  <Trash2 />
                </Button>
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        <Card className="p-8 text-center">
          <CardTitle className="mb-1 text-base">No documents yet</CardTitle>
          <CardDescription>
            Create one to start writing. Uploaded files can be referenced by name.
          </CardDescription>
        </Card>
      )}

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const trimmed = title.trim();
              if (!trimmed) return;
              createDocument.mutate(
                { title: trimmed },
                {
                  onSuccess: (doc) => {
                    setCreating(false);
                    void navigate(`/projects/${projectId}/docs/${doc.id}/edit`);
                  },
                  onError: () => toast.error('Could not create the document.'),
                },
              );
            }}
          >
            <DialogHeader>
              <DialogTitle>New document</DialogTitle>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label htmlFor="document-title">Title</Label>
              <Input
                id="document-title"
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={title.trim().length === 0}>
                Create
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title={`Delete “${pendingDelete?.title ?? ''}”?`}
        description="This cannot be undone."
        confirmLabel="Delete document"
        onConfirm={() => {
          if (!pendingDelete) return;
          deleteDocument.mutate(pendingDelete.id, {
            onError: () => toast.error('Could not delete the document.'),
          });
        }}
      />
    </section>
  );
}
