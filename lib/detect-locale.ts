export type AppLanguage = "en" | "ru";

export function languageFromCountry(country: string | null | undefined): AppLanguage {
  return country?.toUpperCase() === "RU" ? "ru" : "en";
}

export function readSavedLanguage(): AppLanguage | null {
  if (typeof window === "undefined") {
    return null;
  }

  const saved = localStorage.getItem("i18nextLng");
  return saved === "en" || saved === "ru" ? saved : null;
}

export async function resolveInitialLanguage(): Promise<AppLanguage> {
  const saved = readSavedLanguage();
  if (saved) {
    return saved;
  }

  try {
    const response = await fetch("/api/geo");
    if (response.ok) {
      const data = (await response.json()) as { country?: string | null };
      return languageFromCountry(data.country);
    }
  } catch {
    // Ignore geo lookup failures and fall back to English.
  }

  return "en";
}
