export function uid() { return globalThis.crypto.randomUUID(); }
/** Lexically sortable fractional keys over base 62. A terminal 0 is reserved. */
const DIGITS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
export function compareKeys(a, b) { return a < b ? -1 : a > b ? 1 : 0; }
export function keyBetween(a, b) {
    if (a !== null && b !== null && a >= b)
        throw new Error('索引顺序无效');
    for (const v of [a, b])
        if (v !== null && (!/^[0-9A-Za-z]+$/.test(v) || v.endsWith('0')))
            throw new Error('索引格式无效');
    function mid(left, right) {
        let prefix = '';
        let i = 0;
        for (;; i++) {
            const lo = i < left.length ? DIGITS.indexOf(left[i]) : 0;
            const hi = right === null ? 62 : (i < right.length ? DIGITS.indexOf(right[i]) : 0);
            if (lo === hi) {
                prefix += DIGITS[lo];
                continue;
            }
            if (hi - lo > 1)
                return prefix + DIGITS[Math.floor((lo + hi) / 2)];
            return prefix + DIGITS[lo] + mid(left.slice(i + 1), null);
        }
    }
    return mid(a ?? '', b);
}
export const sortedBlocks = (blocks) => [...blocks].filter(b => !b.deleted_at).sort((a, b) => compareKeys(a.key, b.key) || a.id.localeCompare(b.id));
export const bodyText = (blocks) => sortedBlocks(blocks).map(b => b.text).join('\n\n');
export function makeObject(title, user_id, data = {}) {
    const now = Date.now();
    return { id: uid(), user_id, kind: null, form: /^https?:\/\/\S+$/.test(title.trim()) ? 'link' : 'text', title, body: '', body_blocks: { blocks: [] }, series: null, tags_cached: [], status: null, due_at: null, sort_key: null, supersedes_id: null, applies_to: [], ephemeral: false, asset_id: null, source_id: null, source_ref: null, source_version: null, extra: {}, captured_at: now, confirmed_at: null, valid_until: null, rev: 0, created_at: 0, updated_at: now, deleted_at: null, ...data };
}
export function emptyWorkspace(user_id, kinds) { return { user: { id: user_id, timezone: 'Asia/Shanghai', created_at: Date.now(), settings: {} }, objects: [], kinds, relations: [], placements: [], tags: [], assets: [], sources: [], proposals: [], versions: [], conflicts: [], changes: [], clocks: {}, mutations: [], devices: {}, nextSeq: 0 }; }
export function explicitMarkup(text) {
    const clean = text.replace(/```[\s\S]*?```/g, '').replace(/`[^`]*`/g, '');
    return { links: [...clean.matchAll(/(?<!!)\[\[([^\]\n]+)\]\]/g)].map(m => m[1].split('|')[0].trim()), tags: [...clean.matchAll(/(?:^|\s)#([^\s#\[\]]+)/g)].map(m => m[1]) };
}
export function captureText(text, kinds, userId) {
    const m = text.match(/^\/([^/]+)\/(.+)\/$/s);
    const k = m && kinds.find(k => k.id === m[1] || k.label === m[1]);
    return makeObject(k ? m[2] : text, userId, k ? { kind: k.id, form: k.id === 'canvas' ? 'canvas' : 'text' } : {});
}
export function inWindow(timestamp, window, timezone, now = Date.now(), custom) {
    if (window === 'all')
        return true;
    const p = (t) => new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(t);
    const date = p(timestamp), today = p(now);
    if (window === 'today')
        return date === today;
    if (window === 'month')
        return date.slice(0, 7) === today.slice(0, 7);
    if (window === 'custom')
        return !!custom && date >= custom.from && date <= custom.to;
    const [y, m, d] = today.split('-').map(Number);
    const midnight = new Date(Date.UTC(y, m - 1, d));
    const days = (midnight.getUTCDay() + 6) % 7;
    return date >= new Date(midnight.getTime() - days * 86400000).toISOString().slice(0, 10) && date <= today;
}
export function inferForm(mime) { return mime.startsWith('image/') ? 'image' : mime.startsWith('audio/') ? 'audio' : mime.startsWith('video/') ? 'video' : null; }
