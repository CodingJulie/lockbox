export const CLIPBOARD_CLEAR_MS = 30_000;

export async function copyTextTemporarily(
  text: string,
  clearAfterMs = CLIPBOARD_CLEAR_MS
): Promise<number> {
  await navigator.clipboard.writeText(text);
  return window.setTimeout(() => {
    void navigator.clipboard.writeText("").catch(() => {
      // Delayed writes are blocked without a user gesture (NotAllowedError).
    });
  }, clearAfterMs);
}
