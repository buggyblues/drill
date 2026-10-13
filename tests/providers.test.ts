import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createProviders, resolveProviderModes } from '../packages/server/src/providers.ts';
import { JWTAuth, CloudBaseAuth } from '../packages/server/src/auth.ts';
import { S3Assets, CloudBaseAssets } from '../packages/server/src/assets.ts';
import type { Asset } from '../packages/core/src/types.ts';

const password = { AUTH_PASSWORD: 'test-connection-password', JWT_SECRET: 'test-jwt-secret-at-least-32-characters' };
const cloudAuth = { CLOUDBASE_AUTH_INTROSPECT_URL: 'https://auth.example/introspect', CLOUDBASE_CLIENT_ID: 'test-client' };
const cloudStorage = { CLOUDBASE_STORAGE_BASE: 'https://storage.example', CLOUDBASE_SERVICE_KEY: 'test-key', CLOUDBASE_BUCKET: 'test-bucket' };
const asset = { id: 'asset-1', user_id: 'alice', storage_key: 'alice/asset-1', mime: 'image/png', size: 10, hash: 'a'.repeat(64), created_at: 1, committed: false } as Asset;

test('旧 BACKEND 仅为未设置的选项提供默认值，显式认证和存储互不覆盖', () => {
    assert.deepEqual(resolveProviderModes({}), { authMode: 'password', storageDriver: 's3' });
    assert.deepEqual(resolveProviderModes({ BACKEND: 'cloudbase' }), { authMode: 'cloudbase', storageDriver: 'cloudbase' });
    assert.deepEqual(resolveProviderModes({ BACKEND: 'cloudbase', AUTH_MODE: '', STORAGE_DRIVER: '' }), { authMode: 'cloudbase', storageDriver: 'cloudbase' });
    assert.deepEqual(resolveProviderModes({ BACKEND: 'cloudbase', STORAGE_DRIVER: 's3' }), { authMode: 'cloudbase', storageDriver: 's3' });
    assert.deepEqual(resolveProviderModes({ BACKEND: 'cloudbase', AUTH_MODE: 'password' }), { authMode: 'password', storageDriver: 'cloudbase' });
    assert.deepEqual(resolveProviderModes({ BACKEND: 'cloudbase', AUTH_MODE: 'password', STORAGE_DRIVER: 's3' }), { authMode: 'password', storageDriver: 's3' });
    assert.throws(() => resolveProviderModes({ STORAGE_DRIVER: 'cos' }), /STORAGE_DRIVER/);
    assert.throws(() => resolveProviderModes({ AUTH_MODE: 'typo' }), /AUTH_MODE/);
});

test('四种认证/存储组合只要求当前选中适配器的配置', async () => {
    for (const authMode of ['password', 'cloudbase']) {
        for (const storageDriver of ['s3', 'cloudbase']) {
            const p = createProviders({ AUTH_MODE: authMode, STORAGE_DRIVER: storageDriver,
                ...(authMode === 'password' ? password : cloudAuth),
                ...(storageDriver === 'cloudbase' ? cloudStorage : {}),
            });
            assert.ok(p.auth instanceof (authMode === 'password' ? JWTAuth : CloudBaseAuth));
            assert.ok(p.assets instanceof (storageDriver === 's3' ? S3Assets : CloudBaseAssets));
            if (p.auth instanceof JWTAuth) assert.equal(await p.auth.verify(p.auth.issue('alice')), 'alice');
        }
    }
    assert.throws(() => createProviders({ ...password, STORAGE_DRIVER: 'cloudbase' }), /CLOUDBASE_STORAGE_BASE/);
    assert.throws(() => createProviders({ ...cloudStorage, AUTH_MODE: 'cloudbase' }), /CLOUDBASE_AUTH_INTROSPECT_URL/);
    assert.throws(() => createProviders({ ...password, S3_ACCESS_KEY: 'test-key' }), /S3_SECRET_KEY/);
    assert.throws(() => createProviders({ ...password, S3_ENDPOINT: 'file:///tmp/storage' }), /S3_ENDPOINT/);
});

test('两个 S3 实例使用各自的端点、区域、桶与凭证，修改源配置不会改变签名', async () => {
    const minioEnv = { ...password, S3_BUCKET: 'local-bucket', S3_ENDPOINT: 'http://minio:9000', S3_PUBLIC_ENDPOINT: 'https://media.example', S3_ACCESS_KEY: 'minio-key', S3_SECRET_KEY: 'test-minio-secret' };
    const minio = createProviders(minioEnv).assets;
    minioEnv.S3_PUBLIC_ENDPOINT = 'https://changed.example';
    const cos = createProviders({ ...password, S3_BUCKET: 'drill-1250000000', S3_ENDPOINT: 'https://cos.ap-beijing.myqcloud.com', S3_PATH_STYLE: 'false', S3_REGION: 'ap-beijing', S3_ACCESS_KEY: 'cos-key', S3_SECRET_KEY: 'test-cos-secret', S3_SESSION_TOKEN: 'test-session-token' }).assets;
    const [localGrant, cloudGrant] = await Promise.all([minio.sign(asset), cos.sign(asset)]);
    const localURL = new URL(localGrant.url), cloudURL = new URL(cloudGrant.url);
    assert.equal(localURL.origin, 'https://media.example');
    assert.equal(localURL.pathname, '/local-bucket/alice/asset-1');
    assert.match(localURL.searchParams.get('X-Amz-Credential')!, /^minio-key\//);
    assert.equal(cloudURL.hostname, 'drill-1250000000.cos.ap-beijing.myqcloud.com');
    assert.equal(cloudURL.pathname, '/alice/asset-1');
    assert.match(cloudURL.searchParams.get('X-Amz-Credential')!, /^cos-key\/.*\/ap-beijing\/s3\/aws4_request$/);
    assert.equal(cloudURL.searchParams.get('X-Amz-Security-Token'), 'test-session-token');
    assert.equal(cloudURL.searchParams.get('X-Amz-Expires'), '300');
    assert.equal(localGrant.headers?.['x-amz-meta-sha256'], asset.hash);
    const readURL = new URL(await cos.url(asset));
    assert.equal(readURL.hostname, cloudURL.hostname);
    assert.equal(readURL.pathname, cloudURL.pathname);
});

test('客户端签名使用公开端点，服务端 HEAD 校验仍走内部端点并拒绝不匹配文件', async t => {
    let size = 10;
    const requests: string[] = [];
    const storage = createServer((req, res) => {
        requests.push(`${req.method} ${req.url}`);
        assert.match(req.headers.authorization ?? '', /Credential=test-key\//);
        res.writeHead(200, { 'Content-Length': size, 'x-amz-meta-sha256': asset.hash });
        res.end();
    });
    await new Promise<void>(r => storage.listen(0, '127.0.0.1', r));
    t.after(async () => { storage.closeAllConnections(); await new Promise<void>(r => storage.close(() => r())); });
    const port = (storage.address() as { port: number }).port;
    const provider = createProviders({ ...password, S3_ENDPOINT: `http://127.0.0.1:${port}`, S3_PUBLIC_ENDPOINT: 'https://uploads.example', S3_ACCESS_KEY: 'test-key', S3_SECRET_KEY: 'test-secret' }).assets;
    assert.equal(new URL((await provider.sign(asset)).url).hostname, 'uploads.example');
    await provider.verify(asset);
    size = 11;
    await assert.rejects(provider.verify(asset), /对象大小或上传声明不匹配/);
    assert.equal(requests.length, 2);
    assert.ok(requests.every(r => r.startsWith('HEAD /drill/alice/asset-1')));
});
