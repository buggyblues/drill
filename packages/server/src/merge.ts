/** The sole conflict-resolution implementation. Never imported by any client. */
import type { Workspace, KnowledgeObject, Change, Clock, Block, Placement, Relation, Kind, RelationRule, RelationType } from '../../core/src/types.ts';
import { makeObject, uid, bodyText, explicitMarkup } from '../../core/src/helpers.ts';
export class DomainError extends Error {
    status: number;
    constructor(message: string, status = 422) { super(message); this.status = status; }
}
const scalar = new Set(['title', 'body', 'kind', 'series', 'status', 'due_at', 'sort_key', 'applies_to', 'confirmed_at', 'valid_until', 'extra', 'ephemeral']);
const comparable = (a: Clock, b?: Clock) => !b || a.ts > b.ts || (a.ts === b.ts && a.device >= b.device);
const eq = (a: any, b: any) => JSON.stringify(a) === JSON.stringify(b);
const live = (o: KnowledgeObject) => !o.deleted_at;
/** 未提炼的内容也能有归属，所以没有 kind 时用这个默认；kind 自己声明了就听声明的。 */
const DEFAULT_BELONGS: RelationRule = { targets: ['domain', 'project'], multiple: false };
export const belongsRule = (kind?: Kind | null): RelationRule => kind?.relations?.belongs ?? DEFAULT_BELONGS;
/** 一个对象的归属边（子 → 父）。归属是关系表里的一条边，不是对象上的字段。 */
export const belongsEdges = (w: Workspace, id: string): Relation[] => w.relations.filter(r => r.from_id === id && r.type === 'belongs' && !r.deleted_at);
/** 归属从 target 出发能不能走回 o。能就是环。 */
function assertNoBelongsCycle(w: Workspace, o: KnowledgeObject, target: KnowledgeObject) {
    const seen = new Set<string>();
    const queue = [target.id];
    while (queue.length) {
        const id = queue.shift()!;
        if (seen.has(id))
            continue;
        if (id === o.id)
            throw new DomainError('归属不能形成循环');
        seen.add(id);
        for (const e of belongsEdges(w, id))
            queue.push(e.to_id);
    }
}
/** 新建一条归属边之前：目标类型、能不能有多个、会不会成环。 */
function assertBelongs(w: Workspace, o: KnowledgeObject, target: KnowledgeObject) {
    if (target.id === o.id)
        throw new DomainError('不能归属自己');
    const kind = o.kind ? w.kinds.find(k => k.id === o.kind) : null;
    const rule = belongsRule(kind);
    if (!rule.targets.length)
        throw new DomainError('这个类型不能有归属');
    if (!rule.targets.includes(target.kind ?? '')) {
        const names = rule.targets.map(id => w.kinds.find(k => k.id === id)?.label ?? id).join('、');
        throw new DomainError(`只能归属${names}`);
    }
    if (!rule.multiple && belongsEdges(w, o.id).some(e => e.to_id !== target.id))
        throw new DomainError('这条内容只能有一个归属');
    assertNoBelongsCycle(w, o, target);
}
/**
 * 每次改动对象后复查它已有的归属边。
 * 目标已经删掉的不在这里报错——删除对象时归属边会一起打墓碑，这里只保证「类型变了也不违反声明」。
 */
function validateBelongs(w: Workspace, o: KnowledgeObject, kind: Kind | null | undefined) {
    const edges = belongsEdges(w, o.id);
    if (!edges.length)
        return;
    const rule = belongsRule(kind);
    if (!rule.targets.length)
        throw new DomainError('这个类型不能有归属');
    if (!rule.multiple && edges.length > 1)
        throw new DomainError('这条内容只能有一个归属');
    for (const e of edges) {
        const target = w.objects.find(x => x.id === e.to_id && x.user_id === w.user.id);
        if (!target || target.deleted_at)
            continue;
        if (!rule.targets.includes(target.kind ?? ''))
            throw new DomainError('类型不允许此归属');
    }
}
export function getObject(w: Workspace, id: string): KnowledgeObject { const o = w.objects.find(o => o.id === id && o.user_id === w.user.id); if (!o)
    throw new DomainError('对象不存在', 404); return o; }
