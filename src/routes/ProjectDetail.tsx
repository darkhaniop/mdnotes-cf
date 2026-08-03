import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { ChevronLeft, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { Textarea } from '@/components/ui/textarea';
import { useDeleteProject, useProject, useUpdateProject } from '@/hooks/useProjects';

export function ProjectDetail() {
  const { projectId = '' } = useParams();
  const navigate = useNavigate();
  const { data: project, isPending, isError } = useProject(projectId);
  const updateProject = useUpdateProject(projectId);
  const deleteProject = useDeleteProject();
  const [renaming, setRenaming] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftDescription, setDraftDescription] = useState('');

  if (isPending) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-4 p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (isError || !project) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-3 p-6">
        <h1 className="text-2xl font-semibold">Project not found</h1>
        <p className="text-muted-foreground text-sm">
          It may have been deleted, or it belongs to another account.
        </p>
        <Button asChild variant="outline">
          <Link to="/projects">Back to projects</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 p-4 sm:p-6">
      <Link
        to="/projects"
        className="text-muted-foreground mb-4 inline-flex items-center gap-1 text-sm hover:underline"
      >
        <ChevronLeft className="size-4" /> Projects
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight" data-testid="project-title">
            {project.name}
          </h1>
          {project.description ? (
            <p className="text-muted-foreground mt-1 text-sm">{project.description}</p>
          ) : null}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setDraftName(project.name);
              setDraftDescription(project.description ?? '');
              setRenaming(true);
            }}
          >
            <Pencil /> Rename
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(true)}>
            <Trash2 /> Delete
          </Button>
        </div>
      </div>

      <Dialog open={renaming} onOpenChange={setRenaming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename project</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="rename-name">Name</Label>
            <Input
              id="rename-name"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rename-description">Description</Label>
            <Textarea
              id="rename-description"
              rows={3}
              value={draftDescription}
              onChange={(e) => setDraftDescription(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                updateProject.mutate(
                  { name: draftName.trim(), description: draftDescription.trim() || null },
                  {
                    onSuccess: () => setRenaming(false),
                    onError: () => toast.error('Could not rename the project.'),
                  },
                );
              }}
              disabled={draftName.trim().length === 0}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete “${project.name}”?`}
        description="Its documents and uploaded files are deleted too. This cannot be undone."
        confirmLabel="Delete project"
        onConfirm={() =>
          deleteProject.mutate(project.id, {
            onSuccess: () => void navigate('/projects', { replace: true }),
            onError: () => toast.error('Could not delete the project.'),
          })
        }
      />
    </div>
  );
}
