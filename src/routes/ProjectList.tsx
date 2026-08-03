import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { FileText, Image as ImageIcon, MoreVertical, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { CreateProjectDialog } from '@/components/project/CreateProjectDialog';
import { useDeleteProject, useProjects } from '@/hooks/useProjects';

export function ProjectList() {
  const { data: projects, isPending, isError } = useProjects();
  const deleteProject = useDeleteProject();
  const navigate = useNavigate();
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 p-4 sm:p-6">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
          <p className="text-muted-foreground text-sm">Every document and upload lives in one.</p>
        </div>
        <CreateProjectDialog onCreated={(id) => void navigate(`/projects/${id}`)} />
      </div>

      {isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      ) : isError ? (
        <p className="text-destructive text-sm">Could not load your projects.</p>
      ) : projects.length === 0 ? (
        <Card className="p-10 text-center">
          <CardTitle className="mb-1">No projects yet</CardTitle>
          <CardDescription>
            Create your first project to start writing. It only takes a name.
          </CardDescription>
        </Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="project-list">
          {projects.map((project) => (
            <li key={project.id}>
              <Card className="hover:border-[var(--ring)] h-full transition-colors">
                <CardHeader className="flex-row items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <CardTitle className="truncate">
                      <Link to={`/projects/${project.id}`} className="hover:underline">
                        {project.name}
                      </Link>
                    </CardTitle>
                    <CardDescription className="line-clamp-2">
                      {project.description || 'No description'}
                    </CardDescription>
                    <div className="text-muted-foreground mt-3 flex gap-4 text-xs">
                      <span className="inline-flex items-center gap-1">
                        <FileText className="size-3" />
                        {project.documentCount ?? 0}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <ImageIcon className="size-3" />
                        {project.assetCount ?? 0}
                      </span>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" aria-label={`Actions for ${project.name}`}>
                        <MoreVertical />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onSelect={() => setPendingDelete({ id: project.id, name: project.name })}
                      >
                        <Trash2 className="size-4" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardHeader>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title={`Delete “${pendingDelete?.name ?? ''}”?`}
        description="Its documents and uploaded files are deleted too. This cannot be undone."
        confirmLabel="Delete project"
        onConfirm={() => {
          if (!pendingDelete) return;
          deleteProject.mutate(pendingDelete.id, {
            onError: () => toast.error('Could not delete the project.'),
            onSuccess: () => toast.success('Project deleted.'),
          });
        }}
      />
    </div>
  );
}
