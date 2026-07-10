import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useTranslation } from "react-i18next";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AccessDialog from "@/components/vault/AccessDialog";
import { splitVaultKey } from "@/lib/shamir";
import { storeVaultKey, verifyVaultKey } from "@/lib/vault-client";

vi.mock("react-i18next", () => ({
  useTranslation: vi.fn(),
}));

vi.mock("@/lib/vault-client", () => ({
  verifyVaultKey: vi.fn(),
  storeVaultKey: vi.fn(),
}));

function mockT(key: string, opts?: Record<string, unknown>) {
  if (opts && "n" in opts) return `${key}:${opts.n}`;
  return key;
}

describe("AccessDialog shares", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useTranslation as ReturnType<typeof vi.fn>).mockReturnValue({
      t: mockT,
      i18n: { language: "en" },
    });
  });

  it("combines two shares locally before verifying the reconstructed key", async () => {
    const vaultKey = "quiet-light-bridge-shore-A1B2C3D4";
    const [share1, share2] = splitVaultKey(vaultKey);
    vi.mocked(verifyVaultKey).mockResolvedValue({
      ok: true,
      role: "master",
      permissions: ["read", "download", "upload", "manage"],
    });

    const onSuccess = vi.fn();
    render(<AccessDialog open onOpenChange={() => {}} onSuccess={onSuccess} />);

    await userEvent.click(screen.getByRole("button", { name: "accessDialog.useShares" }));
    await userEvent.type(screen.getByLabelText("accessDialog.sharePlaceholder:1"), share1);
    await userEvent.type(screen.getByLabelText("accessDialog.sharePlaceholder:2"), share2);
    await userEvent.click(screen.getByRole("button", { name: "accessDialog.submit" }));

    expect(verifyVaultKey).toHaveBeenCalledWith(vaultKey);
    expect(storeVaultKey).toHaveBeenCalledWith(
      vaultKey,
      expect.objectContaining({ role: "master" })
    );
    expect(onSuccess).toHaveBeenCalledOnce();
  });

  it("does not call the server when shares cannot be combined", async () => {
    const first = splitVaultKey("quiet-light-bridge-shore-A1B2C3D4");
    const second = splitVaultKey("quiet-light-bridge-shore-FFFF0000");

    render(<AccessDialog open onOpenChange={() => {}} onSuccess={() => {}} />);

    await userEvent.click(screen.getByRole("button", { name: "accessDialog.useShares" }));
    await userEvent.type(screen.getByLabelText("accessDialog.sharePlaceholder:1"), first[0]);
    await userEvent.type(screen.getByLabelText("accessDialog.sharePlaceholder:2"), second[1]);
    await userEvent.click(screen.getByRole("button", { name: "accessDialog.submit" }));

    expect(verifyVaultKey).not.toHaveBeenCalled();
    expect(screen.getByText("accessDialog.shareMismatch")).toBeInTheDocument();
  });
});
