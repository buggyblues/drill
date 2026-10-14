/** Shared, transport-neutral contracts. No credentials or provider reasoning in public views. */
export type AgentMode = 'chat' | 'research' | 'plan';
export type AgentEngine = 'deepseek' | 'harness';
export type RunStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' | 'interrupted';
export interface AgentScope {
  object_ids?: string[];
  belongs?: string;
  canvas_id?: string;
  tags?: string[];
  since?: number;
  until?: number;
  include_hidden?: boolean;
}
export interface Evidence {
  id: string; title: string; excerpt: string; rev: number; captured_at: number;
}
export interface WebEvidence { id: string; title: string; url: string; excerpt: string }
export interface AgentMessage {
  id: string; role: 'user' | 'assistant'; text: string; created_at: number;
  run_id?: string; citations?: Evidence[]; web_sources?: WebEvidence[];
}
export interface ToolCall { id: string; type: 'function'; function: { name: string; arguments: string } }
export interface WireMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'; content: string | null;
  reasoning_content?: string; tool_calls?: ToolCall[]; tool_call_id?: string;
}
export interface AgentSession {
  id: string; title: string; mode: AgentMode; scope: AgentScope;
  messages: AgentMessage[]; created_at: number; updated_at: number;
  archived: boolean; allow_web: boolean;
  /** Server only. Keep complete reasoning/tool pairs for the DeepSeek protocol. */
  wire?: WireMessage[];
}
export interface AgentEvent {
  seq: number; at: number;
  type: 'status' | 'tool_start' | 'tool_end' | 'plan' | 'compaction' | 'retry' | 'subagent' | 'approval' | 'warning';
  label: string; data?: Record<string, unknown>;
}
export interface AgentAction {
  id: string; type: 'metadata' | 'memory'; status: 'pending' | 'accepted' | 'rejected' | 'stale';
  object_id?: string; object_title?: string; field?: string; before?: unknown; value: unknown; base_rev?: number;
}
export interface InsightResult {
  silent: boolean; title: string; summary: string;
  findings: { observation: string; interpretation: string; citations: string[] }[];
  questions: string[]; next_step: string; citations: string[];
}
export interface AgentRun {
  id: string; session_id: string; kind: 'chat' | 'insight'; status: RunStatus; input: string;
  engine: AgentEngine; output: string; citations: Evidence[]; web_sources: WebEvidence[];
  events: AgentEvent[]; next_seq: number; actions: AgentAction[];
  usage: { prompt_tokens: number; completion_tokens: number; cached_tokens: number };
  created_at: number; updated_at: number; lease_until: number;
  error?: string; insight?: InsightResult; saved_object_id?: string;
  feedback?: 'helpful' | 'not_helpful'; perspective?: string;
  scope: AgentScope;
}
export interface AgentMemory { id: string; text: string; created_at: number; disabled: boolean }
export interface AgentRecord {
  id: string; user_id: string; category: 'session' | 'run' | 'memory';
  data: Record<string, any>; updated_at: number;
}
export interface AgentSettings {
  consent: boolean; use_memory: boolean; daily_runs: number;
}
export interface AgentCapabilities {
  configured: boolean; engine: AgentEngine; model: string; thinking: boolean;
  web_configured: boolean; consent: boolean; use_memory: boolean;
  max_steps: number; daily_limit: number; harness_version: string;
}
export const PERSPECTIVES = [
  { id: 'patterns', name: '重复的线索', description: '看见反复出现的主题与变化', prompt: '找出重复主题、时间变化与可能的盲点。区分观察与解释。' },
  { id: 'affirmation', name: '看见进展', description: '从记录里辨认已经发生的成长', prompt: '以具体记录为证据识别进展、努力和资源，不奉承，不泛泛鼓励。' },
  { id: 'questions', name: '再问深一点', description: '用更好的问题打开新的思路', prompt: '提出能让用户继续思考的开放问题。不要急于给结论。' },
  { id: 'action', name: '下一小步', description: '把模糊想法变成可尝试的实验', prompt: '基于记录提出一个低成本、可逆、可观察的小实验；不创建任务。' },
  { id: 'values', name: '在意的事情', description: '探索选择背后可能的价值取向', prompt: '探索用户选择中可能的价值冲突。不要把暂时倾向固化成人格标签。' },
  { id: 'counterpoint', name: '换个角度', description: '寻找反例，避免只印证已有判断', prompt: '同时寻找支持与反例，明确证据缺口，提供一种替代解释。' },
  { id: 'custom', name: '自定义视角', description: '写下你真正想探究的问题', prompt: '' },
] as const;
export const SKILLS = [
  { id: 'recall', name: '找回一段想法', mode: 'chat', prompt: '帮我找回最近记录里一个还没想清楚的问题，给出原文来源。' },
  { id: 'review', name: '本周回顾', mode: 'research', prompt: '回顾当前范围的记录：进展、反复遇到的问题、值得继续追问的线索。每项引用原记录。' },
  { id: 'connections', name: '连接两个主题', mode: 'research', prompt: '找出当前记录中两个表面不同、但存在联系的主题。也说明这种联系可能不成立的地方。' },
  { id: 'decision', name: '梳理一个选择', mode: 'plan', prompt: '帮我梳理当前记录中的一个未定选择：已知事实、假设、选择标准和信息缺口。先问我必要的问题。' },
] as const;
