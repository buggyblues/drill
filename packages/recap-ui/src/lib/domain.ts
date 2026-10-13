/** Pure contracts shared by the UI and tests. Dates are civil YYYY-MM-DD dates, not timestamps. */
export type ObjectKind = 'project' | 'person' | 'note' | 'book' | 'image' | 'audio';
export type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | ObjectKind | 'tag';
export interface KnowledgeObject {
  id: string;
  kind: ObjectKind;
  title: string;
  description?: string;
  body: string;
  tags: string[];
  status?: 'planned' | 'active' | 'done';
  date?: string;
  createdAt: string;
  collaborators?: string;
  imageSrc?: string;
  audioSrc?: string;
  duration?: number;
}
export type CalendarMode = 'month' | 'week' | 'three-days' | 'day';
export interface DailyRecord { date: string; body: string; }
export interface LinkEdge { from: string; to: string; label?: string; }
export type SyncState =
  | { status: 'unknown' }
  | { status: 'offline'; pending: number }
  | { status: 'syncing'; progress: number }
  | { status: 'synced'; updatedAt: string }
  | { status: 'error'; message: string };

export const KIND_LABELS: Record<ObjectKind, string> = {
  project: '项目', person: '人物', note: '笔记', book: '书籍', image: '图片', audio: '音频',
};
export function normalized(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase().trim();
}
export function queryObjects(objects: readonly KnowledgeObject[], query: string, kind?: ObjectKind, tag?: string): KnowledgeObject[] {
  const parts = normalized(query).split(/\s+/).filter(Boolean);
  return objects.filter(object => (!kind || object.kind === kind) && (!tag || object.tags.includes(tag)) &&
    parts.every(part => normalized([object.title, object.description ?? '', object.body, object.kind, KIND_LABELS[object.kind], ...object.tags].join(' ')).includes(part)));
}
export function sortObjects(objects: readonly KnowledgeObject[], by: 'title' | 'createdAt', direction: 'asc' | 'desc' = 'asc'): KnowledgeObject[] {
  const collator = new Intl.Collator('zh-CN', { numeric: true, sensitivity: 'base' });
  return [...objects].sort((a, b) => {
    const delta = collator.compare(a[by], b[by]) || collator.compare(a.id, b.id);
    return direction === 'asc' ? delta : -delta;
  });
}
export function parseDate(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new RangeError(`Invalid civil date: ${value}`);
  const [year, month, day] = value.split('-').map(Number);
  const result = new Date(0);
  result.setUTCHours(0, 0, 0, 0); result.setUTCFullYear(year, month - 1, day);
  if (result.getUTCFullYear() !== year || result.getUTCMonth() !== month - 1 || result.getUTCDate() !== day)
    throw new RangeError(`Invalid civil date: ${value}`);
  return result;
}
export function dateKey(date: Date): string {
  return `${String(date.getUTCFullYear()).padStart(4, '0')}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}
export function localToday(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function addDays(value: string, offset: number): string {
  const date = parseDate(value); date.setUTCDate(date.getUTCDate() + offset); return dateKey(date);
}
export function addMonths(value: string, offset: number): string {
  const date = parseDate(value), original = date.getUTCDate();
  date.setUTCDate(1); date.setUTCMonth(date.getUTCMonth() + offset);
  const last = new Date(date); last.setUTCMonth(last.getUTCMonth() + 1, 0);
  date.setUTCDate(Math.min(original, last.getUTCDate())); return dateKey(date);
}
export function formatDate(value: string, locale = 'zh-CN', options: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric' }): string {
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' }).format(parseDate(value));
}
export function monthDays(value: string, weekStartsOn: 0 | 1 = 1): string[] {
  const date = parseDate(value); date.setUTCDate(1);
  const shift = (date.getUTCDay() - weekStartsOn + 7) % 7;
  return Array.from({ length: 42 }, (_, index) => addDays(dateKey(date), index - shift));
}
export function windowDays(value: string, mode: CalendarMode, weekStartsOn: 0 | 1 = 1): string[] {
  parseDate(value);
  if (mode === 'day') return [value];
  if (mode === 'three-days') return [addDays(value, -1), value, addDays(value, 1)];
  if (mode === 'week') {
    const shift = (parseDate(value).getUTCDay() - weekStartsOn + 7) % 7;
    return Array.from({ length: 7 }, (_, index) => addDays(value, index - shift));
  }
  const date = parseDate(value); date.setUTCDate(1);
  const next = addMonths(dateKey(date), 1);
  const result: string[] = [];
  for (let current = dateKey(date); current < next; current = addDays(current, 1)) result.push(current);
  return result;
}
export function safeHref(value: string): string | undefined {
  try {
    const url = new URL(value);
    return ['http:', 'https:', 'mailto:'].includes(url.protocol) ? url.href : undefined;
  } catch { return undefined; }
}
export interface FileLike { name: string; size: number; type: string; }
export function validateFiles(files: readonly FileLike[], maxBytes = 50 * 1024 * 1024, accept = ['.md', '.txt', '.json', '.png', '.jpg', '.jpeg', '.webp', '.mp3', '.wav', '.m4a']): { accepted: FileLike[]; errors: string[] } {
  const accepted: FileLike[] = [], errors: string[] = [];
  for (const file of files) {
    const ext = '.' + file.name.split('.').at(-1)?.toLowerCase();
    if (!Number.isFinite(file.size) || file.size <= 0) { errors.push(`${file.name}：文件为空`); continue; }
    if (file.size > maxBytes) { errors.push(`${file.name}：超过 ${Math.round(maxBytes / 1024 / 1024)} MB`); continue; }
    if (!accept.includes(ext)) { errors.push(`${file.name}：不支持此格式`); continue; }
    accepted.push(file);
  }
  return { accepted, errors };
}
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const unit = bytes < 1024 * 1024 ? 'KB' : bytes < 1024 * 1024 * 1024 ? 'MB' : 'GB';
  const divisor = { KB: 1024, MB: 1048576, GB: 1073741824 }[unit];
  return `${(bytes / divisor).toFixed(1)} ${unit}`;
}
export function markdownExport(object: KnowledgeObject): string {
  const title = object.title.replace(/[\r\n]/g, ' ');
  return `# ${title}\n\n类型：${KIND_LABELS[object.kind]}\n\n标签：${object.tags.join(' / ') || '无'}\n\n${object.body}\n`;
}
/** Do not blindly trust a browser cache: type guards discard incompatible demo data. */
export function isKnowledgeObject(value: unknown): value is KnowledgeObject {
  if (!value || typeof value !== 'object') return false;
  const object = value as Record<string, unknown>;
  if (typeof object.date === 'string' && object.date !== '') { try { parseDate(object.date); } catch { return false; } }
  return typeof object.id === 'string' && object.id.length > 0 && typeof object.title === 'string' && typeof object.body === 'string' &&
    typeof object.kind === 'string' && Object.hasOwn(KIND_LABELS, object.kind) &&
    Array.isArray(object.tags) && object.tags.every(tag => typeof tag === 'string') &&
    typeof object.createdAt === 'string' && Number.isFinite(new Date(object.createdAt).getTime()) &&
    (object.duration === undefined || (typeof object.duration === 'number' && Number.isFinite(object.duration) && object.duration >= 0)) &&
    (object.status === undefined || ['planned', 'active', 'done'].includes(String(object.status))) &&
    ['description','date','collaborators','imageSrc','audioSrc'].every(key => object[key] === undefined || typeof object[key] === 'string');
}

/** Convert timestamps explicitly at the view boundary; never slice UTC strings for local days. */
export function civilFromTimestamp(value: string, timeZone: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) { parseDate(value); return value; }
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new RangeError(`Invalid timestamp: ${value}`);
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const part = (type: string) => parts.find(item => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}
