import React, { useEffect, useId, useRef, useState } from 'react';
import { Button, Badge, Callout, EmptyState, IconButton, Kbd, Skeleton } from './foundations';
import { Dialog } from './overlays';
import { FileDropzone, Progress } from './forms';
import { SegmentedControl } from './navigation';
import { Icon, type IconName } from './icons';
import { cn, downloadText } from '../lib/utils';
import { formatBytes, markdownExport, normalized, type KnowledgeObject, type SyncState } from '../lib/domain';

export interface SettingsRowProps { title: string; description?: string; children: React.ReactNode; danger?: boolean; }
export function SettingsRow({ title, description, children, danger }: SettingsRowProps) {
  return <div className="rc-settings-row" data-danger={danger || undefined}><div><h3>{title}</h3>{description && <p>{description}</p>}</div><div className="rc-settings-control">{children}</div></div>;
}
export interface SettingsSectionProps { title: string; description?: string; children: React.ReactNode; }
export function SettingsSection({ title, description, children }: SettingsSectionProps) {
  return <section className="rc-settings-section"><header><h2>{title}</h2>{description && <p>{description}</p>}</header><div>{children}</div></section>;
}
export function SyncStatus({ state, onRetry }: { state: SyncState; onRetry?: () => void }) {
  const presentation = {
    unknown: { tone: 'neutral', icon: 'cloud', text: '同步状态未知' },
    offline: { tone: 'warning', icon: 'offline', text: '当前离线' },
    syncing: { tone: 'accent', icon: 'refresh', text: '正在同步' },
    synced: { tone: 'success', icon: 'check', text: '已同步' },
    error: { tone: 'danger', icon: 'info', text: '同步失败' },
  }[state.status] as { tone: 'neutral' | 'warning' | 'accent' | 'success' | 'danger'; icon: IconName; text: string };
  return <div className="rc-sync-status"><div className="rc-sync-line" role="status"><Badge tone={presentation.tone}><Icon name={presentation.icon} />{presentation.text}</Badge>
    {state.status === 'offline' && <span>{state.pending} 项等待连接后同步</span>}
    {state.status === 'synced' && <small>服务端确认时间：{state.updatedAt}</small>}
  </div>{state.status === 'syncing' && <Progress label="同步进度" value={state.progress} />}
    {state.status === 'error' && <Callout tone="danger">{state.message}{onRetry && <Button size="sm" onClick={onRetry}>重试</Button>}</Callout>}
  </div>;
}
export interface StorageMeterProps { label: string; usedBytes: number; capacityBytes?: number; }
export function StorageMeter({ label, usedBytes, capacityBytes }: StorageMeterProps) {
  const known = capacityBytes !== undefined && Number.isFinite(capacityBytes) && capacityBytes > 0;
  const exceeded = known && usedBytes > capacityBytes!;
  return <div className="rc-storage-meter"><div className="rc-progress-label"><strong>{label}</strong><span>{formatBytes(usedBytes)} / {known ? formatBytes(capacityBytes!) : '额度未知'}</span></div>
    {known && <Progress label={`${label}用量`} value={usedBytes} max={capacityBytes} />}{exceeded && <p className="rc-field-error" role="alert">已超出额度，请先释放空间。</p>}
  </div>;
}
export interface FeatureGateProps { state: 'allowed' | 'locked' | 'checking'; title: string; description: string; children: React.ReactNode; onRequestAccess: () => void; }
export function FeatureGate({ state, title, description, children, onRequestAccess }: FeatureGateProps) {
  if (state === 'allowed') return <>{children}</>;
  if (state === 'checking') return <Skeleton lines={4} />;
  return <section className="rc-feature-gate"><span className="rc-feature-illustration"><Icon name="sparkle" size={36} /></span><Badge tone="accent">需要权限</Badge>
    <h2>{title}</h2><p>{description}</p><Button variant="primary" leading={<Icon name="lock" />} onClick={onRequestAccess}>了解访问权限</Button>
    <small>这里只表达功能状态；最终授权须由服务端验证。</small>
  </section>;
}
export interface CommandItem { id: string; label: string; description?: string; group?: string; keywords?: string; icon?: IconName; disabled?: boolean; shortcut?: string; onSelect: (mode: 'peek' | 'sidepanel') => void; }
export interface CommandPaletteProps { open: boolean; onOpenChange: (open: boolean) => void; items: CommandItem[]; }
export function CommandPalette({ open, onOpenChange, items }: CommandPaletteProps) {
  const [query, setQuery] = useState(''), [active, setActive] = useState(0);
  const id = useId(), input = useRef<HTMLInputElement>(null);
  const visible = items.filter(item => normalized(`${item.label} ${item.description ?? ''} ${item.keywords ?? ''} ${item.group ?? ''}`).includes(normalized(query)));
  const selectable = visible.filter(item => !item.disabled);
  const selected = selectable[Math.min(active, Math.max(0, selectable.length - 1))];
  useEffect(() => {
    if (!open) return;
    setQuery(''); setActive(0);
    const timer = setTimeout(() => input.current?.focus(), 0);
    return () => clearTimeout(timer);
  }, [open]);
  useEffect(() => { if (selected) document.getElementById(`${id}-${selected.id}`)?.scrollIntoView({ block: 'nearest' }); }, [selected?.id, id]);
  function choose(item: CommandItem, side = false) {
    if (item.disabled) return;
    onOpenChange(false); item.onSelect(side ? 'sidepanel' : 'peek');
  }
  return <Dialog open={open} onOpenChange={onOpenChange} title="搜索与命令" description="搜索对象、切换页面或执行操作。" className="rc-command-dialog"
    footer={<><span><Kbd>↑</Kbd> <Kbd>↓</Kbd> 导航</span><span><Kbd>↵</Kbd> 打开</span><span><Kbd>⇧ ↵</Kbd> 侧面板</span><span className="rc-footer-spacer" /><span><Kbd>Esc</Kbd> 关闭</span></>}>
    <div className="rc-command-search"><Icon name="search" size={20} /><input ref={input} role="combobox" aria-label="搜索对象或操作" aria-autocomplete="list" aria-expanded={open}
      aria-controls={`${id}-list`} aria-activedescendant={selected ? `${id}-${selected.id}` : undefined}
      placeholder="搜索对象、操作，或输入关键词…" value={query} onChange={event => { setQuery(event.target.value); setActive(0); }}
      onKeyDown={event => {
        if (event.nativeEvent.isComposing) return;
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault(); setActive(current => selectable.length ? (current + (event.key === 'ArrowDown' ? 1 : -1) + selectable.length) % selectable.length : 0);
        }
        if (event.key === 'Enter' && selected) { event.preventDefault(); choose(selected, event.shiftKey); }
      }} /></div>
    <div id={`${id}-list`} role="listbox" aria-label="搜索结果" className="rc-command-list">
      {visible.map(item => <div key={item.id} id={`${id}-${item.id}`} role="option" aria-selected={selected?.id === item.id} aria-disabled={item.disabled || undefined}
        className="rc-command-item" onMouseMove={() => { const index = selectable.findIndex(candidate => candidate.id === item.id); if (index >= 0) setActive(index); }}
        onMouseDown={event => event.preventDefault()} onClick={() => choose(item)}>
        <span className="rc-command-icon"><Icon name={item.icon ?? 'note'} /></span><div><strong>{item.label}</strong>{item.description && <small>{item.description}</small>}</div>
        <span className="rc-command-group">{item.group}</span>{item.shortcut && <Kbd>{item.shortcut}</Kbd>}
      </div>)}
    </div>{!visible.length && <EmptyState icon="search" title="没有找到结果" description="试试对象名称、类型或操作关键词。" />}
    <p className="rc-sr-only" role="status">{visible.length} 个结果</p>
  </Dialog>;
}
export interface ImportWizardProps {
  open: boolean; onOpenChange: (open: boolean) => void;
  onImport: (files: File[]) => Promise<void>; acceptedSources?: ('markdown' | 'json' | 'media')[];
}
export function ImportWizard({ open, onOpenChange, onImport, acceptedSources = ['markdown', 'json', 'media'] }: ImportWizardProps) {
  const [step, setStep] = useState<'source' | 'files' | 'review' | 'success'>('source');
  const [source, setSource] = useState<'markdown' | 'json' | 'media'>('markdown');
  const [files, setFiles] = useState<File[]>([]), [pending, setPending] = useState(false), [error, setError] = useState('');
  useEffect(() => { if (open) { setStep('source'); setFiles([]); setError(''); setSource(acceptedSources[0] ?? 'markdown'); } }, [open]);
  const formats = { markdown: ['.md', '.txt'], json: ['.json'], media: ['.png', '.jpg', '.jpeg', '.webp', '.mp3', '.wav', '.m4a'] };
  async function submit() {
    setPending(true); setError('');
    try { await onImport(files); setStep('success'); }
    catch (error) { setError(error instanceof Error ? error.message : '导入失败，请重试。'); }
    finally { setPending(false); }
  }
  return <Dialog open={open} onOpenChange={next => { if (!pending) onOpenChange(next); }} title="导入内容" description="选择来源 → 检查文件 → 确认导入。实际存储与传输方式由接入方决定。"
    footer={step === 'success' ? <Button variant="primary" onClick={() => onOpenChange(false)}>完成</Button> : <>
      {step !== 'source' && <Button disabled={pending} onClick={() => setStep(step === 'review' ? 'files' : 'source')}>上一步</Button>}
      <span className="rc-footer-spacer" /><Button variant="primary" disabled={(step === 'files' && files.length === 0) || (step === 'source' && !acceptedSources.includes(source))} loading={pending} onClick={() => {
        if (step === 'source') setStep('files'); else if (step === 'files') setStep('review'); else void submit();
      }}>{step === 'review' ? '确认导入' : '继续'}</Button></>}>
    {step === 'source' && <><SegmentedControl label="导入来源" value={source} onValueChange={next => { setSource(next as typeof source); setFiles([]); }} options={[
      { value: 'markdown', label: 'Markdown', disabled: !acceptedSources.includes('markdown') },
      { value: 'json', label: 'Recap JSON', disabled: !acceptedSources.includes('json') },
      { value: 'media', label: '媒体文件', disabled: !acceptedSources.includes('media') }]} />
      <Callout title="导入边界">组件负责选择、校验与确认；内容转换由 onImport 适配器完成。ZIP 解压和其他产品数据库迁移不在默认实现中。</Callout></>}
    {step === 'files' && <><FileDropzone accept={formats[source]} onFiles={next => setFiles(previous => [...previous, ...next].filter((file, index, all) => all.findIndex(other => other.name === file.name && other.size === file.size && other.lastModified === file.lastModified) === index))} />
      {files.length > 0 && <ul className="rc-file-list">{files.map((file, index) => <li key={`${file.name}-${index}`}><Icon name="note" /><span>{file.name}</span><small>{formatBytes(file.size)}</small><IconButton icon="close" label={`移除${file.name}`} onClick={() => setFiles(previous => previous.filter((_, i) => i !== index))} /></li>)}</ul>}</>}
    {step === 'review' && <><Callout title={`准备导入 ${files.length} 个文件`}>请确认文件来自可信来源。组件不会运行导入文件中的 HTML 或脚本。</Callout><ul className="rc-file-list">{files.map((file, index) => <li key={index}><Icon name="note" /><span>{file.name}</span><small>{formatBytes(file.size)}</small></li>)}</ul></>}
    {step === 'success' && <EmptyState icon="check" title="导入已完成" description="导入适配器已成功返回。" />}
    {error && <Callout tone="danger">{error}</Callout>}
  </Dialog>;
}
export interface ExportAdapter { id: string; label: string; export: (objects: KnowledgeObject[]) => Promise<void>; }
export interface ExportDialogProps { open: boolean; onOpenChange: (open: boolean) => void; objects: KnowledgeObject[]; adapters?: ExportAdapter[]; }
export function ExportDialog({ open, onOpenChange, objects, adapters = [] }: ExportDialogProps) {
  const [format, setFormat] = useState('markdown'), [pending, setPending] = useState(false), [error, setError] = useState('');
  async function submit() {
    setPending(true); setError('');
    try {
      if (format === 'markdown') downloadText('recap-notes.md', objects.map(markdownExport).join('\n---\n\n'), 'text/markdown;charset=utf-8');
      else if (format === 'json') downloadText('recap-objects.json', JSON.stringify({ schemaVersion: 1, objects }, null, 2), 'application/json');
      else {
        const adapter = adapters.find(item => item.id === format);
        if (!adapter) throw new Error('此导出适配器不可用。');
        await adapter.export(objects);
      }
      onOpenChange(false);
    } catch (error) { setError(error instanceof Error ? error.message : '导出失败'); } finally { setPending(false); }
  }
  return <Dialog open={open} onOpenChange={next => { if (!pending) onOpenChange(next); }} title="导出对象" description={`将 ${objects.length} 个对象导出到本机，不包含登录信息。`}
    footer={<Button variant="primary" leading={<Icon name="export" />} loading={pending} disabled={!objects.length} onClick={() => void submit()}>导出文件</Button>}>
    <SegmentedControl label="导出格式" value={format} onValueChange={setFormat} options={[{ value: 'markdown', label: 'Markdown' }, { value: 'json', label: 'JSON' }, ...adapters.map(item => ({ value: item.id, label: item.label }))]} />
    <Callout title="数据可带走">Markdown 适合阅读，JSON 保留对象字段。媒体导出只保留 URL，不打包媒体文件；PDF、Word 与 LaTeX 需要另行提供适配器。</Callout>
    {error && <Callout tone="danger">{error}</Callout>}
  </Dialog>;
}
