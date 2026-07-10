import { randomUUID } from "crypto";
import { createVault, getVault, listEvidence, getEvidence, createEvidence } from "@/lib/db";
import { generateVaultKey, hashVaultKey, normalizeVaultKey } from "@/lib/crypto";
import { uploadFile, downloadFile } from "@/lib/storage";
import type { EvidenceItem, EvidenceType } from "@/lib/types";
import type { AppLanguage } from "@/lib/detect-locale";

export async function createNewVault(
  locale: AppLanguage = "ru"
): Promise<{ key: string; vaultId: string }> {
  const key = generateVaultKey(locale);
  const vaultId = hashVaultKey(key);
  await createVault(vaultId);
  return { key, vaultId };
}

export async function authenticateVault(key: string): Promise<string | null> {
  const normalized = normalizeVaultKey(key);
  const vaultId = hashVaultKey(normalized);
  const vault = await getVault(vaultId);
  return vault ? vaultId : null;
}

export async function getVaultItems(vaultId: string): Promise<EvidenceItem[]> {
  return listEvidence(vaultId);
}

export async function saveTextEvidence(
  vaultId: string,
  text: string,
  name?: string
): Promise<EvidenceItem> {
  const item: EvidenceItem = {
    id: randomUUID(),
    vaultId,
    type: "text",
    name: name || `Запись ${formatDate(new Date())}`,
    mimeType: "text/plain",
    size: Buffer.byteLength(text, "utf-8"),
    textContent: text,
    storagePath: null,
    createdAt: new Date().toISOString(),
  };
  return createEvidence(item);
}

export async function saveFileEvidence(
  vaultId: string,
  buffer: Buffer,
  type: EvidenceType,
  name: string,
  mimeType: string
): Promise<EvidenceItem> {
  const id = randomUUID();
  const storagePath = `${vaultId}/${id}`;
  await uploadFile(storagePath, buffer, mimeType);

  const item: EvidenceItem = {
    id,
    vaultId,
    type,
    name,
    mimeType,
    size: buffer.length,
    textContent: null,
    storagePath,
    createdAt: new Date().toISOString(),
  };
  return createEvidence(item);
}

export async function getEvidenceFile(
  vaultId: string,
  evidenceId: string
): Promise<{ item: EvidenceItem; data: Buffer } | null> {
  const item = await getEvidence(evidenceId, vaultId);
  if (!item) return null;

  if (item.type === "text" && item.textContent) {
    return { item, data: Buffer.from(item.textContent, "utf-8") };
  }

  if (!item.storagePath) return null;
  const data = await downloadFile(item.storagePath);
  return { item, data };
}

function formatDate(date: Date): string {
  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
