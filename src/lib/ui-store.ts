import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ThemePreference } from './theme';

type UiState = {
  previewVisible: boolean;
  editorPaneSize: number;
  /**
   * Client-side only on purpose: this rides the existing localStorage persist
   * middleware, so there is no D1 column, no API and no user-preferences table.
   */
  theme: ThemePreference;
  togglePreview: () => void;
  setPreviewVisible: (visible: boolean) => void;
  setEditorPaneSize: (size: number) => void;
  setTheme: (theme: ThemePreference) => void;
};

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      previewVisible: true,
      editorPaneSize: 50,
      theme: 'system',
      togglePreview: () => set((s) => ({ previewVisible: !s.previewVisible })),
      setPreviewVisible: (previewVisible) => set({ previewVisible }),
      setEditorPaneSize: (editorPaneSize) => set({ editorPaneSize }),
      setTheme: (theme) => set({ theme }),
    }),
    { name: 'mdnotes-ui' },
  ),
);
