-- Lockbox — Argon2id key hashes
-- Run after 001_initial.sql in SQL Editor.

ALTER TABLE vaults ADD COLUMN IF NOT EXISTS key_hash TEXT;

DROP POLICY IF EXISTS "anon_update_vaults_key_hash" ON vaults;
CREATE POLICY "anon_update_vaults_key_hash" ON vaults
  FOR UPDATE TO anon
  USING (true)
  WITH CHECK (key_hash IS NOT NULL);
