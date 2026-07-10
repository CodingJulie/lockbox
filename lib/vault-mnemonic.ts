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
] as const;

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
] as const;

const WORDS_BY_LOCALE: Record<AppLanguage, readonly string[]> = {
  ru: WORDS_RU,
  en: WORDS_EN,
};

export function normalizeVaultKey(key: string): string {
  return key.trim().toLowerCase().replace(/\s+/g, "-");
}

function bytesToHexUpper(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

/** Human-readable vault code. Generated on the client — never sent to the server. */
export function generateVaultKey(locale: AppLanguage = "ru"): string {
  const wordList = WORDS_BY_LOCALE[locale] ?? WORDS_RU;
  const wordBytes = new Uint8Array(4);
  crypto.getRandomValues(wordBytes);
  const words: string[] = [];
  for (let i = 0; i < 4; i++) {
    words.push(wordList[wordBytes[i] % wordList.length]);
  }
  const suffixBytes = new Uint8Array(4);
  crypto.getRandomValues(suffixBytes);
  return `${words.join("-")}-${bytesToHexUpper(suffixBytes)}`;
}
