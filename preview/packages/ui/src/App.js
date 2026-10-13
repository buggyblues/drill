import React from '../../../vendor/react-shim.js';
import { Icon } from './Icon.js';
import { Canvas } from './Canvas.js';
import { request, loadSnapshot, commit, isDesktop, uploadFile } from './api.js';
import { makeObject, captureText, uid, inWindow, keyBetween, sortedBlocks, inferForm } from '../../core/src/helpers.js';
const statusLabel = { todo: '待做', doing: '在做', blocked: '阻塞', done: '完成' };
const labels = { kind: '类型', parent_id: '归属', tags: '标签', status: '状态', applies_to: '适用范围', series: '系列', due_at: '截止时间' };
const pageTitles = { recent: '新增', actions: '行动', memory: '个人记忆', insight: '洞察', map: '认知地图', walk: '随机漫步', timeline: '时间轴', canvases: '所有画布', settings: '偏好与连接' };
const descriptions = { recent: '先放下。想清楚了，再赋予意义。', actions: '让模糊的想法，变成无歧义的下一步。', memory: '关于自己的判断，也值得保留来路。', insight: '不是更快地得到答案，而是更深地看见问题。', map: '看见那些你反复攀登的山。', walk: '沿着关联走一会儿，偶尔去远一点的地方。', timeline: '回到当时，而不是上传的那一刻。', canvases: '已有一些想法之后，再把它们放到一起。' };
function dateLabel(t, full = false) { return new Intl.DateTimeFormat('zh-CN', full ? { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' } : { month: '2-digit', day: '2-digit' }).format(t); }
function download(name, data) { const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
export class App extends React.Component {
    state = { snapshot: null, loading: true, view: 'recent', scope: null, window: 'today', custom: { from: '', to: '' }, selected: null, right: true, left: true, tab: 'read', mode: 'list', capture: false, captureText: '', search: false, query: '', searchResults: [], searchMode: 'lexical', searchBusy: false, kindFilter: '', toast: '', modal: null, related: { items: [], mode: 'lexical' }, insight: null, reading: false, insightScope: 'week', graphDepth: 1, versions: [], editing: false, draftTitle: '', draftBlocks: [], drafts: {}, connectors: false, login: false, password: '', breadcrumbs: [], mapData: null, walkPath: [], walkObject: null, walkJump: false, recording: false, sourceForm: { connector: 'obsidian', path: '', name: '' }, syncState: null, scrollTop: 0 };
    captureInput = null;
    searchInput = null;
    timer;
    toastTimer;
    poll;
    recorder = null;
    chunks = [];
    undoStack = [];
    relatedRequest = 0;
    searchRequest = 0;
    rootRef = null;
    componentDidMount() {
        window.addEventListener('drill:capture', this.openCapture);
        window.addEventListener('keydown', this.keys);
        window.addEventListener('online', this.network);
        window.addEventListener('offline', this.network);
        void this.init();
        this.poll = setInterval(() => {
            if (isDesktop())
                void this.refresh(false);
        }, 10000);
    }
    componentWillUnmount() { window.removeEventListener('drill:capture', this.openCapture); window.removeEventListener('keydown', this.keys); window.removeEventListener('online', this.network); window.removeEventListener('offline', this.network); clearInterval(this.poll); clearTimeout(this.timer); clearTimeout(this.toastTimer); this.recorder?.stop(); }
    init = async () => {
        try {
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
        catch (e) {
            if (e.status === 401)
                this.setState({ login: true, loading: false });
            else
                this.fail(e);
        }
    };
    refresh = async (select = true) => {
        try {
            const snapshot = await loadSnapshot();
            const selected = this.state.selected ?? (select ? (snapshot.objects.find(o => o.id === 'note-clarity')?.id ?? snapshot.objects.filter(o => !o.deleted_at && !o.ephemeral && !['domain', 'project', 'group', 'canvas'].includes(o.kind ?? '')).sort((a, b) => b.captured_at - a.captured_at)[0]?.id) : null);
            this.setState({ snapshot, loading: false, login: false, selected });
            if (selected && select)
                void this.loadRelated(selected);
            if (isDesktop()) {
                const syncState = await window.drill.status();
                this.setState({ syncState });
            }
        }
        catch (e) {
            this.setState({ loading: false });
            throw e;
        }
    };
    network = () => {
        this.forceUpdate();
        if (navigator.onLine)
            void this.refresh(false).catch(this.fail);
    };
    run = (fn) => { void fn().catch(this.fail); };
    fail = (e) => { this.setState({ loading: false, reading: false, searchBusy: false }); this.toast(e?.message ?? String(e)); };
    toast = (message) => { clearTimeout(this.toastTimer); this.setState({ toast: message }); this.toastTimer = setTimeout(() => this.setState({ toast: '' }), 6000); };
    objects = () => this.state.snapshot?.objects ?? [];
    kinds = () => this.state.snapshot?.kinds ?? [];
    object = (id) => this.objects().find(o => o.id === id);
    selected = () => this.object(this.state.selected);
    kind = (id) => this.kinds().find(k => k.id === id);
    changes = (o, field, value) => ({ mutation_id: uid(), object_id: o.id, field, value, base_rev: o.rev, client_ts: Date.now() });
    save = async (o, field, value, remember = true) => {
        const prior = o[field];
        await commit([this.changes(o, field, value)]);
        if (remember && prior !== undefined)
            this.undoStack.push({ id: o.id, field, value: structuredClone(prior) });
        await this.refresh(false);
    };
    undo = async () => {
        const prev = this.undoStack.pop();
        if (!prev) {
            this.toast('没有可撤销的修改');
            return;
        }
        const o = this.object(prev.id);
        if (o) {
            await this.save(o, prev.field, prev.value, false);
            this.toast('已撤销上一次修改');
        }
    };
    create = async (o) => { await commit([this.changes(o, 'create', o)]); await this.refresh(false); return o.id; };
    openCapture = () => { this.setState({ capture: true }, () => setTimeout(() => this.captureInput?.focus(), 30)); };
    capture = async () => {
        const text = this.state.captureText.trim();
        if (!text)
            return;
        const o = captureText(text, this.kinds(), this.state.snapshot.user.id);
        if (o.kind === 'self' && !o.applies_to.length) {
            this.toast('先捕获内容，再在提炼中填写适用范围');
            o.kind = null;
        }
        const options = this.kind(o.kind)?.properties.status?.options;
        if (options)
            o.status = options[0];
        await this.create(o);
        this.setState({ captureText: '' });
        this.toast('已放下，继续写也可以');
        this.captureInput?.focus();
    };
    importFile = async (file) => {
        const form = inferForm(file.type);
        if (!form) {
            this.toast('这一版接收图片、音频和视频；其他文档请先转成文字。');
            return;
        }
        if (file.size > 256 * 1024 * 1024) {
            this.toast('当前界面单文件上限256MB；大文件请使用桌面连接器。');
            return;
        }
        this.toast('正在保存媒体…');
        const assetId = await uploadFile(file);
        await this.create(makeObject(file.name, this.state.snapshot.user.id, { form, asset_id: assetId }));
        this.toast('媒体已存下');
    };
    recording = async () => {
        if (this.recorder && this.state.recording) {
            this.recorder.stop();
            this.setState({ recording: false });
            return;
        }
        if (!navigator.mediaDevices?.getUserMedia)
            throw new Error('录音需要HTTPS或本机地址，以及麦克风权限');
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.chunks = [];
        const recorder = new MediaRecorder(stream);
        this.recorder = recorder;
        recorder.ondataavailable = e => {
            if (e.data.size)
                this.chunks.push(e.data);
        };
        recorder.onstop = () => { stream.getTracks().forEach(t => t.stop()); const blob = new Blob(this.chunks, { type: recorder.mimeType }); this.run(() => this.importFile(new File([blob], `录音-${new Date().toISOString().slice(0, 16)}.webm`, { type: blob.type }))); };
        recorder.start();
        this.setState({ recording: true });
    };
    navigate = (view, scope = null) => {
        if (this.state.editing && !confirm('还有未保存的编辑，离开吗？'))
            return;
        this.setState({ view, scope, window: ['recent', 'timeline'].includes(view) ? 'today' : 'all', mode: view === 'actions' ? 'board' : 'list', editing: false, insight: null, mapData: null, scrollTop: 0, breadcrumbs: view === 'canvas' && scope ? [scope] : [] });
    };
    select = (id, tab = this.state.tab) => { this.setState({ selected: id, right: true, tab, editing: false }); void this.loadRelated(id); };
    loadRelated = async (id) => {
        const n = ++this.relatedRequest;
        try {
            const data = await request('/related/' + encodeURIComponent(id));
            if (n === this.relatedRequest)
                this.setState({ related: data });
        }
        catch {
            if (n === this.relatedRequest)
                this.setState({ related: { items: [], mode: 'offline' } });
        }
    };
    filtered = () => {
        const s = this.state;
        return this.objects().filter(o => !o.deleted_at && !o.ephemeral).filter(o => {
            if (s.view === 'actions')
                return o.kind === 'action';
            if (s.view === 'memory')
                return o.kind === 'self';
            if (s.view === 'canvases')
                return o.form === 'canvas';
            if (s.view === 'domain')
                return o.parent_id === s.scope || o.parent_id && this.object(o.parent_id)?.parent_id === s.scope;
            if (s.view === 'recent')
                return !['domain', 'project', 'group'].includes(o.kind ?? '');
            return true;
        }).filter(o => !s.kindFilter || o.kind === s.kindFilter).filter(o => ['recent', 'timeline'].includes(s.view) ? inWindow(o.captured_at, s.window, s.snapshot.user.timezone, Date.now(), s.custom) : true).sort((a, b) => b.captured_at - a.captured_at || b.created_at - a.created_at);
    };
    keys = (e) => {
        const meta = e.metaKey || e.ctrlKey;
        const writing = e.target.closest('input,textarea,select,[contenteditable]');
        if (meta && e.key.toLowerCase() === 'k') {
            e.preventDefault();
            this.openSearch();
            return;
        }
        if (meta && e.shiftKey && e.code === 'Space') {
            e.preventDefault();
            this.openCapture();
            return;
        }
        if (meta && e.key.toLowerCase() === 'r' && this.state.capture) {
            e.preventDefault();
            this.run(this.recording);
            return;
        }
        if (e.key === 'Escape') {
            this.setState({ capture: false, search: false, modal: null });
            if (this.state.breadcrumbs.length > 1) {
                const p = [...this.state.breadcrumbs];
                p.pop();
                this.setState({ scope: p.at(-1), breadcrumbs: p });
            }
            return;
        }
        if (writing)
            return;
        if (this.state.view === 'canvas' && e.key === 'Enter' && !meta)
            return;
        if (meta && e.key.toLowerCase() === 'z') {
            e.preventDefault();
            this.run(this.undo);
            return;
        }
        if (e.key === 'Enter' && this.state.selected) {
            e.preventDefault();
            const o = this.selected();
            if (meta && e.shiftKey && o?.form === 'canvas')
                this.enterCanvas(o.id);
            else if (meta)
                this.setState({ right: true });
            else
                this.setState({ modal: 'preview' });
            return;
        }
        if (['ArrowDown', 'ArrowUp'].includes(e.key) && ['recent', 'timeline', 'domain', 'memory', 'actions', 'canvases'].includes(this.state.view)) {
            e.preventDefault();
            const list = this.filtered();
            const index = list.findIndex(o => o.id === this.state.selected), next = list[Math.max(0, Math.min(list.length - 1, index + (e.key === 'ArrowDown' ? 1 : -1)))];
            if (next)
                this.select(next.id);
        }
    };
    openSearch = () => { this.setState({ search: true }, () => setTimeout(() => this.searchInput?.focus(), 30)); };
    search = async (query, mode = this.state.searchMode) => {
        clearTimeout(this.timer);
        this.setState({ query, searchMode: mode });
        if (!query.trim()) {
            this.setState({ searchResults: [] });
            return;
        }
        if (query.startsWith('>'))
            return;
        const n = ++this.searchRequest;
        this.timer = setTimeout(() => this.run(async () => {
            this.setState({ searchBusy: true });
            const data = await request('/search?q=' + encodeURIComponent(query) + '&mode=' + mode);
            if (n === this.searchRequest)
                this.setState({ searchResults: data.items, searchBusy: false });
        }), 250);
    };
    enterCanvas = (id) => { this.setState({ view: 'canvas', scope: id, window: 'all', breadcrumbs: this.state.view === 'canvas' ? [...this.state.breadcrumbs, id] : [id], editing: false }); };
    placement = async (p) => { const canvas = this.object(p.canvas_id); await commit([this.changes(canvas, 'placement', p)]); await this.refresh(false); };
    connect = async (from, to) => { await this.save(this.object(from), 'relation', { to_id: to, source_field: 'canvas' }, false); };
    newCanvasObject = async (title, kind, placement, ephemeral = false) => { const o = makeObject(title, this.state.snapshot.user.id, { kind, ephemeral }); const canvas = this.object(this.state.scope); await commit([this.changes(o, 'create', o), this.changes(canvas, 'placement', { object_id: o.id, ...placement })]); await this.refresh(false); return o.id; };
    newCanvas = async () => {
        const title = prompt('画布名称');
        if (!title?.trim())
            return;
        const o = makeObject(title.trim(), this.state.snapshot.user.id, { form: 'canvas', kind: 'canvas' });
        await this.create(o);
        this.enterCanvas(o.id);
    };
    setKind = async (o, kind) => {
        if (kind === 'action' && !confirm('这是一条具体、无歧义、可以直接开始的下一步吗？'))
            return;
        if (kind === 'self' && !o.applies_to.length) {
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
        }
        const options = this.kind(kind)?.properties.status?.options;
        if (options && !o.status) {
            await commit([this.changes(o, 'kind', kind), this.changes(o, 'status', options[0])]);
            await this.refresh(false);
        }
        else
            await this.save(o, 'kind', kind);
    };
    askAI = async (objectId) => { this.setState({ reading: true, insight: null }); const scope = objectId ? { object_id: objectId } : this.state.insightScope === 'week' ? { since: Date.now() - 7 * 86400000 } : this.state.insightScope.startsWith('canvas:') ? { canvas_id: this.state.insightScope.slice(7) } : { parent_id: this.state.insightScope }; const insight = await request('/insight', 'POST', { scope }); this.setState({ insight, reading: false }); await this.refresh(false); };
    distill = async () => {
        const o = this.selected();
        if (!o)
            return;
        this.setState({ reading: true });
        await request('/ai/distill', 'POST', { object_id: o.id });
        this.setState({ reading: false });
        await this.refresh(false);
        this.toast('建议已列出，每一项都由你决定。');
    };
    versions = async () => { const data = await request('/versions/' + this.state.selected); this.setState({ versions: data.versions, modal: 'versions' }); };
    recognize = async (first, second) => {
        const other = second ?? this.state.recognizeSecond;
        if (!other || other === first) {
            this.setState({ modal: 'recognize', recognizeFirst: first });
            return;
        }
        const text = prompt('你认出了什么？用自己的话写下来。', '这和之前遇到的是同一个问题：');
        if (!text?.trim())
            return;
        await request('/recognize', 'POST', { object_ids: [first, other], text });
        await this.refresh(false);
        this.setState({ modal: null });
        this.toast('这次认出来的关联，已经留下。');
    };
    startEdit = () => {
        const o = this.selected();
        if (!o)
            return;
        let blocks = structuredClone(sortedBlocks(o.body_blocks.blocks));
        if (!blocks.length && o.body)
            blocks = [{ id: uid(), key: keyBetween(null, null), text: o.body }];
        this.setState({ editing: true, draftTitle: o.title, draftBlocks: blocks });
    };
    saveEdit = async () => {
        const o = this.selected();
        const before = sortedBlocks(o.body_blocks.blocks);
        const after = this.state.draftBlocks;
        const delta = [...after.filter(b => { const old = before.find(x => x.id === b.id); return !old || old.text !== b.text || old.key !== b.key; }), ...before.filter(b => !after.some(x => x.id === b.id)).map(b => ({ ...b, deleted_at: Date.now() }))];
        const changes = [];
        if (o.title !== this.state.draftTitle)
            changes.push(this.changes(o, 'title', this.state.draftTitle));
        if (delta.length)
            changes.push(this.changes(o, 'body_blocks', { blocks: delta }));
        await commit(changes);
        this.setState({ editing: false });
        await this.refresh(false);
    };
    renderMarkup = (text, external = false) => {
        if (external)
            return text;
        const parts = text.split(/(\[\[[^\]]+\]\])/g);
        return parts.map((part, i) => {
            if (!part.startsWith('[['))
                return React.createElement("span", { key: i }, part);
            const target = part.slice(2, -2).split('|')[0], matches = this.objects().filter(o => o.title === target && !o.deleted_at);
            return React.createElement("button", { key: i, className: `wiki-link ${matches.length !== 1 ? 'unresolved' : ''}`, onClick: () => this.run(async () => {
                    if (matches.length === 1)
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
                    }
                }) }, target);
        });
    };
    renderSidebar() {
        const s = this.state, snap = s.snapshot;
        const nav = (id, icon, label) => React.createElement("button", { key: id, title: !s.left ? label : undefined, className: 'nav-item ' + (s.view === id ? 'selected' : ''), onClick: () => this.navigate(id) },
            React.createElement(Icon, { name: icon }),
            React.createElement("span", null, label));
        const canvases = this.objects().filter(o => o.form === 'canvas' && !o.deleted_at).sort((a, b) => b.updated_at - a.updated_at).slice(0, 5);
        const unseen = snap.sources.reduce((n, x) => n + (x.state.unseen ?? 0), 0);
        return React.createElement("aside", { className: 'sidebar ' + (!s.left ? 'collapsed' : '') },
            React.createElement("div", { className: "brand" },
                React.createElement("div", { className: "brand-mark" }, "d"),
                s.left && React.createElement("span", null,
                    "drill",
                    React.createElement("span", { className: "brand-note" }, "\u6DF1\u4E00\u5C42")),
                React.createElement("button", { className: "sidebar-toggle", title: "\u6298\u53E0\u5BFC\u822A", onClick: () => this.setState({ left: !s.left }) },
                    React.createElement(Icon, { name: "sidebar", size: 16 }))),
            React.createElement("div", { className: "nav-scroll" },
                React.createElement("div", { className: "nav-group" },
                    nav('recent', 'recent', '新增'),
                    nav('actions', 'action', '行动'),
                    nav('memory', 'memory', '个人记忆')),
                React.createElement("div", { className: "nav-group" },
                    React.createElement("div", { className: "nav-heading" }, "\u9886\u57DF"),
                    this.objects().filter(o => o.kind === 'domain' && !o.deleted_at).map(o => React.createElement("div", { key: o.id },
                        React.createElement("button", { className: 'nav-item ' + (s.scope === o.id ? 'selected' : ''), title: o.title, onClick: () => this.navigate('domain', o.id) },
                            React.createElement(Icon, { name: "folder" }),
                            React.createElement("span", null, o.title)),
                        s.scope === o.id && this.objects().filter(p => p.parent_id === o.id && p.kind === 'project' && !p.deleted_at).map(p => React.createElement("button", { key: p.id, className: "nav-item subitem", onClick: () => this.navigate('domain', p.id) },
                            React.createElement(Icon, { name: "chevron", size: 14 }),
                            React.createElement("span", null, p.title))))),
                    s.left && React.createElement("button", { className: "quiet-add", onClick: () => this.run(async () => {
                            const title = prompt('新增领域名称');
                            if (title?.trim())
                                await this.create(makeObject(title.trim(), snap.user.id, { kind: 'domain' }));
                        }) },
                        React.createElement(Icon, { name: "plus", size: 12 }),
                        " \u6DFB\u52A0\u9886\u57DF")),
                React.createElement("div", { className: "nav-group" },
                    React.createElement("div", { className: "nav-heading" },
                        "\u753B\u5E03",
                        React.createElement("button", { title: "\u521B\u5EFA\u753B\u5E03", onClick: () => this.run(this.newCanvas) },
                            React.createElement(Icon, { name: "plus", size: 12 }))),
                    canvases.map(o => React.createElement("button", { key: o.id, className: 'nav-item ' + (s.scope === o.id ? 'selected' : ''), title: o.title, onClick: () => this.enterCanvas(o.id) },
                        React.createElement(Icon, { name: "canvas" }),
                        React.createElement("span", null, o.title))),
                    s.left && React.createElement("button", { className: "quiet-add", onClick: () => this.navigate('canvases') },
                        "\u5168\u90E8\u753B\u5E03 ",
                        React.createElement(Icon, { name: "arrow", size: 12 }))),
                React.createElement("div", { className: "nav-group" },
                    React.createElement("div", { className: "nav-heading" }, "\u91CD\u65B0\u9047\u89C1"),
                    nav('insight', 'spark', '洞察'),
                    nav('map', 'map', '认知地图'),
                    nav('walk', 'walk', '随机漫步'),
                    nav('timeline', 'clock', '时间轴')),
                React.createElement("div", { className: "nav-group connectors" },
                    React.createElement("button", { className: "nav-item", onClick: () => {
                            this.setState({ connectors: !s.connectors });
                            if (!s.connectors)
                                this.run(async () => { await request('/sources/seen', 'POST', {}); await this.refresh(false); });
                        } },
                        React.createElement(Icon, { name: s.connectors ? 'down' : 'chevron', size: 15 }),
                        React.createElement("span", null, "\u8FDE\u63A5\u5668"),
                        unseen > 0 && s.left && React.createElement("small", null, unseen)),
                    s.connectors && s.left && React.createElement("div", null,
                        snap.sources.map(src => React.createElement("button", { className: "connector-row", key: src.id, onClick: () => this.navigate('settings') },
                            React.createElement("span", null, src.name),
                            React.createElement("small", null, src.state.error ? '连接异常' : src.last_synced ? dateLabel(src.last_synced) : '尚未拉取'))),
                        React.createElement("button", { className: "quiet-add", onClick: () => this.navigate('settings') },
                            "\u7BA1\u7406\u8FDE\u63A5\u5668 ",
                            React.createElement(Icon, { name: "arrow", size: 12 }))))),
            React.createElement("footer", { className: "sidebar-footer" },
                React.createElement("button", { onClick: () => this.navigate('settings'), title: "\u504F\u597D\u4E0E\u8FDE\u63A5" },
                    React.createElement(Icon, { name: "settings" }),
                    s.left && React.createElement("span", null, "\u504F\u597D\u4E0E\u8FDE\u63A5")),
                React.createElement("button", { className: "sync-status", onClick: () => this.navigate('settings'), title: "\u540C\u6B65\u72B6\u6001" },
                    React.createElement("span", { className: 'status-dot ' + (!navigator.onLine ? 'offline' : '') }),
                    s.left && React.createElement("span", null, isDesktop() ? (s.syncState?.pending ? `本地已存 · ${s.syncState.pending} 条待同步` : s.syncState?.error ? '本地可用 · 同步待恢复' : '本地优先') : snap.capabilities.demo ? '本机示例 · 非正式数据' : navigator.onLine ? '在线连接' : '连接中断'))));
    }
    renderTop() { const s = this.state; const hasTime = ['recent', 'timeline', 'canvas'].includes(s.view); return React.createElement("header", { className: "topbar" },
        React.createElement("div", { className: "time-tabs" }, hasTime ? [['today', '今天'], ['week', '本周'], ['month', '本月'], ['all', '全部'], ['custom', '自定义']].map(([value, label]) => React.createElement("button", { key: value, className: s.window === value ? 'active' : '', onClick: () => this.setState({ window: value }) }, label)) : React.createElement("span", { className: "top-crumb" }, s.scope ? this.object(s.scope)?.title : pageTitles[s.view])),
        React.createElement("div", { className: "top-actions" },
            React.createElement("button", { title: "\u5168\u5C40\u641C\u7D22 \u2318K", onClick: this.openSearch },
                React.createElement(Icon, { name: "search", size: 17 }),
                React.createElement("kbd", null, "\u2318 K")),
            React.createElement("button", { title: "\u6295\u5165\u4E00\u4EFD\u4E1C\u897F \u2318\u21E7Space", "aria-label": "\u5FEB\u901F\u6355\u83B7", onClick: this.openCapture },
                React.createElement(Icon, { name: "plus", size: 20 })),
            React.createElement("button", { title: "\u5207\u6362\u4E0A\u4E0B\u6587\u680F", onClick: () => this.setState({ right: !s.right }) },
                React.createElement(Icon, { name: "panel", size: 17 })))); }
    renderList() {
        const list = this.filtered(), s = this.state;
        const board = s.view === 'actions' && s.mode === 'board';
        const kind = this.kind('action'), column = kind?.properties.status;
        if (board && column?.type === 'label')
            return React.createElement("div", { className: "board" }, (column.options ?? []).map(value => React.createElement("section", { key: value, className: "board-column", onDragOver: e => e.preventDefault(), onDrop: e => {
                    e.preventDefault();
                    const o = this.object(e.dataTransfer.getData('drill/object'));
                    if (o)
                        this.run(() => this.save(o, 'status', value));
                } },
                React.createElement("h3", null,
                    statusLabel[value] ?? value,
                    React.createElement("small", null, list.filter(o => (o.status ?? column.options?.[0]) === value).length)),
                list.filter(o => (o.status ?? column.options?.[0]) === value).map(o => React.createElement("button", { key: o.id, draggable: true, onDragStart: e => e.dataTransfer.setData('drill/object', o.id), className: 'board-card ' + (s.selected === o.id ? 'selected' : ''), onClick: () => this.select(o.id) },
                    React.createElement("span", { className: "kind-dot", style: { background: this.kind(o.kind)?.color } }),
                    React.createElement("strong", null, o.title),
                    o.parent_id && React.createElement("small", null, this.object(o.parent_id)?.title))))));
        if (!list.length)
            return React.createElement("div", { className: "empty-state" },
                React.createElement(Icon, { name: s.view === 'recent' ? 'recent' : 'folder', size: 28 }),
                React.createElement("p", null, s.view === 'recent' ? '这段时间还没有新东西。' : '这里还没有内容。'),
                React.createElement("button", { className: "text-button", onClick: this.openCapture },
                    "\u4ECE\u4E00\u4E2A\u60F3\u6CD5\u5F00\u59CB ",
                    React.createElement(Icon, { name: "arrow", size: 14 })));
        if (s.view === 'canvases')
            return React.createElement("div", { className: "canvas-grid" }, list.map(o => React.createElement("button", { key: o.id, className: "canvas-tile", onClick: () => this.enterCanvas(o.id) },
                React.createElement("div", { className: "mini-canvas" },
                    React.createElement("div", null),
                    React.createElement("div", null),
                    React.createElement("div", null)),
                React.createElement("h3", null, o.title),
                React.createElement("p", null, o.body || '一张安静的画布'))));
        const start = Math.max(0, Math.floor(s.scrollTop / 48) - 8), end = Math.min(list.length, start + 36);
        const visible = list.length > 100 ? list.slice(start, end) : list;
        return React.createElement("div", { className: "object-list", role: "listbox", "aria-label": "\u5BF9\u8C61\u5217\u8868", onScroll: e => this.setState({ scrollTop: e.currentTarget.scrollTop }) },
            list.length > 100 && React.createElement("div", { style: { height: start * 48 } }),
            visible.map(o => { const k = this.kind(o.kind), old = o.kind === 'self' && o.valid_until; return React.createElement("button", { key: o.id, role: "option", "aria-selected": s.selected === o.id, className: 'object-row ' + (s.selected === o.id ? 'selected ' : '') + (o.kind === 'ai_output' ? 'ai-object ' : '') + (old ? 'invalidated' : ''), draggable: true, onDragStart: e => e.dataTransfer.setData('drill/object', o.id), onClick: () => this.select(o.id), onDoubleClick: () => o.form === 'canvas' ? this.enterCanvas(o.id) : this.setState({ modal: 'preview' }) },
                React.createElement("span", { className: "kind-dot", style: { background: k?.color ?? '#bbb6ae' }, title: k?.label ?? '未提炼' }),
                React.createElement("span", { className: "object-row-title" },
                    o.title || '无题',
                    old && React.createElement("small", null, "\u5DF2\u63A8\u7FFB")),
                o.source_id && React.createElement("span", { className: "row-source", title: "\u5916\u90E8\u51BB\u7ED3\u5FEB\u7167" }, "\u2197"),
                React.createElement("span", { className: "object-tag" }, o.tags_cached[0] ? '#' + o.tags_cached[0] : s.view === 'memory' ? o.applies_to.join(' · ') : ''),
                React.createElement("time", null, dateLabel(o.captured_at)),
                React.createElement("span", { className: "row-chevron" }, "\u203A")); }),
            list.length > 100 && React.createElement("div", { style: { height: (list.length - end) * 48 } }));
    }
    renderDiscovery() {
        const s = this.state;
        const ai = s.snapshot.capabilities.ai, semantic = s.snapshot.capabilities.semantic;
        if (s.view === 'insight')
            return React.createElement("div", { className: "discovery-body" },
                React.createElement("div", { className: "insight-intro" },
                    React.createElement(Icon, { name: "spark", size: 32 }),
                    React.createElement("h2", null, "\u8BA9\u95EE\u9898\uFF0C\u518D\u6DF1\u4E00\u5C42\u3002"),
                    React.createElement("p", null,
                        "\u53EA\u8BFB\u4F60\u5DF2\u6709\u7684\u5185\u5BB9\uFF0C\u627E\u51FA\u91CD\u590D\u3001\u5F20\u529B\u4E0E\u76F2\u70B9\u3002",
                        React.createElement("br", null),
                        "\u8BC1\u636E\u4E0D\u591F\u7684\u65F6\u5019\uFF0C\u5141\u8BB8\u4EC0\u4E48\u90FD\u4E0D\u8BF4\u3002"),
                    React.createElement("div", { className: "insight-controls" },
                        React.createElement("select", { "aria-label": "\u6D1E\u5BDF\u8303\u56F4", value: s.insightScope, onChange: e => this.setState({ insightScope: e.target.value }) },
                            React.createElement("option", { value: "week" }, "\u6700\u8FD1 7 \u5929"),
                            this.objects().filter(o => o.kind === 'domain').map(o => React.createElement("option", { key: o.id, value: o.id }, o.title)),
                            this.objects().filter(o => o.form === 'canvas').map(o => React.createElement("option", { key: o.id, value: 'canvas:' + o.id },
                                "\u753B\u5E03 \u00B7 ",
                                o.title))),
                        React.createElement("button", { className: "primary", disabled: s.reading || !ai, onClick: () => this.run(() => this.askAI()) },
                            s.reading ? '在读…' : '开始这次思考',
                            React.createElement(Icon, { name: "arrow", size: 16 }))),
                    !ai && React.createElement("p", { className: "service-notice" }, "AI \u5C1A\u672A\u8FDE\u63A5\u3002\u914D\u7F6E\u670D\u52A1\u7AEF\u540E\u53EF\u7528\uFF0C\u4E0D\u63D0\u4F9B\u6A21\u62DF\u6D1E\u5BDF\u3002")),
                this.renderInsightResult());
        if (s.view === 'map')
            return React.createElement("div", { className: "discovery-body" },
                React.createElement("div", { className: "map-frame" }, s.mapData?.clusters?.length ? React.createElement("svg", { viewBox: "0 0 760 470", className: "cognitive-map", role: "img", "aria-label": "\u57FA\u4E8E\u5411\u91CF\u805A\u7C7B\u7684\u4E3B\u9898\u5730\u56FE" }, s.mapData.clusters.map((c, i) => React.createElement("g", { key: c.id, onClick: () => { this.select(c.representative); this.setState({ mapCluster: c }); }, className: "terrain-cluster" },
                    [1, 1.35, 1.7, 2.05, 2.4].map((r, n) => React.createElement("ellipse", { key: n, cx: c.x * 7.4, cy: c.y * 5, rx: (28 + c.objects.length * 2) * r, ry: (18 + c.objects.length) * r, transform: `rotate(${i * 17 - 12} ${c.x * 7.4} ${c.y * 5})`, fill: n === 0 ? '#ece8de' : 'none', stroke: "#d3ccbc", strokeWidth: "1" })),
                    React.createElement("text", { x: c.x * 7.4, y: c.y * 5 - 10, textAnchor: "middle" }, c.label),
                    React.createElement("text", { x: c.x * 7.4, y: c.y * 5 + 12, textAnchor: "middle", className: "map-count" },
                        c.objects.length,
                        " \u6761\u5185\u5BB9")))) : React.createElement("div", { className: "empty-state" },
                    React.createElement(Icon, { name: "map", size: 36 }),
                    React.createElement("h3", null, "\u4E3B\u9898\u6765\u81EA\u5185\u5BB9\uFF0C\u4E0D\u662F\u8FDE\u7EBF\u3002"),
                    React.createElement("p", null, semantic ? '索引就绪后，主动生成这次主题分布。' : '连接 bge-m3 并建立索引后，才能看见你的主题分布。'),
                    React.createElement("button", { className: "primary", disabled: !semantic, onClick: () => this.run(async () => { const data = await request('/map'); this.setState({ mapData: data }); }) }, "\u751F\u6210\u8BA4\u77E5\u5730\u56FE"))),
                s.mapData && React.createElement("p", { className: "metadata" }, "\u5B9E\u9A8C\u6027\u805A\u7C7B \u00B7 \u624B\u52A8\u5237\u65B0 \u00B7 \u4E0D\u81EA\u52A8\u547D\u540D\u6216\u66FF\u4F60\u4E0B\u7ED3\u8BBA"),
                s.mapCluster && React.createElement("div", { className: "cluster-objects" },
                    React.createElement("h3", null, s.mapCluster.label),
                    s.mapCluster.objects.map((id) => React.createElement("button", { key: id, onClick: () => this.select(id) },
                        this.object(id)?.title,
                        React.createElement(Icon, { name: "arrow", size: 14 }))),
                    React.createElement("button", { className: "text-button", onClick: () => this.run(() => this.recognize(s.mapCluster.representative)) }, "\u6211\u8BA4\u51FA\u4E86\u4E00\u4E2A\u91CD\u590D\u7684\u95EE\u9898")));
        return React.createElement("div", { className: "discovery-body" },
            React.createElement("div", { className: "walk-intro" },
                React.createElement(Icon, { name: "walk", size: 30 }),
                !s.walkObject ? React.createElement("div", null,
                    React.createElement("h2", null, "\u4E0D\u7528\u77E5\u9053\u8981\u53BB\u54EA\u91CC\u3002"),
                    React.createElement("p", null,
                        "\u5927\u591A\u6570\u65F6\u5019\u6CBF\u7740\u5173\u8054\u524D\u884C\uFF0C\u5076\u5C14\u505A\u4E00\u6B21\u5F31\u76F8\u5173\u7684\u8DE8\u8D8A\u3002",
                        React.createElement("br", null),
                        "\u4E0D\u6307\u5B9A\u8D77\u70B9\uFF0C\u4E0D\u4FDD\u7559\u8FD9\u6761\u8DEF\u5F84\u3002")) : React.createElement("div", { className: "walk-card" },
                    React.createElement("span", { className: "eyebrow" }, s.walkJump ? '一次弱相关的跨越' : '沿着关联，来到这里'),
                    React.createElement("h2", null, s.walkObject.title),
                    React.createElement("p", null, s.walkObject.body),
                    React.createElement("button", { className: "text-button", onClick: () => this.select(s.walkObject.id) },
                        "\u6253\u5F00\u8FD9\u6761\u5185\u5BB9 ",
                        React.createElement(Icon, { name: "arrow", size: 14 })),
                    React.createElement("button", { className: "text-button", onClick: () => this.run(() => this.recognize(s.walkObject.id)) }, "\u6211\u8BA4\u51FA\u4E86\u540C\u4E00\u4E2A\u95EE\u9898"),
                    React.createElement("button", { className: "text-button", onClick: () => this.run(async () => { await request('/settings', 'POST', { hide_object: s.walkObject.id }); await this.refresh(false); this.setState({ walkObject: null }); }) }, "\u522B\u518D\u7ED9\u6211\u770B\u8FD9\u6761")),
                React.createElement("button", { className: "primary", disabled: !semantic, onClick: () => this.run(async () => {
                        const data = await request('/walk', 'POST', { previous_id: s.walkObject?.id, exclude_ids: s.walkPath });
                        if (!data.object) {
                            this.toast('这次路径走到这里，休息一下。');
                            return;
                        }
                        this.setState({ walkObject: data.object, walkJump: data.jump, walkPath: [...s.walkPath, data.object.id] });
                    }) },
                    s.walkObject ? '继续走一段' : '开始漫步',
                    React.createElement(Icon, { name: "arrow", size: 16 })),
                !semantic && React.createElement("p", { className: "service-notice" }, "\u9700\u8981\u5411\u91CF\u7D22\u5F15\uFF0C\u4E0D\u7528\u968F\u673A\u62BD\u7B7E\u5192\u5145\u8BED\u4E49\u6F2B\u6B65\u3002")));
    }
    renderInsightResult() {
        const s = this.state;
        if (s.reading)
            return React.createElement("div", { className: "insight-result quiet-reading" }, "\u5728\u8BFB\u3002\u4E5F\u5728\u5BFB\u627E\u503C\u5F97\u95EE\u4F60\u7684\u95EE\u9898\u3002");
        if (!s.insight)
            return null;
        if (s.insight.silent)
            return React.createElement("div", { className: "insight-result" },
                React.createElement("p", { className: "metadata" }, "\u6682\u65F6\u6CA1\u4EC0\u4E48\u53EF\u8BF4\u7684\u3002"));
        return React.createElement("article", { className: "insight-result ai-object" },
            React.createElement("span", { className: "eyebrow" }, "AI\u751F\u6210 \u00B7 \u4E0D\u66FF\u4EE3\u4F60\u7684\u5224\u65AD"),
            React.createElement("p", null, s.insight.text),
            React.createElement("div", { className: "citations" }, s.insight.citations.map((id, i) => React.createElement("button", { key: id, onClick: () => this.select(id) },
                i + 1,
                ". ",
                this.object(id)?.title))),
            s.insight.citations.length > 1 && React.createElement("button", { className: "text-button", onClick: () => this.run(() => this.recognize(s.insight.citations[0], s.insight.citations[1])) },
                "\u6211\u8BA4\u51FA\u4E86\u540C\u4E00\u4E2A\u95EE\u9898 ",
                React.createElement(Icon, { name: "arrow", size: 14 })));
    }
    renderMain() {
        const s = this.state;
        const canvas = s.view === 'canvas' ? this.object(s.scope) : null;
        return React.createElement("main", { className: "main-pane" },
            this.renderTop(),
            s.window === 'custom' && ['recent', 'timeline', 'canvas'].includes(s.view) && React.createElement("div", { className: "custom-range" },
                React.createElement("input", { "aria-label": "\u8D77\u59CB\u65E5\u671F", type: "date", value: s.custom.from, onChange: e => this.setState({ custom: { ...s.custom, from: e.target.value } }) }),
                React.createElement("span", null, "\u81F3"),
                React.createElement("input", { "aria-label": "\u7ED3\u675F\u65E5\u671F", type: "date", value: s.custom.to, onChange: e => this.setState({ custom: { ...s.custom, to: e.target.value } }) })),
            canvas ? React.createElement("div", { className: "canvas-page" },
                React.createElement("div", { className: "canvas-breadcrumb" },
                    React.createElement(Icon, { name: "canvas", size: 17 }),
                    s.breadcrumbs.map((id, i) => React.createElement("div", { key: i },
                        React.createElement("button", { onClick: () => this.setState({ scope: id, breadcrumbs: s.breadcrumbs.slice(0, i + 1) }) }, this.object(id)?.title),
                        i < s.breadcrumbs.length - 1 && React.createElement(Icon, { name: "chevron", size: 13 }))),
                    React.createElement("span", { className: "metadata" }, "\u81EA\u7531\u6446\u653E")),
                React.createElement(Canvas, { key: canvas.id, canvas: canvas, objects: this.objects(), placements: s.snapshot.placements, relations: s.snapshot.relations, kinds: this.kinds(), selected: s.selected, window: s.window, custom: s.custom, timezone: s.snapshot.user.timezone, globalDisplay: s.snapshot.user.settings.canvas_display ?? 'collapse_body', onSelect: id => this.select(id), onEnter: this.enterCanvas, onPlacement: this.placement, onConnect: this.connect, onNew: this.newCanvasObject, onError: this.fail, onRemove: id => this.run(async () => {
                        const p = s.snapshot.placements.find((p) => p.canvas_id === canvas.id && p.object_id === id);
                        if (p)
                            await this.placement({ ...p, deleted_at: Date.now() });
                    }) })) : s.view === 'settings' ? this.renderSettings() : React.createElement("div", { className: 'main-content ' + (['insight', 'map', 'walk'].includes(s.view) ? 'discovery-page' : '') },
                React.createElement("section", { className: "page-heading" },
                    React.createElement("span", { className: "eyebrow" }, s.view === 'recent' ? dateLabel(Date.now(), true).split(' ')[0] : s.scope ? '领域里的思考' : 'YOUR QUIET SPACE'),
                    React.createElement("h1", null, s.scope ? this.object(s.scope)?.title : pageTitles[s.view]),
                    React.createElement("p", null, descriptions[s.view] ?? '让资料、想法和判断，在同一个地方相遇。')),
                ['insight', 'map', 'walk'].includes(s.view) ? this.renderDiscovery() : React.createElement("div", { className: "list-content" },
                    s.view === 'recent' && React.createElement("button", { className: "inline-capture", onClick: this.openCapture },
                        React.createElement("span", null, "\u6B64\u523B\uFF0C\u60F3\u5230\u4EC0\u4E48\uFF1F"),
                        React.createElement("span", { className: "input-shortcut" },
                            React.createElement("kbd", null, "\u2318 \u21E7 Space"),
                            React.createElement(Icon, { name: "plus", size: 17 }))),
                    React.createElement("div", { className: "content-bar" },
                        React.createElement("div", { className: "display-switch" },
                            React.createElement("button", { className: s.mode === 'list' ? 'active' : '', onClick: () => this.setState({ mode: 'list' }) },
                                React.createElement(Icon, { name: "list", size: 15 }),
                                " \u5217\u8868"),
                            s.view === 'actions' && this.kind('action')?.properties.status?.type === 'label' && React.createElement("button", { className: s.mode === 'board' ? 'active' : '', onClick: () => this.setState({ mode: 'board' }) },
                                React.createElement(Icon, { name: "board", size: 15 }),
                                " \u770B\u677F")),
                        !['actions', 'memory', 'canvases'].includes(s.view) && React.createElement("select", { "aria-label": "\u6309\u7C7B\u578B\u7B5B\u9009", className: "minimal-select", value: s.kindFilter, onChange: e => this.setState({ kindFilter: e.target.value }) },
                            React.createElement("option", { value: "" }, "\u6240\u6709\u7C7B\u578B"),
                            this.kinds().map(k => React.createElement("option", { key: k.id, value: k.id }, k.label))),
                        React.createElement("span", { className: "metadata" }, s.view === 'memory' ? '手动确认 · 保留变化' : '按捕获时间')),
                    this.renderList(),
                    React.createElement("div", { className: "list-footnote" }, s.view === 'recent' ? '不用清空，也没有必须处理的数量。' : s.view === 'memory' ? '改错字是编辑，改主意是推翻。' : '每一条内容，只保存一份。'))));
    }
    renderProperty(o, name, p) {
        const value = o[name] ?? o.extra[name] ?? '';
        const update = (v) => this.run(() => this.save(o, name in o ? name : 'extra', name in o ? v : { ...o.extra, [name]: v }));
        let control;
        if (p.type === 'label' && p.multiple) {
            const values = Array.isArray(value) ? value : [];
            control = React.createElement("div", { className: "multi-labels" }, (p.options ?? []).map(v => React.createElement("label", { key: v },
                React.createElement("input", { type: "checkbox", checked: values.includes(v), onChange: e => update(e.target.checked ? [...values, v] : values.filter((x) => x !== v)) }),
                statusLabel[v] ?? v)));
        }
        else if (p.type === 'label')
            control = React.createElement("select", { value: value, onChange: e => update(e.target.value || null) },
                React.createElement("option", { value: "" }, "\u2014"),
                (p.options ?? []).map(v => React.createElement("option", { key: v, value: v }, statusLabel[v] ?? v)));
        else if (p.type === 'object')
            control = React.createElement("select", { value: value, onChange: e => update(e.target.value || null) },
                React.createElement("option", { value: "" }, "\u2014"),
                this.objects().filter(x => !x.deleted_at && (!p.kinds?.length || p.kinds.includes(x.kind ?? ''))).map(x => React.createElement("option", { key: x.id, value: x.id }, x.title)));
        else if (p.type === 'checkbox')
            control = React.createElement("input", { type: "checkbox", checked: !!value, onChange: e => update(e.target.checked) });
        else
            control = React.createElement("input", { key: o.id + '-' + name + '-' + String(value), defaultValue: p.type === 'datetime' && value ? new Date(Number(value) - new Date(Number(value)).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : value, type: p.type === 'datetime' ? 'datetime-local' : p.type === 'number' ? 'number' : 'text', onBlur: e => {
                    const v = p.type === 'datetime' ? (e.target.value ? new Date(e.target.value).getTime() : null) : p.type === 'number' ? (e.target.value ? Number(e.target.value) : null) : e.target.value;
                    if (v !== value)
                        update(v);
                } });
        return React.createElement("div", { className: "property-row", key: name },
            React.createElement(Icon, { name: p.type === 'datetime' ? 'clock' : 'tag', size: 14 }),
            React.createElement("label", null, p.label ?? labels[name] ?? name),
            React.createElement("div", null, control));
    }
    renderProperties(o) {
        const k = this.kind(o.kind);
        return React.createElement("div", { className: "properties" },
            React.createElement("div", { className: "property-row" },
                React.createElement("span", { style: { color: k?.color } }, k?.icon ?? '◌'),
                React.createElement("label", null, "\u7C7B\u578B"),
                React.createElement("select", { "aria-label": "\u5BF9\u8C61\u7C7B\u578B", value: o.kind ?? '', disabled: o.form === 'canvas', onChange: e => this.run(() => this.setKind(o, e.target.value || null)) },
                    React.createElement("option", { value: "" }, "\u672A\u63D0\u70BC"),
                    this.kinds().filter(k => o.form === 'canvas' || k.id !== 'canvas').map(k => React.createElement("option", { key: k.id, value: k.id }, k.label)))),
            React.createElement("div", { className: "property-row" },
                React.createElement(Icon, { name: "folder", size: 14 }),
                React.createElement("label", null, "\u5F52\u5C5E"),
                React.createElement("select", { "aria-label": "\u5BF9\u8C61\u5F52\u5C5E", value: o.parent_id ?? '', onChange: e => this.run(() => this.save(o, 'parent_id', e.target.value || null)) },
                    React.createElement("option", { value: "" }, "\u65E0\u5F52\u5C5E"),
                    this.objects().filter(p => p.id !== o.id && !p.deleted_at && ['domain', 'project'].includes(p.kind ?? '')).map(p => React.createElement("option", { key: p.id, value: p.id }, p.title)))),
            React.createElement("div", { className: "property-row" },
                React.createElement(Icon, { name: "tag", size: 14 }),
                React.createElement("label", null, "\u6807\u7B7E"),
                React.createElement("div", { className: "tag-values" },
                    o.tags_cached.map(tag => React.createElement("button", { key: tag, title: "\u79FB\u9664\u6B64\u6807\u7B7E", onClick: () => this.run(() => this.save(o, 'tag', { tag, deleted_at: Date.now() }, false)) },
                        "#",
                        tag,
                        React.createElement("span", null, "\u00D7"))),
                    React.createElement("button", { "aria-label": "\u6DFB\u52A0\u6807\u7B7E", onClick: () => this.run(async () => {
                            const tag = prompt('添加一个跨类型标签');
                            if (tag?.trim())
                                await this.save(o, 'tag', { tag: tag.trim().replace(/^#/, '') }, false);
                        }) },
                        React.createElement(Icon, { name: "plus", size: 12 })))),
            React.createElement("div", { className: "property-row" },
                React.createElement(Icon, { name: "list", size: 14 }),
                React.createElement("label", null, "\u7CFB\u5217"),
                React.createElement("input", { key: o.id + '-series', "aria-label": "\u7CFB\u5217", placeholder: "\u2014", defaultValue: o.series ?? '', onBlur: e => {
                        if ((e.target.value || null) !== o.series)
                            this.run(() => this.save(o, 'series', e.target.value || null));
                    } })),
            Object.entries(k?.properties ?? {}).map(([name, p]) => this.renderProperty(o, name, p)),
            o.ephemeral && React.createElement("div", { className: "ephemeral-note" },
                "\u8FD9\u6761\u53EA\u6D3B\u5728\u5F53\u524D\u753B\u5E03\u4E0A\u3002",
                React.createElement("button", { onClick: () => this.run(() => this.save(o, 'ephemeral', false)) }, "\u8F6C\u4E3A\u6B63\u5F0F\u5BF9\u8C61")));
    }
    renderMedia(o) {
        if (!o.asset_id)
            return null;
        const url = this.state.assetUrls?.[o.asset_id];
        if (!url)
            return React.createElement("button", { className: "media-placeholder", onClick: () => this.run(async () => { const data = isDesktop() ? await request('/assets/' + o.asset_id + '/url') : await request('/assets/' + o.asset_id + '/url'); this.setState({ assetUrls: { ...this.state.assetUrls, [o.asset_id]: data.url } }); }) },
                "\u67E5\u770B",
                o.form === 'image' ? '图片' : o.form === 'audio' ? '音频' : '视频',
                " ",
                React.createElement(Icon, { name: "eye", size: 16 }));
        return o.form === 'image' ? React.createElement("img", { className: "object-image", src: url, alt: o.title }) : o.form === 'audio' ? React.createElement("audio", { controls: true, src: url }) : React.createElement("video", { controls: true, src: url });
    }
    renderObjectBody(o, full = false) { const s = this.state; const frozen = !!o.source_id || o.kind === 'artifact'; return React.createElement("div", { className: "object-body" },
        React.createElement("div", { className: "section-heading" },
            React.createElement("span", null, "\u9644\u6587"),
            isDesktop() && !frozen && !full && React.createElement("button", { onClick: this.startEdit },
                "\u7F16\u8F91 ",
                React.createElement("kbd", null, "\u21B5"))),
        this.renderMedia(o),
        o.form === 'link' && /^https?:\/\//.test(o.title) && React.createElement("a", { className: "external-link", href: o.title, target: "_blank", rel: "noreferrer" },
            "\u6253\u5F00\u539F\u94FE\u63A5 ",
            React.createElement(Icon, { name: "external", size: 14 })),
        (o.body_blocks.blocks.length ? sortedBlocks(o.body_blocks.blocks).map(b => React.createElement("p", { key: b.id, id: 'block-' + b.id, className: "body-paragraph" }, this.renderMarkup(b.text, !!o.source_id))) : o.body ? React.createElement("p", { className: "body-paragraph" }, this.renderMarkup(o.body, !!o.source_id)) : React.createElement("p", { className: "empty-body" }, "\u6682\u65F6\u6CA1\u6709\u9644\u6587\u3002\u4E3B\u4F53\u672C\u8EAB\u4E5F\u53EF\u4EE5\u662F\u4E00\u4EFD\u5B8C\u6574\u7684\u60F3\u6CD5\u3002")),
        !isDesktop() && !full && React.createElement("p", { className: "web-read-note" }, "Web \u7AEF\u53EA\u8BFB\u9644\u6587 \u00B7 \u5B8C\u6574\u7F16\u8F91\u5728\u684C\u9762\u7AEF"),
        frozen && React.createElement("p", { className: "web-read-note" }, o.source_id ? '来自外部的冻结快照，原文不会被自动覆盖。' : '产物内容不可变；需要修改时另建一条。')); }
    renderEditor(o) { const s = this.state; return React.createElement("div", { className: "block-editor" },
        React.createElement("input", { className: "edit-title", value: s.draftTitle, "aria-label": "\u4E3B\u4F53", onChange: e => this.setState({ draftTitle: e.target.value }) }),
        s.draftBlocks.map((b, index) => React.createElement("div", { className: "block-edit", key: b.id },
            React.createElement("textarea", { value: b.text, "aria-label": `第${index + 1}段`, onChange: e => { const value = e.target.value; this.setState({ draftBlocks: s.draftBlocks.map((x) => x.id === b.id ? { ...x, text: value } : x) }); } }),
            React.createElement("div", null,
                React.createElement("button", { title: "\u5728\u6B64\u6BB5\u540E\u63D2\u5165", onClick: () => { const blocks = [...s.draftBlocks]; blocks.splice(index + 1, 0, { id: uid(), key: keyBetween(b.key, blocks[index + 1]?.key ?? null), text: '' }); this.setState({ draftBlocks: blocks }); } },
                    React.createElement(Icon, { name: "plus", size: 12 })),
                React.createElement("button", { title: "\u5220\u9664\u6B64\u6BB5", onClick: () => this.setState({ draftBlocks: s.draftBlocks.filter((x) => x.id !== b.id) }) },
                    React.createElement(Icon, { name: "trash", size: 12 }))))),
        !s.draftBlocks.length && React.createElement("button", { className: "text-button", onClick: () => this.setState({ draftBlocks: [{ id: uid(), key: keyBetween(null, null), text: '' }] }) }, "\u52A0\u4E00\u6BB5\u81EA\u5DF1\u7684\u8BDD"),
        React.createElement("div", { className: "button-row" },
            React.createElement("button", { className: "primary", onClick: () => this.run(this.saveEdit) }, "\u4FDD\u5B58"),
            React.createElement("button", { onClick: () => this.setState({ editing: false }) }, "\u53D6\u6D88")),
        React.createElement("p", { className: "metadata" }, "\u6BCF\u6BB5\u4FDD\u7559\u72EC\u7ACBID\u3002\u5E76\u53D1\u7F16\u8F91\u540C\u4E00\u6BB5\u65F6\uFF0C\u8986\u76D6\u8BB0\u5F55\u53EF\u5728\u7248\u672C\u4E2D\u627E\u56DE\u3002")); }
    renderProposals(o) {
        const s = this.state, proposals = s.snapshot.proposals.filter((p) => p.object_id === o.id && p.status === 'pending');
        const history = s.snapshot.proposals.filter((p) => p.object_id === o.id && p.status !== 'pending');
        return React.createElement("div", { className: "proposal-area" },
            React.createElement("div", { className: "section-heading" },
                React.createElement("span", null, "\u4F60\u7684\u5224\u65AD\uFF0C\u5728\u524D\u9762\u3002"),
                React.createElement("button", { disabled: !s.snapshot.capabilities.ai || s.reading, onClick: () => this.run(this.distill) },
                    React.createElement(Icon, { name: "spark", size: 14 }),
                    s.reading ? '在读…' : '请 AI 提议')),
            !s.snapshot.capabilities.ai && React.createElement("p", { className: "service-notice" }, "AI\u5C1A\u672A\u8FDE\u63A5\uFF0C\u4ECD\u53EF\u4EE5\u624B\u52A8\u63D0\u70BC\u3002"),
            proposals.map((p) => React.createElement("div", { className: "proposal", key: p.id },
                React.createElement("span", { className: "eyebrow" },
                    "AI \u5EFA\u8BAE \u00B7 ",
                    labels[p.field] ?? p.field),
                React.createElement("strong", null, p.field === 'kind' ? this.kind(p.ai_value)?.label : p.field === 'parent_id' ? this.object(p.ai_value)?.title : Array.isArray(p.ai_value) ? p.ai_value.join(' · ') : statusLabel[p.ai_value] ?? String(p.ai_value)),
                React.createElement("div", { className: "button-row" },
                    React.createElement("button", { className: "primary", onClick: () => this.run(async () => { await request('/proposals/decide', 'POST', { id: p.id, status: 'accepted' }); await this.refresh(false); }) }, "\u91C7\u7EB3"),
                    React.createElement("button", { onClick: () => this.run(async () => {
                            const text = prompt('改成什么？类型/归属使用ID，多值用逗号分开。', Array.isArray(p.ai_value) ? p.ai_value.join(',') : String(p.ai_value));
                            if (text === null)
                                return;
                            const value = Array.isArray(p.ai_value) ? text.split(',').map(x => x.trim()).filter(Boolean) : text;
                            await request('/proposals/decide', 'POST', { id: p.id, status: 'edited', value });
                            await this.refresh(false);
                        }) }, "\u6539\u4E00\u4E0B"),
                    React.createElement("button", { onClick: () => this.run(async () => { await request('/proposals/decide', 'POST', { id: p.id, status: 'rejected' }); await this.refresh(false); }) }, "\u8DF3\u8FC7")))),
            history.length > 0 && React.createElement("details", { className: "proposal-history" },
                React.createElement("summary", null, "\u67E5\u770B\u6211\u7684\u5224\u65AD\u8BB0\u5F55"),
                history.map((p) => React.createElement("div", { key: p.id },
                    React.createElement("span", null,
                        labels[p.field] ?? p.field,
                        " \u00B7 ",
                        p.status === 'accepted' ? '采纳' : p.status === 'edited' ? '改写' : '跳过'),
                    React.createElement("p", null,
                        "\u5EFA\u8BAE\uFF1A",
                        JSON.stringify(p.ai_value),
                        React.createElement("br", null),
                        "\u51B3\u5B9A\uFF1A",
                        JSON.stringify(p.final_value))))),
            React.createElement("p", { className: "metadata" }, "\u5EFA\u8BAE\u4E0E\u51B3\u5B9A\u5206\u522B\u7559\u75D5\u3002\u8FD9\u91CC\u4E0D\u8BA1\u7B97\u865A\u5047\u7684\u201C\u601D\u8003\u5360\u6BD4\u201D\u3002"));
    }
    renderRelations(o) { const s = this.state; const active = s.snapshot.relations.filter((r) => !r.deleted_at); const out = active.filter((r) => r.from_id === o.id), incoming = active.filter((r) => r.to_id === o.id); const edge = (r, direction) => { const id = direction === 'out' ? r.to_id : r.from_id; return React.createElement("button", { key: [r.from_id, r.to_id, r.source_field, r.source_block_id].join('-'), className: "context-item", draggable: true, onDragStart: e => e.dataTransfer.setData('drill/object', id), onClick: () => this.select(id) },
        React.createElement("span", null, this.object(id)?.title ?? '对象已不可见'),
        r.source_block_id && React.createElement("small", { onClick: e => { e.stopPropagation(); this.select(r.from_id, 'read'); setTimeout(() => document.getElementById('block-' + r.source_block_id)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100); } }, "\u56DE\u5230\u539F\u6BB5\u843D \u2197"),
        React.createElement(Icon, { name: "arrow", size: 14 })); }; return React.createElement("div", null,
        React.createElement("section", { className: "context-section" },
            React.createElement("div", { className: "section-heading" },
                React.createElement("span", null, "\u76F8\u5173"),
                React.createElement("small", null, s.related.mode === 'semantic' ? '向量相似' : s.related.mode === 'offline' ? '联网后可用' : '字面相近')),
            s.related.items.length ? s.related.items.map((x) => React.createElement("button", { key: x.object.id, className: "context-item", draggable: true, onDragStart: e => e.dataTransfer.setData('drill/object', x.object.id), onClick: () => this.select(x.object.id) },
                React.createElement("span", null, x.object.title),
                React.createElement("small", null, dateLabel(x.object.captured_at)),
                React.createElement(Icon, { name: "arrow", size: 13 }))) : React.createElement("p", { className: "context-empty" }, "\u8FD8\u6CA1\u6709\u8DB3\u591F\u76F8\u4F3C\u7684\u5185\u5BB9\u3002")),
        React.createElement("section", { className: "context-section" },
            React.createElement("div", { className: "section-heading" },
                React.createElement("span", null, "\u5C40\u90E8\u56FE"),
                React.createElement("button", { onClick: () => this.setState({ graphDepth: s.graphDepth === 1 ? 2 : 1 }) }, s.graphDepth === 1 ? '展开两跳' : '收回一跳')),
            !out.length && !incoming.length ? React.createElement("p", { className: "context-empty" }, "\u8FD9\u6761\u8FD8\u6CA1\u6709\u5173\u8054\u3002") : React.createElement("div", { className: "local-graph" },
                React.createElement("div", { className: "graph-direction" },
                    React.createElement(Icon, { name: "arrow", size: 14 }),
                    " \u5B83\u5F15\u7528\u4E86\u8C01"),
                out.map((r) => edge(r, 'out')),
                React.createElement("div", { className: "graph-direction incoming" },
                    React.createElement(Icon, { name: "back", size: 14 }),
                    " \u8C01\u5F15\u7528\u4E86\u5B83"),
                incoming.map((r) => edge(r, 'in')),
                s.graphDepth === 2 && React.createElement("div", { className: "second-hop" },
                    React.createElement("span", { className: "metadata" }, "\u518D\u5F80\u5916\u4E00\u8DF3"),
                    active.filter((r) => r.from_id !== o.id && r.to_id !== o.id && [...out.map((x) => x.to_id), ...incoming.map((x) => x.from_id)].includes(r.from_id)).slice(0, 20).map((r) => edge(r, 'out')))),
            React.createElement("button", { className: "text-button", onClick: () => this.setState({ modal: 'link' }) },
                React.createElement(Icon, { name: "plus", size: 13 }),
                " \u624B\u52A8\u6302\u4E00\u4E2A\u5F15\u7528")),
        React.createElement("section", { className: "context-section" },
            React.createElement("div", { className: "section-heading" },
                React.createElement("span", null, "\u6D1E\u5BDF"),
                React.createElement("button", { disabled: !s.snapshot.capabilities.ai || s.reading, onClick: () => this.run(() => this.askAI(o.id)) },
                    React.createElement(Icon, { name: "spark", size: 14 }),
                    " \u70B9\u4E00\u4E0B")),
            !s.snapshot.capabilities.ai ? React.createElement("p", { className: "context-empty" }, "\u8FDE\u63A5 AI \u540E\uFF0C\u4E3B\u52A8\u5F00\u542F\u4E00\u6B21\u601D\u8003\u3002") : this.renderInsightResult()),
        React.createElement("button", { className: "text-button", onClick: () => this.run(() => this.recognize(o.id)) },
            "\u6211\u8BA4\u51FA\u4E86\u4E00\u4E2A\u91CD\u590D\u7684\u95EE\u9898 ",
            React.createElement(Icon, { name: "arrow", size: 13 }))); }
    renderRight() {
        const s = this.state, o = this.selected();
        if (!s.right)
            return null;
        return React.createElement("aside", { className: "right-pane" },
            React.createElement("header", { className: "right-header" },
                React.createElement("span", null, "\u4E0A\u4E0B\u6587"),
                React.createElement("button", { title: "\u6298\u53E0\u4E0A\u4E0B\u6587\u680F", onClick: () => this.setState({ right: false }) },
                    React.createElement(Icon, { name: "panel", size: 16 }))),
            !o ? React.createElement("div", { className: "right-empty" },
                React.createElement(Icon, { name: "select", size: 24 }),
                React.createElement("p", null, "\u9009\u4E00\u6761\uFF0C\u6162\u6162\u60F3\u3002"),
                React.createElement("span", null,
                    "\u63D0\u70BC\u3001\u76F8\u5173\u4E0E\u6D1E\u5BDF\uFF0C",
                    React.createElement("br", null),
                    "\u90FD\u4ECE\u4E00\u4EFD\u5177\u4F53\u7684\u5185\u5BB9\u5F00\u59CB\u3002")) : React.createElement("div", { className: "right-scroll" },
                React.createElement("div", { className: "object-identity" },
                    React.createElement("span", { className: "object-kind", style: { color: this.kind(o.kind)?.color } },
                        this.kind(o.kind)?.icon ?? '◌',
                        " ",
                        React.createElement("span", null, this.kind(o.kind)?.label ?? '未提炼')),
                    React.createElement("button", { title: "\u5BF9\u8C61\u83DC\u5355", onClick: () => this.setState({ modal: 'object-actions' }) },
                        React.createElement(Icon, { name: "more", size: 18 }))),
                React.createElement("h2", { className: "object-title" }, o.title),
                React.createElement("div", { className: "object-time" },
                    React.createElement(Icon, { name: "clock", size: 12 }),
                    React.createElement("span", null, dateLabel(o.captured_at, true))),
                React.createElement("nav", { className: "context-tabs" }, [['read', '内容'], ['distill', '提炼'], ['relations', '关联']].map(([tab, label]) => React.createElement("button", { key: tab, className: s.tab === tab ? 'active' : '', onClick: () => this.setState({ tab }) }, label))),
                s.snapshot.conflicts.some((c) => c.object_id === o.id && c.resolution === 'lost') && React.createElement("button", { className: "conflict-alert", onClick: () => this.setState({ modal: 'conflicts' }) }, "\u6709\u4E00\u6B21\u4FEE\u6539\u88AB\u8986\u76D6\u4E86\uFF0C\u70B9\u5F00\u770B \u2197"),
                s.editing ? this.renderEditor(o) : s.tab === 'relations' ? this.renderRelations(o) : React.createElement("div", null,
                    this.renderProperties(o),
                    s.tab === 'distill' ? this.renderProposals(o) : this.renderObjectBody(o),
                    o.kind === 'self' && React.createElement("div", { className: "self-actions" },
                        React.createElement("p", null, o.valid_until ? '这条判断已失效，来路仍然保留。' : o.confirmed_at ? '上次确认：' + dateLabel(o.confirmed_at) : '这条判断，今天还成立吗？'),
                        !o.valid_until && React.createElement("div", { className: "button-row" },
                            React.createElement("button", { onClick: () => this.run(() => this.save(o, 'confirmed_at', Date.now())) }, "\u6211\u8FD8\u8FD9\u4E48\u60F3"),
                            React.createElement("button", { onClick: () => this.run(async () => {
                                    const title = prompt('现在，你的看法是什么？');
                                    if (!title?.trim())
                                        return;
                                    const next = makeObject(title.trim(), s.snapshot.user.id, { kind: 'self', parent_id: o.parent_id, applies_to: o.applies_to, supersedes_id: o.id });
                                    await this.create(next);
                                    this.select(next.id);
                                }) }, "\u6211\u6539\u4E3B\u610F\u4E86")))),
                React.createElement("footer", { className: "object-meta" },
                    React.createElement("button", { onClick: () => this.run(this.versions) },
                        "\u7248\u672C \u00B7 \u6539\u8FC7 ",
                        Math.max(0, o.rev - 1),
                        " \u6B21 ",
                        React.createElement(Icon, { name: "chevron", size: 12 })),
                    React.createElement("span", null,
                        "\u6765\u6E90 \u00B7 ",
                        o.source_id ? s.snapshot.sources.find((x) => x.id === o.source_id)?.name ?? '外部快照' : o.kind === 'ai_output' ? 'AI生成' : '自己写'),
                    o.source_id && Object.entries(s.snapshot.sources.find((x) => x.id === o.source_id)?.properties ?? {}).map(([key, p]) => React.createElement("span", { key: key },
                        p.label ?? key,
                        " \u00B7 ",
                        String(o.extra[key] ?? '—')))),
                s.tab === 'read' && React.createElement("div", { className: "quiet-related" },
                    React.createElement("div", { className: "section-heading" },
                        React.createElement("span", null, "\u7EE7\u7EED\u60F3\u4E00\u5C42"),
                        React.createElement("button", { onClick: () => this.setState({ tab: 'relations' }) },
                            "\u76F8\u5173\u4E0E\u6D1E\u5BDF ",
                            React.createElement(Icon, { name: "arrow", size: 13 }))),
                    s.related.items.slice(0, 2).map((x) => React.createElement("button", { key: x.object.id, onClick: () => this.select(x.object.id) },
                        x.object.title,
                        React.createElement(Icon, { name: "arrow", size: 12 }))))));
    }
    renderSettings() {
        const s = this.state, snap = s.snapshot;
        return React.createElement("div", { className: "settings-page" },
            React.createElement("h1", null, "\u504F\u597D\u4E0E\u8FDE\u63A5"),
            React.createElement("section", null,
                React.createElement("h3", null, "\u8FD9\u4EFD\u7A7A\u95F4"),
                React.createElement("div", { className: "settings-row" },
                    React.createElement("label", null, "\u672C\u5730\u65F6\u533A"),
                    React.createElement("select", { value: snap.user.timezone, onChange: e => this.run(async () => { await request('/settings', 'POST', { timezone: e.target.value }); await this.refresh(false); }) }, ['Asia/Shanghai', 'Asia/Hong_Kong', 'Asia/Tokyo', 'Europe/London', 'America/New_York', 'America/Los_Angeles', 'UTC'].map(v => React.createElement("option", { key: v }, v)))),
                React.createElement("div", { className: "settings-row" },
                    React.createElement("label", null, "\u753B\u5E03\u9ED8\u8BA4\u663E\u793A"),
                    React.createElement("select", { value: snap.user.settings.canvas_display ?? 'collapse_body', onChange: e => this.run(async () => { await request('/settings', 'POST', { canvas_display: e.target.value }); await this.refresh(false); }) },
                        React.createElement("option", { value: "title_only" }, "\u53EA\u663E\u793A\u4E3B\u4F53"),
                        React.createElement("option", { value: "collapse_body" }, "\u6298\u53E0\u9644\u6587"),
                        React.createElement("option", { value: "full" }, "\u5168\u90E8\u663E\u793A"))),
                React.createElement("button", { className: "secondary", onClick: () => this.run(async () => download('drill-export-' + new Date().toISOString().slice(0, 10) + '.json', await request('/export'))) },
                    React.createElement(Icon, { name: "download", size: 15 }),
                    " \u5BFC\u51FA\u6211\u7684\u6570\u636E"),
                React.createElement("p", { className: "metadata" }, "\u5BFC\u51FA\u5305\u542B\u5BF9\u8C61\u3001\u5173\u7CFB\u3001\u5E03\u5C40\u4E0E\u7248\u672C\u3002\u5A92\u4F53\u539F\u4EF6\u4ECD\u5728\u539F\u5B58\u50A8\u4E2D\uFF0C\u8BF7\u53E6\u5916\u5907\u4EFD\u3002")),
            React.createElement("section", null,
                React.createElement("h3", null, "\u670D\u52A1\u72B6\u6001"),
                React.createElement("div", { className: "settings-row" },
                    React.createElement("label", null, "\u5F53\u524D\u8FD0\u884C\u65B9\u5F0F"),
                    React.createElement("span", null, isDesktop() ? 'Electron · SQLite 本地库' : snap.capabilities.demo ? '本机示例 · JSON存储（非正式后端）' : 'Web · 纯在线')),
                React.createElement("div", { className: "settings-row" },
                    React.createElement("label", null, "AI \u63D0\u8BAE\u4E0E\u6D1E\u5BDF"),
                    React.createElement("span", null, snap.capabilities.ai ? '已配置' : '未连接')),
                React.createElement("div", { className: "settings-row" },
                    React.createElement("label", null, "bge-m3 \u5411\u91CF"),
                    React.createElement("span", null, snap.capabilities.semantic ? '已配置' : '未连接 · 字面搜索可用')),
                snap.capabilities.semantic && React.createElement("button", { className: "secondary", onClick: () => this.run(async () => {
                        let offset = 0, done = false;
                        while (!done) {
                            const data = await request('/search/reindex', 'POST', { offset });
                            offset = data.next_offset;
                            done = data.done;
                            this.toast(`已索引 ${offset} 条`);
                        }
                    }) }, "\u624B\u52A8\u5EFA\u7ACB / \u5237\u65B0\u5411\u91CF\u7D22\u5F15"),
                React.createElement("p", { className: "metadata" }, "\u6A21\u578B\u5BC6\u94A5\u53EA\u653E\u5728\u670D\u52A1\u7AEF\u73AF\u5883\u53D8\u91CF\u91CC\uFF0C\u4E0D\u5B58\u8FDB\u6D4F\u89C8\u5668\u3002\u670D\u52A1\u672A\u914D\u7F6E\u65F6\u4E0D\u4F1A\u751F\u6210\u865A\u6784\u7ED3\u679C\u3002"),
                isDesktop() && React.createElement("div", null,
                    React.createElement("button", { className: "secondary", onClick: () => this.run(async () => { await window.drill.sync(); await this.refresh(false); }) }, "\u7ACB\u5373\u540C\u6B65"),
                    React.createElement("pre", null, s.syncState?.error ?? '本地内容已保存'),
                    React.createElement("button", { className: "secondary", onClick: () => this.setState({ modal: 'connect' }) }, "\u8FDE\u63A5\u540C\u4E00\u4E2A\u540E\u7AEF"))),
            React.createElement("section", null,
                React.createElement("h3", null, "\u8FDE\u63A5\u5668"),
                React.createElement("p", null, "\u5916\u90E8\u5185\u5BB9\u662F\u8BC1\u636E\uFF0C\u4E0D\u662F\u66FF\u4F60\u5B8C\u6210\u7684\u601D\u8003\u3002\u53EA\u8BFB\u62C9\u53D6\uFF0C\u4E0D\u56DE\u5199\u3002"),
                snap.sources.map((src) => React.createElement("div", { className: "source-card", key: src.id },
                    React.createElement("div", null,
                        React.createElement("strong", null, src.name),
                        React.createElement("span", { className: "metadata" }, src.last_synced ? '上次同步 ' + dateLabel(src.last_synced, true) : '还没有拉取')),
                    src.state.error && React.createElement("p", { className: "amber" }, src.state.error),
                    Object.keys(src.state.new_versions ?? {}).length > 0 && React.createElement("p", null,
                        "\u53D1\u73B0 ",
                        Object.keys(src.state.new_versions ?? {}).length,
                        " \u4E2A\u65B0\u7248\u672C\uFF0C\u539F\u5FEB\u7167\u4FDD\u6301\u4E0D\u53D8\u3002"),
                    isDesktop() && React.createElement("button", { onClick: () => this.run(async () => { await window.drill.pullSource(src.id); await this.refresh(false); }) }, "\u62C9\u53D6\u4E00\u6B21"))),
                isDesktop() ? React.createElement("div", { className: "source-form" },
                    React.createElement("select", { value: s.sourceForm.connector, onChange: e => this.setState({ sourceForm: { ...s.sourceForm, connector: e.target.value } }) },
                        React.createElement("option", { value: "obsidian" }, "Obsidian \u6587\u5E93"),
                        React.createElement("option", { value: "chrome" }, "Chrome History"),
                        React.createElement("option", { value: "codex" }, "Codex \u4F1A\u8BDD\u76EE\u5F55")),
                    React.createElement("input", { placeholder: "\u672C\u673A\u76EE\u5F55\u6216History\u6587\u4EF6\u8DEF\u5F84", value: s.sourceForm.path, onChange: e => this.setState({ sourceForm: { ...s.sourceForm, path: e.target.value } }) }),
                    React.createElement("button", { className: "secondary", onClick: () => this.run(async () => { await window.drill.addSource(s.sourceForm); await this.refresh(false); this.toast('连接器已添加，手动拉取时才读取本机内容。'); }) }, "\u6DFB\u52A0\u8FDE\u63A5\u5668")) : React.createElement("p", { className: "service-notice" }, "\u8FDE\u63A5\u5668\u53EA\u5728\u684C\u9762\u7AEF\u8FD0\u884C\u3002Web\u4E0D\u4F1A\u8BFB\u53D6\u672C\u673A\u6587\u4EF6\u6216\u6D4F\u89C8\u5386\u53F2\u3002")),
            React.createElement("section", null,
                React.createElement("h3", null, "\u4E0D\u518D\u51FA\u73B0\u7684\u5185\u5BB9"),
                (snap.user.settings.discovery_hidden ?? []).length ? (snap.user.settings.discovery_hidden ?? []).map((id) => React.createElement("div", { className: "settings-row", key: id },
                    React.createElement("span", null, this.object(id)?.title ?? id),
                    React.createElement("button", { onClick: () => this.run(async () => { await request('/settings', 'POST', { unhide_object: id }); await this.refresh(false); }) }, "\u6062\u590D\u5C55\u793A"))) : React.createElement("p", { className: "metadata" }, "\u8FD8\u6CA1\u6709\u9690\u85CF\u5185\u5BB9\u3002\u9690\u85CF\u4E0D\u7B49\u4E8E\u5220\u9664\u3002")),
            React.createElement("section", null,
                React.createElement("h3", null, "\u952E\u76D8"),
                React.createElement("div", { className: "shortcut-grid" }, [['⌘ K', '搜索与命令'], ['⌘ ⇧ Space', '快速捕获'], ['↑ / ↓', '移动选择'], ['Enter', '临时预览'], ['⌘ Enter', '固定到右栏'], ['⌘ ⇧ Enter', '进入嵌套画布'], ['⌘ Z', '撤销属性修改'], ['Esc', '关闭预览 / 返回上层']].map(([key, text]) => React.createElement("div", { key: key },
                    React.createElement("kbd", null, key),
                    React.createElement("span", null, text))))));
    }
    renderModals() {
        const s = this.state, o = this.selected();
        let title = '', body = null;
        if (s.modal === 'versions') {
            title = '版本与来路';
            body = React.createElement("div", { className: "versions-list" }, !s.versions.length ? React.createElement("p", null, "\u8FD8\u6CA1\u6709\u66F4\u65E9\u7684\u7248\u672C\u3002") : [...s.versions].reverse().map((v) => React.createElement("details", { key: v.rev },
                React.createElement("summary", null,
                    "\u7248\u672C ",
                    v.rev,
                    " \u00B7 ",
                    dateLabel(v.created_at, true)),
                React.createElement("h3", null, v.snapshot.title),
                React.createElement("pre", null, v.snapshot.body))));
        }
        else if (s.modal === 'conflicts') {
            title = '曾被覆盖的修改';
            body = React.createElement("div", null, s.snapshot.conflicts.filter((c) => c.object_id === o?.id && c.resolution === 'lost').map((c) => React.createElement("article", { className: "conflict-record", key: c.id },
                React.createElement("h3", null,
                    c.field,
                    " \u00B7 ",
                    dateLabel(c.created_at, true)),
                React.createElement("p", null,
                    "\u8BBE\u5907\uFF1A",
                    c.device_id,
                    "\u3000\u57FA\u4E8E\u7248\u672C ",
                    c.base_rev),
                React.createElement("pre", null, typeof c.losing_value === 'string' ? c.losing_value : JSON.stringify(c.losing_value, null, 2)))));
        }
        else if (s.modal === 'preview' && o) {
            title = o.title;
            body = this.renderObjectBody(o, true);
        }
        else if (s.modal === 'link' && o) {
            title = '挂一个引用';
            body = React.createElement("div", { className: "pick-list" }, this.objects().filter(x => !x.deleted_at && x.id !== o.id && !['canvas', 'group'].includes(x.kind ?? '')).map(x => React.createElement("button", { key: x.id, onClick: () => this.run(async () => { await this.save(o, 'relation', { to_id: x.id }, false); this.setState({ modal: null }); }) },
                x.title,
                React.createElement(Icon, { name: "plus", size: 14 }))));
        }
        else if (s.modal === 'recognize') {
            title = '认出同一个问题';
            body = React.createElement("div", { className: "pick-list" },
                React.createElement("p", null,
                    "\u8FD9\u6761\uFF1A",
                    this.object(s.recognizeFirst)?.title),
                React.createElement("p", null, "\u8BA9\u4F60\u60F3\u8D77\u4E86\u54EA\u4E00\u6761\uFF1F"),
                this.objects().filter(x => !x.deleted_at && x.id !== s.recognizeFirst && !['canvas', 'group', 'domain', 'project'].includes(x.kind ?? '')).map(x => React.createElement("button", { key: x.id, onClick: () => this.run(() => this.recognize(s.recognizeFirst, x.id)) },
                    x.title,
                    React.createElement(Icon, { name: "link", size: 14 }))));
        }
        else if (s.modal === 'connect') {
            title = '连接你的后端';
            body = React.createElement("form", { className: "connect-form", onSubmit: e => { e.preventDefault(); this.run(async () => { await window.drill.connect({ url: s.backendUrl, password: s.backendPassword, token: s.backendToken }); this.setState({ modal: null }); await this.refresh(false); }); } },
                React.createElement("input", { required: true, placeholder: "https://\u4F60\u7684\u670D\u52A1\u5730\u5740", value: s.backendUrl ?? '', onChange: e => this.setState({ backendUrl: e.target.value }) }),
                React.createElement("input", { type: "password", placeholder: "\u81EA\u6258\u7BA1\u8FDE\u63A5\u53E3\u4EE4", value: s.backendPassword ?? '', onChange: e => this.setState({ backendPassword: e.target.value }) }),
                React.createElement("input", { type: "password", placeholder: "\u6216 CloudBase access_token", value: s.backendToken ?? '', onChange: e => this.setState({ backendToken: e.target.value }) }),
                React.createElement("p", { className: "metadata" }, "\u5DF2\u6709\u672C\u5730\u5185\u5BB9\u540E\u4E0D\u53EF\u5207\u6362\u5230\u53E6\u4E00\u540E\u7AEF\uFF0C\u4EE5\u514D\u6DF7\u5408\u4E24\u4E2A\u771F\u76F8\u6E90\u3002"),
                React.createElement("button", { className: "primary" }, "\u8FDE\u63A5"));
        }
        else if (s.modal === 'object-actions' && o) {
            title = '对象';
            body = React.createElement("div", { className: "object-actions" },
                React.createElement("button", { onClick: () => this.run(async () => {
                        const title = prompt('用自己的话，重写一条理解。');
                        if (!title?.trim())
                            return;
                        const n = makeObject(title.trim(), s.snapshot.user.id, { kind: 'distill', parent_id: o.parent_id });
                        await this.create(n);
                        await this.save(this.object(n.id), 'relation', { to_id: o.id }, false);
                        this.select(n.id);
                        this.setState({ modal: null });
                    }) },
                    "\u7528\u81EA\u5DF1\u7684\u8BDD\u65B0\u5199\u4E00\u6761\u6C89\u6DC0 ",
                    React.createElement(Icon, { name: "arrow", size: 16 })),
                React.createElement("button", { onClick: () => this.run(async () => { await request('/settings', 'POST', { hide_object: o.id }); await this.refresh(false); this.setState({ modal: null }); this.toast('只停止主动发现中的展示，对象仍然保留。'); }) },
                    "\u522B\u518D\u7ED9\u6211\u770B\u8FD9\u6761 ",
                    React.createElement(Icon, { name: "eye", size: 16 })),
                s.view === 'canvas' && React.createElement("div", null,
                    React.createElement("label", null, "\u5728\u8FD9\u5F20\u753B\u5E03\u7684\u663E\u793A"),
                    React.createElement("select", { value: s.snapshot.placements.find((p) => p.object_id === o.id && p.canvas_id === s.scope)?.display ?? '', onChange: e => this.run(async () => {
                            const p = s.snapshot.placements.find((p) => p.object_id === o.id && p.canvas_id === s.scope);
                            if (p)
                                await this.placement({ ...p, display: e.target.value || null });
                        }) },
                        React.createElement("option", { value: "" }, "\u8DDF\u968F\u5168\u5C40"),
                        React.createElement("option", { value: "title_only" }, "\u53EA\u663E\u793A\u4E3B\u4F53"),
                        React.createElement("option", { value: "collapse_body" }, "\u6298\u53E0\u9644\u6587"),
                        React.createElement("option", { value: "full" }, "\u5168\u90E8\u663E\u793A")),
                    React.createElement("label", null, "\u6240\u5C5E\u533A\u57DF"),
                    React.createElement("select", { value: s.snapshot.placements.find((p) => p.object_id === o.id && p.canvas_id === s.scope)?.group_id ?? '', onChange: e => this.run(async () => {
                            const p = s.snapshot.placements.find((p) => p.object_id === o.id && p.canvas_id === s.scope);
                            if (p)
                                await this.placement({ ...p, group_id: e.target.value || null });
                        }) },
                        React.createElement("option", { value: "" }, "\u4E0D\u5728\u5206\u7EC4\u4E2D"),
                        s.snapshot.placements.filter((p) => p.canvas_id === s.scope && !p.deleted_at && p.object_id !== o.id && this.object(p.object_id)?.kind === 'group').map((p) => React.createElement("option", { key: p.object_id, value: p.object_id }, this.object(p.object_id)?.title)))),
                React.createElement("button", { className: "danger-text", onClick: () => this.run(async () => {
                        if (!confirm('删除这条对象？同步墓碑不可直接复活，请先导出需要保留的内容。'))
                            return;
                        await this.save(o, 'deleted_at', Date.now(), false);
                        this.setState({ selected: null, modal: null });
                    }) },
                    "\u5220\u9664\u5BF9\u8C61 ",
                    React.createElement(Icon, { name: "trash", size: 16 })));
        }
        return React.createElement("div", null,
            s.capture && React.createElement("div", { className: "modal-backdrop", onMouseDown: e => {
                    if (e.target === e.currentTarget)
                        this.setState({ capture: false });
                } },
                React.createElement("section", { className: "capture-modal", role: "dialog", "aria-label": "\u5FEB\u901F\u6355\u83B7", "aria-modal": "true" },
                    React.createElement("textarea", { ref: el => { this.captureInput = el; }, placeholder: "\u5148\u653E\u4E0B\u4E00\u4E2A\u60F3\u6CD5\u2026", value: s.captureText, onChange: e => this.setState({ captureText: e.target.value }), onKeyDown: e => {
                            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                                e.preventDefault();
                                this.run(this.capture);
                            }
                        }, onPaste: e => {
                            const file = e.clipboardData.files[0];
                            if (file) {
                                e.preventDefault();
                                this.run(() => this.importFile(file));
                            }
                        } }),
                    React.createElement("div", { className: "capture-footer" },
                        s.recording ? React.createElement("span", { className: "recording-indicator" }, "\u25CF \u6B63\u5728\u5F55\u97F3 \u00B7 \u2318R \u505C\u6B62") : React.createElement("span", null, "\u4E0D\u7528\u9009\u62E9\u7C7B\u578B\u3002"),
                        React.createElement("span", null,
                            React.createElement("kbd", null, "\u21B5"),
                            " \u5B58\u4E0B\u3000 ",
                            React.createElement("kbd", null, "esc"),
                            " \u53D6\u6D88\u3000 ",
                            React.createElement("kbd", null, "\u2318R"),
                            " \u5F55\u97F3"),
                        React.createElement("button", { className: "capture-save", "aria-label": "\u5B58\u4E0B", onClick: () => this.run(this.capture) },
                            React.createElement(Icon, { name: "arrow", size: 16 }))))),
            s.search && React.createElement("div", { className: "modal-backdrop", onMouseDown: e => {
                    if (e.target === e.currentTarget)
                        this.setState({ search: false });
                } },
                React.createElement("section", { className: "search-modal", role: "dialog", "aria-modal": "true", "aria-label": "\u641C\u7D22\u4E0E\u547D\u4EE4" },
                    React.createElement("header", null,
                        React.createElement(Icon, { name: "search", size: 20 }),
                        React.createElement("input", { ref: el => { this.searchInput = el; }, value: s.query, placeholder: "\u7528\u4F60\u81EA\u5DF1\u4F1A\u5199\u7684\u8BCD\uFF0C\u627E\u56DE\u6765\u2026", onChange: e => void this.search(e.target.value) }),
                        React.createElement("button", { onClick: () => this.setState({ search: false }) },
                            React.createElement("kbd", null, "esc"))),
                    React.createElement("div", { className: "search-tabs" },
                        [['lexical', '字面'], ['semantic', '语义'], ['hybrid', '混合']].map(([mode, label]) => React.createElement("button", { key: mode, disabled: mode !== 'lexical' && !s.snapshot.capabilities.semantic, className: mode === s.searchMode ? 'active' : '', onClick: () => void this.search(s.query, mode) }, label)),
                        React.createElement("span", { className: "metadata" }, "\u8F93\u5165 > \u4F7F\u7528\u547D\u4EE4")),
                    React.createElement("div", { className: "search-results" }, s.query.startsWith('>') ? [['快速捕获', () => this.openCapture()], ['前往行动', () => this.navigate('actions')], ['前往画布', () => this.navigate('canvases')], ['查看设置', () => this.navigate('settings')]].map(([name, fn]) => React.createElement("button", { key: name, onClick: () => { this.setState({ search: false }); fn(); } },
                        name,
                        React.createElement(Icon, { name: "arrow", size: 15 }))) : s.searchBusy ? React.createElement("p", { className: "context-empty" }, "\u5728\u627E\u2026") : s.searchResults.length ? s.searchResults.map((o) => React.createElement("button", { key: o.id, onClick: () => { this.setState({ search: false }); this.select(o.id); } },
                        React.createElement("span", { className: "kind-dot", style: { background: this.kind(o.kind)?.color } }),
                        React.createElement("span", null,
                            React.createElement("strong", null, o.title),
                            React.createElement("small", null, o.body?.slice(0, 100))),
                        React.createElement("time", null, dateLabel(o.captured_at)))) : React.createElement("p", { className: "context-empty" }, s.query ? '没找到。试试用你自己会写的词？' : '从一个词、一句话，或一段记忆开始。')))),
            s.modal && React.createElement("div", { className: "modal-backdrop", onMouseDown: e => {
                    if (e.target === e.currentTarget)
                        this.setState({ modal: null });
                } },
                React.createElement("section", { className: "generic-modal", role: "dialog", "aria-modal": "true" },
                    React.createElement("header", null,
                        React.createElement("h2", null, title),
                        React.createElement("button", { "aria-label": "\u5173\u95ED", onClick: () => this.setState({ modal: null }) },
                            React.createElement(Icon, { name: "close" }))),
                    React.createElement("div", { className: "modal-content" }, body))));
    }
    render() {
        const s = this.state;
        if (s.login)
            return React.createElement("div", { className: "login-page" },
                React.createElement("div", { className: "login-card" },
                    React.createElement("div", { className: "brand-mark" }, "d"),
                    React.createElement("h1", null, "\u56DE\u5230\u4F60\u7684\u601D\u8003\u3002"),
                    React.createElement("p", null, "\u8FDE\u63A5\u5DF2\u7ECF\u90E8\u7F72\u7684 Drill \u670D\u52A1\u3002"),
                    React.createElement("form", { onSubmit: e => { e.preventDefault(); this.run(async () => { await request(s.authMode === 'cloudbase' ? '/auth/token' : '/auth/login', 'POST', s.authMode === 'cloudbase' ? { token: s.password } : { password: s.password }); await this.refresh(); }); } },
                        React.createElement("input", { type: "password", autoFocus: true, "aria-label": s.authMode === 'cloudbase' ? 'CloudBase访问令牌' : '连接口令', placeholder: s.authMode === 'cloudbase' ? 'CloudBase访问令牌' : '连接口令', value: s.password, onChange: e => this.setState({ password: e.target.value }) }),
                        React.createElement("button", { className: "primary" },
                            "\u8FDE\u63A5 ",
                            React.createElement(Icon, { name: "arrow", size: 16 }))),
                    s.toast && React.createElement("p", { className: "amber" }, s.toast)));
        if (s.loading || !s.snapshot)
            return React.createElement("div", { className: "loading-page" },
                React.createElement("div", { className: "brand-mark" }, "d"),
                React.createElement("p", null, s.toast || '把思考放回原位。'),
                s.toast && React.createElement("button", { onClick: () => this.run(this.init) }, "\u91CD\u8BD5\u8FDE\u63A5"));
        return React.createElement("div", { className: 'app-shell ' + (!s.left ? 'left-collapsed ' : '') + (!s.right ? 'right-collapsed' : ''), ref: el => { this.rootRef = el; }, onDragOver: e => {
                if (e.dataTransfer.types.includes('Files'))
                    e.preventDefault();
            }, onDrop: e => {
                if (e.dataTransfer.files.length) {
                    e.preventDefault();
                    const files = [...e.dataTransfer.files];
                    this.run(async () => {
                        for (const file of files)
                            await this.importFile(file);
                    });
                }
            } },
            this.renderSidebar(),
            this.renderMain(),
            this.renderRight(),
            this.renderModals(),
            s.toast && React.createElement("div", { className: "toast", role: "status" },
                React.createElement("span", null, s.toast),
                React.createElement("button", { "aria-label": "\u5173\u95ED\u63D0\u793A", onClick: () => this.setState({ toast: '' }) },
                    React.createElement(Icon, { name: "close", size: 13 }))),
            React.createElement("button", { className: "mobile-capture", "aria-label": "\u6355\u83B7", onClick: this.openCapture },
                React.createElement(Icon, { name: "plus", size: 25 })));
    }
}
