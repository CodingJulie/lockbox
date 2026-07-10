-- Lockbox — drop leftover plaintext filename columns.
-- Safe to re-run if 005_client_encryption.sql already dropped them.
-- Run after 005_client_encryption.sql in SQL Editor.

ALTER TABLE evidence
  DROP COLUMN IF EXISTS name,
  DROP COLUMN IF EXISTS mime_type;
