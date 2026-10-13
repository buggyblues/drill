// Syntax-only validation; intentionally not advertised as production type checking.
import {createRequire} from 'node:module';
import {readdir,readFile,mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
const require=createRequire(import.meta.url),ts=require(process.env.TYPESCRIPT_PATH||'typescript');
const checked=[],errors=[];
async function walk(root){for(const e of await readdir(root,{withFileTypes:true})){const file=join(root,e.name);if(e.isDirectory()&&!['node_modules','dist'].includes(e.name))await walk(file);else if(e.isFile()&&/\.(ts|tsx)$/.test(file)){const source=ts.createSourceFile(file,await readFile(file,'utf8'),ts.ScriptTarget.Latest,true,file.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);checked.push(file);for(const d of source.parseDiagnostics)errors.push({file,message:ts.flattenDiagnosticMessageText(d.messageText,'\n')});}}}
for(const root of ['packages','apps','examples','scripts','tests'])await walk(root);
await mkdir('validation',{recursive:true});
await writeFile('validation/typescript-syntax.json',JSON.stringify({check:'TypeScript parser only, NOT tsc type checking or production bundling',version:ts.version,files:checked,errors},null,2));
console.log(`${checked.length} TypeScript files parsed; ${errors.length} syntax errors.`);if(errors.length)process.exitCode=1;
