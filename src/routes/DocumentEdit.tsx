import { useCallback, useDeferredValue, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { toast } from 'sonner';
import { Check, Eye, EyeOff, Loader2, Save } from 'lucide-react';
import type { AssetDto } from '@shared/schemas/asset';
import { isImageMime } from '@shared/schemas/asset';
import { ApiError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { DocumentBreadcrumbs } from '@/components/layout/Breadcrumbs';
import { MarkdownPreview } from '@/components/markdown/MarkdownPreview';
import {
  MarkdownEditor,
  type MarkdownEditorHandle,
} from '@/components/editor/MarkdownEditor';
import { InsertBlockMenu } from '@/components/editor/InsertBlockMenu';
import type { MarkdownSnippet } from '@/components/editor/markdown-snippets';
import { AssetPanel } from '@/components/project/AssetPanel';
import { useDocument, useUpdateDocument } from '@/hooks/useDocuments';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useUiStore } from '@/lib/ui-store';
import { useMediaQuery } from '@/hooks/useMediaQuery';

const AUTOSAVE_DELAY_MS = 800;
const PREVIEW_DEBOUNCE_MS = 200;

type SaveState = 'saved' | 'dirty' | 'saving' | 'error';

export function DocumentEdit() {
  const { projectId = '', docId = '' } = useParams();
  const navigate = useNavigate();
  const { data: document, isPending, isError } = useDocument(docId);
  const updateDocument = useUpdateDocument(docId, projectId);
  const previewVisible = useUiStore((s) => s.previewVisible);
  const togglePreview = useUiStore((s) => s.togglePreview);
  const editor = useRef<MarkdownEditorHandle>(null);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saveState, setSaveState] = useState<SaveState>('saved');
  /** "Done" is pressed and its save is still round-tripping. */
  const [finishing, setFinishing] = useState(false);
  const loadedFor = useRef<string | null>(null);
  /** The updatedAt the server last confirmed; sent back for optimistic concurrency. */
  const baseUpdatedAt = useRef<number | null>(null);
  const conflicted = useRef(false);
  /** Autosave stays off until the user actually types, so loading never writes. */
  const edited = useRef(false);
  /** Saves are chained; overlapping writes would send a stale expectedUpdatedAt. */
  const queue = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    if (!document || loadedFor.current === document.id) return;
    loadedFor.current = document.id;
    edited.current = false;
    setTitle(document.title);
    setContent(document.content);
    baseUpdatedAt.current = document.updatedAt;
    setSaveState('saved');
  }, [document]);

  const save = useCallback(
    (next: { title: string; content: string }) => {
      const run = async () => {
        if (conflicted.current || !loadedFor.current) return;
        setSaveState('saving');
        try {
          const saved = await updateDocument.mutateAsync({
            title: next.title.trim() || 'Untitled',
            content: next.content,
            ...(baseUpdatedAt.current !== null
              ? { expectedUpdatedAt: baseUpdatedAt.current }
              : {}),
          });
          baseUpdatedAt.current = saved.updatedAt;
          setSaveState('saved');
        } catch (error) {
          setSaveState('error');
          if (error instanceof ApiError && error.status === 409) {
            conflicted.current = true;
            toast.error('This document changed elsewhere. Reload to continue.', {
              action: { label: 'Reload', onClick: () => window.location.reload() },
              duration: Infinity,
            });
          } else {
            toast.error('Could not save. Your changes are still here — try again.');
          }
        }
      };
      queue.current = queue.current.then(run, run);
      return queue.current;
    },
    [updateDocument],
  );

  // Autosave: debounce the draft, then write whenever it differs from what the
  // server last confirmed.
  const draft = useDebouncedValue({ title, content }, AUTOSAVE_DELAY_MS);
  useEffect(() => {
    if (!edited.current || !document || loadedFor.current !== document.id) return;
    if (draft.title === document.title && draft.content === document.content) return;
    void save(draft);
    // `document` is intentionally excluded: it changes on every successful save,
    // which would re-run this effect and save again in a loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  const saveNow = useCallback(() => void save({ title, content }), [save, title, content]);

  const editTitle = useCallback((next: string) => {
    edited.current = true;
    setTitle(next);
    setSaveState('dirty');
  }, []);

  // Enter/blur on the title flushes the rename immediately instead of waiting
  // out the autosave debounce. `next` is passed in because Escape restores the
  // old value in the same event, before `title` has re-rendered.
  const commitTitle = useCallback(
    (next: string) => {
      if (!document || (next.trim() || 'Untitled') === document.title) return;
      void save({ title: next, content });
    },
    [document, save, content],
  );

  const finishEditing = useCallback(async () => {
    setFinishing(true);
    try {
      await save({ title, content });
    } finally {
      setFinishing(false);
      void navigate(`/projects/${projectId}/docs/${docId}`);
    }
  }, [save, title, content, navigate, projectId, docId]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        saveNow();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [saveNow]);

  const insertAsset = useCallback((asset: AssetDto) => {
    edited.current = true;
    const snippet = isImageMime(asset.contentType)
      ? `![${asset.filename}](${asset.filename})`
      : `[${asset.filename}](${asset.filename})`;
    editor.current?.insertAtCursor(snippet);
  }, []);

  // Same insert-at-cursor path as the asset panel; CodeMirror's onChange is what
  // marks the document dirty.
  const insertSnippet = useCallback((snippet: MarkdownSnippet) => {
    edited.current = true;
    editor.current?.insertAtCursor(snippet.text);
  }, []);

  // Below md a horizontal split leaves both panes unusable, so it stacks.
  const isWide = useMediaQuery('(min-width: 768px)');
  const splitOrientation = isWide ? 'horizontal' : 'vertical';

  const deferredContent = useDeferredValue(content);
  const previewContent = useDebouncedValue(deferredContent, PREVIEW_DEBOUNCE_MS);

  if (isPending) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-3 p-6">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-96 w-full" />
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
    <div className="flex flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2">
        <DocumentBreadcrumbs
          projectId={projectId}
          title={title}
          className="min-w-0 shrink"
          currentTestId="title-input"
          edit={{
            label: 'Document title',
            hint: 'Rename this document',
            placeholder: 'Untitled',
            onChange: editTitle,
            onCommit: commitTitle,
          }}
        />
        <span className="text-muted-foreground text-xs" data-testid="save-state">
          {saveState === 'saving'
            ? 'Saving…'
            : saveState === 'saved'
              ? 'Saved'
              : saveState === 'error'
                ? 'Not saved'
                : 'Unsaved changes'}
        </span>
        <div className="flex-1" />
        <InsertBlockMenu onInsert={insertSnippet} />
        <Button
          size="sm"
          variant="outline"
          onClick={togglePreview}
          data-testid="toggle-preview"
          aria-pressed={previewVisible}
        >
          {previewVisible ? <EyeOff /> : <Eye />}
          {previewVisible ? 'Hide preview' : 'Show preview'}
        </Button>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={saveNow} data-testid="save-document">
            <Save /> Save
          </Button>
          <Button
            size="sm"
            data-testid="done-editing"
            disabled={finishing}
            aria-busy={finishing}
            onClick={() => void finishEditing()}
          >
            {finishing ? <Loader2 className="animate-spin" /> : <Check />}
            {finishing ? 'Saving…' : 'Done'}
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="min-h-0 flex-1">
          <Group orientation={splitOrientation} className="flex h-full min-h-[60vh]">
            <Panel defaultSize="50%" minSize="25%" className="min-w-0">
              <MarkdownEditor
                ref={editor}
                value={content}
                onChange={(next) => {
                  edited.current = true;
                  setContent(next);
                  setSaveState('dirty');
                }}
                onSave={saveNow}
              />
            </Panel>
            {previewVisible ? (
              <>
                <Separator
                  className={
                    isWide
                      ? 'bg-[var(--border)] hover:bg-[var(--ring)] w-1 cursor-col-resize transition-colors'
                      : 'bg-[var(--border)] hover:bg-[var(--ring)] h-1 cursor-row-resize transition-colors'
                  }
                />
                <Panel defaultSize="50%" minSize="25%" className="min-w-0 overflow-auto">
                  <div className="p-4">
                    <MarkdownPreview content={previewContent} projectId={projectId} />
                  </div>
                </Panel>
              </>
            ) : null}
          </Group>
        </div>
        <aside className="w-full shrink-0 border-t p-4 lg:w-72 lg:border-t-0 lg:border-l">
          <h2 className="mb-2 text-sm font-medium">Files</h2>
          <p className="text-muted-foreground mb-2 text-xs">
            Click a file to insert a reference at the cursor.
          </p>
          <AssetPanel projectId={projectId} onInsert={insertAsset} />
        </aside>
      </div>
    </div>
  );
}
