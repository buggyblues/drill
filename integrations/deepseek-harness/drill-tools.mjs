/** Original Drill bridge plugin. Uses the official tool registry/guard APIs.
 * No credentials or filesystem path is ever placed in a model tool schema.
 */
export const name = 'drill-tools';
export const inject = ['tools'];
export async function apply(ctx) {
  const allowed = new Set();
  // Install fail-closed guard BEFORE fetching schemas. Covers shell, run_code and unknown tools.
  ctx.tools.guard(exec => allowed.has(exec.name) ? undefined : 'Drill prohibits all non-Drill tools, including shell, filesystem and run_code.');
  const base = process.env.DRILL_BRIDGE_URL, token = process.env.DRILL_BRIDGE_TOKEN;
  if (!base || !/^http:\/\/127\.0\.0\.1:\d+$/.test(base) || !token) throw new Error('Missing local Drill bridge');
  const headers = { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' };
  const response = await fetch(base + '/schemas', { headers, signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error('Drill bridge schema handshake failed');
  const { tools } = await response.json();
  if (!Array.isArray(tools) || tools.length > 20) throw new Error('Invalid Drill schemas');
  for (const tool of tools) {
    const f = tool.schema.function;
    allowed.add(f.name);
    ctx.tools.register({
      ...f,
      output: {
        schema: { type: 'object', properties: { json: { type: 'string' } }, required: ['json'], additionalProperties: false },
        render(_args, value) { return [{ type: 'text', text: value.json }]; },
      },
      timeoutMs: 120000,
      isConcurrencySafe() { return tool.readonly; },
      async execute(args, exec) {
        const r = await fetch(base + '/tool', { method: 'POST', headers, signal: exec.signal,
          body: JSON.stringify({ name: f.name, args }) });
        if (!r.ok) throw new Error('Drill denied tool call (HTTP ' + r.status + ')');
        return { json: JSON.stringify(await r.json()) };
      },
    });
  }
  ctx.tools.restrict({ allow: [...allowed] });
}
