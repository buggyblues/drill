import React, { useState } from 'react';
import { cn } from '../lib/utils';
import { IconButton } from './foundations';
import { Sheet } from './overlays';
export interface AppShellProps { sidebar: React.ReactNode; children: React.ReactNode; topbar?: React.ReactNode; }
export function AppShell({ sidebar, children, topbar }: AppShellProps) {
  const [open, setOpen] = useState(false);
  return <div className="rc-app-shell"><a className="rc-skip-link" href="#recap-main">跳到主要内容</a>
    <aside className="rc-desktop-sidebar">{sidebar}</aside>
    <div className="rc-app-body"><header className="rc-app-topbar"><span className="rc-mobile-only"><IconButton icon="panel" label="打开导航" onClick={() => setOpen(true)} /></span>{topbar}</header>
      <main id="recap-main" className="rc-main" tabIndex={-1}>{children}</main></div>
    <Sheet open={open} onOpenChange={setOpen} title="导航" description="切换工作空间页面" className="rc-mobile-nav-sheet"><div onClick={event => {
      const target = event.target as HTMLElement;
      if (target.closest('.rc-nav-item')) setOpen(false);
    }}>{sidebar}</div></Sheet>
  </div>;
}
export interface PageHeaderProps { title: string; description?: string; icon?: React.ReactNode; eyebrow?: string; actions?: React.ReactNode; }
export function PageHeader({ title, description, icon, eyebrow, actions }: PageHeaderProps) {
  return <header className="rc-page-header"><div className="rc-page-heading">{icon}<div>{eyebrow && <p className="rc-eyebrow">{eyebrow}</p>}<h1>{title}</h1>{description && <p>{description}</p>}</div></div>
    {actions && <div className="rc-page-actions">{actions}</div>}
  </header>;
}
export function Surface({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={cn('rc-surface', className)}>{children}</div>;
}
