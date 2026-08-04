import { beforeEach, describe, expect, it } from 'vitest';
import { useUiStore } from '@/lib/ui-store';

describe('ui-store', () => {
  beforeEach(() => {
    useUiStore.setState({ previewVisible: true, editorPaneSize: 50 });
    localStorage.clear();
  });

  it('toggles the preview', () => {
    expect(useUiStore.getState().previewVisible).toBe(true);
    useUiStore.getState().togglePreview();
    expect(useUiStore.getState().previewVisible).toBe(false);
    useUiStore.getState().togglePreview();
    expect(useUiStore.getState().previewVisible).toBe(true);
  });

  it('persists the preference to localStorage', () => {
    useUiStore.getState().setPreviewVisible(false);
    const raw = localStorage.getItem('mdnotes-ui');
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw!).state.previewVisible).toBe(false);
  });

  it('remembers the split size', () => {
    useUiStore.getState().setEditorPaneSize(70);
    expect(useUiStore.getState().editorPaneSize).toBe(70);
  });
});
