/** Bundle the same React UI for the local demo, including offline fonts and icons. */
import { build } from 'esbuild';
import { mkdir, writeFile, cp } from 'node:fs/promises';
await mkdir('preview', { recursive: true });
await build({ entryPoints: ['apps/web/src/main.tsx'], bundle: true, format: 'esm', target: 'es2022',
    outfile: 'preview/app.js', loader: { '.woff2': 'file', '.woff': 'file' },
    assetNames: '[name]-[hash]', sourcemap: true });
await cp('apps/web/public/licenses', 'preview/licenses', { recursive: true });
await writeFile('preview/index.html', `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Drill · 本机示例</title><link rel="stylesheet" href="/app.css"></head><body><div id="root"></div><script type="module" src="/app.js"></script></body></html>`);
console.log('Local demo built with the production React UI.');
