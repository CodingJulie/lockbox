import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import HomePage from "@/components/home/HomePage";
import { createVault, CreateVaultError, getStoredVaultKey } from "@/lib/vault-client";

vi.mock("react-i18next", () => ({
  useTranslation: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn() },
}));

vi.mock("@/lib/vault-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/vault-client")>();
  return {
    ...actual,
    createVault: vi.fn(),
    getStoredVaultKey: vi.fn(() => null),
    verifyVaultKey: vi.fn(),
    storeVaultKey: vi.fn(),
  };
});

vi.mock("@/components/vault/KeyRevealDialog", () => ({ default: () => null }));
vi.mock("@/components/vault/AccessDialog", () => ({ default: () => null }));
vi.mock("@/components/vault/VaultDashboard", () => ({ default: () => null }));

describe("HomePage vault create limit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getStoredVaultKey as ReturnType<typeof vi.fn>).mockReturnValue(null);
    (useTranslation as ReturnType<typeof vi.fn>).mockReturnValue({
      t: (key: string) =>
        key === "toast.createRateLimited"
          ? "Too many vaults created from this address. Try again tomorrow."
          : key,
      i18n: { language: "en" },
    });
  });

  it("shows a localized toast when vault creation is rate-limited", async () => {
    vi.mocked(createVault).mockRejectedValue(
      new CreateVaultError("rate_limited", "Слишком много хранилищ. Попробуйте позже.")
    );

    render(<HomePage />);
    await userEvent.click(await screen.findByRole("button", { name: "app.createVaultAria" }));

    expect(toast.error).toHaveBeenCalledWith(
      "Too many vaults created from this address. Try again tomorrow."
    );
  });
});
