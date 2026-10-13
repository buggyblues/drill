/** No merge algorithm here. Retries keep the same mutation_id (idempotent on server). */
export async function syncOnce(local, remote) {
    const batch = await local.pending();
    if (batch.length) {
        const out = await remote.push(batch);
        await local.acknowledge(out.acknowledged);
    }
    const pending = await local.pending();
    const snapshot = await remote.pull(await local.cursor());
    await local.apply(snapshot, new Set(pending.map(c => c.object_id)));
}
export function changeFor(object, field, value) { return { mutation_id: crypto.randomUUID(), object_id: object.id, field, value, base_rev: object.rev, client_ts: Date.now() }; }
