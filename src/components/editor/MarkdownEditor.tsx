import { useImperativeHandle, useRef, type Ref } from 'react';
import CodeMirror, { type ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { EditorView } from '@codemirror/view';
import { useResolvedTheme } from '@/hooks/useTheme';

export type MarkdownEditorHandle = {
  /** Inserts text at the cursor (used by the asset panel). */
  insertAtCursor: (text: string) => void;
  focus: () => void;
};

export type MarkdownEditorProps = {
  value: string;
  onChange: (value: string) => void;
  onSave?: () => void;
  ref?: Ref<MarkdownEditorHandle>;
};

const theme = EditorView.theme({
  '&': { height: '100%', fontSize: '14px' },
  '.cm-scroller': {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    lineHeight: '1.6',
  },
  '.cm-content': { paddingBlock: '0.75rem' },
});

export function MarkdownEditor({ value, onChange, onSave, ref }: MarkdownEditorProps) {
  const cm = useRef<ReactCodeMirrorRef>(null);
  const resolvedTheme = useResolvedTheme();

  useImperativeHandle(ref, () => ({
    insertAtCursor(text: string) {
      const view = cm.current?.view;
      if (!view) return;
      const { from, to } = view.state.selection.main;
      view.dispatch({
        changes: { from, to, insert: text },
        selection: { anchor: from + text.length },
      });
      view.focus();
    },
    focus() {
      cm.current?.view?.focus();
    },
  }));

  return (
    <div className="h-full overflow-hidden" data-testid="markdown-editor">
      <CodeMirror
        ref={cm}
        value={value}
        onChange={onChange}
        height="100%"
        theme={resolvedTheme}
        basicSetup={{ lineNumbers: false, foldGutter: false, highlightActiveLine: false }}
        extensions={[
          markdown({ base: markdownLanguage, codeLanguages: languages }),
          EditorView.lineWrapping,
          theme,
          EditorView.domEventHandlers({
            keydown: (event) => {
              if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
                event.preventDefault();
                onSave?.();
                return true;
              }
              return false;
            },
          }),
        ]}
      />
    </div>
  );
}
