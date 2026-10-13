import React from 'react';
import { Icon } from './Icon.tsx';
import { Canvas } from './Canvas.tsx';
import { request, loadSnapshot, commit, isDesktop, uploadFile } from './api.ts';
import { makeObject, captureText, uid, inWindow, keyBetween, sortedBlocks, inferForm } from '../../core/src/helpers.ts';
import type { PublicSnapshot, KnowledgeObject, Kind, Property, Change, Placement, Block } from '../../core/src/types.ts';
const statusLabel: Record<string, string> = { todo: '待做', doing: '在做', blocked: '阻塞', done: '完成' };
const labels: Record<string, string> = { kind: '类型', parent_id: '归属', tags: '标签', status: '状态', applies_to: '适用范围', series: '系列', due_at: '截止时间' };
const pageTitles: Record<string, string> = { recent: '新增', actions: '行动', memory: '个人记忆', insight: '洞察', map: '认知地图', walk: '随机漫步', timeline: '时间轴', canvases: '所有画布', settings: '偏好与连接' };
const descriptions: Record<string, string> = { recent: '先放下。想清楚了，再赋予意义。', actions: '让模糊的想法，变成无歧义的下一步。', memory: '关于自己的判断，也值得保留来路。', insight: '不是更快地得到答案，而是更深地看见问题。', map: '看见那些你反复攀登的山。', walk: '沿着关联走一会儿，偶尔去远一点的地方。', timeline: '回到当时，而不是上传的那一刻。', canvases: '已有一些想法之后，再把它们放到一起。' };
function dateLabel(t: number, full = false) { return new Intl.DateTimeFormat('zh-CN', full ? { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' } : { month: '2-digit', day: '2-digit' }).format(t); }
function download(name: string, data: any) { const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
export class App extends React.Component<any, any> {
    state: any = { snapshot: null, loading: true, view: 'recent', scope: null, window: 'today', custom: { from: '', to: '' }, selected: null, right: true, left: true, tab: 'read', mode: 'list', capture: false, captureText: '', search: false, query: '', searchResults: [], searchMode: 'lexical', searchBusy: false, kindFilter: '', toast: '', modal: null, related: { items: [], mode: 'lexical' }, insight: null, reading: false, insightScope: 'week', graphDepth: 1, versions: [], editing: false, draftTitle: '', draftBlocks: [], drafts: {}, connectors: false, login: false, password: '', breadcrumbs: [], mapData: null, walkPath: [], walkObject: null, walkJump: false, recording: false, sourceForm: { connector: 'obsidian', path: '', name: '' }, syncState: null, scrollTop: 0 };
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
    capture = async () => { const text = this.state.captureText.trim(); if (!text)
        return; const o = captureText(text, this.kinds(), this.state.snapshot.user.id); if (o.kind === 'self' && !o.applies_to.length) {
        this.toast('先捕获内容，再在提炼中填写适用范围');
        o.kind = null;
    } const options = this.kind(o.kind)?.properties.status?.options; if (options)
        o.status = options[0]; await this.create(o); this.setState({ captureText: '' }); this.toast('已放下，继续写也可以'); this.captureInput?.focus(); };
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
    navigate = (view: string, scope: string | null = null) => { if (this.state.editing && !confirm('还有未保存的编辑，离开吗？'))
        return; this.setState({ view, scope, window: ['recent', 'timeline'].includes(view) ? 'today' : 'all', mode: view === 'actions' ? 'board' : 'list', editing: false, insight: null, mapData: null, scrollTop: 0, breadcrumbs: view === 'canvas' && scope ? [scope] : [] }); };
    select = (id: string, tab = this.state.tab) => { this.setState({ selected: id, right: true, tab, editing: false }); void this.loadRelated(id); };
    loadRelated = async (id: string) => { const n = ++this.relatedRequest; try {
        const data = await request('/related/' + encodeURIComponent(id));
        if (n === this.relatedRequest)
            this.setState({ related: data });
    }
    catch {
        if (n === this.relatedRequest)
            this.setState({ related: { items: [], mode: 'offline' } });
    } };
    filtered = () => { const s = this.state; return this.objects().filter(o => !o.deleted_at && !o.ephemeral).filter(o => { if (s.view === 'actions')
        return o.kind === 'action'; if (s.view === 'memory')
        return o.kind === 'self'; if (s.view === 'canvases')
        return o.form === 'canvas'; if (s.view === 'domain')
        return o.parent_id === s.scope || o.parent_id && this.object(o.parent_id)?.parent_id === s.scope; if (s.view === 'recent')
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
        this.setState({ capture: false, search: false, modal: null });
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
    } if (['ArrowDown', 'ArrowUp'].includes(e.key) && ['recent', 'timeline', 'domain', 'memory', 'actions', 'canvases'].includes(this.state.view)) {
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
    newCanvas = async () => { const title = prompt('画布名称'); if (!title?.trim())
        return; const o = makeObject(title.trim(), this.state.snapshot.user.id, { form: 'canvas', kind: 'canvas' }); await this.create(o); this.enterCanvas(o.id); };
    setKind = async (o: KnowledgeObject, kind: string | null) => { if (kind === 'action' && !confirm('这是一条具体、无歧义、可以直接开始的下一步吗？'))
        return; if (kind === 'self' && !o.applies_to.length) {
        const options = this.kind('self')?.properties.applies_to.options ?? [];
        const scope = prompt('先填写适用范围，可选：' + options.join('、'), options[0]);
        if (!scope)
            return;
        if (!options.includes(scope)) {
            this.toast('请选择已有适用范围；新增选项需修改数据库定义。');
            return;
        }
        await commit([this.changes(o, 'applies_to', [scope]), this.changes(o, 'kind', kind)]);
        await this.refresh(false);
        return;
    } const options = this.kind(kind)?.properties.status?.options; if (options && !o.status) {
        await commit([this.changes(o, 'kind', kind), this.changes(o, 'status', options[0])]);
        await this.refresh(false);
    }
    else
        await this.save(o, 'kind', kind); };
    askAI = async (objectId?: string) => { this.setState({ reading: true, insight: null }); const scope = objectId ? { object_id: objectId } : this.state.insightScope === 'week' ? { since: Date.now() - 7 * 86400000 } : this.state.insightScope.startsWith('canvas:') ? { canvas_id: this.state.insightScope.slice(7) } : { parent_id: this.state.insightScope }; const insight = await request('/insight', 'POST', { scope }); this.setState({ insight, reading: false }); await this.refresh(false); };
    distill = async () => { const o = this.selected(); if (!o)
        return; this.setState({ reading: true }); await request('/ai/distill', 'POST', { object_id: o.id }); this.setState({ reading: false }); await this.refresh(false); this.toast('建议已列出，每一项都由你决定。'); };
    versions = async () => { const data = await request('/versions/' + this.state.selected); this.setState({ versions: data.versions, modal: 'versions' }); };
    recognize = async (first: string, second?: string) => { const other = second ?? this.state.recognizeSecond; if (!other || other === first) {
        this.setState({ modal: 'recognize', recognizeFirst: first });
        return;
    } const text = prompt('你认出了什么？用自己的话写下来。', '这和之前遇到的是同一个问题：'); if (!text?.trim())
        return; await request('/recognize', 'POST', { object_ids: [first, other], text }); await this.refresh(false); this.setState({ modal: null }); this.toast('这次认出来的关联，已经留下。'); };
    startEdit = () => { const o = this.selected(); if (!o)
        return; let blocks = structuredClone(sortedBlocks(o.body_blocks.blocks)); if (!blocks.length && o.body)
        blocks = [{ id: uid(), key: keyBetween(null, null), text: o.body }]; this.setState({ editing: true, draftTitle: o.title, draftBlocks: blocks }); };
    saveEdit = async () => { const o = this.selected()!; const before = sortedBlocks(o.body_blocks.blocks); const after: Block[] = this.state.draftBlocks; const delta = [...after.filter(b => { const old = before.find(x => x.id === b.id); return !old || old.text !== b.text || old.key !== b.key; }), ...before.filter(b => !after.some(x => x.id === b.id)).map(b => ({ ...b, deleted_at: Date.now() }))]; const changes: Change[] = []; if (o.title !== this.state.draftTitle)
        changes.push(this.changes(o, 'title', this.state.draftTitle)); if (delta.length)
        changes.push(this.changes(o, 'body_blocks', { blocks: delta })); await commit(changes); this.setState({ editing: false }); await this.refresh(false); };
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
    renderSidebar() {
        const s = this.state, snap: PublicSnapshot = s.snapshot;
        const nav = (id: string, icon: string, label: string) => <button key={id} title={!s.left ? label : undefined} className={'nav-item ' + (s.view === id ? 'selected' : '')} onClick={() => this.navigate(id)}><Icon name={icon}/><span>{label}</span></button>;
        const canvases = this.objects().filter(o => o.form === 'canvas' && !o.deleted_at).sort((a, b) => b.updated_at - a.updated_at).slice(0, 5);
        const unseen = snap.sources.reduce((n, x) => n + (x.state.unseen ?? 0), 0);
        return <aside className={'sidebar ' + (!s.left ? 'collapsed' : '')}><div className="brand"><div className="brand-mark">d</div>{s.left && <span>drill<span className="brand-note">深一层</span></span>}<button className="sidebar-toggle" title="折叠导航" onClick={() => this.setState({ left: !s.left })}><Icon name="sidebar" size={16}/></button></div><div className="nav-scroll"><div className="nav-group">{nav('recent', 'recent', '新增')}{nav('actions', 'action', '行动')}{nav('memory', 'memory', '个人记忆')}</div><div className="nav-group"><div className="nav-heading">领域</div>{this.objects().filter(o => o.kind === 'domain' && !o.deleted_at).map(o => <div key={o.id}><button className={'nav-item ' + (s.scope === o.id ? 'selected' : '')} title={o.title} onClick={() => this.navigate('domain', o.id)}><Icon name="folder"/><span>{o.title}</span></button>{s.scope === o.id && this.objects().filter(p => p.parent_id === o.id && p.kind === 'project' && !p.deleted_at).map(p => <button key={p.id} className="nav-item subitem" onClick={() => this.navigate('domain', p.id)}><Icon name="chevron" size={14}/><span>{p.title}</span></button>)}</div>)}{s.left && <button className="quiet-add" onClick={() => this.run(async () => { const title = prompt('新增领域名称'); if (title?.trim())
            await this.create(makeObject(title.trim(), snap.user.id, { kind: 'domain' })); })}><Icon name="plus" size={12}/> 添加领域</button>}</div><div className="nav-group"><div className="nav-heading">画布<button title="创建画布" onClick={() => this.run(this.newCanvas)}><Icon name="plus" size={12}/></button></div>{canvases.map(o => <button key={o.id} className={'nav-item ' + (s.scope === o.id ? 'selected' : '')} title={o.title} onClick={() => this.enterCanvas(o.id)}><Icon name="canvas"/><span>{o.title}</span></button>)}{s.left && <button className="quiet-add" onClick={() => this.navigate('canvases')}>全部画布 <Icon name="arrow" size={12}/></button>}</div><div className="nav-group"><div className="nav-heading">重新遇见</div>{nav('insight', 'spark', '洞察')}{nav('map', 'map', '认知地图')}{nav('walk', 'walk', '随机漫步')}{nav('timeline', 'clock', '时间轴')}</div><div className="nav-group connectors"><button className="nav-item" onClick={() => { this.setState({ connectors: !s.connectors }); if (!s.connectors)
            this.run(async () => { await request('/sources/seen', 'POST', {}); await this.refresh(false); }); }}><Icon name={s.connectors ? 'down' : 'chevron'} size={15}/><span>连接器</span>{unseen > 0 && s.left && <small>{unseen}</small>}</button>{s.connectors && s.left && <div>{snap.sources.map(src => <button className="connector-row" key={src.id} onClick={() => this.navigate('settings')}><span>{src.name}</span><small>{src.state.error ? '连接异常' : src.last_synced ? dateLabel(src.last_synced) : '尚未拉取'}</small></button>)}<button className="quiet-add" onClick={() => this.navigate('settings')}>管理连接器 <Icon name="arrow" size={12}/></button></div>}</div></div><footer className="sidebar-footer"><button onClick={() => this.navigate('settings')} title="偏好与连接"><Icon name="settings"/>{s.left && <span>偏好与连接</span>}</button><button className="sync-status" onClick={() => this.navigate('settings')} title="同步状态"><span className={'status-dot ' + (!navigator.onLine ? 'offline' : '')}/>{s.left && <span>{isDesktop() ? (s.syncState?.pending ? `本地已存 · ${s.syncState.pending} 条待同步` : s.syncState?.error ? '本地可用 · 同步待恢复' : '本地优先') : snap.capabilities.demo ? '本机示例 · 非正式数据' : navigator.onLine ? '在线连接' : '连接中断'}</span>}</button></footer></aside>;
    }
    renderTop() { const s = this.state; const hasTime = ['recent', 'timeline', 'canvas'].includes(s.view); return <header className="topbar"><div className="time-tabs">{hasTime ? [['today', '今天'], ['week', '本周'], ['month', '本月'], ['all', '全部'], ['custom', '自定义']].map(([value, label]) => <button key={value} className={s.window === value ? 'active' : ''} onClick={() => this.setState({ window: value })}>{label}</button>) : <span className="top-crumb">{s.scope ? this.object(s.scope)?.title : pageTitles[s.view]}</span>}</div><div className="top-actions"><button title="全局搜索 ⌘K" onClick={this.openSearch}><Icon name="search" size={17}/><kbd>⌘ K</kbd></button><button title="投入一份东西 ⌘⇧Space" aria-label="快速捕获" onClick={this.openCapture}><Icon name="plus" size={20}/></button><button title="切换上下文栏" onClick={() => this.setState({ right: !s.right })}><Icon name="panel" size={17}/></button></div></header>; }
    renderList() {
        const list = this.filtered(), s = this.state;
        const board = s.view === 'actions' && s.mode === 'board';
        const kind = this.kind('action'), column = kind?.properties.status;
        if (board && column?.type === 'label')
            return <div className="board">{(column.options ?? []).map(value => <section key={value} className="board-column" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); const o = this.object(e.dataTransfer.getData('drill/object')); if (o)
                this.run(() => this.save(o, 'status', value)); }}><h3>{statusLabel[value] ?? value}<small>{list.filter(o => (o.status ?? column.options?.[0]) === value).length}</small></h3>{list.filter(o => (o.status ?? column.options?.[0]) === value).map(o => <button key={o.id} draggable onDragStart={e => e.dataTransfer.setData('drill/object', o.id)} className={'board-card ' + (s.selected === o.id ? 'selected' : '')} onClick={() => this.select(o.id)}><span className="kind-dot" style={{ background: this.kind(o.kind)?.color }}/><strong>{o.title}</strong>{o.parent_id && <small>{this.object(o.parent_id)?.title}</small>}</button>)}</section>)}</div>;
        if (!list.length)
            return <div className="empty-state"><Icon name={s.view === 'recent' ? 'recent' : 'folder'} size={28}/><p>{s.view === 'recent' ? '这段时间还没有新东西。' : '这里还没有内容。'}</p><button className="text-button" onClick={this.openCapture}>从一个想法开始 <Icon name="arrow" size={14}/></button></div>;
        if (s.view === 'canvases')
            return <div className="canvas-grid">{list.map(o => <button key={o.id} className="canvas-tile" onClick={() => this.enterCanvas(o.id)}><div className="mini-canvas"><div /><div /><div /></div><h3>{o.title}</h3><p>{o.body || '一张安静的画布'}</p></button>)}</div>;
        const start = Math.max(0, Math.floor(s.scrollTop / 48) - 8), end = Math.min(list.length, start + 36);
        const visible = list.length > 100 ? list.slice(start, end) : list;
        return <div className="object-list" role="listbox" aria-label="对象列表" onScroll={e => this.setState({ scrollTop: e.currentTarget.scrollTop })}>{list.length > 100 && <div style={{ height: start * 48 }}/>}{visible.map(o => { const k = this.kind(o.kind), old = o.kind === 'self' && o.valid_until; return <button key={o.id} role="option" aria-selected={s.selected === o.id} className={'object-row ' + (s.selected === o.id ? 'selected ' : '') + (o.kind === 'ai_output' ? 'ai-object ' : '') + (old ? 'invalidated' : '')} draggable onDragStart={e => e.dataTransfer.setData('drill/object', o.id)} onClick={() => this.select(o.id)} onDoubleClick={() => o.form === 'canvas' ? this.enterCanvas(o.id) : this.setState({ modal: 'preview' })}><span className="kind-dot" style={{ background: k?.color ?? '#bbb6ae' }} title={k?.label ?? '未提炼'}/><span className="object-row-title">{o.title || '无题'}{old && <small>已推翻</small>}</span>{o.source_id && <span className="row-source" title="外部冻结快照">↗</span>}<span className="object-tag">{o.tags_cached[0] ? '#' + o.tags_cached[0] : s.view === 'memory' ? o.applies_to.join(' · ') : ''}</span><time>{dateLabel(o.captured_at)}</time><span className="row-chevron">›</span></button>; })}{list.length > 100 && <div style={{ height: (list.length - end) * 48 }}/>}</div>;
    }
    renderDiscovery() {
        const s = this.state;
        const ai = s.snapshot.capabilities.ai, semantic = s.snapshot.capabilities.semantic;
        if (s.view === 'insight')
            return <div className="discovery-body"><div className="insight-intro"><Icon name="spark" size={32}/><h2>让问题，再深一层。</h2><p>只读你已有的内容，找出重复、张力与盲点。<br />证据不够的时候，允许什么都不说。</p><div className="insight-controls"><select aria-label="洞察范围" value={s.insightScope} onChange={e => this.setState({ insightScope: e.target.value })}><option value="week">最近 7 天</option>{this.objects().filter(o => o.kind === 'domain').map(o => <option key={o.id} value={o.id}>{o.title}</option>)}{this.objects().filter(o => o.form === 'canvas').map(o => <option key={o.id} value={'canvas:' + o.id}>画布 · {o.title}</option>)}</select><button className="primary" disabled={s.reading || !ai} onClick={() => this.run(() => this.askAI())}>{s.reading ? '在读…' : '开始这次思考'}<Icon name="arrow" size={16}/></button></div>{!ai && <p className="service-notice">AI 尚未连接。配置服务端后可用，不提供模拟洞察。</p>}</div>{this.renderInsightResult()}</div>;
        if (s.view === 'map')
            return <div className="discovery-body"><div className="map-frame">{s.mapData?.clusters?.length ? <svg viewBox="0 0 760 470" className="cognitive-map" role="img" aria-label="基于向量聚类的主题地图">{s.mapData.clusters.map((c: any, i: number) => <g key={c.id} onClick={() => { this.select(c.representative); this.setState({ mapCluster: c }); }} className="terrain-cluster">{[1, 1.35, 1.7, 2.05, 2.4].map((r: number, n: number) => <ellipse key={n} cx={c.x * 7.4} cy={c.y * 5} rx={(28 + c.objects.length * 2) * r} ry={(18 + c.objects.length) * r} transform={`rotate(${i * 17 - 12} ${c.x * 7.4} ${c.y * 5})`} fill={n === 0 ? '#ece8de' : 'none'} stroke="#d3ccbc" strokeWidth="1"/>)}<text x={c.x * 7.4} y={c.y * 5 - 10} textAnchor="middle">{c.label}</text><text x={c.x * 7.4} y={c.y * 5 + 12} textAnchor="middle" className="map-count">{c.objects.length} 条内容</text></g>)}</svg> : <div className="empty-state"><Icon name="map" size={36}/><h3>主题来自内容，不是连线。</h3><p>{semantic ? '索引就绪后，主动生成这次主题分布。' : '连接 bge-m3 并建立索引后，才能看见你的主题分布。'}</p><button className="primary" disabled={!semantic} onClick={() => this.run(async () => { const data = await request('/map'); this.setState({ mapData: data }); })}>生成认知地图</button></div>}</div>{s.mapData && <p className="metadata">实验性聚类 · 手动刷新 · 不自动命名或替你下结论</p>}{s.mapCluster && <div className="cluster-objects"><h3>{s.mapCluster.label}</h3>{s.mapCluster.objects.map((id: string) => <button key={id} onClick={() => this.select(id)}>{this.object(id)?.title}<Icon name="arrow" size={14}/></button>)}<button className="text-button" onClick={() => this.run(() => this.recognize(s.mapCluster.representative))}>我认出了一个重复的问题</button></div>}</div>;
        return <div className="discovery-body"><div className="walk-intro"><Icon name="walk" size={30}/>{!s.walkObject ? <div><h2>不用知道要去哪里。</h2><p>大多数时候沿着关联前行，偶尔做一次弱相关的跨越。<br />不指定起点，不保留这条路径。</p></div> : <div className="walk-card"><span className="eyebrow">{s.walkJump ? '一次弱相关的跨越' : '沿着关联，来到这里'}</span><h2>{s.walkObject.title}</h2><p>{s.walkObject.body}</p><button className="text-button" onClick={() => this.select(s.walkObject.id)}>打开这条内容 <Icon name="arrow" size={14}/></button><button className="text-button" onClick={() => this.run(() => this.recognize(s.walkObject.id))}>我认出了同一个问题</button><button className="text-button" onClick={() => this.run(async () => { await request('/settings', 'POST', { hide_object: s.walkObject.id }); await this.refresh(false); this.setState({ walkObject: null }); })}>别再给我看这条</button></div>}<button className="primary" disabled={!semantic} onClick={() => this.run(async () => { const data = await request('/walk', 'POST', { previous_id: s.walkObject?.id, exclude_ids: s.walkPath }); if (!data.object) {
            this.toast('这次路径走到这里，休息一下。');
            return;
        } this.setState({ walkObject: data.object, walkJump: data.jump, walkPath: [...s.walkPath, data.object.id] }); })}>{s.walkObject ? '继续走一段' : '开始漫步'}<Icon name="arrow" size={16}/></button>{!semantic && <p className="service-notice">需要向量索引，不用随机抽签冒充语义漫步。</p>}</div></div>;
    }
    renderInsightResult() { const s = this.state; if (s.reading)
        return <div className="insight-result quiet-reading">在读。也在寻找值得问你的问题。</div>; if (!s.insight)
        return null; if (s.insight.silent)
        return <div className="insight-result"><p className="metadata">暂时没什么可说的。</p></div>; return <article className="insight-result ai-object"><span className="eyebrow">AI生成 · 不替代你的判断</span><p>{s.insight.text}</p><div className="citations">{s.insight.citations.map((id: string, i: number) => <button key={id} onClick={() => this.select(id)}>{i + 1}. {this.object(id)?.title}</button>)}</div>{s.insight.citations.length > 1 && <button className="text-button" onClick={() => this.run(() => this.recognize(s.insight.citations[0], s.insight.citations[1]))}>我认出了同一个问题 <Icon name="arrow" size={14}/></button>}</article>; }
    renderMain() { const s = this.state; const canvas = s.view === 'canvas' ? this.object(s.scope) : null; return <main className="main-pane">{this.renderTop()}{s.window === 'custom' && ['recent', 'timeline', 'canvas'].includes(s.view) && <div className="custom-range"><input aria-label="起始日期" type="date" value={s.custom.from} onChange={e => this.setState({ custom: { ...s.custom, from: e.target.value } })}/><span>至</span><input aria-label="结束日期" type="date" value={s.custom.to} onChange={e => this.setState({ custom: { ...s.custom, to: e.target.value } })}/></div>}{canvas ? <div className="canvas-page"><div className="canvas-breadcrumb"><Icon name="canvas" size={17}/>{s.breadcrumbs.map((id: string, i: number) => <div key={i}><button onClick={() => this.setState({ scope: id, breadcrumbs: s.breadcrumbs.slice(0, i + 1) })}>{this.object(id)?.title}</button>{i < s.breadcrumbs.length - 1 && <Icon name="chevron" size={13}/>}</div>)}<span className="metadata">自由摆放</span></div><Canvas key={canvas.id} canvas={canvas} objects={this.objects()} placements={s.snapshot.placements} relations={s.snapshot.relations} kinds={this.kinds()} selected={s.selected} window={s.window} custom={s.custom} timezone={s.snapshot.user.timezone} globalDisplay={s.snapshot.user.settings.canvas_display ?? 'collapse_body'} onSelect={id => this.select(id)} onEnter={this.enterCanvas} onPlacement={this.placement} onConnect={this.connect} onNew={this.newCanvasObject} onError={this.fail} onRemove={id => this.run(async () => { const p = s.snapshot.placements.find((p: Placement) => p.canvas_id === canvas.id && p.object_id === id); if (p)
        await this.placement({ ...p, deleted_at: Date.now() }); })}/></div> : s.view === 'settings' ? this.renderSettings() : <div className={'main-content ' + (['insight', 'map', 'walk'].includes(s.view) ? 'discovery-page' : '')}><section className="page-heading"><span className="eyebrow">{s.view === 'recent' ? dateLabel(Date.now(), true).split(' ')[0] : s.scope ? '领域里的思考' : 'YOUR QUIET SPACE'}</span><h1>{s.scope ? this.object(s.scope)?.title : pageTitles[s.view]}</h1><p>{descriptions[s.view] ?? '让资料、想法和判断，在同一个地方相遇。'}</p></section>{['insight', 'map', 'walk'].includes(s.view) ? this.renderDiscovery() : <div className="list-content">{s.view === 'recent' && <button className="inline-capture" onClick={this.openCapture}><span>此刻，想到什么？</span><span className="input-shortcut"><kbd>⌘ ⇧ Space</kbd><Icon name="plus" size={17}/></span></button>}<div className="content-bar"><div className="display-switch"><button className={s.mode === 'list' ? 'active' : ''} onClick={() => this.setState({ mode: 'list' })}><Icon name="list" size={15}/> 列表</button>{s.view === 'actions' && this.kind('action')?.properties.status?.type === 'label' && <button className={s.mode === 'board' ? 'active' : ''} onClick={() => this.setState({ mode: 'board' })}><Icon name="board" size={15}/> 看板</button>}</div>{!['actions', 'memory', 'canvases'].includes(s.view) && <select aria-label="按类型筛选" className="minimal-select" value={s.kindFilter} onChange={e => this.setState({ kindFilter: e.target.value })}><option value="">所有类型</option>{this.kinds().map(k => <option key={k.id} value={k.id}>{k.label}</option>)}</select>}<span className="metadata">{s.view === 'memory' ? '手动确认 · 保留变化' : '按捕获时间'}</span></div>{this.renderList()}<div className="list-footnote">{s.view === 'recent' ? '不用清空，也没有必须处理的数量。' : s.view === 'memory' ? '改错字是编辑，改主意是推翻。' : '每一条内容，只保存一份。'}</div></div>}</div>}</main>; }
    renderProperty(o: KnowledgeObject, name: string, p: Property) {
        const value = (o as any)[name] ?? o.extra[name] ?? '';
        const update = (v: any) => this.run(() => this.save(o, name in o ? name : 'extra', name in o ? v : { ...o.extra, [name]: v }));
        let control: React.ReactNode;
        if (p.type === 'label' && p.multiple) {
            const values = Array.isArray(value) ? value : [];
            control = <div className="multi-labels">{(p.options ?? []).map(v => <label key={v}><input type="checkbox" checked={values.includes(v)} onChange={e => update(e.target.checked ? [...values, v] : values.filter((x: string) => x !== v))}/>{statusLabel[v] ?? v}</label>)}</div>;
        }
        else if (p.type === 'label')
            control = <select value={value} onChange={e => update(e.target.value || null)}><option value="">—</option>{(p.options ?? []).map(v => <option key={v} value={v}>{statusLabel[v] ?? v}</option>)}</select>;
        else if (p.type === 'object')
            control = <select value={value} onChange={e => update(e.target.value || null)}><option value="">—</option>{this.objects().filter(x => !x.deleted_at && (!p.kinds?.length || p.kinds.includes(x.kind ?? ''))).map(x => <option key={x.id} value={x.id}>{x.title}</option>)}</select>;
        else if (p.type === 'checkbox')
            control = <input type="checkbox" checked={!!value} onChange={e => update(e.target.checked)}/>;
        else
            control = <input key={o.id + '-' + name + '-' + String(value)} defaultValue={p.type === 'datetime' && value ? new Date(Number(value) - new Date(Number(value)).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : value} type={p.type === 'datetime' ? 'datetime-local' : p.type === 'number' ? 'number' : 'text'} onBlur={e => { const v = p.type === 'datetime' ? (e.target.value ? new Date(e.target.value).getTime() : null) : p.type === 'number' ? (e.target.value ? Number(e.target.value) : null) : e.target.value; if (v !== value)
                update(v); }}/>;
        return <div className="property-row" key={name}><Icon name={p.type === 'datetime' ? 'clock' : 'tag'} size={14}/><label>{p.label ?? labels[name] ?? name}</label><div>{control}</div></div>;
    }
    renderProperties(o: KnowledgeObject) { const k = this.kind(o.kind); return <div className="properties"><div className="property-row"><span style={{ color: k?.color }}>{k?.icon ?? '◌'}</span><label>类型</label><select aria-label="对象类型" value={o.kind ?? ''} disabled={o.form === 'canvas'} onChange={e => this.run(() => this.setKind(o, e.target.value || null))}><option value="">未提炼</option>{this.kinds().filter(k => o.form === 'canvas' || k.id !== 'canvas').map(k => <option key={k.id} value={k.id}>{k.label}</option>)}</select></div><div className="property-row"><Icon name="folder" size={14}/><label>归属</label><select aria-label="对象归属" value={o.parent_id ?? ''} onChange={e => this.run(() => this.save(o, 'parent_id', e.target.value || null))}><option value="">无归属</option>{this.objects().filter(p => p.id !== o.id && !p.deleted_at && ['domain', 'project'].includes(p.kind ?? '')).map(p => <option key={p.id} value={p.id}>{p.title}</option>)}</select></div><div className="property-row"><Icon name="tag" size={14}/><label>标签</label><div className="tag-values">{o.tags_cached.map(tag => <button key={tag} title="移除此标签" onClick={() => this.run(() => this.save(o, 'tag', { tag, deleted_at: Date.now() }, false))}>#{tag}<span>×</span></button>)}<button aria-label="添加标签" onClick={() => this.run(async () => { const tag = prompt('添加一个跨类型标签'); if (tag?.trim())
        await this.save(o, 'tag', { tag: tag.trim().replace(/^#/, '') }, false); })}><Icon name="plus" size={12}/></button></div></div><div className="property-row"><Icon name="list" size={14}/><label>系列</label><input key={o.id + '-series'} aria-label="系列" placeholder="—" defaultValue={o.series ?? ''} onBlur={e => { if ((e.target.value || null) !== o.series)
        this.run(() => this.save(o, 'series', e.target.value || null)); }}/></div>{Object.entries(k?.properties ?? {}).map(([name, p]) => this.renderProperty(o, name, p))}{o.ephemeral && <div className="ephemeral-note">这条只活在当前画布上。<button onClick={() => this.run(() => this.save(o, 'ephemeral', false))}>转为正式对象</button></div>}</div>; }
    renderMedia(o: KnowledgeObject) { if (!o.asset_id)
        return null; const url = this.state.assetUrls?.[o.asset_id]; if (!url)
        return <button className="media-placeholder" onClick={() => this.run(async () => { const data = isDesktop() ? await request('/assets/' + o.asset_id + '/url') : await request('/assets/' + o.asset_id + '/url'); this.setState({ assetUrls: { ...this.state.assetUrls, [o.asset_id!]: data.url } }); })}>查看{o.form === 'image' ? '图片' : o.form === 'audio' ? '音频' : '视频'} <Icon name="eye" size={16}/></button>; return o.form === 'image' ? <img className="object-image" src={url} alt={o.title}/> : o.form === 'audio' ? <audio controls src={url}/> : <video controls src={url}/>; }
    renderObjectBody(o: KnowledgeObject, full = false) { const s = this.state; const frozen = !!o.source_id || o.kind === 'artifact'; return <div className="object-body"><div className="section-heading"><span>附文</span>{isDesktop() && !frozen && !full && <button onClick={this.startEdit}>编辑 <kbd>↵</kbd></button>}</div>{this.renderMedia(o)}{o.form === 'link' && /^https?:\/\//.test(o.title) && <a className="external-link" href={o.title} target="_blank" rel="noreferrer">打开原链接 <Icon name="external" size={14}/></a>}{(o.body_blocks.blocks.length ? sortedBlocks(o.body_blocks.blocks).map(b => <p key={b.id} id={'block-' + b.id} className="body-paragraph">{this.renderMarkup(b.text, !!o.source_id)}</p>) : o.body ? <p className="body-paragraph">{this.renderMarkup(o.body, !!o.source_id)}</p> : <p className="empty-body">暂时没有附文。主体本身也可以是一份完整的想法。</p>)}{!isDesktop() && !full && <p className="web-read-note">Web 端只读附文 · 完整编辑在桌面端</p>}{frozen && <p className="web-read-note">{o.source_id ? '来自外部的冻结快照，原文不会被自动覆盖。' : '产物内容不可变；需要修改时另建一条。'}</p>}</div>; }
    renderEditor(o: KnowledgeObject) { const s = this.state; return <div className="block-editor"><input className="edit-title" value={s.draftTitle} aria-label="主体" onChange={e => this.setState({ draftTitle: e.target.value })}/>{s.draftBlocks.map((b: Block, index: number) => <div className="block-edit" key={b.id}><textarea value={b.text} aria-label={`第${index + 1}段`} onChange={e => { const value = e.target.value; this.setState({ draftBlocks: s.draftBlocks.map((x: Block) => x.id === b.id ? { ...x, text: value } : x) }); }}/><div><button title="在此段后插入" onClick={() => { const blocks = [...s.draftBlocks]; blocks.splice(index + 1, 0, { id: uid(), key: keyBetween(b.key, blocks[index + 1]?.key ?? null), text: '' }); this.setState({ draftBlocks: blocks }); }}><Icon name="plus" size={12}/></button><button title="删除此段" onClick={() => this.setState({ draftBlocks: s.draftBlocks.filter((x: Block) => x.id !== b.id) })}><Icon name="trash" size={12}/></button></div></div>)}{!s.draftBlocks.length && <button className="text-button" onClick={() => this.setState({ draftBlocks: [{ id: uid(), key: keyBetween(null, null), text: '' }] })}>加一段自己的话</button>}<div className="button-row"><button className="primary" onClick={() => this.run(this.saveEdit)}>保存</button><button onClick={() => this.setState({ editing: false })}>取消</button></div><p className="metadata">每段保留独立ID。并发编辑同一段时，覆盖记录可在版本中找回。</p></div>; }
    renderProposals(o: KnowledgeObject) { const s = this.state, proposals = s.snapshot.proposals.filter((p: any) => p.object_id === o.id && p.status === 'pending'); const history = s.snapshot.proposals.filter((p: any) => p.object_id === o.id && p.status !== 'pending'); return <div className="proposal-area"><div className="section-heading"><span>你的判断，在前面。</span><button disabled={!s.snapshot.capabilities.ai || s.reading} onClick={() => this.run(this.distill)}><Icon name="spark" size={14}/>{s.reading ? '在读…' : '请 AI 提议'}</button></div>{!s.snapshot.capabilities.ai && <p className="service-notice">AI尚未连接，仍可以手动提炼。</p>}{proposals.map((p: any) => <div className="proposal" key={p.id}><span className="eyebrow">AI 建议 · {labels[p.field] ?? p.field}</span><strong>{p.field === 'kind' ? this.kind(p.ai_value)?.label : p.field === 'parent_id' ? this.object(p.ai_value)?.title : Array.isArray(p.ai_value) ? p.ai_value.join(' · ') : statusLabel[p.ai_value] ?? String(p.ai_value)}</strong><div className="button-row"><button className="primary" onClick={() => this.run(async () => { await request('/proposals/decide', 'POST', { id: p.id, status: 'accepted' }); await this.refresh(false); })}>采纳</button><button onClick={() => this.run(async () => { const text = prompt('改成什么？类型/归属使用ID，多值用逗号分开。', Array.isArray(p.ai_value) ? p.ai_value.join(',') : String(p.ai_value)); if (text === null)
        return; const value = Array.isArray(p.ai_value) ? text.split(',').map(x => x.trim()).filter(Boolean) : text; await request('/proposals/decide', 'POST', { id: p.id, status: 'edited', value }); await this.refresh(false); })}>改一下</button><button onClick={() => this.run(async () => { await request('/proposals/decide', 'POST', { id: p.id, status: 'rejected' }); await this.refresh(false); })}>跳过</button></div></div>)}{history.length > 0 && <details className="proposal-history"><summary>查看我的判断记录</summary>{history.map((p: any) => <div key={p.id}><span>{labels[p.field] ?? p.field} · {p.status === 'accepted' ? '采纳' : p.status === 'edited' ? '改写' : '跳过'}</span><p>建议：{JSON.stringify(p.ai_value)}<br />决定：{JSON.stringify(p.final_value)}</p></div>)}</details>}<p className="metadata">建议与决定分别留痕。这里不计算虚假的“思考占比”。</p></div>; }
    renderRelations(o: KnowledgeObject) { const s = this.state; const active = s.snapshot.relations.filter((r: any) => !r.deleted_at); const out = active.filter((r: any) => r.from_id === o.id), incoming = active.filter((r: any) => r.to_id === o.id); const edge = (r: any, direction: string) => { const id = direction === 'out' ? r.to_id : r.from_id; return <button key={[r.from_id, r.to_id, r.source_field, r.source_block_id].join('-')} className="context-item" draggable onDragStart={e => e.dataTransfer.setData('drill/object', id)} onClick={() => this.select(id)}><span>{this.object(id)?.title ?? '对象已不可见'}</span>{r.source_block_id && <small onClick={e => { e.stopPropagation(); this.select(r.from_id, 'read'); setTimeout(() => document.getElementById('block-' + r.source_block_id)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100); }}>回到原段落 ↗</small>}<Icon name="arrow" size={14}/></button>; }; return <div><section className="context-section"><div className="section-heading"><span>相关</span><small>{s.related.mode === 'semantic' ? '向量相似' : s.related.mode === 'offline' ? '联网后可用' : '字面相近'}</small></div>{s.related.items.length ? s.related.items.map((x: any) => <button key={x.object.id} className="context-item" draggable onDragStart={e => e.dataTransfer.setData('drill/object', x.object.id)} onClick={() => this.select(x.object.id)}><span>{x.object.title}</span><small>{dateLabel(x.object.captured_at)}</small><Icon name="arrow" size={13}/></button>) : <p className="context-empty">还没有足够相似的内容。</p>}</section><section className="context-section"><div className="section-heading"><span>局部图</span><button onClick={() => this.setState({ graphDepth: s.graphDepth === 1 ? 2 : 1 })}>{s.graphDepth === 1 ? '展开两跳' : '收回一跳'}</button></div>{!out.length && !incoming.length ? <p className="context-empty">这条还没有关联。</p> : <div className="local-graph"><div className="graph-direction"><Icon name="arrow" size={14}/> 它引用了谁</div>{out.map((r: any) => edge(r, 'out'))}<div className="graph-direction incoming"><Icon name="back" size={14}/> 谁引用了它</div>{incoming.map((r: any) => edge(r, 'in'))}{s.graphDepth === 2 && <div className="second-hop"><span className="metadata">再往外一跳</span>{active.filter((r: any) => r.from_id !== o.id && r.to_id !== o.id && [...out.map((x: any) => x.to_id), ...incoming.map((x: any) => x.from_id)].includes(r.from_id)).slice(0, 20).map((r: any) => edge(r, 'out'))}</div>}</div>}<button className="text-button" onClick={() => this.setState({ modal: 'link' })}><Icon name="plus" size={13}/> 手动挂一个引用</button></section><section className="context-section"><div className="section-heading"><span>洞察</span><button disabled={!s.snapshot.capabilities.ai || s.reading} onClick={() => this.run(() => this.askAI(o.id))}><Icon name="spark" size={14}/> 点一下</button></div>{!s.snapshot.capabilities.ai ? <p className="context-empty">连接 AI 后，主动开启一次思考。</p> : this.renderInsightResult()}</section><button className="text-button" onClick={() => this.run(() => this.recognize(o.id))}>我认出了一个重复的问题 <Icon name="arrow" size={13}/></button></div>; }
    renderRight() { const s = this.state, o = this.selected(); if (!s.right)
        return null; return <aside className="right-pane"><header className="right-header"><span>上下文</span><button title="折叠上下文栏" onClick={() => this.setState({ right: false })}><Icon name="panel" size={16}/></button></header>{!o ? <div className="right-empty"><Icon name="select" size={24}/><p>选一条，慢慢想。</p><span>提炼、相关与洞察，<br />都从一份具体的内容开始。</span></div> : <div className="right-scroll"><div className="object-identity"><span className="object-kind" style={{ color: this.kind(o.kind)?.color }}>{this.kind(o.kind)?.icon ?? '◌'} <span>{this.kind(o.kind)?.label ?? '未提炼'}</span></span><button title="对象菜单" onClick={() => this.setState({ modal: 'object-actions' })}><Icon name="more" size={18}/></button></div><h2 className="object-title">{o.title}</h2><div className="object-time"><Icon name="clock" size={12}/><span>{dateLabel(o.captured_at, true)}</span></div><nav className="context-tabs">{[['read', '内容'], ['distill', '提炼'], ['relations', '关联']].map(([tab, label]) => <button key={tab} className={s.tab === tab ? 'active' : ''} onClick={() => this.setState({ tab })}>{label}</button>)}</nav>{s.snapshot.conflicts.some((c: any) => c.object_id === o.id && c.resolution === 'lost') && <button className="conflict-alert" onClick={() => this.setState({ modal: 'conflicts' })}>有一次修改被覆盖了，点开看 ↗</button>}{s.editing ? this.renderEditor(o) : s.tab === 'relations' ? this.renderRelations(o) : <div>{this.renderProperties(o)}{s.tab === 'distill' ? this.renderProposals(o) : this.renderObjectBody(o)}{o.kind === 'self' && <div className="self-actions"><p>{o.valid_until ? '这条判断已失效，来路仍然保留。' : o.confirmed_at ? '上次确认：' + dateLabel(o.confirmed_at) : '这条判断，今天还成立吗？'}</p>{!o.valid_until && <div className="button-row"><button onClick={() => this.run(() => this.save(o, 'confirmed_at', Date.now()))}>我还这么想</button><button onClick={() => this.run(async () => { const title = prompt('现在，你的看法是什么？'); if (!title?.trim())
        return; const next = makeObject(title.trim(), s.snapshot.user.id, { kind: 'self', parent_id: o.parent_id, applies_to: o.applies_to, supersedes_id: o.id }); await this.create(next); this.select(next.id); })}>我改主意了</button></div>}</div>}</div>}<footer className="object-meta"><button onClick={() => this.run(this.versions)}>版本 · 改过 {Math.max(0, o.rev - 1)} 次 <Icon name="chevron" size={12}/></button><span>来源 · {o.source_id ? s.snapshot.sources.find((x: any) => x.id === o.source_id)?.name ?? '外部快照' : o.kind === 'ai_output' ? 'AI生成' : '自己写'}</span>{o.source_id && Object.entries(s.snapshot.sources.find((x: any) => x.id === o.source_id)?.properties ?? {}).map(([key, p]: [
        string,
        any
    ]) => <span key={key}>{p.label ?? key} · {String(o.extra[key] ?? '—')}</span>)}</footer>{s.tab === 'read' && <div className="quiet-related"><div className="section-heading"><span>继续想一层</span><button onClick={() => this.setState({ tab: 'relations' })}>相关与洞察 <Icon name="arrow" size={13}/></button></div>{s.related.items.slice(0, 2).map((x: any) => <button key={x.object.id} onClick={() => this.select(x.object.id)}>{x.object.title}<Icon name="arrow" size={12}/></button>)}</div>}</div>}</aside>; }
    renderSettings() { const s = this.state, snap = s.snapshot; return <div className="settings-page"><h1>偏好与连接</h1><section><h3>这份空间</h3><div className="settings-row"><label>本地时区</label><select value={snap.user.timezone} onChange={e => this.run(async () => { await request('/settings', 'POST', { timezone: e.target.value }); await this.refresh(false); })}>{['Asia/Shanghai', 'Asia/Hong_Kong', 'Asia/Tokyo', 'Europe/London', 'America/New_York', 'America/Los_Angeles', 'UTC'].map(v => <option key={v}>{v}</option>)}</select></div><div className="settings-row"><label>画布默认显示</label><select value={snap.user.settings.canvas_display ?? 'collapse_body'} onChange={e => this.run(async () => { await request('/settings', 'POST', { canvas_display: e.target.value }); await this.refresh(false); })}><option value="title_only">只显示主体</option><option value="collapse_body">折叠附文</option><option value="full">全部显示</option></select></div><button className="secondary" onClick={() => this.run(async () => download('drill-export-' + new Date().toISOString().slice(0, 10) + '.json', await request('/export')))}><Icon name="download" size={15}/> 导出我的数据</button><p className="metadata">导出包含对象、关系、布局与版本。媒体原件仍在原存储中，请另外备份。</p></section><section><h3>服务状态</h3><div className="settings-row"><label>当前运行方式</label><span>{isDesktop() ? 'Electron · SQLite 本地库' : snap.capabilities.demo ? '本机示例 · JSON存储（非正式后端）' : 'Web · 纯在线'}</span></div><div className="settings-row"><label>AI 提议与洞察</label><span>{snap.capabilities.ai ? '已配置' : '未连接'}</span></div><div className="settings-row"><label>bge-m3 向量</label><span>{snap.capabilities.semantic ? '已配置' : '未连接 · 字面搜索可用'}</span></div>{snap.capabilities.semantic && <button className="secondary" onClick={() => this.run(async () => { let offset = 0, done = false; while (!done) {
        const data = await request('/search/reindex', 'POST', { offset });
        offset = data.next_offset;
        done = data.done;
        this.toast(`已索引 ${offset} 条`);
    } })}>手动建立 / 刷新向量索引</button>}<p className="metadata">模型密钥只放在服务端环境变量里，不存进浏览器。服务未配置时不会生成虚构结果。</p>{isDesktop() && <div><button className="secondary" onClick={() => this.run(async () => { await (window as any).drill.sync(); await this.refresh(false); })}>立即同步</button><pre>{s.syncState?.error ?? '本地内容已保存'}</pre><button className="secondary" onClick={() => this.setState({ modal: 'connect' })}>连接同一个后端</button></div>}</section><section><h3>连接器</h3><p>外部内容是证据，不是替你完成的思考。只读拉取，不回写。</p>{snap.sources.map((src: any) => <div className="source-card" key={src.id}><div><strong>{src.name}</strong><span className="metadata">{src.last_synced ? '上次同步 ' + dateLabel(src.last_synced, true) : '还没有拉取'}</span></div>{src.state.error && <p className="amber">{src.state.error}</p>}{Object.keys(src.state.new_versions ?? {}).length > 0 && <p>发现 {Object.keys(src.state.new_versions ?? {}).length} 个新版本，原快照保持不变。</p>}{isDesktop() && <button onClick={() => this.run(async () => { await (window as any).drill.pullSource(src.id); await this.refresh(false); })}>拉取一次</button>}</div>)}{isDesktop() ? <div className="source-form"><select value={s.sourceForm.connector} onChange={e => this.setState({ sourceForm: { ...s.sourceForm, connector: e.target.value } })}><option value="obsidian">Obsidian 文库</option><option value="chrome">Chrome History</option><option value="codex">Codex 会话目录</option></select><input placeholder="本机目录或History文件路径" value={s.sourceForm.path} onChange={e => this.setState({ sourceForm: { ...s.sourceForm, path: e.target.value } })}/><button className="secondary" onClick={() => this.run(async () => { await (window as any).drill.addSource(s.sourceForm); await this.refresh(false); this.toast('连接器已添加，手动拉取时才读取本机内容。'); })}>添加连接器</button></div> : <p className="service-notice">连接器只在桌面端运行。Web不会读取本机文件或浏览历史。</p>}</section><section><h3>不再出现的内容</h3>{(snap.user.settings.discovery_hidden ?? []).length ? (snap.user.settings.discovery_hidden ?? []).map((id: string) => <div className="settings-row" key={id}><span>{this.object(id)?.title ?? id}</span><button onClick={() => this.run(async () => { await request('/settings', 'POST', { unhide_object: id }); await this.refresh(false); })}>恢复展示</button></div>) : <p className="metadata">还没有隐藏内容。隐藏不等于删除。</p>}</section><section><h3>键盘</h3><div className="shortcut-grid">{[['⌘ K', '搜索与命令'], ['⌘ ⇧ Space', '快速捕获'], ['↑ / ↓', '移动选择'], ['Enter', '临时预览'], ['⌘ Enter', '固定到右栏'], ['⌘ ⇧ Enter', '进入嵌套画布'], ['⌘ Z', '撤销属性修改'], ['Esc', '关闭预览 / 返回上层']].map(([key, text]) => <div key={key}><kbd>{key}</kbd><span>{text}</span></div>)}</div></section></div>; }
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
        else if (s.modal === 'connect') {
            title = '连接你的后端';
            body = <form className="connect-form" onSubmit={e => { e.preventDefault(); this.run(async () => { await (window as any).drill.connect({ url: s.backendUrl, password: s.backendPassword, token: s.backendToken }); this.setState({ modal: null }); await this.refresh(false); }); }}><input required placeholder="https://你的服务地址" value={s.backendUrl ?? ''} onChange={e => this.setState({ backendUrl: e.target.value })}/><input type="password" placeholder="自托管连接口令" value={s.backendPassword ?? ''} onChange={e => this.setState({ backendPassword: e.target.value })}/><input type="password" placeholder="或 CloudBase access_token" value={s.backendToken ?? ''} onChange={e => this.setState({ backendToken: e.target.value })}/><p className="metadata">已有本地内容后不可切换到另一后端，以免混合两个真相源。</p><button className="primary">连接</button></form>;
        }
        else if (s.modal === 'object-actions' && o) {
            title = '对象';
            body = <div className="object-actions"><button onClick={() => this.run(async () => { const title = prompt('用自己的话，重写一条理解。'); if (!title?.trim())
                return; const n = makeObject(title.trim(), s.snapshot.user.id, { kind: 'distill', parent_id: o.parent_id }); await this.create(n); await this.save(this.object(n.id)!, 'relation', { to_id: o.id }, false); this.select(n.id); this.setState({ modal: null }); })}>用自己的话新写一条沉淀 <Icon name="arrow" size={16}/></button><button onClick={() => this.run(async () => { await request('/settings', 'POST', { hide_object: o.id }); await this.refresh(false); this.setState({ modal: null }); this.toast('只停止主动发现中的展示，对象仍然保留。'); })}>别再给我看这条 <Icon name="eye" size={16}/></button>{s.view === 'canvas' && <div><label>在这张画布的显示</label><select value={s.snapshot.placements.find((p: Placement) => p.object_id === o.id && p.canvas_id === s.scope)?.display ?? ''} onChange={e => this.run(async () => { const p = s.snapshot.placements.find((p: Placement) => p.object_id === o.id && p.canvas_id === s.scope); if (p)
                await this.placement({ ...p, display: e.target.value || null }); })}><option value="">跟随全局</option><option value="title_only">只显示主体</option><option value="collapse_body">折叠附文</option><option value="full">全部显示</option></select><label>所属区域</label><select value={s.snapshot.placements.find((p: Placement) => p.object_id === o.id && p.canvas_id === s.scope)?.group_id ?? ''} onChange={e => this.run(async () => { const p = s.snapshot.placements.find((p: Placement) => p.object_id === o.id && p.canvas_id === s.scope); if (p)
                await this.placement({ ...p, group_id: e.target.value || null }); })}><option value="">不在分组中</option>{s.snapshot.placements.filter((p: Placement) => p.canvas_id === s.scope && !p.deleted_at && p.object_id !== o.id && this.object(p.object_id)?.kind === 'group').map((p: Placement) => <option key={p.object_id} value={p.object_id}>{this.object(p.object_id)?.title}</option>)}</select></div>}<button className="danger-text" onClick={() => this.run(async () => { if (!confirm('删除这条对象？同步墓碑不可直接复活，请先导出需要保留的内容。'))
                return; await this.save(o, 'deleted_at', Date.now(), false); this.setState({ selected: null, modal: null }); })}>删除对象 <Icon name="trash" size={16}/></button></div>;
        }
        return <div>{s.capture && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget)
            this.setState({ capture: false }); }}><section className="capture-modal" role="dialog" aria-label="快速捕获" aria-modal="true"><textarea ref={el => { this.captureInput = el; }} placeholder="先放下一个想法…" value={s.captureText} onChange={e => this.setState({ captureText: e.target.value })} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            this.run(this.capture);
        } }} onPaste={e => { const file = e.clipboardData.files[0]; if (file) {
            e.preventDefault();
            this.run(() => this.importFile(file));
        } }}/><div className="capture-footer">{s.recording ? <span className="recording-indicator">● 正在录音 · ⌘R 停止</span> : <span>不用选择类型。</span>}<span><kbd>↵</kbd> 存下　 <kbd>esc</kbd> 取消　 <kbd>⌘R</kbd> 录音</span><button className="capture-save" aria-label="存下" onClick={() => this.run(this.capture)}><Icon name="arrow" size={16}/></button></div></section></div>}{s.search && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget)
            this.setState({ search: false }); }}><section className="search-modal" role="dialog" aria-modal="true" aria-label="搜索与命令"><header><Icon name="search" size={20}/><input ref={el => { this.searchInput = el; }} value={s.query} placeholder="用你自己会写的词，找回来…" onChange={e => void this.search(e.target.value)}/><button onClick={() => this.setState({ search: false })}><kbd>esc</kbd></button></header><div className="search-tabs">{[['lexical', '字面'], ['semantic', '语义'], ['hybrid', '混合']].map(([mode, label]) => <button key={mode} disabled={mode !== 'lexical' && !s.snapshot.capabilities.semantic} className={mode === s.searchMode ? 'active' : ''} onClick={() => void this.search(s.query, mode)}>{label}</button>)}<span className="metadata">输入 &gt; 使用命令</span></div><div className="search-results">{s.query.startsWith('>') ? [['快速捕获', () => this.openCapture()], ['前往行动', () => this.navigate('actions')], ['前往画布', () => this.navigate('canvases')], ['查看设置', () => this.navigate('settings')]].map(([name, fn]: any) => <button key={name} onClick={() => { this.setState({ search: false }); fn(); }}>{name}<Icon name="arrow" size={15}/></button>) : s.searchBusy ? <p className="context-empty">在找…</p> : s.searchResults.length ? s.searchResults.map((o: KnowledgeObject) => <button key={o.id} onClick={() => { this.setState({ search: false }); this.select(o.id); }}><span className="kind-dot" style={{ background: this.kind(o.kind)?.color }}/><span><strong>{o.title}</strong><small>{o.body?.slice(0, 100)}</small></span><time>{dateLabel(o.captured_at)}</time></button>) : <p className="context-empty">{s.query ? '没找到。试试用你自己会写的词？' : '从一个词、一句话，或一段记忆开始。'}</p>}</div></section></div>}{s.modal && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget)
            this.setState({ modal: null }); }}><section className="generic-modal" role="dialog" aria-modal="true"><header><h2>{title}</h2><button aria-label="关闭" onClick={() => this.setState({ modal: null })}><Icon name="close"/></button></header><div className="modal-content">{body}</div></section></div>}</div>;
    }
    render() {
        const s = this.state;
        if (s.login)
            return <div className="login-page"><div className="login-card"><div className="brand-mark">d</div><h1>回到你的思考。</h1><p>连接已经部署的 Drill 服务。</p><form onSubmit={e => { e.preventDefault(); this.run(async () => { await request(s.authMode === 'cloudbase' ? '/auth/token' : '/auth/login', 'POST', s.authMode === 'cloudbase' ? { token: s.password } : { password: s.password }); await this.refresh(); }); }}><input type="password" autoFocus aria-label={s.authMode === 'cloudbase' ? 'CloudBase访问令牌' : '连接口令'} placeholder={s.authMode === 'cloudbase' ? 'CloudBase访问令牌' : '连接口令'} value={s.password} onChange={e => this.setState({ password: e.target.value })}/><button className="primary">连接 <Icon name="arrow" size={16}/></button></form>{s.toast && <p className="amber">{s.toast}</p>}</div></div>;
        if (s.loading || !s.snapshot)
            return <div className="loading-page"><div className="brand-mark">d</div><p>{s.toast || '把思考放回原位。'}</p>{s.toast && <button onClick={() => this.run(this.init)}>重试连接</button>}</div>;
        return <div className={'app-shell ' + (!s.left ? 'left-collapsed ' : '') + (!s.right ? 'right-collapsed' : '')} ref={el => { this.rootRef = el; }} onDragOver={e => { if (e.dataTransfer.types.includes('Files'))
            e.preventDefault(); }} onDrop={e => { if (e.dataTransfer.files.length) {
            e.preventDefault();
            const files = [...e.dataTransfer.files];
            this.run(async () => { for (const file of files)
                await this.importFile(file); });
        } }}>{this.renderSidebar()}{this.renderMain()}{this.renderRight()}{this.renderModals()}{s.toast && <div className="toast" role="status"><span>{s.toast}</span><button aria-label="关闭提示" onClick={() => this.setState({ toast: '' })}><Icon name="close" size={13}/></button></div>}<button className="mobile-capture" aria-label="捕获" onClick={this.openCapture}><Icon name="plus" size={25}/></button></div>;
    }
}
