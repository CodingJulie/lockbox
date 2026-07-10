import { randomUUID } from "crypto";
import { hashClientIp } from "@/lib/audit-ip";
import { insertVaultEvent, listVaultEventActions } from "@/lib/db";
import { getClientIp } from "@/lib/rate-limit";
import { logServerError } from "@/lib/safe-log";
import type { VaultActivitySummary, VaultEventAction } from "@/lib/types";

export async function recordVaultEvent(
  request: Request,
  vaultId: string,
  action: VaultEventAction
): Promise<void> {
  try {
    await insertVaultEvent({
      id: randomUUID(),
      vaultId,
      action,
      ipHash: hashClientIp(getClientIp(request)),
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    logServerError("Vault event log failed:", error);
  }
}

export function summarizeVaultActivity(
  events: Array<{ action: VaultEventAction; createdAt: string }>
): VaultActivitySummary {
  let lastLoginAt: string | null = null;
  let downloads = 0;
  let uploads = 0;
  let failedVerifies = 0;

  for (const event of events) {
    if (event.action === "login" && !lastLoginAt) lastLoginAt = event.createdAt;
    if (event.action === "download") downloads += 1;
    if (event.action === "upload") uploads += 1;
    if (event.action === "verify_fail") failedVerifies += 1;
  }

  return { lastLoginAt, downloads, uploads, failedVerifies };
}

export async function getVaultActivity(vaultId: string): Promise<VaultActivitySummary> {
  const events = await listVaultEventActions(vaultId);
  return summarizeVaultActivity(events);
}
