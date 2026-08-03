import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type UiState = {
  previewVisible: boolean;
  editorPaneSize: number;
  togglePreview: () => void;
  setPreviewVisible: (visible: boolean) => void;
  setEditorPaneSize: (size: number) => void;
};

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      previewVisible: true,
      editorPaneSize: 50,
      togglePreview: () => set((s) => ({ previewVisible: !s.previewVisible })),
      setPreviewVisible: (previewVisible) => set({ previewVisible }),
      setEditorPaneSize: (editorPaneSize) => set({ editorPaneSize }),
    }),
    { name: 'mdnotes-ui' },
  ),
);
