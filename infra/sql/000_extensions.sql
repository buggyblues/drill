-- 扩展。两套后端都支持这三个。
-- CloudBase 的托管 PostgreSQL 可能需要在控制台预先启用扩展，这里的 IF NOT EXISTS 就会成为空操作。
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS vector;
