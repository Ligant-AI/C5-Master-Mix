import { defineConfig } from 'vite';
export default defineConfig(({ mode }) => ({
    base: './',
    build: {
        modulePreload: { polyfill: false },
        target: 'es2022',
            },
    server: { port: 5175, strictPort: true },
}));
