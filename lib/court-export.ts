import type { EvidenceType } from "@/lib/types";
import type { TrustedTime } from "@/lib/trusted-time";

export function sanitizeExportFilename(name: string, index: number): string {
  const cleaned = name
    .replace(/[/\\?%*:|"<>]/g, "_")
    .replace(/^\.+/g, "")
    .trim();
  const base = (cleaned || `item-${index + 1}`).slice(0, 80);
  return `${String(index + 1).padStart(3, "0")}-${base}`;
}

export type CourtManifestItem = {
  id: string;
  path: string;
  type: EvidenceType;
  size: number;
  createdAt: string;
  sha256: string;
};

export type CourtManifest = {
  format: "lockbox-court-package-v1";
  exportedAt: string;
  timeSource: TrustedTime["source"];
  chainOfCustody: string;
  items: CourtManifestItem[];
};

export function buildCourtManifest(items: CourtManifestItem[], time: TrustedTime): CourtManifest {
  return {
    format: "lockbox-court-package-v1",
    exportedAt: time.iso,
    timeSource: time.source,
    chainOfCustody: "docs/CHAIN_OF_CUSTODY.md",
    items,
  };
}

export function buildHashList(items: CourtManifestItem[]): string {
  return (
    items.map((item) => `${item.sha256}  ${item.path}`).join("\n") + (items.length ? "\n" : "")
  );
}
