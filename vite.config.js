import { defineConfig } from 'vite';

// Relative base so the artefact serves under https://benchtools.ligant.ai/<slug>/ unchanged.
// No modulepreload polyfill: it would inject an inline script, which the CSP forbids.
// `vite build --mode layout` also builds the Task 3 layout mock
// (verification/layout/mock.html); the production build does not contain it.
export default defineConfig(({ mode }) => ({
  base: './',
  build: {
    modulePreload: { polyfill: false },
    target: 'es2022',
    ...(mode === 'layout' ? { rollupOptions: { input: { main: 'index.html', mock: 'verification/layout/mock.html' } } } : {}),
  },
  server: { port: 5175, strictPort: true },
}));
