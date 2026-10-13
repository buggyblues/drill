-- 登录态与 CloudBase PG 模式对齐。
--
-- 差异只有「谁把 claims 写进来」：
--   自托管   服务端 set_config('request.jwt.claims', '{"sub":"..."}', true)
--   CloudBase 网关从 JWT 解析后自动注入
--
-- 变量名和函数定义与 CloudBase 文档完全一致，所以 RLS 策略、
-- 以及任何调用 auth.uid() 的 SQL，都可以在两边原样使用、原样迁移。

CREATE SCHEMA IF NOT EXISTS auth;

CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb
    LANGUAGE sql STABLE
    AS $$
  select
    nullif(current_setting('request.jwt.claims', true), '')::jsonb
$$;

CREATE OR REPLACE FUNCTION auth.uid() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  select
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::text
$$;

CREATE OR REPLACE FUNCTION auth.role() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  select
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')::text
$$;

CREATE OR REPLACE FUNCTION auth.email() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  select
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email')::text
$$;
