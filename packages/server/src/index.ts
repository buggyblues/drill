import { connectPostgres } from './repository.ts';
import { createProviders } from './providers.ts';
import { createDrillServer } from './http.ts';
import { AgentService } from './agent/service.ts';
const env = process.env;
if (!env.DATABASE_URL)
    throw new Error('请配置 DATABASE_URL，或使用 npm run demo 体验示例');
const { auth, assets, authMode } = createProviders(env);
const repo = await connectPostgres();
const agent = new AgentService(repo);
const app = createDrillServer({ agent, repo, auth, assets, staticDir: 'apps/web/dist', origin: env.APP_ORIGIN, singleUser: authMode === 'password', owner: env.OWNER_ID ?? 'owner', password: env.AUTH_PASSWORD });
app.listen(Number(env.PORT ?? 8787), env.HOST ?? '127.0.0.1', () => console.log('Drill已启动'));
let stopping = false;
async function shutdown() {
    if (stopping) return;
    stopping = true;
    // Abort model/runtime work before closing the database needed to persist cancellation.
    const drained = agent.close();
    await new Promise<void>((resolve) => app.close(() => resolve()));
    await drained;
    await repo.pool.end();
}
for (const signal of ['SIGTERM', 'SIGINT'] as const)
    process.on(signal, () => { void shutdown().then(() => process.exit(0)).catch(() => process.exit(1)); });
