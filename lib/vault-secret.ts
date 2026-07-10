import { hash, parseOptions, verify } from "@node-rs/argon2";

export const VAULT_HASH_PEPPER_MIN_LENGTH = 16;

/** Argon2id. Numeric because the package exports a const enum incompatible with isolatedModules. */
const ARGON2ID = 2;

const ARGON2_OPTIONS = {
  algorithm: ARGON2ID,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

const DUMMY_SECRET = "lockbox-dummy-not-a-vault-key";

let dummyHashCache: { pepper: string; hash: Promise<string> } | null = null;

export function getVaultHashPepper(): Uint8Array {
  const pepper = process.env.VAULT_HASH_PEPPER ?? "";
  if (pepper.length < VAULT_HASH_PEPPER_MIN_LENGTH) {
    throw new Error("VAULT_HASH_PEPPER must be set to a random secret of at least 16 characters");
  }
  return new TextEncoder().encode(pepper);
}

function argon2Options() {
  return { ...ARGON2_OPTIONS, secret: getVaultHashPepper() };
}

function dummyHash(): Promise<string> {
  const pepper = process.env.VAULT_HASH_PEPPER ?? "";
  if (dummyHashCache?.pepper === pepper) return dummyHashCache.hash;
  const hashPromise = hash(DUMMY_SECRET, argon2Options());
  dummyHashCache = { pepper, hash: hashPromise };
  return hashPromise;
}

/** Argon2id PHC string keyed with VAULT_HASH_PEPPER. */
export async function hashVaultSecret(key: string): Promise<string> {
  return hash(key, argon2Options());
}

/**
 * Verify a vault code against a stored Argon2id hash.
 * When `storedHash` is missing, still runs a dummy verify so missing vaults
 * are not cheaper than real ones.
 */
export async function verifyVaultSecret(key: string, storedHash: string | null): Promise<boolean> {
  const hashed = storedHash ?? (await dummyHash());
  try {
    return await verify(hashed, key, argon2Options());
  } catch {
    return false;
  }
}

export function vaultSecretNeedsRehash(storedHash: string): boolean {
  try {
    const parsed = parseOptions(storedHash);
    return (
      parsed.algorithm !== ARGON2_OPTIONS.algorithm ||
      parsed.memoryCost !== ARGON2_OPTIONS.memoryCost ||
      parsed.timeCost !== ARGON2_OPTIONS.timeCost ||
      parsed.parallelism !== ARGON2_OPTIONS.parallelism
    );
  } catch {
    return true;
  }
}

export function resetVaultSecretCacheForTests(): void {
  dummyHashCache = null;
}
