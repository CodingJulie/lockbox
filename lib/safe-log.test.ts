import { describe, expect, it, vi } from "vitest";
import { logServerError, redactSecrets } from "@/lib/safe-log";

describe("redactSecrets", () => {
  it("redacts Authorization headers and Bearer tokens", () => {
    expect(redactSecrets("Authorization: Bearer abc.def")).toBe("Authorization: [REDACTED]");
    expect(redactSecrets("failed Bearer vaultid.proofvalue extra")).toBe(
      "failed Bearer [REDACTED] extra"
    );
  });
});

describe("logServerError", () => {
  it("logs only the redacted message, not the Error object", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    logServerError("Upload failed:", new Error("Authorization: Bearer secret-token"));
    expect(spy).toHaveBeenCalledWith("Upload failed:", "Authorization: [REDACTED]");
    expect(JSON.stringify(spy.mock.calls)).not.toContain("secret-token");
    spy.mockRestore();
  });
});
