import { connectPostgres } from './repository.ts';
import { createProviders } from './providers.ts';
import { createDrillServer } from './http.ts';
const env = process.env;
if (!env.DATABASE_URL)
    throw new Error('请配置 DATABASE_URL，或使用 npm run demo 体验示例');
const { auth, assets, authMode } = createProviders(env);
const repo = await connectPostgres();
const app = createDrillServer({ repo, auth, assets, staticDir: 'apps/web/dist', origin: env.APP_ORIGIN, singleUser: authMode === 'password', owner: env.OWNER_ID ?? 'owner', password: env.AUTH_PASSWORD });
app.listen(Number(env.PORT ?? 8787), env.HOST ?? '127.0.0.1', () => console.log('Drill已启动'));
process.on('SIGTERM', () => app.close(() => repo.pool.end().then(() => process.exit(0))));
