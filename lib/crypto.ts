import { createHash, randomBytes } from "crypto";
import type { AppLanguage } from "@/lib/detect-locale";

const WORDS_RU = [
  "тихий",
  "свет",
  "мост",
  "берег",
  "звезда",
  "тайна",
  "ключ",
  "щит",
  "рассвет",
  "путь",
  "сила",
  "надежда",
  "тишина",
  "рубин",
  "сапфир",
  "янтарь",
  "север",
  "юг",
  "восток",
  "запад",
  "луна",
  "солнце",
  "река",
  "гора",
  "сад",
  "поле",
  "лес",
  "океан",
  "ветер",
  "дождь",
  "снег",
  "огонь",
];

const WORDS_EN = [
  "quiet",
  "light",
  "bridge",
  "shore",
  "star",
  "secret",
  "key",
  "shield",
  "dawn",
  "path",
  "strength",
  "hope",
  "silence",
  "ruby",
  "sapphire",
  "amber",
  "north",
  "south",
  "east",
  "west",
  "moon",
  "sun",
  "river",
  "mountain",
  "garden",
  "field",
  "forest",
  "ocean",
  "wind",
  "rain",
  "snow",
  "fire",
];

const WORDS_BY_LOCALE: Record<AppLanguage, readonly string[]> = {
  ru: WORDS_RU,
  en: WORDS_EN,
};

export function hashVaultKey(key: string): string {
  return createHash("sha256").update(key.trim().toLowerCase()).digest("hex");
}

export function generateVaultKey(locale: AppLanguage = "ru"): string {
  const wordList = WORDS_BY_LOCALE[locale] ?? WORDS_RU;
  const words: string[] = [];
  const bytes = randomBytes(4);
  for (let i = 0; i < 4; i++) {
    words.push(wordList[bytes[i] % wordList.length]);
  }
  const suffix = randomBytes(2).toString("hex").toUpperCase();
  return `${words.join("-")}-${suffix}`;
}

export function normalizeVaultKey(key: string): string {
  return key.trim().toLowerCase().replace(/\s+/g, "-");
}

/** Decode key from Authorization header (base64url or legacy plain text) */
export function decodeVaultKeyFromTransport(token: string): string {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf-8");
    if (decoded.includes("-")) return normalizeVaultKey(decoded);
  } catch {
    // not base64url — use as plain key (legacy)
  }
  return normalizeVaultKey(token);
}

export function extractVaultKey(authHeader: string | null): string | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7).trim();
  if (!token) return null;
  return decodeVaultKeyFromTransport(token);
}
