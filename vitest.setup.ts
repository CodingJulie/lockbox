import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

process.env.VAULT_HASH_PEPPER ??= "test-pepper-not-for-production";

afterEach(() => {
  cleanup();
});

if (typeof navigator !== "undefined") {
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    configurable: true,
  });
}
