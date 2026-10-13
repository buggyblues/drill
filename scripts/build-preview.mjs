/** Builds a dependency-free demonstration. Production always uses React 19 + Vite. */
import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir,readdir,copyFile} from 'node:fs/promises';
import {resolve,relative,dirname} from 'node:path';
const require=createRequire(import.meta.url);
let ts;try{ts=require('typescript');}catch{if(!process.env.TYPESCRIPT_PATH)throw new Error('Install TypeScript or set TYPESCRIPT_PATH');ts=require(process.env.TYPESCRIPT_PATH);}
const root=resolve('.'),out=resolve('preview');await mkdir(out,{recursive:true});let diagnostics=[];
for(const folder of ['packages/core/src','packages/ui/src','apps/web/src']){
 for(const file of await readdir(folder)){if(!/\.tsx?$/.test(file))continue;
 const source=await readFile(folder+'/'+file,'utf8');const result=ts.transpileModule(source,{fileName:file,reportDiagnostics:true,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022,jsx:ts.JsxEmit.React,esModuleInterop:true,isolatedModules:true}});
 diagnostics.push(...(result.diagnostics??[]).filter(x=>x.category===ts.DiagnosticCategory.Error));
 const output=out+'/'+folder+'/'+file.replace(/\.tsx?$/,'.js');await mkdir(dirname(output),{recursive:true});
 let text=result.outputText.replace(/(from\s+['"][^'"]+)\.tsx?(['"])/g,'$1.js$2').replace(/import\s+['"][^'"]+\.css['"];?/g,'');
 const shim=relative(dirname(output),out+'/vendor/react-shim.js').replaceAll('\\','/');const domShim=relative(dirname(output),out+'/vendor/dom-shim.js').replaceAll('\\','/');
 text=text.replace(/from ['"]react['"]/g,`from '${shim}'`).replace(/from ['"]react-dom\/client['"]/g,`from '${domShim}'`);await writeFile(output,text);
 }
}
if(diagnostics.length){console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics,{getCurrentDirectory:()=>root,getCanonicalFileName:x=>x,getNewLine:()=>"\n"}));process.exit(1);}
await copyFile('packages/ui/src/styles.css',out+'/styles.css');
await writeFile(out+'/vendor/react-shim.js','export default window.React;');
await writeFile(out+'/vendor/dom-shim.js','export const createRoot = element => ({render: node => window.ReactDOM.render(node, element)});');
await writeFile(out+'/index.html',`<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Drill · 本机示例</title><link rel="stylesheet" href="/styles.css"></head><body><div id="root"></div><script src="/vendor/react.demo.js"></script><script src="/vendor/react-dom.demo.js"></script><script type="module" src="/apps/web/src/main.js"></script></body></html>`);
console.log('Preview syntax transpilation complete. This does not replace production type checking or the Vite build.');
