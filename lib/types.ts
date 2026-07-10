export type EvidenceType = "file" | "audio" | "video" | "text";

export interface EvidenceItem {
  id: string;
  vaultId: string;
  type: EvidenceType;
  name: string;
  mimeType: string | null;
  size: number | null;
  textContent: string | null;
  storagePath: string | null;
  createdAt: string;
}

export interface Vault {
  id: string;
  createdAt: string;
}

export interface VaultSession {
  key: string;
  vaultId: string;
}
