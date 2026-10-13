import React, { useEffect, useRef, useState } from 'react';
import { addDays, addMonths, monthDays, parseDate, dateKey, formatDate, windowDays, localToday, civilFromTimestamp,
  type CalendarMode, type DailyRecord, type KnowledgeObject } from '../lib/domain';
import { Button, EmptyState, IconButton } from './foundations';
import { SegmentedControl } from './navigation';
import { ObjectCollection } from './objects';
import { EditorSurface } from './editor';
import { Icon } from './icons';
import { cn } from '../lib/utils';

export interface MiniCalendarProps {
  value: string; onChange: (value: string) => void; today?: string; locale?: string;
  weekStartsOn?: 0 | 1; markedDates?: string[]; label?: string;
}
export function MiniCalendar({ value, onChange, today = localToday(), locale = 'zh-CN', weekStartsOn = 1, markedDates = [], label = '选择日期' }: MiniCalendarProps) {
  const [month, setMonth] = useState(value), [focused, setFocused] = useState(value);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => { setMonth(value); setFocused(value); }, [value]);
  const days = monthDays(month, weekStartsOn);
  const weekdays = Array.from({ length: 7 }, (_, index) => formatDate(addDays('2024-01-07', index + weekStartsOn), locale, { weekday: 'narrow' }));
  function move(next: string) {
    setMonth(next); setFocused(next);
    requestAnimationFrame(() => root.current?.querySelector<HTMLButtonElement>(`button[data-date="${next}"]`)?.focus());
  }
  function key(event: React.KeyboardEvent<HTMLButtonElement>, day: string) {
    let next: string | undefined;
    const rtl = root.current && getComputedStyle(root.current).direction === 'rtl';
    if (event.key === 'ArrowRight') next = addDays(day, rtl ? -1 : 1);
    if (event.key === 'ArrowLeft') next = addDays(day, rtl ? 1 : -1);
    if (event.key === 'ArrowDown') next = addDays(day, 7);
    if (event.key === 'ArrowUp') next = addDays(day, -7);
    if (event.key === 'PageDown') next = addMonths(day, event.shiftKey ? 12 : 1);
    if (event.key === 'PageUp') next = addMonths(day, event.shiftKey ? -12 : -1);
    const shift = (parseDate(day).getUTCDay() - weekStartsOn + 7) % 7;
    if (event.key === 'Home') next = addDays(day, -shift);
    if (event.key === 'End') next = addDays(day, 6 - shift);
    if (next) { event.preventDefault(); move(next); }
  }
  const currentMonth = month.slice(0, 7);
  return <div className="rc-mini-calendar" ref={root}>
    <div className="rc-mini-calendar-header"><strong aria-live="polite">{formatDate(month, locale, { month: 'long', year: 'numeric' })}</strong>
      <IconButton icon="back" label="上个月" size="sm" onClick={() => { const next = addMonths(month, -1); setMonth(next); setFocused(next); }} />
      <IconButton icon="chevron" label="下个月" size="sm" onClick={() => { const next = addMonths(month, 1); setMonth(next); setFocused(next); }} />
    </div>
    <table role="grid" aria-label={label}><thead><tr>{weekdays.map((name, index) => <th scope="col" key={index}>{name}</th>)}</tr></thead>
      <tbody>{Array.from({ length: 6 }, (_, row) => <tr key={row}>{days.slice(row * 7, row * 7 + 7).map(day =>
        <td key={day} aria-selected={day === value}><button type="button" data-date={day} onKeyDown={event => key(event, day)} onFocus={() => setFocused(day)}
          tabIndex={day === focused ? 0 : -1} onClick={() => onChange(day)} className={cn('rc-calendar-day', day === value && 'is-selected')}
          data-today={day === today || undefined} data-outside={day.slice(0, 7) !== currentMonth || undefined}
          aria-current={day === today ? 'date' : undefined} aria-label={formatDate(day, locale, { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}>
          {parseDate(day).getUTCDate()}{markedDates.includes(day) && <span className="rc-calendar-mark" aria-label="有笔记" />}
        </button></td>)}</tr>)}</tbody>
    </table><p className="rc-sr-only">方向键切换日期，回车选择，Page Up 或 Page Down 切换月份。</p>
  </div>;
}
export const CALENDAR_MODES = [{ value: 'month', label: '月' }, { value: 'week', label: '周' }, { value: 'three-days', label: '三天' }, { value: 'day', label: '日' }];
export interface DateNavigatorProps { date: string; mode: CalendarMode; onDateChange: (date: string) => void; onModeChange: (mode: CalendarMode) => void; today?: string; }
export function DateNavigator({ date, mode, onDateChange, onModeChange, today = localToday() }: DateNavigatorProps) {
  const step = (direction: number) => onDateChange(mode === 'month' ? addMonths(date, direction) : addDays(date, direction * (mode === 'week' ? 7 : mode === 'three-days' ? 3 : 1)));
  return <div className="rc-date-navigator"><strong>{formatDate(date, 'zh-CN', { year: 'numeric', month: 'long' })}</strong>
    <SegmentedControl label="日历视图" value={mode} onValueChange={next => onModeChange(next as CalendarMode)} options={CALENDAR_MODES} />
    <div className="rc-date-step"><IconButton icon="back" label="上一个日期窗口" onClick={() => step(-1)} /><Button size="sm" variant="ghost" onClick={() => onDateChange(today)}>今天</Button><IconButton icon="chevron" label="下一个日期窗口" onClick={() => step(1)} /></div>
  </div>;
}
export interface DailyNoteProps { date: string; record?: DailyRecord; onCreate: (date: string) => void; onChange?: (date: string, body: string) => void; }
export function DailyNote({ date, record, onCreate, onChange }: DailyNoteProps) {
  return <div className="rc-daily-note"><h3>每日笔记</h3>{record ? <EditorSurface label={`${date}的笔记`} value={record.body} onChange={onChange ? body => onChange(date, body) : undefined} /> :
    <Button size="sm" variant="ghost" leading={<Icon name="plus" size={13} />} onClick={() => onCreate(date)}>新建当日笔记</Button>}</div>;
}
export interface CalendarViewProps {
  date: string; mode: CalendarMode; records: DailyRecord[]; objects: KnowledgeObject[]; today?: string;
  onCreateNote: (date: string) => void; onNoteChange?: (date: string, body: string) => void;
  onOpenObject: (id: string) => void; timeZone?: string; weekStartsOn?: 0 | 1;
}
export function CalendarView({ date, mode, records, objects, today = localToday(), onCreateNote, onNoteChange, onOpenObject, timeZone = 'Asia/Shanghai', weekStartsOn = 1 }: CalendarViewProps) {
  const allDays = windowDays(date, mode, weekStartsOn);
  const days = mode === 'month' ? allDays.filter(day => records.some(record => record.date === day)) : allDays;
  if (!days.length) return <EmptyState icon="calendar" title="这个月，还没有每日笔记" description="浏览空日期不会自动创建内容。" action={<Button onClick={() => onCreateNote(date)}>写下第一条笔记</Button>} />;
  return <div className={cn('rc-calendar-view', `rc-calendar-view--${mode}`)}>{days.map(day => {
    const created = objects.filter(object => {
      try { return civilFromTimestamp(object.createdAt, timeZone) === day; } catch { return false; }
    });
    return <section key={day} className="rc-day-section"><div className="rc-day-heading"><span data-tone={day === today ? 'image' : 'note'}>{formatDate(day, 'zh-CN', { weekday: 'long' })}{day === today && ' · 今天'}</span><h2>{formatDate(day, 'zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })}</h2></div>
      <DailyNote date={day} record={records.find(record => record.date === day)} onCreate={onCreateNote} onChange={onNoteChange} />
      {day <= today && <section className="rc-created-section"><h3>{day === today ? '今日创建' : '在这一天创建'}</h3>
        {created.length ? <ObjectCollection view="list" objects={created} onOpen={onOpenObject} /> : <p className="rc-text-muted">还没有在这一天创建的对象。</p>}</section>}
    </section>;
  })}</div>;
}
