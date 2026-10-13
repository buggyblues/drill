import React from 'react';
import {
    Plus, Search, Inbox, CircleCheck, Fingerprint, Sparkles, Map, Shuffle, Clock, LayoutDashboard,
    Folder, ChevronRight, ChevronDown, X, PanelLeft, PanelRight, Settings, ArrowRight, ArrowLeft,
    Link, Ellipsis, List, Columns3, Check, Trash2, Download, MousePointer2, Type, Group, Maximize,
    Minus, GitBranch, ExternalLink, Tag, Mic, Eye, CircleHelp,
} from 'lucide-react';
import type { LucideIcon, LucideProps } from 'lucide-react';
const icons: Record<string, LucideIcon> = {
    plus: Plus, search: Search, recent: Inbox, action: CircleCheck, memory: Fingerprint, spark: Sparkles,
    map: Map, walk: Shuffle, clock: Clock, canvas: LayoutDashboard, folder: Folder, chevron: ChevronRight,
    down: ChevronDown, close: X, sidebar: PanelLeft, panel: PanelRight, settings: Settings,
    arrow: ArrowRight, back: ArrowLeft, link: Link, more: Ellipsis, list: List, board: Columns3,
    check: Check, trash: Trash2, download: Download, select: MousePointer2, text: Type, group: Group,
    fit: Maximize, minus: Minus, branch: GitBranch, external: ExternalLink, tag: Tag, mic: Mic, eye: Eye, help: CircleHelp,
};
export function Icon({ name, size = 16, ...props }: LucideProps & { name: string }) {
    const Component = icons[name] ?? Inbox;
    return <Component size={size} strokeWidth={1.5} aria-hidden="true" {...props}/>;
}
