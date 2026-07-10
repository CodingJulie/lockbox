/** GF(256) Shamir secret sharing. AES polynomial 0x11b. */

export interface ShamirShare {
  x: number;
  y: Uint8Array;
}

export class ShareError extends Error {
  readonly code: "invalid" | "mismatch" | "incomplete";

  constructor(code: "invalid" | "mismatch" | "incomplete", message: string) {
    super(message);
    this.name = "ShareError";
    this.code = code;
  }
}

const SHARE_PREFIX = "lb2";
const SHARE_VERSION = 1;
const SHARE_ID_LENGTH = 4;
const VAULT_SHARE_COUNT = 2;
const VAULT_SHARE_THRESHOLD = 2;

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

function gfMul(a: number, b: number): number {
  let p = 0;
  for (let i = 0; i < 8; i++) {
    if (b & 1) p ^= a;
    const hi = a & 0x80;
    a = (a << 1) & 0xff;
    if (hi) a ^= 0x1b;
    b >>= 1;
  }
  return p;
}

function gfPow(a: number, exp: number): number {
  let result = 1;
  let base = a;
  let e = exp;
  while (e > 0) {
    if (e & 1) result = gfMul(result, base);
    base = gfMul(base, base);
    e >>= 1;
  }
  return result;
}

function gfInv(a: number): number {
  if (a === 0) throw new ShareError("invalid", "Division by zero in GF(256)");
  return gfPow(a, 254);
}

function evalPoly(coefficients: Uint8Array, x: number): number {
  let y = 0;
  for (let i = coefficients.length - 1; i >= 0; i--) {
    y = gfMul(y, x) ^ coefficients[i];
  }
  return y;
}

function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

function interpolateSecret(xs: number[], ys: number[]): number {
  let secret = 0;
  for (let i = 0; i < xs.length; i++) {
    let num = 1;
    let den = 1;
    for (let j = 0; j < xs.length; j++) {
      if (i === j) continue;
      num = gfMul(num, xs[j]);
      den = gfMul(den, xs[j] ^ xs[i]);
    }
    secret ^= gfMul(ys[i], gfMul(num, gfInv(den)));
  }
  return secret;
}

export function splitSecret(
  secret: Uint8Array,
  shareCount = VAULT_SHARE_COUNT,
  threshold = VAULT_SHARE_THRESHOLD,
  random: (length: number) => Uint8Array = randomBytes
): ShamirShare[] {
  if (secret.length === 0) throw new ShareError("invalid", "Secret is empty");
  if (threshold < 2 || shareCount < threshold || shareCount > 255) {
    throw new ShareError("invalid", "Invalid share parameters");
  }

  const shares: ShamirShare[] = Array.from({ length: shareCount }, (_, index) => ({
    x: index + 1,
    y: new Uint8Array(secret.length),
  }));

  for (let byteIndex = 0; byteIndex < secret.length; byteIndex++) {
    const coefficients = new Uint8Array(threshold);
    coefficients[0] = secret[byteIndex];
    for (let degree = 1; degree < threshold; degree++) {
      let coefficient = 0;
      while (coefficient === 0) coefficient = random(1)[0];
      coefficients[degree] = coefficient;
    }
    for (const share of shares) {
      share.y[byteIndex] = evalPoly(coefficients, share.x);
    }
  }

  return shares;
}

export function combineSecret(
  shares: ShamirShare[],
  threshold = VAULT_SHARE_THRESHOLD
): Uint8Array {
  if (shares.length < threshold) {
    throw new ShareError("incomplete", "Not enough shares to reconstruct");
  }

  const length = shares[0]?.y.length ?? 0;
  if (length === 0) throw new ShareError("invalid", "Shares are empty");

  const uniqueX = new Set<number>();
  for (const share of shares) {
    if (share.x < 1 || share.x > 255 || share.y.length !== length) {
      throw new ShareError("mismatch", "Shares are damaged or do not match");
    }
    if (uniqueX.has(share.x)) {
      throw new ShareError("mismatch", "Shares are damaged or do not match");
    }
    uniqueX.add(share.x);
  }

  const used = shares.slice(0, threshold);
  const xs = used.map((share) => share.x);
  const secret = new Uint8Array(length);
  for (let byteIndex = 0; byteIndex < length; byteIndex++) {
    secret[byteIndex] = interpolateSecret(
      xs,
      used.map((share) => share.y[byteIndex])
    );
  }
  return secret;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBytes(value: string): Uint8Array {
  const padded =
    value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (value.length % 4)) % 4);
  try {
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    throw new ShareError("invalid", "Share encoding is invalid");
  }
}

function encodeShare(share: ShamirShare, id: Uint8Array): string {
  const payload = new Uint8Array(2 + SHARE_ID_LENGTH + share.y.length);
  payload[0] = SHARE_VERSION;
  payload[1] = share.x;
  payload.set(id, 2);
  payload.set(share.y, 2 + SHARE_ID_LENGTH);
  return `${SHARE_PREFIX}.${share.x}.${bytesToBase64Url(payload)}`;
}

function decodeShare(value: string): { share: ShamirShare; id: Uint8Array } {
  const normalized = value.trim().replace(/\s+/g, "");
  const match = /^lb2\.([1-9]\d*)\.([A-Za-z0-9_-]+)$/.exec(normalized);
  if (!match) throw new ShareError("invalid", "Share encoding is invalid");

  const declaredX = Number(match[1]);
  const payload = base64UrlToBytes(match[2]);
  if (payload.length <= 2 + SHARE_ID_LENGTH) {
    throw new ShareError("invalid", "Share encoding is invalid");
  }
  if (payload[0] !== SHARE_VERSION) {
    throw new ShareError("invalid", "Share encoding is invalid");
  }

  const x = payload[1];
  if (x !== declaredX) throw new ShareError("mismatch", "Shares are damaged or do not match");

  return {
    id: payload.slice(2, 2 + SHARE_ID_LENGTH),
    share: { x, y: payload.slice(2 + SHARE_ID_LENGTH) },
  };
}

export function looksLikeVaultShare(value: string): boolean {
  return /^lb2\.[1-9]\d*\./i.test(value.trim().replace(/\s+/g, ""));
}

export function splitVaultKey(key: string): [string, string] {
  const secret = new TextEncoder().encode(key);
  const id = randomBytes(SHARE_ID_LENGTH);
  const [first, second] = splitSecret(secret);
  return [encodeShare(first, id), encodeShare(second, id)];
}

export function combineVaultKeyShares(shareA: string, shareB: string): string {
  if (!shareA.trim() || !shareB.trim()) {
    throw new ShareError("incomplete", "Both shares are required");
  }

  const decodedA = decodeShare(shareA);
  const decodedB = decodeShare(shareB);
  if (!equalBytes(decodedA.id, decodedB.id)) {
    throw new ShareError("mismatch", "Shares are damaged or do not match");
  }

  const secret = combineSecret([decodedA.share, decodedB.share]);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(secret);
  } catch {
    throw new ShareError("mismatch", "Shares are damaged or do not match");
  }
}
