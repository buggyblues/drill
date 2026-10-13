import React, { createContext, useContext, useEffect, useState } from 'react';
import { DirectionProvider } from '@base-ui/react/direction-provider';
import { cn } from '../lib/utils';
export type Theme = 'dark' | 'light';
export type Density = 'comfortable' | 'compact';
const PortalContext = createContext<HTMLElement | null>(null);
export function useRecapPortal(): HTMLElement | null { return useContext(PortalContext); }
export interface RecapProviderProps {
  children: React.ReactNode; theme?: Theme; density?: Density; direction?: 'ltr' | 'rtl';
  className?: string; lang?: string;
}
/** Portals keep the same theme/density without changing the host application's document. */
export function RecapProvider({ children, theme = 'dark', density = 'comfortable', direction = 'ltr', lang = 'zh-CN', className }: RecapProviderProps) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const element = document.createElement('div');
    element.className = 'rc-root rc-portal-root';
    document.body.append(element); setHost(element);
    return () => { element.remove(); };
  }, []);
  useEffect(() => {
    if (host) { host.dataset.theme = theme; host.dataset.density = density; host.dir = direction; host.lang = lang; }
  }, [host, theme, density, direction, lang]);
  return <DirectionProvider direction={direction}><PortalContext.Provider value={host}>
    <div className={cn('rc-root', className)} data-theme={theme} data-density={density} dir={direction} lang={lang}>{children}</div>
  </PortalContext.Provider></DirectionProvider>;
}
