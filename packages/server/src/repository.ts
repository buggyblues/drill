import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import { join } from 'node:path';
import type { Workspace, Kind } from '../../core/src/types.ts';
import { emptyWorkspace } from '../../core/src/helpers.ts';
import { EMBEDDING_MODEL } from './embedding.ts';
export interface Repository {
    transaction<T>(userId: string, fn: (w: Workspace) => Promise<{
        workspace: Workspace;
        result: T;
    }> | {
        workspace: Workspace;
        result: T;
    }): Promise<T>;
    read(userId: string): Promise<Workspace>;
    lexical?(userId: string, q: string): Promise<any[]>;
    vectors?(userId: string): Promise<{
        object_id: string;
        vec: number[];
    }[]>;
    saveVector?(userId: string, id: string, vector: number[], hash: string): Promise<void>;
    /** 该用户库里存在哪些模型的向量。用于检测「换了模型但没重建索引」。 */
    vectorModels?(userId: string): Promise<{
        model: string;
        n: number;
    }[]>;
}
/** Development demonstration only. Never selected by the production entrypoint. */
export class DemoRepository implements Repository {
    private tails = new Map<string, Promise<unknown>>();
    private root: string;
    private kinds: Kind[];
    constructor(root: string, kinds: Kind[]) { this.root = root; this.kinds = kinds; }
    private path(user: string) { if (!/^[A-Za-z0-9_-]{1,100}$/.test(user))
        throw new Error('Invalid demo user'); return join(this.root, user + '.json'); }
    async read(user: string) { try {
        return JSON.parse(await readFile(this.path(user), 'utf8')) as Workspace;
    }
    catch (e: any) {
        if (e.code !== 'ENOENT')
            throw e;
        return emptyWorkspace(user, this.kinds);
    } }
    async transaction<T>(user: string, fn: (w: Workspace) => Promise<{
        workspace: Workspace;
        result: T;
    }> | {
        workspace: Workspace;
        result: T;
    }): Promise<T> {
        const previous = this.tails.get(user) ?? Promise.resolve();
        const run = previous.catch(() => { }).then(async () => { const current = await this.read(user); const { workspace, result } = await fn(current); await mkdir(this.root, { recursive: true }); const temp = this.path(user) + '.tmp'; await writeFile(temp, JSON.stringify(workspace), { mode: 0o600 }); await rename(temp, this.path(user)); return result; });
        this.tails.set(user, run);
        return run;
    }
}
const maps: Record<string, {
    property: keyof Workspace;
    keys: string[];
    json?: string[];
}> = {
    objects: { property: 'objects', keys: ['user_id', 'id'], json: ['body_blocks', 'extra'] }, object_tags: { property: 'tags', keys: ['user_id', 'object_id', 'tag'] }, relations: { property: 'relations', keys: ['user_id', 'from_id', 'type', 'to_id', 'source_field', 'source_block_id'] }, placements: { property: 'placements', keys: ['user_id', 'canvas_id', 'object_id'] }, assets: { property: 'assets', keys: ['user_id', 'id'], json: ['provider_data'] }, sources: { property: 'sources', keys: ['user_id', 'id'], json: ['properties', 'config', 'anchor', 'state'] }, proposals: { property: 'proposals', keys: ['user_id', 'id'], json: ['ai_value', 'final_value'] }, versions: { property: 'versions', keys: ['user_id', 'object_id', 'rev'], json: ['snapshot'] }, conflicts: { property: 'conflicts', keys: ['user_id', 'id'], json: ['losing_value'] }
};
/**
 * 注入登录态。
 *
 * 变量名和 `auth.uid()` 的定义都与 CloudBase PG 模式一致：
 *   - 自托管：这里写进去
 *   - CloudBase：网关从 JWT 解析后自动注入
 *
 * 所以 RLS 策略、以及任何调用 auth.uid() 的 SQL，两边通用、可原样迁移。
 * 服务端从不直接传 user_id 给业务查询——它只注入 claims，剩下交给 RLS 与 DAL 绑定。
 */
