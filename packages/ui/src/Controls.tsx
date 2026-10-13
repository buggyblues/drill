import React, { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon.tsx';

export type Choice = { value: string; label: string };
export function GhostSelect({ label, value, options, multiple = false, disabled = false, onChange }: {
    label: string; value: string | string[]; options: Choice[]; multiple?: boolean; disabled?: boolean;
    onChange: (value: any) => void;
}) {
    const [open, setOpen] = useState(false), [query, setQuery] = useState('');
    const root = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null);
    useEffect(() => {
        if (!open) return;
        const outside = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
        document.addEventListener('mousedown', outside);
        return () => document.removeEventListener('mousedown', outside);
    }, [open]);
    const values = Array.isArray(value) ? value : [value];
    return <div className="ghost-select" ref={root} onKeyDown={e => {
        if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); trigger.current?.focus(); }
    }}>
        <button ref={trigger} className="ghost-value" aria-label={label} aria-expanded={open} aria-haspopup="dialog" disabled={disabled} onClick={() => { setOpen(!open); setQuery(''); }}>
            {values.filter(Boolean).map(v => options.find(o => o.value === v)?.label ?? v).join(' · ') || '—'}
        </button>
        {open && <div className="property-popover" role="dialog" aria-label={label + '选项'}>
            {options.length > 7 && <input autoFocus placeholder="筛选…" aria-label={'筛选' + label} value={query} onChange={e => setQuery(e.target.value)}/>}
            <div className="popover-options">
                {!multiple && <button onClick={() => { onChange(''); setOpen(false); trigger.current?.focus(); }}>—</button>}
                {options.filter(o => o.label.includes(query)).map(o => <button key={o.value} aria-pressed={values.includes(o.value)} onClick={() => {
                    onChange(multiple ? values.includes(o.value) ? values.filter(v => v && v !== o.value) : [...values.filter(Boolean), o.value] : o.value);
                    if (!multiple) { setOpen(false); trigger.current?.focus(); }
                }}><span>{o.label}</span>{values.includes(o.value) && <Icon name="check"/>}</button>)}
            </div>
            {multiple && <button className="popover-done" onClick={() => { setOpen(false); trigger.current?.focus(); }}>完成</button>}
        </div>}
    </div>;
}

export type DialogSpec = { title: string; description?: string; initial?: string; options?: Choice[]; confirm?: boolean; submit?: string; onSubmit: (value: string) => Promise<void> };
export function InputDialog({ spec, onClose, onError }: { spec: DialogSpec; onClose: () => void; onError: (e: any) => void }) {
    const [value, setValue] = useState(spec.initial ?? spec.options?.[0]?.value ?? ''), [busy, setBusy] = useState(false);
    return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget && !busy) onClose(); }}>
        <section className="generic-modal input-dialog" role="dialog" aria-modal="true" aria-label={spec.title}>
            <header><h2>{spec.title}</h2><button aria-label="关闭" disabled={busy} onClick={onClose}><Icon name="close"/></button></header>
            <form className="modal-content connect-form" onSubmit={async e => {
                e.preventDefault(); if (busy || (!spec.confirm && !value.trim())) return;
                setBusy(true); try { await spec.onSubmit(value.trim()); onClose(); } catch (error) { onError(error); setBusy(false); }
            }}>
                {spec.description && <p>{spec.description}</p>}
                {!spec.confirm && (spec.options ? <select autoFocus aria-label={spec.title} value={value} onChange={e => setValue(e.target.value)}>{spec.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select> : <input autoFocus required aria-label={spec.title} value={value} onChange={e => setValue(e.target.value)}/>)}
                <div className="button-row"><button className="primary" disabled={busy || (!spec.confirm && !value.trim())}>{busy ? '保存中…' : spec.submit ?? '保存'}</button><button type="button" disabled={busy} onClick={onClose}>取消</button></div>
            </form>
        </section>
    </div>;
}
