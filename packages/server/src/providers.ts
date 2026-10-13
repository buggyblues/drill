import { JWTAuth, CloudBaseAuth, type Auth } from './auth.ts';
import { S3Assets, CloudBaseAssets, type Assets } from './assets.ts';

type Env = Record<string, string | undefined>;
export type ProviderModes = {
    authMode: 'password' | 'cloudbase';
    storageDriver: 's3' | 'cloudbase';
};

/** BACKEND is a legacy default only. Explicit selectors always win independently. */
export function resolveProviderModes(env: Env): ProviderModes {
    const cloud = env.BACKEND === 'cloudbase';
    const authMode = env.AUTH_MODE?.trim() || (cloud ? 'cloudbase' : 'password');
    const storageDriver = env.STORAGE_DRIVER?.trim() || (cloud ? 'cloudbase' : 's3');
    if (authMode !== 'password' && authMode !== 'cloudbase')
        throw new Error('未知 AUTH_MODE。可选：password | cloudbase');
    if (storageDriver !== 's3' && storageDriver !== 'cloudbase')
        throw new Error('未知 STORAGE_DRIVER。可选：s3 | cloudbase');
    return { authMode, storageDriver };
}

function required(env: Env, key: string): string {
    const value = env[key];
    if (!value?.trim()) throw new Error(`请配置 ${key}`);
    return value;
}

/** Capture configuration before opening database connections. */
export function createProviders(env: Env = process.env): ProviderModes & { auth: Auth; assets: Assets } {
    const modes = resolveProviderModes(env);
    let auth: Auth;
    if (modes.authMode === 'cloudbase') {
        auth = new CloudBaseAuth(required(env, 'CLOUDBASE_AUTH_INTROSPECT_URL'), required(env, 'CLOUDBASE_CLIENT_ID'));
    } else {
        if (!env.AUTH_PASSWORD || env.AUTH_PASSWORD.length < 12)
            throw new Error('AUTH_MODE=password 需要至少 12 字符的 AUTH_PASSWORD');
        auth = new JWTAuth(required(env, 'JWT_SECRET'));
    }
    const assets: Assets = modes.storageDriver === 'cloudbase'
        ? new CloudBaseAssets(required(env, 'CLOUDBASE_STORAGE_BASE'), required(env, 'CLOUDBASE_SERVICE_KEY'), required(env, 'CLOUDBASE_BUCKET'))
        : new S3Assets(env.S3_BUCKET || 'drill', {
            region: env.S3_REGION || 'us-east-1',
            endpoint: env.S3_ENDPOINT || undefined,
            publicEndpoint: env.S3_PUBLIC_ENDPOINT || undefined,
            pathStyle: env.S3_PATH_STYLE !== 'false',
            accessKey: env.S3_ACCESS_KEY || undefined,
            secretKey: env.S3_SECRET_KEY || undefined,
            sessionToken: env.S3_SESSION_TOKEN || undefined,
        });
    return { ...modes, auth, assets };
}
