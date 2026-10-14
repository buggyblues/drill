import type { Workspace } from '../../../core/src/types.ts';
import type { AgentRecord, AgentRun, AgentSession, AgentMemory } from '../../../core/src/agent.ts';
import { DomainError } from '../merge.ts';
export function records(w: Workspace) { return w.agent_records ?? (w.agent_records = []); }
export function record<T>(w: Workspace, id: string, category: AgentRecord['category']): T {
  const r = records(w).find(r => r.id === id && r.user_id === w.user.id && r.category === category);
  if (!r) throw new DomainError('记录不存在或无权访问', 404);
  return r.data as T;
}
export function put<T extends { id: string }>(w: Workspace, category: AgentRecord['category'], data: T) {
  const rows = records(w), old = rows.find(r => r.id === data.id && r.category === category);
  const row = { id: data.id, user_id: w.user.id, category, data, updated_at: Date.now() };
  if (old) Object.assign(old, row); else rows.push(row);
}
export function sessions(w: Workspace) { return records(w).filter(r => r.category === 'session').map(r => r.data as AgentSession); }
export function runs(w: Workspace) { return records(w).filter(r => r.category === 'run').map(r => r.data as AgentRun); }
export function memories(w: Workspace) { return records(w).filter(r => r.category === 'memory').map(r => r.data as AgentMemory); }
export function publicSession(s: AgentSession) { const { wire: _wire, ...visible } = s; return visible; }
export function recoverExpired(w: Workspace) {
  for (const r of runs(w)) if (['queued','running'].includes(r.status) && r.lease_until < Date.now()) {
    r.status = 'interrupted'; r.error = '运行租约已失效，可能是服务重启或连接中断。已保留结果；请手动重试。';
    r.updated_at = Date.now(); put(w, 'run', r);
  }
}
