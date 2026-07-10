import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { getSupabase, isSupabaseConfigured } from "@/lib/storage/supabase";
import type { EvidenceItem, Vault } from "@/lib/types";

const DATA_DIR = path.join(process.cwd(), "data");
const VAULTS_FILE = path.join(DATA_DIR, "vaults.json");
const EVIDENCE_FILE = path.join(DATA_DIR, "evidence.json");

interface LocalDb {
  vaults: Vault[];
  evidence: EvidenceItem[];
}

async function readLocalDb(): Promise<LocalDb> {
  try {
    const raw = await readFile(VAULTS_FILE, "utf-8");
    const vaults = JSON.parse(raw) as Vault[];
    const evidenceRaw = await readFile(EVIDENCE_FILE, "utf-8");
    const evidence = JSON.parse(evidenceRaw) as EvidenceItem[];
    return { vaults, evidence };
  } catch {
    return { vaults: [], evidence: [] };
  }
}

async function writeLocalDb(db: LocalDb): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(VAULTS_FILE, JSON.stringify(db.vaults, null, 2));
  await writeFile(EVIDENCE_FILE, JSON.stringify(db.evidence, null, 2));
}

export async function createVault(vaultId: string): Promise<Vault> {
  const vault: Vault = { id: vaultId, createdAt: new Date().toISOString() };

  if (isSupabaseConfigured()) {
    const supabase = getSupabase()!;
    const { error } = await supabase.from("vaults").insert({ id: vaultId });
    if (error) throw error;
    return vault;
  }

  const db = await readLocalDb();
  db.vaults.push(vault);
  await writeLocalDb(db);
  return vault;
}

export async function getVault(vaultId: string): Promise<Vault | null> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabase()!;
    const { data, error } = await supabase
      .from("vaults")
      .select("id, created_at")
      .eq("id", vaultId)
      .single();
    if (error || !data) return null;
    return { id: data.id, createdAt: data.created_at };
  }

  const db = await readLocalDb();
  return db.vaults.find((v) => v.id === vaultId) ?? null;
}

export async function listEvidence(vaultId: string): Promise<EvidenceItem[]> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabase()!;
    const { data, error } = await supabase
      .from("evidence")
      .select("*")
      .eq("vault_id", vaultId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapSupabaseEvidence);
  }

  const db = await readLocalDb();
  return db.evidence
    .filter((e) => e.vaultId === vaultId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function getEvidence(id: string, vaultId: string): Promise<EvidenceItem | null> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabase()!;
    const { data, error } = await supabase
      .from("evidence")
      .select("*")
      .eq("id", id)
      .eq("vault_id", vaultId)
      .single();
    if (error || !data) return null;
    return mapSupabaseEvidence(data);
  }

  const db = await readLocalDb();
  return db.evidence.find((e) => e.id === id && e.vaultId === vaultId) ?? null;
}

export async function createEvidence(item: EvidenceItem): Promise<EvidenceItem> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabase()!;
    const { error } = await supabase.from("evidence").insert({
      id: item.id,
      vault_id: item.vaultId,
      type: item.type,
      name: item.name,
      mime_type: item.mimeType,
      size: item.size,
      text_content: item.textContent,
      storage_path: item.storagePath,
      created_at: item.createdAt,
    });
    if (error) throw error;
    return item;
  }

  const db = await readLocalDb();
  db.evidence.push(item);
  await writeLocalDb(db);
  return item;
}

function mapSupabaseEvidence(row: Record<string, unknown>): EvidenceItem {
  return {
    id: row.id as string,
    vaultId: row.vault_id as string,
    type: row.type as EvidenceItem["type"],
    name: row.name as string,
    mimeType: (row.mime_type as string) ?? null,
    size: (row.size as number) ?? null,
    textContent: (row.text_content as string) ?? null,
    storagePath: (row.storage_path as string) ?? null,
    createdAt: row.created_at as string,
  };
}
