-- Additive and idempotent. Separate from object sync: no raw reasoning in bootstrap.
CREATE TABLE IF NOT EXISTS agent_records (
  -- Same provider-decoupled tenant seam as the existing business tables; no auth-source FK.
  user_id varchar(64) NOT NULL,
  id text NOT NULL,
  category text NOT NULL CHECK (category IN ('session','run','memory')),
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at bigint NOT NULL,
  PRIMARY KEY (user_id, id)
);
CREATE INDEX IF NOT EXISTS agent_records_category ON agent_records(user_id, category, updated_at DESC);
ALTER TABLE agent_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_records FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_scope ON agent_records;
CREATE POLICY tenant_scope ON agent_records
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
