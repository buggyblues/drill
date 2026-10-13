import type { Asset } from '../../core/src/types.ts';
import { DomainError } from './merge.ts';
export type UploadGrant = {
    method: 'PUT' | 'POST';
    url: string;
    headers?: Record<string, string>;
    fields?: Record<string, string>;
};
export interface Assets {
    sign(asset: Asset): Promise<UploadGrant>;
    verify(asset: Asset): Promise<void>;
    url(asset: Asset): Promise<string>;
}
export type S3AssetOptions = {
    region?: string;
    endpoint?: string;
    publicEndpoint?: string;
    pathStyle?: boolean;
    accessKey?: string;
    secretKey?: string;
    sessionToken?: string;
};
export class S3Assets implements Assets {
    private client: any;
    private signingClient: any;
    private sdk: any;
    private presign: any;
    private bucket: string;
    private options: S3AssetOptions;
    constructor(bucket: string, options: S3AssetOptions = {
        region: process.env.S3_REGION || 'us-east-1',
        endpoint: process.env.S3_ENDPOINT || undefined,
        publicEndpoint: process.env.S3_PUBLIC_ENDPOINT || undefined,
        pathStyle: process.env.S3_PATH_STYLE !== 'false',
        accessKey: process.env.S3_ACCESS_KEY || undefined,
        secretKey: process.env.S3_SECRET_KEY || undefined,
        sessionToken: process.env.S3_SESSION_TOKEN || undefined,
    }) {
        if (!bucket.trim()) throw new Error('请配置 S3_BUCKET');
        if (!!options.accessKey !== !!options.secretKey)
            throw new Error('S3_ACCESS_KEY 与 S3_SECRET_KEY 必须同时配置');
        for (const [key, value] of [['S3_ENDPOINT', options.endpoint], ['S3_PUBLIC_ENDPOINT', options.publicEndpoint]]) {
            if (!value) continue;
            let url: URL;
            try { url = new URL(value); } catch { throw new Error(`${key} 必须是 HTTP(S) 地址`); }
            if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash)
                throw new Error(`${key} 必须是无凭证、查询参数或片段的 HTTP(S) 地址`);
        }
        this.bucket = bucket;
        this.options = { ...options };
    }
    private async init() { if (this.client)
        return;
        const sdk = await import('@aws-sdk/client-s3');
        const presign = (await import('@aws-sdk/s3-request-presigner')).getSignedUrl;
        const o = this.options;
        const config = {
            region: o.region || 'us-east-1', forcePathStyle: o.pathStyle ?? true,
            credentials: o.accessKey ? { accessKeyId: o.accessKey, secretAccessKey: o.secretKey!, sessionToken: o.sessionToken } : undefined,
        };
        this.sdk = sdk;
        this.presign = presign;
        this.signingClient = new sdk.S3Client({ ...config, endpoint: o.publicEndpoint || o.endpoint });
        this.client = new sdk.S3Client({ ...config, endpoint: o.endpoint });
    }
    async sign(a: Asset) { await this.init(); const headers = { 'Content-Type': a.mime, 'x-amz-meta-sha256': a.hash }; const url = await this.presign(this.signingClient, new this.sdk.PutObjectCommand({ Bucket: this.bucket, Key: a.storage_key, ContentType: a.mime, Metadata: { sha256: a.hash } }), { expiresIn: 300 }); return { method: 'PUT' as const, url, headers }; }
    async verify(a: Asset) { await this.init(); const head = await this.client.send(new this.sdk.HeadObjectCommand({ Bucket: this.bucket, Key: a.storage_key })); if (Number(head.ContentLength) !== a.size || head.Metadata?.sha256 !== a.hash)
        throw new DomainError('对象大小或上传声明不匹配'); }
    async url(a: Asset) { await this.init(); return this.presign(this.signingClient, new this.sdk.GetObjectCommand({ Bucket: this.bucket, Key: a.storage_key, ResponseContentDisposition: 'inline' }), { expiresIn: 300 }); }
}
/** CloudBase PG Storage adapter. Validate response contract in your target environment before deployment. */
export class CloudBaseAssets implements Assets {
    base: string;
    key: string;
    bucket: string;
    constructor(base: string, key: string, bucket: string) { if (!base?.startsWith('https://'))
        throw new Error('CloudBase存储必须使用HTTPS'); this.base = base.replace(/\/$/, ''); this.key = key; this.bucket = bucket; }
    private path(a: Asset) { return encodeURIComponent(this.bucket) + '/' + a.storage_key.split('/').map(encodeURIComponent).join('/'); }
    private async request(path: string) { const r = await fetch(this.base + path, { method: 'POST', headers: { Authorization: 'Bearer ' + this.key, 'Content-Type': 'application/json' }, body: JSON.stringify({ expiresIn: 300 }), signal: AbortSignal.timeout(10000) }); if (!r.ok)
        throw new DomainError('云存储签名请求失败', 502); const raw: any = await r.json(), d = raw.data ?? raw; const value = d.signedURL ?? d.signedUrl ?? d.url; if (typeof value !== 'string')
        throw new DomainError('云存储签名返回格式不匹配，请核对环境API版本', 502); return new URL(value, this.base).href; }
    async sign(a: Asset) { return { method: 'PUT' as const, url: await this.request('/v1/storages/object/upload/sign/' + this.path(a)), headers: { 'Content-Type': a.mime } }; }
    async url(a: Asset) { return this.request('/v1/storages/object/sign/' + this.path(a)); }
    async verify(a: Asset) { const r = await fetch(await this.url(a), { method: 'HEAD', signal: AbortSignal.timeout(10000) }); if (!r.ok || Number(r.headers.get('content-length')) !== a.size)
        throw new DomainError('云存储对象尚未上传完成'); }
}
export class DisabledAssets implements Assets {
    async sign(_a: Asset): Promise<UploadGrant> { throw new DomainError('尚未配置对象存储。文字捕获可用，媒体需要直传存储。', 503); }
    async verify(_a: Asset) { throw new DomainError('未配置对象存储', 503); }
    async url(_a: Asset): Promise<string> { throw new DomainError('未配置对象存储', 503); }
}
