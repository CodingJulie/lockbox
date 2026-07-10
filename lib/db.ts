import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { getSupabase, isSupabaseConfigured } from "@/lib/storage/supabase";
import type {
  EvidenceRecord,
  Vault,
  VaultAccessKey,
  VaultEvent,
  VaultEventAction,
} from "@/lib/types";
import { isAccessKeyUsable, parseSessionPermissions } from "@/lib/vault-permissions";

const DATA_DIR = path.join(process.cwd(), "data");
const VAULTS_FILE = path.join(DATA_DIR, "vaults.json");
const EVIDENCE_FILE = path.join(DATA_DIR, "evidence.json");
const ACCESS_KEYS_FILE = path.join(DATA_DIR, "access-keys.json");
const EVENTS_FILE = path.join(DATA_DIR, "vault-events.json");

interface LocalDb {
  vaults: Vault[];
  evidence: EvidenceRecord[];
}

async function readLocalDb(): Promise<LocalDb> {
  try {
    const raw = await readFile(VAULTS_FILE, "utf-8");
    const vaults = JSON.parse(raw) as Vault[];
    const evidenceRaw = await readFile(EVIDENCE_FILE, "utf-8");
    const evidence = (JSON.parse(evidenceRaw) as EvidenceRecord[]).map(mapLocalEvidence);
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

export async function createVault(
  vaultId: string,
  keyHash: string,
  wrap: { wrappedDek: string; dekNonce: string }
): Promise<Vault> {
  const vault: Vault = {
    id: vaultId,
    keyHash,
    wrappedDek: wrap.wrappedDek,
    dekNonce: wrap.dekNonce,
    createdAt: new Date().toISOString(),
  };

  if (isSupabaseConfigured()) {
    const supabase = getSupabase()!;
    const { error } = await supabase.from("vaults").insert({
      id: vaultId,
      key_hash: keyHash,
      wrapped_dek: wrap.wrappedDek,
      dek_nonce: wrap.dekNonce,
    });
    if (error) throw error;
    return vault;
  }

  const db = await readLocalDb();
  db.vaults.push(vault);
  await writeLocalDb(db);
  return vault;
}

function mapVault(row: {
  id: string;
  keyHash?: string | null;
  wrappedDek?: string | null;
  dekNonce?: string | null;
  createdAt: string;
}): Vault {
  return {
    id: row.id,
    keyHash: row.keyHash ?? null,
    wrappedDek: row.wrappedDek ?? null,
    dekNonce: row.dekNonce ?? null,
    createdAt: row.createdAt,
  };
}

export async function getVault(vaultId: string): Promise<Vault | null> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabase()!;
    const { data, error } = await supabase
      .from("vaults")
      .select("id, key_hash, wrapped_dek, dek_nonce, created_at")
      .eq("id", vaultId)
      .single();
    if (error || !data) return null;
    return {
      id: data.id,
      keyHash: data.key_hash ?? null,
      wrappedDek: data.wrapped_dek ?? null,
      dekNonce: data.dek_nonce ?? null,
      createdAt: data.created_at,
    };
  }

  const db = await readLocalDb();
  const vault = db.vaults.find((v) => v.id === vaultId);
  return vault ? mapVault(vault) : null;
}

export async function updateVaultKeyHash(vaultId: string, keyHash: string): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabase()!;
    const { error } = await supabase.from("vaults").update({ key_hash: keyHash }).eq("id", vaultId);
    if (error) throw error;
    return;
  }

  const db = await readLocalDb();
  const vault = db.vaults.find((v) => v.id === vaultId);
  if (!vault) return;
  vault.keyHash = keyHash;
  await writeLocalDb(db);
}

export async function listEvidence(vaultId: string): Promise<EvidenceRecord[]> {
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
    .map(mapLocalEvidence)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function getEvidence(id: string, vaultId: string): Promise<EvidenceRecord | null> {
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
  const found = db.evidence.find((e) => e.id === id && e.vaultId === vaultId);
  return found ? mapLocalEvidence(found) : null;
}

export async function createEvidence(item: EvidenceRecord): Promise<EvidenceRecord> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabase()!;
    const { error } = await supabase.from("evidence").insert({
      id: item.id,
      vault_id: item.vaultId,
      type: item.type,
      size: item.size,
      text_content: item.textContent,
      storage_path: item.storagePath,
      content_nonce: item.contentNonce,
      encrypted_meta: item.encryptedMeta,
      created_at: item.createdAt,
    });
    if (error) throw error;
    return item;
  }

  const db = await readLocalDb();
  db.evidence.push(mapLocalEvidence(item));
  await writeLocalDb(db);
  return item;
}

