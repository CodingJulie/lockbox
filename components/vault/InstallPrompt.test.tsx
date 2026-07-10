import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useTranslation } from "react-i18next";
import { beforeEach, describe, expect, it, vi } from "vitest";
import InstallPrompt from "@/components/vault/InstallPrompt";
import { usePwaInstall } from "@/hooks/use-pwa-install";

vi.mock("react-i18next", () => ({
  useTranslation: vi.fn(),
}));

vi.mock("@/hooks/use-pwa-install", () => ({
  usePwaInstall: vi.fn(),
}));

describe("InstallPrompt", () => {
  const mockInstall = vi.fn();
  const mockDismiss = vi.fn();
  const mockSetIosDialogOpen = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useTranslation as ReturnType<typeof vi.fn>).mockReturnValue({
      t: (key: string) => {
        const labels: Record<string, string> = {
          "install.bannerTitle": "Install Lockbox",
          "install.bannerDescription": "Add to home screen",
          "install.installButton": "Install",
          "install.dismiss": "Dismiss",
          "install.iosDialogTitle": "Add to Home Screen",
          "install.iosStep1": "Tap Share in Safari",
          "install.iosStep2": 'Select "Add to Home Screen"',
          "install.iosStep3": 'Tap "Add"',
          "install.iosGotIt": "Got it",
        };
        return labels[key] ?? key;
      },
    });
    (usePwaInstall as ReturnType<typeof vi.fn>).mockReturnValue({
      visible: true,
      iosDialogOpen: false,
      setIosDialogOpen: mockSetIosDialogOpen,
      install: mockInstall,
      dismiss: mockDismiss,
      isIOS: false,
    });
  });

  it("renders banner when visible", () => {
    render(<InstallPrompt />);
    expect(screen.getByText("Install Lockbox")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Install" })).toBeInTheDocument();
  });

  it("calls install on button click", async () => {
    render(<InstallPrompt />);
    await userEvent.click(screen.getByRole("button", { name: "Install" }));
    expect(mockInstall).toHaveBeenCalledOnce();
  });

  it("calls dismiss on close button click", async () => {
    render(<InstallPrompt />);
    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(mockDismiss).toHaveBeenCalledOnce();
  });

  it("renders nothing when not visible", () => {
    (usePwaInstall as ReturnType<typeof vi.fn>).mockReturnValue({
      visible: false,
      iosDialogOpen: false,
      setIosDialogOpen: mockSetIosDialogOpen,
      install: mockInstall,
      dismiss: mockDismiss,
      isIOS: false,
    });
    render(<InstallPrompt />);
    expect(screen.queryByText("Install Lockbox")).not.toBeInTheDocument();
  });
});
