import React from 'react';
import { Tabs as BaseTabs } from '@base-ui/react/tabs';
import { cn } from '../lib/utils';
import { Icon } from './icons';
import { IconButton, Badge } from './foundations';

export interface TabItem { value: string; label: string; content: React.ReactNode; disabled?: boolean; }
export interface TabsProps { label: string; items: TabItem[]; value?: string; defaultValue?: string; onValueChange?: (value: string) => void; }
export function Tabs({ label, items, value, defaultValue, onValueChange }: TabsProps) {
  return <BaseTabs.Root value={value} defaultValue={defaultValue ?? items[0]?.value} onValueChange={next => onValueChange?.(String(next))}>
    <BaseTabs.List className="rc-tabs" aria-label={label}>{items.map(item =>
      <BaseTabs.Tab key={item.value} className="rc-tab" value={item.value} disabled={item.disabled}>{item.label}</BaseTabs.Tab>)}
    </BaseTabs.List>{items.map(item => <BaseTabs.Panel key={item.value} value={item.value} className="rc-tab-panel">{item.content}</BaseTabs.Panel>)}
  </BaseTabs.Root>;
}
export interface SegmentOption { value: string; label: string; icon?: React.ReactNode; disabled?: boolean; }
export interface SegmentedControlProps { label: string; value: string; onValueChange: (value: string) => void; options: SegmentOption[]; }
export function SegmentedControl({ label, value, onValueChange, options }: SegmentedControlProps) {
  const name = React.useId();
  return <fieldset className="rc-segmented"><legend className="rc-sr-only">{label}</legend>
    {options.map(option => <label key={option.value} className="rc-segment" data-selected={option.value === value || undefined} data-disabled={option.disabled || undefined}>
      <input type="radio" name={name} value={option.value} checked={value === option.value} onChange={() => onValueChange(option.value)} disabled={option.disabled} />
      {option.icon}<span>{option.label}</span>
    </label>)}
  </fieldset>;
}
export interface BreadcrumbItem { label: string; onClick?: () => void; }
export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return <nav aria-label="当前位置"><ol className="rc-breadcrumbs">{items.map((item, index) => <li key={`${item.label}-${index}`}>
    {index > 0 && <Icon name="chevron" size={12} />}
    {index < items.length - 1 && item.onClick ? <button type="button" onClick={item.onClick}>{item.label}</button> : <span aria-current={index === items.length - 1 ? 'page' : undefined}>{item.label}</span>}
  </li>)}</ol></nav>;
}
export interface SidebarItem { id: string; label: string; icon?: React.ReactNode; count?: number; badge?: string; }
export interface SidebarSection { label: string; items: SidebarItem[]; }
export interface SidebarProps {
  title: string; subtitle?: string; activeId: string; sections: SidebarSection[];
  onNavigate: (id: string) => void; onSearch: () => void; onCreate: () => void; footer?: React.ReactNode;
}
export function Sidebar({ title, subtitle = '个人工作空间', activeId, sections, onNavigate, onSearch, onCreate, footer }: SidebarProps) {
  return <div className="rc-sidebar"><div className="rc-workspace"><span className="rc-brand-mark"><Icon name="project" size={20} /></span><div><strong>{title}</strong><small>{subtitle}</small></div><Icon name="down" size={14} /></div>
    <div className="rc-sidebar-actions"><button type="button" onClick={onCreate} className="rc-quick-new"><Icon name="plus" />新建对象</button><IconButton icon="search" label="搜索与命令" onClick={onSearch} /></div>
    <nav className="rc-sidebar-nav" aria-label="主导航">{sections.map(section => <section key={section.label}>
      {section.label && <h2 className="rc-nav-label">{section.label}</h2>}
      {section.items.map(item => <button type="button" key={item.id} className={cn('rc-nav-item', activeId === item.id && 'is-active')} aria-current={activeId === item.id ? 'page' : undefined} onClick={() => onNavigate(item.id)}>
        {item.icon}<span>{item.label}</span>{item.badge && <Badge tone="accent">{item.badge}</Badge>}{item.count !== undefined && <small>{item.count}</small>}
      </button>)}
    </section>)}</nav>
    {footer && <footer className="rc-sidebar-footer">{footer}</footer>}
  </div>;
}
export interface ViewToolbarProps { count?: number; children: React.ReactNode; label?: string; }
export function ViewToolbar({ count, children, label = '视图操作' }: ViewToolbarProps) {
  return <div className="rc-view-toolbar" role="group" aria-label={label}>{count !== undefined && <span className="rc-toolbar-count" aria-label={`${count} 个对象`}>{count}</span>}{children}</div>;
}
