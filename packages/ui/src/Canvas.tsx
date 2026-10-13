import React from 'react';
import { Icon } from './Icon.tsx';
import { edgeGeometry } from './canvasGeometry.ts';
import { inWindow } from '../../core/src/helpers.ts';
import type { KnowledgeObject, Placement, Kind, Relation } from '../../core/src/types.ts';
type Props = {
    canvas: KnowledgeObject;
    objects: KnowledgeObject[];
    placements: Placement[];
    relations: Relation[];
    kinds: Kind[];
    selected: string | null;
    window: string;
    custom: {
        from: string;
        to: string;
    };
    timezone: string;
    globalDisplay: string;
    onSelect: (id: string) => void;
    onEnter: (id: string) => void;
    onPlacement: (p: Placement) => Promise<void>;
    onConnect: (from: string, to: string) => Promise<void>;
    onNew: (title: string, kind: string | null, placement: any, ephemeral?: boolean) => Promise<string>;
    onRename: (id: string, title: string) => Promise<void>;
    onRemove: (id: string) => void;
    onError: (e: any) => void;
};
export class Canvas extends React.Component<Props, any> {
    state = { panX: 24, panY: 24, zoom: .7, tool: 'select', drawer: false, selected: [] as string[], connecting: null as string | null, overrides: {} as Record<string, Partial<Placement>>, expanded: [] as string[], box: null as any, draft: null as any, saving: false };
    stage: HTMLDivElement | null = null;
    stopDrag: (() => void) | null = null;
    componentDidMount() { this.fit(); window.addEventListener('keydown', this.key); }
    componentWillUnmount() { window.removeEventListener('keydown', this.key); this.stopDrag?.(); }
    placements = () => this.props.placements.filter(p => p.canvas_id === this.props.canvas.id && !p.deleted_at).map(p => ({ ...p, ...this.state.overrides[p.object_id] }));
    point = (event: any) => { const r = this.stage!.getBoundingClientRect(); return { x: (event.clientX - r.left - this.state.panX) / this.state.zoom, y: (event.clientY - r.top - this.state.panY) / this.state.zoom }; };
    fit = () => { const ps = this.placements(); if (!ps.length) return;
        const x = Math.min(...ps.map(p => p.x)), y = Math.min(...ps.map(p => p.y)), w = Math.max(...ps.map(p => p.x + p.w)) - x, h = Math.max(...ps.map(p => p.y + p.h)) - y;
        const width = this.stage?.clientWidth ?? 700, height = this.stage?.clientHeight ?? 600, z = Math.max(.25, Math.min(1, (width - 120) / w, (height - 80) / h));
        this.setState({ zoom: z, panX: (width - w * z) / 2 - x * z, panY: (height - h * z) / 2 - y * z });
    };
    key = (e: KeyboardEvent) => { if ((e.target as HTMLElement).closest('input,textarea,select,[contenteditable]'))
        return; if (this.state.tool === 'mind' && ['Tab', 'Enter'].includes(e.key)) {
        e.preventDefault();
        void this.grow(e.key === 'Tab');
    } };
    grow = async (child: boolean) => { try {
        const ps = this.placements(), selected = ps.find(p => p.object_id === this.props.selected);
        if (!selected)
            return;
        const parent = child ? selected : ps.find(p => this.props.relations.some(r => r.from_id === p.object_id && r.to_id === selected.object_id && r.source_field === 'canvas' && !r.deleted_at));
        const siblings = parent ? this.props.relations.filter(r => r.from_id === parent.object_id && r.source_field === 'canvas' && !r.deleted_at).length : 1;
        const placement = { x: parent ? parent.x + parent.w + 60 : selected.x, y: parent ? parent.y + siblings * 180 : selected.y + 200, w: 260, h: 140 };
        this.setState({ ...this.reveal(placement), draft: { title: '', kind: null, ephemeral: true, parent: parent?.object_id, placement } });
    } catch (e) { this.props.onError(e); } };
    saveDraft = async () => {
        const draft = this.state.draft; if (!draft || this.state.saving || !draft.title.trim()) return;
        this.setState({ saving: true });
        try {
            if (draft.renameId) await this.props.onRename(draft.renameId, draft.title.trim());
            else {
                const id = draft.createdId ?? await this.props.onNew(draft.title.trim(), draft.kind, draft.placement, draft.ephemeral);
                this.setState({ draft: { ...draft, createdId: id } });
                if (draft.parent) await this.props.onConnect(draft.parent, id);
                this.props.onSelect(id);
            }
            this.setState({ draft: null, saving: false });
        } catch (e) { this.setState({ saving: false }); this.props.onError(e); }
    };
    reveal = (p: { x: number; y: number; w: number; h: number }) => {
        const { zoom } = this.state; let { panX, panY } = this.state;
        const width = this.stage?.clientWidth ?? 700, height = this.stage?.clientHeight ?? 600;
        if (p.x * zoom + panX < 72) panX = 72 - p.x * zoom;
        if ((p.x + p.w) * zoom + panX > width - 24) panX = width - 24 - (p.x + p.w) * zoom;
        if (p.y * zoom + panY < 32) panY = 32 - p.y * zoom;
        if ((p.y + p.h) * zoom + panY > height - 80) panY = height - 80 - (p.y + p.h) * zoom;
        return { panX, panY };
    };
    startDraft = (tool: string, point?: { x: number; y: number }) => {
        const { panX, panY, zoom } = this.state;
        const position = point ?? { x: ((this.stage?.clientWidth ?? 700) / 2 - panX) / zoom, y: ((this.stage?.clientHeight ?? 600) / 2 - panY) / zoom };
        const placement = { ...position, w: tool === 'group' ? 560 : 260, h: tool === 'group' ? 300 : 140 };
        this.setState({ ...this.reveal(placement), draft: { title: '', kind: tool === 'group' ? 'group' : null, ephemeral: tool === 'text', placement }, tool: 'select' });
    };
    zoom = (step: number) => { const z = Math.max(.25, Math.min(2, this.state.zoom * step)); const cx = (this.stage?.clientWidth ?? 700) / 2, cy = (this.stage?.clientHeight ?? 600) / 2; const ratio = z / this.state.zoom; this.setState({ zoom: z, panX: cx - (cx - this.state.panX) * ratio, panY: cy - (cy - this.state.panY) * ratio }); };
    onWheel = (e: React.WheelEvent) => { if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        this.zoom(e.deltaY < 0 ? 1.1 : 1 / 1.1);
    }
    else
        this.setState({ panX: this.state.panX - e.deltaX, panY: this.state.panY - e.deltaY }); };
    background = (e: React.MouseEvent) => {
        if ((e.target as HTMLElement).closest('.canvas-card,.canvas-toolbar,.canvas-drawer,.canvas-controls,.canvas-draft,.canvas-empty'))
            return;
        if (e.button !== 0) return;
        if (['text', 'group'].includes(this.state.tool)) { this.startDraft(this.state.tool, this.point(e)); return; }
        const sx = e.clientX, sy = e.clientY, px = this.state.panX, py = this.state.panY, start = this.point(e);
        let rect: any = null;
        const move = (ev: MouseEvent) => { if (this.state.tool === 'box') {
            const end = this.point(ev);
            rect = { x: Math.min(start.x, end.x), y: Math.min(start.y, end.y), w: Math.abs(end.x - start.x), h: Math.abs(end.y - start.y) };
            this.setState({ box: rect });
        }
        else
            this.setState({ panX: px + ev.clientX - sx, panY: py + ev.clientY - sy }); };
        const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); if (rect)
            this.setState({ selected: this.placements().filter(p => p.x >= rect.x && p.y >= rect.y && p.x + p.w <= rect.x + rect.w && p.y + p.h <= rect.y + rect.h).map(p => p.object_id), box: null }); };
        window.addEventListener('mousemove', move);
        window.addEventListener('mouseup', up);
        this.stopDrag = up;
    };
    drag = (e: React.MouseEvent, p: Placement, resize = false) => {
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
        let latest: Record<string, Partial<Placement>> = {};
        const move = (ev: MouseEvent) => { const dx = (ev.clientX - sx) / this.state.zoom, dy = (ev.clientY - sy) / this.state.zoom; latest = Object.fromEntries(movers.map(v => [v.object_id, resize ? { w: Math.max(160, v.w + dx), h: Math.max(90, v.h + dy) } : { x: v.x + dx, y: v.y + dy }])); this.setState({ overrides: latest }); };
        const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); if (!Object.keys(latest).length)
            return; void (async () => { try {
            for (const v of movers)
                await this.props.onPlacement({ ...v, ...latest[v.object_id] });
        }
        catch (e) {
            this.props.onError(e);
        }
        finally {
            this.setState({ overrides: {} });
        } })(); };
        window.addEventListener('mousemove', move);
        window.addEventListener('mouseup', up);
        this.stopDrag = up;
    };
    click = async (id: string) => { if (this.state.tool === 'link') {
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
        this.props.onSelect(id); };
    add = async (id: string) => { const o = this.props.objects.find(x => x.id === id)!; const p: Placement = { canvas_id: this.props.canvas.id, object_id: id, user_id: o.user_id, x: (80 - this.state.panX) / this.state.zoom, y: (80 - this.state.panY) / this.state.zoom, w: o.kind === 'group' ? 560 : 270, h: o.kind === 'group' ? 300 : 180, z: this.placements().length, group_id: null, display: null, deleted_at: null }; try {
        await this.props.onPlacement(p);
        this.props.onSelect(id);
        this.setState({ drawer: false });
    }
    catch (e) {
        this.props.onError(e);
    } };
    tool = async (tool: string) => { if (tool === 'library') {
        this.setState({ drawer: !this.state.drawer });
        return;
    } this.setState({ tool, connecting: null }); };
    render() {
        const ps = this.placements(), objects = this.props.objects, byId = new Map(ps.map(p => [p.object_id, p]));
        const edges = this.props.relations.filter(r => r.type !== 'belongs' && !r.deleted_at && byId.has(r.from_id) && byId.has(r.to_id));
        return <div className="canvas-stage" ref={el => { this.stage = el; }} onMouseDown={this.background} onWheel={this.onWheel} onDragOver={e => e.preventDefault()} onDrop={e => { const id = e.dataTransfer.getData('drill/object'); if (id) {
            e.preventDefault();
            const point = this.point(e);
            const o = objects.find(o => o.id === id);
            if (o)
                void this.props.onPlacement({ canvas_id: this.props.canvas.id, object_id: id, user_id: o.user_id, ...point, w: 260, h: 160, z: ps.length, display: null, group_id: null, deleted_at: null }).catch(this.props.onError);
        } }}>
  <div className="canvas-toolbar" aria-label="画布工具">{[['select', 'select', '选择 / 拖动'], ['link', 'link', '连线：依次点击两张卡'], ['text', 'text', '临时文字'], ['box', 'fit', '框选'], ['mind', 'branch', '导图：Tab子节点，Enter兄弟节点'], ['group', 'group', '新建分组区域'], ['library', 'search', '从对象库拉入']].map(([tool, icon, title]) => <button key={tool} className={this.state.tool === tool ? 'active' : ''} title={title} aria-label={title} onClick={() => void this.tool(tool)}><Icon name={icon}/></button>)}</div>
  {this.state.tool === 'link' && <div className="canvas-hint">{this.state.connecting ? '再点一张卡，建立引用' : '点第一张卡，建立引用'}</div>}
  <div className="canvas-world" style={{ transform: `translate(${this.state.panX}px,${this.state.panY}px) scale(${this.state.zoom})` }}>
   <svg className="canvas-edges" width="12000" height="12000" style={{ left: -4000, top: -4000 }}><defs><marker id="arrowhead" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto"><path d="M0 0L7 3L0 6" fill="none" stroke="#71717a"/></marker></defs>{edges.map((r, i) => { const a = byId.get(r.from_id)!, b = byId.get(r.to_id)!; const { x1, y1, path } = edgeGeometry(a, b, 4000); return <g key={i}><circle cx={x1} cy={y1} r="3" fill="#71717a"/><path d={path} fill="none" stroke="#71717a" strokeWidth="1.5" markerEnd="url(#arrowhead)" onClick={() => this.props.onSelect(r.from_id)}><title>引用 · 点击查看发出引用的对象</title></path></g>; })}</svg>
   {[...ps].sort((a, b) => Number(objects.find(o => o.id === b.object_id)?.kind === 'group') - Number(objects.find(o => o.id === a.object_id)?.kind === 'group') || a.z - b.z).map(p => {
                const o = objects.find(o => o.id === p.object_id);
                if (!o || o.deleted_at)
                    return null;
                const kind = this.props.kinds.find(k => k.id === o.kind);
                const grouped = o.kind === 'group', selected = this.props.selected === o.id || this.state.selected.includes(o.id);
                const dim = !inWindow(o.captured_at, this.props.window, this.props.timezone, Date.now(), this.props.custom) && !inWindow(o.updated_at, this.props.window, this.props.timezone, Date.now(), this.props.custom);
                const display = p.display ?? this.props.globalDisplay;
                return <div key={o.id} className={`canvas-card ${grouped ? 'canvas-group group-tone-' + (o.id.split('').reduce((n, c) => n + c.charCodeAt(0), 0) % 4) : ''} ${selected ? 'selected' : ''} ${o.ephemeral ? 'ephemeral' : ''} ${dim ? 'outside-window' : ''} ${o.kind === 'ai_output' ? 'ai-object' : ''}`} style={{ left: p.x, top: p.y, width: p.w, height: dim && !grouped ? 64 : p.h, zIndex: grouped ? 0 : 1 }} onMouseDown={e => this.drag(e, p)} onDoubleClick={() => o.form === 'canvas' ? this.props.onEnter(o.id) : this.props.onSelect(o.id)}>
     {grouped ? <div className="group-title" onDoubleClick={e => { e.stopPropagation(); this.setState({ draft: { title: o.title, renameId: o.id, kind: 'group', placement: p } }); }}>{o.title}</div> : <div className="canvas-card-inner"><h3><span className="kind-dot" style={{ background: kind?.color ?? 'var(--ash)' }}/>{o.title}{o.source_id && <Icon name="external" size={12}/>}</h3>{display !== 'title_only' && !dim && o.body && <p className={display === 'collapse_body' ? 'body-collapsed' : ''}>{o.body.replace(/\[\[|\]\]/g, '')}</p>}{o.form === 'canvas' && <div className="nested-controls"><button onMouseDown={e => e.stopPropagation()} onClick={() => this.props.onEnter(o.id)}>进入 <Icon name="arrow" size={13}/></button><button onMouseDown={e => e.stopPropagation()} onClick={() => this.setState({ expanded: this.state.expanded.includes(o.id) ? this.state.expanded.filter((x: string) => x !== o.id) : [...this.state.expanded, o.id] })}>展开</button></div>}{this.state.expanded.includes(o.id) && <div className="nested-preview">{this.props.placements.filter(x => x.canvas_id === o.id && !x.deleted_at).slice(0, 5).map(x => <p key={x.object_id}>{objects.find(o => o.id === x.object_id)?.title}</p>)}</div>}</div>}
     {selected && <div className="card-float-actions"><button title="从此画布移除（保留对象）" onMouseDown={e => e.stopPropagation()} onClick={() => this.props.onRemove(o.id)}><Icon name="close" size={13}/></button></div>}<div className="resize-handle" onMouseDown={e => this.drag(e, p, true)}/>
    </div>;
            })}
   {this.state.draft && <div className={'canvas-draft ' + (this.state.draft.kind === 'group' ? 'group-draft' : '')} style={{ left: this.state.draft.placement.x, top: this.state.draft.placement.y, width: this.state.draft.placement.w }} onMouseDown={e => e.stopPropagation()}><input autoFocus aria-label={this.state.draft.kind === 'group' ? '分组名称' : '节点标题'} placeholder={this.state.draft.kind === 'group' ? '分组名称' : '写点什么…'} value={this.state.draft.title} disabled={this.state.saving} onChange={e => this.setState({ draft: { ...this.state.draft, title: e.target.value } })} onKeyDown={e => { e.stopPropagation(); if (e.nativeEvent.isComposing) return; if (e.key === 'Enter') { e.preventDefault(); void this.saveDraft(); } if (e.key === 'Escape' && !this.state.saving) this.setState({ draft: null }); }}/><small>Enter 保存 · Esc 取消</small></div>}
   {this.state.box && <div className="selection-box" style={{ left: this.state.box.x, top: this.state.box.y, width: this.state.box.w, height: this.state.box.h }}/>}
  </div>
  {this.state.drawer && <div className="canvas-drawer"><header><strong>从对象库拉入</strong><button onClick={() => this.setState({ drawer: false })}><Icon name="close"/></button></header>{objects.filter(o => !o.deleted_at && !o.ephemeral && o.id !== this.props.canvas.id && !byId.has(o.id)).map(o => <button className="library-object" key={o.id} draggable onDragStart={e => e.dataTransfer.setData('drill/object', o.id)} onClick={() => void this.add(o.id)}>{o.title}<Icon name="plus" size={13}/></button>)}</div>}
  {!ps.length && <div className="canvas-empty"><Icon name="canvas" size={36}/><p>画布还没有内容</p><button onClick={() => this.setState({ drawer: true })}>从对象库拉入 <Icon name="arrow" size={14}/></button></div>}
  <div className="canvas-controls"><button title="缩小" onClick={() => this.zoom(1 / 1.15)}><Icon name="minus" size={15}/></button><span>{Math.round(this.state.zoom * 100)}%</span><button title="放大" onClick={() => this.zoom(1.15)}><Icon name="plus" size={15}/></button><button title="适应画布" onClick={this.fit}><Icon name="fit" size={16}/></button></div>
 </div>;
    }
}
