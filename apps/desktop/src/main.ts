import { app, BrowserWindow, ipcMain, globalShortcut, safeStorage, shell, dialog } from 'electron';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { LocalStore } from './local.ts';
import { ingest } from './connectors.ts';
let win: BrowserWindow | null = null, store: LocalStore, token = '', syncing = false;
const root = () => app.getPath('userData'), secureFile = () => join(root(), 'credentials.bin');
const backend = () => store.meta('backend');
const allowed = /^\/(bootstrap|sync|search|objects|related|insight|ai|versions|conflicts|assets|settings|sources|proposals|map|walk|recognize|export)(\/|\?|$)/;
function validateURL(value: string) { const u = new URL(value); if (u.username || u.password || u.search || u.hash)
    throw new Error('后端地址不能包含口令或查询参数'); if (u.protocol !== 'https:' && !(u.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(u.hostname)))
    throw new Error('后端必须使用HTTPS，本机回环地址除外'); return u.origin; }
async function remote(path: string, method = 'GET', body?: any) { if (!allowed.test(path) || path.includes('..') || path.startsWith('//'))
    throw new Error('接口不在白名单'); if (!backend() || !token)
    throw new Error('请先在偏好中连接后端，本地捕获仍可使用'); const r = await fetch(backend() + path, { method, headers: { Authorization: 'Bearer ' + token, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(20000) }); const data: any = await r.json(); if (!r.ok)
    throw new Error(data.error ?? `服务错误 ${r.status}`); return data; }
async function saveToken(t: string) { if (!safeStorage.isEncryptionAvailable() || safeStorage.getSelectedStorageBackend?.() === 'basic_text')
    throw new Error('系统安全存储不可用；为避免明文落盘口令，暂不保存连接。请启用系统钥匙串。'); await writeFile(secureFile(), safeStorage.encryptString(t), { mode: 0o600 }); token = t; }
async function syncAssets() {
    for (const row of store.db.prepare('SELECT * FROM asset_queue WHERE remote_id IS NULL').all() as any[]) {
        const size = (await stat(row.path)).size;
        if (size !== row.size)
            throw new Error('本地媒体已改变，停止上传');
        const grant = await remote('/assets/sign', 'POST', { size: row.size, mime: row.mime, hash: row.hash });
        if (!grant.deduplicated) {
            const g = grant.upload_token, bytes = await readFile(row.path);
            let body: any = bytes;
            if (g.method === 'POST') {
                const f = new FormData();
                for (const [k, v] of Object.entries(g.fields ?? {}))
                    f.append(k, String(v));
                f.append('file', new Blob([bytes], { type: row.mime }));
                body = f;
            }
            const upload = await fetch(g.url, { method: g.method, headers: g.headers, body, signal: AbortSignal.timeout(300000) });
            if (!upload.ok)
                throw new Error('直传媒体失败，文件仍保留在本机');
            await remote('/assets/commit', 'POST', { asset_id: grant.asset_id, hash: row.hash, size: row.size });
        }
        store.transaction(() => { store.db.prepare('UPDATE asset_queue SET remote_id=? WHERE id=?').run(grant.asset_id, row.id); for (const pending of store.db.prepare('SELECT seq,json FROM outbox').all() as any[]) {
            const c = JSON.parse(pending.json);
            if (c.field === 'create' && c.value.asset_id === row.id) {
                c.value.asset_id = grant.asset_id;
                store.db.prepare('UPDATE outbox SET json=? WHERE seq=?').run(JSON.stringify(c), pending.seq);
            }
        } });
    }
}
async function synchronize() { if (syncing || !backend())
    return; syncing = true; try {
    await store.serial(async () => { await syncAssets(); await store.sync(remote); });
}
catch (e: any) {
    store.setMeta('sync_error', e.message);
}
finally {
    syncing = false;
} }
function handler(name: string, fn: (...args: any[]) => any) { ipcMain.handle('drill:' + name, async (event, ...args) => { if (!win || event.sender.id !== win.webContents.id || event.senderFrame !== win.webContents.mainFrame)
    throw new Error('不可信IPC来源'); return fn(...args); }); }
async function initialize() {
    await mkdir(root(), { recursive: true, mode: 0o700 });
    let kinds = [];
    try {
        kinds = JSON.parse(await readFile(app.isPackaged ? join(process.resourcesPath, 'kinds.json') : resolve(__dirname, '../../../infra/sql/kinds.json'), 'utf8'));
    }
    catch { }
    store = new LocalStore(join(root(), 'drill.sqlite'), kinds);
    try {
        if (safeStorage.isEncryptionAvailable())
            token = safeStorage.decryptString(await readFile(secureFile()));
    }
    catch { }
    handler('snapshot', () => store.snapshot());
    handler('status', () => store.status());
    handler('commit', (changes) => store.serial(async () => store.commit(changes)));
    handler('connect', async ({ url, password, token: provided }) => { const origin = validateURL(url); if (backend() && backend() !== origin)
        throw new Error('不允许混合后端；请使用独立本地数据目录'); let t = provided; if (!t) {
        const r = await fetch(origin + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }), signal: AbortSignal.timeout(10000) });
        const body: any = await r.json();
        if (!r.ok)
            throw new Error(body.error ?? '登录失败');
        t = body.token;
    } const r = await fetch(origin + '/bootstrap', { headers: { Authorization: 'Bearer ' + t }, signal: AbortSignal.timeout(20000) }); if (!r.ok)
        throw new Error('令牌无效或后端不可用'); const snap: any = await r.json(); if (!snap.user?.id)
        throw new Error('不是Drill后端'); if (store.meta('owner') && store.meta('owner') !== snap.user.id)
        throw new Error('此本地库属于另一用户，旧凭证未改变'); await saveToken(t); await store.serial(async () => { store.bind(origin, snap.user); await syncAssets(); await store.sync(remote); }); return { ok: true }; });
    handler('sync', synchronize);
    handler('captureAsset', async ({ mime, bytes }) => { if (!/^(image|audio|video)\//.test(mime) || !Array.isArray(bytes) || bytes.length > 256 * 1024 * 1024 || bytes.some((x: any) => !Number.isInteger(x) || x < 0 || x > 255))
        throw new Error('媒体参数无效'); const buffer = Buffer.from(bytes), hash = createHash('sha256').update(buffer).digest('hex'), id = randomUUID(), dir = join(root(), 'assets'); await mkdir(dir, { recursive: true, mode: 0o700 }); const path = join(dir, id); await writeFile(path, buffer, { mode: 0o600 }); store.db.prepare('INSERT INTO asset_queue(id,path,mime,hash,size) VALUES(?,?,?,?,?)').run(id, path, mime, hash, buffer.length); return id; });
    handler('addSource', ({ connector, path, name }) => store.serial(async () => { if (!['obsidian', 'chrome', 'codex'].includes(connector) || typeof path !== 'string' || !path)
        throw new Error('连接器配置无效'); const source = { id: randomUUID(), user_id: store.snapshot().user.id, type: 'connector' as const, connector, name: name || connector, properties: {}, config: { path }, anchor: null, state: {}, last_synced: null, enabled: true }; store.setSource(source); return source; }));
    handler('pullSource', (id: string) => store.serial(async () => { const s = store.snapshot().sources.find(s => s.id === id); if (!s)
        throw new Error('连接器不存在'); try {
        return await ingest(store, s, join(root(), 'connector-snapshots'));
    }
    catch (e: any) {
        store.setSource({ ...s, state: { ...s.state, error: e.message } });
        throw e;
    } }));
    handler('request', async (path: string, method = 'GET', body?: any) => {
        if (!allowed.test(path))
            throw new Error('接口不在白名单');
        const url = new URL(path, 'http://local');
        if (path === '/bootstrap')
            return store.snapshot();
        if (url.pathname === '/search' && url.searchParams.get('mode') !== 'semantic' && url.searchParams.get('mode') !== 'hybrid') {
            return { items: store.localSearch(url.searchParams.get('q') ?? ''), mode: 'lexical' };
        }
        if (path === '/sources/seen')
            return store.serial(async () => store.seenSources());
        if (path.startsWith('/versions/'))
            return { versions: (store.meta('snapshot').versions ?? []).filter((v: any) => v.object_id === decodeURIComponent(path.split('/')[2])) };
        if (path.startsWith('/assets/') && path.endsWith('/url')) {
            const id = decodeURIComponent(path.split('/')[2]), a = store.db.prepare('SELECT * FROM asset_queue WHERE id=? OR remote_id=?').get(id, id) as any;
            if (a) {
                const bytes = await readFile(a.path);
                return { url: `data:${a.mime};base64,${bytes.toString('base64')}` };
            }
        }
        if (path === '/export') {
            return { version: 1, exported_at: Date.now(), ...store.snapshot(), pending_changes: store.pending(), pending_requests: store.db.prepare('SELECT path,body FROM requests ORDER BY seq').all(), versions: store.meta('snapshot').versions ?? [], note: '媒体原文件在本机assets目录，此导出只有元数据。' };
        }
        if (path.startsWith('/related/') && !backend()) {
            const id = path.split('/')[2], o = store.snapshot().objects.find(o => o.id === id);
            return { items: o ? store.localSearch(o.title.slice(0, 3)).filter(x => x.id !== id).slice(0, 5).map(object => ({ object, score: 1 })) : [], mode: 'lexical' };
        }
        const result = await remote(path, method, body);
        if (method !== 'GET')
            await synchronize();
        return result;
    });
    win = new BrowserWindow({ width: 1440, height: 960, minWidth: 760, minHeight: 580, backgroundColor: '#f8f7f6', title: 'Drill', webPreferences: { preload: join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true } });
    win.webContents.setWindowOpenHandler(({ url }) => { try {
        if (['https:', 'http:'].includes(new URL(url).protocol))
            void shell.openExternal(url);
    }
    catch { } return { action: 'deny' }; });
    win.webContents.on('will-navigate', (event, url) => { if (url !== win?.webContents.getURL())
        event.preventDefault(); });
    const index = app.isPackaged ? join(process.resourcesPath, 'web', 'index.html') : resolve(__dirname, '../../web/dist/index.html');
    await win.loadFile(index);
    globalShortcut.register('CommandOrControl+Shift+Space', () => { win?.show(); win?.focus(); void win?.webContents.executeJavaScript('window.dispatchEvent(new CustomEvent("drill:capture"))'); });
    setInterval(() => void synchronize(), 15000);
    void synchronize();
    win.on('closed', () => { win = null; });
}
if (!app.requestSingleInstanceLock())
    app.quit();
else {
    app.whenReady().then(initialize).catch(e => { dialog.showErrorBox('Drill 无法启动', String(e)); app.quit(); });
    app.on('second-instance', () => { win?.show(); win?.focus(); });
    app.on('window-all-closed', () => app.quit());
    app.on('will-quit', () => { globalShortcut.unregisterAll(); store?.close(); });
}
