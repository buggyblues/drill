-- 已有安装的幂等升级。全新安装跑完 000–003 之后，这里是空操作。
--
-- 做三件事：
--   1. 删掉旧的租户策略（它们引用了 user_id 列，会阻塞下一步的 ALTER）
--   2. user_id / users.id 统一为 varchar(64)，与 CloudBase auth.users.id 同型
--   3. 去掉 objects.user_id → users(id) 的外键，让业务数据与认证源解耦
--
-- 策略由后面的 005_rls.sql 重建。顺序不能颠倒：
-- PostgreSQL 不允许修改被策略引用的列的类型。

-- 1. 先删策略。这一步必须在改类型之前。
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
    EXECUTE format('DROP POLICY IF EXISTS tenant_scope ON %I', t);
  END LOOP;
  DROP POLICY IF EXISTS self_only ON users;
END $$;

-- 2. 统一 ID 类型。先探当前类型，所以可以反复执行。
DO $$
DECLARE
  t text;
  tenant_tables text[] := ARRAY[
    'objects','object_tags','object_aliases','relations','placements','assets',
    'object_assets','versions','conflicts','distill_sessions','proposals',
    'changes','devices','sources','embeddings','field_clocks','applied_mutations'
  ];
  needs boolean;
BEGIN
  FOREACH t IN ARRAY tenant_tables LOOP
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = t AND column_name = 'user_id'
        AND data_type <> 'character varying'
    ) INTO needs;
    IF needs THEN
      EXECUTE format('ALTER TABLE %I ALTER COLUMN user_id TYPE varchar(64)', t);
      RAISE NOTICE 'user_id 已改为 varchar(64)：%', t;
    END IF;
  END LOOP;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'id'
      AND data_type <> 'character varying'
  ) INTO needs;
  IF needs THEN
    ALTER TABLE users ALTER COLUMN id TYPE varchar(64);
    RAISE NOTICE 'users.id 已改为 varchar(64)';
  END IF;
END $$;

-- 3. 去掉 objects 上**指向 users** 的外键。
--
--    注意只能按 confrelid 精确匹配。objects 上还有两个自引用外键
--    （user_id,parent_id → objects 和 user_id,supersedes_id → objects），
--    它们的键里也含 user_id，按列名匹配会把它们一起误删。
DO $$
DECLARE
  c text;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'objects'::regclass
      AND contype = 'f'
      AND confrelid = 'users'::regclass
  LOOP
    EXECUTE format('ALTER TABLE objects DROP CONSTRAINT %I', c);
    RAISE NOTICE '已去掉外键 objects.%（业务数据不再依赖 users 表的存在）', c;
  END LOOP;
END $$;
