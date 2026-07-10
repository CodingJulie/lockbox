-- Lockbox — client-side AES-256-GCM
-- Server stores ciphertext, nonce, encrypted metadata, and wrapped DEK only.
-- Filename and MIME type live in encrypted_meta; plaintext is type, size, created_at.
-- Run after 003_vault_access_keys.sql (and 004_vault_events.sql) in SQL Editor.

ALTER TABLE vaults
  ADD COLUMN IF NOT EXISTS wrapped_dek TEXT,
  ADD COLUMN IF NOT EXISTS dek_nonce TEXT;

ALTER TABLE IF EXISTS vault_access_keys
  ADD COLUMN IF NOT EXISTS wrapped_dek TEXT,
  ADD COLUMN IF NOT EXISTS dek_nonce TEXT;

ALTER TABLE evidence
  ADD COLUMN IF NOT EXISTS content_nonce TEXT,
  ADD COLUMN IF NOT EXISTS encrypted_meta TEXT,
  DROP COLUMN IF EXISTS name,
  DROP COLUMN IF EXISTS mime_type;
