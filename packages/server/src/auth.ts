import { createHmac, timingSafeEqual, scryptSync, randomBytes } from 'node:crypto';
import { DomainError } from './merge.ts';
export interface Auth {
    verify(token: string): Promise<string>;
}
export class JWTAuth implements Auth {
    secret: string;
    constructor(secret: string) { if (secret.length < 32)
        throw new Error('JWT_SECRET至少32个字符'); this.secret = secret; }
    issue(user: string, ttl = 86400) { const now = Math.floor(Date.now() / 1000); const encode = (v: any) => Buffer.from(JSON.stringify(v)).toString('base64url'); const payload = encode({ alg: 'HS256', typ: 'JWT' }) + '.' + encode({ sub: user, iss: 'drill', aud: 'drill-clients', iat: now, exp: now + ttl }); return payload + '.' + createHmac('sha256', this.secret).update(payload).digest('base64url'); }
    async verify(token: string) { try {
        const [h, p, s, ...rest] = token.split('.');
        if (rest.length || !h || !p || !s)
            throw 0;
        const header = JSON.parse(Buffer.from(h, 'base64url').toString());
        if (header.alg !== 'HS256')
            throw 0;
        const expected = createHmac('sha256', this.secret).update(h + '.' + p).digest();
        const provided = Buffer.from(s, 'base64url');
        if (expected.length !== provided.length || !timingSafeEqual(expected, provided))
            throw 0;
        const claim = JSON.parse(Buffer.from(p, 'base64url').toString());
        if (claim.iss !== 'drill' || claim.aud !== 'drill-clients' || !Number.isFinite(claim.exp) || claim.exp <= Date.now() / 1000 || typeof claim.sub !== 'string' || !claim.sub)
            throw 0;
        return claim.sub;
    }
    catch {
        throw new DomainError('登录已失效，请重新连接', 401);
    } }
}
export function checkPassword(input: string, expected: string) { const salt = 'drill-login-constant-time'; const a = scryptSync(input, salt, 32), b = scryptSync(expected, salt, 32); return timingSafeEqual(a, b); }
export class CloudBaseAuth implements Auth {
    url: string;
    clientId: string;
    constructor(url: string, clientId: string) { if (!url?.startsWith('https://') || !clientId)
        throw new Error('CloudBase认证需要HTTPS introspection地址和CLOUDBASE_CLIENT_ID'); this.url = url; this.clientId = clientId; }
    async verify(token: string) { const r = await fetch(this.url, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ client_id: this.clientId }), signal: AbortSignal.timeout(10000) }); if (!r.ok)
        throw new DomainError('CloudBase登录验证失败', 401); const raw: any = await r.json(); const data = raw.data ?? raw; if (data.active === false || typeof data.sub !== 'string' || !data.sub)
        throw new DomainError('CloudBase未返回有效用户身份', 401); return data.sub; }
}
