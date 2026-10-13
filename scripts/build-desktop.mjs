import {build} from 'esbuild';
await build({entryPoints:['apps/desktop/src/main.ts'],bundle:true,platform:'node',target:'node22',format:'cjs',external:['electron','node:sqlite'],outfile:'apps/desktop/dist/main.cjs',sourcemap:true});
await build({entryPoints:['apps/desktop/src/preload.ts'],bundle:true,platform:'node',target:'node22',format:'cjs',external:['electron'],outfile:'apps/desktop/dist/preload.cjs'});
console.log('Electron main and isolated preload built. Packaging/signing is a separate platform step.');
