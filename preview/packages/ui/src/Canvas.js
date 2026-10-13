import React from '../../../vendor/react-shim.js';
import { Icon } from './Icon.js';
import { inWindow } from '../../core/src/helpers.js';
export class Canvas extends React.Component {
    state = { panX: 24, panY: 24, zoom: .7, tool: 'select', drawer: false, selected: [], connecting: null, overrides: {}, expanded: [], box: null };
    stage = null;
    stopDrag = null;
    componentDidMount() { this.fit(); window.addEventListener('keydown', this.key); }
    componentWillUnmount() { window.removeEventListener('keydown', this.key); this.stopDrag?.(); }
    placements = () => this.props.placements.filter(p => p.canvas_id === this.props.canvas.id && !p.deleted_at).map(p => ({ ...p, ...this.state.overrides[p.object_id] }));
    point = (event) => { const r = this.stage.getBoundingClientRect(); return { x: (event.clientX - r.left - this.state.panX) / this.state.zoom, y: (event.clientY - r.top - this.state.panY) / this.state.zoom }; };
    fit = () => {
        const ps = this.placements();
        if (!ps.length)
            return;
        const width = Math.max(...ps.map(p => p.x + p.w)) + 80, height = Math.max(...ps.map(p => p.y + p.h)) + 80;
        const z = Math.max(.25, Math.min(1, (this.stage?.clientWidth ?? 700) / width, (this.stage?.clientHeight ?? 600) / height));
        this.setState({ zoom: z, panX: 24, panY: 24 });
    };
    key = (e) => {
        if (e.target.closest('input,textarea,select,[contenteditable]'))
            return;
        if (this.state.tool === 'mind' && ['Tab', 'Enter'].includes(e.key)) {
            e.preventDefault();
            void this.grow(e.key === 'Tab');
        }
    };
    grow = async (child) => {
        try {
            const ps = this.placements(), selected = ps.find(p => p.object_id === this.props.selected);
            if (!selected)
                return;
            const parent = child ? selected : ps.find(p => this.props.relations.some(r => r.from_id === p.object_id && r.to_id === selected.object_id && r.source_field === 'canvas' && !r.deleted_at));
            const siblings = parent ? this.props.relations.filter(r => r.from_id === parent.object_id && r.source_field === 'canvas' && !r.deleted_at).length : 1;
            const title = window.prompt(child ? '子节点：写一个想法' : '兄弟节点：写一个想法');
            if (!title?.trim())
                return;
            const id = await this.props.onNew(title.trim(), null, { x: parent ? parent.x + 320 : selected.x, y: parent ? parent.y + siblings * 180 : selected.y + 200, w: 260, h: 140 }, true);
            if (parent)
                await this.props.onConnect(parent.object_id, id);
            this.props.onSelect(id);
        }
        catch (e) {
            this.props.onError(e);
        }
    };
    zoom = (step) => { const z = Math.max(.25, Math.min(2, this.state.zoom * step)); const cx = (this.stage?.clientWidth ?? 700) / 2, cy = (this.stage?.clientHeight ?? 600) / 2; const ratio = z / this.state.zoom; this.setState({ zoom: z, panX: cx - (cx - this.state.panX) * ratio, panY: cy - (cy - this.state.panY) * ratio }); };
    onWheel = (e) => {
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            this.zoom(e.deltaY < 0 ? 1.1 : 1 / 1.1);
        }
        else
            this.setState({ panX: this.state.panX - e.deltaX, panY: this.state.panY - e.deltaY });
    };
    background = (e) => {
        if (e.target.closest('.canvas-card,.canvas-toolbar,.canvas-drawer,.canvas-controls'))
            return;
        const sx = e.clientX, sy = e.clientY, px = this.state.panX, py = this.state.panY, start = this.point(e);
        let rect = null;
        const move = (ev) => {
            if (this.state.tool === 'box') {
                const end = this.point(ev);
                rect = { x: Math.min(start.x, end.x), y: Math.min(start.y, end.y), w: Math.abs(end.x - start.x), h: Math.abs(end.y - start.y) };
                this.setState({ box: rect });
            }
            else
                this.setState({ panX: px + ev.clientX - sx, panY: py + ev.clientY - sy });
        };
        const up = () => {
            window.removeEventListener('mousemove', move);
            window.removeEventListener('mouseup', up);
            if (rect)
                this.setState({ selected: this.placements().filter(p => p.x >= rect.x && p.y >= rect.y && p.x + p.w <= rect.x + rect.w && p.y + p.h <= rect.y + rect.h).map(p => p.object_id), box: null });
        };
        window.addEventListener('mousemove', move);
        window.addEventListener('mouseup', up);
        this.stopDrag = up;
    };
    drag = (e, p, resize = false) => {
        e.stopPropagation();
        if (e.button !== 0)
            return;
        if (this.state.tool === 'link') {
            void this.click(p.object_id);
            return;
        }
        this.props.onSelect(p.object_id);
        const sx = e.clientX, sy = e.clientY;
        const group = this.placements().filter(x => x.group_id === p.object_id);
        const selected = this.state.selected.includes(p.object_id) ? this.placements().filter(x => this.state.selected.includes(x.object_id)) : [];
        const movers = resize ? [p] : [p, ...group, ...selected].filter((v, i, arr) => arr.findIndex(a => a.object_id === v.object_id) === i);
        let latest = {};
        const move = (ev) => { const dx = (ev.clientX - sx) / this.state.zoom, dy = (ev.clientY - sy) / this.state.zoom; latest = Object.fromEntries(movers.map(v => [v.object_id, resize ? { w: Math.max(160, v.w + dx), h: Math.max(90, v.h + dy) } : { x: v.x + dx, y: v.y + dy }])); this.setState({ overrides: latest }); };
        const up = () => {
            window.removeEventListener('mousemove', move);
            window.removeEventListener('mouseup', up);
            if (!Object.keys(latest).length)
                return;
            void (async () => {
                try {
                    for (const v of movers)
                        await this.props.onPlacement({ ...v, ...latest[v.object_id] });
                }
                catch (e) {
                    this.props.onError(e);
                }
                finally {
                    this.setState({ overrides: {} });
                }
            })();
        };
        window.addEventListener('mousemove', move);
        window.addEventListener('mouseup', up);
        this.stopDrag = up;
    };
    click = async (id) => {
        if (this.state.tool === 'link') {
            if (!this.state.connecting)
                this.setState({ connecting: id });
            else if (this.state.connecting !== id) {
                try {
                    await this.props.onConnect(this.state.connecting, id);
                }
                catch (e) {
                    this.props.onError(e);
                }
                this.setState({ connecting: null, tool: 'select' });
            }
        }
        else
            this.props.onSelect(id);
    };
    add = async (id) => {
        const o = this.props.objects.find(x => x.id === id);
        const p = { canvas_id: this.props.canvas.id, object_id: id, user_id: o.user_id, x: (80 - this.state.panX) / this.state.zoom, y: (80 - this.state.panY) / this.state.zoom, w: o.kind === 'group' ? 560 : 270, h: o.kind === 'group' ? 300 : 180, z: this.placements().length, group_id: null, display: null, deleted_at: null };
        try {
            await this.props.onPlacement(p);
            this.props.onSelect(id);
            this.setState({ drawer: false });
        }
        catch (e) {
            this.props.onError(e);
        }
    };
    tool = async (tool) => {
        if (tool === 'library') {
            this.setState({ drawer: !this.state.drawer });
            return;
        }
        if (tool === 'text' || tool === 'group') {
            const text = window.prompt(tool === 'group' ? '为这块区域命名' : '写一个临时想法');
            if (text?.trim())
                try {
                    await this.props.onNew(text.trim(), tool === 'group' ? 'group' : null, { x: 100, y: 100, w: tool === 'group' ? 560 : 260, h: tool === 'group' ? 300 : 150 }, tool === 'text');
                }
                catch (e) {
                    this.props.onError(e);
                }
            return;
        }
        this.setState({ tool, connecting: null });
    };
    render() {
        const ps = this.placements(), objects = this.props.objects, byId = new Map(ps.map(p => [p.object_id, p]));
        const edges = this.props.relations.filter(r => !r.deleted_at && byId.has(r.from_id) && byId.has(r.to_id));
        return React.createElement("div", { className: "canvas-stage", ref: el => { this.stage = el; }, onMouseDown: this.background, onWheel: this.onWheel, onDragOver: e => e.preventDefault(), onDrop: e => {
                const id = e.dataTransfer.getData('drill/object');
                if (id) {
                    e.preventDefault();
                    const point = this.point(e);
                    const o = objects.find(o => o.id === id);
                    if (o)
                        void this.props.onPlacement({ canvas_id: this.props.canvas.id, object_id: id, user_id: o.user_id, ...point, w: 260, h: 160, z: ps.length, display: null, group_id: null, deleted_at: null }).catch(this.props.onError);
                }
            } },
            React.createElement("div", { className: "canvas-toolbar", "aria-label": "\u753B\u5E03\u5DE5\u5177" }, [['select', 'select', '选择 / 拖动'], ['link', 'link', '连线：依次点击两张卡'], ['text', 'text', '临时文字'], ['group', 'group', '新建分组区域'], ['box', 'fit', '框选'], ['mind', 'branch', '导图：Tab子节点，Enter兄弟节点'], ['library', 'search', '从对象库拉入']].map(([tool, icon, title]) => React.createElement("button", { key: tool, className: this.state.tool === tool ? 'active' : '', title: title, "aria-label": title, onClick: () => void this.tool(tool) },
                React.createElement(Icon, { name: icon })))),
            React.createElement("div", { className: "canvas-hint" }, this.state.tool === 'link' ? (this.state.connecting ? '再点一张卡，建立引用' : '点第一张卡，建立引用') : this.state.tool === 'mind' ? '选中卡片 · Tab 生长子节点 · Enter 生长兄弟节点' : this.state.tool === 'box' ? '拖出一个范围，选中多张卡片' : '拉进来，摆位置，连线。'),
            React.createElement("div", { className: "canvas-world", style: { transform: `translate(${this.state.panX}px,${this.state.panY}px) scale(${this.state.zoom})` } },
                React.createElement("svg", { className: "canvas-edges", width: "12000", height: "12000", style: { left: -4000, top: -4000 } },
                    React.createElement("defs", null,
                        React.createElement("marker", { id: "arrowhead", markerWidth: "8", markerHeight: "8", refX: "7", refY: "3", orient: "auto" },
                            React.createElement("path", { d: "M0 0L7 3L0 6", fill: "none", stroke: "#8a8580" }))),
                    edges.map((r, i) => { const a = byId.get(r.from_id), b = byId.get(r.to_id); const x1 = a.x + a.w / 2 + 4000, y1 = a.y + a.h + 4000, x2 = b.x + b.w / 2 + 4000, y2 = b.y + 4000; return React.createElement("g", { key: i },
                        React.createElement("circle", { cx: x1, cy: y1, r: "3", fill: "#8a8580" }),
                        React.createElement("path", { d: `M${x1} ${y1}C${x1} ${y1 + 80},${x2} ${y2 - 80},${x2} ${y2}`, fill: "none", stroke: "#aaa29a", strokeWidth: "1.4", markerEnd: "url(#arrowhead)", onClick: () => this.props.onSelect(r.from_id) },
                            React.createElement("title", null, "\u5F15\u7528 \u00B7 \u70B9\u51FB\u67E5\u770B\u53D1\u51FA\u5F15\u7528\u7684\u5BF9\u8C61"))); })),
                [...ps].sort((a, b) => Number(objects.find(o => o.id === b.object_id)?.kind === 'group') - Number(objects.find(o => o.id === a.object_id)?.kind === 'group') || a.z - b.z).map(p => {
                    const o = objects.find(o => o.id === p.object_id);
                    if (!o || o.deleted_at)
                        return null;
                    const kind = this.props.kinds.find(k => k.id === o.kind);
                    const grouped = o.kind === 'group', selected = this.props.selected === o.id || this.state.selected.includes(o.id);
                    const dim = !inWindow(o.captured_at, this.props.window, this.props.timezone, Date.now(), this.props.custom) && !inWindow(o.updated_at, this.props.window, this.props.timezone, Date.now(), this.props.custom);
                    const display = p.display ?? this.props.globalDisplay;
                    return React.createElement("div", { key: o.id, className: `canvas-card ${grouped ? 'canvas-group' : ''} ${selected ? 'selected' : ''} ${o.ephemeral ? 'ephemeral' : ''} ${dim ? 'outside-window' : ''} ${o.kind === 'ai_output' ? 'ai-object' : ''}`, style: { left: p.x, top: p.y, width: p.w, height: dim && !grouped ? 64 : p.h, zIndex: grouped ? 0 : 1 }, onMouseDown: e => this.drag(e, p), onDoubleClick: () => o.form === 'canvas' ? this.props.onEnter(o.id) : this.props.onSelect(o.id) },
                        grouped ? React.createElement("div", { className: "group-title" }, o.title) : React.createElement("div", { className: "canvas-card-inner" },
                            React.createElement("div", { className: "card-eyebrow" },
                                React.createElement("span", { style: { color: kind?.color } }, kind?.icon ?? '◌'),
                                " ",
                                kind?.label ?? '未提炼',
                                o.source_id && React.createElement("span", { className: "source-mark" }, "\u2197 \u5916\u90E8")),
                            React.createElement("h3", null, o.title),
                            display !== 'title_only' && !dim && o.body && React.createElement("p", { className: display === 'collapse_body' ? 'body-collapsed' : '' }, o.body.replace(/\[\[|\]\]/g, '')),
                            o.form === 'canvas' && React.createElement("div", { className: "nested-controls" },
                                React.createElement("button", { onMouseDown: e => e.stopPropagation(), onClick: () => this.props.onEnter(o.id) },
                                    "\u8FDB\u5165 ",
                                    React.createElement(Icon, { name: "arrow", size: 13 })),
                                React.createElement("button", { onMouseDown: e => e.stopPropagation(), onClick: () => this.setState({ expanded: this.state.expanded.includes(o.id) ? this.state.expanded.filter((x) => x !== o.id) : [...this.state.expanded, o.id] }) }, "\u5C55\u5F00")),
                            this.state.expanded.includes(o.id) && React.createElement("div", { className: "nested-preview" }, this.props.placements.filter(x => x.canvas_id === o.id && !x.deleted_at).slice(0, 5).map(x => React.createElement("p", { key: x.object_id }, objects.find(o => o.id === x.object_id)?.title)))),
                        selected && React.createElement("div", { className: "card-float-actions" },
                            React.createElement("button", { title: "\u4ECE\u6B64\u753B\u5E03\u79FB\u9664\uFF08\u4FDD\u7559\u5BF9\u8C61\uFF09", onMouseDown: e => e.stopPropagation(), onClick: () => this.props.onRemove(o.id) },
                                React.createElement(Icon, { name: "close", size: 13 }))),
                        React.createElement("div", { className: "resize-handle", onMouseDown: e => this.drag(e, p, true) }));
                }),
                this.state.box && React.createElement("div", { className: "selection-box", style: { left: this.state.box.x, top: this.state.box.y, width: this.state.box.w, height: this.state.box.h } })),
            this.state.drawer && React.createElement("div", { className: "canvas-drawer" },
                React.createElement("header", null,
                    React.createElement("strong", null, "\u4ECE\u5BF9\u8C61\u5E93\u62C9\u5165"),
                    React.createElement("button", { onClick: () => this.setState({ drawer: false }) },
                        React.createElement(Icon, { name: "close" }))),
                React.createElement("p", null, "\u540C\u4E00\u4EFD\u5185\u5BB9\uFF0C\u4E0D\u540C\u7684\u6446\u653E\u3002"),
                objects.filter(o => !o.deleted_at && !o.ephemeral && o.id !== this.props.canvas.id && !byId.has(o.id)).map(o => React.createElement("button", { className: "library-object", key: o.id, draggable: true, onDragStart: e => e.dataTransfer.setData('drill/object', o.id), onClick: () => void this.add(o.id) },
                    o.title,
                    React.createElement(Icon, { name: "plus", size: 13 })))),
            !ps.length && React.createElement("div", { className: "canvas-empty" },
                React.createElement(Icon, { name: "canvas", size: 36 }),
                React.createElement("p", null, "\u5148\u653E\u4E00\u5F20\u5361\uFF0C\u8BA9\u7406\u89E3\u4ECE\u8FD9\u91CC\u751F\u957F\u3002"),
                React.createElement("button", { onClick: () => this.setState({ drawer: true }) },
                    "\u4ECE\u5BF9\u8C61\u5E93\u62C9\u5165 ",
                    React.createElement(Icon, { name: "arrow", size: 14 }))),
            React.createElement("div", { className: "canvas-controls" },
                React.createElement("button", { title: "\u7F29\u5C0F", onClick: () => this.zoom(1 / 1.15) },
                    React.createElement(Icon, { name: "minus", size: 15 })),
                React.createElement("span", null,
                    Math.round(this.state.zoom * 100),
                    "%"),
                React.createElement("button", { title: "\u653E\u5927", onClick: () => this.zoom(1.15) },
                    React.createElement(Icon, { name: "plus", size: 15 })),
                React.createElement("button", { title: "\u9002\u5E94\u753B\u5E03", onClick: this.fit },
                    React.createElement(Icon, { name: "fit", size: 16 }))));
    }
}
