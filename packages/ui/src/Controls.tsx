import React, { useState } from 'react';
import { Button, Checkbox, Dialog, Popover, Select, TextField } from '@recap/ui';

export type Choice = { value: string; label: string };
export function GhostSelect({ label, value, options, multiple = false, disabled = false, onChange }: {
    label: string; value: string | string[]; options: Choice[]; multiple?: boolean; disabled?: boolean;
    onChange: (value: any) => void | Promise<unknown>;
}) {
    const [open, setOpen] = useState(false), [query, setQuery] = useState('');
    const [busy, setBusy] = useState(false), [pendingValues, setPendingValues] = useState<string[] | null>(null);
    const values = pendingValues ?? (Array.isArray(value) ? value : [value]).filter(Boolean);
    async function change(next: string | string[]) {
        if (busy) return;
        setBusy(true); if (Array.isArray(next)) setPendingValues(next);
        try { await onChange(next); } finally { setPendingValues(null); setBusy(false); }
    }
    if (!multiple) return <div className="ghost-select recap-property-select"><Select hideLabel placeholder="未填写" label={label} value={values[0] ?? ''} disabled={disabled || busy} onValueChange={next => { void change(next); }} options={[{ value: '', label: '未填写' }, ...options]}/></div>;
    return <Popover open={open} onOpenChange={next => { setOpen(next); if (next) setQuery(''); }} label={label + '选项'}
        trigger={<Button variant="ghost" className="ghost-value" disabled={disabled} aria-label={label}>{values.map(v => options.find(o => o.value === v)?.label ?? v).join(' · ') || '未填写'}</Button>}>
        <div className="property-options">
            {options.length > 7 && <TextField label={'筛选' + label} hideLabel placeholder="筛选…" value={query} onChange={e => setQuery(e.target.value)}/>}
            <div className="property-choice-list">{options.filter(o => o.label.toLowerCase().includes(query.toLowerCase())).map(o => <Checkbox key={o.value} label={o.label} checked={values.includes(o.value)} disabled={busy} onCheckedChange={checked => { void change(checked ? [...values, o.value] : values.filter(v => v !== o.value)); }}/>)}</div>
            <Button size="sm" onClick={() => setOpen(false)}>完成</Button>
        </div>
    </Popover>;
}

export type DialogSpec = { title: string; description?: string; initial?: string; options?: Choice[]; confirm?: boolean; submit?: string; onSubmit: (value: string) => Promise<void> };
export function InputDialog({ spec, onClose, onError }: { spec: DialogSpec; onClose: () => void; onError: (e: any) => void }) {
    const [value, setValue] = useState(spec.initial ?? spec.options?.[0]?.value ?? ''), [busy, setBusy] = useState(false);
    return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }} title={spec.title} description={spec.description ?? (spec.confirm ? '请确认此操作。' : '填写后保存到当前工作空间。')}>
        <form className="connect-form" onSubmit={async e => {
            e.preventDefault(); if (busy || (!spec.confirm && !value.trim())) return;
            setBusy(true); try { await spec.onSubmit(value.trim()); onClose(); } catch (error) { onError(error); setBusy(false); }
        }}>
            {!spec.confirm && (spec.options ? <Select label={spec.title} value={value} options={spec.options} onValueChange={setValue}/> : <TextField autoFocus required label={spec.title} hideLabel value={value} onChange={e => setValue(e.target.value)}/>)}
            <div className="dialog-submit-row"><Button type="button" disabled={busy} onClick={onClose}>取消</Button><Button type="submit" variant={spec.submit === '删除' ? 'danger' : 'primary'} loading={busy} disabled={!spec.confirm && !value.trim()}>{spec.submit ?? '保存'}</Button></div>
        </form>
    </Dialog>;
}
