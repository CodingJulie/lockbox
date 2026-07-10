import { clearVaultKey } from "@/lib/vault-client";
import { wipeOfflineQueue } from "@/lib/offline-queue";

/** Neutral weather site — looks like a glance at the forecast, not an app exit. */
export const PANIC_REDIRECT_URL = "https://www.bbc.com/weather";

const WIPE_TIMEOUT_MS = 1500;

async function unregisterClients(): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.map((registration) => registration.unregister()));
}

async function clearCaches(): Promise<void> {
  if (typeof caches === "undefined") return;
  const keys = await caches.keys();
  await Promise.all(keys.map((key) => caches.delete(key)));
}

export async function panicWipe(): Promise<void> {
  clearVaultKey();
  try {
    await navigator.clipboard.writeText("");
  } catch {
    // Clipboard may be locked without a gesture.
  }
  try {
    localStorage.clear();
  } catch {
    // Private mode can block storage.
  }
  try {
    sessionStorage.clear();
  } catch {
    // Ignore.
  }
  await wipeOfflineQueue();
  await Promise.all([unregisterClients(), clearCaches()]);
}

/** Clears RAM, local traces, then replaces history with a neutral site. */
export async function panicExit(redirectUrl = PANIC_REDIRECT_URL): Promise<void> {
  await Promise.race([
    panicWipe(),
    new Promise<void>((resolve) => {
      window.setTimeout(resolve, WIPE_TIMEOUT_MS);
    }),
  ]);
  window.location.replace(redirectUrl);
}
