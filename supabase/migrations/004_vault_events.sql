-- Lockbox — minimal audit log (no PII; IP stored as HMAC only)
-- Run after 003_vault_access_keys.sql in SQL Editor.

CREATE TABLE IF NOT EXISTS vault_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vault_id TEXT NOT NULL REFERENCES vaults(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('login', 'upload', 'download', 'verify_fail')),
  ip_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS vault_events_vault_id_created_at_idx
  ON vault_events (vault_id, created_at DESC);

ALTER TABLE vault_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_insert_vault_events" ON vault_events;
DROP POLICY IF EXISTS "anon_select_vault_events" ON vault_events;

CREATE POLICY "anon_insert_vault_events" ON vault_events
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "anon_select_vault_events" ON vault_events
  FOR SELECT TO anon USING (true);
