-- 存量库升级到当前形状。全新安装跑完 000–001 之后，这里几乎全是空操作。
--
-- **这个文件必须排在 003_kinds.sql 之前。** 种子数据写的是当前形状的列，
-- 存量库要先在这里被改成当前形状，否则种子会往还不存在的列里插。
-- 一句话：形状在数据前面。
--
-- 做这几件事：
--   1. 删掉旧的租户策略（它们引用了 user_id 列，会阻塞下一步的 ALTER）
--   2. user_id / users.id 统一为 varchar(64)，与 CloudBase auth.users.id 同型
--   3. 去掉 objects.user_id → users(id) 的外键，让业务数据与认证源解耦
--   4. kinds.parent_allowed → kinds.relations（关系声明）
--   5. relations 增加 type（cite / belongs），并把 type 并入主键
--   6. 存量 objects.parent_id 搬成 belongs 边
--   7. 删掉 objects.parent_id 列
--   8. 重建 relations 索引，跟上按 type 过滤的访问路径
--
-- 策略由后面的 005_rls.sql 重建。顺序不能颠倒：
-- PostgreSQL 不允许修改被策略引用的列的类型。
--
-- 第 5 步必须早于第 6 步：同一对对象之间可能已经有一条手工引用，
-- 归属边只有在「type 参与主键」之后才是另一条边，否则会被吞掉。

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
--    注意只能按 confrelid 精确匹配。objects 上还有自引用外键
--    （user_id,supersedes_id → objects），它的键里也含 user_id，
--    按列名匹配会把它一起误删。
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

-- 4. kinds.parent_allowed → kinds.relations。
--    text[] 只能表达「允许哪些父类型」；关系声明还要说明关系类型、目标 kind、能否有多个。
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'kinds' AND column_name = 'parent_allowed') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'kinds' AND column_name = 'relations') THEN
      ALTER TABLE kinds ADD COLUMN relations jsonb NOT NULL DEFAULT '{}';
    END IF;
    -- 项目对领域是多对多；其余沿用「归属唯一」。
    UPDATE kinds
       SET relations = jsonb_build_object('belongs', jsonb_build_object(
             'targets', to_jsonb(parent_allowed),
             'multiple', id = 'project'))
     WHERE relations = '{}'::jsonb;
    ALTER TABLE kinds DROP COLUMN parent_allowed;
    RAISE NOTICE 'kinds.parent_allowed 已转为 kinds.relations 并删除';
  END IF;
END $$;

-- 5. relations 增加 type，并把 type 并入主键。
DO $$
DECLARE
  pk_has_type boolean;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'relations' AND column_name = 'type') THEN
    ALTER TABLE relations ADD COLUMN type text NOT NULL DEFAULT 'cite';
    RAISE NOTICE 'relations.type 已新增，存量边一律是 cite（引用）';
  END IF;

  SELECT COALESCE(bool_or(a.attname = 'type'), false) INTO pk_has_type
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
   WHERE c.conrelid = 'relations'::regclass AND c.contype = 'p';

  IF NOT pk_has_type THEN
    ALTER TABLE relations DROP CONSTRAINT relations_pkey;
    ALTER TABLE relations ADD PRIMARY KEY (user_id, from_id, type, to_id, source_field, source_block_id);
    RAISE NOTICE 'relations 主键已并入 type';
  END IF;
END $$;

-- 6. 存量 objects.parent_id 搬成 belongs 边：from = 子对象，to = 父对象。
--    整段包在「列还在吗」里面，所以反复执行是安全的。
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'objects' AND column_name = 'parent_id') THEN
    EXECUTE $move$
      INSERT INTO relations(user_id, from_id, type, to_id, source_field, source_block_id, created_at, deleted_at)
      SELECT user_id, id, 'belongs', parent_id, 'manual', '', COALESCE(created_at, 0), deleted_at
        FROM objects
       WHERE parent_id IS NOT NULL
      ON CONFLICT DO NOTHING
    $move$;
    RAISE NOTICE 'objects.parent_id 已搬成 belongs 边';
  END IF;
END $$;

-- 7. 删掉 objects.parent_id。指向它的外键随列一起消失。
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'objects' AND column_name = 'parent_id') THEN
    ALTER TABLE objects DROP COLUMN parent_id;
    RAISE NOTICE 'objects.parent_id 已删除：归属现在是 relations 里的一条边';
  END IF;
END $$;
DROP INDEX IF EXISTS objects_parent;

-- 8. 索引跟上新的访问路径。旧索引不含 type，而 CREATE INDEX IF NOT EXISTS
--    看到同名索引存在会直接跳过，所以这里显式重建。
DROP INDEX IF EXISTS relations_from;
DROP INDEX IF EXISTS relations_to;
CREATE INDEX IF NOT EXISTS relations_from ON relations(user_id, type, from_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS relations_to ON relations(user_id, type, to_id) WHERE deleted_at IS NULL;
