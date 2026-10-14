import type { Workspace, KnowledgeObject } from '../../../core/src/types.ts';
import type { AgentScope, Evidence } from '../../../core/src/agent.ts';
import { DomainError } from '../merge.ts';
import { lexicalScore } from '../intelligence.ts';
export function validateScope(input: unknown): AgentScope {
  if (input === undefined) return {};
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new DomainError('资料范围必须是对象');
  const s = input as Record<string, unknown>, out: AgentScope = {};
  if(Object.keys(s).some(k=>!['object_ids','tags','belongs','canvas_id','since','until','include_hidden'].includes(k))) throw new DomainError('资料范围包含未知字段');
  for (const key of ['object_ids','tags'] as const) if (s[key] !== undefined) {
    if (!Array.isArray(s[key]) || s[key].length > 100 || s[key].some((x: unknown) => typeof x !== 'string' || !x || x.length > 200)) throw new DomainError('资料范围无效');
    out[key] = [...new Set(s[key] as string[])];
  }
  for (const key of ['belongs','canvas_id'] as const) if (s[key] !== undefined) {
    if (typeof s[key] !== 'string' || !s[key] || s[key].length > 200) throw new DomainError('资料范围无效'); out[key] = s[key];
  }
  for (const key of ['since','until'] as const) if (s[key] !== undefined) {
    if (!Number.isFinite(s[key]) || Number(s[key]) < 0) throw new DomainError('日期范围无效'); out[key] = Number(s[key]);
  }
  if (out.since && out.until && out.since > out.until) throw new DomainError('开始时间不能晚于结束时间');
  // Hidden notes are deliberately never exposed by the model. UI cannot override this invariant.
  return out;
}
export function scopedNotes(w: Workspace, scope: AgentScope): KnowledgeObject[] {
  const hidden: string[] = w.user.settings.discovery_hidden ?? [];
  let list = w.objects.filter(o => o.user_id === w.user.id && !o.deleted_at && !o.ephemeral && !hidden.includes(o.id) &&
    o.kind !== 'ai_output' && o.kind !== 'group' && o.form !== 'canvas');
  if (scope.object_ids) list = list.filter(o => scope.object_ids!.includes(o.id));
  if (scope.belongs) {
    const ids = new Set([scope.belongs]); let changed = true;
    while (changed) { changed = false; for (const r of w.relations) if (!r.deleted_at && r.type === 'belongs' && ids.has(r.to_id) && !ids.has(r.from_id)) { ids.add(r.from_id); changed = true; } }
    list = list.filter(o => ids.has(o.id));
  }
  if (scope.canvas_id) { const ids = new Set(w.placements.filter(p => !p.deleted_at && p.canvas_id === scope.canvas_id).map(p => p.object_id)); list = list.filter(o => ids.has(o.id)); }
  if (scope.tags) list = scope.tags.length ? list.filter(o => scope.tags!.every(t => o.tags_cached.includes(t))) : [];
  if (scope.since !== undefined) list = list.filter(o => o.captured_at >= scope.since!);
  if (scope.until !== undefined) list = list.filter(o => o.captured_at <= scope.until!);
  return list.sort((a,b) => b.captured_at - a.captured_at);
}
export const evidence = (o: KnowledgeObject): Evidence => ({id:o.id,title:o.title,excerpt:o.body.slice(0,2000),rev:o.rev,captured_at:o.captured_at});
export function rankNotes(list: KnowledgeObject[], query: string) {
  if (!query.trim()) return list;
  return list.map(o => ({o,score:lexicalScore(query, o.title+' '+o.body+' '+o.tags_cached.join(' ')) + (o.title.toLowerCase().includes(query.toLowerCase()) ? 1 : 0)})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).map(x=>x.o);
}
export function citationsIn(text: string, seen: Map<string,Evidence>): Evidence[] {
  return [...new Set([...text.matchAll(/\[note:([^\]\s]+)\]/g)].map(m=>m[1]))].filter(id=>seen.has(id)).map(id=>seen.get(id)!);
}
export function sanitizeCitations(text: string, seen: Map<string,Evidence>): string {
  return text.replace(/\[note:([^\]\s]+)\]/g, (all,id) => seen.has(id) ? all : '[来源未验证]');
}
