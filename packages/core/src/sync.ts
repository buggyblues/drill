import type { Change, KnowledgeObject, PublicSnapshot } from './types.ts';
export interface LocalReplica {
    pending(): Promise<Change[]>;
    acknowledge(ids: string[]): Promise<void>;
    cursor(): Promise<number>;
    /** Apply server-authoritative snapshots. Objects with pending edits are held, not merged. */
    apply(snapshot: PublicSnapshot, protectedIds: Set<string>): Promise<void>;
}
export interface SyncTransport {
    push(changes: Change[]): Promise<{
        acknowledged: string[];
    }>;
    pull(since: number): Promise<PublicSnapshot>;
}
/** No merge algorithm here. Retries keep the same mutation_id (idempotent on server). */
export async function syncOnce(local: LocalReplica, remote: SyncTransport): Promise<void> {
    const batch = await local.pending();
    if (batch.length) {
        const out = await remote.push(batch);
        await local.acknowledge(out.acknowledged);
    }
    const pending = await local.pending();
    const snapshot = await remote.pull(await local.cursor());
    await local.apply(snapshot, new Set(pending.map(c => c.object_id)));
}
export function changeFor(object: KnowledgeObject, field: string, value: any): Change { return { mutation_id: crypto.randomUUID(), object_id: object.id, field, value, base_rev: object.rev, client_ts: Date.now() }; }