function mapLocalEvidence(item: EvidenceRecord): EvidenceRecord {
  return {
    id: item.id,
    vaultId: item.vaultId,
    type: item.type,
    size: item.size ?? null,
    textContent: item.textContent ?? null,
    storagePath: item.storagePath ?? null,
    contentNonce: item.contentNonce ?? null,
    encryptedMeta: item.encryptedMeta ?? null,
    createdAt: item.createdAt,
  };
}

function mapSupabaseEvidence(row: Record<string, unknown>): EvidenceRecord {
  return {
    id: row.id as string,
    vaultId: row.vault_id as string,
    type: row.type as EvidenceRecord["type"],
    size: (row.size as number) ?? null,
    textContent: (row.text_content as string) ?? null,
    storagePath: (row.storage_path as string) ?? null,
    contentNonce: (row.content_nonce as string) ?? null,
    encryptedMeta: (row.encrypted_meta as string) ?? null,
    createdAt: row.created_at as string,
  };
}

async function readAccessKeys(): Promise<VaultAccessKey[]> {
  try {
    const raw = await readFile(ACCESS_KEYS_FILE, "utf-8");
    return JSON.parse(raw) as VaultAccessKey[];
  } catch {
    return [];
  }
}

async function writeAccessKeys(keys: VaultAccessKey[]): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(ACCESS_KEYS_FILE, JSON.stringify(keys, null, 2));
}

function mapAccessKey(row: {
  id: string;
  vaultId?: string;
  vault_id?: string;
  keyHash?: string;
  key_hash?: string;
  wrappedDek?: string | null;
  wrapped_dek?: string | null;
  dekNonce?: string | null;
  dek_nonce?: string | null;
  permissions: unknown;
  expiresAt?: string | null;
  expires_at?: string | null;
  revokedAt?: string | null;
  revoked_at?: string | null;
  createdAt?: string;
  created_at?: string;
}): VaultAccessKey | null {
  const permissions = parseSessionPermissions(row.permissions);
  if (!permissions) return null;
  return {
    id: row.id,
    vaultId: row.vaultId ?? row.vault_id ?? "",
    keyHash: row.keyHash ?? row.key_hash ?? "",
    wrappedDek: row.wrappedDek ?? row.wrapped_dek ?? null,
    dekNonce: row.dekNonce ?? row.dek_nonce ?? null,
    permissions,
    expiresAt: row.expiresAt ?? row.expires_at ?? null,
    revokedAt: row.revokedAt ?? row.revoked_at ?? null,
    createdAt: row.createdAt ?? row.created_at ?? new Date().toISOString(),
  };
}

export async function insertAccessKey(key: VaultAccessKey): Promise<VaultAccessKey> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabase()!;
    const { error } = await supabase.from("vault_access_keys").insert({
      id: key.id,
      vault_id: key.vaultId,
      key_hash: key.keyHash,
      wrapped_dek: key.wrappedDek,
      dek_nonce: key.dekNonce,
      permissions: key.permissions,
      expires_at: key.expiresAt,
      revoked_at: key.revokedAt,
      created_at: key.createdAt,
    });
    if (error) throw error;
    return key;
  }

  const keys = await readAccessKeys();
  keys.push(key);
  await writeAccessKeys(keys);
  return key;
}

export async function getAccessKeyById(id: string): Promise<VaultAccessKey | null> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabase()!;
    const { data, error } = await supabase
      .from("vault_access_keys")
      .select(
        "id, vault_id, key_hash, wrapped_dek, dek_nonce, permissions, expires_at, revoked_at, created_at"
      )
      .eq("id", id)
      .single();
    if (error || !data) return null;
    return mapAccessKey(data);
  }

  const keys = await readAccessKeys();
  const found = keys.find((key) => key.id === id);
  return found ? mapAccessKey(found) : null;
}

