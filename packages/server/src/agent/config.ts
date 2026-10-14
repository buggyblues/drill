import type { AgentEngine } from '../../../core/src/agent.ts';
import { DomainError } from '../merge.ts';
const bounded = (v: string | undefined, fallback: number, min: number, max: number) => {
  const n = Number(v); return Number.isFinite(n) && v ? Math.max(min, Math.min(max, Math.floor(n))) : fallback;
};
export function agentConfig(env: NodeJS.ProcessEnv = process.env) {
  const engine: AgentEngine = env.DRILL_AGENT_ENGINE === 'harness' ? 'harness' : 'deepseek';
  const key = env.DEEPSEEK_API_KEY || env.AI_API_KEY || '';
  const base = (env.DEEPSEEK_BASE_URL || env.AI_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, '');
  const nativeModel = env.DEEPSEEK_MODEL || env.AI_MODEL || 'deepseek-flash';
  const model = engine === 'harness' ? (env.DRILL_HARNESS_MODEL || 'deepseek-v4-flash') : nativeModel;
  return { engine, key, base, model, nativeModel, configured: Boolean(key),
    thinking: env.DEEPSEEK_THINKING !== 'disabled',
    effort: ['low', 'high', 'max'].includes(env.DEEPSEEK_REASONING_EFFORT || '') ? env.DEEPSEEK_REASONING_EFFORT! : 'high',
    maxTokens: bounded(env.DRILL_AGENT_MAX_TOKENS, 4096, 256, 16384),
    maxSteps: bounded(env.DRILL_AGENT_MAX_STEPS, 10, 1, 30),
    dailyLimit: bounded(env.DRILL_AGENT_DAILY_RUNS, 30, 1, 500),
    timeoutMs: bounded(env.DRILL_AGENT_TIMEOUT_MS, 180000, 5000, 900000),
    contextChars: bounded(env.DRILL_AGENT_CONTEXT_CHARS, 48000, 8000, 160000),
    webKey: env.TAVILY_API_KEY || '',
    harnessVersion: '0.2.1-alpha.2',
  };
}
export type AgentConfig = ReturnType<typeof agentConfig>;
export function checkProviderURL(base: string) {
  const u = new URL(base);
  if (u.username || u.password || u.search || u.hash ||
      (u.protocol !== 'https:' && !(u.protocol === 'http:' && ['localhost','127.0.0.1','[::1]'].includes(u.hostname))))
    throw new DomainError('AI 服务地址必须是无内嵌凭证的 HTTPS 地址；仅本机调试允许 HTTP。', 503);
}
