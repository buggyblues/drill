import React, { useState } from 'react';
import { SegmentedControl } from './navigation';
import { Textarea } from './forms';
import { Callout } from './foundations';
import { safeHref } from '../lib/domain';

/** Minimal safe Markdown renderer. No HTML injection, remote parsing or contentEditable. */
function inline(value: string): React.ReactNode[] {
  return value.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g).filter(Boolean).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={index}>{part.slice(2, -2)}</strong>;
    const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
    if (link) {
      const href = safeHref(link[2]);
      return href ? <a key={index} href={href} target="_blank" rel="noreferrer noopener">{link[1]}</a> : <span key={index}>{link[1]}</span>;
    }
    return <React.Fragment key={index}>{part}</React.Fragment>;
  });
}
export function MarkdownPreview({ value }: { value: string }) {
  if (!value.trim()) return <p className="rc-text-muted">这里还没有内容。</p>;
  return <div className="rc-markdown">{value.split('\n').map((line, index) => {
    if (/^### /.test(line)) return <h4 key={index}>{inline(line.slice(4))}</h4>;
    if (/^## /.test(line)) return <h3 key={index}>{inline(line.slice(3))}</h3>;
    if (/^# /.test(line)) return <h2 key={index}>{inline(line.slice(2))}</h2>;
    if (/^> /.test(line)) return <blockquote key={index}>{inline(line.slice(2))}</blockquote>;
    if (/^- \[[ x]\] /.test(line)) return <p key={index} className="rc-md-check"><input type="checkbox" checked={line[3] === 'x'} readOnly tabIndex={-1} aria-label={line.slice(6)} />{inline(line.slice(6))}</p>;
    if (/^- /.test(line)) return <p key={index} className="rc-md-list"><span aria-hidden="true">•</span>{inline(line.slice(2))}</p>;
    if (!line.trim()) return <div key={index} className="rc-md-gap" />;
    return <p key={index}>{inline(line)}</p>;
  })}</div>;
}
export interface EditorSurfaceProps { value: string; onChange?: (value: string) => void; label?: string; placeholder?: string; }
export function EditorSurface({ value, onChange, label = '正文', placeholder = '写下一些想法。支持标题、引用、清单和链接…' }: EditorSurfaceProps) {
  const [mode, setMode] = useState('preview');
  return <section className="rc-editor"><div className="rc-section-heading"><span>{label}</span>{onChange && <SegmentedControl label="编辑模式" value={mode} onValueChange={setMode} options={[{ value: 'preview', label: '阅读' }, { value: 'edit', label: '编辑' }]} />}</div>
    {mode === 'edit' && onChange ? <><Textarea hideLabel label={label} rows={10} value={value} placeholder={placeholder} onChange={event => onChange(event.target.value)} />
      <p className="rc-field-hint">轻量 Markdown 输入；不是完整富文本/协同编辑器。</p></> : <MarkdownPreview value={value} />}
  </section>;
}
