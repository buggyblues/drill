import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { LocalStore } from '../apps/desktop/src/local.ts';
import { aggregateChrome, parseCodex, readObsidian, ingest } from '../apps/desktop/src/connectors.ts';
import { makeObject, emptyWorkspace } from '../packages/core/src/helpers.ts';
import { pushBatch } from '../packages/server/src/merge.ts';
import type { Change, Source } from '../packages/core/src/types.ts';
const kinds = JSON.parse(readFileSync(new URL('../infra/sql/kinds.json', import.meta.url), 'utf8'));
const change = (id: string, title: string, time = Date.now()): Change => ({ mutation_id: 'm-' + id, object_id: id, field: 'create', value: makeObject(title, 'u', { id, captured_at: time }), client_ts: Date.now(), base_rev: 0 });
async function local(t: any) { const dir = await mkdtemp(join(tmpdir(), 'drill-local-')); const s = new LocalStore(join(dir, 'replica.sqlite'), kinds); t.after(() => { try {
    s.close();
}
catch { } ; return rm(dir, { recursive: true, force: true }); }); return { s, dir }; }
test('SQLite：离线连续捕获三条，重启后队列与原始时间均保留', async (t) => { const { s, dir } = await local(t), captured = Date.now() - 86400000; s.commit([change('a', 'one', captured), change('b', 'two', captured + 1), change('c', 'three', captured + 2)]); s.close(); const reopened = new LocalStore(join(dir, 'replica.sqlite'), kinds); try {
    assert.equal(reopened.pending().length, 3);
    assert.equal(reopened.snapshot().objects[0].captured_at, captured);
    assert.equal(reopened.status().pending, 3);
}
finally {
    reopened.close();
} });
test('SQLite：断网同步失败不删除outbox', async (t) => { const { s } = await local(t); s.commit([change('a', 'offline')]); await assert.rejects(s.sync(async () => { throw new Error('offline'); })); assert.equal(s.pending().length, 1); assert.equal(s.snapshot().objects[0].title, 'offline'); });
test('SQLite：push成功但响应丢失，幂等重试只创建一次', async (t) => { const { s } = await local(t); s.commit([change('a', 'once')]); let w = emptyWorkspace('u', kinds), lost = true; const transport = async (path: string, _method?: string, b?: any) => { if (path === '/sync/push') {
    const r = pushBatch(w, b.changes, b.device_id);
    w = r.workspace;
    if (lost) {
        lost = false;
        throw new Error('lost response');
    }
    return { acknowledged: r.acknowledged };
} return { objects: w.objects, kinds, relations: [], placements: [], sources: [], proposals: [], conflicts: [], user: w.user, latest_seq: w.nextSeq, capabilities: { ai: false, semantic: false, demo: false } }; }; await assert.rejects(s.sync(transport)); await s.sync(transport); assert.equal(w.objects.length, 1); assert.equal(w.objects[0].rev, 1); assert.equal(s.pending().length, 0); assert.equal(s.snapshot().latest_seq, w.nextSeq); });
test('SQLite：同步失败不提前移动游标', async (t) => { const { s } = await local(t); await assert.rejects(s.sync(async () => { throw new Error('network'); })); assert.equal(s.snapshot().latest_seq, 0); });
test('SQLite：批次失败本地投影与outbox一起回滚', async (t) => { const { s } = await local(t); assert.throws(() => s.commit([change('a', 'one'), { ...change('b', 'two'), field: 'title' }])); assert.equal(s.pending().length, 0); assert.equal(s.snapshot().objects.length, 0); });
test('SQLite：FTS与中文子串搜索排除临时卡', async (t) => { const { s } = await local(t); const a = change('a', '英语口语练习'), b = change('b', '英语临时想法'); b.value.ephemeral = true; s.commit([a, b]); assert.equal(s.localSearch('口语')[0].id, 'a'); assert.equal(s.localSearch('英语').length, 1); });
test('SQLite：首次绑定迁移本机owner，拒绝跨后端和跨用户混库', async (t) => { const { s } = await local(t); s.commit([change('a', 'local')]); s.bind('https://one.example', { id: 'real-user', timezone: 'Asia/Shanghai', settings: {}, created_at: Date.now() }); assert.equal(s.pending()[0].value.user_id, 'real-user'); assert.throws(() => s.bind('https://two.example', { id: 'real-user' })); assert.throws(() => s.bind('https://one.example', { id: 'other' })); });
test('Chrome：同域且连续间隔小于30分钟聚合，否则分开', () => { const r = aggregateChrome([{ url: 'https://a.example/1', title: 'a', time: 1 }, { url: 'https://a.example/2', title: 'b', time: 120000 }, { url: 'https://b.example/1', title: 'c', time: 240000 }, { url: 'https://b.example/2', title: 'd', time: 240000 + 1800000 }]); assert.equal(r.length, 3); assert.equal(r[0].extra.visits, 2); assert.equal(r[0].captured_at, 1); });
test('Codex：只读可见对话，忽略工具与analysis并去除结构语法', () => { const r = parseCodex([JSON.stringify({ type: 'response_item', payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text: '[[想法]] #标签' }] } }), JSON.stringify({ type: 'response_item', payload: { type: 'message', role: 'assistant', channel: 'analysis', content: [{ type: 'output_text', text: 'internal' }] } }), JSON.stringify({ type: 'response_item', payload: { type: 'function_call', arguments: 'secret' } })].join('\n'), 'session.jsonl', 123); assert.ok(r); assert.equal(r.body, '我：想法 标签'); assert.equal(r.extra.turns, 1); });
test('Obsidian：一文件一对象、冻结快照不被更新、重拉不重复', async (t) => { const { s, dir } = await local(t); const path = join(dir, 'note.md'); await writeFile(path, '# 标题\n\n[[旧想法]] #标签'); const source: Source = { id: 'source', user_id: 'local', type: 'connector', connector: 'obsidian', name: 'Vault', properties: {}, config: { path: dir }, anchor: null, state: {}, last_synced: null, enabled: true }; s.setSource(source); const a = await ingest(s, source, join(dir, 'temp')); assert.equal(a.added, 1); const first = s.snapshot().objects[0], time = first.captured_at; assert.ok(!first.body.includes('[[')); await writeFile(path, 'changed'); const second = await ingest(s, s.snapshot().sources[0], join(dir, 'temp')); assert.equal(second.added, 0); assert.equal(second.changed, 1); assert.equal(s.snapshot().objects[0].body, first.body); assert.equal(s.snapshot().objects[0].captured_at, time); assert.equal(s.pending().length, 1); });
