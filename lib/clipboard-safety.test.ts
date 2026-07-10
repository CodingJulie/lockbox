import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CLIPBOARD_CLEAR_MS, copyTextTemporarily } from "@/lib/clipboard-safety";

describe("copyTextTemporarily", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(navigator.clipboard.writeText).mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("copies text then clears the clipboard after the delay", async () => {
    await copyTextTemporarily("secret");
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("secret");

    await vi.advanceTimersByTimeAsync(CLIPBOARD_CLEAR_MS);
    expect(navigator.clipboard.writeText).toHaveBeenLastCalledWith("");
  });

  it("does not surface NotAllowedError when the delayed clear is blocked", async () => {
    vi.mocked(navigator.clipboard.writeText)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new DOMException("The request is not allowed", "NotAllowedError"));

    await copyTextTemporarily("secret", 1_000);
    await vi.advanceTimersByTimeAsync(1_000);

    expect(navigator.clipboard.writeText).toHaveBeenLastCalledWith("");
  });
});
