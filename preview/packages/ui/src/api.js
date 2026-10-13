export const isDesktop = () => !!window.drill;
let desktopBridge = () => window.drill;
export async function request(path, method = 'GET', body) {
    if (isDesktop())
        return desktopBridge().request(path, method, body);
    const response = await fetch(path, { method, credentials: 'same-origin', headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
    let json;
    try {
        json = await response.json();
    }
    catch {
        throw new Error('服务返回了无法读取的内容');
    }
    if (!response.ok) {
        const e = new Error(json.error ?? '请求失败');
        e.status = response.status;
        throw e;
    }
    return json;
}
export async function loadSnapshot() { return isDesktop() ? desktopBridge().snapshot() : request('/bootstrap'); }
export async function commit(changes) { return isDesktop() ? desktopBridge().commit(changes) : request('/sync/push', 'POST', { device_id: 'web-' + deviceId(), changes }); }
let temporaryId; // Memory only; the Web client has no persistent object store.
export function deviceId() { return temporaryId ?? (temporaryId = crypto.randomUUID()); }
export async function uploadFile(file) {
    if (isDesktop()) {
        const bytes = Array.from(new Uint8Array(await file.arrayBuffer()));
        return desktopBridge().captureAsset({ name: file.name, mime: file.type, bytes });
    }
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await file.arrayBuffer()))).map(x => x.toString(16).padStart(2, '0')).join('');
    const signed = await request('/assets/sign', 'POST', { size: file.size, mime: file.type, hash });
    if (!signed.deduplicated) {
        const g = signed.upload_token;
        let body = file;
        if (g.method === 'POST') {
            const form = new FormData();
            for (const [k, v] of Object.entries(g.fields ?? {}))
                form.append(k, String(v));
            form.append('file', file);
            body = form;
        }
        const r = await fetch(g.url, { method: g.method, headers: g.headers, body });
        if (!r.ok)
            throw new Error('媒体未上传成功；未创建空白对象');
        await request('/assets/commit', 'POST', { asset_id: signed.asset_id, hash, size: file.size });
    }
    return signed.asset_id;
}
