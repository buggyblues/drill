import { DomainError } from './merge.ts';

/**
 * 向量服务的唯一配置入口。
 *
 * 不变式：**同一条链上的所有供应商必须提供同一个模型。**
 * 向量只在同一个模型的向量空间里可比；混用会让检索静默变差——
 * 不报错，只是结果越来越不对。
 */
export const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL?.trim() || 'BAAI/bge-m3';
export const EMBEDDING_DIMS = Number(process.env.EMBEDDING_DIMS || 1024);

export type Provider = { name: string; url: string; key?: string; format: 'openai' | 'cloudflare' };

/** 主供应商来自 EMBEDDING_URL，备选来自 EMBEDDING_FALLBACKS（JSON 数组）。 */
export function providers(): Provider[] {
    const list: Provider[] = [];
    const primary = process.env.EMBEDDING_URL?.trim();
    if (primary)
        list.push({ name: 'primary', url: primary, key: process.env.EMBEDDING_KEY, format: 'openai' });
    const raw = process.env.EMBEDDING_FALLBACKS?.trim();
    if (raw) {
        let parsed: unknown;
        try {
            parsed = JSON.parse(raw);
        }
        catch {
            throw new Error('EMBEDDING_FALLBACKS 必须是 JSON 数组，例如 [{"name":"cf","url":"https://...","key":"..."}]');
        }
        if (!Array.isArray(parsed))
            throw new Error('EMBEDDING_FALLBACKS 必须是 JSON 数组');
        parsed.forEach((entry: any, i: number) => {
            if (typeof entry?.url !== 'string' || !entry.url.startsWith('https://'))
                throw new Error(`EMBEDDING_FALLBACKS[${i}].url 必须是 https 地址`);
            list.push({ name: entry.name || `fallback-${i + 1}`, url: entry.url, key: entry.key, format: entry.format === 'cloudflare' ? 'cloudflare' : 'openai' });
        });
    }
    return list;
}

export const embeddingReady = () => providers().length > 0;

/** 上游返回形状：OpenAI 是 data[].embedding，Cloudflare 是 result.data[][]，原生服务是 embeddings[][]。 */
function parse(body: any, format: Provider['format'], expected: number): number[][] | null {
    const values = format === 'cloudflare' ? body?.result?.data : (body?.embeddings ?? body?.data?.map((v: any) => v.embedding));
    if (!Array.isArray(values) || values.length !== expected)
        return null;
    if (values.some((v: any) => !Array.isArray(v) || v.length !== EMBEDDING_DIMS || !v.every(Number.isFinite)))
        return null;
    return values as number[][];
}

/** 值得转移到下一个供应商的信号。4xx 不转移——那是我们请求本身的问题，换谁都会失败。 */
const retryable = (status: number) => status === 429 || status >= 500;

/**
 * 主供应商故障后的静默期。
 * 没有它，主站超时会让**每一次**向量调用都白等一整个 timeout——比直接失败还糟。
 */
let primaryDownUntil = 0;

export async function embedWithFallback(texts: string[]): Promise<{ vectors: number[][]; provider: string }> {
    const chain = providers();
    if (!chain.length)
        throw new DomainError('尚未配置向量服务。设置 EMBEDDING_URL，或留空以仅使用字面搜索。', 503);
    const timeout = Number(process.env.EMBEDDING_TIMEOUT_MS || 45000);
    const skippedPrimary = chain.length > 1 && Date.now() < primaryDownUntil;
    const order = skippedPrimary ? chain.slice(1) : chain;
    const failures: string[] = skippedPrimary ? ['primary: 静默期内跳过'] : [];
    for (const p of order) {
        try {
            const body = p.format === 'cloudflare' ? { text: texts } : { input: texts, model: EMBEDDING_MODEL };
            const r = await fetch(p.url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...(p.key ? { Authorization: 'Bearer ' + p.key } : {}) },
                body: JSON.stringify(body),
                signal: AbortSignal.timeout(timeout),
            });
            if (!r.ok) {
                if (!retryable(r.status))
                    throw new DomainError(`向量服务拒绝了请求（${p.name}，HTTP ${r.status}）`, 502);
                failures.push(`${p.name}: HTTP ${r.status}`);
                if (p.name === 'primary')
                    primaryDownUntil = Date.now() + 60000;
                continue;
            }
            const parsed = parse(await r.json(), p.format, texts.length);
            if (!parsed) {
                failures.push(`${p.name}: 返回形状不符合 ${EMBEDDING_MODEL} / ${EMBEDDING_DIMS} 维`);
                if (p.name === 'primary')
                    primaryDownUntil = Date.now() + 60000;
                continue;
            }
            if (p.name !== 'primary')
                primaryDownUntil = 0; // 备选可用，不必继续惩罚主供应商
            return { vectors: parsed, provider: p.name };
        }
        catch (e: any) {
            if (e instanceof DomainError)
                throw e;
            failures.push(`${p.name}: ${e?.name === 'TimeoutError' ? `超时（${timeout}ms）` : e?.message ?? '未知错误'}`);
            if (p.name === 'primary')
                primaryDownUntil = Date.now() + 60000;
        }
    }
    throw new DomainError(`所有向量服务均不可用（${failures.join('；')}）。字面搜索不受影响。`, 502);
}
