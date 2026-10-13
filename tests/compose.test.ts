import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
let composeAvailable = false;
try { execFileSync('docker', ['compose', 'version'], { stdio: 'ignore' }); composeAvailable = true; } catch { /* Unit tests do not require Docker. */ }
function config(file: string, overrides: Record<string, string> = {}, semantic = false) {
    const out = execFileSync('docker', ['compose', '--env-file', '/dev/null', '-f', `infra/compose/${file}`, ...(semantic ? ['--profile', 'semantic'] : []), 'config', '--format', 'json'], {
        cwd: root, encoding: 'utf8',
        env: { PATH: process.env.PATH, HOME: process.env.HOME, POSTGRES_ADMIN_PASSWORD: 'test-admin-password', DRILL_DB_PASSWORD: 'test-app-password', ...overrides },
    });
    return JSON.parse(out);
}

test('外部存储 Compose 不创建/等待 MinIO，传入独立认证与存储配置', { skip: !composeAvailable }, () => {
    const c = config('compose.external.yml', {
        AUTH_MODE: 'cloudbase', STORAGE_DRIVER: 's3',
        CLOUDBASE_AUTH_INTROSPECT_URL: 'https://auth.example', CLOUDBASE_CLIENT_ID: 'test-client',
        S3_ENDPOINT: 'https://cos.ap-beijing.myqcloud.com', S3_PUBLIC_ENDPOINT: 'https://cos.ap-beijing.myqcloud.com',
        S3_BUCKET: 'drill-1250000000', S3_REGION: 'ap-beijing', S3_PATH_STYLE: 'false', S3_SESSION_TOKEN: 'test-token',
    });
    assert.deepEqual(Object.keys(c.services).sort(), ['postgres', 'server']);
    assert.deepEqual(Object.keys(c.services.server.depends_on), ['postgres']);
    assert.equal(c.services.server.environment.AUTH_MODE, 'cloudbase');
    assert.equal(c.services.server.environment.S3_ENDPOINT, 'https://cos.ap-beijing.myqcloud.com');
    assert.equal(c.services.server.environment.S3_PATH_STYLE, 'false');
    assert.equal(c.services.server.environment.S3_SESSION_TOKEN, 'test-token');
    assert.equal(c.services.server.environment.JWT_SECRET, '');
    assert.equal(c.services.server.ports[0].host_ip, '127.0.0.1');
    assert.equal(c.services.postgres.ports, undefined);
    assert.equal(c.services.server.build.context, root.replace(/\/$/, ''));
});

test('CloudBase 存储无需提供 S3 密钥；可选语义服务仍可启用', { skip: !composeAvailable }, () => {
    const c = config('compose.external.yml', { AUTH_MODE: 'password', STORAGE_DRIVER: 'cloudbase', CLOUDBASE_STORAGE_BASE: 'https://storage.example', CLOUDBASE_SERVICE_KEY: 'test-key', CLOUDBASE_BUCKET: 'files' }, true);
    assert.equal(c.services.server.environment.STORAGE_DRIVER, 'cloudbase');
    assert.equal(c.services.server.environment.CLOUDBASE_BUCKET, 'files');
    assert.ok(c.services.embedding);
    assert.equal(c.services.minio, undefined);
});

test('原 MinIO 命令保留数据卷名称、初始化依赖和内部地址，桶名可配置', { skip: !composeAvailable }, () => {
    const c = config('compose.yml', { S3_ACCESS_KEY: 'test-user', S3_SECRET_KEY: 'test-secret', S3_BUCKET: 'custom-bucket', S3_ENDPOINT: 'http://localhost:9000' });
    assert.ok(c.services.minio);
    assert.equal(c.services.server.depends_on.postgres.condition, 'service_healthy');
    assert.equal(c.services.server.depends_on['storage-init'].condition, 'service_completed_successfully');
    assert.equal(c.services.server.environment.S3_ENDPOINT, 'http://minio:9000');
    assert.equal(c.services.server.environment.S3_BUCKET, 'custom-bucket');
    assert.equal(c.services['storage-init'].environment.S3_BUCKET, 'custom-bucket');
    assert.equal(c.volumes['pg-data'].name, 'drill_pg-data');
    assert.equal(c.volumes.media.name, 'drill_media');
    assert.ok(c.services.postgres.volumes.some((v: any) => v.source === root + 'infra/sql'));
});
