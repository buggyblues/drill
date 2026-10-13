import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { connectPostgres } from './repository.ts';
export async function migrate() { const store = await connectPostgres(); const c = await store.pool.connect(); try {
    await c.query('BEGIN');
    await c.query('SELECT pg_advisory_xact_lock(71400001)');
    for (const file of (await readdir(resolve('infra/sql'))).filter(f => f.endsWith('.sql')).sort())
        await c.query(await readFile(resolve('infra/sql', file), 'utf8'));
    await c.query('COMMIT');
}
catch (e) {
    await c.query('ROLLBACK');
    throw e;
}
finally {
    c.release();
    await store.pool.end();
} }
if (process.argv[1]?.endsWith('migrate.ts'))
    migrate().then(() => console.log('迁移完成')).catch(e => { console.error(e); process.exit(1); });
