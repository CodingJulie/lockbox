import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { languageFromCountry, readSavedLanguage, resolveInitialLanguage } from "./detect-locale";

describe("languageFromCountry", () => {
  it("returns ru for Russia", () => {
    expect(languageFromCountry("RU")).toBe("ru");
    expect(languageFromCountry("ru")).toBe("ru");
  });

  it("returns en for other countries", () => {
    expect(languageFromCountry("US")).toBe("en");
    expect(languageFromCountry("DE")).toBe("en");
  });

  it("returns en when country is missing", () => {
    expect(languageFromCountry(null)).toBe("en");
    expect(languageFromCountry(undefined)).toBe("en");
  });
});

describe("readSavedLanguage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns saved language when present", () => {
    localStorage.setItem("i18nextLng", "ru");
    expect(readSavedLanguage()).toBe("ru");
  });

  it("returns null for unsupported saved values", () => {
    localStorage.setItem("i18nextLng", "fr");
    expect(readSavedLanguage()).toBeNull();
  });
});

describe("resolveInitialLanguage", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("prefers saved language over geo lookup", async () => {
    localStorage.setItem("i18nextLng", "en");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(resolveInitialLanguage()).resolves.toBe("en");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses geo lookup when no saved language is present", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ country: "RU" }),
      })
    );

    await expect(resolveInitialLanguage()).resolves.toBe("ru");
  });

  it("falls back to en when geo lookup fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    await expect(resolveInitialLanguage()).resolves.toBe("en");
  });
});
