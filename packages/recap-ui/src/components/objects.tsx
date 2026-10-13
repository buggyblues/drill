import React, { useState } from 'react';
import type { KnowledgeObject, ObjectKind } from '../lib/domain';
import { KIND_LABELS, queryObjects } from '../lib/domain';
import { Badge, Button, EmptyState, IconButton, ObjectTypeLabel, Tag, TypeIcon, Skeleton } from './foundations';
import { TextField, Select, Checkbox } from './forms';
import { Dialog, DropdownMenu, type MenuAction } from './overlays';
import { Icon } from './icons';
import { EditorSurface } from './editor';
import { cn } from '../lib/utils';

export interface ObjectCardProps { object: KnowledgeObject; onOpen: (id: string) => void; onTagClick?: (tag: string) => void; actions?: MenuAction[]; selected?: boolean; }
export function ObjectCard({ object, onOpen, onTagClick, actions, selected }: ObjectCardProps) {
  return <article className="rc-object-card" data-selected={selected || undefined}>
    <div className="rc-card-top"><ObjectTypeLabel kind={object.kind} />{actions && <DropdownMenu trigger={<IconButton icon="more" label={`${object.title}的操作`} size="sm" />} items={actions} />}</div>
    {object.imageSrc && <img className="rc-card-image" src={object.imageSrc} alt="" loading="lazy" />}
    <h3><button type="button" className="rc-card-open" onClick={() => onOpen(object.id)}>{object.title || '未命名'}</button></h3>
    <div className="rc-card-description">{object.description || (object.body ? object.body.replace(/^#+\s/gm, '').slice(0, 160) : <span className="rc-text-muted">留一点空间，给下一个想法。</span>)}</div>
    <div className="rc-card-tags">{object.tags.map(tag => <Tag key={tag} onClick={onTagClick ? () => onTagClick(tag) : undefined}>{tag}</Tag>)}</div>
    <div className="rc-card-properties">
      {object.collaborators !== undefined && <div><Icon name="person" /><span>{object.collaborators || '未填写协作者'}</span></div>}
      <div><Icon name="calendar" /><span>{object.date || '暂无日期'}</span></div>
      {object.status && <div><Icon name="clock" /><Badge tone={object.status === 'active' ? 'success' : object.status === 'done' ? 'neutral' : 'accent'}>{({ planned: '计划中', active: '进行中', done: '已完成' })[object.status]}</Badge></div>}
      {object.duration !== undefined && <div><Icon name="audio" /><span>{Math.floor(object.duration / 60)}:{String(Math.round(object.duration % 60)).padStart(2, '0')}</span></div>}
    </div>
  </article>;
}
export interface ObjectCollectionProps {
  objects: KnowledgeObject[]; view?: 'grid' | 'list'; loading?: boolean;
  onOpen: (id: string) => void; onCreate?: () => void; onTagClick?: (tag: string) => void;
}
export function ObjectCollection({ objects, view = 'grid', loading = false, onOpen, onCreate, onTagClick }: ObjectCollectionProps) {
  if (loading) return <div className="rc-object-grid" aria-label="正在加载对象" aria-busy="true">{[0,1,2].map(n => <div className="rc-object-card" key={n}><Skeleton lines={5} /></div>)}</div>;
  if (!objects.length) return <EmptyState title="还没有匹配的对象" description="试试其他关键词，或从一个新想法开始。" action={onCreate && <Button onClick={onCreate}>新建对象</Button>} />;
  if (view === 'list') return <ul className="rc-object-list">{objects.map(object => <li key={object.id}>
    <button type="button" onClick={() => onOpen(object.id)}><TypeIcon kind={object.kind} /><strong>{object.title || '未命名'}</strong><span className="rc-list-tag">{object.tags[0]}</span><time>{object.date || '—'}</time><Icon name="chevron" size={14} /></button>
  </li>)}</ul>;
  return <div className="rc-object-grid">{objects.map(object => <ObjectCard key={object.id} object={object} onOpen={onOpen} onTagClick={onTagClick} />)}</div>;
}
export interface ObjectReferenceProps { id: string; label: string; kind: ObjectKind; onNavigate: (id: string) => void; }
export function ObjectReference({ id, label, kind, onNavigate }: ObjectReferenceProps) {
  return <button type="button" className="rc-object-reference" onClick={() => onNavigate(id)}><TypeIcon kind={kind} />{label}</button>;
}
export type PropertyValue = string | number | boolean;
export interface PropertyDefinition { id: string; label: string; type: 'text' | 'number' | 'date' | 'checkbox' | 'label'; value: PropertyValue; options?: { label: string; value: string }[]; readonly?: boolean; }
export interface PropertyGridProps { fields: PropertyDefinition[]; onChange?: (id: string, value: PropertyValue) => void; }
export function PropertyGrid({ fields, onChange }: PropertyGridProps) {
  return <dl className="rc-property-grid">{fields.map(field => <div className="rc-property-row" key={field.id}>
    <dt><Icon name={field.type === 'date' ? 'calendar' : field.type === 'checkbox' ? 'check' : field.type === 'label' ? 'tag' : 'note'} size={14} />{field.label}</dt>
    <dd>{!onChange || field.readonly ? <span>{field.value === '' ? '未填写' : typeof field.value === 'boolean' ? (field.value ? '是' : '否') : String(field.value)}</span> :
      field.type === 'checkbox' ? <Checkbox label={field.label} checked={Boolean(field.value)} onCheckedChange={next => onChange(field.id, next)} /> :
      field.type === 'label' ? <Select hideLabel label={field.label} value={String(field.value)} options={field.options ?? []} onValueChange={next => onChange(field.id, next)} /> :
      <TextField hideLabel label={field.label} type={field.type === 'text' ? 'text' : field.type} value={String(field.value)}
        onChange={event => onChange(field.id, field.type === 'number' && event.target.value !== '' ? Number(event.target.value) : event.target.value)} />}</dd>
  </div>)}</dl>;
}
export const PROPERTY_TYPES = [
  { id: 'text', label: '文本', description: '姓名、备注等自由文本' },
  { id: 'content', label: '正文', description: '结构化长内容' },
  { id: 'label', label: '状态标签', description: '类型内部的有限选项' },
  { id: 'object', label: '对象引用', description: '按稳定 ID 关联对象' },
  { id: 'checkbox', label: '复选框', description: '是 / 否值' },
  { id: 'date', label: '日期与时间', description: '时间点或日期' },
  { id: 'number', label: '数字', description: '评分、计数与数值' },
  { id: 'cover', label: '封面', description: '图片资产引用' },
  { id: 'icon', label: '图标', description: '对象识别标记' },
  { id: 'created', label: '创建时间', description: '系统生成，不可编辑' },
  { id: 'updated', label: '更新时间', description: '系统生成，不可编辑' },
  { id: 'aliases', label: '别名', description: '同一对象的其他称呼' },
] as const;
export type PropertyTypeId = typeof PROPERTY_TYPES[number]['id'];
export function PropertyTypePicker({ onSelect }: { onSelect: (id: PropertyTypeId) => void }) {
  const [query, setQuery] = useState('');
  const options = PROPERTY_TYPES.filter(option => `${option.label} ${option.id} ${option.description}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="rc-property-picker"><TextField label="搜索属性类型" hideLabel leading="search" placeholder="搜索属性类型…" value={query} onChange={event => setQuery(event.target.value)} />
    <div className="rc-picker-options">{options.map(option => <button key={option.id} type="button" onClick={() => onSelect(option.id)}>
      <Icon name={option.id === 'date' ? 'calendar' : option.id === 'checkbox' ? 'check' : option.id === 'object' ? 'link' : 'note'} /><span><strong>{option.label}</strong><small>{option.description}</small></span>
    </button>)}</div>{options.length === 0 && <p role="status">没有匹配的属性类型。</p>}
  </div>;
}
export interface TypePreset { id: string; kind: ObjectKind; title: string; description: string; category: string; }
export function TypeStudio({ presets, onAdd }: { presets: TypePreset[]; onAdd: (preset: TypePreset) => void }) {
  const [selected, setSelected] = useState<string>();
  const preset = presets.find(item => item.id === selected);
  return <div className="rc-type-studio">{Array.from(new Set(presets.map(item => item.category))).map(category => <section key={category}><h3 className="rc-nav-label">{category}</h3>
    <div className="rc-preset-grid">{presets.filter(item => item.category === category).map(item =>
      <button className="rc-preset" type="button" key={item.id} aria-pressed={selected === item.id} onClick={() => setSelected(item.id)}><TypeIcon kind={item.kind} size="md" /><strong>{item.title}</strong><p>{item.description}</p></button>)}</div>
  </section>)}<footer className="rc-studio-footer"><p>{preset ? `将添加「${preset.title}」类型` : '先选择一个适合你记录习惯的类型。'}</p><Button variant="primary" disabled={!preset} onClick={() => { if (preset) onAdd(preset); }}>添加对象类型</Button></footer></div>;
}
export function Backlinks({ objects, onOpen }: { objects: KnowledgeObject[]; onOpen: (id: string) => void }) {
  return <section className="rc-backlinks"><h3><Icon name="link" />引用此对象 <span>{objects.length}</span></h3>
    {objects.length ? objects.map(object => <ObjectReference key={object.id} id={object.id} label={object.title} kind={object.kind} onNavigate={onOpen} />) : <p className="rc-text-muted">还没有显式引用。相似标题不自动视为引用。</p>}
  </section>;
}
export interface ObjectPeekProps {
  object?: KnowledgeObject; open: boolean; onOpenChange: (open: boolean) => void;
  onChange?: (patch: Partial<KnowledgeObject>) => void; mode?: 'peek' | 'sidepanel';
  position?: number; total?: number; onPrevious?: () => void; onNext?: () => void;
  backlinks?: KnowledgeObject[]; onNavigate?: (id: string) => void;
}
export function ObjectPeek({ object, open, onOpenChange, onChange, mode = 'peek', position = 0, total = 1, onPrevious, onNext, backlinks = [], onNavigate }: ObjectPeekProps) {
  return <Dialog open={open} onOpenChange={onOpenChange} title={object?.title || '对象详情'} description={mode === 'peek' ? '保留当前列表上下文的对象预览' : '可与主页面并行使用的侧面板'} variant={mode === 'peek' ? 'peek' : 'sheet'} modal={mode === 'peek'}
    footer={<><span className="rc-text-muted">{Math.min(position + 1, total)} / {total}</span><span className="rc-footer-spacer" /><IconButton icon="back" label="上一个对象" disabled={position <= 0 || !onPrevious} onClick={onPrevious} /><IconButton icon="chevron" label="下一个对象" disabled={position >= total - 1 || !onNext} onClick={onNext} /></>}>
    {object && <div className="rc-object-detail"><ObjectTypeLabel kind={object.kind} />
      <TextField label="对象标题" hideLabel value={object.title} readOnly={!onChange} onChange={event => onChange?.({ title: event.target.value })} className="rc-title-field" />
      <div className="rc-card-tags">{object.tags.map(tag => <Tag key={tag}>{tag}</Tag>)}</div>
      <PropertyGrid fields={[
        { id: 'collaborators', label: '协作者（文本）', type: 'text', value: object.collaborators ?? '' },
        { id: 'date', label: '日期', type: 'date', value: object.date ?? '' },
        { id: 'status', label: '状态', type: 'label', value: object.status ?? 'planned', options: [{ value: 'planned', label: '计划中' }, { value: 'active', label: '进行中' }, { value: 'done', label: '已完成' }] },
      ]} onChange={onChange ? (id, value) => onChange({ [id]: value } as Partial<KnowledgeObject>) : undefined} />
      {object.imageSrc && <img className="rc-detail-image" src={object.imageSrc} alt={object.title} />}
      {object.audioSrc && <audio className="rc-native-audio" controls src={object.audioSrc} preload="metadata" aria-label={object.title} />}
      <EditorSurface value={object.body} onChange={onChange ? body => onChange({ body }) : undefined} />
      <Backlinks objects={backlinks} onOpen={onNavigate ?? (() => undefined)} />
    </div>}
  </Dialog>;
}
