/** Read-only, explicitly initiated ingestion. Never rewrites external files. */
import { readdir, readFile, stat, copyFile, mkdir, rm } from 'node:fs/promises';
import { join, relative, basename, extname } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { makeObject } from '../../../packages/core/src/helpers.ts';
import type { Source, Change } from '../../../packages/core/src/types.ts';
import type { LocalStore } from './local.ts';
export type ExternalSnapshot = {
    ref: string;
    version: string;
    title: string;
    body: string;
    captured_at: number;
    extra: Record<string, any>;
};
const hash = (text: string) => createHash('sha256').update(text).digest('hex');
const plain = (text: string) => text.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, title, alias) => alias ?? title).replace(/(^|\s)#([^\s#]+)/g, '$1$2');
async function files(root: string, extensions: string[], depth = 0): Promise<string[]> { if (depth > 15)
    return []; const results: string[] = []; for (const d of await readdir(root, { withFileTypes: true })) {
    if (d.name.startsWith('.') || d.name === 'node_modules')
        continue;
    const path = join(root, d.name);
    if (d.isDirectory())
        results.push(...await files(path, extensions, depth + 1));
    else if (d.isFile() && extensions.includes(extname(d.name)))
        results.push(path);
    if (results.length > 20000)
        throw new Error('目录超过20,000个文件，请选择更具体的子目录');
} return results; }
export async function readObsidian(root: string): Promise<ExternalSnapshot[]> { const out: ExternalSnapshot[] = []; for (const path of await files(root, ['.md'])) {
    const info = await stat(path);
    if (info.size > 2000000)
        continue;
    const raw = await readFile(path, 'utf8'), body = plain(raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, ''));
    out.push({ ref: relative(root, path), version: hash(raw), title: basename(path, '.md'), body, captured_at: Math.round(info.birthtimeMs || info.mtimeMs), extra: { external_path: relative(root, path), modified_at: info.mtimeMs } });
} return out; }
export function aggregateChrome(rows: {
    url: string;
    title: string;
    time: number;
}[]): ExternalSnapshot[] { const sessions: ExternalSnapshot[] = []; let current: any = null; for (const row of [...rows].sort((a, b) => a.time - b.time)) {
    let host: string;
    try {
        const u = new URL(row.url);
        if (!['http:', 'https:'].includes(u.protocol))
            continue;
        host = u.hostname;
    }
    catch {
        continue;
    }
    if (!current || current.host !== host || row.time - current.last >= 30 * 60000) {
        if (current)
            sessions.push(finish(current));
        current = { host, start: row.time, last: row.time, rows: [] };
    }
    current.rows.push(row);
    current.last = row.time;
} if (current)
    sessions.push(finish(current)); return sessions; }
function finish(c: any): ExternalSnapshot { const body = c.rows.map((r: any) => `${r.title || r.url}\n${r.url}`).join('\n\n'); return { ref: `${c.host}:${c.start}`, version: hash(body), title: `${c.host} · 浏览会话`, body, captured_at: c.start, extra: { domain: c.host, visits: c.rows.length, ended_at: c.last } }; }
export async function readChrome(path: string, temp: string): Promise<ExternalSnapshot[]> { await mkdir(temp, { recursive: true }); const copy = join(temp, randomUUID() + '.sqlite'); try {
    await copyFile(path, copy);
    for (const suffix of ['-wal', '-shm'])
        try {
            await copyFile(path + suffix, copy + suffix);
        }
        catch { }
    const db = new DatabaseSync(copy, { readOnly: true });
    let rows: any[];
    try {
        rows = db.prepare(`SELECT urls.url,urls.title,CAST(visits.visit_time/1000-11644473600000 AS INTEGER) AS time FROM visits JOIN urls ON urls.id=visits.url ORDER BY visits.visit_time DESC LIMIT 50000`).all();
    }
    finally {
        db.close();
    }
    return aggregateChrome(rows as any);
}
catch (e: any) {
    throw new Error('无法读取Chrome历史快照；请完全退出Chrome再拉取。' + e.message);
}
finally {
    for (const suffix of ['', '-wal', '-shm'])
        await rm(copy + suffix, { force: true }).catch(() => { });
} }
export function parseCodex(text: string, ref: string, created: number): ExternalSnapshot | null {
    const lines: string[] = [];
    let captured = created;
    for (const raw of text.split(/\r?\n/)) {
        let item: any;
        try {
            item = JSON.parse(raw);
        }
        catch {
            continue;
        }
        if (item.type === 'session_meta') {
            const time = Date.parse(item.payload?.timestamp ?? item.timestamp);
            if (Number.isFinite(time))
                captured = time;
            continue;
        }
        const p = item.payload;
        if (item.type === 'response_item' && p?.type === 'message' && ['user', 'assistant'].includes(p.role) && p.phase !== 'analysis' && p.channel !== 'analysis') {
            const content = (p.content ?? []).filter((x: any) => ['input_text', 'output_text', 'text'].includes(x.type)).map((x: any) => x.text ?? '').join('\n');
            if (content.trim())
                lines.push(`${p.role === 'user' ? '我' : '助手'}：${content.trim()}`);
        }
    }
    if (!lines.length)
        return null;
    const body = plain(lines.join('\n\n'));
    return { ref, version: hash(body), title: lines.find(x => x.startsWith('我：'))?.slice(2, 100) ?? basename(ref), body: body.slice(0, 1000000), captured_at: Math.round(captured), extra: { turns: lines.length, external_file: ref } };
}
export async function readCodex(root: string) { const out: ExternalSnapshot[] = []; for (const path of await files(root, ['.jsonl'])) {
    const s = await stat(path);
    if (s.size > 15000000)
        continue;
    const item = parseCodex(await readFile(path, 'utf8'), relative(root, path), s.birthtimeMs || s.mtimeMs);
    if (item)
        out.push(item);
} return out; }
export async function ingest(store: LocalStore, source: Source, temp: string) {
    const root = String(source.config.path ?? '');
    if (!root)
        throw new Error('请提供本机目录或历史数据库文件');
    const snapshots = source.connector === 'obsidian' ? await readObsidian(root) : source.connector === 'chrome' ? await readChrome(root, temp) : source.connector === 'codex' ? await readCodex(root) : [];
    const existing = store.snapshot().objects, changes: Change[] = [], newVersions: Record<string, any> = { ...source.state.new_versions };
    let count = 0;
    for (const item of snapshots) {
        const old = existing.find(o => o.source_id === source.id && o.source_ref === item.ref);
        if (old) {
            if (old.source_version !== item.version)
                newVersions[old.id] = { version: item.version, noticed_at: Date.now() };
            continue;
        }
        const id = 'ext-' + hash(source.id + '\0' + item.ref), o = makeObject(item.title, store.snapshot().user.id, { id, kind: 'material', body: item.body, source_id: source.id, source_ref: item.ref, source_version: item.version, captured_at: item.captured_at, extra: item.extra });
        changes.push({ mutation_id: 'ingest-' + id, object_id: id, field: 'create', value: o, client_ts: Date.now(), base_rev: 0 });
        count++;
    }
    // An interrupted pull may enqueue some chunks; deterministic IDs make the next pull safe to retry.
    for (let i = 0; i < changes.length; i += 200)
        store.commit(changes.slice(i, i + 200));
    const next = { ...source, anchor: { scanned_at: Date.now(), items: snapshots.length }, last_synced: Date.now(), state: { ...source.state, unseen: (source.state.unseen ?? 0) + count, new_versions: newVersions, error: null } };
    store.setSource(next);
    return { added: count, changed: Object.keys(newVersions).length };
}
