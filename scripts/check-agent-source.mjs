/** Source-only checks. This is NOT a substitute for `npm run check` or browser tests. */
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const root = fileURLToPath(new URL('../', import.meta.url));
const walk = dir => readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]);
const files = [join(root, 'packages/core/src/agent.ts'), ...walk(join(root, 'packages/server/src/agent')), ...walk(join(root, 'packages/ui/src/agent'))].filter(f => /\.tsx?$/.test(f));
let failures = 0;
for (const f of files) {
  const input = readFileSync(f, 'utf8');
  const out = ts.transpileModule(input, { fileName: f, reportDiagnostics: true, compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.React, isolatedModules: true } });
  for (const d of out.diagnostics ?? []) if (d.category === ts.DiagnosticCategory.Error) {
    failures++; console.error(relative(root, f), ts.flattenDiagnosticMessageText(d.messageText, '\n'));
  }
  // Verify the actual Recap IconButton contract, not an incompatible lookalike.
  const source = ts.createSourceFile(f, input, ts.ScriptTarget.Latest, true, /tsx$/.test(f) ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  function visit(node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      if (node.tagName.getText(source) === 'IconButton') {
        const props = node.attributes.properties.filter(ts.isJsxAttribute).map(x => x.name.getText(source));
        if (!props.includes('icon') || !props.includes('label')) { failures++; console.error('IconButton requires icon + label:', relative(root, f)); }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
}
const css = readFileSync(join(root, 'packages/ui/src/agent/agent.css'), 'utf8');
const used = new Set([...css.matchAll(/var\((--rc-[\w-]+)/g)].map(m => m[1]));
const definitions = new Set(walk(join(root, 'packages/recap-ui/src')).filter(f => f.endsWith('.css')).flatMap(f => [...readFileSync(f, 'utf8').matchAll(/(--rc-[\w-]+)\s*:/g)].map(m => m[1])));
for (const variable of used) if (!definitions.has(variable)) { failures++; console.error('Undefined Recap token:', variable); }
if (failures) process.exitCode = 1;
else console.log(`PASS: ${files.length} TS/TSX syntax transforms, Recap IconButton contracts, ${used.size} semantic tokens. Full typecheck/build/browser are separate gates.`);
