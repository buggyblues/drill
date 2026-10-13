import { defineConfig } from 'vite';
// /assets is the authenticated attachment API; compiled public files use /static.
export default defineConfig({ base: './', server: { port: 5173, proxy: Object.fromEntries(['health', 'auth', 'bootstrap', 'objects', 'sync', 'search', 'related', 'insight', 'ai', 'versions', 'conflicts', 'assets', 'settings', 'sources', 'proposals', 'map', 'walk', 'recognize', 'export'].map(p => ['/' + p, { target: 'http://127.0.0.1:8787', changeOrigin: true }])) }, build: { target: 'es2022', outDir: 'dist', assetsDir: 'static' } });
