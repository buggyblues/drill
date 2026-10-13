import React, { forwardRef } from 'react';
import { cn } from '../lib/utils';
import type { ObjectKind, Tone } from '../lib/domain';
import { KIND_LABELS } from '../lib/domain';
import { Icon, type IconName } from './icons';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
}
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({
  variant = 'secondary', size = 'md', loading = false, leading, trailing, disabled, className, children, type = 'button', ...props
}, ref) {
  return <button ref={ref} type={type} className={cn('rc-button', `rc-button--${variant}`, `rc-button--${size}`, className)}
    disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
    {loading ? <Spinner label="" /> : leading}{children}{trailing}
  </button>;
});
export interface IconButtonProps extends Omit<ButtonProps, 'children' | 'leading' | 'trailing'> {
  label: string; icon: IconName;
}
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton({ label, icon, className, ...props }, ref) {
  return <Button ref={ref} variant="ghost" className={cn('rc-icon-button', className)} aria-label={label} title={label} {...props}><Icon name={icon} /></Button>;
});
export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> { tone?: Tone; dot?: boolean; }
export function Badge({ tone = 'neutral', dot, className, children, ...props }: BadgeProps) {
  return <span className={cn('rc-badge', className)} data-tone={tone} {...props}>{dot && <span className="rc-dot" />}{children}</span>;
}
export interface TagProps { children: React.ReactNode; tone?: Tone; selected?: boolean; onClick?: () => void; onRemove?: () => void; label?: string; }
export function Tag({ children, tone = 'tag', selected, onClick, onRemove, label }: TagProps) {
  return <span className="rc-tag" data-tone={tone} data-selected={selected || undefined}>
    {onClick ? <button type="button" onClick={onClick} aria-pressed={selected}>{children}</button> : <span>{children}</span>}
    {onRemove && <button type="button" aria-label={label ?? `移除标签 ${typeof children === 'string' ? children : ''}`} onClick={onRemove}><Icon name="close" size={12} /></button>}
  </span>;
}
export function TypeIcon({ kind, size = 'sm' }: { kind: ObjectKind; size?: 'sm' | 'md' | 'lg' }) {
  return <span className={cn('rc-type-icon', `rc-type-icon--${size}`)} data-tone={kind}><Icon name={kind} size={size === 'lg' ? 26 : size === 'md' ? 20 : 14} /></span>;
}
export function ObjectTypeLabel({ kind }: { kind: ObjectKind }) {
  return <span className="rc-type-label"><TypeIcon kind={kind} /><span>{KIND_LABELS[kind]}</span></span>;
}
export function Kbd({ children }: { children: React.ReactNode }) { return <kbd className="rc-kbd">{children}</kbd>; }
export function Separator({ className }: { className?: string }) { return <hr className={cn('rc-separator', className)} />; }
export function Avatar({ name, src, size = 28 }: { name: string; src?: string; size?: number }) {
  return <span className="rc-avatar" style={{ width: size, height: size }} title={name}>
    {src ? <img src={src} alt={name} /> : <span aria-label={name}>{[...name].slice(0, 1).join('').toUpperCase()}</span>}
  </span>;
}
export function Spinner({ label = '加载中' }: { label?: string }) {
  return <span className="rc-spinner" role={label ? 'status' : undefined} aria-label={label || undefined} aria-hidden={!label || undefined} />;
}
export function Skeleton({ lines = 3, className }: { lines?: number; className?: string }) {
  return <div className={cn('rc-skeleton', className)} role="status" aria-label="正在加载内容">
    {Array.from({ length: lines }, (_, i) => <span key={i} style={{ width: i === lines - 1 ? '64%' : '100%' }} />)}
  </div>;
}
export interface EmptyStateProps { title: string; description?: string; icon?: IconName; action?: React.ReactNode; }
export function EmptyState({ title, description, icon = 'note', action }: EmptyStateProps) {
  return <div className="rc-empty"><span className="rc-empty-icon"><Icon name={icon} size={24} /></span><h3>{title}</h3>
    {description && <p>{description}</p>}{action && <div>{action}</div>}</div>;
}
export interface CalloutProps { title?: string; children: React.ReactNode; tone?: 'accent' | 'warning' | 'danger' | 'success'; }
export function Callout({ title, children, tone = 'accent' }: CalloutProps) {
  return <div className="rc-callout" data-tone={tone} role={tone === 'danger' ? 'alert' : undefined}>
    <Icon name={tone === 'success' ? 'check' : 'info'} /><div>{title && <strong>{title}</strong>}<div>{children}</div></div>
  </div>;
}
