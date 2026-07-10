import { createHmac } from "crypto";
import { getVaultHashPepper } from "@/lib/vault-secret";

const AUDIT_IP_SALT_MIN_LENGTH = 16;

function getAuditIpSalt(): Uint8Array | string {
  const explicit = process.env.AUDIT_IP_SALT ?? "";
  if (explicit.length >= AUDIT_IP_SALT_MIN_LENGTH) return explicit;
  return getVaultHashPepper();
}

/** HMAC-SHA256(IP, salt). Never store or return the raw IP. */
export function hashClientIp(ip: string): string {
  return createHmac("sha256", getAuditIpSalt()).update(ip).digest("hex");
}
