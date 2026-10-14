import { AgentService } from './agent/service.ts';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import type { Repository } from './repository.ts';
import type { Auth } from './auth.ts';
import { JWTAuth, checkPassword } from './auth.ts';
import type { Assets } from './assets.ts';
import { pushBatch, DomainError, getObject } from './merge.ts';
import { uid, makeObject, explicitMarkup } from '../../core/src/helpers.ts';
import type { Workspace, Change, PublicSnapshot, Asset } from '../../core/src/types.ts';
import { aiReady, semanticReady, related, searchable, lexicalScore, modelJSON, scopeObjects, embed, cosine, clusterVectors, contentHash } from './intelligence.ts';
import { EMBEDDING_MODEL, EMBEDDING_DIMS, embeddingReady, providers } from './embedding.ts';
export type ServerOptions = {
    /** Injectable for deterministic tests; production uses the real provider configuration. */
    agent?: AgentService;
    repo: Repository;
    auth: Auth;
    assets: Assets;
    demo?: boolean;
    /** 单用户口令登录。多用户环境必须为 false，否则所有登录都会落到同一个 owner。 */
    singleUser?: boolean;
    staticDir: string;
    origin?: string;
    owner?: string;
    password?: string;
};
const newChange = (id: string, field: string, value: any, rev = 0): Change => ({ mutation_id: uid(), object_id: id, field, value, base_rev: rev, client_ts: Date.now() });
function snapshot(w: Workspace, opts: ServerOptions, since?: number): PublicSnapshot {
    const changed = since === undefined ? null : new Set(w.changes.filter(c => c.seq > since).map(c => c.object_id));
    return { objects: changed ? w.objects.filter(o => changed.has(o.id)) : w.objects, kinds: w.kinds, relations: w.relations, placements: w.placements, sources: w.sources, proposals: w.proposals, conflicts: w.conflicts, user: w.user, latest_seq: w.nextSeq, capabilities: { ai: aiReady(), semantic: semanticReady(opts.repo), demo: !!opts.demo } };
}
async function jsonBody(req: IncomingMessage) { let data = ''; for await (const chunk of req) {
    data += chunk.toString();
    if (Buffer.byteLength(data) > 2 * 1024 * 1024)
        throw new DomainError('请求过大。媒体必须直接上传对象存储。', 413);
} if (!data)
    return {}; try {
    return JSON.parse(data);
}
catch {
    throw new DomainError('JSON请求格式错误', 400);
} }
function send(res: ServerResponse, data: any, status = 200) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)); }
export function createDrillServer(opts: ServerOptions) {
    const agent = opts.agent ?? new AgentService(opts.repo);
    const limits = new Map<string, {
        start: number;
        n: number;
    }>();
    const server = createServer(async (req, res) => {
        try {
            res.setHeader('X-Content-Type-Options', 'nosniff');
            res.setHeader('Referrer-Policy', 'no-referrer');
            res.setHeader('X-Frame-Options', 'DENY');
            const u = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`), path = u.pathname;
            const method = req.method ?? 'GET';
            const localOrigin = `http://${req.headers.host}`;
            if (req.headers.origin && req.headers.origin !== (opts.origin ?? localOrigin))
                throw new DomainError('跨域请求被拒绝', 403);
            if (path === '/health')
                return send(res, { ok: true, version: '0.1.0', mode: opts.demo ? 'demo' : 'postgres', auth: opts.auth instanceof JWTAuth ? 'password' : 'cloudbase',
                    embedding: { configured: embeddingReady(), model: EMBEDDING_MODEL, dimensions: EMBEDDING_DIMS, providers: providers().map(p => p.name) } });
            // 单用户引导入口。多用户环境必须关闭——它把任何成功登录都映射到同一个 owner。
            // 迁移到真正的用户体系时，这一整块会被替换或删除，不影响其他路由。
            if (path === '/auth/login' && method === 'POST') {
                if (!opts.singleUser || !(opts.auth instanceof JWTAuth))
                    throw new DomainError('此环境未开启单用户口令登录。请改用 /auth/token 提交身份令牌。', 404);
                const address = req.socket.remoteAddress ?? 'unknown', now = Date.now();
                const old = limits.get(address), v = old && now - old.start < 60000 ? old : { start: now, n: 0 };
                limits.set(address, v);
                if (++v.n > 10)
                    throw new DomainError('尝试过多，请一分钟后再试', 429);
                const b = await jsonBody(req);
                if (!opts.password || !checkPassword(String(b.password ?? ''), opts.password))
                    throw new DomainError('连接口令不正确', 401);
                const token = opts.auth.issue(opts.owner ?? 'owner');
                res.setHeader('Set-Cookie', `drill_token=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400${opts.origin?.startsWith('https') ? '; Secure' : ''}`);
                return send(res, { token });
            }
            if (path === '/auth/token' && method === 'POST') {
                const address = req.socket.remoteAddress ?? 'unknown', now = Date.now();
                const old = limits.get(address), v = old && now - old.start < 60000 ? old : { start: now, n: 0 };
                limits.set(address, v);
                if (++v.n > 10)
                    throw new DomainError('尝试过多，请一分钟后再试', 429);
                const b = await jsonBody(req);
                if (typeof b.token !== 'string' || !b.token || b.token.length > 16000 || /[^A-Za-z0-9._~+\/-]/.test(b.token))
                    throw new DomainError('令牌格式无效', 400);
                await opts.auth.verify(b.token);
                res.setHeader('Set-Cookie', `drill_token=${b.token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=3600${opts.origin?.startsWith('https') ? '; Secure' : ''}`);
                return send(res, { ok: true });
            }
            if (path === '/auth/demo' && method === 'POST' && opts.demo && opts.auth instanceof JWTAuth) {
                const token = opts.auth.issue('demo');
                res.setHeader('Set-Cookie', `drill_token=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400`);
                return send(res, { ok: true });
            }
            if (path === '/auth/logout' && method === 'POST') {
                res.setHeader('Set-Cookie', 'drill_token=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
                return send(res, { ok: true });
            }
            if (path.startsWith('/api/'))
                throw new DomainError('接口地址不包含/api前缀', 404);
            const route = /^\/(agent|bootstrap|objects|sync|search|related|insight|ai|versions|conflicts|assets|settings|sources|proposals|map|walk|recognize|export)(\/|$)/.test(path);
            if (!route) {
                if (method !== 'GET')
                    throw new DomainError('入口不存在', 404);
                const base = resolve(opts.staticDir), file = resolve(base, '.' + decodeURIComponent(path === '/' ? '/index.html' : path));
                if (file !== base && !file.startsWith(base + sep))
                    throw new DomainError('路径无效', 403);
                let bytes: Buffer;
                try {
                    bytes = await readFile(file);
                }
                catch {
                    throw new DomainError('页面尚未构建，请先运行 npm run build 或 npm run demo', 404);
                }
                const mime: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };
                res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https: http://localhost:9000 http://127.0.0.1:9000; media-src 'self' data: blob: https: http://localhost:9000 http://127.0.0.1:9000; connect-src 'self' https: http://localhost:9000 http://127.0.0.1:9000; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
                res.writeHead(200, { 'Content-Type': mime[extname(file)] ?? 'application/octet-stream' });
                res.end(bytes);
                return;
            }
            const token = req.headers.authorization?.replace(/^Bearer /i, '') ?? req.headers.cookie?.match(/(?:^|;\s*)drill_token=([^;]+)/)?.[1] ?? '';
            const user = await opts.auth.verify(token);
            const b = method === 'POST' || method === 'PATCH' ? await jsonBody(req) : {};
            if (path === '/agent' || path.startsWith('/agent/'))
                return send(res, await agent.handle(user, path, method, u.searchParams, b));
            if (path === '/sync/push' && method === 'POST') {
                if (!Array.isArray(b.changes))
                    throw new DomainError('缺少变更列表', 400);
                const result = await opts.repo.transaction(user, w => { const pushed = pushBatch(w, b.changes, b.device_id); return { workspace: pushed.workspace, result: { acknowledged: pushed.acknowledged } }; });
                return send(res, result);
            }
            if (path === '/sync/pull' && method === 'POST') {
                if (typeof b.device_id !== 'string' || !b.device_id || b.device_id.length > 200 || b.device_id === '__proto__' || !Number.isSafeInteger(b.since_seq) || b.since_seq < 0)
                    throw new DomainError('同步游标无效');
                const result = await opts.repo.transaction(user, w => { w.devices[b.device_id] = { last_seq: b.since_seq, last_seen: Date.now() }; return { workspace: w, result: { ...snapshot(w, opts, b.since_seq), changes: w.changes.filter(c => c.seq > b.since_seq), assets: w.assets.filter(a => a.committed), versions: w.versions } }; });
                return send(res, result);
            }
            if (path === '/bootstrap')
                return send(res, snapshot(await opts.repo.read(user), opts));
            if (path === '/settings' && method === 'POST') {
                const out = await opts.repo.transaction(user, w => {
                    if (b.timezone) {
                        try {
                            new Intl.DateTimeFormat('en', { timeZone: b.timezone }).format();
                        }
                        catch {
                            throw new DomainError('时区无效');
                        }
                        w.user.timezone = b.timezone;
                    }
                    if (b.hide_object) {
                        getObject(w, b.hide_object);
                        w.user.settings.discovery_hidden = [...new Set([...(w.user.settings.discovery_hidden ?? []), b.hide_object])];
                    }
                    if (b.unhide_object)
                        w.user.settings.discovery_hidden = (w.user.settings.discovery_hidden ?? []).filter((x: string) => x !== b.unhide_object);
                    if (['title_only', 'collapse_body', 'full'].includes(b.canvas_display))
                        w.user.settings.canvas_display = b.canvas_display;
                    return { workspace: w, result: w.user };
                });
                return send(res, out);
            }
            if (path === '/sources' && method === 'POST') {
                const out = await opts.repo.transaction(user, w => { if (!b.id || !['obsidian', 'chrome', 'codex'].includes(b.connector))
                    throw new DomainError('连接器定义无效'); const old = w.sources.find(s => s.id === b.id); const source = { id: b.id, user_id: user, type: 'connector' as const, connector: b.connector, name: String(b.name ?? b.connector), properties: b.properties ?? {}, config: b.config ?? {}, anchor: b.anchor ?? null, state: b.state ?? {}, last_synced: b.last_synced ?? null, enabled: b.enabled !== false }; if (old)
                    Object.assign(old, source);
                else
                    w.sources.push(source); return { workspace: w, result: source }; });
                return send(res, out);
            }
            if (path === '/sources/seen' && method === 'POST') {
                await opts.repo.transaction(user, w => { for (const s of w.sources)
                    s.state = { ...s.state, seen_at: Date.now(), unseen: 0 }; return { workspace: w, result: true }; });
                return send(res, { ok: true });
            }
            if (path === '/assets/sign' && method === 'POST') {
                if (!Number.isSafeInteger(b.size) || b.size < 1 || b.size > 2 * 1024 * 1024 * 1024 || !(/^[a-f0-9]{64}$/.test(b.hash ?? '')) || !(/^(image|audio|video)\//.test(b.mime ?? '')))
                    throw new DomainError('媒体大小、类型或哈希无效');
                let dedup = false;
                const asset = await opts.repo.transaction(user, w => { const existing = w.assets.find(a => a.hash === b.hash && a.size === b.size && a.committed); if (existing) {
                    dedup = true;
                    return { workspace: w, result: existing };
                } const id = uid(); const a: Asset = { id, user_id: user, hash: b.hash, size: b.size, mime: b.mime, storage_key: `${encodeURIComponent(user)}/${id}`, thumb_key: null, width: null, height: null, duration: null, created_at: Date.now(), committed: false }; w.assets.push(a); return { workspace: w, result: a }; });
                if (dedup)
                    return send(res, { asset_id: asset.id, storage_key: asset.storage_key, deduplicated: true });
                return send(res, { asset_id: asset.id, storage_key: asset.storage_key, upload_token: await opts.assets.sign(asset) });
            }
            if (path === '/assets/commit' && method === 'POST') {
                const w = await opts.repo.read(user), a = w.assets.find(x => x.id === b.asset_id);
                if (!a)
                    throw new DomainError('资产不存在', 404);
                if (a.hash !== b.hash || a.size !== b.size)
                    throw new DomainError('资产声明和签名记录不一致');
                await opts.assets.verify(a);
                await opts.repo.transaction(user, w => { w.assets.find(x => x.id === a.id)!.committed = true; return { workspace: w, result: true }; });
                return send(res, { ok: true, asset_id: a.id });
            }
            if (/^\/assets\/[^/]+\/url$/.test(path)) {
                const w = await opts.repo.read(user), a = w.assets.find(x => x.id === decodeURIComponent(path.split('/')[2]) && x.committed);
                if (!a)
                    throw new DomainError('资产不存在或未提交', 404);
                return send(res, { url: await opts.assets.url(a), expires_in: 300 });
            }
            if (path === '/export') {
                const w = await opts.repo.read(user);
                return send(res, { version: 1, exported_at: Date.now(), ...snapshot(w, opts), versions: w.versions, assets: w.assets });
            }
            if (path === '/proposals/decide' && method === 'POST') {
                const out = await opts.repo.transaction(user, w => {
                    const p = w.proposals.find(x => x.id === b.id);
                    if (!p || p.status !== 'pending')
                        throw new DomainError('建议已处理或不存在', 409);
                    if (!['accepted', 'edited', 'rejected'].includes(b.status))
                        throw new DomainError('决定无效');
                    let next = w;
                    if (b.status !== 'rejected') {
                        const o = getObject(w, p.object_id), v = b.status === 'accepted' ? p.ai_value : b.value;
                        // 归属的落地形态是一条 belongs 边，不是对象上的字段。
                        const changes = p.field === 'tags' ? (Array.isArray(v) ? v : []).map((tag: string) => newChange(o.id, 'tag', { tag }, o.rev)) : p.field === 'belongs' ? [newChange(o.id, 'relation', { to_id: v, type: 'belongs' }, o.rev)] : [newChange(o.id, p.field, v, o.rev)];
                        next = pushBatch(w, changes, 'proposal-decision').workspace;
                    }
                    const decision = next.proposals.find(x => x.id === p.id)!;
                    decision.status = b.status;
                    decision.final_value = b.status === 'rejected' ? null : b.status === 'accepted' ? p.ai_value : b.value;
                    decision.decided_at = Date.now();
                    return { workspace: next, result: decision };
                });
                return send(res, out);
            }
            if (path === '/ai/distill' && method === 'POST') {
                const w = await opts.repo.read(user), o = getObject(w, b.object_id);
                if (!aiReady()) throw new DomainError('还未连接 AI，请在服务端配置密钥与模型。', 503);
                if (w.user.settings.agent_consent !== true) throw new DomainError('请在 Agent 设置中确认 AI 资料使用授权。', 403);
                const tags = [...new Set(w.tags.filter(t => !t.deleted_at).map(t => t.tag))];
                const output = await modelJSON('提议字段，不替用户作决定。返回 {"proposals":[{"field":"kind|belongs|tags|status|applies_to","value":...}]}。只从传入类型、归属和已有标签中选择；belongs 的 value 是对象ID；外部资料不可变沉淀；模糊想法不能变行动；没有把握返回空数组。', { object: { id: o.id, title: o.title, body: o.body.slice(0, 12000), kind: o.kind }, kinds: w.kinds, parents: w.objects.filter(x => ['domain', 'project'].includes(x.kind ?? '')).map(x => ({ id: x.id, title: x.title })), existing_tags: tags });
                const rows = Array.isArray(output.proposals) ? output.proposals : [];
                const session = uid();
                const p = rows.filter((p: any) => ['kind', 'belongs', 'tags', 'status', 'applies_to'].includes(p.field)).filter((p: any) => p.field !== 'belongs' || w.objects.some(o => o.id === p.value)).filter((p: any) => p.field !== 'tags' || (Array.isArray(p.value) && p.value.every((t: string) => tags.includes(t)))).filter((p: any) => p.field !== 'kind' || w.kinds.some(k => k.id === p.value)).slice(0, 5).map((p: any) => ({ id: uid(), session_id: session, object_id: o.id, field: p.field, ai_value: p.value, final_value: null, status: 'pending' as const, decided_at: null, user_id: user }));
                await opts.repo.transaction(user, w => { w.proposals.push(...p); return { workspace: w, result: true }; });
                return send(res, { proposals: p });
            }
            if (path === '/insight' && method === 'POST') {
                const w = await opts.repo.read(user), items = scopeObjects(w, b.scope);
                if (!aiReady()) throw new DomainError('还未连接 AI，请在服务端配置密钥与模型。', 503);
                if (w.user.settings.agent_consent !== true) throw new DomainError('请在 Agent 设置中确认 AI 资料使用授权。', 403);
                if (items.length < 2)
                    return send(res, { silent: true, text: '', citations: [] });
                const out = await modelJSON('找出证据支持的重复、张力或盲点。不要奉承，不要为了有输出而编造。返回 {"silent":boolean,"title":string,"text":string,"citations":[对象ID]}。没有明确张力必须silent=true；输出应有一个值得思考的问题。', { objects: items.map(o => ({ id: o.id, title: o.title, body: o.body.slice(0, 3000), captured_at: o.captured_at })) });
                const citations: string[] = Array.isArray(out?.citations) ? [...new Set<string>(out.citations.filter((id: unknown) => typeof id === 'string' && items.some(o => o.id === id)))] : [];
                if (out?.silent !== false || typeof out.text !== 'string' || !out.text.trim() || citations.length < 2)
                    return send(res, { silent: true, text: '', citations: [] });
                const object = makeObject(String(out.title ?? '一次思考的旁注').slice(0, 200), user, { kind: 'ai_output', body: out.text.slice(0, 12000), extra: { citations } });
                await opts.repo.transaction(user, w => { let next = pushBatch(w, [newChange(object.id, 'create', object)], 'ai', 'ai').workspace; next = pushBatch(next, citations.map((id: string) => newChange(object.id, 'relation', { to_id: id }, getObject(next, object.id).rev)), 'ai-citations').workspace; return { workspace: next, result: true }; });
                return send(res, { silent: false, text: object.body, citations, object_id: object.id });
            }
            if (path === '/search/reindex' && method === 'POST') {
                if (!semanticReady(opts.repo) || !opts.repo.saveVector)
                    throw new DomainError('向量服务尚未连接；字面搜索不受影响', 503);
                const w = await opts.repo.read(user), all = searchable(w), offset = Math.max(0, Number(b.offset) || 0);
                const batch = all.slice(offset, offset + 8);
                if (batch.length) {
                    const v = await embed(batch.map(o => (o.title + '\n' + o.body).slice(0, 24000)));
                    for (let i = 0; i < batch.length; i++)
                        await opts.repo.saveVector(user, batch[i].id, v[i], contentHash(batch[i]));
                }
                // 库里若有别的模型的向量，说明换过模型而没重建——此时语义检索会静默返回空。
                const stale = (await opts.repo.vectorModels?.(user) ?? []).filter(m => m.model !== EMBEDDING_MODEL);
                return send(res, { indexed: batch.length, next_offset: offset + batch.length, done: offset + batch.length >= all.length, model: EMBEDDING_MODEL, stale_models: stale });
            }
            if (path === '/search') {
                const q = u.searchParams.get('q')?.trim() ?? '', mode = u.searchParams.get('mode') ?? 'lexical';
                if (!q)
                    return send(res, { items: [], mode });
                const w = await opts.repo.read(user);
                const lexical = opts.repo.lexical ? await opts.repo.lexical(user, q) : searchable(w).map(o => ({ ...o, score: lexicalScore(o.title + ' ' + o.body, q) })).filter(o => (o.title + ' ' + o.body).toLowerCase().includes(q.toLowerCase()) || o.score > 0.15).sort((a, b) => b.score - a.score).slice(0, 100);
                if (mode === 'lexical')
                    return send(res, { items: lexical, mode });
                if (!semanticReady(opts.repo))
                    throw new DomainError('语义搜索需要先连接向量服务', 503);
                const [query] = await embed([q]), vectors = await opts.repo.vectors!(user);
                const alive = new Set(searchable(w).map(o => o.id));
                const semantic = vectors.filter(v => alive.has(v.object_id)).map(v => ({ ...getObject(w, v.object_id), score: cosine(query, v.vec) })).sort((a, b) => b.score - a.score).slice(0, 100);
                if (mode === 'semantic')
                    return send(res, { items: semantic, mode });
                const scores = new Map<string, number>();
                for (const rank of [lexical, semantic])
                    rank.forEach((o: any, i: number) => scores.set(o.id, (scores.get(o.id) ?? 0) + 1 / (60 + i + 1)));
                return send(res, { items: [...scores.entries()].sort((a, b) => b[1] - a[1]).slice(0, 100).map(([id, score]) => ({ ...getObject(w, id), score })), mode: 'hybrid' });
            }
            if (path === '/map' || path === '/walk') {
                if (!semanticReady(opts.repo))
                    throw new DomainError('认知地图与随机漫步需要 bge-m3 向量索引。不会用随机图冒充语义结果。', 503);
                const w = await opts.repo.read(user), eligible = searchable(w).filter(o => !(w.user.settings.discovery_hidden ?? []).includes(o.id));
                const vectors = await opts.repo.vectors!(user);
                const items = vectors.map(v => ({ vec: v.vec, object: eligible.find(o => o.id === v.object_id)! })).filter(x => x.object);
                if (path === '/map')
                    return send(res, { clusters: clusterVectors(items), indexed: items.length, method: 'farthest-seed-cosine', experimental: true });
                const current = items.find(o => o.object.id === b.previous_id), exclude = new Set(Array.isArray(b.exclude_ids) ? b.exclude_ids : []);
                let candidates = items.filter(i => !exclude.has(i.object.id) && i.object.id !== current?.object.id);
                const jump = !!current && Math.random() < Number(process.env.WALK_JUMP_RATE ?? 0.15);
                if (current)
                    candidates = candidates.sort((a, b) => jump ? cosine(a.vec, current.vec) - cosine(b.vec, current.vec) : cosine(b.vec, current.vec) - cosine(a.vec, current.vec)).slice(0, 8);
                const shown = w.user.settings.recently_shown ?? {};
                const weights = candidates.map(c => 1 / (1 + Math.max(0, 7 - (Date.now() - (shown[c.object.id] ?? 0)) / 86400000)));
                let pick = Math.random() * weights.reduce((a, b) => a + b, 0), chosen = candidates[0];
                for (let i = 0; i < candidates.length; i++) {
                    pick -= weights[i];
                    if (pick <= 0) {
                        chosen = candidates[i];
                        break;
                    }
                }
                if (!chosen)
                    return send(res, { object: null });
                await opts.repo.transaction(user, w => { w.user.settings.recently_shown = { ...(w.user.settings.recently_shown ?? {}), [chosen.object.id]: Date.now() }; return { workspace: w, result: true }; });
                return send(res, { object: chosen.object, jump });
            }
            if (path === '/recognize' && method === 'POST') {
                if (!b.text?.trim() || !Array.isArray(b.object_ids) || b.object_ids.length < 2)
                    throw new DomainError('写下你认出的关联，并选择两个对象');
                const w = await opts.repo.read(user);
                for (const id of b.object_ids)
                    getObject(w, id);
                const o = makeObject(b.text.trim(), user, { kind: 'thought', extra: { recognition: true } });
                await opts.repo.transaction(user, w => { let next = pushBatch(w, [newChange(o.id, 'create', o)], 'recognition').workspace; next = pushBatch(next, b.object_ids.map((id: string) => newChange(o.id, 'relation', { to_id: id }, getObject(next, o.id).rev)), 'recognition').workspace; return { workspace: next, result: true }; });
                return send(res, { object: o });
            }
            const w = await opts.repo.read(user);
            if (path === '/objects') {
                let items = searchable(w);
                for (const f of ['kind', 'status'])
                    if (u.searchParams.has(f))
                        items = items.filter(o => (o as any)[f] === u.searchParams.get(f));
                // 归属是边，不是字段：?belongs=<id> 返回直接挂在它下面的对象。
                if (u.searchParams.has('belongs')) {
                    const container = u.searchParams.get('belongs')!;
                    items = items.filter(o => w.relations.some(r => r.from_id === o.id && r.type === 'belongs' && r.to_id === container && !r.deleted_at));
                }
                const since = Number(u.searchParams.get('since') ?? 0);
                items = items.filter(o => o.captured_at >= since);
                const offset = Math.max(0, Number(u.searchParams.get('offset')) || 0), limit = Math.min(500, Number(u.searchParams.get('limit')) || 100);
                items.sort((a, b) => b.captured_at - a.captured_at);
                return send(res, { objects: items.slice(offset, offset + limit), next_offset: offset + limit < items.length ? offset + limit : null });
            }
            if (path.startsWith('/objects/'))
                return send(res, getObject(w, decodeURIComponent(path.split('/')[2])));
            if (path.startsWith('/related/'))
                return send(res, await related(w, opts.repo, decodeURIComponent(path.split('/')[2])));
            if (path.startsWith('/versions/'))
                return send(res, { versions: w.versions.filter(v => v.object_id === decodeURIComponent(path.split('/')[2])) });
            if (path === '/conflicts')
                return send(res, { conflicts: w.conflicts });
            throw new DomainError('这个入口不存在', 404);
        }
        catch (error: any) {
            if (res.headersSent) {
                res.end();
                return;
            }
            const status = error instanceof DomainError ? error.status : 500;
            if (status === 500)
                console.error(error);
            send(res, { error: status === 500 ? '服务暂时未能完成请求，请查看服务端日志' : error.message }, status);
        }
    });
    server.on('close', () => { void agent.close(); });
    return server;
}
