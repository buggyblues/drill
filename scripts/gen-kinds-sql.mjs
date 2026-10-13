// 从 infra/sql/kinds.json 生成 003_kinds.sql。
//
// kinds.json 是类型定义的唯一真相：测试、demo 脚本和桌面端都直接读它。
// 003_kinds.sql 只是同一份数据的 SQL 投影，供 migrate 使用。
// 两份手写必然漂移，所以这里单向生成——改 kinds.json，然后 `npm run kinds`。
//
// 注意 SQL 字符串字面量用单引号，JSON 里的双引号必须原样保留，
// 不能用 JSON.stringify 直接拼（那会生成标识符而不是字面量）。
import { readFileSync, writeFileSync } from 'node:fs';

const path = new URL('../infra/sql/kinds.json', import.meta.url);
const kinds = JSON.parse(readFileSync(path, 'utf8'));

const lit = v => "'" + String(v).replaceAll("'", "''") + "'";

const rows = kinds.map(k => {
    if (!k.id || !k.label) throw new Error('每个 kind 必须有 id 和 label');
    if (typeof k.sort !== 'number') throw new Error(`${k.id}: sort 必须是数字`);
    return `INSERT INTO kinds(id,label,icon,color,properties,relations,sort) VALUES (${[
        lit(k.id), lit(k.label), lit(k.icon ?? ''), lit(k.color ?? ''),
        lit(JSON.stringify(k.properties ?? {})), lit(JSON.stringify(k.relations ?? {})), k.sort,
    ].join(',')}) ON CONFLICT(id) DO NOTHING;`;
});

const header = [
    '-- 由 scripts/gen-kinds-sql.mjs 从 kinds.json 生成，不要手改。',
    '-- relations 说明每种 kind 允许建立的关系：belongs = 归属（from 归属于 to）。',
    '-- 项目对领域是多对多（multiple: true），其余归属唯一；targets 为空数组即不允许归属。',
].join('\n');

writeFileSync(new URL('../infra/sql/003_kinds.sql', import.meta.url), header + '\n' + rows.join('\n') + '\n');
console.log(`003_kinds.sql 已从 kinds.json 重新生成（${rows.length} 条）`);
