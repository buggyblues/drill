import React from 'react';
import { keyBetween, sortedBlocks, uid } from '../../core/src/helpers.ts';
import type { Block, KnowledgeObject } from '../../core/src/types.ts';

// Editing keeps the same block IDs and commits only changed or deleted blocks.
export class ParagraphEditor extends React.Component<{
    object: KnowledgeObject; objects: KnowledgeObject[]; renderMarkup: (text: string) => React.ReactNode;
    draft?: Block[]; onDraft: (blocks: Block[] | null) => void;
    onSave: (blocks: Block[]) => Promise<void>; onError: (error: any) => void;
}, { blocks: Block[]; active: string | null; reference: string | null; referenceIndex: number; saving: boolean }> {
    state = { blocks: this.props.draft ?? this.blocks(), active: null as string | null, reference: null as string | null, referenceIndex: 0, saving: false };
    input: HTMLTextAreaElement | null = null;
    baseline = structuredClone(sortedBlocks(this.props.object.body_blocks.blocks));
    pending = Promise.resolve();
    queuedSignature = '';
    dirty = !!this.props.draft;
    mounted = false;
    componentDidMount() { this.mounted = true; }
    rememberDraft = () => { this.dirty = true; this.props.onDraft(structuredClone(this.state.blocks)); };
    blocks() { const o = this.props.object; return structuredClone(sortedBlocks(o.body_blocks.blocks)).length ? structuredClone(sortedBlocks(o.body_blocks.blocks)) : o.body ? [{ id: uid(), key: keyBetween(null, null), text: o.body }] : []; }
    componentDidUpdate(previous: Readonly<typeof this.props>) {
        if (previous.object !== this.props.object && !this.state.active && !this.state.saving && !this.dirty) {
            const blocks = this.blocks(); this.baseline = structuredClone(sortedBlocks(this.props.object.body_blocks.blocks)); this.setState({ blocks });
        }
        if (this.input) { this.input.style.height = 'auto'; this.input.style.height = this.input.scrollHeight + 'px'; }
    }
    componentWillUnmount() { this.mounted = false; void this.flush(); }
    flush = () => {
        if (!this.dirty) return this.pending;
        const after = structuredClone(this.state.blocks), signature = JSON.stringify(after);
        if (signature === this.queuedSignature) return this.pending;
        this.queuedSignature = signature;
        if (this.mounted) this.setState({ saving: true });
        this.pending = this.pending.then(async () => {
            const before = this.baseline;
            const delta = [...after.filter(b => { const old = before.find(x => x.id === b.id); return !old || old.text !== b.text || old.key !== b.key; }), ...before.filter(b => !after.some(x => x.id === b.id)).map(b => ({ ...b, deleted_at: Date.now() }))];
            if (delta.length) await this.props.onSave(delta);
            this.baseline = after;
            if (JSON.stringify(this.state.blocks) === signature) { this.dirty = false; this.props.onDraft(null); }
        }).catch(e => { this.dirty = true; this.props.onDraft(structuredClone(this.state.blocks)); this.props.onError(e); }).finally(() => {
            if (this.queuedSignature === signature) { this.queuedSignature = ''; if (this.mounted) this.setState({ saving: false }); }
        });
        return this.pending;
    };
    activate = (id: string, caret?: number) => this.setState({ active: id }, () => { this.input?.focus(); if (caret !== undefined) this.input?.setSelectionRange(caret, caret); });
    referenceOptions = () => this.props.objects.filter(o => !o.deleted_at && !o.ephemeral && o.id !== this.props.object.id && o.title.includes(this.state.reference ?? '')).slice(0, 8);
    insertReference = (b: Block, target: KnowledgeObject) => {
        const cursor = this.input?.selectionStart ?? b.text.length, start = b.text.slice(0, cursor).lastIndexOf('[[');
        const text = b.text.slice(0, start) + '[[' + target.title + ']]' + b.text.slice(cursor);
        this.setState({ blocks: this.state.blocks.map(x => x.id === b.id ? { ...x, text } : x), reference: null }, () => { this.rememberDraft(); this.activate(b.id, start + target.title.length + 4); });
    };
    key = (e: React.KeyboardEvent<HTMLTextAreaElement>, b: Block, index: number) => {
        if (e.nativeEvent.isComposing) return;
        if (this.state.reference !== null) {
            const options = this.referenceOptions();
            if (['ArrowDown', 'ArrowUp'].includes(e.key) && options.length) { e.preventDefault(); this.setState({ referenceIndex: (this.state.referenceIndex + (e.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length }); return; }
            if (e.key === 'Enter' && options.length) { e.preventDefault(); this.insertReference(b, options[this.state.referenceIndex] ?? options[0]); return; }
            if (e.key === 'Escape') { e.stopPropagation(); this.setState({ reference: null }); return; }
        }
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); void this.flush(); return; }
        if (e.key === 'Escape') { e.stopPropagation(); this.setState({ active: null, reference: null }); void this.flush(); return; }
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault(); const input = e.currentTarget, blocks = [...this.state.blocks];
            const next = { id: uid(), key: keyBetween(b.key, blocks[index + 1]?.key ?? null), text: b.text.slice(input.selectionEnd) };
            blocks[index] = { ...b, text: b.text.slice(0, input.selectionStart) }; blocks.splice(index + 1, 0, next);
            this.setState({ blocks, reference: null }, () => { this.rememberDraft(); this.activate(next.id, 0); void this.flush(); });
        } else if (e.key === 'Backspace' && e.currentTarget.selectionStart === 0 && e.currentTarget.selectionEnd === 0 && index > 0) {
            e.preventDefault(); const blocks = [...this.state.blocks], prev = blocks[index - 1], caret = prev.text.length;
            blocks[index - 1] = { ...prev, text: prev.text + b.text }; blocks.splice(index, 1);
            this.setState({ blocks, reference: null }, () => { this.rememberDraft(); this.activate(prev.id, caret); void this.flush(); });
        }
    };
    render() { const { blocks, active, reference } = this.state;
        return <div className="paragraph-editor">{blocks.map((b, index) => active === b.id ? <div key={b.id} className="paragraph-edit">
            <textarea ref={el => { this.input = el; }} autoFocus aria-label={`第${index + 1}段`} value={b.text} rows={1} onKeyDown={e => this.key(e, b, index)} onBlur={() => { this.setState({ active: null, reference: null }); void this.flush(); }} onChange={e => {
                const text = e.target.value, cursor = e.target.selectionStart, match = text.slice(0, cursor).match(/\[\[([^\]]*)$/);
                this.setState({ blocks: blocks.map(x => x.id === b.id ? { ...x, text } : x), reference: match?.[1] ?? null, referenceIndex: 0 }, this.rememberDraft);
            }}/>
            {reference !== null && <div className="reference-popover">{this.referenceOptions().map((o, i) => <button key={o.id} className={i === this.state.referenceIndex ? 'active' : ''} onMouseDown={e => { e.preventDefault(); this.insertReference(b, o); }}>{o.title}</button>)}</div>}
        </div> : <p key={b.id} id={'block-' + b.id} className="body-paragraph editable-paragraph" tabIndex={0} onKeyDown={e => { if (e.key === 'Enter') this.activate(b.id); }} onClick={e => { if (!(e.target as HTMLElement).closest('button')) this.activate(b.id); }}>{b.text ? this.props.renderMarkup(b.text) : <span className="empty-body">写点什么…</span>}</p>)}
            {!blocks.length && <button className="empty-body" onClick={() => { const b = { id: uid(), key: keyBetween(null, null), text: '' }; this.setState({ blocks: [b] }, () => { this.rememberDraft(); this.activate(b.id); }); }}>添加附文…</button>}
        </div>;
    }
}
