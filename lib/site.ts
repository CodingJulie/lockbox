const DEFAULT_SITE_URL = "https://lockbox-sigma.vercel.app";

function normalizeSiteOrigin(raw: string | undefined): string | null {
  const trimmed = raw?.trim().replace(/\/$/, "");
  if (!trimmed) return null;

  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    if (
      process.env.NODE_ENV === "production" &&
      (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1")
    ) {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

/** Prefer Vercel's production domain so og:image URLs match the live deployment. */
function getVercelProductionUrl(): string | null {
  const raw = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (!raw) return null;
  return normalizeSiteOrigin(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
}

/** Safe site URL for metadata — never throws during build */
export function getSiteUrl(): string {
  return (
    getVercelProductionUrl() ??
    normalizeSiteOrigin(process.env.NEXT_PUBLIC_SITE_URL) ??
    DEFAULT_SITE_URL
  );
}

export const ogImage = {
  url: "/og-preview.jpg",
  width: 1200,
  height: 627,
  alt: "Lockbox — secure private cloud storage",
  type: "image/jpeg",
} as const;
