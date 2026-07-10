import { describe, it, expect, afterEach, vi } from "vitest";
import { getSiteUrl } from "@/lib/site";

describe("getSiteUrl", () => {
  const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const originalVercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL;

  afterEach(() => {
    vi.unstubAllEnvs();
    if (originalSiteUrl === undefined) {
      delete process.env.NEXT_PUBLIC_SITE_URL;
    } else {
      process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl;
    }
    if (originalVercelUrl === undefined) {
      delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
    } else {
      process.env.VERCEL_PROJECT_PRODUCTION_URL = originalVercelUrl;
    }
  });

  it("returns default when env is missing", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
    expect(getSiteUrl()).toBe("https://lockbox-sigma.vercel.app");
  });

  it("returns default for invalid URL", () => {
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
    process.env.NEXT_PUBLIC_SITE_URL = "not-a-url";
    expect(getSiteUrl()).toBe("https://lockbox-sigma.vercel.app");
  });

  it("returns valid configured URL", () => {
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
    process.env.NEXT_PUBLIC_SITE_URL = "https://example.com/";
    expect(getSiteUrl()).toBe("https://example.com");
  });

  it("prefers Vercel production domain over NEXT_PUBLIC_SITE_URL", () => {
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "lockbox-sigma.vercel.app";
    process.env.NEXT_PUBLIC_SITE_URL = "https://wrong.example.com";
    expect(getSiteUrl()).toBe("https://lockbox-sigma.vercel.app");
  });

  it("ignores localhost URL in production builds", () => {
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
    vi.stubEnv("NODE_ENV", "production");
    process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
    expect(getSiteUrl()).toBe("https://lockbox-sigma.vercel.app");
  });
});
