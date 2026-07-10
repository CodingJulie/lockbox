-- Lockbox — full Supabase migration
-- Run entirely in SQL Editor: https://supabase.com/dashboard/project/_/sql

-- ─── Tables ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vaults (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vault_id TEXT NOT NULL REFERENCES vaults(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('file', 'audio', 'video', 'text')),
  name TEXT NOT NULL,
  mime_type TEXT,
  size BIGINT,
  text_content TEXT,
  storage_path TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS evidence_vault_id_idx ON evidence(vault_id);
CREATE INDEX IF NOT EXISTS evidence_created_at_idx ON evidence(created_at DESC);

-- ─── Storage bucket ────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('evidence', 'evidence', false, 52428800)
ON CONFLICT (id) DO UPDATE SET file_size_limit = 52428800;

-- ─── Table RLS ─────────────────────────────────────────────
-- Access via publishable key; vault_id is a SHA-256 hash (not guessable)

ALTER TABLE vaults ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_insert_vaults" ON vaults;
DROP POLICY IF EXISTS "anon_select_vaults" ON vaults;
DROP POLICY IF EXISTS "anon_insert_evidence" ON evidence;
DROP POLICY IF EXISTS "anon_select_evidence" ON evidence;

CREATE POLICY "anon_insert_vaults" ON vaults
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "anon_select_vaults" ON vaults
  FOR SELECT TO anon USING (true);

CREATE POLICY "anon_insert_evidence" ON evidence
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "anon_select_evidence" ON evidence
  FOR SELECT TO anon USING (true);

-- ─── Storage RLS ─────────────────────────────────────────

DROP POLICY IF EXISTS "anon_upload_evidence" ON storage.objects;
DROP POLICY IF EXISTS "anon_download_evidence" ON storage.objects;
DROP POLICY IF EXISTS "anon_delete_evidence" ON storage.objects;

CREATE POLICY "anon_upload_evidence" ON storage.objects
  FOR INSERT TO anon
  WITH CHECK (bucket_id = 'evidence');

CREATE POLICY "anon_download_evidence" ON storage.objects
  FOR SELECT TO anon
  USING (bucket_id = 'evidence');

CREATE POLICY "anon_delete_evidence" ON storage.objects
  FOR DELETE TO anon
  USING (bucket_id = 'evidence');
