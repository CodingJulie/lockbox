-- Lockbox — scoped access keys for trusted people
-- Run after 002_vault_key_hash.sql in SQL Editor.

CREATE TABLE IF NOT EXISTS vault_access_keys (
  id TEXT PRIMARY KEY,
  vault_id TEXT NOT NULL REFERENCES vaults(id) ON DELETE CASCADE,
  key_hash TEXT NOT NULL,
  permissions TEXT[] NOT NULL,
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS vault_access_keys_vault_id_idx ON vault_access_keys(vault_id);

ALTER TABLE vault_access_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_insert_vault_access_keys" ON vault_access_keys;
DROP POLICY IF EXISTS "anon_select_vault_access_keys" ON vault_access_keys;
DROP POLICY IF EXISTS "anon_update_vault_access_keys" ON vault_access_keys;

CREATE POLICY "anon_insert_vault_access_keys" ON vault_access_keys
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "anon_select_vault_access_keys" ON vault_access_keys
  FOR SELECT TO anon USING (true);

CREATE POLICY "anon_update_vault_access_keys" ON vault_access_keys
  FOR UPDATE TO anon
  USING (true)
  WITH CHECK (true);
