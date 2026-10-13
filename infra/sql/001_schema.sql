-- 表结构。自托管与 CloudBase 共用同一份。
--
-- 两条与迁移有关的约定：
--  1. user_id 统一为 varchar(64)，与 CloudBase 的 auth.users.id 同型，
--     迁移时 ID 可以直接对应，不需要转换。
--  2. objects.user_id **不建**指向 users(id) 的外键。
--     租户边界由 RLS 保证；不加外键，换认证源时业务表一行都不用动。
--     业务数据与「用户是谁」之间只有 user_id 这一个字符串作为接缝。

CREATE TABLE IF NOT EXISTS schema_migrations(version text primary key, applied_at timestamptz default now());

-- 用户档案（时区与偏好）。这是档案表，不是身份表——
-- 身份由 Auth 接口背后的实现负责（自托管口令 / CloudBase 身份认证 / 以后的其他源）。
CREATE TABLE IF NOT EXISTS users(
 id varchar(64) primary key,
 timezone text NOT NULL default 'Asia/Shanghai',
 created_at bigint NOT NULL,
 settings jsonb NOT NULL default '{}'
);

-- 类型定义是数据，不是客户端常量。共用，不按租户隔离。
-- relations 是每种 kind 的关系声明：允许建立哪几种关系、指向哪些 kind、能不能有多个。
-- 形如 {"belongs":{"targets":["domain","project"],"multiple":false}}。空 {} = 用默认。
CREATE TABLE IF NOT EXISTS kinds(id text primary key,label text NOT NULL,icon text,color text,properties jsonb NOT NULL default '{}',relations jsonb NOT NULL default '{}',sort integer);

