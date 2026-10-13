-- 行级权限。两套后端都启用，是租户隔离的最后一道防线
-- （服务端的数据访问层也逐条绑 user_id，两道锁都要过）。
--
-- 失败方向是「看不见」而不是「看得见」：claims 未注入时 auth.uid() 返回 NULL，
-- user_id = NULL 求值为 NULL，任何行都不匹配。

DO $$
DECLARE
  t text;
  tenant_tables text[] := ARRAY[
    'objects','object_tags','object_aliases','relations','placements','assets',
    'object_assets','versions','conflicts','distill_sessions','proposals',
    'changes','devices','sources','embeddings','field_clocks','applied_mutations'
  ];
BEGIN
  FOREACH t IN ARRAY tenant_tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    -- 先删后建，保证重复执行时策略定义是最新的。
    EXECUTE format('DROP POLICY IF EXISTS tenant_scope ON %I', t);
    EXECUTE format(
      'CREATE POLICY tenant_scope ON %I USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())', t);
  END LOOP;

  -- users 是档案表，归属列叫 id 而不是 user_id，所以单独处理。
  -- 服务端在事务开头就注入 claims，随后的 upsert 能通过 WITH CHECK。
  ALTER TABLE users ENABLE ROW LEVEL SECURITY;
  ALTER TABLE users FORCE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS self_only ON users;
  CREATE POLICY self_only ON users USING (id = auth.uid()) WITH CHECK (id = auth.uid());
END $$;

-- kinds 是共用定义，schema_migrations 是运维表，两者都不做租户隔离。
