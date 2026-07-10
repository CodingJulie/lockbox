import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import KeyRevealDialog from "@/components/vault/KeyRevealDialog";
import { combineVaultKeyShares } from "@/lib/shamir";

vi.mock("react-i18next", () => ({
  useTranslation: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), warning: vi.fn() },
}));

function mockT(key: string, opts?: Record<string, unknown>) {
  if (opts && "n" in opts) return `${key}:${opts.n}`;
  return key;
}

describe("KeyRevealDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useTranslation as ReturnType<typeof vi.fn>).mockReturnValue({
      t: mockT,
      i18n: { language: "en" },
    });
  });

  it("keeps continue disabled until both acknowledgements are checked", async () => {
    const onConfirm = vi.fn();
    render(
      <KeyRevealDialog open vaultKey="quiet-light-bridge-shore-A1B2C3D4" onConfirm={onConfirm} />
    );

    const continueButton = screen.getByRole("button", { name: "keyDialog.continue" });
    expect(continueButton).toBeDisabled();

    await userEvent.click(screen.getByLabelText("keyDialog.confirmSaved"));
    expect(continueButton).toBeDisabled();
    await userEvent.click(continueButton);
    expect(onConfirm).not.toHaveBeenCalled();

    await userEvent.click(screen.getByLabelText("keyDialog.confirm"));
    expect(continueButton).toBeEnabled();
    await userEvent.click(continueButton);
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("does not continue if only the irrecoverable checkbox is checked", async () => {
    const onConfirm = vi.fn();
    render(
      <KeyRevealDialog open vaultKey="quiet-light-bridge-shore-A1B2C3D4" onConfirm={onConfirm} />
    );

    await userEvent.click(screen.getByLabelText("keyDialog.confirm"));
    expect(screen.getByRole("button", { name: "keyDialog.continue" })).toBeDisabled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("hides the original key and shows two reconstructable shares when split is enabled", async () => {
    const vaultKey = "quiet-light-bridge-shore-A1B2C3D4";
    render(<KeyRevealDialog open vaultKey={vaultKey} onConfirm={() => {}} />);

    expect(screen.getByText(vaultKey)).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText("keyDialog.splitToggle"));

    expect(screen.queryByText(vaultKey)).not.toBeInTheDocument();
    expect(screen.getByText("keyDialog.shareLabel:1")).toBeInTheDocument();
    expect(screen.getByText("keyDialog.shareLabel:2")).toBeInTheDocument();
    expect(screen.getByLabelText("keyDialog.confirmSavedSplit")).toBeInTheDocument();

    const share1 = screen.getByText(/^lb2\.1\./).textContent ?? "";
    const share2 = screen.getByText(/^lb2\.2\./).textContent ?? "";
    expect(combineVaultKeyShares(share1, share2)).toBe(vaultKey);
  });

  it("warns that the clipboard is unsafe and may be cleared", async () => {
    render(
      <KeyRevealDialog open vaultKey="quiet-light-bridge-shore-A1B2C3D4" onConfirm={() => {}} />
    );

    expect(screen.getByText("keyDialog.clipboardWarning")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "keyDialog.copy" }));
    expect(toast.warning).toHaveBeenCalledWith("keyDialog.clipboardCopiedWarning");
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("quiet-light-bridge-shore-A1B2C3D4");
  });
});
