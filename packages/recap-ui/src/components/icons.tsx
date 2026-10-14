import React, { type SVGProps } from 'react';

const paths = {
  plus: 'M12 5v14M5 12h14',
  search: 'M21 21l-4.5-4.5M18 10.5a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0',
  close: 'M6 6l12 12M6 18L18 6',
  chevron: 'M9 5l7 7-7 7',
  down: 'M5 9l7 7 7-7',
  back: 'M15 5l-7 7 7 7',
  check: 'M5 12l4 4L19 6',
  project: 'm12 3 9 5v8l-9 5-9-5V8l9-5ZM3 8l9 5 9-5M12 13v8M7 5.8l10 5.4',
  person: 'M16 8a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 21v-2a8 8 0 0 1 16 0v2',
  note: 'M5 3h14v18H5zM8 7h8M8 11h8M8 15h5',
  book: 'M12 5C9 3 5 3 2 4v16c4-1 7-1 10 1 3-2 6-2 10-1V4c-3-1-7-1-10 1ZM12 5v16',
  image: 'M3 3h18v18H3zM3 16l6-6 5 5 3-3 4 4M16 7h.01',
  audio: 'M4 9v6M8 5v14M12 2v20M16 6v12M20 9v6',
  calendar: 'M4 5h16v16H4zM7 3v4M17 3v4M4 10h16M8 14h2M14 14h2M8 18h2',
  tag: 'M3 3h8l10 10-8 8L3 11V3ZM7 7h.01',
  grid: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  list: 'M8 5h13M8 12h13M8 19h13M3 5h.01M3 12h.01M3 19h.01',
  settings: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2',
  graph: 'M8 5a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM22 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM10 20a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM7 7l10 4M17 14l-8 5M5 8l1 9',
  sun: 'M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM12 1v3M12 20v3M1 12h3M20 12h3M4 4l2 2M18 18l2 2M4 20l2-2M18 6l2-2',
  moon: 'M20 15a9 9 0 0 1-11-11 9 9 0 1 0 11 11Z',
  filter: 'M3 5h18M6 12h12M10 19h4',
  sort: 'M7 3v18M3 17l4 4 4-4M13 5h8M13 10h6M13 15h4',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  export: 'M12 16V3M7 8l5-5 5 5M4 14v7h16v-7',
  import: 'M12 3v13M7 11l5 5 5-5M4 17v4h16v-4',
  link: 'M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-2 2M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l2-2',
  lock: 'M5 10h14v11H5zM8 10V6a4 4 0 0 1 8 0v4M12 14v3',
  cloud: 'M6 19a5 5 0 0 1-1-10 7 7 0 0 1 13-2 6 6 0 0 1 0 12H6Z',
  offline: 'M3 3l18 18M8 8a7 7 0 0 0-3 1 5 5 0 0 0 1 10h11M10 5a7 7 0 0 1 8 2 6 6 0 0 1 4 8',
  info: 'M12 11v6M12 7h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  arrow: 'M4 12h16M14 6l6 6-6 6',
  panel: 'M3 4h18v16H3zM15 4v16',
  command: 'M8 8V5a3 3 0 1 0-3 3h14a3 3 0 1 0-3-3v14a3 3 0 1 0 3-3H5a3 3 0 1 0 3 3V8Z',
  trash: 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7',
  sparkle: 'm12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z',
  pin: 'M8 3h8l-1 6 4 4v2H5v-2l4-4-1-6ZM12 15v7',
  play: 'm8 4 12 8-12 8V4Z',
  refresh: 'M20 5v6h-6M4 19v-6h6M19 11a7 7 0 0 0-12-6L4 8M5 13a7 7 0 0 0 12 6l3-3',
  folder: 'M3 5h7l2 3h9v13H3V5Z',
  clock: 'M12 7v5l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
} as const;
export type IconName = keyof typeof paths;
export interface IconProps extends SVGProps<SVGSVGElement> { name: IconName; size?: number; }
export function Icon({ name, size = 16, ...props }: IconProps) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...props}><path d={paths[name]} /></svg>;
}