export const bindTenant = (c: any, user: string) =>
    c.query("SELECT set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: user })]);

/** Both CloudBase and self-hosted use this exact class / pg.Pool. */
export class PostgresRepository implements Repository {
    pool: any;
    constructor(pool: any) { this.pool = pool; }
    private async load(c: any, user: string): Promise<Workspace> {
        const k = (await c.query('SELECT * FROM kinds ORDER BY sort')).rows;
        const w = emptyWorkspace(user, k);
        const u = (await c.query('SELECT * FROM users WHERE id=$1', [user])).rows[0];
        if (u)
            w.user = u;
        for (const [table, m] of Object.entries(maps))
            (w as any)[m.property] = (await c.query(`SELECT * FROM ${table} WHERE user_id=$1`, [user])).rows.map((r: any) => { delete r.search_vector; return r; });
        w.changes = (await c.query('SELECT * FROM changes WHERE user_id=$1 ORDER BY seq', [user])).rows;
        w.nextSeq = w.changes.at(-1)?.seq ?? 0;
        w.clocks = Object.fromEntries((await c.query('SELECT key,value FROM field_clocks WHERE user_id=$1', [user])).rows.map((x: any) => [x.key, x.value]));
        w.mutations = (await c.query('SELECT id FROM applied_mutations WHERE user_id=$1', [user])).rows.map((x: any) => x.id);
        w.devices = Object.fromEntries((await c.query('SELECT * FROM devices WHERE user_id=$1', [user])).rows.map((x: any) => [x.id, { last_seq: x.last_seq, last_seen: x.last_seen }]));
        return w;
    }
    private async upsert(c: any, table: string, keys: string[], row: Record<string, any>, json: string[] = []) {
        const cols = Object.keys(row).filter(k => row[k] !== undefined && k !== 'search_vector');
        if (cols.some(k => !/^[a-z_]+$/.test(k)))
            throw new Error('Invalid internal column');
        const values = cols.map(k => json.includes(k) ? JSON.stringify(row[k]) : row[k]);
        const update = cols.filter(k => !keys.includes(k)).map(k => `${k}=EXCLUDED.${k}`).join(',');
        await c.query(`INSERT INTO ${table} (${cols.join(',')}) VALUES (${cols.map((_, i) => '$' + (i + 1)).join(',')}) ON CONFLICT (${keys.join(',')}) DO ${update ? 'UPDATE SET ' + update : 'NOTHING'}`, values);
    }
    async transaction<T>(user: string, fn: (w: Workspace) => Promise<{
        workspace: Workspace;
        result: T;
    }> | {
        workspace: Workspace;
        result: T;
    }): Promise<T> {
        const c = await this.pool.connect();
        try {
            await c.query('BEGIN');
            await bindTenant(c, user);
            // Also serializes pull with push; no transaction can advance past an uncommitted sequence.
            await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [user]);
            await c.query('INSERT INTO users(id,created_at) VALUES($1,$2) ON CONFLICT DO NOTHING', [user, Date.now()]);
            const before = await this.load(c, user);
            const { workspace: w, result } = await fn(structuredClone(before));
            await c.query('UPDATE users SET timezone=$2,settings=$3 WHERE id=$1', [user, w.user.timezone, JSON.stringify(w.user.settings)]);
            for (const [table, m] of Object.entries(maps)) {
                const key = (r: any) => JSON.stringify(m.keys.map(k => r[k]));
                const old = new Map((before[m.property] as any[]).map(r => [key(r), JSON.stringify(r)]));
                for (const row of w[m.property] as any[])
                    if (JSON.stringify(row) !== old.get(key(row)))
                        await this.upsert(c, table, m.keys, { ...row, user_id: user }, m.json);
            }
            for (const [key, value] of Object.entries(w.clocks))
                if (JSON.stringify(value) !== JSON.stringify(before.clocks[key]))
                    await this.upsert(c, 'field_clocks', ['user_id', 'key'], { user_id: user, key, value }, ['value']);
            const prior = new Set(before.mutations);
            for (const id of w.mutations)
                if (!prior.has(id))
                    await this.upsert(c, 'applied_mutations', ['user_id', 'id'], { user_id: user, id });
            for (const [id, value] of Object.entries(w.devices))
                await this.upsert(c, 'devices', ['user_id', 'id'], { user_id: user, id, ...value });
            for (const change of w.changes.slice(before.changes.length)) {
                const { seq, ...row } = change;
                const cols = Object.keys(row);
                const inserted = await c.query(`INSERT INTO changes(${cols.join(',')}) VALUES(${cols.map((_, i) => '$' + (i + 1)).join(',')}) RETURNING seq`, cols.map(k => k === 'value' ? JSON.stringify((row as any)[k]) : (row as any)[k]));
                change.seq = inserted.rows[0].seq;
                w.nextSeq = change.seq;
            }
            await c.query('COMMIT');
            return result;
        }
        catch (e) {
            await c.query('ROLLBACK');
            throw e;
        }
        finally {
            c.release();
        }
    }
    async read(user: string) { return this.transaction(user, w => ({ workspace: w, result: w })); }
    async lexical(user: string, q: string) { const c = await this.pool.connect(); try {
        await c.query('BEGIN');
        await bindTenant(c, user);
        const result = await c.query("SELECT *,similarity(title||' '||body,$2) AS score FROM objects WHERE user_id=$1 AND deleted_at IS NULL AND NOT ephemeral AND (kind IS NULL OR kind NOT IN ('canvas','group')) AND ((title||' '||body) ILIKE $3 ESCAPE '\\' OR (title||' '||body) % $2) ORDER BY score DESC,captured_at DESC LIMIT 100", [user, q, '%' + q.replace(/[\\%_]/g, '\\$&') + '%']);
        await c.query('COMMIT');
        return result.rows;
    }
    catch (e) {
        await c.query('ROLLBACK');
        throw e;
    }
    finally {
        c.release();
    } }
    async vectors(user: string) { const c = await this.pool.connect(); try {
        await c.query('BEGIN');
        await bindTenant(c, user);
        const rows = (await c.query('SELECT object_id,vec::text FROM embeddings WHERE user_id=$1 AND model=$2', [user, EMBEDDING_MODEL])).rows;
        await c.query('COMMIT');
        return rows.map((r: any) => ({ object_id: r.object_id, vec: JSON.parse(r.vec) }));
    }
    catch (e) {
        await c.query('ROLLBACK');
        throw e;
    }
    finally {
        c.release();
    } }
    async saveVector(user: string, id: string, vec: number[], hash: string) { const c = await this.pool.connect(); try {
        await c.query('BEGIN');
        await bindTenant(c, user);
        await c.query("INSERT INTO embeddings(user_id,object_id,chunk_id,model,vec,content_hash) VALUES($1,$2,'main',$3,$4,$5) ON CONFLICT(user_id,object_id,chunk_id,model) DO UPDATE SET vec=EXCLUDED.vec,content_hash=EXCLUDED.content_hash", [user, id, EMBEDDING_MODEL, JSON.stringify(vec), hash]);
        await c.query('COMMIT');
    }
    catch (e) {
        await c.query('ROLLBACK');
        throw e;
    }
    finally {
        c.release();
    } }
    async vectorModels(user: string) { const c = await this.pool.connect(); try {
        await c.query('BEGIN');
        await bindTenant(c, user);
        const rows = (await c.query('SELECT model, count(*)::int AS n FROM embeddings WHERE user_id=$1 GROUP BY model ORDER BY n DESC', [user])).rows;
        await c.query('COMMIT');
        return rows;
    }
    catch (e) {
        await c.query('ROLLBACK');
        throw e;
    }
    finally {
        c.release();
    } }
}
export async function connectPostgres() { const pg = await import('pg'); pg.types.setTypeParser(20, (v: string) => Number(v)); const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 8, ssl: process.env.PGSSL === 'require' ? { rejectUnauthorized: process.env.PGSSL_VERIFY !== 'false' } : undefined }); return new PostgresRepository(pool); }
