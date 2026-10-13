/** SQLite replica + durable outbox. Optimistic projection is NOT conflict resolution.
 * Only the server resolves concurrent edits; every acknowledged entity is replaced by server state.
 */
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { bodyText } from '../../../packages/core/src/helpers.ts';
import type { Change, PublicSnapshot, KnowledgeObject, Source } from '../../../packages/core/src/types.ts';
export type Transport = (path: string, method?: string, body?: any) => Promise<any>;
const empty = (): PublicSnapshot => ({ objects: [], kinds: [], relations: [], placements: [], sources: [], proposals: [], conflicts: [], user: { id: 'local', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, created_at: Date.now(), settings: {} }, latest_seq: 0, capabilities: { ai: false, semantic: false, demo: false } });
export class LocalStore {
    db: DatabaseSync;
    device: string;
    private chain: Promise<any> = Promise.resolve();
    constructor(path: string, kinds: any[] = []) {
        mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
        this.db = new DatabaseSync(path);
        this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON;
 CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY,value TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS objects(id TEXT PRIMARY KEY,json TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS outbox(seq INTEGER PRIMARY KEY AUTOINCREMENT,mutation_id TEXT UNIQUE NOT NULL,object_id TEXT NOT NULL,json TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS requests(seq INTEGER PRIMARY KEY AUTOINCREMENT,path TEXT NOT NULL,body TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS asset_queue(id TEXT PRIMARY KEY,path TEXT NOT NULL,mime TEXT NOT NULL,hash TEXT NOT NULL,size INTEGER NOT NULL,remote_id TEXT);
 CREATE VIRTUAL TABLE IF NOT EXISTS search_index USING fts5(id UNINDEXED,title,body,tokenize='unicode61');`);
        this.device = this.meta('device') ?? 'desktop-' + randomUUID();
        this.setMeta('device', this.device);
        if (!this.meta('snapshot')) {
            const s = empty();
            s.kinds = kinds;
            this.setMeta('snapshot', s);
        }
    }
    close() { this.db.close(); }
    meta(key: string): any { const row = this.db.prepare('SELECT value FROM meta WHERE key=?').get(key) as any; return row ? JSON.parse(row.value) : null; }
    setMeta(key: string, value: any) { this.db.prepare('INSERT INTO meta(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key, JSON.stringify(value)); }
    serial<T>(fn: () => Promise<T>): Promise<T> { const p = this.chain.then(fn); this.chain = p.catch(() => { }); return p; }
    transaction<T>(fn: () => T): T { this.db.exec('BEGIN IMMEDIATE'); try {
        const r = fn();
        this.db.exec('COMMIT');
        return r;
    }
    catch (e) {
        this.db.exec('ROLLBACK');
        throw e;
    } }
    private put(o: KnowledgeObject) { this.db.prepare('INSERT INTO objects VALUES(?,?) ON CONFLICT(id) DO UPDATE SET json=excluded.json').run(o.id, JSON.stringify(o)); this.db.prepare('DELETE FROM search_index WHERE id=?').run(o.id); if (!o.deleted_at && !o.ephemeral && !['canvas', 'group'].includes(o.kind ?? ''))
        this.db.prepare('INSERT INTO search_index(id,title,body) VALUES(?,?,?)').run(o.id, o.title, o.body); }
    snapshot(): PublicSnapshot { const s = this.meta('snapshot') as PublicSnapshot; s.objects = (this.db.prepare('SELECT json FROM objects').all() as any[]).map(r => JSON.parse(r.json)); return s; }
    pending(): Change[] { return (this.db.prepare('SELECT json FROM outbox ORDER BY seq').all() as any[]).map(r => JSON.parse(r.json)); }
    status() { return { pending: (this.db.prepare('SELECT COUNT(*) AS n FROM outbox').get() as any).n + (this.db.prepare('SELECT COUNT(*) AS n FROM requests').get() as any).n, last_sync: this.meta('last_sync'), error: this.meta('sync_error'), connected: !!this.meta('backend') }; }
    commit(changes: Change[]) {
        if (!Array.isArray(changes) || changes.length > 500)
            throw new Error('本地变更批次无效');
        this.transaction(() => {
            const s = this.snapshot();
            for (const c of changes) {
                if (this.db.prepare('SELECT 1 FROM outbox WHERE mutation_id=?').get(c.mutation_id))
                    continue;
                this.db.prepare('INSERT INTO outbox(mutation_id,object_id,json) VALUES(?,?,?)').run(c.mutation_id, c.object_id, JSON.stringify(c));
                let o = s.objects.find(o => o.id === c.object_id);
                if (c.field === 'create') {
                    if (!o) {
                        o = structuredClone(c.value);
                        s.objects.push(o!);
                    }
                }
                else if (!o)
                    throw new Error('本地对象不存在');
                if (o) {
                    if (c.field === 'tag') {
                        const tags = new Set(o.tags_cached);
                        if (c.value.deleted_at)
                            tags.delete(c.value.tag);
                        else
                            tags.add(c.value.tag);
                        o.tags_cached = [...tags];
                    }
                    else if (c.field === 'relation') {
                        // 和服务端 applyRelation 的判定保持一致：type 是边的一部分，
                        // 同一对对象之间「归属」和「引用」是两条边，不能互相覆盖。
                        const type = c.value.type === 'belongs' ? 'belongs' : 'cite';
                        const source_field = type === 'belongs' || c.value.source_field !== 'canvas' ? 'manual' : 'canvas';
                        const p = { ...c.value, type, user_id: s.user.id, from_id: o.id, source_field, source_block_id: '', created_at: Date.now(), deleted_at: c.value.deleted_at ?? null };
                        s.relations = s.relations.filter(x => !(x.from_id === p.from_id && x.to_id === p.to_id && x.type === type && x.source_field === source_field));
                        s.relations.push(p);
                    }
                    else if (c.field === 'placement') {
                        const p = { ...c.value, canvas_id: o.id, user_id: s.user.id };
                        s.placements = s.placements.filter(x => !(x.canvas_id === o!.id && x.object_id === p.object_id));
                        s.placements.push(p);
                    }
                    else if (c.field === 'body_blocks') {
                        for (const b of c.value.blocks) {
                            const i = o.body_blocks.blocks.findIndex(x => x.id === b.id);
                            if (i < 0)
                                o.body_blocks.blocks.push(b);
                            else
                                o.body_blocks.blocks[i] = b;
                        }
                        o.body = bodyText(o.body_blocks.blocks);
                    }
                    else if (c.field !== 'create' && !['id', 'user_id', 'captured_at', 'rev', 'form', 'source_id', 'asset_id'].includes(c.field))
                        (o as any)[c.field] = c.value;
                    o.updated_at = Date.now();
                    this.put(o);
                }
            }
            this.setMeta('snapshot', { ...s, objects: [] });
        });
        return { acknowledged: [], stored: changes.map(c => c.mutation_id) };
    }
    setSource(source: Source) { this.transaction(() => { const s = this.snapshot(); const i = s.sources.findIndex(x => x.id === source.id); if (i >= 0)
        s.sources[i] = source;
    else
        s.sources.push(source); this.setMeta('snapshot', { ...s, objects: [] }); this.db.prepare('INSERT INTO requests(path,body) VALUES(?,?)').run('/sources', JSON.stringify(source)); }); }
    seenSources() { const s = this.snapshot(); for (const src of s.sources) {
        src.state = { ...src.state, unseen: 0, seen_at: Date.now() };
    } this.setMeta('snapshot', { ...s, objects: [] }); this.db.prepare('INSERT INTO requests(path,body) VALUES(?,?)').run('/sources/seen', '{}'); return { ok: true }; }
    localSearch(q: string) { const term = q.trim(); if (!term)
        return []; let rows: any[] = []; try {
        rows = this.db.prepare('SELECT id FROM search_index WHERE search_index MATCH ? LIMIT 80').all('"' + term.replaceAll('"', '""') + '"') as any[];
    }
    catch { /* Non-tokenizable query falls through to literal contains. */ } const s = this.snapshot(), ids = new Set(rows.map(r => r.id)); return s.objects.filter(o => !o.deleted_at && !o.ephemeral && !['canvas', 'group'].includes(o.kind ?? '') && (ids.has(o.id) || [o.title, o.body].some(t => t.toLocaleLowerCase().includes(term.toLocaleLowerCase())))).slice(0, 80); }
    /** Caller must hold serial() during network I/O; commit IPC uses the same serialization queue. */
    async sync(transport: Transport) {
        try {
            for (const row of this.db.prepare('SELECT * FROM requests ORDER BY seq').all() as any[]) {
                await transport(row.path, 'POST', JSON.parse(row.body));
                this.db.prepare('DELETE FROM requests WHERE seq=?').run(row.seq);
            }
            while (this.pending().length) {
                const changes = this.pending().slice(0, 200), r = await transport('/sync/push', 'POST', { device_id: this.device, changes });
                if (!Array.isArray(r.acknowledged) || !r.acknowledged.length)
                    throw new Error('服务端未确认离线批次');
                const allowed = new Set(changes.map(c => c.mutation_id));
                this.transaction(() => { for (const id of r.acknowledged)
                    if (allowed.has(id))
                        this.db.prepare('DELETE FROM outbox WHERE mutation_id=?').run(id); });
            }
            // Poll delta, not bootstrap. A full snapshot is needed only once; the saved cursor is never advanced before applying objects.
            const current = this.snapshot();
            const incoming = await transport('/sync/pull', 'POST', { device_id: this.device, since_seq: current.latest_seq });
            this.transaction(() => { for (const o of incoming.objects ?? [])
                this.put(o); this.setMeta('snapshot', { ...current, ...incoming, objects: [] }); this.setMeta('last_sync', Date.now()); this.setMeta('sync_error', null); });
        }
        catch (e: any) {
            this.setMeta('sync_error', e.message);
            throw e;
        }
    }
    bind(url: string, user: any) { const previous = this.meta('backend'); if (previous && previous !== url)
        throw new Error('已有本地库不可切换后端，请新建独立数据目录'); const owner = this.meta('owner'); if (owner && owner !== user.id)
        throw new Error('不能将另一用户的数据混入此本地库'); this.transaction(() => { const s = this.snapshot(); for (const o of s.objects) {
        o.user_id = user.id;
        this.put(o);
    } for (const row of this.db.prepare('SELECT seq,json FROM outbox').all() as any[]) {
        const c = JSON.parse(row.json);
        if (c.field === 'create')
            c.value.user_id = user.id;
        this.db.prepare('UPDATE outbox SET json=? WHERE seq=?').run(JSON.stringify(c), row.seq);
    } this.setMeta('snapshot', { ...s, user, objects: [] }); this.setMeta('backend', url); this.setMeta('owner', user.id); }); }
}
