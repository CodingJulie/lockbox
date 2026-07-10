export const VAULT_PERMISSIONS = ["read", "download", "upload", "manage"] as const;

export type VaultPermission = (typeof VAULT_PERMISSIONS)[number];

export const SUB_KEY_PERMISSIONS = ["read", "download", "upload"] as const;
export type SubKeyPermission = (typeof SUB_KEY_PERMISSIONS)[number];

export const MASTER_PERMISSIONS: VaultPermission[] = ["read", "download", "upload", "manage"];

export const ACCESS_KEY_EXPIRY_DAYS = [7, 30, 90] as const;
export type AccessKeyExpiryDays = (typeof ACCESS_KEY_EXPIRY_DAYS)[number];

export const DEFAULT_ACCESS_KEY_EXPIRY_DAYS = 30;
export const MAX_ACTIVE_ACCESS_KEYS = 20;

export const ACCESS_KEY_PRESETS = {
  lawyer: {
    permissions: ["read", "download"] as SubKeyPermission[],
  },
  upload: {
    permissions: ["upload"] as SubKeyPermission[],
  },
} as const;

export type AccessKeyPreset = keyof typeof ACCESS_KEY_PRESETS;

export function hasPermission(
  permissions: readonly VaultPermission[],
  required: VaultPermission
): boolean {
  return permissions.includes(required);
}

function isVaultPermission(value: unknown): value is VaultPermission {
  return VAULT_PERMISSIONS.includes(value as VaultPermission);
}

function isSubKeyPermission(value: unknown): value is SubKeyPermission {
  return SUB_KEY_PERMISSIONS.includes(value as SubKeyPermission);
}

/** Permissions returned by a trusted server (may include manage). */
export function parseSessionPermissions(value: unknown): VaultPermission[] | null {
  if (!Array.isArray(value)) return null;
  const unique = [...new Set(value.filter(isVaultPermission))];
  return unique.length > 0 ? unique : null;
}

/** Permissions a master may grant to a sub-key. `manage` is never allowed. */
export function parseSubKeyPermissions(value: unknown): SubKeyPermission[] | null {
  if (!Array.isArray(value)) return null;
  const unique = [...new Set(value.filter(isSubKeyPermission))];
  return unique.length > 0 ? unique : null;
}

export function parseExpiresInDays(value: unknown): AccessKeyExpiryDays | null | undefined {
  if (value === undefined) return DEFAULT_ACCESS_KEY_EXPIRY_DAYS;
  if (value === null) return null;
  if (value === 7 || value === 30 || value === 90) return value;
  return undefined;
}

export function isAccessKeyUsable(key: {
  revokedAt: string | null;
  expiresAt: string | null;
}): boolean {
  if (key.revokedAt) return false;
  if (key.expiresAt && new Date(key.expiresAt).getTime() <= Date.now()) return false;
  return true;
}