CREATE TABLE IF NOT EXISTS objects(
 id text NOT NULL,user_id varchar(64) NOT NULL,kind text REFERENCES kinds(id),form text NOT NULL CHECK(form IN ('text','image','audio','video','link','canvas')),
 title text NOT NULL default '',body text NOT NULL default '',body_blocks jsonb NOT NULL default '{"blocks":[]}',series text,tags_cached text[] NOT NULL default '{}',status text,due_at bigint,sort_key text,supersedes_id text,applies_to text[] NOT NULL default '{}',ephemeral boolean NOT NULL default false,asset_id text,source_id text,source_ref text,source_version text,extra jsonb NOT NULL default '{}',captured_at bigint NOT NULL,confirmed_at bigint,valid_until bigint,rev integer NOT NULL,created_at bigint NOT NULL,updated_at bigint NOT NULL,deleted_at bigint,search_vector tsvector,
 PRIMARY KEY(user_id,id),FOREIGN KEY(user_id,supersedes_id) REFERENCES objects(user_id,id) DEFERRABLE INITIALLY DEFERRED
);
CREATE INDEX IF NOT EXISTS objects_captured ON objects(user_id,captured_at DESC) WHERE deleted_at IS NULL AND NOT ephemeral;
CREATE INDEX IF NOT EXISTS objects_trgm ON objects USING gin ((title||' '||body) gin_trgm_ops) WHERE deleted_at IS NULL AND NOT ephemeral;
CREATE TABLE IF NOT EXISTS object_tags(user_id varchar(64) NOT NULL,object_id text NOT NULL,tag text NOT NULL,deleted_at bigint,PRIMARY KEY(user_id,object_id,tag),FOREIGN KEY(user_id,object_id) REFERENCES objects(user_id,id));
CREATE TABLE IF NOT EXISTS object_aliases(user_id varchar(64) NOT NULL,object_id text NOT NULL,alias text NOT NULL,PRIMARY KEY(user_id,object_id,alias));
-- 对象之间只有一张关系表。type 说的是「这条边是什么意思」：
--   belongs = 归属。from 归属于 to。可以多对多，由 kinds.relations 声明约束。
--   cite    = 引用。from 引用了 to，来自 [[X]] 或手工连线。
-- source_field 说的是「这条边从哪来」（manual / canvas / title / body），和 type 正交。
-- 两个都要进主键：同一对对象之间可以既归属又引用。
CREATE TABLE IF NOT EXISTS relations(user_id varchar(64) NOT NULL,from_id text NOT NULL,to_id text NOT NULL,type text NOT NULL default 'cite',source_field text NOT NULL default 'manual',source_block_id text NOT NULL default '',created_at bigint,deleted_at bigint,PRIMARY KEY(user_id,from_id,type,to_id,source_field,source_block_id),FOREIGN KEY(user_id,from_id) REFERENCES objects(user_id,id),FOREIGN KEY(user_id,to_id) REFERENCES objects(user_id,id));
-- relations 的索引在 002_migrate.sql 里建。
--
-- 原因：这个文件在存量库上会被整段跳过（表已存在），但 CREATE INDEX 不是——
-- PostgreSQL 在检查索引名之前就解析列引用，所以 `CREATE INDEX IF NOT EXISTS
-- relations_from ON relations(user_id,type,from_id)` 会在还没有 type 列的旧库上报
-- `column "type" does not exist`，索引名重名也拦不住。
-- 规则：001 里的语句不得引用「只有升级文件才会加上」的列。
CREATE TABLE IF NOT EXISTS placements(user_id varchar(64) NOT NULL,canvas_id text NOT NULL,object_id text NOT NULL,x real NOT NULL,y real NOT NULL,w real NOT NULL,h real NOT NULL,z integer NOT NULL,display text,group_id text,deleted_at bigint,PRIMARY KEY(user_id,canvas_id,object_id),FOREIGN KEY(user_id,canvas_id) REFERENCES objects(user_id,id),FOREIGN KEY(user_id,object_id) REFERENCES objects(user_id,id));
CREATE TABLE IF NOT EXISTS assets(user_id varchar(64) NOT NULL,id text NOT NULL,hash text NOT NULL,size bigint NOT NULL,mime text NOT NULL,storage_key text NOT NULL,thumb_key text,width integer,height integer,duration real,created_at bigint,committed boolean NOT NULL default false,provider_data jsonb,PRIMARY KEY(user_id,id));
CREATE INDEX IF NOT EXISTS asset_dedupe ON assets(user_id,hash,size) WHERE committed;
CREATE TABLE IF NOT EXISTS object_assets(user_id varchar(64) NOT NULL,object_id text NOT NULL,asset_id text NOT NULL,role text NOT NULL,PRIMARY KEY(user_id,object_id,asset_id,role));
CREATE TABLE IF NOT EXISTS versions(user_id varchar(64) NOT NULL,object_id text NOT NULL,rev integer NOT NULL,snapshot jsonb NOT NULL,created_at bigint,PRIMARY KEY(user_id,object_id,rev));
CREATE TABLE IF NOT EXISTS conflicts(user_id varchar(64) NOT NULL,id text NOT NULL,object_id text NOT NULL,field text,base_rev integer,server_rev integer,resolution text,device_id text,created_at bigint,losing_value jsonb,PRIMARY KEY(user_id,id));
CREATE TABLE IF NOT EXISTS distill_sessions(user_id varchar(64) NOT NULL,id text NOT NULL,created_at bigint,scope jsonb,PRIMARY KEY(user_id,id));
CREATE TABLE IF NOT EXISTS proposals(user_id varchar(64) NOT NULL,id text NOT NULL,session_id text,object_id text,field text,ai_value jsonb,final_value jsonb,status text,decided_at bigint,PRIMARY KEY(user_id,id));
CREATE TABLE IF NOT EXISTS changes(seq bigserial PRIMARY KEY,user_id varchar(64) NOT NULL,device_id text,object_id text,field text,value jsonb,base_rev integer,client_ts bigint,created_at bigint,mutation_id text NOT NULL,UNIQUE(user_id,mutation_id));
CREATE INDEX IF NOT EXISTS changes_pull ON changes(user_id,seq);
CREATE TABLE IF NOT EXISTS devices(user_id varchar(64) NOT NULL,id text NOT NULL,name text,last_seq bigint,last_seen bigint,PRIMARY KEY(user_id,id));
CREATE TABLE IF NOT EXISTS sources(user_id varchar(64) NOT NULL,id text NOT NULL,type text,connector text,name text,properties jsonb,config jsonb,anchor jsonb,state jsonb,last_synced bigint,enabled boolean,PRIMARY KEY(user_id,id));
CREATE TABLE IF NOT EXISTS embeddings(user_id varchar(64) NOT NULL,object_id text NOT NULL,chunk_id text NOT NULL,model text NOT NULL,vec vector(1024),content_hash text,PRIMARY KEY(user_id,object_id,chunk_id,model));
-- 协议层需要的：逐字段时钟 + 稳定的幂等键。
CREATE TABLE IF NOT EXISTS field_clocks(user_id varchar(64) NOT NULL,key text NOT NULL,value jsonb NOT NULL,PRIMARY KEY(user_id,key));
CREATE TABLE IF NOT EXISTS applied_mutations(user_id varchar(64) NOT NULL,id text NOT NULL,PRIMARY KEY(user_id,id));