function clockKey(...parts: string[]) { return JSON.stringify(parts); }
function stamp(w: Workspace, key: string, clock: Clock) { w.clocks[key] = clock; }
function conflict(w: Workspace, o: KnowledgeObject, c: Change, device: string, value: any, resolution: 'lost' | 'block_merge' = 'lost') {
    w.conflicts.push({ id: uid(), user_id: w.user.id, object_id: o.id, field: c.field, base_rev: c.base_rev, server_rev: o.rev, resolution, device_id: device, created_at: Date.now(), losing_value: value });
}
function validateObject(w: Workspace, o: KnowledgeObject, previous?: KnowledgeObject) {
    if (typeof o.title !== 'string' || typeof o.body !== 'string' || !o.extra || typeof o.extra !== 'object' || Array.isArray(o.extra))
        throw new DomainError('主体、附文或扩展属性格式无效');
    if (!Array.isArray(o.applies_to) || o.applies_to.some(x => typeof x !== 'string') || typeof o.ephemeral !== 'boolean' || !Array.isArray(o.tags_cached) || o.tags_cached.some(x => typeof x !== 'string'))
        throw new DomainError('对象数组或布尔属性无效');
    for (const key of ['kind', 'series', 'status', 'sort_key', 'supersedes_id', 'asset_id', 'source_id', 'source_ref', 'source_version'] as const)
        if (o[key] !== null && typeof o[key] !== 'string')
            throw new DomainError(`${key}需要文本或null`);
    for (const key of ['captured_at', 'due_at', 'confirmed_at', 'valid_until'] as const)
        if (o[key] !== null && (!Number.isSafeInteger(o[key]) || Number(o[key]) < 0))
            throw new DomainError(`${key}时间格式无效`);
    if (!o.body_blocks || !Array.isArray(o.body_blocks.blocks) || o.body_blocks.blocks.length > 10000)
        throw new DomainError('段落数组无效');
    const ids = new Set<string>();
    for (const b of o.body_blocks.blocks) {
        if (!b || typeof b.id !== 'string' || !b.id || b.id.length > 200 || ids.has(b.id) || typeof b.text !== 'string' || typeof b.key !== 'string' || !(/^[A-Za-z0-9]+$/.test(b.key)) || b.key.endsWith('0'))
            throw new DomainError('段落id和排序索引无效');
        ids.add(b.id);
        if (b.deleted_at != null && !Number.isSafeInteger(b.deleted_at))
            throw new DomainError('段落墓碑时间无效');
    }
    if (o.asset_id && !w.assets.some(a => a.id === o.asset_id && a.user_id === w.user.id && a.committed))
        throw new DomainError('媒体未提交或不属于当前用户');
    if (o.source_id && !w.sources.some(src => src.id === o.source_id && src.user_id === w.user.id))
        throw new DomainError('来源未注册或不属于当前用户');
    const kind = o.kind ? w.kinds.find(k => k.id === o.kind) : null;
    if (o.kind && !kind)
        throw new DomainError('未定义的类型');
    if (!['text', 'image', 'audio', 'video', 'link', 'canvas'].includes(o.form))
        throw new DomainError('不支持的形态');
    if (o.title.length > 100000 || o.body.length > 2000000)
        throw new DomainError('内容过长');
    if (previous && o.form !== previous.form)
        throw new DomainError('形态由捕获决定，不能更改');
    if (o.kind === 'canvas' && o.form !== 'canvas')
        throw new DomainError('画布必须使用画布形态');
    if (o.form === 'canvas' && o.kind !== 'canvas')
        throw new DomainError('画布不能改为其他类型');
    if (previous && (previous.kind === 'material' || previous.kind === 'ai_output' || previous.source_id) && o.kind === 'distill')
        throw new DomainError('外部内容不能直接变成沉淀，请用自己的话新写一条');
    if (previous && previous.kind === 'artifact' && (o.title !== previous.title || o.body !== previous.body || !eq(o.body_blocks, previous.body_blocks)))
        throw new DomainError('产物正文不可变，请新建一个对象');
    if (previous && previous.source_id && (o.title !== previous.title || o.body !== previous.body || !eq(o.body_blocks, previous.body_blocks)))
        throw new DomainError('外部正文是冻结快照，请在新对象里写自己的理解');
    if (o.kind === 'self' && !o.applies_to.length)
        throw new DomainError('自我认知需要填写适用范围');
    // 归属不在这里校验：它是 relations 里的一条边，随 applyRelation 走 assertBelongs。
    // 这里只复查「已经有的归属边在当前 kind 下还合不合法」。
    validateBelongs(w, o, kind);
    if (kind)
        for (const [name, p] of Object.entries(kind.properties)) {
            const v = (o as any)[name] ?? o.extra[name];
            if (v == null || v === '') {
                if (p.required)
                    throw new DomainError(`${p.label ?? name}不能为空`);
                continue;
            }
            if (p.type === 'label') {
                const values = Array.isArray(v) ? v : [v];
                if (values.some(x => !(p.options ?? []).includes(x)))
                    throw new DomainError(`${p.label ?? name}不是有效选项`);
            }
            if (p.type === 'number' && (!Number.isFinite(v) || typeof v !== 'number'))
                throw new DomainError(`${name}必须是数字`);
            if (p.type === 'checkbox' && typeof v !== 'boolean')
                throw new DomainError(`${name}必须是布尔值`);
            if (p.type === 'datetime' && !Number.isFinite(v))
                throw new DomainError(`${name}时间无效`);
            if (p.type === 'object') {
                const target = getObject(w, v);
                if (p.kinds?.length && !p.kinds.includes(target.kind ?? ''))
                    throw new DomainError(`${name}对象类型无效`);
            }
        }
}
export function assertNoCanvasCycle(w: Workspace, canvasId: string, objectId: string) {
    if (canvasId === objectId)
        throw new DomainError('画布不能包含自身');
    const o = getObject(w, objectId);
    if (o.form !== 'canvas')
        return;
    const queue = [objectId], seen = new Set<string>();
    while (queue.length) {
        const id = queue.shift()!;
        if (id === canvasId)
            throw new DomainError('画布嵌套会形成循环');
        if (seen.has(id))
            continue;
        seen.add(id);
        for (const p of w.placements.filter(p => p.canvas_id === id && !p.deleted_at)) {
            if (getObject(w, p.object_id).form === 'canvas')
                queue.push(p.object_id);
        }
    }
}
function syncMarkup(w: Workspace, o: KnowledgeObject) {
    if (o.source_id)
        return; // Frozen external syntax never produces structure.
    const fields = [{ field: 'title', block: '', text: o.title }, ...o.body_blocks.blocks.filter(b => !b.deleted_at).map(b => ({ field: 'body', block: b.id, text: b.text }))];
    if (!o.body_blocks.blocks.length && o.body)
        fields.push({ field: 'body', block: '', text: o.body });
    const now = Date.now();
    // 只清理「由正文标记推导出来的引用边」。归属边和画布连线是手工建立的，正文变了也不该动。
    for (const r of w.relations.filter(r => r.from_id === o.id && r.type === 'cite' && r.source_field !== 'manual' && r.source_field !== 'canvas'))
        r.deleted_at = now;
    for (const f of fields) {
        const m = explicitMarkup(f.text);
        for (const title of m.links) {
            const matches = w.objects.filter(x => live(x) && x.title === title && !['canvas', 'group'].includes(x.kind ?? ''));
            if (matches.length !== 1)
                continue;
            const t = matches[0];
            if (t.id === o.id)
                continue;
            const found = w.relations.find(r => r.from_id === o.id && r.to_id === t.id && r.source_field === f.field && r.source_block_id === f.block);
            if (found)
                found.deleted_at = null;
            else
                w.relations.push({ from_id: o.id, to_id: t.id, user_id: w.user.id, type: 'cite', source_field: f.field, source_block_id: f.block, created_at: now, deleted_at: null });
        }
        for (const tag of m.tags) {
            const existing = w.tags.find(t => t.object_id === o.id && t.tag === tag);
            if (!existing)
                w.tags.push({ object_id: o.id, tag, user_id: w.user.id, deleted_at: null });
        }
    }
    o.tags_cached = w.tags.filter(t => t.object_id === o.id && !t.deleted_at).map(t => t.tag);
}
function applyBlocks(w: Workspace, o: KnowledgeObject, c: Change, device: string) {
    const input = c.value?.blocks;
    if (!Array.isArray(input) || input.length > 10000)
        throw new DomainError('段落数据无效');
    const incoming: Clock = { ts: c.client_ts, device };
    for (const raw of input) {
        if (!raw || typeof raw.id !== 'string' || typeof raw.text !== 'string' || typeof raw.key !== 'string' || !(/^[0-9A-Za-z]+$/.test(raw.key)) || raw.key.endsWith('0'))
            throw new DomainError('段落必须包含稳定 id 和分数索引');
        const b: Block = { id: raw.id, key: raw.key, text: raw.text, deleted_at: raw.deleted_at ?? null };
        const current = o.body_blocks.blocks.find(x => x.id === b.id);
        const key = clockKey(o.id, 'block', b.id);
        if (!current) {
            o.body_blocks.blocks.push(b);
            stamp(w, key, incoming);
            continue;
        }
        if (eq(current, b))
            continue;
        if (current.deleted_at && !b.deleted_at) {
            conflict(w, o, c, device, b);
            continue;
        }
        const base = w.versions.find(v => v.object_id === o.id && v.rev === c.base_rev)?.snapshot.body_blocks.blocks.find(x => x.id === b.id);
        // Causally observed edits win even if this device's clock is behind. LWW is only for actual concurrency.
        const observed = c.base_rev === o.rev || !!base && eq(base, current);
        if (b.deleted_at || observed || comparable(incoming, w.clocks[key])) {
            if (!observed && !b.deleted_at)
                conflict(w, o, c, w.clocks[key]?.device ?? device, current);
            Object.assign(current, b);
            stamp(w, key, incoming);
        }
        else
            conflict(w, o, c, device, b);
    }
    o.body = bodyText(o.body_blocks.blocks);
}
function applyPlacement(w: Workspace, o: KnowledgeObject, c: Change, device: string) {
    if (o.form !== 'canvas')
        throw new DomainError('只能在画布上摆放');
    const v = c.value;
    const target = getObject(w, v.object_id);
    if (target.deleted_at)
        throw new DomainError('对象已删除');
    assertNoCanvasCycle(w, o.id, target.id);
    if (v.group_id) {
        const g = w.placements.find(p => p.canvas_id === o.id && p.object_id === v.group_id && !p.deleted_at);
        if (!g || getObject(w, g.object_id).kind !== 'group')
            throw new DomainError('分组必须位于同一张画布');
        if (v.group_id === v.object_id)
            throw new DomainError('分组不能包含自己');
    }
    const key = clockKey(o.id, 'placement', v.object_id);
    const current = w.placements.find(p => p.canvas_id === o.id && p.object_id === v.object_id);
    if (current?.deleted_at && !v.deleted_at) {
        conflict(w, o, c, device, v);
        return;
    }
    if (current && c.base_rev !== o.rev && !comparable({ ts: c.client_ts, device }, w.clocks[key]) && !v.deleted_at) {
        conflict(w, o, c, device, v);
        return;
    }
    const p: Placement = { canvas_id: o.id, object_id: v.object_id, user_id: w.user.id, x: Number(v.x ?? current?.x ?? 0), y: Number(v.y ?? current?.y ?? 0), w: Number(v.w ?? current?.w ?? 260), h: Number(v.h ?? current?.h ?? 160), z: Number(v.z ?? current?.z ?? 0), display: v.display ?? current?.display ?? null, group_id: v.group_id === undefined ? current?.group_id ?? null : v.group_id, deleted_at: v.deleted_at ?? null };
    if (![p.x, p.y, p.w, p.h, p.z].every(Number.isFinite) || !Number.isInteger(p.z) || p.w < 80 || p.h < 40 || ![null, 'title_only', 'collapse_body', 'full'].includes(p.display))
        throw new DomainError('布局坐标无效');
    if (current)
        Object.assign(current, p);
    else
        w.placements.push(p);
    stamp(w, key, { ts: c.client_ts, device });
    if (p.deleted_at)
        for (const child of w.placements.filter(x => x.canvas_id === o.id && x.group_id === p.object_id))
            child.group_id = null;
}
function applyRelation(w: Workspace, o: KnowledgeObject, c: Change, device: string) {
    const v = c.value;
    const target = getObject(w, v.to_id);
    if (target.deleted_at)
        throw new DomainError('引用对象已删除');
    const type: RelationType = v.type === 'belongs' ? 'belongs' : 'cite';
    // 删边不用重新校验：它只会让约束更松。
    if (type === 'belongs') {
        if (!v.deleted_at)
            assertBelongs(w, o, target);
    }
    else if (['canvas', 'group'].includes(o.kind ?? '') || ['canvas', 'group'].includes(target.kind ?? ''))
        throw new DomainError('画布和分组使用摆放关系，不进入局部图');
    // 归属边永远是手工建立的。source_field 说的是「边从哪来」，归属不可能来自正文标记。
    const field = type === 'belongs' || v.source_field !== 'canvas' ? 'manual' : 'canvas';
    const key = clockKey(o.id, 'relation', type, target.id, field);
    const current = w.relations.find(r => r.from_id === o.id && r.to_id === target.id && r.type === type && r.source_field === field && r.source_block_id === '');
    if (current?.deleted_at && !v.deleted_at)
        return;
    if (current && c.base_rev !== o.rev && !v.deleted_at && !comparable({ ts: c.client_ts, device }, w.clocks[key]))
        return;
    const r: Relation = { from_id: o.id, to_id: target.id, user_id: w.user.id, type, source_field: field, source_block_id: '', created_at: current?.created_at ?? Date.now(), deleted_at: v.deleted_at ?? null };
    if (current)
        Object.assign(current, r);
    else
        w.relations.push(r);
    stamp(w, key, { ts: c.client_ts, device });
}
export function applyChange(w: Workspace, c: Change, device: string, actor: 'user' | 'ai' = 'user'): {
    acknowledged: string;
    ignored?: boolean;
} {
    if (!c || typeof c.mutation_id !== 'string' || !c.mutation_id || c.mutation_id.length > 220 || typeof c.object_id !== 'string' || !c.object_id || c.object_id.length > 200 || typeof c.field !== 'string' || !Number.isSafeInteger(c.client_ts) || !Number.isInteger(c.base_rev) || c.base_rev < 0)
        throw new DomainError('变更格式无效');
    if (w.mutations.includes(c.mutation_id))
        return { acknowledged: c.mutation_id };
    if (c.client_ts > Date.now() + 86400000)
        throw new DomainError('设备时钟偏差超过一天，请校正后重试');
    const exists = w.objects.find(o => o.id === c.object_id);
    let o: KnowledgeObject;
    if (actor === 'ai' && (exists || c.field !== 'create' || c.value?.kind !== 'ai_output'))
        throw new DomainError('AI只能新增AI生成对象', 403);
    if (!exists) {
        if (c.field !== 'create')
            throw new DomainError('先创建对象再提交属性', 409);
        const input = c.value ?? {};
        const allowed = Object.keys(makeObject('', w.user.id));
        const v = Object.fromEntries(Object.entries(input).filter(([key]) => allowed.includes(key)));
        o = makeObject(typeof v.title === 'string' ? v.title : '', w.user.id, { ...v, id: c.object_id, user_id: w.user.id, rev: 0, created_at: Date.now(), updated_at: Date.now(), deleted_at: null });
        if (!Number.isSafeInteger(o.captured_at))
            throw new DomainError('捕获时间无效');
        if (o.supersedes_id) {
            const old = getObject(w, o.supersedes_id);
            if (old.kind !== 'self' || o.kind !== 'self')
                throw new DomainError('只有自我认知通过推翻建立替代关系');
        }
        validateObject(w, o);
        if (o.body_blocks.blocks.length)
            o.body = bodyText(o.body_blocks.blocks);
        w.objects.push(o);
        for (const f of scalar)
            stamp(w, clockKey(o.id, f), { ts: c.client_ts, device });
        for (const b of o.body_blocks.blocks)
            stamp(w, clockKey(o.id, 'block', b.id), { ts: c.client_ts, device });
    }
    else {
        o = exists;
        if (c.field === 'create') {
            w.mutations.push(c.mutation_id);
            return { acknowledged: c.mutation_id, ignored: true };
        }
        if (o.deleted_at) {
            w.mutations.push(c.mutation_id);
            return { acknowledged: c.mutation_id, ignored: true };
        }
        if (!scalar.has(c.field) && !['body_blocks', 'tag', 'relation', 'placement', 'deleted_at'].includes(c.field)) {
            w.mutations.push(c.mutation_id);
            return { acknowledged: c.mutation_id, ignored: true };
        }
        const before = structuredClone(o);
        w.versions.push({ object_id: o.id, rev: o.rev, snapshot: before, created_at: Date.now(), user_id: w.user.id });
        if (c.field === 'body_blocks')
            applyBlocks(w, o, c, device);
        else if (c.field === 'placement')
            applyPlacement(w, o, c, device);
        else if (c.field === 'relation')
            applyRelation(w, o, c, device);
        else if (c.field === 'tag') {
            const { tag, deleted_at = null } = c.value;
            if (typeof tag !== 'string' || !tag.trim() || tag.length > 80)
                throw new DomainError('标签无效');
            const t = w.tags.find(x => x.object_id === o.id && x.tag === tag);
            if (!t)
                w.tags.push({ object_id: o.id, tag, user_id: w.user.id, deleted_at });
            else if (deleted_at)
                t.deleted_at = deleted_at; // Tombstone wins.
        }
        else if (c.field === 'deleted_at') {
            o.deleted_at = Date.now();
            for (const p of w.placements.filter(p => p.canvas_id === o.id || p.object_id === o.id))
                p.deleted_at = o.deleted_at;
            for (const r of w.relations.filter(r => r.from_id === o.id || r.to_id === o.id))
                r.deleted_at = o.deleted_at;
        }
        else {
            const key = clockKey(o.id, c.field), incoming = { ts: c.client_ts, device };
            const current = (o as any)[c.field];
            const base = w.versions.find(v => v.object_id === o.id && v.rev === c.base_rev)?.snapshot;
            if (c.base_rev === o.rev || (base && eq((base as any)[c.field], current)) || comparable(incoming, w.clocks[key])) {
                const concurrentlyChanged = c.base_rev !== o.rev && (!base || !eq((base as any)[c.field], current));
                if (concurrentlyChanged && !eq(current, c.value))
                    conflict(w, o, c, w.clocks[key]?.device ?? device, current);
                (o as any)[c.field] = c.value;
                stamp(w, key, incoming);
                if (c.field === 'body') {
                    // Legacy scalar body cannot silently discard structured paragraphs.
                    if (before.body_blocks.blocks.length)
                        throw new DomainError('已有段落 id，请使用 body_blocks 更新', 409);
                }
            }
            else if (!eq(current, c.value))
                conflict(w, o, c, device, c.value);
        }
        validateObject(w, o, before);
    }
    o.rev++;
    o.updated_at = Date.now();
    syncMarkup(w, o);
    if (o.supersedes_id && c.field === 'create') {
        const old = getObject(w, o.supersedes_id);
        applyChange(w, { mutation_id: c.mutation_id + ':supersede', object_id: old.id, field: 'valid_until', value: Date.now(), base_rev: old.rev, client_ts: c.client_ts }, device);
    }
    w.nextSeq++;
    w.changes.push({ ...c, seq: w.nextSeq, user_id: w.user.id, device_id: device, created_at: Date.now() });
    w.mutations.push(c.mutation_id);
    return { acknowledged: c.mutation_id };
}
/** Atomic batch: failures must roll back the *whole* batch, including versions/clocks. */
export function pushBatch(workspace: Workspace, changes: Change[], device: string, actor: 'user' | 'ai' = 'user'): {
    workspace: Workspace;
    acknowledged: string[];
} {
    if (typeof device !== 'string' || !device || device.length > 200 || device === '__proto__' || !Array.isArray(changes) || changes.length > 500)
        throw new DomainError('同步批次无效');
    const copy = structuredClone(workspace);
    const acknowledged = changes.map(c => applyChange(copy, c, device, actor).acknowledged);
    copy.devices[device] = { last_seq: workspace.devices[device]?.last_seq ?? 0, last_seen: Date.now() };
    return { workspace: copy, acknowledged };
}
