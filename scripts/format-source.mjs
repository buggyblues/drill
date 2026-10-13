// Optional deterministic formatting with the project's TypeScript dependency.
import {createRequire} from 'node:module';
import {readdir,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
const require=createRequire(import.meta.url);
const ts=require(process.env.TYPESCRIPT_PATH || 'typescript');
const printer=ts.createPrinter({newLine:ts.NewLineKind.LineFeed});
let count=0;
async function walk(root){for(const item of await readdir(root,{withFileTypes:true})){const path=join(root,item.name);if(item.isDirectory()&&!['dist','node_modules'].includes(item.name))await walk(path);else if(item.isFile()&&/\.(ts|tsx)$/.test(path)){const text=await readFile(path,'utf8');const source=ts.createSourceFile(path,text,ts.ScriptTarget.Latest,true,path.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);if(source.parseDiagnostics.length)throw new Error('Parse error: '+path);await writeFile(path,printer.printFile(source));count++;}}}
for(const folder of ['packages','apps','tests','examples'])await walk(folder);
console.log(`Formatted ${count} TypeScript source files. This is not type checking.`);
