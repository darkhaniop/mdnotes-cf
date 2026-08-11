import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'katex/dist/katex.min.css';
// highlight.js ships one stylesheet per theme; ours are in index.css instead so
// code blocks can follow the light/dark choice.
import './index.css';
import { App } from './App';
import { applyTheme, prefersDarkNow } from './lib/theme';
import { useUiStore } from './lib/ui-store';

// Pin the theme class before the first render so a stored light/dark choice does
// not flash the system default. index.css covers the pre-JS paint.
applyTheme(useUiStore.getState().theme, prefersDarkNow());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
