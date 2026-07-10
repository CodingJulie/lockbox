import { encodeVaultKeyForTransport } from "@/lib/vault-key-codec";
import type { AppLanguage } from "@/lib/detect-locale";

/** In-memory only — cleared on page leave (see SessionGuard) */
let vaultKeyMemory: string | null = null;

export function getStoredVaultKey(): string | null {
  return vaultKeyMemory;
}

export function storeVaultKey(key: string): void {
  vaultKeyMemory = key;
}

export function clearVaultKey(): void {
  vaultKeyMemory = null;
}

export function authHeaders(): HeadersInit {
  const key = getStoredVaultKey();
  return key ? { Authorization: `Bearer ${encodeVaultKeyForTransport(key)}` } : {};
}

export async function createVault(locale: AppLanguage = "ru"): Promise<{ key: string }> {
  const res = await fetch("/api/vault", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ locale }),
  });
  const data = await res.json();
  if (!res.ok) {
    const msg = [data.error, data.hint, data.detail].filter(Boolean).join(" — ");
    throw new Error(msg || "Vault creation failed");
  }
  return data;
}

export async function verifyVaultKey(key: string): Promise<boolean> {
  const res = await fetch("/api/vault/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key }),
  });
  return res.ok;
}

export async function fetchItems() {
  const res = await fetch("/api/vault/items", { headers: authHeaders() });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Load failed");
  }
  return res.json();
}

export async function uploadFile(file: Blob, name: string, type?: string) {
  const formData = new FormData();
  formData.append("file", file, name);
  if (type) formData.append("type", type);

  const res = await fetch("/api/vault/upload", {
    method: "POST",
    headers: authHeaders(),
    body: formData,
  });
  if (!res.ok) {
    const data = await res.json();
    const msg = [data.error, data.detail].filter(Boolean).join(" — ");
    throw new Error(msg || "Upload failed");
  }
  return res.json();
}

export async function saveText(text: string, name?: string) {
  const res = await fetch("/api/vault/text", {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ text, name }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Save failed");
  }
  return res.json();
}

export async function downloadItem(id: string, filename: string) {
  const res = await fetch(`/api/vault/download/${id}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Download failed");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
