import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { toast } from 'sonner';
import { Download, ExternalLink, Eye, FileText, Trash2, UploadCloud } from 'lucide-react';
import { ALLOWED_MIME, MAX_UPLOAD_BYTES } from '@shared/constants';
import type { AssetDto } from '@shared/schemas/asset';
import { isImageMime } from '@shared/schemas/asset';
import { ApiError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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

/**
 * `asset.url` is the same `/api/projects/:id/assets/:assetId` route the markdown
 * renderer uses; the httpOnly `mdn_at` cookie authenticates the `<img>`/
 * `<object>` request, so there is no separate auth path to arrange here.
 */
function AssetPreviewDialog({
  asset,
  onOpenChange,
}: {
  asset: AssetDto | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={asset !== null} onOpenChange={onOpenChange}>
      {asset ? (
        <DialogContent
          data-testid="asset-preview"
          className="flex max-h-[90vh] w-[calc(100%-2rem)] max-w-3xl flex-col overflow-hidden"
        >
          <DialogHeader>
            <DialogTitle className="truncate pr-8">{asset.filename}</DialogTitle>
            <DialogDescription>
              {formatBytes(asset.sizeBytes)} · {asset.contentType}
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-auto">
            {isImageMime(asset.contentType) ? (
              <img
                src={asset.url}
                alt={asset.filename}
                data-testid="asset-preview-image"
                className="mx-auto max-h-[70vh] w-auto max-w-full rounded-md object-contain"
              />
            ) : (
              <object
                data={asset.url}
                type={asset.contentType}
                aria-label={asset.filename}
                data-testid="asset-preview-object"
                className="h-[70vh] w-full rounded-md"
              >
                <p className="text-muted-foreground p-4 text-sm">
                  Your browser cannot display this file inline. Use “Open in a new tab” below.
                </p>
              </object>
            )}
          </div>

          <DialogFooter>
            <Button asChild variant="outline" size="sm">
              <a href={asset.url} target="_blank" rel="noreferrer">
                <ExternalLink /> Open in a new tab
              </a>
            </Button>
            <Button asChild size="sm">
              <a href={asset.url} download={asset.filename} data-testid="asset-download">
                <Download /> Download
              </a>
            </Button>
          </DialogFooter>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

export function AssetPanel({ projectId, onInsert }: AssetPanelProps) {
  const { data: assets, isPending } = useAssets(projectId);
  const upload = useUploadAsset(projectId);
  const remove = useDeleteAsset(projectId);
  const [pendingDelete, setPendingDelete] = useState<AssetDto | null>(null);
  const [previewing, setPreviewing] = useState<AssetDto | null>(null);

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
                // In the editor the tile inserts a reference; with no insert
                // target (the project screen) it opens the preview instead.
                onClick={() => (onInsert ? onInsert(asset) : setPreviewing(asset))}
                title={onInsert ? `Insert ${asset.filename}` : `Preview ${asset.filename}`}
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
              <div className="absolute top-1 right-1 flex opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Preview ${asset.filename}`}
                  onClick={() => setPreviewing(asset)}
                >
                  <Eye className="size-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Delete ${asset.filename}`}
                  onClick={() => setPendingDelete(asset)}
                >
                  <Trash2 className="size-3" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground text-sm">
          No files yet. Anything you upload can be referenced from a document by its name.
        </p>
      )}

      <AssetPreviewDialog
        asset={previewing}
        onOpenChange={(open) => !open && setPreviewing(null)}
      />

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