export async function listAccessKeysByVault(vaultId: string): Promise<VaultAccessKey[]> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabase()!;
    const { data, error } = await supabase
      .from("vault_access_keys")
      .select(
        "id, vault_id, key_hash, wrapped_dek, dek_nonce, permissions, expires_at, revoked_at, created_at"
      )
      .eq("vault_id", vaultId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapAccessKey).filter((key): key is VaultAccessKey => key !== null);
  }

  const keys = await readAccessKeys();
  return keys
    .filter((key) => key.vaultId === vaultId)
    .map(mapAccessKey)
    .filter((key): key is VaultAccessKey => key !== null)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function countActiveAccessKeys(vaultId: string): Promise<number> {
  const keys = await listAccessKeysByVault(vaultId);
  return keys.filter(isAccessKeyUsable).length;
}

export async function revokeAccessKey(id: string, vaultId: string): Promise<boolean> {
  const revokedAt = new Date().toISOString();

  if (isSupabaseConfigured()) {
    const supabase = getSupabase()!;
    const { data, error } = await supabase
      .from("vault_access_keys")
      .update({ revoked_at: revokedAt })
      .eq("id", id)
      .eq("vault_id", vaultId)
      .is("revoked_at", null)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    return Boolean(data);
  }

  const keys = await readAccessKeys();
  const key = keys.find((item) => item.id === id && item.vaultId === vaultId && !item.revokedAt);
  if (!key) return false;
  key.revokedAt = revokedAt;
  await writeAccessKeys(keys);
  return true;
}

export async function updateAccessKeyHash(id: string, keyHash: string): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabase()!;
    const { error } = await supabase
      .from("vault_access_keys")
      .update({ key_hash: keyHash })
      .eq("id", id);
    if (error) throw error;
    return;
  }

  const keys = await readAccessKeys();
  const key = keys.find((item) => item.id === id);
  if (!key) return;
  key.keyHash = keyHash;
  await writeAccessKeys(keys);
}

async function readEvents(): Promise<VaultEvent[]> {
  try {
    const raw = await readFile(EVENTS_FILE, "utf-8");
    return JSON.parse(raw) as VaultEvent[];
  } catch {
    return [];
  }
}

async function writeEvents(events: VaultEvent[]): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(EVENTS_FILE, JSON.stringify(events, null, 2));
}

const VAULT_EVENT_ACTIONS = new Set(["login", "upload", "download", "verify_fail"]);

function mapVaultEvent(row: {
  id: string;
  vaultId?: string;
  vault_id?: string;
  action: string;
  ipHash?: string;
  ip_hash?: string;
  createdAt?: string;
  created_at?: string;
}): VaultEvent | null {
  if (!VAULT_EVENT_ACTIONS.has(row.action)) return null;
  return {
    id: row.id,
    vaultId: row.vaultId ?? row.vault_id ?? "",
    action: row.action as VaultEventAction,
    ipHash: row.ipHash ?? row.ip_hash ?? "",
    createdAt: row.createdAt ?? row.created_at ?? new Date().toISOString(),
  };
}

export async function insertVaultEvent(event: VaultEvent): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabase()!;
    const { error } = await supabase.from("vault_events").insert({
      id: event.id,
      vault_id: event.vaultId,
      action: event.action,
      ip_hash: event.ipHash,
      created_at: event.createdAt,
    });
    if (error) throw error;
    return;
  }

  const events = await readEvents();
  events.push(event);
  await writeEvents(events);
}

export async function listVaultEventActions(
  vaultId: string
): Promise<Array<{ action: VaultEventAction; createdAt: string }>> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabase()!;
    const { data, error } = await supabase
      .from("vault_events")
      .select("action, created_at")
      .eq("vault_id", vaultId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? [])
      .map((row) => mapVaultEvent({ id: "", action: row.action, created_at: row.created_at }))
      .filter((event): event is VaultEvent => event !== null)
      .map((event) => ({ action: event.action, createdAt: event.createdAt }));
  }

  const events = await readEvents();
  return events
    .filter((event) => event.vaultId === vaultId)
    .map(mapVaultEvent)
    .filter((event): event is VaultEvent => event !== null)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map((event) => ({ action: event.action, createdAt: event.createdAt }));
}
