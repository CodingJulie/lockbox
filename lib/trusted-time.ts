export type TrustedTime = {
  iso: string;
  unix: number;
  source: "lockbox-runtime" | "client-fallback";
};

export async function fetchTrustedTime(): Promise<TrustedTime> {
  try {
    const response = await fetch("/api/time", { cache: "no-store" });
    if (!response.ok) throw new Error("time unavailable");
    const data = (await response.json()) as Partial<TrustedTime>;
    if (typeof data.iso !== "string" || typeof data.unix !== "number") {
      throw new Error("time unavailable");
    }
    return { iso: data.iso, unix: data.unix, source: "lockbox-runtime" };
  } catch {
    const now = new Date();
    return {
      iso: now.toISOString(),
      unix: Math.floor(now.getTime() / 1000),
      source: "client-fallback",
    };
  }
}
