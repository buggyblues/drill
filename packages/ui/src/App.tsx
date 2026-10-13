import React from 'react';
import { RecapProvider, TooltipProvider, Button, IconButton, Sidebar, PageHeader, ViewToolbar, SegmentedControl, Select, Badge, Surface, EmptyState, Dialog, Sheet, Kbd, SettingsSection, SettingsRow, Skeleton, Tag } from '@recap/ui';
import { Icon } from './Icon.tsx';
import { Canvas } from './Canvas.tsx';
import { GhostSelect, InputDialog, type DialogSpec } from './Controls.tsx';
import { ParagraphEditor } from './ParagraphEditor.tsx';
import { request, loadSnapshot, commit, isDesktop, uploadFile } from './api.ts';
import { makeObject, captureText, uid, inWindow, keyBetween, sortedBlocks, inferForm } from '../../core/src/helpers.ts';
import type { PublicSnapshot, KnowledgeObject, Kind, Property, Change, Placement, Block, Relation } from '../../core/src/types.ts';
const statusLabel: Record<string, string> = { todo: '待做', doing: '在做', blocked: '阻塞', done: '完成' };
const labels: Record<string, string> = { kind: '类型', belongs: '归属', tags: '标签', status: '状态', applies_to: '适用范围', series: '系列', due_at: '截止时间' };
const pageTitles: Record<string, string> = { recent: '最近新增', domains: '领域', projects: '项目', actions: '行动', memory: '个人记忆', insight: '洞察', map: '认知地图', walk: '随机漫步', timeline: '时间轴', canvases: '所有画布', settings: '偏好与连接' };
function dateLabel(t: number, full = false) { return new Intl.DateTimeFormat('zh-CN', full ? { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' } : { month: '2-digit', day: '2-digit' }).format(t); }
function download(name: string, data: any) { const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
function readPreference(key: string, fallback: string) { try { return localStorage.getItem('drill:ui:' + key) ?? fallback; } catch { return fallback; } }
export class App extends React.Component<any, any> {
    state: any = { theme: readPreference('theme', 'light'), density: readPreference('density', 'comfortable'), recentIds: [], mobileNav: false, captureBusy: false, searchActive: 0, snapshot: null, loading: true, view: 'recent', scope: null, window: 'today', custom: { from: '', to: '' }, selected: null, right: true, left: true, tab: 'read', mode: 'list', capture: false, captureText: '', search: false, query: '', searchResults: [], searchMode: 'lexical', searchBusy: false, kindFilter: '', toast: '', modal: null, related: { items: [], mode: 'lexical' }, insight: null, reading: false, insightScope: 'week', graphDepth: 1, versions: [], editing: false, draftTitle: '', draftBlocks: [], drafts: {}, connectors: false, login: false, password: '', breadcrumbs: [], mapData: null, walkPath: [], walkObject: null, walkJump: false, recording: false, sourceForm: { connector: 'obsidian', path: '', name: '' }, syncState: null, scrollTop: 0, expandedDomains: [], dialog: null, tagInput: null, proposalEdit: null };
    preference = (key: 'theme' | 'density', value: string) => { this.setState({ [key]: value }); try { localStorage.setItem('drill:ui:' + key, value); } catch { this.toast('外观设置仅在本次会话生效'); } };
    captureInput: HTMLTextAreaElement | null = null;
    searchInput: HTMLInputElement | null = null;
    timer: any;
    toastTimer: any;
    poll: any;
    recorder: MediaRecorder | null = null;
    chunks: Blob[] = [];
    undoStack: any[] = [];
    relatedRequest = 0;
    searchRequest = 0;
    rootRef: HTMLDivElement | null = null;
    bodyDrafts: Record<string, Block[]> = {};
    componentDidMount() { window.addEventListener('drill:capture', this.openCapture); window.addEventListener('keydown', this.keys); window.addEventListener('online', this.network); window.addEventListener('offline', this.network); void this.init(); this.poll = setInterval(() => { if (isDesktop())
        void this.refresh(false); }, 10000); }
    componentWillUnmount() { window.removeEventListener('drill:capture', this.openCapture); window.removeEventListener('keydown', this.keys); window.removeEventListener('online', this.network); window.removeEventListener('offline', this.network); clearInterval(this.poll); clearTimeout(this.timer); clearTimeout(this.toastTimer); this.recorder?.stop(); }
    init = async () => { try {
        if (!isDesktop()) {
            const health = await request('/health');
            this.setState({ authMode: health.auth });
            if (health.mode === 'demo')
                await request('/auth/demo', 'POST');
        }
        await this.refresh();
        if (location.hash === '#capture')
            this.openCapture();
    }
    catch (e: any) {
        if (e.status === 401)
            this.setState({ login: true, loading: false });
        else
            this.fail(e);
    } };
    refresh = async (select = true) => { try {
        const snapshot = await loadSnapshot();
        const selected = this.state.selected ?? (select ? (snapshot.objects.find(o => o.id === 'note-clarity')?.id ?? snapshot.objects.filter(o => !o.deleted_at && !o.ephemeral && !['domain', 'project', 'group', 'canvas'].includes(o.kind ?? '')).sort((a, b) => b.captured_at - a.captured_at)[0]?.id) : null);
        this.setState({ snapshot, loading: false, login: false, selected });
        if (selected && select)
            void this.loadRelated(selected);
        if (isDesktop()) {
            const syncState = await (window as any).drill.status();
            this.setState({ syncState });
        }
    }
    catch (e) {
        this.setState({ loading: false });
        throw e;
    } };
    network = () => { this.forceUpdate(); if (navigator.onLine)
        void this.refresh(false).catch(this.fail); };
    run = (fn: () => Promise<any>) => { void fn().catch(this.fail); };
    fail = (e: any) => { this.setState({ loading: false, reading: false, searchBusy: false }); this.toast(e?.message ?? String(e)); };
    toast = (message: string) => { clearTimeout(this.toastTimer); this.setState({ toast: message }); this.toastTimer = setTimeout(() => this.setState({ toast: '' }), 6000); };
    relCache: { snap: any; out: Map<string, Relation[]>; inc: Map<string, Relation[]> } | null = null;
    relationsIndex = (): { out: Map<string, Relation[]>; inc: Map<string, Relation[]> } => { const snap = this.state.snapshot; const empty = { out: new Map<string, Relation[]>(), inc: new Map<string, Relation[]>() }; if (!snap)
        return empty; const cached = this.relCache; if (cached && cached.snap === snap)
        return cached; const out = new Map<string, Relation[]>(), inc = new Map<string, Relation[]>(); const push = (m: Map<string, Relation[]>, k: string, v: Relation) => { const list = m.get(k); if (list)
        list.push(v);
    else
        m.set(k, [v]); }; for (const r of snap.relations) {
        if (r.deleted_at)
            continue;
        push(out, r.from_id, r);
        push(inc, r.to_id, r);
    } this.relCache = { snap, out, inc }; return { out, inc }; };
    /** 归属边从子指向父：「我归属谁」在出边里，「谁挂在我下面」在入边里。 */
    belongsParents = (id: string): string[] => (this.relationsIndex().out.get(id) ?? []).filter(r => r.type === 'belongs').map(r => r.to_id);
    belongsChildren = (id: string): string[] => (this.relationsIndex().inc.get(id) ?? []).filter(r => r.type === 'belongs').map(r => r.from_id);
    /** 容器范围是传递的：领域 → 项目 → 项目里的东西。 */
    belongsUnder = (scope: string): Set<string> => { const found = new Set<string>(), queue = [scope]; while (queue.length) {
        const id = queue.shift()!;
        if (found.has(id))
            continue;
        found.add(id);
        for (const child of this.belongsChildren(id))
            queue.push(child);
    } found.delete(scope); return found; };
    /** 这个 kind 允许归属哪些 kind。空数组 = 它不属于任何东西（领域就是这样）。 */
    belongsTargets = (o: KnowledgeObject): string[] => { const k = o.kind ? this.kind(o.kind) : null; return k ? k.relations?.belongs?.targets ?? ['domain', 'project'] : ['domain', 'project']; };
    childrenOf = (id: string, kind?: string): KnowledgeObject[] => this.belongsChildren(id).map(x => this.object(x)).filter((o): o is KnowledgeObject => !!o && !o.deleted_at && (!kind || o.kind === kind));
    /** 归属是边，不是字段：改归属 = 删掉旧边 + 建一条新边。 */
    setBelongs = async (o: KnowledgeObject, targetId: string | null) => { const current = this.belongsParents(o.id); if (targetId && current.length === 1 && current[0] === targetId)
        return; const changes: Change[] = current.map(id => this.changes(o, 'relation', { to_id: id, type: 'belongs', deleted_at: Date.now() })); if (targetId)
        changes.push(this.changes(o, 'relation', { to_id: targetId, type: 'belongs' })); if (changes.length) {
        await commit(changes);
        await this.refresh(false);
    } };
    /** 新建衍生对象（推翻、沉淀）时把归属一起带过去，因为归属不再是对象上的字段。 */
    inheritBelongs = async (fromId: string, toId: string) => { const parents = this.belongsParents(fromId), o = this.object(toId); if (!parents.length || !o)
        return; await commit(parents.map(p => this.changes(o, 'relation', { to_id: p, type: 'belongs' }))); await this.refresh(false); };
    objects = (): KnowledgeObject[] => this.state.snapshot?.objects ?? [];
    kinds = (): Kind[] => this.state.snapshot?.kinds ?? [];
    object = (id: string) => this.objects().find(o => o.id === id);
    selected = () => this.object(this.state.selected);
    kind = (id: string | null) => this.kinds().find(k => k.id === id);
    changes = (o: KnowledgeObject, field: string, value: any): Change => ({ mutation_id: uid(), object_id: o.id, field, value, base_rev: o.rev, client_ts: Date.now() });
    save = async (o: KnowledgeObject, field: string, value: any, remember = true) => { const prior = (o as any)[field]; await commit([this.changes(o, field, value)]); if (remember && prior !== undefined)
        this.undoStack.push({ id: o.id, field, value: structuredClone(prior) }); await this.refresh(false); };
    undo = async () => { const prev = this.undoStack.pop(); if (!prev) {
        this.toast('没有可撤销的修改');
        return;
    } const o = this.object(prev.id); if (o) {
        await this.save(o, prev.field, prev.value, false);
        this.toast('已撤销上一次修改');
    } };
    create = async (o: KnowledgeObject) => { await commit([this.changes(o, 'create', o)]); await this.refresh(false); return o.id; };
    openCapture = () => { this.setState({ capture: true }, () => setTimeout(() => this.captureInput?.focus(), 30)); };
    capture = async () => { if (this.state.captureBusy) return; const text = this.state.captureText.trim(); if (!text)
        return; this.setState({ captureBusy: true }); try { const o = captureText(text, this.kinds(), this.state.snapshot.user.id); if (o.kind === 'self' && !o.applies_to.length) {
        this.toast('先捕获内容，再在提炼中填写适用范围');
        o.kind = null;
    } const options = this.kind(o.kind)?.properties.status?.options; if (options)
        o.status = options[0]; await this.create(o); this.setState({ captureText: '', selected: o.id, right: true }); void this.loadRelated(o.id); this.toast('已保存'); this.captureInput?.focus(); } finally { this.setState({ captureBusy: false }); } };
    importFile = async (file: File) => { const form = inferForm(file.type); if (!form) {
        this.toast('这一版接收图片、音频和视频；其他文档请先转成文字。');
        return;
    } if (file.size > 256 * 1024 * 1024) {
        this.toast('当前界面单文件上限256MB；大文件请使用桌面连接器。');
        return;
    } this.toast('正在保存媒体…'); const assetId = await uploadFile(file); await this.create(makeObject(file.name, this.state.snapshot.user.id, { form, asset_id: assetId })); this.toast('媒体已存下'); };
    recording = async () => { if (this.recorder && this.state.recording) {
        this.recorder.stop();
        this.setState({ recording: false });
        return;
    } if (!navigator.mediaDevices?.getUserMedia)
        throw new Error('录音需要HTTPS或本机地址，以及麦克风权限'); const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); this.chunks = []; const recorder = new MediaRecorder(stream); this.recorder = recorder; recorder.ondataavailable = e => { if (e.data.size)
        this.chunks.push(e.data); }; recorder.onstop = () => { stream.getTracks().forEach(t => t.stop()); const blob = new Blob(this.chunks, { type: recorder.mimeType }); this.run(() => this.importFile(new File([blob], `录音-${new Date().toISOString().slice(0, 16)}.webm`, { type: blob.type }))); }; recorder.start(); this.setState({ recording: true }); };
    navigate = (view: string, scope: string | null = null) => { this.setState({ view, scope, mobileNav: false, kindFilter: '', window: ['recent', 'timeline'].includes(view) ? 'today' : 'all', mode: 'list', insight: null, mapData: null, scrollTop: 0, breadcrumbs: view === 'canvas' && scope ? [scope] : [] }); };
    select = (id: string, tab = 'read') => { this.setState({ selected: id, recentIds: [id, ...this.state.recentIds.filter((x: string) => x !== id)].slice(0, 5), right: true, tab, tagInput: null, proposalEdit: null, insight: null }); void this.loadRelated(id); };
    showDialog = (dialog: DialogSpec) => this.setState({ dialog, modal: null });
    loadRelated = async (id: string) => { const n = ++this.relatedRequest; try {
        const data = await request('/related/' + encodeURIComponent(id));
        if (n === this.relatedRequest)
            this.setState({ related: data });
    }
    catch {
        if (n === this.relatedRequest)
            this.setState({ related: { items: [], mode: 'offline' } });
    } };
    filtered = () => { const s = this.state; const under = s.view === 'domain' && s.scope ? this.belongsUnder(s.scope) : null; return this.objects().filter(o => !o.deleted_at && !o.ephemeral).filter(o => { if (s.view === 'domains') return o.kind === 'domain'; if (s.view === 'projects') return o.kind === 'project'; if (s.view === 'actions')
        return o.kind === 'action'; if (s.view === 'memory')
        return o.kind === 'self'; if (s.view === 'canvases')
        return o.form === 'canvas'; if (s.view === 'domain')
        return !!under && under.has(o.id); if (s.view === 'recent')
        return !['domain', 'project', 'group'].includes(o.kind ?? ''); return true; }).filter(o => !s.kindFilter || o.kind === s.kindFilter).filter(o => ['recent', 'timeline'].includes(s.view) ? inWindow(o.captured_at, s.window, s.snapshot.user.timezone, Date.now(), s.custom) : true).sort((a, b) => b.captured_at - a.captured_at || b.created_at - a.created_at); };
    keys = (e: KeyboardEvent) => { const meta = e.metaKey || e.ctrlKey; const writing = (e.target as HTMLElement).closest('input,textarea,select,[contenteditable]'); if (meta && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        this.openSearch();
        return;
    } if (meta && e.shiftKey && e.code === 'Space') {
        e.preventDefault();
        this.openCapture();
        return;
    } if (meta && e.key.toLowerCase() === 'r' && this.state.capture) {
        e.preventDefault();
        this.run(this.recording);
        return;
    } if (e.key === 'Escape') {
        if (this.state.capture || this.state.search || this.state.modal || this.state.dialog || this.state.mobileNav) return;
        this.setState({ capture: false, search: false, modal: null, dialog: null });
        if (this.state.breadcrumbs.length > 1) {
            const p = [...this.state.breadcrumbs];
            p.pop();
            this.setState({ scope: p.at(-1), breadcrumbs: p });
        }
        return;
    } if (writing)
        return; if (this.state.view === 'canvas' && e.key === 'Enter' && !meta)
        return; if (meta && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        this.run(this.undo);
        return;
    } if (e.key === 'Enter' && this.state.selected) {
        e.preventDefault();
        const o = this.selected();
        if (meta && e.shiftKey && o?.form === 'canvas')
            this.enterCanvas(o.id);
        else if (meta)
            this.setState({ right: true });
        else
            this.setState({ modal: 'preview' });
        return;
    } if (['ArrowDown', 'ArrowUp'].includes(e.key) && ['recent', 'timeline', 'domain', 'memory', 'actions', 'canvases', 'domains', 'projects'].includes(this.state.view)) {
        e.preventDefault();
        const list = this.filtered();
        const index = list.findIndex(o => o.id === this.state.selected), next = list[Math.max(0, Math.min(list.length - 1, index + (e.key === 'ArrowDown' ? 1 : -1)))];
        if (next)
            this.select(next.id);
    } };
    openSearch = () => { this.setState({ search: true }, () => setTimeout(() => this.searchInput?.focus(), 30)); };
    search = async (query: string, mode = this.state.searchMode) => { clearTimeout(this.timer); this.setState({ query, searchMode: mode }); if (!query.trim()) {
        this.setState({ searchResults: [] });
        return;
    } if (query.startsWith('>'))
        return; const n = ++this.searchRequest; this.timer = setTimeout(() => this.run(async () => { this.setState({ searchBusy: true }); const data = await request('/search?q=' + encodeURIComponent(query) + '&mode=' + mode); if (n === this.searchRequest)
        this.setState({ searchResults: data.items, searchBusy: false }); }), 250); };
    enterCanvas = (id: string) => { this.setState({ view: 'canvas', scope: id, window: 'all', breadcrumbs: this.state.view === 'canvas' ? [...this.state.breadcrumbs, id] : [id], editing: false }); };
    placement = async (p: Placement) => { const canvas = this.object(p.canvas_id)!; await commit([this.changes(canvas, 'placement', p)]); await this.refresh(false); };
    connect = async (from: string, to: string) => { await this.save(this.object(from)!, 'relation', { to_id: to, source_field: 'canvas' }, false); };
    newCanvasObject = async (title: string, kind: string | null, placement: any, ephemeral = false) => { const o = makeObject(title, this.state.snapshot.user.id, { kind, ephemeral }); const canvas = this.object(this.state.scope)!; await commit([this.changes(o, 'create', o), this.changes(canvas, 'placement', { object_id: o.id, ...placement })]); await this.refresh(false); return o.id; };
    newCanvas = async () => this.showDialog({ title: '画布名称', onSubmit: async title => { const o = makeObject(title, this.state.snapshot.user.id, { form: 'canvas', kind: 'canvas' }); await this.create(o); this.enterCanvas(o.id); } });
    applyKind = async (o: KnowledgeObject, kind: string | null, scope?: string) => {
        const changes: Change[] = [];
        if (scope) changes.push(this.changes(o, 'applies_to', [scope]));
        changes.push(this.changes(o, 'kind', kind));
        const options = this.kind(kind)?.properties.status?.options;
        if (options && !o.status) changes.push(this.changes(o, 'status', options[0]));
        await commit(changes); await this.refresh(false);
    };
    setKind = async (o: KnowledgeObject, kind: string | null) => {
        if (kind === 'action') { this.showDialog({ title: '设为行动', description: '这是一条具体、可以直接开始的下一步吗？', confirm: true, submit: '设为行动', onSubmit: () => this.applyKind(o, kind) }); return; }
        if (kind === 'self' && !o.applies_to.length) { this.showDialog({ title: '适用范围', options: (this.kind('self')?.properties.applies_to.options ?? []).map(value => ({ value, label: value })), onSubmit: value => this.applyKind(o, kind, value) }); return; }
        await this.applyKind(o, kind);
    };
    askAI = async (objectId?: string) => { this.setState({ reading: true, insight: null }); const scope = objectId ? { object_id: objectId } : this.state.insightScope === 'week' ? { since: Date.now() - 7 * 86400000 } : this.state.insightScope.startsWith('canvas:') ? { canvas_id: this.state.insightScope.slice(7) } : { belongs: this.state.insightScope }; const insight = await request('/insight', 'POST', { scope }); this.setState({ insight, reading: false }); await this.refresh(false); };
    distill = async () => { const o = this.selected(); if (!o)
        return; this.setState({ reading: true }); await request('/ai/distill', 'POST', { object_id: o.id }); this.setState({ reading: false }); await this.refresh(false); this.toast('已生成建议'); };
    versions = async () => { const data = await request('/versions/' + this.state.selected); this.setState({ versions: data.versions, modal: 'versions' }); };
    recognize = async (first: string, second?: string) => {
        if (!second || second === first) { this.setState({ modal: 'recognize', recognizeFirst: first }); return; }
        this.showDialog({ title: '你认出了什么？', onSubmit: async text => { await request('/recognize', 'POST', { object_ids: [first, second], text }); await this.refresh(false); this.toast('已保存关联'); } });
    };
    renderMarkup = (text: string, external = false): React.ReactNode => { if (external)
        return text; const parts = text.split(/(\[\[[^\]]+\]\])/g); return parts.map((part, i) => { if (!part.startsWith('[['))
        return <span key={i}>{part}</span>; const target = part.slice(2, -2).split('|')[0], matches = this.objects().filter(o => o.title === target && !o.deleted_at); return <button key={i} className={`wiki-link ${matches.length !== 1 ? 'unresolved' : ''}`} onClick={() => this.run(async () => { if (matches.length === 1)
        this.select(matches[0].id);
    else if (matches.length > 1) {
        this.openSearch();
        await this.search(target);
    }
    else {
        const o = makeObject(target, this.state.snapshot.user.id);
        await this.create(o);
        const from = this.selected();
        if (from)
            await this.save(from, 'relation', { to_id: o.id }, false);
        this.select(o.id);
    } })}>{target}</button>; }); };
    renderSidebar(full = false) {
        const s = this.state, snap: PublicSnapshot = s.snapshot;
        const sections = [
            { label: '工作空间', items: [
                { id: 'recent', label: '最近新增', icon: <Icon name="recent"/> },
                { id: 'actions', label: '行动', icon: <Icon name="action"/>, count: this.objects().filter(o => !o.deleted_at && o.kind === 'action' && o.status !== 'done').length },
                { id: 'domains', label: '领域', icon: <Icon name="folder"/> },
                { id: 'projects', label: '项目', icon: <Icon name="board"/> },
                { id: 'canvases', label: '画布', icon: <Icon name="canvas"/> },
            ]},
            { label: '回顾与发现', items: [
                { id: 'memory', label: '个人记忆', icon: <Icon name="memory"/> },
                { id: 'insight', label: '洞察', icon: <Icon name="spark"/> },
                { id: 'timeline', label: '时间轴', icon: <Icon name="clock"/> },
                { id: 'map', label: '认知地图', icon: <Icon name="map"/> },
                { id: 'walk', label: '随机漫步', icon: <Icon name="walk"/> },
            ]},
            { label: '最近打开', items: s.recentIds.map((id: string) => this.object(id)).filter((o: KnowledgeObject | undefined) => o && !o.deleted_at).map((o: KnowledgeObject) => ({ id: 'object:' + o.id, label: o.title, icon: <Icon name="file"/> })) },
        ];
        const route = (id: string) => { if (id.startsWith('object:')) { this.select(id.slice(7)); this.setState({ mobileNav: false }); } else this.navigate(id); };
        const status = !navigator.onLine ? '离线' : isDesktop() ? s.syncState?.pending ? `${s.syncState.pending} 条待同步` : s.syncState?.error ? '同步待恢复' : '本地已保存' : snap.capabilities.demo ? '本机示例' : '在线';
        if (!s.left && !full) return <aside className="sidebar collapsed"><IconButton icon="panel" label="展开导航" onClick={() => this.setState({ left: true })}/>{sections[0].items.map(item => <button key={item.id} title={item.label} aria-label={item.label} aria-current={s.view === item.id ? 'page' : undefined} className="nav-item" onClick={() => route(item.id)}>{item.icon}</button>)}<IconButton icon="settings" label="设置" onClick={() => this.navigate('settings')}/></aside>;
        return <aside className="sidebar recap-sidebar"><Sidebar title="Drill" subtitle="记录 · 连接 · 回顾" activeId={s.view} sections={sections} onNavigate={route} onSearch={this.openSearch} onCreate={this.openCapture}
            footer={<><Button variant="ghost" leading={<Icon name="settings"/>} onClick={() => this.navigate('settings')}>偏好与连接</Button><div className="workspace-status"><Badge dot tone={navigator.onLine && !s.syncState?.error ? 'neutral' : 'warning'}>{status}</Badge><IconButton icon="panel" label="折叠导航" size="sm" onClick={() => this.setState({ left: false })}/></div></>}/></aside>;
    }
    renderTop() {
        const s = this.state, hasTime = ['recent', 'timeline', 'canvas'].includes(s.view);
        const description: Record<string, string> = { recent: '留住此刻的想法，让它们慢慢连成线索。', actions: '从想法走向下一步。', domains: '持续关心的主题与生活领域。', projects: '围绕目标，连接行动与知识。', memory: '回看自己的判断、变化与成长。', canvases: '用空间组织对象，发现新的联系。', timeline: '沿着时间，回看留下的线索。', insight: '从已有记录中，找到值得继续思考的问题。', map: '看见知识之间的分布与联系。', walk: '沿着关联，重新遇见旧想法。' };
        const isCollection = !['canvas', 'settings', 'insight', 'map', 'walk'].includes(s.view);
        const title = s.scope ? this.object(s.scope)?.title ?? '对象' : pageTitles[s.view] ?? 'Drill';
        return <><div className="workspace-topbar"><div><IconButton className="mobile-nav-trigger" icon="panel" label="打开导航" onClick={() => this.setState({ mobileNav: true })}/><span>我的空间</span><Icon name="chevron" size={12}/><span>{title}</span></div><div><IconButton icon="search" label="全局搜索" onClick={this.openSearch}/><IconButton icon={s.theme === 'dark' ? 'sun' : 'moon'} label={s.theme === 'dark' ? '切换浅色主题' : '切换深色主题'} onClick={() => this.preference('theme', s.theme === 'dark' ? 'light' : 'dark')}/>{!s.right && <IconButton icon="panel" label="展开上下文栏" onClick={() => this.setState({ right: true })}/>}</div></div>
            {s.view !== 'settings' && <PageHeader title={title} description={s.scope ? this.object(s.scope)?.body?.slice(0, 100) : description[s.view]} eyebrow={s.view === 'recent' ? new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' }).format(Date.now()) : undefined}
                actions={<Button variant="primary" leading={<Icon name="plus" size={16}/>} onClick={s.view === 'canvases' ? () => this.run(this.newCanvas) : ['domains', 'projects'].includes(s.view) ? () => this.showDialog({ title: s.view === 'domains' ? '新建领域' : '新建项目', onSubmit: async title => { const o = makeObject(title, s.snapshot.user.id, { kind: s.view === 'domains' ? 'domain' : 'project' }); await this.create(o); this.select(o.id); } }) : this.openCapture}>{s.view === 'canvases' ? '新建画布' : s.view === 'domains' ? '新建领域' : s.view === 'projects' ? '新建项目' : '快速创建'}</Button>}/>}
            {(hasTime || isCollection) && <ViewToolbar count={isCollection ? this.filtered().length : undefined}>
                {hasTime && <SegmentedControl label="时间范围" value={s.window} onValueChange={window => this.setState({ window, scrollTop: 0 })} options={[{ value: 'today', label: '今天' }, { value: 'week', label: '本周' }, { value: 'month', label: '本月' }, { value: 'all', label: '全部' }, { value: 'custom', label: '自定义' }]}/>}
                {isCollection && <><div className="toolbar-spacer"/><Select hideLabel label="筛选对象类型" value={s.kindFilter} onValueChange={kindFilter => this.setState({ kindFilter, scrollTop: 0 })} options={[{ value: '', label: '全部类型' }, ...this.kinds().map(k => ({ value: k.id, label: k.label }))]}/><SegmentedControl label="显示方式" value={s.mode} onValueChange={mode => this.setState({ mode, scrollTop: 0 })} options={[{ value: 'list', label: '列表', icon: <Icon name="list" size={14}/> }, { value: 'grid', label: '卡片', icon: <Icon name="canvas" size={14}/> }, ...(s.view === 'actions' ? [{ value: 'board', label: '看板', icon: <Icon name="board" size={14}/> }] : [])]}/></>}
            </ViewToolbar>}</>;
    }
    renderList() {
        const list = this.filtered(), s = this.state;
        const board = s.view === 'actions' && s.mode === 'board';
        const kind = this.kind('action'), column = kind?.properties.status;
        if (board && column?.type === 'label')
            return <div className="board">{(column.options ?? []).map(value => <section key={value} className="board-column" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); const o = this.object(e.dataTransfer.getData('drill/object')); if (o)
                this.run(() => this.save(o, 'status', value)); }}><h3>{statusLabel[value] ?? value}<small>{list.filter(o => (o.status ?? column.options?.[0]) === value).length}</small></h3>{list.filter(o => (o.status ?? column.options?.[0]) === value).map(o => <button key={o.id} draggable onDragStart={e => e.dataTransfer.setData('drill/object', o.id)} className={'board-card ' + (s.selected === o.id ? 'selected' : '')} onClick={() => this.select(o.id)}><span className="kind-dot" style={{ background: this.kind(o.kind)?.color }}/><strong>{o.title}</strong>{this.belongsParents(o.id)[0] && <small>{this.object(this.belongsParents(o.id)[0])?.title}</small>}</button>)}</section>)}</div>;
        if (!list.length)
            return <EmptyState icon="note" title="这里还没有内容" description="试试其他时间范围，或记录一个新想法。" action={<Button onClick={this.openCapture}>快速创建</Button>}/>;
        if (s.view === 'canvases')
            return <div className="canvas-grid">{list.map(o => <button key={o.id} className="canvas-tile" onClick={() => this.enterCanvas(o.id)}>{this.renderCanvasThumbnail(o)}<h3>{o.title}</h3><p>{o.body || ''}</p></button>)}</div>;
        if (s.mode === 'grid') return <div className="drill-object-grid">{list.map(o => <Surface key={o.id} className="drill-object-card" data-selected={s.selected === o.id || undefined} draggable onDragStart={e => e.dataTransfer.setData('drill/object', o.id)}>
            <div className="card-type"><span className="kind-dot" style={{ background: this.kind(o.kind)?.color ?? 'var(--ash)' }}/>{this.kind(o.kind)?.label ?? '未分类'}{o.status && <Badge>{statusLabel[o.status] ?? o.status}</Badge>}</div>
            <button className="card-open" onClick={() => this.select(o.id)} onDoubleClick={() => this.setState({ modal: 'preview' })}>{o.title || '无题'}</button><p className="card-excerpt">{o.body?.slice(0, 140) || '打开对象，继续补充内容。'}</p>
            <div className="card-tags">{o.tags_cached.slice(0, 3).map(tag => <Tag key={tag}>{tag}</Tag>)}</div><footer><time>{dateLabel(o.captured_at)}</time><span>{this.belongsParents(o.id).map(id => this.object(id)?.title).filter(Boolean).join(' · ')}</span></footer>
        </Surface>)}</div>;
        const start = Math.max(0, Math.floor(s.scrollTop / 44) - 8), end = Math.min(list.length, start + 36);
        const visible = list.length > 100 ? list.slice(start, end) : list;
        return <div className="object-list" role="listbox" aria-label="对象列表" onScroll={e => this.setState({ scrollTop: e.currentTarget.scrollTop })}>{list.length > 100 && <div style={{ height: start * 44 }}/>}{visible.map(o => { const k = this.kind(o.kind), old = o.kind === 'self' && o.valid_until; return <button key={o.id} role="option" aria-selected={s.selected === o.id} className={'object-row ' + (s.selected === o.id ? 'selected ' : '') + (o.kind === 'ai_output' ? 'ai-object ' : '') + (old ? 'invalidated' : '')} draggable onDragStart={e => e.dataTransfer.setData('drill/object', o.id)} onClick={() => this.select(o.id)} onDoubleClick={() => o.form === 'canvas' ? this.enterCanvas(o.id) : this.setState({ modal: 'preview' })}><span className="kind-dot" style={{ background: k?.color ?? 'var(--ash)' }} title={k?.label ?? '未提炼'}/><span className="object-row-title">{o.title || '无题'}{old && <small>已推翻</small>}</span>{o.source_id && <span className="row-source" title="外部冻结快照">↗</span>}<span className="object-tag">{o.tags_cached[0] ? '#' + o.tags_cached[0] : s.view === 'memory' ? o.applies_to.join(' · ') : ''}</span><time>{dateLabel(o.captured_at)}</time></button>; })}{list.length > 100 && <div style={{ height: (list.length - end) * 44 }}/>}</div>;
    }
    renderDiscovery() {
        const s = this.state;
        const ai = s.snapshot.capabilities.ai, semantic = s.snapshot.capabilities.semantic;
        if (s.view === 'insight')
            return <div className="discovery-body"><div className="insight-intro"><Icon name="spark" size={32}/><h2>洞察</h2><div className="insight-controls"><select aria-label="洞察范围" value={s.insightScope} onChange={e => this.setState({ insightScope: e.target.value })}><option value="week">最近 7 天</option>{this.objects().filter(o => o.kind === 'domain').map(o => <option key={o.id} value={o.id}>{o.title}</option>)}{this.objects().filter(o => o.form === 'canvas').map(o => <option key={o.id} value={'canvas:' + o.id}>画布 · {o.title}</option>)}</select><button className="primary" disabled={s.reading || !ai} onClick={() => this.run(() => this.askAI())}>{s.reading ? '在读…' : '生成洞察'}<Icon name="arrow" size={16}/></button></div>{!ai && <button className="text-button" onClick={() => this.navigate('settings')}>连接 AI</button>}</div>{this.renderInsightResult()}</div>;
        if (s.view === 'map')
            return <div className="discovery-body"><div className="map-frame">{s.mapData?.clusters?.length ? <svg viewBox="0 0 760 470" className="cognitive-map" role="img" aria-label="基于向量聚类的主题地图">{s.mapData.clusters.map((c: any, i: number) => <g key={c.id} onClick={() => { this.select(c.representative); this.setState({ mapCluster: c }); }} className="terrain-cluster"><circle cx={c.x * 7.4} cy={c.y * 5} r={24 + Math.sqrt(c.objects.length) * 8} fill="var(--porcelain)" stroke="var(--stone)"/><text x={c.x * 7.4} y={c.y * 5 - 10} textAnchor="middle">{c.label}</text><text x={c.x * 7.4} y={c.y * 5 + 12} textAnchor="middle" className="map-count">{c.objects.length} 条内容</text></g>)}</svg> : <div className="empty-state"><Icon name="map" size={36}/><h3>认知地图</h3><p>{semantic ? '生成主题分布' : '请先连接向量索引'}</p><button className="primary" disabled={!semantic} onClick={() => this.run(async () => { const data = await request('/map'); this.setState({ mapData: data }); })}>生成认知地图</button></div>}</div>{s.mapCluster && <div className="cluster-objects"><h3>{s.mapCluster.label}</h3>{s.mapCluster.objects.map((id: string) => <button key={id} onClick={() => this.select(id)}>{this.object(id)?.title}<Icon name="arrow" size={14}/></button>)}<button className="text-button" onClick={() => this.run(() => this.recognize(s.mapCluster.representative))}>我认出了一个重复的问题</button></div>}</div>;
        return <div className="discovery-body"><div className="walk-intro"><Icon name="walk" size={30}/>{!s.walkObject ? <div><h2>随机漫步</h2></div> : <div className="walk-card"><span className="eyebrow">{s.walkJump ? '一次弱相关的跨越' : '沿着关联，来到这里'}</span><h2>{s.walkObject.title}</h2><p>{s.walkObject.body}</p><button className="text-button" onClick={() => this.select(s.walkObject.id)}>打开这条内容 <Icon name="arrow" size={14}/></button><button className="text-button" onClick={() => this.run(() => this.recognize(s.walkObject.id))}>我认出了同一个问题</button><button className="text-button" onClick={() => this.run(async () => { await request('/settings', 'POST', { hide_object: s.walkObject.id }); await this.refresh(false); this.setState({ walkObject: null }); })}>别再给我看这条</button></div>}<button className="primary" disabled={!semantic} onClick={() => this.run(async () => { const data = await request('/walk', 'POST', { previous_id: s.walkObject?.id, exclude_ids: s.walkPath }); if (!data.object) {
            this.toast('这次路径走到这里，休息一下。');
            return;
        } this.setState({ walkObject: data.object, walkJump: data.jump, walkPath: [...s.walkPath, data.object.id] }); })}>{s.walkObject ? '继续走一段' : '开始漫步'}<Icon name="arrow" size={16}/></button>{!semantic && <button className="text-button" onClick={() => this.navigate('settings')}>连接向量索引</button>}</div></div>;
    }
    renderInsightResult() { const s = this.state; if (s.reading)
        return <div className="insight-result quiet-reading">在读…</div>; if (!s.insight)
        return null; if (s.insight.silent)
        return <div className="insight-result"><p className="metadata">暂时没什么可说的</p></div>; return <article className="insight-result ai-object"><span className="eyebrow">AI生成</span><p>{s.insight.text}</p><div className="citations">{s.insight.citations.map((id: string, i: number) => <button key={id} onClick={() => this.select(id)}>{i + 1}. {this.object(id)?.title}</button>)}</div>{s.insight.citations.length > 1 && <button className="text-button" onClick={() => this.run(() => this.recognize(s.insight.citations[0], s.insight.citations[1]))}>我认出了同一个问题 <Icon name="arrow" size={14}/></button>}</article>; }
    renderMain() { const s = this.state; const canvas = s.view === 'canvas' ? this.object(s.scope) : null; return <main id="drill-main" tabIndex={-1} className="main-pane">{this.renderTop()}{s.window === 'custom' && ['recent', 'timeline', 'canvas'].includes(s.view) && <div className="custom-range"><input aria-label="起始日期" type="date" value={s.custom.from} onChange={e => this.setState({ custom: { ...s.custom, from: e.target.value } })}/><span>至</span><input aria-label="结束日期" type="date" value={s.custom.to} onChange={e => this.setState({ custom: { ...s.custom, to: e.target.value } })}/></div>}{canvas ? <div className="canvas-page"><div className="canvas-breadcrumb"><Icon name="canvas" size={17}/>{s.breadcrumbs.map((id: string, i: number) => <div key={i}><button onClick={() => this.setState({ scope: id, breadcrumbs: s.breadcrumbs.slice(0, i + 1) })}>{this.object(id)?.title}</button>{i < s.breadcrumbs.length - 1 && <Icon name="chevron" size={13}/>}</div>)}<span className="metadata">自由摆放</span></div><Canvas key={canvas.id} canvas={canvas} objects={this.objects()} placements={s.snapshot.placements} relations={s.snapshot.relations} kinds={this.kinds()} selected={s.selected} window={s.window} custom={s.custom} timezone={s.snapshot.user.timezone} globalDisplay={s.snapshot.user.settings.canvas_display ?? 'collapse_body'} onSelect={id => this.select(id)} onEnter={this.enterCanvas} onPlacement={this.placement} onConnect={this.connect} onNew={this.newCanvasObject} onRename={(id, title) => this.save(this.object(id)!, 'title', title)} onError={this.fail} onRemove={id => this.run(async () => { const p = s.snapshot.placements.find((p: Placement) => p.canvas_id === canvas.id && p.object_id === id); if (p)
        await this.placement({ ...p, deleted_at: Date.now() }); })}/></div> : s.view === 'settings' ? this.renderSettings() : <div className={'main-content ' + (['insight', 'map', 'walk'].includes(s.view) ? 'discovery-page' : '')}>{['insight', 'map', 'walk'].includes(s.view) ? this.renderDiscovery() : <div className="list-content">{this.renderList()}</div>}</div>}</main>; }
    renderProperty(o: KnowledgeObject, name: string, p: Property) {
        const value = (o as any)[name] ?? o.extra[name] ?? '';
        const update = (v: any) => this.run(() => this.save(o, name in o ? name : 'extra', name in o ? v : { ...o.extra, [name]: v }));
        const options = p.type === 'object' ? this.objects().filter(x => !x.deleted_at && (!p.kinds?.length || p.kinds.includes(x.kind ?? ''))).map(x => ({ value: x.id, label: x.title })) : (p.options ?? []).map(value => ({ value, label: statusLabel[value] ?? value }));
        return <div className="property-row" key={name}><Icon name={p.type === 'datetime' ? 'clock' : 'tag'}/><label>{p.label ?? labels[name] ?? name}</label><div>{['label', 'object'].includes(p.type) ? <GhostSelect label={p.label ?? labels[name] ?? name} value={value} options={options} multiple={p.multiple} onChange={update}/> : p.type === 'checkbox' ? <input aria-label={p.label ?? name} type="checkbox" checked={!!value} onChange={e => update(e.target.checked)}/> : <input className="ghost-input" aria-label={p.label ?? labels[name] ?? name} placeholder="—" key={o.id + name + String(value)} defaultValue={p.type === 'datetime' && value ? new Date(Number(value) - new Date(Number(value)).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : value} type={p.type === 'datetime' ? 'datetime-local' : p.type === 'number' ? 'number' : 'text'} onBlur={e => { const v = p.type === 'datetime' ? e.target.value ? new Date(e.target.value).getTime() : null : p.type === 'number' ? e.target.value ? Number(e.target.value) : null : e.target.value; if (v !== value) update(v); }}/>} {this.renderProposals(o, name)}</div></div>;
    }
    updateBelongs = async (o: KnowledgeObject, values: string[]) => {
        const current = this.belongsParents(o.id);
        const changes = [...current.filter(id => !values.includes(id)).map(to_id => this.changes(o, 'relation', { to_id, type: 'belongs', deleted_at: Date.now() })), ...values.filter(id => !current.includes(id)).map(to_id => this.changes(o, 'relation', { to_id, type: 'belongs' }))];
        if (changes.length) { await commit(changes); await this.refresh(false); }
    };
    renderProperties(o: KnowledgeObject) {
        const s = this.state, k = this.kind(o.kind), multiple = !!k?.relations?.belongs?.multiple;
        const properties: Record<string, Property> = { ...k?.properties };
        for (const p of s.snapshot.proposals.filter((p: any) => p.object_id === o.id && p.status === 'pending' && !['kind', 'belongs', 'tags'].includes(p.field))) { const definition = this.kinds().find(k => k.properties[p.field])?.properties[p.field]; if (definition) properties[p.field] = definition; }
        return <div className="properties">
            <div className="property-row"><Icon name="canvas" style={{ color: k?.color }}/><label>类型</label><div><GhostSelect key={o.id + '-kind'} label="对象类型" value={o.kind ?? ''} options={this.kinds().filter(k => o.form === 'canvas' || k.id !== 'canvas').map(k => ({ value: k.id, label: k.label }))} disabled={o.form === 'canvas'} onChange={(value: string) => this.run(() => this.setKind(o, value || null))}/>{this.renderProposals(o, 'kind')}</div></div>
            {this.belongsTargets(o).length > 0 && <div className="property-row"><Icon name="folder"/><label>归属</label><div><GhostSelect key={o.id + '-belongs'} label="对象归属" value={multiple ? this.belongsParents(o.id) : this.belongsParents(o.id)[0] ?? ''} multiple={multiple} options={this.objects().filter(p => p.id !== o.id && !p.deleted_at && this.belongsTargets(o).includes(p.kind ?? '')).map(p => ({ value: p.id, label: p.title }))} onChange={(value: any) => this.run(() => this.updateBelongs(o, multiple ? value : value ? [value] : []))}/>{this.renderProposals(o, 'belongs')}</div></div>}
            <div className="property-row"><Icon name="tag"/><label>标签</label><div className="tag-values">{o.tags_cached.map(tag => <button key={tag} title={'移除标签' + tag} onClick={() => this.run(() => this.save(o, 'tag', { tag, deleted_at: Date.now() }, false))}>#{tag}<span>×</span></button>)}{s.tagInput === o.id ? <input autoFocus className="ghost-input tag-input" aria-label="新标签" list="existing-tags" placeholder="标签" onBlur={() => this.setState({ tagInput: null })} onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); const tag = e.currentTarget.value.trim().replace(/^#/, ''); if (tag) this.run(async () => { await this.save(o, 'tag', { tag }, false); this.setState({ tagInput: null }); }); } if (e.key === 'Escape') { e.stopPropagation(); this.setState({ tagInput: null }); } }}/> : <button aria-label="添加标签" onClick={() => this.setState({ tagInput: o.id })}><Icon name="plus"/></button>}<datalist id="existing-tags">{[...new Set(this.objects().flatMap(o => o.tags_cached))].map(tag => <option key={tag} value={tag}/>)}</datalist>{this.renderProposals(o, 'tags')}</div></div>
            <div className="property-row"><Icon name="list"/><label>系列</label><input key={o.id + '-series'} className="ghost-input" aria-label="系列" placeholder="—" defaultValue={o.series ?? ''} onBlur={e => { if ((e.target.value || null) !== o.series) this.run(() => this.save(o, 'series', e.target.value || null)); }}/></div>
            {Object.entries(properties).map(([name, p]) => this.renderProperty(o, name, p))}
            {o.ephemeral && <button className="text-button" onClick={() => this.run(() => this.save(o, 'ephemeral', false))}>转为正式对象</button>}
        </div>;
    }
    renderMedia(o: KnowledgeObject) { if (!o.asset_id)
        return null; const url = this.state.assetUrls?.[o.asset_id]; if (!url)
        return <button className="media-placeholder" onClick={() => this.run(async () => { const data = isDesktop() ? await request('/assets/' + o.asset_id + '/url') : await request('/assets/' + o.asset_id + '/url'); this.setState({ assetUrls: { ...this.state.assetUrls, [o.asset_id!]: data.url } }); })}>查看{o.form === 'image' ? '图片' : o.form === 'audio' ? '音频' : '视频'} <Icon name="eye" size={16}/></button>; return o.form === 'image' ? <img className="object-image" src={url} alt={o.title}/> : o.form === 'audio' ? <audio controls src={url}/> : <video controls src={url}/>; }
    renderObjectBody(o: KnowledgeObject, full = false) {
        const editable = isDesktop() && !o.source_id && o.kind !== 'artifact' && !full;
        return <div className="object-body">{this.renderMedia(o)}{o.form === 'link' && /^https?:\/\//.test(o.title) && <a className="external-link" href={o.title} target="_blank" rel="noreferrer">打开原链接 <Icon name="external"/></a>}
            {editable ? <ParagraphEditor key={o.id} draft={this.bodyDrafts[o.id]} onDraft={blocks => { if (blocks) this.bodyDrafts[o.id] = blocks; else delete this.bodyDrafts[o.id]; }} object={o} objects={this.objects()} renderMarkup={text => this.renderMarkup(text)} onSave={async blocks => { await commit([this.changes(this.object(o.id) ?? o, 'body_blocks', { blocks })]); await this.refresh(false); }} onError={this.fail}/> : sortedBlocks(o.body_blocks.blocks).length ? sortedBlocks(o.body_blocks.blocks).map(b => <p key={b.id} id={'block-' + b.id} className="body-paragraph">{this.renderMarkup(b.text, !!o.source_id)}</p>) : o.body ? <p className="body-paragraph">{this.renderMarkup(o.body, !!o.source_id)}</p> : null}
        </div>;
    }
    proposalLabel = (field: string, value: any): string => value == null ? '—' : field === 'kind' ? this.kind(value)?.label ?? value : field === 'belongs' ? this.object(value)?.title ?? value : Array.isArray(value) ? value.join(' · ') : statusLabel[value] ?? String(value);
    decideProposal = async (p: any, status: string, value?: any) => { await request('/proposals/decide', 'POST', { id: p.id, status, ...(value !== undefined ? { value } : {}) }); this.setState({ proposalEdit: null }); await this.refresh(false); };
    renderProposals(o: KnowledgeObject, field?: string) {
        const s = this.state, proposals = s.snapshot.proposals.filter((p: any) => p.object_id === o.id && p.status === 'pending' && p.field === field);
        if (field && !proposals.length) return null;
        return <div className={field ? 'inline-proposals' : 'proposal-area'}>{!field && <div className="section-heading"><span>提炼</span><button title={!s.snapshot.capabilities.ai ? '在设置中连接 AI' : '请 AI 提议'} disabled={!s.snapshot.capabilities.ai || s.reading} onClick={() => this.run(this.distill)}><Icon name="spark"/>{s.reading ? '在读…' : '请 AI 提议'}</button></div>}
            {proposals.map((p: any) => {
                const display = p.field === 'kind' ? this.kind(p.ai_value)?.label : p.field === 'belongs' ? this.object(p.ai_value)?.title : Array.isArray(p.ai_value) ? p.ai_value.join(' · ') : statusLabel[p.ai_value] ?? String(p.ai_value);
                const options = p.field === 'kind' ? this.kinds().map(k => ({ value: k.id, label: k.label })) : p.field === 'belongs' ? this.objects().filter(x => !x.deleted_at && x.id !== o.id && this.belongsTargets(o).includes(x.kind ?? '')).map(x => ({ value: x.id, label: x.title })) : (this.kind(o.kind)?.properties[p.field]?.options ?? this.kinds().find(k => k.properties[p.field])?.properties[p.field]?.options ?? []).map(value => ({ value, label: statusLabel[value] ?? value }));
                return <div className="proposal" key={p.id}><div className="proposal-value"><strong>{display}</strong><small>AI 建议</small></div>
                    {s.proposalEdit === p.id ? <div className="proposal-edit">{options.length ? <GhostSelect label={'修改' + (labels[p.field] ?? p.field)} value={s.proposalValue} options={options} multiple={Array.isArray(p.ai_value)} onChange={(value: any) => this.setState({ proposalValue: value })}/> : <input autoFocus aria-label={'修改' + (labels[p.field] ?? p.field)} value={Array.isArray(s.proposalValue) ? s.proposalValue.join('、') : s.proposalValue ?? ''} onChange={e => this.setState({ proposalValue: Array.isArray(p.ai_value) ? e.target.value.split(/[、,，]/).map(x => x.trim()).filter(Boolean) : e.target.value })}/>}
                        <div className="button-row"><button className="primary" onClick={() => this.run(() => this.decideProposal(p, 'edited', s.proposalValue))}>保存</button><button onClick={() => this.setState({ proposalEdit: null })}>取消</button></div></div> : <div className="button-row"><button className="primary" onClick={() => this.run(() => this.decideProposal(p, 'accepted'))}>采纳</button><button onClick={() => this.setState({ proposalEdit: p.id, proposalValue: p.ai_value })}>改一下</button><button onClick={() => this.run(() => this.decideProposal(p, 'rejected'))}>跳过</button></div>}
                </div>;
            })}
        </div>;
    }
    renderRelations(o: KnowledgeObject) { const s = this.state; const active = s.snapshot.relations.filter((r: any) => !r.deleted_at); const out = active.filter((r: any) => r.from_id === o.id && r.type !== 'belongs'), incoming = active.filter((r: any) => r.to_id === o.id && r.type !== 'belongs'); const edge = (r: any, direction: string) => { const id = direction === 'out' ? r.to_id : r.from_id; return <button key={[r.from_id, r.to_id, r.source_field, r.source_block_id].join('-')} className="context-item" draggable onDragStart={e => e.dataTransfer.setData('drill/object', id)} onClick={() => this.select(id)}><span>{this.object(id)?.title ?? '对象已不可见'}</span>{r.source_block_id && <small onClick={e => { e.stopPropagation(); this.select(r.from_id, 'read'); setTimeout(() => document.getElementById('block-' + r.source_block_id)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100); }}>回到原段落 ↗</small>}<Icon name="arrow" size={14}/></button>; }; return <div><section className="context-section"><div className="section-heading"><span>相关</span><small>{s.related.mode === 'semantic' ? '向量相似' : s.related.mode === 'offline' ? '联网后可用' : '字面相近'}</small></div>{s.related.items.length ? s.related.items.slice(0, 5).map((x: any) => <button key={x.object.id} className="context-item" draggable onDragStart={e => e.dataTransfer.setData('drill/object', x.object.id)} onClick={() => this.select(x.object.id)}><span>{x.object.title}</span><small>{dateLabel(x.object.captured_at)}</small><Icon name="arrow" size={13}/></button>) : <p className="context-empty">还没有足够相似的内容</p>}</section><section className="context-section"><div className="section-heading"><span>局部图</span><button onClick={() => this.setState({ graphDepth: s.graphDepth === 1 ? 2 : 1 })}>{s.graphDepth === 1 ? '展开两跳' : '收回一跳'}</button></div>{!out.length && !incoming.length ? <p className="context-empty">这条还没有关联</p> : <div className="local-graph"><div className="graph-direction"><Icon name="arrow" size={14}/> 它引用了谁</div>{out.map((r: any) => edge(r, 'out'))}<div className="graph-direction incoming"><Icon name="back" size={14}/> 谁引用了它</div>{incoming.map((r: any) => edge(r, 'in'))}{s.graphDepth === 2 && <div className="second-hop"><span className="metadata">再往外一跳</span>{active.filter((r: any) => r.from_id !== o.id && r.to_id !== o.id && [...out.map((x: any) => x.to_id), ...incoming.map((x: any) => x.from_id)].includes(r.from_id)).slice(0, 20).map((r: any) => edge(r, 'out'))}</div>}</div>}<button className="text-button" onClick={() => this.setState({ modal: 'link' })}><Icon name="plus" size={13}/> 手动挂一个引用</button></section><section className="context-section"><div className="section-heading"><span>洞察</span><button disabled={!s.snapshot.capabilities.ai || s.reading} onClick={() => this.run(() => this.askAI(o.id))}><Icon name="spark" size={14}/> 点一下</button></div>{this.renderInsightResult()}</section><button className="text-button" onClick={() => this.run(() => this.recognize(o.id))}>我认出了一个重复的问题 <Icon name="arrow" size={13}/></button></div>; }
    renderRight() {
        const s = this.state, o = this.selected(); if (!s.right) return null;
        const pending = o && (!o.kind || s.snapshot.proposals.some((p: any) => p.object_id === o.id && p.status === 'pending'));
        return <aside className="right-pane" aria-label="对象详情">{!o ? <div className="right-empty"><button className="empty-panel-close" title="折叠上下文栏" onClick={() => this.setState({ right: false })}><Icon name="panel"/></button><Icon name="select" size={24}/><p>选择一条内容</p></div> : <div className="right-scroll">
            <div className="detail-type"><Badge dot>{this.kind(o.kind)?.label ?? '未分类'}</Badge><span>对象详情</span></div><div className="object-title-row"><h2 className="object-title" key={o.id} contentEditable={!o.source_id && o.kind !== 'artifact'} suppressContentEditableWarning aria-label="对象标题" onBlur={e => { const title = e.currentTarget.textContent?.trim(); if (title && title !== o.title) this.run(() => this.save(o, 'title', title)); else e.currentTarget.textContent = o.title; }} onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); e.currentTarget.blur(); } }} >{o.title}</h2><div className="object-title-actions"><button title="对象菜单" onClick={() => this.setState({ modal: 'object-actions' })}><Icon name="more"/></button><button title="折叠上下文栏" onClick={() => this.setState({ right: false })}><Icon name="panel"/></button></div></div>
            {s.snapshot.conflicts.some((c: any) => c.object_id === o.id && c.resolution === 'lost') && <button className="conflict-alert" onClick={() => this.setState({ modal: 'conflicts' })}>有一次修改被覆盖了，点开看 ↗</button>}
            {pending && this.renderProposals(o)}{this.renderProperties(o)}{this.renderObjectBody(o)}
            {o.kind === 'self' && <div className="self-actions"><p>{o.valid_until ? '已推翻' : o.confirmed_at ? '上次确认：' + dateLabel(o.confirmed_at) : '今天还成立吗？'}</p>{!o.valid_until && <div className="button-row"><button onClick={() => this.run(() => this.save(o, 'confirmed_at', Date.now()))}>我还这么想</button><button onClick={() => this.showDialog({ title: '现在的看法', onSubmit: async title => { const next = makeObject(title, s.snapshot.user.id, { kind: 'self', applies_to: o.applies_to, supersedes_id: o.id }); await this.create(next); await this.inheritBelongs(o.id, next.id); this.select(next.id); } })}>我改主意了</button></div>}</div>}
            {this.renderRelations(o)}
            <footer className="object-meta"><time>{dateLabel(o.captured_at, true)}</time><button onClick={() => this.run(this.versions)}>版本 · 改过 {Math.max(0, o.rev - 1)} 次</button><span>来源 · {o.source_id ? s.snapshot.sources.find((x: any) => x.id === o.source_id)?.name ?? '外部快照' : o.kind === 'ai_output' ? 'AI生成' : '自己写'}</span>{o.source_id && Object.entries(s.snapshot.sources.find((x: any) => x.id === o.source_id)?.properties ?? {}).map(([key, p]: [string, any]) => <span key={key}>{p.label ?? key} · {String(o.extra[key] ?? '—')}</span>)}</footer>{s.snapshot.proposals.some((p: any) => p.object_id === o.id && p.status !== 'pending') && <details className="proposal-history"><summary>判断记录</summary>{s.snapshot.proposals.filter((p: any) => p.object_id === o.id && p.status !== 'pending').map((p: any) => <p key={p.id}>{labels[p.field] ?? p.field} · {p.status === 'accepted' ? '采纳' : p.status === 'edited' ? '改写' : '跳过'}<br/>建议：{this.proposalLabel(p.field, p.ai_value)}<br/>决定：{this.proposalLabel(p.field, p.final_value)}</p>)}</details>}
        </div>}</aside>;
    }
    renderCanvasThumbnail(o: KnowledgeObject) {
        const ps: Placement[] = this.state.snapshot.placements.filter((p: Placement) => p.canvas_id === o.id && !p.deleted_at && this.object(p.object_id) && !this.object(p.object_id)?.deleted_at);
        if (!ps.length) return <div className="mini-canvas"><Icon name="canvas" size={24}/></div>;
        const x = Math.min(...ps.map(p => p.x)), y = Math.min(...ps.map(p => p.y)), w = Math.max(...ps.map(p => p.x + p.w)) - x, h = Math.max(...ps.map(p => p.y + p.h)) - y;
        return <svg className="mini-canvas" viewBox={`${x - 20} ${y - 20} ${w + 40} ${h + 40}`} aria-label={o.title + '布局预览'}>{ps.map(p => <rect key={p.object_id} x={p.x} y={p.y} width={p.w} height={p.h} rx="8" fill={this.object(p.object_id)?.kind === 'group' ? 'var(--porcelain)' : 'var(--paper)'} stroke="var(--stone)" strokeWidth="3"/>)}</svg>;
    }
    renderSettings() { const s = this.state, snap = s.snapshot; return <div className="settings-page"><PageHeader title="偏好与连接" description="让工作空间适合你的记录习惯。"/><SettingsSection title="外观" description="此设备上的界面偏好。"><SettingsRow title="主题" description="浅色或深色工作空间"><SegmentedControl label="主题" value={s.theme} onValueChange={value => this.preference('theme', value)} options={[{ value: 'light', label: '浅色' }, { value: 'dark', label: '深色' }]}/></SettingsRow><SettingsRow title="界面密度" description="调整控件与列表的留白"><SegmentedControl label="界面密度" value={s.density} onValueChange={value => this.preference('density', value)} options={[{ value: 'comfortable', label: '舒适' }, { value: 'compact', label: '紧凑' }]}/></SettingsRow></SettingsSection><section><h3>这份空间</h3><div className="settings-row"><label>本地时区</label><select value={snap.user.timezone} onChange={e => this.run(async () => { await request('/settings', 'POST', { timezone: e.target.value }); await this.refresh(false); })}>{['Asia/Shanghai', 'Asia/Hong_Kong', 'Asia/Tokyo', 'Europe/London', 'America/New_York', 'America/Los_Angeles', 'UTC'].map(v => <option key={v}>{v}</option>)}</select></div><div className="settings-row"><label>画布默认显示</label><select value={snap.user.settings.canvas_display ?? 'collapse_body'} onChange={e => this.run(async () => { await request('/settings', 'POST', { canvas_display: e.target.value }); await this.refresh(false); })}><option value="title_only">只显示主体</option><option value="collapse_body">折叠附文</option><option value="full">全部显示</option></select></div><button className="secondary" onClick={() => this.run(async () => download('drill-export-' + new Date().toISOString().slice(0, 10) + '.json', await request('/export')))}><Icon name="download" size={15}/> 导出我的数据</button><p className="metadata">导出包含对象、关系、布局与版本。媒体原件仍在原存储中，请另外备份。</p></section><section><h3>服务状态</h3><div className="settings-row"><label>当前运行方式</label><span>{isDesktop() ? 'Electron · SQLite 本地库' : snap.capabilities.demo ? '本机示例 · JSON存储（非正式后端）' : 'Web · 纯在线'}</span></div><div className="settings-row"><label>AI 提议与洞察</label><span>{snap.capabilities.ai ? '已配置' : '未连接'}</span></div><div className="settings-row"><label>bge-m3 向量</label><span>{snap.capabilities.semantic ? '已配置' : '未连接 · 字面搜索可用'}</span></div>{snap.capabilities.semantic && <button className="secondary" onClick={() => this.run(async () => { let offset = 0, done = false; while (!done) {
        const data = await request('/search/reindex', 'POST', { offset });
        offset = data.next_offset;
        done = data.done;
        this.toast(`已索引 ${offset} 条`);
    } })}>手动建立 / 刷新向量索引</button>}<p className="metadata"></p>{isDesktop() && <div><button className="secondary" onClick={() => this.run(async () => { await (window as any).drill.sync(); await this.refresh(false); })}>立即同步</button><pre>{s.syncState?.error ?? '本地内容已保存'}</pre><button className="secondary" onClick={() => this.setState({ modal: 'connect' })}>连接同一个后端</button></div>}</section><section><h3>连接器</h3><p></p>{snap.sources.map((src: any) => <div className="source-card" key={src.id}><div><strong>{src.name}</strong><span className="metadata">{src.last_synced ? '上次同步 ' + dateLabel(src.last_synced, true) : '还没有拉取'}</span></div>{src.state.error && <p className="amber">{src.state.error}</p>}{Object.keys(src.state.new_versions ?? {}).length > 0 && <p>发现 {Object.keys(src.state.new_versions ?? {}).length} 个新版本，原快照保持不变。</p>}{isDesktop() && <button onClick={() => this.run(async () => { await (window as any).drill.pullSource(src.id); await this.refresh(false); })}>拉取一次</button>}</div>)}{isDesktop() ? <div className="source-form"><select value={s.sourceForm.connector} onChange={e => this.setState({ sourceForm: { ...s.sourceForm, connector: e.target.value } })}><option value="obsidian">Obsidian 文库</option><option value="chrome">Chrome History</option><option value="codex">Codex 会话目录</option></select><input placeholder="本机目录或History文件路径" value={s.sourceForm.path} onChange={e => this.setState({ sourceForm: { ...s.sourceForm, path: e.target.value } })}/><button className="secondary" onClick={() => this.run(async () => { await (window as any).drill.addSource(s.sourceForm); await this.refresh(false); this.toast('连接器已添加，手动拉取时才读取本机内容。'); })}>添加连接器</button></div> : <p className="service-notice">连接器只在桌面端运行。</p>}</section><section><h3>不再出现的内容</h3>{(snap.user.settings.discovery_hidden ?? []).length ? (snap.user.settings.discovery_hidden ?? []).map((id: string) => <div className="settings-row" key={id}><span>{this.object(id)?.title ?? id}</span><button onClick={() => this.run(async () => { await request('/settings', 'POST', { unhide_object: id }); await this.refresh(false); })}>恢复展示</button></div>) : <p className="metadata">还没有隐藏内容。隐藏不等于删除。</p>}</section><section><h3>键盘</h3><div className="shortcut-grid">{[['⌘ K', '搜索与命令'], ['⌘ ⇧ Space', '快速捕获'], ['↑ / ↓', '移动选择'], ['Enter', '临时预览'], ['⌘ Enter', '固定到右栏'], ['⌘ ⇧ Enter', '进入嵌套画布'], ['⌘ Z', '撤销属性修改'], ['Esc', '关闭预览 / 返回上层']].map(([key, text]) => <div key={key}><kbd>{key}</kbd><span>{text}</span></div>)}</div></section></div>; }
    renderModals() {
        const s = this.state, o = this.selected();
        let title = '', body: React.ReactNode = null;
        if (s.modal === 'versions') {
            title = '版本与来路';
            body = <div className="versions-list">{!s.versions.length ? <p>还没有更早的版本。</p> : [...s.versions].reverse().map((v: any) => <details key={v.rev}><summary>版本 {v.rev} · {dateLabel(v.created_at, true)}</summary><h3>{v.snapshot.title}</h3><pre>{v.snapshot.body}</pre></details>)}</div>;
        }
        else if (s.modal === 'conflicts') {
            title = '曾被覆盖的修改';
            body = <div>{s.snapshot.conflicts.filter((c: any) => c.object_id === o?.id && c.resolution === 'lost').map((c: any) => <article className="conflict-record" key={c.id}><h3>{c.field} · {dateLabel(c.created_at, true)}</h3><p>设备：{c.device_id}　基于版本 {c.base_rev}</p><pre>{typeof c.losing_value === 'string' ? c.losing_value : JSON.stringify(c.losing_value, null, 2)}</pre></article>)}</div>;
        }
        else if (s.modal === 'preview' && o) {
            title = o.title;
            body = this.renderObjectBody(o, true);
        }
        else if (s.modal === 'link' && o) {
            title = '挂一个引用';
            body = <div className="pick-list">{this.objects().filter(x => !x.deleted_at && x.id !== o.id && !['canvas', 'group'].includes(x.kind ?? '')).map(x => <button key={x.id} onClick={() => this.run(async () => { await this.save(o, 'relation', { to_id: x.id }, false); this.setState({ modal: null }); })}>{x.title}<Icon name="plus" size={14}/></button>)}</div>;
        }
        else if (s.modal === 'recognize') {
            title = '认出同一个问题';
            body = <div className="pick-list"><p>这条：{this.object(s.recognizeFirst)?.title}</p><p>让你想起了哪一条？</p>{this.objects().filter(x => !x.deleted_at && x.id !== s.recognizeFirst && !['canvas', 'group', 'domain', 'project'].includes(x.kind ?? '')).map(x => <button key={x.id} onClick={() => this.run(() => this.recognize(s.recognizeFirst, x.id))}>{x.title}<Icon name="link" size={14}/></button>)}</div>;
        }
        else if (s.modal === 'source') {
            const src = s.snapshot.sources.find((x: any) => x.id === s.sourceId);
            title = src?.name ?? '添加连接器';
            body = src ? <div className="connect-form"><p className="metadata">{src.last_synced ? '上次同步 ' + dateLabel(src.last_synced, true) : '尚未同步'}</p>{src.state.error && <p className="amber">{src.state.error}</p>}{isDesktop() ? <button className="primary" onClick={() => this.run(async () => { await (window as any).drill.pullSource(src.id); await this.refresh(false); this.setState({ modal: null }); })}>同步</button> : <p className="metadata">在桌面端同步此连接器</p>}</div> : isDesktop() ? <form className="source-form" onSubmit={e => { e.preventDefault(); this.run(async () => { await (window as any).drill.addSource(s.sourceForm); await this.refresh(false); this.setState({ modal: null }); }); }}><select aria-label="连接器类型" value={s.sourceForm.connector} onChange={e => this.setState({ sourceForm: { ...s.sourceForm, connector: e.target.value } })}><option value="obsidian">Obsidian</option><option value="chrome">Chrome History</option><option value="codex">Codex</option></select><input required aria-label="连接器路径" placeholder="目录或文件路径" value={s.sourceForm.path} onChange={e => this.setState({ sourceForm: { ...s.sourceForm, path: e.target.value } })}/><button className="primary">添加</button></form> : <p className="metadata">在桌面端添加连接器</p>;
        }
        else if (s.modal === 'connect') {
            title = '连接你的后端';
            body = <form className="connect-form" onSubmit={e => { e.preventDefault(); this.run(async () => { await (window as any).drill.connect({ url: s.backendUrl, password: s.backendPassword, token: s.backendToken }); this.setState({ modal: null }); await this.refresh(false); }); }}><input required placeholder="https://你的服务地址" value={s.backendUrl ?? ''} onChange={e => this.setState({ backendUrl: e.target.value })}/><input type="password" placeholder="自托管连接口令" value={s.backendPassword ?? ''} onChange={e => this.setState({ backendPassword: e.target.value })}/><input type="password" placeholder="或 CloudBase access_token" value={s.backendToken ?? ''} onChange={e => this.setState({ backendToken: e.target.value })}/><p className="metadata">已有本地内容后不可切换到另一后端，以免混合两个真相源。</p><button className="primary">连接</button></form>;
        }
        else if (s.modal === 'object-actions' && o) {
            title = '对象';
            body = <div className="object-actions"><button disabled={!s.snapshot.capabilities.ai || s.reading} onClick={() => { this.setState({ modal: null }); this.run(this.distill); }}>请 AI 提议 <Icon name="spark"/></button><button onClick={() => this.showDialog({ title: '新写一条沉淀', onSubmit: async title => { const n = makeObject(title, s.snapshot.user.id, { kind: 'distill' }); await this.create(n); await this.inheritBelongs(o.id, n.id); await this.save(this.object(n.id)!, 'relation', { to_id: o.id, type: 'cite' }, false); this.select(n.id); } })}>用自己的话新写一条沉淀 <Icon name="arrow" size={16}/></button><button onClick={() => this.run(async () => { await request('/settings', 'POST', { hide_object: o.id }); await this.refresh(false); this.setState({ modal: null }); this.toast('只停止主动发现中的展示，对象仍然保留。'); })}>别再给我看这条 <Icon name="eye" size={16}/></button>{s.view === 'canvas' && <div><label>在这张画布的显示</label><select value={s.snapshot.placements.find((p: Placement) => p.object_id === o.id && p.canvas_id === s.scope)?.display ?? ''} onChange={e => this.run(async () => { const p = s.snapshot.placements.find((p: Placement) => p.object_id === o.id && p.canvas_id === s.scope); if (p)
                await this.placement({ ...p, display: e.target.value || null }); })}><option value="">跟随全局</option><option value="title_only">只显示主体</option><option value="collapse_body">折叠附文</option><option value="full">全部显示</option></select><label>所属区域</label><select value={s.snapshot.placements.find((p: Placement) => p.object_id === o.id && p.canvas_id === s.scope)?.group_id ?? ''} onChange={e => this.run(async () => { const p = s.snapshot.placements.find((p: Placement) => p.object_id === o.id && p.canvas_id === s.scope); if (p)
                await this.placement({ ...p, group_id: e.target.value || null }); })}><option value="">不在分组中</option>{s.snapshot.placements.filter((p: Placement) => p.canvas_id === s.scope && !p.deleted_at && p.object_id !== o.id && this.object(p.object_id)?.kind === 'group').map((p: Placement) => <option key={p.object_id} value={p.object_id}>{this.object(p.object_id)?.title}</option>)}</select></div>}<button className="danger-text" onClick={() => this.showDialog({ title: '删除对象', description: '删除「' + o.title + '」？此操作无法直接恢复。', confirm: true, submit: '删除', onSubmit: async () => { await this.save(o, 'deleted_at', Date.now(), false); this.setState({ selected: null }); } })}>删除对象 <Icon name="trash" size={16}/></button></div>;
        }
        return <>{s.dialog && <InputDialog key={s.dialog.title} spec={s.dialog} onClose={() => this.setState({ dialog: null })} onError={this.fail}/>} {s.capture && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget)
            this.setState({ capture: false }); }}><section className="capture-modal" role="dialog" aria-label="快速捕获" aria-modal="true"><textarea ref={el => { this.captureInput = el; }} placeholder="写下此刻的想法…" rows={3} value={s.captureText} onChange={e => { e.currentTarget.style.height = 'auto'; e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px'; this.setState({ captureText: e.target.value }); }} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            this.run(this.capture);
        } }} onPaste={e => { const file = e.clipboardData.files[0]; if (file) {
            e.preventDefault();
            this.run(() => this.importFile(file));
        } }}/><div className="capture-footer">{s.recording ? <span className="recording-indicator">● 正在录音 · ⌘R 停止</span> : null}<span><kbd>↵</kbd> 存下　 <kbd>esc</kbd> 取消　 <kbd>⌘R</kbd> 录音</span></div></section></div>}{s.search && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget)
            this.setState({ search: false }); }}><section className="search-modal" role="dialog" aria-modal="true" aria-label="搜索与命令"><header><Icon name="search" size={20}/><input ref={el => { this.searchInput = el; }} value={s.query} placeholder="用你自己会写的词，找回来…" onChange={e => void this.search(e.target.value)}/><button onClick={() => this.setState({ search: false })}><kbd>esc</kbd></button></header><div className="search-tabs">{[['lexical', '字面'], ['semantic', '语义'], ['hybrid', '混合']].map(([mode, label]) => <button key={mode} disabled={mode !== 'lexical' && !s.snapshot.capabilities.semantic} className={mode === s.searchMode ? 'active' : ''} onClick={() => void this.search(s.query, mode)}>{label}</button>)}<span className="metadata">输入 &gt; 使用命令</span></div><div className="search-results">{s.query.startsWith('>') ? [['快速捕获', () => this.openCapture()], ['前往行动', () => this.navigate('actions')], ['前往画布', () => this.navigate('canvases')], ['查看设置', () => this.navigate('settings')]].map(([name, fn]: any) => <button key={name} onClick={() => { this.setState({ search: false }); fn(); }}>{name}<Icon name="arrow" size={15}/></button>) : s.searchBusy ? <p className="context-empty">在找…</p> : s.searchResults.length ? s.searchResults.map((o: KnowledgeObject) => <button key={o.id} onClick={() => { this.setState({ search: false }); this.select(o.id); }}><span className="kind-dot" style={{ background: this.kind(o.kind)?.color }}/><span><strong>{o.title}</strong><small>{o.body?.slice(0, 100)}</small></span><time>{dateLabel(o.captured_at)}</time></button>) : <p className="context-empty">{s.query ? '没找到。试试用你自己会写的词？' : '从一个词、一句话，或一段记忆开始。'}</p>}</div></section></div>}{s.modal && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget)
            this.setState({ modal: null }); }}><section className="generic-modal" role="dialog" aria-modal="true"><header><h2>{title}</h2><button aria-label="关闭" onClick={() => this.setState({ modal: null })}><Icon name="close"/></button></header><div className="modal-content">{body}</div></section></div>}</>;
    }
    renderWorkspace() {
        const s = this.state;
        if (s.login)
            return <div className="login-page"><div className="login-card"><div className="brand-mark">d</div><h1>回到你的思考。</h1><p>连接已经部署的 Drill 服务。</p><form onSubmit={e => { e.preventDefault(); this.run(async () => { await request(s.authMode === 'cloudbase' ? '/auth/token' : '/auth/login', 'POST', s.authMode === 'cloudbase' ? { token: s.password } : { password: s.password }); await this.refresh(); }); }}><input type="password" autoFocus aria-label={s.authMode === 'cloudbase' ? 'CloudBase访问令牌' : '连接口令'} placeholder={s.authMode === 'cloudbase' ? 'CloudBase访问令牌' : '连接口令'} value={s.password} onChange={e => this.setState({ password: e.target.value })}/><button className="primary">连接 <Icon name="arrow" size={16}/></button></form>{s.toast && <p className="amber">{s.toast}</p>}</div></div>;
        if (s.loading || !s.snapshot)
            return <div className="loading-page"><div className="brand-mark">d</div><Skeleton lines={3}/><p>{s.toast || '正在加载…'}</p>{s.toast && <button onClick={() => this.run(this.init)}>重试连接</button>}</div>;
        return <><a className="drill-skip-link" href="#drill-main">跳到主要内容</a><div className={'app-shell ' + (!s.left ? 'left-collapsed ' : '') + (!s.right ? 'right-collapsed' : '')} ref={el => { this.rootRef = el; }} onDragOver={e => { if (e.dataTransfer.types.includes('Files'))
            e.preventDefault(); }} onDrop={e => { if (e.dataTransfer.files.length) {
            e.preventDefault();
            const files = [...e.dataTransfer.files];
            this.run(async () => { for (const file of files)
                await this.importFile(file); });
        } }}>{this.renderSidebar()}{this.renderMain()}{this.renderRight()}{this.renderModals()}{s.toast && <div className="toast" role="status"><span>{s.toast}</span><button aria-label="关闭提示" onClick={() => this.setState({ toast: '' })}><Icon name="close" size={13}/></button></div>}<button className="mobile-capture" aria-label="捕获" onClick={this.openCapture}><Icon name="plus" size={25}/></button></div><Sheet open={s.mobileNav} onOpenChange={mobileNav => this.setState({ mobileNav })} title="导航" description="切换工作空间页面" className="drill-nav-sheet">{this.renderSidebar(true)}</Sheet></>;
    }
    render() { return <RecapProvider theme={this.state.theme === 'dark' ? 'dark' : 'light'} density={this.state.density === 'compact' ? 'compact' : 'comfortable'} className="drill-ui"><TooltipProvider>{this.renderWorkspace()}</TooltipProvider></RecapProvider>; }
}
