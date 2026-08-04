import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { toast } from 'sonner';
import { FileText, Trash2, UploadCloud } from 'lucide-react';
import { ALLOWED_MIME, MAX_UPLOAD_BYTES } from '@shared/constants';
import type { AssetDto } from '@shared/schemas/asset';
import { isImageMime } from '@shared/schemas/asset';
import { ApiError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useAssets, useDeleteAsset, useUploadAsset } from '@/hooks/useAssets';

export type AssetPanelProps = {
  projectId: string;
  /** Set in the editor so clicking an asset inserts a markdown reference. */
  onInsert?: (asset: AssetDto) => void;
};

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function AssetPanel({ projectId, onInsert }: AssetPanelProps) {
  const { data: assets, isPending } = useAssets(projectId);
  const upload = useUploadAsset(projectId);
  const remove = useDeleteAsset(projectId);
  const [pendingDelete, setPendingDelete] = useState<AssetDto | null>(null);

  const onDrop = useCallback(
    async (files: File[]) => {
      for (const file of files) {
        try {
          const asset = await upload.mutateAsync(file);
          toast.success(`Uploaded ${asset.filename}`);
        } catch (error) {
          toast.error(
            error instanceof ApiError ? error.message : `Could not upload ${file.name}`,
          );
        }
      }
    },
    [upload],
  );

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop: (files) => void onDrop(files),
    accept: Object.fromEntries(ALLOWED_MIME.map((mime) => [mime, []])),
    maxSize: MAX_UPLOAD_BYTES,
    noClick: true,
    noKeyboard: true,
  });

  return (
    <section className="space-y-3" aria-label="Project files">
      <div
        {...getRootProps()}
        data-testid="asset-dropzone"
        className={cn(
          'rounded-lg border border-dashed p-6 text-center transition-colors',
          isDragActive && 'border-[var(--ring)] bg-accent',
        )}
      >
        <input {...getInputProps()} data-testid="asset-input" />
        <UploadCloud className="text-muted-foreground mx-auto mb-2 size-6" />
        <p className="text-sm">Drop images or PDFs here</p>
        <p className="text-muted-foreground mb-3 text-xs">
          PNG, JPEG, WebP, GIF or PDF · up to 25 MB
        </p>
        <Button type="button" size="sm" variant="outline" onClick={open}>
          Choose a file
        </Button>
      </div>

      {upload.isPending ? <p className="text-muted-foreground text-xs">Uploading…</p> : null}

      {isPending ? (
        <div className="grid grid-cols-2 gap-2">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      ) : assets && assets.length > 0 ? (
        <ul className="grid grid-cols-2 gap-2" data-testid="asset-grid">
          {assets.map((asset) => (
            <li key={asset.id} className="group relative">
              <button
                type="button"
                onClick={() => onInsert?.(asset)}
                title={onInsert ? `Insert ${asset.filename}` : asset.filename}
                className="hover:border-[var(--ring)] flex w-full flex-col items-center gap-1 rounded-md border p-2 text-left"
              >
                {isImageMime(asset.contentType) ? (
                  <img
                    src={asset.url}
                    alt={asset.filename}
                    loading="lazy"
                    className="h-16 w-full rounded object-cover"
                  />
                ) : (
                  <span className="bg-muted flex h-16 w-full items-center justify-center rounded">
                    <FileText className="size-6" />
                  </span>
                )}
                <span className="w-full truncate text-xs">{asset.filename}</span>
                <span className="text-muted-foreground w-full text-[10px]">
                  {formatBytes(asset.sizeBytes)}
                </span>
              </button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Delete ${asset.filename}`}
                className="absolute top-1 right-1 opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
                onClick={() => setPendingDelete(asset)}
              >
                <Trash2 className="size-3" />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground text-sm">
          No files yet. Anything you upload can be referenced from a document by its name.
        </p>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title={`Delete ${pendingDelete?.filename ?? ''}?`}
        description="Documents referencing this file will show a broken image."
        confirmLabel="Delete file"
        onConfirm={() => {
          if (!pendingDelete) return;
          remove.mutate(pendingDelete.id, {
            onError: () => toast.error('Could not delete that file.'),
          });
        }}
      />
    </section>
  );
}
